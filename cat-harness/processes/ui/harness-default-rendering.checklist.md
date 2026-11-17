<!-- GENERATED from cat-harness/processes/ui/harness-default-rendering.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A harness's default rendering

> **Generated, and not the authority.** This is `cat-harness/processes/ui/harness-default-rendering.bpmn` (process `Process_HarnessRendering`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Renders a harness layer as its default interface: its left-hand nav and docs on its own theme's art, and a board of its todos and beans from which a reader reads, reviews and, when a write tool is available, proposes changes into the publication review.

## Begin — Site build starts (`Start_Process_HarnessRendering`)

- Begin here.
- Call `workflow_start` with `process: "Process_HarnessRendering"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Tiles` (Compose each harness's nav and tile)

### 1. Compose each harness's nav and tile (`A_Tiles`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `harness-tiles`.
- What: One themed section per layer in dependency order, from its declaration: its docs, its declared subgraphs (a graph with no viewer is shown inert and labelled), and its theme.
- Record it: `workflow_complete` with `node: "A_Tiles"`.
- next: → `A_Ground` (Resolve each harness's page ground)

### 2. Resolve each harness's page ground (`A_Ground`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `harness-tiles`.
- What: The theme art for that harness's pages, all three crops or none, and the URL scopes that make a page that harness's (`pageGround`).
- Record it: `workflow_complete` with `node: "A_Ground"`.
- next: → `A_Publish` (Publish docs on their theme's art)

### 3. Publish docs on their theme's art (`A_Publish`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `liquid-templates`.
- What: `head_custom.html` sets the ground behind every page of the harness, under two scrims of the page's own colour, so text and links keep the plain page's contrast.
- Record it: `workflow_complete` with `node: "A_Publish"`.
- next: → `A_NodeViews` (Report node-view coverage)

### 4. Report node-view coverage (`A_NodeViews`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-viewer`.
- What: The Tool `node-view-coverage` (`bun run cat node-views:report -- --site <built site>`) counts, per layer, folder and kind, which nodes have an IRI, a `.jsonld`, a page and a row on their folder page, and which folder links are dead or point at the raw repository.
- Record it: `workflow_complete` with `node: "A_NodeViews"`.
- next: → `A_Board` (Draw the board of todos and beans)

### 5. Draw the board of todos and beans (`A_Board`)

- Who: the `Board renderer` lane (role `board-renderer`).
- Skill: `board-windows`.
- What: The todo board mounts inside the landing board, so harness cards and todo stickies share one surface.
- Record it: `workflow_complete` with `node: "A_Board"`.
- next: → `A_Read` (Read a page or a card)

### 6. Read a page or a card (`A_Read`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `content-review`.
- What: The floor of the interface: everything a harness publishes can be read with no account and no tool.
- Record it: `workflow_complete` with `node: "A_Read"`.
- next: → `GW_Write` (Write tool available?)

### Decide — Write tool available? (`GW_Write`)

- Does this session have a write tool (a checkout with git-push, the forge API, or a host connector) and the permission to use it?
- Call `workflow_complete` with `node: "GW_Write"` and `outcome` set to the label that holds:
  - «yes» → `A_Propose` (Propose the change)
  - «no» → `A_Todo` (Leave it as feedback)

### 7. Propose the change (`A_Propose`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `kg-affordances`.
- What: Through whichever write tool the session has.
- Record it: `workflow_complete` with `node: "A_Propose"`.
- next: → `End_Proposed` (Change in the content review)

### 8. Leave it as feedback (`A_Todo`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `content-feedback`.
- What: With no write tool the reader's point is not lost: it is recorded as feedback for someone who can write.
- Record it: `workflow_complete` with `node: "A_Todo"`.
- next: → `End_Noted` (Feedback recorded)

## Done — Change in the content review (`End_Proposed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Feedback recorded (`End_Noted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
