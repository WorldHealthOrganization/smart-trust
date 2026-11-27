---
name: process-state
description: >
  Track where you are inside a running process — which task, in which
  swimlane, under which role — and recover deliberately when you find
  yourself outside it. Read before completing a workflow step, and whenever
  something unexpected interrupts one. Covers what to do about notes and
  stickies you re-anchored while off-process, which leave no trace in the
  artefact.
satisfies:
  - "req:agent-workflow#process-is-declared"
---

# Process state — the task you are in, inside the process you are running

An agent working a BPMN process holds **nested state**: a *task*, inside a
*process instance*, under a *role* that owns a *swimlane*. Losing track of the
outer level while still acting on the inner one looks like ordinary work and
produces changes nobody authorised.

## The three levels, and what each one answers

| level | answers | where it lives |
|---|---|---|
| **process instance** | which run of which process is this? | `beans/workflows/` (`workflow-state` graph in `work-plan-store` (opt-in `cat-harness.work-plan`)) |
| **swimlane / role** | am I the actor who may do this? | the lane on the activity; checked by the executor ([`task-authorization`](../process-core/task-authorization.md)) |
| **task** | which step am I on, and is it enabled? | `workflow_next` |

`workflow_next` reports what is enabled **now**, which lane owns it, and which
skill implements it. `workflow_complete` refuses a step that is not enabled.
Those two are the ground truth; your memory of where you were is not.

**Name yourself when you complete a step.** Pass `actor` as a declared actor
id, not a free-text name: `workflow_complete` checks that actor against the
lane's role and the ODRL policies before recording anything, refuses a role
mismatch or a `deny`, and writes the verdict into the history. An `actor` you
type is recorded as **asserted**, not authenticated. Say so rather than
presenting it as identity. `workflow_gate` takes the same `actor` and `target`,
so ask it before doing the work
([`task-authorization`](../process-core/task-authorization.md)).

**The history is checked again afterwards.** `bun run cat prov:qaqc` turns every
instance's history into a W3C PROV-O log and re-runs the same check on each
step; `claude` or a login in `actor`, rather than a declared actor id, shows up
there as `undeclared-actor`. It is advisory: the findings are listed on the
`/prov-qaqc/` page, and CI fails only when that page is stale
([`task-authorization`](../process-core/task-authorization.md) §"The after-check").

## Say which process you are in — every turn

Claiming a work item says *what* you are working on. This says **where in the
process** you are working, which is the question a reader cannot answer from an
id.

**Name the process, the lane and the task**, and say when you switch:

> **Process:** `crdm-requirements`, Agent lane · **Phase 6 — implement**.
> Completed `A_Implement`; next is `A_Summary`.

The engine's "what is enabled now" call (`workflow_next`) reports the enabled
step, the lane that owns it, and the skill that implements it.

**Say which permission you are acting under.** Entering a task in a lane
means performing it as that lane's role, and that needs an ODRL rule that permits it there (`permits()` in `schemas/content/odrl.ts`: the actor,
the action, and the process, task and role as scope). If the answer is
`unknown` or `deny`, you are out of process for that task: route it to a lane
whose actor holds the permission, or stop and ask. The engine enforces this
before the task at the deterministic end of the spectrum; at the agentic end
nothing stops you, and the QA/QC report over the PROV-O record finds it
afterwards (`agentic-harness.html#bpmn-execution`).

**Switching processes is the case that matters.** Moving between processes
changes who is accountable for the next step and which gates apply, and **a
reader who does not know you switched will assume the old lane's rules still
hold.**

### Naming it is not the same as recording it (advisory)

> **A turn that is in a process has an INSTANCE under the declared
> `workflow-state` graph. Naming the process in prose is the report; the
> recorded instance in the work-plan store is the evidence.**

Without recorded instances, a reviewer sweeping a window of merged work cannot
classify a single session by lane.

`workflow_start` creates it, `workflow_next` and `workflow_complete` advance
it, and the state lives in the work-plan store precisely so a sibling session
reads the same position — [`workflow-state.md`](workflow-state.md) §"Where running instances live".

**Opening or claiming a work item for a process step means starting or resuming its
workflow instance:**

1. **Claiming or starting work in a process** (`code-change-review`,
   `merge-train`, `crdm-requirements`, etc.): start an instance with
   `workflow_start` passing `bean: "<id>"` (CLI: `bun run cat workflow:start
   --process <process> --subject <subject> --bean <id>`), or resume the running
   instance that already names that work item. `workflow_start` writes the
   `process:<Process_Id>` tag and `Workflow:` backlink onto the work item so the
   visualiser can place the work item on its current BPMN step.
2. **Advancing through tasks**: call `workflow_complete` (`bun run cat
   workflow:complete --id <instance> --task <node> --actor <actor>`) as each step
   finishes so the token moves with the work.
3. **Closing the work item**: complete the final step so the workflow instance
   reaches `status: "completed"`. If a work item is closed (`completed` or
   `scrapped`) while its workflow instance still sits `running`, run `bun run cat
   workflow:instances --sweep` to close stale instances while preserving their
   `history` and PROV-O trail (`cat-harness#988`).

**The session-start sweep reads the work-plan store and reports "no instance recorded" as a FINDING, not as
silence**, when the directory holds none. A finding is not a failure — plenty
of turns are legitimately outside any process — it is the prompt to say which.

**This rule is ADVISORY: nothing gates on it.** Record the instance when the
turn is in a process, but no check refuses a merge without one, and none
should be added without a new ruling from the owner. It is labelled advisory
because a rule called STRICT that nothing enforces teaches readers that the
word is decoration, including where it is enforced.

**The gap is computed, never quoted**, because a count written down goes stale
with nothing to say so. `bun run cat workflow:instances` prints
today's count: instances recorded, instances started since the rule, first-parent
merges in the same window, running instances whose work item is closed or missing
from the store (`staleInstances`), `in-progress` work items carrying a `process:<id>`
tag with no running instance (`untrackedProcessBeans`), and the CI workflows that
read the graph. Merges are an upper bound on the instances owed, since a steward's
train, a docs-only fix or a revert may have none. The command reports the gap and
exits 0 by default (`--strict` exits 1 on stale or untracked process work items;
`--sweep` closes running instances whose work item is `completed`, `scrapped`, or
missing); only a count it cannot make (store unmounted, shallow clone, an undatable
instance) exits 2.

### Arriving without the sweep — a mid-session clone, a project thread

A session that clones a harness repository after it started has no route to
this skill:

- the **sweep** above runs from `.claude/hooks/session-start.sh`, and a hook
  runs only when the repository is there **at session start**;
- the `workflow_*` and `skill_fetch` tools come from the folio-assistant MCP
  server (`.mcp.json`), which starts with the session, so a mid-session clone
  has neither;
- the repository's `CLAUDE.md` reaches the agent only once the clone is
  registered.

So, **when you clone a harness repository after the session started**:

1. **Register it** if the platform offers that (Claude Code on the web:
   `register_repo_root`), so its `CLAUDE.md` and skills load.
2. **Run the sweep by hand**, from the checkout root:
   `bash .claude/hooks/session-start.sh`. It lays the mounts down and prints
   `## Running processes`, the prompt this section depends on.
3. **Name the process before the first edit.** A code fix in a layer is
   `sdlc/code-change-review`; a repin is `sdlc/upstream-version-adoption`; a
   preview is `sdlc/feature-staging`. A delivery is `delivery-summary` plus the
   deep-link rule in `feedback-deep-links`.
4. **With no `workflow_*` tools, say so.** "Process X, not recorded: this
   session has no workflow engine" is the true third state. Never write it as
   recorded, and never leave it out.

**A coordinator that briefs a thread** (a project's coordinator session, a
swarm lead, anything that spawns an agent) puts the process, or "none", the
governing skill and the repository in the brief. A spawned thread starts with
nothing else that would tell it, and the coordinator's own memory holds no
process rules by design.

When the brief is written **during a live discussion with a person**, it also
names the discussion: who is talking with the person, how to reach them, the
standing card rules, and any feedback channel in play (a review sheet's id and
tab, an issue). That is `definitions.discussion` of the
[`hand-back-to-discussion`](../../conduct/conduct-core/hand-back-to-discussion.md)
input schema, and it is what lets the thread hand its cards, questions and
results back instead of leaving them in its own channel.

## How to tell you are out of process

**You are outside the process if any of these is true**, and each is cheap to
check:

1. **`workflow_complete` refused a step you believed was next.** The refusal is
   not an obstacle to route around — it is the detector working.
2. **You are about to change a corpus file and cannot name the instance that
   authorised it.** `scripts/check-corpus-gate.ts` refuses exactly this at the
   commit boundary; discovering it there is late.
3. **`workflow_next` returns a step in a lane whose role you are not playing.**
4. **You cannot say which process instance you are in** without looking it up —
   and looking it up returns nothing, or more than one candidate.
5. **The work you are doing was not in the brief you opened the turn with.** An
   unplanned detour is the most common way this happens, and the least likely
   to be noticed from inside it.

## Recovering

When one of the five fires, **stop making changes** and recover in this order:

1. **Re-read the instance.** `work_plan_prime` reports every instance's
   position next to its work item. State is committed, so a sibling session's
   progress is visible too.
2. **Reconstruct from context what you were doing** and which task it belongs
   to. You usually can: the branch name, the claimed work item, and the opening
   brief together pin it.
3. **Say what you concluded, and confirm it with the user** before resuming:

   > I completed the QA sweep but never completed `Task_ReviewFindings`, so the
   > instance is still sitting before the editor decision. I believe I am in
   > `content-lifecycle` instance `cl-2f9`, in the **editor** lane, at
   > `Gateway_EditorDecision`. Confirm before I proceed?

   **This confirmation is not optional and not a formality.** An agent that
   silently re-enters a process it inferred its way back into is asserting
   authorisation nobody gave it. The whole point of the swimlane guardrail is
   that the actor is *assigned*, not self-declared.

   The person owed the confirmation may give it in advance for a stated scope —
   see [`confirmation-waiver.md`](../../conduct/conduct-core/confirmation-waiver.md).
4. **If you cannot reconstruct it, say so and stop.** A wrong instance is worse
   than none: completing a step in the wrong run records an authorisation that
   did not happen.

## What you MOVED while you were out of process

Steps 1–3 reconstruct **where you were**. They do not reconstruct **what you
changed position of**, and for notes and stickies that is a separate problem
with a sharper edge:

> **A move is not self-documenting.** `moveNote` (`schemas/ui/note-anchor.ts`)
> returns the note with its new anchor and *nothing about the old one*. A note
> that has been moved cannot say where it was.

So a sticky re-anchored during an off-process detour leaves **no trace in the
artefact**. There is no field to read back, no diff that distinguishes "moved
deliberately" from "moved by an agent that had lost the thread", and — because
a move keeps the id — nothing that even looks unusual.

**The only possible record is what was written to a work item at the time.** Work items
carry **no anchor**: a work item is not a thing pinned to a block, it is the record
that a pinning *changed*. `workflow/bean-link.ts` has the `note` op that writes
it.

So, as part of recovery, before step 3's confirmation:

- **Name every note or sticky you re-anchored during the detour**, with its
  anchor before and after. Read them off the work item's note trail — not off the
  notes, which no longer know.
- **If the trail is silent and you moved things, say that.** A gap is a
  finding. "I moved stickies and did not record where from" is recoverable by
  a person who remembers; "everything is fine" is not.
- **Do not move anything back on your own judgement.** Re-anchoring to undo is
  another unlogged move, and it is a durable change made to cover one — see
  [`deletion-requires-confirmation.md`](../../conduct/conduct-core/deletion-requires-confirmation.md),
  which is the same rule about a different verb.

**A note carries no `movedFrom` history.** History kept in the artefact being
moved is lost when the note is deleted, or moved by a tool that does not
maintain the field. The work item is a *separate* record, which is what an audit
trail has to be.

### Reading a bean back as the trail

A work item is a usable trail when **a wrong claim is left in place**, with the
correction appended beside it rather than replacing it. Read back, the work item
shows the premise, the disproof, and the re-scoped work in order, so an agent
resuming can see that the original framing was abandoned *and why*, which is
what it needs to avoid re-deriving the same mistake.

A work item tidied to show only the correct conclusion reads as though the work had
always been aimed there. That is why
`bean-coordination.md` has unwanted work
`scrapped` **with its reasons** rather than deleted: a record that shows only
outcomes cannot distinguish a dead end somebody ruled out from one nobody tried.

## What not to do

- **Do not start a fresh instance to escape a confusing one.** Two instances
  for one piece of work is two answers to "was this authorised", free to
  disagree.
- **Do not complete a step to "unstick" the process.** `Task_ReviewFindings`,
  `Gateway_EditorDecision`, `Task_Commit`, `Task_AuthorizeRelease` and
  `Task_PublishRelease` are marked `relaxable="false"` precisely because they
  are the steps where skipping is most tempting and most costly.
- **Do not treat a refusal as a bug.** `workflow_complete` refusing a step is
  the system telling you your model of where you are is wrong.

## Relationship to the opening brief

The brief you open a turn with (`turn-reporting.md` (opt-in `cat-harness.sdlc`))
is what makes detector 5 usable: without a stated plan there is nothing for the
current work to have diverged *from*. The two skills are one loop — brief the
route, notice the divergence, confirm the recovery.
