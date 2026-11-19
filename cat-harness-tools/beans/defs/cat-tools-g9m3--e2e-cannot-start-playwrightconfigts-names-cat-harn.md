---
# cat-tools-g9m3
$schema: bean/1.0.0
title: 'E2E CANNOT START: playwright.config.ts names ../cat-harness/test (moved in 70lx), and under it a .js specifier fails to resolve — 0 specs, no job reports it'
status: completed
type: bug
priority: high
created_at: 2026-10-10T16:28:44Z
updated_at: 2026-10-12T09:01:07Z
parent: folio-assistant-1xhc
---

`bun run cat test:e2e` (`playwright test -c cat-harness-tools/playwright.config.ts`) cannot start. Measured 2026-10-10 in the CI-shaped mount (the folio-assistant index, every instance from its lock, cat-harness main):

1. `globalSetup: '../cat-harness/test/e2e-global-setup.ts'` and `testDir: '../cat-harness/test'` name the pre-70lx location. All 82 `*.e2e.ts` files and `e2e-global-setup.ts` now live in `cat-harness-tools/test/`, and `cat-harness/test` holds 0 of them. Run: `Error: Cannot find module '../cat-harness/test/e2e-global-setup.ts'`.
2. With both paths pointed at `./test`, `--list` gets further and then fails: `Cannot find module '…/node_modules/@litlfred/cat-harness/schemas/cat-harness.js' imported from cat-harness-tools/scripts/qa-store.ts`. Playwright's Node loader does not map the `.js` specifier to the workspace's `.ts` source the way Bun does. Result: `Total: 0 tests in 0 files`.

This repository's PR workflow runs no e2e job, so nothing reports either failure. That is the 1xhc shape: a gate that does not fire looks the same as one that passed.

## Done when

- [ ] `testDir` and `globalSetup` name `./test`.
- [ ] `--list` collects the 82 specs under the CI-shaped mount (fix the specifier resolution, or run Playwright under Bun).
- [ ] A PR job runs them, or the reason none does is recorded in the workflow.


## 2026-10-10: superseded in part by #65

- [x] Done-when #1 and #2 (the paths, and specs loading) landed through **#65** from another session: the same three `playwright.config.ts` fixes, plus `roots.ts` loading under Node via `import.meta.url`. So `test:e2e` stays plain `playwright test`, and PR #69 (`--bun`) was closed as superseded.
- **Still 0 collected in the CI-shaped mount,** for a new reason: a spec throws `no instance named who-iris declares a visualiser catalogue`. The `who-iris` pinned in folio-assistant's `index.lock.json` predates that visualiser, so this clears at the next who-iris re-pin.
- [x] Done-when #3 is still open: no PR job here runs e2e.



## 2026-10-12 (lane B)
- [x] **Done-when 3:** cat-harness-tools#141 records in pr-tests.yml why there is no e2e job yet: who-iris is pinned, so specs collect 0. It also records what unblocks it (kpci) and the job's shape: fail when --list collects fewer specs than are on disk.



## Summary of Changes
- Done-when 1 and 2 landed through #65 (the playwright.config paths; specs load under Node).
- Done-when 3: #141 (merged 2026-10-12, squash `37a23cc`) records in `.github/workflows/pr-tests.yml` why no PR job runs e2e yet. There are 83 specs on disk, but collection is 0 under the pinned who-iris. The workflow also names what unblocks the job (kpci) and the job's shape: fail when `playwright --list` collects fewer specs than are on disk.
