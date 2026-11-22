---
# folio-assistant-3o5b
$schema: bean/1.0.0
title: 'TEST PROCESS: tester + certifier roles, system-under-test actor facet, test-plan-execution.bpmn, certification DMN, kg-audit criteria'
status: completed
type: feature
priority: normal
created_at: 2026-10-01T08:00:47Z
updated_at: 2026-10-02T05:51:43Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-ygzh
---

Arc `3fva`, proposal §3.2 and §4 items 5.4 and 5.5. Blocked on the TEST PLAN schema bean.

`test-plan-execution.bpmn` has five lanes:
- Requester / SUT: requests certification against plan P.
- Tester: resolves the plan, binds the test data, executes, writes the run.
- Untainted checker: re-executes a sample (`untainted-verification`).
- Certifier: decides, using the DMN that `exitCriteria` names.
- Attestation service: signs, via a call activity to `qa-report-signing.bpmn`.

Roles: `tester` and `certifier` (a specialisation of `stakeholder` / `programme-manager`). The system-under-test facet goes on the actor, and is reachable by a machine or an agent.

`kg-audit` criteria:
- the plan resolves;
- every case was executed or skipped with a reason;
- the data hash is present;
- the SUT never wrote its own verdict.

## Done when
- [x] `kg:audit` is clean on the new process, roles and criteria
- [x] the process runs end to end through `workflow_start` / `workflow_complete`

Claim: worktree agent-aeed952a1045a7b02 (branch worktree-agent-aeed952a1045a7b02), session https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR, 2026-10-01. Not pushed; the parent session integrates.

## Summary of Changes (2026-10-01)

- **Roles** (`cat-harness/scenarios/roles.json`): `test-requester` (person/agent/system; may BE the SUT, so does nothing after asking), `tester` (person/agent/system; untainted from the SUT), `untainted-checker` (person/agent; rules on nothing), `certifier` (person; `inherits: [stakeholder]`, deliberately NOT `judgementOnly` — the DMN is applied, only the decision is the judgement). `attestation-service` gains the skill. Actors: `ci-pipeline` → tester, `programme-manager` → certifier + test-requester, `untainted-checker` → untainted-checker. Seven user stories.
- **SUT facet** (`schemas/skill-package.ts`): `ActorDefinition.systemUnderTest = { kind ∈ SUT_KINDS, version }`, agent/system actors only; reach is NOT restated — `sutRefFor` reads the actor's own `reach` (absent → `unknown`). `readActors` loads and validates it (`LoadedActor.systemUnderTest`).
- **Process** `cat-harness/processes/test-plan-execution.bpmn`: five lanes; every activity names a skill and a bean op (claim → notes → resolve on refusal / filing); `GW_ExitCriteria` computed by `processes/decisions/test-certification.dmn` (six facts; `certified` / `refused` / `undetermined`, every could-not-determine row firing before a failure counts); `Call_Sign` calls `Process_QaReportSigning` unchanged. Indexed on the publication-workflow page.
- **kg-audit criteria** (`KG_CRITERIA`, graph roll-up; implemented in `scripts/test-plan-audit.ts`): `test-plan-resolves` (critical), `test-case-executed-or-skipped` (major; `unknown` when the plan cannot be followed), `test-data-hash-present` (major), `test-sut-not-self-judged` (critical). All `n/a` on main today: no plan, plan-run or report exists yet.
- **Skill** `sdlc/sdlc-core/test-plan-execution.md`, registered; links (does not edit) `test-engineer` and `content-test`.
- **Proof it runs**: `scripts/tests/test-plan-execution.test.ts` (31 tests) drives the diagram on `scripts/tests/fixtures/test-plan-execution/tiny.test-plan.json` through all three endings with facts read off a real `buildTestRun` run and `test-report/v1` report, including the signing subprocess through its own DMN; also the DMN rows, the facet, and each criterion pass/fail/unknown/n/a. Engine-level (`startInstance`/`enabled`/`complete`) — the MCP tools add only GitHub auth and bean side-effects.
- Not done: a `qa-attestations/v1` family for certifications (the filing step names the graph; the family does not exist yet); per-plan DMN dispatch (the gateway carries the platform default).



## Owner rulings (2026-10-02)
- test-requester stays its own role.
- Certification family in qa-attestations/v1: follow-up bean zaui.
- Per-plan exit-criteria DMN: follow-up bean 4iey (interim kg:audit guard first, dispatch when a plan needs it).
