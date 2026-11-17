<!-- GENERATED from cat-harness/processes/kg/mount-subgraph.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Mount a declared subgraph

> **Generated, and not the authority.** This is `cat-harness/processes/kg/mount-subgraph.bpmn` (process `Process_MountSubgraph`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Making a declared subgraph's content available at its declared path, whatever its content source.

## Begin — A step needs a declared subgraph (`Start_SubgraphWanted`)

- Begin here.
- Call `workflow_start` with `process: "Process_MountSubgraph"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ResolveSource` (Resolve the subgraph's content source)

### 1. Resolve the subgraph's content source (`Task_ResolveSource`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `sub-kg-lifecycle`.
- What: `declaredSubgraph(start, id)`: the declaring layer, the entry, and the resolved source with `declaredIn` saying which layer answered.
- Record it: `workflow_complete` with `node: "Task_ResolveSource"`.
- next: → `GW_SourceKind` (Which source kind?)

### Decide — Which source kind? (`GW_SourceKind`)

- The resolved source's `kind`: `directory`, `branch`, `remote`, `npm`, or a kind this diagram has no flow for.
- Call `workflow_complete` with `node: "GW_SourceKind"` and `outcome` set to the label that holds:
  - «directory» → `Task_UseCheckoutPath` (Use the checkout path in place)
  - «branch» → `Task_MountBranchTip` (Mount the branch tip at the declared path)
  - «any other kind» → `Task_RefuseUnknownKind` (Refuse: no flow for this source kind)
  - «remote» → `Task_MountRemotePin` (Mount the remote tree at its pin)
  - «npm» → `Task_RetrieveNpmPackage` (Retrieve the npm package or tarball)

### 2. Use the checkout path in place (`Task_UseCheckoutPath`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `sub-kg-lifecycle`.
- What: A `directory` source IS its declared path.
- Record it: `workflow_complete` with `node: "Task_UseCheckoutPath"`.
- next: → `GW_Join`

### 3. Mount the branch tip at the declared path (`Task_MountBranchTip`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `sub-kg-lifecycle`.
- What: A `branch` source keyed by `tip`: `branch-store mount --id <dir-id>` writes the tip's files at the declared path, so every reader finds the directory where it always was; `push` splices edits back onto the tip, never forcing, and a same-file race is a conflict.
- Record it: `workflow_complete` with `node: "Task_MountBranchTip"`.
- next: → `GW_Join`

### 4. Refuse: no flow for this source kind (`Task_RefuseUnknownKind`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `sub-kg-lifecycle`.
- What: A kind added to the union (a graph database, say) before this diagram and the mount tool learn it.
- Record it: `workflow_complete` with `node: "Task_RefuseUnknownKind"`.
- next: → `End_Refused` (Refused, with the reason)

### 5. Mount the remote tree at its pin (`Task_MountRemotePin`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `remote-mount`.
- What: A `remote` source: another repository's tree at a full 40-character commit.
- Record it: `workflow_complete` with `node: "Task_MountRemotePin"`.
- next: → `GW_Join`

### 6. Retrieve the npm package or tarball (`Task_RetrieveNpmPackage`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `npm-kg-distribution`.
- What: An `npm` source (`schemas/kg/subgraph-source.ts`, `npm-kg-distribution`): an npm package specifier or tarball path (`.tgz`).
- Record it: `workflow_complete` with `node: "Task_RetrieveNpmPackage"`.
- next: → `GW_Join`

### Merge — `GW_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `End_Mounted` (Subgraph content at its declared path)

## Done — Refused, with the reason (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Subgraph content at its declared path (`End_Mounted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
