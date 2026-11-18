<!-- GENERATED from cat-harness/processes/kg/kg-separation.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A knowledge graph leaves for its own repositories

> **Generated, and not the authority.** This is `cat-harness/processes/kg/kg-separation.bpmn` (process `Process_KgSeparation`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Move part of a knowledge graph into repositories of its own: the content (files to read, no code) and its tools (the code that writes and checks it) separate as a pair, into two repositories, not one.

## Begin — Too large, or readers and cadence differ (`Start_Trigger`)

- Begin here.
- Call `workflow_start` with `process: "Process_KgSeparation"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Brief` (Brief the work)

### 1. Brief the work (`Task_Brief`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `opening-brief`.
- What: What the work is and why, what is already measured with its provenance, how it will be done, and what would falsify the approach.
- Shared step `GT_Brief`.
- Record it: `workflow_complete` with `node: "Task_Brief"`.
- next: → `Task_Measure` (Measure the signals)

### 2. Measure the signals (`Task_Measure`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-separation`.
- What: Files and bytes per layer, clone cost (`bun run cat health`), gate time, merge contention, the candidate's cohesion and cut (`kg:detangle`), wrong-direction edges, and the would-be tools package's import cone.
- Record it: `workflow_complete` with `node: "Task_Measure"`.
- next: → `Task_Decide` (Ask whether to separate it)

### 3. Ask whether to separate it (`Task_Decide`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `kg-separation`.
- What: The owner decides from the measured signals, and also decides the address base for its identifiers, where verdicts about it live, and what its tools repository owns.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Separate` (Separate this graph?)

### Decide — Separate this graph? (`GW_Separate`)

- Reads the owner's answer to the ask before it.
- Call `workflow_complete` with `node: "GW_Separate"` and `outcome` set to the label that holds:
  - «declined» → `End_Stays` (Stays where it is)
  - «separate» → `Task_Detangle` (Declare, detangle, isolate)

## Done — Stays where it is (`End_Stays`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Declare, detangle, isolate (`Task_Detangle`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: The graph-detanglement practice, all of its gates: declared in place, zero wrong-direction edges on every axis, and standing alone with its own declaration, namespace and artefact.
- Record it: `workflow_complete` with `node: "Task_Detangle"`.
- next: → `Call_Prepare` (Prepare it to stand alone)

### 5. Prepare it to stand alone (`Call_Prepare`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-separation`.
- What: Identity, hosted output, the content-tools split, the publication plan, and the standalone rehearsal.
- A subprocess (`Process_KgSeparationPrepare`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Prepared` (Green alone?)

### Decide — Green alone? (`GW_Prepared`)

- Reads which end the prepare phase reached.
- Call `workflow_complete` with `node: "GW_Prepared"` and `outcome` set to the label that holds:
  - «green» → `Call_Authorise` (Authorise the extraction)
  - «red: an unseen edge» → `Task_Detangle` (Declare, detangle, isolate)
  - «could not run» → `End_Unknown` (UNKNOWN — stop. Not clean)

### 6. Authorise the extraction (`Call_Authorise`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: Report what moves and ask the administrator.
- A subprocess (`Process_KgSeparationAuthorise`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Authorised` (Authorised?)

## Done — UNKNOWN — stop. Not clean (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Authorised? (`GW_Authorised`)

- Reads which end the authorise phase reached.
- Call `workflow_complete` with `node: "GW_Authorised"` and `outcome` set to the label that holds:
  - «authorised» → `Call_Move` (Move it into its repositories)
  - «declined» → `End_Declined` (Stays in place, ready to leave)

### 7. Move it into its repositories (`Call_Move`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-separation`.
- What: Create the repositories, drain, seed, consume additively, release, and check every identifier dereferences.
- A subprocess (`Process_KgSeparationMove`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Moved` (Seeded and released?)

## Done — Stays in place, ready to leave (`End_Declined`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Seeded and released? (`GW_Moved`)

- Reads which end the move phase reached.
- Call `workflow_complete` with `node: "GW_Moved"` and `outcome` set to the label that holds:
  - «released» → `Call_Cutover` (Cut over)
  - «unknown» → `End_Unknown` (UNKNOWN — stop. Not clean)

### 8. Cut over (`Call_Cutover`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `kg-separation`.
- What: Retire the parent's copy and measure the cutover until it is complete or cannot be shown complete.
- A subprocess (`Process_KgSeparationCutover`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_CutOver` (Cut over?)

### Decide — Cut over? (`GW_CutOver`)

- Reads which end the cutover phase reached: complete, or not shown complete.
- Call `workflow_complete` with `node: "GW_CutOver"` and `outcome` set to the label that holds:
  - «complete» → `End_Separated` (Separated)
  - «could not determine» → `End_Unknown` (UNKNOWN — stop. Not clean)

## Done — Separated (`End_Separated`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
