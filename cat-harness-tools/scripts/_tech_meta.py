"""Technical facts about an ingested file — one definition, shared by the rungs.

Bean `nso8`. `pdf-structure.py` already wrote a `source` block; `pdf-pages.py`
wrote none, so a document ingested ONLY through the no-outline rung carried no
technical metadata at all. Measured 2026-09-19: `library/milnorlink/` — the one
entry `pdf-structure` never touched — has `source` absent, while the other two
page-granularity entries have it only because `pdf-structure` ran on them first
and `pdf-pages` merges into the existing file.

Underscore-prefixed because a module with a hyphen cannot be imported; same
reason as `_pdf_doc_id.py` and `_pypdf_compat.py`. Importable rather than
copied for the reason `rlp5` records: three spellings of `slugify` existed
before that module, and a copy drifts.

## The mimetype is SNIFFED, and that is the point of it

An extension is a claim by whoever named the file; the magic bytes are what the
content actually is. A `.pdf` that is really HTML — an error page saved by a
download that failed — extracts to nothing, and every downstream verdict about
it is about the wrong document.

So {@link sniff_mimetype} reads the leading bytes and returns **None** when it
does not recognise them. It never falls back to the extension: a guess that
agrees with the filename is indistinguishable from a real sniff, which makes
the field worthless for exactly the case it exists to catch. "Could not
determine" is a third state here as everywhere else in this repository.
"""
from __future__ import annotations

import datetime
import hashlib
import os
import zipfile
from typing import Any

# Leading-byte signatures, longest first so a prefix cannot shadow a longer
# match. Deliberately small: these are the formats an ingested corpus actually
# holds, and an unknown one is reported as unknown rather than guessed.
_MAGIC: list[tuple[bytes, str]] = [
    (b"%PDF-", "application/pdf"),
    (b"PK\x03\x04", "application/zip"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
    (b"\x1f\x8b", "application/gzip"),
    (b"ustar", "application/x-tar"),
    (b"{\\rtf", "application/rtf"),
    (b"<!DOCTYPE html", "text/html"),
    (b"<html", "text/html"),
]


def sniff_mimetype(path: str) -> str | None:
    """What the CONTENT says this is, or None when the bytes are unrecognised.

    Never consults the extension. See the module docstring for why a fallback
    would make the field worthless.
    """
    try:
        with open(path, "rb") as fh:
            head = fh.read(512)
    except OSError:
        return None
    for sig, mime in sorted(_MAGIC, key=lambda kv: -len(kv[0])):
        if head.startswith(sig):
            return mime
    # `ustar` sits at offset 257 in a tar header rather than at the start.
    if len(head) > 262 and head[257:262] == b"ustar":
        return "application/x-tar"
    return sniff_media(head)


# Recordings (bean `folio-assistant-1r0p`). Containers whose signature is not
# a plain prefix, so they are read here rather than listed in `_MAGIC`.
_ISO_AUDIO_BRANDS = {b"M4A ", b"M4B ", b"M4P "}
_ISO_QUICKTIME_BRANDS = {b"qt  "}


def sniff_media(head: bytes) -> str | None:
    """An audio or video container, by its signature, or None."""
    # ISO base media (MP4, M4A, MOV): a box size, then `ftyp`, then the brand.
    if len(head) >= 12 and head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in _ISO_AUDIO_BRANDS:
            return "audio/mp4"
        if brand in _ISO_QUICKTIME_BRANDS:
            return "video/quicktime"
        return "video/mp4"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "audio/wav"
    if head[:4] == b"fLaC":
        return "audio/flac"
    if head[:4] == b"OggS":
        return "audio/ogg"
    if head[:3] == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0 and head[1] & 0x06):
        return "audio/mpeg"
    # EBML: Matroska or WebM. The DocType says which.
    if head[:4] == b"\x1aE\xdf\xa3":
        return "video/webm" if b"webm" in head[:64] else "video/x-matroska"
    return None


# An OOXML or ODF document IS a zip, so the magic bytes say `application/zip`
# and stop there. That is TRUE and useless: it sends a spreadsheet to the
# archive rung, where it is listed as a bag of XML parts instead of read as a
# workbook (bean `p67i`, defect introduced by `twqe`'s routing).
#
# The package declares itself one level in, and this is the same principle as
# the byte sniff rather than an exception to it — neither the extension nor the
# outer magic can say, so ASK THE CONTAINER:
#
#   * OOXML carries `[Content_Types].xml`, and the part names say which member
#     of the family it is (`xl/` workbook, `word/` document, `ppt/` deck).
#   * ODF carries `mimetype` as an entry whose CONTENT is the type, which the
#     format requires to be stored first and uncompressed precisely so it can
#     be read this way.
_OOXML_PARTS: list[tuple[str, str]] = [
    ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
]


def sniff_zip_package(path: str) -> str | None:
    """What a zip DECLARES itself to be, or None when it is a plain archive.

    Reads the member list and, for ODF, the `mimetype` entry's content. Never
    looks at the file's name. Returns None for an ordinary zip, which is a
    determined answer and not a failure.
    """
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            if "mimetype" in names:
                # ODF states its own type. Bounded read: a conforming package
                # holds a short media type here, and anything longer is not one.
                declared = z.read("mimetype")[:200].decode("ascii", "replace").strip()
                if declared.startswith("application/vnd.oasis.opendocument"):
                    return declared
            if "[Content_Types].xml" in names:
                for part, mime in _OOXML_PARTS:
                    if part in names:
                        return mime
                # An OOXML package whose family we do not recognise. Reported
                # as the generic one rather than as a plain zip: something
                # declared itself, and losing that is the defect above.
                return "application/vnd.openxmlformats-officedocument"
    except (zipfile.BadZipFile, OSError, KeyError):
        return None
    return None


def sha256_of(path: str) -> str:
    """Full 64-hex digest, streamed so a large PDF does not land in memory."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sniff_effective_mimetype(path: str) -> tuple[str | None, str]:
    """What this file IS, and how that was determined.

    Magic bytes, then — for a zip — the package's own declaration. ONE
    definition, because the routing decision and the recorded fact are two
    readings of the same question: `planFor` asks this and `tech_meta` records
    it, so an `.xlsx` cannot route as an archive while its `source` block calls
    it a workbook. That disagreement was real for one commit, and it sent every
    spreadsheet to the archive rung.
    """
    mime = sniff_mimetype(path)
    if mime == "application/zip":
        declared = sniff_zip_package(path)
        if declared:
            return declared, "zip-package"
    return mime, "magic-bytes" if mime else "unrecognised"


def tech_meta(path: str) -> dict[str, Any]:
    """The mechanical facts `nso8` asks for, for one file.

    `mimetype_sniffed` is None when the bytes were not recognised, and
    `mimetype_source` says so explicitly rather than leaving a reader to infer
    it from a null — a consumer that sees `"unrecognised"` knows the file was
    looked at, which absence alone does not tell it.
    """
    st = os.stat(path)
    # The shared answer, so the recorded fact and the routing decision cannot
    # disagree. `mimetype_source` says HOW it was determined, which lets a
    # reader tell a byte sniff from a container declaration rather than infer
    # it from the value.
    mime, source = sniff_effective_mimetype(path)
    return {
        "file": os.path.basename(path),
        "sha256": sha256_of(path),
        "bytes": st.st_size,
        # ISO-8601 UTC, seconds. Not the ingest time: this is when the SOURCE
        # last changed, which is what tells you a re-fetch got something new.
        "mtime": datetime.datetime.fromtimestamp(
            st.st_mtime, tz=datetime.timezone.utc
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "mimetype_sniffed": mime,
        "mimetype_source": source,
    }
