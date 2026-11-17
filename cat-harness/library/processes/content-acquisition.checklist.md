<!-- GENERATED from cat-harness/library/processes/content-acquisition.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Content acquisition

> **Generated, and not the authority.** This is `cat-harness/library/processes/content-acquisition.bpmn` (process `Process_ContentAcquisition`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a resource gets into the graph in the first place.

## Begin — A resource is needed, or one is offered (`Start_Acquire`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentAcquisition"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_Offered` (Offered already?)

### Decide — Offered already? (`GW_Offered`)

- Did the resource arrive with the request?
- Call `workflow_complete` with `node: "GW_Offered"` and `outcome` set to the label that holds:
  - «no» → `A_Ask` (Ask for a link or a description)
  - «yes» → `A_Accept` (Accept it, and record where it came from)

### 1. Ask for a link or a description (`A_Ask`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `content-acquisition`.
- What: Both forms, named together.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `P_Respond` (Give a link, a description, or neither)

### 2. Accept it, and record where it came from (`A_Accept`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `content-acquisition`.
- What: Both branches land here.
- Record it: `workflow_complete` with `node: "A_Accept"`.
- next: → `A_Route` (Route it, and watch the queue)

### 3. Give a link, a description, or neither (`P_Respond`)

- Who: the `Contributor` lane (role `user`).
- What: "Or neither" is a real outcome, not a failure.
- Record it: `workflow_complete` with `node: "P_Respond"`.
- next: → `A_PointToUpload` (Point at the upload target)

### 4. Route it, and watch the queue (`A_Route`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `uploads-watch`, `library-ingestion`.
- What: A file goes to ingestion; a link or a description goes to whatever will resolve it.
- Record it: `workflow_complete` with `node: "A_Route"`.
- next: → `End_Acquired` (In the queue, or recorded in the conversation)

### 5. Point at the upload target (`A_PointToUpload`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `content-acquisition`.
- What: Composed from the declaration by the `upload-url` Tool, never written by hand: the queue is declared with INSTANCE scope, and a forge URL needs the path relative to the REPOSITORY.
- Record it: `workflow_complete` with `node: "A_PointToUpload"`.
- next: → `P_Upload` (Drop the file in the queue)

## Done — In the queue, or recorded in the conversation (`End_Acquired`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Drop the file in the queue (`P_Upload`)

- Who: the `Contributor` lane (role `user`).
- What: Through the forge's upload form, a commit, or any other route that lands the file in the declared queue.
- Record it: `workflow_complete` with `node: "P_Upload"`.
- next: → `A_Accept` (Accept it, and record where it came from)
