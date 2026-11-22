---
name: log-message
description: >
  Say what you are doing, to the Logger, in a form a reader can act on. Five
  required fields and one optional body; an incomplete message is not logged.
  Callable from any task in any process, and required by some.
---

# Logging what you are doing

**You are the author of a log line; the Logger is where it goes.** The Logger
records and decides nothing, so it cannot know who acted: you supply `actor`.

It is carried out as a **sub-process**: nobody starts there. A task in another
process calls it, and the calling task's diagram says so; this skill does not
list its callers or the process that implements it.

## The message

Five strings, all required, and one optional markdown body.

| field | what it answers | shape |
|---|---|---|
| `timestamp` | when | an ISO-8601 instant, e.g. `2026-09-20T14:03:11Z` |
| `actor` | who was acting | the acting actor's id — **never the Logger's** |
| `process` | inside which process | a process id, e.g. `my-process` |
| `task` | at which step of it | a node id within that process, e.g. `A_DoTheThing` |
| `message` | what happened | one line, no newline |
| `body` | the detail, if any | markdown, optional |

**All five are required**: each answers a question a reader would otherwise
guess.

**`body` is the one place free prose belongs.** A diff, an error, the contents
of a file that was not where it should have been. Keep `message` to the line
somebody scanning will read, and put everything else here.

## When to log

**Optionally, from any task in any process.** You need no permission and no
element in the diagram: an actor saying what it is doing is always in order.

**Required where a diagram says so**, which it says by drawing the call
explicitly — a `callActivity` whose `calledElement` is `Process_LogMessage`.
If the diagram drew it, logging is a step, not a courtesy.

The difference between the two is only whether the caller drew it. It is the
same sub-process either way, and it takes the same six fields.

## If you cannot complete the message

**Do not log, and say that you could not.** The `End_NotLogged` branch is a real
outcome, not an error path to route around.

A line missing its `actor` or its `task` still looks like a record, and a
reader cannot tell it from a complete one.

The same holds if the Logger is unreachable: say so, in the place you would have
logged to, and carry on with the task. **Logging is not a gate.** A failure to
log is never a reason to abandon an install.

## The one destination bootstrap has

**The discussion with the human actor.** A Bootstrapping Agent has no log file, no
service and no work plan — the only place it can put a line where a person will
see it is the conversation it is already in.

There is no command: the agent writes the six fields into the conversation. A
harness that installs a real log sink adds a Tool for it; this skill still
says what a message is.

## What this skill is NOT

A log line says what an actor did at a moment; it is not a record of work
still outstanding. Logging is also not asking: if a
step needs a judgement, that is [`confirm-harness`](confirm-harness.md), and no
number of log lines substitutes for it.
