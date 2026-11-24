#!/usr/bin/env python3
"""List an archive's entries AS DATA — bean `twqe`.

A tar or zip lands in `uploads/` and its contents are opaque to every grep in
the corpus. `grep -r somefile.csv` finds nothing, and the absence is
indistinguishable from the file not being there: the archive is a byte blob
that happens to contain the answer.

This writes `library/<slug>/contents.jsonld`, one schema whatever the format,
so the entry list joins the L1 source graph as part of that document's own
record and a grep for a filename inside an archive finds it.

## Per entry, the SAME fields a loose file gets

`path`, `bytes`, `sha256`, `mtime`, `mimetype_sniffed`, `mimetype_source` —
the vocabulary `_tech_meta.py` defines for a file on disk (bean `nso8`),
because an archive entry is not a different kind of thing. The mimetype is
sniffed from the entry's own leading bytes, never from its name, for exactly
the reason it is sniffed outside an archive: the name is a claim by whoever
made the archive.

## A directory is recorded, not skipped

`kind: "directory"` with no digest. Dropping them would make an archive of
empty directories indistinguishable from an empty archive, which are different
facts, and it would lose the shape a reader needs to understand the paths.

## What this does NOT do

It does not extract. The bean asks for the entry list to be greppable; pulling
the documents inside out into `sections/` is a separate question and a
separate arm. Nothing here writes outside `contents.jsonld`.

  python3 scripts/archive-contents.py -o library uploads/FILE.zip
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import sys
import tarfile
import zipfile
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _pdf_doc_id import slugify as _slugify  # noqa: E402
from _content_context import CONTENT_CONTEXT_URL  # noqa: E402


def _load_tech_meta():
    """`_tech_meta.py`'s helpers, loaded by path — see `pdf-pages.py` for why."""
    import importlib.util as _u
    spec = _u.spec_from_file_location("_tech_meta", str(Path(__file__).with_name("_tech_meta.py")))
    mod = _u.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_tm = _load_tech_meta()


def _iso(ts: float) -> str:
    return (
        datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _entry(path: str, kind: str, size: int | None, mtime: str | None, data: bytes | None) -> dict[str, Any]:
    """One row of the manifest, in the `nso8` vocabulary."""
    e: dict[str, Any] = {"path": path, "kind": kind}
    if kind == "directory":
        # No size and no digest: a directory has neither, and inventing a zero
        # would be a measurement nobody made.
        if mtime:
            e["mtime"] = mtime
        return e
    e["bytes"] = size
    if mtime:
        e["mtime"] = mtime
    if data is None:
        # The entry could not be read — a corrupt member, or one this format
        # cannot stream. NOT the same as an empty file, and recorded as its own
        # state rather than as a zero-length one.
        e["sha256"] = None
        e["mimetype_sniffed"] = None
        e["mimetype_source"] = "unreadable"
        return e
    e["sha256"] = hashlib.sha256(data).hexdigest()
    mime = _sniff_bytes(data)
    e["mimetype_sniffed"] = mime
    e["mimetype_source"] = "magic-bytes" if mime else "unrecognised"
    return e


def _sniff_bytes(head: bytes) -> str | None:
    """`_tech_meta.sniff_mimetype`, over bytes rather than a path.

    The signature table is imported rather than restated: two copies of it
    would let an archive entry and the same file on disk disagree about what
    they are, which is precisely the drift `rlp5` records.
    """
    head = head[:512]
    for sig, mime in sorted(_tm._MAGIC, key=lambda kv: -len(kv[0])):
        if head.startswith(sig):
            return mime
    if len(head) > 262 and head[257:262] == b"ustar":
        return "application/x-tar"
    return None


def _zip_entries(p: Path) -> Iterator[dict[str, Any]]:
    with zipfile.ZipFile(p) as z:
        for i in z.infolist():
            if i.is_dir():
                yield _entry(i.filename, "directory", None, _iso_from_tuple(i.date_time), None)
                continue
            try:
                with z.open(i) as fh:
                    data = fh.read()
            except Exception:
                data = None
            yield _entry(i.filename, "file", i.file_size, _iso_from_tuple(i.date_time), data)


def _iso_from_tuple(dt: tuple[int, int, int, int, int, int]) -> str | None:
    # A zip records local time with no zone, so this is NOT converted to UTC —
    # relabelling an unknown zone as UTC would be a fabricated measurement.
    # Recorded as a naive local timestamp, which is what the archive holds.
    try:
        return datetime.datetime(*dt).replace(microsecond=0).isoformat()
    except (ValueError, TypeError):
        return None


def _tar_entries(p: Path) -> Iterator[dict[str, Any]]:
    with tarfile.open(p) as t:
        for m in t:
            if m.isdir():
                yield _entry(m.name, "directory", None, _iso(m.mtime), None)
                continue
            if not m.isfile():
                # A symlink or device node. Recorded with its kind, because
                # "the archive contains a symlink" is a fact a reader wants and
                # silently dropping it makes the listing wrong.
                yield _entry(m.name, "symlink" if m.issym() or m.islnk() else "special", m.size, _iso(m.mtime), None)
                continue
            try:
                fh = t.extractfile(m)
                data = fh.read() if fh else None
            except Exception:
                data = None
            yield _entry(m.name, "file", m.size, _iso(m.mtime), data)


def contents(archive: Path) -> dict[str, Any]:
    """The manifest document for one archive, format decided by CONTENT."""
    mime = _tm.sniff_mimetype(str(archive))
    if mime == "application/zip":
        fmt, rows = "zip", list(_zip_entries(archive))
    elif mime in ("application/gzip", "application/x-tar") or tarfile.is_tarfile(archive):
        fmt, rows = "tar", list(_tar_entries(archive))
    else:
        # Refused, not guessed. A format this cannot read is reported as one —
        # an empty `entries[]` would read as an empty archive, which is a
        # different fact and the kind of silent zero this repository keeps
        # paying for.
        raise ValueError(
            f"{archive.name}: not an archive this can read "
            f"(sniffed {mime or 'unrecognised bytes'}) — nothing written"
        )
    files = [e for e in rows if e["kind"] == "file"]
    return {
        # The record is JSON-LD, and says so (bean `yh6u`): without this every
        # key below was dropped by a JSON-LD processor.
        "@context": CONTENT_CONTEXT_URL,
        "$schema": "folio-archive-contents/v1",
        "@id": f"library/{_slugify(archive.stem)}/contents",
        "archive": _tm.tech_meta(str(archive)),
        "format": fmt,
        "entries": rows,
        # Reported, never left to be counted off the array by a reader — and a
        # zero here is a determined zero.
        "n_entries": len(rows),
        "n_files": len(files),
        "n_directories": sum(1 for e in rows if e["kind"] == "directory"),
        "uncompressed_bytes": sum(e.get("bytes") or 0 for e in files),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("archives", nargs="+", type=Path)
    ap.add_argument("-o", "--outdir", type=Path, default=Path("."),
                    help="root that <doc-id>/ hangs off — the same meaning as pdf-structure.py -o")
    a = ap.parse_args()
    for arc in a.archives:
        try:
            doc = contents(arc)
        except (ValueError, OSError, zipfile.BadZipFile, tarfile.TarError) as e:
            print(f"SKIP {arc.name}: {e}", file=sys.stderr)
            return 1
        out = a.outdir / _slugify(arc.stem)
        out.mkdir(parents=True, exist_ok=True)
        (out / "contents.jsonld").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
        print(f"ok  {out.name:34s} {doc['n_files']:4d} file(s), {doc['n_directories']} dir(s)  [{doc['format']}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
