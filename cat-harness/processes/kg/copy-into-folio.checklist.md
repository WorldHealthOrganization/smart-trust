<!-- GENERATED from cat-harness/processes/kg/copy-into-folio.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Copy a knowledge-graph asset into a folio

> **Generated, and not the authority.** This is `cat-harness/processes/kg/copy-into-folio.bpmn` (process `Process_CopyIntoFolio`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Taking an asset from an upstream knowledge graph into your own folio so you can edit it, comment on it or raise todos against it — without touching the upstream source and without losing where it came from.

## Begin — Author wants to adapt a KG asset in their folio (`Start_WantCopy`)

- Begin here: Triggered when a reader browsing a knowledge graph wants to take an asset into their own folio to edit it, annotate it or raise todos against it.
- Call `workflow_start` with `process: "Process_CopyIntoFolio"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ChooseAsset` (Select upstream asset and target folio)

### 1. Select upstream asset and target folio (`Task_ChooseAsset`)

- Who: the `Folio author` lane (role `author`).
- Skill: `kg-affordances`.
- What: Name the upstream layer (`<owner>/<repo>`), the asset's declared path in that layer, the commit `ref` (when pinned), and the target folio declaration that will receive the copy.
- Record it: `workflow_complete` with `node: "Task_ChooseAsset"`.
- next: → `Task_ProbeWriteCapability` (Probe write capability)

### 2. Probe write capability (`Task_ProbeWriteCapability`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-affordances`.
- What: Check whether the session holds at least one of the three write capabilities (`git-push`, `github-api`, or `github-connector` under `scenarios/capabilities/`).
- Record it: `workflow_complete` with `node: "Task_ProbeWriteCapability"`.
- next: → `GW_CanWrite` (Write capability available?)

### Decide — Write capability available? (`GW_CanWrite`)

- Decided from the capability probe over `git-push`, `github-api` and `github-connector`.
- Call `workflow_complete` with `node: "GW_CanWrite"` and `outcome` set to the label that holds:
  - «yes — git-push, github-api or github-connector» → `Task_ReadUpstreamAsset` (Read the upstream asset (no writes))
  - «no — read-only session» → `Task_InspectReadOnly` (Browse in place, emit a KgAsset snippet)

### 3. Read the upstream asset (no writes) (`Task_ReadUpstreamAsset`)

- Who: the `Source knowledge graph — read-only` lane (role `corpus`).
- Skill: `kg-affordances`.
- What: Read the asset bytes and its origin coordinates (`instance` as `<owner>/<repo>`, `path` within that instance, and commit `ref`) from the source knowledge graph without modifying anything in the source lane.
- Record it: `workflow_complete` with `node: "Task_ReadUpstreamAsset"`.
- next: → `Task_CopyAndDeclareAsset` (Copy asset into target folio and declare in assets[])

### 4. Browse in place, emit a KgAsset snippet (`Task_InspectReadOnly`)

- Who: the `Folio author` lane (role `author`).
- Skill: `kg-affordances`.
- What: Clean degradation when no write capability (`git-push`, `github-api`, `github-connector`) is present: inspect the asset in place through the zero-write `browse` affordance and output the ready-to-paste `KgAsset` entry (with `source: { instance, path, ref }` populated) so the author can apply it wher
- Record it: `workflow_complete` with `node: "Task_InspectReadOnly"`.
- next: → `End_ReadOnlyDegraded` (Inspected in place; snippet emitted without write)

### 5. Copy asset into target folio and declare in assets[] (`Task_CopyAndDeclareAsset`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-affordances`, `directory-conventions`.
- What: Write the asset bytes into a declared path inside the target folio and add the `KgAsset` entry to the target folio's `<name>.json` `assets[]` list (`directory-conventions`).
- Record it: `workflow_complete` with `node: "Task_CopyAndDeclareAsset"`.
- next: → `Task_StampAssetSource` (Stamp the asset's source)

## Done — Inspected in place; snippet emitted without write (`End_ReadOnlyDegraded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Stamp the asset's source (`Task_StampAssetSource`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `kg-affordances`, `directory-conventions`.
- What: Populate `source: { instance, path, ref }` (`AssetSourceSchema` in `schemas/kg/kg-node.ts`) on the new `KgAsset` entry in the same change.
- Record it: `workflow_complete` with `node: "Task_StampAssetSource"`.
- next: → `Task_ValidateDeclaredAsset` (Validate the asset and provenance)

### 7. Validate the asset and provenance (`Task_ValidateDeclaredAsset`)

- Who: the `Validation pipeline` lane (role `validation-pipeline`).
- Skill: `kg-affordances`.
- What: Run `bun run cat check:declaration-resolution` (`check:declared-assets`) to verify that the copied asset exists at its declared path, its `KgAsset.source` conforms to `AssetSourceSchema`, and the upstream source graph remains untouched.
- Record it: `workflow_complete` with `node: "Task_ValidateDeclaredAsset"`.
- next: → `Task_WorkOnCopy` (Edit, comment or raise todos on the folio's copy)

### 8. Edit, comment or raise todos on the folio's copy (`Task_WorkOnCopy`)

- Who: the `Folio author` lane (role `author`).
- Skill: `kg-affordances`.
- What: The copied asset is now writable content of the target folio with recorded upstream provenance (`KgAsset.source`).
- Record it: `workflow_complete` with `node: "Task_WorkOnCopy"`.
- next: → `End_CopiedAndEditable` (Working copy in folio with KgAsset.source stamped)

## Done — Working copy in folio with KgAsset.source stamped (`End_CopiedAndEditable`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
