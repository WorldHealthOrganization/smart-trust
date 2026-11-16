<!-- GENERATED from cat-harness/processes/kg/kg-to-portal.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — KG to public portal

> **Generated, and not the authority.** This is `cat-harness/processes/kg/kg-to-portal.bpmn` (process `Process_KgToPortal`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a knowledge graph reaches a public portal this repository does not run: select, serialize, package, sign, distribute, and verify on the portal's side.

## Begin — A graph exists, and a portal needs it (`Start_Graph`)

- Begin here.
- Call `workflow_start` with `process: "Process_KgToPortal"` and the subject this run is about; keep the instance id it returns.
- next: → `D_Constraints` (State the constraints, with denominators)

### 1. State the constraints, with denominators (`D_Constraints`)

- Who: the `Deployment owner` lane (role `publication-manager`).
- Skill: `kg-to-portal`.
- What: Money, network traffic, graph size, latency.
- Record it: `workflow_complete` with `node: "D_Constraints"`.
- next: → `E_Scope` (Decide what may leave the repository)

### 2. Decide what may leave the repository (`E_Scope`)

- Who: the `Editorial` lane (role `editor`).
- Skill: `kg-to-portal`.
- What: EDITORIAL, and it is stage 1 rather than a filter bolted to the exporter.
- Record it: `workflow_complete` with `node: "E_Scope"`.
- next: → `A_Select` (Cut the subgraph that leaves)

### 3. Cut the subgraph that leaves (`A_Select`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-to-portal`.
- What: Apply the editorial scope mechanically and report what it removed.
- Record it: `workflow_complete` with `node: "A_Select"`.
- next: → `A_Serialize` (Serialize to JSON-LD)

### 4. Serialize to JSON-LD (`A_Serialize`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-export`.
- What: kg-export, already built and host-agnostic by design.
- Record it: `workflow_complete` with `node: "A_Serialize"`.
- next: → `A_Package` (Package with digests)

### 5. Package with digests (`A_Package`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-to-portal`.
- What: The serialization alone is not a package.
- Record it: `workflow_complete` with `node: "A_Package"`.
- next: → `GW_Budget` (Within the stated budget?)

### Decide — Within the stated budget? (`GW_Budget`)

- Measured against D_Constraints' numbers, not against a feeling.
- Call `workflow_complete` with `node: "GW_Budget"` and `outcome` set to the label that holds:
  - «within budget» → `S_Sign` (Sign the package and/or each asset)
  - «over budget» → `End_OverBudget` (Refused — over budget)

### 6. Sign the package and/or each asset (`S_Sign`)

- Who: the `Attestation (GDHCN / WHO SMART Trust)` lane (role `attestation-service`).
- Skill: `kg-to-portal`.
- What: THE TRUST ANCHOR IS GDHCN, SPECIFIED BY THE WHO SMART TRUST IG.
- Record it: `workflow_complete` with `node: "S_Sign"`.
- next: → `E_HumanEyes` (Human eyes on the rendered artefact)

## Done — Refused — over budget (`End_OverBudget`)

- The instance completes here: A real end, not a warning. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Human eyes on the rendered artefact (`E_HumanEyes`)

- Who: the `Editorial` lane (role `editor`).
- Skill: `continual-progress`.
- What: Easy to drop because merging to main looks like an approval.
- Record it: `workflow_complete` with `node: "E_HumanEyes"`.
- next: → `GW_Transport` (Which transport? (UNDETERMINED))

### Decide — Which transport? (UNDETERMINED) (`GW_Transport`)

- THIS GATEWAY HAS NO DEFAULT BRANCH: the ingestion method is not determined.
- Call `workflow_complete` with `node: "GW_Transport"` and `outcome` set to the label that holds:
  - «a transport was chosen» → `A_Distribute` (Publish to the origin (a cache may front it))
  - «still undetermined» → `D_Undetermined` (Record the decision as still open)

### 8. Publish to the origin (a cache may front it) (`A_Distribute`)

- Who: the `Publish target` lane (role `publish-target`).
- Skill: `kg-to-portal`.
- What: Reach host behaviour through publication.host, never by assuming GitHub Pages' behaviour — Pages CANNOT serve application/ld+json and a local server can.
- Record it: `workflow_complete` with `node: "A_Distribute"`.
- next: → `P_Verify` (Verify what arrived against what was signed)

### 9. Record the decision as still open (`D_Undetermined`)

- Who: the `Deployment owner` lane (role `publication-manager`).
- Skill: `decision-audit`.
- What: An undetermined decision is DATA, not silence.
- Record it: `workflow_complete` with `node: "D_Undetermined"`.
- next: → `End_Blocked` (Open — awaiting a deployment decision)

### 10. Verify what arrived against what was signed (`P_Verify`)

- Who: the `Portal (external consumer)` lane (role `external-registry`).
- Skill: `kg-to-portal`.
- What: Against a GDHCN DID trustlist, which means the verifier needs THE NETWORK and not only the bytes — the key is resolved from the trustlist rather than read out of the package.
- Record it: `workflow_complete` with `node: "P_Verify"`.
- next: → `GW_Verified` (Verifies?)

## Done — Open — awaiting a deployment decision (`End_Blocked`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Verifies? (`GW_Verified`)

- Answered by verifying what arrived against what was signed.
- Call `workflow_complete` with `node: "GW_Verified"` and `outcome` set to the label that holds:
  - «signature and digests match» → `End_Served` (Readers have the bytes)
  - «mismatch» → `End_Rejected` (Rejected — serve the previous version)

## Done — Readers have the bytes (`End_Served`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Rejected — serve the previous version (`End_Rejected`)

- The instance completes here: Serving the LAST good version rather than nothing: a portal that goes blank on a failed verification has turned an integrity problem into an outage, and a reader cannot tell the two apart. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
