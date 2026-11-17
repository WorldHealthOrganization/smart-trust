<!-- GENERATED from cat-harness/library/processes/translation-review-adjudication.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Translation review and adjudication

> **Generated, and not the authority.** This is `cat-harness/library/processes/translation-review-adjudication.bpmn` (process `Process_TranslationReviewAdjudication`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A person's verdict on a machine translation, carried from the review page to the record.

## Begin — A catalogue needs a translation (`Start_TRA`)

- Begin here: A locale's `.po` catalogue has strings with no translation, or a translation no person has adjudicated.
- Call `workflow_start` with `process: "Process_TranslationReviewAdjudication"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_TRA_Candidates` (Produce candidate translations (any engine))

### 1. Produce candidate translations (any engine) (`Task_TRA_Candidates`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-candidate-source`.
- What: One or more candidate sources write alternatives per string to `translations/<locale>/<catalogue>.candidates.json` (`translation-candidates/v1`), each candidate carrying its source: an agent model, an open machine-translation model, a web service, or a person.
- Record it: `workflow_complete` with `node: "Task_TRA_Candidates"`.
- next: → `Gateway_TRA_Empty` (Any msgstr empty?)

### Decide — Any msgstr empty? (`Gateway_TRA_Empty`)

- Per string: does the `.po` have no translation for a string the engine just gave candidates for?
- Call `workflow_complete` with `node: "Gateway_TRA_Empty"` and `outcome` set to the label that holds:
  - «Yes» → `Task_TRA_SeedFuzzy` (Write the first candidate as a fuzzy msgstr)
  - «No» → `Gateway_TRA_Seeded`

### 2. Write the first candidate as a fuzzy msgstr (`Task_TRA_SeedFuzzy`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-candidate-source`.
- What: Candidates are never a barrier to having a translation.
- Record it: `workflow_complete` with `node: "Task_TRA_SeedFuzzy"`.
- next: → `Gateway_TRA_Seeded`

### Merge — `Gateway_TRA_Seeded`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_TRA_ReviewPage` (Build the review page)

### 3. Build the review page (`Task_TRA_ReviewPage`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-adjudication`.
- What: `translation:status` writes `review.html` beside the status page, with `assets/translation-status/review.json`: every catalogue × locale, its state (`machine`, `flagged`, `reviewed`, `stale`, `official`), the candidates per string, and the hash of the catalogue's bytes.
- Record it: `workflow_complete` with `node: "Task_TRA_ReviewPage"`.
- next: → `Task_TRA_Review` (Read the catalogue on the review page)

### 4. Read the catalogue on the review page (`Task_TRA_Review`)

- Who: the `Reviewer (adjudicator)` lane (role `translation-adjudicator`).
- Skill: `translation-adjudication`.
- What: The reviewer opens the review page and reads one catalogue's strings against their source, with the candidates beside each.
- Record it: `workflow_complete` with `node: "Task_TRA_Review"`.
- next: → `Gateway_TRA_Verdict` (Acceptable?)

### Decide — Acceptable? (`Gateway_TRA_Verdict`)

- Per catalogue, the reviewer's verdict.
- Call `workflow_complete` with `node: "Gateway_TRA_Verdict"` and `outcome` set to the label that holds:
  - «Acceptable» → `Task_TRA_FileIssue` (File the adjudication issue)
  - «Mistranslation» → `Task_TRA_Choose` (Pick a candidate or write your own)

### 5. File the adjudication issue (`Task_TRA_FileIssue`)

- Who: the `Reviewer (adjudicator)` lane (role `translation-adjudicator`).
- Skill: `translation-adjudication`.
- What: Submit opens GitHub's new-issue form prefilled with a readable summary and a `translation-adjudication/v1` JSON block, labelled `translation-adjudication` and titled `[translation review] …`.
- Record it: `workflow_complete` with `node: "Task_TRA_FileIssue"`.
- next: → `Gateway_TRA_Once` (Already recorded for this issue?)

### 6. Pick a candidate or write your own (`Task_TRA_Choose`)

- Who: the `Reviewer (adjudicator)` lane (role `translation-adjudicator`).
- Skill: `translation-adjudication`.
- What: For each wrong string: pick one of the candidates (its source is recorded with the suggestion) or type the text.
- Record it: `workflow_complete` with `node: "Task_TRA_Choose"`.
- next: → `Task_TRA_FileIssue` (File the adjudication issue)

### Decide — Already recorded for this issue? (`Gateway_TRA_Once`)

- The workflow runs for an issue that is labelled or titled as an adjudication, and once per issue: `Yes` when the issue's branch already exists, and nothing more is done.
- Call `workflow_complete` with `node: "Gateway_TRA_Once"` and `outcome` set to the label that holds:
  - «Yes» → `End_TRA_AlreadyRecorded` (Already recorded)
  - «No» → `Task_TRA_Plan` (Plan the records (translation:adjudicate))

## Done — Already recorded (`End_TRA_AlreadyRecorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Plan the records (translation:adjudicate) (`Task_TRA_Plan`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-adjudication`.
- What: `translation:adjudicate` reads the `issues` event GitHub wrote, never the body from a shell variable: the body is untrusted and is only parsed as JSON.
- Record it: `workflow_complete` with `node: "Task_TRA_Plan"`.
- next: → `Gateway_TRA_Determined` (Event and declaration readable?)

### Decide — Event and declaration readable? (`Gateway_TRA_Determined`)

- `No` when there is no event file, the event carries no issue with an author, or the layer has no declaration to resolve its translations directory from.
- Call `workflow_complete` with `node: "Gateway_TRA_Determined"` and `outcome` set to the label that holds:
  - «No» → `End_TRA_CouldNotDetermine` (Could not determine (the run fails))
  - «Yes» → `Gateway_TRA_Author` (Author an owner, member or collaborator?)

## Done — Could not determine (the run fails) (`End_TRA_CouldNotDetermine`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Author an owner, member or collaborator? (`Gateway_TRA_Author`)

- Read from the event's `author_association`, never from the body.
- Call `workflow_complete` with `node: "Gateway_TRA_Author"` and `outcome` set to the label that holds:
  - «No» → `Task_TRA_Refuse` (Comment why nothing was recorded)
  - «Yes» → `Gateway_TRA_Hash` (Any catalogue unchanged?)

### 8. Comment why nothing was recorded (`Task_TRA_Refuse`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-adjudication`.
- What: Every refusal, with its reason, as a comment on the issue (exit 3).
- Record it: `workflow_complete` with `node: "Task_TRA_Refuse"`.
- next: → `End_TRA_NotRecorded` (Not recorded)

### Decide — Any catalogue unchanged? (`Gateway_TRA_Hash`)

- Per item: is the catalogue's hash today the one the page showed, does its path stay inside the translations directory, and is every suggestion's `current` text still what the catalogue says?
- Call `workflow_complete` with `node: "Gateway_TRA_Hash"` and `outcome` set to the label that holds:
  - «No» → `Task_TRA_Refuse` (Comment why nothing was recorded)
  - «Yes» → `Task_TRA_Write` (Write the records)

## Done — Not recorded (`End_TRA_NotRecorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 9. Write the records (`Task_TRA_Write`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-adjudication`.
- What: Acceptable: the catalogue's translation node gets `signedOffBy` / `signedOffAt`.
- Record it: `workflow_complete` with `node: "Task_TRA_Write"`.
- next: → `Task_TRA_OpenPR` (Open a ready PR and comment)

### 10. Open a ready PR and comment (`Task_TRA_OpenPR`)

- Who: the `Automated pipeline` lane (role `build-pipeline`).
- Skill: `translation-adjudication`.
- What: Commit on `translation-adjudication/issue-<n>`, authored by the issue's author, open a ready pull request that names the issue, and comment the summary on the issue: what was recorded and what was refused.
- Record it: `workflow_complete` with `node: "Task_TRA_OpenPR"`.
- next: → `Task_TRA_Merge` (Review the PR; merge or close)

### 11. Review the PR; merge or close (`Task_TRA_Merge`)

- Who: the `Maintainer` lane (role `editor`).
- Skill: `translation-adjudication`.
- What: The maintainer checks that the PR writes down what the issue decided and nothing else, lets the layer's checks run, and merges or closes it.
- Record it: `workflow_complete` with `node: "Task_TRA_Merge"`.
- next: → `Gateway_TRA_Merged` (Merged?)

### Decide — Merged? (`Gateway_TRA_Merged`)

- `No`: the PR is closed and nothing is recorded; the issue stays as the account of what was asked.
- Call `workflow_complete` with `node: "Gateway_TRA_Merged"` and `outcome` set to the label that holds:
  - «No» → `End_TRA_Closed` (Closed, not recorded)
  - «Yes» → `Gateway_TRA_PerCatalogue` (Verdict?)

## Done — Closed, not recorded (`End_TRA_Closed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Verdict? (`Gateway_TRA_PerCatalogue`)

- Decided once for each catalogue the merged PR records, by that catalogue's verdict: `Accepted` when it was found acceptable, `Suggestion applied` when its suggestions went in.
- Call `workflow_complete` with `node: "Gateway_TRA_PerCatalogue"` and `outcome` set to the label that holds:
  - «Accepted» → `End_TRA_Reviewed` (Catalogue reviewed (not official))
  - «Suggestion applied» → `End_TRA_Flagged` (Catalogue flagged for review)

## Done — Catalogue reviewed (not official) (`End_TRA_Reviewed`)

- The instance completes here: The review page shows the catalogue `reviewed`, and `stale` once its bytes change. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Catalogue flagged for review (`End_TRA_Flagged`)

- The instance completes here: The suggestions are in the catalogue, fuzzy, so the catalogue needs review again: a person's text is not reviewed by being written. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
