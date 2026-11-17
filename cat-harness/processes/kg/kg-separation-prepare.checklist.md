<!-- GENERATED from cat-harness/processes/kg/kg-separation-prepare.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Prepare a graph to stand alone

> **Generated, and not the authority.** This is `cat-harness/processes/kg/kg-separation-prepare.bpmn` (process `Process_KgSeparationPrepare`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Gets a detangled graph ready to stand alone: its identity, the harness output about it moved to the host, its content split from its tools, its publication planned, and a standalone rehearsal.

## Begin — A detangled, isolated graph (`Start_Prepare`)

- Begin here.
- Call `workflow_start` with `process: "Process_KgSeparationPrepare"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Identity` (Identity: version, iriBase, nodeSchemas)

### 1. Identity: version, iriBase, nodeSchemas (`Task_Identity`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-separation`.
- What: The declaration carries name, version, iriBase, needs and nodeSchemas.
- Record it: `workflow_complete` with `node: "Task_Identity"`.
- next: → `Task_Hosted` (Move harness output about it to the host)

### 2. Move harness output about it to the host (`Task_Hosted`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-separation`.
- What: QA verdicts, translation templates, the exported graph and the glossary ledger are harness output ABOUT the graph: they live with the harness (kgQaHomeFor, translationsHomeFor).
- Record it: `workflow_complete` with `node: "Task_Hosted"`.
- next: → `Task_Split` (Split content from tools)

### 3. Split content from tools (`Task_Split`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-separation`.
- What: Create <name>-tools as a sibling directory and move the code: the Zod source, the generators, the README and diagram writers, the content checks.
- Record it: `workflow_complete` with `node: "Task_Split"`.
- next: → `GW_Closed` (Tools closed, content code-free?)

### Decide — Tools closed, content code-free? (`GW_Closed`)

- Decided by commands, not judgement: `check:tools-closure` (no import leaves the tools directory or names an undeclared package), the content's no-code test, and generated files byte-identical before and after the move.
- Call `workflow_complete` with `node: "GW_Closed"` and `outcome` set to the label that holds:
  - «leaks or stale» → `Task_Split` (Split content from tools)
  - «closed» → `Task_Plan` (Plan publication)

### 4. Plan publication (`Task_Plan`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `instance-publication`.
- What: Every identifier the content mints is a file some step publishes: /v<major>/, for what programs read and pages people read alike; the exact release is the pin's.
- Record it: `workflow_complete` with `node: "Task_Plan"`.
- next: → `GW_Ids` (Every identifier its file's path?)

### Decide — Every identifier its file's path? (`GW_Ids`)

- Decided by `check:node-iris`: a published node's own identifier ($id or @id) under the release address must be its file's path.
- Call `workflow_complete` with `node: "GW_Ids"` and `outcome` set to the label that holds:
  - «mismatch» → `Task_Plan` (Plan publication)
  - «every one matches» → `Task_Rehearse` (Rehearse standalone)

### 5. Rehearse standalone (`Task_Rehearse`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-separation`.
- What: Copy the content and the tools alone into a temporary directory, with nothing else on the path, and run the tools' checks there.
- Record it: `workflow_complete` with `node: "Task_Rehearse"`.
- next: → `GW_Alone` (Green alone?)

### Decide — Green alone? (`GW_Alone`)

- Green with nothing else present goes on.
- Call `workflow_complete` with `node: "GW_Alone"` and `outcome` set to the label that holds:
  - «green» → `End_Ready` (Green alone)
  - «red: an unseen edge» → `End_RedEdge` (Red: an unseen edge)
  - «could not run» → `End_PrepareUnknown` (Could not run)

## Done — Green alone (`End_Ready`)

- The instance completes here: The graph builds and checks green with nothing of its parent mounted. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Red: an unseen edge (`End_RedEdge`)

- The instance completes here: The rehearsal found an edge the measurement missed. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Could not run (`End_PrepareUnknown`)

- The instance completes here: The rehearsal could not run, so nobody can tell. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
