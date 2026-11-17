<!-- GENERATED from cat-harness/library/processes/methodology-from-source.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Adopt a methodology from a source document

> **Generated, and not the authority.** This is `cat-harness/library/processes/methodology-from-source.bpmn` (process `Process_MethodologyFromSource`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The general process an agent follows when someone shares a paper, book or standard and asks for its method to be used: establish origin and licence, ingest it, render what the method says with what is adopted and refused, place it by ownership, integrate it into the processes that already exist by c

## Begin — Source shared, with an intent (`Start_MFS`)

- Begin here.
- Call `workflow_start` with `process: "Process_MethodologyFromSource"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Origin` (Establish origin and licence)

### 1. Establish origin and licence (`A_Origin`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `adopt-methodology-from-source`.
- What: Authors, publication, identifier, and the licence the source itself states.
- Record it: `workflow_complete` with `node: "A_Origin"`.
- next: → `Call_Ingest` (Ingest into library/)

### 2. Ingest into library/ (`Call_Ingest`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: The harness's basic ingestion flow (`document-ingestion.bpmn`, `Process_Ingestion`): the source is accepted, its metadata goes into the KG, and it is catalogued in library/ — held if materialized, recorded as referenced if not.
- A subprocess (`Process_Ingestion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_RelatedWork` (Related work: find, sort, ask)

### 3. Related work: find, sort, ask (`Call_RelatedWork`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: Search beans, issues and open PRs for work the method touches, categorize and summarize them, and ask the owner whether and how to coordinate.
- A subprocess (`Process_RelatedWork`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Render` (Render the method: adopted vs refused)

### 4. Render the method: adopted vs refused (`A_Render`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `methodology-adoption`.
- What: What the source says, section by section, then a table of what this platform adopts and what it refuses, each with a reason.
- Record it: `workflow_complete` with `node: "A_Render"`.
- next: → `A_Place` (Place by ownership; declare the directory)

### 5. Place by ownership; declare the directory (`A_Place`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `methodology-adoption`.
- What: A domain-neutral method belongs to the harness and a domain method to the folio that owns the domain.
- Record it: `workflow_complete` with `node: "A_Place"`.
- next: → `A_Integrate` (Integrate: call existing processes)

### 6. Integrate: call existing processes (`A_Integrate`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `adopt-methodology-from-source`.
- What: The method's steps become a process whose judgement points call the processes that already exist (adjudication, options analysis, review) by calledElement.
- Record it: `workflow_complete` with `node: "A_Integrate"`.
- next: → `A_Tools` (Every skill and tool used becomes a Tool)

### 7. Every skill and tool used becomes a Tool (`A_Tools`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `adopt-methodology-from-source`.
- What: Each script, CLI or checker the process relies on gets a Tool node (`tools/<id>/<id>.json`) that satisfies a named skill, validated by folio-assistant's ToolDefinitionSchema.
- Record it: `workflow_complete` with `node: "A_Tools"`.
- next: → `O_Review` (Review the adoption)

### 8. Review the adoption (`O_Review`)

- Who: the `Owner` lane (role `user`).
- Record it: `workflow_complete` with `node: "O_Review"`.
- next: → `GW_Decision` (Adopted?)

### Decide — Adopted? (`GW_Decision`)

- The reviewer's decision on the adoption.
- Call `workflow_complete` with `node: "GW_Decision"` and `outcome` set to the label that holds:
  - «yes» → `End_Adopted` (Adopted)
  - «no» → `End_Declined` (Declined, with the reason recorded)
  - «changes» → `A_Render` (Render the method: adopted vs refused)

## Done — Adopted (`End_Adopted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Declined, with the reason recorded (`End_Declined`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
