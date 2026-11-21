#!/usr/bin/env python3
"""A recording as a library entry, and its source-language transcript. Bean `folio-assistant-1r0p`.

Two steps, because the recogniser does not run here:

  record      write `<out>/<slug>/recording.json` (`folio-recording/v1`): the
              recording's title, date, spoken language and speakers, read off
              the recording or its meeting record by the caller and passed in
              an identity file, never guessed; plus `_tech_meta`'s `source`
              block and the length `ffprobe` reads (null when it cannot).
  transcript  write `<entry>/transcript/<lang>.json` (`folio-transcript/v1`)
              from a recogniser's output. Today that is whisper.cpp's `-oj`
              JSON. The recogniser's tool, version, model and model sha256 come
              from a second file the caller writes from the run, because the
              JSON does not carry them.

The transcript is the recogniser's text as it came out, in state `draft`,
drafted by the recogniser as a `script`. Nothing here corrects a name or a
term: a correction is a reviewer's, and confirming a transcript is a human's
act (`schemas/content/narrative.ts`).

Translations are written by their translator straight to
`transcript/<lang>.json`, with `translated_from` naming the source language
and the sha256 of its segments (`segments_sha256` below), so a later
correction to the source makes them stale. `check:l1-complete` checks them.

`gen-library-jsonld.ts --entry <entry>` then writes the manifest and one
`transcript` block per language, as for every rung.

  python3 scripts/recording-transcript.py record uploads/talk.mp4 -o library --identity id.json [--slug S]
  python3 scripts/recording-transcript.py transcript library/S --whisper-json talk.json --recogniser r.json
  python3 scripts/recording-transcript.py segments-sha256 library/S/transcript/en.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _pdf_doc_id import slugify as _slugify  # noqa: E402


def _load_tech_meta():
    import importlib.util as _u
    spec = _u.spec_from_file_location("_tech_meta", str(Path(__file__).with_name("_tech_meta.py")))
    mod = _u.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_tm = _load_tech_meta()
RECORDING_SCHEMA = "folio-recording/v1"
TRANSCRIPT_SCHEMA = "folio-transcript/v1"
RECORDING_FILE = "recording.json"
TRANSCRIPT_DIR = "transcript"
LANG = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def is_recording(mime: str | None) -> bool:
    return bool(mime) and (mime.startswith("audio/") or mime.startswith("video/"))


def duration_s(path: Path) -> float | None:
    """Length in seconds by `ffprobe`, or None when it is absent or cannot read the file."""
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return round(float(r.stdout.strip()), 3)
    except ValueError:
        return None


def recording(path: Path, ident: dict) -> dict:
    missing = [k for k in ("title", "date", "language") if not ident.get(k)]
    if missing:
        raise ValueError(f"identity file lacks {', '.join(missing)}: read them off the recording, never guess")
    if not DATE.match(ident["date"]):
        raise ValueError(f"identity date {ident['date']!r} is not YYYY-MM-DD")
    if not LANG.match(ident["language"]):
        raise ValueError(f"identity language {ident['language']!r} is not a BCP 47 tag")
    meta = _tm.tech_meta(str(path))
    if not is_recording(meta["mimetype_sniffed"]):
        raise ValueError(f"{path.name} sniffs as {meta['mimetype_sniffed'] or 'unrecognised'}, not audio or video")
    identity = {k: ident[k] for k in ("title", "date", "language")}
    if ident.get("speakers"):
        identity["speakers"] = list(ident["speakers"])
    return {"$schema": RECORDING_SCHEMA, "identity": identity, "source": meta, "duration_s": duration_s(path)}


def _ms(v) -> int:
    return int(round(float(v)))


def from_whisper_cpp(doc: dict) -> tuple[str, list[dict]]:
    """(language, segments) from whisper.cpp's `-oj` output. Refuses a `translate` run."""
    params = doc.get("params") or {}
    if params.get("translate"):
        raise ValueError("this whisper.cpp run translated into English: it is a translation, not a transcript")
    lang = (doc.get("result") or {}).get("language") or params.get("language")
    if not lang or not LANG.match(lang):
        raise ValueError(f"whisper.cpp output names no usable language ({lang!r})")
    segs = []
    for t in doc.get("transcription") or []:
        text = (t.get("text") or "").strip()
        off = t.get("offsets") or {}
        if not text or "from" not in off or "to" not in off:
            continue
        segs.append({"start_ms": _ms(off["from"]), "end_ms": _ms(off["to"]), "text": text})
    if not segs:
        raise ValueError("whisper.cpp output holds no timed text")
    return lang, segs


def recogniser_of(r: dict) -> dict:
    missing = [k for k in ("tool", "version", "model", "model_sha256") if not r.get(k)]
    if missing:
        raise ValueError(f"recogniser file lacks {', '.join(missing)}: record them from the run")
    if not SHA256.match(r["model_sha256"]):
        raise ValueError("recogniser model_sha256 is not a 64-hex sha256")
    out = {k: r[k] for k in ("tool", "version", "model", "model_sha256")}
    if r.get("invocation"):
        out["invocation"] = r["invocation"]
    return out


def transcript(entry: Path, whisper: dict, rec: dict, date: str | None = None) -> tuple[str, dict]:
    rfile = entry / RECORDING_FILE
    if not rfile.exists():
        raise ValueError(f"{entry} has no {RECORDING_FILE}: run `record` first")
    record = json.loads(rfile.read_text(encoding="utf-8"))
    lang, segs = from_whisper_cpp(whisper)
    spoken = record["identity"]["language"]
    if lang != spoken:
        raise ValueError(f"the recogniser heard {lang}, the recording is recorded as {spoken}")
    g = recogniser_of(rec)
    doc = {
        "$schema": TRANSCRIPT_SCHEMA,
        "lang": lang,
        "recording_sha256": record["source"]["sha256"],
        "recogniser": g,
        "state": "draft",
        "drafted_by": {"kind": "script", "id": g["tool"], "version": g["version"]},
        **({"drafted_at": date} if date else {}),
        "segments": segs,
    }
    return lang, doc


def segments_sha256(segments: list[dict]) -> str:
    """sha256 of `segmentsCanonical` in `schemas/library/recording.ts`: compact JSON of [start, end, text]."""
    canon = json.dumps([[s["start_ms"], s["end_ms"], s["text"]] for s in segments], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def _write(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("record")
    p.add_argument("file", type=Path)
    p.add_argument("-o", "--outdir", type=Path, required=True)
    p.add_argument("--identity", type=Path, required=True, help="JSON: title, date, language, speakers?")
    p.add_argument("--slug")
    p = sub.add_parser("transcript")
    p.add_argument("entry", type=Path)
    p.add_argument("--whisper-json", type=Path, required=True)
    p.add_argument("--recogniser", type=Path, required=True, help="JSON: tool, version, model, model_sha256, invocation?")
    p.add_argument("--date", help="drafted_at, YYYY-MM-DD: the day the recogniser ran")
    p = sub.add_parser("segments-sha256")
    p.add_argument("transcript", type=Path)
    a = ap.parse_args(argv)
    try:
        if a.cmd == "record":
            doc = recording(a.file, json.loads(a.identity.read_text(encoding="utf-8")))
            out = a.outdir / (a.slug or _slugify(a.file.stem))
            _write(out / RECORDING_FILE, doc)
            print(f"ok  {out.name}  {doc['source']['mimetype_sniffed']}, {doc['duration_s']} s")
        elif a.cmd == "transcript":
            lang, doc = transcript(
                a.entry,
                json.loads(a.whisper_json.read_text(encoding="utf-8")),
                json.loads(a.recogniser.read_text(encoding="utf-8")),
                a.date,
            )
            _write(a.entry / TRANSCRIPT_DIR / f"{lang}.json", doc)
            print(f"ok  {a.entry.name}/{TRANSCRIPT_DIR}/{lang}.json  {len(doc['segments'])} segments, draft")
        else:
            print(segments_sha256(json.loads(a.transcript.read_text(encoding="utf-8"))["segments"]))
    except (ValueError, OSError, KeyError) as e:
        print(f"SKIP: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
