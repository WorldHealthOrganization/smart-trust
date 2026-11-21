---
# folio-assistant-d6bw
$schema: bean/1.0.0
title: 'Skills, processes and docs: QA lives on qa-reports — update every skill, BPMN and page that says test/results is committed'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:00:47Z
updated_at: 2026-10-01T18:03:20Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-16ei
---

Arc `3fva`, proposal §4 Phase 4. Can be dispatched once qa-store lands. Edit the SKILL, not AGENTS.md. AGENTS.md gets a pointer only.

- Skills:
  - `qa-witness`
  - `prepare-merge` §"Conflicts in test/results/"
  - `audit-coverage`
  - `directory-conventions`
  - `content-context-and-state-graphs`
  - `skill-registration`
  - `ci-health`
  - `untainted-verification`
  - `qa-report-signing`
  - `test-engineer`
  - `content-test`
- Processes:
  - `code-quality-gates.bpmn`, which gains a publish step
  - a new `qa-publish.bpmn`
  - `qa-report-signing.bpmn`, whose output goes to the branch
- Then `skill:register` and `render:bpmn`.

## Done when
- [x] no skill tells an agent to commit or hand-resolve `test/results/**`
- [x] `skill:register:check` and `render:bpmn:check` are green



## From the reader audit (`gxvk`, 2026-10-01)
`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §5.6 lists 13 F-class sites. Files that tell an agent `test/results/**` is committed, missing from the list above:
- `skills/kg/graph-management/lsi-indexing.md` (4)
- `skills/sdlc/sdlc-core/platform-gates.md` (2)
- `skills/sdlc/sdlc-core/decision-audit.md` (2)
- `skills/kg/kg-core/skill-voice-review.md` (2): it must name `test/attestations/`
- one mention each in `wireframe-design-review`, `readme-sections`, `liquid-templates`, `gate-tree-mutation`, `coordinate`, `adjudication`, `role-model`, `methodology-adoption`, `domain-fencing`, `deletion-requires-confirmation`
- the memories `never-assert-on-a-qa-verdict-from-the-published-corpus`, `derive-the-gate-list-from-the-workflow` and `.claude/agent-memory/ci-health-watcher/MEMORY.md`

Counts are from `rg -c 'test/results|kg-qa sidecar|qa-results\.json' -g '*.md'`.

## Summary of Changes

Branch `d6bw-qa-reports-skills`, worktree `agent-a70932b891e633e4f`, on top of `52345604` (head of PR #1801). Not pushed.

**New skill `qa-reports`** (`skills/sdlc/sdlc-core/`) is the one home for the concept. Derived results go to the orphan branch and judgements go to `test/attestations/`. Gates compute and judge, and a missing baseline is unknown. It also covers the five read states and gives a "what to do, by situation" table. The other skills point to it rather than restating it. `build-pipeline` and `validation-pipeline` carry it.

**Skills changed, each for what was false:**
- `qa-witness`: said witnesses are "committed". They are a working copy with a stored record. It now also names the judgement store.
- `prepare-merge`: §"Conflicts in `test/results/` and `test/attestations/`" says to regenerate the first and have a person read the second. The resolver now reads the store, and the section says to migrate a refused judgement rather than hand-edit it. It also gives the owner's merge policy.
- `continual-progress`: new §"Green means handed to the Merge Steward" (Ready, `ready-to-merge`, `ready: <sha>`, never merge). "Merge anyway" now reads "mark it ready anyway".
- `audit-coverage`: `--check` "fails on a stale sidecar" is replaced by "new against a baseline", with an unknown baseline. It adds the `unknown`/`stored` kind states.
- `directory-conventions`: the `qa` row names the branch. New §"`storage`", and the checklist no longer says "committed sidecar".
- `content-context-and-state-graphs`: `attestations` is state that cannot be rebuilt.
- `skill-registration`, `platform-gates`, `lsi-indexing`, `readme-sections`, `liquid-templates`, `role-model`, `coordinate`, `deletion-requires-confirmation`, `adjudication`, `decision-audit` (cite `qa-reports:<key>`), `skill-voice-review` (voice reviews are attestations), `ci-health` (`qa-publish` is not a gate), `untainted-verification` (the verdict's home is the store), `qa-report-signing` (the signed report goes to the branch, a certification stays on main), `test-engineer` (no `test/results` fixtures), `content-test` (where results go).
- Memory `never-assert-on-a-qa-verdict…`, plus the regenerated `MEMORY.md` (line count unchanged).

**Processes:**
- New `qa-publish.bpmn` covers the publish job and the prune run. `qa-reports-prune.yml` now declares it, and it is indexed on the publication-workflow page.
- `code-quality-gates.bpmn`: `Task_QaPublish` was already drawn. It is now a call activity into `qa-publish`. The process text no longer says "no job declares needs" or counts `qa-publish` as a warn-only gate.
- `qa-report-signing.bpmn`: gains `Task_StoreSigned`.
- No activity touches the work plan, so none carries a bean op, as `bpmn-processes` says.

**Docs:** an `AGENTS.md` pointer, and the QA section of `agent-onboarding`.

**Left:**
- `recordUntainted` still writes agent entries into the derived sidecar. The next writer, or `qa:attestations:migrate`, moves them.
- `kg:audit:check` still fails on a stale sidecar. That is 3.1a.
- Whether to keep `domain-fencing` and `methodology-adoption`'s historical mentions as they are.
