---
name: l4-application-brief
description: >
  Stage 7 of smart-guideline-end-to-end: get from the requester a description
  of the consuming application — who uses it, on what device, which L2
  processes and L3 resources it covers, connectivity, the systems it talks
  to — and turn it into the design intent wireframe-design-review starts
  from. The agent offers options drawn from the L2 personas and processes,
  and never invents the application. Read before wireframing or building an
  L4 application on a guideline.
input: L4/schemas/skills/l4-application-brief/input.schema.json
output: L4/schemas/skills/l4-application-brief/output.schema.json
---

# l4-application-brief

> Skill id: `l4-application-brief` · Package: `authoring-who-smart-guidelines` ·
> Stage 7 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md),
> task `Task_DescribeApp` of
> `smart-guideline-end-to-end.bpmn` (opt-in `smart-base.collab`),
> in the requester's (`user`) lane.

**The application is the requester's, not the agent's**, as the use case
is in stage 0 ([`guideline-use-case`](../../../skills/content/authoring-who-smart-guidelines/guideline-use-case.md)).

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/l4-application-brief/input.schema.json) and [`output.schema.json`](../../schemas/skills/l4-application-brief/output.schema.json).

- **In:** what the requester said (`request`), the `useCase`, the stage-4 `l2Assets` the options are drawn from, and the stage-6 `ig` build.
- **Out:** the `applicationBrief` (`topic`, `kind`, `users`, `devices`, `l2Processes`, `l3Resources`, `operations`, `connectivity`, `systems`); and the `wireframeRequest`, which is cat-harness `wireframe-design-review`'s input for design use, so stage 8a is called with it unchanged.

## Steps

1. If the request does not describe the application, ask a numbered
   question. Use the requester's own words where they gave any, and offer
   options drawn from the L2 personas and processes already found:

   > Which application are we building?
   >
   > 1. **A point-of-care app** for the DAK's main persona, covering its business
   >    processes *(recommended when stage 4 found one dominant persona)*.
   > 2. **A reporting / indicator dashboard** over the DAK's indicators.
   > 3. **A decision-support service** (CDS Hooks / `$apply`) that an existing
   >    EMR calls.
   > 4. **Tell me more.**

2. Fill the brief. `users` are L2 persona ids, `l2Processes` L2
   business-process ids, `l3Resources` canonicals from the stage-6 build:
   the brief names what the guideline already has, and a need it does not
   have goes back to stage 4 or 6 as a finding.
3. Write the `wireframeRequest`: `use: design`, the brief's `topic`, the
   application's screens as `surface`, and as `intent` who the screens are
   for, what they need to do and what they must show.

## Adjudication

None: the requester is the source. The brief is checked when the wireframes
and the application are adjudicated.
