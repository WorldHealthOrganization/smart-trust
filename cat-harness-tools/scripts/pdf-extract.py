#!/usr/bin/env python3
"""Extract text from a PDF, or say precisely WHY it could not.

WHY THIS EXISTS.  `document-intake` advertises "Handles OCR extraction" and its
routing table sends scanned PDFs to "Tesseract OCR / Claude vision" -- but
nothing implemented that, so in practice an agent reached for a Python PDF
library, got an empty string or an import crash, and had to guess what went
wrong.  That guessing is the actual cost: an empty extraction looks identical
whether the file is a scan, the library is broken, or the PDF is malformed.

So this script's contract is: **never return empty silently.**  It either
produces text, or exits non-zero with a diagnosis naming which rung of the
ladder failed and what to do next.

THE LADDER (highest fidelity first; broken rungs are skipped, not fatal):

  1. `pdftotext` (poppler)      -- best layout fidelity when installed
  2. `pypdf`                     -- pure-python, good on modern PDFs
  3. `pdfminer.six`              -- slower, better on awkward encodings
  4. built-in stream extractor   -- ZERO dependencies: inflate the content
                                    streams and read the text-showing operators
  5. OCR (`tesseract`)           -- only route for a scan; needs a rasteriser

Rung 4 matters more than it looks.  In the container this was written in,
rungs 1-3 were ALL unavailable (`poppler` absent; `pypdf` and `pdfminer.six`
both dead because `cryptography`'s Rust bindings segfault on import), and rung 4
was the only thing that read the papers.  It has no dependencies beyond the
standard library by design -- it is the rung that still works when the
environment is broken.

SCAN DETECTION, AND ITS ONE TRAP.  The script inspects the PDF's structure:
pages made of `CCITTFaxDecode` / `JBIG2Decode` / `DCTDecode` images with little
`/Font` indicate a scan.  **But "is a scan" does NOT imply "has no text
layer."**  Publisher scans very often carry an embedded OCR sidecar, which
`pdftotext` reads perfectly while every other rung here returns nothing --
including rung 4, because the sidecar is not laid out like pdflatex content
streams.  This was found the hard way: a 1985 Elsevier scan (658 CCITTFax
blocks) was reported "no parser will ever read this", and then poppler read
79,231 characters out of it.

So a scan verdict is only ever reported ALONGSIDE which rungs were actually
available, and if `pdftotext` was missing the script says to install poppler
FIRST rather than reaching for OCR or a vision model.  Never conclude "no text
layer" from the image counts alone.

Usage:
    pdf-extract.py FILE.pdf                 # text to stdout
    pdf-extract.py FILE.pdf -o out.txt      # text to a file
    pdf-extract.py FILE.pdf --diagnose      # structure report only, no text
    pdf-extract.py FILE.pdf --max-pages N   # limit (rungs that support it)

Exit codes:
    0  text extracted
    2  no text layer -- the file is a scan; use OCR or a vision model
    3  every rung failed for another reason (details on stderr)
    4  bad usage / unreadable file
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import zlib
from pathlib import Path

# A rung is considered to have produced usable output only if it clears this.
# Scanned PDFs often yield a handful of stray characters from page furniture;
# treating those as success is how an agent ends up "reading" an empty paper.
MIN_USEFUL_CHARS = 200


def _guard(fn, *args):
    """Run a rung, surviving ANY failure short of the user interrupting.

    Deliberately catches `BaseException`, not `Exception`: a broken native
    extension raises pyo3's `PanicException`, which derives from BaseException
    and would otherwise kill the whole ladder. That is not hypothetical -- it
    is exactly how `pypdf` and `pdfminer.six` fail when `cryptography`'s Rust
    bindings are broken, and it was found by running this script against a real
    paper. Interrupt and exit signals are re-raised so Ctrl-C still works.
    """
    try:
        return fn(*args)
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException as exc:  # noqa: BLE001 -- see docstring
        return exc


# --------------------------------------------------------------------------- #
# structure diagnosis
# --------------------------------------------------------------------------- #

def diagnose(path: Path) -> dict:
    """Classify the PDF by what its pages are actually made of."""
    data = path.read_bytes()
    counts = {
        "bytes": len(data),
        "font_refs": len(re.findall(rb"/Font", data)),
        "image_refs": len(re.findall(rb"/Image", data)),
        "ccitt_or_jbig2": len(re.findall(rb"CCITTFaxDecode|JBIG2Decode", data)),
        "jpeg": len(re.findall(rb"DCTDecode", data)),
        "pages": len(re.findall(rb"/Type\s*/Page[^s]", data)),
    }
    scan_blocks = counts["ccitt_or_jbig2"] + counts["jpeg"]
    # Heuristic: many image blocks and few fonts => a scan. Fonts alone do not
    # prove a text layer (a scan may still embed a font for an OCR sidecar),
    # which is why the caller only trusts this after extraction has failed.
    counts["looks_like_scan"] = scan_blocks > 0 and scan_blocks >= counts["font_refs"]
    return counts


def format_diagnosis(path: Path, d: dict) -> str:
    return (
        f"{path.name}: {d['bytes']:,} bytes, ~{d['pages']} pages\n"
        f"  /Font refs        : {d['font_refs']}\n"
        f"  /Image refs       : {d['image_refs']}\n"
        f"  CCITTFax/JBIG2    : {d['ccitt_or_jbig2']}  (fax-style scan blocks)\n"
        f"  DCTDecode (JPEG)  : {d['jpeg']}\n"
        f"  verdict           : {'SCANNED (no text layer)' if d['looks_like_scan'] else 'has a text layer'}"
    )


# --------------------------------------------------------------------------- #
# the ladder
# --------------------------------------------------------------------------- #

def try_pdftotext(path: Path, max_pages: int | None) -> str | None:
    if not shutil.which("pdftotext"):
        return None
    cmd = ["pdftotext", "-layout"]
    if max_pages:
        cmd += ["-f", "1", "-l", str(max_pages)]
    cmd += [str(path), "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=300)
        return out.stdout.decode("utf-8", "replace")
    except Exception:
        return None


def try_pypdf(path: Path, max_pages: int | None) -> str | None:
    try:
        from pypdf import PdfReader  # noqa: PLC0415
    except BaseException:  # noqa: BLE001 -- PanicException is not an Exception
        return None  # not installed, or its native crypto backend is broken
    try:
        reader = PdfReader(str(path))
        pages = reader.pages[:max_pages] if max_pages else reader.pages
        return "\n".join((p.extract_text() or "") for p in pages)
    except BaseException:  # noqa: BLE001
        return None


def try_pdfminer(path: Path, max_pages: int | None) -> str | None:
    try:
        from pdfminer.high_level import extract_text  # noqa: PLC0415
    except BaseException:  # noqa: BLE001 -- PanicException is not an Exception
        return None
    try:
        return extract_text(str(path), maxpages=max_pages or 0)
    except BaseException:  # noqa: BLE001
        return None


def try_streams(path: Path, max_pages: int | None = None) -> str | None:
    """Zero-dependency fallback: inflate content streams, read text operators.

    Handles the common pdflatex/pdftex output shape. Ligatures and custom
    encodings can come through imperfectly -- this rung trades fidelity for
    always being available. It is deliberately last-but-one, before OCR.
    """
    try:
        data = path.read_bytes()
    except Exception:
        return None
    chunks: list[str] = []
    for m in re.finditer(rb"stream\r?\n", data):
        start = m.end()
        end = data.find(b"endstream", start)
        if end < 0:
            continue
        try:
            dec = zlib.decompress(data[start:end])
        except Exception:
            continue  # not Flate-compressed, or an image stream
        parts: list[str] = []
        for tm in re.finditer(rb"\((?:\\.|[^\\()])*\)", dec):
            tok = tm.group()[1:-1]
            tok = (tok.replace(rb"\(", b"(")
                      .replace(rb"\)", b")")
                      .replace(rb"\\", b"\\"))
            parts.append(tok.decode("latin-1"))
        if parts:
            chunks.append("".join(parts))
        if max_pages and len(chunks) >= max_pages:
            break
    return "\n".join(chunks) if chunks else None


def try_ocr(path: Path, max_pages: int | None) -> str | None:
    """OCR a scan. Needs BOTH a rasteriser and tesseract; reports which is absent."""
    tesseract = shutil.which("tesseract")
    raster = shutil.which("pdftoppm")
    if not tesseract or not raster:
        missing = [n for n, p in (("tesseract", tesseract), ("pdftoppm", raster)) if not p]
        print(f"[ocr] unavailable, missing: {', '.join(missing)}", file=sys.stderr)
        return None
    import tempfile  # noqa: PLC0415
    with tempfile.TemporaryDirectory() as td:
        cmd = [raster, "-r", "300", "-png"]
        if max_pages:
            cmd += ["-f", "1", "-l", str(max_pages)]
        cmd += [str(path), f"{td}/page"]
        try:
            subprocess.run(cmd, capture_output=True, timeout=1800, check=True)
        except Exception as exc:
            print(f"[ocr] rasterising failed: {exc}", file=sys.stderr)
            return None
        out: list[str] = []
        for png in sorted(Path(td).glob("page*.png")):
            try:
                r = subprocess.run([tesseract, str(png), "stdout"],
                                   capture_output=True, timeout=600)
                out.append(r.stdout.decode("utf-8", "replace"))
            except Exception:
                continue
        return "\n".join(out) if out else None


LADDER = [
    ("pdftotext (poppler)", try_pdftotext),
    ("pypdf", try_pypdf),
    ("pdfminer.six", try_pdfminer),
    ("built-in stream extractor", try_streams),
    ("OCR (tesseract)", try_ocr),
]


def extract(path: Path, max_pages: int | None, verbose: bool = True):
    """Walk the ladder. Returns (text, rung_name) or (None, None)."""
    for name, fn in LADDER:
        text = _guard(fn, path, max_pages)
        if isinstance(text, BaseException):
            if verbose:
                kind = type(text).__name__
                print(f"[skip] {name}: {kind}: {text}", file=sys.stderr)
            continue
        if text and len(text.strip()) >= MIN_USEFUL_CHARS:
            if verbose:
                print(f"[ok] extracted with: {name} "
                      f"({len(text.strip()):,} chars)", file=sys.stderr)
            return text, name
        if verbose:
            got = len(text.strip()) if text else 0
            print(f"[skip] {name}: {got} chars (< {MIN_USEFUL_CHARS} threshold)",
                  file=sys.stderr)
    return None, None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("-o", "--out", type=Path, help="write text here instead of stdout")
    ap.add_argument("--diagnose", action="store_true", help="structure report only")
    ap.add_argument("--max-pages", type=int, default=None)
    ap.add_argument("-q", "--quiet", action="store_true")
    args = ap.parse_args()

    if not args.pdf.is_file():
        print(f"error: not a file: {args.pdf}", file=sys.stderr)
        return 4

    d = diagnose(args.pdf)
    if args.diagnose:
        print(format_diagnosis(args.pdf, d))
        return 0

    text, rung = extract(args.pdf, args.max_pages, verbose=not args.quiet)

    if text is None:
        print(format_diagnosis(args.pdf, d), file=sys.stderr)
        if d["looks_like_scan"]:
            have_poppler = shutil.which("pdftotext") is not None
            if not have_poppler:
                # The important case: a scan may still carry an embedded OCR
                # sidecar that ONLY pdftotext reads. Do not send the user to
                # OCR or a vision model before that has been tried.
                print(
                    "\nSCAN-LIKE STRUCTURE, and `pdftotext` is NOT INSTALLED --\n"
                    "so this is NOT yet evidence that the file lacks a text layer.\n"
                    "Publisher scans frequently embed an OCR sidecar that poppler\n"
                    "reads and the other rungs cannot. Do this FIRST:\n"
                    "    apt-get install -y poppler-utils\n"
                    "then re-run. Only if rung 1 also comes back empty is the file\n"
                    "genuinely imageonly, and OCR/vision the right answer:\n"
                    "    apt-get install -y tesseract-ocr\n",
                    file=sys.stderr)
                return 2
            print(
                "\nNO TEXT LAYER. `pdftotext` IS installed and still found nothing,\n"
                "so this file is image-only -- swapping PDF libraries is wasted\n"
                "effort. Options:\n"
                "  * install OCR:  apt-get install -y tesseract-ocr poppler-utils\n"
                "                  then re-run (the OCR rung will fire)\n"
                "  * or read the pages with a vision model, per\n"
                "    document-intake.md's routing table.\n",
                file=sys.stderr)
            return 2
        print(
            "\nEvery rung failed, but the file DOES appear to have a text layer,\n"
            "so this is a parser problem rather than a scan. Try installing\n"
            "poppler-utils (rung 1) -- and note rungs 2-3 fail silently when\n"
            "`cryptography`'s native bindings are broken, which is not obvious\n"
            "from their error.\n",
            file=sys.stderr)
        return 3

    if args.out:
        args.out.write_text(text, encoding="utf-8")
        if not args.quiet:
            print(f"[ok] wrote {args.out} ({len(text):,} chars) via {rung}",
                  file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
