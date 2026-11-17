"""A scanned page's printed number, read from its OCR text. Bean `turh`.

`pdf-structure.py --ocr` used to write `pages[]` with every label `null`: the
printed-folio reader looks for a number in a page's top or bottom margin, and
OCR text has no positions, so it found no margin at all. who-iris
`who-pub-tps-931` (121 scanned pages) prints its folio as the last line of
nearly every page ("15" on physical page 20, "95" on page 100), so the label was
in the text and was not read.

`_pdf_page_labels.text_margin_lines` takes a page's first and last lines as the
margins. The run fit is unchanged, so a number counts only when it fits a run of
three or more pages at one offset.

## What these tests hold

1. Folios on the last line give the printed label, and a page with none in a
   run takes the run's value (interpolated).
2. A short last line of body text that ends in a number ("12 countries") is not
   a folio. A bare number that fits no run is not a label either.
3. Margin stand-ins are not read as a contents page.
4. Through `pdf-structure.py`'s `infer_page_labels`: with no layout and no OCR
   text every label stays `null`, as before; with OCR text the labels appear.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)

import _pdf_page_labels as L  # noqa: E402


def load(name: str):
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


rc = 0


def check(what: str, ok: bool) -> None:
    global rc
    print(("  ok   " if ok else "  FAIL ") + what)
    if not ok:
        rc = 1


def body(n: int) -> str:
    return "\n".join(f"Body line {i} about house style." for i in range(n))


def scanned() -> list[str]:
    """Ten pages: two unnumbered front pages, then folios 1..8 on the last line
    of pages 3..10, except page 6, which prints none."""
    pages = ["WHO Editorial Style Manual", "Contents\nIntroduction 1\nSpelling 4"]
    for p in range(3, 11):
        folio = "" if p == 6 else f"\n{p - 2}"
        pages.append("Running head\n" + body(6) + "\nSpelling" + folio)
    # A stray number: body text whose last line ends in one, on a front page.
    pages[1] += "\nWe surveyed\n12"
    return pages


def main() -> int:
    pages = scanned()
    lines = L.text_margin_lines(pages)
    check("margin lines come only from page edges (≤ 4 per page)",
          all(sum(1 for l in lines if l.page == p) <= 4 for p in range(1, 11)))

    labels = {pl.physical: pl for pl in L.page_labels(lines, len(pages), contents=False)}
    check("page 3 prints 1", labels[3].label == "1" and labels[3].source == "printed")
    check("page 10 prints 8", labels[10].label == "8" and labels[10].source == "printed")
    check("page 6 prints none and takes the run's 4",
          labels[6].label == "4" and labels[6].source == "interpolated")
    check("a stray 12 on page 2 fits no run and labels nothing", labels[2].label is None)
    check("the cover has no label", labels[1].label is None)
    check("no contents source is read from margin stand-ins",
          all("contents" not in pl.evidence for pl in labels.values()))

    ps = load("pdf-structure.py")
    missing = "/nonexistent/scan.pdf"           # no /PageLabels to read
    rows, conflicts = ps.infer_page_labels(missing, None, len(pages))
    check("no layout and no OCR text: every label stays null",
          all(r["label"] is None for r in rows) and conflicts["count"] == 0)
    rows, conflicts = ps.infer_page_labels(missing, None, len(pages), pages)
    by = {r["physical"]: r for r in rows}
    check("with OCR text, infer_page_labels reads the folios",
          by[3]["label"] == "1" and by[10]["label"] == "8" and by[1]["label"] is None)
    check("and reports no conflicts", conflicts["count"] == 0)

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
