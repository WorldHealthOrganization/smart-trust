#!/usr/bin/env python3
"""formula-benchmark.py — how much of a paper's mathematics its ingested text holds.

An arXiv entry with its LaTeX source fetched (`arxiv-source.py`) has the
author's own formulas as an answer key, the way a PDF outline is the answer key
for `toc-benchmark.py`. This scores each ingested section's text against the
formulas of the `\\section` it pairs with.

Pairing uses the overlay's title gate (`latex-math-overlay.py`): exact
normalised title, else a close match at `TITLE_RATIO`. Never by position.

## Matching — the two-stage check of Horn & Keuper (arXiv:2512.09874)

Each formula is canonicalised, then looked for in the canonicalised section:

1. **exact** — the canonical formula is a substring of the canonical text;
2. **fuzzy** — otherwise, the best approximate-substring Levenshtein distance
   (Sellers' algorithm: free start and end in the text), divided by the
   formula's length. Below `--threshold` it counts as found.

The paper does not publish its threshold; 0.2 is ours and is a flag.

## Stage 3 — the judge, read as data (cat-harness-tools#130)

The paper's third stage, an LLM judge of semantic equivalence, is the one it
validates against people (r = 0.78 with human ratings, against 0.34 for
character-level CDM). It needs a model, so this script never runs one: CI
stays model-free. The verdicts are DATA, the way image narratives are read
from `image-verdicts.json`:

- `<library>/formula-verdicts.json` (`formula-verdicts/v1`, or `--verdicts`)
  holds one verdict per (entry, section, formula): `equivalent`,
  `not-equivalent` or `undetermined`, with `judged_by` naming the model.
  Each records `text_sha256`, the sha256 of the canonical section text the
  judge was shown. When the text has changed since, the verdict is STALE: it
  is counted as stale and never used.
- `--judge-queue FILE` writes the pairs that still need a verdict (stage 2
  `fuzzy` or `missed`, no current verdict), each with the formula, the
  section text and its `text_sha256`, so an agent can judge them offline and
  append to the verdicts file.
- The judge figures are reported beside the string figures, never in place
  of them. `recall_judged` is over judged formulas only, and `coverage` says
  how many that is. `recall_combined` counts a formula found when stage 1 or 2
  found it or the judge said `equivalent`. An unjudged miss stays a miss, so
  this is still a lower bound.
- **Calibration first.** The paper's r = 0.78 is on its own synthetic set,
  not on a library. `--held-set FILE` (`formula-judge-held-set/v1`: pairs with
  a known `truth` and the judge's `verdict`) scores the judge against ground
  truth. Without it, every judge figure carries `calibrated: false`.

Canonical form: a small table maps common commands to the characters a PDF
text layer prints (`\\phi` → φ, `\\to` → →, `\\mathbb{R}` → R), then
backslashes, `^ _ { }`, `$` and whitespace go. So a text layer that reads
`φ: R3 → S2` is credited for `\\phi:\\mathbb{R}^3\\to S^2`. A command not in
the table survives as its bare name, which a text layer will rarely match:
the score is a lower bound on what the text holds, not an upper one.

## Third state

A section the overlay already replaced (`text_source: latex`) is the LaTeX
itself, so scoring it against the LaTeX measures nothing. It is reported as
`overlaid` and left out of the averages, as are sections whose title matches no
`\\section` and sections with no formulas. An entry with no source is
`skipped` with the reason, never `recall: 0`.

Metrics per section and per entry (micro over formulas):
  recall_exact   share of formulas found by stage 1
  recall         share found by stage 1 or 2
  mean_distance  mean normalised distance over all formulas (0 for exact)
  judge          present only when a verdicts file is read:
                 judged, stale, coverage, recall_judged, recall_combined

Output is a report, not KG content: it is written to
`build/benchmarks/formula-benchmark.json` unless `--json` says otherwise, and a
path inside a declared graph directory is refused (`_benchmark_guard.py`).

Usage:
  python3 scripts/formula-benchmark.py library/arxiv-0705.1468v1
  python3 scripts/formula-benchmark.py library/arxiv-* --judge-queue build/benchmarks/judge-queue.json
  python3 scripts/formula-benchmark.py library/arxiv-* --verdicts library/formula-verdicts.json --held-set held.json
  python3 scripts/formula-benchmark.py library/arxiv-* --json build/benchmarks/formula.json
  python3 scripts/formula-benchmark.py ENTRY --source e-print.tgz --threshold 0.15

Exit: 0 every entry scored or skipped with a reason, 1 an entry failed.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import importlib.util
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _benchmark_guard import assert_not_declared_graph_path  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "latex_math_overlay", os.path.join(os.path.dirname(os.path.abspath(__file__)), "latex-math-overlay.py"))
ovl = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
sys.modules["latex_math_overlay"] = ovl  # its dataclasses look themselves up here
_spec.loader.exec_module(ovl)

SCHEMA = "formula-benchmark/v1"
VERDICTS_SCHEMA = "formula-verdicts/v1"
QUEUE_SCHEMA = "formula-judge-queue/v1"
HELD_SET_SCHEMA = "formula-judge-held-set/v1"
VERDICTS_FILE = "formula-verdicts.json"
VERDICTS = ("equivalent", "not-equivalent", "undetermined")
THRESHOLD = 0.2
MIN_LEN = 2  # a canonical formula shorter than this ("x") is found anywhere

_FORMULA = re.compile(
    r"\$\$(.+?)\$\$|\\\[(.+?)\\\]|\\\((.+?)\\\)|(?<![\\$])\$(?!\$)(.+?)(?<!\\)\$"
    r"|\\begin\{(equation|align|gather|multline|eqnarray|displaymath)\*?\}(.*?)\\end\{\5\*?\}",
    re.S,
)

_GREEK = ("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau "
          "upsilon phi chi psi omega").split()
_GLYPH = dict(zip(_GREEK, "αβγδεζηθικλμνξπρστυφχψω"))
_GLYPH.update(zip((g.capitalize() for g in _GREEK), "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΠΡΣΤΥΦΧΨΩ"))
_GLYPH.update({
    "varepsilon": "ε", "varphi": "φ", "vartheta": "θ", "varrho": "ρ", "varsigma": "ς", "ell": "ℓ",
    "to": "→", "rightarrow": "→", "mapsto": "↦", "leftarrow": "←", "Rightarrow": "⇒", "iff": "⇔",
    "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠", "approx": "≈", "equiv": "≡",
    "sim": "∼", "simeq": "≃", "cong": "≅", "times": "×", "cdot": "·", "otimes": "⊗", "oplus": "⊕",
    "circ": "∘", "pm": "±", "mp": "∓", "infty": "∞", "partial": "∂", "nabla": "∇", "sum": "∑",
    "prod": "∏", "int": "∫", "oint": "∮", "in": "∈", "notin": "∉", "subset": "⊂", "subseteq": "⊆",
    "supset": "⊃", "cup": "∪", "cap": "∩", "emptyset": "∅", "forall": "∀", "exists": "∃",
    "langle": "⟨", "rangle": "⟩", "ldots": "...", "cdots": "···", "dots": "...", "hbar": "ℏ",
    "wedge": "∧", "vee": "∨", "neg": "¬", "setminus": "∖", "mid": "|", "prime": "′",
})
# Commands that only style their argument: the text layer prints the argument.
_STYLE = re.compile(r"\\(?:math(?:bb|bf|rm|cal|frak|sf|it|scr)|bm|boldsymbol|operatorname|text(?:rm|bf|it)?|mbox|hat|bar|tilde|widetilde|overline|vec|dot)\b\s*")
_SPACING = re.compile(r"\\(?:left|right|big|Big|bigg|Bigg)[lr]?\b|\\[,;:! ]|\\(?:quad|qquad|displaystyle|nonumber|label\{[^}]*\})")
_CMD = re.compile(r"\\([A-Za-z]+)")


def canon(s: str) -> str:
    """The canonical form both sides are compared in."""
    s = ovl._unligature(s)
    s = _SPACING.sub(" ", s)
    s = _STYLE.sub("", s)
    s = _CMD.sub(lambda m: _GLYPH.get(m.group(1), m.group(1)), s)
    s = s.replace("−", "-").replace("&", "")
    return re.sub(r"[\s\\^_{}$]+", "", s)


def formulas(tex: str) -> list[str]:
    """Every formula in a LaTeX section, in order, without its delimiters."""
    tex = ovl.strip_comments(tex)
    out = []
    for m in _FORMULA.finditer(tex):
        body = next(g for g in (m.group(1), m.group(2), m.group(3), m.group(4), m.group(6)) if g is not None)
        if body.strip():
            out.append(body.strip())
    return out


def substring_distance(needle: str, hay: str) -> int:
    """Least edit distance between `needle` and any substring of `hay` (Sellers)."""
    prev = list(range(len(needle) + 1))
    best = prev[-1]
    for ch in hay:
        cur = [0]
        for i, nc in enumerate(needle, 1):
            cur.append(min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (nc != ch)))
        best = min(best, cur[-1])
        prev = cur
        if best == 0:
            break
    return best


def score(formula: str, text_canon: str, threshold: float) -> dict:
    c = canon(formula)
    if len(c) < MIN_LEN:
        return {"formula": formula, "stage": "too-short"}
    if c in text_canon:
        return {"formula": formula, "stage": "exact", "distance": 0.0}
    d = substring_distance(c, text_canon) / len(c)
    return {"formula": formula, "stage": "fuzzy" if d <= threshold else "missed", "distance": round(d, 3)}


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def judge_summary(scored: list[dict]) -> dict | None:
    """Stage 3 over rows that carry a `judge` field; None when no verdicts were read."""
    if not any("judge" in r for r in scored):
        return None
    n = len(scored)
    judged = [r for r in scored if r.get("judge", {}).get("verdict") in ("equivalent", "not-equivalent")]
    stale = sum(r.get("judge", {}).get("state") == "stale" for r in scored)
    eq = [r for r in judged if r["judge"]["verdict"] == "equivalent"]
    found = sum(r["stage"] in ("exact", "fuzzy") or r.get("judge", {}).get("verdict") == "equivalent" for r in scored)
    return {
        "judged": len(judged),
        "stale": stale,
        "coverage": round(len(judged) / n, 3),
        "recall_judged": round(len(eq) / len(judged), 3) if judged else None,
        "recall_combined": round(found / n, 3),
    }


def summarise(rows: list[dict]) -> dict:
    scored = [r for r in rows if r["stage"] != "too-short"]
    if not scored:
        return {"formulas": 0}
    n = len(scored)
    out = {
        "formulas": n,
        "recall_exact": round(sum(r["stage"] == "exact" for r in scored) / n, 3),
        "recall": round(sum(r["stage"] in ("exact", "fuzzy") for r in scored) / n, 3),
        "mean_distance": round(sum(r["distance"] for r in scored) / n, 3),
    }
    j = judge_summary(scored)
    if j is not None:
        out["judge"] = j
    return out


def read_verdicts(path: str) -> dict:
    """{(entry slug, section id, formula): verdict row} from a formula-verdicts/v1 file."""
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    if doc.get("$schema") != VERDICTS_SCHEMA:
        raise ValueError(f"{path}: expected $schema {VERDICTS_SCHEMA!r}, got {doc.get('$schema')!r}")
    out: dict = {}
    for i, v in enumerate(doc.get("verdicts", [])):
        missing = [k for k in ("entry", "section", "formula", "text_sha256", "verdict", "judged_by") if not v.get(k)]
        if missing:
            raise ValueError(f"{path}: verdicts[{i}] lacks {', '.join(missing)}")
        if v["verdict"] not in VERDICTS:
            raise ValueError(f"{path}: verdicts[{i}] verdict {v['verdict']!r} is not one of {', '.join(VERDICTS)}")
        if not (isinstance(v["judged_by"], dict) and v["judged_by"].get("model")):
            raise ValueError(f"{path}: verdicts[{i}] judged_by must name the model that gave the verdict")
        key = (v["entry"], v["section"], v["formula"])
        if key in out:
            raise ValueError(f"{path}: verdicts[{i}] repeats ({v['entry']}, {v['section']}, a formula already judged)")
        out[key] = v
    return out


def attach_verdicts(slug: str, section: str, text_canon: str, rows: list[dict], verdicts: dict) -> None:
    """Give each row its judge verdict: current, stale (text changed) or none."""
    sha = sha256_text(text_canon)
    for r in rows:
        if r["stage"] == "too-short":
            continue
        v = verdicts.get((slug, section, r["formula"]))
        if v is None:
            r["judge"] = {"state": "none"}
        elif v["text_sha256"] != sha:
            r["judge"] = {"state": "stale"}
        else:
            r["judge"] = {"state": "current", "verdict": v["verdict"], "model": v["judged_by"]["model"]}


def score_held_set(path: str) -> dict:
    """The judge against ground truth: agreement, and precision/recall for `equivalent`."""
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    if doc.get("$schema") != HELD_SET_SCHEMA:
        raise ValueError(f"{path}: expected $schema {HELD_SET_SCHEMA!r}, got {doc.get('$schema')!r}")
    pairs = doc.get("pairs", [])
    rated = [p for p in pairs if isinstance(p.get("truth"), bool) and p.get("verdict") in ("equivalent", "not-equivalent")]
    if not rated:
        raise ValueError(f"{path}: no pair has both a boolean truth and an equivalent/not-equivalent verdict")
    tp = sum(p["truth"] and p["verdict"] == "equivalent" for p in rated)
    fp = sum(not p["truth"] and p["verdict"] == "equivalent" for p in rated)
    fn = sum(p["truth"] and p["verdict"] == "not-equivalent" for p in rated)
    agree = sum(p["truth"] == (p["verdict"] == "equivalent") for p in rated)
    return {
        "held_set": path,
        "pairs": len(pairs),
        "rated": len(rated),
        "agreement": round(agree / len(rated), 3),
        "precision": round(tp / (tp + fp), 3) if tp + fp else None,
        "recall": round(tp / (tp + fn), 3) if tp + fn else None,
        "models": sorted({p["judged_by"]["model"] for p in rated if isinstance(p.get("judged_by"), dict) and p["judged_by"].get("model")}),
    }


def bench_entry(entry: str, source: str | None, threshold: float, library: str | None = None,
                verdicts: dict | None = None, queue: list | None = None) -> dict:
    rep: dict = {"entry": entry, "status": "skipped", "reason": "", "sections": []}
    spath = os.path.join(entry, "structure.json")
    if not os.path.exists(spath):
        rep["reason"] = "no structure.json — run a PDF rung first"
        return rep
    with open(spath) as fh:
        structure = json.load(fh)
    if structure.get("granularity") == "page":
        rep["reason"] = "page granularity — no titled sections to pair a \\section with"
        return rep
    src = source or os.path.join(entry, ovl.SOURCE_DIRNAME)
    if source is None and not os.path.exists(src) and library:
        src = os.path.join(library, os.path.basename(entry), ovl.SOURCE_DIRNAME)
    if not os.path.exists(src):
        rep["reason"] = "no LaTeX source — fetch it with arxiv-source.py"
        return rep
    files = ovl.read_source(src)
    main = ovl.main_tex(files)
    if main is None:
        rep["reason"] = f"source holds {len(files)} .tex file(s), none with \\documentclass and \\begin{{document}}"
        return rep
    _, secs = ovl.tex_sections(ovl.inline_inputs(main, files))
    by_title = {ovl.norm_title(t.title): t for t in secs}

    every: list[dict] = []
    for s in structure.get("sections", []):
        row: dict = {"id": s["id"], "title": s.get("title", "")}
        rep["sections"].append(row)
        want = ovl.norm_title(s.get("title", ""))
        tex = by_title.get(want)
        if tex is None and want:
            close = difflib.get_close_matches(want, list(by_title), n=1, cutoff=ovl.TITLE_RATIO)
            tex = by_title[close[0]] if close else None
        if tex is None:
            row["result"] = "no matching \\section"
            continue
        mdpath = os.path.join(entry, "sections", f"{s['id']}.md")
        if not os.path.exists(mdpath):
            row["result"] = "section file missing"
            continue
        with open(mdpath, encoding="utf-8") as fh:
            fm, text = ovl.split_frontmatter(fh.read())
        if re.search(r"^text_source:\s*latex\s*$", fm, re.M):
            row["result"] = "overlaid — the text is the LaTeX, not a measurement"
            continue
        fs = formulas(tex.body)
        if not fs:
            row["result"] = "no formulas"
            continue
        text_canon = canon(text)
        rows = [score(f, text_canon, threshold) for f in fs]
        slug = os.path.basename(entry.rstrip("/"))
        if verdicts is not None:
            attach_verdicts(slug, s["id"], text_canon, rows, verdicts)
        if queue is not None:
            sha = sha256_text(text_canon)
            for r in rows:
                if r["stage"] in ("fuzzy", "missed") and r.get("judge", {}).get("state") != "current":
                    queue.append({"entry": slug, "section": s["id"], "formula": r["formula"],
                                  "text_sha256": sha, "text": text})
        row.update({"result": "scored", **summarise(rows), "matches": rows})
        every += rows

    rep["status"] = "scored"
    rep.update(summarise(every))
    rep["reason"] = f"{sum(r.get('result') == 'scored' for r in rep['sections'])} of {len(rep['sections'])} sections scored"
    return rep


def _bench_worker(item: tuple) -> tuple[dict, list]:
    e, source, threshold, library, verdicts, want_queue = item
    queue: list | None = [] if want_queue else None
    try:
        return bench_entry(e.rstrip("/"), source, threshold, library, verdicts, queue), queue or []
    except Exception as exc:  # one bad bundle must not stop a library run
        return {"entry": e, "status": "failed", "reason": f"{type(exc).__name__}: {exc}", "sections": []}, []


def default_verdicts(entries: list[str], library: str | None) -> str | None:
    """`<library>/formula-verdicts.json` when every entry sits in one library that has one."""
    libs = {library} if library else {os.path.dirname(os.path.abspath(e.rstrip("/"))) for e in entries}
    if len(libs) != 1:
        return None
    p = os.path.join(next(iter(libs)), VERDICTS_FILE)
    return p if os.path.exists(p) else None


def main() -> int:
    ap = argparse.ArgumentParser(description="score ingested section text against the paper's LaTeX formulas")
    ap.add_argument("entries", nargs="+", help="library/<bib-slug>/ directories")
    ap.add_argument("--source", help="the LaTeX source (one entry only); default <entry>/source/")
    ap.add_argument("--library", help="library root holding <slug>/source/ for a staged entry")
    ap.add_argument("--threshold", type=float, default=THRESHOLD, help="normalised distance counted as found (default 0.2)")
    ap.add_argument("--json", default="build/benchmarks/formula-benchmark.json",
                    help="write the full report here (default: build/benchmarks/formula-benchmark.json; never a graph directory)")
    ap.add_argument("--stdout-json", action="store_true", help="print the report as JSON instead of a table")
    ap.add_argument("--jobs", "-j", type=int, default=1, help="worker processes (default 1)")
    ap.add_argument("--verdicts", help=f"stage-3 judge verdicts ({VERDICTS_SCHEMA}); default <library>/{VERDICTS_FILE} when present")
    ap.add_argument("--judge-queue", help="write the pairs still needing a verdict here (never a graph directory)")
    ap.add_argument("--held-set", help=f"score the judge against ground truth first ({HELD_SET_SCHEMA})")
    args = ap.parse_args()
    if args.source and len(args.entries) > 1:
        ap.error("--source names one entry's source; give one entry")
    if args.json:
        assert_not_declared_graph_path(args.json, os.getcwd())
    if args.judge_queue:
        assert_not_declared_graph_path(args.judge_queue, os.getcwd())

    vpath = args.verdicts or default_verdicts(args.entries, args.library)
    verdicts = read_verdicts(vpath) if vpath else None
    calibration = score_held_set(args.held_set) if args.held_set else None

    items = [(e, args.source, args.threshold, args.library, verdicts, bool(args.judge_queue)) for e in args.entries]
    if args.jobs > 1:
        from concurrent.futures import ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=args.jobs) as ex:
            results = list(ex.map(_bench_worker, items))
    else:
        results = [_bench_worker(it) for it in items]
    reports = [r for r, _ in results]
    queue = [q for _, qs in results for q in qs]

    scored = [r for r in reports if r["status"] == "scored" and r.get("formulas")]
    n = sum(r["formulas"] for r in scored)
    overall = {
        "_schema": SCHEMA, "threshold": args.threshold, "entries": len(reports), "entries_scored": len(scored),
        "formulas": n,
        "recall_exact": round(sum(r["recall_exact"] * r["formulas"] for r in scored) / n, 3) if n else None,
        "recall": round(sum(r["recall"] * r["formulas"] for r in scored) / n, 3) if n else None,
        "mean_distance": round(sum(r["mean_distance"] * r["formulas"] for r in scored) / n, 3) if n else None,
    }
    if verdicts is not None:
        rows = [m for r in scored for sec in r["sections"] for m in sec.get("matches", []) if m["stage"] != "too-short"]
        j = judge_summary(rows) or {"judged": 0, "stale": 0, "coverage": 0.0, "recall_judged": None, "recall_combined": overall["recall"]}
        overall["judge"] = {"verdicts": vpath, **j, "calibrated": calibration is not None,
                            **({"calibration": calibration} if calibration else {})}
    elif calibration is not None:
        overall["judge"] = {"verdicts": None, "calibrated": True, "calibration": calibration}
    out = {**overall, "reports": reports}
    if args.judge_queue:
        os.makedirs(os.path.dirname(os.path.abspath(args.judge_queue)), exist_ok=True)
        with open(args.judge_queue, "w", encoding="utf-8") as fh:
            json.dump({"$schema": QUEUE_SCHEMA, "verdicts_schema": VERDICTS_SCHEMA, "pairs": queue}, fh, indent=1, ensure_ascii=False)
    if args.json:
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        with open(args.json, "w") as fh:
            json.dump(out, fh, indent=1)
    if args.stdout_json:
        print(json.dumps(out, indent=1))
    else:
        for r in reports:
            m = f"recall {r['recall']:.2f} (exact {r['recall_exact']:.2f}) over {r['formulas']}" if r.get("formulas") else ""
            print(f"{r['status']:<8} {os.path.basename(r['entry']):<34} {m}  {r['reason']}")
        if n:
            print(f"\n{n} formulas in {len(scored)} entries: recall {overall['recall']}, "
                  f"exact {overall['recall_exact']}, mean distance {overall['mean_distance']}", file=sys.stderr)
    j = overall.get("judge")
    if j and "judged" in j:
        print(f"judge: {j['judged']} judged ({j['coverage']} coverage, {j['stale']} stale), "
              f"recall_judged {j['recall_judged']}, recall_combined {j['recall_combined']}"
              + ("" if j["calibrated"] else " — UNCALIBRATED: score a held set (--held-set) before citing these"),
              file=sys.stderr)
    if args.judge_queue:
        print(f"judge queue: {len(queue)} pair(s) -> {args.judge_queue}", file=sys.stderr)
    return 1 if any(r["status"] == "failed" for r in reports) else 0


if __name__ == "__main__":
    sys.exit(main())
