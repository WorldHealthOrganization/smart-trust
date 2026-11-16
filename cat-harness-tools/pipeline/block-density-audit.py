#!/usr/bin/env python3
"""
Block density and topic-coherence audit.

Scans all .md content files and reports:
  1. Oversized blocks (> 40 lines ≈ 2/3 page)
  2. Large tables embedded in non-table blocks (> 5 rows)
  3. Multi-topic blocks (heuristic: block lives in chapter X but
     majority of its content references chapter Y concepts)

Usage:
  cd content && python3 pipeline/block-density-audit.py [paper-dir]
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from dataclasses import dataclass

# ── Constants ─────────────────────────────────────────────────────

# A block longer than this (non-blank .md lines) may need splitting.
MAX_BLOCK_LINES = 40

# Tables with more than this many data rows should be their own block.
MAX_INLINE_TABLE_ROWS = 5

# Chapter topic keywords — rough heuristic for topic detection.
CHAPTER_KEYWORDS: dict[str, list[str]] = {
    "introduction": ["overview", "outline", "motivation"],
    "quantum-universes": ["quantum universe", "fibre functor", "Tannaka",
                          "monoidal", "dagger", "Frobenius"],
    "quantum-observable-universes": ["observable", "QOU", "theta", "state bundle",
                                      "jet bundle", "q-codifferential"],
    "lifting-and-descent": ["lifting", "descent", "torsion", "jet", "prolongation",
                             "brane tower"],
    "braids-and-knots": ["braid", "knot", "Hecke", "Markov trace", "skein",
                          "crossing", "Jones polynomial", "SU(2)", "SO(3)",
                          "vertex operator", "transfer matrix", "trefoil"],
    "models-of-qous": ["Calabi-Yau", "ALE", "instanton", "Reeb", "Riemannian",
                        "Webster", "inner product"],
    "descartes-universe": ["Bring", "Descartes", "color tube", "coral",
                            "shell", "hadron", "proton", "neutron", "quark",
                            "beta decay", "nucleus", "nuclear", "half-life",
                            "periodic table", "torus knot T_{"],
    "algebraic-substrate": ["substrate", "Collatz", "algebraic", "classical limit",
                             "Hasse-Weil", "Birch", "rigid dualizing"],
    "fluid-dynamics": ["fluid", "Navier--Stokes", "vortex", "turbulence",
                        "Reynolds", "helicity", "Madelung"],
    "information-theory": ["information", "entropy", "Planck", "speed of light",
                            "gravitational constant", "Bekenstein", "horizon",
                            "CMB", "big bang", "aeon"],
    "observations": ["CODATA", "PDG", "experiment", "measurement", "prediction",
                      "crystal", "photonic Hall", "fine structure", "lepton",
                      "proton radius"],
    "organic-chemistry": ["benzene", "covalent", "carbon", "organic", "molecular",
                           "ring closure"],
    "glossary": ["glossary"],
}


@dataclass
class Finding:
    severity: str  # "HIGH" | "MEDIUM" | "LOW"
    kind: str      # "oversized" | "large-table" | "multi-topic"
    block: str     # block root name
    chapter: str   # chapter directory
    detail: str
    lines: int = 0
    table_rows: int = 0


def count_table_rows(content: str) -> list[tuple[int, int]]:
    """Find markdown tables and return (start_line, row_count) for each."""
    tables = []
    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # A markdown table row starts with |
        if line.startswith("|") and "|" in line[1:]:
            start = i
            row_count = 0
            while i < len(lines) and lines[i].strip().startswith("|"):
                stripped = lines[i].strip()
                # Skip separator rows (|---|---|)
                if re.match(r"^\|[\s\-:]+\|", stripped):
                    i += 1
                    continue
                # Skip header row (first data row)
                if row_count == 0:
                    row_count += 1
                    i += 1
                    continue
                row_count += 1
                i += 1
            if row_count > 1:  # at least header + 1 data row
                tables.append((start, row_count - 1))  # subtract header
        else:
            i += 1
    return tables


def detect_topics(content: str, home_chapter: str) -> dict[str, int]:
    """Count keyword hits per chapter topic."""
    scores: dict[str, int] = {}
    content_lower = content.lower()
    for chapter, keywords in CHAPTER_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw.lower() in content_lower)
        if hits > 0:
            scores[chapter] = hits
    return scores


def audit_block(md_path: Path, chapter_dir: str) -> list[Finding]:
    """Audit a single .md block file."""
    findings = []
    block_name = md_path.stem
    content = md_path.read_text(encoding="utf-8", errors="replace")
    non_blank = [l for l in content.split("\n") if l.strip()]
    line_count = len(non_blank)

    # 1. Oversized block
    if line_count > MAX_BLOCK_LINES:
        findings.append(Finding(
            severity="MEDIUM",
            kind="oversized",
            block=block_name,
            chapter=chapter_dir,
            detail=f"{line_count} non-blank lines (limit: {MAX_BLOCK_LINES}). "
                   f"Consider splitting into focused sub-blocks.",
            lines=line_count,
        ))

    # 2. Large embedded tables
    # First check if this is already a table-kind block
    ts_path = md_path.with_suffix(".ts")
    is_table_kind = False
    block_kind = "unknown"
    if ts_path.exists():
        ts_content = ts_path.read_text(encoding="utf-8", errors="replace")
        if 'kind: "table"' in ts_content or "kind: 'table'" in ts_content or "table(" in ts_content:
            is_table_kind = True
        # Extract block kind
        kind_match = re.search(r"""(?:kind:\s*["'](\w+)["']|^export default (\w+)\()""", ts_content, re.M)
        if kind_match:
            block_kind = kind_match.group(1) or kind_match.group(2) or "unknown"

    if not is_table_kind:
        tables = count_table_rows(content)
        for start_line, data_rows in tables:
            if data_rows > MAX_INLINE_TABLE_ROWS:
                findings.append(Finding(
                    severity="HIGH",
                    kind="large-table",
                    block=block_name,
                    chapter=chapter_dir,
                    detail=f"Table at line {start_line+1} has {data_rows} data rows "
                           f"(limit: {MAX_INLINE_TABLE_ROWS}) in a '{block_kind}' block. "
                           f"Extract to a standalone 'table' block with label 'tbl:{block_name}-data'.",
                    table_rows=data_rows,
                ))

    # 3. Multi-topic detection (only for blocks > 20 lines)
    if line_count > 20:
        topics = detect_topics(content, chapter_dir)
        if topics:
            home_score = topics.get(chapter_dir, 0)
            for other_ch, score in sorted(topics.items(), key=lambda x: -x[1]):
                if other_ch != chapter_dir and score > home_score and score >= 3:
                    findings.append(Finding(
                        severity="LOW",
                        kind="multi-topic",
                        block=block_name,
                        chapter=chapter_dir,
                        detail=f"Block has {score} keyword hits for '{other_ch}' "
                               f"but only {home_score} for its home chapter '{chapter_dir}'. "
                               f"Consider splitting: move {other_ch}-specific content there.",
                        lines=line_count,
                    ))
                    break  # report only the strongest mismatch

    return findings


def main():
    root = Path(os.getcwd())
    paper_dir = sys.argv[1] if len(sys.argv) > 1 else "quantum-observable-universe"
    paper_path = root / paper_dir

    if not paper_path.exists():
        print(f"Paper directory not found: {paper_path}", file=sys.stderr)
        sys.exit(1)

    all_findings: list[Finding] = []

    # Walk all chapter directories
    for chapter_path in sorted(paper_path.iterdir()):
        if not chapter_path.is_dir():
            continue
        chapter_name = chapter_path.name
        if chapter_name in ("lean", "schema", "pipeline", "node_modules"):
            continue

        for md_file in sorted(chapter_path.glob("*.md")):
            findings = audit_block(md_file, chapter_name)
            all_findings.extend(findings)

    # ── Report ────────────────────────────────────────────────────
    print(f"# Block Density Audit: {paper_dir}\n")

    # Summary
    high = [f for f in all_findings if f.severity == "HIGH"]
    med = [f for f in all_findings if f.severity == "MEDIUM"]
    low = [f for f in all_findings if f.severity == "LOW"]

    print(f"**Total findings:** {len(all_findings)} "
          f"({len(high)} HIGH, {len(med)} MEDIUM, {len(low)} LOW)\n")

    # By kind
    large_tables = [f for f in all_findings if f.kind == "large-table"]
    oversized = [f for f in all_findings if f.kind == "oversized"]
    multi_topic = [f for f in all_findings if f.kind == "multi-topic"]

    print(f"| Category | Count |")
    print(f"|----------|-------|")
    print(f"| Large tables in non-table blocks (> {MAX_INLINE_TABLE_ROWS} rows) | {len(large_tables)} |")
    print(f"| Oversized blocks (> {MAX_BLOCK_LINES} lines) | {len(oversized)} |")
    print(f"| Multi-topic blocks (topic mismatch) | {len(multi_topic)} |")
    print()

    # Detailed findings
    if large_tables:
        print(f"## 🔴 Large Tables to Extract ({len(large_tables)})\n")
        print(f"| Block | Chapter | Rows | Action |")
        print(f"|-------|---------|------|--------|")
        for f in sorted(large_tables, key=lambda x: -x.table_rows):
            print(f"| `{f.block}` | {f.chapter} | {f.table_rows} | {f.detail.split('. ')[-1]} |")
        print()

    if oversized:
        print(f"## 🟡 Oversized Blocks ({len(oversized)})\n")
        print(f"| Block | Chapter | Lines | Note |")
        print(f"|-------|---------|-------|------|")
        for f in sorted(oversized, key=lambda x: -x.lines):
            print(f"| `{f.block}` | {f.chapter} | {f.lines} | Review for splitting |")
        print()

    if multi_topic:
        print(f"## 🔵 Multi-Topic Blocks ({len(multi_topic)})\n")
        print(f"| Block | Home Chapter | Stronger Topic | Detail |")
        print(f"|-------|-------------|----------------|--------|")
        for f in multi_topic:
            # Extract the stronger topic from the detail
            m = re.search(r"keyword hits for '([^']+)'", f.detail)
            stronger = m.group(1) if m else "?"
            print(f"| `{f.block}` | {f.chapter} | {stronger} | {f.detail[:80]}... |")
        print()

    if not all_findings:
        print("✅ No density issues found.\n")


if __name__ == "__main__":
    main()
