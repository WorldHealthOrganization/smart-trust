<!-- GENERATED from cat-harness/library/processes/subscribe-kg.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Subscribe to an external knowledge graph

> **Generated, and not the authority.** This is `cat-harness/library/processes/subscribe-kg.bpmn` (process `Process_SubscribeKg`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Subscribe a folio or harness to an external knowledge graph pinned to a full commit SHA, then take each chosen part from referenced to materialized through `materialize-remote` and instantiate each chosen harness once its needs are held, so the harness appears in the subscriber's navbar.

## Begin — A substrate is wanted, or a held pin is due to move (`StartEvent_Wanted`)

- Begin here: Two ways in, one path: a first subscription, or an existing one whose pin should move.
- Call `workflow_start` with `process: "Process_SubscribeKg"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Pin` (Name the substrate, pin a full commit SHA)

### 1. Name the substrate, pin a full commit SHA (`Task_Pin`)

- Who: the `Subscriber (the folio's owner)` lane (role `user`).
- Skill: `kg-subscription`.
- What: `owner/repo` and a 40-character commit SHA — never a branch, never an abbreviated SHA.
- Record it: `workflow_complete` with `node: "Task_Pin"`.
- next: → `Task_Validate` (Fetch and validate the pinned declaration)

### 2. Fetch and validate the pinned declaration (`Task_Validate`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`.
- What: A sparse, shallow fetch of the substrate's root declaration only.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `Gateway_Substrate` (A substrate at this pin?)

### Decide — A substrate at this pin? (`Gateway_Substrate`)

- Decided from Task_Validate's result, not by a person.
- Call `workflow_complete` with `node: "Gateway_Substrate"` and `outcome` set to the label that holds:
  - «no, or could not tell» → `Task_Refuse` (Record why it is not a substrate; write no entry)
  - «yes» → `Gateway_Kind` (New subscription, or moving a held pin?)

### 3. Record why it is not a substrate; write no entry (`Task_Refuse`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`.
- What: No subscription entry is written for a repository that is not a substrate.
- Record it: `workflow_complete` with `node: "Task_Refuse"`.
- next: → `EndEvent_Refused` (Not subscribed, and the record says why)

### Decide — New subscription, or moving a held pin? (`Gateway_Kind`)

- Answered by the subscriber's declaration: an entry with this id already exists or it does not.
- Call `workflow_complete` with `node: "Gateway_Kind"` and `outcome` set to the label that holds:
  - «new» → `Task_Record` (Write the entry and cache the declaration)
  - «moving a held pin» → `Gateway_NextHeld_Join`

## Done — Not subscribed, and the record says why (`EndEvent_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Write the entry and cache the declaration (`Task_Record`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`.
- What: The `subscriptions` entry in the subscriber's layer declaration — id, repository, ref, and nothing chosen yet — plus a cached copy of the substrate's declaration at the pin.
- Record it: `workflow_complete` with `node: "Task_Record"`.
- next: → `Task_Review` (Review what the substrate offers)

### Merge — `Gateway_NextHeld_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_NextHeld` (Another held part not yet refreshed?)

### 5. Review what the substrate offers (`Task_Review`)

- Who: the `Subscriber (the folio's owner)` lane (role `user`).
- Skill: `kg-subscription`.
- What: Every subgraph, asset class and harness the cached declaration names, each with its current state — referenced, materialised, unknown, stale, or refused by a gate.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `Task_Choose` (Choose subgraphs, assets, harnesses)

### Decide — Another held part not yet refreshed? (`Gateway_NextHeld`)

- Walks the parts this subscription already holds — every subgraph and asset with a materialisation record — one at a time.
- Call `workflow_complete` with `node: "Gateway_NextHeld"` and `outcome` set to the label that holds:
  - «yes» → `Call_Refresh` (Refresh the held part)
  - «no, all refreshed» → `Task_RePin` (Move the entry's ref and re-cache the declaration)

### 6. Choose subgraphs, assets, harnesses (`Task_Choose`)

- Who: the `Subscriber (the folio's owner)` lane (role `user`).
- Skill: `kg-subscription`.
- What: Written to the entry as `subgraphs`, `assets.policy` (none, on-demand or all) and `harnesses`.
- Record it: `workflow_complete` with `node: "Task_Choose"`.
- next: → `Gateway_NeedsHeld` (Every chosen harness's needs held here?)

### 7. Refresh the held part (`Call_Refresh`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The shared refresh, called, not re-described: what changed upstream, what changed locally, and what to do when both did.
- A subprocess (`Process_RefreshMaterialized`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_NextHeld_Join`

### 8. Move the entry's ref and re-cache the declaration (`Task_RePin`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`.
- What: Only after every held part has been through the refresh.
- Record it: `workflow_complete` with `node: "Task_RePin"`.
- next: → `Task_Review` (Review what the substrate offers)

### Decide — Every chosen harness's needs held here? (`Gateway_NeedsHeld`)

- For each chosen harness, is every layer it `needs` either local to this checkout or itself subscribed?
- Call `workflow_complete` with `node: "Gateway_NeedsHeld"` and `outcome` set to the label that holds:
  - «no — choose again» → `Task_Choose` (Choose subgraphs, assets, harnesses)
  - «yes» → `Gateway_NextPart_Join`

### Merge — `Gateway_NextPart_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_NextPart` (Another chosen subgraph or asset not yet walked?)

### Decide — Another chosen subgraph or asset not yet walked? (`Gateway_NextPart`)

- One part at a time, in the order chosen.
- Call `workflow_complete` with `node: "Gateway_NextPart"` and `outcome` set to the label that holds:
  - «yes» → `Call_Materialize` (Materialise the part)
  - «no, every part walked» → `Gateway_NextHarness_Join`

### 9. Materialise the part (`Call_Materialize`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The ONLY way bytes arrive.
- A subprocess (`Process_MaterializeRemote`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_NextPart_Join`

### Merge — `Gateway_NextHarness_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_NextHarness` (Another chosen harness not yet instantiated?)

### Decide — Another chosen harness not yet instantiated? (`Gateway_NextHarness`)

- Walks the chosen harnesses, whose needs the pre-check already found held.
- Call `workflow_complete` with `node: "Gateway_NextHarness"` and `outcome` set to the label that holds:
  - «yes» → `Task_Instantiate` (Instantiate the harness: write its config)
  - «no, every harness walked» → `Task_Summarise` (Record how each part of the walk ended)

### 10. Instantiate the harness: write its config (`Task_Instantiate`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`, `index-config`.
- What: Write `<harness>.config.json` at the repository root, plus the state directories the harness declares, and — where the checkout has a root `index.config.json` — add the harness to its `instances[]` (kg:instantiate does both), because the index, not the file, is then what reads as INSTANTIATED (index
- Record it: `workflow_complete` with `node: "Task_Instantiate"`.
- next: → `Gateway_NextHarness_Join`

### 11. Record how each part of the walk ended (`Task_Summarise`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `kg-subscription`.
- What: One line per offered part: materialised, referenced by choice, or referenced because a gate refused (and which).
- Record it: `workflow_complete` with `node: "Task_Summarise"`.
- next: → `EndEvent_Done` (Subscribed, every part in a recorded state)

## Done — Subscribed, every part in a recorded state (`EndEvent_Done`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
