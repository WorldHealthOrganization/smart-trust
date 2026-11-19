---
name: review-client-history
description: >
  A health worker reads the client's history as their device shows it (an
  International Patient Summary, imported records, or a paper card and what
  the client reports) and takes into account what bears on today's care,
  weighing each item by where it came from: verified, unverified or reported.
  Input is the records with their provenance; output is what the health
  worker relies on.
input: L4/schemas/skills/review-client-history/input.schema.json
output: L4/schemas/skills/review-client-history/output.schema.json
---

# Review the client's history

> Skill id: `review-client-history` · Package: `authoring-who-smart-guidelines` ·
> Performed by a person in a `health-worker` lane. The PHC digital
> transformation handbook's "longitudinal tracking" of a health service user
> is what this reads.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/review-client-history/input.schema.json)
and [`output.schema.json`](../../schemas/skills/review-client-history/output.schema.json).

- **In:** the `records` shown, each a FHIR resource (or a summary of a paper
  record), with its `provenance`: `verified` (a signature or a trusted
  source checked it), `unverified` (read but not checked) or `reported`
  (paper, or the client's word); and the `purpose` of the visit.
- **Out:** the `reliedOn` items, each with its provenance kept, and the
  `gaps` the health worker could not settle.

## What the health worker does

1. Read what bears on today's care: allergies, current medicines,
   vaccinations, active problems.
2. Treat each item by its provenance: an unverified or reported item is
   taken like paper, by the programme's policy for paper records, never
   shown or recorded as verified.
3. Note the gaps; the DAK's own steps (decision support, a form) act on them.

## Success criteria

- Nothing reported or unverified is relied on as verified.
- What was relied on, and why, can be read back from the output.
