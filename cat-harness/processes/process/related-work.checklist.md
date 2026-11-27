<!-- GENERATED from cat-harness/processes/process/related-work.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Related work: find, sort, summarize, ask to coordinate

> **Generated, and not the authority.** This is `cat-harness/processes/process/related-work.bpmn` (process `Process_RelatedWork`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Before new work takes shape, find the work it touches.

## Begin — Work started or changed in chat (`Start_RW`)

- Begin here.
- Call `workflow_start` with `process: "Process_RelatedWork"` and the subject this run is about; keep the instance id it returns.
- next: → `A_SearchBeans` (Search beans for relevance)

### 1. Search beans for relevance (`A_SearchBeans`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: beans list --json / beans query over titles AND bodies, open and recently completed.
- Record it: `workflow_complete` with `node: "A_SearchBeans"`.
- next: → `A_SearchIssues` (Search issues and open PRs)

### 2. Search issues and open PRs (`A_SearchIssues`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: The repository's issues (open and closed) and its open pull requests.
- Record it: `workflow_complete` with `node: "A_SearchIssues"`.
- next: → `A_Categorize` (Categorize and summarize)

### 3. Categorize and summarize (`A_Categorize`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: Each hit gets a category (overlaps: coordinate; affected by; out of scope; unrelated) and a one-line summary with its state.
- Record it: `workflow_complete` with `node: "A_Categorize"`.
- next: → `U_Coordinate` (Coordinate? How?)

### 4. Coordinate? How? (`U_Coordinate`)

- Who: the `User` lane (role `user`).
- Skill: `interaction-modality`.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Record` (Record and act on the answer)

### 5. Record and act on the answer (`A_Record`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: Write the chosen coordination where it will be found: bean links (--blocked-by, --parent), a line in the issue or PR body, or 'note only'.
- Record it: `workflow_complete` with `node: "A_Record"`.
- next: → `End_RW` (Related work known and decided)

## Done — Related work known and decided (`End_RW`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
