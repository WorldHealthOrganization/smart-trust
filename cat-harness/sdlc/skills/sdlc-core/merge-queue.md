---
name: merge-queue
description: >
  Order the ready PRs and land them as a train: read each PR's live facts,
  let the reprioritisation table place it, merge the members together, run the
  gate set on the combination, and on red attribute and eject the culprit
  rather than reject the train. Every merge goes through `merge:guard`. Use
  for "merge the ready PRs", "land this PR", "what lands
  next", "run a merge train", "why was my PR ejected", "move this PR up", and
  when tuning the train's order or size.
user_invocable: false
uses-methodology:
  - agentic-pre-merge-review
---

# Merge queue — what lands next, and as what

`sdlc/processes/merge-train.bpmn` is the process. The ORDER is computed by
`sdlc/processes/decisions/merge-priority.dmn`; the facts it reads are derived
by `scripts/merge-queue.ts`; what the steward decided is recorded against
`schemas/sdlc/merge-queue.ts`. This page says what each piece is FOR.

## The rule everything else follows from

**The queue stores decisions, never GitHub's facts.** CI status, mergeability,
labels and head SHA change without the queue being told, so a stored copy is
stale the moment it is written and a reader cannot tell which. They are read
live at each step. What a queue entry holds is what the steward DECIDED — the
placement, a hold, an ejection — with who decided it, when, and the evidence
URL it acted on. `FORBIDDEN_FACT_KEYS` in the schema refuses an entry that
carries a fact.

## What "ready to merge" means (STRICT)

Owner, 2026-11-15: "clarify what ready to merge means (e.g. Ready, green
PRs, CI passes etc. need generic ready and cat-harness specific
processes)". Two layers: a generic definition for any repository, and what
a cat-harness layer adds on top of it.

### Generic: any repository

A PR is **ready to merge** when all of these hold:

1. **Out of draft**: its author marked it ready for review.
2. **No conflicts** with its base branch.
3. **CI passes**: every required check on its head has finished and is
   green, judged against the repository's own dependencies. A red that also
   fails on the base branch's own main, and that the PR does not cause, does
   not block it; the PR says so, and that red has someone fixing it.
4. **Its description is complete**: what it changes and why, how it was
   verified, and no unticked checklist item.
5. **Every approval it needs is given**: any review the repository requires,
   and any owner decision the change depends on.

**A ready PR merges right away**, in the same pass, lowest dependency first.
It does not wait for a batch, for a later PR, or for anything in a
repository that depends on it.

### cat-harness layers: in addition

Every repository built on cat-harness (the harness, its tools, the content
layers and the index) adds these to the generic list:

6. **The content rule.** A PR labelled `content` is ready only when the
   owner has asked to review it and its `## Content review` section names
   the review record ([`prepare-merge`](prepare-merge.md) §"Content PRs").
   It merges on the owner's approval, never from the queue. Every other PR
   is non-content and goes through the queue.
7. **The hand-over.** Its own session marked it ready and labelled it
   `ready-to-merge` (or `needs-repin` when only a re-pin is missing), or
   sent the merge manager its request
   ([`merge-manager-watcher`](merge-manager-watcher.md) §"The merge request:
   six lines"). Only the merge manager merges.
8. **`merge:guard` passes**: base, ready-for-review, ready marker, labels,
   CI, checklist, open question, mergeable, and content review. The
   `merge-guard` commit status is `success`. Where the guard and this list
   disagree, fix the guard.
9. **Linked to its issue**, with a comment on that issue for each push.
10. **Pins.** A PR that changes `index.lock.json` (a re-pin or an
    integration PR) moves each pinned layer to that layer's current main,
    with the pins agreeing with each other, and needs the full tier green on
    its head, not only the fast tier. Any other PR is judged against its
    own layer's pins, never a dependent's (§"A lower repository never waits
    on a higher one").

## A lower repository never waits on a higher one (STRICT)

Owner, 2026-11-15: "A lower layer never waits on a higher one". A PR in a
repository is judged only against the repositories it depends on:

- **Merging:** a lower repository's PR is never held for a dependent's lock,
  pins, train or red main. A dependent catches up through its own re-pin.
- **CI design:** each repository's checks run against its own dependencies at
  the versions it pins, never against a dependent's pins of it. A gate that
  mounts a dependent's index and therefore tests an older copy of the
  repository under review is a defect in that gate: file it, and do not let
  its red block the PR (generic rule 3 above).
- **Fixes flow up:** when a lower change breaks a dependent, the fix lands in
  the dependent (or in the lower repository, if it is the lower one's bug)
  after the lower PR merges; the lower PR is not reverted for it unless its
  own main is red.

## Handing a PR to the queue — the sibling session's side (STRICT)

`merge-train.bpmn` has two lanes that matter here:
- **`sibling-session`** ("Sibling session"): whoever submits a PR to the
  queue and fixes it when it is handed back.
- **`merge-steward`** ("Merge steward"): whoever orders and lands the queue.

Both are ROLES, not sessions, so nothing in this section depends on which
session holds either lane.

### The PR is the message

The steward reads open PRs labelled `ready-to-merge`, and nothing else.
A PR labelled `content` is never in the queue, even with `ready-to-merge`
on it: it waits for the owner on its documented content review
([`prepare-merge`](prepare-merge.md) §"Content PRs"). A
comment posted anywhere else reaches nobody: not on a PR you believe is the
steward's, and not on an issue.


A session that cannot message the merge manager labels its own PR
instead: `ready-to-merge` when it is green, `needs-repin` when it is green
except for a re-pin. Only the merge manager acts on either label
([`merge-manager-watcher`](merge-manager-watcher.md) §"The sibling's side:
find the merge manager first"; owner, 2026-11-13).
### Ask the user before submitting

**When you finish your work and are ready to merge, ask the user before submitting to the merge queue.** Do not apply `ready-to-merge` or post the `ready:` marker autonomously without asking the user if you should submit. Submitting to the queue requests landing the code on `main`; the user or owner confirms the submission.

### While a merge manager is active, tell it, and never merge yourself

Owner ruling, 2026-11-07, card "Approvals", B: siblings send merge requests to
the merge manager, and the owner approves only in the merge manager's
session. So, besides the steps below, send the merge manager the six-line
merge request: the PR URL and full head SHA, your session URL, what changed,
the rendered preview URL (or `no preview: <reason>`), what to look for in
it, and `full tier green as judged`. A request with no preview and no reason
comes back. Never merge your own PR. An approval the owner gives in your
session does not authorise a merge. The merge manager posts your request in
its chat, asks the owner on its batch card, and orders the queue:
[`merge-manager-watcher`](merge-manager-watcher.md) §"Am I the active merge
manager?" and §"The merge request: six lines".

Find the merge manager before you send: the latest `merge manager: <session
id>` announcement, noted on the coordination work item, names a session that
must also be live. When none is active the siblings elect one by a fixed
rule; a lone session is elected alone; the lane never lapses into
self-merging (owner ruling, 2026-11-13); and one that does not acknowledge
within the stall window is treated as stalled
([`merge-manager-watcher`](merge-manager-watcher.md) §"The sibling's side:
find the merge manager first").

### Submitting to the queue

To submit, do all of these on YOUR PR:

1. **Owed CI is green on the head, for a release.** See §"Admission asks which runs are OWED". On a non-release merge CI is advisory (owner, card Q-CIB-4 A, 2026-11-08): it is read and reported, and it does not hold the PR ([`merge-to-main`](merge-to-main.md) §"CI gates a release only").
2. **The PR is ready for review**, not a draft.
3. **It carries the label `ready-to-merge`.**
4. **It has a comment `ready: <full head sha>`, signed** with your session link
   (`https://claude.ai/code/session_…`). Every session acts with the owner's
   token, so the link is the only thing that tells sessions apart. A
   `_Generated by Claude Code_` footer alone is not a signature.
5. **It does not carry `needs-merge-human`.** `merge-main.yml` adds that label
   when it refuses a merge and never removes it. If you have since merged
   `main` by hand, remove the label, and say why in a comment.
6. **The body has no unticked box**, and there is no open question to the
   owner or the steward.
7. **An agent-touched PR has an adversarial review on its head**, recorded on
   the `merge-reviews` state branch by a session that is not the author
   ([`adversarial-code-review`](adversarial-code-review.md)). The gate is
   warn-only for now, so a missing verdict is reported, not refused. A train
   keeps each PR's verdict, because the review is per head.

### Watch status after submitting — never fire-and-forget

**When you submit something to the merge queue, you need to watch what its status is.** Submitting is not the end of your turn. Watch the GitHub Actions runs on the head (`check:head-has-run`), evaluate `merge-guard`, and monitor whether the PR is admitted into a train or whether it is refused, held, or failing checks. If CI fails, diagnose and repair the failure immediately rather than leaving a failing PR in the queue.

**Merge order goes on the PR, and setting an order is the owner's call.**
- Write it in the `ready:` comment, on every PR it concerns ("merge before #N").
- Quote the owner's ruling with its date.
- When two PRs must not land in the wrong order, keep the label OFF the later
  one until the earlier one lands. A label is the only hold the steward is
  certain to see.

### After submitting: do not spend CI you do not need yet

Once CI has confirmed the PR, a submitter far back in the queue should not
burn CI cycles keeping up with a churning `main`. Every
merge of `main` into your PR re-runs the whole suite. While other PRs are
landing, each of those runs is obsolete before the steward reaches you.

- **The first green is what admits you.** Your `ready:` marker stays valid
  across `merge-main` bot merges (see "A push makes the marker stale" below),
  so the steward can still see a PR that is a few merges behind.
- **Far back, stand still.** If your PR is not in the next train or two (the
  steward's status comment on your PR gives your position), do not merge
  `main` by hand to stay current. Take `merge-main` off as well: that label
  makes the bot merge `main` into your PR on every push to `main`
  (§"Your merge cadence is an input to the bot's throughput").
- **Near the front, catch up once.** When you are in the next train, or the
  steward asks you to:
  1. put `merge-main` back on, or merge `main` by hand
     ([`prepare-merge`](prepare-merge.md) §"Submodules: check the pointers
     BEFORE you stage the merge");
  2. let CI go green;
  3. post a fresh signed `ready:`.
- **A conflict is the exception.** If `main` now conflicts with your PR, fix it
  when you see it, wherever you are in the queue. A conflict is work, not churn.

**A push makes the marker stale.** A head newer than your `ready:` sha is not
intake, unless every commit since is a `merge-main` bot merge. Post `ready:`
again for the new head once CI is green on it. Do not post "ready soon": it is
not intake, and it costs the steward a read.

### The steward's side: reach a submitter who has fallen behind

While watching the queue, and after every reshuffle or disentangling of
trains, the steward checks the PRs near the front. A PR there can be:
- behind `main` and conflicted;
- red, or with an owed run missing on its head;
- carrying a stale `ready:`;
- carrying `needs-merge-human`.

When the steward finds one, it tells the submitter. It never fixes the PR on
the submitter's behalf, and never waits in silence. It uses the skills it
already has:

- **The status comment on the PR, edited in place.** It states the position,
  what is missing, and by when. Its shape is the one in
  [`merge-conflict-patterns`](merge-conflict-patterns.md) §"When a merge-train
  member is refused".
- **A hand-back work item** when the PR is ejected or handed back (same section).
  The submitting role picks it up even if the original session is gone.
  **Every hand-back gets one, not only a train ejection.** That covers
  `Rule_Refused`, `Rule_HeadNotGreen`, `Rule_NotReady`, and a `merge:guard`
  refusal on a PR the owner asked to land. A PR comment and a queue entry
  are not a hand-back on their own: the work plan cannot see them.
  - **Shape:** titled `Merge refused: #<n> <cause>`, `type: bug`, parented
    under the PR's work item's parent (or under the PR's work item when it is an epic
    or feature), marked `--blocking` that work item.
  - **Body:** the refused checks, roles, the brief (link the takeover plan if
    there is one), where to report, Done when, and Fails if.
  - **Dedupe:** check first, because `beans create` dedupes on nothing.
  - **Process:** run it through `sdlc/processes/merge-refusal.bpmn`
    (`workflow_start`), not from memory.

  `merge:steward` prints `✗ handed back with NO open hand-back bean:
  #…` and carries `handBackBean` per PR in `--json`, because a procedure
  that lives in another skill is skipped unless something checks for it.
- **A direct message as the fast path**, by the recipe below. Use it when the
  PR is next and waiting costs a train.
- **The queue entry** records the hold or ejection, with its reason and
  expiry (§"The steward answers in the queue").

A submitter told "you are next" catches up at once. That is the trade this
section makes: CI is spent on the PRs about to land, not on the whole queue.

### Address the ROLE, never a session

The Merge Steward is a lane in `merge-train.bpmn`, not a particular session,
and whoever holds it today may not hold it tomorrow. So the handover must not
depend on who that is:
- no session id written anywhere, since it dies with its container;
- no "they are active on PR #N", since that PR may merge or the role may move;
- no message as the channel.

Whoever takes the lane next reads the same open PRs and the same queue
entries.

**A direct message is a fast path on top of that, never a replacement.** Use
one when it is the more efficient tool, and say how you used it. It saves the receiver a polling cycle, but it never counts as handing
over: the PR's own state still has to say `ready`. The same recipe works in
both directions:

1. **Find whoever holds the other role now.** Do not use a remembered session
   id.
   - Cloud: run `list_sessions` (claude-code-remote). Match the session whose
     title or `external_metadata.current_branches` shows the lane, or the
     PR's head branch when you are looking for a submitter.
   - Same machine: run `ListAgents`.
2. **Check it can receive.** For a cloud session, run `get_session(id)` and
   confirm `cross_session_inbound == "available"`.
3. **Send one line.** Use `send_message` (cloud) or `SendMessage` (same
   machine), naming the PR and the head sha. The PR comment stays the record;
   the message only points at it.
4. **If any step fails, stop.** Do not post the message as a comment on some
   other PR or issue instead.

[`coordinate`](coordinate.md) §"What actually reaches a sibling" has the
measurements of which tool reaches which kind of session.

### The steward answers in the queue, and the queue lives on the beans branch

Once the steward has decided something about your PR (a placement, a hold,
an ejection), that decision is an entry under `beans/queue/<pr>.json`. The
entry carries `pr` and **`beans`**, the work items and epics the PR serves; name
them in your PR body so the steward can copy them. That list is the
association between a PR and its work items.

**Where to read it depends on the state-branch cutover.** The queue is moving
to its OWN branch, `cat/cat-harness/merge-queue` — §"Where the queue is GOING"
below — and where the two disagree, that section governs:
- **Before the cutover**, `main` is authoritative. Entries reach it only through
  the steward's own PRs, a PR cycle late, so the edited-in-place status comment
  on your PR is the live answer.
- **After the cutover**, `beans/` (with `queue/` inside it) is authoritative on
  the orphan branch **`cat/cat-harness/beans`**. Read it with
  `bun run cat state:mount`. The steward writes an entry the moment it decides,
  then `bun run cat state:push`, which splices only the changed paths onto the tip
  and stops on a conflicting write instead of overwriting it. The entry is then
  live for everyone, and the status comment is a courtesy that points at it.

The branch's `manifest.json` says which state it is in (`"authoritative"`).
Read that rather than this paragraph.

**The cutover also changes what a work item can do here.** A work item created on a
code branch is invisible until the PR lands; a work item written through
`state:push` is visible at once. A submitter can then note on the PR's work item that it is submitted, and the
steward can answer on the same work item. The PR state above stays the intake
signal either way: the work item is where the conversation is kept.

**Not GitHub's merge queue.** It is not offered on a personal-account
repository. The merge guard (`bun run cat merge:guard <pr>`) checks the six submission points mechanically; run it against
your own PR before you announce.

## Where the queue is GOING, and the tool that will write it

**Not cut over yet.** The queue is still on `main` under `beans/queue/`. The
store and CLI below exist; the cutover to its own branch,
`cat/cat-harness/merge-queue`, is a separate small change during which the
steward pauses queue writes. Until it lands, `merge:queue:read` reads the checkout and `merge:queue:record`
**refuses** — keep committing entries to `main` as §"The steward answers in the
queue" describes. The branch's `manifest.json` says which state it is in.

Why the queue comes off `main` at all is structural: an entry on `main` arrives
only through a pull request, and **the steward does no development work** — it
must not open PRs of its own, which would have it setting its own priority in
the queue it manages, spending the CI the queue is starved of, and judging its
own head. On `main`, the one actor whose decisions the queue records is the
one actor that cannot write to it.

After the cutover:

```sh
bun run cat state:mount                  # the queue on disk at its declared path
bun run cat merge:queue:read             # the recorded decisions
bun run cat merge:queue:record --pr <n> --class <c> --rank <r> --rule <id> \
    --reason "<why>" --by <your session URL>          # ...or --position <n> for an owner override
```

- **`record` pushes by default**, as a splice onto the branch tip carrying the
  blob each file was read at. So the entry is live for every sibling at once,
  and a steward who edited the same entry since gets this write stopped as a
  **`conflict`** with the path named rather than overwritten. On a conflict,
  re-mount and decide again; nothing was pushed and the local edit is the only
  copy. `--no-push` leaves it in the mount, where **nobody else can see it**.
- **`--reason` and `--by` are required.** A placement nobody can explain cannot
  be honoured or safely undone by the next steward, and every session here acts
  with the owner's token, so the session link is the only thing that says which
  steward decided.
- **An unreachable queue is not an empty one.** `merge:queue:read` exits 4 and
  `readQueueEntries` THROWS when the branch is not mounted, because "no
  decisions recorded, all clear" printed over a graph nobody read is a false
  clean. Exit 1 — declared-but-absent — is a different answer with a different remedy.
- **The decisions are read back.** `merge:steward` feeds recorded overrides into
  the table's `ownerOverride` input and their positions into the order, treats
  an un-cleared ejection as refused, and prints a live hold, because a
  decision nobody reads back is a decision nobody took.

The queue's decisions and a finished train run's evidence (under `workflows/`)
live in different stores, one `state:mount` apart. The trade is deliberate:
kept together on `main`, the queue could hold no entry the steward wrote.

## Placement is computed, not chosen

`GW_Placement` is DMN-backed, so `workflow_complete` refuses a hand-supplied
outcome there. The table (hit policy FIRST) answers a `route` (`admit` or
`hand back`), a `class` (`PRIORITY_CLASSES`), a `rank` and whether the PR
rides alone.

- **An owner override is an INPUT** (`ownerOverride`), never an outcome. The
  owner places a PR by hand in `Task_Override`; the schema refuses an
  `override` placement without a reason.
- **Independence is decided on AUTHORED paths** (`authoredPaths`,
  `touchesShared`). Generated paths are excluded because
  `merge-conflict-patterns` already resolves them; counting them would make
  every pair of PRs conflict.
- **Ties go to the oldest PR** (`orderQueue`): overrides at their positions,
  then rank, then PR number.

## Admission asks which runs are OWED, never whether anything is red

**On a release, a member is admitted on `ownCi == "green"` (on a non-release merge `ownCi` is reported, not required; owner, card Q-CIB-4 A, 2026-11-08), and `green` means every workflow
owed for the head's event ran and succeeded.** It does not mean "nothing is
failing". A head can have every expected job name present, no `failure`
anywhere, and still have runs `in_progress` and suites `completed` with
`conclusion: action_required` that executed nothing. **Counting the runs does
not catch it.** Only asking *which runs are owed for this event* catches it,
and `check-head-has-run` is the one thing here that asks. Do not write a
second checker: it already
keeps the states apart, has a test, and is already wired into
`pr-checks-present.bpmn`.

Its five states are the five values of `ownCi`, and collapsing any two is the
defect:

| value | means |
|---|---|
| `green` | every owed run present and successful — **the only admitting value** |
| `red` | an owed run ran and failed |
| `missing-required` | it HAS runs, but not the ones owed |
| `none` | GitHub answered and nothing names this head |
| `unknown` | could not ask: no network, rate limit, HTTP error |

`unknown` is handed back, never admitted and **never reported as red**: telling somebody their head is unverified when you merely could not
look trains them to ignore the signal, which costs more than the gap.

**This is a gate, not advice.** `Rule_HeadNotGreen` in
[`merge-priority.dmn`](../../processes/decisions/merge-priority.dmn)
sits immediately after `Rule_Refused` under `hitPolicy="FIRST"`, so anything
but `green` routes to hand-back before any admitting rule can fire, and
`workflow_gate` refuses a hand-supplied outcome.

**A dispatch is not an owed run.** `workflow_dispatch` is the designed
workaround for the bot-actor push condition (`merge-main.yml` dispatches the
gating workflows for exactly that reason), but a dispatched run is evidence
about the TREE, not evidence that the owed `pull_request` run exists. Report
the two facts separately.

## Overlap has a KIND, and a train is the right answer to one of the four

`conflictRisk` answers *is there a collision*. A steward needs *is it the kind
a train is for*, which is `overlapKind`:

| kind | means | what it needs |
|---|---|---|
| `none` | no path shared with any live member | nothing |
| `generated-only` | shares paths, every one resolved by a declared pattern | **regeneration** |
| `shared-declaration` | the only authored paths shared are shared declarations | **ordering** |
| `authored` | shares an authored path that is not a declaration | **a train** |

Four values rather than three because a shared declaration is a **subset** of
an authored path, not a sibling: `classify("package.json").strategy` is
`refuse`, so it is authored, *and* `isSharedDeclaration("package.json")` is
true. A three-value partition would file a declaration-only collision under
`authored` and build trains nobody needed.

`authored` outranks `shared-declaration`, which outranks `generated-only`,
because at each step the earlier kind is the one the later kind's remedy
cannot resolve. The partition is tested in
`scripts/tests/merge-queue.test.ts`
— including that a refused member cannot be the other side of a collision,
since it never enters a train.

## A train admits only members that STACK cleanly (STRICT)

A train is a **stack**: member *n+1* merges onto `main` + members *1…n* with
**no conflict at all**, generated paths included, and with no semantic break
(tsc and the gate set pass on the stack). Check every candidate before
admitting it:

```sh
c=origin/main
for p in <members in order>; do
  t=$(git merge-tree --write-tree $c pr/$p) || { echo "#$p does not stack"; break; }
  c=$(git commit-tree $t -p $c -p pr/$p -m stack)
done
```

A member that does not stack is **not admitted**. It does not go in on the
promise that `merge:main` will resolve it. It goes back to its own session,
which merges `main` on its own branch, gets CI green, and re-signals. Conflict
resolution belongs on the member's branch, never in the train, and never in the
steward's time.

Resolving conflicts inside a train blocks everything else from landing. The
`overlapKind` table above still says what a collision NEEDS; the steward
provides only the `none` row. Every other kind goes back to its owner.

## Two execution modes of `Process_MergeTrain` (`>= 2` ready PRs in any repository — STRICT)

`Process_MergeTrain` (`sdlc/processes/merge-train.bpmn`, entered via `Gw_Train` → `Call_Train` in [`merge-manager-watch.bpmn`](../../processes/merge-manager-watch.bpmn)) applies to **every repository whenever two or more non-content ready PRs are queued** — both repositories with automated GitHub Actions CI runners and repositories gated locally or via dispatch-only workflows. Only a lone ready PR (`queue depth == 1`), a `.github/workflows/` PR (when `MERGE_TRAIN_CARRIES_WORKFLOWS` is unset), or a `subscriptions/` PR bypasses the train into single-PR `Process_MergeToMain`.

### Mode A — Automated CI-runner merge train (`merge-train.yml`)

Where a repository runs `.github/workflows/merge-train.yml`, the steward's train executes as a workflow. A person opts a PR in by adding the `merge-train` label (a bot's label does not count) or by approving it. Every 15 minutes, when there is work, the train:
1. judges the open train PR (`merge-train-batch`) as the re-pin train is judged: every check finished, the full tier ran, and no check fails that passes on main, check by check. When green, it merges the train PR with a merge commit, and every member is then on main;
2. on red, ejects a batch of one (label removed, failures listed), or splits a larger batch in halves and tests the first half next (about $\log_2 k$ extra runs for one culprit);
3. otherwise stacks the ready opted-in PRs on main with `merge:train` and opens ONE train PR, which CI judges once.

**Owner ruling, 2026-11-05 ("Resolve generated only").** For the automated train this supersedes §"A train admits only members that STACK cleanly" for GENERATED paths only. A conflict that a declared generated-path pattern covers is resolved mechanically at train time and proved by the candidate's CI. A conflict in any hand-written file ejects that PR with a comment, and it waits for its author. No person resolves conflicts in the train.

**Owner ruling, 2026-11-05 (off switch).** A PR that changes `.github/workflows/` rides the train only when the repository variable `MERGE_TRAIN_CARRIES_WORKFLOWS` is `true` and a bot token with the workflows permission is present. Until then, workflow PRs are merged one at a time when green (owner, 2026-11-05, option 1). `subscriptions/` never rides.

`merge-main.yml` skips PRs labelled `merge-train`: they are integrated once, at train time, never on each push to main.

**Owner ruling, 2026-11-07, card "Train", A.** When the owner approves an eligible non-workflow PR in a CI-train repository, the merge manager adds the `merge-train` label instead of merging it directly, so the train lands it in a batch with one CI run (merging one PR at a time cost ~6.7 runs per merged PR).

### Mode B — Steward-run local-gate merge train (`ciState: none` or dispatch-only repositories)

In a repository with no automated pull-request CI (`ciState: none` in [`merge-to-main`](merge-to-main.md)) or dispatch-only workflows, running full local builds/verifiers serially across $N$ PRs wastes $N\times$ wall-clock compute and stalls sibling throughput. Whenever `>= 2` ready non-content PRs are queued, the `merge-steward` runs `Process_MergeTrain` locally across **`4–8` mutually independent PRs per train**:

1. **Classify pairwise independence on `authoredPaths` ([`merge-overlap`](../../tools/merge-overlap/merge-overlap.json)):** Read each candidate's `base.ref`, 40-hex head SHA, and diff against `origin/<base>`. Admit `4–8` candidates whose pairwise `overlapKind` is `none` or `generated-only` (declared additive/generated regions). Hand back any candidate with conflicting `authored` overlap or dirty mergeability immediately through [`merge-refusal.bpmn`](../../processes/merge-refusal.bpmn) (`Process_MergeRefusal`).
2. **Compose `merge-train/<base>-<n>` on a clean worktree (`Task_Admit` → `Call_MergeMembers`):** Confirm `git status --porcelain` is empty, create `merge-train/<base>-<n>` from fresh `origin/<base>`, merge each admitted PR head in queue order with `--no-ff`, and regenerate declared additive/generated regions **once** across the composed stack.
3. **Run the combined `Task_LocalGates` suite ONCE (`Call_Gates`):** Execute the repository's full local gate suite (proof/code build, test suite, schema/witness/audit validators, and derived-file checks) **once** on `merge-train/<base>-<n>`, recording exact commands, exit codes, and the composed train tree SHA.
4. **Attribute, bisect, and eject ONLY the culprit on red (`Task_Attribute` → `Task_Bisect` → `Task_Eject` → `Process_MergeRefusal`):** Never discard a `4–8` PR train because one member broke a gate. Attribute from per-PR pre-checks first; if every member passed alone, bisect the stack ($\lceil \log_2 k \rceil$ local gate runs), eject **only** the offending PR, file its blocking `Merge refused: #<n> <cause>` bug work item via `Process_MergeRefusal`, and re-verify the surviving stack.
5. **Land in train order and verify merge replay (`Call_MergeToMain` + `verify-merge-replay`):** Under recorded owner batch authorisation ([`merge-to-main`](merge-to-main.md) §"Recording the authorisation"), land each surviving member onto `<base>` in exact train order pinned to its evaluated 40-hex head SHA (**never passing `--delete-branch`**; applying the single regenerated additive commit if required by the repo's merge workflow), then run **post-merge replay verification (`verify-merge-replay`)**: fetch `origin/<base>`, verify `git diff <tested-train-tree> origin/<base>` is empty (zero drift and zero silently dropped tracked files), and record `"not verified: no CI (verified via local merge-train replay @ <sha>)"` on the parent Swarm Work Item and linked issues.

## Regenerate on a clean tree, and check it

**`git status --porcelain` is empty before a member is merged and the tree
regenerated.** Checked, not assumed, on `Task_Admit`.

Generated directory READMEs carry a per-subdirectory file count, and the
writer counts the files git would commit —
`git ls-files --cached --others --exclude-standard`
(`bootstrap-tools/scripts/git-files.ts:23`). `--exclude-standard` keeps
*ignored* junk out, which is the `__pycache__` case that drove that line, but
`--others` still counts an untracked file nobody has ignored. So a transient
written by an earlier train step moves a committed count,
`readme:subgraphs:check` goes red, and **the red belongs to nobody**.

The precondition does not make the count stable: two members each adding a
file still write different integers to one line. `merge:main` resolves them
under `readme-generated-regions`; a merge made by plain git does not. Not
`-merge` and not a merge driver — both are refused in `.gitattributes`, the
first because it tidies conflicts without removing them and the second because
it needs per-checkout `git config`.

## A red train ejects one member, not the train

1. **Retry only a declared-flaky gate, and only once** (`Task_RetryFlaky`).
   A deterministic gate retried learns nothing.
2. **Attribute from each member's own CI first** (`Task_Attribute`). A member
   whose own CI is red, or never ran on its head — GitHub runs no
   `pull_request` CI while a PR conflicts — is the prime suspect, at no cost.
3. **Bisect only when every member is green alone** (`Task_Bisect`).
4. **Eject and hand back with the reason** (`Task_Eject`, then
   `merge-refusal.bpmn`). The ejection is written on the member's entry; the
   rest re-run without it. The owning session fixes and re-signals ready; it
   is never merged on its behalf.

## A PR lands only through `merge:guard` (STRICT)

**Every merge a steward makes goes through `bun run cat merge:guard <pr> --merge
--session <your session id>`.** Never `gh api -X PUT …/pulls/<n>/merge`,
never the web button, never `merge_pull_request` from an MCP tool, and, while a
Merge Manager is active, never by marking a PR ready or labelling it yourself
first (with none active, see §"When no Merge Manager is active"). The script
(`cat-harness-tools/scripts/merge-guard.ts`) is the merge: it evaluates eight checks over GitHub's live facts, and performs
the PUT, pinned to the head it evaluated, only when every one passes. A direct
PUT lands a PR whatever its state.

### When no Merge Manager is active, elect one; only it merges

Owner ruling, 2026-11-13: only the merge manager merges ([`merge-manager-watcher`](merge-manager-watcher.md)
§"Only the merge manager merges and re-pins"). With none active, the siblings
elect one first, and a lone session is elected alone. A PR's own session
lands its PR only when it is that merge manager, once the owner has said to
merge, and still through the guard:

```
bun run cat merge:guard <pr> --merge --session <your session id> --no-merge-manager
```

`--no-merge-manager` lifts **one** thing: check 2's refusal of a merging
session that marked the PR ready itself. Every other check still applies,
and so does check 2's own-session attribution. In particular, the
`ready: <head sha>` marker signed by this session, `ready-to-merge`, green
owed CI and a clean merge are all still required. The verdict says the
separation was lifted, so the landing is auditable.

**Where the guard cannot run** (for example a cloud sandbox whose `gh` has
no usable token), do not merge: hand the landing to a session that can run
it, or ask the owner. No workflow posts a `merge-guard` commit status, so
there is no posted verdict to read in its place.

How to tell whether a Merge Manager is active: the owner says so, or a live
session holds the `merge-steward` lane (§"Address the ROLE, never a session",
step 1). If you cannot tell, apply the rules of
[`merge-manager-watcher`](merge-manager-watcher.md) §"The sibling's side:
find the merge manager first": with none active, the siblings elect one by
its fixed rule, and a lone session is elected alone (owner rulings,
2026-11-07 and 2026-11-13).
Do not assume none. A stale memory of "there was one yesterday" is not an
answer in either direction.
"The owner said merge" is still required. Submitting to `main` is the owner's
call (§"Ask the user before submitting"), and this does not change that.

The eight checks, each named in a refusal by number and id:

1. **`base`** — open, based on `main`, and the base is not the head branch of
   a merged PR. A stacked PR is retargeted by its owning session first.
2. **`ready-for-review`** — not a draft, and the latest `ready_for_review`
   event is attributable to the PR's **own** session, never to yours.
   When the merge manager lands a PR of its own, `--no-merge-manager` lifts
   the "never to yours" half (§"When no Merge Manager is active").
3. **`ready-marker`** — a `ready: <sha>` comment **signed with the PR's own
   session link** (the one in its body), naming the head, or with only
   merge-main bot merges after it.
4. **`labels`** — `ready-to-merge` present, `needs-merge-human` absent.
5. **`ci`** — **gates a release only** (`--release`, or the `release` label; owner, card Q-CIB-4 A, 2026-11-08). On any other merge the judgement below is made and reported, and the check passes as advisory. The judgement: every `pull_request` run on the head is `success` or `skipped`,
   and every workflow owed for that event ran. A `workflow_dispatch` run
   counts **only** as the stand-in for a `pull_request` run GitHub held for
   approval (`action_required`) on a head that is a merge-main
   bot merge: merge-main has already merged main into that head, so the head
   IS the merge, and a dispatch on it judges the tree that would land. The
   latest dispatch of the same workflow on the head decides — green counts,
   running is not-ready, red is a defect. Held with no dispatch: not-ready if
   `merge-main.yml`'s `for wf in … ; do gh workflow run` line names that
   workflow's file (the dispatch is still owed), reported **not judged** if
   it does not (Feature Staging, preview-only), and `unknown` if that line
   cannot be parsed. A green dispatch never rescues a `pull_request` run that
   executed and went red, and anywhere else it is reported and **not**
   counted. **Feature Staging is judged, never waited for**: a staging run
   still in flight, or not started, is not a refusal — its deploy is held by
   the `gh-pages` rate limit — and the verdict
   says so as **not waited for**. Once it finishes, red still refuses, since
   `stage` runs real checks before it deploys — **unless the only failed
   step is the deploy itself** (`DEPLOY_ONLY_STEP`): a push window that
   never opened, or three rejected pushes, is not a verdict on the tree. The guard reads the run's failed steps to
   tell; if it cannot read them, red refuses as before. The list is
   `NOT_WAITED_FOR_WORKFLOW_FILES` in `merge-guard.ts`.
6. **`checklist`** — no unticked `- [ ]` in the body.
7. **`open-question`** — no comment after the marker asks the owner or the
   Merge Manager a question (a heuristic; its limits are on `openQuestions`
   in the script — a fresh `ready:` after the answer moves the window).
8. **`mergeable`** — GitHub says the head still merges cleanly into `main`
   Check 5's runs tested the head merged with `main` **as `main` was when
   the head was pushed**; once `main` moves, a stale green head with a valid
   marker can pass checks 1-7 while it conflicts. The PR API's
   `mergeable: false` (`mergeable_state: dirty`) refuses **not-ready** —
   merge `main` into the head and re-sign `ready:`. `mergeable: null` means
   GitHub has not computed it yet: the guard re-asks for up to 14 s, then
   reports **unknown**, never a pass. `unstable` and `blocked` pass here,
   because they are about checks and reviews, which check 5 and the owner
   judge. A verdict is a snapshot and can go stale on exactly this check
   when `main` moves; `--merge` re-evaluates live.

Exit 0 is pass (or merged), 1 refused, **2 could not determine — never a
pass.** A refusal is handed back to the owning session through
`merge-refusal.bpmn` with the check's text; the steward does not fix the PR
to make it pass.

**What the OWNING session does, so a finished PR passes:** mark it ready,
then post `ready: <head sha>` signed with its session link —
`https://claude.ai/code/session_…` in the footer — within ten minutes of
each other, and apply `ready-to-merge`. Every session acts with the owner's
token, so the timeline's actor is always the owner and cannot tell sessions
apart; **the signature is the only thing that can**. An unsigned marker is
refused.

**A verdict has four states, and red means wrong, not unfinished.** A PR
that is merely not ready yet (a draft, no marker, no label, an unticked box,
CI still running, an open question, a conflict with `main`) is `pending`. Only a defect is
`failure`: a base that is not `main` or is dead, `needs-merge-human`, red CI
on the head, or a marker or ready-flip by a session other than the PR's own.
`success` is pass and `error` is could-not-determine. Red on every draft
would teach readers to ignore red. Only `success` lands.

**No workflow runs it.** The guard is the script alone, and `--merge`
evaluates live at the moment it lands.

`Rule_NotReady` in
[`merge-priority.dmn`](../../processes/decisions/merge-priority.dmn)
applies the cheap half of checks 1-3 at placement (`readiness`, from
`LivePr.draft`, `baseRef`, `readySha`, `readyBy`), so an unfinished PR is
handed back before it is put in a train rather than at the PUT.

## When the authors stall: the steward dispatches unblockers

Authors' sessions can hit usage limits together, so the whole hand-back
column can go quiet while every member in it is one small fix away from
admission. The steward may dispatch agents for small unblocking fixes,
without using up the CI budget.

**This adds a second actor to step 4 above. It changes nothing else.** An
unblocker fixes the head. It **never merges, never adds `ready-to-merge`, and
never posts a `ready:` marker.** The author still vouches for the PR, and the
steward still lands it only after the author signals ready, or under the
owner's explicit release.

**Who goes:** the PRs `merge:steward` routes to hand-back. Leave out drafts,
PRs whose author was active in the last 15 minutes, PRs another session has
claimed, and PRs under an owner block (a ruling such as "this blocks the PR"
is a judgement about content, and fixing the code does not lift it). Group
them into a few agents, each in its own worktree. The general swarm rules are
in [`swarm-management`](swarm-management.md).

**Every unblocker gets the same rules, written once and handed to all of
them:**

| rule | why |
|---|---|
| **at most ONE push per PR**, after `bun run cat gates` locally — or, when every conflict was generated, after the targeted checks of [`merge-conflict-patterns`](merge-conflict-patterns.md) §"A merge round — run each check ONCE" | each push runs full CI **and** deploys a staging preview into `gh-pages`, which has a size budget. Pushing speculatively spends both |
| no `workflow_dispatch`, re-run, empty commit or close/reopen | the same budget, and a dispatched run is not an owed run (above) |
| the merge manager re-runs only a PR it is about to merge, never held content, never in a batch, never during a GitHub outage, and refreshes a re-pin PR's pins first ([`merge-manager-watcher`](merge-manager-watcher.md) §"Re-run policy") | every failed run emails the owner; re-runs were most of the 11-11 failure emails (card Q-RERUN-1 B) |
| merge commits only: no rebase, amend or force-push | it is somebody else's branch |
| authored conflict → resolve only dead code, or a pure addition carried over verbatim; otherwise quote both sides and stand down | choosing between two behaviours is the author's call |
| `git submodule update --init` and `bun run cat state:mount` before `regen` | without the submodules `merge:steward` cannot load. Without the mount, `fsh-guts:viz:check` exits non-zero (it judges that the mounted graph renders; the page itself is built at publish) and `audit:coverage:strict` goes red |
| delete the worktree's `node_modules` at the end | four parallel installs run out of the container's disk |
| one comment per PR: root cause, the commit it pushed or the reason it stood down | the author comes back to an explanation, not a mystery commit |

**`missing-required` is often a head that CI never started, not a slow
one.** The causes to check, in order:
- the PR edits a workflow file and GitHub cannot parse it, so no run is
  created at all;
- the head was pushed with `GITHUB_TOKEN`, which starts no `pull_request`
  run;
- the run is held at `action_required`.

The first one is not visible in the check list, so look at the YAML.

**After any merge of `main`, check for silently dropped files.** Some files
under `*/test/results/` (LSI indexes, QA and detangle sidecars) are gitignored
but still tracked. Once a resolution step removes one from the index, regen
rewrites it on disk and `git add -A` does not stage it again. Local checks
still pass, but CI's fresh checkout fails. `merge:main` and the merge-main bot
refuse such a merge and name the paths (`droppedInMerge` in
`merge-base.ts`, see `merge-conflict-patterns` §"When one side deleted the
file"). A hand `git merge` gets no such check. After one, run
`git diff --diff-filter=D HEAD^1 HEAD -- '*/test/results/*'`, and restore
anything that main still tracks with `git checkout HEAD^2 -- <path>`.

### Stalled for days, with no handover report: write it, then hand it to a takeover agent

An unblocker suits a short pause. When the authors are gone for days, the
steward does something else:

1. **Writes the handover report each author did not.** It goes as one
   comment per PR, headed `## Takeover plan`, in the
   [`handover-report`](handover-report.md) format and measured, not
   recalled: intent with the owner's rulings quoted; head SHA, conflicts
   split into authored and generated, owed CI; done and remaining; approval
   and any scope drift; ordered next steps with their falsifiers; owner
   questions; couplings with other open PRs. This step is read-only apart
   from the comment.
2. **Gives the owner one paste-able brief** for the takeover agent: the
   cold start, the work order across PRs (the couplings decide it), the
   merge rules, and the open owner questions. The owner starts that agent,
   possibly on another account, so the brief must stand alone.
3. **The takeover session becomes each PR's owning session.** `merge:guard`
   accepts a `ready:` marker only from the session the PR body names, and
   check 2 keeps the merging session from vouching for its own landing.
   So the takeover agent edits the body's session line to its own session,
   records "taken over from <old> (stalled)", claims the work items, and then
   signs. The steward never signs for it, and there is no one-time bypass.

A PR that is green but refused by checks 3 and 4 (no marker, no label) is
`waiting-on-author` in the queue, not `active`, until the takeover session
signs it.

## Landing

**Re-run `merge:steward` after every merge, before the next one.** Each merge
moves `main`. A member admitted against the old `main` can turn `dirty` and
then cannot land at all: its tested head is still green, but GitHub refuses
to merge a conflicted PR, so it waits for its `merge:main` round and fresh CI
on the new head.

Only with the owner's release, which is the authorisation half of
[`merge-to-main`](merge-to-main.md) (`Call_MergeToMain` in `merge-train.bpmn`):
explicit, or a standing ruling
quoted verbatim with its date, and **only through `bun run cat merge:guard <pr>
--merge --session <id>`** (section above). What lands is exactly the SHA CI
tested — the guard pins the PUT to the head it evaluated, so GitHub refuses it
if the head moved; if `main` moved after the train's CI started, re-run
rather than land.

**A standing release covers the queue AS IT STOOD, not every PR that arrives
later.** New PRs need the owner's explicit approval. So on every sweep the steward lists the PRs opened since the
release, and puts them to the owner in one question, with the table's verdict
on each. One answer ("approve all 6") may cover the whole batch.

## Post-merge asymmetry: why main needs its own regeneration pipeline

`.github/workflows/merge-main.yml` runs `bun run cat merge:main` on an opted-in
**PR branch** when `main` moves, resolving declared conflicts and regenerating.
There is a structural asymmetry in the other direction: **after a PR merges into
`main`, nothing in that workflow regenerates `main`.**

So any merge changing an enumerated or counted directory can leave `main` red on a
hard gate, even when the PR merged cleanly with zero git conflicts. The only reason
it usually does not is an accident: the PR branch happened to regenerate against a
base that had not moved yet. When that accident does not hold, `main` goes red and
stays red until somebody notices.

### The accidental-repair pattern

A PR that adds files without regenerating a counted README breaks `main`; a
later, unrelated PR whose branch carries a regenerated README repairs it
**incidentally**; a web-UI upload breaks it again with no generator run at all.

**The trap:** A green on a derived gate must NOT be read as "was never broken" or
"the commit before it was clean". Unrelated PR branches that happen to carry
regenerated files incidentally repair `main`, creating untrustworthy gate
histories.

**Why this halts development:** While `main` is red on a hard gate, every open PR
inherits that red, so no PR can show green, and nothing can be merged on green CI.
PR sessions start debugging their own diffs for failures that belong to `main`.

### Where derived artefacts are regenerated

No automation pushes to `main` and none opens a repair PR: the
`automation/post-merge-regen-<sha>` branches and their PRs piled up with no CI
once Actions could no longer open PRs here, and they are gone. A full regen
composes and regenerates the whole index, 50-80 minutes of runner time, so it
runs only when a person dispatches it or the release build calls it. No pull
request, push or schedule event starts one.

1. **For a PR, by hand, before it merges.** Dispatch `post-merge-regen.yml`
   with `pr` set to the PR's number or branch (`gh workflow run
   post-merge-regen.yml -f pr=<n>`). It runs the regen writers at the PR's
   head. When a tracked file changed, it commits ONE
   `chore(derived): regenerate derived artefacts for <sha>` to the PR's own
   branch; for a fork's PR it commits nothing and fails with the command to
   run. The PR's checks judge that commit, so the regen reaches `main`
   through the normal, tested merge. Pushed with GITHUB_TOKEN, the commit
   starts no CI and the run fails saying so; a `REGEN_PUSH_TOKEN` secret lets
   the checks start by themselves. A head that is itself a regen commit and
   still regenerates fails (no fixpoint), so it cannot loop.
2. **At release, automatically.** `release-npm.yml` regenerates into the
   package it publishes (a patch applied to the release checkout, never
   committed) and publishes nothing when a check is unrepaired.
3. **On main, by hand: verify and warn.** `post-merge-regen.yml` with `pr`
   empty regenerates in its runner, warns with what was stale, and commits,
   pushes and opens nothing. NEGATIVE CONTROL: a `main` with nothing stale
   warns about nothing.

Branch and staging preview builds do not regenerate.

### Merge steward procedure: post-merge verification

- **A PR carries its own regen.** When a PR changes the inputs of a derived
  file, its author (or the steward) dispatches the regen for it before it
  merges. The PR's own gates report a stale derived file as they always did.
- **Main stale on a derived gate:** dispatch the verify run to see what is
  stale, then dispatch the regen for the next PR in the queue, or for a PR
  opened only to carry it, which is admitted with priority under
  `merge-priority.dmn` as an unblock-main repair.
- **A red regen run is that PR's failure**, like any other check: a fork PR
  runs the regen it names, and a regen commit pushed without CI needs one more
  push before the PR's checks run.

## ACK every PR that enters the queue, on its bean (STRICT)

A submitter who hears nothing cannot tell "queued"
from "lost", and the work item is where the next session looks.

When a PR enters the queue (first seen on a sweep, or approved by the
owner), the steward writes three things in the same change:

1. **The queue entry**, `beans/queue/<owner>--<repo>--<pr>.json`. It holds the
   table's placement, a `reason` that begins `ACK:` and says what the PR waits
   on, and **`beans`**, copied from the PR body. Validate it against
   `MergeQueueEntrySchema`.
2. **A note on each work item the PR serves**, one file per work item per branch:
   `beans/notes/<bean>--<date>--<branch>.md`. A note, never an append to the
   work item def; `bean-coordination` (opt-in `cat-harness.work-plan`) says why. Then run
   `bun run cat beans:notes`, or CI's `beans:notes:check` goes red.
3. **One comment on the PR** naming the entry and the work items. Before the work items
   cutover, items 1 and 2 reach `main` only through the steward's own PR, a
   cycle late, so the comment is the ACK the author sees now. After the
   cutover, write 1 and 2 with `state:push`; the comment then just points at
   them.

A PR whose body names no work item gets the entry with `beans: []` and a comment
asking the author to name one. The steward does not invent the association.

## Every open PR has an entry: review the whole list, then triage it

`merge:steward` skips drafts, and a PR that nobody ACKed has no entry, so the
queue silently shrinks to the PRs someone happened to look at.

On a review, and at least once per working session:

1. **List every open PR**, drafts included, from the API; not from the
   steward's table and not from memory.
2. **Every PR without an entry gets one with `status: "unknown"`.** A
   draft gets the placement `rule: "draft"`, `class: "hand-back"`,
   `rank: 99`, and its `decision` names the steward, not the DMN, because
   the table never placed it. Claiming the table did would be a fact the
   steward invented.
3. **Triage each one into a status** (`QUEUE_STATUSES` in
   `schemas/sdlc/merge-queue.ts`), with the evidence in `reason`:

   | status | when |
   |---|---|
   | `active` | its author pushed or commented within 24 hours |
   | `waiting-on-author` | handed back with a named ask, and the author is not back yet |
   | `blocked` | waits on another PR, work item or ruling, named in `reason` |
   | `stale` | no push **and** no human comment for more than 24 hours. Bot pushes from `merge-main` do not count as activity |
   | `approval-void` | the owner approved it, and then its scope changed |
   | `landed` | merged. The entry stays as history; it is never deleted |

4. **Report the stale ones to the owner as a decision**, never close them:
   closing a PR is the author's or the owner's call
   ([`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md)).

**An approval is for the content that was approved.** A branch can change
scope after approval. Compare the title and the changed-file count against
what was approved before landing. On a mismatch, set `approval-void` and ask
again.

## Your merge cadence is an input to the bot's throughput

**Pacing and concurrency are one question, not two.** `merge-main.yml` sweeps
the `merge-main`-labelled PRs on every push to `main`, so each merge you land
starts a sweep — and the per-PR `merge` job's concurrency group decides what
happens to the sweep already running.

A sweep takes 1–15 minutes, and a steward draining the queue can land a merge
more often than that. `cancel-in-progress` is trigger-dependent, so a push
sweep QUEUES behind the running one rather than killing it. The rule:

- **A sweep in flight is work in progress — do not count a PR as unmergeable
  while its merge job is queued behind your last landing.** Re-read it after
  the sweep settles.
- **When you are landing faster than the sweep completes, you are the reason
  the behind-PRs are not catching up.** A merge still carries only `main@T(n-1) -> T(n)`
  per sweep; a burst of landings leaves a backlog of steps to carry.

## A hold has an EXPIRY and a trigger, or it outlives its reason

A hold is a decision, and like every queue entry it records what the steward
decided — not a fact. Facts move. **So a hold is only valid while the condition
that justified it is still true, and the steward re-derives that condition at
every sweep rather than inheriting it.**

Write a hold with three parts or do not write one:

| part | why |
|---|---|
| **what it waits on** | the condition, stated so it can be checked mechanically |
| **what ends it** | the observation that lifts it, not a time |
| **what it costs** | which PRs are being held, so the price is visible |

Two failures that both look like diligence:

- **Inheriting a hold across its own justification.** Once the condition a
  hold waited on has passed, the hold must go. A hold whose reason you cannot
  restate from current facts is not a hold, it is a habit.
- **Holding to protect a PR that was already conflicted.** A head that needs a
  forward merge whatever happens is protected by nothing. **If the thing you are protecting already needs the work
  your hold is avoiding, the hold is free of benefit and not free of cost.**

## Sweep the whole queue; a tracked handful is not the queue

**Compute the mergeable set from the open-PR list every time, never from the
PRs you happen to be following.** A PR not in your mental list is in no list
at all.

The sweep is cheap and mechanical: for every open non-draft PR, read
`base.ref`, run `git merge-tree --write-tree origin/main <head>` for the rc,
and read the check runs on that exact head. Three columns, one pass. A PR with `base == main` and
`rc == 0` is a *candidate*; whether it is mergeable is still the OWED question
above, not a count of failures.

**`no failures and nothing pending` is NOT green.** One completed check out of
the full suite reads `bad=0 wait=0` because **almost nothing has been asked**:
a gate that did not fire is indistinguishable from one that passed, and a
tally of failures cannot tell them apart.

So the third column is the owed SET, never a count: compare the check-run
*names* on that head against the set owed for its event, and treat a missing
name exactly as a red one. A steward that cannot say why it is not merging a PR
which is green **on the owed set** is holding it by accident; one that merges on
`bad=0 wait=0` alone is merging unverified.

The exact meaning of "all green" for a merge, including the full tier and
superseded cancelled jobs, is rule 1 of
[`merge-manager-watcher`](merge-manager-watcher.md) §"Merge-sweep rules".
`bun run cat merge:watch` prints that verdict for every open PR.

## Read `base.ref` BEFORE anything else: a stacked PR is not a main-queue member

**`merge-tree origin/main <head>` answers a question nobody asked when the
PR's base is not `main`.** Mergeability, independence and placement are all
computed against the base, so a stacked PR measured against `main` is measured
against the wrong tree — and the merge button lands it on the wrong tree too.

A PR merged onto a stacked base closes as merged while its commits are not on
`main`. The tell is cheap and it is first:
`gh api repos/<o>/<r>/pulls/<n> --jq .base.ref`. A queue sweep must print the
base.

A stacked PR is not admitted to the main queue. Either its base lands first and
the PR is re-measured against `main`, or it is rebased onto `main` by its
author. The steward's job is to notice, not to resolve it.

**GitHub does not retarget a stacked PR when its base PR merges.** It retargets
only when the base BRANCH is deleted, and these repositories keep merged
branches. So "stacked on #N, GitHub retargets to `main` when #N merges", a
sentence a PR body may well carry, is false here. Read `base.ref` again after
the lower PR merges, and retarget it yourself (`PATCH .../pulls/<n>` with
`base=main`) before merging.

## `git add -A` after a merge silently reverts the submodule gitlinks

**And `git submodule status` does not catch it.**

A merge resolves a submodule gitlink like any other path. `git add -A` then
re-records every submodule at **whatever the working tree happens to have
checked out**, overwriting the resolution. If you initialised submodules
*before* merging, and the base advanced them, you have just reverted them to
the merge base — and `git submodule status` shows **no `+` and no `-`**, because
the index and the working tree agree with each other. They are simply both
wrong.

The symptom is usually not a submodule error but `regen` reporting checks as
"a real defect, not staleness", from a module-load failure such as an export
not found in a submodule script.

Two rules follow:

- **Stage explicitly after a merge**, never `git add -A`, while any submodule is
  in the tree.
- **Verify the pins against the ref, not against the working tree.**
  `git ls-tree <ref> bootstrap bootstrap-tools` is what exposes this;
  `git submodule status` cannot, and a check that cannot see the defect is not
  evidence of its absence.

## A local gate run in a contended container is not evidence — and here is the ratio

A `bun test` shard in a shared agent container can run about **ten times
slower** than on a dedicated runner, and at that ratio the default 5 s
per-test budget stops measuring the code:

```
grep -c "timed out after 5000ms"                    -> N
grep -cE "^error:|Expected:|Received:|toBe|toEqual" ->  0
```

So the signature is cheap to check and worth checking before you believe a red
local run: **all failures are `timed out after Nms` and the assertion-failure
count is zero.** That is contention. Report it as *inconclusive under
contention* — never as green, and never as a defect — and let CI on the exact
sha be the authority. What you must not do is "fix" a test that is not broken,
and `never skip, disable or quarantine a test to get green` applies with full
force here, because the temptation is strongest when the failure is not real.

**Two ways to get this measurement wrong:**

- A count read from a partial log, before the run ends, is not a count.
- A compound command's exit status is the last command's, and a test runner's
  status has to be captured before anything else runs.

## Agentic pre-merge review: warn-only and the would-have-blocked counterfactual

Agentic merge review is **warn-only**.

### Architectural decision: staying WARN-ONLY with measured justification

The decision to keep agentic code review warn-only is governed by empirical evidence, not caution:

1. **Literature gap**: Across five ingested agentic SE papers (CodeAgent arXiv:2402.02172v5, SWE-Debate arXiv:2404.04834v4, SWE-Router arXiv:2507.23348v1, TCAndon-Router arXiv:2601.04544v1, He et al. arXiv:2607.00053v1), **zero empirical false-positive rates (FPR) exist for an LLM judge**.
2. **CodeAgent's unconfirmed flag rate**: CodeAgent's own human annotation revealed that **48.6% of GPT-4's flags were unconfirmed**. A reviewer where nearly half of all flags are unconfirmed cannot be a blocking gate.
3. **SWE-Router & SWE-Debate noise boundaries**: LLM-as-a-judge suffers from self-enhancement bias, verbosity bias, and positional bias.
4. **Deterministic compile checks stay blocking**: G5 (Lean module compilation), G6 (SUSHI FHIR compilation), and G7 (JSON-LD schema validation) are deterministic compile gates that have exact binary outcomes and remain blocking. An agentic reviewer does not share this property.
5. **Backlog inversion**: A blocking gate over an active codebase with unreviewed content nodes would fail on existing background patterns rather than PR delta, inverting the order of necessary backfill.

### The counterfactual instrument: why only a warn-only phase can measure FPR

A blocking gate destroys the counterfactual: when a gate blocks, authors modify code, bypass checks, or abandon PRs. It is impossible to determine whether the flagged condition would have actually broken production or represented a false positive.

By contrast, a warn-only gate records `blocking`-severity findings as **"would have blocked"** (`WouldHaveBlockedRecordSchema` in `schemas/sdlc/merge-queue.ts`), pinned to the PR's `headSha`. The PR then merges to `main`. Subsequent monitoring observes whether any defect materialized, enabling humans to adjudicate findings:
- `true_positive`: Finding correctly identified a genuine defect.
- `false_positive`: Finding flagged benign, correct code.
- `unknown`: Third state (inconclusive, unverified, or cannot be determined).

**The third-state rule**: `unknown` is strictly preserved and never folded into `true_positive` (which would artificially deflate FPR) or `false_positive` (which would artificially inflate FPR).

### Pre-registered promotion criteria

To prevent choosing thresholds to fit data, promotion criteria are registered as numbers and windows *before* data collection begins (`AgenticPromotionCriteriaSchema`):
- `minimumPrWindow`: 50 evaluated PRs.
- `maximumFalsePositiveRate`: <= 0.05 (5% FPR: `confirmedFalsePositives / (confirmedTruePositives + confirmedFalsePositives)`).
- `minimumReviewCoverage`: >= 0.80 (80% non-unknown adjudication: `(confirmedTruePositives + confirmedFalsePositives) / warnedFindings`).

Until all three criteria are empirically proven, the agentic review remains **warn-only**.

## Tool-integrated agentic pre-merge review (CodeAgent / 2402.02172v5)

Codified in `research/methodologies/agentic-pre-merge-review.md` (opt-in `cat-harness.research`).

Multi-agent tool-integrated code review architectures (Tang et al., arXiv:2402.02172v5)
structure automated pre-merge evaluation into specialized roles (Reviewer, Coder,
QA-Checker, Consistency, Security) across four sequential phases.

Three operational rules govern its integration into this repository's merge queue:

1. **The Deterministic vs. Judged Boundary**:
   Deterministic compile gates (Lean formal proofs, SUSHI/FHIR IG AST, JSON-LD schema renders,
   linter and test suites) answer questions with one computable truth — **these MUST BLOCK**.
   LLM-mediated agentic code reviews answer questions with uncalibrated error rates — **these
   MUST WARN ("would have blocked")**, exiting 0 and logging structured finding sidecars.
2. **The False-Positive Guard**: an automated review gate must never block merge on
   unverified LLM assertions (see the unconfirmed flag rate above). Promotion from warn to
   block requires measured calibration against recorded repository defects, per the
   pre-registered criteria above.
3. **Bounded Dialogue Budgets**: Conversational QA-Checker loops must cap at a maximum of 2
   adjustment iterations to avoid latency explosions (CodeAgent measured 5 min / $0.122 per review)
   and context window exhaustion. Deterministic formatters and linters must run directly in CLI
   gates (`bun run cat gates`) rather than consuming multi-turn LLM reasoning.

## What this does not do yet

The train's size is a fixed cap. Sizing it by risk waits for this process's
own run records, which is why each run is a committed instance under
`beans/workflows/`. The tools named on the steps (`merge:overlap`,
`merge:train`, `merge:leftover`) live on branch `claude/merge-pipeline-tools`
until it lands.

