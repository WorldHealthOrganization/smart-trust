#!/usr/bin/env python3
"""
l1-indicator-sheets — read the indicator metadata sheets of an L1 source from
its PDF page layout, and propose each indicator as an `indicator` candidate.

    python3 l1-indicator-sheets.py --entry library/<doc-id> --pdf uploads/<doc-id>/<doc-id>.pdf \
        [--pages 51-99] [--write | --json]

Owner, 2026-11-02: extracting a source's indicators into L2 style "is a
process added as part of L1 -> L2 extraction for DAK or DTH". This is the
mechanical half; the skill is `indicator-extraction`.

**Why the PDF and not the section text.** A WHO indicator reference sheet is
a two-column table: a column of labels ("Indicator name", "Numerator",
"Definition", ...) and a column of values, with the indicator's number and
short name in a side bar. Stage A's section text reads those in the wrong
order (the NHWA handbook's side bars land on the next sheet, one sheet's
name went missing, and indicator 4-04 has no section of its own). The word
positions on the page keep the two columns apart, so this reads them.

How a sheet is read:

- A sheet starts on a page whose label column holds the first label of
  `LABELS` that the source uses to open a sheet (default "Indicator name").
  It continues onto the following pages while their header prints the same
  indicator number.
- The value column starts where the words after that opening label start.
  Words left of it are labels; a line whose label starts with a known label
  word opens a new field; other label words continue the label, or are a
  sub-indicator's number ("4 – 01.3").
- The indicator number and short name come from the page header (the area
  above the table): `ID_PATTERN` finds the number. **Ids come from the
  source, never invented**; a sheet whose header prints no number is
  reported and skipped.
- Values are verbatim: printed lines joined by a space, letter-spacing
  artefacts closed up, nothing reworded. A bulleted value (glossary, data
  sources) is a list, kept as one string joined with "; " in `fields`.

Each candidate carries `kind: indicator`, `aspect: indicators`, `number`
(the printed id), `name` (the printed indicator name), `statement` (the
sheet as label/value lines, verbatim) and `fields`, the printed fields as
strings, which `gen-library-jsonld` copies into the node's `meta`.
Sub-indicators (a "Sub-indicator" row with its own number, e.g. 2-07.1) are
their own candidates with `fields.parentIndicator`.

`--write` merges the candidates into `<entry>/candidates.json`: earlier
`indicators`-aspect candidates are replaced, and an older hand-made
`indicator` candidate with the same number is replaced by the sheet's (so a
re-run is idempotent). Then run `gen-library-jsonld --entry <entry>`.

Validated against: NHWA handbook, 2nd edition (who-iris 9789240081291-eng),
29 indicators and 33 sub-indicators.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

ASPECT = "indicators"

# Label -> field key. The first word of a label line decides which field it
# opens; the rest of the label may run onto the next line(s).
LABELS: list[tuple[str, str]] = [
    ("Indicator name", "name"),
    ("Numerator", "numerator"),
    ("Denominator", "denominator"),
    ("Disaggregation", "disaggregation"),
    ("Definition", "definition"),
    ("Glossary", "glossary"),
    ("Data reporting frequency", "reporting"),
    ("Potential data sources", "dataSources"),
    ("Data sources", "dataSources"),
    ("Further information", "furtherInformation"),
    ("Sub-indicator", "subIndicator"),
    ("Dimension", "dimension"),
    ("What it measures", "whatItMeasures"),
    ("Rationale", "rationale"),
    ("Method of measurement", "methodOfMeasurement"),
    ("Unit of measure", "unit"),
]
OPENING_LABEL = "Indicator name"
LIST_FIELDS = {"glossary", "dataSources"}
# "1 – 01", "4-01.10": module digit, dash, two-digit number, optional .sub
ID_PATTERN = re.compile(r"^(\d{1,2})\s*[–-]\s*(\d{2})(?:\.(\d{1,2}))?$")
HEADER_BOTTOM = 130.0  # pt from the top: the side-bar header sits above this
FOOTER_TOP = 790.0     # running footer (page number, book title) below this


def _lines(page, tol: float = 3.5) -> list[dict[str, Any]]:
    words = page.extract_words(keep_blank_chars=False)
    words.sort(key=lambda w: (w["top"], w["x0"]))
    out: list[dict[str, Any]] = []
    for w in words:
        if out and abs(out[-1]["top"] - w["top"]) <= tol:
            out[-1]["w"].append(w)
        else:
            out.append({"top": w["top"], "w": [w]})
    for ln in out:
        ln["w"].sort(key=lambda w: w["x0"])
        merged: list[dict[str, Any]] = []
        for w in ln["w"]:
            # letter-spaced capitals ("P arental"): glyphs that touch are one word
            if merged and -1.5 < w["x0"] - merged[-1]["x1"] < 1.2 and "•" not in (w["text"], merged[-1]["text"]):
                m = dict(merged[-1])
                m["text"] += w["text"]
                m["x1"] = w["x1"]
                merged[-1] = m
            else:
                merged.append(dict(w))
        ln["w"] = merged
    return out


def _value_x(lines: list[dict[str, Any]]) -> float | None:
    """Where the value column starts: the first word after the opening label."""
    first = OPENING_LABEL.split()
    for ln in lines:
        texts = [w["text"] for w in ln["w"]]
        for i in range(len(texts) - len(first) + 1):
            if texts[i : i + len(first)] == first and i + len(first) < len(texts):
                return ln["w"][i + len(first)]["x0"] - 2.0
    return None


def _header(lines: list[dict[str, Any]]) -> tuple[str | None, str]:
    """The printed indicator number and short name from the side-bar header."""
    head = [ln for ln in lines if ln["top"] < HEADER_BOTTOM]
    toks = " ".join(w["text"] for ln in head for w in ln["w"])
    m = re.search(r"\b(\d{1,2})\b.*?–\s*(\d{2})\b", toks)
    num = f"{m.group(1)}-{m.group(2)}" if m else None
    name = []
    for ln in head:
        t = " ".join(w["text"] for w in ln["w"] if not re.fullmatch(r"–|\d{1,2}", w["text"]))
        t = t.replace("Abbreviated name", "").strip()
        if t:
            name.append(t)
    return num, re.sub(r"\s+", " ", " ".join(name)).strip()


def _module_title(lines: list[dict[str, Any]]) -> tuple[str, str] | None:
    """A module divider page: 'Module N' then its title."""
    txt = [" ".join(w["text"] for w in ln["w"]) for ln in lines]
    for i, t in enumerate(txt):
        m = re.fullmatch(r"Module\s+(\d{1,2})", t.strip())
        if m:
            title = []
            for u in txt[i + 1 :]:
                if u.strip().startswith("Module summary"):
                    break
                title.append(u.strip())
            return m.group(1), re.sub(r"\s+", " ", " ".join(title)).strip()
    return None


def _label_key(label: str) -> str | None:
    for text, key in LABELS:
        if label.startswith(text.split()[0]) and (text.startswith(label[: len(text)]) or label.startswith(text)):
            return key
    return None


def _join(lines: list[str]) -> str:
    out = ""
    for ln in lines:
        if not out:
            out = ln
        elif out.endswith("-") and not out.endswith(" -"):
            out += ln  # a compound broken at its hyphen ("well-" / "being")
        else:
            out += " " + ln
    return re.sub(r"\s+", " ", out).strip()


def _items(lines: list[str]) -> list[str]:
    items: list[list[str]] = []
    for ln in lines:
        if ln.startswith("•"):
            items.append([ln.lstrip("•").strip()])
        elif items:
            items[-1].append(ln)
        else:
            items.append([ln])
    return [j for j in (_join(i) for i in items) if j]


def read_sheets(pdf_path: str, first: int, last: int) -> tuple[list[dict[str, Any]], list[str]]:
    import pdfplumber  # cat-harness-tools python/requirements.txt

    sheets: list[dict[str, Any]] = []
    warnings: list[str] = []
    modules: dict[str, str] = {}
    cur: dict[str, Any] | None = None
    with pdfplumber.open(pdf_path) as pdf:
        last = min(last, len(pdf.pages))
        for pno in range(first, last + 1):
            lines = _lines(pdf.pages[pno - 1])
            mod = _module_title(lines)
            if mod:
                modules[mod[0]] = mod[1]
                cur = None
                continue
            num, short = _header(lines)
            body = [ln for ln in lines if HEADER_BOTTOM <= ln["top"] < FOOTER_TOP]
            vx = _value_x(body)
            if vx is not None:
                if not num:
                    warnings.append(f"p{pno}: a sheet opens but its header prints no indicator number; skipped")
                    cur = None
                    continue
                cur = {"number": num, "abbreviatedName": short, "pages": [pno], "vx": vx, "fields": []}
                sheets.append(cur)
            elif cur is not None and num == cur["number"] and body:
                cur["pages"].append(pno)
                vx = cur["vx"]
            else:
                cur = None
                continue
            f = cur["fields"][-1] if cur["fields"] else None
            for ln in body:
                lab = " ".join(w["text"] for w in ln["w"] if w["x1"] < vx).strip()
                val = " ".join(w["text"] for w in ln["w"] if w["x1"] >= vx).strip()
                key = _label_key(lab) if lab else None
                if key and not (key == "reporting" and f is not None and f["key"] == "dataSources"):
                    f = {"key": key, "label": lab, "sub": None, "lines": []}
                    cur["fields"].append(f)
                elif lab and f is not None:
                    m = ID_PATTERN.match(lab)
                    if m and m.group(3):
                        f["sub"] = f"{m.group(1)}-{m.group(2)}.{m.group(3)}"
                    else:
                        f["label"] += " " + lab
                if val and f is not None:
                    f["lines"].append(val)
    for s in sheets:
        s["module"] = modules.get(s["number"].split("-")[0])
    return sheets, warnings


def to_candidates(sheets: list[dict[str, Any]], sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def section_for(number: str, page: int) -> dict[str, Any] | None:
        for s in sections:  # a section named after the indicator ("sec-023-1-01-...")
            if re.search(rf"-{re.escape(number)}-", s["id"] + "-"):
                return s
        best = None
        for s in sections:
            if (s.get("page_start") or 0) <= page:
                best = s
        return best

    out: list[dict[str, Any]] = []
    for sh in sheets:
        num = sh["number"]
        mod = num.split("-")[0]
        fields: dict[str, str] = {"indicatorId": num}
        if sh.get("module"):
            fields["module"] = f"Module {mod}: {sh['module']}"
        if sh["abbreviatedName"]:
            fields["abbreviatedName"] = sh["abbreviatedName"]
        stmt: list[str] = []
        subs: list[dict[str, Any]] = []
        for f in sh["fields"]:
            label = re.sub(r"\s+", " ", f["label"]).strip()
            k, L = f["key"], f["lines"]
            if k == "subIndicator":
                text = "\n".join(L)
                parts = re.split(r"\s*Guiding questions?:\s*", text, maxsplit=1)
                sub = {"number": f["sub"], "name": _join(parts[0].split("\n")),
                       "guidingQuestions": _join(parts[1].split("\n")) if len(parts) > 1 else None}
                if not sub["number"]:
                    continue
                subs.append(sub)
                stmt += [f"{label} {sub['number']}", sub["name"]] + (
                    [f"Guiding questions: {sub['guidingQuestions']}"] if sub["guidingQuestions"] else [])
                continue
            stmt += [label] + L
            if k in LIST_FIELDS:
                fields[k] = "; ".join(_items(L))
            elif k == "reporting":
                t = _join(L)
                p = re.split(r"\s*Reporting frameworks?:\s*", t, maxsplit=1)
                fields["reportingFrequency"] = p[0].strip()
                if len(p) > 1:
                    fields["reportingFrameworks"] = p[1].strip()
            elif k == "definition":
                fields[k] = "\n".join(L)  # paragraphs and level lists: keep the printed lines
            else:
                fields[k] = _join(L)
        pages = f"{sh['pages'][0]}-{sh['pages'][-1]}" if len(sh["pages"]) > 1 else str(sh["pages"][0])
        sec = section_for(num, sh["pages"][0])
        base = {
            "kind": "indicator",
            "aspect": ASPECT,
            "source_kind": "indicator-reference-sheet",
            "section_file": f"sections/{sec['md']}" if sec else None,
            "section_title": sec.get("title") if sec else None,
            "pages": pages,
            "formalization_candidate": False,
            "route_to": "l2-dak-authoring",
        }
        out.append({**base, "number": num, "name": fields.get("name"), "statement": "\n".join(stmt), "fields": fields})
        for sub in subs:
            sf = {"indicatorId": sub["number"], "parentIndicator": num}
            if fields.get("module"):
                sf["module"] = fields["module"]
            sf["name"] = sub["name"]
            if sub["guidingQuestions"]:
                sf["guidingQuestions"] = sub["guidingQuestions"]
            st = [f"Sub-indicator {sub['number']}", sub["name"]] + (
                [f"Guiding questions: {sub['guidingQuestions']}"] if sub["guidingQuestions"] else [])
            out.append({**base, "number": sub["number"], "name": sub["name"], "statement": "\n".join(st), "fields": sf})
    return out


def load_sections(entry: str) -> list[dict[str, Any]]:
    with open(os.path.join(entry, "structure.json"), encoding="utf-8") as fh:
        st = json.load(fh)
    mds = {f[:-3].split("-", 2)[0] + "-" + f[:-3].split("-", 2)[1]: f
           for f in os.listdir(os.path.join(entry, "sections")) if f.endswith(".md")}
    out = []
    for s in st.get("sections", []):
        sid = s.get("id", "")
        key = "-".join(sid.split("-")[:2])
        md = mds.get(key) or (sid + ".md")
        out.append({"id": sid, "md": md, "title": s.get("title"),
                    "page_start": s.get("page_start"), "page_end": s.get("page_end")})
    return out


def merge(entry: str, cands: list[dict[str, Any]]) -> dict[str, Any]:
    path = os.path.join(entry, "candidates.json")
    prior: dict[str, Any] = {"_schema": "ingest-candidates/v1", "candidates": []}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            prior = json.load(fh)
    numbers = {c["number"] for c in cands}
    kept = [c for c in prior.get("candidates", [])
            if c.get("aspect") != ASPECT and not (c.get("kind") == "indicator" and c.get("number") in numbers)]
    prior["candidates"] = kept + cands
    aspects = set(prior.get("aspects", [])) | {ASPECT}
    prior["aspects"] = sorted(aspects)
    return prior


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--entry", required=True, help="library/<doc-id> (structure.json + sections/)")
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--pages", help="first-last PDF pages to read (default: all)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--write", action="store_true", help="merge into <entry>/candidates.json")
    g.add_argument("--json", action="store_true", help="print the candidates")
    a = ap.parse_args()
    first, last = 1, 10_000
    if a.pages:
        first, last = (int(x) for x in a.pages.split("-"))
    sheets, warnings = read_sheets(a.pdf, first, last)
    cands = to_candidates(sheets, load_sections(a.entry))
    for w in warnings:
        print("WARNING", w, file=sys.stderr)
    top = sum(1 for c in cands if "parentIndicator" not in c["fields"])
    print(f"indicator sheets: {top} indicators, {len(cands) - top} sub-indicators", file=sys.stderr)
    if a.write:
        doc = merge(a.entry, cands)
        with open(os.path.join(a.entry, "candidates.json"), "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
    else:
        json.dump(cands, sys.stdout, indent=1, ensure_ascii=False)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
