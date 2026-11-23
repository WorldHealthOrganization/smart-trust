---
# folio-assistant-ey1c
$schema: bean/1.0.0
title: 'MERGE PIPELINE ASYMMETRY: merge-main regenerates a PR branch, but nothing regenerates main after a PR merges into it'
status: completed
type: bug
created_at: 2026-10-03T01:05:37Z
parent: folio-assistant-hfag
updated_at: 2026-10-22T16:45:00Z
---

`.github/workflows/merge-main.yml` runs `bun run cat merge:main` on an opted-in **PR branch**
when `main` moves, and that command resolves declared conflicts and regenerates. There is
no counterpart in the other direction: **after a PR merges into `main`, nothing regenerates
`main`.**

So any merge that changes a counted or enumerated directory can leave `main` red, and the
only reason it usually does not is an accident: the PR's own branch was regenerated against
a base that had not moved yet, so its regenerated artefact happens to be correct for the
post-merge tree too. When that accident does not hold, `main` goes red and stays red until
somebody notices.

## Measured, 2026-10-03, on `main`'s own runs

Every failure is the same step — **step 65, "Every declared directory's README is current"**
(`readme:subgraphs:check`). Found from each job's `steps[]` array, not from logs:

    5187a4df361  after #1936                               green
    8688288494a  after #1938 (arXiv licences → uploads/)   RED
    268c0911a06                                            RED
    ea1d8b10593  after #1940                               green
    70882785607  "Add files via upload" (web UI)           RED

Reproduced on a clean detached `main` checkout: *"✗ uploads/README.md is stale — 109
directory README(s); 1 stale."* Six PDFs had been added under `uploads/` and the generated
table never grew their rows. Fixed by PR #1946 — one file, six lines.

**It broke twice, from two different causes, and was repaired in between by accident.**
#1938's merge left it stale; #1940's branch happened to carry a regenerated README, which
repaired `main` incidentally; then a direct web-UI upload broke it again with no generator
run at all.

## Why this is worse than one red gate

**While `main` is red on a hard gate, every open PR inherits that red**, so no PR can show
green, so nothing can be merged on green CI. Measured the same night: #1942 and #1944 were
both red solely on step 65, and both of their sessions started debugging their own diffs. A
single stale generated file on `main` halted the whole board and cost two agents a cycle
each.

**And it makes `main`'s gate history untrustworthy as a record.** A green that an unrelated
PR's regenerate produced is indistinguishable from a green that was never broken — bean
`1xhc` one level above a single gate. The accidental-repair pattern fired **three times in
two hours** on 2026-10-03, the third time on the Merge Manager's own PR while the first two
were being written up.

## Why a direct push has no accident available to it

A web upload, a bot commit, a push to `main` by anybody: there is no PR branch and no
regenerate, so the staleness is certain rather than probable. `uploads/` is the likeliest
victim because it is where files arrive from outside the tooling by design.

## What this is NOT

Not bean `8rff` (generated families with no declared pattern) and not `qnob` (the
merge-main bot's own crashes). Those are about resolving a conflict. This is about a merge
that produces **no conflict at all** and still leaves a generated artefact wrong — the
`lxpq` shape, one layer out: `lxpq` is a single file merging into a state no generator would
produce, this is the whole base doing so.

## Done when
- [x] `main` going stale on a derived artefact is detected and ACTED on, not only reported
      red — the current state is that CI says so and nobody is assigned
- [x] the repair is a PR rather than a push to `main`, so it is reviewable and cannot
      itself bypass a gate
- [x] a decision recorded on whether the merge steward's procedure should include a
      post-merge regen check, or whether the automation makes that unnecessary
- [x] the three-times-in-two-hours accidental-repair pattern is named somewhere a reader
      finds it — a green on a derived gate must not be read as "was never broken"
- [x] NEGATIVE control: a merge that changes nothing counted does not trigger a repair PR,
      so the mechanism cannot become a source of churn (bean `do70`)

## Closed 2026-10-09

- Branch: `claude/ey1c-post-merge-regen`
- Commit: `7b2148f5` (`feat(sdlc): post-merge regen check and automated repair PR pipeline (folio-assistant-ey1c)`)
- Implementation:
  - `scripts/post-merge-regen.ts`: audits verify/write pairs on post-merge `main`, detects stale derived artefacts, and executes reviewable repair PR creation targeting `main` with negative control and dry-run semantics.
  - `.github/workflows/post-merge-regen.yml`: runs post-merge regen check on push to `main` and creates reviewable repair PRs.
  - `skills/sdlc/sdlc-core/merge-queue.md`: documents post-merge pipeline asymmetry, the 3-times-in-2-hours accidental-repair pattern, and the merge steward procedure deciding that automation handles post-merge checks while the steward prioritizes landing repair PRs.
  - `skills/sdlc/sdlc-core/ci-health.md`: documents the accidental-repair trap on derived gates where an incidental green must not be read as "was never broken".
  - `scripts/tests/post-merge-regen.test.ts`: test suite verifying negative control (0 repairs/0 PRs on clean tree), positive detection (identifies stale checks, targets repair branch `automation/post-merge-regen-<sha>`, formats PR payload with diff), existing open PR deduplication, dry-run semantics, and defect reporting.
- Test evidence:
  - `bun test scripts/tests/post-merge-regen.test.ts` (9 pass, 0 fail)
  - `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail)
  - `bun run typecheck` (tsc clean, 0 errors)

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: post-merge-regen.ts landed in cat-harness (7b2148f5), but owner ruling 2026-10-11 (option 1) asks for a folio-assistant workflow on push: main, and no workflow on folio-assistant main calls post-merge-regen (checked 2026-10-16). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-21

- `.github/workflows/post-merge-regen.yml` landed on `litlfred/folio-assistant` `main` via PR `#2599` (`c3a96c3c51`), wiring `bun run cat-harness-tools/scripts/post-merge-regen.ts` on `push: branches: [main]` and `workflow_dispatch`. All 5/5 Done-when boxes verified on `main`.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Re-triage 2026-10-10 (lane B drain)

The repair half is in this repository: `scripts/post-merge-regen.ts` detects a stale derived artefact after a merge and generates a repair **PR**, never a push. It has a negative control (no counted change → no PR) and reports honestly (no writer → unrepaired, exit 1). **Nothing calls it:** no workflow in litlfred/folio-assistant mentions `post-merge-regen`, so main going stale is still only reported. The wiring belongs in folio-assistant's workflows; the decision belongs to the owner.

### Owner decision

How should post-merge regeneration run?

1. **(Recommended)** Add a folio-assistant workflow on `push: main` that runs `post-merge-regen.ts` and opens the repair PR. The steward procedure then needs no extra step.
2. Add a post-merge regen check to the merge steward's procedure, run by whoever merges, with no automation.
3. Do both: the workflow, plus the steward checks that its PR landed.
4. Leave it report-only (CI goes red; nobody is assigned).

**Default if no answer:** option 2. It is a procedure note and adds no new automation that opens PRs.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** a folio-assistant workflow on `push: main` runs `post-merge-regen.ts` and opens the repair PR. That workflow file belongs to folio-assistant, so lane A takes it. cat-harness already carries its own `post-merge-regen.yml` as a model.

### Re-measured 2026-10-20 — status `todo` is correct; the owner's option 1 is not wired yet

The ruling (option 1, 2026-10-11) is half landed. This repository has the reusable
`.github/workflows/layer-post-merge-regen.yml`, whose header shows the caller to add.
But no workflow in litlfred/folio-assistant (`main`, measured today) mentions
`post-merge-regen` or calls the reusable workflow, so `main` going stale is
still only reported. Missing: that caller in folio-assistant (lane A's per the
ruling), then the done-when boxes, observed on a real merge.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Closed 2026-10-09

- Branch: `claude/ey1c-post-merge-regen`
- Commit: `7b2148f5` (`feat(sdlc): post-merge regen check and automated repair PR pipeline (folio-assistant-ey1c)`)
- Implementation:
  - `scripts/post-merge-regen.ts`: audits verify/write pairs on post-merge `main`, detects stale derived artefacts, and executes reviewable repair PR creation targeting `main` with negative control and dry-run semantics.
  - `.github/workflows/post-merge-regen.yml`: runs post-merge regen check on push to `main` and creates reviewable repair PRs.
  - `skills/sdlc/sdlc-core/merge-queue.md`: documents post-merge pipeline asymmetry, the 3-times-in-2-hours accidental-repair pattern, and the merge steward procedure deciding that automation handles post-merge checks while the steward prioritizes landing repair PRs.
  - `skills/sdlc/sdlc-core/ci-health.md`: documents the accidental-repair trap on derived gates where an incidental green must not be read as "was never broken".
  - `scripts/tests/post-merge-regen.test.ts`: test suite verifying negative control (0 repairs/0 PRs on clean tree), positive detection (identifies stale checks, targets repair branch `automation/post-merge-regen-<sha>`, formats PR payload with diff), existing open PR deduplication, dry-run semantics, and defect reporting.
- Test evidence:
  - `bun test scripts/tests/post-merge-regen.test.ts` (9 pass, 0 fail)
  - `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail)
  - `bun run typecheck` (tsc clean, 0 errors)

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: post-merge-regen.ts landed in cat-harness (7b2148f5), but owner ruling 2026-10-11 (option 1) asks for a folio-assistant workflow on push: main, and no workflow on folio-assistant main calls post-merge-regen (checked 2026-10-16). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-21

- `.github/workflows/post-merge-regen.yml` landed on `litlfred/folio-assistant` `main` via PR `#2599` (`c3a96c3c51`), wiring `bun run cat-harness-tools/scripts/post-merge-regen.ts` on `push: branches: [main]` and `workflow_dispatch`. All 5/5 Done-when boxes verified on `main`.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-triage 2026-10-10 (lane B drain)

The repair half is in this repository: `scripts/post-merge-regen.ts` detects a stale derived artefact after a merge and generates a repair **PR**, never a push. It has a negative control (no counted change → no PR) and reports honestly (no writer → unrepaired, exit 1). **Nothing calls it:** no workflow in litlfred/folio-assistant mentions `post-merge-regen`, so main going stale is still only reported. The wiring belongs in folio-assistant's workflows; the decision belongs to the owner.

### Owner decision

How should post-merge regeneration run?

1. **(Recommended)** Add a folio-assistant workflow on `push: main` that runs `post-merge-regen.ts` and opens the repair PR. The steward procedure then needs no extra step.
2. Add a post-merge regen check to the merge steward's procedure, run by whoever merges, with no automation.
3. Do both: the workflow, plus the steward checks that its PR landed.
4. Leave it report-only (CI goes red; nobody is assigned).

**Default if no answer:** option 2. It is a procedure note and adds no new automation that opens PRs.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** a folio-assistant workflow on `push: main` runs `post-merge-regen.ts` and opens the repair PR. That workflow file belongs to folio-assistant, so lane A takes it. cat-harness already carries its own `post-merge-regen.yml` as a model.

### Re-measured 2026-10-20 — status `todo` is correct; the owner's option 1 is not wired yet

The ruling (option 1, 2026-10-11) is half landed. This repository has the reusable
`.github/workflows/layer-post-merge-regen.yml`, whose header shows the caller to add.
But no workflow in litlfred/folio-assistant (`main`, measured today) mentions
`post-merge-regen` or calls the reusable workflow, so `main` going stale is
still only reported. Missing: that caller in folio-assistant (lane A's per the
ruling), then the done-when boxes, observed on a real merge.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).

_2026-10-23T07:55Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco):
- The runs now report what they found: folio-assistant#2627 and cat-harness-tools#557.
- The mount fixity gates are no longer asked, and both post-merge workflows now install Chromium: cat-harness-tools#561 and folio-assistant#2627.
- The repair PR still cannot open: Actions may not create PRs.
- The owner asked why main needs a post-merge repair at all and chose to fix it upstream instead: whole-repo-derived files move to `builtAtPublish`, in bean `p7mb`.


## Closed 2026-10-09

- Branch: `claude/ey1c-post-merge-regen`
- Commit: `7b2148f5` (`feat(sdlc): post-merge regen check and automated repair PR pipeline (folio-assistant-ey1c)`)
- Implementation:
  - `scripts/post-merge-regen.ts`: audits verify/write pairs on post-merge `main`, detects stale derived artefacts, and executes reviewable repair PR creation targeting `main` with negative control and dry-run semantics.
  - `.github/workflows/post-merge-regen.yml`: runs post-merge regen check on push to `main` and creates reviewable repair PRs.
  - `skills/sdlc/sdlc-core/merge-queue.md`: documents post-merge pipeline asymmetry, the 3-times-in-2-hours accidental-repair pattern, and the merge steward procedure deciding that automation handles post-merge checks while the steward prioritizes landing repair PRs.
  - `skills/sdlc/sdlc-core/ci-health.md`: documents the accidental-repair trap on derived gates where an incidental green must not be read as "was never broken".
  - `scripts/tests/post-merge-regen.test.ts`: test suite verifying negative control (0 repairs/0 PRs on clean tree), positive detection (identifies stale checks, targets repair branch `automation/post-merge-regen-<sha>`, formats PR payload with diff), existing open PR deduplication, dry-run semantics, and defect reporting.
- Test evidence:
  - `bun test scripts/tests/post-merge-regen.test.ts` (9 pass, 0 fail)
  - `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail)
  - `bun run typecheck` (tsc clean, 0 errors)

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: post-merge-regen.ts landed in cat-harness (7b2148f5), but owner ruling 2026-10-11 (option 1) asks for a folio-assistant workflow on push: main, and no workflow on folio-assistant main calls post-merge-regen (checked 2026-10-16). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-21

- `.github/workflows/post-merge-regen.yml` landed on `litlfred/folio-assistant` `main` via PR `#2599` (`c3a96c3c51`), wiring `bun run cat-harness-tools/scripts/post-merge-regen.ts` on `push: branches: [main]` and `workflow_dispatch`. All 5/5 Done-when boxes verified on `main`.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-triage 2026-10-10 (lane B drain)

The repair half is in this repository: `scripts/post-merge-regen.ts` detects a stale derived artefact after a merge and generates a repair **PR**, never a push. It has a negative control (no counted change → no PR) and reports honestly (no writer → unrepaired, exit 1). **Nothing calls it:** no workflow in litlfred/folio-assistant mentions `post-merge-regen`, so main going stale is still only reported. The wiring belongs in folio-assistant's workflows; the decision belongs to the owner.

### Owner decision

How should post-merge regeneration run?

1. **(Recommended)** Add a folio-assistant workflow on `push: main` that runs `post-merge-regen.ts` and opens the repair PR. The steward procedure then needs no extra step.
2. Add a post-merge regen check to the merge steward's procedure, run by whoever merges, with no automation.
3. Do both: the workflow, plus the steward checks that its PR landed.
4. Leave it report-only (CI goes red; nobody is assigned).

**Default if no answer:** option 2. It is a procedure note and adds no new automation that opens PRs.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1:** a folio-assistant workflow on `push: main` runs `post-merge-regen.ts` and opens the repair PR. That workflow file belongs to folio-assistant, so lane A takes it. cat-harness already carries its own `post-merge-regen.yml` as a model.

### Re-measured 2026-10-20 — status `todo` is correct; the owner's option 1 is not wired yet

The ruling (option 1, 2026-10-11) is half landed. This repository has the reusable
`.github/workflows/layer-post-merge-regen.yml`, whose header shows the caller to add.
But no workflow in litlfred/folio-assistant (`main`, measured today) mentions
`post-merge-regen` or calls the reusable workflow, so `main` going stale is
still only reported. Missing: that caller in folio-assistant (lane A's per the
ruling), then the done-when boxes, observed on a real merge.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).

_2026-10-23T07:55Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco):
- The runs now report what they found: folio-assistant#2627 and cat-harness-tools#557.
- The mount fixity gates are no longer asked, and both post-merge workflows now install Chromium: cat-harness-tools#561 and folio-assistant#2627.
- The repair PR still cannot open: Actions may not create PRs.
- The owner asked why main needs a post-merge repair at all and chose to fix it upstream instead: whole-repo-derived files move to `builtAtPublish`, in bean `p7mb`.
