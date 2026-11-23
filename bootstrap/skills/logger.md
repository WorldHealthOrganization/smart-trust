---
name: logger
description: >
  The contract a Logger keeps: accept a complete log message, record it
  unchanged where a person can read it, attributed to the actor the message
  names. A mechanical Actor plays this Role; this is what it must do, and what
  it can be tested against.
tested-by:
  - https://github.com/litlfred/bootstrap-tools/blob/main/scripts/logger.test.ts
---

# The Logger's contract

**A Logger plays a Role, and this is the Role's contract.** The author of a
log line follows [`log-message`](log-message.md). This skill is the other side:
what happens to the line once it arrives.

It sits in the `Logger` lane of [`log-message`](../processes/log-message.bpmn).

## Responsibilities

1. **Record a complete message unchanged.** All five fields `log-message`
   requires (`timestamp`, `actor`, `process`, `task`, `message`), and `body`
   when given, are recorded as received. No field is rewritten, truncated or
   filled in.
2. **Attribute it to the actor the message names.** The line says the `actor`
   field's value acted. It never names the Logger.
3. **Put it where a person can read it.** In bootstrap that is the discussion
   the human actor is already in. A harness that installs a log sink adds a
   Tool for it, and this contract still holds.
4. **Say when it cannot record.** If the destination is unreachable, the
   failure is reported to the author, so `log-message`'s "say that you could
   not" can happen. A message is never dropped silently.

## Tests

Bootstrap runs nothing, so the test named in `tested-by:` lives with the
toolset. It checks line 1 (the fields match `log-message`, and only a
complete message reaches the `Logger` lane). Lines 2–4 concern the
destination, the discussion, and are not tested.

## Not its responsibility

Composing the message, judging whether it is complete, or deciding what
happens next. Those happen in the acting Actor's lane before anything reaches
the Logger.
