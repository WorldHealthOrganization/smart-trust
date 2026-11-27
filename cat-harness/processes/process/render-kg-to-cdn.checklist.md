<!-- GENERATED from cat-harness/processes/process/render-kg-to-cdn.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Render a Knowledge Graph to a CDN

> **Generated, and not the authority.** This is `cat-harness/processes/process/render-kg-to-cdn.bpmn` (process `Process_RenderKgToCdn`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Render a Knowledge Graph — the whole of it, or a list of its Subgraphs — for publication to a CDN at a publication root URL, and report a STATUS and a MESSAGE.

## Begin — A Knowledge Graph, a root URL, a CDN target (`Start_Render`)

- Begin here.
- Call `workflow_start` with `process: "Process_RenderKgToCdn"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Resolve` (Determine which CDN, the root URL and the Subgraphs)

### 1. Determine which CDN, the root URL and the Subgraphs (`Task_Resolve`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: Every Subgraph id asked for must be one the declaration lists; none means the whole graph.
- Record it: `workflow_complete` with `node: "Task_Resolve"`.
- next: → `GW_Tool` (Which CDN?)

### Decide — Which CDN? (`GW_Tool`)

- Answered by the target just determined and the Tool registry.
- Call `workflow_complete` with `node: "GW_Tool"` and `outcome` set to the label that holds:
  - «GitHub Pages» → `Call_GitHubPages` (Render and push to GitHub Pages)
  - «another CDN» → `Call_ToolSubprocess` (Render and push with that CDN's own Tool)
  - «no Tool for it» → `Task_Report` (Report the push: status and message)

### 2. Render and push to GitHub Pages (`Call_GitHubPages`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: BOUND BY THE TOOL, so no `calledElement` is written here: the `gh-pages` Tool lists the process this descends into, render-kg-to-github-pages, and that process is held by a layer cat-harness does not need, so naming it would bind upward.
- Record it: `workflow_complete` with `node: "Call_GitHubPages"`.
- next: → `Task_Report` (Report the push: status and message)

### 3. Render and push with that CDN's own Tool (`Call_ToolSubprocess`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: BOUND BY THE TOOL, so no `calledElement` is written here, and only on this branch: the CDN is not GitHub Pages, and its Tool, which a higher layer owns (a Cloudflare publish, for one), lists the process this descends into.
- Record it: `workflow_complete` with `node: "Call_ToolSubprocess"`.
- next: → `Task_Report` (Report the push: status and message)

### 4. Report the push: status and message (`Task_Report`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: The output, on every path: `pushed`, `not-pushed` or `could-not-determine`, and one message — what is live (a commit), at which root URL, and the QA result.
- Record it: `workflow_complete` with `node: "Task_Report"`.
- next: → `GW_Pushed` (Status is pushed?)

### Decide — Status is pushed? (`GW_Pushed`)

- Read off the status just reported.
- Call `workflow_complete` with `node: "GW_Pushed"` and `outcome` set to the label that holds:
  - «yes» → `End_Pushed` (Pushed; the message says what is live)
  - «no, or could not tell» → `End_NotPushed` (Not pushed, or could not tell; the message says why)

## Done — Pushed; the message says what is live (`End_Pushed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Not pushed, or could not tell; the message says why (`End_NotPushed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
