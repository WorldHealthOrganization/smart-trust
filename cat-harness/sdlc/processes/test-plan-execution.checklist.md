<!-- GENERATED from cat-harness/sdlc/processes/test-plan-execution.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Test-plan execution

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/test-plan-execution.bpmn` (process `Process_TestPlanExecution`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Executing a `test-plan/v1` against a system under test and taking the result to a certification decision: requested by (or for) the system, run by a tester, re-executed in sample by an untainted checker, decided by a certifier through the plan's exit-criteria table, and signed through `qa-report-sig

## Begin — Certification wanted against plan P (`Start_Request`)

- Begin here.
- Call `workflow_start` with `process: "Process_TestPlanExecution"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Requester / system under test` lane (role `test-requester`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `A_Request` (Request certification of the system against plan P)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Request certification of the system against plan P (`A_Request`)

- Who: the `Requester / system under test` lane (role `test-requester`).
- Skill: `test-plan-execution`.
- What: Name the plan by id AND version, and the system under test by actor id.
- Record it: `workflow_complete` with `node: "A_Request"`.
- next: → `A_ResolvePlan` (Resolve the plan)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Resolve the plan (`A_ResolvePlan`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-plan-execution`.
- What: The plan parses, names at least one `req:` requirement, its `exitCriteria` resolves to a decision in a `.dmn` that exists, and its `scope.kind` is the system's facet kind.
- Record it: `workflow_complete` with `node: "A_ResolvePlan"`.
- next: → `A_BindData` (Bind the test data)

### 4. Bind the test data (`A_BindData`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-plan-execution`.
- What: Per bean `vm6m`: a fixed set is a committed path and counts as evidence only once reviewed; a generated set is template + params + seed and is never materialised.
- Record it: `workflow_complete` with `node: "A_BindData"`.
- next: → `A_Execute` (Execute every case, or skip it with a reason)

### 5. Execute every case, or skip it with a reason (`A_Execute`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-plan-execution`, `test-engineer`.
- What: Every case in dependency order.
- Record it: `workflow_complete` with `node: "A_Execute"`.
- next: → `A_WriteRun` (Write the test run and the test report)

### 6. Write the test run and the test report (`A_WriteRun`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-plan-execution`.
- What: The run records `plan {id, version}` and `sut {actor, version, reach}` with its data and process hashes; the report rolls up per plan, never across plans, and goes to the `qa-reports` branch at `tests/plan/sut/run/`.
- Record it: `workflow_complete` with `node: "A_WriteRun"`.
- next: → `A_ReExecuteSample` (Re-execute a sample, blind to the tester's verdicts)

### 7. Re-execute a sample, blind to the tester's verdicts (`A_ReExecuteSample`)

- Who: the `Untainted checker` lane (role `untainted-checker`).
- Skill: `untainted-verification`, `test-plan-execution`.
- What: Given the plan, the bound data and a sample of case ids — not the report.
- Record it: `workflow_complete` with `node: "A_ReExecuteSample"`.
- next: → `GW_ExitCriteria` (Exit criteria met?)

### Decide — Exit criteria met? (`GW_ExitCriteria`)

- Computed from six facts read off the records — report status, data hash known, unexecuted cases, the checker's agreement, failed and passed cases — by the table the plan's `exitCriteria` names (resolved dynamically; if unresolvable, routes to undetermined and never silently falls back to default).
- Computed by the DMN table `decisions/test-certification.dmn#Decision_TestCertification`: call `workflow_complete` with `node: "GW_ExitCriteria"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «certified» → `A_RecordCertification` (Record the certification decision)
  - «refused» → `A_RecordRefusal` (Record the refusal, with the failing cases)
  - «undetermined» → `A_RecordUndetermined` (Record why it could not be decided)

### 8. Record the certification decision (`A_RecordCertification`)

- Who: the `Certifier` lane (role `certifier`).
- Skill: `test-plan-execution`.
- What: The judgement: the certifier records, under their own name, that the system meets plan P at this version on this run.
- Record it: `workflow_complete` with `node: "A_RecordCertification"`.
- next: → `Call_Sign` (Sign the certification)

### 9. Record the refusal, with the failing cases (`A_RecordRefusal`)

- Who: the `Certifier` lane (role `certifier`).
- Skill: `test-plan-execution`.
- What: A complete, trusted run in which a case failed.
- Record it: `workflow_complete` with `node: "A_RecordRefusal"`.
- next: → `Call_BeanClose` (Close the bean)

### 10. Record why it could not be decided (`A_RecordUndetermined`)

- Who: the `Certifier` lane (role `certifier`).
- Skill: `test-plan-execution`.
- What: The third state: which fact kept the table from deciding — a run not finished, an unknown data hash, an unexecuted case, a checker that disagreed or could not run, or nothing passed.
- Record it: `workflow_complete` with `node: "A_RecordUndetermined"`.
- next: → `Call_BeanClose` (Close the bean)

### 11. Sign the certification (`Call_Sign`)

- Who: the `Attestation service` lane (role `attestation-service`).
- Skill: `qa-report-signing`.
- What: `qa-report-signing.bpmn`, unchanged: it builds the signable run record, resolves the signer's reach, and routes the signature to the API or to a human release authority.
- A subprocess (`Process_QaReportSigning`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_FileCertification` (File the signed certification)

### 12. Close the bean (`Call_BeanClose`)

- Who: the `Attestation service` lane (role `attestation-service`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanClosedHow` (How did it end?)

### 13. File the signed certification (`A_FileCertification`)

- Who: the `Attestation service` lane (role `attestation-service`).
- Skill: `test-plan-execution`.
- What: The signed certification goes under the declared `attestations` graph on main (owner ruling D2 (a), D5 default), pointing at the report it certifies.
- Record it: `workflow_complete` with `node: "A_FileCertification"`.
- next: → `Call_BeanClose` (Close the bean)

### Decide — How did it end? (`GW_BeanClosedHow`)

- Which outcome the bean was closed with, so each ends at its own named end event.
- Call `workflow_complete` with `node: "GW_BeanClosedHow"` and `outcome` set to the label that holds:
  - «certified» → `End_Certified` (Certified and signed)
  - «refused» → `End_Refused` (Refused)
  - «undetermined» → `End_Undetermined` (Undetermined — nothing signed)

## Done — Certified and signed (`End_Certified`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Refused (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Undetermined — nothing signed (`End_Undetermined`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
