#!/usr/bin/env python3
"""
pdf-ocr — recover text from PDFs that `pdf-structure` cannot read.

Two kinds of document defeat text extraction entirely, and both are common
in an ingested corpus:

  * **A scan with no text layer.** `pypdf` returns 0 characters. The
    document is invisible to grep, has no title, and cannot be registered.
  * **A scan whose text layer is mojibake.** Older Japanese typesetting
    embeds a JIS-encoded font with no ToUnicode map, so extraction yields
    `Fs=E2=7k$SL\\$Ncolored Jones` — worse than nothing, because it looks
    like text and passes any "did we get characters" test.

This rasterises such documents and runs Tesseract over the images, caching
one text file per page beside the PDF. `pdf-structure.py --ocr` then reads
that cache instead of the embedded text.

## Why Tesseract and not a model-based OCR

Measured against this environment, not against benchmarks. Every
model-based option — PaddleOCR, docTR, Surya, EasyOCR — fetches weights
from Hugging Face on first run, and `huggingface.co` returns **403** here
(organisation policy). Tesseract's language data ships in Ubuntu packages,
so it installs from apt and runs entirely offline:

    apt-get install -y --no-install-recommends \\
        tesseract-ocr tesseract-ocr-eng tesseract-ocr-jpn \\
        poppler-utils poppler-data

`poppler-data` is not optional for CJK. Without it `pdftoppm` fails with
"Missing language pack for 'Adobe-Japan1' mapping" and produces no image
at all, so the OCR silently has nothing to read.

`rapidocr-onnxruntime` is the one model-based option that does work
offline — it ships its ONNX weights inside the wheel — and is the natural
second string if Tesseract's accuracy proves insufficient on a given
document class.

## Language

Passing the wrong language is not a small penalty: a Japanese page read as
English returns near-nothing. The language is guessed from Tesseract's own
orientation-and-script detection, which is cheap and does not need the
language pack for the script it detects. Override with `--lang`.

Script detection alone cannot tell languages that share a script apart:
French, Spanish and Portuguese are all `Latin`, Russian and Ukrainian are both
`Cyrillic`, Arabic and Persian are both `Arabic`. So a caller that knows the
document's languages passes them as `--lang-hint` (ISO 639 codes, as a Dublin
Core `dc.language.iso` carries them: `fr,en`). The hints are filtered to the
script the page shows, so a bilingual French/English record OCRs a French
page as `fra+eng`. A hinted language whose Tesseract pack is not installed is
an ERROR naming the package to install, never a silent fall back to English:
owner, 2026-11-10, "make sure OCR is language aware".

Right-to-left scripts (Arabic, Persian, Hebrew, Urdu) are recorded as such in
the run context (`direction: rtl`), so a later rule that reads lines or
margins can tell an RTL page from an LTR one instead of assuming LTR.

Usage:
    pdf-ocr.py <pdf> [-o OUTDIR] [--lang jpn+eng | --lang-hint fr,en] [--dpi 200] [--force]
               [--vision-digits]   # opt-in; needs IRIS_VISION_MODEL and ANTHROPIC_API_KEY
    pdf-ocr.py --check            # report whether the tools are present
"""

from __future__ import annotations

import argparse
import glob
import os
import re
from collections import Counter
import shutil
import subprocess
import sys
import tempfile

# `-o` is the ROOT that `<doc-id>/` hangs off, the same meaning
# `pdf-structure.py -o` carries — and the doc-id is spelled by the SHARED
# helper so the two steps of one pipeline compose. Bean `rlp5`: this script
# used to write `<outdir>/ocr/` with no doc-id level, so a second scanned
# document overwrote the first page for page, silently, and
# `pdf-structure.py --ocr` looked somewhere this never wrote.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pdf_doc_id import OCR_DIRNAME, derive_doc_id, ocr_cache_dir  # noqa: E402
import _run_context  # noqa: E402

# A page below this many characters is treated as having no usable text.
MIN_CHARS_PER_PAGE = 120
# Below this fraction of letters, the "text" is mojibake rather than prose.
MIN_ALPHA_RATIO = 0.55

SCRIPT_TO_LANG = {
    "Japanese": "jpn+eng",
    "HanS": "chi_sim+eng",
    "HanT": "chi_tra+eng",
    "Korean": "kor+eng",
    "Cyrillic": "rus+eng",
    "Greek": "ell+eng",
    "Arabic": "ara+eng",
    "Hebrew": "heb+eng",
    "Devanagari": "hin+eng",
    "Thai": "tha+eng",
}

# ISO 639-1 / 639-2 code (as `dc.language.iso` carries it) -> Tesseract pack.
ISO_TO_TESS = {
    "en": "eng", "eng": "eng", "fr": "fra", "fra": "fra", "fre": "fra",
    "es": "spa", "spa": "spa", "pt": "por", "por": "por", "de": "deu",
    "deu": "deu", "ger": "deu", "it": "ita", "ita": "ita", "nl": "nld",
    "ru": "rus", "rus": "rus", "uk": "ukr", "ukr": "ukr", "ar": "ara",
    "ara": "ara", "fa": "fas", "fas": "fas", "per": "fas", "ur": "urd",
    "he": "heb", "heb": "heb", "zh": "chi_sim+chi_tra", "zho": "chi_sim+chi_tra",
    "chi": "chi_sim+chi_tra", "ja": "jpn", "jpn": "jpn", "ko": "kor",
    "kor": "kor", "el": "ell", "ell": "ell", "hi": "hin", "hin": "hin",
    "th": "tha", "tr": "tur", "id": "ind", "vi": "vie", "sw": "swa",
}

# Which script each Tesseract pack writes in, as `--psm 0` names scripts.
TESS_SCRIPT = {
    "eng": "Latin", "fra": "Latin", "spa": "Latin", "por": "Latin",
    "deu": "Latin", "ita": "Latin", "nld": "Latin", "tur": "Latin",
    "ind": "Latin", "vie": "Latin", "swa": "Latin",
    "rus": "Cyrillic", "ukr": "Cyrillic", "ara": "Arabic", "fas": "Arabic",
    "urd": "Arabic", "heb": "Hebrew", "chi_sim": "Han", "chi_tra": "Han",
    "jpn": "Japanese", "kor": "Korean", "ell": "Greek", "hin": "Devanagari",
    "tha": "Thai",
}

RTL_SCRIPTS = {"Arabic", "Hebrew"}


def hint_packs(hints: list[str]) -> list[str]:
    """Tesseract packs for ISO 639 hints, in order, without repeats.

    `en_US` and `EN` read as `en`; an unknown code is dropped, because a
    record that names a language with no Tesseract model has nothing to ask
    for. Pure.
    """
    out: list[str] = []
    for h in hints:
        code = h.strip().lower().replace("-", "_").split("_")[0]
        for p in ISO_TO_TESS.get(code, "").split("+"):
            if p and p not in out:
                out.append(p)
    return out


def _script_family(script: str) -> str:
    """`HanS`/`HanT` are one family for matching against hints."""
    return "Han" if script.startswith("Han") else script


def choose_lang(script: str, hints: list[str], have: set[str]) -> tuple[str, list[str]]:
    """The `-l` value for a page whose detected script is `script`. Pure.

    Returns `(lang, missing)`: `missing` is the hinted packs the page needs
    that are not installed — the caller refuses on it rather than reading a
    French page as English. With no hints, the old script-only rule holds.
    """
    packs = hint_packs(hints)
    if packs:
        fam = _script_family(script)
        same = [p for p in packs if TESS_SCRIPT.get(p) == fam] if fam else []
        if fam == "Han" and same:
            # The detector does tell simplified from traditional.
            want = "chi_tra" if script == "HanT" else "chi_sim"
            same = [want] + [p for p in same if p != want and not p.startswith("chi_")]
        if not same:
            # The page's script matches no hinted language (or none was
            # detected): read it with every hinted pack.
            same = packs
        if "eng" in packs and "eng" not in same:
            same = same + ["eng"]
        missing = [p for p in same if p not in have]
        return "+".join(same), missing
    lang = SCRIPT_TO_LANG.get(script, "eng")
    # Fall back rather than fail: asking for a pack that is not installed
    # makes Tesseract exit non-zero and return nothing at all.
    kept = "+".join(p for p in lang.split("+") if p in have)
    return kept or "eng", []


def direction_of(lang: str) -> str:
    """`rtl` when the page's FIRST pack writes right to left, else `ltr`. Pure."""
    first = lang.split("+")[0]
    return "rtl" if TESS_SCRIPT.get(first) in RTL_SCRIPTS else "ltr"


def tools_present() -> dict[str, str | None]:
    return {t: shutil.which(t) for t in ("tesseract", "pdftoppm")}


def langs_present() -> set[str]:
    try:
        out = subprocess.run(["tesseract", "--list-langs"], capture_output=True,
                             text=True, timeout=30).stdout
    except Exception:
        return set()
    return {l.strip() for l in out.splitlines()[1:] if l.strip()}


def _first_line_version(cmd: list[str], pattern: str) -> str:
    """The version a tool prints about itself, or `unknown`."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception:
        return "unknown"
    m = re.search(pattern, (r.stdout or "") + "\n" + (r.stderr or ""))
    return m.group(1) if m else "unknown"


def tessdata_dir() -> str | None:
    """Where Tesseract reads its language models from, as it reports it."""
    try:
        out = subprocess.run(["tesseract", "--list-langs"], capture_output=True,
                             text=True, timeout=30).stdout
    except Exception:
        return None
    m = re.search(r'"([^"]+)"', out.splitlines()[0] if out else "")
    return m.group(1) if m else os.environ.get("TESSDATA_PREFIX")


def _package_version(file: str) -> str | None:
    """The distribution package that owns `file`, where dpkg can say."""
    try:
        r = subprocess.run(["dpkg-query", "-S", file], capture_output=True, text=True, timeout=20)
        pkg = r.stdout.split(":", 1)[0].strip() if r.returncode == 0 else ""
        if not pkg:
            return None
        v = subprocess.run(["dpkg-query", "-W", "-f=${Version}", pkg],
                           capture_output=True, text=True, timeout=20).stdout.strip()
        return v or None
    except Exception:
        return None


def ocr_releases(langs: list[str]) -> list[dict]:
    """`releases[]` of a `folio-run-context/v1` for one OCR run (bean `turh`).

    The engine, the rasteriser, and each language model the run used — each
    with the sha256 of the bytes that ran. The model matters as much as the
    engine: Ubuntu's `tesseract-ocr-eng` and tessdata_best's `eng` are both
    "eng" and read the same page differently.
    """
    tools = tools_present()
    out = [
        _run_context.provisioned(
            "tesseract", _first_line_version(["tesseract", "--version"], r"tesseract\s+v?(\S+)"), tools["tesseract"]),
        _run_context.provisioned(
            "pdftoppm", _first_line_version(["pdftoppm", "-v"], r"pdftoppm version\s+(\S+)"), tools["pdftoppm"]),
    ]
    td = tessdata_dir()
    for lang in langs:
        f = os.path.join(td, f"{lang}.traineddata") if td else None
        if not f or not os.path.exists(f):
            out.append(_run_context.could_not_provision(
                f"tessdata-{lang}", "unknown", f"no {lang}.traineddata under {td or 'an unknown tessdata directory'}"))
            continue
        digest = _run_context.sha256_file(f) or ""
        version = _package_version(os.path.realpath(f)) or f"sha256-{digest[:12]}"
        out.append(_run_context.provisioned(f"tessdata-{lang}", version, f))
    return out


def write_ocr_run_context(pdf: str, root: str, cache: str, langs: list[str],
                          vision: bool = False) -> dict | None:
    """Record which software produced `cache`, beside it. None when no checkout can be named.

    A run with the vision fallback says so: a remote model has no bytes here
    to digest, so it is recorded as not provisioned, with the reason.
    """
    releases = ocr_releases(langs)
    if vision:
        releases.append(_run_context.could_not_provision(
            "vision-digits", "not-disclosed",
            f"a remote vision model re-read unsure number words; see {VISION_LOG}"))
    ctx = _run_context.build(
        invoker_script=os.path.abspath(__file__),
        releases=releases,
        inputs=[pdf],
        where=[root, os.getcwd()],
    )
    if ctx is None:
        print(f"  warning: no git checkout found for {root}; ocr/{_run_context.RUN_CONTEXT_FILENAME} not written",
              file=sys.stderr)
        return None
    return _run_context.write(ctx, cache)


def is_mojibake(text: str) -> bool:
    """Text that decoded through the wrong codec.

    Distinct from "no text": the string is long, so a length test passes,
    but it is mostly punctuation and digits rather than letters.
    """
    if not text:
        return True
    letters = sum(c.isalpha() for c in text)
    return letters < MIN_ALPHA_RATIO * len(text)


def needs_ocr(pages: list[str]) -> tuple[bool, str]:
    """Decide from the embedded text alone, and say why."""
    if not pages:
        return True, "no pages could be read"
    total = sum(len(p or "") for p in pages)
    mean = total / len(pages)
    if mean < MIN_CHARS_PER_PAGE:
        return True, f"{int(mean)} chars/page — no text layer"
    head = " ".join((p or "") for p in pages[:3])
    if is_mojibake(head):
        return True, "text layer is mojibake — wrong codec"
    return False, f"{int(mean)} chars/page of readable text"


def detect_script(png: str) -> str:
    """Tesseract's orientation-and-script guess for one page, or ''."""
    try:
        out = subprocess.run(["tesseract", png, "stdout", "--psm", "0"], env=_tesseract_env(),
                             capture_output=True, text=True, timeout=90).stdout
    except Exception:
        return ""
    m = re.search(r"Script:\s*(\S+)", out)
    return m.group(1) if m else ""


def detect_lang(png: str, hints: list[str] | None = None) -> str:
    """The language to read `png` in: its script, narrowed by `hints`.

    Raises when a hinted pack the page needs is missing, naming the apt
    package, so a run never reads a page in a language it was not given.
    """
    lang, missing = choose_lang(detect_script(png), hints or [], langs_present())
    if missing:
        pkgs = " ".join("tesseract-ocr-" + p.replace("_", "-") for p in missing)
        raise RuntimeError(f"needs Tesseract language pack(s) {', '.join(missing)}: apt-get install {pkgs}")
    return lang


def ocr_pdf(pdf: str, root: str, lang: str | None, dpi: int,
            force: bool, hints: list[str] | None = None, vision_ask=None) -> tuple[int, str]:
    """Rasterise and OCR, caching one text file per page. Returns (pages, lang).

    `root` is the ROOT, not the cache directory: pages land in
    `root/<doc-id>/ocr/`. Two documents therefore cannot collide however many
    are OCR'd into one root — by construction rather than by the caller
    remembering to pass a different `-o` each time.
    """
    cache = ocr_cache_dir(root, pdf)
    os.makedirs(cache, exist_ok=True)
    done = sorted(glob.glob(os.path.join(cache, "page-*.txt")))
    # A cache counts only once a run has finished it. Pages are written one
    # at a time, so a run stopped part way left a few `page-*.txt` behind and
    # the next run reported them as the whole document (measured 2026-11-10:
    # 4 of 38 pages "cached" after an interrupted bulk ingest).
    if done and not force and len(done) == pdf_pages(pdf):
        return len(done), "cached"
    for f in done:
        os.remove(f)

    # A context left by an earlier run would describe software that did not
    # make the pages about to be written; remove it before they are.
    for name in (_run_context.RUN_CONTEXT_FILENAME, VISION_LOG):
        stale = os.path.join(cache, name)
        if os.path.exists(stale):
            os.remove(stale)
    with tempfile.TemporaryDirectory() as tmp:
        stem = os.path.join(tmp, "pg")
        r = subprocess.run(["pdftoppm", "-r", str(dpi), "-png", pdf, stem],
                           capture_output=True, text=True)
        pngs = sorted(glob.glob(stem + "*.png"))
        if not pngs:
            # The usual cause is a missing CMap pack, and the message goes
            # to stderr while the exit code stays 0 — so report it rather
            # than returning a silent zero.
            raise RuntimeError(
                f"pdftoppm produced no images: {(r.stderr or '').strip()[:200] or 'no output'}")
        # Detected per page when hints are given: a bilingual report is
        # often French on the left-hand pages and English on the right, or
        # one language per half, and page 1 alone would pick one for all.
        first = lang or detect_lang(pngs[0], hints)
        have_langs = langs_present()
        used: list[str] = []
        pages_meta: list[dict] = []
        vision_log: list[dict] = []
        for i, png in enumerate(pngs, 1):
            use = lang or (first if i == 1 or not hints else detect_lang(png, hints))
            if lang:
                try:
                    txt = subprocess.run(["tesseract", png, "stdout", "-l", use], capture_output=True,
                                         text=True, env=_tesseract_env(), timeout=PAGE_TIMEOUT).stdout
                except subprocess.TimeoutExpired:
                    print(f"  {os.path.basename(png)}: Tesseract ran past {PAGE_TIMEOUT}s; page left empty",
                          file=sys.stderr)
                    txt = ""
            else:
                txt, use = read_page_with_latin(png, use, have_langs)
                txt = rescue_digits(pdf, i, png, txt, use, dpi)
                if vision_ask is not None:
                    txt, changed = vision_digits(png, txt, use, _tsv_words(png, use, SECOND_READ_TIMEOUT), vision_ask)
                    vision_log.extend({"page": i, **c} for c in changed)
            open(os.path.join(cache, f"page-{i:03d}.txt"), "w",
                 encoding="utf-8").write(txt)
            for p in use.split("+"):
                if p not in used:
                    used.append(p)
            pages_meta.append({"page": i, "lang": use, "direction": direction_of(use)})
        # Per-page language and direction, beside the text, so a reader of
        # the pages need not assume left to right.
        import json as _json
        with open(os.path.join(cache, "languages.json"), "w", encoding="utf-8") as fh:
            _json.dump({"hints": hints or [], "forced": lang, "pages": pages_meta}, fh,
                       ensure_ascii=False, indent=1)
        if vision_ask is not None:
            with open(os.path.join(cache, VISION_LOG), "w", encoding="utf-8") as fh:
                _json.dump({"confidence_below": VISION_CONFIDENCE, "model": "not-disclosed",
                            "changes": vision_log}, fh, ensure_ascii=False, indent=1)
        use = "+".join(used)
        # Which software made these pages (bean `turh`). Written only for a
        # run that OCR'd: a cache hit was made by whatever ran then, and that
        # run's record is the one already beside it. Detection read the page
        # with `osd`, so it is a model this run used as well.
        models = use.split("+") + ([] if lang else ["osd"])
        write_ocr_run_context(pdf, root, cache, models, vision=vision_ask is not None)
        return len(pngs), use


# Below this mean word confidence a page is read again with a second script.
LOW_CONFIDENCE = 70.0
# A second read is kept only when it is this many points more confident.
MIN_GAIN = 10.0
# The scripts a page may mix in, one pack each, tried in this order.
SECOND_SCRIPTS = ["eng", "ara", "rus", "chi_sim", "fas"]
# A second-script read is an attempt to do better; it gets less time than the first.
SECOND_READ_TIMEOUT = 180


# One page's read may not run longer than this. Measured 2026-11-11 on the
# IRIS re-derive: four ingests side by side, each Tesseract left to start one
# OpenMP thread per core, read single A4 pages for over 30 minutes each (a
# normal read takes seconds). So Tesseract runs single-threaded unless the
# caller set OMP_THREAD_LIMIT, and a read past the limit is given up: a second-
# script retry is skipped, a first read leaves the page empty and says so.
PAGE_TIMEOUT = 600


def _tesseract_env() -> dict:
    env = dict(os.environ)
    env.setdefault("OMP_THREAD_LIMIT", "1")
    return env


def _ocr_with_confidence(png: str, lang: str, timeout: int = PAGE_TIMEOUT) -> tuple[str, float]:
    """Tesseract's text for `png` read as `lang`, and its mean word confidence (0-100).

    ("", -1.0) when the read ran past `timeout` seconds.
    """
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "o")
        try:
            subprocess.run(["tesseract", png, base, "-l", lang, "txt", "tsv"], capture_output=True, text=True,
                           env=_tesseract_env(), timeout=timeout)
        except subprocess.TimeoutExpired:
            print(f"  {os.path.basename(png)}: Tesseract ({lang}) ran past {timeout}s; given up", file=sys.stderr)
            return "", -1.0
        try:
            txt = open(base + ".txt", encoding="utf-8").read()
        except OSError:
            return "", 0.0
        confs = []
        try:
            for row in open(base + ".tsv", encoding="utf-8").read().splitlines()[1:]:
                cols = row.split("\t")
                if len(cols) >= 12 and cols[11].strip():
                    try:
                        c = float(cols[10])
                    except ValueError:
                        continue
                    if c >= 0:
                        confs.append(c)
        except OSError:
            pass
    return txt, (sum(confs) / len(confs) if confs else 0.0)


def second_script_candidates(lang: str, have: set[str]) -> list[str]:
    """`lang` plus one more installed pack of ANOTHER script, for each such pack. Pure."""
    packs = lang.split("+")
    scripts = {TESS_SCRIPT.get(p) for p in packs}
    out = []
    for extra in SECOND_SCRIPTS:
        if extra in have and extra not in packs and TESS_SCRIPT.get(extra) not in scripts:
            out.append(f"{lang}+{extra}")
    return out


# A Latin word from the `+eng` read replaces the primary read's word under it
# only at this confidence or above. Measured on 10665-94830-per page 28: "HIV"
# and "WHO" read at 75-95, the junk the English pack makes of Persian words
# ("chy", "Shee", "leg!") at 42-72.
LATIN_RESCUE_CONFIDENCE = 80.0
RE_LATIN_WORD = re.compile(r"[A-Za-z]")
# A word read alone (`_read_word_as_acronym`) is kept only as a capitalised
# acronym of 2-6 letters ("HPV", "VIA", "LEEP", "CIN2+"), at this confidence.
RE_ACRONYM = re.compile(r"^[A-Z][A-Z0-9]{1,5}\+?$")
ACRONYM_CONFIDENCE = 75.0
# At most this many words of one page are read alone (each is a Tesseract run).
MAX_WORD_READS = 80
# Arabic-Indic and Persian digit runs: what a Latin word read as Arabic script
# becomes. A run may mix in Western digits: 10665-94830-per page 16 prints
# "VIA" and "HPV" and the OCR reads "۷1۸" and "11۳۷", which a run of eastern
# digits alone never matched.
RE_EASTERN_DIGITS = re.compile(
    r"(?=[0-9\u0660-\u0669\u06f0-\u06f9]*[\u0660-\u0669\u06f0-\u06f9])[0-9\u0660-\u0669\u06f0-\u06f9]{2,}")


def _tsv_words(png: str, lang: str, timeout: int) -> list[dict]:
    """Tesseract's words for `png` as `lang`: text, confidence, box, line key. [] on a timeout."""
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "o")
        try:
            subprocess.run(["tesseract", png, base, "-l", lang, "tsv"], capture_output=True, text=True,
                           env=_tesseract_env(), timeout=timeout)
            rows = open(base + ".tsv", encoding="utf-8").read().splitlines()[1:]
        except (subprocess.TimeoutExpired, OSError):
            return []
    words = []
    for row in rows:
        c = row.split("\t")
        if len(c) < 12 or not c[11].strip():
            continue
        try:
            words.append({"text": c[11].strip(), "conf": float(c[10]),
                          "box": tuple(int(x) for x in c[6:10]), "line": tuple(int(x) for x in c[2:5])})
        except ValueError:
            continue
    return words


def _overlap(a: tuple, b: tuple) -> float:
    """Share of box `a` (left, top, width, height) that box `b` covers. Pure."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    w = min(ax + aw, bx + bw) - max(ax, bx)
    h = min(ay + ah, by + bh) - max(ay, by)
    return (w * h) / (aw * ah) if w > 0 and h > 0 and aw * ah else 0.0


def latin_rescues(primary: list[dict], mixed: list[dict]) -> list[tuple[str, str]]:
    """(primary word, Latin word) pairs where the `+eng` read is sure of a Latin word. Pure.

    10665-94830-per was read as Persian only, so every Latin acronym came out
    as Persian digits ("HPV" as "۲۱۳۷", "VIA" as "۷۱۸"). Reading the page as
    `fas+eng` gets the acronyms right but turns some Persian words into English
    junk, so neither read is kept whole: each confident Latin word of the mixed
    read replaces the primary word whose box it covers.

    Only a primary word with no letters is replaced: the fault is Latin read
    as digits, and a word of the page's own script stays as it was read.
    """
    out = []
    for m in mixed:
        word = m["text"].strip("\u200e\u200f")
        if m["conf"] < LATIN_RESCUE_CONFIDENCE or len(word) < 2 or not RE_LATIN_WORD.search(word):
            continue
        under = max(primary, key=lambda p: _overlap(m["box"], p["box"]), default=None)
        if under and _overlap(m["box"], under["box"]) >= 0.5 and not any(ch.isalpha() for ch in under["text"]):
            out.append((under["text"], word))
    return out


def rescue_latin(png: str, txt: str, lang: str, have: set[str]) -> str:
    """`txt` (read as `lang`) with the Latin words a `lang+eng` read is sure of put back.

    Only for a read with no Latin pack: a page read as `fra` or `fas+eng` has
    its Latin words already.
    """
    packs = lang.split("+")
    if "eng" not in have or any(TESS_SCRIPT.get(p) == "Latin" for p in packs):
        return txt
    if not RE_EASTERN_DIGITS.search(txt):
        return txt  # nothing that could be a misread Latin word: no second read
    primary = _tsv_words(png, lang, SECOND_READ_TIMEOUT)
    mixed = _tsv_words(png, f"{lang}+eng", SECOND_READ_TIMEOUT)
    pairs = latin_rescues(primary, mixed)
    # What the mixed read left as digits, or read unsure: each other
    # eastern-digit word is read alone as English, and kept only if it reads
    # as an acronym. A text rescued n times above skips its first n words.
    rescued = Counter(o for o, _ in pairs)
    left = []
    for p in primary:
        t = p["text"]
        if not RE_EASTERN_DIGITS.search(t) or any(ch.isalpha() for ch in t):
            continue
        if rescued[t] > 0:
            rescued[t] -= 1
            continue
        left.append(p)
    pairs += [(p["text"], w) for p in left[:MAX_WORD_READS] if (w := _read_word_as_acronym(png, p["box"]))]
    # A lone digit is never taken for an acronym: replace_word changes the
    # first "۷" on the page, and 10665-94830-per page 35 lost "Recommendation
    # 7" ("توصیه ۷") to "توصیه HPV" that way.
    pairs = [(old, new) for old, new in pairs if len(RE_DIGIT.findall(old)) >= 2]
    for old, new in pairs:
        txt = replace_word(txt, old, new)
    return txt


RE_DIGIT = re.compile(r"[0-9\u0660-\u0669\u06f0-\u06f9]")
RE_NUMBER_WORD = re.compile(r"^[\W\d_\u0660-\u0669\u06f0-\u06f9]+$")


def layer_digits(chars: list[tuple[float, float, float, float, str]], box: tuple, scale: float) -> str:
    """The digits the text layer prints inside `box`, left to right. Pure.

    `chars` are the page's text-layer characters as (x0, y0, x1, y1, char) in
    PDF points; `box` is an OCR word's (left, top, width, height) in pixels
    rendered at `scale` pixels per point. A character counts when its centre
    falls in the box.
    """
    x, y, w, h = box
    inside = [c for c in chars if RE_DIGIT.match(c[4])
              and x <= (c[0] + c[2]) / 2 * scale <= x + w and y <= (c[1] + c[3]) / 2 * scale <= y + h]
    return "".join(c[4] for c in sorted(inside, key=lambda c: c[0]))


def rescue_digits(pdf: str, page: int, png: str, txt: str, lang: str, dpi: int) -> str:
    """`txt` with each number word replaced by the digits the PDF's text layer prints there.

    10665-192500 (WHA42/10, Arabic, 1989) sets each letter apart in its text
    layer, so the page is OCR'd; but Tesseract reads its typewriter digits
    badly ("8٠١" for 80, "٠٠*؟" for 2000). The text layer has the digits right,
    in visual order ("٠٩٩١" read right to left is 1990), so a number word of the
    OCR takes the layer's digits in its box, sorted left to right. Only words of
    digits and punctuation are touched, and only where the layer has digits.
    """
    if not RE_DIGIT.search(txt):
        return txt
    try:
        import pymupdf
        doc = pymupdf.open(pdf)
        raw = doc[page - 1].get_text("rawdict")
    except Exception:
        return txt
    chars = [(*c["bbox"], c["c"]) for b in raw.get("blocks", []) for l in b.get("lines", [])
             for sp in l.get("spans", []) for c in sp.get("chars", [])]
    if not any(RE_DIGIT.match(c[4]) for c in chars):
        return txt
    scale = dpi / 72.0
    for wd in _tsv_words(png, lang, SECOND_READ_TIMEOUT):
        t = wd["text"]
        if not RE_DIGIT.search(t) or not RE_NUMBER_WORD.match(t):
            continue
        lead = re.match(r"^\D*", t).group(0)
        tail = re.search(r"\D*$", t).group(0)
        core = t[len(lead):len(t) - len(tail)]
        if len(core) < 2 or not core.isdigit():
            # "1-3", "1/5": a separator the layer's digits would lose. One
            # digit is a paragraph or list number ("١-"), and its box often
            # takes in the layer's neighbouring digits.
            continue
        digits = layer_digits(chars, wd["box"], scale)
        # Fewer digits than the OCR read means the box caught only part of
        # the number: leave it rather than make it shorter.
        if digits and digits != core and len(digits) >= len(core):
            txt = replace_word(txt, t, f"{lead}{digits}{tail}")
    return txt


def replace_word(txt: str, old: str, new: str) -> str:
    """`txt` with the first WHOLE occurrence of `old` replaced: "۷۱۸" is not the
    start of "۷۱۸۵". Pure."""
    edge = r"[\u0660-\u0669\u06f0-\u06f9\w]"
    return re.sub(f"(?<!{edge}){re.escape(old)}(?!{edge})", lambda _m: new, txt, count=1)


# ---------------------------------------------------------------------------
# Optional: a vision model re-reads the number words Tesseract is unsure of.
#
# Off unless `--vision-digits` is passed or IRIS_VISION_DIGITS=1 is set, and
# then only on Arabic-script pages. 10665-94830-per (Persian, 2014) has no text
# layer worth reading, and Tesseract's `fas` misreads single digits there with
# no second source to correct them: page 65's heading "Annex 6" comes out as
# "1.", and page 30's "۳ سال" (3 years) as another digit. Owner, 2026-11-15:
# "B as a ack optional tool in case bad results". The model is named by
# IRIS_VISION_MODEL; nothing here names one.
#
# A reading is kept only when it is sure: two crops of the word (tight, and
# with its line around it, outlined in blue because the headings are red) must
# give the same digits, as many digits as Tesseract read, and the model may
# answer UNSURE. Each change is logged in
# `vision-digits.json` beside the pages, so a reviewer can check every one.
VISION_ENV = "IRIS_VISION_DIGITS"
VISION_MODEL_ENV = "IRIS_VISION_MODEL"
VISION_LOG = "vision-digits.json"
# A number word at or above this Tesseract confidence is left alone. On
# 10665-94830-per the misread "1." of page 65 scores 38 and page 15's correct
# "۲" scores 90.
VISION_CONFIDENCE = 80.0
VISION_MAX_WORDS = 40
VISION_LANGS = {"ara", "fas", "urd", "pus", "uig", "snd"}

DIGIT_FAMILIES = ("0123456789", "٠١٢٣٤٥٦٧٨٩",
                  "۰۱۲۳۴۵۶۷۸۹")
TO_WESTERN = {ord(f[i]): str(i) for f in DIGIT_FAMILIES for i in range(10)}
RE_VISION_ANSWER = re.compile(r"^\s*([0-9]+)\s+(WESTERN|EASTERN)\s*$")


def vision_enabled(flag: bool = False) -> bool:
    return flag or os.environ.get(VISION_ENV, "") not in ("", "0", "false", "no")


def western(digits: str) -> str:
    """`digits` in Western digits, whatever family they were written in. Pure."""
    return digits.translate(TO_WESTERN)


def eastern_family(lang: str) -> str:
    """The Arabic-script digit family a page in `lang` prints. Pure.

    Persian, Urdu, Pashto and the like use the extended forms (۴ ۵ ۶); Arabic
    uses ٤ ٥ ٦.
    """
    packs = set(lang.split("+"))
    return DIGIT_FAMILIES[1] if "ara" in packs and not packs & {"fas", "urd", "pus", "uig", "snd"} else DIGIT_FAMILIES[2]


def vision_prompt(lang: str) -> str:
    language = "Arabic" if eastern_family(lang) == DIGIT_FAMILIES[1] else "Persian or another Arabic-script language"
    return (
        f"This image is cut from a printed page in {language}. It shows one number; where a blue box is drawn, "
        "the number is the word inside the box. Reply with exactly one line: the digits it shows, written as "
        "Western digits 0-9 with the most significant digit first, then a space, then WESTERN if the page "
        "prints them as 0-9 shapes or EASTERN if it prints Arabic-script digit shapes. Leave out any "
        "punctuation around the number. If any digit is unclear, or the word is letters rather than a number, "
        "reply UNSURE.")


def parse_vision_answer(answer: str, lang: str) -> str | None:
    """The digits a model's answer names, in the family it names; None unless sure. Pure."""
    m = RE_VISION_ANSWER.match(answer or "")
    if not m:
        return None
    fam = DIGIT_FAMILIES[0] if m.group(2) == "WESTERN" else eastern_family(lang)
    return "".join(fam[int(d)] for d in m.group(1))


def count_word(txt: str, word: str) -> int:
    """How many WHOLE occurrences of `word` `txt` holds, as `replace_word` finds them. Pure."""
    edge = r"[\u0660-\u0669\u06f0-\u06f9\w]"
    return len(re.findall(f"(?<!{edge}){re.escape(word)}(?!{edge})", txt))


def nth_word_span(txt: str, word: str, n: int) -> tuple[int, int] | None:
    """The span of the `n`th (from 0) WHOLE occurrence of `word` in `txt`, as `replace_word` finds them. Pure."""
    edge = r"[٠-٩۰-۹\w]"
    spans = [m.span() for m in re.finditer(f"(?<!{edge}){re.escape(word)}(?!{edge})", txt)]
    return spans[n] if n < len(spans) else None


def crop_word(png: str, box: tuple, context: bool) -> bytes:
    """PNG bytes of the word in `box` (left, top, width, height): tight, or with its line and a red outline."""
    import io

    from PIL import Image, ImageDraw
    x, y, w, h = box
    with Image.open(png) as im:
        im = im.convert("RGB")
        px, py = (max(3 * h, 40), h) if context else (max(h // 2, 4), max(h // 2, 4))
        area = (max(x - px, 0), max(y - py, 0), min(x + w + px, im.width), min(y + h + py, im.height))
        if context:
            ImageDraw.Draw(im).rectangle((x - 2, y - 2, x + w + 2, y + h + 2), outline=(0, 90, 255), width=2)
        out = im.crop(area)
        # Small crops read better enlarged; the model sees no more detail, but
        # thin strokes are not lost to its own downscaling.
        scale = max(1, 96 // max(out.height, 1))
        if scale > 1:
            out = out.resize((out.width * scale, out.height * scale), Image.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, format="PNG")
        return buf.getvalue()


def vision_digits(png: str, txt: str, lang: str, words: list[dict], ask) -> tuple[str, list[dict]]:
    """`txt` with unsure number words re-read by `ask`, and the log of what changed.

    `words` are Tesseract's words for the page (`_tsv_words`), in reading
    order; `ask(images, prompt)` returns the model's answer for a list of PNG
    byte strings. A word is re-read when it is digits with punctuation around
    them, below VISION_CONFIDENCE. It is replaced only when both crops give
    the same digits, as many as Tesseract read, and different from them; and
    only when the page text holds that word as often as Tesseract's words do,
    so the `n`th word in reading order is the `n`th in the text.
    """
    if not set(lang.split("+")) & VISION_LANGS or not RE_DIGIT.search(txt):
        return txt, []
    seen: Counter = Counter()
    total = Counter(w["text"] for w in words)
    edits: list[tuple[int, int, str, dict]] = []
    asked = 0
    for wd in words:
        t = wd["text"]
        n = seen[t]
        seen[t] += 1
        if not RE_DIGIT.search(t) or not RE_NUMBER_WORD.match(t) or wd["conf"] >= VISION_CONFIDENCE:
            continue
        lead = re.match(r"^\D*", t).group(0)
        tail = re.search(r"\D*$", t).group(0)
        core = t[len(lead):len(t) - len(tail)]
        if not core.isdigit():
            continue
        span = nth_word_span(txt, t, n)
        if span is None or count_word(txt, t) != total[t]:
            continue
        if asked >= VISION_MAX_WORDS:
            break
        asked += 1
        prompt = vision_prompt(lang)
        reads = [parse_vision_answer(ask([crop_word(png, wd["box"], c)], prompt), lang) for c in (False, True)]
        new = reads[0]
        if new is None or reads[1] != new or len(new) != len(core) or new == core:
            continue
        edits.append((*span, f"{lead}{new}{tail}",
                      {"box": list(wd["box"]), "confidence": wd["conf"], "ocr": t, "read": f"{lead}{new}{tail}"}))
    for start, end, new, _ in sorted(edits, key=lambda e: -e[0]):
        txt = txt[:start] + new + txt[end:]
    return txt, [e[3] for e in edits]


def anthropic_ask(model: str):
    """An `ask(images, prompt)` that sends the images to `model` through the Anthropic API.

    Credentials come from the environment as the SDK reads them
    (ANTHROPIC_API_KEY). An error or a refusal is an UNSURE answer: the word
    keeps Tesseract's reading rather than the run failing.
    """
    import base64

    import anthropic
    client = anthropic.Anthropic()

    def ask(images: list[bytes], prompt: str) -> str:
        content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                 "data": base64.standard_b64encode(b).decode("ascii")}}
                   for b in images]
        content.append({"type": "text", "text": prompt})
        try:
            msg = client.messages.create(model=model, max_tokens=2048,
                                         messages=[{"role": "user", "content": content}])
        except anthropic.APIError as e:
            print(f"  vision-digits: {type(e).__name__}; word left as read", file=sys.stderr)
            return "UNSURE"
        if msg.stop_reason == "refusal":
            return "UNSURE"
        return "".join(b.text for b in msg.content if b.type == "text").strip()
    return ask


def _read_word_as_acronym(png: str, box: tuple) -> str | None:
    """The word in `box` read alone as English, if it is a sure acronym. None otherwise.

    10665-94830-per page 35: the page-wide `fas+eng` read still gave "۲۱۳۷" (57)
    for one HPV and "VIA" at 55-67 for others. Read alone, cropped, the word has
    no Persian context to pull it to digits. Only a capitalised acronym
    (RE_ACRONYM) read at ACRONYM_CONFIDENCE or above is taken, so a number
    written in Persian digits is never turned into Latin junk.
    """
    try:
        from PIL import Image
    except ImportError:
        return None
    x, y, w, h = box
    pad = max(4, h // 3)
    with tempfile.TemporaryDirectory() as tmp:
        crop = os.path.join(tmp, "w.png")
        with Image.open(png) as im:
            im.crop((max(0, x - pad), max(0, y - pad), x + w + pad, y + h + pad)).save(crop)
        words = _tsv_words_psm(crop, "eng", "8")
    if len(words) != 1:
        return None
    t = words[0]["text"].strip("\u200e\u200f()[]{}.,;:")
    return t if words[0]["conf"] >= ACRONYM_CONFIDENCE and RE_ACRONYM.match(t) else None


def _tsv_words_psm(png: str, lang: str, psm: str) -> list[dict]:
    """`_tsv_words` with a page segmentation mode (8: one word)."""
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "o")
        try:
            subprocess.run(["tesseract", png, base, "-l", lang, "--psm", psm, "tsv"], capture_output=True,
                           text=True, env=_tesseract_env(), timeout=60)
            rows = open(base + ".tsv", encoding="utf-8").read().splitlines()[1:]
        except (subprocess.TimeoutExpired, OSError):
            return []
    out = []
    for row in rows:
        c = row.split("\t")
        if len(c) >= 12 and c[11].strip():
            try:
                out.append({"text": c[11].strip(), "conf": float(c[10])})
            except ValueError:
                pass
    return out


def read_page(png: str, lang: str, have: set[str]) -> tuple[str, str]:
    """One page's text, read again with a second script when the first read is unsure.

    Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A). Tesseract reads a page in
    the script its detector names, and a page often holds two: the Arabic
    abstract of a French EMHJ article (10665/117378) read as `fra` came out as
    "er ie obus AU ball Aélroll"; the Latin URLs of an Arabic toolkit's
    references (10665/75211, page 221) read as `ara` came out as Arabic
    letters, mean word confidence 54. Read as `ara+eng` the same page gives
    "http://www.health.gov.au/internet/main/..." at confidence 86. So a page
    under LOW_CONFIDENCE is read again with each other installed script added,
    and the most confident read is kept when it gains MIN_GAIN points. A page
    the first read is sure of costs nothing more. Returns (text, lang used).
    """
    txt, conf = _ocr_with_confidence(png, lang)
    if conf >= LOW_CONFIDENCE or conf < 0:
        return txt, lang  # sure enough, or the page outran the time limit: no retry
    # Each read must gain MIN_GAIN on the best so far, the first read included,
    # so an earlier script in SECOND_SCRIPTS wins a near tie. 10665-192500
    # page 1, an Arabic page under an English/French letterhead: `ara+eng`
    # read 53.8, `ara+rus` 54.4, and the near-even Cyrillic read turned
    # "WORLD HEALTH ORGANIZATION" into "WORLD НЕАТТН ORGANIZATION".
    best = (txt, conf, lang)
    for cand in second_script_candidates(lang, have):
        t, c = _ocr_with_confidence(png, cand, timeout=SECOND_READ_TIMEOUT)
        if c - best[1] >= MIN_GAIN and script_words_sure(
                _tsv_words(png, cand, SECOND_READ_TIMEOUT), cand.split("+")[-1]):
            best = (t, c, cand)
    return best[0], best[2]


# The words a second script adds must themselves be read this surely (mean
# word confidence) for its read to be kept. Measured 2026-11-11 on
# 10665-192500 page 1 at 200 dpi: `ara+rus` read 66.3 overall against 58.7
# for `ara+eng`, but its Cyrillic words, the English/French letterhead read
# as "WORLD НЕАТТН ORGANIZATION", averaged 35.6. Real Russian reads at 80+.
SCRIPT_WORD_CONFIDENCE = 60.0
SCRIPT_CHARS = {
    "Latin": r"[A-Za-z]", "Cyrillic": r"[\u0400-\u04ff]",
    "Arabic": r"[\u0600-\u06ff\u0750-\u077f]", "Han": r"[\u4e00-\u9fff]",
}


def script_words_sure(words: list[dict], pack: str) -> bool:
    """True when the words in `pack`'s script are read at SCRIPT_WORD_CONFIDENCE
    on average, or there are none to judge. Pure."""
    rx = SCRIPT_CHARS.get(TESS_SCRIPT.get(pack, ""))
    if not rx:
        return True
    confs = [w["conf"] for w in words if re.search(rx, w["text"])]
    return not confs or sum(confs) / len(confs) >= SCRIPT_WORD_CONFIDENCE


def read_page_with_latin(png: str, lang: str, have: set[str]) -> tuple[str, str]:
    """`read_page`, then the Latin words of a non-Latin read put back (`rescue_latin`)."""
    txt, use = read_page(png, lang, have)
    return rescue_latin(png, txt, use, have), use


def pdf_pages(pdf: str) -> int | None:
    """The PDF's page count from `pdfinfo` (poppler, already required), or None."""
    try:
        out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return None
    m = re.search(r"^Pages:\s+(\d+)", out, re.M)
    return int(m.group(1)) if m else None


def read_cache(root: str, pdf: str) -> list[str]:
    """The cached OCR text for one PDF, one entry per page, or [] if none.

    Takes the PDF as well as the root, because the cache is keyed on the
    DOCUMENT. It previously took only a directory and read `<dir>/ocr/`, which
    is what made the cache un-addressable once two documents shared a root.
    """
    files = sorted(glob.glob(os.path.join(ocr_cache_dir(root, pdf), "page-*.txt")))
    return [open(f, encoding="utf-8", errors="replace").read() for f in files]


def main() -> int:
    ap = argparse.ArgumentParser(description="OCR a PDF that has no usable text layer")
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("-o", "--outdir", metavar="ROOT",
                    help="root that <doc-id>/ocr/ hangs off, the same ROOT "
                         "pdf-structure.py -o takes (default: beside the PDF)")
    ap.add_argument("--lang", help="tesseract language, e.g. jpn+eng (default: detect)")
    ap.add_argument("--lang-hint", default="",
                    help="the document's languages as ISO 639 codes, e.g. fr,en "
                         "(from dc.language.iso); narrows detection, refuses missing packs")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--force", action="store_true", help="re-OCR even if cached")
    ap.add_argument("--check", action="store_true", help="report tool availability and exit")
    ap.add_argument("--vision-digits", action="store_true",
                    help=f"re-read unsure number words on Arabic-script pages with a vision model "
                         f"(also {VISION_ENV}=1; the model is {VISION_MODEL_ENV}; off by default)")
    args = ap.parse_args()

    tools = tools_present()
    if args.check:
        for t, p in tools.items():
            print(f"  {t:<10} {p or 'MISSING'}")
        have = sorted(langs_present())
        print(f"  languages  {', '.join(have) if have else 'none'}")
        return 0 if all(tools.values()) else 1

    missing = [t for t, p in tools.items() if not p]
    if missing:
        # Get it rather than route around it (skill `finding-software`): the
        # command installs exactly what this script declares it needs.
        sys.exit(f"pdf-ocr: needs {', '.join(missing)} — "
                 "bun run cat software:ensure --for scripts/pdf-ocr.py")

    vision_ask = None
    if vision_enabled(args.vision_digits):
        model = os.environ.get(VISION_MODEL_ENV, "").strip()
        if not model:
            sys.exit(f"pdf-ocr: --vision-digits needs {VISION_MODEL_ENV} set to the model to ask")
        import importlib.util
        lacking = [m for m in ("anthropic", "PIL") if importlib.util.find_spec(m) is None]
        if lacking:
            sys.exit(f"pdf-ocr: --vision-digits needs the {', '.join(lacking)} Python package(s) "
                     "(pip install -r python/requirements-extended.txt)")
        vision_ask = anthropic_ask(model)

    for pdf in args.pdfs:
        root = args.outdir or os.path.dirname(os.path.abspath(pdf))
        try:
            hints = [h for h in args.lang_hint.split(",") if h.strip()]
            n, lang = ocr_pdf(pdf, root, args.lang, args.dpi, args.force, hints, vision_ask)
            # Name the directory, because it is no longer the one the caller
            # passed and a reader should not have to derive it.
            rel = os.path.join(derive_doc_id(pdf), OCR_DIRNAME)
            print(f"  {os.path.basename(pdf)}: {n} pages ({lang}) -> {rel}/")
        except Exception as e:
            print(f"  {os.path.basename(pdf)}: FAILED — {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
