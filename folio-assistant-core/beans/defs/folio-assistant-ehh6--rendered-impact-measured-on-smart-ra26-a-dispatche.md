---
# folio-assistant-ehh6
$schema: bean/1.0.0
title: 'RENDERED IMPACT, measured on smart-ra#26: a dispatched staging run finds its PR; a file the site reads nothing from reaches no page; the review page shows the measurement'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T18:25:34Z
updated_at: 2026-10-06T21:25:11Z
parent: folio-assistant-q4jm
---

Found by the real staging run on litlfred/smart-ra#26 (run 37507489070, bean dpi-h-ra-7ss8).

A. folio-staging.yml reads the PR only from a pull_request event. smart-ra runs staging by dispatch only (owner decision 2026-10-06), so PR=n/a, no bot comment, no review-comment ingestion, no qa-reports fetch, though GitHub lists the run under #26.
B. document-rendered-impact.ts puts every unplaced file at 'may change any page'. The bean file beans/dpi-h-ra-7ss8*.md landed there; no document builder reads the work plan, and an undetermined input holds the coverage gate shut, so nearly every PR would be blocked by a false alarm.
C. The review page lists the prediction but not rendered-measured.json: misses and not-base appear only in the PR comment, which A suppressed.

## Done when
- [x] A dispatched run on a branch with an open same-repo PR uses that PR's number and base everywhere the pull_request run does, and comments on it.
- [x] A changed file under no declared directory, no submodule, not .github/, and not a non-Markdown root file is an input that reaches no page; every other unplaced file stays undetermined; no declaration keeps today's behaviour.
- [x] The review page shows the measurement: missed pages, not-base, or not measured, never silence.
- [x] Tests for each; gates green.

Held by claude/laughing-ramanujan-uripip (session https://claude.ai/code/session_01HzVuZ2axYhgcko3rodMh2S).

## Summary of Changes

Landed in #2310 (merge 9452bc6), CI green on every gate, merge guard PASS.
- A: folio-staging.yml 'Find the pull request' step; later steps read steps.pr. Tests run the step with a fake gh.
- B: document-rendered-impact.ts siteMayRead/siteReadsOf: declared dirs, submodules, .github/, non-Markdown root files may be read; anything else reaches no page; no declaration excludes nothing.
- C: review-rendered.ts measuredModel/renderMeasured; gen-review-page fetches rendered-measured.json. Checked in Chromium on the smart-ra#26 files.
The confirming re-run on smart-ra#26 (submodule past 9452bc6) is the folio's bean dpi-h-ra-7ss8.

## Reopened 2026-10-06: B did not hold on the real run

smart-ra#26 run 37517493046 (folio-assistant 9452bc6): A worked (PR 26 found, comments ingested; the comment POST got a GitHub 500). B did not: smart-ra's dpi-h-ra.json now DECLARES beans/ and todos/, and 'declared' was the test for 'may be read', so the bean stayed 'any page'. The site reads todos/ (gen-node-kind-pages renders todo pages) and not beans/. Owner, 2026-10-06, option 1 of 3: each site builder declares what it reads.

- [x] build-document-site, public-comment-site and gen-node-kind-pages export siteReads(repoRoot, args); the predictor finds the builders in the folio's build command and unions their reads; a builder with no siteReads excludes nothing.

## Closed 2026-10-06 on evidence

- #2318 (merge 8604cf2): builders declare siteReads; predictor asks the folio's build command. CI green.
- smart-ra#26 run on b9bf022 (folio-assistant 8604cf2): A confirmed (bot comment posted by the dispatched run), C confirmed (review page reads rendered-measured.json; status not-base, 11 measured). 'Not known' lists only the submodule.
- B was NOT exercised by that run: the branch had dropped its beans/ file, so no bean was an input. B's evidence is the unit tests (site-reads.test.ts, document-rendered-impact.test.ts) and a local run on smart-ra's branch with its real build command (beans/, README.md, library/, input/, uploads/ reach no page; todos/ and the submodule stay any page). The first PR on smart-ra that touches an undeclared-read file is the live check.
