---
# folio-assistant-4rbc
$schema: bean/1.0.0
title: 'CI cone: enable the f017 input-hash skip under CI, seeded from main''s last green run'
status: completed
type: task
priority: normal
created_at: 2026-10-07T19:39:28Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-hfag
---

Issue #2456. Owner approved 2026-10-07 ~19:40Z ("1y, 2y, 3y, 4y"). Measurements in the issue body.

_2026-10-07T19:39:38Z_ — Claimed by claude/ci-cone-f017 (session https://claude.ai/code/session_013WbQekVypi9A6YQbLDXMmJ).

## 2026-10-07: the approach as specified skips nothing, so no CI plumbing was built

**The falsifier hit before any code was written.** Under f017's existing rules, a pull request skips a check only when that check's fingerprint equals the one main recorded. Today no PR can meet that condition.

**What was measured, on `origin/main` @ 1d28c5c4562:**
- `bun run input-hash:coverage` reports 222 declared tasks: 162 skippable, 3 undetermined, 1 audit-clean but undeclared, and 56 blocked by an input site.
- Every one of the 162 is declared `inputs: [{tracked}]`, the whole working tree. That covers `TREE_READER` in `cat-harness/scripts/task-io.ts` and every `taskIo` row in `smart-base.json`, `who-iris.json` and `fhir-harness.json`. No task declares a narrower glob list.
- **What a beans-only edit does:** appending one line to one bean changed the fingerprint of `check:workflow-coverage` and of `check:import-direction`. Neither check reads beans. Measured with `checkFingerprint` in about 350 ms each. The `{tracked}` digest is part of every skippable fingerprint, so any change to any tracked file moves all 162.
- So, against main's last green run, a PR skips 0 checks and saves 0 runner-seconds. The same holds for a beans-only PR, the motivating case. Restoring the record would cost runner time and buy nothing.
- **The only case that would skip is a PR merge tree identical to a green main tree.** That case is issue #2456 item 2 (verdict reuse on main), not this bean.
- Checks with a `head` or `refs` site also hash the commit id. Those would miss even on an identical tree, because a PR merge commit is never main's commit.

**Test level (design item 5): same blocker.** A test file reads the tree like a gate does. With nothing narrower than `{tracked}` to declare, its import closure is not its input set. Fixture reads, directory walks and spawns are file reads that the closure does not name.

**What would make the cone real.** Each check needs an input set narrower than the tree, and that narrowing must be checked rather than merely claimed. `task-io.ts` currently forbids an unchecked narrow list: "a narrower list is a claim about FILES the audit cannot check". Two ways to check one:
1. **Declared narrow inputs, verified by a trace on main.** Each check declares globs. On every main run the check also runs under `strace -f`, recording opens, stats and directory listings. A read outside the declaration marks that declaration undetermined from then on.
   - Why this is sound, given f017's input-site audit: identical declared inputs and identical code give an identical run, so the same reads.
   - Cost: one declaration per check, 162 in all, which can be drafted from the first trace. The trace also makes the main run slower.
2. **A recorded read set, with no declaration.** The trace from main's green run is used directly as the check's inputs.
   - Less authoring than option 1.
   - It moves the "declared, not inferred" rule from f017. That rule is the owner's to change.

Both options need an owner decision. Until then this bean stays open, with no CI change.

## 2026-10-07 ~20:00–20:08Z: owner rulings

After the measurement above, the owner chose option 1, *"1y"*: narrow inputs, verified on every main run. He then refined it twice:

- *"derived is BEST"*: the narrow sets are DERIVED, computed by a deterministic, re-runnable procedure. They are neither hand-declared nor inferred.
- *"DERIVED = no drift, no extra data fields"*: no committed input-set file and no new `inputs` field. The read set is computed from the run itself and never stored as authored data.

**The rule becomes: an input set is declared or derived (computed from the run itself, never stored), never inferred.** It is stated in:
- `ci-health.md` §"A green step can be a SKIPPED one: the CI cone";
- the `input-hash.ts` and `task-io.ts` docblocks;
- the `ci-cone.ts` module comment.

## Design as built

1. **Record, on a push to main.** `gate-shell.sh` runs every `bun run <check>` step of `gates-kg` and `gates-docs` through `ci-cone.ts run`, which runs it under `strace -f`. A green run records, in `build/ci-cone/records.json`:
   - every path inside the checkout that the run opened, stat'ed, listed or probed, with the state it had (content digest, sorted listing, or absent);
   - every git command the run executed (only read-only subcommands with no stdin), with its exit status and output digests;
   - the check's f017 fingerprint without the tree: import closure, audited environment, tool versions and `--against` baseline.

   The job saves the file with `actions/cache/save` under `ci-cone-v1-<job>-<main sha>`.
2. **Decide, on a pull request.** The job restores the record under `<job>-<base sha>`, falling back to the newest `<job>-` key. `ci-cone.ts decide` re-computes the fingerprint, re-hashes every recorded path, and replays every recorded git command on the PR's tree. It skips only on an exact match. The step then prints `SKIPPED — inputs unchanged since <sha>` and is listed in the job summary under "CI cone". It is never reported as a pass.
3. **Why an exact match is sound.** The verdict and its read set come from the same run, so nothing can drift. The same code reading the same recorded content takes the same path, given that f017's input-site audit makes every other input hashed or refused. A data-dependent read is covered, because the file that chose the path is in the record.

   The caveat stands: a trace covers only the path that run took, and the argument above is what makes that enough.
4. **Recorded as undetermined, so the check always runs:**
   - a red run;
   - a write inside the checkout;
   - a git command that is not read-only;
   - a relative path with no known cwd;
   - an unclassified syscall;
   - more than 20,000 paths (the whole-tree walks);
   - a traced input site the run reached;
   - a fingerprint that moved while the check ran;
   - a check not declared `{tracked}` in task-io.

   One change to f017 itself: a `tree` site no longer forces `{tracked}` when the caller replays git. Only the cone passes that option.

## 2026-10-07 (late): measured. Built and tested, and NOT wired into CI, because enabling it would cost more than it saves

The owner paused CI and rendering during the separation (~20:50Z), so everything below was measured locally.

**Setup.** On this branch, after merging main @ `ecf8af69e03`, I recorded every `{tracked}` single-command gate step of `gates-kg` and `gates-docs`: 45 distinct scripts once 8 slow, unrecordable ones were set aside. I then asked `decide` for each under four PR shapes. Bun 1.3.14, 4 shared CPUs. The QA working copy could not be built locally, because `skill:register` failed inside `qa:refresh` on main's own stale state.

| PR shape | skipped | CI step-seconds skipped* |
|---|---|---|
| same tree | 36 of 45 | 32 s |
| a bean file edited (`beans/defs/README.md`) | 34 | 29 s |
| a new bean file added | 31 | 28 s |
| one gate script edited (`check-workflow-policy.ts`) | 34 | 28 s |

\* Each step's duration in main's green run 37668903964.

**What ran, and why:**
- **Bean edit:** `handler:index:check` and `lsi:viz:check` read that README.
- **Bean add:**
  - `check:declared-dirs`, `check:rendered-labels:check`, `check:structure-accessor` and `lsi:viz:check` list `beans/defs`.
  - `handler:index:check` reads the README.
- **Script edit:**
  - `check:workflow-policy`, because its own script changed.
  - `check:structure-accessor`, which reads every `.ts` under the tree.

**Not recordable:**
- **The whole-tree walkers (over 20,000 paths):** `check:process-documentation`, `check:lane-documentation:check`, `check:prov-qaqc`, `iri:sync:check`.
- **Reached a `git-refs` traced site:** `check:agent-entry-links`, `readme:sync:all:check`, `readme:sync:root:check`, `voices:viz:check`.
- **Undetermined before tracing:** `upload-step:docs:check`, from a stale pin in `cat-harness/tools/index.ts:1192` that is on main.
- **The expensive checks:**
  - `kg:audit:check` (71 s): reads the qa-reports store.
  - `kg:audit:all:check` (74 s): same reason.
  - `root-scan-census:check`: same reason.
  - `check:viewer-nav`: same reason.
  - `skill:register:check`: unannotated site in mounted `bootstrap-tools/scripts/export-graph.ts:400`.
  - `audit:coverage:*`: unannotated site in `check-environment.ts:270`.
  - `readme:subgraphs:check`: red locally.

**Why it is not enabled:**
- **Savings:** about 30 runner-seconds per PR run across the two jobs.
- **Cost on PRs:** `decide` takes about 0.48 s a step, 21.7 s for the 45. Net, about 10 s saved per PR run.
- **Cost on main:** tracing the 45 took 259 s against 37 s untraced, and the slow checks are traced too: `kg:audit:all:check` went from 74 s to 782 s and `kg:audit:check` from 71 s to 259 s, and neither records. Recording would make every main run several minutes slower.
- The approach still holds. It is cheap only for checks that are already cheap.

**Two defects found and fixed on the way, both in this PR:**
1. **A recorder crash could change a verdict.** `kg:audit:all:check` passed, then the recorder aborted (exit 134) while parsing its trace. Now:
   - a trace over 256 MiB is undetermined;
   - a failed traced run is re-run untraced, and that run's exit is the verdict;
   - `gate-shell` re-runs a step whose recorder died by a signal.
2. **Build output was read as an instance.** `instanceRootsIn` read `build/qa-refresh.json`, which is stamped with its commit, as a candidate instance declaration. That made a build product an input of every check that discovers instances, so none of them could ever skip. The build-output directories (`BUILD_OUTPUT_DIRS`) are no longer scanned. Before the fix, 20 checks skipped on the same tree; after it, 36.

**What it would take to make the cone worth wiring in:**
- **`kg:audit:check` and `kg:audit:all:check` recordable.** Their qa-reports reads would be hashed as an `--against`-style baseline identity rather than refused as a traced site. They are 47 s and 54 s of CI steps.
- **`skill:register:check` recordable.** It needs the mounted `bootstrap-tools/scripts/export-graph.ts:400` spawn annotated (upstream), and is about 55 s of CI.
- **A cheaper record on main.**
  - Trace only checks that recorded last time, or whose last record failed only because the fingerprint moved.
  - Or replace `strace` with a preloaded fs shim; `strace -f` costs 3–10x.
- **The 255 s QA working-copy step.** It is the real cost of a gate job, and the cone cannot skip it unless every reader in the job skips.

**Tests (local):**
- `ci-cone.test.ts`: 29 pass, with the falsifiers under a real `strace`:
  - a traced file edited;
  - a data-dependent read redirected;
  - a probed absent path created;
  - a file added to a listed directory;
  - the script edited;
  - an imported module edited;
  - `package.json` edited;
  - a moved `--against` baseline;
  - a git `ls-files` answer changed by a tracked file under its pathspec.

  Each of these makes the check RUN. A file the check never read does not.
- `gate-shell.test.ts`: 28 pass.

**To wire it in later:** add the restore, prepare and save steps to the gate jobs, as the `ci-cone.ts` module comment says. Commit `c6dc9b5cdd2` of PR #2458 has them for `gates-kg` and `gates-docs`.

## 2026-10-07T22:34:11Z: owner ruling — merge as tooling, CI wiring deferred

After the measurement above (net ~10 s per PR; tracing `kg:audit*` costs main minutes), the owner chose option 1 of 3 ("go on all", 2026-10-07 ~22:30Z): **merge the cone tooling, the two defect fixes (tracer-flips-verdict, build-output-read-as-instance) and the rule text, without wiring `ci-cone` into code-quality-gates.yml.** This bean stays open: its goal "enable in CI" is unmet until `kg:audit*` and `skill:register:check` can be recorded (see "What would make it pay").

## 2026-10-20T12:00:00Z: wired into CI, closed

The deferred CI wiring shipped in `litlfred/cat-harness-tools#411` (squash `32a5d8b`). `layer-pr-checks.yml` asks `ci-cone.ts decide-all` once per shard, records a cone skip as SKIPPED with its sha (never a pass), and records cone runs on a push to the caller's main. The 11 caller PRs that add `push: main` are tracked in `litlfred/cat-harness-tools#414`. Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Summary of Changes

_2026-10-20T16:49:14Z_ — Store reconciliation: status `in-progress` → `completed`, mirroring the folio-assistant store's copy (`cat/cat-harness/beans`), which closed it at 2026-10-20T12:00:00Z with the note above (copied verbatim). Re-verified here on cat-harness-tools `main`: `32a5d8b` (#411) is on main, `.github/scripts/layer-pr-checks/run-gates.py` calls `ci-cone.ts decide-all` once, and `layer-pr-checks.yml` documents the cone skip as "SKIPPED — inputs unchanged since <sha>", never a pass. This was the only open copy in this store whose status differed from its live copy. Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.


## 2026-10-20T12:00:00Z: wired into CI, closed

The deferred CI wiring shipped in `litlfred/cat-harness-tools#411` (squash `32a5d8b`). `layer-pr-checks.yml` asks `ci-cone.ts decide-all` once per shard, records a cone skip as SKIPPED with its sha (never a pass), and records cone runs on a push to the caller's main. The 11 caller PRs that add `push: main` are tracked in `litlfred/cat-harness-tools#414`. Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Summary of Changes

_2026-10-20T16:49:14Z_ — Store reconciliation: status `in-progress` → `completed`, mirroring the folio-assistant store's copy (`cat/cat-harness/beans`), which closed it at 2026-10-20T12:00:00Z with the note above (copied verbatim). Re-verified here on cat-harness-tools `main`: `32a5d8b` (#411) is on main, `.github/scripts/layer-pr-checks/run-gates.py` calls `ci-cone.ts decide-all` once, and `layer-pr-checks.yml` documents the cone skip as "SKIPPED — inputs unchanged since <sha>", never a pass. This was the only open copy in this store whose status differed from its live copy. Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.


## 2026-10-20T12:00:00Z: wired into CI, closed

The deferred CI wiring shipped in `litlfred/cat-harness-tools#411` (squash `32a5d8b`). `layer-pr-checks.yml` asks `ci-cone.ts decide-all` once per shard, records a cone skip as SKIPPED with its sha (never a pass), and records cone runs on a push to the caller's main. The 11 caller PRs that add `push: main` are tracked in `litlfred/cat-harness-tools#414`. Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.
