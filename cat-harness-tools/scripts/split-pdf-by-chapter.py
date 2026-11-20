#!/usr/bin/env python3
"""split-pdf-by-chapter.py — Post-process main.pdf into per-chapter PDFs.

Reads top-level outline (bookmarks) from a compiled main.pdf and slices
the document into smaller per-chapter PDFs, plus a bundled front-matter
PDF (front matter aggregate).

Per-appendix PDFs are produced upstream by direct `pdflatex` of
`standalone-*.tex` files and are NOT touched by this script.

Usage:
    python3 scripts/split-pdf-by-chapter.py [--pdf main.pdf]
                                            [--paper <dir>]
                                            [--out-dir <dir>]
                                            [--front-matter-name front-matter]
                                            [--manifest <chapters>.json]

Chapter list is taken from the paper manifest
(`content/<paper>/<paper>.ts`). The order of bookmarks in the PDF is
assumed to match the chapter order in the manifest, **after excluding**
any chapters marked as appendices (their PDFs are produced standalone).

Front matter chapters are still emitted as individual chapter PDFs when
they exist in main.pdf, and also aggregated into front-matter.pdf.

Outputs (in --out-dir, default = current directory):
    <slug>.pdf                   — one per main chapter
    front-matter.pdf             — bundled front matter + notation + glossary + index
    pdf-split-manifest.json      — machine-readable list of outputs

Exit codes:
    0  success
    1  manifest / PDF inconsistency (chapter count mismatch, etc.)
    2  pypdf import or file-not-found errors
"""

from __future__ import annotations

import argparse
import json
import re
import pathlib
import sys
from pathlib import Path

# See scripts/_pypdf_compat.py: a broken `cryptography` native extension panics
# instead of raising ImportError, and the panic is not an Exception subclass.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _pypdf_compat import import_pypdf  # noqa: E402

PdfReader, PdfWriter = import_pypdf("PdfReader", "PdfWriter")


# Chapter slugs bundled into front-matter.pdf rather than as standalone PDFs.
# Membership-only set: the actual page order in front-matter.pdf is determined
# by the PDF bookmark traversal in `ranges` (whatever order the chapters
# appear in main.pdf), not by this constant.
FRONT_MATTER_GROUP: frozenset[str] = frozenset({
    "introduction",
    "notation",
    "glossary",
    "index-of-definitions",
})


def parse_chapter_list(manifest_path: Path) -> list[str]:
    """Extract ordered list of chapter directories from the paper manifest."""
    src = manifest_path.read_text()
    # Match chapterRef({ dir: "..." }) in source order.
    return [m.group(1) for m in re.finditer(r'chapterRef\(\s*\{\s*dir:\s*["\']([^"\']+)["\']', src)]


def parse_appendix_dirs(manifest_path: Path) -> set[str]:
    """Heuristic: any chapter dir starting with 'appendix-' is an appendix."""
    return {dir for dir in parse_chapter_list(manifest_path) if dir.startswith("appendix-")}


def parse_chapter_title(repo_root: Path, paper: str, chapter_dir: str) -> str:
    """Read the chapter's title from content/<paper>/<dir>/<dir>.ts."""
    ts_path = repo_root / "content" / paper / chapter_dir / f"{chapter_dir}.ts"
    if not ts_path.exists():
        return chapter_dir  # fallback to dir name
    src = ts_path.read_text()
    m = re.search(r'title:\s*["\']([^"\']+)["\']', src)
    return m.group(1) if m else chapter_dir


def collect_all_bookmarks(reader: PdfReader) -> list[tuple[str, int, int]]:
    """Return [(title, start_page_0idx, depth), ...] for every outline entry,
    flat across depths. Title-based matching against the manifest is more
    robust than position-based matching because the LaTeX render can promote
    section-level entries to outline depth 0 (e.g. notation register
    subsections) or demote chapters below depth 0 (e.g. molecular-construction
    missing entirely from depth-0 listing).
    """
    out: list[tuple[str, int, int]] = []

    def walk(items, depth=0):
        for item in items:
            if isinstance(item, list):
                # nested list = children of the previous sibling
                walk(item, depth=depth + 1)
                continue
            title = getattr(item, "title", None) or "(untitled)"
            try:
                page = reader.get_destination_page_number(item)
            except Exception:
                page = None
            if page is not None:
                out.append((title, page, depth))

    walk(reader.outline, depth=0)
    return out


def normalize_title(s: str) -> str:
    """Lowercase and collapse non-alphanumerics for tolerant matching."""
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def find_bookmark_for_chapter(
    chapter_title: str,
    bookmarks: list[tuple[str, int, int]],
) -> int | None:
    """Find the bookmark index whose title matches the chapter title.
    Strategy: exact match (normalized) at the shallowest depth available,
    then prefix match, then substring match. Returns the bookmark index or
    None if no match found.
    """
    target = normalize_title(chapter_title)
    if not target:
        return None

    # 1. Exact match at shallowest depth
    best_idx = None
    best_depth = 999
    for i, (title, _page, depth) in enumerate(bookmarks):
        if normalize_title(title) == target and depth < best_depth:
            best_idx = i
            best_depth = depth
    if best_idx is not None:
        return best_idx

    # 2. Prefix match
    for i, (title, _page, _depth) in enumerate(bookmarks):
        nt = normalize_title(title)
        if nt.startswith(target) or target.startswith(nt):
            if len(nt) >= 4 and len(target) >= 4:  # avoid trivial matches
                return i

    # 3. Substring match (avoid runaway false positives — require ≥6 chars)
    if len(target) >= 6:
        for i, (title, _page, _depth) in enumerate(bookmarks):
            if target in normalize_title(title):
                return i

    return None


def slice_pdf(reader: PdfReader, start_page: int, end_page: int, dest: Path) -> None:
    """Write pages [start_page, end_page) of reader to dest (0-indexed, exclusive end)."""
    writer = PdfWriter()
    for i in range(start_page, end_page):
        writer.add_page(reader.pages[i])
    # Preserve PDF metadata
    if reader.metadata:
        writer.add_metadata({k: v for k, v in reader.metadata.items() if v is not None})
    with open(dest, "wb") as f:
        writer.write(f)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--pdf", default="main.pdf", help="path to compiled main.pdf")
    ap.add_argument("--paper", default="quantum-observable-universe",
                    help="paper directory under content/")
    ap.add_argument("--out-dir", default=".", help="output directory")
    ap.add_argument("--front-matter-name", default="front-matter",
                    help="basename for the bundled front-matter PDF (no .pdf suffix)")
    ap.add_argument("--manifest", default=None,
                    help="override path to paper manifest (.ts)")
    args = ap.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    repo_root = Path(__file__).resolve().parent.parent
    manifest_path = Path(args.manifest) if args.manifest else \
        repo_root / "content" / args.paper / f"{args.paper}.ts"
    if not manifest_path.exists():
        print(f"ERROR: paper manifest not found: {manifest_path}", file=sys.stderr)
        return 2

    all_chapters = parse_chapter_list(manifest_path)
    appendix_dirs = parse_appendix_dirs(manifest_path)
    # The main.pdf has every chapter EXCEPT appendices (those are standalone).
    main_chapters_in_order = [c for c in all_chapters if c not in appendix_dirs]

    if not main_chapters_in_order:
        print("ERROR: no chapters found in manifest", file=sys.stderr)
        return 1

    print(f"Loading {pdf_path}...")
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    print(f"  {total_pages} pages total")

    bookmarks = collect_all_bookmarks(reader)
    print(f"  {len(bookmarks)} outline entries (all depths)")

    # Hard fail: no bookmarks at all means the PDF has no outline.
    if not bookmarks:
        print("ERROR: main.pdf has no outline entries — cannot split. "
              "Ensure hyperref is loaded and \\chapter{...} commands produce "
              "outline entries.", file=sys.stderr)
        return 1

    # Build chapter-dir → (title, matched_bookmark_idx, start_page) map by
    # matching each manifest chapter's title against the flat outline.
    # Position-based matching is unreliable: front-matter (notation register)
    # subsections frequently get promoted to outline depth 0, and some content
    # chapters (e.g. molecular-construction) are not bookmarked at depth 0 in
    # the rendered PDF. Title-based matching is robust against both cases.
    matched: list[tuple[str, str, int]] = []  # (chapter_dir, title, start_page)
    unmatched: list[str] = []
    for chapter_dir in main_chapters_in_order:
        chapter_title = parse_chapter_title(repo_root, args.paper, chapter_dir)
        bm_idx = find_bookmark_for_chapter(chapter_title, bookmarks)
        if bm_idx is None:
            unmatched.append(f"{chapter_dir} (title: {chapter_title!r})")
            print(f"  ⚠ no bookmark match for chapter: {chapter_dir} "
                  f"(title: {chapter_title!r})", file=sys.stderr)
            continue
        matched.append((chapter_dir, bookmarks[bm_idx][0], bookmarks[bm_idx][1]))

    # Sort matched chapters by page (preserves the order they appear in the
    # rendered PDF, which should match the manifest order but we don't rely
    # on it).
    matched.sort(key=lambda x: x[2])

    if not matched:
        print(f"ERROR: matched zero of {len(main_chapters_in_order)} manifest "
              "chapters to bookmarks — cannot split. Available bookmark titles "
              "(first 10):", file=sys.stderr)
        for bt, bp, bd in bookmarks[:10]:
            print(f"    [d={bd} p={bp + 1}] {bt}", file=sys.stderr)
        return 1

    # A heavy mismatch (less than half matched) likely indicates a stale
    # manifest or a rendering bug; refuse to publish rather than ship a
    # mostly-empty split.
    match_ratio = len(matched) / len(main_chapters_in_order)
    if match_ratio < 0.6:
        print(f"ERROR: only {len(matched)} of {len(main_chapters_in_order)} "
              f"manifest chapters matched bookmarks ({match_ratio:.0%}). "
              "Refusing to publish a misaligned split. Unmatched: "
              f"{', '.join(unmatched[:5])}{' ...' if len(unmatched) > 5 else ''}",
              file=sys.stderr)
        return 1

    if unmatched:
        print(f"  ⚠ {len(unmatched)} chapter(s) unmatched; their pages will be "
              f"absorbed into the prior matched chapter's PDF: {unmatched}",
              file=sys.stderr)

    # Determine page ranges for each matched chapter: chapter i spans
    # [start_i, start_{i+1}); the last matched chapter extends to the next
    # *outline* entry after it (whether matched or not) — this prevents
    # trailing appendix bookmarks (Q-Value, Surreal, Appendix B refs) that
    # somehow ended up in main.pdf from being absorbed into the final
    # content chapter PDF.
    last_match_page = matched[-1][2]
    next_outline_page_after_last = total_pages
    for bt, bp, bd in bookmarks:
        if bp > last_match_page:
            next_outline_page_after_last = bp
            break

    ranges: list[tuple[str, str, int, int]] = []
    for i, (slug, title, page) in enumerate(matched):
        if i + 1 < len(matched):
            next_page = matched[i + 1][2]
        else:
            next_page = next_outline_page_after_last
        ranges.append((slug, title, page, next_page))

    # Write per-chapter PDFs for all matched chapters (including front matter
    # chapters when they are present in main.pdf).
    outputs = []
    for slug, title, start, end in ranges:
        dest = out_dir / f"{slug}.pdf"
        slice_pdf(reader, start, end, dest)
        outputs.append({"slug": slug, "title": title,
                        "pages": [start + 1, end],
                        "path": str(dest.name)})
        print(f"  [chapter] {slug}: pages {start + 1}–{end} → {dest.name}")

    non_front_ranges = [r for r in ranges if r[0] not in FRONT_MATTER_GROUP]
    if non_front_ranges:
        first_content_start = non_front_ranges[0][2]
    else:
        first_content_start = total_pages

    # Build front-matter bundle = pages [0, first_content_start).
    # We deliberately do NOT include the tail [*, total_pages):
    # in QOU's render the tail contains stray appendix bookmarks (Q-Value,
    # Surreal, Appendix B references) that already have their own standalone
    # PDFs from step 2c. Glossary and index-of-definitions live in the head
    # region (they're rendered before the first content chapter) so they're
    # captured automatically.
    fm_writer = PdfWriter()
    fm_segments: list[tuple[int, int]] = []
    if first_content_start > 0:
        fm_segments.append((0, first_content_start))
        for i in range(0, first_content_start):
            fm_writer.add_page(reader.pages[i])

    if fm_segments:
        fm_dest = out_dir / f"{args.front_matter_name}.pdf"
        if reader.metadata:
            fm_writer.add_metadata({k: v for k, v in reader.metadata.items() if v is not None})
        with open(fm_dest, "wb") as f:
            fm_writer.write(f)
        bundled = [r[0] for r in ranges if r[0] in FRONT_MATTER_GROUP]
        outputs.append({
            "slug": args.front_matter_name,
            "title": "Front matter (introduction, notation, glossary, index)",
            "pages": None,
            "path": fm_dest.name,
            "page_segments": [[s + 1, e] for s, e in fm_segments],
            "bundled_chapters": bundled,
        })
        print(f"  [front-matter] {fm_dest.name} ← pages "
              f"{', '.join(f'{s+1}–{e}' for s, e in fm_segments)}")
    else:
        print("  ⚠ no front-matter pages to bundle (first content chapter "
              "starts at page 1 and last content chapter ends at total_pages)")

    # Emit machine-readable manifest.
    manifest_out = out_dir / "pdf-split-manifest.json"
    manifest_out.write_text(json.dumps({
        "pdf": str(pdf_path.name),
        "total_pages": total_pages,
        "outputs": outputs,
    }, indent=2))
    print(f"\nWrote: {manifest_out.name}")
    print(f"Total outputs: {len(outputs)} PDF(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
