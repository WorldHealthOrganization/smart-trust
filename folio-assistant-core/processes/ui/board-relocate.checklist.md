<!-- GENERATED from folio-assistant-core/processes/ui/board-relocate.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Board: relocate content to the trashcan

> **Generated, and not the authority.** This is `folio-assistant-core/processes/ui/board-relocate.bpmn` (process `Process_BoardRelocate`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Moving open content to the trashcan from the board, with the reader's confirmation in front of the move and not behind it.

## Begin — The fishbone is used on open content (`Start_Fishbone`)

- Begin here.
- Call `workflow_start` with `process: "Process_BoardRelocate"` and the subject this run is about; keep the instance id it returns.
- next: → `A_AskConfirm` (Name what will move, and where it lands)

### 1. Name what will move, and where it lands (`A_AskConfirm`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `deletion-requires-confirmation`.
- What: Before anything moves, name the content that would move — what it is, with its size and age — and where it lands.
- Record it: `workflow_complete` with `node: "A_AskConfirm"`.
- next: → `GW_Confirmed` (Confirmed by the reader?)

### Decide — Confirmed by the reader? (`GW_Confirmed`)

- The reader's answer to A_AskConfirm, which named what will move and where it lands.
- Call `workflow_complete` with `node: "GW_Confirmed"` and `outcome` set to the label that holds:
  - «yes, move it» → `A_MoveContent` (Relocate the content to the trashcan)
  - «no» → `A_Cancel` (Leave the content exactly where it is)

### 2. Relocate the content to the trashcan (`A_MoveContent`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-diagram-interchange`.
- What: Relocate the confirmed content — that one thing, not the class it belongs to — to the trashcan.
- Record it: `workflow_complete` with `node: "A_MoveContent"`.
- next: → `A_UpdateLayer` (Drop its positions and sweep orphans)

### 3. Leave the content exactly where it is (`A_Cancel`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: The reader said no: nothing moves, no position is dropped, and the board is left exactly as it was.
- Record it: `workflow_complete` with `node: "A_Cancel"`.
- next: → `End_Unchanged` (Nothing moved)

### 4. Drop its positions and sweep orphans (`A_UpdateLayer`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-diagram-interchange`.
- What: Only after the content has moved: drop its positions from the layout layer and sweep any position whose note is now gone.
- Record it: `workflow_complete` with `node: "A_UpdateLayer"`.
- next: → `A_ReportMove` (Say what moved and where it went)

## Done — Nothing moved (`End_Unchanged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Say what moved and where it went (`A_ReportMove`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `deletion-requires-confirmation`.
- What: Tell the reader what moved and where it went, so the content can be found in the trashcan rather than inferred missing from a card that disappeared.
- Record it: `workflow_complete` with `node: "A_ReportMove"`.
- next: → `End_Moved` (The content lives in the trashcan)

## Done — The content lives in the trashcan (`End_Moved`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
