<!-- GENERATED from cat-harness/processes/process/session-state-machine.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Session state machine

> **Generated, and not the authority.** This is `cat-harness/processes/process/session-state-machine.bpmn` (process `Process_SessionStateMachine`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The shape of a session from the outside: establish who is acting, open a record for them, take each turn in, and write down only what actually changed.

## Begin — An actor picks up (`Start_Session`)

- Begin here.
- Call `workflow_start` with `process: "Process_SessionStateMachine"` and the subject this run is about; keep the instance id it returns.
- next: → `A_IdentifyActor` (Establish who is acting)

### 1. Establish who is acting (`A_IdentifyActor`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `session-context`.
- What: The first step and not a formality: `actor` is the one field of the record that nothing else can supply.
- Record it: `workflow_complete` with `node: "A_IdentifyActor"`.
- next: → `Gateway_ActorKnown` (Actor established?)

### Decide — Actor established? (`Gateway_ActorKnown`)

- Is it established who is acting?
- Call `workflow_complete` with `node: "Gateway_ActorKnown"` and `outcome` set to the label that holds:
  - «no» → `A_AskWhoIsActing` (Ask who is acting)
  - «yes» → `A_OpenSession` (Open the session record)

### 2. Ask who is acting (`A_AskWhoIsActing`)

- Who: the `Human actor` lane (role `user`).
- Skill: `interaction-modality`.
- What: The one step that needs a person.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_IdentifyActor` (Establish who is acting)

### 3. Open the session record (`A_OpenSession`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `session-context`.
- What: Writes `id`, `actor` and `startedAt`, with `open` and `claimed` empty.
- Record it: `workflow_complete` with `node: "A_OpenSession"`.
- next: → `Call_SecurePermissions` (Secure the agent's permissions)

### 4. Secure the agent's permissions (`Call_SecurePermissions`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: Once the actor is known and the record is open, check that the coding agent acting here holds the permissions this layer's processes need, granted by a person and recorded, and ask for any that are missing.
- A subprocess (`Process_SecureAgentPermissions`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_ReadTurn` (Take in the turn)

### 5. Take in the turn (`A_ReadTurn`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- What: A turn is anything that arrives — a person's message, a tool result, a notification.
- Record it: `workflow_complete` with `node: "A_ReadTurn"`.
- next: → `Gateway_TurnEffect` (What did the turn change?)

### Decide — What did the turn change? (`Gateway_TurnEffect`)

- THE non-deterministic point, and the reason this process exists.
- Call `workflow_complete` with `node: "Gateway_TurnEffect"` and `outcome` set to the label that holds:
  - «nothing changed» → `A_Touch` (Refresh `updatedAt` only)
  - «state changed» → `A_UpdateSession` (Write what changed)
  - «the session is ending» → `A_CloseSession` (Close the session)

### 6. Refresh `updatedAt` only (`A_Touch`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `session-context`.
- What: Nothing changed, and saying so is the point.
- Record it: `workflow_complete` with `node: "A_Touch"`.
- next: → `A_ReadTurn` (Take in the turn)

### 7. Write what changed (`A_UpdateSession`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `session-context`.
- What: An instance opened or closed, a bean claimed, a wait started or ended.
- Record it: `workflow_complete` with `node: "A_UpdateSession"`.
- next: → `A_ReadTurn` (Take in the turn)

### 8. Close the session (`A_CloseSession`)

- Who: the `Agent (playing the machine)` lane (role `authoring-agent`).
- Skill: `session-context`.
- What: Records that the actor stopped.
- Record it: `workflow_complete` with `node: "A_CloseSession"`.
- next: → `End_Session` (Session closed)

## Done — Session closed (`End_Session`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
