---
name: ci-health
description: >
  A red workflow looks exactly like a green one from inside a checkout. How to
  read a default-branch health report, the three verdicts that keep it honest,
  why a watchdog needs both a session-start print and an unattended run, and the
  separate external question the Pages deployments need.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# CI health — a red workflow looks exactly like a green one from in here

**A workflow's outcome is invisible from the working tree.** Nothing in a
checkout says whether the last run passed, so a workflow can fire on every push
and fail every time while the repository reads as healthy.

Measured here: one publishing workflow fired on every push to the default branch
and **failed all 30 times over two months**. The trigger was fine; the outcome
was unobserved, the published site sat stale, and nothing in the repository said
so.

## Read the report, and read it by these three rules

`check:ci-health` reports each workflow's state on the **default branch** —
consecutive failures, days since the last green, and whether it has run at all
recently. The session-start sweep prints it, so it lands where you already look.

1. **"Could not check" is never rendered as green.** A watchdog that has gone
   blind must not read as good news.
2. **A red that has not re-run in a week is *possibly stale*, not an active
   fire.** The distinction is what stops a dead workflow consuming attention a
   live one needs.
3. **A red whose workflow file changed *after* the failing run is
   `superseded`.** The version that failed is gone, so the verdict is stale.
   `superseded` is never rendered as green and never counted as a live failure:
   a later edit is evidence the failing version is gone, **not** evidence the
   new one works.

That third rule is not hypothetical. Two workflows here failed to *parse* on one
day — which is why the platform ran them on `push` despite both being
dispatch-only, and why their runs are named by path rather than by their
declared name. They were fixed the next day, and they only run on dispatch, so
nothing will ever run them on the default branch again. Without the rule they
are red forever.

**Do not "fix" a dispatch-only workflow by dispatching it.** Some fail by design
in the repository you are standing in — a folio-shaped job preflighting on a
manifest the platform does not carry, or a computation step needing a directory
only a folio has. A red you caused by running something that was never meant to
run here is worse than the stale verdict you were trying to clear.

## For ONE commit, zero checks is not a pass

`check:ci-health` reads workflows across history. When the question is **one
commit** (may I merge this PR, must I fix it, or do I not yet know?), the
tool is `bun run cat ci:watch <sha>` or `ci:watch --pr <n>`. It answers in three
states, and `undetermined` has its own exit code, never 0.

The trap it exists for arrives as good news. **A conflicted pull request gets
no `pull_request` run at all.** GitHub checks out `refs/pull/N/merge`, which
it does not build for a head that conflicts. So the notification that "every
check suite completed and none failed" can be true of **zero suites**. "No
suite failed" over nothing that ran is not green, and neither is a partial set
(a push-triggered job finished, the PR's gate workflow never registered).
Before reading an event as a pass, ask the head's merge state. A merge ref
that exists can still have been built for an EARLIER head (GitHub leaves the
old one in place when a new head conflicts), so the ref must have been built
from the current head.

The tool enforces this (`verdictForCommit`, `mergeStateForHead`); an agent
reading PR events **without** the tool applies it too.

### `qa-publish` is a job in the gate workflow, and it is not a gate

`Code quality gates` carries one job that judges nothing:
`qa-publish`, which runs after `gates` **whatever they concluded** and stores
the run's QA results on the orphan `qa-reports` branch (`main/<sha>/` on a
push, `pr/<n>/<sha>/` on a same-repository PR). Read its outcome as a
statement about the **evidence**, not about the commit:

- **red** — the record for this commit was not stored. The gates' verdict is
  untouched (it is a separate job for exactly that reason), but a later
  `--against` this commit will read UNKNOWN, so it is still a red to fix, and
  a workflow-level red in this report.
- **green with a `::notice`** on a fork PR — skipped by design: a fork's token
  cannot write. Stated, never silent.
- **green** with the gates red — the red commit's evidence was stored. That is
  the point of `always()`, not a contradiction.

The merge policy counts it like any job: a PR is handed to the Merge
Steward only when CI is green on **every** job
([`continual-progress`](../../conduct/conduct-core/continual-progress.md) §"Green means handed to the
Merge Steward").

## The report answers about the default branch — and Pages is not on it

**A Pages build outcome is not repository state.** It is a fact GitHub holds
*about* the repository, and it changes the repository's status without changing
a single byte of it. So the tool must **look external, cache nothing**: a
committed answer would be right when it was written and silently wrong from
then on.

The default-branch query cannot see it, for three reasons at once, and all
three have to be answered together:

| property | why the default-branch query misses it |
|---|---|
| runs on the **publish** branch | `?branch=<default>` excludes them outright |
| raised by `github-pages[bot]`, event `dynamic` | there is no file in `.github/workflows/` to be a row about |
| its workflow has **no file** | it is addressable only by a per-repository id |

Measured here on one day: the default-branch page held **zero** deployments
while the publish branch held **51 cancelled and 49 succeeded**, of which
**25** were self-inflicted. None of it was visible from anywhere.

### Two more, for the question the three above do not cover

Deliberately **not** numbered 4 and 5: the three rules are the three rules, for
reading the default-branch report, and they are quoted by that count in several
places. These are a separate pair for a separate question — which is itself the
rule about never letting a count in prose go stale.

- **`cancelled` is a THIRD state.** A cancelled deployment neither shipped nor
  broke: the previous preview stays up, so the site is *stale* rather than
  down, and nobody is owed a fix. Folded into success the report says the
  preview shipped; folded into failure it sends somebody after a build that was
  merely superseded. Both readings are wrong in a way the reader cannot detect
  — which is rule 1 again, wearing different clothes.

  **Crucial exception**: staleness is benign
  only when falling back to an existing live preview,
  **never when the previous state is a deletion** (where "stale" manifests as a
  404). When PR N's merge cleanup removed `branches/<slug>/` and PR N+1's
  staging deploy was cancelled, the live site serves the deletion rather than
  a previous preview. Staleness is safe only when what you fall back to
  actually exists.
- **Say WHOSE contention it is.** One workflow pushing twice and cancelling its
  own build is a fixed defect; several sessions racing for the publish ref is a
  different, open one. A merged cancellation count cannot show whether the
  first fix held — so the self-inflicted ones are named **by slug**, and a slug
  still appearing is a branch running the workflow from before the fix.

### Report the counts; grade only a floor

There is no calibrated threshold for "too many cancellations", so the report
states the numbers and **does not grade the share** — no percentage, no verdict
word. That is the same refusal that stopped a PDF heuristic inventing a size
threshold with nothing to calibrate against.

One statement *is* graded, because it is a **floor** rather than a threshold:
deployments happened and **not one succeeded**. That needs no calibration, the
way "the build directory is empty" needs none.

## A report is only read by someone in the room

This is the part that gets designed wrong. The session-start print covers every
day somebody is working — and **the failure being guarded against is a quiet
stretch with nobody looking, which is exactly the stretch in which no session
starts either.** A report alone cannot cover its own worst case.

So the watchdog has a second half: the same check runs on a schedule and
maintains **one** tracking issue, which is

- **opened** when the default branch has a live failure,
- **edited in place** while it persists — an edit does not notify, so a long
  outage stays one unread item rather than a stream,
- **closed automatically** when the branch is clean.

**It deliberately does not send another email.** The platform already sent 30
and the premise of the whole exercise is that nobody reads them. Live badges at
the top of the README are the same state at the front door.

Two properties of that scheduled run are load-bearing rather than incidental:

- **It needs full history.** The `superseded` rule asks when a workflow file
  last changed, and a shallow clone cannot answer — which would resurrect
  exactly the false fires the rule exists to retire.
- **On "could not check" it leaves the issue untouched and fails its own job**,
  rather than closing it. A watchdog reporting that it cannot see must not read
  as good news, and its own red is reported by the next scheduled run.

### The second instance: merge-main's in-place comment

The same edited-in-place doctrine governs `merge-main.yml` (implemented by `cat-harness-tools/scripts/merge-main-comment.ts`). The workflow fires on every
push to `main` and runs across open PRs; one failing PR must not email the
maintainer on every push across the day.

So the bot's PR comment is the record and is **edited in place**, and a failure
whose signature the comment already holds stays quiet. Three conditions stay
**loud** (failing the aggregate step so the run notifies):

1. **A new failure** — the first failure on this PR head.
2. **A changed cause** — the failure signature changed even on the same head.
3. **A systemic failure** — every selected PR failed, not made up entirely of
   repeats (or a member failed to classify itself).

**Quiet is not silent.** A failure that does not notify still maintains four
records:

1. **Its PR comment** (edited in place, carrying the failure signature).
2. **Its line in the job summary**.
3. **A warning annotation** on the run.
4. **Its own red member job** in the matrix (findable in GitHub Actions UI).

## The opposite defect

This covers a workflow that fires constantly and fails every time. The
complementary failure — a workflow that never fires at all — is not visible to
this check, because a workflow with no runs and a workflow with no failures look
identical in the run history. Both are "could not check", and the first rule
applies.

## A superseded PR run is cancelled — and only a PR's

A run on a PR head that a newer push replaced judges a commit nobody will
merge, and it still waits for and holds a runner. So a workflow that runs on
`pull_request` declares

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.event.pull_request.number || github.sha }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Two halves, and the second matters as much as the first. A PR's runs share
one group, so the newer cancels the older. **Every other event is grouped by
its own sha and never cancelled**: a push to `main` keeps its verdict, so
this report's history of `main` is not thinned by cancellations, and a
`cancelled` on `main` keeps meaning contention rather than housekeeping
(the third state above).

A `cancelled` run on a PR's OLDER head is therefore expected and is not a
finding. The merge guard judges the head, and the head's run is never the
one cancelled.

## A green step can be a SKIPPED one: the CI cone

`cat-harness-tools/scripts/ci-cone.ts` lets a pull request skip a `bun run cat <check>` gate step whose inputs are unchanged since main's last green run. Such a step prints `SKIPPED — inputs unchanged since <sha>`, and the job summary lists it under **CI cone**. **Read it as "not asked here", never as "passed here".**

**It is built but NOT wired into the workflow.** Measured 2026-10-07 on the 53 candidate steps of `gates-kg` and `gates-docs`:
- **It saves almost nothing.** The 36 checks it could record skip on a beans-only or one-script PR, but they are the cheap ones: about 30 runner-seconds a run. Deciding costs about 0.5 s a step, roughly 22 s for those steps.
- **Recording would slow main a lot.** The expensive checks cannot be recorded: `kg:audit:check` and `kg:audit:all:check` read the `qa-reports` store, and `skill:register:check` has an unannotated site. Tracing them anyway would add minutes to every main run (`kg:audit:all:check`: 74 s untraced, 782 s traced).

Wire it in when those checks become recordable.

**The rule it follows: an input set is declared or derived, never inferred, and derived is preferred** (no drift, no extra data fields).
- **Declared** is a `task-io` row. It is checked by the input-site audit.
- **Derived** is computed from the run itself and never stored as authored data. A green run on main traces the check under `strace` and records what that run read: the files, the directory listings, the absent paths it probed, and the read-only git commands it ran, with their answers. A PR skips the check only when every recorded path and every git answer is the same, and so is the script fingerprint (import closure, audited environment, tools and `--against` baseline).
- **Inferred** is a guess about what a check reads. It is never used.

**Why the derived set is enough.** The verdict and its read set come from the same run. A PR run with the same code and the same recorded inputs takes the same path, so it reads the same files and gives the same answer. A data-dependent read is covered by the same argument: the file that chose the path is one of the recorded inputs.

**What a trace cannot enumerate is never skipped.** Each of these is recorded as undetermined, so the check always runs:
- a write inside the checkout;
- a git command that is not read-only;
- a traced input site the run reached;
- a relative path with no known directory;
- a trace over 256 MiB;
- more than 20,000 paths.

A failed traced run is asked again untraced, so the verdict is always the check's own.

## A slow workflow can be mostly waiting: fold tiny serial jobs into one

Owner ruling, 2026-11-13 (card "A. Collapse into one job", then "update
skills and processes to see when need to do so"). Each job waits for its
own runner, so a chain of small jobs pays that wait once per link.
Measured: one content layer's run took 23 minutes for about 2.5
minutes of work. Its five small serial jobs each queued for a runner, for
9m29s, 1m, 1m45s, 3m43s and 4m22s.

**When to act.** A job is a candidate to become a step of its neighbour
when either holds:

- its median queue wait is longer than its median run time; or
- it is one of more than 2 jobs in a serial chain (`needs:`) that each run
  in under 1 minute.

**How to see it.** Measure each job from the Actions API (`GET
/repos/<owner>/<repo>/actions/runs/<run>/jobs`):

- its wait is `started_at − created_at`;
- its run time is `completed_at − started_at`.

Take the median over the workflow's recent runs on the default branch,
not one run, because a single wait says more about the runner pool that
minute than about the workflow. The tools layer will add the report. Until
it does, the weekly review below measures by hand.

**What stays a separate job**, even when it is small:

- a heavy job, or a set of parallel shards: folding them makes the run
  longer, not shorter;
- a job that needs different permissions, a different runner, or a
  different environment;
- a job whose check name something reads: `merge:guard`, branch
  protection's required checks, or verdict reuse. Fold it only together
  with every reader of that name, in the same change.

**Who looks, and when.** The weekly CI health review
(`ci-health-watch.bpmn`, the `check:ci-health` step) also looks at job
shape. When a workflow crosses either threshold, it opens a work item
naming the workflow, the jobs, the measured medians, and which of them
must stay separate. The fold itself is an ordinary PR.

## Step names describe what the check does, not merely its passing invariant

A CI step named solely after its passing invariant misdescribes any failure
where the check could not run or the baseline was absent.
A step named `viewer pages keep the navbar they had` that goes red when its audit
sidecar is absent misleads a reader to investigate page layouts when zero pages
regressed. Where a check has both a subject-invariant branch and an
audit/baseline-reachability branch, the step name in the workflow must cover both
(e.g. `viewer pages keep the navbar they had, and audit is reachable`).

## The accidental-repair trap on derived gates

A green outcome on a derived gate (such as `readme:subgraphs:check`,
`docs:harness:check`, or other verify/write pairs) must **never be read as
"was never broken"**.

Because PR branches run `merge:main` which regenerates derived files, an
unrelated PR branch may happen to carry a freshly generated artefact. When that PR
merges into `main`, it incidentally repairs `main`, creating an illusion in CI
history that the commit before it was clean.

**The guard:** The post-merge regeneration pipeline
(`.github/workflows/post-merge-regen.yml`, `scripts/post-merge-regen.ts`) audits
derived artefacts when dispatched on `main` and warns when they are stale;
dispatched for a PR, it commits the regeneration to that PR's branch, and the
release build regenerates into what it publishes (`merge-queue.md`
§"Where derived artefacts are regenerated"). When inspecting CI health on `main`, do not treat an accidental green as
evidence of health: verify that post-merge checks run and derive their state
consistently. Full details in `merge-queue.md` (opt-in `cat-harness.sdlc`) §"The accidental-repair pattern".


