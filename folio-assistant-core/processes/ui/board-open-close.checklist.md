<!-- GENERATED from folio-assistant-core/processes/ui/board-open-close.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Board: open and close content

> **Generated, and not the authority.** This is `folio-assistant-core/processes/ui/board-open-close.bpmn` (process `Process_BoardOpenClose`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

What a reader does to a board and what the renderer does back: every card rests as its avatar, a window opens onto the one the reader chose, and it closes back to where it came from.

## Begin — A board is opened (`Start_Board`)

- Begin here.
- Call `workflow_start` with `process: "Process_BoardOpenClose"` and the subject this run is about; keep the instance id it returns.
- next: → `A_RenderAvatars` (Render every card as its avatar)

### 1. Render every card as its avatar (`A_RenderAvatars`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Render every card as its avatar — the starting state.
- Record it: `workflow_complete` with `node: "A_RenderAvatars"`.
- next: → `GW_Act_Join`

### Merge — `GW_Act_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_Act` (What did the reader do?)

### Decide — What did the reader do? (`GW_Act`)

- Waits on the reader's next action on the board.
- Call `workflow_complete` with `node: "GW_Act"` and `outcome` set to the label that holds:
  - «open a card» → `A_Open` (Project a window onto the board)
  - «select a window» → `A_Raise` (Raise the window the reader selected)
  - «[x]» → `A_Close` (Close the window back to its avatar)
  - «resize the board» → `A_ResolveThreshold` (Resolve the kind's zoom threshold)
  - «leave» → `End_Board` (The reader leaves the board)

### 2. Project a window onto the board (`A_Open`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Project a window onto the board for the chosen card.
- Record it: `workflow_complete` with `node: "A_Open"`.
- next: → `A_Raise` (Raise the window the reader selected)

### 3. Raise the window the reader selected (`A_Raise`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Raise the selected window to the top.
- Record it: `workflow_complete` with `node: "A_Raise"`.
- next: → `End_Board` (The reader leaves the board)

### 4. Close the window back to its avatar (`A_Close`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: [x] closes the window back to its avatar.
- Record it: `workflow_complete` with `node: "A_Close"`.
- next: → `A_OfferWayBack` (Leave a reachable way back)

### 5. Resolve the kind's zoom threshold (`A_ResolveThreshold`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Resolve the semantic-zoom threshold for each card's kind: the folio default unless the kind overrides it with a stated because.
- Record it: `workflow_complete` with `node: "A_ResolveThreshold"`.
- next: → `A_SwapToAvatar` (Swap cards below the threshold; leave open windows alone)

## Done — The reader leaves the board (`End_Board`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Leave a reachable way back (`A_OfferWayBack`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Leave the way back reachable: the collapsed window becomes a control in its own position and focus moves to it — left alone, focus lands on <body> and the keyboard position is lost.
- Record it: `workflow_complete` with `node: "A_OfferWayBack"`.
- next: → `GW_Act_Join`

### 7. Swap cards below the threshold; leave open windows alone (`A_SwapToAvatar`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: Cards whose rendered width is strictly below the threshold swap to their avatar — automatic, driven by size.
- Record it: `workflow_complete` with `node: "A_SwapToAvatar"`.
- next: → `A_RenderAvatars` (Render every card as its avatar)
