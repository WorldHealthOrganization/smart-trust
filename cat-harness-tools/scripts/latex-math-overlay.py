#!/usr/bin/env python3
"""latex-math-overlay.py — replace an ingested entry's section text with the
text of its own LaTeX source, where the two provably say the same thing.

## Why

A PDF rung (`pdf-structure`, `pdf-pages`) reads the text layer, and a text
layer has no mathematics in it: `3_1` comes out as "3 1", `\\frac{a}{b}` as
three lines, ligatures as `ﬁ`. Horn & Keuper (arXiv:2512.09874) measure
rule-based text extraction as the weakest tier for formulas (PyPDF 7.69,
PyMuPDF4LLM 6.67, GROBID 5.70 on a 0–10 judge scale, against 9.6+ for the best
parsers). For an arXiv paper there is something better than any parser: the
author's own LaTeX. This overlay uses it.

## The rung keeps the structure; this replaces only the text

`structure.json` — pages, contents, figures, page labels — stays the PDF
rung's, because every downstream check reads it and the PDF is still the
document a reader cites by page. Only the BODY of each `sections/*.md` is
replaced, and only for sections that pass both gates below. Everything else
is left exactly as the rung wrote it, and the entry says which sections were
overlaid.

## Propose, then verify

The method both newer papers share (Pluzhnikov et al., arXiv:2604.00554, and
Horn & Keuper's two-stage matching): a candidate text is accepted only when it
is checked against the source it claims to represent. Here:

1. **Title gate.** A LaTeX `\\section` is paired with a PDF section only when
   their normalised titles are equal, or differ by at most a
   `TITLE_RATIO` similarity. Never by position: position is how a shifted
   pairing replaces every section with its neighbour's text.
2. **Prose gate.** Of the distinct words (four letters or more) in the LaTeX
   section's prose, outside mathematics, at least `PROSE_RATIO` must occur in
   the PDF section's text. A pairing that fails it is reported and NOT
   applied: the titles agreed and the contents did not, which is a finding
   about the pairing rather than something to paper over.
3. **Coverage gate.** The other direction: of the PDF section's distinct
   words, at least `COVERAGE_RATIO` must occur in the LaTeX section. Without
   it a LaTeX section that holds only the first paragraph of a PDF section
   passes the prose gate and REPLACES the whole section with a fragment. The
   bar is lower than the prose gate's because a text layer carries running
   heads, page numbers and split words the source never had.

## Third state

An entry whose structure is page-granular has no titled sections to pair, and
one with no LaTeX source has nothing to overlay. Both are reported as
`skipped` with the reason, never as `overlaid: 0` — zero overlaid sections in
an entry that was never eligible is not a measurement.

Usage:
  python3 scripts/latex-math-overlay.py library/arxiv-0705.1468v1
  python3 scripts/latex-math-overlay.py library/arxiv-0705.1468v1 --source e-print.tar.gz
  python3 scripts/latex-math-overlay.py library/arxiv-* --dry-run

The source is `<entry>/source/` unless `--source` names a tarball, a gzipped
single file, a directory or a `.tex` file; for a staged entry with none,
`--library` names the library whose `<slug>/source/` to read.
`arxiv-source.py` fetches it. `ingest-document.ts` runs this as an arm.

Exit: 0 every entry overlaid or skipped with a reason, 1 an entry failed.
"""

from __future__ import annotations

import argparse
import difflib
import gzip
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from dataclasses import dataclass, field

TITLE_RATIO = 0.85
PROSE_RATIO = 0.6
COVERAGE_RATIO = 0.5
SOURCE_DIRNAME = "source"
OVERLAY_SCHEMA = "latex-math-overlay/v1"

# Every sectioning level a PDF rung may report: its contents come from font
# sizes, so a "section" there is often a \subsection here.
_SECTION = re.compile(r"\\((?:sub){0,2})section\*?\s*(?:\[[^\]]*\])?\s*\{")
_INPUT = re.compile(r"\\(?:input|include)\s*\{([^}]+)\}")
_COMMENT = re.compile(r"(?<!\\)%.*")
_MATH = re.compile(
    r"\$\$.*?\$\$|\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\)"
    r"|\\begin\{(equation|align|gather|multline|eqnarray|displaymath|math)\*?\}.*?\\end\{\1\*?\}",
    re.S,
)
_WORD = re.compile(r"[A-Za-z]{4,}")
_LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}


# ── source ──────────────────────────────────────────────────────────────────

def read_source(path: str) -> dict[str, str]:
    """Every `.tex` file in a source bundle, by its path inside the bundle.

    arXiv serves an e-print as a gzipped tarball, or — for a single-file
    submission — a gzipped `.tex` with no tar around it. Both are accepted, as
    is an unpacked directory or a lone `.tex`.
    """
    files: dict[str, str] = {}
    # What `arxiv-source.py` writes: the e-print exactly as arXiv served it.
    if os.path.isdir(path) and os.path.isfile(os.path.join(path, "e-print")):
        return read_source(os.path.join(path, "e-print"))
    if os.path.isdir(path):
        for root, _, names in os.walk(path):
            for n in names:
                if n.endswith(".tex"):
                    p = os.path.join(root, n)
                    with open(p, encoding="utf-8", errors="replace") as fh:
                        files[os.path.relpath(p, path)] = fh.read()
        return files
    with open(path, "rb") as fh:
        raw = fh.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    try:
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            for m in tar.getmembers():
                if m.isfile() and m.name.endswith(".tex"):
                    f = tar.extractfile(m)
                    if f is not None:
                        files[m.name] = f.read().decode("utf-8", errors="replace")
        return files
    except tarfile.ReadError:
        return {os.path.basename(path).removesuffix(".gz") or "main.tex": raw.decode("utf-8", errors="replace")}


def main_tex(files: dict[str, str]) -> str | None:
    """The file that holds `\\documentclass` and `\\begin{document}`.

    LaTeX 2.09's `\\documentstyle` counts too: much of 1990s arXiv is written
    in it, and its `\\section`s are the same. AMS-TeX also says
    `\\documentstyle`, but has no `\\begin{document}`, so it stays out.

    More than one candidate is resolved by size, the largest being the paper
    rather than a standalone figure; none is `None`, never a guess.
    """
    cands = [k for k, v in files.items()
             if ("\\documentclass" in v or "\\documentstyle" in v) and "\\begin{document}" in v]
    if not cands:
        return None
    return max(cands, key=lambda k: len(files[k]))


def strip_comments(tex: str) -> str:
    return "\n".join(_COMMENT.sub("", line) for line in tex.split("\n"))


def inline_inputs(name: str, files: dict[str, str], depth: int = 0) -> str:
    """`\\input` and `\\include` replaced by the file they name, recursively."""
    base = os.path.dirname(name)
    text = strip_comments(files[name])
    if depth > 8:
        return text

    def sub(m: re.Match[str]) -> str:
        target = m.group(1).strip()
        for cand in (target, target + ".tex"):
            for key in (os.path.normpath(os.path.join(base, cand)), os.path.normpath(cand)):
                if key in files:
                    return inline_inputs(key, files, depth + 1)
        return ""

    return _INPUT.sub(sub, text)


def balanced(text: str, start: int) -> tuple[str, int]:
    """The contents of the brace group whose `{` is at `start - 1`."""
    depth, i = 1, start
    while i < len(text) and depth:
        if text[i] == "\\":
            i += 2
            continue
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    return text[start : i - 1], i


@dataclass
class TexSection:
    title: str
    body: str
    level: int = 1
    start: int = 0
    end: int = 0


def tex_sections(full: str) -> tuple[str, list[TexSection]]:
    """The preamble, and every `\\section`, `\\subsection` and `\\subsubsection`.

    Each `body` runs to the next heading of ANY level, so it is the text a PDF
    rung holds when it reports both levels. When the PDF reports only some of
    them, `bodies_for` widens each paired heading over the ones it did not.
    """
    pre, _, doc = full.partition("\\begin{document}")
    doc = doc.split("\\end{document}")[0]
    doc = re.split(r"\\(?:bibliography\{|begin\{thebibliography\}|appendix\b)", doc)[0]
    out: list[TexSection] = []
    heads = list(_SECTION.finditer(doc))
    for k, m in enumerate(heads):
        title, end = balanced(doc, m.end())
        stop = heads[k + 1].start() if k + 1 < len(heads) else len(doc)
        out.append(TexSection(title=title, body=doc[end:stop], level=1 + len(m.group(1)) // 3, start=m.start(), end=end))
    return pre, out


def bodies_for(secs: list[TexSection], paired: set[int]) -> dict[int, str]:
    """The body of each paired heading: everything up to the next PAIRED heading.

    A heading the PDF has no section for (a subsection the font-size rung did
    not see) belongs to the paired heading above it, as it does in the PDF's
    text. The prose and coverage gates then decide whether that widened body
    really is the PDF section's text.
    """
    out: dict[int, str] = {}
    for i in sorted(paired):
        stop_at = len(secs)
        for j in range(i + 1, len(secs)):
            if j in paired:
                stop_at = j
                break
        text = "".join(
            (("\n\\" + ("sub" * (secs[j].level - 1)) + "section{" + secs[j].title + "}") if j > i else "") + secs[j].body
            for j in range(i, stop_at))
        out[i] = text
    return out


# ── conversion ──────────────────────────────────────────────────────────────

def to_markdown(preamble: str, body: str) -> tuple[str, str]:
    """`(markdown, converter)`. Pandoc with the paper's own preamble, so its
    `\\newcommand`s expand; the LaTeX itself when pandoc is absent or refuses.
    Mathematics is kept as `$…$` / `$$…$$` either way."""
    if shutil.which("pandoc"):
        macros = "\n".join(l for l in preamble.split("\n") if re.match(r"\s*\\(re)?newcommand|\s*\\def\\|\s*\\DeclareMathOperator", l))
        doc = f"\\documentclass{{article}}\n{macros}\n\\begin{{document}}\n{body}\n\\end{{document}}\n"
        # input-site: inert #6c55b410 — pandoc on stdin built from the paper's own text; a traced run records pandoc's binary by digest and its file reads
        r = subprocess.run(
            ["pandoc", "-f", "latex", "-t", "markdown+tex_math_dollars-raw_attribute", "--wrap=none"],
            input=doc, capture_output=True, text=True, timeout=120,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip(), "pandoc"
    return body.strip(), "latex"


# ── verification ────────────────────────────────────────────────────────────

def norm_title(t: str) -> str:
    t = re.sub(r"\\[a-zA-Z]+\*?", " ", t)
    t = _unligature(re.sub(r"\$.*?\$", " ", t))
    t = re.sub(r"^[\dIVXivx.\s]+(?=[A-Za-z])", "", t.strip())
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def prose_words(text: str) -> set[str]:
    text = _MATH.sub(" ", text)
    text = re.sub(r"\\[a-zA-Z]+", " ", text)
    return {w.lower() for w in _WORD.findall(text)}


def pdf_words(text: str) -> set[str]:
    text = _unligature(text)
    # A text layer splits words at line ends and at kerning gaps ("three-di
    # mensional"), so the words it holds are also read with those joined.
    joined = re.sub(r"-\s*\n\s*", "", text)
    squashed = re.sub(r"\s+", "", joined)
    words = {w.lower() for w in _WORD.findall(joined)}
    return words | {"\0" + squashed.lower()}


def coverage_ratio(tex_body: str, pdf_text: str) -> float | None:
    """Share of the PDF section's words that the LaTeX section holds, maths
    included — an identifier in a formula is still the same word."""
    want = {w.lower() for w in _WORD.findall(_unligature(pdf_text))}
    if not want:
        return None
    have = {w.lower() for w in _WORD.findall(re.sub(r"\\[a-zA-Z]+", " ", tex_body))}
    squashed = re.sub(r"\s+", "", tex_body).lower()
    return sum(1 for w in want if w in have or w in squashed) / len(want)


def _unligature(text: str) -> str:
    for k, v in _LIGATURES.items():
        text = text.replace(k, v)
    return text


def prose_ratio(tex_body: str, pdf_text: str) -> float | None:
    want = prose_words(tex_body)
    if not want:
        return None
    have = pdf_words(pdf_text)
    squashed = next(w for w in have if w.startswith("\0"))
    hit = sum(1 for w in want if w in have or w in squashed)
    return hit / len(want)


# ── the entry ───────────────────────────────────────────────────────────────

@dataclass
class Report:
    entry: str
    status: str  # overlaid | skipped | failed
    reason: str = ""
    sections: list[dict] = field(default_factory=list)


def split_frontmatter(md: str) -> tuple[str, str]:
    if md.startswith("---\n"):
        end = md.find("\n---\n", 4)
        if end >= 0:
            return md[: end + 5], md[end + 5 :]
    return "", md


def overlay_entry(entry: str, source: str | None, dry_run: bool, library: str | None = None) -> Report:
    rep = Report(entry=entry, status="skipped")
    spath = os.path.join(entry, "structure.json")
    if not os.path.exists(spath):
        rep.reason = "no structure.json — run a PDF rung first"
        return rep
    with open(spath) as fh:
        structure = json.load(fh)
    if structure.get("granularity") == "page":
        rep.reason = "page granularity — no titled sections to pair a \\section with"
        return rep
    src = source or os.path.join(entry, SOURCE_DIRNAME)
    if source is None and not os.path.exists(src) and library:
        # A staged entry is fresh; the source lives in the promoted one.
        src = os.path.join(library, os.path.basename(entry), SOURCE_DIRNAME)
    if not os.path.exists(src):
        rep.reason = f"no LaTeX source at {os.path.relpath(src, entry)} — fetch it with arxiv-source.py"
        return rep
    files = read_source(src)
    main = main_tex(files)
    if main is None:
        rep.reason = f"source holds {len(files)} .tex file(s), none with \\documentclass and \\begin{{document}}"
        return rep
    preamble, secs = tex_sections(inline_inputs(main, files))
    if not secs:
        rep.reason = f"{main} has no \\section"
        return rep

    by_title: dict[str, int] = {}
    for k, sec in enumerate(secs):
        by_title.setdefault(norm_title(sec.title), k)
    sdir = os.path.join(entry, "sections")
    applied = 0
    pairs: list[tuple[dict, dict, int | None]] = []
    for s in structure.get("sections", []):
        row: dict = {"id": s["id"], "title": s.get("title", "")}
        rep.sections.append(row)
        want = norm_title(s.get("title", ""))
        k = by_title.get(want)
        if k is None and want:
            close = difflib.get_close_matches(want, list(by_title), n=1, cutoff=TITLE_RATIO)
            k = by_title[close[0]] if close else None
        pairs.append((s, row, k))
    body = bodies_for(secs, {k for _, _, k in pairs if k is not None})
    for s, row, k in pairs:
        if k is None:
            row["result"] = "no matching \\section"
            continue
        tex = TexSection(title=secs[k].title, body=body[k], level=secs[k].level)
        mdpath = os.path.join(sdir, f"{s['id']}.md")
        if not os.path.exists(mdpath):
            row["result"] = "section file missing"
            continue
        with open(mdpath, encoding="utf-8") as fh:
            fm, pdf_text = split_frontmatter(fh.read())
        ratio = prose_ratio(tex.body, pdf_text)
        row["prose_ratio"] = None if ratio is None else round(ratio, 3)
        if ratio is None or ratio < PROSE_RATIO:
            row["result"] = "prose gate failed — titles agree, contents do not"
            continue
        cover = coverage_ratio(tex.body, pdf_text)
        row["coverage_ratio"] = None if cover is None else round(cover, 3)
        if cover is None or cover < COVERAGE_RATIO:
            row["result"] = "coverage gate failed — the LaTeX section holds only part of the PDF section"
            continue
        md, conv = to_markdown(preamble, tex.body)
        row["result"] = "overlaid"
        row["converter"] = conv
        applied += 1
        if dry_run:
            continue
        fm_lines = [l for l in fm.rstrip("\n").split("\n")[:-1]
                    if not l.startswith(("text_source:", "latex_prose_ratio:", "latex_coverage_ratio:"))]
        fm_lines += ["text_source: latex", f"latex_prose_ratio: {round(ratio, 3)}",
                     f"latex_coverage_ratio: {round(cover, 3)}", "---", ""]
        with open(mdpath, "w", encoding="utf-8") as fh:
            fh.write("\n".join(fm_lines) + md + "\n")

    rep.status = "overlaid"
    rep.reason = f"{applied} of {len(structure.get('sections', []))} sections from {main}"
    if not dry_run:
        structure.setdefault("source", {})["math_source"] = "latex" if applied else "text-layer"
        structure.setdefault("diagnostics", {})["latex_overlay"] = {
            "_schema": OVERLAY_SCHEMA,
            "main": main,
            "tex_sections": len(secs),
            "overlaid": applied,
            "thresholds": {"title": TITLE_RATIO, "prose": PROSE_RATIO, "coverage": COVERAGE_RATIO},
            "sections": rep.sections,
        }
        with open(spath, "w") as fh:
            json.dump(structure, fh, indent=1)
    return rep


def main() -> int:
    ap = argparse.ArgumentParser(description="overlay LaTeX-source section text onto an ingested entry")
    ap.add_argument("entries", nargs="+", help="library/<bib-slug>/ directories")
    ap.add_argument("--source", help="the LaTeX source (one entry only); default <entry>/source/")
    ap.add_argument("--library", help="library root to look in for <slug>/source/ when the entry has none (a staged entry)")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    ap.add_argument("--json", action="store_true", help="print the reports as JSON")
    args = ap.parse_args()
    if args.source and len(args.entries) > 1:
        ap.error("--source names one entry's source; give one entry")

    reports: list[Report] = []
    for e in args.entries:
        try:
            reports.append(overlay_entry(e.rstrip("/"), args.source, args.dry_run, args.library))
        except Exception as exc:  # one bad bundle must not stop a library run
            reports.append(Report(entry=e, status="failed", reason=f"{type(exc).__name__}: {exc}"))

    if args.json:
        print(json.dumps([r.__dict__ for r in reports], indent=1))
    else:
        for r in reports:
            print(f"{r.status:<9} {os.path.basename(r.entry):<34} {r.reason}")
        n = {s: sum(r.status == s for r in reports) for s in ("overlaid", "skipped", "failed")}
        print(f"\n{n['overlaid']} overlaid, {n['skipped']} skipped, {n['failed']} failed", file=sys.stderr)
    return 1 if any(r.status == "failed" for r in reports) else 0


if __name__ == "__main__":
    sys.exit(main())
