<!-- GENERATED from bootstrap/processes/complete-initialization.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Complete initialization

> **Generated, and not the authority.** This is `bootstrap/processes/complete-initialization.bpmn` (process `Process_CompleteInitialization`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A SUB-PROCESS of initialize-harness, called after a harness is installed and also when the location turns out to be a layer instantiating the chosen harness already.

## Begin — A harness is installed here (`Start_CompleteInitialization`)

- Begin here.
- Call `workflow_start` with `process: "Process_CompleteInitialization"` and the subject this run is about; keep the instance id it returns.
- next: → `A_ReadDeclarations` (Read the declaration, and each one it needs)

### 1. Read the declaration, and each one it needs (`A_ReadDeclarations`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `bootstrap-kg-navigation`.
- What: `<name>.json` at the root, then each name in its `needs`, from a sibling checkout `../<name>/<name>.json`.
- Record it: `workflow_complete` with `node: "A_ReadDeclarations"`.
- next: → `A_CheckDocuments` (Check the JSON Schemas and JSON-LD are at their IRIs)

### 2. Check the JSON Schemas and JSON-LD are at their IRIs (`A_CheckDocuments`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `publish-documents`, `initialization-steps`.
- What: THE PRIMARY STEP of initializing a Knowledge Graph harness and so the first one checked once the declarations are read.
- Record it: `workflow_complete` with `node: "A_CheckDocuments"`.
- next: → `A_ListSteps` (List the steps the declarations name)

### 3. List the steps the declarations name (`A_ListSteps`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`.
- What: In the order of the table in `initialization-steps`: declaration, needs, each dependency's instructions, the documents at their IRIs (checked above; the report leads with them), directories, assets, README, README sections, site.
- Record it: `workflow_complete` with `node: "A_ListSteps"`.
- next: → `GW_NextStep_Join`

### Merge — `GW_NextStep_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_NextStep` (A step not yet checked?)

### Decide — A step not yet checked? (`GW_NextStep`)

- Call `workflow_complete` with `node: "GW_NextStep"` and `outcome` set to the label that holds:
  - «yes» → `A_CheckStep` (Check it)
  - «no, all checked» → `A_Report` (Report every step)

### 4. Check it (`A_CheckStep`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`.
- What: Look, do not remember.
- Record it: `workflow_complete` with `node: "A_CheckStep"`.
- next: → `GW_StepState` (What did the check find?)

### 5. Report every step (`A_Report`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `log-message`.
- What: One report, every step in its state, with counts: done, not done, could not determine, stated — led by the primary step, the JSON Schemas and JSON-LD at their IRIs.
- A subprocess (`Process_LogMessage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_AllDone` (Every checkable step done?)

### Decide — What did the check find? (`GW_StepState`)

- Call `workflow_complete` with `node: "GW_StepState"` and `outcome` set to the label that holds:
  - «done» → `A_RecordStep` (Record the step in its state)
  - «not done, and I can do it» → `A_PerformStep` (Do it, then check again)
  - «stated» → `A_FollowStated` (Follow it, and say that you did)
  - «needs a person, or could not determine» → `A_AskPerson` (Ask the person)

### Decide — Every checkable step done? (`GW_AllDone`)

- Call `workflow_complete` with `node: "GW_AllDone"` and `outcome` set to the label that holds:
  - «yes» → `End_Complete` (Every step done)
  - «no» → `End_OpenStepsRecorded` (Open steps recorded, each with what to do)

### 6. Record the step in its state (`A_RecordStep`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`.
- What: The step, the declaration that named it, its state, what was seen, and — for anything not done — exactly what to do next.
- Record it: `workflow_complete` with `node: "A_RecordStep"`.
- next: → `GW_NextStep_Join`

### 7. Do it, then check again (`A_PerformStep`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`, `publish-site`.
- What: Only what the agent, or a tool it has, can do without replacing anything somebody wrote: regenerate a README section, add a missing Pages workflow, switch Pages on with an authenticated `gh`.
- Record it: `workflow_complete` with `node: "A_PerformStep"`.
- next: → `A_CheckStep` (Check it)

### 8. Follow it, and say that you did (`A_FollowStated`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`.
- What: A stated step — a harness's own `docs/bootstrap/initialization.md`.
- Record it: `workflow_complete` with `node: "A_FollowStated"`.
- next: → `A_RecordStep` (Record the step in its state)

### 9. Ask the person (`A_AskPerson`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `human-agent-discussion`, `publish-site`.
- What: A step the agent cannot do or cannot check from here — switching Pages on without a signed-in `gh`, granting a permission, choosing between two ways of fixing a declaration.
- A subprocess (`Process_HumanAgentDiscussion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_RecordStep` (Record the step in its state)

## Done — Every step done (`End_Complete`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Open steps recorded, each with what to do (`End_OpenStepsRecorded`)

- The instance completes here: Not a failure of the harness: the repository is a layer, and the report says what is left and who does it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
