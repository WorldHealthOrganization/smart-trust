---
# folio-assistant-16ei
$schema: bean/1.0.0
title: 'qa-store: one read/write API for QA results, qa:fetch / qa:publish, ContentDirectory.storage, CI publish and a prune that fires'
status: completed
type: feature
priority: high
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-06T06:09:21Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §2.2–2.4 and §4 Phase 2. Blocked on the SPIKE bean. Serial, one agent: everything else depends on this.

- `qa-store` module:
  - `readQa(ref, path)` returns hit / miss / corrupt / unknown, and a miss is never read as clean;
  - `publishQa(ref)` follows the lake-cache write path, with fetch → rebuild-on-tip → push, 3 attempts and `backoff-sleep.ts`, and never `-f`.
- `bun run cat qa:fetch [--ref main|<sha>|pr/<n>]` and `bun run cat qa:publish`.
- `storage: {branch, keyedBy}` on `ContentDirectory` (`schemas/cat-harness.ts`). `test/results/` goes into `.gitignore` only when it is set. `audit:coverage` and `check:harness-dirs` both honour it.
- CI publishes `main/<sha>` on push and `pr/<n>/<sha>` on PR (D3). A `check-workflows` finding `qa-reports-unretried`.
- A prune workflow on `schedule`. The lake-cache prune never ran, because its trigger cannot fire.

## Done when
- [x] the module has 4-state tests on real git repositories, not mocks (as `520m` did) — `scripts/tests/qa-store.test.ts`
- [x] main and PR runs publish, and a sibling's entry survives concurrent writes — the concurrent-writer survival is tested locally against a real bare remote (a forced race, and two CLI processes started together); CI has not published yet, because nothing is pushed — **verified 2026-10-06: CI publishes both kinds on `cat/cat-harness/qa-reports` — `main/1b17452d…`, `main/9e43d531…`, `pr/2250/…`, `pr/2251/…`, `pr/2252/…` written within seconds of each other (06:04–06:07Z), each entry surviving the next writer.**
- [x] the prune runs on schedule at least once — **verified 2026-10-06: `qa-reports prune` ran on `schedule` three times — runs 37181406971 (10-04), 37265199564 (10-05), 37414373793 (10-06), all success.**


## Progress 2026-10-01 (branch `worktree-agent-ab1c210ad9aa5cbbf`, NOT pushed)

Held by session https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR (sub-agent of `claude/quirky-davinci-ixuymr`). Announced here rather than through `beans:claim`, because this session pushes nothing.

- [x] `cat-harness/scripts/qa-store.ts`: `resolveQaLocation`, `readQa` / `readQaTree` / `readQaManifest` (hit / miss / corrupt / unknown; exit 0 / 1 / 3 / 4, usage 2), `fetchQa` (one batch, never deletes, reports `extra`), `publishQa`, `pruneQa`, and `githubPublishDecision` (fork skip).
- [x] `qa:fetch`, `qa:publish`, `qa:prune` in package.json.
- [x] `storage: {branch, keyedBy: "commit"}` on `ContentDirectory`, set on no declaration. Honoured by `check:declared-dirs`, `harness:dirs` (neither creates the directory nor lists it as missing) and `audit:coverage` (new state `stored`). Nothing is `.gitignore`d yet.
- [x] CI: a `qa-publish` job in `code-quality-gates.yml` (`needs: gates`, `always()`, `contents: write`), `Task_QaPublish` in the BPMN, `gates.ts` skips publisher jobs, and `check:workflows` has the new finding `qa-reports-unretried`.
- [x] `.github/workflows/qa-reports-prune.yml`: a schedule, plus a dispatch that is a dry run by default. It was not run.
- [x] Tests on real temporary repositories (`qa-store.test.ts`, `directory-storage.test.ts`, `qa-reports-ci.test.ts`).
- [x] the first CI publish (this needs the branch pushed and merged) — **verified 2026-10-06: see the first box — main and PR entries are on the branch.**
- [x] the first scheduled prune — **verified 2026-10-06: run 37181406971, 2026-10-04, event `schedule`, success.**

Measured read-only against the real remote: `qa:fetch` on `qa-reports` returns a MISS (exit 1), because the branch does not exist yet. A read of spike entry `qa-reports-spike:main/cdb0a018…` returns CORRUPT (exit 3) in 2.4 s, because spike manifests have no `payloadTree`.


## Production evidence 2026-10-01 11:3xZ (parent session)
Merged into `claude/quirky-davinci-ixuymr` (`1d49d343`, `475e5ca7`). The agent's own full-gate run was cut off by a container restart, so the parent verified instead: tsc 0, eslint 0, qa-store/storage/CI tests 48/48, `check:workflows` 0, `audit:coverage:check` 0. CI `bun test` on `475e5ca7`: 21 failing tests, all on main's list too; none new.

**First real publish:** the `qa-publish` job on PR #1764 created `qa-reports` at `6cb19a24` (author `folio-qa-bot`): `index.json` plus `pr/1764/475e5ca7…/`, 1150 files, 8,231,995 bytes. It ran after red gates, as designed (`always()`).

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").
