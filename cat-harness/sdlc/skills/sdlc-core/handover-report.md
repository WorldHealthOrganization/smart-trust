---
name: handover-report
description: >
  Write a handover report: a templated snapshot of an agent's current state,
  committed as a work item note, so that a session or subagent that stalls, runs
  out of context, or loses its container can be picked up by another agent
  without re-deriving anything. Use it when you are told a stall is likely, at
  the end of every long arc, before a risky or long-running step, and whenever
  a steward asks for one. Its reader is `stalled-agent-triage`.
---

# Handover report

An agent's state lives in three places that do not survive it: the chat, its
scratchpad, and uncommitted work in its worktree. A **handover report** moves
the parts that matter into the repository, as a committed work item note, so the
next agent starts from fact rather than from guesswork.

To produce one under time pressure, follow [`prepare-for-handover`](prepare-for-handover.md): it commits and pushes first, then writes this report citing the pushed SHAs.

This skill is not [`agent-handoff`](agent-handoff.md), which hands
**one task** to a named agent in another environment. A handover report is a
**snapshot of everything one agent is holding**, written for whoever turns up
next, which may be no one in particular.

## When to write one

- **When told a stall is likely.** Write it first, before continuing any work.
  A report written after the stall is never written.
- **Before a long or risky step**: a 30-minute regenerate, a big merge, a
  disk-heavy run.
- **At the end of an arc**, even a successful one, if anything stays open.
- **When a steward or the owner asks.**

Write it **short and early**, then update it. A 20-line report pushed now is
worth more than a complete one that never lands.

## Where it goes

A work item note on the work item you are working, or on its epic if you hold several:

```sh
bun run cat beans:note <bean-id> --title "handover: <role> <date>" \
  --body-file <file> --branch <your-branch>
bun run cat beans:notes          # rewrites the index; commit both files
git add -A && git commit && git push
```

One file per branch per work item, so two agents writing handovers never conflict
(`bean-coordination` (opt-in `cat-harness.work-plan`) §"Adding to a bean — a note, not
an append"). **Write it in your own worktree.** Some tools write into the main
checkout instead; if you are a subagent, check `git status` there afterwards.

Push it, even onto a draft PR or a red branch. An unpushed report does not
exist.

## The template

Mix narrative with formal content. The tables are what a triage agent parses;
the prose is what a person reads.

```markdown
## Handover report: <role> (<session or agent>)

- **Session:** <session URL, or the parent session plus agent id>
- **Written:** <UTC time>, <why: stall expected / end of arc / asked>
- **Role and mandate:** <one line; the owner rulings that bound you>

### Where I'm going (current arc)
<2–4 sentences: the goal, the epic it serves, and what "done" looks like.>

### Done so far
- <outcome, with PR, commit or bean>

### Next in queue
1. <next concrete step: command, file, PR>
2. …

### In flight
| item | kind (PR / branch / bean / process run) | state | next action | owner |
|---|---|---|---|---|

### Blockers and dependencies
| blocker | waits on | since | expires / re-check |
|---|---|---|---|

### Decisions pending (owner)
- <question, with options and your recommendation, so it can be asked cold>

### Unpushed or at-risk state
- <scratchpad files, local commits, running jobs, and whether each is reproducible>

### Dispatch lines (copy-paste, one per unstarted item)
Do bean folio-assistant-<id> on branch <branch-to-create> of repo <owner>/<repo>.
Do bean folio-assistant-<id> on branch <branch-to-create> of repo <owner>/<repo>.

### How to resume
<the first three things the next agent should do, in order>
```

## Rules

1. **Facts with provenance.** Write "CI red on `abc123` (check X)", not "CI is
   flaky". Give SHAs, PR numbers and work item ids, never "the branch".
2. **Say what is NOT pushed.** Unpushed commits, scratchpad plans and running
   background jobs are exactly what a stall destroys. Name each one, and say
   whether it can be rebuilt.
3. **Owner rulings verbatim**, with the date. A ruling paraphrased in a
   handover becomes a different ruling by the second handover.
4. **Never put secrets in it.** Name secrets, never give their values.
5. **Blocks follow `bean-blocking`:** what it waits on,
   since when, and when to re-check, so a stale block can be told from a live
   one.
6. **Update in place.** Re-run `beans:note` on the same branch and work item, which
   gives the same file. Do not append a second report.
7. **Every unstarted item gets a DISPATCH LINE, in one fixed sentence.**

   ```
   Do bean folio-assistant-<id> on branch <branch-to-create> of repo <owner>/<repo>.
   ```

   It is a format, not a suggestion: write it verbatim with the three slots
   filled.

   **Why one sentence, and why these three slots.** A dispatch is read by
   somebody with no context — the owner pasting it into a new session, or a
   steward handing out work. The three slots are the minimum that makes it
   actionable alone: the WORK ITEM says what and carries its own Done-when, the
   BRANCH stops two agents landing on one ref, and the REPO is required because
   an agent's session may be scoped to a different one. Drop any slot and the
   recipient has to come back and ask.

   Three rules:

   - **Name a branch that does not exist yet**, and say so. A line naming a
     finished branch sends an agent to a dead ref.
   - **One work item per line.** Not a theme, not "the three remaining X". The work item
     is what carries the Done-when, and a line that names a theme hands over a
     judgement instead of a task.
   - **Order them, and say what is ordered.** If a line must follow another,
     write that above the block — not inside the sentence, which stays fixed.
     A hidden prerequisite makes a list of dispatchable work items worse than a
     list of the one that is ready.

   `dispatch-agent` governs what happens AFTER the line is sent — the progress
   contract and the heartbeat. This rule is only about writing the line so the
   work can be handed on at all.
