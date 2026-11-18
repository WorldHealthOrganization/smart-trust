<!-- GENERATED from folio-assistant-core/processes/library/deep-document-research.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Deep document research

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/deep-document-research.bpmn` (process `Process_DeepDocumentResearch`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Answer a question from a corpus this folio ALREADY HOLDS, iteratively, stopping on a stated condition.

## Begin — A question about held documents (`Start_Question`)

- Begin here: A question whose evidence is expected to be in this folio's library.
- Call `workflow_start` with `process: "Process_DeepDocumentResearch"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_Held` (Is the corpus there to search?)

### Decide — Is the corpus there to search? (`GW_Held`)

- Computable, and deliberately carries neither `cat-harness.processes:decision` nor `cat-harness.processes:judgement`: whether the library holds entries whose L1 completeness verdict is `met` is a fact about the checkout, so calling it a judgement would be false.
- Call `workflow_complete` with `node: "GW_Held"` and `outcome` set to the label that holds:
  - «held» → `A_Plan` (Filter the corpus, choose the granularity, decompose the question)
  - «not held» → `End_NotHeld` (Not held — a question for library-ingestion)

### 1. Filter the corpus, choose the granularity, decompose the question (`A_Plan`)

- Who: the `Deep researcher` lane (role `deep-researcher`).
- Skill: `deep-document-research`.
- What: The paper's Planner.
- Record it: `workflow_complete` with `node: "A_Plan"`.
- next: → `A_Search` (Retrieve for each sub-question)

## Done — Not held — a question for library-ingestion (`End_NotHeld`)

- The instance completes here: The corpus cannot bear on the question. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Retrieve for each sub-question (`A_Search`)

- Who: the `Deep researcher` lane (role `deep-researcher`).
- Skill: `deep-document-research`.
- What: The paper's Searcher, at the granularity A_Plan chose.
- Record it: `workflow_complete` with `node: "A_Search"`.
- next: → `A_Refine` (Deduplicate, and keep what is actually relevant)

### 3. Deduplicate, and keep what is actually relevant (`A_Refine`)

- Who: the `Deep researcher` lane (role `deep-researcher`).
- Skill: `deep-document-research`.
- What: The paper's Refiner.
- Record it: `workflow_complete` with `node: "A_Refine"`.
- next: → `GW_Sufficient` (Enough, or out of iterations?)

### Decide — Enough, or out of iterations? (`GW_Sufficient`)

- TWO ways out, and both are load-bearing.
- Call `workflow_complete` with `node: "GW_Sufficient"` and `outcome` set to the label that holds:
  - «not yet, and iterations remain» → `A_Plan` (Filter the corpus, choose the granularity, decompose the question)
  - «sufficient» → `A_Report` (Synthesise, cite to a location, and say what was not found)
  - «out of iterations» → `A_Report` (Synthesise, cite to a location, and say what was not found)

### 4. Synthesise, cite to a location, and say what was not found (`A_Report`)

- Who: the `Deep researcher` lane (role `deep-researcher`).
- Skill: `deep-document-research`.
- What: The paper's Reporter, with two obligations it does not state.
- Record it: `workflow_complete` with `node: "A_Report"`.
- next: → `End_Answered` (Answered, with its citations and its gaps)

## Done — Answered, with its citations and its gaps (`End_Answered`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
