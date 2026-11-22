---
name: harness-projections
description: >
  Who may write under `.claude/`, and when. The generated projections of the
  knowledge graph (`.claude/commands/*.md` from `skill:commands`, the assembled
  agent memory under `.claude/agents/` and `.claude/agent-memory/`) are written
  by CI, which commits them to the PR branch, and never by an agent. A
  hand-edited `.claude/` file (`settings.json`, its hooks, a hand-written
  command or agent definition) changes only with the owner's explicit consent
  to that change: the agent shows the exact diff and the reason, asks first,
  and records the consent. Read before staging any path under `.claude/`.
---

# Harness projections: CI writes them, the owner consents to every hand edit

`.claude/` is what the Claude Code harness reads before any skill is loaded:
the slash commands a person can type, the memory injected into a subagent, and
the hooks and permissions every session runs under. An edit there changes how
every later session behaves, including sessions that never see the commit.

**`.claude/` is one instance of a general rule.** Every coding-agent Tool has
config files, and some of them are projections of the graph: CI writes the
projections, and a person consents to each hand edit. `.claude/` is named here
because it is the agent-host directory the generators write. Which files a Tool reads, and which of them are
generated, belongs to that Tool's adapter. Securing what the agent may do at
all is [`agent-permissions`](agent-permissions.md).

## Two kinds of file, two writers

| kind | examples | source of truth | who writes the `.claude/` file |
|---|---|---|---|
| **projection** (generated) | `.claude/commands/<name>.md` carrying a `generated:` key (`skill:commands`); the marked region of `.claude/agent-memory/<agent>/MEMORY.md` (`agent-memory`); `.claude/agents/*` where the memory assembler writes them; `.claude/skills/` synced from packages | the skill's front matter, the memory nodes under `memory/`, the package | **CI only.** A workflow step runs the generator and commits the result to the PR branch. |
| **hand-edited** | `.claude/settings.json` and its hooks, a hand-written command (no `generated:` key), an agent definition's hand-written body, a memory file's `## Session log` | the file itself | **an agent, only with the owner's consent to that exact change** |

**The rule for a projection: edit the source, not the projection.** To change a
slash command, change the skill's `user_invocable` or description. To change
what a subagent remembers, add or edit a node under `memory/`
([`agent-memory`](agent-memory.md)). Push the source change and let CI write
the projection. You may run a generator locally in its `--check` form, or into
a scratch tree, to see what it would write. Do not stage or commit anything it
writes under `.claude/`.

This applies inside [`skill-registration`](../../kg/kg-core/skill-registration.md)
too. `skill:register` runs `skill:commands`, which writes `.claude/commands/` in
a composed checkout. Commit what it writes everywhere else, and leave
`.claude/` to CI.

**Why CI and not the agent.** A projection is correct only if it was generated
from the tree that lands. An agent's local run reflects the tree it had, and a
hand-merged projection drifts from its source; the CI
step runs on the PR head, so the projection on the branch is the one the merge
will carry, from one writer.

## Hand-edited files: consent per change

Before you write a hand-edited `.claude/` file:

1. **Show the exact diff.** Paste the unified diff itself, not a description of
   it.
2. **Give the reason**: what breaks or is missing without the change, and what
   the change does to every later session (a hook that runs on every tool call;
   a permission that stops a prompt).
3. **Ask, and wait.** The order is context, diff, recommendation, question
   ([`interaction-modality`](interaction-modality.md) §4.1). "Go ahead"
   discharges this question, for this diff only.
4. **Record the consent** in the commit that makes the change, and as a comment
   on the PR:

   ```
   claude-config-consent:
     by: <owner's login>
     on: <ISO-8601 date-time>
     file: .claude/settings.json
     diff: <sha256 of the diff shown>
     evidence: "<the owner's words, verbatim>" (<session link or comment permalink>)
   ```

**A standing waiver does not reach this.** Consent is per change, so there is
no gate class for it in
[`confirmation-waiver`](confirmation-waiver.md)'s table, and a waiver that
claims one is not a waiver. A broad instruction such as "fix the hooks" or "make
the session start work" authorises the investigation. It does not authorise the
edit. Bring the diff back.

**When a hook or setting gets in your way, report it; do not edit it.** This is
the same rule as `prepare-merge` §Guardrails ("fix the tool" rather than delete
the branch), with one extra step: here, fixing the tool is itself a change that
needs consent.

## Where it sits in the process

`merge-to-main.bpmn` runs `Task_RegenProjections` in its build-pipeline lane
before it reads any evidence. CI regenerates the projections on the head and
commits them to the PR branch, and the evidence is then read on that new head.
A PR whose projections are stale therefore cannot reach the merge gate looking
green (`merge-to-main` (opt-in `cat-harness.sdlc`)).

## What this does not do yet

- **The CI step is declared here, not built.** In the platform repository,
  `merge-main.yml` runs `regen` (which includes `skill:commands` and
  `agent-memory`) and pushes to the PR branch, but only for PRs labelled
  `merge-main` when `main` moves. `code-quality-gates.yml` runs
  `skill:commands:check` and `agent-memory:check` and fails, but commits
  nothing. A step that regenerates the projections on every PR head and commits
  them is a workflow change in the repositories that carry `.github/`. That
  change is not made here.
- **No check refuses an agent-authored commit under `.claude/`.** Telling a
  CI-written commit from an agent's needs a committer convention (the bot
  identity the workflow pushes as), and a gate that reads it.
- **`skill:register` still writes `.claude/commands/`.** Restricting it to
  `--check` for that one step would be a change to `skill-register.ts`.
