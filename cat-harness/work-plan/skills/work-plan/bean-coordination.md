---
name: bean-coordination
description: >
  Pointer to the bean-based session work-plan system (the `beans` CLI
  flat-file issue tracker, data under `beans/`). Operational usage lives in
  todo-manager.md / session-intent.md; this file is the canonical copy of the
  coordinator logic that downstream repositories sync from.
---

# Bean Coordination

The **bean-based work-plan system** — the [`beans`](https://github.com/hmans/beans)
CLI, a flat-file issue tracker storing issues as markdown under `beans/` — is
how every session tracks its work-plan and how agents hand off across sessions.

## A bean is never deleted

`beans delete` exists in the CLI. **Do not use it — not on a sibling's work item,
and not on your own.**

Work that turns out not to be wanted is **scrapped**: `status: scrapped`, with
a section saying why. That is also what "disable" means here; the CLI's status
vocabulary is `draft`, `todo`, `in-progress`, `completed`, `scrapped`, and
there is no disabled state.

A scrapped work item records that something was considered and rejected, and on
what grounds, which stops the next agent re-entering the same dead end. A
deleted work item leaves a sibling session unable to tell abandonment from
accident.

### Archiving is a VIEW, not a third way out

`beans/defs/archive/` is **not** a terminal state. An archived work item **keeps its
status** and is still part of the store, moved aside rather than closed.
Archiving is a file move, not a status change, so it records no reason and is
not a way to make unwanted work go quiet.

**`bun run cat check:bean-archive`** holds the rule: the `archive` node must be
declared in `beans/beans.json` — `check:declared-dirs` and
`check:harness-dirs` compare declarations against disk, not the reverse, so
they cannot see an undeclared directory — and every work item in it must be
`completed` or `scrapped`. If you want a work item out of the way, scrap it *with its reasons*
first, then archive if you like.

`readBeans` reads the **active** store and `readArchivedBeans` the archive.
They share the graph typology `bean-defs`, so anything resolving by KIND gets
whichever is declared first; resolve the archive by its **id**. A work item count
that reads only the active store does not fall when work is archived.

**Claiming and closing are separately scoped.** Claim before you work, so two
sessions do not pick the same item (§"Claims are global via the branch store").
**Closing is governed by evidence, not by authorship**: read §"Closing a bean
whose work has already landed" before you close anything — it carries the three
obligations, and the `ready-to-close` tag for the case where you cannot
re-derive the measurement yourself. What stays off limits is a work item a sibling
is **mid-flight** on: a claim naming a branch, a recent note, an open PR.
Closing that loses work the sibling had not finished reporting.

Full cycle, as a diagram: [Work items and todos](https://litlfred.github.io/folio-assistant/docs/cat-harness/guides/beans-and-todos.html).

**Operational spec (read these):**

- [`todo-manager.md`](todo-manager.md) — work item lifecycle: `beans create` /
  `update` / `list`, parent/child epics, status transitions. This is the
  authoritative *local* usage spec.
- `session-intent.md` (opt-in `cat-harness.sdlc`) — session-start intent + session-end
  results protocol against the master ledger and the work item queue.
- `pending-show.md` — read-only "what is this session
  working on?" display.
- [`idle-backlog.md`](idle-backlog.md) — pull right-scoped work items while idle.

**Install the CLI:** `cat-harness-tools/scripts/install-beans.sh`
(idempotent; `go install github.com/hmans/beans@latest`).

## Claims are global via the branch store

**Claims are written immediately to the work-plan store** ([`work-plan-store`](work-plan-store.md))
by `bun run cat beans:claim <id>`. The claim (`update(id, { status: "in-progress" })`) and its
holder note (`note(id, ...)`) are persisted directly to the shared store, so:

- **Immediate global visibility**: sibling sessions see your claim as soon as
  `beans:claim` finishes.
- **Atomic write with collision detection**: if two sessions race to claim the
  same work item, the store Tool detects the conflict and rejects the second
  claim (`state: "conflict"`).

Always claim with `bun run cat beans:claim <id>`. Do not use `beans update
--status in-progress`, which writes no holder note and does not persist to the
shared store.

A claim is not gated by the code pre-push hook (`prepare-merge` step 6), which
judges only the checked-out code commit. How the git state-branch Tool pushes
claims and state commits to `refs/heads/cat/...` is in
[`work-plan-store-git-branch`](work-plan-store-git-branch.md). If a claim is ever
refused as a gate failure, that is a bug in the hook — report it, and do not
bypass the claim.

**When several agents drain at once, or the store has more than one copy**, the
claim is [`bean-drain`](bean-drain.md) step 2 instead: check recent history and
open PRs first, then claim across every store copy (the `bean-claim-check`
Tool). `beans:claim` writes one copy and reads status only.

### Linking PRs to beans with `Closes-bean:` and recording closure evidence

Code changes on `main` and work-plan state in the work-plan store
([`work-plan-store`](work-plan-store.md)) are separate. To link them:

1. **In your PR body**, include:
   ```markdown
   Closes-bean: <bean-id>
   ```
2. **On closure**, record the landed merge commit SHA from `main`, the branch,
   and verifiable evidence in the work item body (`update` / `note` in
   [`work-plan-store`](work-plan-store.md); when the store is on a git state
   branch, push with `bun run cat state:push` per
   [`work-plan-store-git-branch`](work-plan-store-git-branch.md)).

### A DECISION bean you will not land soon — put the question where a person reads

A **decision** work item exists to get a ruling, and its value is that somebody
with the authority to rule sees it. A work item left on a branch merely gets
duplicated; a decision left there sits unanswered while every branch
downstream of it waits.

**If you open a decision work item on a branch you will not land soon: set `status:
draft` in front matter (or `beans create "<title>" --status draft`), post the
question where the owner already reads — the issue — and say ON THE WORK ITEM where
you posted it.** All three parts. The comment is what reaches a person; the
line on the work item stops the next session re-asking and tells them where the
answer will appear; and `status: draft` lets automated checks find an
unanswered ruling request. `draft` is already in the status enum and otherwise
unused, so it needs no new vocabulary. A decision work item stays `status: draft`
until ruled on or landed.

```yaml
---
status: draft
...
---
```

**Prose is not a signal.** Recognisers over work item prose (`Recommendation`,
`Options`, `safe default`, `ruling`, an unticked box) disagree by two orders of
magnitude, and also match work items that *record* a ruling. So a check reads the
STATUS, never the prose. `bun run cat check:draft-beans`
(`scripts/check-draft-beans.ts`) finds any ruling request that never landed,
reporting with a denominator.

### The trigger is STARTING WORK, not claiming

> **Run the open-PR check before you start work on a topic — not only before
> you claim a work item.** A cause inside a work item you already hold, a fix an owner
> just asked for, a gate you are about to unbreak: each is a unit of work a
> sibling can already have a PR up for, and none of them involves claiming
> anything.

**Search the subject as well as the id**: the file you are about to edit, the
gate you are about to turn green, the symbol you are about to add. A search
keyed on a work item id finds nothing when the sibling's work has no work item of its
own, or its work item is only on an unpushed branch.

A duplicate-detecting test punishes **whoever merges second**, not whoever
duplicated. Merging first does not mean you were first.

**Starting any new unit of work runs the collision review in
`coordinate` §"Starting new work"**, scaled to its blast
radius and recorded in the workplan work item before the first edit.

### And ASK AGAIN before you open the PR — looking once is not enough

> **Re-run the open-PR search immediately before you open your PR, not only
> before you start.**

A search at the start finds nothing when the sibling's PR does not exist yet,
and no relation between work items can fix that: the second session to arrive
cannot know it is second. Only asking again later finds it. These do not
replace the second check:

| alternative | why it fails |
|---|---|
| a `describes:` edge between work items | the second session to arrive cannot know it is second, so nobody is in a position to write the edge |
| a label or line on the PR carrying work item ids | only helps once a PR exists, which is exactly the window these collisions open in |

Same commands, same widened search terms — the subject as well as the id. The
cost is one call at a moment you are already stopping to write a PR body.

> **Two independent implementations of one fix produce two sets of observations,
> and the weaker implementation's observations look like findings about the
> subject** — and you cannot tell which set you hold until the other lands.

So the second check also stops a measurement taken against your own artefact
from being reported as a property of the system.

### `bun run cat beans:claim <id>` — how it behaves

`scripts/claim-bean.ts` builds the status change as a commit of its OWN and
pushes it, so a sibling sees the claim immediately instead of when your PR
opens.

```sh
bun run cat beans:claim <bean-id>              # store defaults to the CURRENT directory's checkout
bun run cat beans:claim <bean-id> --dry-run    # say what would happen
```

**Run it from the checkout doing the work.** The command resolves the
checkout's top level, prints `claiming from <tree> (branch <b>)`, and **refuses
with exit 5** when that checkout is on the default branch or detached — the
signature of the wrong tree — naming the tree it was about to write to. Pass
`--repo <worktree>` from elsewhere; `--any-branch` overrides for a claim that
really is made from there.

It is a **claim only** — never your work: a claim bundled with work cannot be
pushed until the work is ready. It also writes the same status into **your**
copy of the work item, so a branch still carrying `todo` does not revert the claim
at merge time; it does not commit that. It builds the commit in a detached `git
worktree`, so a session mid-edit is not asked to accept a checkout, and removes
it on every path including failure.

**Read the outcome, because three of the seven are refusals:**

| outcome | exit | what it means |
|---|---|---|
| `pushed` | 0 | claimed; every session sees it |
| `already-claimed` | 0 | a sibling holds it, and is **named**. Nothing written — pick another item |
| `held-unknown` | **4** | `in-progress` there, and **nobody recorded a holder**. Nothing written. It cannot tell a live sibling from a claim abandoned days ago, so it refuses and says so — read the work item and the open PR list before taking it |
| `already-closed` | 0 | it is `completed` or `scrapped` there. **Not claimed, deliberately** — reviving finished work, and especially a `scrapped` work item whose purpose is recording a rejected approach, is a decision rather than a side effect of asking to claim |
| `new-on-branch` | 0 | the work item is not in the shared store yet, so nobody can see it and there is nothing to race over. Claim locally and open the PR early |
| `fell-back` | **3** | the push was REJECTED. The work item is **not** claimed anywhere a sibling can see — claim on your branch and open the PR at your first commit |
| `unknown` | **2** | the store could not be read. **Never** "the bean is free" |

**`held-unknown` is common**: any work item set `in-progress` with `beans update`
instead of `beans:claim`, or hand-edited, carries no holder. Its exit code is
**4**, distinct from `0` (which `already-claimed` uses to say *pick another
item*) and from `2` (the store was read perfectly well).

**`fell-back` is to be expected.** Whether a direct push is accepted cannot be
determined from inside an agent session (`GET /branches/main/protection`
answers 403, and `git push --dry-run` does not run receive hooks), so the tool
attempts and handles the rejection, loudly. A non-fast-forward is **retried** —
another claim landed first, and the retry may discover the work item is now theirs,
which is the correct answer rather than a conflict to force past.

Two sessions choosing the same work is a different failure from two concurrent
PRs going green alone and red together; the latter is about merging concurrent
work.

## Lifecycle of a coordinated work item

Several agent sessions run in parallel against the same repo, each in its own
`claude/*` branch and ephemeral container. Without discipline they duplicate
work, clobber each other's queues, or resolve items a sibling is mid-flight on.
Work items are the shared substrate.

1. **Prime** — at session start read the current work-plan (`beans prime` +
   `beans list`, or the CLI-independent fallback that parses `beans/` directly).
   Know what is open and what siblings are touching.
2. **Declare intent + claim** — before starting, claim the work item via
   `bun run cat beans:claim <id>`, which records your holder note and updates
   the work-plan store ([`work-plan-store`](work-plan-store.md)) immediately so
   siblings see it globally. When the work item
   is for a process step (`code-change-review`, `merge-train`, `crdm-requirements`,
   etc.), start or resume its workflow instance with `workflow_start` (`--bean <id>`)
   so the work item is placed on its current BPMN step
   ([`process-state.md`](../../../skills/process/workflow/process-state.md)).
3. **Work** — keep the work item current; advance the workflow instance with
   `workflow_complete` as each step finishes; append status notes as you go **to a work item
   only your branch is changing**. When other open pull requests are adding
   to the same work item, write a note instead — §"Adding to a bean — a note, not
   an append" below. Do not fork it into a parallel `todos/*.json` queue —
   link to any bulk queue from the work item instead.
4. **Hand off or finish** — on landing, close the work item, complete its workflow
   instance (or run `bun run cat workflow:instances --sweep` to close stale
   instances on closed work items), and update any cross-repo ownership note.
   **If you stop mid-flight, leave the work item `in-progress` with a
   note saying where you got to**, so the next session resumes instead of
   re-deriving. A work item abandoned silently is indistinguishable from one nobody
   started.

An **unclaimed** work item is fair game for any session; a claimed one is not.
Respect sibling claims. Agents create and set `in-progress`; they do not take
over the work another session is mid-flight on.

### Complete it in the PR's own last commit

**Mark the work item `completed` in the last commit of the PR that does its work.**
Do not wait for the merge: a completion committed after the merge, on a branch
then re-created from the new `main`, is in no PR and is orphaned, so the work item
still reads open and the next session is offered finished work. If the PR is
abandoned, the work item reads done only on a branch that never lands.

- The `## Done when` items are ticked in that same commit, with the evidence,
  so the work item shows *why* it is complete, not just that it is. When the work item
  delivers requirement statements, those items ARE their success criteria,
  copied when the work item was made (`todo-manager` §"Working with Beans" 4), and
  the work item is in its requirement set's `workPlan` — so ticking them is judging
  the criteria, and closing the last work item of a set is what moves the set
  toward `delivered`.
- A work item whose Done-when is not yet all met **stays open** in that commit, with
  a note saying what is left; completing it to avoid an orphan would be the
  opposite error.

`bun run cat beans:landed` reports what slipped through: open, non-epic work items named
in a merged PR's title on `main`, those with every Done-when item ticked listed
first. It reports and never closes; closing is still on evidence, per the next
section.

## Adding to a bean — a note, not an append

**When more than one open pull request has something to add to the same work item,
each writes a NOTE, never an append to the work item.**

```bash
bun run cat beans:note <bean-id> --title "Finding 3: ruling and after state" --body "…"
git add beans/notes/      # the note AND the regenerated index
```

That writes `<bean-id>--<YYYY-MM-DD>--<branch>.md` in the declared `notes`
directory of `beans/beans.json`, and rewrites the generated index beside it
(`README.md`). The work item itself is not touched. Appending from several PRs puts
every other open PR in conflict on that one file, and the merge-main bot
refuses a work item conflict on purpose: two sessions editing one work item is a
coordination question, not a regeneration, so the shared write is what has to
go.

**The branch is the key, and that is the rule that must not drift.** Two open
pull requests never share a branch, and the branch is known at the first
commit, which a pull request number is not. A second note from the same branch
is a new `##` section in that branch's own file — found by its front matter,
not by today's date — so only that branch ever writes it. A date-plus-finding
name would collide when two sessions work the same finding on the same day.
Reasoning in full:
`cat-harness/schemas/sdlc/bean-note.ts`.

**What still conflicts, and why that is acceptable.** The index is rewritten
by every pull request that adds a note, so two of them conflict on it. Its rows
all sit inside one `<!-- bean-notes:begin -->` region, so the declared
`readme-generated-regions` pattern resolves it without a person and `regen`
rewrites it from the merged notes. The notes themselves never conflict.
`cat-harness-tools/scripts/tests/bean-notes.test.ts` merges two real branches to
show both halves, and fails when the branch is dropped from the name.

**What `beans:notes:check` judges** (in CI): every file in the directory is a
`folio-bean-note/v1` note naming a work item that exists, under exactly the name its
own front matter derives (a hand-named note is the first step back to two
pull requests writing one path), and the index is current.

- **The work item's own body stays the owner's.** Re-scoping it, ticking its
  `## Done when`, or closing it are still edits to the work item, made by whoever
  holds it.
- **A note does not move the work item's `updated_at`**, because bumping it from
  every pull request is the one-line conflict notes remove. A reader asking "is anyone
  working on this?" reads the index's dates as well as the work item's.
- **Sections appended before the convention stay where they are.** Moving them
  would rewrite the region every still-open pull request is appending to.

## Closing a bean whose work has already landed (STRICT)

A work item verified done and left open is as misleading as one abandoned silently:
an agent that picks it up re-derives work already on `main`. A rule that says
only who may **not** close a work item leaves nobody able to discharge it. **So: a
work item closes on EVIDENCE, not on authorship.**

> **You may close any work item — whoever opened it — when you have re-run the
> measurement yourself and it passes.** You may not close one because a note in
> it says somebody else measured it.

Three obligations come with that:

1. **Re-derive, never quote.** The note claiming resolution is the thing under
   suspicion; reading it is not verification. Run the check, then record the
   command and its result in the work item, because notes claiming resolution do
   fail re-verification. Where a note gives a line number or a count, verify
   the *fact* — line numbers rot.
2. **A Done-when only a person can satisfy is not yours to discharge** — for
   example "the issue can be closed by its author"; an agent never closes an
   issue on its own say-so.
3. **Mid-flight is still off limits.** This governs work that has *landed*. A
   work item a sibling is actively working — a claim naming a branch, a recent note,
   an open PR — is theirs, finished or not.

**Verified-done and still not closable? Say why, with an expiry**, in the
shape [`bean-blocking.md`](bean-blocking.md) requires of a block: an exception
that carries no way to re-derive it is indistinguishable from an oversight.

Stopping because you are *blocked* is a different state with its own
requirements — what it waits on, since when, an expiry and a handoff:
[`bean-blocking.md`](bean-blocking.md).

### Reconciling closes in bulk — and an owner's reopen outranks your evidence

A sweep that closes many work items on evidence (patch-ids on main from
`branch-archaeology`, a gate that now passes, commits
naming the work item) is these same three obligations applied per row. It adds one
of its own: the owner may have moved work items from `completed` back to `todo` or
`in-progress` because the earlier close was not good enough, and those work items
can still carry a `close(<id>)` commit on main.

> **Before closing, read the work item's own status history**
> (`history(id)` in [`work-plan-store`](work-plan-store.md), plus the archive;
> see [`work-plan-store-git-branch`](work-plan-store-git-branch.md) for the git
> state-branch form). **If it was
> closed and later reopened, it is not closable on any evidence that predates
> the reopen.** Read the reopen note. Close it only with evidence that answers
> that note's reason and is newer than it. If there is no such evidence, list
> it as "reopened by the owner — evidence does not answer the reopen" and
> leave it.

The same holds in reverse: evidence that a `completed` work item did not land (its
commits absent from main under every test in `branch-archaeology` §1) is a
finding to report, not a licence to reopen it on the agent's own say-so,
unless the owner has asked for that sweep.

### Re-derive from the REMOTE, never from your checkout (STRICT)

**Where you read the evidence from is part of the evidence.** Getting it wrong
produces a finding that is confident, specific and false — for example "this
file has no such code" read from a checkout branched before the commit that
added it.

**A branch older than the claim.** Grepping the working tree answers *"is this
in MY base"*, which is a different question from *"does this exist"*.

> Ask the remote: `git show origin/main:<path>`, `git log origin/main -- <path>`.
> Never `grep` over the checkout to prove an absence.

**A fetch in the same compound command is not a barrier.** `git fetch -q origin
main && git cat-file -e origin/main:<path>` looks airtight and is not: sibling
sessions merge every few minutes, so the ref can be stale when read.

> Fetch, then read in a **separate** command, and re-read before publishing.

**A file that exists only on an open PR's head.** When the claim is *"nobody
has built this"*, check the open branches too, with the
[`open-work-lookup`](../../tools/open-work-lookup/open-work-lookup.json)
Tool: a path, a prefix or a work item id, against `main` and every open PR head
(see also [`bean-drain`](bean-drain.md)).

**The cost is asymmetric, which is why this is STRICT.** A missed finding is a
work item that stays open one more day. A false one about a sibling's work is a
correction, a retraction, and a reader who now trusts the next finding less.

### When you cannot re-derive it yourself — `ready-to-close`

Re-derivation is not always available: the measurement may need a running
deployment, a branch this container does not have, or a judgement the owner
reserved. Without an exit, *leave it open* is what an agent picks every time,
and the work item costs a session of confusion on every sweep.

> **The third state: tag the work item `ready-to-close`, quote under a `## Evidence`
> heading what you DID verify, and say in one line what you could not re-derive
> and why. The owner confirms the batch.**

It is a **tag, not a status**, because the status vocabulary belongs to the
third-party CLI:

```
$ beans update <id> --status ready-to-close
Error: invalid status: ready-to-close (must be in-progress, todo, draft, completed, scrapped)
$ beans update <id> --tag ready-to-close
Updated <id>
```

and `BeanStatusSchema` in `schemas/tools/tool-types.ts` is defined as *"exactly what
`beans update --status` accepts"*, so a sixth status here would desync the
schema from the tool it documents.

`bun run cat check:ready-to-close` lists every tagged work item with its evidence, so the
confirmation is one read. **It reports and never acts** —
[`deletion-requires-confirmation.md`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md) — unless
the owner has waived the `bean-close` gate for this session or process run, in
which case the batch closes under that waiver and the turn report names it:
[`confirmation-waiver.md`](../../../skills/conduct/conduct-core/confirmation-waiver.md).

**It is not a parking space.** `ready-to-close` says *re-derivation is beyond
this session*; it never says *I would rather not*. Where you can run the check,
run it and close the work item.

## Where a sibling session is visible from (STRICT)

Sibling sessions can be **listed** (`list_sessions` gives each one's id,
title, branch and a task summary), which is enough to see WHO overlaps you
before you write anything. They cannot reliably be **reached**: each sibling
is its own cloud container, and messaging one may be refused. Seeing a sibling
is not reaching one; what you commit is the only thing that arrives.

> **A session is an ephemeral container, and nothing about it survives the
> container except what it committed. The `Claude-Session:` trailer on a commit
> is therefore the ONLY durable session identity this repository has, and a
> branch tip is the only durable statement of where a session got to.**

### A sibling's state is INFERRED, and the inference has a boundary

| what the trailer and the branches DO tell you | what they do NOT |
|---|---|
| which commits a session authored | whether it is running now |
| when it started and stopped committing | whether it is blocked, thinking, or gone |
| which branches carry its work, and its latest subject | what it intends to do next |

**"Stopped committing" is not "finished", and it is not "abandoned".** Treat a
recent tip as a live claim, treat silence as a question, and ask — never as
licence.

### One command, not a procedure

```sh
bun run cat sessions --since 4h
```

The `sibling-sessions` **Tool node** (`tools/sibling-sessions/`) does this, so
every session counts the same way. It reads **all** branches, because a
sibling's work is on ITS branch. A window with no commits **exits non-zero**
rather than reporting "no siblings": a sweep over nothing has not found
anything.

### Before creating or claiming, look

- **The checkout is a snapshot.** A container fetched `main` when it started,
  and everything merged since is invisible until it fetches again.
- **`beans create` is not idempotent and dedupes on nothing.** The existence
  check in [`todo-manager`](todo-manager.md) §"Check before you create" reads
  the LOCAL store, so it cannot catch a duplicate a sibling created since, and
  the cost of not looking is duplicates somebody scraps one at a time.

**So before creating a work item for a decision, or claiming one, do both:**

```sh
git fetch origin main
bun run cat sessions --since 4h
```

The second is the one that gets skipped, and it answers *who else is on this
right now*.

## A quiet claim — what `in-progress` does NOT tell you

`blocked` has an expiry ([`bean-blocking.md`](bean-blocking.md)); `in-progress`
has nothing, so it carries **no information about activity**, and a reader
cannot tell a stalled agent from a claim nobody has thought about since a bulk
edit.

### The signal is liveness, not elapsed time

> **A claim is LIVE when something outside the work item says so: an open PR naming
> it, an unmerged branch touching it, or a note since. A claim with none of
> those has announced nothing to anybody — and a claim that announces nothing
> does not reserve anything.**

**Elapsed time is the fallback, not the rule**, because it is what a tool can
compute offline. `bun run cat health` reports `bean-quiet-claims` at **72 hours**
since `updated_at`, alongside `bean-claimed` as the denominator. Its count is
an **upper bound**: a work item it lists may have an open PR the sweep cannot see.
Read it as "check these", never as "take these".

### Who may act

- **Any session may TAKE a quiet claim** — check for a liveness signal first;
  if there is none, work it, and say in the work item that you took it and what you
  found. This is the unclaimed case, reached by a different route.
- **Nothing re-statuses it automatically.** The check reports; a person or the
  session taking the work acts. A tool that flipped `in-progress` back to
  `todo` would destroy the one record of who was where.
- **Quiet is not evidence of completion.** Closing is governed by §"Closing a
  bean whose work has already landed", and staleness is not evidence. A quiet
  claim on unfinished work goes back to the pool; it does not get closed.

### A stale claim is reset to `todo`, and the reset keeps the record

A claim untouched for weeks is not one anybody is honouring, but it still
tells every sibling "taken".

> **A claim with no liveness signal (§"The signal is liveness") AND no commit
> naming the work item or touching its branch in 14 days may be reset to `todo` by
> a sweep, provided the sweep appends a note recording what it reset.**

```bash
beans update <id> --status todo --body-append - <<'NOTE'
_<UTC timestamp>_ — claim reset by stale-claim sweep: was `in-progress` since <date>,
held by <branch / session from the holder note, or "no holder recorded">; no open PR,
no unmerged branch naming it, no commit in 14 d. Re-claim with `bun run cat beans:claim`.
NOTE
```

This does not contradict "nothing re-statuses it automatically": the note
keeps the record. The sweep is run by a session or the owner who has checked
the network half (`bun run cat check:quiet-claims`), never by an unattended
job. **14 days is the `bean-stale-in-progress` threshold in `bun run cat
health`**, so the two never drift apart. The reset never moves a work item to
`completed` or `scrapped`, never touches an epic whose children are moving,
and runs as one batch with a summary, under
[`work-plan-restructure`](work-plan-restructure.md) when it is more than a
handful.

## The branch store is the one every sibling reads (STRICT)

Work items live in the shared work-plan store ([`work-plan-store`](work-plan-store.md);
on git, the dedicated state branch in [`work-plan-store-git-branch`](work-plan-store-git-branch.md)), not
committed to `main` or held on unmerged feature branches, where a review of the
store sees none of them.

1. **Write work items directly to the work-plan store.** Newly created work items, epics and
   Done-whens are written (`create` / `update` in [`work-plan-store`](work-plan-store.md);
   `bun run cat state:push` on the git state-branch Tool) as soon as the plan exists, so the work plan is immediately
   visible to all agents.
2. **A sweep reads the work-plan store**, and also sweeps open branches that still
   carry work item files from before the shared store, so no session is blind to
   current goals and claims.

## Each bean has one home (STRICT)

Each work item lives in exactly one store, because copies of one work item written
separately drift apart:

| Work item | Its one home |
|---|---|
| `cat-tools-*`, and the work items the tools layer took when it split off | `beans/defs` on `main` of https://github.com/litlfred/cat-harness-tools |
| `folio-core-*`, and the work items the core content layer took | `beans/defs` on `main` of https://github.com/litlfred/folio-assistant-core |
| every other work item | `litlfred/folio-assistant`, branch `cat/cat-harness/beans` |

`litlfred/cat-harness`'s own `cat/cat-harness/beans` branch keeps its notes,
queue, surveys and workflows, but **no work item files**. Write a work item change once,
to its home, and nowhere else. From a cat-harness checkout that means fetching
the folio-assistant branch, not this repository's.

The tools hold the rule too: `state:push` refuses to write a work item file to the
retired branch (deleting one is allowed), `beans:claim` there names the home
instead of reporting the work item missing, and `bun run cat check:bean-one-home`
fails when any work item id is in two stores or in the retired one. Run it after
editing work items by hand. The table it reads is
https://github.com/litlfred/cat-harness-tools/blob/main/scripts/lib/bean-homes.ts.

## Which copy is canonical — `work-plan/skills/work-plan/`

**This file.** `LOCAL_PACKAGES` (built in `scripts/skill-packages.ts`) is the
table `skill_fetch` serves from, so an agent asking for this skill by name
receives this file. When this skill or the installer changes,
**`work-plan/skills/work-plan/` is what a downstream repo syncs from**, and the
generated mirror under the docs site follows it automatically. On landing a
coordination change that affects a downstream repo, update that repo's
ownership note and close the tracking work items.

## Issues are a third todo source — queryable `issue:` link

`beans/` (agent work plan) and `todos/` (human items and feedback) are the two
stores declared in the repository. **GitHub issues are a third source**,
carrying external tracking, stakeholder adjudication, cross-repo visibility,
and human decisions.

A work item can link directly to its corresponding GitHub issue via the front-matter
`issue:` field:

```yaml
---
title: 'ISSUES ARE A THIRD TODO SOURCE: queryable bean-issue link'
status: in-progress
type: feature
issue: 730
---
```

The `issue:` field is typed as `z.union([z.number().int().positive(), z.string().min(1)]).optional()`,
supporting numeric issue numbers (`issue: 730`), issue shorthand (`issue: "#730"`),
or fully-qualified issue URLs (`issue: "https://github.com/<owner>/<repo>/issues/730"`).

### When an issue is owed

Work items representing substantive roadmap scope or human adjudication **owe an
issue**:

1. **Features (`type: feature`)**: features deliver user-facing capabilities or
   major roadmap changes, so they require an external tracking issue for
   stakeholder visibility and acceptance.
2. **Stakeholder adjudication**: any work item requiring human adjudication,
   policy rulings, or cross-team consensus (flagged via `issue-required` or
   `needs-issue` tags, or explicit adjudication requirements in the body) owes
   an issue link so the discussion and ruling remain discoverable.

The check **`bun run cat check:bean-issues`** audits the work item store to verify
that work items owing an issue provide either an `issue:` front-matter link or an
issue reference in the work item body (`#<number>`, `issue #<number>`, or issue URL).
It reports compliant work items alongside findings for unlinked items under 3-state
reporting (0 = pass, 1 = finding, 2 = could not determine).

## Disambiguation (do not conflate)

- **work items** = the agent's *session work-plan* (`beans/`, this skill).
- **todos** = the human *work-plan items* (`todos/`).
- **issues** = the *third todo source* (`issue:` front-matter field), carrying
  human/stakeholder adjudication and external tracking.
- **sidecars** (`*.qa.json`, `*.witness.json`) = *content state tracking*.
  Work items ≠ sidecars. Do **not** convert QA / witness queue items into individual
  work items (see todo-manager.md disambiguation block).
- **A sibling session** sharing this store (this skill) ≠ **an agent in another
  environment** you hand ONE task to, which you cannot see and which a person
  may relay to: `agent-handoff`. That covers who writes
  which work item, where the receiver reports, the one line the person pastes, and
  why the receiver's own measurement is evidence rather than the close.
