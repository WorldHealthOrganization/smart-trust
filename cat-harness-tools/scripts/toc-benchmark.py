#!/usr/bin/env python3
"""
toc-benchmark — score table-of-contents extractors against held-out PDF
outlines. Issue #2302, bean `cp3v`.

A PDF that carries an embedded outline (bookmarks) has its author's own answer
to "what are the sections". Hide it, run each extractor on the page content
alone, and score the result against it. That gives an answer key over the
whole corpus without labelling anything by hand. The outline is not perfect
ground truth (some omit the title, some add front matter), which is why the
report gives several metrics rather than one.

Metrics, per document and then averaged (macro) over documents:

* title P/R/F1 — an extracted entry matches a gold entry when their
  normalised titles are similar (ratio >= 0.85, see `_pdf_headings.similar`);
  one-to-one, in document order.
* link F1  — matched AND on the same physical page (ICDAR "matching links").
* level F1 — matched AND at the same depth, up to one constant shift (the
  commonest among matched pairs), so an outline that omits the chapter level
  is not scored zero for it (ICDAR "matching levels", relative form).
* full F1  — matched with both page and level right ("complete entries").
* capped F1 — title F1 after dropping predictions deeper than the outline's
  deepest level: an outline that stops at level 2 otherwise makes every real
  level-3 heading a false positive.
* TEDS     — 1 - TED(T_pred, T_gold) / max(|T_pred|, |T_gold|), the tree-edit
  similarity of Wang, Gui & He (2023), labels compared with the same rule.

The first four are the ICDAR Book Structure Extraction family used by Wu,
Mitra & Giles (ICDAR 2013) and, as "Xerox F1", by Bentabet et al. (2019).

Usage:
    toc-benchmark.py [PDF ...]            # default: every PDF with >= 5 outline entries
    toc-benchmark.py --json out.json      # also write per-document results
    toc-benchmark.py --methods regex,font # choose methods
    toc-benchmark.py --layout-backend pdfminer   # font metrics from pdfminer.six
    toc-benchmark.py --gold scripts/tests/fixtures/dth-toc-gold.json --methods pipeline,consensus \\
        <who-iris>/uploads/9789240116191-eng/9789240116191-eng.pdf ...   # hand-made answer keys
"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import os
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _pdf_headings as H  # noqa: E402
from _benchmark_guard import assert_not_declared_graph_path  # noqa: E402

MATCH = 0.85


def _load_pdf_structure():
    spec = importlib.util.spec_from_file_location("pdf_structure", os.path.join(HERE, "pdf-structure.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pdf_structure"] = mod     # dataclasses look the module up
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


# ---------------------------------------------------------------- methods


@dataclass
class Doc:
    path: str
    gold: list[H.Heading]
    lines: list[H.Line]
    pages: list[str]


def m_regex(doc: Doc) -> list[H.Heading]:
    """The current pdf-structure.py fallback, verdict included."""
    ps = PS
    inferred = ps.infer_headings([ps.join_soft_hyphens(p) for p in doc.pages])
    if ps.inferred_toc_verdict(inferred, len(doc.pages)):
        return []
    return [H.Heading(e.level, e.title, e.page, e.number) for e in inferred]


def m_size(doc: Doc) -> list[H.Heading]:
    """Size-only construction (Wang et al. 2023, step 1): anything set larger
    than the body is a heading; larger size = shallower level."""
    body = H.body_size(doc.lines)
    furn = H.furniture_keys(doc.lines, max((l.page for l in doc.lines), default=0))
    cands = [l for l in doc.lines if l.size > body + 0.4 and H.RE_HAS_WORD.search(l.text)
             and H._furniture_key(l) not in furn and len(l.text) <= 160]
    sizes = sorted({l.size for l in cands}, reverse=True)
    rank = {s: i + 1 for i, s in enumerate(sizes)}
    out = []
    for l in cands:
        num, t = H.split_number(l.text)
        out.append(H.Heading(rank[l.size], t, l.page, num))
    return out


def m_font(doc: Doc) -> list[H.Heading]:
    return H.font_headings(doc.lines)


def m_contents(doc: Doc) -> list[H.Heading]:
    return H.contents_headings(doc.lines)


def m_layout(doc: Doc) -> list[H.Heading]:
    return H.layout_headings(doc.lines)[0]


TEI_DIR: str | None = None          # set by --grobid-tei


def _tei_headings(path: str) -> list[H.Heading]:
    """Grobid's TEI-XML body headings as `Heading`s.

    Grobid writes the body as a FLAT run of `<div>`s, each opening with a
    `<head>`; the hierarchy is only in the `n` attribute ("1.1"), so depth is
    read from it and an unnumbered head is level 1. The page comes from the
    head's `coords` ("page,x,y,w,h;...") when Grobid was asked for
    `teiCoordinates=head`.
    """
    import xml.etree.ElementTree as ET
    ns = {"tei": "http://www.tei-c.org/ns/1.0"}
    root = ET.parse(path).getroot()
    out: list[H.Heading] = []
    for head in root.iterfind(".//tei:text/tei:body//tei:head", ns):
        title = re.sub(r"\s+", " ", "".join(head.itertext())).strip()
        if not title:
            continue
        n = (head.get("n") or "").strip().rstrip(".") or None
        level = n.count(".") + 1 if n and re.fullmatch(r"\d+(?:\.\d+)*", n) else 1
        coords = head.get("coords") or ""
        page = int(coords.split(",")[0]) if re.match(r"^\d+,", coords) else None
        out.append(H.Heading(level, title, page, n))
    return out


def m_grobid(doc: Doc) -> list[H.Heading]:
    """Grobid (CRF models, `processFulltextDocument`), read from saved TEI.

    Run Grobid separately and save `<stem>.tei.xml` per PDF into the
    directory given by --grobid-tei; a PDF with no TEI scores as empty.
    """
    if not TEI_DIR:
        return []
    stem = os.path.splitext(os.path.basename(doc.path))[0]
    tei = os.path.join(TEI_DIR, stem + ".tei.xml")
    return _tei_headings(tei) if os.path.exists(tei) else []


MMD_DIR: str | None = None          # set by --nougat-mmd


def _mmd_headings(path: str) -> list[H.Heading]:
    """Nougat's Markdown (`.mmd`) headings as `Heading`s.

    Depth is the count of `#`. Nougat marks no page boundaries in its default
    output, so `page` is None and link F1 is not measurable for it; title,
    level and TEDS are. Fenced code is skipped.
    """
    out: list[H.Heading] = []
    fenced = False
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.lstrip().startswith("```"):
                fenced = not fenced
                continue
            m = None if fenced else re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
            if not m or not m.group(2):
                continue
            title = re.sub(r"\*\*|__|\\[()\[\]]", "", m.group(2)).strip()
            num, t = H.split_number(title)
            out.append(H.Heading(len(m.group(1)), t, None, num))
    return H.tree_levels(out)


def m_nougat(doc: Doc) -> list[H.Heading]:
    """Nougat (Blecher et al. 2023), read from saved `<stem>.mmd` files in the
    directory given by --nougat-mmd; a PDF with no output scores as empty."""
    if not MMD_DIR:
        return []
    stem = os.path.splitext(os.path.basename(doc.path))[0]
    mmd = os.path.join(MMD_DIR, stem + ".mmd")
    return _mmd_headings(mmd) if os.path.exists(mmd) else []


def m_consensus(doc: Doc) -> list[H.Heading]:
    """Contents page cross-checked against the body, plus heading style and
    numbering; Grobid joins as a voter when --grobid-tei is given."""
    others = {}
    g = m_grobid(doc)
    if g:
        others["grobid"] = g
    return [s.heading for s in H.consensus_headings(doc.lines, others)]


def m_pipeline(doc: Doc) -> list[H.Heading]:
    """What `pdf-structure.py` itself would use: the PDF's outline (repaired by
    `repair_outline`) when it has one, else its inferred TOC. Only meaningful
    against a `--gold` key, since against the outline an outline scores 1."""
    import pymupdf
    with pymupdf.open(doc.path) as d:
        raw = d.get_toc(simple=True)
    outline, _ = PS.repair_outline(PS._toc_entries(raw), doc.pages)
    if outline:
        return [H.Heading(e.level, e.title, e.page, e.number) for e in outline]
    toc, _ = PS.infer_toc(doc.lines, doc.pages)
    return [H.Heading(e.level, e.title, e.page, e.number) for e in toc]


def m_latex(doc: Doc) -> list[H.Heading]:
    """The paper's own LaTeX headings, placed on their pages
    (`_pdf_headings.latex_headings`), as `pdf-structure.py` uses them: only
    when the body confirms at least half. Reads the `source/` beside the PDF;
    a PDF with none scores as empty, so run it on entries that have one."""
    src = PS.latex_source_for(doc.path, None)
    if not src:
        return []
    tex = PS._latex_headings.source_headings(src)[0]
    scored = H.latex_headings(doc.lines, tex)
    if not scored or H.latex_found_share(scored) < PS.LATEX_FOUND_SHARE:
        return []
    return [s.heading for s in scored]


METHODS = {
    "regex": m_regex,
    "size": m_size,
    "font": m_font,
    "contents": m_contents,
    "layout": m_layout,
    "consensus": m_consensus,
    "latex": m_latex,
    "grobid": m_grobid,
    "nougat": m_nougat,
    "pipeline": m_pipeline,
}
# Not run unless asked: scored against an outline, the outline scores 1.
NOT_DEFAULT = {"pipeline"}


# ---------------------------------------------------------------- scoring


def in_page_order(entries: list[H.Heading]) -> list[H.Heading]:
    """Stable sort by page. Outlines are not always in document order — one
    WHO handbook lists 1.3 before 1.2 — and the matcher below is an LCS."""
    return sorted(entries, key=lambda e: e.page if e.page is not None else 10**9)


def match(gold: list[H.Heading], pred: list[H.Heading]) -> list[tuple[int, int]]:
    """One-to-one fuzzy title matching that respects document order (an LCS
    over the similarity relation), so a repeated title pairs with its own
    occurrence rather than the first one. Both lists must be in page order."""
    g = [H.norm_title(x.title) for x in gold]
    p = [H.norm_title(x.title) for x in pred]
    n, m = len(g), len(p)
    if not n or not m:
        return []
    # Banded LCS would be faster; documents here are at most a few thousand
    # entries, so the plain table is fine.
    sim = [[H.similar(g[i], p[j]) >= MATCH for j in range(m)] for i in range(n)]
    L = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            L[i][j] = L[i + 1][j + 1] + 1 if sim[i][j] else max(L[i + 1][j], L[i][j + 1])
    pairs, i, j = [], 0, 0
    while i < n and j < m:
        if sim[i][j] and L[i][j] == L[i + 1][j + 1] + 1:
            pairs.append((i, j))
            i, j = i + 1, j + 1
        elif L[i + 1][j] >= L[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def prf(hit: int, n_pred: int, n_gold: int) -> tuple[float, float, float]:
    p = hit / n_pred if n_pred else 0.0
    r = hit / n_gold if n_gold else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def _tree(entries: list[H.Heading]):
    """Nest a flat levelled list: parent = nearest earlier shallower entry."""
    root = ("", [])
    stack = [(0, root)]
    for e in entries:
        node = (H.norm_title(e.title), [])
        while stack[-1][0] >= e.level:
            stack.pop()
        stack[-1][1][1].append(node)
        stack.append((e.level, node))
    return root


def ted(a, b) -> int:
    """Zhang–Shasha tree edit distance, unit costs, fuzzy label equality."""
    def post(t):
        nodes, lmd = [], []
        def walk(n):
            first = None
            for c in n[1]:
                f = walk(c)
                first = f if first is None else first
            nodes.append(n[0])
            idx = len(nodes) - 1
            lmd.append(first if first is not None else idx)
            return lmd[idx]
        walk(t)
        return nodes, lmd

    an, al = post(a)
    bn, bl = post(b)
    kr = lambda l: sorted({max(i for i in range(len(l)) if l[i] == v) for v in set(l)})  # noqa: E731
    ak, bk = kr(al), kr(bl)
    td = [[0] * len(bn) for _ in range(len(an))]
    eq = lambda x, y: x == y or H.similar(x, y) >= MATCH  # noqa: E731
    for i in ak:
        for j in bk:
            fi, fj = al[i], bl[j]
            m, n = i - fi + 2, j - fj + 2
            fd = [[0] * n for _ in range(m)]
            for x in range(1, m):
                fd[x][0] = fd[x - 1][0] + 1
            for y in range(1, n):
                fd[0][y] = fd[0][y - 1] + 1
            for x in range(1, m):
                for y in range(1, n):
                    ii, jj = fi + x - 1, fj + y - 1
                    if al[ii] == fi and bl[jj] == fj:
                        fd[x][y] = min(fd[x - 1][y] + 1, fd[x][y - 1] + 1,
                                       fd[x - 1][y - 1] + (0 if eq(an[ii], bn[jj]) else 1))
                        td[ii][jj] = fd[x][y]
                    else:
                        fd[x][y] = min(fd[x - 1][y] + 1, fd[x][y - 1] + 1,
                                       fd[al[ii] - fi][bl[jj] - fj] + td[ii][jj])
    return td[-1][-1]


def teds(gold: list[H.Heading], pred: list[H.Heading]) -> float | None:
    if len(gold) + len(pred) > 1200:
        return None                    # too slow in pure Python; reported as n/a
    a, b = _tree(gold), _tree(pred)
    return 1 - ted(a, b) / max(len(gold), len(pred), 1)


def outline_is_pages(gold: list[H.Heading]) -> bool:
    """An outline that bookmarks pages ("p. 177", "p. 178" …), or entries with
    no destination in this file, rather than its own sections, is not an
    answer key for a TOC. Set aside, like a /PageLabels that repeats the
    physical index in page-label-benchmark.py. Measured: a JSTOR download's
    outline is its page bookmarks plus the whole journal ISSUE's contents,
    13 articles of which are not in the PDF."""
    foreign = sum(1 for g in gold if RE_PAGE_ENTRY.match(g.title) or g.page is None)
    return foreign >= 0.6 * max(1, len(gold))


def score(gold: list[H.Heading], pred: list[H.Heading]) -> dict:
    gold_tree, pred_tree = gold, pred          # TEDS reads the nesting as given
    gold, pred = in_page_order(gold), in_page_order(pred)
    pairs = match(gold, pred)
    # Levels are compared up to one constant shift, the commonest one among
    # matched pairs: an outline that omits the chapter level (bookmarks
    # starting at "1.1") or adds the title above everything is still the same
    # hierarchy, and an absolute comparison would score it zero.
    shift = Counter(pred[j].level - gold[i].level for i, j in pairs).most_common(1)
    k = shift[0][0] if shift else 0
    lv_ok = lambda i, j: pred[j].level - gold[i].level == k  # noqa: E731
    link = sum(1 for i, j in pairs if gold[i].page is not None and gold[i].page == pred[j].page)
    lev = sum(1 for i, j in pairs if lv_ok(i, j))
    full = sum(1 for i, j in pairs if gold[i].page == pred[j].page and lv_ok(i, j))
    t = prf(len(pairs), len(pred), len(gold))
    # Depth-capped: an outline that stops at level 2 makes every true level-3
    # heading a false positive. Drop predictions deeper than the outline goes
    # (under the same shift) and score the titles again.
    gmax = max((e.level for e in gold), default=0)
    capped = [e for e in pred if e.level - k <= gmax]
    tc = prf(len(match(gold, capped)), len(capped), len(gold))
    return {
        "n_gold": len(gold), "n_pred": len(pred),
        "title_p": t[0], "title_r": t[1], "title_f1": t[2], "capped_f1": tc[2],
        "link_f1": prf(link, len(pred), len(gold))[2],
        "level_f1": prf(lev, len(pred), len(gold))[2],
        "full_f1": prf(full, len(pred), len(gold))[2],
        "teds": teds(gold_tree, pred_tree),
    }


# ---------------------------------------------------------------- driver


RE_SLIDE = re.compile(r"^\s*slide\s+\d+\s*[:.\-–—]?\s*", re.I)
RE_PAGE_ENTRY = re.compile(r"^\s*(?:p\.|pp\.|page)?\s*[\divxlc]+\s*$", re.I)


def gold_outline(path: str) -> list[H.Heading]:
    """The outline as the answer key. A presentation's export prefixes every
    entry "Slide N:" — not part of the title a reader sees — so it is
    dropped before comparing."""
    import pymupdf
    with pymupdf.open(path) as d:
        out = []
        for level, title, page in d.get_toc(simple=True):
            num, t = H.split_number(RE_SLIDE.sub("", str(title).strip()))
            out.append(H.Heading(level, t, page if page and page > 0 else None, num))
        return out


def default_corpus(root: str) -> list[str]:
    """Every TRACKED PDF with an outline of five or more entries.

    Tracked, not every file on disk: `bun run cat state:mount` puts untracked
    PDFs beside the tracked ones, and a corpus that depends on what was last
    mounted gives a number nobody can reproduce. Pass paths explicitly to
    score others — that is how the held-out set is scored.
    """
    import pymupdf
    import subprocess
    tracked = subprocess.run(["git", "-C", root, "ls-files", "*.pdf"], capture_output=True, text=True).stdout.split()
    found = []
    for p in sorted(os.path.join(root, t) for t in tracked):
        if "node_modules" in p:
            continue
        try:
            with pymupdf.open(p) as d:
                if len(d.get_toc()) >= 5:
                    found.append(p)
        except Exception:
            pass
    return found


def gold_key(path: str, keys: dict) -> list[H.Heading] | None:
    """A hand-made answer key for this PDF from a `--gold` file, matched on the
    file name. For a document whose outline is missing or wrong, the sections a
    person settled on are the only answer there is (bean `6chd`: the WHO
    handbooks re-split by hand in who-iris)."""
    entry = keys.get(os.path.basename(path))
    if not entry:
        return None
    return [H.Heading(int(e["level"]), e["title"], e.get("page"), None) for e in entry["toc"]]


def load(path: str, layout_backend: str = "pymupdf", keys: dict | None = None) -> Doc:
    with contextlib.redirect_stdout(io.StringIO()):
        backend = PS.open_backend(path, "pymupdf")
        pages = backend.page_texts()
    gold = gold_key(path, keys or {})
    return Doc(path, gold if gold is not None else gold_outline(path),
               H.extract_lines(path, layout_backend), pages)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("--root", default=os.path.dirname(str(__import__("_harness_root").HARNESS_ROOT)))  # bean 70lx: the checkout holding the harness
    ap.add_argument("--methods", default=",".join(m for m in METHODS if m not in NOT_DEFAULT))
    ap.add_argument("--json", default="build/benchmarks/toc-benchmark.json",
                    help="write per-document results here (default: build/benchmarks/toc-benchmark.json)")
    ap.add_argument("--no-json", action="store_true", help="do not write JSON output")
    ap.add_argument("--grobid-tei", help="directory of Grobid <stem>.tei.xml outputs, for the `grobid` method")
    ap.add_argument("--nougat-mmd", help="directory of Nougat <stem>.mmd outputs, for the `nougat` method")
    ap.add_argument("--layout-backend", choices=["pymupdf", "pdfminer"], default="pymupdf",
                    help="which library reads font metrics (pdfminer.six is MIT; PyMuPDF is AGPL)")
    ap.add_argument("--gold", help="JSON answer keys by PDF file name ({name: {toc: [{level, title, page}]}}), "
                    "used instead of the outline for the PDFs it names; e.g. scripts/tests/fixtures/dth-toc-gold.json")
    args = ap.parse_args()

    global TEI_DIR, MMD_DIR
    TEI_DIR, MMD_DIR = args.grobid_tei, args.nougat_mmd
    keys = {}
    if args.gold:
        with open(args.gold) as f:
            keys = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    pdfs = args.pdfs or default_corpus(args.root)
    methods = [m for m in args.methods.split(",") if m]
    if "grobid" in methods and not TEI_DIR:
        methods.remove("grobid")             # needs saved output; not run by default
    if "nougat" in methods and not MMD_DIR:
        methods.remove("nougat")
    rows = []
    for path in pdfs:
        doc = load(path, args.layout_backend, keys)
        rel = os.path.relpath(path, args.root)
        if outline_is_pages(doc.gold):
            print(f"set aside, outline bookmarks pages not sections: {rel}", file=sys.stderr)
            pdfs = [p for p in pdfs if p != path]
            continue
        for m in methods:
            t0 = time.time()
            pred = METHODS[m](doc)
            s = score(doc.gold, pred)
            s.update(doc=rel, method=m, seconds=round(time.time() - t0, 2))
            rows.append(s)
            ted_s = f"{s['teds']:.2f}" if s["teds"] is not None else " n/a"
            print(f"{m:9s} gold={s['n_gold']:5d} pred={s['n_pred']:5d} "
                  f"P={s['title_p']:.2f} R={s['title_r']:.2f} F1={s['title_f1']:.2f} "
                  f"link={s['link_f1']:.2f} level={s['level_f1']:.2f} full={s['full_f1']:.2f} "
                  f"TEDS={ted_s}  {rel}", file=sys.stderr)

    print("\nMacro average over", len(pdfs), "documents")
    print(f"{'method':9s} {'title P':>8s} {'title R':>8s} {'title F1':>8s} {'capped':>8s} {'link F1':>8s} "
          f"{'level F1':>8s} {'full F1':>8s} {'TEDS':>6s}")
    for m in methods:
        rs = [r for r in rows if r["method"] == m]
        avg = lambda k: sum(r[k] for r in rs) / len(rs)  # noqa: E731
        tv = [r["teds"] for r in rs if r["teds"] is not None]
        print(f"{m:9s} {avg('title_p'):8.2f} {avg('title_r'):8.2f} {avg('title_f1'):8.2f} {avg('capped_f1'):8.2f} "
              f"{avg('link_f1'):8.2f} {avg('level_f1'):8.2f} {avg('full_f1'):8.2f} "
              f"{(sum(tv) / len(tv) if tv else float('nan')):6.2f}")
    if args.json and not args.no_json:
        assert_not_declared_graph_path(args.json, args.root)
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        with open(args.json, "w") as f:
            json.dump(rows, f, indent=1)
    return 0


PS = _load_pdf_structure()

if __name__ == "__main__":
    sys.exit(main())
