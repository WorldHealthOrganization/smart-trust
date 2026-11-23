<!-- GENERATED from cat-harness/processes/kg/mount-dependency.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Remote-mount a dependency

> **Generated, and not the authority.** This is `cat-harness/processes/kg/mount-dependency.bpmn` (process `Process_MountDependency`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Laying a harness — and every layer it needs — down from another repository at a pinned commit, as declared directories, with a lock that says exactly what arrived.

## Begin — A layer this checkout does not hold (`Start_LayerNeeded`)

- Begin here.
- Call `workflow_start` with `process: "Process_MountDependency"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DeclareMount` (Declare the mount: harness, repository, pin)

### 1. Declare the mount: harness, repository, pin (`Task_DeclareMount`)

- Who: the `Downstream author` lane (role `author`).
- Skill: `remote-mount`, `index-config`.
- What: A layer `{ name, source: { remote: { repository, ref } } }` in the downstream's root `index.config.json`, written through `writeDeclaredMounts`.
- Record it: `workflow_complete` with `node: "Task_DeclareMount"`.
- next: → `Task_ResolveClosure` (Resolve the closure at the pin)

### 2. Resolve the closure at the pin (`Task_ResolveClosure`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`.
- What: Fetch the pinned tree (shallow, blobless).
- Record it: `workflow_complete` with `node: "Task_ResolveClosure"`.
- next: → `Task_MountInstances` (Mount each layer at its declared path)

### 3. Mount each layer at its declared path (`Task_MountInstances`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`.
- What: Sparse checkout of the declaration and the chosen directories, copied to the mount path (by default the layer's home path, so relative imports and sibling discovery hold).
- Record it: `workflow_complete` with `node: "Task_MountInstances"`.
- next: → `Task_WriteLock` (Write the lock)

### 4. Write the lock (`Task_WriteLock`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`.
- What: `index.lock.json` beside the downstream's `index.config.json` (the legacy `<instance>.mount-lock.json` is still read, and is renamed onto the new name when rewritten; both present is an error): the pins it was written for, each layer's repository, SHA and how the pin was found, each directory's tree
- Record it: `workflow_complete` with `node: "Task_WriteLock"`.
- next: → `Task_RenderAgentSurface` (Re-render the agent surface)

### 5. Re-render the agent surface (`Task_RenderAgentSurface`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`, `agent-memory`.
- What: When the lock changed, the layers an agent's skills and memory are generated from changed with it.
- Record it: `workflow_complete` with `node: "Task_RenderAgentSurface"`.
- next: → `Task_CheckAgainstLock` (Check disk against lock against declaration)

### 6. Check disk against lock against declaration (`Task_CheckAgainstLock`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`, `ci-health`.
- What: `mount:remote:check`, with no network: the lock's pins are the declaration's, and every locked directory is on disk and hashes to its digest.
- Record it: `workflow_complete` with `node: "Task_CheckAgainstLock"`.
- next: → `GW_State` (Every layer mounted or local?)

### Decide — Every layer mounted or local? (`GW_State`)

- Read off the check's aggregate state.
- Call `workflow_complete` with `node: "GW_State"` and `outcome` set to the label that holds:
  - «yes» → `End_Mounted` (The closure is on disk, pinned and locked)
  - «no» → `End_Reported` (Reported loudly: missing / could not determine)

## Done — The closure is on disk, pinned and locked (`End_Mounted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Reported loudly: missing / could not determine (`End_Reported`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
