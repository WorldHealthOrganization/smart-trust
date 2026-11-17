#!/usr/bin/env python3
"""
meeting-recording — turn a recorded requirements walkthrough into evidence a
requirements document can cite. Bean `uphx`; skill `crdm-recorded-walkthrough`.

Standard library plus `ffmpeg`/`ffprobe` on PATH. Transcription is optional
and needs the `vosk` package and a model directory you already have; nothing
is downloaded.

    meeting-recording.py transcript FILE            # .vtt, Teams .docx or vosk .json -> JSON cues
    meeting-recording.py compare A B [--keys w,...] # word similarity + where they differ
    meeting-recording.py scenes VIDEO [--threshold 0.02]
    meeting-recording.py frames VIDEO --at 1:52,2:26 --out DIR [--crop W:H:X:Y] [--width 1280] [--webp]
    meeting-recording.py transcribe VIDEO --model DIR --out FILE.json

Why each exists, measured on the 2026-10-06 DPI-H walkthrough (17 min 9 s):

- A Teams **.docx** export and its **.vtt** are the SAME speech recognition.
  They agreed on 98% of words, and every difference was a moved interjection
  or two words joined at a line break. Comparing them cannot catch a
  recognition error; `compare` says so instead of reporting agreement as
  confirmation.
- An **independent** transcript (`transcribe`, Vosk small-en) agreed with
  Teams on 80% of words. Lower, but it disagrees where Teams is wrong
  ("Lightner" -> Leitner, "philtres" -> filters), which is the point.
- A Teams .docx carries **no screen content**: its images are speaker
  avatars. Screenshots come from the video only.
- `scenes` finds when the shared screen changes; frames cut at those times
  and at the moments a speaker says "you can see" are the screenshots.
"""
import argparse
import difflib
import html
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


def ts(s):
    """'1:52', '01:52', '00:01:52.5' or seconds -> seconds (float)."""
    parts = [float(p) for p in str(s).split(":")]
    sec = 0.0
    for p in parts:
        sec = sec * 60 + p
    return sec


def mmss(sec):
    sec = int(sec)
    return f"{sec // 60}:{sec % 60:02d}"


def words(text):
    return re.findall(r"[a-z0-9']+", text.lower())


# --- transcripts ------------------------------------------------------------

def read_vtt(path):
    raw = Path(path).read_text(encoding="utf-8")
    cues = []
    for start, speaker, body in re.findall(
        r"(\d+:\d\d:\d\d\.\d+) --> [^\n]+\n<v ([^>]+)>(.*?)</v>", raw, re.S
    ):
        cues.append({"start": ts(start), "speaker": speaker, "text": " ".join(body.split())})
    return cues


def read_teams_docx(path):
    """A Teams 'Download as .docx' transcript: 'Speaker   m:ss' then the text."""
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    cues = []
    for para in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        text = html.unescape("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", para)))
        m = re.match(r"^(.*?)\s{2,}(\d+:\d\d(?::\d\d)?)(.*)$", text)
        if m:
            cues.append({"start": ts(m.group(2)), "speaker": m.group(1).strip(), "text": m.group(3).strip()})
    return cues


def read_vosk(path):
    cues = []
    for r in json.loads(Path(path).read_text(encoding="utf-8")):
        ws = r.get("result") or []
        if ws:
            cues.append({"start": ws[0]["start"], "speaker": None, "text": " ".join(w["word"] for w in ws),
                         "words": ws})
    return cues


def read_transcript(path):
    p = str(path).lower()
    if p.endswith(".vtt"):
        return read_vtt(path)
    if p.endswith(".docx"):
        return read_teams_docx(path)
    if p.endswith(".json"):
        return read_vosk(path)
    sys.exit(f"meeting-recording: unknown transcript type: {path} (.vtt, .docx or vosk .json)")


def timed_words(cues):
    out = []
    for c in cues:
        if c.get("words"):
            out += [(w["word"], w["start"]) for w in c["words"]]
        else:
            out += [(w, c["start"]) for w in words(c["text"])]
    return out


def compare(a_path, b_path, keys=None, context=3):
    a, b = timed_words(read_transcript(a_path)), timed_words(read_transcript(b_path))
    aw, bw = [w for w, _ in a], [w for w, _ in b]
    sm = difflib.SequenceMatcher(None, aw, bw, autojunk=False)
    diffs = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        sa, sb = " ".join(aw[i1:i2]), " ".join(bw[j1:j2])
        if keys and not any(k in sa.split() or k in sb.split() for k in keys):
            continue
        at = a[i1][1] if i1 < len(a) else (a[-1][1] if a else 0)
        diffs.append({"at": mmss(at), "op": op, "a": sa, "b": sb})
    return {
        "a": {"file": str(a_path), "words": len(aw)},
        "b": {"file": str(b_path), "words": len(bw)},
        "similarity": round(sm.ratio(), 3),
        "differences": diffs,
        "note": "Two exports of one speech recognition (a Teams .docx and its .vtt) agree "
                "whatever it misheard: high similarity between them is not confirmation. "
                "Compare against an independent transcript for that.",
    }


# --- video ------------------------------------------------------------------

def need(tool):
    if not shutil.which(tool):
        sys.exit(f"meeting-recording: `{tool}` is not on PATH")


def scenes(video, threshold=0.02, min_gap=2.0):
    need("ffmpeg")
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(video), "-vf", f"select='gt(scene,{threshold})',showinfo",
         "-vsync", "vfr", "-f", "null", "-"], capture_output=True, text=True)
    times = [float(t) for t in re.findall(r"pts_time:([0-9.]+)", r.stderr)]
    kept = []
    for t in times:
        if not kept or t - kept[-1] >= min_gap:
            kept.append(t)
    return [mmss(t) for t in kept]


def frames(video, at, out, crop=None, width=None, webp=False):
    need("ffmpeg")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    filters = []
    if crop:
        filters.append(f"crop={crop}")
    if width:
        filters.append(f"scale={width}:-1")
    written = []
    for t in at:
        name = out / f"{mmss(ts(t)).replace(':', 'm')}.{'webp' if webp else 'png'}"
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(ts(t)), "-i", str(video),
               "-frames:v", "1"]
        if filters:
            cmd += ["-vf", ",".join(filters)]
        if webp:
            cmd += ["-c:v", "libwebp", "-quality", "80"]
        subprocess.run(cmd + [str(name)], check=True)
        written.append(str(name))
    return written


def transcribe(video, model, out):
    need("ffmpeg")
    try:
        import vosk  # optional: pip install vosk
    except ImportError:
        sys.exit("meeting-recording: transcribe needs the `vosk` package and a local model directory")
    vosk.SetLogLevel(-1)
    rec = vosk.KaldiRecognizer(vosk.Model(str(model)), 16000)
    rec.SetWords(True)
    pcm = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video), "-ac", "1",
                            "-ar", "16000", "-f", "s16le", "-"], stdout=subprocess.PIPE)
    results = []
    while True:
        chunk = pcm.stdout.read(16000 * 2 * 4)
        if not chunk:
            break
        if rec.AcceptWaveform(chunk):
            results.append(json.loads(rec.Result()))
    results.append(json.loads(rec.FinalResult()))
    Path(out).write_text(json.dumps(results), encoding="utf-8")
    return {"out": str(out), "words": sum(len(r.get("result", [])) for r in results)}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="meeting-recording", description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("transcript"); p.add_argument("file")
    p = sub.add_parser("compare"); p.add_argument("a"); p.add_argument("b")
    p.add_argument("--keys", help="comma-separated words: report only differences touching them")
    p = sub.add_parser("scenes"); p.add_argument("video"); p.add_argument("--threshold", type=float, default=0.02)
    p.add_argument("--min-gap", type=float, default=2.0)
    p = sub.add_parser("frames"); p.add_argument("video"); p.add_argument("--at", required=True)
    p.add_argument("--out", required=True); p.add_argument("--crop"); p.add_argument("--width", type=int)
    p.add_argument("--webp", action="store_true")
    p = sub.add_parser("transcribe"); p.add_argument("video"); p.add_argument("--model", required=True)
    p.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "transcript":
        res = read_transcript(a.file)
    elif a.cmd == "compare":
        res = compare(a.a, a.b, a.keys.split(",") if a.keys else None)
    elif a.cmd == "scenes":
        res = scenes(a.video, a.threshold, a.min_gap)
    elif a.cmd == "frames":
        res = frames(a.video, a.at.split(","), a.out, a.crop, a.width, a.webp)
    else:
        res = transcribe(a.video, a.model, a.out)
    json.dump(res, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
