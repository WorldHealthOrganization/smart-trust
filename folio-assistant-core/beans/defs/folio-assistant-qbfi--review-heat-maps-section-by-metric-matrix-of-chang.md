---
# folio-assistant-qbfi
$schema: bean/1.0.0
title: 'REVIEW HEAT MAPS: section-by-metric matrix of change, coverage, findings, QA and staleness — published, never colour alone'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:55Z
updated_at: 2026-10-10T16:40:52Z
parent: folio-assistant-q4jm
blocked_by:
    - folio-assistant-jwox
---

Owner: *"heat map skills"*.

**Measured 2026-09-22.** The only heat map is `render_block_heatmap` in
`content-graph-analysis.py`. It draws a DOT/SVG of block DEPENDENCIES and
writes it to `/tmp`, and it is paper-oriented. Nothing aggregates QA, review
coverage or change density, and nothing is published on the site.

**What.** A section × metric matrix on the review page, plus the minimap
(child 06) as its one-column projection. The metrics:
- change density (ChangeSet, child 02)
- review coverage: blocks with a reviewer verdict ÷ changed blocks (child 08)
- open findings by severity (9gyz Findings)
- QA axis status (existing sidecars)
- staleness: last reviewed at an older content hash

**Rules.** Follow the `dataviz` skill for colour. Use a sequential scale per
metric, and **never colour alone**: each cell also carries a glyph or number,
for colour-blind readers and screen readers. The matrix is backed by a table
view of the same data.

**Skill.** A `review-heatmap` skill in folio-assistant-core/skills/review/
says what each metric MEANS and what it must not be read as. In particular,
coverage is not approval.

## Done when
- [ ] the five metrics are computed from published data (four of five; coverage waits on en2d), not from an agent's /tmp
- [ ] the matrix, minimap and table view are on the review page, and pass the dataviz validator in both themes
- [x] the skill is written, and content-graph.md points to it for the review use

## Measured and ruled 2026-09-23 (session_017nyJj3PsjvszpF3DyGeBgE)

**What published data exists, per metric:**

| metric | data today |
|---|---|
| change density | `changeset.json` |
| open review comments, by kind | `review-comments.json` (9gyz Findings are not published in previews) |
| staleness | each comment's recorded block hash vs `blocks.json` |
| review coverage | **none**: no per-block reviewer verdict is recorded (that comes with en2d) |
| QA | **not published**: the staging build does not copy the folio's QA results |

**Owner's answer: "1 2".**
- **1, now:** build the three columns that have data. Coverage and QA are
  columns that say "not measured yet" / "not published yet" in every row,
  never 0 or blank.
- **2, next:** make the staging build publish the folio's QA results, so the
  QA column becomes real.

**Built (option 1):**
- `cat-harness/scripts/review-heat.ts`: `computeHeat`, `heatBucket` and
  `renderHeat`, embedded by `toString()`.
- `blocks.json` now carries each block's `section`.
- The page's table uses a blue ordinal ramp that passes the dataviz validator
  in both themes, with every cell's ink at ≥ 4.7:1 against its fill.
- The `review-heatmap` skill says what each column means and must not be read
  as, and `content-graph.md` now points to it.
- 5 unit tests and 4 Playwright tests. Checked in Chromium, light and dark, on
  the scaffolded folio with real ingested comments.

**Deviations from the bean's text:**
- The skill is in `cat-harness/skills/folio-core/` beside `staging-review` and
  `review-comments`, not in `folio-assistant-core/skills/review/`. Core holds
  no skills package, and a review skill split from its siblings would be found
  by nobody.
- The minimap is not built here. It is the outline/minimap bean (`eb4l`).

**Built (option 2, same PR): the QA column is real.**
- Tool `folio-block-qa-summary` (`cat-harness/scripts/publish-block-qa.ts`)
  reads the folio's committed `block-qa/v1` verdicts and writes
  `block-qa.json` for the preview. Each block is failing, stale, passing or
  unaudited, with the sweep's own freshness rule.
- Stale outranks passing. That came from a real test: after one sentence was
  added to a swept block, 24 criteria went stale and it still read "passing".
- The graph hash is included. Without it, every detangler criterion read
  stale straight after a sweep.
- The summary reads verdicts at both anchors. The sweep writes under the
  directory it was run on, not the instance root (bean `s3p2` records it and
  waits on the owner).
- `folio-staging.yml` runs it after the ChangeSet. The heat map's QA column
  shows "N failing (worst) · N stale · N unaudited", or "passing".
- Checked on the scaffolded folio with a REAL sweep: `prose:overview` fails
  `voice-status-leak` (critical) on its placeholder text.

**Left:**
- coverage, which needs en2d's verdicts;
- the minimap (`eb4l`).

## Owner ruling 2026-10-06: the QA-column work waits for #2080

Chosen directly by the owner in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, from two options (recommended first):

1. **CHOSEN: hold the heat map's QA-column work until #2080 (5hox, QA results off main) merges.** The column reads per-block QA files that #2080 moves to the `qa-reports` branch, so it is built once, against where the files will live.
2. Build now and adapt after #2080 (not chosen: the same reader would be reworked twice).

The rest of q4jm (the end-to-end check on folio-test, comments, accept, the large fixture) is not held.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence, checked against `litlfred/cat-harness-tools` @ `80e46e7` and `litlfred/cat-harness` (shallow main clones). Nothing was changed in this repository.

The heat map is built and reads published data:
- `cat-harness-tools/scripts/review-heat.ts` (cites this bean) computes the
  section × metric rows for changed, open, stale, coverage and qa.
  - **Coverage** is real now, through `px0t`'s reviewer verdicts on the current hash.
  - **The QA column** reads `block-qa.json` from the `qa-reports` branch
    (`publish-block-qa.ts`), as the 2026-10-06 ruling required (#2080/5hox).
- A column with no data says so, per row, rather than showing 0.
- `gen-review-page` embeds `computeHeat` itself, so the tested function is the
  one the page runs.

Moved out, as already recorded: the minimap is bean `eb4l`. Not re-checked
here: a dataviz-validator pass in both themes on a built review page. That
needs a site build of the harness, so any defect it finds belongs to the
cat-harness-tools store, where the renderer lives.


## Summary of Changes

Mirror copy. Owned by litlfred/folio-assistant-core's store, where drain lane C closed it (folio-assistant-core#28; shipped as review-heat.ts). Closed here so no lane repeats it.



## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence, checked against `litlfred/cat-harness-tools` @ `80e46e7` and `litlfred/cat-harness` (shallow main clones). Nothing was changed in this repository.

The heat map is built and reads published data:
- `cat-harness-tools/scripts/review-heat.ts` (cites this bean) computes the
  section × metric rows for changed, open, stale, coverage and qa.
  - **Coverage** is real now, through `px0t`'s reviewer verdicts on the current hash.
  - **The QA column** reads `block-qa.json` from the `qa-reports` branch
    (`publish-block-qa.ts`), as the 2026-10-06 ruling required (#2080/5hox).
- A column with no data says so, per row, rather than showing 0.
- `gen-review-page` embeds `computeHeat` itself, so the tested function is the
  one the page runs.

Moved out, as already recorded: the minimap is bean `eb4l`. Not re-checked
here: a dataviz-validator pass in both themes on a built review page. That
needs a site build of the harness, so any defect it finds belongs to the
cat-harness-tools store, where the renderer lives.
