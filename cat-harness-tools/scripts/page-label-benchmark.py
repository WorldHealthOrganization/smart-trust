#!/usr/bin/env python3
"""
page-label-benchmark — score page-label inference against held-out
/PageLabels. Issue #2302.

A PDF that carries /PageLabels has its publisher's answer to "what number is
printed on this page". Hide it, infer labels from the page content alone
(printed folios fitted into runs, interpolation, contents-page offsets), and
compare page by page. Same idea as `toc-benchmark.py` with the outline.

A PDF whose labels merely repeat the physical index ("1", "2", "3" …) is
set aside: that is a producer's default, not an answer — one such PDF prints
"3" on its physical page 4. It is listed, not scored.

Per document: accuracy over pages whose held-out label is non-empty (a
predicted None counts as wrong), and coverage (share of pages given any
label). Reported separately for arabic-labelled pages, because cover and
plate labels ("A", "Cover Page") are not printed on the page and no
content-based method can recover them.

Usage:
    page-label-benchmark.py [PDF ...]     # default: every PDF with /PageLabels
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _pdf_headings as H  # noqa: E402
import _pdf_page_labels as P  # noqa: E402
from _benchmark_guard import assert_not_declared_graph_path  # noqa: E402


def corpus(root: str) -> list[str]:
    seen: set[str] = set()
    out = []
    for p in sorted(glob.glob(os.path.join(root, "**", "*.pdf"), recursive=True)):
        if "node_modules" in p or os.path.basename(p) in seen:
            continue
        try:
            labels = P.pdf_labels(p)
        except Exception:
            continue
        if labels:
            seen.add(os.path.basename(p))
            out.append(p)
    return out


def score(path: str) -> dict:
    import pymupdf
    with pymupdf.open(path) as d:
        n = len(d)
    gold = P.pdf_labels(path)
    lines = H.extract_lines(path)
    pred = {pl.physical: pl for pl in P.page_labels(lines, n, pdf=None)}
    lab = [p for p in range(1, n + 1) if gold.get(p)]
    arabic = [p for p in lab if gold[p].isdigit()]
    trivial = sum(1 for p in lab if P._norm(gold[p]) == str(p)) >= 0.9 * max(1, len(lab))
    ok = lambda p: pred[p].label is not None and P._norm(pred[p].label) == P._norm(gold[p])  # noqa: E731
    arabic = [p for p in lab if (P._norm(gold[p]) or "").isdigit()]
    return {
        "trivial": trivial,
        "doc": os.path.basename(path), "pages": n, "labelled": len(lab), "arabic": len(arabic),
        "acc": sum(ok(p) for p in lab) / len(lab) if lab else 0.0,
        "acc_arabic": sum(ok(p) for p in arabic) / len(arabic) if arabic else None,
        "coverage": sum(1 for p in range(1, n + 1) if pred[p].label) / n,
        "wrong": [(p, gold[p], pred[p].label) for p in lab if not ok(p) and pred[p].label][:5],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("--root", default=os.path.dirname(str(__import__("_harness_root").HARNESS_ROOT)))  # bean 70lx: the checkout holding the harness
    ap.add_argument("--json", default="build/benchmarks/page-label-benchmark.json",
                    help="write benchmark results JSON here (default: build/benchmarks/page-label-benchmark.json)")
    ap.add_argument("--no-json", action="store_true", help="do not write JSON output")
    a = ap.parse_args()
    all_rows = [score(p) for p in (a.pdfs or corpus(a.root))]
    rows = [r for r in all_rows if not r["trivial"]]
    skipped = [r["doc"] for r in all_rows if r["trivial"]]
    print("| document | pages | labelled | accuracy | accuracy (arabic) | coverage |")
    print("|---|---|---|---|---|---|")
    for r in rows:
        aa = "—" if r["acc_arabic"] is None else f"{r['acc_arabic']:.2f}"
        print(f"| `{r['doc']}` | {r['pages']} | {r['labelled']} | {r['acc']:.2f} | {aa} | {r['coverage']:.2f} |")
    m = lambda k: sum(r[k] for r in rows if r[k] is not None) / max(1, sum(1 for r in rows if r[k] is not None))  # noqa: E731
    print(f"\nMacro average over {len(rows)} documents: accuracy {m('acc'):.2f}, "
          f"arabic {m('acc_arabic'):.2f}, coverage {m('coverage'):.2f}")
    if skipped:
        print(f"\nSet aside, labels repeat the physical index: {', '.join(skipped)}")
    for r in rows:
        if r["wrong"]:
            print(f"  wrong in {r['doc']}: {r['wrong']}", file=sys.stderr)
    if a.json and not a.no_json:
        assert_not_declared_graph_path(a.json, a.root)
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        with open(a.json, "w") as f:
            json.dump(all_rows, f, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
