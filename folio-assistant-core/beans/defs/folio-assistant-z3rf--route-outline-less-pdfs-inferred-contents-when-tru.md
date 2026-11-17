---
# folio-assistant-z3rf
$schema: bean/1.0.0
title: 'Route outline-less PDFs: inferred contents when trusted (6xaz + mean confidence >= 0.6), else page granularity (#2302)'
status: completed
type: task
priority: normal
created_at: 2026-10-07T05:08:20Z
updated_at: 2026-10-07T10:44:51Z
parent: folio-assistant-cp3v
---

Owner decision on #2302 (2026-10-07): option 1. A PDF with no outline uses its inferred contents when it passes the 6xaz concentration check AND the entries' mean confidence is at least 0.6; otherwise pdf-structure.py falls back to page granularity (one section per page) instead of today's single whole-document section.

## Todo
- [x] Measure the threshold on the benchmark corpus (mean confidence vs title F1)
- [x] Route in pdf-structure.py; page sections in the pdf-pages.py shape
- [x] Schema + diagnostics (mean confidence recorded)
- [x] Tests
- [x] Skill: document-intake / l1-document-ingestion
- [x] wpr-rdo-2020-003-eng: owner chose the third test (2026-10-07); the guide now routes to PAGES (48% empty sections), which its committed 33-page tree already is — no re-ingest, summaries kept
- [x] Third test: empty-section share, measured (72 PDFs) before fixing 25% / 50 chars
## Done when
pdf-structure.py routes as above with tests, and the style guide is re-ingested.

## Findings (2026-10-07)

- Mean confidence is a weak predictor: every consensus TOC on the 75 corpus PDFs
  scored 0.60-0.94; W3C PROV-O scored 0.72 at title F1 0.23. Exactly 0.60 means
  no entry was corroborated beyond its style.
- wpr-rdo-2020-003-eng routes to `inferred` under the rule (mean 0.602, 47
  sections) but the tree is poor: 18 of 47 sections hold 0 characters, logo
  lettering and the sample table's column heads become headings. Re-ingest held:
  it would replace 33 correct page sections (with draft summaries) by this.
  Decision put to the owner on #2302: a third test (share of empty sections),
  a higher floor, or keep the page tree.

## Summary of Changes

Merged in #2388 (7282e291). When a PDF has no outline, `pdf-structure.py` uses the inferred contents only if they pass three tests in `inferred_toc_trust`: the 6xaz concentration check, mean confidence ≥ 0.6, and at most 25% empty sections. Otherwise it falls back to one section per page (`granularity: "page"` plus a `structure_note`). Two new diagnostics (`toc_inferred_mean_confidence`, `toc_inferred_empty_share`) are in the schema; the tests are sections 9 and 10 of `pdf-toc-verdict.test.py`; the skills `l1-document-ingestion` and `document-intake` were updated. No library entry was re-ingested. Round summary on #2302.
