---
name: inform-client
description: >
  A health worker tells the client (or caregiver) what was decided and what
  happens next, in words and, where the DAK gives one, on a slip or card: a
  referral, a return date, a result. Input is what to tell and the client's
  language; output is that the client was told, and what they were handed.
  Generic for any DAK step that ends with the client being informed.
input: L4/schemas/skills/inform-client/input.schema.json
output: L4/schemas/skills/inform-client/output.schema.json
---

# Inform the client

> Skill id: `inform-client` · Package: `authoring-who-smart-guidelines` ·
> Performed by a person in a `health-worker` lane. WHO's immunization DAK has
> it as IMMZ.D7 "Counsel client" and IMMZ.D9 "Inform client when to return".

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/inform-client/input.schema.json)
and [`output.schema.json`](../../schemas/skills/inform-client/output.schema.json).

- **In:** the `about` (a referral, a return visit, a result, a decision),
  the `facts` to convey, the `language` the client understands, and any
  `handout` the DAK gives (a referral slip, a vaccination card).
- **Out:** `informed` (true once said and understood), the `handedOver`
  items, and the `questions` the client raised that need follow-up.

## What the health worker does

1. Say what was decided and what happens next, in the client's language,
   without jargon; check it was understood.
2. Hand over the slip or card when the DAK gives one.
3. Note any question that needs a follow-up. Nothing else is recorded: this
   step adds no form.

## Success criteria

- The client can say where to go, when, and why.
- Every handout the DAK names was given.
