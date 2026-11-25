"""A title is taken only when an independent source corroborates it — bean `w6fu`.

Owner's ruling 2026-10-02 on issue #1838: the ingest path tries the PDF's
`Title` metadata, the first page's largest heading and the outline before the
text walk, and **never guesses** — with no trustworthy source the raw title is
kept and marked unverified. Each case below is a shape measured on this
repository's own library, written as evidence rather than as a PDF, because
`resolve` is pure over the evidence dict.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import _pdf_title as t  # noqa: E402

failures = 0


def check(name, got, want):
    global failures
    if got != want:
        failures += 1
        print(f"FAIL {name}: got {got!r}, want {want!r}")
    else:
        print(f"ok   {name}")


# The text walk ran on into the status block; the metadata title is printed on page 1.
r = t.resolve(
    {"metadata": "PROV-O: The PROV Ontology", "page_text": "PROV-O: The PROV Ontology\nW3C Recommendation"},
    "PROV-O: The PROV Ontology W3C Recommendation 30 April 2013 This version: Editors:",
)
check("metadata printed on page 1 wins", (r["title"], r["source"], r["verified"]), ("PROV-O: The PROV Ontology", "metadata", True))

# A production label is never a title, and with nothing else the raw title stands, unverified.
r = t.resolve({"metadata": "Microsoft Word - gurel_emet.doc", "page_text": "Microsoft Word - gurel_emet.doc"}, None, "gurel-tat")
check("production label refused; no guess", (r["title"], r["verified"]), ("gurel-tat", False))
r = t.resolve({"metadata": "arXiv:0909.4061v2  [math.NA]  14 Dec 2010"}, "Some raw walk")
check("arXiv stamp refused; raw kept", (r["title"], r["source"], r["verified"]), ("Some raw walk", "text", False))

# One source alone is not enough, however plausible.
r = t.resolve({"heading": "An Introduction to Latent Semantic Analysis"}, None, "landauer")
check("an uncorroborated heading is not taken", r["verified"], False)

# A browser print: the page attests nothing about the metadata title, but the
# heading and the metadata still agree. The site name is cut back.
r = t.resolve(
    {"metadata": "Agent Skill best practices | Gemini CLI", "heading": "Agent Skill best practices",
     "page_text": "Agent Skill best practices | Gemini CLI\nAgent Skill best practices", "browser": True},
    None, "agent-skill-best-practices---gemini-cli",
)
check("browser print: heading corroborated by metadata, even when the metadata equals the slug",
      (r["title"], r["source"], r["verified"]), ("Agent Skill best practices", "heading", True))

# Letter-spaced type: the metadata's typed spelling of the same letters wins.
r = t.resolve(
    {"metadata": "Skill authoring best practices - Claude Platform Docs",
     "heading": "Skill a ut h or i n g be st pr ac t ice s", "browser": True},
    None, "skill-authoring-best-practices---claude-platform-docs",
)
check("metadata spelling of a letter-spaced heading", r["title"], "Skill authoring best practices")

# The slug is still refused as the CHOSEN title.
r = t.resolve({"metadata": "Skills in OpenAI API", "browser": True}, None, "skills-in-openai-api")
check("a metadata title equal to the slug is not chosen on its own", r["verified"], False)

# Agreement ignores spacing and a line-end hyphen.
check("agree ignores spacing", t.agree("KeywordsforuseinRFCs", "Key words for use in RFCs"), True)
check("agree rejoins a line-end hyphen", t.agree("AUTOFOR- MALIZATION IN LEAN", "Autoformalization in Lean"), True)
check("one shared word is not agreement", t.agree("Handbook", "WHO Handbook for Guideline Development"), False)

# apply() is idempotent and never touches an editor's correction.
corr = {"title": "X", "basis": "page 1", "corrected_on": "2026-10-02"}
md = {"title": "raw walk", "title_correction": corr}
once = t.apply(md, {"metadata": "Real Title", "page_text": "Real Title"}, "slug")
twice = t.apply(once, {"metadata": "Real Title", "page_text": "Real Title"}, "slug")
check("apply resolves", once["title"], "Real Title")
check("apply keeps the raw title", once["title_raw"], "raw walk")
check("apply is idempotent", twice, once)
check("apply leaves title_correction alone", twice["title_correction"], corr)

sys.exit(1 if failures else 0)
