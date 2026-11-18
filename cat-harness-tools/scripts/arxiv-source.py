#!/usr/bin/env python3
"""arxiv-source.py — fetch an arXiv paper's LaTeX source into its library entry.

The source is what `latex-math-overlay.py` reads. It is fetched once and kept
at `<entry>/source/e-print` with a `source.json` beside it recording the URL,
sha256, byte count and fetch time, so a re-ingest reads the same bytes and
never re-asks arXiv.

The arXiv id is read from the entry's directory name (`arxiv-<id>v<n>`), the
convention `ingest-document.ts`'s slug uses. An entry that does not carry one
is skipped and says so; a title search is `find-arxiv-mirrors.py`'s job, and a
fuzzy match is not a source.

## What lands beside the e-print

- `source/files/` — the bundle's `.tex`, `.bib`, `.bbl`, `.sty`, `.cls` and
  any licence file (`LICENSE*`, `COPYING*`, `LICENCE*`), unpacked so they are
  greppable and addressable. Nothing else is unpacked: figures are already in
  the PDF, and a member whose path is absolute, climbs out with `..`, or is a
  link is refused rather than followed. `source.json` lists each one with its
  sha256 and size.
- `licence.json` — the paper's licence from arXiv's own metadata (OAI-PMH,
  `metadataPrefix=arXiv`, its `<license>` element), in the three-state record
  `schemas/source-licence.ts` defines and `gen-library-jsonld.ts` carries into
  the graph as `dcterms:license`. A record without `<license>` is written as
  `unknown` with where it looked — never as a default licence, because whether
  the paper may be republished turns on exactly this field. A licence file in
  the bundle is noted in the record; it does not override arXiv's statement.
  An existing `licence.json` not written by this script (an editor's) is left
  alone.

Network: outbound HTTPS to arxiv.org (`export.arxiv.org` for the metadata). A sandbox that denies it gets an
`unreachable` line per entry and exit 2, never a partial file.

arXiv asks automated clients for no more than one request every three
seconds; `--delay` defaults to that.

Usage:
  python3 scripts/arxiv-source.py library/arxiv-0705.1468v1
  python3 scripts/arxiv-source.py library/arxiv-* --delay 3
  python3 scripts/arxiv-source.py library/arxiv-0705.1468v1 --refetch

Exit: 0 fetched, present or PDF-only, 1 an entry failed, 2 arXiv unreachable.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

SOURCE_DIRNAME = "source"
EPRINT = os.environ.get("ARXIV_EPRINT_URL", "https://arxiv.org/e-print/{id}")
# Overridable so the tests can serve a fixture over file://.
OAI = os.environ.get(
    "ARXIV_OAI_URL",
    "https://export.arxiv.org/oai2?verb=GetRecord&identifier=oai:arXiv.org:{id}&metadataPrefix=arXiv",
)
FILES_DIRNAME = "files"
LICENCE_FILENAME = "licence.json"
WRITTEN_BY = "arxiv-source.py"
KEEP_EXT = (".tex", ".bib", ".bbl", ".sty", ".cls")
_LICENCE_NAME = re.compile(r"^(licen[cs]e|copying)(\.[a-z]+)?$", re.I)
UA = "cat-harness-tools-arxiv-source/1.0 (+https://github.com/litlfred/cat-harness-tools)"
_ID = re.compile(r"^arxiv-(?:(\d{4}\.\d{4,5}(?:v\d+)?)|([a-z][a-z\-]*?(?:\.[A-Za-z]{2})?)-(\d{7}(?:v\d+)?))$")


def arxiv_id(entry: str) -> str | None:
    """`arxiv-0705.1468v1` → `0705.1468v1`; an old-style `arxiv-hep-th-9901001v2`
    → `hep-th/9901001v2` (the LAST hyphen before the seven digits is the slash,
    since categories carry hyphens of their own); anything else `None`."""
    m = _ID.match(os.path.basename(entry.rstrip("/")))
    if not m:
        return None
    return m.group(1) or f"{m.group(2)}/{m.group(3)}"


def _role(name: str) -> str | None:
    base = os.path.basename(name)
    if _LICENCE_NAME.match(base):
        return "licence"
    ext = os.path.splitext(base)[1].lower()
    return ext[1:] if ext in KEEP_EXT else None


def _safe(name: str) -> str | None:
    """A member path that stays inside `files/`, or `None`."""
    n = name.replace("\\", "/")
    if n.startswith("/") or re.match(r"^[A-Za-z]:", n):
        return None
    while n.startswith("./"):
        n = n[2:]
    if not n or any(part == ".." for part in n.split("/")):
        return None
    return n


def unpack(entry: str) -> list[dict]:
    """Unpack the kept members of `source/e-print` into `source/files/`."""
    sdir = os.path.join(entry, SOURCE_DIRNAME)
    with open(os.path.join(sdir, "e-print"), "rb") as fh:
        raw = fh.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    members: list[tuple[str, bytes]] = []
    try:
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            for m in tar.getmembers():
                if not m.isfile():  # links and devices are not followed
                    continue
                f = tar.extractfile(m)
                if f is not None:
                    members.append((m.name, f.read()))
    except tarfile.ReadError:
        # A single-file submission: one gzipped .tex with no tar around it.
        members.append(("main.tex", raw))
    out = []
    fdir = os.path.join(sdir, FILES_DIRNAME)
    for name, body in members:
        role = _role(name)
        rel = _safe(name)
        if role is None or rel is None:
            continue
        dest = os.path.join(fdir, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as fh:
            fh.write(body)
        out.append({"path": f"{FILES_DIRNAME}/{rel}", "role": role,
                    "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)})
    return sorted(out, key=lambda r: r["path"])


ASSUMED_LICENCE = "http://arxiv.org/licenses/assumed-1991-2003/"


def is_pre_2004(created: str | None, ident: str) -> bool:
    if created:
        return created < "2004-01-01"
    if "/" in ident:
        m = re.search(r"/(\d{2})", ident)
        if m:
            yy = int(m.group(1))
            return yy >= 91 or yy <= 3
    return False


def licence_record(ident: str, files: list[dict], today: str) -> tuple[dict | None, str]:
    """The arXiv licence as a `source-licence` record, or `(None, why)` when
    arXiv's metadata could not be read at all (no record is better than a
    record claiming somebody looked)."""
    bare = re.sub(r"v\d+$", "", ident)
    url = OAI.format(id=bare)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            xml = r.read()
    except (urllib.error.URLError, OSError) as e:
        return None, f"{url}: {e}"
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        return None, f"{url}: unparseable metadata ({e})"
    if not any(el.tag.endswith("}arXiv") for el in root.iter()):
        err = next((el.text for el in root.iter() if el.tag.endswith("}error")), None)
        return None, f"{url}: no arXiv metadata record" + (f" ({err.strip()})" if err else "")
    created = next((el.text.strip() for el in root.iter() if el.tag.endswith("}created") and el.text and el.text.strip()), None)
    lic = next((el.text.strip() for el in root.iter() if el.tag.endswith("}license") and el.text and el.text.strip()), None)
    in_bundle = [f["path"] for f in files if f["role"] == "licence"]
    bundle_note = (f" The source bundle also carries {', '.join('source/' + p for p in in_bundle)}; "
                   "read it before relying on this record alone.") if in_bundle else ""
    if lic:
        rec = {"status": "stated", "id": lic,
               "basis": f"arXiv metadata record ({url}), <license> element, read {today}"}
        if bundle_note:
            rec["note"] = bundle_note.strip()
    elif is_pre_2004(created, ident):
        date_str = f"submitted {created}" if created else "pre-2004 submission"
        rec = {"status": "stated", "id": ASSUMED_LICENCE,
               "basis": f"arXiv metadata record ({url}), {date_str}, assumed licence per {ASSUMED_LICENCE}"}
        if bundle_note:
            rec["note"] = bundle_note.strip()
    else:
        rec = {"status": "unknown",
               "searched": [{"where": url, "result": "the arXiv metadata record has no <license> element", "on": today}]
                         + [{"where": f"source/{p}", "result": "licence file present in the source bundle; not interpreted here", "on": today} for p in in_bundle],
               "note": "arXiv records no licence for this submission. Whether it may be republished is NOT established "
                       "here; do not assume arXiv's default distribution licence grants it." + bundle_note}
    rec["written_by"] = WRITTEN_BY
    return rec, "stated" if (lic or is_pre_2004(created, ident)) else "unknown"


def write_licence(entry: str, rec: dict) -> str:
    path = os.path.join(entry, LICENCE_FILENAME)
    if os.path.exists(path):
        try:
            with open(path) as fh:
                old = json.load(fh)
        except (OSError, json.JSONDecodeError):
            old = None
        if not (isinstance(old, dict) and old.get("written_by") == WRITTEN_BY):
            return "kept the existing licence.json (not written by this script)"
    with open(path, "w") as fh:
        json.dump(rec, fh, indent=1)
        fh.write("\n")
    return f"licence {rec['status']}" + (f" {rec['id']}" if rec.get("id") else "")


def fetch_eprint(entry: str, ident: str, refetch: bool) -> tuple[str, str]:
    sdir = os.path.join(entry, SOURCE_DIRNAME)
    target = os.path.join(sdir, "e-print")
    if os.path.exists(target) and not refetch:
        return "present", target
    url = EPRINT.format(id=ident)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return "failed", f"{url}: HTTP {e.code}"
    except (urllib.error.URLError, OSError) as e:
        return "unreachable", f"{url}: {e}"
    # arXiv answers a PDF-only submission (no source deposited) with the PDF.
    if body[:5] == b"%PDF-":
        return "pdf-only", "arXiv holds no LaTeX source for this paper (PDF-only submission)"
    os.makedirs(sdir, exist_ok=True)
    tmp = target + ".part"
    with open(tmp, "wb") as fh:
        fh.write(body)
    os.replace(tmp, target)
    with open(os.path.join(sdir, "source.json"), "w") as fh:
        json.dump({
            "url": url,
            "content_type": ctype,
            "sha256": hashlib.sha256(body).hexdigest(),
            "bytes": len(body),
            "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, fh, indent=1)
    return "fetched", f"{len(body)} bytes"


def record_files(entry: str) -> list[dict]:
    """Unpack the bundle and list what was kept in `source.json`."""
    files = unpack(entry)
    spath = os.path.join(entry, SOURCE_DIRNAME, "source.json")
    meta = {}
    if os.path.exists(spath):
        with open(spath) as fh:
            meta = json.load(fh)
    meta["files"] = files
    with open(spath, "w") as fh:
        json.dump(meta, fh, indent=1)
    return files


def fetch(entry: str, refetch: bool) -> tuple[str, str]:
    """`(status, detail)` for one entry: the e-print, its files, its licence.

    The licence is looked up whether or not arXiv holds a LaTeX source: a
    PDF-only paper has a licence too, and it decides the same question."""
    ident = arxiv_id(entry)
    if ident is None:
        return "skipped", "directory name carries no arXiv id"
    status, detail = fetch_eprint(entry, ident, refetch)
    if status in ("failed", "unreachable"):
        return status, detail
    parts = [detail if status != "present" else "e-print present"]
    files: list[dict] = []
    if status != "pdf-only":
        files = record_files(entry)
        parts.append(f"{sum(f['role'] == 'tex' for f in files)} .tex, {len(files)} files kept")
    lpath = os.path.join(entry, LICENCE_FILENAME)
    have_ours = False
    if os.path.exists(lpath):
        try:
            with open(lpath) as fh:
                have_ours = json.load(fh).get("written_by") == WRITTEN_BY
        except (OSError, json.JSONDecodeError, AttributeError):
            pass
    if os.path.exists(lpath) and (not have_ours or not refetch):
        parts.append("licence.json kept")
    else:
        today = datetime.now(timezone.utc).date().isoformat()
        rec, why = licence_record(ident, files, today)
        if rec is None:
            return "unreachable", f"licence: {why}"
        parts.append(write_licence(entry, rec))
    return status, "; ".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description="fetch arXiv LaTeX source into library entries")
    ap.add_argument("entries", nargs="+")
    ap.add_argument("--delay", type=float, default=3.0, help="seconds between requests (arXiv asks for 3)")
    ap.add_argument("--refetch", action="store_true")
    args = ap.parse_args()
    worst = 0
    asked = False
    for e in args.entries:
        if asked:
            time.sleep(args.delay)
        status, detail = fetch(e, args.refetch)
        asked = status in ("fetched", "pdf-only", "failed", "unreachable") or ("licence stated" in detail or "licence unknown" in detail)
        print(f"{status:<11} {os.path.basename(e.rstrip('/')):<34} {detail}")
        if status == "unreachable":
            return 2
        if status == "failed":
            worst = 1
    return worst


if __name__ == "__main__":
    sys.exit(main())
