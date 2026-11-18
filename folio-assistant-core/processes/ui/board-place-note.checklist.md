<!-- GENERATED from folio-assistant-core/processes/ui/board-place-note.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Board: place a note

> **Generated, and not the authority.** This is `folio-assistant-core/processes/ui/board-place-note.bpmn` (process `Process_BoardPlaceNote`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Putting a note at a spot on a board: write the note into the folio, record where it was drawn on THIS board, and sweep any position whose note has gone.

## Begin — A note is to appear at a spot (`Start_Place`)

- Begin here.
- Call `workflow_start` with `process: "Process_BoardPlaceNote"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_Exists` (Does the note exist already?)

### Decide — Does the note exist already? (`GW_Exists`)

- Is the note already in the folio?
- Call `workflow_complete` with `node: "GW_Exists"` and `outcome` set to the label that holds:
  - «new sticky» → `A_CreateNote` (Write the note into the folio — with no coordinate)
  - «an existing card, dragged» → `A_Place` (Record x,y for this note on THIS board)

### 1. Write the note into the folio — with no coordinate (`A_CreateNote`)

- Who: the `Author` lane (role `author`).
- Skill: `board-diagram-interchange`.
- What: A new note: write it into the folio with no x, no y, no board and no position.
- Record it: `workflow_complete` with `node: "A_CreateNote"`.
- next: → `A_Place` (Record x,y for this note on THIS board)

### 2. Record x,y for this note on THIS board (`A_Place`)

- Who: the `Layout layer` lane (role `corpus`).
- Skill: `board-diagram-interchange`.
- What: Record the note's x,y in the layout layer for THIS board, naming the note by id.
- Record it: `workflow_complete` with `node: "A_Place"`.
- next: → `A_SweepOrphans` (Sweep positions whose note is gone)

### 3. Sweep positions whose note is gone (`A_SweepOrphans`)

- Who: the `Layout layer` lane (role `corpus`).
- Skill: `board-diagram-interchange`.
- What: Remove every position in this board's layer whose note no longer exists.
- Record it: `workflow_complete` with `node: "A_SweepOrphans"`.
- next: → `End_Placed` (The board shows it there)

## Done — The board shows it there (`End_Placed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
