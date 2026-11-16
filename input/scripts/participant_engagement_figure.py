#!/usr/bin/env python3
"""Draw the home page "GDHCN Participant Engagement" figure from data.

Inputs (no network, standard library only):
  input/figures/participant_engagement.json      the WHO engagement list
  input/fsh/valuesets/Participants.fsh           who is in production
  input/fsh/conceptmaps/ParticipantsToWHORegionalOffices.fsh   WHO region
  input/fsh/codesystems/RefMartCountryList.fsh   known country codes
  input/fsh/instances/participants.fsh           Organization pages to link

Output:
  input/includes/participant_engagement.svg      included inline by overview.md

A participant counts as "onboarded" when it is in the production
Participants value set, "in progress" when the engagement list says it is
engaged but it is not in production yet, and "in discussion" otherwise. Its
region comes from the ConceptMap when the ConceptMap maps it, else from the
engagement list. All totals are counted, never copied.

Usage:
  python3 input/scripts/participant_engagement_figure.py           write the SVG
  python3 input/scripts/participant_engagement_figure.py --check   exit 1 if stale

Both modes print where the engagement list and the FHIR data disagree.
"""
from __future__ import annotations

import json
import re
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "input/figures/participant_engagement.json"
PROD_VS = ROOT / "input/fsh/valuesets/Participants.fsh"
REGION_MAP = ROOT / "input/fsh/conceptmaps/ParticipantsToWHORegionalOffices.fsh"
REFMART = ROOT / "input/fsh/codesystems/RefMartCountryList.fsh"
ORGS = ROOT / "input/fsh/instances/participants.fsh"
OUT = ROOT / "input/includes/participant_engagement.svg"

REGION_TITLES = {
    "AMRO": "Region of the Americas",
    "EURO": "European Region",
    "AFRO": "African Region",
    "EMRO": "Eastern Mediterranean Region",
    "WPRO": "Western Pacific Region",
    "SEARO": "South-East Asia Region",
    "OTHER": "International Organizations",
}
# Columns of names per region panel; the layout is two rows of panels.
LAYOUT = [[("AMRO", 2), ("EURO", 3)], [("AFRO", 1), ("EMRO", 1), ("WPRO", 1), ("SEARO", 1), ("OTHER", 1)]]

STATUS = {
    "onboarded": {"label": "Onboarded (in production)", "fill": "#1B6E30", "weight": "bold", "mark": "● "},
    "in-progress": {"label": "In progress (letter received or technical onboarding)", "fill": "#1565C0", "weight": "normal", "mark": "○ "},
    "in-discussion": {"label": "In discussion (letter of application not received)", "fill": "#3A3A3A", "weight": "normal", "mark": ""},
}

HEAD_FILL = "#1F4E79"
W = 960
PAD = 12
GAP = 10
COL_W = 176
LINE = 17
HEAD_H = 34


def prod_codes() -> set[str]:
    text = PROD_VS.read_text(encoding="utf-8")
    codes = set(re.findall(r"^\*\s+\$RefMartCountryList#([A-Z0-9-]+)", text, re.M))
    codes |= set(re.findall(r"^\*\s+(?:\$?Participants)?#([A-Z0-9-]+)", text, re.M))
    return codes


def concept_map_regions() -> dict[str, str]:
    regions: dict[str, str] = {}
    current = None
    for line in REGION_MAP.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*\* code = #(\S+)", line)
        if not m:
            continue
        code = m.group(1)
        if line.startswith("    *"):  # element code (4 spaces)
            current = code
        elif current is not None:  # target code (6 spaces)
            regions[current] = code
            current = None
    return regions


def refmart_codes() -> set[str]:
    return set(re.findall(r"^\* #([A-Z0-9]+)", REFMART.read_text(encoding="utf-8"), re.M))


def org_pages() -> set[str]:
    return set(re.findall(r"^Instance: GDHCNParticipant-([A-Z0-9]+)\s*$", ORGS.read_text(encoding="utf-8"), re.M))


def classify(data: dict) -> tuple[list[dict], list[str]]:
    prod = prod_codes()
    cmap = concept_map_regions()
    known = refmart_codes() | {"IOM", "WHO"}
    orgs = org_pages()
    notes: list[str] = []
    rows = []
    seen = set()
    for p in data["participants"]:
        code = p["code"]
        if code in seen:
            notes.append(f"error: {code} is listed twice")
        seen.add(code)
        if code not in known:
            notes.append(f"error: {code} ({p['name']}) is not a RefMart country code")
        if code in prod:
            status = "onboarded"
            if p["status"] != "engaged":
                notes.append(f"disagree: {code} is in production but the list says {p['status']}")
        elif p["status"] == "engaged":
            status = "in-progress"
        else:
            status = "in-discussion"
        region = cmap.get(code, p["region"])
        if code in cmap and cmap[code] != p["region"]:
            notes.append(f"disagree: {code} is {p['region']} in the list, {cmap[code]} in the ConceptMap (ConceptMap used)")
        rows.append({**p, "status": status, "region": region, "link": code in orgs and code in prod})
    for code in sorted(prod - seen - {"WHO"}):
        notes.append(f"disagree: {code} is in production but not in the engagement list")
    return rows, notes


def text_lines(name: str, max_chars: int) -> list[str]:
    words, lines, cur = name.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    return lines


def panel_height(entries: list[dict], cols: int) -> int:
    per_col = -(-len(entries) // cols) if entries else 0
    n_lines = 0
    for c in range(cols):
        col = entries[c * per_col:(c + 1) * per_col]
        n_lines = max(n_lines, sum(len(text_lines(e["name"], 26)) for e in col))
    return HEAD_H + 10 + n_lines * LINE + 8


def render(data: dict, rows: list[dict]) -> str:
    by_region: dict[str, list[dict]] = {r: [] for r in REGION_TITLES}
    for r in rows:
        by_region.setdefault(r["region"], []).append(r)
    for r in by_region.values():
        r.sort(key=lambda e: e["name"])

    out: list[str] = []
    y = 44
    for row in LAYOUT:
        units = sum(c for _, c in row)
        avail = W - 2 * PAD - GAP * (len(row) - 1)
        x = PAD
        h = max(panel_height(by_region[r], c) for r, c in row)
        for region, cols in row:
            pw = round(avail * cols / units)
            entries = by_region[region]
            out.append(f'<rect x="{x}" y="{y}" width="{pw}" height="{h}" fill="#FFFFFF" stroke="{HEAD_FILL}" stroke-width="1.2"/>')
            head_lines = text_lines(f"{REGION_TITLES[region]} ({len(entries)})", int(pw / 7.6))
            hy = y + (20 if len(head_lines) == 1 else 13)
            head_text = "".join(
                f'<tspan x="{x + pw / 2:.0f}" dy="{0 if i == 0 else 14}">{escape(ln)}</tspan>' for i, ln in enumerate(head_lines)
            )
            out.append(
                f'<a href="CodeSystem-WHORegionalOffices.html#WHORegionalOffices-{region}"><title>{escape(REGION_TITLES[region])} ({region})</title>'
                f'<rect x="{x}" y="{y}" width="{pw}" height="{HEAD_H}" fill="{HEAD_FILL}"/>'
                f'<text y="{hy}" text-anchor="middle" font-size="12.5" font-weight="bold" fill="#FFFFFF">{head_text}</text></a>'
            )
            per_col = -(-len(entries) // cols) if entries else 0
            cw = pw / cols
            for c in range(cols):
                ty = y + HEAD_H + 18
                for e in entries[c * per_col:(c + 1) * per_col]:
                    st = STATUS[e["status"]]
                    lines = text_lines(e["name"], 26)
                    tspans = "".join(
                        f'<tspan x="{x + 8 + c * cw:.0f}" dy="{0 if i == 0 else LINE}">{escape((st["mark"] if i == 0 else "   ") + ln)}</tspan>'
                        for i, ln in enumerate(lines)
                    )
                    t = (
                        f'<text y="{ty}" font-size="12" font-weight="{st["weight"]}" fill="{st["fill"]}">'
                        f'<title>{escape(e["name"])} ({e["code"]}): {escape(st["label"])}</title>{tspans}</text>'
                    )
                    if e["link"]:
                        t = f'<a href="Organization-GDHCNParticipant-{e["code"]}.html">{t}</a>'
                    out.append(t)
                    ty += LINE * len(lines)
            x += pw + GAP
        y += h + GAP

    # Totals, counted from the rows.
    counts = {s: sum(r["status"] == s for r in rows) for s in STATUS}
    tiles = [("total participants", len(rows), "#C55A11")] + [
        (lbl, counts[s], "#1F4E79") for s, lbl in (("onboarded", "onboarded"), ("in-progress", "in progress"), ("in-discussion", "in discussion"))
    ]
    tw = (W - 2 * PAD - GAP * 3) / 4
    y += 4
    for i, (lbl, n, col) in enumerate(tiles):
        tx = PAD + i * (tw + GAP)
        out.append(f'<rect x="{tx:.0f}" y="{y}" width="{tw:.0f}" height="62" fill="#FFFFFF" stroke="{col}" stroke-width="1.2"/>')
        out.append(f'<text x="{tx + tw / 2:.0f}" y="{y + 32}" text-anchor="middle" font-size="26" fill="{col}">{n}</text>')
        out.append(f'<text x="{tx + tw / 2:.0f}" y="{y + 52}" text-anchor="middle" font-size="13" fill="#1A1A1A">{lbl}</text>')
    y += 62 + 18

    for s, st in STATUS.items():
        out.append(f'<text x="{PAD}" y="{y}" font-size="12" font-weight="{st["weight"]}" fill="{st["fill"]}">{escape(st["mark"] or "Aa ")}{escape(st["label"])}</text>')
        y += 17
    y += 2
    for ln in (
        f'Engagement list as of {data["asOf"]}: {data["source"].split(" (")[0]}.',
        "Onboarded = in ValueSet Participants (production). Regions from ConceptMap ParticipantsToWHORegionalOffices. Totals are counted.",
    ):
        out.append(f'<text x="{PAD}" y="{y}" font-size="10.5" font-style="italic" fill="#555555">{escape(ln)}</text>')
        y += 14
    title = escape(data["title"])
    head = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {y}" width="100%" style="max-width:{W}px" '
        f'font-family="Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-labelledby="pe-title">'
        f'<title id="pe-title">{title}</title>'
        f'<rect width="{W}" height="{y}" fill="#FFFFFF"/>'
        f'<text x="{PAD}" y="28" font-size="20" fill="{HEAD_FILL}">{title}</text>'
    )
    return "<!-- Generated by input/scripts/participant_engagement_figure.py from input/figures/participant_engagement.json. Do not edit. -->\n" + head + "\n" + "\n".join(out) + "\n</svg>\n"


def main(argv: list[str]) -> int:
    check = "--check" in argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    rows, notes = classify(data)
    for n in notes:
        print(n, file=sys.stderr)
    if any(n.startswith("error:") for n in notes):
        return 2
    svg = render(data, rows)
    if check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != svg:
            print(f"stale: {OUT.relative_to(ROOT)}; run python3 input/scripts/participant_engagement_figure.py", file=sys.stderr)
            return 1
        print(f"ok: {OUT.relative_to(ROOT)} is current")
        return 0
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
