"""`-o` means one thing, and the doc-id has one spelling — bean `rlp5`.

`pdf-structure.py -o DIR` wrote `DIR/<doc-id>/`; `pdf-ocr.py -o DIR` wrote
`DIR/ocr/`, with no doc-id level. Measured 2026-09-19: OCR'ing
`uploads/WHO_PUB_TPS_93.1.pdf` with `-o library` put 121 pages in `library/ocr/`
rather than `library/who-pub-tps-931/ocr/`. Two consequences, and the second is
the one that loses data:

* `pdf-structure.py --ocr` looked in the doc-id location, so the two steps of one
  documented pipeline did not compose — the OCR had to be moved by hand.
* a second scanned document OCR'd into the same root would overwrite the first
  page for page: same filenames, same directory, no message.

These assert the PROPERTY — every script resolves the same directory for the same
PDF, and different PDFs never share one — rather than any particular string. A
test pinning `who-pub-tps-931` would pass while the scripts disagreed, which is
what the previous state looked like from the outside.
"""
import importlib.util
import os
import sys

# `scripts/`, which is this file's PARENT — the idiom in the sibling tests here
# (`HERE` then `dirname(HERE)`). Copying `test/test_pypdf_compat.py`'s version
# instead pointed at `scripts/scripts` and failed on the first run.
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)

import _pdf_doc_id as shared  # noqa: E402


def load(name: str):
    """A hyphenated script as a module. Not importable by name; loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_"), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    # Registered before exec: `pdf-structure.py` defines dataclasses, and
    # `dataclasses` resolves `__module__` through `sys.modules` while the body
    # runs.
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


failures: list[str] = []


def check(label: str, got, want) -> None:
    if got != want:
        failures.append(f"{label}: got {got!r}, want {want!r}")


# ---------------------------------------------------------------- one spelling

structure = load("pdf-structure.py")
ocr = load("pdf-ocr.py")
pages = load("pdf-pages.py")

# Every route to the doc-id is the same function object, not merely the same
# answer today. This is the falsifier for "did the duplication actually go, or
# did it just move": three equal strings could still be three implementations.
check("pdf-structure.derive_doc_id is shared", structure.derive_doc_id, shared.derive_doc_id)
check("pdf-structure.slugify is shared", structure.slugify, shared.slugify)
check("pdf-ocr.derive_doc_id is shared", ocr.derive_doc_id, shared.derive_doc_id)
check("pdf-ocr.ocr_cache_dir is shared", ocr.ocr_cache_dir, shared.ocr_cache_dir)
check("pdf-pages._slugify is shared", pages._slugify, shared.slugify)
check("pdf-pages.ocr_cache_dir is shared", pages.ocr_cache_dir, shared.ocr_cache_dir)

# The case that first exposed the disagreement. `.` in the stem is the part a
# reimplementation gets wrong: a naive slugify yields `who-pub-tps-93-1`.
WHO = "uploads/WHO_PUB_TPS_93.1.pdf"
check("WHO doc-id", shared.derive_doc_id(WHO), "who-pub-tps-931")
check(
    "WHO ocr cache under the doc-id",
    shared.ocr_cache_dir("library", WHO),
    os.path.join("library", "who-pub-tps-931", "ocr"),
)

# ------------------------------------------------- collision is impossible now

a = shared.ocr_cache_dir("library", "uploads/first-scan.pdf")
b = shared.ocr_cache_dir("library", "uploads/second-scan.pdf")
check("two documents, two cache directories", a != b, True)
# And neither is the flat location that made them collide.
check("no flat cache for a", a, os.path.join("library", "first-scan", "ocr"))
check("no flat cache for b", b, os.path.join("library", "second-scan", "ocr"))

# ------------------------------------------------------------- arXiv agreement
#
# `derive_doc_id` returns the arXiv spelling when metadata carries one. The
# reader used to hardcode the FALLBACK spelling, so for an arXiv document the
# writer wrote `arxiv-…/` and the reader looked in `<basename-slug>/ocr`.
AX = {"arxiv": {"id": "math/0304010", "version": "1"}}
check("arXiv doc-id", shared.derive_doc_id("x.pdf", AX), "arxiv-math-0304010v1")
check(
    "arXiv cache follows the arXiv id",
    shared.ocr_cache_dir("lib", "x.pdf", AX),
    os.path.join("lib", "arxiv-math-0304010v1", "ocr"),
)
# No metadata => the basename slug, which is what `pdf-ocr.py` can compute
# without reading the PDF. Sound because the arXiv id is found by regex over
# page one's TEXT, and no usable text layer is the precondition for OCR.
check("no metadata falls back to the stem", shared.derive_doc_id("x.pdf"), "x")

# ------------------------------------------------------ the legacy read, warned

import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as root:
    pdf = os.path.join(root, "doc.pdf")
    check("nothing found in an empty root", shared.find_ocr_cache(root, pdf), (None, False))

    flat = os.path.join(root, "ocr")
    os.makedirs(flat)
    open(os.path.join(flat, "page-001.txt"), "w").write("x")
    d, legacy = shared.find_ocr_cache(root, pdf)
    check("flat cache still READS", d, flat)
    check("flat cache reports itself legacy", legacy, True)

    proper = shared.ocr_cache_dir(root, pdf)
    # Asserted BEFORE creating it: if `ocr_cache_dir` ever returns the flat
    # location again — the original defect — `os.makedirs` would die with a bare
    # FileExistsError and the traceback would not say what was wrong. Measured:
    # that is exactly what happened when this was probed.
    check("the doc-id cache is not the flat cache", proper != flat, True)
    os.makedirs(proper, exist_ok=True)
    open(os.path.join(proper, "page-001.txt"), "w").write("x")
    d, legacy = shared.find_ocr_cache(root, pdf)
    check("the doc-id location wins when both exist", d, proper)
    check("and is not reported legacy", legacy, False)

if failures:
    for f in failures:
        print("FAIL " + f, file=sys.stderr)
    raise SystemExit(1)
print(f"ok  pdf doc-id: one spelling across 3 scripts, {14} properties")
