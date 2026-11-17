<!-- GENERATED from cat-harness/processes/process/actor-role-administration.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Actor and role administration

> **Generated, and not the authority.** This is `cat-harness/processes/process/actor-role-administration.bpmn` (process `Process_ActorRoleAdministration`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Changing who can do what: adding an actor, opening or closing a role to one, granting or revoking a permission — and auditing the graph afterwards, because the declaration and the graph are two things that can disagree.

## Begin — A change to who can do what (`Start_AdminRequest`)

- Begin here.
- Call `workflow_start` with `process: "Process_ActorRoleAdministration"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_WhichChange_Join`

### Merge — `Gateway_WhichChange_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_WhichChange` (Which administration change?)

### Decide — Which administration change? (`Gateway_WhichChange`)

- Read from the request.
- Call `workflow_complete` with `node: "Gateway_WhichChange"` and `outcome` set to the label that holds:
  - «add actor» → `Task_AddActor` (Add an actor, and declare its kind)
  - «assign roles» → `Task_AssignRoles` (Open or close a role to an actor)
  - «permission» → `Task_GrantOrRevoke` (Grant or revoke a permission)
  - «retire» → `Task_RetireActor` (Retire an actor — never delete one)

### 1. Add an actor, and declare its kind (`Task_AddActor`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `role-model`.
- What: Human, agentic or mechanical.
- Record it: `workflow_complete` with `node: "Task_AddActor"`.
- next: → `Gateway_Changed` (Declaration edited)

### 2. Open or close a role to an actor (`Task_AssignRoles`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `role-model`.
- What: The join every other diagram depends on.
- Record it: `workflow_complete` with `node: "Task_AssignRoles"`.
- next: → `Gateway_Changed` (Declaration edited)

### 3. Grant or revoke a permission (`Task_GrantOrRevoke`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `role-model`.
- What: A permission travels with the PARTICIPANT and cross-cuts every lane, so unlike a role it cannot be scoped by the diagram it is used in.
- Record it: `workflow_complete` with `node: "Task_GrantOrRevoke"`.
- next: → `Gateway_Changed` (Declaration edited)

### 4. Retire an actor — never delete one (`Task_RetireActor`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`, `role-model`.
- What: An actor id is referenced from roles, diagrams, beans and commits, so removing the file leaves every one of those unable to tell retirement from accident.
- Record it: `workflow_complete` with `node: "Task_RetireActor"`.
- next: → `Gateway_Changed` (Declaration edited)

### Merge — Declaration edited (`Gateway_Changed`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `CallActivity_CodeChangeReview` (Branch, gates, PR and review)

### 5. Branch, gates, PR and review (`CallActivity_CodeChangeReview`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `continual-progress`.
- What: Called rather than restated.
- Record it: `workflow_complete` with `node: "CallActivity_CodeChangeReview"`.
- next: → `Task_RunKgAudit` (Audit the graph)

### 6. Audit the graph (`Task_RunKgAudit`)

- Who: the `Graph audit (system)` lane (role `build-pipeline`).
- Skill: `role-model`.
- What: AFTER the change, not before.
- Record it: `workflow_complete` with `node: "Task_RunKgAudit"`.
- next: → `Gateway_AuditClean` (Audit clean?)

### Decide — Audit clean? (`Gateway_AuditClean`)

- The administrator's call, not the pipeline's: `kg:audit:check` fails on `critical` and `kg:audit:strict` adds `major`, so what holds a change is a policy choice about this layer rather than arithmetic the audit performs.
- Call `workflow_complete` with `node: "Gateway_AuditClean"` and `outcome` set to the label that holds:
  - «no» → `Gateway_WhichChange_Join`
  - «yes» → `End_Administered` (Graph changed and audited)

## Done — Graph changed and audited (`End_Administered`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
