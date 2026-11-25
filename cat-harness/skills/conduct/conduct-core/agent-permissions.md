---
name: agent-permissions
description: >
  Securing what a coding agent may do without asking, from the person who can
  grant it: the `secure-agent-permissions` sub-process, run at session start and
  on demand when an action is denied. Vendor-neutral: the coding agent is a Tool
  (Claude Code is one; Gemini CLI, Cursor, Copilot and Codex are others), and
  each Tool's own config format belongs to its adapter, not here. Covers the
  permissions the harness's processes need, least privilege, how each one is
  explained before it is granted, how a grant is recorded, and the rules that no
  grant relaxes: never self-granted, generated projections are CI's, and merging
  to main is never a standing permission.
---

# Agent permissions — asked for, explained, granted by a person, recorded

[`processes/process/secure-agent-permissions.bpmn`](../../../processes/process/secure-agent-permissions.bpmn)
(`Process_SecureAgentPermissions`) is the process. It is called from
`session-state-machine.bpmn` (`Call_SecurePermissions`, after the session record
opens), so it is part of starting work in a layer. It also runs **on
demand when an agent hits a denied action**. A denial is a reason to ask. It is
never a reason for the agent to edit its own configuration.

A run that finds every needed permission granted and recorded ends at
`End_Current` without asking anything.

## Three layers, three questions, and this skill answers the third

| layer | question | where it lives |
|---|---|---|
| role | what does the performer of this lane need to KNOW? | skills on the role ([`role-model`](../../process/process-core/role-model.md)) |
| actor permission | what may this participant DO in the harness, in any lane? | `skills/permissions/permissions.json` actions, granted by ODRL rules under `policies/` |
| **agent Tool permission** | **what may this coding agent do on this machine without stopping to ask?** | **the Tool's own config, written through its adapter; the grant recorded as below** |

The third layer enforces the second at the agent host. Editing hooks or
settings exercises `admin-settings`; writing content exercises
`content-authoring`. An agent Tool permission never widens what the actor's
ODRL grants allow. It only decides whether the host stops to ask.

## The permissions the processes need

Grant only what the layer's processes actually call, and the narrowest form
that does the job.

| permission | what it allows | why a process needs it | notes |
|---|---|---|---|
| run the gates | run the repository's test, typecheck and `cat` check scripts | every gate a PR must pass before `merge-to-main` | read-only checks first; a writer (`regen`) is a separate grant |
| push a feature branch | `git push` to a non-default branch | `continual-progress`: commit early, push, open the PR at the first commit | never the default branch; never `--force`, only `--force-with-lease` |
| open and update a PR | create a PR, comment, label it | `continual-progress`, `issue-working`, `merge-queue` handover | never merge |
| edit agent hooks and settings | change the Tool's hand-edited config | only when a hook or setting is itself the defect | **per change, never standing**: the exact diff, the reason, then the owner's yes ([`harness-projections`](harness-projections.md)) |
| write generated projections | regenerate the Tool's projections of the graph | none: CI regenerates them on the PR head | **not granted to an agent at all** ([`harness-projections`](harness-projections.md)) |
| merge to `main` | — | — | **never a Tool permission.** Every merge is its own owner-authorised run of `merge-to-main` (opt-in `cat-harness.sdlc`). No allow-rule for a merge command is ever written. |

## Explaining one before it is granted

`Task_Explain` follows
[`interaction-modality`](interaction-modality.md) §4.1: context, options,
recommendation, question. The test is whether the owner can answer without
opening anything. For each permission:

1. **What it allows**, concretely: the command or file pattern, and what the
   agent will then do without stopping.
2. **Why** a process here needs it: name the process and the step.
3. **Options**, narrowest first: the exact pattern, a wider one, or no grant
   (and what then keeps asking).
4. **The exact config change**, as a diff in the Tool's own format, produced by
   its adapter.
5. **The recommendation**: least privilege, unless there is a measured reason
   for more.

## Recording a grant (not relaxable)

Before the config is written, one record per permission, granted or refused:

```
agent-permission:
  by: <the person's login>
  on: <ISO-8601 date-time>
  tool: <Tool id, e.g. the coding agent's Tool node>
  permission: <a row of the table above>
  scope: session:<id> | instance | until:<ISO-8601>
  answer: granted | narrowed | refused
  diff: <sha256 of the config diff shown>
  evidence: "<the person's words, verbatim>" (<session link or comment permalink>)
```

Post it on the PR that carries the config change, and in its commit message.
A refusal is recorded too, so the next session does not ask the same question
blind.

**A config rule with no grant on the record is reported as unrecorded**
(`Task_ReadGrants`). It is not treated as granted, because a rule nobody can
account for cannot be told from one an agent wrote for itself.

## Rules no grant relaxes

- **Never self-granted.** The grant is a person's (`Task_OwnerGrants` is
  fulfilled by a person only). The config write is done by the person, or by the
  agent writing exactly the diff the person consented to. If you are composing
  the consent, you are the grantor, and you may not be (the
  [`confirmation-waiver`](confirmation-waiver.md) rule, applied to the agent
  host).
- **Generated projections are CI's.** No permission lets an agent write them
  ([`harness-projections`](harness-projections.md)).
- **Hand-edited agent config changes per change, with consent.** A standing
  grant to edit settings does not exist. Each edit is its own diff, reason and
  yes.
- **Merging to `main` is never granted here.** See
  `merge-to-main`.
- **A broad instruction is not a grant.** "Fix all issues until green", "get
  the session start working" and "stop the prompts" authorise investigation.
  They do not authorise widening what the agent may do. Bring the diff back.

## Per-Tool specifics belong to the Tool, not here

Where a Tool keeps its permissions, how a rule is spelled, and which of its
files are generated are properties of that Tool, and belong on its Tool node or
adapter ([`bpmn-processes`](../../process/workflow/bpmn-processes.md) §"A Tool's
OWN procedure is the Tool's subprocess, not the skill's prose"). For example, Claude Code keeps
permission allow-rules in `.claude/settings*.json`.

## What this does not do yet

- **No coding-agent Tool nodes or adapters exist in cat-harness.** Claude Code,
  Gemini CLI, Cursor, Copilot and Codex have no Tool node here. `claude` is
  declared only as an actor (`scenarios/actors/claude.json`). Until adapters
  exist, `Task_IdentifyTools` reports "no adapter" and leaves the config write
  to the person.
- **`GW_Gap` is a judgement.** Computing it needs the needed set (from the
  processes this layer runs) and the granted set (from the config, through an
  adapter). No tool produces both yet.
- **The permission rows are not yet ODRL actions.** They map onto existing
  actions (`admin-settings`, `content-authoring`) in the table above, but are
  not declared in `permissions.json`; declaring them belongs with the adapters
  that read them.
