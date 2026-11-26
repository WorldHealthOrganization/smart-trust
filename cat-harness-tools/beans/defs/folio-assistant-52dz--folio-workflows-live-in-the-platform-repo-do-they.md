---
# folio-assistant-52dz
$schema: bean/1.0.0
title: |-
    FOLIO WORKFLOWS live in the PLATFORM repo — do they belong here? them

    `AGENTS.md` already states the shape for two of them — 'qa-sweep and witness-refresh fail by design in this repo: the first preflights on content/package.json, the second needs computations/, and the platform carries no folio' — and adds 'do not fix a dispatch-only workflow by dispatching it'. So at least some are deliberate: the platform ships the workflow a folio will use.

    If that is the intent for all twelve, the question is whether a workflow a repository cannot run should live in it at all, or be part of what `folio_init` writes into a folio. If it is NOT the intent, some of these are dead files whose paths broke at the #223 split and nothing noticed — `check:ci-health` cannot see them because a path-filtered workflow that never fires has no runs to be red.

    They are now declared `no-folio` in `STEP_EXEMPTIONS` with reasons, so a machine can read what prose asserted. **That records what they are and does not decide where they go.**

    ## Done when

    - [x] decide: shipped-for-a-folio, or dead since the split, per workflow
    - [x] the shipped ones have a home that makes their non-running visible rather than silent
    - [x] the dead ones go to `fsh-guts/`, never `rm`
status: completed
type: task
priority: normal
created_at: 2026-09-20T07:44:35Z
updated_at: 2026-09-20T09:12:10Z
parent: folio-assistant-1xhc
---

Owner, 2026-09-20: *"whats using them? give more info"*.

## Answer: NOTHING is using them

Measured 2026-09-20 — and the measurement **corrected this bean's own
framing**, which called them "folio workflows living in the platform".

### 1. Nothing triggers them

All eight are **`workflow_dispatch` only**. `publish.yml` also declares
`workflow_call`, and **no workflow calls it**. They fire if, and only if, a
person clicks "Run workflow".

### 2. Two have never run at all

| workflow | runs, all time | last | outcome |
|---|---|---|---|
| `section-title-audit` | **0** | — | never fired |
| `witness-pipeline` | **0** | — | never fired |
| `publish` | **1** | 2026-06-24 | failure |
| `qa-sweep` | **267** | 2026-08-09 | failure (every run in the visible window) |

`qa-sweep`'s 267 runs fired on **`push`**, on branches doing Lean/Hecke work —
so the trigger was removed at some point and the history is from when it was
not. Every visible run failed.

This is why `check:ci-health` cannot see them: it reads runs on the default
branch, and a workflow with **zero runs** has nothing to be red. The `5rfy`
shape — "29 of 32 workflows never fire on their own" — with the dial at zero.

### 3. The framing in this bean was WRONG, and the truth is more actionable

I wrote that these run against "a FOLIO's tree, which the platform does not
have". **Seven of the eight scripts exist right here**, under `cat-harness/`:

    content/pipeline/qa-sweep.ts                   -> cat-harness/... EXISTS
    content/pipeline/qa-section-title-audit.ts     -> cat-harness/... EXISTS
    content/pipeline/latex-overfull-report.ts      -> cat-harness/... EXISTS
    content/pipeline/conditional-class-banner-audit.ts -> EXISTS
    content/pipeline/codemod-leanval.ts            -> EXISTS
    scripts/audit-wiring.ts                        -> EXISTS
    scripts/section-story-audit.ts                 -> EXISTS
    pipeline/build.ts                              -> exists NOWHERE

The workflows name them **without the `cat-harness/` prefix**, and were last
touched **2026-09-18** — two days before the #223 split moved everything under
`cat-harness/`. **The split broke their paths and nothing noticed**, because a
dispatch-only workflow that nobody dispatches produces no evidence of being
broken.

So it is not one question but three, and they have different answers:

- **`pipeline/build.ts`** — genuinely absent. Folio-shaped, or dead.
- **The seven that exist** — platform scripts with pre-split paths. Whether
  they should run here is a real question; that their paths are wrong is not.
- **The `on:` triggers** — all dispatch-only, two never used. Even with correct
  paths they would still fire only by hand.

## What this changes about the `no-folio` exemptions

The `STEP_EXEMPTIONS` entries added under `j2w4` say these steps "run against a
FOLIO's tree, which the platform does not have". For `pipeline/build.ts` that
holds. **For the other seven it is wrong**, and an exemption resting on a wrong
reason is the thing that table exists to prevent. Correcting them is part of
this bean now, not a separate one.

## 2026-09-20, working it: the dispatch-only framing was STILL too narrow

Measured by writing the check rather than by reading the workflows, which is
what turned up the part I had missed twice.

### THREE live workflows were broken, and one of them is the watchdog

Not dispatch-only. These fire on a schedule and crashed on their first
command, every time, since the #223 split:

| workflow | schedule | invoked | resolves? |
|---|---|---|---|
| `health-check.yml` | **daily** `41 6 * * *` | `bun run test/health/run.ts` | no — it is `cat-harness/test/health/run.ts` |
| `ci-health.yml` | weekly Mon | `bun run scripts/check-ci-health.ts` | no — `cat-harness/scripts/...` |
| `upstream-pins.yml` | weekly Tue | `bun run scripts/check-upstream-pins.ts` | no — `cat-harness/scripts/...` |

Run by hand at the time of writing, both exit 1 with
`error: Module not found`.

**`ci-health.yml` is the workflow whose entire purpose is catching workflows
that fail where nobody looks** (`xom7`, `ynu8`, `lq7e`). It had been failing
at its own job, at its own job. That is not irony worth a sentence; it is the
argument for gating this mechanically, because the one guard aimed at this
class was itself a member of the class and could not see itself.

`ci-health.yml` is also written defensively — a crash writes no report, so
`status=1` degrades to `verdict=unknown`, the tracking issue is left untouched
and the job fails. The design worked. Nobody read the result.

**Confirmation after the fix, and it is the good kind:** `bun run
check:ci-health` now runs, and its FIRST finding is *"Repository health
watchdog — 1 consecutive failure(s), no success in the window, last ran 0d
ago"* — i.e. the tool, once repaired, immediately reports the daily workflow
I had found by hand. It also prints `(4 other workflow(s) not failing.)`
against a repository carrying roughly thirty: everything with **no runs** is
invisible to it, which is `5rfy` and is why this bean's dispatch-only half
cannot be closed by a report that reads runs.

### The other framing correction: `pipeline/build.ts` DOES exist

The previous section of this bean said it "exists nowhere". Wrong —
`cat-harness/content/pipeline/build.ts` is there. But pointing the workflow at
it would be a **wrong fix that looks like a right one**: those invocations run
after `cd content`, so they name a *folio's* pipeline, and the platform's file
merely shares the basename. That is now recorded as a `FOLIO_PATHS` exemption
with exactly that reason, and a test pins it.

So the honest count is: **every referenced script exists somewhere**; eleven
invocations legitimately need a folio; eight were platform scripts that simply
lost their prefix.

### What was done

- the three live workflows now call the **npm script** (`health`,
  `check:ci-health`, `check:upstream-pins`), so the path is written down once
  instead of in every caller
- the five dispatch-only ones had `cat-harness/` restored inline
- `cat-harness/scripts/check-workflow-paths.ts` — every script path a workflow
  invokes must resolve **from the directory the step actually runs in**. It
  computes the cwd (job defaults, step `working-directory`, `cd` within the
  run block, `--cwd`, and `actions/checkout` `path:`), because checking the
  spelling alone reports working workflows as broken and trains readers to
  skim. Three verdicts plus `undetermined`, which FAILS — a `cd` naming a
  variable is not a pass.
- registered as `check:workflow-paths` **and added to the gates workflow**.
  That last part is the point: this bean is about a check nothing invoked.
- 20 tests, each pinning a refusal or a discrimination; ratchet falsified in
  both directions (un-fixing a path goes red; an exemption matching nothing
  goes red).

### What is still the owner's

Fixing the paths makes these workflows *load*. It does not make them
*runnable*: the five dispatch-only ones still expect a folio tree under
`content/`, which this repository does not have, so they would now fail for
the true reason instead of a misleading one. Whether they should live here at
all is unchanged and unanswered — and is deliberately not settled by this
change.

## Done when

- [x] the live, scheduled workflows are fixed — `health-check` (daily),
      `ci-health` and `upstream-pins` (weekly)
- [x] the platform scripts that lost their `cat-harness/` prefix are restored
- [x] a check that a workflow naming an unresolvable path is REPORTED, and it
      is wired into a workflow that actually runs
- [x] the `no-folio` claim re-stated per invocation, with the reason that is
      actually true for each (`FOLIO_PATHS`, with tests)
- [x] **owner:** the five dispatch-only workflows expecting a folio under
      `content/` — do they belong in the platform repo, or move to what
      `folio_init` writes into a folio? If dead, they go to `fsh-guts/`,
      never `rm`
- [x] **owner:** two of them (`section-title-audit`, `witness-pipeline`) have
      never been run once. A workflow with no runs is invisible to
      `check:ci-health` by construction, so "fixed" here is unobservable
      until something dispatches them

## 2026-09-20: the per-workflow classification, measured

This bean's first "Done when" — *"decide: shipped-for-a-folio, or dead since
the split, per workflow"*. Here is the evidence. **The framing "vendored by
folios" turns out to be false**, which changes the answer.

### Which workflows even need a folio

Six reference a folio tree (`cd content`). Not the eight this bean assumed,
and `conditional-class-banner-audit` has no workflow file at all:

| workflow | trigger | `cd content` | runs, ALL TIME | vendored by qou? |
|---|---|---|---|---|
| `publish.yml` | dispatch **+ workflow_call** | 7 | 1 (2026-06-24, failure) | no — **qou CALLS it** |
| `qa-sweep.yml` | dispatch | 4 | 267 (last 2026-08-09, failure) | no |
| `blueprint.yml` | dispatch | 1 | **0** | no |
| `lean-build.yml` | dispatch | 1 | **0** | no |
| `lean_ci.yml` | dispatch | 1 | **0** | no |
| `section-title-audit.yml` | dispatch | 1 | **0** | no |

### `publish.yml` is NOT in question, and that is settled

It declares `workflow_call` and has a NAMED LIVE CALLER: qou's
`.github/workflows/build.yml:10` does
`uses: litlfred/folio-assistant/.github/workflows/publish.yml@main`. Its own
header says so, and adds the reason its calls had never run — *"a reusable
workflow must declare `workflow_call` to be callable at all"*, which it now
does.

So `publish.yml` is the platform's **published interface** to folios. It
belongs here, it is not dead, and moving it would break qou. Remove it from
this bean's scope.

### The other five: nothing ships them

Two independent measurements, and they agree:

1. **qou vendors NONE of them.** The only real folio has 13 workflows of its
   own — `lean-axiom-guard`, `lp-dual-gate`, `probe-float64-gate`,
   `witness-staleness`, `word-provenance-gate`, … — every one folio-specific,
   plus `build.yml` which calls the platform. Zero overlap with the six.
2. **`folio_init` writes no workflows at all.** `grep -c '\.github/workflows'
   cat-harness/scripts/init-folio.ts` → **0**.

So *"the platform ships the workflow a folio will use"* — the reading
`AGENTS.md` offers and this bean inherited — **is not the operative state**.
Nothing ships them. There is no mechanism that would, and the one folio that
exists grew its own instead.

`workflow-paths-resolve.test.ts`'s header asserts *"Most workflows here are
VENDORED BY FOLIOS"* and names `lean_ci.yml` as an example. That is **not true
of qou**, which is the only folio to check it against. The claim may have been
true of an earlier arrangement; it should not be quoted as current.

### What is still the owner's, now better posed

The question is no longer "platform or folio_init". It is:

> Five workflow files sit in `.github/workflows/` where GitHub lists them,
> offers a Run button, and counts them — four with **zero runs ever**. They
> are not templates, because nothing copies them. Should they be
> (a) made into templates `folio_init` actually writes, (b) moved to
> `fsh-guts/` as superseded, or (c) left as reference material somewhere
> that is not a live workflow directory?

A template in `.github/workflows/` is indistinguishable from a workflow — it
is dispatchable, it inflates every count, and `check:ci-health` carries
exemptions for it. That is `5rfy`'s "29 of 32 never fire" as a standing cost.

**Not acted on.** `deletion-requires-confirmation`: nothing moves to
`fsh-guts/` on an agent's own initiative, and never `rm`.

## Done when (revised)

- [x] decide, per workflow, with evidence — table above
- [x] `publish.yml` established as a live interface, out of scope
- [x] the "vendored by folios" premise checked against the only folio: FALSE
- [x] **owner:** the five — templates `folio_init` writes, `fsh-guts/`, or
      reference material outside `.github/workflows/`?

## Summary of Changes

Owner, 2026-09-23/24: *"folio_init templates"* for the generic three, and
*"Genericise them"* for the Lean four. None was dead, so none went to
`fsh-guts/`.

- `cat-harness/templates/` is declared as `folio-templates`. `document/`
  (qa-sweep, qa-sweep-nightly, section-title-audit) is written into every new
  folio. `paper/` (blueprint, lean-build, lean-build-sidecar, lean_ci, plus
  their scripts and the lake-cache action) is written into paper folios only.
- The Lean workflows name no paper. A discover job builds a matrix over every
  `<folio>/<paper>/lean/` that has a lakefile, and finding none fails the job.
- Scripts that other files still use were copied, not moved. STEP_EXEMPTIONS
  and check-workflow-paths lost only the entries that matched nothing.
- `init-folio.test.ts` pins the document/paper sets, no `qou`, no leftover
  placeholder, and YAML that parses.

`witness-pipeline.yml` was not part of the owner's decision and has never run. It moved to its own bean, `1l13`, and `section-title-audit` is now a template, so the never-run item has nothing left here.
