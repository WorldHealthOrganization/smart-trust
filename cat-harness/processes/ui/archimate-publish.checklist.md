<!-- GENERATED from cat-harness/processes/ui/archimate-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Publish an ArchiMate model — every picture derived from it

> **Generated, and not the authority.** This is `cat-harness/processes/ui/archimate-publish.bpmn` (process `Process_ArchimatePublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

An ArchiMate model is authored in Archi and committed; everything a reader sees is derived from it by three mechanical Tools, in order, in the pipeline lane: `archimate-check` (it parses and resolves), `archimate-metamodel` (the element types and relationship patterns it uses, each checked against A

## Begin — Model committed from Archi (`Start_Process_ArchimatePublish`)

- Begin here.
- Call `workflow_start` with `process: "Process_ArchimatePublish"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Check` (Check the model parses and resolves)

### 1. Check the model parses and resolves (`A_Check`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `archimate-models`.
- What: Tool `archimate-check` (`archimate:validate`, on the layer root): every model the config names is held and parses, every box in every view draws an element the model holds, every relationship's ends are in the model.
- Record it: `workflow_complete` with `node: "A_Check"`.
- next: → `A_Metamodel` (Derive the metamodel in use)

### 2. Derive the metamodel in use (`A_Metamodel`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `archimate-models`.
- What: Tool `archimate-metamodel` (`archimate:metamodel --check`, on the layer root): the element types the model uses and every (source type, relationship, target type) pattern, each checked against ArchiMate's relationship table.
- Record it: `workflow_complete` with `node: "A_Metamodel"`.
- next: → `GW_Allowed` (Every relationship allowed by ArchiMate?)

### Decide — Every relationship allowed by ArchiMate? (`GW_Allowed`)

- Answered by the metamodel step's exit code: does every relationship follow a pattern ArchiMate's relationship table allows?
- Call `workflow_complete` with `node: "GW_Allowed"` and `outcome` set to the label that holds:
  - «yes» → `A_Pages` (Write pages, drawings and the metamodel page)
  - «no» → `A_FixModel` (Fix the relationship in Archi)

### 3. Write pages, drawings and the metamodel page (`A_Pages`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `archimate-models`.
- What: Tool `archimate-pages` (`archimate:pages --out`, into the site being built): a JSON-LD node and a thin page for every view, element and relationship, every view drawn as SVG, and each model's "Metamodel in use" page with its diagram laid out from DOT by Graphviz in WebAssembly, plus the same diagram
- Record it: `workflow_complete` with `node: "A_Pages"`.
- next: → `End_Process_ArchimatePublish` (Model published; every picture derived)

### 4. Fix the relationship in Archi (`A_FixModel`)

- Who: the `Model author` lane (role `author`).
- Skill: `archimate-models`.
- What: The author changes the relationship's type or ends in Archi and commits the model again.
- Record it: `workflow_complete` with `node: "A_FixModel"`.
- next: → `A_Check` (Check the model parses and resolves)

## Done — Model published; every picture derived (`End_Process_ArchimatePublish`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
