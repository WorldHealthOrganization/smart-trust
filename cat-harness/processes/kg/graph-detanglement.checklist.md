<!-- GENERATED from cat-harness/processes/kg/graph-detanglement.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A sub-graph wants to leave

> **Generated, and not the authority.** This is `cat-harness/processes/kg/graph-detanglement.bpmn` (process `Process_GraphDetanglement`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Part of a repository wants to leave, for size or a semantic reason: four gated stages measure it out of the graph before anything moves, and an administrator authorises the extraction.

## Begin — Size, or a semantic reason to separate (`Start_Wants`)

- Begin here.
- Call `workflow_start` with `process: "Process_GraphDetanglement"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Brief` (Brief the topic before touching anything)

### 1. Brief the topic before touching anything (`Task_Brief`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `opening-brief`.
- What: What am I doing and why is it worth doing; what do I already know, with each measurement's provenance; how do I plan to do it and WHAT WOULD FALSIFY THE APPROACH.
- Record it: `workflow_complete` with `node: "Task_Brief"`.
- next: → `Task_Declare` (1 · Declare in place (nothing moves))

### 2. 1 · Declare in place (nothing moves) (`Task_Declare`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: A `<name>.json` entry with its `graphs[]` kinds.
- Record it: `workflow_complete` with `node: "Task_Declare"`.
- next: → `GW_Declared` (Declared in place?)

### Decide — Declared in place? (`GW_Declared`)

- Computed, not chosen: decisions/subgraph-declared-gate.dmn (hit policy FIRST) over three inputs — the declaration parsed (`readable`), an entry present for the sub-graph, and every declared path exists.
- Computed by the DMN table `decisions/subgraph-declared-gate.dmn#Decision_SubgraphDeclaredGate`: call `workflow_complete` with `node: "GW_Declared"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «unknown» → `End_Unknown` (UNKNOWN — stop. Not “not yet”, not clean)
  - «declared» → `Task_Measure` (2a · Measure — unassigned column FIRST)
  - «not yet» → `Task_Declare` (1 · Declare in place (nothing moves))

## Done — UNKNOWN — stop. Not “not yet”, not clean (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. 2a · Measure — unassigned column FIRST (`Task_Measure`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: `bun run cat check:partition`.
- Record it: `workflow_complete` with `node: "Task_Measure"`.
- next: → `GW_Detangled` (Detangled?)

### Decide — Detangled? (`GW_Detangled`)

- Computed from `check:partition`'s counts by decisions/detanglement-gate.dmn (hit policy FIRST).
- Computed by the DMN table `decisions/detanglement-gate.dmn#Decision_DetanglementGate`: call `workflow_complete` with `node: "GW_Detangled"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «unknown» → `End_Unknown` (UNKNOWN — stop. Not “not yet”, not clean)
  - «keep detangling» → `Task_Move` (2b · Prune, merge, factor — or the classification is wrong)
  - «detangled» → `Task_Isolate` (3 · Isolate — own declaration, namespace, artefact)

### 4. 2b · Prune, merge, factor — or the classification is wrong (`Task_Move`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: The only four moves.
- Record it: `workflow_complete` with `node: "Task_Move"`.
- next: → `Task_Measure` (2a · Measure — unassigned column FIRST)

### 5. 3 · Isolate — own declaration, namespace, artefact (`Task_Isolate`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: Only once cross-edges measure zero: give the sub-graph its own declaration, its own namespace and its own published artefact, as bootstrap/ has (its own declaration, bs: namespace and graph document).
- Record it: `workflow_complete` with `node: "Task_Isolate"`.
- next: → `GW_Isolated` (Stands alone?)

### Decide — Stands alone? (`GW_Isolated`)

- Computed by decisions/isolation-gate.dmn (hit policy FIRST) over three inputs: its own declaration with paths relative to itself, its own namespace with every minted term defined, and a published artefact of its own.
- Computed by the DMN table `decisions/isolation-gate.dmn#Decision_IsolationGate`: call `workflow_complete` with `node: "GW_Isolated"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «not yet» → `Task_Isolate` (3 · Isolate — own declaration, namespace, artefact)
  - «isolated» → `Task_Propose` (Report what would move — sizes, and what breaks)

### 6. Report what would move — sizes, and what breaks (`Task_Propose`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `deletion-requires-confirmation`.
- What: The agent reports and waits: what would move, how large, what in the parent breaks, and the rollback.
- Shared step `GT_ReportWhatMoves`.
- Record it: `workflow_complete` with `node: "Task_Propose"`.
- next: → `Task_Authorise` (Authorise the extraction)

### 7. Authorise the extraction (`Task_Authorise`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: The one step no package may relax.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Extract` (4 · Extract — a directory move, not a file-by-file sift), → `End_Declined` (Stays where it is — declared, detangled, isolated)

### 8. 4 · Extract — a directory move, not a file-by-file sift (`Task_Extract`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `graph-detanglement`.
- What: Only once edges are zero and the declaration stands alone: move the sub-graph out as one directory move, not a file-by-file sift.
- Record it: `workflow_complete` with `node: "Task_Extract"`.
- next: → `End_Extracted` (Extracted)

## Done — Stays where it is — declared, detangled, isolated (`End_Declined`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Extracted (`End_Extracted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
