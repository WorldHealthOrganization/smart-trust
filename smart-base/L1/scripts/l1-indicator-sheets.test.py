#!/usr/bin/env python3
"""
Exercise `l1-indicator-sheets.py` beside this file without a PDF: the label
matching, list and line joining, turning parsed sheets into candidates, and
the idempotent merge into candidates.json.

Validation against a real source is the NHWA handbook run recorded in the
`indicator-extraction` skill; this is a logic test.

Run: python3 smart-base/L1/scripts/l1-indicator-sheets.test.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("l1_indicator_sheets", os.path.join(HERE, "l1-indicator-sheets.py"))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)

fails = 0


def check(cond: bool, what: str) -> None:
    global fails
    if not cond:
        fails += 1
        print("FAIL", what)


check(M._label_key("Indicator name") == "name", "Indicator name -> name")
check(M._label_key("Data reporting frequency") == "reporting", "reporting label")
check(M._label_key("Potential data sources") == "dataSources", "data sources label")
check(M._label_key("Sub-indicator") == "subIndicator", "sub-indicator label")
check(M._label_key("and related links") is None, "a label continuation opens no field")
check(M._join(["mental well-", "being of health workers"]) == "mental well-being of health workers", "hyphen join")
check(M._items(["• Health workforce registry", "or database", "• Labour force surveys"])
      == ["Health workforce registry or database", "Labour force surveys"], "bulleted items")
check(M.ID_PATTERN.match("4 – 01.10").group(3) == "10", "sub-indicator id")

sheet = {
    "number": "2-07", "abbreviatedName": "Standards", "pages": [72, 73], "module": "Education",
    "fields": [
        {"key": "name", "label": "Indicator name", "sub": None, "lines": ["Existence of standards"]},
        {"key": "subIndicator", "label": "Sub-indicator", "sub": "2-07.1",
         "lines": ["Existence of X (Yes/Partial/No)", "Guiding questions: Is X there?"]},
        {"key": "dataSources", "label": "Potential data sources", "sub": None, "lines": ["• A", "• B"]},
        {"key": "reporting", "label": "Data reporting frequency", "sub": None,
         "lines": ["Every three years", "Reporting frameworks: JEE"]},
    ],
}
sections = [{"id": "sec-042-2-07-standards", "md": "sec-042-2-07-standards.md", "title": "2-07", "page_start": 72}]
cands = M.to_candidates([sheet], sections)
check(len(cands) == 2, "a sheet and its sub-indicator")
top, sub = cands
check(top["number"] == "2-07" and top["fields"]["module"] == "Module 2: Education", "id and module from the source")
check(top["fields"]["dataSources"] == "A; B", "list joined with '; '")
check(top["fields"]["reportingFrequency"] == "Every three years" and top["fields"]["reportingFrameworks"] == "JEE",
      "frequency and frameworks split")
check(top["section_file"] == "sections/sec-042-2-07-standards.md", "section named after the indicator")
check(sub["number"] == "2-07.1" and sub["fields"]["parentIndicator"] == "2-07", "sub-indicator keeps its parent")
check(sub["fields"]["guidingQuestions"] == "Is X there?", "guiding questions split off")
check(all(c["aspect"] == "indicators" and c["kind"] == "indicator" for c in cands), "aspect and kind")

with tempfile.TemporaryDirectory() as d:
    with open(os.path.join(d, "candidates.json"), "w") as fh:
        json.dump({"candidates": [{"kind": "indicator", "number": "2-07", "name": "old"},
                                  {"kind": "recommendation", "number": None}]}, fh)
    once = M.merge(d, cands)
    check([c.get("name") for c in once["candidates"]].count("old") == 0, "an older candidate with the same number is replaced")
    check(sum(1 for c in once["candidates"] if c["kind"] == "recommendation") == 1, "other candidates kept")
    with open(os.path.join(d, "candidates.json"), "w") as fh:
        json.dump(once, fh)
    twice = M.merge(d, cands)
    check(len(twice["candidates"]) == len(once["candidates"]), "a re-run is idempotent")

if fails:
    print(f"{fails} check(s) failed")
    sys.exit(1)
print("l1-indicator-sheets: all checks pass")
