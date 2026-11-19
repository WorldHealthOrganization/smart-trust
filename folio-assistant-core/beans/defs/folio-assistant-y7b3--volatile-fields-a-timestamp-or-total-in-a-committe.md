---
# folio-assistant-y7b3
$schema: bean/1.0.0
title: 'VOLATILE FIELDS: a timestamp or total in a committed generated file turns every pair of concurrent changes into a conflict'
status: completed
type: task
priority: normal
created_at: 2026-09-30T22:25:16Z
updated_at: 2026-10-04T13:34:40Z
parent: folio-assistant-o3xy
---

Follow-on to #1658 (bean 52cz, done) and beans oxka / 520m / lxpq (completed). Owner 2026-09-30 chose MEASURE line-level before building a resolver.

## Measured 2026-09-30

300 recent main-into-branch merges on origin/claude/* replayed with git merge-tree (read-only). 235 conflicted; 147 (63%) conflicted ONLY on generated files.

Top four, what the conflicting lines are:

| file | conflicted merges | conflicting content |
|---|---|---|
| skill-register.qa-results.json | 89 | updated_at on 80 of 86 hunk lines; script_hash 6 |
| glossary/index.md (-merge) | 87 | real new DefinedTerms + header and TOTAL-count lines |
| beans/README.md | 76 | only the '| defs/ | N files |' count line |
| audit-coverage.qa-results.json (-merge) | 60 | updated_at every time, count-bearing summaries, some real gate-list changes |

Across 150 merges / 1174 conflicted files, hunks compared with digits, hashes and timestamps masked:
- 508 (43%) differ ONLY in a number, hash or timestamp
- 270 real content
- 396 whole-file (-merge files: no hunks to inspect)

Only 33 of 150 merges would have been fully clean without volatile fields: the -merge files and real content remain.

## Mechanism

writeQaResult already refuses to restamp unchanged findings (ymsu). The collision is when BOTH branches change findings: each writes a new updated_at, and that single line collides while the rest of the body merges cleanly. A total count behaves the same. Checks already strip updated_at before comparing (subgraph-readmes:158, root-scan-census:242, check-reference-direction:917, audit-coverage:527), so it carries no verdict.

## Done when
- [x] line-level measurement recorded
- [x] owner decides which fix: "remove volatile fields" (2026-09-30)
- [x] part 1: qa-results carry no updated_at (#1714)
- [x] part 2: subdirectory file counts in generated READMEs — answered by bean `ba9e` (counts off `main`, into the KG JSON-LD; owner 2026-10-02)

## Part 2 — open, deliberately

The `N files` count per subdirectory in generated directory READMEs (`beans/README.md`: 76 conflicts in the sample, every one on that line) is rendered by `litlfred/bootstrap-tools` (a submodule since 2026-09-30), and is an intended feature (owner, 2026-09-29: large instances show a count instead of listing every file). Options put to the owner: round to a band (`1,000+ files`), drop the count, keep exact counts. Owner: decide later. Not a blocker for #1714.

## Found in passing
`cat-harness/test/results/kg-export.@litlfred/folio-assistant.qa-results.json` is an orphan: unwritten since 2026-09-23, producer path pre-split `scripts/kg-export.ts`; the exporter now names the host's sidecar `kg-export`. Owner, 2026-09-30: "ok move to fsh-guts" — moved to `fsh-guts/retired/kg-export-folio-assistant-orphan-sidecar.md`, content kept inside the manifest.


## Handover evidence, 2026-10-01 (session_01Cw8JgZEDT5VqQ5ergjdMjB)

The GOAL 2 handover (issue #1260) names the same class again: the beans README, the LSI index and page, and the detangle, kg-qa, kg-export and source-licence sidecars go stale on main after merges, so every open PR then conflicts on them, and a conflicting PR runs no CI. It asked for a bean; this one, `cflw` and `do70` already hold it, so the evidence is recorded here rather than in a fourth.

Measured on main at aeeb6bab: `readme:subgraphs:check` 0 stale; `kg:audit:all:check` 17 of 17 clean. So the drift reported on 663ce6d had cleared by the time it was re-checked, which is the intermittent shape this bean describes.



## Closed 2026-10-04, at the owner's instruction ("close y7b3")

Every box is ticked, and both parts have landed on `main`:
- **part 1:** QA results carry no `updated_at` (#1714);
- **part 2:** answered by bean `ba9e` (completed). bootstrap-tools#8 made the generated README rows independent of file counts; folio-assistant#2044 publishes the counts as `fileCount` in the KG JSON-LD, and the viewer shows them; #2075 closed `ba9e` with the live-site evidence.

Closed by session_01Jf39Vh4B8EQT6TBYzTtMCA.
