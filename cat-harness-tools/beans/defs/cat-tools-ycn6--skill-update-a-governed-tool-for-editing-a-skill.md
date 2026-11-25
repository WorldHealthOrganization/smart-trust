---
# cat-tools-ycn6
$schema: bean/1.0.0
title: 'skill_update: a skill edit goes through a governed Tool, not a raw file write (folio-assistant#875)'
status: completed
type: feature
priority: normal
created_at: 2026-10-29T12:10:00Z
updated_at: 2026-10-30T13:55:00Z
---

Governing issue: litlfred/folio-assistant#875. Spec: the spec-kit comment on that issue, Adjudicated by the owner 2026-10-29 11:33Z (card "A. Accept all four, then build"):

1. A write edits the working tree, and the agent commits it.
2. Only Roles the owner grants may write. The permission is `skill-update`, and no default policy grants it.
3. A gate that cannot decide refuses.
4. A skill in another layer is refused, and the result names the owning repo.

Definition: litlfred/cat-harness `tools/skill-update/` and the `skill-update` permission in `skills/permissions/permissions.json`. Implementation: `src/tools/skill-update.ts`, next to `skill_fetch`.

## Done when

- [x] FR-001–004, FR-006–008: the Tool, its gates and its QA node (this PR and the cat-harness PR)
- [x] FR-005: accepted writes are persisted as PROV-O activities. The Tool returns the activity today when a step is named. Where to persist it, and whether refused calls are logged at all (the engine records none: "it did not happen"), is open on the PR.
- [x] Graduation (FR-013): the accepted FRs become `req:*` statements with tests

Session: https://claude.ai/code/session_01Qmmkt7rXCDPexdBbNqeJqU

_2026-10-30T13:35:00Z_ — Filed: litlfred/cat-harness#727 (merged c53d772) adds `skills/requirements/skill-update.json`, `req:skill-update`, `status: proposed`, from the adjudicated spec (filing at adjudication, owner 2026-10-30 option E on cat-harness#686). SC-001 to SC-004 keep their spec keys. The graduation box stays open: `status` flips to `in-force` once FR-005 is settled and built. FR-005's open question (where the activity is persisted, and whether refusals are logged) is the one thing left, and it needs the owner. (https://claude.ai/code/session_01Qmmkt6TFC8Yd4jePf6WnBv)

_2026-10-30T13:55:00Z_ — Completed. FR-005: the owner chose option A (card "A. On the workflow step", 13:31Z): an accepted write's activity is kept on its workflow step. Built in litlfred/cat-harness-tools#887 (merged 07f57ca): `workflow_complete` takes `activities` and the engine keeps them on the step's history entry, refusing a malformed or wrong-step one. Graduation: litlfred/cat-harness#729 (merged 4d3ce5f) flips `req:skill-update` to `in-force`. (https://claude.ai/code/session_01Qmmkt6TFC8Yd4jePf6WnBv)
