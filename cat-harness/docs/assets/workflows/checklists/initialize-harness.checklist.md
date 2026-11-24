<!-- GENERATED from bootstrap/processes/initialize-harness.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Initialize a harness

> **Generated, and not the authority.** This is `bootstrap/processes/initialize-harness.bpmn` (process `Process_InitializeHarness`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

THE ONLY PROCESS IN BOOTSTRAP AN ACTOR STARTS.

## Begin — Asked to initialize a harness (`Start_InitializeHarness`)

- Begin here.
- Call `workflow_start` with `process: "Process_InitializeHarness"` and the subject this run is about; keep the instance id it returns.
- next: → `A_DetermineHarness` (Determine which harness, and where)

### 1. Determine which harness, and where (`A_DetermineHarness`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `confirm-harness`.
- What: The candidates are listed and the Requestor is asked, in `discussion`, which asks through `human-agent-discussion`.
- A subprocess (`Process_Discussion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_HarnessChosen` (One harness?)

### Decide — One harness? (`GW_HarnessChosen`)

- Call `workflow_complete` with `node: "GW_HarnessChosen"` and `outcome` set to the label that holds:
  - «none» → `A_LogFailure` (Log the failure)
  - «one» → `A_ReadLocation` (Read what each location already is)

### 2. Log the failure (`A_LogFailure`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `log-message`.
- What: Every failure path passes through here, so "logged as failed" is a step somebody performs rather than an adjective on an end event.
- A subprocess (`Process_LogMessage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Failed` (Failed)

### 3. Read what each location already is (`A_ReadLocation`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `bootstrap-kg-navigation`.
- What: Ask the location, not your memory of it: a Knowledge Graph Data Store that carries a declaration at its root is ALREADY a layer, and it says so itself.
- Record it: `workflow_complete` with `node: "A_ReadLocation"`.
- next: → `GW_AlreadyInitialized` (Already initialized?)

## Done — Failed (`End_Failed`)

- The instance completes here: Three ways in, and all are logged rather than retried: no harness was chosen, a location is already a layer instantiating something else, or the instructions were not at the predetermined spot. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Already initialized? (`GW_AlreadyInitialized`)

- Three answers, not two.
- Call `workflow_complete` with `node: "GW_AlreadyInitialized"` and `outcome` set to the label that holds:
  - «already, as something else» → `A_LogFailure` (Log the failure)
  - «already, as the chosen harness» → `A_CompleteInitialization` (Make sure every step is done)
  - «not yet» → `A_ReadDeclaration` (Read the harness's declaration and instructions)

### 4. Make sure every step is done (`A_CompleteInitialization`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `initialization-steps`.
- What: Following a harness's instructions once is not the same as every step being done.
- A subprocess (`Process_CompleteInitialization`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Installed` (Harness installed, every step checked)

### 5. Read the harness's declaration and instructions (`A_ReadDeclaration`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `bootstrap-kg-navigation`.
- What: Performed against the data store — a git repository, through the git CLI or a forge API.
- Record it: `workflow_complete` with `node: "A_ReadDeclaration"`.
- next: → `GW_InstructionsFound` (Instructions there?)

## Done — Harness installed, every step checked (`End_Installed`)

- The instance completes here: Installed, and every step the declarations name reported in its state. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Instructions there? (`GW_InstructionsFound`)

- Call `workflow_complete` with `node: "GW_InstructionsFound"` and `outcome` set to the label that holds:
  - «no» → `A_LogFailure` (Log the failure)
  - «yes» → `A_LogInstallStart` (Log the start of the install)

### 6. Log the start of the install (`A_LogInstallStart`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `log-message`.
- What: REQUIRED logging, which is what drawing the call says.
- A subprocess (`Process_LogMessage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Install` (Follow them, at each location)

### 7. Follow them, at each location (`A_Install`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `bootstrap-kg-navigation`.
- What: The instructions belong to the harness being installed, not to bootstrap — bootstrap does not know what any Harness above it requires, and does not need to.
- Record it: `workflow_complete` with `node: "A_Install"`.
- next: → `A_WriteRootReadme` (Write the root README, if it is not there)

### 8. Write the root README, if it is not there (`A_WriteRootReadme`)

- Who: the `Bootstrapping Agent` lane (role `bootstrapping-agent`).
- Skill: `root-readme`.
- What: The repository now IS a layer instantiating a harness, and nothing at its root says so.
- Record it: `workflow_complete` with `node: "A_WriteRootReadme"`.
- next: → `A_CompleteInitialization` (Make sure every step is done)
