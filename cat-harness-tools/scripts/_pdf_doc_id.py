"""A document's id, and where its OCR cache lives — one answer, shared.

`-o DIR` meant two different things in one documented pipeline. Bean `rlp5`:

* `pdf-structure.py -o DIR` wrote `DIR/<doc-id>/`
* `pdf-ocr.py -o DIR` wrote `DIR/ocr/`, with no doc-id level at all

Measured 2026-09-19: `python3 scripts/pdf-ocr.py -o library
uploads/WHO_PUB_TPS_93.1.pdf` put 121 pages in `library/ocr/`, not
`library/who-pub-tps-931/ocr/`. A second scanned document OCR'd into the same
`library/` would have overwritten the first page for page — same filenames, same
directory, no message. And `pdf-structure.py --ocr` looks for the cache in the
doc-id location, so the two steps of one pipeline did not compose: the OCR had to
be moved by hand between them.

## Why this is importable rather than copied

There were THREE routes to `slugify` before this module: the definition in
`pdf-structure.py`, a 26-line `_load_slugify()` in `pdf-pages.py` that read the
function out of that file by path, and the separate spelling inside `ocr_pages`
(below). The loader existed precisely because a copy would drift — which is the
right instinct and the wrong mechanism. Underscore-prefixed because a module with
a hyphen cannot be imported; same reason as `scripts/_pypdf_compat.py`.

## Why `pdf-ocr` can compute the doc-id without reading the PDF

{@link derive_doc_id} returns `arxiv-<id>[v<n>]` when arXiv metadata is present,
and the basename slug otherwise. The arXiv id is found by regex over **page one's
extracted text** — so it requires a usable text layer, and the ABSENCE of one is
the precondition for running OCR at all. For every document `pdf-ocr` is ever
used on, the doc-id is therefore the basename slug, reachable from the filename
alone with no `pypdf` dependency and no metadata pass.

That is a measured property, not a convenience, and it is why `meta` is optional
here rather than required.
"""
from __future__ import annotations

import glob
import os
import re
from typing import Any

#: Directory the OCR step writes under a document's own directory.
OCR_DIRNAME = "ocr"

#: How long a doc-id derived from a filename may be. `pdf-structure.py` used 60
#: for the doc-id and 48 for section ids; the two are different limits for
#: different things, so the doc-id one is named rather than passed at each call.
DOC_ID_MAXLEN = 60


def slugify(s: str, maxlen: int = 48) -> str:
    """Lowercase, punctuation-stripped, hyphen-joined. The one definition."""
    s = re.sub(r"[^\w\s-]", "", s.lower()).strip()
    s = re.sub(r"[\s_]+", "-", s)
    return (s[:maxlen].rstrip("-")) or "section"


#: The arXiv stamp, as it appears down the left margin of page one.
#:
#: DEFINED HERE, not in `pdf-structure.py`, because the doc-id depends on it
#: and `pdf-structure.py` cannot be imported — its name has a hyphen, which is
#: the same constraint that put `slugify` here in the first place. It lived
#: there until 2026-09-20, so every arm that was not `pdf-structure` fell
#: through to the basename slug and named the same paper differently.
RE_ARXIV_NEW = re.compile(
    r"ar\s*X\s*iv\s*[:.]?\s*(?P<id>\d{4}\.\d{4,5})\s*(?P<ver>v\d+)?"
    r"(?:\s*\[(?P<cls>[a-zA-Z\-]+(?:\.[A-Za-z\-]{2,})?)\])?",
    re.I,
)
RE_ARXIV_OLD = re.compile(
    r"ar\s*X\s*iv\s*[:.]?\s*(?P<id>[a-zA-Z\-]+(?:\.[A-Z]{2})?/\d{7})\s*(?P<ver>v\d+)?",
    re.I,
)


def arxiv_from_text(page1: str) -> dict[str, Any] | None:
    """The arXiv identity in page-one text, or `None`.

    The MINIMUM `derive_doc_id` needs — id and version. `pdf-structure.py`'s
    `parse_front_matter` reads more from the same match (primary class, stamp
    date) for the front matter it builds, and calls this for the part the
    doc-id depends on, so the two cannot disagree about which paper it is.
    """
    for rx in (RE_ARXIV_NEW, RE_ARXIV_OLD):
        m = rx.search(page1)
        if m:
            return {
                "id": m.group("id"),
                "version": (m.groupdict().get("ver") or "").lstrip("v") or None,
                "primary_class": m.groupdict().get("cls"),
                "_match": m,
            }
    return None


def derive_doc_id_from_pdf(path: str) -> str:
    """This document's id, asking the PDF itself.

    For an arm that holds the file but no extracted front matter —
    `pdf-images.py` was the case, and it named three arXiv papers by their
    basename while `pdf-structure.py` named them `arxiv-<id>v<n>`. The images
    sidecar then landed in a SIBLING directory of the entry it belonged to:
    not an error, not a warning, and invisible to `check:l1-complete`, which
    scans entries and saw the orphan as an entry of its own holding nothing
    but an `images.json`.

    Falls back to the basename slug when the text layer yields no stamp, which
    is the same answer `derive_doc_id` gives with no meta at all.
    """
    try:
        import pymupdf
    except ImportError:
        return derive_doc_id(path)
    try:
        with pymupdf.open(path) as d:
            page1 = d[0].get_text() if d.page_count else ""
    except Exception:
        return derive_doc_id(path)
    ax = arxiv_from_text(page1)
    return derive_doc_id(path, {"arxiv": ax} if ax else None)


def derive_doc_id(path: str, meta: dict[str, Any] | None = None) -> str:
    """This document's identity, as every step of the pipeline must spell it.

    `meta` is optional so a caller that has not extracted any — `pdf-ocr.py` —
    gets the same answer for the documents it handles. See the module docstring
    for why that is sound rather than merely convenient.
    """
    ax = (meta or {}).get("arxiv")
    if ax and ax.get("id"):
        base = "arxiv-" + ax["id"].replace("/", "-")
        return base + (f"v{ax['version']}" if ax.get("version") else "")
    return slugify(os.path.splitext(os.path.basename(path))[0], DOC_ID_MAXLEN)


def doc_dir(root: str, path: str, meta: dict[str, Any] | None = None) -> str:
    """`root/<doc-id>` — what `-o` means, in EVERY script that takes it."""
    return os.path.join(root, derive_doc_id(path, meta))


def ocr_cache_dir(root: str, path: str, meta: dict[str, Any] | None = None) -> str:
    """Where this document's OCR pages live. The writer's answer."""
    return os.path.join(doc_dir(root, path, meta), OCR_DIRNAME)


def find_ocr_cache(
    root: str, path: str, meta: dict[str, Any] | None = None
) -> tuple[str | None, bool]:
    """Locate a cache to READ, and say whether it was found in the old place.

    Returns `(directory, legacy)`. `legacy` is `True` for a cache sitting at the
    flat `root/ocr/` that `pdf-ocr.py` wrote before this module existed.

    **The flat location stays readable, deliberately.** Dropping it would make a
    121-page cache silently invisible and re-OCR it at seconds per page; the
    caller warns and names the new location instead. Reading it cannot cause the
    overwrite this bean is about — only writing could, and nothing writes there
    any more.
    """
    for d, legacy in ((ocr_cache_dir(root, path, meta), False),
                      (os.path.join(root, OCR_DIRNAME), True)):
        if glob.glob(os.path.join(d, "page-*.txt")):
            return d, legacy
    return None, False
