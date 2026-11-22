#!/usr/bin/env python3
"""
content-graph-analysis.py — Editorial graph analysis for one paper of a folio.

Builds a block-level and chapter/section-level dependency graph from content
.ts manifests.  Applies heuristics to detect forward references,
cross-chapter/cross-section coupling, sparse/dense sections, and isolated
blocks.  Outputs a ranked report and optional Graphviz SVG visualisations.

Usage:
    python3 cat-harness-tools/pipeline/content-graph-analysis.py [options]

    Run it from the folio (content) repository. The paper is `--paper`, or
    the folio's only paper when it holds exactly one; there is no default
    paper name, because the platform must not privilege one folio.

Options:
    --paper <dir>     The paper: a directory name under the folio directory,
                      or a path to the paper directory. Required when the
                      folio holds several papers.
    --content-root <dir>
                      The folio directory that holds the papers. Default: the
                      nearest `folio/` or `content/` directory, walking up
                      from the current directory, that holds a paper.
    --chapter <dir>   Restrict analysis to one chapter directory
    --visualise       Render Graphviz DOT files to SVG (requires graphviz)
    --json            Emit full graph as JSON to stdout and exit
    --md              Write report to /tmp/content-graph-report.md
    --help            Show this message
"""

import sys
import re
import json
import argparse
import subprocess
from collections import defaultdict
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────

# A paper is a directory `<root>/<paper>/` holding a same-named manifest
# `<paper>.ts` (the same rule as `findPapers` in pipeline/repo-root.ts, which
# Python cannot import). The folio directory is declared per instance and
# defaults to `folio/`; `content/` is still accepted for folios that keep it.
FOLIO_DIR_NAMES = ("folio", "content")


def find_papers(root: Path) -> list[str]:
    """Paper directory names under `root`, sorted."""
    if not root.is_dir():
        return []
    return sorted(
        d.name for d in root.iterdir()
        if d.is_dir() and not d.name.startswith(".") and (d / f"{d.name}.ts").is_file()
    )


def find_content_root(start: Path) -> Path | None:
    """The nearest folio directory holding at least one paper, walking up from `start`."""
    for d in [start, *start.parents][:12]:
        for name in FOLIO_DIR_NAMES:
            cand = d / name
            if find_papers(cand):
                return cand
    return None


def resolve_paper_dir(paper: str | None, content_root: str | None,
                      cwd: Path | None = None) -> Path:
    """
    The paper directory to analyse: `paper` if given (a path, or a name under
    the folio directory), else the folio's only paper. Exits with the folio's
    actual contents when there is no unambiguous answer, rather than guessing
    a paper name.
    """
    cwd = cwd or Path.cwd()
    if paper and Path(paper).is_dir() and (Path(paper) / f"{Path(paper).name}.ts").is_file():
        return Path(paper).resolve()
    root = Path(content_root).resolve() if content_root else find_content_root(cwd)
    if root is None:
        sys.exit(
            "content-graph-analysis: no folio directory with a paper found above "
            f"{cwd}. Run it from the folio repository, or pass --content-root."
        )
    if paper:
        if not (root / paper / f"{paper}.ts").is_file():
            sys.exit(f"content-graph-analysis: no paper '{paper}' under {root} "
                     f"(papers: {', '.join(find_papers(root)) or 'none'}).")
        return root / paper
    papers = find_papers(root)
    if len(papers) == 1:
        return root / papers[0]
    sys.exit(
        f"content-graph-analysis: no paper under {root}; pass --paper."
        if not papers else
        f"content-graph-analysis: {len(papers)} papers under {root} "
        f"({', '.join(papers)}); name one with --paper."
    )

# ── Regex helpers ────────────────────────────────────────────────────────────

def extract_string_list(text: str, field: str) -> list[str]:
    """Extract a string array field like uses: ["a", "b"] or uses: ["a"]."""
    pattern = rf'{field}\s*:\s*\[([^\]]*)\]'
    m = re.search(pattern, text, re.DOTALL)
    if not m:
        return []
    items = re.findall(r'''["']([^"']+)["']''', m.group(1))
    return items


def extract_string_value(text: str, field: str) -> str | None:
    """Extract a single string field like label: "def:foo"."""
    m = re.search(rf"""{field}\s*:\s*["']([^"']+)["']""", text)
    return m.group(1) if m else None


def extract_int_value(text: str, field: str) -> int | None:
    """Extract an integer field like number: 4."""
    m = re.search(rf'{field}\s*:\s*(\d+)', text)
    return int(m.group(1)) if m else None


def extract_chapter_dirs(text: str) -> list[str]:
    """Extract all chapterRef({ dir: "..." }) entries from a paper manifest."""
    return re.findall(r"""chapterRef\(\s*\{[^}]*dir\s*:\s*["']([^"']+)["']""", text)


# ── Data structures ──────────────────────────────────────────────────────────

class BlockInfo:
    __slots__ = (
        "root_name", "ts_path", "label", "kind",
        "uses", "interprets", "proofs", "examples",
        "chapter_dir", "chapter_number", "chapter_title",
        "section_label", "section_title",
        "chapter_idx", "section_idx", "block_idx",
    )

    def __init__(self):
        self.root_name     = ""
        self.ts_path       = ""
        self.label         = ""
        self.kind          = "prose"
        self.uses          : list[str] = []
        self.interprets    : str | None = None
        self.proofs        : list[str] = []
        self.examples      : list[str] = []
        self.chapter_dir   = ""
        self.chapter_number: int = 0
        self.chapter_title : str = ""
        self.section_label : str = ""
        self.section_title : str = ""
        self.chapter_idx   : int = 0   # 0-based position in chapters list
        self.section_idx   : int = 0   # 0-based within chapter
        self.block_idx     : int = 0   # 0-based within section

    def position(self) -> tuple[int, int, int]:
        return (self.chapter_idx, self.section_idx, self.block_idx)

    def __repr__(self):
        return f"Block({self.label!r}, pos={self.position()})"


class SectionInfo:
    __slots__ = ("label", "title", "blocks", "chapter_dir", "section_idx")

    def __init__(self, label, title, blocks, chapter_dir, section_idx):
        self.label       = label
        self.title       = title
        self.blocks      = blocks           # list[str] root names
        self.chapter_dir = chapter_dir
        self.section_idx = section_idx


class ChapterInfo:
    __slots__ = ("dir", "number", "title", "label", "sections", "chapter_idx")

    def __init__(self, dir, number, title, label, sections, chapter_idx):
        self.dir         = dir
        self.number      = number
        self.title       = title
        self.label       = label
        self.sections    = sections         # list[SectionInfo]
        self.chapter_idx = chapter_idx


class Finding:
    def __init__(self, heuristic, severity, description, blocks=None, suggestion=""):
        self.heuristic   = heuristic
        self.severity    = severity          # "HIGH" | "MEDIUM" | "LOW" | "INFO"
        self.description = description
        self.blocks      = blocks or []
        self.suggestion  = suggestion

    def severity_order(self):
        return {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INFO": 3}.get(self.severity, 4)


# ── Parsers ──────────────────────────────────────────────────────────────────

def parse_block_ts(ts_path: Path, chapter_dir: str) -> BlockInfo | None:
    """Parse a single block .ts file and return a BlockInfo (or None on failure)."""
    try:
        text = ts_path.read_text(encoding="utf-8")
    except OSError:
        return None

    b = BlockInfo()
    b.root_name   = ts_path.stem
    b.ts_path     = str(ts_path)
    b.chapter_dir = chapter_dir

    # Detect kind from the builder call: definition(...), theorem(...), etc.
    kind_match = re.search(
        r'^\s*export\s+default\s+(\w+)\s*\(',
        text, re.MULTILINE,
    )
    if kind_match:
        b.kind = kind_match.group(1).lower()
    else:
        # Fallback: look for kind field
        k = extract_string_value(text, "kind")
        if k:
            b.kind = k

    b.label      = extract_string_value(text, "label") or ""
    b.uses       = extract_string_list(text, "uses")
    b.interprets = extract_string_value(text, "interprets")
    b.proofs     = extract_string_list(text, "proofs")
    b.examples   = extract_string_list(text, "examples")

    if not b.label:
        return None

    return b


def parse_chapter(chapter_dir_path: Path, chapter_idx: int) -> ChapterInfo | None:
    """Parse a chapter directory and return a ChapterInfo."""
    chapter_dir = chapter_dir_path.name
    manifest    = chapter_dir_path / f"{chapter_dir}.ts"
    if not manifest.exists():
        return None

    text = manifest.read_text(encoding="utf-8")

    number = extract_int_value(text, "number")
    if number is None:
        # Could have tabLabel instead; assign synthetic number
        number = chapter_idx

    title = extract_string_value(text, "title") or chapter_dir
    label = extract_string_value(text, "label") or f"chap:{chapter_dir}"

    # Parse sections.  Two literal shapes are recognised:
    #   section({ title: "...", label: "...", blocks: [...] })  — builder
    #   Object.freeze({ ... })                                  — frozen literal
    # Both yield the same Section interface; the second shape is used in
    # braids-and-knots.ts (sec:lepton-meson-parallel) for tighter immutability.
    sections = []
    section_pattern = re.compile(
        r'(?:\bsection|Object\.freeze)\s*\(\s*\{(.*?)\}\s*\)',
        re.DOTALL,
    )
    for sec_idx, m in enumerate(section_pattern.finditer(text)):
        body    = m.group(1)
        s_title = extract_string_value(body, "title") or f"sec{sec_idx}"
        s_label = extract_string_value(body, "label") or f"sec:{chapter_dir}-{sec_idx}"
        s_blocks = extract_string_list(body, "blocks")
        sections.append(SectionInfo(s_label, s_title, s_blocks, chapter_dir, sec_idx))

    return ChapterInfo(chapter_dir, number, title, label, sections, chapter_idx)


def parse_paper(paper_dir: Path, chapter_filter: str | None = None
                ) -> tuple[list[ChapterInfo], list[BlockInfo]]:
    """
    Parse the whole paper.  Returns (chapters, all_blocks) with positions set.
    If chapter_filter is given, only that chapter directory is analysed.
    """
    paper_manifest = paper_dir / f"{paper_dir.name}.ts"
    text           = paper_manifest.read_text(encoding="utf-8")
    chapter_dirs   = extract_chapter_dirs(text)

    chapters : list[ChapterInfo] = []
    all_blocks: list[BlockInfo]  = []

    for ch_idx, ch_dir in enumerate(chapter_dirs):
        if chapter_filter and ch_dir != chapter_filter:
            continue

        ch_path = paper_dir / ch_dir
        if not ch_path.is_dir():
            continue

        ch_info = parse_chapter(ch_path, ch_idx)
        if not ch_info:
            continue

        chapters.append(ch_info)

        for sec_info in ch_info.sections:
            for blk_idx, root_name in enumerate(sec_info.blocks):
                ts_path = ch_path / f"{root_name}.ts"
                b = parse_block_ts(ts_path, ch_dir)
                if b is None:
                    # Placeholder for missing/unparseable block
                    b = BlockInfo()
                    b.root_name   = root_name
                    b.ts_path     = str(ts_path)
                    b.label       = f"??:{root_name}"
                    b.kind        = "prose"
                    b.chapter_dir = ch_dir

                b.chapter_number = ch_info.number
                b.chapter_title  = ch_info.title
                b.section_label  = sec_info.label
                b.section_title  = sec_info.title
                b.chapter_idx    = ch_idx
                b.section_idx    = sec_info.section_idx
                b.block_idx      = blk_idx

                all_blocks.append(b)

    return chapters, all_blocks


# ── Graph building ───────────────────────────────────────────────────────────

def build_block_graph(blocks: list[BlockInfo]):
    """
    Returns:
        label_to_block : dict[str, BlockInfo]
        edges          : list[(from_label, to_label, edge_type)]
    """
    label_to_block: dict[str, BlockInfo] = {}
    for b in blocks:
        if b.label:
            label_to_block[b.label] = b

    edges: list[tuple[str, str, str]] = []

    for b in blocks:
        for dep in b.uses:
            if dep in label_to_block:
                edges.append((b.label, dep, "uses"))
        if b.interprets and b.interprets in label_to_block:
            edges.append((b.label, b.interprets, "interprets"))
        for p in b.proofs:
            if p in label_to_block:
                edges.append((b.label, p, "proof"))
        for e in b.examples:
            if e in label_to_block:
                edges.append((b.label, e, "example"))

    return label_to_block, edges


def build_section_graph(
    blocks: list[BlockInfo],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
):
    """
    Returns:
        chapter_edges : dict[(ch_idx1, ch_idx2), int]
        section_edges : dict[(sec_label1, sec_label2), int]
    """
    chapter_edges: dict[tuple[int, int], int] = defaultdict(int)
    section_edges: dict[tuple[str, str], int] = defaultdict(int)

    for from_label, to_label, etype in edges:
        fb = label_to_block.get(from_label)
        tb = label_to_block.get(to_label)
        if fb is None or tb is None:
            continue
        if fb.chapter_idx != tb.chapter_idx:
            chapter_edges[(fb.chapter_idx, tb.chapter_idx)] += 1
        if fb.section_label != tb.section_label:
            section_edges[(fb.section_label, tb.section_label)] += 1

    return chapter_edges, section_edges


# ── Heuristics ───────────────────────────────────────────────────────────────

PROVABLE_KINDS = {
    "definition", "theorem", "lemma", "proposition", "corollary", "conjecture",
}
NARRATIVE_KINDS = {"prose", "equation", "diagram", "simulator"}


def _is_statement_to_own_proof(from_label: str, to_label: str) -> bool:
    """Detect the proof-after-statement pattern that the H1 heuristic
    must NOT flag as a forward reference.

    Proofs of named statements (`prf:foo`) belong immediately after their
    statement (`prop:foo`, `lem:foo`, `thm:foo`, `cor:foo`). The "later
    position" of the proof block IS the correct authoring order, not a
    detangler finding. Skip pairs of the form:

        prop:foo  → prf:foo                  (exact suffix match)
        prop:foo  → prf:foo-proof            (with -proof suffix)
        prop:foo  → prf:foo-<qualifier>      (qualified-variant proofs)
        lem:foo   → prf:foo                  (etc. — same shape for any
        thm:foo   → prf:foo                   of the four provable-kind
        cor:foo   → prf:foo                   prefixes)

    Documented in `.claude/skills/local/detangler-integration-watcher.md`
    Slot D under "Excluded forward-reference patterns". The earlier
    detangler heuristic flagged 143+ such pairs as H1 false positives
    on one paper's main; this filter eliminates that class. The
    qualified-variant rule (`prf:foo-bar`) trades a slight risk of
    false-negatives (a real forward ref where the proof name happens
    to share a `-`-prefixed segment with an unrelated earlier
    statement) for the practical wins; given the paper's naming
    convention, this risk is empirically zero today.
    """
    if not to_label.startswith("prf:"):
        return False
    proof_suffix = to_label[len("prf:"):]
    # Strip trailing "-proof" if present, so prf:foo-proof matches
    # prop:foo just as cleanly as prf:foo does.
    if proof_suffix.endswith("-proof"):
        proof_suffix = proof_suffix[: -len("-proof")]
    for kind in ("prop:", "lem:", "thm:", "cor:"):
        statement_suffix = from_label[len(kind):] if from_label.startswith(kind) else None
        if statement_suffix is None:
            continue
        # Exact match: prop:foo → prf:foo (or via the -proof strip).
        if proof_suffix == statement_suffix:
            return True
        # Qualified variant: prop:foo → prf:foo-<qualifier>.
        if proof_suffix.startswith(statement_suffix + "-"):
            return True
    return False


def h1_forward_references(
    blocks: list[BlockInfo],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
) -> list[Finding]:
    """H1 — Forward references: block A uses block B defined later.

    Excludes statement-to-own-proof pairs (see
    `_is_statement_to_own_proof`) — those are the correct authoring
    order, not findings.
    """
    findings = []
    for from_label, to_label, etype in edges:
        # Statement-to-own-proof is the correct authoring order, not
        # a forward reference. Skip without flagging.
        if _is_statement_to_own_proof(from_label, to_label):
            continue
        fb = label_to_block.get(from_label)
        tb = label_to_block.get(to_label)
        if fb is None or tb is None:
            continue
        if fb.position() < tb.position():
            span_ch = tb.chapter_idx - fb.chapter_idx
            span_sec = tb.section_idx - fb.section_idx if tb.chapter_idx == fb.chapter_idx else 0
            severity = "HIGH" if span_ch > 0 else ("MEDIUM" if span_sec > 1 else "LOW")
            findings.append(Finding(
                heuristic="H1",
                severity=severity,
                description=(
                    f"{from_label} ({fb.chapter_title} / {fb.section_title}) "
                    f"→ {to_label} ({tb.chapter_title} / {tb.section_title}) "
                    f"[{etype}]  chapter_span={span_ch}, section_span={span_sec}"
                ),
                blocks=[from_label, to_label],
                suggestion=(
                    f"Move {to_label!r} earlier, "
                    f"or move {from_label!r} later in the document."
                ),
            ))
    return findings


def h2_cross_chapter_coupling(
    chapters: list[ChapterInfo],
    chapter_edges: dict[tuple[int, int], int],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
) -> list[Finding]:
    """H2 — Cross-chapter coupling: forward chapter references."""
    findings = []
    ch_idx_to_info = {ch.chapter_idx: ch for ch in chapters}

    # Forward cross-chapter edges (from later content to earlier — that's fine;
    # flag when early chapters depend on later ones, i.e., from < to by idx but
    # the from chapter has a lower document position yet targets a later chapter)
    for (ci, cj), count in sorted(chapter_edges.items(), key=lambda x: -x[1]):
        ch_i = ch_idx_to_info.get(ci)
        ch_j = ch_idx_to_info.get(cj)
        if ch_i is None or ch_j is None:
            continue
        if ci < cj:
            # From an earlier chapter to a later one → forward cross-chapter ref
            if count >= 3:
                severity = "HIGH" if count >= 10 else "MEDIUM"
                # Collect top offending blocks
                offenders = []
                for from_l, to_l, _ in edges:
                    fb = label_to_block.get(from_l)
                    tb = label_to_block.get(to_l)
                    if fb and tb and fb.chapter_idx == ci and tb.chapter_idx == cj:
                        offenders.append((from_l, to_l))
                findings.append(Finding(
                    heuristic="H2",
                    severity=severity,
                    description=(
                        f"Chapter {ch_i.number} ({ch_i.title!r}) → "
                        f"Chapter {ch_j.number} ({ch_j.title!r}): "
                        f"{count} forward cross-chapter edge(s)"
                    ),
                    blocks=[f"{a}→{b}" for a, b in offenders[:5]],
                    suggestion=(
                        f"Move the {count} referenced block(s) from "
                        f"{ch_j.title!r} into an earlier chapter (or to a shared "
                        f"preliminaries section in {ch_i.title!r})."
                    ),
                ))
    return findings


def h3_cross_section_coupling(
    chapters: list[ChapterInfo],
    section_edges: dict[tuple[str, str], int],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
) -> list[Finding]:
    """H3 — Cross-section coupling ratio per chapter."""
    findings = []

    for ch in chapters:
        sec_labels = {s.label for s in ch.sections}
        total_ch_edges  = 0
        cross_sec_edges = 0

        for from_l, to_l, _ in edges:
            fb = label_to_block.get(from_l)
            tb = label_to_block.get(to_l)
            if fb is None or tb is None:
                continue
            if fb.chapter_idx != ch.chapter_idx:
                continue
            if fb.chapter_idx == tb.chapter_idx:
                total_ch_edges += 1
                if fb.section_label != tb.section_label:
                    cross_sec_edges += 1

        if total_ch_edges == 0:
            continue

        ratio = cross_sec_edges / total_ch_edges
        if ratio > 0.40:
            severity = "HIGH" if ratio > 0.60 else "MEDIUM"
            findings.append(Finding(
                heuristic="H3",
                severity=severity,
                description=(
                    f"Chapter {ch.number} ({ch.title!r}): "
                    f"cross-section coupling ratio = {ratio:.2f} "
                    f"({cross_sec_edges}/{total_ch_edges} edges cross section boundaries)"
                ),
                blocks=[],
                suggestion=(
                    "Consider grouping tightly coupled blocks into the same section, "
                    "or extracting shared prerequisites into a new 'Preliminaries' section."
                ),
            ))
        elif ratio > 0.20:
            findings.append(Finding(
                heuristic="H3",
                severity="LOW",
                description=(
                    f"Chapter {ch.number} ({ch.title!r}): "
                    f"moderate cross-section coupling {ratio:.2f} "
                    f"({cross_sec_edges}/{total_ch_edges})"
                ),
                blocks=[],
                suggestion="Minor restructuring might improve section cohesion.",
            ))

    return findings


def h4_sparse_sections(
    chapters: list[ChapterInfo],
    label_to_block: dict[str, BlockInfo],
) -> list[Finding]:
    """H4 — Sections with fewer than 3 non-prose blocks."""
    findings = []
    for ch in chapters:
        for sec in ch.sections:
            non_prose_blocks = []
            for root in sec.blocks:
                matched = [b for b in label_to_block.values()
                           if b.root_name == root and b.chapter_dir == ch.dir]
                for b in matched:
                    if b.kind not in NARRATIVE_KINDS:
                        non_prose_blocks.append(b.label)
            total = len(sec.blocks)
            np_count = len(non_prose_blocks)

            # Skip intro sections (first section in a chapter, often pure prose)
            if sec.section_idx == 0:
                continue
            if total > 0 and np_count < 3:
                findings.append(Finding(
                    heuristic="H4",
                    severity="LOW",
                    description=(
                        f"Sparse section: {sec.label!r} "
                        f"({ch.title!r}) — {total} block(s), "
                        f"{np_count} non-prose"
                    ),
                    blocks=sec.blocks[:5],
                    suggestion=(
                        f"Consider merging {sec.label!r} with an adjacent section."
                    ),
                ))
    return findings


def h5_dense_sections(
    chapters: list[ChapterInfo],
) -> list[Finding]:
    """H5 — Sections with more than 18 blocks."""
    findings = []
    for ch in chapters:
        for sec in ch.sections:
            count = len(sec.blocks)
            if count > 18:
                severity = "HIGH" if count > 30 else "LOW"
                findings.append(Finding(
                    heuristic="H5",
                    severity=severity,
                    description=(
                        f"Dense section: {sec.label!r} "
                        f"({ch.title!r}) — {count} blocks"
                    ),
                    blocks=sec.blocks[:5],
                    suggestion=(
                        f"Split {sec.label!r} into two smaller sections "
                        f"along natural dependency boundaries."
                    ),
                ))
    return findings


def h6_isolated_blocks(
    blocks: list[BlockInfo],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
) -> list[Finding]:
    """H6 — Blocks with no edges at all (no uses and no one uses them)."""
    referenced = set()
    for from_l, to_l, _ in edges:
        referenced.add(from_l)
        referenced.add(to_l)

    findings = []
    for b in blocks:
        if b.kind in NARRATIVE_KINDS:
            continue
        if b.label and b.label not in referenced:
            findings.append(Finding(
                heuristic="H6",
                severity="INFO",
                description=(
                    f"Isolated block: {b.label!r} "
                    f"({b.chapter_title} / {b.section_title}) — "
                    f"kind={b.kind}, no uses[] and not referenced by any block"
                ),
                blocks=[b.label],
                suggestion=(
                    "Verify this block is intentionally standalone, or "
                    "add uses[] links to connect it to the argument."
                ),
            ))
    return findings


def h7_remark_ratio(
    chapters: list[ChapterInfo],
    label_to_block: dict[str, BlockInfo],
) -> list[Finding]:
    """H7 — Sections where interpretation blocks outnumber provable blocks 2:1."""
    findings = []
    for ch in chapters:
        for sec in ch.sections:
            provable = 0
            interpretive = 0
            for root in sec.blocks:
                matched = [b for b in label_to_block.values()
                           if b.root_name == root and b.chapter_dir == ch.dir]
                for b in matched:
                    if b.kind in PROVABLE_KINDS:
                        provable += 1
                    elif b.kind in {"remark", "example"}:
                        interpretive += 1
            if provable > 0 and interpretive > 2 * provable:
                findings.append(Finding(
                    heuristic="H7",
                    severity="INFO",
                    description=(
                        f"High remark/example ratio in {sec.label!r} "
                        f"({ch.title!r}): {interpretive} interpretive vs "
                        f"{provable} provable"
                    ),
                    blocks=[],
                    suggestion=(
                        "Consider whether some remarks contain provable content "
                        "that should be promoted to propositions."
                    ),
                ))
            elif interpretive > 0 and provable > 3 * interpretive:
                findings.append(Finding(
                    heuristic="H7",
                    severity="INFO",
                    description=(
                        f"Low remark/example ratio in {sec.label!r} "
                        f"({ch.title!r}): {interpretive} interpretive vs "
                        f"{provable} provable"
                    ),
                    blocks=[],
                    suggestion=(
                        "Consider adding examples or remarks to ground the "
                        "formal content in intuition."
                    ),
                ))
    return findings


# ── Reporting ────────────────────────────────────────────────────────────────

SEVERITY_EMOJI = {"HIGH": "🔴", "MEDIUM": "🟠", "LOW": "🟡", "INFO": "ℹ️ "}


def format_report(
    chapters: list[ChapterInfo],
    blocks: list[BlockInfo],
    edges: list[tuple[str, str, str]],
    chapter_edges: dict[tuple[int, int], int],
    section_edges: dict[tuple[str, str], int],
    findings: list[Finding],
    paper_name: str,
) -> str:
    lines = []
    lines.append(f"# Content Graph Analysis: {paper_name}")
    lines.append("")

    # Summary
    lines.append("## Summary")
    total_blocks   = len(blocks)
    total_sections = sum(len(ch.sections) for ch in chapters)
    total_edges    = len(edges)
    uses_edges     = sum(1 for _, _, t in edges if t == "uses")
    interp_edges   = sum(1 for _, _, t in edges if t == "interprets")
    proof_edges    = sum(1 for _, _, t in edges if t == "proof")
    example_edges  = sum(1 for _, _, t in edges if t == "example")
    cross_ch       = sum(chapter_edges.values())
    cross_sec      = sum(section_edges.values())
    h1_count       = sum(1 for f in findings if f.heuristic == "H1")

    lines.append(f"- Chapters: {len(chapters)} | Sections: {total_sections} | Blocks: {total_blocks}")
    lines.append(f"- Block edges: {total_edges} (uses={uses_edges}, interprets={interp_edges}, proof={proof_edges}, example={example_edges})")
    lines.append(f"- Cross-chapter edges: {cross_ch} | Cross-section edges: {cross_sec}")
    lines.append(f"- Forward references (H1): {h1_count}")
    lines.append("")

    # Chapter overview
    lines.append("## Chapter Overview")
    lines.append("")
    lines.append("| # | Chapter | Sections | Blocks |")
    lines.append("|---|---------|----------|--------|")
    for ch in chapters:
        ch_blocks = [b for b in blocks if b.chapter_idx == ch.chapter_idx]
        lines.append(
            f"| {ch.number} | {ch.title} | {len(ch.sections)} | {len(ch_blocks)} |"
        )
    lines.append("")

    # Section size table
    lines.append("## Section Sizes")
    lines.append("")
    lines.append("| Chapter | Section | Blocks | Provable | Remark/Ex | Prose |")
    lines.append("|---------|---------|--------|----------|-----------|-------|")
    label_to_block = {b.label: b for b in blocks}
    for ch in chapters:
        for sec in ch.sections:
            b_list = [
                b for b in blocks
                if b.chapter_dir == ch.dir and b.section_label == sec.label
            ]
            provable = sum(1 for b in b_list if b.kind in PROVABLE_KINDS)
            interp   = sum(1 for b in b_list if b.kind in {"remark", "example"})
            narrative = sum(1 for b in b_list if b.kind in NARRATIVE_KINDS)
            lines.append(
                f"| {ch.title[:30]} | {sec.title[:35]} "
                f"| {len(b_list)} | {provable} | {interp} | {narrative} |"
            )
    lines.append("")

    # Cross-chapter matrix
    lines.append("## Cross-Chapter Edge Matrix")
    lines.append("")
    ch_nums = sorted({ch.chapter_idx for ch in chapters})
    ch_idx_to_ch = {ch.chapter_idx: ch for ch in chapters}
    lines.append("Rows = FROM chapter, Cols = TO chapter.  Counts > 0 shown.")
    lines.append("")
    # Build a compact list
    ch_cross = sorted(
        [(ci, cj, n) for (ci, cj), n in chapter_edges.items() if n > 0],
        key=lambda x: -x[2],
    )
    if ch_cross:
        lines.append("| From | To | Edges | Direction |")
        lines.append("|------|----|-------|-----------|")
        for ci, cj, n in ch_cross[:20]:
            ch_i = ch_idx_to_ch.get(ci)
            ch_j = ch_idx_to_ch.get(cj)
            if ch_i and ch_j:
                direction = "forward ⚠️ " if ci < cj else "backward ✓"
                lines.append(
                    f"| Ch{ch_i.number} {ch_i.title[:20]} "
                    f"| Ch{ch_j.number} {ch_j.title[:20]} "
                    f"| {n} | {direction} |"
                )
    else:
        lines.append("_No cross-chapter edges found._")
    lines.append("")

    # Findings by severity
    severity_order = ["HIGH", "MEDIUM", "LOW", "INFO"]
    grouped: dict[str, list[Finding]] = defaultdict(list)
    for f in findings:
        grouped[f.severity].append(f)

    for sev in severity_order:
        fs = grouped.get(sev, [])
        if not fs:
            continue
        emoji = SEVERITY_EMOJI.get(sev, "")
        lines.append(f"## {emoji} {sev} Findings")
        lines.append("")
        heuristic_groups: dict[str, list[Finding]] = defaultdict(list)
        for f in fs:
            heuristic_groups[f.heuristic].append(f)
        for hid, hfs in sorted(heuristic_groups.items()):
            lines.append(f"### {hid} — {hfs[0].description.split(':')[0]}")
            for f in hfs[:30]:  # cap at 30 per heuristic
                lines.append(f"- {f.description}")
                if f.blocks:
                    lines.append(f"  Blocks: `{'`, `'.join(f.blocks[:5])}`")
                if f.suggestion:
                    lines.append(f"  💡 {f.suggestion}")
            if len(hfs) > 30:
                lines.append(f"  … and {len(hfs) - 30} more")
            lines.append("")

    lines.append("---")
    lines.append("_Generated by pipeline/content-graph-analysis.py_")
    return "\n".join(lines)


# ── Graphviz visualisation ───────────────────────────────────────────────────

def try_install_graphviz():
    try:
        subprocess.run(["dot", "-V"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("graphviz not found — attempting install…", file=sys.stderr)
        r = subprocess.run(
            ["apt-get", "install", "-y", "--quiet", "graphviz"],
            capture_output=True,
        )
        return r.returncode == 0


def render_chapter_graph(
    chapters: list[ChapterInfo],
    chapter_edges: dict[tuple[int, int], int],
    section_edges: dict[tuple[str, str], int],
    output_path: str = "/tmp/content_chapter_graph.svg",
) -> str:
    """Generate a chapter/section topology DOT and render to SVG."""
    ch_idx_to_ch = {ch.chapter_idx: ch for ch in chapters}

    dot = ["digraph content_chapters {"]
    dot.append('  rankdir=LR;')
    dot.append('  node [shape=box, style=filled, fillcolor=lightblue, fontsize=9];')
    dot.append('  edge [fontsize=8];')
    dot.append("")

    # Chapter clusters with sections as nodes
    for ch in chapters:
        dot.append(f'  subgraph cluster_{ch.chapter_idx} {{')
        dot.append(f'    label="Ch{ch.number}: {ch.title[:30]}";')
        dot.append(f'    style=filled; fillcolor=lightyellow;')
        for sec in ch.sections:
            safe = sec.label.replace(":", "_").replace("-", "_")
            label = sec.title[:25].replace('"', "'")
            dot.append(f'    {safe} [label="{label}"];')
        dot.append("  }")
        dot.append("")

    # Cross-section edges within same chapter (light gray)
    for (sl1, sl2), count in section_edges.items():
        safe1 = sl1.replace(":", "_").replace("-", "_")
        safe2 = sl2.replace(":", "_").replace("-", "_")
        color = "gray70"
        dot.append(f'  {safe1} -> {safe2} [label="{count}", color={color}];')

    # Cross-chapter edges (warn forward, ok backward)
    for (ci, cj), count in chapter_edges.items():
        chi = ch_idx_to_ch.get(ci)
        chj = ch_idx_to_ch.get(cj)
        if not chi or not chj:
            continue
        # Use first section of each chapter as endpoint
        if not chi.sections or not chj.sections:
            continue
        s1 = chi.sections[0].label.replace(":", "_").replace("-", "_")
        s2 = chj.sections[0].label.replace(":", "_").replace("-", "_")
        color = "red" if ci < cj else "blue"
        style = "dashed" if ci < cj else "solid"
        dot.append(
            f'  {s1} -> {s2} '
            f'[label="ch: {count}", color={color}, style={style}, penwidth=1.5];'
        )

    dot.append("}")

    dot_text = "\n".join(dot)
    dot_path = output_path.replace(".svg", ".dot")
    Path(dot_path).write_text(dot_text)

    r = subprocess.run(
        ["dot", "-Tsvg", "-o", output_path, dot_path],
        capture_output=True,
    )
    if r.returncode == 0:
        return output_path
    else:
        print(f"dot rendering failed: {r.stderr.decode()}", file=sys.stderr)
        return dot_path


def render_block_heatmap(
    blocks: list[BlockInfo],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
    output_path: str = "/tmp/content_block_heatmap.svg",
    max_nodes: int = 200,
) -> str:
    """Generate a block dependency heat-map DOT — forward/cross-chapter edges only."""
    # Only include blocks involved in forward or cross-chapter edges
    important_labels = set()
    fwd_edges = []
    for from_l, to_l, etype in edges:
        fb = label_to_block.get(from_l)
        tb = label_to_block.get(to_l)
        if fb is None or tb is None:
            continue
        if fb.position() < tb.position() or fb.chapter_idx != tb.chapter_idx:
            important_labels.add(from_l)
            important_labels.add(to_l)
            fwd_edges.append((from_l, to_l, etype, fb, tb))

    # Cap to max_nodes to keep SVG readable
    if len(important_labels) > max_nodes:
        # Trim to blocks with the most cross-edges
        edge_count: dict[str, int] = defaultdict(int)
        for fl, tl, _, _, _ in fwd_edges:
            edge_count[fl] += 1
            edge_count[tl] += 1
        top = sorted(important_labels, key=lambda l: -edge_count[l])[:max_nodes]
        important_labels = set(top)
        fwd_edges = [
            e for e in fwd_edges
            if e[0] in important_labels and e[1] in important_labels
        ]

    dot = ["digraph block_heatmap {"]
    dot.append('  rankdir=TB;')
    dot.append('  node [shape=ellipse, style=filled, fontsize=7];')
    dot.append('  edge [fontsize=7];')
    dot.append("")

    # Group by chapter
    ch_groups: dict[int, list[BlockInfo]] = defaultdict(list)
    for b in blocks:
        if b.label in important_labels:
            ch_groups[b.chapter_idx].append(b)

    for ch_idx, blist in sorted(ch_groups.items()):
        b0 = blist[0]
        safe_ch = f"cluster_ch{ch_idx}"
        dot.append(f'  subgraph {safe_ch} {{')
        dot.append(f'    label="Ch {b0.chapter_number}: {b0.chapter_title[:25]}";')
        dot.append(f'    style=dashed;')
        for b in blist:
            safe = b.label.replace(":", "_").replace("-", "_").replace("?", "_")
            color = "lightyellow" if b.kind in PROVABLE_KINDS else "lightgray"
            lbl = (b.label[:30]).replace('"', "'")
            dot.append(f'    {safe} [label="{lbl}", fillcolor={color}];')
        dot.append("  }")
        dot.append("")

    # Edges
    for from_l, to_l, etype, fb, tb in fwd_edges:
        safe_f = from_l.replace(":", "_").replace("-", "_").replace("?", "_")
        safe_t = to_l.replace(":", "_").replace("-", "_").replace("?", "_")
        if fb.chapter_idx != tb.chapter_idx:
            color = "red"
        elif fb.position() < tb.position():
            color = "orange"
        else:
            color = "gray60"
        dot.append(f'  {safe_f} -> {safe_t} [color={color}];')

    dot.append("}")

    dot_text = "\n".join(dot)
    dot_path = output_path.replace(".svg", ".dot")
    Path(dot_path).write_text(dot_text)

    r = subprocess.run(
        ["dot", "-Tsvg", "-o", output_path, dot_path],
        capture_output=True,
    )
    if r.returncode == 0:
        return output_path
    else:
        print(f"dot rendering failed: {r.stderr.decode()}", file=sys.stderr)
        return dot_path


# ── JSON export ──────────────────────────────────────────────────────────────

def export_json(
    chapters: list[ChapterInfo],
    blocks: list[BlockInfo],
    edges: list[tuple[str, str, str]],
    chapter_edges: dict[tuple[int, int], int],
    section_edges: dict[tuple[str, str], int],
    findings: list[Finding],
) -> dict:
    ch_idx_to_ch = {ch.chapter_idx: ch for ch in chapters}
    return {
        "chapters": [
            {
                "dir": ch.dir,
                "number": ch.number,
                "title": ch.title,
                "label": ch.label,
                "sections": [
                    {
                        "label": s.label,
                        "title": s.title,
                        "blocks": s.blocks,
                    }
                    for s in ch.sections
                ],
            }
            for ch in chapters
        ],
        "blocks": [
            {
                "label": b.label,
                "kind": b.kind,
                "root_name": b.root_name,
                "chapter_dir": b.chapter_dir,
                "chapter_number": b.chapter_number,
                "section_label": b.section_label,
                "position": list(b.position()),
                "uses": b.uses,
                "interprets": b.interprets,
                "proofs": b.proofs,
                "examples": b.examples,
            }
            for b in blocks
        ],
        "edges": [
            {"from": f, "to": t, "type": e}
            for f, t, e in edges
        ],
        "chapter_edges": [
            {
                "from_ch": ch_idx_to_ch[ci].number if ci in ch_idx_to_ch else ci,
                "to_ch": ch_idx_to_ch[cj].number if cj in ch_idx_to_ch else cj,
                "count": n,
            }
            for (ci, cj), n in sorted(chapter_edges.items())
        ],
        "findings": [
            {
                "heuristic": f.heuristic,
                "severity": f.severity,
                "description": f.description,
                "blocks": f.blocks,
                "suggestion": f.suggestion,
            }
            for f in findings
        ],
    }


# ── Concrete proposals ───────────────────────────────────────────────────────

class Proposal:
    def __init__(self, pid, kind, title, rationale, impact, blocks=None, details=None):
        self.id        = pid      # "P1", "P2", …
        self.kind      = kind     # "split" | "merge" | "move" | "reverse"
        self.title     = title
        self.rationale = rationale
        self.impact    = impact   # expected forward-ref reduction
        self.blocks    = blocks or []
        self.details   = details or {}

    def __repr__(self):
        return f"Proposal({self.id}: {self.title})"


def generate_proposals(
    chapters: list[ChapterInfo],
    blocks: list[BlockInfo],
    label_to_block: dict[str, BlockInfo],
    edges: list[tuple[str, str, str]],
    chapter_edges: dict[tuple[int, int], int],
    paper_dir: Path,
) -> list[Proposal]:
    """
    Generate concrete, implementable reorganisation proposals from the findings.

    Each proposal has:
    - A unique ID (P1, P2, …)
    - Kind: split | merge | move | reverse
    - Affected blocks and sections
    - Expected forward-reference reduction
    - Concrete edit instructions
    """
    pos         = {b.label: b.position() for b in blocks}
    section_map : dict[str, tuple[ChapterInfo, SectionInfo]] = {}
    for ch in chapters:
        for sec in ch.sections:
            section_map[sec.label] = (ch, sec)

    proposals: list[Proposal] = []
    pid = [1]

    def next_id() -> str:
        s = f"P{pid[0]}"
        pid[0] += 1
        return s

    # ── P-SPLIT: Dense sections (H5 findings → concrete splits) ──────
    for ch in chapters:
        for sec in ch.sections:
            count = len(sec.blocks)
            if count <= 18:
                continue
            proposals.append(Proposal(
                pid=next_id(),
                kind="split",
                title=f"Split dense section '{sec.title[:45]}' ({count} blocks) in {ch.title}",
                rationale=(
                    f"Section '{sec.label}' has {count} blocks — far above the recommended "
                    f"maximum of 18.  Large sections make navigation and cross-referencing "
                    f"difficult.  Split along the natural comment boundaries already present "
                    f"in the source."
                ),
                impact=f"Breaks {count}-block monolith into focused subsections of 5–20 blocks.",
                blocks=sec.blocks[:5],
                details={
                    "chapter_manifest": str(paper_dir / ch.dir / f"{ch.dir}.ts"),
                    "section_label": sec.label,
                    "current_block_count": count,
                    "action": (
                        f"Replace the single section({{{sec.label!r}}}) with multiple "
                        f"section({{...}}) calls, each containing a logically coherent subset "
                        f"of the {count} blocks."
                    ),
                },
            ))

    # ── P-MERGE: Sparse sections (H4 findings → concrete merges) ──────
    # Find adjacent sparse sections within the same chapter
    for ch in chapters:
        secs = ch.sections
        i = 0
        while i < len(secs) - 1:
            s1, s2 = secs[i], secs[i + 1]
            b1 = [b for b in blocks if b.chapter_dir == ch.dir and b.section_label == s1.label]
            b2 = [b for b in blocks if b.chapter_dir == ch.dir and b.section_label == s2.label]
            np1 = sum(1 for b in b1 if b.kind not in NARRATIVE_KINDS)
            np2 = sum(1 for b in b2 if b.kind not in NARRATIVE_KINDS)
            # Skip intro sections
            if s1.section_idx == 0 or s2.section_idx == 0:
                i += 1
                continue
            if np1 < 3 and np2 < 3 and len(s1.blocks) + len(s2.blocks) <= 8:
                proposals.append(Proposal(
                    pid=next_id(),
                    kind="merge",
                    title=(
                        f"Merge sparse sections '{s1.title[:30]}' + "
                        f"'{s2.title[:30]}' in {ch.title}"
                    ),
                    rationale=(
                        f"'{s1.label}' ({len(s1.blocks)} blocks) and "
                        f"'{s2.label}' ({len(s2.blocks)} blocks) are both too sparse. "
                        f"Combined they would form a {len(s1.blocks)+len(s2.blocks)}-block "
                        f"section, which is a more appropriate size."
                    ),
                    impact=f"Reduces section count by 1; improves narrative flow.",
                    blocks=s1.blocks + s2.blocks,
                    details={
                        "chapter_manifest": str(paper_dir / ch.dir / f"{ch.dir}.ts"),
                        "keep_label": s1.label,
                        "remove_label": s2.label,
                        "merged_blocks": s1.blocks + s2.blocks,
                        "action": (
                            f"Replace both section({{{s1.label!r}}}) and "
                            f"section({{{s2.label!r}}}) with a single section whose "
                            f"blocks[] array concatenates both block lists."
                        ),
                    },
                ))
                i += 2
                continue
            i += 1

    # ── P-MOVE: Forward references pointing to isolated blocks ────────
    # Find blocks that cause forward refs AND are only referenced by
    # a small number of blocks — good candidates to move earlier.
    forward_target_count: dict[str, int] = defaultdict(int)
    forward_source_map: dict[str, list[str]] = defaultdict(list)
    for from_l, to_l, etype in edges:
        fb = label_to_block.get(from_l)
        tb = label_to_block.get(to_l)
        if fb is None or tb is None:
            continue
        if pos.get(from_l, (999,)) < pos.get(to_l, (0,)):
            forward_target_count[to_l] += 1
            forward_source_map[to_l].append(from_l)

    # High-value candidates: blocks that fix many forward refs if moved earlier
    move_candidates = sorted(
        [(count, tl) for tl, count in forward_target_count.items() if count >= 3],
        reverse=True,
    )
    for count, tl in move_candidates[:10]:
        tb = label_to_block.get(tl)
        if tb is None:
            continue
        sources = forward_source_map[tl]
        # Find the earliest source position
        src_positions = [pos.get(sl) for sl in sources if pos.get(sl) is not None]
        if not src_positions:
            continue
        earliest_src = min(src_positions)
        # Current position of the target
        tl_pos = pos.get(tl)
        if tl_pos is None or tl_pos <= earliest_src:
            continue

        # Which chapter/section does the earliest source live in?
        earliest_src_blocks = [
            label_to_block[sl] for sl in sources
            if pos.get(sl) == earliest_src and sl in label_to_block
        ]
        if not earliest_src_blocks:
            continue
        target_ch = earliest_src_blocks[0]

        proposals.append(Proposal(
            pid=next_id(),
            kind="move",
            title=f"Move '{tl}' earlier (fixes {count} forward references)",
            rationale=(
                f"Block '{tl}' (currently in {tb.chapter_dir}/{tb.section_label}) "
                f"is forward-referenced by {count} blocks that appear earlier in the document. "
                f"Moving it to {target_ch.chapter_dir}/{target_ch.section_label} or "
                f"earlier would eliminate all {count} forward refs at once."
            ),
            impact=f"Eliminates {count} forward reference(s).",
            blocks=[tl] + sources[:5],
            details={
                "block_label": tl,
                "block_kind": tb.kind,
                "current_chapter": tb.chapter_dir,
                "current_section": tb.section_label,
                "suggested_chapter": target_ch.chapter_dir,
                "suggested_section": target_ch.section_label,
                "forward_ref_sources": sources[:10],
                "action": (
                    f"Remove '{tb.root_name}' from its current blocks[] array in "
                    f"{tb.chapter_dir}.ts and add it to the blocks[] array of "
                    f"section '{target_ch.section_label}' in {target_ch.chapter_dir}.ts, "
                    f"placing it before the first block that references it."
                ),
            },
        ))

    # ── P-REVERSE: Edges that are backwards in document order ─────────
    # Find remark/example blocks earlier than what they interpret/example
    for from_l, to_l, etype in edges:
        if etype not in ("interprets", "example"):
            continue
        fb = label_to_block.get(from_l)
        tb = label_to_block.get(to_l)
        if fb is None or tb is None:
            continue
        if pos.get(from_l, (999,)) < pos.get(to_l, (0,)):
            # An interpretation/example appears before what it interprets
            proposals.append(Proposal(
                pid=next_id(),
                kind="reverse",
                title=(
                    f"'{from_l}' ({fb.kind}) appears before its "
                    f"{etype} target '{to_l}'"
                ),
                rationale=(
                    f"A {fb.kind} block should come AFTER the block it interprets/exemplifies. "
                    f"'{from_l}' is in {fb.chapter_dir}/{fb.section_label} but its "
                    f"{etype} target '{to_l}' is in {tb.chapter_dir}/{tb.section_label} "
                    f"which appears LATER in the document."
                ),
                impact="Fixes reader confusion: interpretation appears before the statement.",
                blocks=[from_l, to_l],
                details={
                    "action": (
                        f"Either move '{tb.root_name}' earlier (before "
                        f"'{fb.root_name}'), or move '{fb.root_name}' later "
                        f"(to the same section as '{to_l}')."
                    ),
                    "preferred": (
                        f"Move '{tb.root_name}' from {tb.section_label} to "
                        f"{fb.section_label} (place it just before '{from_l}')."
                    ),
                },
            ))

    return proposals


def format_proposals(proposals: list[Proposal]) -> str:
    lines = ["# Concrete Reorganisation Proposals", ""]
    lines.append(
        f"Total proposals: **{len(proposals)}**  "
        f"({sum(1 for p in proposals if p.kind=='split')} split, "
        f"{sum(1 for p in proposals if p.kind=='merge')} merge, "
        f"{sum(1 for p in proposals if p.kind=='move')} move, "
        f"{sum(1 for p in proposals if p.kind=='reverse')} reverse)"
    )
    lines.append("")

    by_kind = {"split": [], "merge": [], "move": [], "reverse": []}
    for p in proposals:
        by_kind.get(p.kind, by_kind["split"]).append(p)

    kind_labels = {
        "split":   "✂️  Split dense sections",
        "merge":   "🔗 Merge sparse sections",
        "move":    "📦 Move blocks earlier",
        "reverse": "🔄 Fix out-of-order interprets/examples",
    }

    for kind, label in kind_labels.items():
        plist = by_kind[kind]
        if not plist:
            continue
        lines.append(f"## {label}")
        lines.append("")
        for p in plist:
            lines.append(f"### {p.id} — {p.title}")
            lines.append("")
            lines.append(f"**Rationale:** {p.rationale}")
            lines.append("")
            lines.append(f"**Impact:** {p.impact}")
            if p.blocks:
                lines.append(f"**Key blocks:** `{'`, `'.join(p.blocks[:5])}`")
            if p.details.get("action"):
                lines.append("")
                lines.append(f"**Action:** {p.details['action']}")
            if p.details.get("preferred"):
                lines.append(f"**Preferred:** {p.details['preferred']}")
            if p.details.get("merged_blocks"):
                lines.append(
                    f"**Merged block list:** `{'`, `'.join(p.details['merged_blocks'])}`"
                )
            lines.append("")

    lines.append("---")
    lines.append("_Generated by pipeline/content-graph-analysis.py --proposals_")
    return "\n".join(lines)



def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chapter", metavar="DIR", help="Restrict to one chapter directory")
    parser.add_argument("--visualise", action="store_true", help="Render Graphviz SVG")
    parser.add_argument("--json", action="store_true", help="Emit JSON to stdout and exit")
    parser.add_argument("--md", action="store_true", help="Write report to /tmp/content-graph-report.md")
    parser.add_argument("--proposals", action="store_true",
                        help="Generate concrete reorganisation proposals (outputs /tmp/content-graph-proposals.md)")
    parser.add_argument("--paper", metavar="DIR",
                        help="Paper directory name under the folio directory, or a path to it "
                             "(default: the folio's only paper; required when it has several)")
    parser.add_argument("--content-root", metavar="DIR",
                        help="Folio directory holding the papers (default: nearest folio/ or "
                             "content/ above the current directory that holds a paper)")
    args = parser.parse_args()

    paper_dir = resolve_paper_dir(args.paper, args.content_root)
    print("Parsing content tree…", file=sys.stderr)
    chapters, blocks = parse_paper(paper_dir, chapter_filter=args.chapter)
    print(
        f"  {len(chapters)} chapter(s), "
        f"{sum(len(c.sections) for c in chapters)} section(s), "
        f"{len(blocks)} block(s)",
        file=sys.stderr,
    )

    print("Building graphs…", file=sys.stderr)
    label_to_block, edges = build_block_graph(blocks)
    chapter_edges, section_edges = build_section_graph(
        blocks, label_to_block, edges
    )

    print("Applying heuristics…", file=sys.stderr)
    findings: list[Finding] = []
    findings += h1_forward_references(blocks, label_to_block, edges)
    findings += h2_cross_chapter_coupling(chapters, chapter_edges, label_to_block, edges)
    findings += h3_cross_section_coupling(chapters, section_edges, label_to_block, edges)
    findings += h4_sparse_sections(chapters, label_to_block)
    findings += h5_dense_sections(chapters)
    findings += h6_isolated_blocks(blocks, label_to_block, edges)
    findings += h7_remark_ratio(chapters, label_to_block)
    findings.sort(key=lambda f: (f.severity_order(), f.heuristic))
    print(f"  {len(findings)} finding(s) generated", file=sys.stderr)

    if args.proposals:
        print("Generating concrete proposals…", file=sys.stderr)
        proposals = generate_proposals(
            chapters, blocks, label_to_block, edges, chapter_edges,
            paper_dir=paper_dir,
        )
        print(f"  {len(proposals)} proposal(s) generated", file=sys.stderr)
        proposal_text = format_proposals(proposals)
        out = Path("/tmp/content-graph-proposals.md")
        out.write_text(proposal_text)
        print(f"Proposals written to {out}", file=sys.stderr)
        print(proposal_text)
        return

    if args.json:
        print(json.dumps(
            export_json(chapters, blocks, edges, chapter_edges, section_edges, findings),
            indent=2,
        ))
        return

    report = format_report(
        chapters, blocks, edges, chapter_edges, section_edges, findings,
        paper_name=paper_dir.name,
    )

    if args.md:
        out = Path("/tmp/content-graph-report.md")
        out.write_text(report)
        print(f"Report written to {out}", file=sys.stderr)
    else:
        print(report)

    if args.visualise:
        if try_install_graphviz():
            print("\nGenerating chapter graph…", file=sys.stderr)
            p1 = render_chapter_graph(chapters, chapter_edges, section_edges)
            print(f"  → {p1}", file=sys.stderr)
            print("Generating block heat-map…", file=sys.stderr)
            p2 = render_block_heatmap(blocks, label_to_block, edges)
            print(f"  → {p2}", file=sys.stderr)
        else:
            print("graphviz install failed — skipping visualisation", file=sys.stderr)


if __name__ == "__main__":
    main()
