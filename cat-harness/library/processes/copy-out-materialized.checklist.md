<!-- GENERATED from cat-harness/library/processes/copy-out-materialized.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Copy out materialized content — to work on somebody else's bytes

> **Generated, and not the authority.** This is `cat-harness/library/processes/copy-out-materialized.bpmn` (process `Process_CopyOutMaterialized`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Somebody wants to change content this repository holds a read-only materialized copy of: copy it into their own `folio/`, recording which original it came out of.

## Begin — Somebody wants to work on held content (`StartEvent_WantToEdit`)

- Begin here: The entry point is an INTENT TO EDIT, not a request to copy.
- Call `workflow_start` with `process: "Process_CopyOutMaterialized"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_Frozen` (Is the target materialized / read-only?)

### Decide — Is the target materialized / read-only? (`Gateway_Frozen`)

- The one gate.
- Call `workflow_complete` with `node: "Gateway_Frozen"` and `outcome` set to the label that holds:
  - «yes — read-only» → `Task_ReadSource` (Read the original — and write nothing)
  - «no, or not declared» → `Task_EditDirectly` (Edit it in place — it is your own content)

### 1. Read the original — and write nothing (`Task_ReadSource`)

- Who: the `Source graph — read-only` lane (role `corpus`).
- Skill: `copy-out-materialized`.
- What: A read, and the only interaction this process has with the source.
- Record it: `workflow_complete` with `node: "Task_ReadSource"`.
- next: → `Task_Land` (Land the bytes in the copier's own folio/)

### 2. Edit it in place — it is your own content (`Task_EditDirectly`)

- Who: the `Reader (any actor)` lane (role `user`).
- Skill: `copy-out-materialized`.
- What: The ordinary path, drawn so the process does not read as though every edit needs a copy.
- Record it: `workflow_complete` with `node: "Task_EditDirectly"`.
- next: → `EndEvent_NotFrozen` (Edited where it lives — no copy needed)

### 3. Land the bytes in the copier's own folio/ (`Task_Land`)

- Who: the `Copier's own folio/` lane (role `author`).
- Skill: `copy-out-materialized`.
- What: Into the copier's own declared `folio/`, never a scratch area — a directory nobody declared is a directory nobody gates, and the copy would be publishable by accident.
- Record it: `workflow_complete` with `node: "Task_Land"`.
- next: → `Task_RecordProvenance` (Record what this is a copy of)

## Done — Edited where it lives — no copy needed (`EndEvent_NotFrozen`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Record what this is a copy of (`Task_RecordProvenance`)

- Who: the `Copier's own folio/` lane (role `author`).
- Skill: `copy-out-materialized`.
- What: The step that is easy to omit and impossible to reconstruct afterwards.
- Record it: `workflow_complete` with `node: "Task_RecordProvenance"`.
- next: → `Task_VerifySourceUntouched` (Verify the ORIGINAL still hashes to its digest)

### 5. Verify the ORIGINAL still hashes to its digest (`Task_VerifySourceUntouched`)

- Who: the `Verification` lane (role `validation-pipeline`).
- Skill: `copy-out-materialized`.
- What: `check:materialized-fixity`.
- Record it: `workflow_complete` with `node: "Task_VerifySourceUntouched"`.
- next: → `EndEvent_Copied` (A working copy, saying what it is a copy of)

## Done — A working copy, saying what it is a copy of (`EndEvent_Copied`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
