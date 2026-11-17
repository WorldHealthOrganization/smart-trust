<!-- GENERATED from folio-assistant-core/collab/processes/content/guideline-updates.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Guideline Updates

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/guideline-updates.bpmn` (process `Process_GuidelineUpdates`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Taking up a new version of a guideline, or a changed lower layer, is a re-pin and a review at once.

## Begin — A new guideline version is published (`Start_NewVersion`)

- Begin here: The issuing body publishes a new version.
- Call `workflow_start` with `process: "Process_GuidelineUpdates"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ChangeNotes` (Publish the version with its change notes)

## Begin — A harness or base layer changed (`Start_LayerChanged`)

- Begin here: Rapid development: a lower layer merged a change, and the sites above it need the new pin.
- Call `workflow_start` with `process: "Process_GuidelineUpdates"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_MapCone` (Map the affected layers in order)

### 1. Publish the version with its change notes (`Task_ChangeNotes`)

- Who: the `Guideline publisher` lane (role `publication-manager`).
- Skill: `content-publish`.
- What: The publisher states what changed, what was added and what was withdrawn, and why, in words a country team can act on.
- Record it: `workflow_complete` with `node: "Task_ChangeNotes"`.
- next: → `Task_MapCone` (Map the affected layers in order)

### 2. Map the affected layers in order (`Task_MapCone`)

- Who: the `Re-pin steward and build pipeline` lane (role `merge-steward`).
- Skill: `remote-mount`.
- What: Run the re-pin planner (mount:repin:cone) with the fleet and the changed repository.
- Record it: `workflow_complete` with `node: "Task_MapCone"`.
- next: → `Task_OpenRepin` (Open the re-pin for the next ready layer)

### 3. Open the re-pin for the next ready layer (`Task_OpenRepin`)

- Who: the `Re-pin steward and build pipeline` lane (role `merge-steward`).
- Skill: `remote-mount`.
- What: For each site that is ready now, open one re-pin pull request that moves its pins from the old version to the new one.
- Record it: `workflow_complete` with `node: "Task_OpenRepin"`.
- next: → `Task_Impact` (Compare old, new and our adaptations)

### 4. Compare old, new and our adaptations (`Task_Impact`)

- Who: the `Adaptation team (human or agentic)` lane (role `business-analyst`).
- Skill: `rendered-impact`.
- What: Attach the impact report to the re-pin: the changes that reach this site (only what it mounts), and its own files that look like adaptations of a changed file.
- Record it: `workflow_complete` with `node: "Task_Impact"`.
- next: → `Gw_Touches` (Does the change touch an adaptation or policy?)

### Decide — Does the change touch an adaptation or policy? (`Gw_Touches`)

- Call `workflow_complete` with `node: "Gw_Touches"` and `outcome` set to the label that holds:
  - «yes» → `Task_Review` (Review the impact with stakeholders)
  - «no» → `Task_Merge` (Merge the re-pin with its decided revisions)

### 5. Review the impact with stakeholders (`Task_Review`)

- Who: the `Adaptation committee (policy, clinical, programme)` lane (role `authoring-committee`).
- Skill: `content-review`.
- What: The committee reads the old version, the new version and each affected adaptation side by side on the staging preview, and hears the adaptation team's account of what rests on them.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `Task_Decide` (Decide each adaptation: keep, revise or retire)

### 6. Merge the re-pin with its decided revisions (`Task_Merge`)

- Who: the `Re-pin steward and build pipeline` lane (role `merge-steward`).
- Skill: `prepare-merge`.
- What: The re-pin merges when its checks are green and every decision it needs is recorded.
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `Gw_More` (More layers left to re-pin?)

### 7. Decide each adaptation: keep, revise or retire (`Task_Decide`)

- Who: the `Adaptation committee (policy, clinical, programme)` lane (role `authoring-committee`).
- Skill: `decision-audit`.
- What: One recorded decision per affected adaptation, with its reason: keep it as is, revise it to the new version, or retire it because the new version now covers it.
- Record it: `workflow_complete` with `node: "Task_Decide"`.
- next: → `Gw_Revise` (Any adaptation to revise?)

### Decide — More layers left to re-pin? (`Gw_More`)

- Call `workflow_complete` with `node: "Gw_More"` and `outcome` set to the label that holds:
  - «yes» → `Task_OpenRepin` (Open the re-pin for the next ready layer)
  - «no» → `End_Current` (Every layer current with the new version)

### Decide — Any adaptation to revise? (`Gw_Revise`)

- Call `workflow_complete` with `node: "Gw_Revise"` and `outcome` set to the label that holds:
  - «yes» → `Task_Revise` (Revise the adaptations as decided)
  - «no» → `Task_Merge` (Merge the re-pin with its decided revisions)

## Done — Every layer current with the new version (`End_Current`)

- The instance completes here: Every site in the cone has moved, and each adaptation has a recorded decision. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Revise the adaptations as decided (`Task_Revise`)

- Who: the `Adaptation team (human or agentic)` lane (role `business-analyst`).
- Skill: `content-review`.
- What: Each revision is an ordinary content change, reviewed on its staging preview through content change review, on the re-pin's branch or a branch that merges with it.
- A subprocess (`Process_ContentChangeReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Merge` (Merge the re-pin with its decided revisions)
