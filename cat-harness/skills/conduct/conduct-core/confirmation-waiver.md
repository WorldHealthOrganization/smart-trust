---
name: confirmation-waiver
description: >
  A human may waive a confirmation they are owed — for a session, for a process
  run, or until a stated time. Covers what a waiver is made of, where it is
  recorded (the context graph, never the work plan), the gates that can be
  waived and the rules that cannot, why every waiver carries an expiry, and the
  one thing an agent may never do: grant itself one.
allowed-tools: Read Grep Glob Bash
graph-typologies:
  - waiver
---

# A confirmation can be waived — by the person who is owed it

Several rules here stop an agent and hand a decision back: merging to `main`,
removing a durable artefact, spawning a swarm, closing a work item whose evidence
the session could not re-derive, re-entering a process it fell out of.

**The person who is owed a confirmation may give it in advance, for a stated
scope.** That is the same decision, made earlier, by the same person — never
an agent making an exception for itself.

## A waiver is five fields, and none is optional

| field | what it carries | why it cannot be omitted |
|---|---|---|
| `granted_by` | the person, by the identity the repository already knows them by | a waiver with no grantor is an agent's own decision wearing a hat |
| `quote` | **the grantor's own words, verbatim** | the agent's paraphrase is the thing under suspicion; a summary can widen a scope without anyone noticing |
| `gate` | which gate class is waived (below) — never "everything" | a blanket waiver is indistinguishable from no rule, and nobody can audit what it covered |
| `scope` | `session:<id>`, `process:<instance-id>`, or `until:<ISO-8601>` | an unscoped waiver outlives the situation that justified it |
| `expires` | a timestamp, always | same argument `bean-blocking.md` (opt-in `cat-harness.work-plan`) makes for a block: **a waiver with no expiry cannot be told from one nobody remembered to withdraw** |

A waiver missing any field is **not a waiver**, and the gate stands. An agent
that finds a malformed one asks, exactly as if none existed.

## The gates that can be waived, and the rules that cannot

> **A waiver relaxes a rule whose text is *ask first*. It can never relax a
> rule whose text is *never*.**

**Never delete a work item** is such a prohibition: no waiver reaches it, and the
non-destructive move (`scrapped`, with reasons) is always available.

| gate class | the rule it relaxes | waivable |
|---|---|---|
| `merge-to-main` | `merge-to-main` (opt-in `cat-harness.sdlc`) — the owner's authorisation for each merge (and `crdm-requirements-workflow` §Phase 6) | yes, **for green heads only**: a head in a repository with no CI is never covered |
| `bean-close` | `bean-coordination` §"When you cannot re-derive it yourself" — the `ready-to-close` batch | yes |
| `deletion` | [`deletion-requires-confirmation`](deletion-requires-confirmation.md) — report and wait | yes, **per artefact class**, never blanket |
| `swarm-spawn` | `swarm-management` — asked every time, per swarm | yes, with the agent count and model level named in the quote |
| `process-reentry` | [`process-state`](../../process/workflow/process-state.md) — confirm before re-entering | yes |
| `issue-close` | `issue-working` — an agent never closes an issue on its own say-so | yes; the waiver names the issues |
| *agent permission grants* | [`agent-permissions`](agent-permissions.md) — a person grants what a coding agent may do | **no — never self-granted, and granted per permission** |
| *hand-edited agent config* | [`harness-projections`](harness-projections.md) — consent per change to `.claude/settings.json` and the like | **no — consent is per change** |
| *work item deletion* | `todo-manager`, never delete a work item | **no — a prohibition, not a gate** |
| *fabricating evidence* | anywhere a rule says re-derive rather than quote | **no** |

A *never* that somebody wants waived is a change to the skill that owns it —
not a waiver.

## Where a waiver lives — the context graph, never the work plan

A waiver is **context**: read at the start of a turn, consulted by whatever gate
is about to fire, and never produced by the work it governs. That is the
`context` layer as [`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md)
defines it, so a waiver is a node under `memory/waivers/` — the same graph an
agent's durable memory lives in.

**Not `beans/`.** The work plan is `state`: it records what is being worked on
and where it got to. A waiver is not work, has no Done-when, and must be
readable by a gate that fires before any work item is opened. The work plan is also
branch-local, so a session-scoped waiver filed there could be invisible to the
session it was granted for.

**Not the interaction node (`memory/interaction.json`) either**: that is read
at session start and *never written by a process*, and a waiver is granted
mid-session.

## Consulting one — the three-state read, as everywhere else

Before a gate fires, look for a waiver in scope. There are **three** answers:

1. **A valid waiver covers this gate, in scope, unexpired** → proceed, and say
   in the turn report *which* waiver you are acting under, quoting its words.
   A waived action is still an announced one.
2. **No waiver** → ask, exactly as the gate's own skill says.
3. **Could not determine** — `memory/waivers/` unreadable, a malformed node, a
   clock you cannot trust → **ask**. A gate that cannot read its waivers has
   not been waived.

An expired waiver is **kept, never deleted**, as a `scrapped` work item is: the
record of what was permitted, to whom and when, makes the next grant
reviewable.

## What an agent may never do

- **Grant itself a waiver.** A waiver whose `quote` is not the grantor's own
  words does not exist. If you are composing the sentence, you are the grantor,
  and you may not be.
- **Widen one.** `session:` does not reach the next session; `process:` does not
  reach a sibling layer; `deletion` for build artefacts does not reach
  content. When the scope does not plainly cover the case in front of you, it
  does not cover it.
- **Infer one from tone.** "go ahead", "yes", "do it" discharge the gate they
  were said to — that is an ordinary confirmation, and it needs no waiver node.
  A *waiver* is a standing grant over future gates, and it is recorded only
  when the owner says something that plainly is one.
- **Treat a waiver as a reason to skip the work.** `merge-to-main` waived still
  means green CI and no conflict; `bean-close` waived still means the evidence
  is quoted in the work item. A waiver removes the *asking*, never the *doing*.

## Checked, not trusted

`bun run cat check:waivers` reads every node under `memory/waivers/` and fails on a
missing field, a `gate` outside the table above, a scope that names a
non-existent session or layer, and a waiver over a non-waivable rule. It
reports expired waivers as **inert**, never as findings — they are history.

The check reads the same table this skill publishes, so a gate class without
a row is refused and the vocabulary cannot drift into "everything".
