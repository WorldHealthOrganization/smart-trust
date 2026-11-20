<!-- GENERATED from cat-harness/sdlc/processes/docs-site-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Publishing the docs site, and keeping the previews alive

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/docs-site-publish.bpmn` (process `Process_DocsSite`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Builds the docs site from this checkout's sources and publishes it to `gh-pages` (`.github/workflows/docs-site.yml`).

## Begin — Push to main, or dispatch (`Start_Push`)

- Begin here.
- Call `workflow_start` with `process: "Process_DocsSite"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_SecurityGate` (Run the release security gate)

### 1. Run the release security gate (`Task_SecurityGate`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `security`.
- What: `bun run cat security:gate`, before the site is built.
- Record it: `workflow_complete` with `node: "Task_SecurityGate"`.
- next: → `GW_Secure` (Security gate passed?)

### Decide — Security gate passed? (`GW_Secure`)

- `passed` only on exit 0, meaning no blocking check failed or could not be run.
- Call `workflow_complete` with `node: "GW_Secure"` and `outcome` set to the label that holds:
  - «passed» → `Task_Regenerate` (Regenerate every derived reference from its source)
  - «refused, or could not check» → `Call_Alert` (Alert the publication manager)

### 2. Regenerate every derived reference from its source (`Task_Regenerate`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Regenerates every derived reference from its source, so the site is never built from committed copies that may be stale: the derived artefacts kept off the commit (`bun run cat derive:publish`), the skill schema and instruction pages (`gen-schema-docs.ts`, `gen-skill-docs.ts`), the content-backed do
- Record it: `workflow_complete` with `node: "Task_Regenerate"`.
- next: → `Call_InstanceSites` (Compose each layer's site [its Tool])

### 3. Alert the publication manager (`Call_Alert`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `publish-verification`.
- What: Process_PublishAlert — the ONE alert every failing step after the publish button goes through, whichever step it was.
- A subprocess (`Process_PublishAlert`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Failed` (Job RED — publication manager alerted)

### 4. Compose each layer's site [its Tool] (`Call_InstanceSites`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `docs-generation`.
- What: `compose-docs.ts` composes the docs layers into one Jekyll source (`cat-harness/docs/` as the base, the checkout root's `docs/` laid over it); then each layer that builds a site of its own composes it into that source at `<instance>/`, so the result is one site with one sidebar, search and language 
- Record it: `workflow_complete` with `node: "Call_InstanceSites"`.
- next: → `Task_Build` (Build the Jekyll site and the API reference)

## Done — Job RED — publication manager alerted (`End_Failed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Build the Jekyll site and the API reference (`Task_Build`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Builds the composed source with Jekyll 4 and just-the-docs (`bundle exec jekyll build`), runs each composing Tool's post-build pass, mounts instance-rendered content (`mount-instance-docs.ts`), and generates the TypeScript API reference with TypeDoc (`.github/actions/typedoc-api`).
- Record it: `workflow_complete` with `node: "Task_Build"`.
- next: → `Task_Export` (Export the knowledge graph and its schema)

### 6. Export the knowledge graph and its schema (`Task_Export`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Exports the knowledge graph and its schema into the published tree (`kg-export.ts`, `harness-schema-export.ts`, `kg-viewer.ts`), stripping the unpublished graph typologies, then runs the built-site checks: every maintained artefact is present (`bun run cat check:maintained-artefacts`), no block-leve
- Record it: `workflow_complete` with `node: "Task_Export"`.
- next: → `Call_Verify` (Verify the export)

### 7. Verify the export (`Call_Verify`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `publish-verification`.
- What: Process_PublishVerification: the verifier set over the built tree (`publish-verify.ts`), before the deploy.
- A subprocess (`Process_PublishVerification`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Restore` (Restore the OPEN PRs' staging previews)

### 8. Restore the OPEN PRs' staging previews (`Task_Restore`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: Copies every open pull request's `branches/<slug>/` preview from `gh-pages` into the publish directory before the replace, once per publish attempt (`restore-staging.ts`, run inside `publish-gh-pages.sh`).
- Record it: `workflow_complete` with `node: "Task_Restore"`.
- next: → `Task_Publish` (Push to the CDN (full replace))

### 9. Push to the CDN (full replace) (`Task_Publish`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: Calls Process_RenderKgToCdn with the built tree, the site root as publication root URL, and GitHub Pages as target, so its `gh-pages` Tool (`publish-gh-pages.sh`) replaces the branch and returns the push's status and message.
- A subprocess (`Process_RenderKgToCdn`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Deployed` (Did the deploy succeed?)

### Decide — Did the deploy succeed? (`GW_Deployed`)

- Answered by the deploy step.
- Call `workflow_complete` with `node: "GW_Deployed"` and `outcome` set to the label that holds:
  - «yes» → `GW_Survived` (Did the previews survive?)
  - «no» → `Call_Alert` (Alert the publication manager)

### Decide — Did the previews survive? (`GW_Survived`)

- Asked after the full-replace publish (`restore-staging.ts --verify`): are the open PRs' previews still there?
- Call `workflow_complete` with `node: "GW_Survived"` and `outcome` set to the label that holds:
  - «yes» → `Task_Judge` (Judge the built-site checks)
  - «no, or could not tell» → `Call_Alert` (Alert the publication manager)

### 10. Judge the built-site checks (`Task_Judge`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Reads the outcomes `Task_Export` and `Call_Verify` recorded (maintained artefacts, escaped markup, QA witnesses and results, navbar tiles, the export verification) and fails the run if any failed.
- Record it: `workflow_complete` with `node: "Task_Judge"`.
- next: → `GW_Judged` (Did every built-site check pass?)

### Decide — Did every built-site check pass? (`GW_Judged`)

- Answered by `Task_Judge`.
- Call `workflow_complete` with `node: "GW_Judged"` and `outcome` set to the label that holds:
  - «yes» → `Task_CloseAlert` (Close the publication manager's alert, if open)
  - «no — the site is live» → `Call_Alert` (Alert the publication manager)

### 11. Close the publication manager's alert, if open (`Task_CloseAlert`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: A clean publish resolves whatever the last failure raised: close the open publication-manager tracking issue with a comment naming this run.
- Record it: `workflow_complete` with `node: "Task_CloseAlert"`.
- next: → `End_Published` (Site published, previews intact)

## Done — Site published, previews intact (`End_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
