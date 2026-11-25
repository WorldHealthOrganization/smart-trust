<!-- GENERATED from cat-harness/processes/kg/sub-kg-lifecycle.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A sub-KG is staged in place, then leaves for its own repository

> **Generated, and not the authority.** This is `cat-harness/processes/kg/sub-kg-lifecycle.bpmn` (process `Process_SubKgLifecycle`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Create a knowledge graph inside a harnessed repository as a layer of its own, grow it there, and when it should leave, stage it for separation and move it whole into a new repository.

## Begin — A sub-KG is wanted in this repository (`Start_Wanted`)

- Begin here: A content type's creation skill asked whether the new graph goes in a new repository or inside this one, and the answer was inside this one.
- Call `workflow_start` with `process: "Process_SubKgLifecycle"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Brief` (Brief the work)

### 1. Brief the work (`Task_Brief`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `opening-brief`.
- What: What the work is and why, what is already measured with its provenance, how it will be done, and what would falsify the approach.
- Shared step `GT_Brief`.
- Record it: `workflow_complete` with `node: "Task_Brief"`.
- next: → `Task_Declare` (Declare it in place, with its seam)

### 2. Declare it in place, with its seam (`Task_Declare`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `sub-kg-lifecycle`.
- What: `<name>/<name>.json` with name, version, `repository` (the planned home), `livesAt` (where it sits today), `needs`, and only the directories that exist, each declared with its files in one commit.
- Record it: `workflow_complete` with `node: "Task_Declare"`.
- next: → `Task_Grow` (Grow it in place)

### 3. Grow it in place (`Task_Grow`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `sub-kg-lifecycle`.
- What: The content type's own authoring process runs here, against the staged layer.
- Record it: `workflow_complete` with `node: "Task_Grow"`.
- next: → `Task_DecideLeave` (Ask whether it should leave now)

### 4. Ask whether it should leave now (`Task_DecideLeave`)

- Who: the `Administrator (owner)` lane (role `administrator`).
- Skill: `sub-kg-lifecycle`.
- What: The owner decides, from what is measured, whether the sub-KG starts staging for separation now.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Leave` (Leave now?)

### Decide — Leave now? (`GW_Leave`)

- Reads the owner's answer to the ask before it.
- Call `workflow_complete` with `node: "GW_Leave"` and `outcome` set to the label that holds:
  - «stay» → `End_Stays` (Stays in place)
  - «leave» → `Task_PushDown` (Push generic down first)

## Done — Stays in place (`End_Stays`)

- The instance completes here: The sub-KG stays staged in the host. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Push generic down first (`Task_PushDown`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `graph-detanglement`.
- What: Move what is generic into the harness below before the seam is closed, and consolidate what the sub-KG needs into the harness it instantiates.
- Record it: `workflow_complete` with `node: "Task_PushDown"`.
- next: → `Task_Seam` (Route every climb through platform.ts)

### 6. Route every climb through platform.ts (`Task_Seam`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `sub-kg-lifecycle`.
- What: Every platform symbol the sub-KG uses is re-exported from `<name>/platform.ts`, so re-pointing the platform is a one-file edit.
- Record it: `workflow_complete` with `node: "Task_Seam"`.
- next: → `GW_Guard` (Guard green, no edge up?)

### Decide — Guard green, no edge up? (`GW_Guard`)

- Decided by commands: instance-separation-imports.test.ts (every instance whose repository differs from its livesAt is covered), and the three direction checks adding nothing.
- Call `workflow_complete` with `node: "GW_Guard"` and `outcome` set to the label that holds:
  - «red» → `Task_Seam` (Route every climb through platform.ts)
  - «green» → `Task_Rehearse` (Rehearse self-contained)

### 7. Rehearse self-contained (`Task_Rehearse`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `sub-kg-lifecycle`.
- What: `bun run cat seed:ready --layer <name> --rehearse` copies the layer and what it needs into a scratch workspace of sibling directories and runs the tests there.
- Record it: `workflow_complete` with `node: "Task_Rehearse"`.
- next: → `GW_Alone` (Green alone?)

### Decide — Green alone? (`GW_Alone`)

- Green with only the layer and what it needs present goes on.
- Call `workflow_complete` with `node: "GW_Alone"` and `outcome` set to the label that holds:
  - «red: an unseen climb» → `Task_Seam` (Route every climb through platform.ts)
  - «could not run» → `End_Unknown` (UNKNOWN: stop. Not clean)
  - «green» → `Call_Authorise` (Authorise the move)

## Done — UNKNOWN: stop. Not clean (`End_Unknown`)

- The instance completes here: The rehearsal could not run. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Authorise the move (`Call_Authorise`)

- Who: the `Administrator (owner)` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: Report what would move and how it undoes, and ask the owner to create the repository.
- A subprocess (`Process_KgSeparationAuthorise`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Authorised` (Authorised?)

### Decide — Authorised? (`GW_Authorised`)

- Reads which end the authorise phase reached.
- Call `workflow_complete` with `node: "GW_Authorised"` and `outcome` set to the label that holds:
  - «declined» → `End_Declined` (Staged, ready to leave)
  - «authorised» → `Call_Move` (Move it into its repository)

## Done — Staged, ready to leave (`End_Declined`)

- The instance completes here: Not yet. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 9. Move it into its repository (`Call_Move`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-separation`.
- What: Create the repository, drain, copy the staged contents in, re-point the declaration, verify a fresh clone, then consume, release and check every identifier dereferences.
- A subprocess (`Process_KgSeparationMove`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Moved` (Moved and verified?)

### Decide — Moved and verified? (`GW_Moved`)

- Reads which end the move phase reached.
- Call `workflow_complete` with `node: "GW_Moved"` and `outcome` set to the label that holds:
  - «verified» → `Task_ConfirmCutover` (Ask to freeze the in-repo copy)
  - «unknown» → `End_PhaseUnknown` (UNKNOWN: stop. Not clean)

### 10. Ask to freeze the in-repo copy (`Task_ConfirmCutover`)

- Who: the `Administrator (owner)` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: The agent reports the files that would move, their size, the new repository and the commit the copy matches, then asks: (1) freeze it in the kept trashcan now, (2) keep in place until the first release, (3) show the file list first.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Freeze` (Freeze it now?)

## Done — UNKNOWN: stop. Not clean (`End_PhaseUnknown`)

- The instance completes here: A phase could not decide: seed readiness unknown, a fresh clone that could not run, or a cutover not shown complete. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Freeze it now? (`GW_Freeze`)

- Reads the owner's answer to the ask before it.
- Call `workflow_complete` with `node: "GW_Freeze"` and `outcome` set to the label that holds:
  - «keep» → `End_Kept` (Consumed; in-repo copy kept)
  - «freeze» → `Call_Cutover` (Cut over)

## Done — Consumed; in-repo copy kept (`End_Kept`)

- The instance completes here: The host consumes the new repository and keeps its own copy, as the owner chose. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Cut over (`Call_Cutover`)

- Who: the `Administrator (owner)` lane (role `administrator`).
- Skill: `kg-separation`.
- What: Freeze the in-repo copy in the kept trashcan and measure the cutover until it is complete or cannot be shown complete.
- A subprocess (`Process_KgSeparationCutover`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_CutOver` (Cut over?)

### Decide — Cut over? (`GW_CutOver`)

- Reads which end the cutover phase reached: complete, or not shown complete.
- Call `workflow_complete` with `node: "GW_CutOver"` and `outcome` set to the label that holds:
  - «complete» → `End_Separated` (Separated)
  - «could not determine» → `End_PhaseUnknown` (UNKNOWN: stop. Not clean)

## Done — Separated (`End_Separated`)

- The instance completes here: The sub-KG lives in its own repository and the host consumes it from there. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
