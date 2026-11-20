---
# folio-assistant-03nl
$schema: bean/1.0.0
title: 'MERGE-MAIN NOTIFICATION HYGIENE: one bad matrix member reds the whole run, and an unchanged failure re-notifies on every push to main'
status: completed
type: bug
priority: high
created_at: 2026-10-04T05:52:09Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-1xhc
---

## Brief

**What and why.** The owner is being emailed *"Merge main into opted-in PRs /
merge:main into PR (1958) — Failed in 6 minutes and 18 seconds"* many times a
day. `merge-main.yml` fires on every push to `main` (many per hour) and runs one
matrix member per opted-in PR; a single member's failure makes the whole run
`failure`, and GitHub emails the run. Run `37179860536` failed on exactly one
member (`merge:main into PR (1801)`, step *"Fail on anything but a merge, an
up-to-date branch or a refusal"*). The condition was already known and already
fixed on another branch (bean `z7n1`), so every subsequent email carried no new
information. Notification hygiene is the deliverable; the particular PR is not.

**What is already measured.** The 1801 root cause is `qa-resolve-conflicts.ts`
staging with a plain `git add` under a newly gitignored directory, so
`merge-base.ts` aborted "without a refusal" (bean `z7n1`, fixed on
`claude/festive-galileo-s7ibx0`); `merge-base.ts` runs from main's copy, so the
fix only takes effect once it lands. The `merge-main` label was removed from
#1801 as a stopgap, which is not the fix.

**Approach.** (1) The matrix member no longer decides the RUN's colour:
`continue-on-error: true` on the `merge` job, with a single aggregating `notify`
job that fails only on a NEW or SYSTEMIC condition. (2) A failure signature is
written into the bot's existing in-place PR comment; a failure whose signature
the comment already records is a REPEAT and stays quiet. Falsifiable: if
`continue-on-error` on a job does not keep the run conclusion green, the emails
continue and the whole approach is wrong — pinned by the workflow test and
checkable on the first real red member after merge.

**Not doing.** Not re-fixing `z7n1`; not disabling the workflow; not removing
anyone's `merge-main` label; not reintroducing `needs-merge-human` (owner ruling
2026-10-03, retired on `claude/festive-galileo-s7ibx0`).

**Parent.** `folio-assistant-1xhc` — *a gate that does not fire is
indistinguishable from one that passed*. Suppressing a notification is one move
away from suppressing the gate, so every quiet outcome here still has to leave a
durable, findable record (the PR comment, the job summary, a red-but-ignored
job, an annotation). That is this epic's sentence applied to the notification
layer rather than to the gate layer.

## Done when

- [ ] a repeat of an identical failure on an unchanged PR head does not fail the run
- [ ] a new failure, a changed cause, a systemic failure and a `select` failure all still fail the run
- [ ] every quiet failure is still recorded in the PR comment AND the job summary, and its member job is still red
- [ ] `cat-harness/scripts/tests/merge-main-workflow.test.ts` covers the new behaviour
- [ ] bun run cat gates green, PR CI green, PR marked ready-to-merge

## Landed on `claude/merge-main-notification-hygiene` → PR #2046

**What changed.** `continue-on-error: true` on the `merge` matrix member, so one
member's failure no longer reds the RUN (which is what GitHub emails); the bot's
in-place PR comment now carries a SIGNATURE of the failure it reports
(`<!-- merge-main-signature: … -->` = PR head sha + merge-base's own
`ABORTED`/`STILL fails`/`fatal:` lines + the comment text, normalised); and one
new job, `notify`, is the only thing that reds the run.

**Loud:** a new or changed failure; a member that reported no verdict or could
not classify itself; a systemic failure (every selected PR failed) that is not
made up entirely of repeats; `select`'s own failure (no `continue-on-error`, and
`notify` deliberately does not double-count it).

**Quiet, and still recorded four ways** — PR comment, job summary, warning
annotation, and the member's own red job: a repeat of an identical failure on an
unchanged head, a refusal, the head-moved race, a cancelled run, a rejected
fast-forward, the `workflows`-scope push block.

**A correction I made to my own first design, recorded because it is the same
defect in a new hat:** systemic was loud unconditionally. Under this merge
cadence a persistent all-fail state would then be ~100 emails a day about
conditions each PR's comment already reports. It is now loud unless every one of
those failures is a repeat — the run in which a systemic state BECOMES true is
still loud, because each member's first failure is new then.

**What a new job owes here, found by three gates rather than by memory:** a BPMN
node (`Task_Report` + `Start_Report`/`GW_News`/`End_Notified`/`End_Recorded`, a
deliberately separate flow — drawing it inside one PR's merge would say the run
notifies per PR); a `STEP_EXEMPTIONS` entry in `gates.ts` declaring the
`--aggregate` step `ci-only` with its reason; and `skill:register` +
`render:bpmn` + `processes:viz`, whose 20-odd generated artefacts are committed
with it.

**Spun out rather than widened in:** `obhe` — `ci-health.md` already carries this
doctrine ("an edit does not notify, so a long outage stays one unread item
rather than a stream") and names only the tracking-issue instance.

**Not verifiable from this container, and said in the PR body rather than
assumed:** that `continue-on-error` on a JOB keeps the run's conclusion green,
and that `if: ${{ !cancelled() }}` makes `notify` run when `merge` was skipped or
failed. Both are documented GitHub behaviour, pinned by the workflow test, and
checkable with one safe `workflow_dispatch` (the PR body gives the exact command
and what to look for); the harness refused the dispatch as a shared resource,
which is correct.


_2026-10-04_ — **PR #2046 is green and labelled** `ready-to-merge` + `merge-main`; not merged (workflow file, merge manager orders it, #1952 first). Gates run 37185893239 success on head `1a0bbdfc9`.

**The regeneration ORDER for a change that adds one BPMN node**, learned from two red CI rounds: `render:bpmn` → `translate-bpmn --extract` → `glossary:page` → `term:mapping` → `skill:register`. The registration chain is necessary and NOT sufficient — it runs neither `term:mapping` nor `translate-bpmn`, and its own verify passes `check:glossary` BEFORE the pots are re-extracted, so running `glossary:page` first leaves five localised pages stale under a green chain.

Also measured: **no `pull_request` run fired for either of the last two pushes** (bean `3pqn`'s shape), so the green verdict is a `workflow_dispatch` on the branch head rather than on main-merged-into-branch. Said on the PR rather than left to read as a current green.

## Completed on landed evidence
Landed on main in PR #2046 (beans(03nl): merge-main notification hygiene and matrix member failure isolation).
