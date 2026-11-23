#!/usr/bin/env python3
"""
Exercise the WHO L1 extractor, `who-l1.py` beside this file.

It moved here from cat-harness-tools (`scripts/tests/who-l1-extractor.test.py`)
with the extractor (bean saqd, row 6). It runs the extractor two ways:

  - **directly**, by loading `who-l1.py` and calling `extract` on the
    fixture's sections. Always runs: no other layer is needed.
  - **through the shared CLI**, cat-harness-tools'
    `scripts/extract-candidates.py`, with this layer as the only extractor
    root, when that layer is mounted (`<repo>/cat-harness-tools`, a sibling
    clone, or `$CAT_HARNESS_TOOLS_ROOT`). This is what pins
    `document_class` and the `"validated": false` flag in `candidates.json`.
    When it is not mounted that half says SKIP, never ok.

## What this does and does not establish

It builds a **synthetic** L1 fixture from the structure documented in
`local/document-intake` §"WHO-Specific Processing" and asserts the
extractor finds each normative element and maps it to the right block
kind. That is a logic test.

It is **not** validation against a real WHO guideline. No L1 PDF exists
in the corpus and `who.int` / `iris.who.int` are 403-blocked by the egress
policy (measured 2026-08-15), so the real-layout question — do
recommendations survive Stage A's text extraction as recognisable lines
once they have been through a *ruled box*, does a GRADE table survive as
anything parseable — is untouched by this file and remains open.

Read a pass here as "the regexes do what they claim on well-formed
input", not "the L1 path works". `candidates.json` reports
`"validated": false` for this class for exactly that reason, and should
keep doing so until a real guideline has been run.

Run: python3 smart-base/scripts/extractors/who-l1.test.py
"""

from __future__ import annotations

import json
import os
import importlib.util
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
LAYER_ROOT = os.path.dirname(os.path.dirname(HERE))   # the smart-base layer
REPO_ROOT = os.path.dirname(LAYER_ROOT)

_spec = importlib.util.spec_from_file_location("who_l1_extractor", os.path.join(HERE, "who-l1.py"))
WHO = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(WHO)


def tools_extract() -> str | None:
    """cat-harness-tools' extract-candidates.py, if that layer is mounted."""
    cands = []
    if os.environ.get("CAT_HARNESS_TOOLS_ROOT"):
        cands.append(os.environ["CAT_HARNESS_TOOLS_ROOT"])
    cands += [os.path.join(REPO_ROOT, "cat-harness-tools"),
              os.path.join(os.path.dirname(REPO_ROOT), "cat-harness-tools")]
    for c in cands:
        p = os.path.join(c, "scripts", "extract-candidates.py")
        if os.path.exists(p):
            return p
    return None


def sections_of(text: str, fn: str):
    """The (filename, front-matter, body) triple extract-candidates' read_sections yields."""
    fm: dict[str, str] = {}
    body = text
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            for line in text[4:end].splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    fm[k.strip()] = v.strip().strip('"')
            body = text[end + 5:]
    return [(fn, fm, body)]


def direct(text: str, fn: str) -> dict:
    cands = WHO.extract(sections_of(text, fn), {})
    by_kind: dict[str, int] = {}
    for c in cands:
        by_kind[c["kind"]] = by_kind.get(c["kind"], 0) + 1
    return {
        "document_class": WHO.CLASS,
        "validated": bool(getattr(WHO, "VALIDATED", True)),
        "summary": {"candidates": len(cands), "by_kind": by_kind,
                    "formalization_candidates": sum(1 for c in cands if c["formalization_candidate"])},
        "candidates": cands,
    }


def via_cli(extract: str, text: str, fn: str, title: str) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        docdir = os.path.join(tmp, "who-test-guideline")
        os.makedirs(os.path.join(docdir, "sections"))
        with open(os.path.join(docdir, "structure.json"), "w") as fh:
            json.dump({
                "_schema": "pdf-structure/v1",
                "doc_id": "who-test-guideline",
                "source": {"file": "who-test-guideline.pdf", "sha256": "0" * 64, "pages": 40},
                "metadata": {"title": title, "arxiv": None, "doi": None},
                "sections": [], "toc": [], "diagnostics": {},
            }, fh)
        with open(os.path.join(docdir, "sections", fn), "w") as fh:
            fh.write(text)
        env = dict(os.environ, CAT_HARNESS_EXTRACTOR_ROOTS=LAYER_ROOT)
        r = subprocess.run(
            [sys.executable, extract, docdir, "--class", "who-l1", "--json"],
            capture_output=True, text=True, env=env,
        )
        if r.returncode != 0:
            raise RuntimeError(r.stderr)
        return json.loads(r.stdout)

# Shaped after document-intake's worked example: a boxed numbered
# recommendation, its strength/certainty line, remarks, a good-practice
# statement, and a research priority.
SECTION = """---
doc_id: who-test-guideline
doc_title: "WHO Recommendations on Synthetic Test Care"
section_id: sec-003-recommendations
section_title: "3 Recommendations"
section_number: 3
pages: 12-19
source_pdf: who-test-guideline.pdf
source_sha256: 0000000000000000
---

RECOMMENDATION 1: Daily oral iron and folic acid supplementation is
recommended for pregnant women to prevent maternal anaemia.

(Strong recommendation, moderate certainty of the evidence)

GRADE: ⊕⊕⊕◯ moderate

Remarks: Implementation should account for local anaemia prevalence and
existing supplementation programmes.

Good practice statement: Counselling on side-effects should accompany
every supplementation contact.

Research priority: The optimal dosing interval in settings with high
malaria burden has not been established.

RECOMMENDATION 2: Ultrasound scan before 24 weeks of gestation is
recommended for pregnant women to estimate gestational age.

(Conditional recommendation, low certainty of the evidence)
"""

EXPECT = {
    "recommendation": 3,  # two RECOMMENDATIONs and the good practice statement (core kind)
    "remark": 1,
    "conjecture": 1,     # research priority
}


def check(res: dict, neg: dict, failures: list[str], how: str) -> None:
    # The class's own candidates: an ASPECT mounted in this layer (the
    # `requirements` aspect) adds its own, tagged with `aspect`.
    got: dict[str, int] = {}
    for c in res["candidates"]:
        if not c.get("aspect"):
            got[c["kind"]] = got.get(c["kind"], 0) + 1
    for kind, n in EXPECT.items():
        if got.get(kind, 0) != n:
            failures.append(f"[{how}] {kind}: expected {n}, got {got.get(kind, 0)}")

    if res["document_class"] != "who-l1":
        failures.append(f"[{how}] document_class: {res['document_class']}")

    # The class must declare itself unvalidated — this is the honesty flag
    # the whole file exists to protect.
    if res.get("validated") is not False:
        failures.append(f"[{how}] validated should be False for the who-l1 class")

    # Nothing in a guideline is a formalization candidate; that routing
    # belongs to the math class alone.
    if res["summary"]["formalization_candidates"] != 0:
        failures.append(f"[{how}] who-l1 must not emit formalization candidates")

    recs = [c for c in res["candidates"] if c["source_kind"] == "recommendation"]
    if [c["number"] for c in recs] != ["1", "2"]:
        failures.append(f"[{how}] recommendation numbers: {[c['number'] for c in recs]}")
    if not recs or not recs[0]["grade_nearby"]:
        failures.append(f"[{how}] GRADE marker not detected next to recommendation 1")
    strengths = [c.get("strength") for c in recs]
    if strengths != ["strong", "conditional"]:
        failures.append(f"[{how}] strength: {strengths}")
    for c in res["candidates"]:
        if c["route_to"] != "l2-dak-authoring":
            failures.append(f"[{how}] route_to: {c['route_to']}")
            break

    # Negative case: with the GRADE line and the strength parentheticals
    # removed, neither signal may survive. This is what caught the original
    # `\bhigh|moderate|low` alternation — the phrase "high malaria burden"
    # in a nearby research priority kept grade_nearby true.
    nrecs = [c for c in neg["candidates"] if c["source_kind"] == "recommendation"]
    if any(c["grade_nearby"] for c in nrecs):
        failures.append(f"[{how}] grade_nearby true with no GRADE marker present "
                        "(regex matching a bare certainty word)")
    if any(c.get("strength") for c in nrecs):
        failures.append(f"[{how}] strength detected with no strength parenthetical present")


def main() -> int:
    failures: list[str] = []
    fn = "sec-003-recommendations.md"
    title = "WHO Recommendations on Synthetic Test Care"
    stripped = re.sub(r"\(Strong recommendation.*?\)|GRADE:.*|\(Conditional recommendation.*?\)",
                      "", SECTION)

    res = direct(SECTION, fn)
    check(res, direct(stripped, "s.md"), failures, "direct")

    # Auto-detection: a guideline title is claimed by this class.
    if not WHO.detect({"title": title}, sections_of(SECTION, fn)):
        failures.append("[direct] detect() does not claim a WHO guideline")
    if WHO.detect({"title": "On the spectrum of a compact operator"},
                  [("s.md", {"section_title": "2 Preliminaries"}, "")]):
        failures.append("[direct] detect() claims a document with no guideline signal")

    extract = tools_extract()
    cli_note = "SKIP through the CLI: cat-harness-tools is not mounted"
    if extract:
        try:
            cli = via_cli(extract, SECTION, fn, title)
            check(cli, via_cli(extract, stripped, "s.md", "t"), failures, "cli")
            cli_note = f"ok through the CLI ({extract})"
        except RuntimeError as e:
            failures.append(f"[cli] extract-candidates failed: {e}")

    if failures:
        print("FAIL")
        for f in failures:
            print("  -", f)
        return 1

    print(f"ok — {res['summary']['candidates']} candidates, kinds {res['summary']['by_kind']}")
    print(cli_note)
    print("NOTE: synthetic fixture only; the real-layout question is untested "
          "(no L1 PDF in corpus, who.int egress 403).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
