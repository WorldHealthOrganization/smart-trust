---
# folio-core-efv4
$schema: bean/1.0.0
title: 'folio-assistant-core has no tsconfig: its scripts/*.ts are typechecked by nobody'
status: completed
type: bug
priority: normal
created_at: 2026-10-10T16:11:04Z
updated_at: 2026-10-10T16:12:38Z
parent: folio-assistant-rwmf
---

Found by lane B on cat-harness-tools#59 (the cat-harness-tools half of lvoa is done; mirror closed), relayed by lane A of the 2026-10-10 bean-backlog drain.

folio-assistant-core declares no tsconfig.json, no typescript devDependency and no typecheck script, so its ~78 scripts/*.ts and its schemas/*.ts are typechecked by nobody: bun runs them without checking types.

## Done when
- [ ] tsconfig.json mirrors the cat-harness / cat-harness-tools one (strict, bundler resolution, bun-types)
- [ ] `bun run typecheck` exists and passes on main
- [ ] the errors it finds on first run are fixed, not suppressed


## Summary of Changes

Done 2026-10-10 by the bean-backlog drain (lane C).

- **`tsconfig.json`** uses the cat-harness / cat-harness-tools compiler options
  verbatim: strict, ES2022, bundler resolution, bun-types, noEmit,
  `allowImportingTsExtensions`. It includes `src`, `adapters`, `scripts`,
  `schemas`, `skills`, `tools`, `validators` and `test`, and excludes
  `*.e2e.ts`. It also includes `../cat-harness-tools/types/**/*.d.ts`, the
  `bpmn-moddle`/`dmn-moddle` declarations, because core imports harness
  modules that use them.
- **`package.json`** adds `scripts.typecheck` (`tsc -p tsconfig.json`) and the
  devDependencies it needs: `typescript` 6.0.3 (the harness's pin),
  `bun-types` and `@types/jsonld`.
- **The first run found 5 errors.** 4 were missing declarations, fixed by the
  two lines above. 1 was real: `scripts/review-coverage.test.ts:35` passed a
  `renamedFrom` field that `buildCoverage`'s `blocks` parameter does not
  declare. It is dropped from that literal; the fixture used where
  `BlockAnchor` requires it keeps it.
- `bun run typecheck` exits 0.

Not done here: wiring `typecheck` into CI. This repository has no PR
workflow (only `release-npm.yml`), so that is a separate decision.
