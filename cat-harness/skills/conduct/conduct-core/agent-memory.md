---
name: agent-memory
description: >
  Durable memory for a subagent — the three entry labels and what each promises,
  why entries are authored as graph nodes rather than in the generated file, the
  injection budget that silently truncates, and archiving as the third state
  between "reaches everybody" and "deleted".
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
graph-typologies:
  - memory
  - waiver
---

# Subagent memory — what a durable entry may claim

A subagent declaring project memory gets its own directory; the first **200
lines (or 25 KB)** of that directory's `MEMORY.md` are injected into its system
prompt at start, and it reads and writes the directory as it works.

**Maintaining it is part of the work.** A session that establishes a durable
fact in an agent's area adds it in the same change; a session that re-measures
a number updates the entry with the fresh value and date, because a memory
file that only accretes becomes the thing it exists to prevent.

**This curated memory is not a memory record, and a work item is.** The
entries here are read during a process and never written by one. A *memory
record* is what a process keeps as it runs (`memory-record-core` in
cat-harness-tools `schemas/kg/memory-record.ts`, owner ruling Q17 of
2026-11-03), and a *work item* is a memory record with more structure: a
status, a type, a priority, a parent and what it blocks. Both are worked with
the same memory Tools (`memory_note`, `memory_checkpoint`, `memory_recall`);
see `todo-manager` (opt-in `cat-harness.work-plan`).

## Every entry carries exactly one of three labels

| label | what it promises |
|---|---|
| **STABLE** | a path, a command, a rule. Trustworthy as written. |
| **TRAP** | a specific way the task goes wrong, **with the evidence that established it**. |
| **BASELINE** | a measured number, stored with the command that produced it and the date, **and never quoted as a current answer**. |

A TRAP is what stops a failure the project has paid for once being paid for
twice. An entry that merely restates a rule is STABLE — a TRAP needs the
incident.

**A `baseline` with no measurement is refused by the schema.** A table of how
to measure is a STABLE fact, not a measurement. A watcher whose subject is a
live signal holds no baselines at all: every one goes stale by design.

## Entries are authored as nodes; the file is generated

**Edit the node; CI assembles.** The assembled file under `.claude/` is a
projection that CI writes and commits, never an agent
([`harness-projections`](harness-projections.md)). Run the assembler locally in
its check form to see what it would change.

One entry per file, each declaring its own `$schema`, a label, a summary, and
the agents it reaches — **one entry can reach several agents**, so a fact two
agents need is not written into two files. The assembly
check gates it, so **an entry edited and never assembled fails the build**.

**The generated file is written only between its markers**, as the README sync
is, so each file's hand-written session log stays intact. A file with no
markers is reported as *not opted in*, left alone, and never counted as up to
date.

## Vendor target mapping — one memory source, generated per target

Every declared `memory` directory is the single source of truth; the assembler
projects it into each active vendor target, and `--check` gates both drift and
per-target budgets:

| target | path | scope | budget |
|---|---|---|---|
| Claude Code per-agent | `.claude/agent-memory/<agent>/MEMORY.md` (+ `detail/<slug>.md`) | nodes referencing `<agent>` or agent-less | 200 lines |
| Antigravity per-agent skill | `.agents/skills/<agent>-memory/SKILL.md` (+ `detail/<slug>.md`) | nodes referencing `<agent>` or agent-less | 24,000 bytes |
| Antigravity workspace rule | `.agents/rules/agent-memory.md` | all agents, grouped under `## <agent>` | 24,000 bytes |
| Repo-wide `AGENTS.md` | `AGENTS.md` (`<!-- cat-harness:agent-memory:begin/end -->`) | live **agent-less** nodes (`tags.references` has no `kind: "agent"`) | 32,768 bytes (32 KiB) |
| Gemini CLI per-agent | `.gemini/agents/<agent>.md` | the Claude agent's prompt + nodes referencing `<agent>` or agent-less | 32,768 bytes |
| OpenAI Codex per-agent | `.codex/agents/<agent>.toml` (`developer_instructions`) | same | 32,768 bytes |
| Cursor per-agent | `.cursor/agents/<agent>.md` | same | 32,768 bytes |
| GitHub Copilot per-agent | `.github/agents/<agent>.agent.md` | same | 30,000 characters (vendor limit) |

**Agent-less nodes feed the repo-wide `AGENTS.md` section** when `AGENTS.md`
opts in with memory markers (`missing` and `no-markers` remain distinct third
states).

**Only Claude has per-agent memory; the other hosts get a whole definition.**
Gemini CLI, Codex, Cursor and Copilot read per-agent *definition* files whose
body is the prompt. So each `.claude/agents/<agent>.md` is projected into one
file per host: its prompt, then its memory nodes inline, because imports are
not portable. Tools map only where the host documents an equivalent. Cursor
also reads `.claude/agents/`, but `.cursor/` wins on a name clash, so Cursor
gets its own file (the Claude copy carries no memory). An agent with memory but
no definition gets no file and is reported `no-definition`. The formats and
their sources are in the header of
`cat-harness-tools/scripts/agent-memory-vendors.ts`.

**Byte-budgeted targets drop whole nodes lowest-priority first, never mid-entry.**
When a target exceeds its byte budget, the assembler drops `baseline` before
`trap` and `trap` before `stable` (oldest `createdAt` first), names every
dropped node per target, and fails `--check` until entries are split into
`detail/` or archived.

## The budget truncates silently, so it is checked two ways

**Keep the injected file under the line budget.** The harness drops the
overflow without saying so. A truncated entry still looks complete to the
agent reading it, so the check covers both an entry whose **heading** falls
past the budget and a region whose **end** does.

An entry too long to fit declares its evidence as **detail**, split at a body
marker and written beside the injected file — and **pruned** when the entry
stops declaring one, so a stale detail file cannot outlive the claim it
supported.

## Archiving is the third state, and the check order is load-bearing

Retiring an agent **archives its memory; it does not delete it.** An archived
entry is a node of the graph that reaches no agent's prompt — the state between
*untagged, so reaches everybody* and *gone*. Deleting an entry throws away work
somebody else paid for; same discipline as a scrapped work item.

**Archived must be checked BEFORE the untagged rule.** An archived entry has no
agent tag once its agent is gone, so checking it second hands it to *every*
agent.

**Do not re-home an entry into an agent that does not own the subject.** Budget
is not the constraint — a detail split makes room; forcing a fact into an
unrelated lane is. Archive it, record why, and say what would justify
un-archiving it.

## Scoping: by agent, with role tags

Memory is knowledge, and knowledge belongs to the lane, so entries are tagged
with a **role**. Generation still goes through the agent axis, so **tagging a
lane is additive and changes no generated byte**; keep the two axes separate.

A CI watcher is a *mechanical* role, so a system lane is its correct home; a
guard that exercises judgement is not, because judgement is what a system lane
excludes. **Every live entry carries a lane tag**, so an untagged entry added
now goes to every agent.

## A memory entry never outranks a skill

The agents defer to `skills/` as the source of truth. **Memory summarises; the
skill governs. Where the two disagree, the skill wins and the memory entry is
wrong — fix it.**

## The layer's two declared assets are maintained here too

`README.md` and `AGENTS.md` are **declared assets with a declared purpose**,
and their upkeep belongs to this skill.

| role | purpose | layer | delivery |
|---|---|---|---|
| `instance-readme` | what the layer **is**, for a reader | `context` | read as a file |
| `agent-instructions` | what a cold agent **does** here, in order | `context` | read as a file |
| agent memory | durable facts an agent must have without asking | `context` | **injected** |

**This table is DECLARED, not described.** All three columns are `ASSET_ROLES`
in `schemas/kg/cat-harness.ts` — one record of objects per ROLE, never per
asset, because per-asset copies of a role's purpose drift apart. `layer` and
`delivery` are **required** on `AssetRoleDef`, so a new role decides them at
the keyboard rather than at CI.

**The layer column makes a process step that writes one of these a defect.**
`processMayWriteAsset(role)` answers it through the same `layerIsWritable`
rule the graph typologies use, so assets and directories cannot disagree about
what `context` permits. For a role this layer does not govern it returns
`undefined` — the third state, never to be read as permission.

**The delivery column is mechanical.** Memory is spliced into a prompt, so it
pays a budget — `MEMORY.md`'s first 200 lines, *with the overflow dropped
silently*. A file is opened, so nothing truncates it. So `AGENTS.md` may be
long and a memory entry may not, and a fact that must arrive unasked is a
memory entry. `asset-roles.test.ts` asserts it: the longest declared
`AGENTS.md` in the checkout runs past the 200-line budget, which is legal only
because its delivery is `file`.

**`AGENTS.md` augments the README; it never restates it.** The README answers
*what is this*; `AGENTS.md` answers *what do I do, in what order*. A session
that establishes a durable fact about a layer updates the one whose
question it answers — and if it answers neither, it is a memory entry.

`bun run cat check:subgraph-coverage` reports any layer missing either
asset; both are required of every layer, because one with a README and no
`AGENTS.md` is mute to an agent, and the reverse leaves a reader with nothing
saying what the layer is. `bun run cat check:asset-roles`
keeps the declaration single: it reports a required role `ASSET_ROLES` does
not govern, a role a running process would be allowed to write, or an asset
restating `purpose`, `layer` or `delivery` on itself. That last check reads the
RAW declaration, because `KgAssetSchema` is a non-strict `z.object` and drops
an unknown key when parsing.
