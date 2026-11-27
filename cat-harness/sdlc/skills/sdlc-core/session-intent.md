---
name: session-intent
description: Session-start intent declaration + session-end results recording, against the work plan's goals (milestone work items) and their open work items. Enforces the durable-handoff discipline so any agent can pick up another's thread.
user_invocable: true
---

# /session-intent — durable session intent + results

Without a durable record of which tasks are in flight, what each has already
learned, and why a previous result was retracted, each new session
re-discovers the same near-result and re-commits it, only to retract it again
later (a flip-flop).

This skill enforces the **read → declare → work → record** loop so
the next session — possibly a different agent — picks up exactly
where the previous one left off.

## Where state lives

Each job lives in the object that already owns it:

| job | here |
|---|---|
| goals, and what serves each | a `milestone` work item per goal, with the epics parented to it — `todo-manager` (opt-in `cat-harness.work-plan`) §"A GOAL is a `milestone` bean"; `beans roadmap` renders it |
| canonical status of an item | the work item itself. There is no second copy to disagree with it |
| flip-flop history | a `scrapped` work item keeps the rejected approach *with its reasons*, and a `trap` node under the declared `memory` graph keeps the failure signature — [`agent-memory`](../../../skills/conduct/conduct-core/agent-memory.md) |
| session log | the work item's body notes, plus the PR. Both are durable and both are read by the next session; a third place would be a third answer |

| Artifact | Purpose |
|---|---|
| `beans/` (via the `beans` CLI) | the **queue** and the **plan**: goals as milestones, epics, tasks |
| `memory/` | established facts and TRAPs — what not to re-derive, and what not to repeat |
| Per-PR body | session intent at branch-open; EOS results appended |
| a root dashboard file | **optional, and this layer has none.** See below |

### The dashboard is optional, and absent is not undetermined

A layer MAY keep a `STATUS.md`-style dashboard. This one does not, and
that is a **determined absence** rather than a gap: the milestones and
`beans roadmap` answer the same question from the store, so a dashboard here
would be a second copy free to drift from it.

Three states, and the third is the one that gets collapsed:

1. **A dashboard exists** → read it first, as step 1 below.
2. **No dashboard, and the work plan reads** → skip to the roadmap. Nothing is
   missing.
3. **The work plan could not be read** — no CLI, no store, an unreadable
   declaration → **that is not an empty plan.** Say so and fix it before
   declaring intent; `todo-manager` §"When the `beans` CLI
   is not there" has the fallback, which writes as well as reads.

## Session-start protocol (5 steps)

> Run these in order. Steps 1–3 are read-only; step 4 writes.

### 1. Read the goals

`beans roadmap`, or `beans list` filtered to `--type milestone`. Identify which
goal the user's request serves. A request that serves none is not thereby
illegitimate — it is a finding worth one line in the turn report, and possibly
a new milestone.

Then find your siblings: the open PRs, and the `Claude-Session:` trailer on
recent commits. **The session API cannot see sibling sessions**, so a branch
and its PR are the only durable evidence that another session is working.

### 2. Read the goal's epics and their open children

Walk down from the milestone: `beans list` and read the epics parented to it,
then their open children.

- **Status** — the work item's own `status` is canonical.
- **What was rejected** — read the `scrapped` work items in the archive before
  proposing an approach. That is what stops you re-entering a dead end, and it
  is why a work item is never deleted.
- **Traps** — the `memory` graph's `trap` nodes carry failure signatures.
  **Do not repeat any pattern recorded there.**
- **What is in flight** — an `in-progress` work item, with the caveat that a claim
  is branch-local and announces rather than reserves
  (`bean-coordination`).

### 3. Read the queue

Run `beans list` to find:

- **`todo` or `draft`** work items not yet picked up.
- **`blocked`** work items waiting on dependencies.
- Who is working an item: check the work item body and its holder note. Multiple
  agents MAY pick the same item; coordinate with the user if you see this
  happen.

### 4. Declare intent (write)

Three places, all required:

**a. The work item** — claim the work item you are working, naming your branch:

```sh
bun run cat beans:claim <id>
```

A claim goes through `beans:claim`, not `beans update`: it reads the default
branch first, refuses a work item somebody else holds, and records a holder note the
next session's check can read. `beans update` writes no such note.

Then append a note to its body saying what you intend and where you got to.
The work item is the durable record a sibling reads; there is no separate session
log to keep in step with it.

**b. `beans` CLI** — new tasks, parented by SUBJECT. **No session work item.**

> **Check before you create (STRICT).** `beans create` is not idempotent — it
> mints a fresh ID every call and dedupes on nothing, so re-entering this step
> duplicates the whole plan rather than no-op'ing. Run the existence check in
> `todo-manager.md` §Check before you create before **every**
> `beans create` below.

- **Do not create a `Session: …` milestone or epic.** A session is a LOG, and
  its log is the PR body (part c) plus a work item note on each work item worked
  (`bun run cat beans:note <id>`, keyed by branch).
  `todo-manager` §"A session is a log, not a
  parent" has the reasoning.
- For each NEW task you pick up, create it under the epic whose subject it is:
  `beans create "<Task>" --type task --parent <subject-epic-id>`, then claim
  it.

**c. PR body** — at branch-open, the PR body must include:

```markdown
## Intent (session start)
- <one line per task ID from queue you're working>
- <user's stated goal in their words>

## Session results
<filled at EOS>
```

### 5. Hand off to /coordinate

After step 4, run `/coordinate` to post intent on relevant sibling PRs
+ triage their review comments. Then start work.

Before the first edit of any new unit of work, run the collision review in
`coordinate` §"Starting new work", scaled to the blast radius and recorded in
your workplan work item. A pickup (§"Hand-off pickup protocol") runs its own.

## Session-end protocol (3 steps)

> Run these BEFORE pushing the final commit. The push triggers PR
> auto-subscription + sibling-coord sweep, so the EOS state must be
> visible from the push commit.

### 1. Update the queue

For each task you worked, use the `beans` CLI:

- If completed: `beans update <id> --status completed`, with a summary:
  `beans update <id> --body-append "Completed with finding: ..."`.
- If partial: leave `status: in-progress`, and append
  `beans update <id> --body-append "Partial result: ..."`.
- If you discovered a NEW task: create a new work item via `beans create` (after the
  existence check).
- If you retract a previous claim: see step 2.

### 2. Record the results where they will be read

Append them to the **work item**, which is where step 4a put the intent — what was
confirmed, what remains, and the PR. One object, opened and closed, rather
than an intent in one place and a result in another.

If the session **retracted** a prior claim, that is not a body note. Two
objects carry it, and they answer different questions:

- the approach that was rejected becomes a `scrapped` work item **with its
  reasons**, so the next agent does not re-enter it;
- the failure *signature* — what made the wrong answer look right — becomes a
  `trap` node in the `memory` graph ([`agent-memory`](../../../skills/conduct/conduct-core/agent-memory.md)).

### 3. Update the PR body

Replace the placeholder `## Session results` section with:

```markdown
## Session results
- Picked up: <task IDs>
- Completed: <list>
- Partial: <list with where to pick up>
- New tasks added: <list>
- Retractions: <list of any prior-claim retractions>
- Open question for user: <if any>
```

## Multi-agent same-goal coordination

**Multiple agents MAY attack the same goal simultaneously.** The model is:

- **Goal** = product (user's directive).
- **Queue** = per-goal item list, all agents read + write.
- **Tasks are not exclusively claimed.** Two agents may pick the
  same task; this is allowed.
- **Coordination is with the USER on goal-level decisions**, not
  agent-to-agent on task-level locks.

When you discover a task you're working has been picked up by another agent
(another holder note on the work item, or a sibling PR commit touching the same
scope):

1. **Do not silently abandon** — your independent attack is
   valuable (different methods may surface different findings).
2. **Post intent** on the sibling PR via `/coordinate` so the
   sibling agent sees you're also working it.
3. **Ask the user** if they want both threads or want one to stand down,
   with context, options and a recommendation first
   ([`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)).
   Sample:

   > 🟡 Two agents attacking task-foo-stability — sibling PR
   > #XXXX is at 50% with method A; I'd attack
   > with method B. Keep both threads?

4. **If the user says one stands down**, the standing-down agent appends its
   partial results to the work item and releases its claim.

## Hand-off pickup protocol

If you're the picking-up agent (someone else's `in-progress` task
or partial result):

1. Read the work item's notes (`beans show <id>`) — that's the handoff letter and
   the technical state.
2. Read the partial PR (if open) — that's the code state.
3. Declare your intent normally (claim the work item and add a note to it — `bun run cat beans:note <id>` — saying you picked it up and where you will start; no session work item).
4. Re-run the collision review in `coordinate` §"Starting new work" before
   your first edit, and add the result to the work item.

## Anti-patterns

- ❌ Starting work without reading the goal's work items, `scrapped` work items and
  traps first ("just-the-prompt" agents re-commit flipped claims).
- ❌ Claiming a task but not writing the EOS results ("silent abandon").
- ❌ Retracting a previous claim quietly, without a `scrapped` work item or a trap
  ("erasure" — guaranteed to re-flip next session).
- ❌ Asking the user "should I pick this task?" — the queue is the
  authoritative list; just pick and declare.

## See also

- `todo-manager` (the work-plan rules)
- [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) (the ALWAYS-PR rule)
- [`coordinate`](coordinate.md) (sibling-PR coordination)
- [`watch`](watch.md) (main-watching)
- [`pending-show`](pending-show.md) (showing current pending)
