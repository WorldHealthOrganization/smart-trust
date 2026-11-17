<!-- GENERATED from bootstrap-tools/processes/render-kg-to-github-pages.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Render a Knowledge Graph to GitHub Pages

> **Generated, and not the authority.** This is `bootstrap-tools/processes/render-kg-to-github-pages.bpmn` (process `Process_RenderKgToGitHubPages`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Render a Knowledge Graph — the whole of it, or a list of its Subgraphs — to GitHub Pages at a publication root URL, and report the push: a STATUS (pushed, not pushed, could not determine) and one MESSAGE carrying the deployed commit and the QA result.

## Begin — A Knowledge Graph, a publication root URL, GitHub Pages as the target (`Start_Render`)

- Begin here.
- Call `workflow_start` with `process: "Process_RenderKgToGitHubPages"` and the subject this run is about; keep the instance id it returns.
- next: → `A_ResolveInputs` (Resolve the Subgraphs and the root URL)

### 1. Resolve the Subgraphs and the root URL (`A_ResolveInputs`)

- Who: the `Site Publisher` lane (role `site-publisher`).
- Skill: `render-kg-to-github-pages`.
- What: Read the instance's declaration.
- Record it: `workflow_complete` with `node: "A_ResolveInputs"`.
- next: → `A_Provision` (Make sure gh-pages exists and Pages serves it)

### 2. Make sure gh-pages exists and Pages serves it (`A_Provision`)

- Who: the `GitHub Pages` lane (role `github-pages`).
- Skill: `render-kg-to-github-pages`.
- What: Provisioning the target, owned by this process rather than by the publication step that calls it.
- Record it: `workflow_complete` with `node: "A_Provision"`.
- next: → `A_Stage` (Stage the rendering)

### 3. Stage the rendering (`A_Stage`)

- Who: the `Site Publisher` lane (role `site-publisher`).
- Skill: `render-kg-to-github-pages`.
- What: site.ts --root <instance> --out <dir> [--subgraph <id>]…: every JSON Schema and JSON-LD document at the IRI it names, the files as they sit, the README page as README.md (served as README.html), and index.html as a redirect to it — the default landing page, which an index.html or index.md at the ins
- Record it: `workflow_complete` with `node: "A_Stage"`.
- next: → `A_CheckStaged` (Check what was staged)

### 4. Check what was staged (`A_CheckStaged`)

- Who: the `Site Publisher` lane (role `site-publisher`).
- Skill: `render-kg-to-github-pages`.
- What: site.ts --check and readme-book.ts --check: every document at its address, no address taken by another file, every link on the page landing.
- Record it: `workflow_complete` with `node: "A_CheckStaged"`.
- next: → `GW_Staged` (Staged tree passes?)

### Decide — Staged tree passes? (`GW_Staged`)

- Call `workflow_complete` with `node: "GW_Staged"` and `outcome` set to the label that holds:
  - «yes» → `A_Deploy` (Deploy the rendering)
  - «no» → `A_Report` (Report the push: status and message)

### 5. Deploy the rendering (`A_Deploy`)

- Who: the `GitHub Pages` lane (role `github-pages`).
- Skill: `render-kg-to-github-pages`.
- What: publish-site.ts commits the staged tree onto gh-pages as a full replace (run by the instance's Pages workflow on a push to main, or by an agent with its own git credentials); GitHub Pages then builds it from the branch.
- Record it: `workflow_complete` with `node: "A_Deploy"`.
- next: → `A_CheckServed` (Check what is served)

### 6. Report the push: status and message (`A_Report`)

- Who: the `Site Publisher` lane (role `site-publisher`).
- Skill: `render-kg-to-github-pages`.
- What: pages-status.ts: pushed, not-pushed or could-not-determine, and one line — the commit, the root URL, and the QA of both the staging and what is served.
- Record it: `workflow_complete` with `node: "A_Report"`.
- next: → `GW_Pushed` (Status is pushed?)

### 7. Check what is served (`A_CheckServed`)

- Who: the `Site Publisher` lane (role `site-publisher`).
- Skill: `render-kg-to-github-pages`.
- What: Ask the root URL and every document address.
- Record it: `workflow_complete` with `node: "A_CheckServed"`.
- next: → `A_Report` (Report the push: status and message)

### Decide — Status is pushed? (`GW_Pushed`)

- Call `workflow_complete` with `node: "GW_Pushed"` and `outcome` set to the label that holds:
  - «yes» → `End_Pushed` (Pushed, and the message says what is live)
  - «no» → `End_NotPushed` (Not pushed, or could not tell, and the message says why)

## Done — Pushed, and the message says what is live (`End_Pushed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Not pushed, or could not tell, and the message says why (`End_NotPushed`)

- The instance completes here: Not a failure of the process: it ran, and its answer is that the rendering is not (or not demonstrably) live. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
