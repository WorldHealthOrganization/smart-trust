#!/usr/bin/env python3
"""
intake-rows — the cell values of a comment spreadsheet (.xlsx) or a form
export (.csv), as JSON rows. Bean `v26p`.

Standard library only (zipfile, xml.etree, csv). Comment intake needs cell
VALUES and nothing else, so no spreadsheet library is pulled in for it.
Not supported, and refused with a message: legacy .xls, encrypted workbooks.

Output: {"sheets": [{"name": "Comment matrix", "rows": [[cell, ...], ...]}]}
"""
import csv
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def text(el):
    return "".join(t.text or "" for t in el.iter(f"{{{NS['m']}}}t")) if el is not None else ""


def col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def xlsx(path):
    if not zipfile.is_zipfile(path):
        sys.exit("intake-rows: not an .xlsx (a legacy .xls or an encrypted workbook?); save it as .xlsx")
    z = zipfile.ZipFile(path)
    names = set(z.namelist())
    shared = [text(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)] if "xl/sharedStrings.xml" in names else []
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = []
    for s in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS):
        target = rels[s.get(REL)].lstrip("/")
        target = target if target.startswith("xl/") else f"xl/{target}"
        rows = {}
        for row in ET.fromstring(z.read(target)).iter(f"{{{NS['m']}}}row"):
            cells = {}
            for c in row.findall("m:c", NS):
                t, v = c.get("t"), c.find("m:v", NS)
                if t == "s":
                    val = shared[int(v.text)]
                elif t == "inlineStr":
                    val = text(c.find("m:is", NS))
                elif v is None:
                    continue
                elif t in ("str", "e"):
                    val = v.text
                elif t == "b":
                    val = v.text == "1"
                else:
                    try:
                        f = float(v.text)
                        val = int(f) if f.is_integer() else f
                    except ValueError:
                        val = v.text
                cells[col(c.get("r"))] = val
            rows[int(row.get("r")) - 1] = cells
        width = max((max(r) + 1 for r in rows.values() if r), default=0)
        out.append({"name": s.get("name"), "rows": [[rows.get(i, {}).get(j) for j in range(width)] for i in range(max(rows, default=-1) + 1)]})
    return out


def main():
    path = sys.argv[1]
    if path.lower().endswith(".csv"):
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = [[c if c != "" else None for c in r] for r in csv.reader(f)]
        sheets = [{"name": "csv", "rows": rows}]
    else:
        sheets = xlsx(path)
    json.dump({"sheets": sheets}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
