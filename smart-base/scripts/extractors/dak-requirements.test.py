#!/usr/bin/env python3
"""
Exercise the `requirements` aspect, `dak-requirements.py` beside this file,
on a synthetic fixture: DAK FR/NFR table rows, a system requirement stated
in prose, a plain normative sentence, and text with no marker.

A logic test, not validation against a real DAK L1. The candidates it
proposes are proposals; a person promotes them.

Run: python3 smart-base/scripts/extractors/dak-requirements.test.py
"""

from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("dak_requirements", os.path.join(HERE, "dak-requirements.py"))
REQ = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(REQ)

BODY = """\
| Requirement ID | Activity | As a | I want | So that |
|---|---|---|---|---|
| ANC.FXREQ.001 | Register client | health worker | to register a pregnant woman | she can be followed up |
| ANC.NFXREQ.002 | Availability | | The system is available offline | |

See ANC.FXREQ.001 above for the registration step.

The registry should record each health worker's licensing status. Countries
must not publish personal data without consent. It is a long-standing
practice in many countries to keep paper records.

Vaccines may be given at any age. Health workers may choose the order.
"""


def main() -> int:
    failures: list[str] = []

    def expect(label: str, cond: bool, detail: object = "") -> None:
        if not cond:
            failures.append(f"{label} {detail}".rstrip())

    sections = [("sec-001-reqs.md", {"section_title": "Requirements", "pages": "4-5"}, BODY)]
    out = REQ.extract(sections, {})
    by_num = {c["number"]: c for c in out if c["number"]}

    expect("ASPECT, not CLASS", REQ.ASPECT == "requirements" and not hasattr(REQ, "CLASS"))
    expect("FR row: smart-base kind, the source's own id",
           by_num.get("ANC.FXREQ.001", {}).get("kind") == "functional-requirement", by_num)
    expect("NFR row: smart-base kind",
           by_num.get("ANC.NFXREQ.002", {}).get("kind") == "non-functional-requirement", by_num)
    expect("a row is its cells, verbatim, without pipes",
           by_num.get("ANC.FXREQ.001", {}).get("statement")
           == "ANC.FXREQ.001 Register client health worker to register a pregnant woman she can be followed up",
           by_num.get("ANC.FXREQ.001", {}).get("statement"))
    expect("a second mention of an id is not a second requirement",
           sum(1 for c in out if c["number"] == "ANC.FXREQ.001") == 1)

    prose = [c for c in out if c["number"] is None]
    texts = [c["statement"] for c in prose]
    sys_req = [c for c in prose if c["source_kind"] == "system-requirement-statement"]
    expect("a system's 'should' is a functional requirement with no invented id",
           len(sys_req) == 1 and sys_req[0]["kind"] == "functional-requirement"
           and sys_req[0]["statement"].startswith("The registry should record"), sys_req)
    norm = [c for c in prose if c["source_kind"] == "normative-statement"]
    expect("'must not' is core's recommendation at must-not",
           any(c["kind"] == "recommendation" and c["strength"] == "must-not" and c["statement"].startswith("Countries must not")
               for c in norm), norm)
    expect("'may be given' counts (the coverage marker list)", any(t.startswith("Vaccines may be given") for t in texts), texts)
    expect("bare 'may' does not count", not any(t.startswith("Health workers may choose") for t in texts), texts)
    expect("no marker, no candidate", not any("long-standing practice" in t for t in texts), texts)
    expect("every candidate names its L1 section and pages",
           all(c["section_file"] == "sections/sec-001-reqs.md" and c["pages"] == "4-5" for c in out))
    expect("nothing is content", all(c["formalization_candidate"] is False and c["route_to"] == "l2-dak-authoring" for c in out))

    if failures:
        print("FAIL")
        for f in failures:
            print("  -", f)
        return 1
    print(f"ok — requirements aspect ({len(out)} candidates on the fixture)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
