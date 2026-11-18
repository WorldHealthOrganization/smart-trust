---
name: bean-drain
description: >
  Drain open work items (stories, bugs, features) with several agents at once, as
  part of the SDLC: build the queue, group it by owner, check and claim each
  work item on every work item copy before any work, open the PR at the first commit,
  ask the owner through ask-the-person, close, and refill. Use when a thread
  or agent is asked to drain work items, when a coordinator spawns drain threads,
  or when an idle agent pulls from a shared queue next to other agents.
input: schemas/skills/bean-drain/input.schema.json
output: schemas/skills/bean-drain/output.schema.json
---

# Bean drain

A drain is the delivery loop run over a queue instead of over one item. Each
work item in it still goes through the ordinary lifecycle
([`bean-coordination`](bean-coordination.md), [`todo-manager`](todo-manager.md),
[`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md)). What this skill adds is what goes
wrong only when **several agents drain the same store at once**: two of them
starting the same work item.

The drain is drawn as a process: `Process_BeanDrain`
(`sdlc/processes/bean-drain.bpmn`).
It builds the queue (the `drain-queue` Tool), then for each work item
calls OPEN (`Process_BeanOpen`, whose check is the `bean-claim-check` Tool),
works it, calls CLOSE (`Process_BeanClose`), and refills. The steps below are
the same loop in prose.

## Roles

| role | does | holds |
|---|---|---|
| **queue keeper** | builds the queue, assigns work items to drainers, refills a drainer that runs dry | the queue file |
| **drainer** | takes the next work item from its own list, checks, claims, works, closes | the work items it claimed |

One agent can be both. Drainers are cloud threads and agents on the owner's own
machine, side by side. Each one is told apart by its **commit author** on the
work item branch, never by its own say-so:

| agent | commit author on the work item branch |
|---|---|
| cloud threads | `Claude <noreply@anthropic.com>`, or `litlfred <litlfred@users.noreply.github.com>` |
| agy, the owner's local Antigravity agent | `Carl Leitner <litlfred@fenugreek.home>` |
| the state bot | `folio-state-bot` |

A new kind of agent joins this table when it starts committing. An author not
in the table is treated as "another agent".

## Spawning drainers

A queue keeper that starts drain threads seeds each one as
`coordinate` §"A spawned helper is reachable, and
the owner's authority is not relayed" says: the owner's words verbatim, no
relayed rulings (a merge window included), and a finishable list. Give each
drainer this skill and its list, not a copy of the rules.

Three further rules: work leaves up (a parent closes when its last child
does), one PR per work item or tight cluster, and scrap obsolete work items with
reasons.

## 1. Build the queue — the `drain-queue` Tool

Read **every** work item store, not the one this checkout mounts. Each work item has one
home ([`bean-coordination`](bean-coordination.md) §"Each bean has one home"):
the `cat/cat-harness/beans` branch on folio-assistant, plus the tools and core
layers' work items on their `main`. The cat-harness copy of that branch keeps no
work items. If two stores ever hold the same id again,
`bun run cat check:bean-one-home` names it; the newest `updated_at` wins here
and the disagreement is listed, so somebody can fix it.

Leave out, each with its reason in the output so nothing vanishes silently:

- **goals and epics** (`milestone`, `epic`): they close when their children do;
- **blocked**: a work item in `blocked_by` that is still open ([`bean-blocking`](bean-blocking.md));
- **closed or not ready**: `completed`, `scrapped`, `draft`;
- **owner-held or parked**: the last note says it waits on the owner, a date or a ruling;
- **not drainable here**: it needs something the drainers lack (a network host,
  a person's account). Route it to an agent that has it instead, and say which.

Group the rest **by owner** (the thread or agent that already holds work in the
same area), in priority order, and write the result to one shared file. Mark the
work items other agents hold as **skip**. Refill a drainer from the deepest queue when
it finishes, and refresh the file each time.

The queue is advisory. It says who should take a work item; only a claim says who
did. So a drainer still runs step 2 on every work item it takes from the queue.

## 2. Before each bean: check, then claim — the `bean-claim-check` Tool

Run this before **any** work on the work item, including reading code for it. The
trigger is starting work, not claiming ([`bean-coordination`](bean-coordination.md)
§"The trigger is STARTING WORK").

1. **Refresh every store copy** from its remote authority in its own step
   (never cached from session start; [`bean-coordination`](bean-coordination.md)
   §"Re-derive from the REMOTE", and [`work-plan-store-git-branch`](work-plan-store-git-branch.md)
   for the git state-branch fetch).
2. **Read the recent history on the work item**, per copy (`history(id)` in
   [`work-plan-store`](work-plan-store.md)).
   **Skip** the work item if another agent wrote to it in the past 24 hours, or
   its last note says it is claimed.
3. **Look for open work naming the work item**: an open PR whose title, body or
   branch names the id, in every repository the drain touches — the
   `open-work-lookup` Tool. **Skip** if one exists and is not yours. This catches
   a duplicate that exists only on an open PR's head, which step 2 cannot see.
4. **Claim**: set `status: in-progress` (`update`) and append a dated note
   (`note`) naming you and your session across every store copy, persisted before
   any other commit of yours so the next agent's step 2 sees it.
5. **A write conflict** means somebody wrote first: refresh, re-read the
   work item (`get(id)` / `history(id)`), and go back to step 2. **Never
   force-push** a state branch ([`work-plan-store-git-branch`](work-plan-store-git-branch.md)).

`status: in-progress` alone is not a claim you can trust. It goes stale
(§"A quiet claim" in `bean-coordination`), so steps 2 and 3 read activity, not
status.

**Why every copy must be updated.** `bun run cat state:push` and
`bun run cat beans:claim` write the one store copy the checkout points at. With more
than one copy, the others go on saying `todo`. So while there is more than one
copy, the `bean-claim-check` Tool writes the claim to each copy directly
([`work-plan-store-git-branch`](work-plan-store-git-branch.md)), rather than
through a single-checkout `state:push`. Where a work item has one copy,
`beans:claim` is the claim.

## 3. Work it

- Open the PR **at the first commit**, with `Closes-bean: <id>` in the body
  (`continual-progress`, `pr-description`).
  An open PR is the claim every other agent can see without the work item branch.
- Add the PR's link to the work item with a dated note, on every copy.
- Work only the work item you claimed. A cause you find inside it that is a separate
  piece of work becomes a new work item, and is checked and claimed in its own right.

## 4. When the bean waits on the owner

Ask through [`ask-the-person`](../../../skills/conduct/conduct-core/ask-the-person.md):
the full question and every option in the chat first, then the card. Record the
question's link in the work item. Keep the claim while the question is open, and take
the next work item meanwhile. A work item that will wait long goes back to `todo` with the
question recorded, so that it does not hold the queue.

When the question is about changed pages, it carries the staging preview: one
deep link per changed page, with the same page on main, in the output
contract's `stagingLinks` field
([`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md)).

## 5. Close it, and refill

Close on evidence ([`bean-coordination`](bean-coordination.md) §"Closing a bean
whose work has already landed"), on every copy. Then tell the queue keeper, or
take the next work item on your list. A drainer whose list is empty asks for a refill
instead of picking from another owner's list.

## Tools

| Tool | answers | contract |
|---|---|---|
| [`drain-queue`](../../tools/drain-queue/drain-queue.json) | which open work items, grouped by owner, with what was left out and why | `definitions.queue` in the output schema |
| [`bean-claim-check`](../../tools/bean-claim-check/bean-claim-check.json) | may I take this work item; if so, claim it on every copy | `definitions.claimCheck` |
| [`open-work-lookup`](../../tools/open-work-lookup/open-work-lookup.json) | does a path, a path prefix or a work item id appear on `main` or any open PR head, and where | `definitions.lookup` |

Run from an index checkout, with one `--copy` per work item copy checkout:

```sh
bun run cat beans:drain-queue --copy folio-assistant --copy cat-harness --holdings holdings.json
bun run cat beans:claim-check <id> --copy folio-assistant --copy cat-harness \
  --repo litlfred/cat-harness --repo <tools-layer-repo> --session <your session link>
bun run cat lookup:open-work --bean <id> --repo litlfred/cat-harness   # or --path / --prefix
```

Pass one `--repo` per repository the work item's work can land in — for example the
harness and its tools layer.

`--dry-run` on the claim check says what it would do and writes nothing.
`--json` on any of them emits the contract below. The claim check exits 0
when claimed, 1 on a skip and 2 when it could not tell; 2 is never "free".

The Tools satisfy `bean-coordination` rather than this skill: this skill's
contract is the whole drain, and each Tool takes one step of it.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/bean-drain/input.schema.json)
and [`output.schema.json`](../../../schemas/skills/bean-drain/output.schema.json).

- **In:** the work item `copies` to read, the `agents` and how each is recognised,
  the owners' current `holdings`, the `windowHours` (24) and the `queueFile`.
- **Out:** the `queue` (by owner, excluded with reasons, copies that disagree),
  one `claimCheck` per work item taken, and what each drainer closed or asked.
