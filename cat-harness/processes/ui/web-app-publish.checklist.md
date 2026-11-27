<!-- GENERATED from cat-harness/processes/ui/web-app-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Publish a web app — declared, translated, built at its own route

> **Generated, and not the authority.** This is `cat-harness/processes/ui/web-app-publish.bpmn` (process `Process_WebAppPublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How any layer publishes an interactive app it holds as source, without becoming a harness.

## Begin — App source committed in a layer (`Start_Process_WebAppPublish`)

- Begin here.
- Call `workflow_start` with `process: "Process_WebAppPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Declare` (Declare the web-app directory)

### 1. Declare the web-app directory (`A_Declare`)

- Who: the `App author` lane (role `author`).
- Skill: `web-apps`.
- What: The layer declares a directory of kind `web-app` in its `<name>.json` and puts a `web-app.json` (`web-app/0.1.0`) at its root: id, title, description, how it builds, the languages it ships (the site's six UN languages: ar, en, es, fr, ru, zh), the layer directories it reads at build time (`contentFr
- Record it: `workflow_complete` with `node: "A_Declare"`.
- next: → `A_Extract` (Extract the app's translation templates)

### 2. Extract the app's translation templates (`A_Extract`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `web-apps`.
- What: Tool `web-app-build` (`web-apps:build --extract`): the catalog becomes `translations/<locale>/apps/<id>.pot` in the declaring layer, one `ui-string` entry per key with the key as `msgctxt`.
- Record it: `workflow_complete` with `node: "A_Extract"`.
- next: → `Call_Translate` (Translate into each locale)

### 3. Translate into each locale (`Call_Translate`)

- Who: the `Translators` lane (role `translation-source-lead`).
- What: The harness's multi-locale translation, unchanged: the templates are merged into each locale's `.po`, new and fuzzy strings are translated with the fixed terms, the gates run, and each locale is its own PR.
- A subprocess (`Process_MultiLocaleTranslation`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Check` (Check the declaration and translations)

### 4. Check the declaration and translations (`A_Check`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `web-apps`.
- What: Tool `web-app-build` (`web-apps:build --check`): the manifest parses, `package.json` has the build script, a lockfile pins exact versions, no two layers claim one app id, every template is current, and no translation drops or adds a `{placeholder}`.
- Record it: `workflow_complete` with `node: "A_Check"`.
- next: → `GW_Valid` (Declaration and translations valid?)

### Decide — Declaration and translations valid? (`GW_Valid`)

- Answered by the check's exit code.
- Call `workflow_complete` with `node: "GW_Valid"` and `outcome` set to the label that holds:
  - «yes» → `A_Build` (Build into its own chrome-less route)
  - «no» → `A_Fix` (Fix the declaration or the catalog)

### 5. Build into its own chrome-less route (`A_Build`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `web-apps`.
- What: Tool `web-app-build` (`web-apps:build`, run with the other declared visualiser writers): each locale's strings are written to `<i18n.out>/<locale>.json` from the `.po` (building is the injection), the app installs from its lockfile and builds, and the build is copied to `<locale>/<harness>/apps/<id>
- Record it: `workflow_complete` with `node: "A_Build"`.
- next: → `A_Size` (Review the size against its budget)

### 6. Fix the declaration or the catalog (`A_Fix`)

- Who: the `App author` lane (role `author`).
- Skill: `web-apps`.
- What: The author fixes what the check named (the manifest, the lockfile, a clashing id, a stale template) and commits again.
- Record it: `workflow_complete` with `node: "A_Fix"`.
- next: → `A_Extract` (Extract the app's translation templates)

### 7. Review the size against its budget (`A_Size`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `web-apps`.
- What: The index flags an app over its `sizeBudgetMB`; the site size review reads it with the rest of the site.
- Record it: `workflow_complete` with `node: "A_Size"`.
- next: → `End_Process_WebAppPublish` (App published at its own route)

## Done — App published at its own route (`End_Process_WebAppPublish`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
