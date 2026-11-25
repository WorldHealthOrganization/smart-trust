<!-- GENERATED from cat-harness/library/processes/materialize-remote.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Materialize remote content: the shared subprocess

> **Generated, and not the authority.** This is `cat-harness/library/processes/materialize-remote.bpmn` (process `Process_MaterializeRemote`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One process, called wherever remote content is landed locally: a large remote collection with no restrictions known in context may be materialized locally, size permitting, and bootstrapping a harness is the same shape.

## Begin — Remote content wanted (`StartEvent_Asked`)

- Begin here: The only entry point.
- Call `workflow_start` with `process: "Process_MaterializeRemote"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Purpose` (Declare the purpose: working or archival)

### 1. Declare the purpose: working or archival (`Task_Purpose`)

- Who: the `Contributor (human or agent)` lane (role `user`).
- Skill: `materialize-remote`.
- What: working or archival, and it is asked FIRST because three of the five gates mean different things under each.
- Record it: `workflow_complete` with `node: "Task_Purpose"`.
- next: → `Task_Enumerate` (Enumerate the source descriptor)

### 2. Enumerate the source descriptor (`Task_Enumerate`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Resolve the request against the source's descriptor (one per corpus, in the declared sources/ of the layer that owns it, e.g.
- Record it: `workflow_complete` with `node: "Task_Enumerate"`.
- next: → `Task_Size` (Size the take and the whole)

### 3. Size the take and the whole (`Task_Size`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: What is being taken, and what the whole collection would cost.
- Record it: `workflow_complete` with `node: "Task_Size"`.
- next: → `Task_AnswerGates` (Answer the other four gates)

### 4. Answer the other four gates (`Task_AnswerGates`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Restrictions, copyright, retention and source loss, each answered permitted, refused or unknown.
- Record it: `workflow_complete` with `node: "Task_AnswerGates"`.
- next: → `Gateway_Gates` (All five answered, none refused?)

### Decide — All five answered, none refused? (`Gateway_Gates`)

- Computed by decisions/materialization-gate.dmn (hit policy FIRST) over the five verdicts: size, restrictions, copyright, retention and source loss.
- Computed by the DMN table `decisions/materialization-gate.dmn#Decision_MaterializationGate`: call `workflow_complete` with `node: "Gateway_Gates"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «yes» → `Task_Fetch` (Fetch, and record fixity)
  - «no, or unknown» → `Task_StayRef` (Leave it referenced, record why)

### 5. Fetch, and record fixity (`Task_Fetch`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Fetch, then record sha256 and byte count.
- Record it: `workflow_complete` with `node: "Task_Fetch"`.
- next: → `Task_Declare` (Declare the node materialized)

### 6. Leave it referenced, record why (`Task_StayRef`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: A refusal is not a failure of the process — it is the process working.
- Record it: `workflow_complete` with `node: "Task_StayRef"`.
- next: → `EndEvent_Refused` (Not materialized, and the graph says why)

### 7. Declare the node materialized (`Task_Declare`)

- Who: the `Ingestion engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The node's state moves from `referenced` to `materialized`, carrying purpose, localPath, gates and (archival) fixity.
- Record it: `workflow_complete` with `node: "Task_Declare"`.
- next: → `EndEvent_Done` (Local copy exists, with its five answers)

## Done — Not materialized, and the graph says why (`EndEvent_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Local copy exists, with its five answers (`EndEvent_Done`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
