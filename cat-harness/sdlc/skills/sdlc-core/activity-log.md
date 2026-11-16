# Activity log — what an agent did, kept out of the graph

**Write an entry when you start a task, when you end one, and whenever you
have something a later reader would need.** Entries go to `fsh-guts/logs/`,
and **nothing reaches the git data store unless capture is explicitly on.**

## The role is mechanical

`log` in `scenarios/roles.json`: `actorKinds: ["system"]`. It is written to
and emptied *by* an actor, and it decides nothing. The precedents are
`work-plan` and `corpus`. A mechanical role is still a real role: this skill
is its **contract** — the shape of an entry and where it goes.

## The entry

`schemas/sdlc/log-entry.ts`. Every entry carries `$schema: folio-log/v1`: a
directory says what to EXPECT and the file says what it IS. Without it, a log
entry is told apart from a discarded proposal by its folder alone.

| field | why it is there |
|---|---|
| `event` | `task-start` · `task-end` · `message` · `error` |
| `summary` | one line, so a long log stays skimmable; detail goes in `detail` |
| `actor`, `role` | who, and which lane they were acting in |
| `process`, `task` | the BPMN process and step, when inside one |
| `bean`, `branch`, `session` | so a run's entries can be found and emptied together |
| `references[]` | **what this entry points at** — a chat, an issue, a commit, a command. See below |
| `execution` | command-execution detail, when the entry IS one |
| `capture` | whether this entry persists — **three-valued**, see below |

`role`, `process` and `task` are **optional and meant to be**. An agent
writes log lines outside any process, and inventing a lane for those would
be the fake-reference failure `activity-names-skill` exists to prevent.

## What an entry points at — `references[]` is OPEN

An entry references whatever the work touched — discussions, chats, command
executions and more — and nobody enumerates that in advance, so a closed list
is wrong within a week. So `kind` is an
open string with a KNOWN SET, and an unrecognised kind is **accepted and flagged**, never
refused:

```
discussion · comment · issue · pull-request · commit · command · workflow · artefact
```

A reference is `{ kind, ref }` plus an optional `title` and `at`. **`ref` is
required**: a kind with nothing to point at gives the reader no way to reach
it.

**A list, not named fields**, because one entry routinely touches several of
one kind (a step that answers three review threads has three comments).

**Unknown kinds are surfaced rather than rejected.** Open is the point, but a
*silently* open list is how `issue`, `issues` and `gh-issue` end up in one
store with nothing able to query it. `writeLogEntry` returns
`unknownRefKinds`, and the one-line report says so — so a typo is noticeable
without the parser being able to refuse a legitimate extension.

### Command execution has its own shape, and no output field

`execution` carries `command`, `argv`, `exitCode`, `durationMs`, `cwd` and
`outputRef`. It sits beside `references` rather than inside it because an exit
code is a *queryable fact*, and `ref: "exit 1"` is not a field anyone can
filter on. **An absent `exitCode` means it did not finish, which is not `0`** —
the third state again.

**There is deliberately no field to inline output into.** `outputRef` points
at where stdout and stderr went. Command output is the likeliest place for a
token or a connection string to appear, and `capture: "on"` puts an entry in
git in a repository that may be public. An `output` field would invite that
leak, and **an absent field is stronger than a warning.** The same caution applies to `command` itself: a
command line carries its own arguments, and `--token=…` is a command line.

## Turning it on — `<cat-harness.processes:log capture="on"/>` on the process

Capture is a declaration on the **process**, parsed at load and **throwing on a
value the engine cannot honour**, exactly as `<cat-harness.processes:bean op>`
does. A diagram asking for a mode that does not exist must not load and quietly
log nothing, because the missing artefact *is* the record.

`workflow_start` writes `task-start`; `workflow_complete` writes `task-end`
for the step just recorded, with the instance's status in the detail. The step
is the unit, not the whole process: waiting for the process to finish would
lose every intermediate entry, which is most of what a log is read for.

Marked in this layer: `crdm-requirements` and `actor-role-administration`.

**Not a call activity.** A call activity is a **node in the control flow**,
so the log would become a step to complete in sequence, and in a
`enforcement="strict"` process `workflow_gate` refuses a step that is not
enabled, so a call activity would need policy relaxations for a concern that is
not a phase of anything. An extension element adds no node and no flow; a test asserts the
strict processes enforce exactly what their diagrams say.

**`unknown` is not writable as a declared value.** It is what the *absence* of
a declaration resolves to, and a diagram cannot assert that nobody could tell.

## Capture is off by default, and `unknown` is a real answer

`fsh-guts/logs/` is inside the repository, so writing there *would* be
committing unless something stops it. The default is **write locally,
ignored by git** — the agent can read back what it wrote this session, and
nothing enters the data store until a workflow or the config asks.

```
off      the default — written, not committed
on       explicitly enabled, for this workflow or by config
unknown  the setting could not be determined
```

A logging system that silently keeps nothing is worse than none, because the
agent believes it has an audit trail. So:

- absent configuration resolves to `unknown`, **never to `off`** — they are
  different claims. `off` says somebody decided; `unknown` says nobody could
  tell, and the first is a choice while the second is a bug.
- `unknown` does **not** persist. When the setting cannot be determined the
  safe reading is the default, and committing an audit trail nobody asked
  for is the worse of the two failures.
- **report the state.** Say which of the three you are in when you start
  logging; do not let a reader infer it.

Same discipline as `ci-health` never rendering "could not check" as green,
and `renderingMediaType` returning `undefined` rather than a plausible guess.

## Emptying — and the exception to the never-delete rule

Three operations: **one entry**, **all of them**, and a **periodic sweep**.
An entry carries a stable `id` so the first is possible at all, and
`session` so a whole run can go at once.

**This is the one exception to [`fsh-guts`](../../../skills/kg/kg-core/fsh-guts.md)'s rule that nothing
is deleted.** That rule exists because a removed artefact cannot be told
from one that never existed, and a scrapped thing records a dead end so the
next agent does not re-enter it. **A log entry records no decision.** It is
a trace of activity, it is expected to be voluminous, and keeping it forever
would drown the directory that exists to make discarded *decisions*
findable.

So: logs may be emptied without confirmation; **everything else in
`fsh-guts/` may not.** Without this exception an agent would either never empty
the log or start deleting proposals.

### The exception was granted to a KIND OF FILE, not to a path

`emptyLog(root, selector)` in `src/logging/log-sweep.ts`, with the selector
being one of `{ id }`, `{ session }`, `{ before }` or `{ all: true }`. There
is **no default selector**: an operation with no undo that empties everything
when the caller passed nothing is the wrong way round.

**A file is removed only if it declares itself a `folio-log/v1` entry**, never
by path. A stray proposal dropped in the log directory keeps every protection
it would have had one folder up, because the exception was granted to a kind
of file, not to a path, and a declaration inside the file is the contract.

Three consequences worth knowing before you call it:

- **"Could not tell" resolves to KEEP.** A file that will not parse is a file
  whose kind could not be established, and this module deletes.
- **A symlink out of the directory is refused**, checked by `realpath` rather
  than `resolve` — string arithmetic would not catch it, and here the cost of
  getting containment wrong is a loss rather than a leak.
- **Everything not removed says WHY**, and `describeSweep` separates a
  selector miss from a refusal. "Nothing to delete" and "nine files I would
  not touch" must not read the same; the second is the one somebody needs to
  know about. `scanned` is the vacuity guard on every other count.

## It is never published

`fsh-guts/logs/` is inside `fsh-guts/`, which `UNPUBLISHED_GRAPH_TYPOLOGIES`
strips from every published graph — the kind, the directory, the skill and
every edge naming them
([`kg-export`](../../../skills/kg/kg-core/kg-export.md)).

That is placement doing the work rather than a second rule, which is why
logs can be as detailed as they need to be. **There is a test asserting it
for logs specifically**, rather than trusting that the parent rule reaches
them.

## What not to log

- **Secrets, tokens, credentials or personal data.** Not-published is not
  the same as not-committed and not the same as private: capture `on` puts
  entries in git, and the repository may be public.
- **A substitute for a work item.** A log says what happened; a work item says what is
  being worked on and what it waits on. Log in addition to claiming, never
  instead.
- **A substitute for the turn report.** The log is for a later reader; the
  report is for the person in the room now.
