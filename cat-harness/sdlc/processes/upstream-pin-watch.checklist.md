<!-- GENERATED from cat-harness/sdlc/processes/upstream-pin-watch.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Watching a pinned upstream dependency

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/upstream-pin-watch.bpmn` (process `Process_UpstreamPinWatch`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Has a pinned upstream dependency fallen behind a release: check each pin, keep one tracking issue, and enter the adoption subprocess for each dependency that is behind.

## Begin — Weekly, or on dispatch (`Start_Sweep`)

- Begin here: Weekly and not daily, for the same reason `ci-health.yml` is weekly: the defect being guarded against is "nobody noticed for months", not "nobody noticed for a day", and a daily run turns the tracking issue into a feed.
- Call `workflow_start` with `process: "Process_UpstreamPinWatch"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ReadPins` (Read the pin registry upstream-pins.json)

### 1. Read the pin registry upstream-pins.json (`Task_ReadPins`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `upstream-version-adoption`.
- What: The registry lists the tenants and says, per row, WHICH FILE holds the pin literal and how to read it.
- Record it: `workflow_complete` with `node: "Task_ReadPins"`.
- next: → `Task_QueryUpstream` (List upstream releases and compare to the pin)

### 2. List upstream releases and compare to the pin (`Task_QueryUpstream`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `upstream-version-adoption`.
- What: `git ls-remote --tags`, filtered by the row's `tagPattern` and ordered by version.
- Record it: `workflow_complete` with `node: "Task_QueryUpstream"`.
- next: → `GW_Determined` (Could we tell?)

### Decide — Could we tell? (`GW_Determined`)

- Asked of the `verdict` output of 'Check the pins' in .github/workflows/upstream-pins.yml, which runs `check:upstream-pins --out`.
- Call `workflow_complete` with `node: "GW_Determined"` and `outcome` set to the label that holds:
  - «no» → `End_Unknown` (Unknown — issue untouched, job red)
  - «yes» → `GW_Stale` (Behind a release?)

## Done — Unknown — issue untouched, job red (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Behind a release? (`GW_Stale`)

- Asked of the same `verdict`.
- Call `workflow_complete` with `node: "GW_Stale"` and `outcome` set to the label that holds:
  - «no» → `Task_CloseIssue` (Close the tracking issue)
  - «yes» → `Task_TrackIssue` (Open or EDIT the one tracking issue)

### 3. Close the tracking issue (`Task_CloseIssue`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `upstream-version-adoption`.
- What: Closed automatically when every pin is current, so the issue's existence is the state rather than a log of past states.
- Record it: `workflow_complete` with `node: "Task_CloseIssue"`.
- next: → `End_Current` (Every pin current)

### 4. Open or EDIT the one tracking issue (`Task_TrackIssue`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `upstream-version-adoption`.
- What: One issue, edited in place.
- Record it: `workflow_complete` with `node: "Task_TrackIssue"`.
- next: → `Call_BeanOpen` (Open the bean)

## Done — Every pin current (`End_Current`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Open the bean (`Call_BeanOpen`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `A_PickUp` (Pick up the stale pin)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 6. Pick up the stale pin (`A_PickUp`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `upstream-version-adoption`.
- What: The hand-off from the mechanical lane to the one that can exercise judgement.
- Record it: `workflow_complete` with `node: "A_PickUp"`.
- next: → `Call_Adopt` (Adopt the version bump)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Adopt the version bump (`Call_Adopt`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `upstream-version-adoption`.
- What: The reusable subprocess.
- A subprocess (`Process_UpstreamAdoption`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_BeanClose` (Close the bean)

### 8. Close the bean (`Call_BeanClose`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Handled` (Decision recorded)

## Done — Decision recorded (`End_Handled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
