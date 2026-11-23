---
# folio-assistant-h1wq
$schema: bean/1.0.0
title: 'JUDGE the four typed-only kinds: health, todos, interaction, issue-marks'
status: completed
type: task
priority: normal
created_at: 2026-09-24T17:30:16Z
updated_at: 2026-09-24T17:40:31Z
parent: folio-assistant-1swy
---

From `audit-coverage`'s `typed-only` finding. Four kinds declare a validator that
parses their nodes, and nothing had an opinion about what those nodes SAY. The
owner chose all four (2026-09-24), having been told the risk: `health` and
`todos` already have machinery, so a criterion here could be a second answer to
a settled question.

## Summary of Changes

`cat-harness/scripts/check-harness-state.ts` — one script, four families, one
gate. Not `kg-audit`: its stated subject is one criterion per join in the
actor→role→skill→task sentence, and these are `state`/`context` graphs, not joins.

| family | subject | on this tree |
|---|---|---|
| `health-result-is-from-the-current-producer` | the committed report's `producer.script_hash` | **FIRED** |
| `todo-process-references-resolve` | a `processes:` entry naming a real BPMN id | 3 examined, empty |
| `issue-mark-accounts-for-edits` | `lastCommentId` with no `lastUpdatedAt`; `checkedAt` before `lastUpdatedAt` | 2 examined, empty |
| `interaction-profile-is-read` | a declared profile nothing names | 1 examined, empty |

The risk was answered by reading rather than assumed: **no gate declared
`@covers health` or `@covers todos` at all**, so none of these duplicates one.

### The one that fired, and why it mattered

`repository.health-report.json` recorded `producer.script_hash: 760c506fd051`
against a checker at `1401c8090bf5`. Not a staleness nit: that result's staging
finding still told a reader to *"have the owner add `staging:cleanup` to the PRs
whose previews are finished with"* — which bean `7umv` had **proved cannot reach
an orphaned preview**. A person reading the committed health report was being
told to do something this repository had established was impossible.

Fixed by `bun run cat health`.

### Two defects in my own check, both caught by falsifying it

- **It re-derived the hash.** The first version computed `sha256(run.ts)` and
  could never have passed: the field records `checkerHash`, which hashes THREE
  modules because any can alter a verdict. Re-running `bun run cat health` moved the
  recorded hash and the check stayed red — that is how it surfaced. **A staleness
  check calls the producer's own hash function; it never re-derives one.** A check
  that cannot pass is indistinguishable from a corpus that cannot be fixed, and
  somebody eventually deletes it.
- **`nodesOf` listed every file twice.** The repository root and `cat-harness`
  both resolve `todos` to `./todos`, so three items read as six and one planted
  defect was reported twice. A doubled denominator is worse than a wrong one: it
  reads as coverage while measuring the same file again.

### Verified

All four families falsified — plant a defect, it fires; restore, it goes quiet.
Nine tests. `--strict` is now GREEN, so CI runs it as a second step beside
`--require-all`: the two lock different things and a reader should see which
broke.
