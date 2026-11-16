<!-- GENERATED from bootstrap/processes/discussion.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Determine the harness and repositories

> **Generated, and not the authority.** This is `bootstrap/processes/discussion.bpmn` (process `Process_Discussion`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A SUB-PROCESS of initialize-harness, never an entry point.

## Begin — Which harness, and where, is not known (`Start_Discussion`)

- Begin here.
- Call `workflow_start` with `process: "Process_Discussion"` and the subject this run is about; keep the instance id it returns.
- next: → `A_DetermineWhere` (Determine where you are: process, roles, context)

### 1. Determine where you are: process, roles, context (`A_DetermineWhere`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `discussion`, `human-agent-discussion`.
- What: Before narrowing, say where this is happening, in the words you will use in the question.
- Record it: `workflow_complete` with `node: "A_DetermineWhere"`.
- next: → `A_ListHarnesses` (List the harnesses this could be)

### 2. List the harnesses this could be (`A_ListHarnesses`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `confirm-harness`.
- What: Zero or more.
- Record it: `workflow_complete` with `node: "A_ListHarnesses"`.
- next: → `A_ListLocations` (List the locations this could install to)

### 3. List the locations this could install to (`A_ListLocations`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `confirm-harness`.
- What: Zero or more.
- Record it: `workflow_complete` with `node: "A_ListLocations"`.
- next: → `A_AskRequestor` (Ask which harness, and where)

### 4. Ask which harness, and where (`A_AskRequestor`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `confirm-harness`, `human-agent-discussion`.
- What: The candidates go in as the options; the recommendation may name one; the default is NONE.
- A subprocess (`Process_HumanAgentDiscussion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `G_Settled` (One harness, and where it goes?)

### Decide — One harness, and where it goes? (`G_Settled`)

- At most one harness: a list of two is not an answer, and the Bootstrapping Agent may not break the tie.
- Call `workflow_complete` with `node: "G_Settled"` and `outcome` set to the label that holds:
  - «yes» → `A_RecordDetermination` (Record the determination)
  - «no, or still open» → `A_RecordUnsettled` (Record what is still open)

### 5. Record the determination (`A_RecordDetermination`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `discussion`.
- What: Writes a document conforming to `discussion.output.schema.json`: the harness, the repositories as read-from / written-to pairs, `determinedBy: asked`, and who answered.
- Record it: `workflow_complete` with `node: "A_RecordDetermination"`.
- next: → `End_Settled` (Harness and repositories determined)

### 6. Record what is still open (`A_RecordUnsettled`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `discussion`.
- What: `outcome: unsettled` with what was asked and what is still open, so the next actor resumes rather than restarts.
- Record it: `workflow_complete` with `node: "A_RecordUnsettled"`.
- next: → `End_Unsettled` (Still open, and said so)

## Done — Harness and repositories determined (`End_Settled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Still open, and said so (`End_Unsettled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
