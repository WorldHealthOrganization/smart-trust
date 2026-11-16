<!-- GENERATED from fhir-harness/processes/content/ig-release.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — An IG release: the owner tags, a draft is built, the owner publishes

> **Generated, and not the authority.** This is `fhir-harness/processes/content/ig-release.bpmn` (process `Process_IgRelease`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How an IG repository's release is cut, and how a missed one is caught up (skill `ig-binary-artefacts` §"Releasing").

## Begin — Version set on main (`Start_VersionSet`)

- Begin here: `sushi-config.yaml` on the default branch carries the version the owner wants released (skill `ig-build-pipeline` §"Version numbering").
- Call `workflow_start` with `process: "Process_IgRelease"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Tag` (Tag the IG's current version)

## Begin — AST refresh of main (`Start_Check`)

- Begin here: Every run of `ig-ast-refresh.yml` on the default branch that is not itself a release build.
- Call `workflow_start` with `process: "Process_IgRelease"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Check` (Check the current version's tag and release)

### 1. Tag the IG's current version (`Task_Tag`)

- Who: the `Owner (release authority, a person)` lane (role `publication-manager`).
- Skill: `ig-binary-artefacts`, `ig-publication`.
- What: The owner tags the commit that set the version with `v<version>` (for example `v0.2.0`) and pushes the tag.
- Record it: `workflow_complete` with `node: "Task_Tag"`.
- next: → `Task_ReleaseBuild` (Build the tag in full and make the draft release)

### 2. Check the current version's tag and release (`Task_Check`)

- Who: the `Release check (advisory)` lane (role `build-pipeline`).
- Skill: `ig-binary-artefacts`.
- What: `bun run fhir-harness/scripts/ig-release.ts check --ig .
- Record it: `workflow_complete` with `node: "Task_Check"`.
- next: → `GW_Tagged` (Version tagged?)

### 3. Build the tag in full and make the draft release (`Task_ReleaseBuild`)

- Who: the `IG release (GitHub runner: full build, draft release)` lane (role `ig-publisher-service`).
- Skill: `ig-binary-artefacts`.
- What: `ig-release.yml` (Tool `ig-release`): `ig-ast-refresh.yml` with `force` and `release` (never incremental), then `ig-release.ts assets` gathers `package.tgz` (and `package.r4.tgz`, `package.r4b.tgz`), `ast-data.zip` (the AST, Libraries with their ELM) and `SHA256SUMS`, and `ig-release.ts draft` makes
- Record it: `workflow_complete` with `node: "Task_ReleaseBuild"`.
- next: → `Task_Publish` (Publish the draft release)

### Decide — Version tagged? (`GW_Tagged`)

- Answered by the check: `v<version>` exists locally or on origin.
- Call `workflow_complete` with `node: "GW_Tagged"` and `outcome` set to the label that holds:
  - «no» → `Task_Tag` (Tag the IG's current version)
  - «yes» → `GW_Released` (Tag released?)

### 4. Publish the draft release (`Task_Publish`)

- Who: the `Owner (release authority, a person)` lane (role `publication-manager`).
- Skill: `ig-binary-artefacts`.
- What: The owner reads the draft's files and publishes it on GitHub: `Task_AuthorizeRelease` of `draft-to-publication.bpmn`.
- Record it: `workflow_complete` with `node: "Task_Publish"`.
- next: → `End_Released` (Release published)

### Decide — Tag released? (`GW_Released`)

- Answered by the check from the repository's release list (a draft is visible only to a token that may write the repository).
- Call `workflow_complete` with `node: "GW_Released"` and `outcome` set to the label that holds:
  - «no release» → `Task_RunRelease` (Run IG release (draft) by hand for the tag)
  - «a draft» → `Task_Publish` (Publish the draft release)
  - «published» → `End_InOrder` (Released)

## Done — Release published (`End_Released`)

- The instance completes here: The release and its files are public; `ingest-ig-releases` lists it in `releases.json` and the site's releases page. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Run IG release (draft) by hand for the tag (`Task_RunRelease`)

- Who: the `Owner (release authority, a person)` lane (role `publication-manager`).
- Skill: `ig-binary-artefacts`.
- What: Actions → "IG release (draft)" → Run workflow, input `tag` = `v<version>`.
- Record it: `workflow_complete` with `node: "Task_RunRelease"`.
- next: → `Task_ReleaseBuild` (Build the tag in full and make the draft release)

## Done — Released (`End_InOrder`)

- The instance completes here: The current version's tag has a published release: nothing to catch up. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
