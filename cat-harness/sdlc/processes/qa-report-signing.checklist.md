<!-- GENERATED from cat-harness/sdlc/processes/qa-report-signing.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — QA report signing

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/qa-report-signing.bpmn` (process `Process_QaReportSigning`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Attesting a QA report: build the test run, work out what the performer can actually reach, and sign — over the API where that is available, or as release authority where it is not.

## Begin — QA report ready to attest (`Start_ReportReady`)

- Begin here.
- Call `workflow_start` with `process: "Process_QaReportSigning"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_BuildRun` (Build the test run)

### 1. Build the test run (`Task_BuildRun`)

- Who: the `Validation and QA (mechanical + agents)` lane (role `validation-pipeline`).
- Skill: `qa-report-signing`, `content-test`.
- What: Assemble the run record the signature will cover: the data hash and the process hash, each all-or-nothing.
- Record it: `workflow_complete` with `node: "Task_BuildRun"`.
- next: → `Task_ResolveReach` (Resolve the performer's reach)

### 2. Resolve the performer's reach (`Task_ResolveReach`)

- Who: the `Validation and QA (mechanical + agents)` lane (role `validation-pipeline`).
- Skill: `qa-report-signing`.
- What: Compute the two facts the gateway reads: effectiveReach(deployment, actor) from schemas/process/actor-reach.ts, and whether the signing-api capability is configured.
- Record it: `workflow_complete` with `node: "Task_ResolveReach"`.
- next: → `Gateway_SigningRoute` (Which signing route?)

### Decide — Which signing route? (`Gateway_SigningRoute`)

- Answered by the performer's resolved reach (effectiveReach plus the signing-api probe).
- Computed by the DMN table `decisions/signing-route.dmn#Decision_SigningRoute`: call `workflow_complete` with `node: "Gateway_SigningRoute"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «api» → `Task_ApiSign` (Sign over the API)
  - «human» → `Task_HumanSign` (Sign as release authority)

### 3. Sign over the API (`Task_ApiSign`)

- Who: the `Attestation service (API)` lane (role `attestation-service`).
- Skill: `qa-report-signing`.
- What: The attestation service signs the run hashes.
- Record it: `workflow_complete` with `node: "Task_ApiSign"`.
- next: → `Gateway_Signed` (Signed)

### 4. Sign as release authority (`Task_HumanSign`)

- Who: the `Human signer` lane (role `publication-manager`).
- Skill: `qa-report-signing`.
- What: A person attests the run hashes out of band.
- Record it: `workflow_complete` with `node: "Task_HumanSign"`.
- next: → `Gateway_Signed` (Signed)

### Merge — Signed (`Gateway_Signed`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_RecordAttestation` (Record which route signed it)

### 5. Record which route signed it (`Task_RecordAttestation`)

- Who: the `Validation and QA (mechanical + agents)` lane (role `validation-pipeline`).
- Skill: `qa-report-signing`.
- What: The attestation records the route, not only the signature.
- Record it: `workflow_complete` with `node: "Task_RecordAttestation"`.
- next: → `Task_StoreSigned` (Store the signed report on qa-reports)

### 6. Store the signed report on qa-reports (`Task_StoreSigned`)

- Who: the `Validation and QA (mechanical + agents)` lane (role `validation-pipeline`).
- Skill: `qa-reports`.
- What: The signed report, its signature and the route that produced it are written TOGETHER into the `qa-reports` entry keyed by the commit the report judged (`main/<sha>/` or `pr/<n>/<sha>/`), through `scripts/qa-store.ts` — never committed to main and never pushed by hand (arc `3fva`, owner ruling D1).
- Record it: `workflow_complete` with `node: "Task_StoreSigned"`.
- next: → `End_Signed` (Report attested and stored)

## Done — Report attested and stored (`End_Signed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
