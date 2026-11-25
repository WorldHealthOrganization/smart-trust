---
# folio-assistant-eqly
$schema: bean/1.0.0
title: 'validate: a block on disk listed in no section, or listed and absent, is not a validation finding'
status: completed
type: feature
priority: normal
created_at: 2026-10-04T15:52:13Z
updated_at: 2026-10-05T07:18:00Z
parent: folio-assistant-0lmb
---

Recorded from the qou orphaned-content census, 2026-10-04 (ORPH report; session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91, issue #2106). qou: 3 of 3,676 block manifests are in no chapter section and render nowhere, each with .md, .ts and a QA sidecar (e.g. prop:atomic-q-reeb-universal-rho). cat-harness validate.ts has no rule for 'on disk, in no section' or 'in a section, not on disk'. Proposed: one rule, both directions, reported per block.

_2026-10-05T06:48:05Z_ — Claimed by claude/eqly-orphan-blocks — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Progress 2026-10-05 (session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi)
Branch claude/eqly-orphan-blocks. Rule `no-unlisted-block` added to validate.ts (warning, per block, `[unlisted-block]`); only manifests that parse as a Block count; a chapter with a section reference reports `info` (undetermined) instead. The 'listed, absent' direction already existed (`Block manifest not found`, error) and is now pinned by a test. Measured against qou c452a0f9 with a manifest-membership approximation: exactly 3 of 3,676 unlisted, matching the census.

## Closed 2026-10-05 — landed in #2163 (main 88a0ce1eebab)

Both directions are now findings. 'In a section, absent from disk' was already an error (`Block manifest not found`) and is pinned by a test. 'On disk, in no section' is the new `[unlisted-block]` warning in `cat-harness/content/pipeline/validate.ts` (`checkUnlistedBlocks`), reported per block. When a chapter lists a section by reference, membership cannot be decided from the manifest, so it reports a single 'could not determine' info line and claims no orphans. Tests: `cat-harness/scripts/tests/validate-unlisted-block.test.ts` (5); with the rule disabled, 2 of the 5 fail.

Not done here: the 3 qou blocks the census found. qou is a math repo and needs owner sign-off, so the rule reports them and nothing in qou was changed.
