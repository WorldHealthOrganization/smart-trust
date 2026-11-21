---
# folio-assistant-1dre
$schema: bean/1.0.0
title: 'PAGES SERVING PROBE: the instrument pages-publish-health counts, and it can only be built in CI because egress refuses every route from an agent'
status: completed
type: feature
created_at: 2026-09-26T03:55:45Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1xhc
---

`pages-publish-health` (bean `qj9a`) counts instruments for observing the
published site. The count is **0**, so it reports a `major` finding whose action
is this bean. This is that probe, specified rather than built, because it cannot
be built here.

## Why it cannot be written or tested from an agent's container

Measured 2026-09-25 and 2026-09-26, every route refused:

| route | result |
|---|---|
| `GET https://litlfred.github.io/folio-assistant/` | `connect_rejected` — egress proxy, organization policy |
| the same for a `STAGING/<slug>/` page | `connect_rejected` |
| `GET /repos/:o/:r/pages` | every field `null` |
| `GET /repos/:o/:r/pages/builds` | *"Access to this GitHub API path is not permitted through this proxy"* |
| `actions/workflows/pages-build-deployment/runs` | `total_count` absent |

So a probe written locally cannot be exercised even once, and a probe that
reaches the network at sweep time would report `unknown` — which
[`qj9a`](folio-assistant-qj9a--staging-size-the-measurement-is-right-and-the-seve.md)
establishes takes the WHOLE health report to `unknown`, exits 2 and leaves the
tracking issue untouched. `health-check.yml`'s own comment: *"the whole verdict
goes to `unknown` — correctly, and uselessly."*

**That constraint shapes the design and is the reason this is a bean rather than
a patch.**

## What it has to do

1. **Run in CI**, in a job with ordinary egress — `health-check.yml` already runs
   daily and already fetches `gh-pages`, so it is the obvious host.
2. **Fetch the published site** and record, per URL: HTTP status, bytes served,
   and whether the body is the expected page rather than Pages' own 404.
3. **Record the observation as committed evidence**, not as a live call the sweep
   depends on. The check then reads the recorded observation and counts as its
   instrument — which keeps `pages-publish-health` offline and deterministic,
   the property `bean-quiet-claims` has for the same reason (`bun run cat health`
   must not need a token or a reachable API to say anything).
4. **Carry its own staleness**, because a recorded observation is a measurement
   with a date. An observation older than N is not an observation — same rule
   `check:ci-health` applies to a red that has not re-run in a week.

## The question it exists to settle

**Is GitHub's documented 1 GB Pages limit enforced at all for branch-based
sites?** Measured: the served tree crossed 1 GB on 2026-09-23 and was 2.67 GB on
2026-09-25, with every deploy succeeding throughout. So it is not a hard refusal
on push. Whether it degrades, truncates, or is simply unenforced is unknown, and
the answer changes what the thresholds MEAN:

- **enforced somehow** → 500 MB is a safety margin and the owner's number is a
  cliff-avoidance measure
- **not enforced** → 500 MB is a repository-hygiene policy, and saying so plainly
  is more honest than implying a cliff

Neither is asserted here. This is the one fact a probe buys that no amount of
reasoning does.

## What it must NOT become

**Not a gate.** `schema:viz:check` is exempt from gating for a reason that
applies with more force here: a check depending on an external service reddens
when that service hiccups rather than when this author forgot something. The
probe records; a person reads.

**Not a licence to delete.** Even a probe returning HTTP 500 would not authorise
removing a preview — `deletion-requires-confirmation`, and every remedy on this
check names a person.

## Done when

- [x] A CI job fetches the published site and commits the observation with its
      timestamp
- [x] `pages-publish-health` reads that observation, counts it as its instrument,
      and stays offline — no network at sweep time
- [x] A stale observation is distinguished from a fresh one, with the horizon's
      basis recorded
- [x] The enforcement question above is answered from evidence, and
      `STAGING_WARN_BYTES`' basis says which of the two readings is true
- [x] It is NOT wired into `gates`, and the exemption states why

## Progress 2026-10-12 09:05 UTC (lane A)
Owner ruling 2026-10-11: **add-only publish**. `publishQa` never writes into an existing entry, and the gates job writes `main/<sha>` first, so the writer could not land a file there.
- litlfred/cat-harness-tools#140: `qa:publish --add` writes into the existing entry. It never changes a path from the first write, can replace a path an earlier add wrote (so the observation refreshes daily), creates nothing when there is no entry, and resolves skipped refs. qa-store suite 37/0.
- litlfred/folio-assistant#2538: the health-check.yml writer. It observes the root and every gh-pages directory index, using a 404 control, and runs `qa:publish --add`. It refuses to publish without #140 in the tools pin.
Closes when both are merged, the pin includes #140, and one daily run reads `pages-publish-health` as known.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `in-progress` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: todo, cat-harness-tools: in-progress). Evidence: owner ruling 2026-10-11 (option 1, qa-reports) and lane progress: cat-harness#141 merged, cat-harness-tools#117/#140 and folio-assistant#2538 in flight. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-20T15:40:00Z_ — **The close condition cannot be met yet, because the watchdog never finishes.** Code side: #140 and #2538 are merged (#2538 through #2529, merged 2026-10-15), and the pin carries #140. But every `health-check.yml` run on record, run 16 (2026-10-05) through run 31 (2026-10-20), ended `cancelled`. In run 31 the **Checkout** step alone took 06:59:39–07:14:37, against the job's `timeout-minutes: 15`, so the pages-serving step never ran. The checkout is `fetch-depth: 0`, which fetches every branch, state branches and `gh-pages` included. It is set that way on purpose, for `repository-size`. Fixing this means choosing what that check measures, which is put to the owner. Session https://claude.ai/code/session_01JkK6uP3iU2etyMbrw7v3cu.

_2026-10-21T18:18:00Z_ — **Completed.** `litlfred/folio-assistant#2610` (`3d586f5794`) merged the owner's 2026-10-20 choice (option 1: shallow checkout + `git fetch --unshallow --no-tags origin "+refs/heads/main:refs/remotes/origin/main"`, `timeout-minutes: 30`). In `health-check.yml` run `39650717679` on `main/3d586f5794c6596525a0a935f51ccd054ba5df39`, `Observe the published site (pages-serving)` succeeded and published `main/3d586f5794c6596525a0a935f51ccd054ba5df39/health/pages-serving.json` to `cat/cat-harness/qa-reports` (`691ae7a593`): **36 of 36** published URLs on `https://litlfred.github.io/folio-assistant/` returned HTTP 200 and `expectedPage: true` (0 failing), and `bun run cat health` now reads `pages-publish-health` as `ok` (0 findings) and `verdict: "findings"` (no longer `unknown`), pushed to `cat/cat-harness/health`. `STAGING_WARN_BYTES`' basis in `cat-harness-tools/test/health/checks.ts` states that it is a repository-hygiene budget (`3 GB`, enforced by `staging-rotate.ts`) rather than a GitHub cliff. Note for follow-up: `git fetch --filter=blob:none` in the `pages-serving` step sets `remote.origin.partialclonefilter = blob:none` in `.git/config`, which makes `git ls-tree -r -l` in `probeStaging` / `probeSpecialBranches` lazy-fetch blobs one-by-one unless `--filter=blob:none` is dropped or unset before `Run the health checks`.

_2026-10-22T13:30:00Z_ — **Evidence for the close.** The first `health-check.yml` run to finish since 2026-10-05 was run 38 (39781213346, dispatched on main after litlfred/folio-assistant#2615 merged). #2615 removed the `--filter=blob:none` gh-pages fetch, which had made the clone partial and turned each `ls-tree -l` into a blob fetch. Runs 33 and 36 ran `health` for 14 and 28 min without finishing. In run 38 `health` took 29 s, the whole job 4.5 min, and `✓ pages-publish-health 0 finding(s)`. The run is red only at "Write the report through its state branch": github-actions[bot] gets a 403 pushing to `litlfred/cat-harness:cat/cat-harness/health` (tracked separately).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Owner decision

(Lane B drain, 2026-10-10.) The bean asks for the probe's observation to be **committed**, but since arc `3fva` and `5hox` health and QA results stay off main (`test/health/results/` is gitignored), so it is unclear where the observation should live. The reader, `pagesPublishHealthCheck` in cat-harness-tools `test/health/checks.ts`, is here. The writer is a CI job in folio-assistant's `health-check.yml`, which has the network access.

Where should the CI job record the pages-serving observation?

1. **(Recommended)** **On `qa-reports`**, under `main/<sha>/health/pages-serving.json`, using the existing qa-store publish. The health check reads it with `qa:fetch`, stays offline at sweep time, and treats a missing or old entry as `unknown` with its date.
2. **Committed on main** as a small dated file (e.g. `test/health/observations/pages-serving.json`): one deliberate exception to results-off-main, because it is an instrument reading, not a verdict.
3. **As a workflow artifact plus a tracking-issue comment**, with the check reading the issue. That needs the API at sweep time, which the bean rules out.
4. **Not built:** keep `instruments = 0` and the `major` finding as the standing reminder.

**Default if no answer:** option 4. Nothing is built, and the finding stays as it is today.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** record the pages-serving observation on `qa-reports` under `main/<sha>/health/pages-serving.json` through the qa-store publish. The health check reads it offline with `qa:fetch`, and a missing or old entry reads as `unknown`, with its date. Lane A takes the CI writer in folio-assistant's `health-check.yml`; the reader is here.

### Progress 2026-10-11 (lane B)
- [x] Schema: `PagesServingObservationSchema` in cat-harness `schemas/health-report.ts` (cat-harness#141, merged).
- [x] Reader: cat-harness-tools#117. `probePagesServing` reads `main/<HEAD>/health/pages-serving.json` through the qa-store, offline. Missing, or older than 7 days, reads as unknown with its date. Each URL that wasn't served is a major finding. **Held unmerged until lane A's writer publishes**, because otherwise every daily health run would read unknown.
- [ ] Writer: lane A, in folio-assistant health-check.yml. I sent them the contract.
- [ ] The enforcement question, answered from accumulated observations.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] It is NOT wired into `gates`, and the exemption states why

## Progress 2026-10-12 09:05 UTC (lane A)
Owner ruling 2026-10-11: **add-only publish**. `publishQa` never writes into an existing entry, and the gates job writes `main/<sha>` first, so the writer could not land a file there.
- litlfred/cat-harness-tools#140: `qa:publish --add` writes into the existing entry. It never changes a path from the first write, can replace a path an earlier add wrote (so the observation refreshes daily), creates nothing when there is no entry, and resolves skipped refs. qa-store suite 37/0.
- litlfred/folio-assistant#2538: the health-check.yml writer. It observes the root and every gh-pages directory index, using a 404 control, and runs `qa:publish --add`. It refuses to publish without #140 in the tools pin.
Closes when both are merged, the pin includes #140, and one daily run reads `pages-publish-health` as known.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `in-progress` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: todo, cat-harness-tools: in-progress). Evidence: owner ruling 2026-10-11 (option 1, qa-reports) and lane progress: cat-harness#141 merged, cat-harness-tools#117/#140 and folio-assistant#2538 in flight. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-20T15:40:00Z_ — **The close condition cannot be met yet, because the watchdog never finishes.** Code side: #140 and #2538 are merged (#2538 through #2529, merged 2026-10-15), and the pin carries #140. But every `health-check.yml` run on record, run 16 (2026-10-05) through run 31 (2026-10-20), ended `cancelled`. In run 31 the **Checkout** step alone took 06:59:39–07:14:37, against the job's `timeout-minutes: 15`, so the pages-serving step never ran. The checkout is `fetch-depth: 0`, which fetches every branch, state branches and `gh-pages` included. It is set that way on purpose, for `repository-size`. Fixing this means choosing what that check measures, which is put to the owner. Session https://claude.ai/code/session_01JkK6uP3iU2etyMbrw7v3cu.

_2026-10-21T18:18:00Z_ — **Completed.** `litlfred/folio-assistant#2610` (`3d586f5794`) merged the owner's 2026-10-20 choice (option 1: shallow checkout + `git fetch --unshallow --no-tags origin "+refs/heads/main:refs/remotes/origin/main"`, `timeout-minutes: 30`). In `health-check.yml` run `39650717679` on `main/3d586f5794c6596525a0a935f51ccd054ba5df39`, `Observe the published site (pages-serving)` succeeded and published `main/3d586f5794c6596525a0a935f51ccd054ba5df39/health/pages-serving.json` to `cat/cat-harness/qa-reports` (`691ae7a593`): **36 of 36** published URLs on `https://litlfred.github.io/folio-assistant/` returned HTTP 200 and `expectedPage: true` (0 failing), and `bun run cat health` now reads `pages-publish-health` as `ok` (0 findings) and `verdict: "findings"` (no longer `unknown`), pushed to `cat/cat-harness/health`. `STAGING_WARN_BYTES`' basis in `cat-harness-tools/test/health/checks.ts` states that it is a repository-hygiene budget (`3 GB`, enforced by `staging-rotate.ts`) rather than a GitHub cliff. Note for follow-up: `git fetch --filter=blob:none` in the `pages-serving` step sets `remote.origin.partialclonefilter = blob:none` in `.git/config`, which makes `git ls-tree -r -l` in `probeStaging` / `probeSpecialBranches` lazy-fetch blobs one-by-one unless `--filter=blob:none` is dropped or unset before `Run the health checks`.

_2026-10-22T13:30:00Z_ — **Evidence for the close.** The first `health-check.yml` run to finish since 2026-10-05 was run 38 (39781213346, dispatched on main after litlfred/folio-assistant#2615 merged). #2615 removed the `--filter=blob:none` gh-pages fetch, which had made the clone partial and turned each `ls-tree -l` into a blob fetch. Runs 33 and 36 ran `health` for 14 and 28 min without finishing. In run 38 `health` took 29 s, the whole job 4.5 min, and `✓ pages-publish-health 0 finding(s)`. The run is red only at "Write the report through its state branch": github-actions[bot] gets a 403 pushing to `litlfred/cat-harness:cat/cat-harness/health` (tracked separately).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Owner decision

(Lane B drain, 2026-10-10.) The bean asks for the probe's observation to be **committed**, but since arc `3fva` and `5hox` health and QA results stay off main (`test/health/results/` is gitignored), so it is unclear where the observation should live. The reader, `pagesPublishHealthCheck` in cat-harness-tools `test/health/checks.ts`, is here. The writer is a CI job in folio-assistant's `health-check.yml`, which has the network access.

Where should the CI job record the pages-serving observation?

1. **(Recommended)** **On `qa-reports`**, under `main/<sha>/health/pages-serving.json`, using the existing qa-store publish. The health check reads it with `qa:fetch`, stays offline at sweep time, and treats a missing or old entry as `unknown` with its date.
2. **Committed on main** as a small dated file (e.g. `test/health/observations/pages-serving.json`): one deliberate exception to results-off-main, because it is an instrument reading, not a verdict.
3. **As a workflow artifact plus a tracking-issue comment**, with the check reading the issue. That needs the API at sweep time, which the bean rules out.
4. **Not built:** keep `instruments = 0` and the `major` finding as the standing reminder.

**Default if no answer:** option 4. Nothing is built, and the finding stays as it is today.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** record the pages-serving observation on `qa-reports` under `main/<sha>/health/pages-serving.json` through the qa-store publish. The health check reads it offline with `qa:fetch`, and a missing or old entry reads as `unknown`, with its date. Lane A takes the CI writer in folio-assistant's `health-check.yml`; the reader is here.

### Progress 2026-10-11 (lane B)
- [x] Schema: `PagesServingObservationSchema` in cat-harness `schemas/health-report.ts` (cat-harness#141, merged).
- [x] Reader: cat-harness-tools#117. `probePagesServing` reads `main/<HEAD>/health/pages-serving.json` through the qa-store, offline. Missing, or older than 7 days, reads as unknown with its date. Each URL that wasn't served is a major finding. **Held unmerged until lane A's writer publishes**, because otherwise every daily health run would read unknown.
- [ ] Writer: lane A, in folio-assistant health-check.yml. I sent them the contract.
- [ ] The enforcement question, answered from accumulated observations.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] It is NOT wired into `gates`, and the exemption states why

## Progress 2026-10-12 09:05 UTC (lane A)
Owner ruling 2026-10-11: **add-only publish**. `publishQa` never writes into an existing entry, and the gates job writes `main/<sha>` first, so the writer could not land a file there.
- litlfred/cat-harness-tools#140: `qa:publish --add` writes into the existing entry. It never changes a path from the first write, can replace a path an earlier add wrote (so the observation refreshes daily), creates nothing when there is no entry, and resolves skipped refs. qa-store suite 37/0.
- litlfred/folio-assistant#2538: the health-check.yml writer. It observes the root and every gh-pages directory index, using a 404 control, and runs `qa:publish --add`. It refuses to publish without #140 in the tools pin.
Closes when both are merged, the pin includes #140, and one daily run reads `pages-publish-health` as known.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `in-progress` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: todo, cat-harness-tools: in-progress). Evidence: owner ruling 2026-10-11 (option 1, qa-reports) and lane progress: cat-harness#141 merged, cat-harness-tools#117/#140 and folio-assistant#2538 in flight. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-20T15:40:00Z_ — **The close condition cannot be met yet, because the watchdog never finishes.** Code side: #140 and #2538 are merged (#2538 through #2529, merged 2026-10-15), and the pin carries #140. But every `health-check.yml` run on record, run 16 (2026-10-05) through run 31 (2026-10-20), ended `cancelled`. In run 31 the **Checkout** step alone took 06:59:39–07:14:37, against the job's `timeout-minutes: 15`, so the pages-serving step never ran. The checkout is `fetch-depth: 0`, which fetches every branch, state branches and `gh-pages` included. It is set that way on purpose, for `repository-size`. Fixing this means choosing what that check measures, which is put to the owner. Session https://claude.ai/code/session_01JkK6uP3iU2etyMbrw7v3cu.

_2026-10-21T18:18:00Z_ — **Completed.** `litlfred/folio-assistant#2610` (`3d586f5794`) merged the owner's 2026-10-20 choice (option 1: shallow checkout + `git fetch --unshallow --no-tags origin "+refs/heads/main:refs/remotes/origin/main"`, `timeout-minutes: 30`). In `health-check.yml` run `39650717679` on `main/3d586f5794c6596525a0a935f51ccd054ba5df39`, `Observe the published site (pages-serving)` succeeded and published `main/3d586f5794c6596525a0a935f51ccd054ba5df39/health/pages-serving.json` to `cat/cat-harness/qa-reports` (`691ae7a593`): **36 of 36** published URLs on `https://litlfred.github.io/folio-assistant/` returned HTTP 200 and `expectedPage: true` (0 failing), and `bun run cat health` now reads `pages-publish-health` as `ok` (0 findings) and `verdict: "findings"` (no longer `unknown`), pushed to `cat/cat-harness/health`. `STAGING_WARN_BYTES`' basis in `cat-harness-tools/test/health/checks.ts` states that it is a repository-hygiene budget (`3 GB`, enforced by `staging-rotate.ts`) rather than a GitHub cliff. Note for follow-up: `git fetch --filter=blob:none` in the `pages-serving` step sets `remote.origin.partialclonefilter = blob:none` in `.git/config`, which makes `git ls-tree -r -l` in `probeStaging` / `probeSpecialBranches` lazy-fetch blobs one-by-one unless `--filter=blob:none` is dropped or unset before `Run the health checks`.

_2026-10-22T13:30:00Z_ — **Evidence for the close.** The first `health-check.yml` run to finish since 2026-10-05 was run 38 (39781213346, dispatched on main after litlfred/folio-assistant#2615 merged). #2615 removed the `--filter=blob:none` gh-pages fetch, which had made the clone partial and turned each `ls-tree -l` into a blob fetch. Runs 33 and 36 ran `health` for 14 and 28 min without finishing. In run 38 `health` took 29 s, the whole job 4.5 min, and `✓ pages-publish-health 0 finding(s)`. The run is red only at "Write the report through its state branch": github-actions[bot] gets a 403 pushing to `litlfred/cat-harness:cat/cat-harness/health` (tracked separately).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Owner decision

(Lane B drain, 2026-10-10.) The bean asks for the probe's observation to be **committed**, but since arc `3fva` and `5hox` health and QA results stay off main (`test/health/results/` is gitignored), so it is unclear where the observation should live. The reader, `pagesPublishHealthCheck` in cat-harness-tools `test/health/checks.ts`, is here. The writer is a CI job in folio-assistant's `health-check.yml`, which has the network access.

Where should the CI job record the pages-serving observation?

1. **(Recommended)** **On `qa-reports`**, under `main/<sha>/health/pages-serving.json`, using the existing qa-store publish. The health check reads it with `qa:fetch`, stays offline at sweep time, and treats a missing or old entry as `unknown` with its date.
2. **Committed on main** as a small dated file (e.g. `test/health/observations/pages-serving.json`): one deliberate exception to results-off-main, because it is an instrument reading, not a verdict.
3. **As a workflow artifact plus a tracking-issue comment**, with the check reading the issue. That needs the API at sweep time, which the bean rules out.
4. **Not built:** keep `instruments = 0` and the `major` finding as the standing reminder.

**Default if no answer:** option 4. Nothing is built, and the finding stays as it is today.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** record the pages-serving observation on `qa-reports` under `main/<sha>/health/pages-serving.json` through the qa-store publish. The health check reads it offline with `qa:fetch`, and a missing or old entry reads as `unknown`, with its date. Lane A takes the CI writer in folio-assistant's `health-check.yml`; the reader is here.

### Progress 2026-10-11 (lane B)
- [x] Schema: `PagesServingObservationSchema` in cat-harness `schemas/health-report.ts` (cat-harness#141, merged).
- [x] Reader: cat-harness-tools#117. `probePagesServing` reads `main/<HEAD>/health/pages-serving.json` through the qa-store, offline. Missing, or older than 7 days, reads as unknown with its date. Each URL that wasn't served is a major finding. **Held unmerged until lane A's writer publishes**, because otherwise every daily health run would read unknown.
- [ ] Writer: lane A, in folio-assistant health-check.yml. I sent them the contract.
- [ ] The enforcement question, answered from accumulated observations.
```
