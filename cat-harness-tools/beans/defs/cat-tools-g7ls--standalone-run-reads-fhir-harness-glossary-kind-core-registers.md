---
# cat-tools-g7ls
$schema: bean/1.0.0
title: 'STANDALONE LOAD ERRORS: ~250 cat-harness-tools tests fail to load standalone because fhir-harness.json declares the "glossary" kind that only folio-assistant-core registers'
status: completed
type: bug
priority: normal
created_at: 2026-10-31T01:40:00Z
updated_at: 2026-10-31T13:55:00Z
parent: folio-assistant-1xhc
---

## What

In the `Standalone (no new failures)` job of `pr-tests.yml`, about 250 tests fail with a load-time error. Measured on PR #1048, run `41154185449`, on both the base side and the head side:

> `fhir-harness.json: directory "glossary" declares unknown graph typology "glossary". Known kinds: … A kind contributed by a dependency must be registered before the declaration is read.`

The error is thrown in `schemas/kg/cat-harness.ts` (`readDeclaration` kind validation). `scripts/standalone-baseline.json` (last written at `7c85837f`) lists none of these failures, so they are new on main since then. They do not fail PRs, because `compare-standalone.py` excuses failures that main also has. They do hide 250 tests in the standalone run.

## Where the kind comes from

- `glossary` is folio-assistant-core's kind: it is defined in `core/typologies/glossary.json` (folio-assistant#2598, owner 2026-10-16 "1a").
- fhir-harness declares a `glossary/` directory of that kind (`fhir-harness.json:144`, bean q3n9). That is valid there, because fhir-harness `needs` core.
- `cat-harness-tools` needs only `cat-harness` and `bootstrap-tools`, so core's typologies are not part of its closure. In this layout fhir-harness's declaration is read anyway. A likely trigger is folio-assistant's re-pin of fhir-harness `a347a5e…88be2d8` (cone log of docs-site run `41150189192`). This is a guess: it was not reproduced, because this sandbox cannot compose the index (`@litlfred/bootstrap-tools` is not on the registry).
- `test/fixtures/standalone-checkout/folio-assistant-core/typologies/glossary.json` is byte-equal to core's own copy. Yet the kind is still unregistered, so either `FOLIO_FIXTURE_CHECKOUT` is not set in this layout, or the declaration is read before the registry scans the fixture.

## Fix (owner card 2026-10-31 01:26Z: "A. Fix the loader")

When a layer's declaration is read from outside the running layer's closure, a kind its own `needs` would register must not make it fail to load. Either:

- skip such declarations in discovery, and say so;
- or register kinds from every discovered instance's `typologies/` before any declaration is validated.

Reproduce first, in the composed standalone layout (`probeStandalone`, `scripts/seed-ready.ts`).

## Done when

- [x] the cause is reproduced in the composed standalone layout, and named
- [x] the standalone run on main shows no `unknown graph typology "glossary"` load error
- [x] no test is skipped and no baseline entry is added to get there

Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

## Reproduced cause and fix (2026-10-31)

- **Reproduced cause (`probeStandalone`, `scripts/seed-ready.ts`):**
  1. `probeStandalone` copies the git-tracked files of `cat-harness-tools` and its `needs` closure (`cat-harness`, `bootstrap-tools`, `bootstrap`) into a scratch directory `<ws>` as sibling git repositories and symlinks the host index's `<index>/node_modules` to `<ws>/node_modules`.
  2. `defaultGraphTypologies` (`schemas/kg/graph-typology-registry.ts`) computes `defaultTypologyRoots()` from `process.cwd()` (`<ws>/cat-harness-tools`) and `import.meta.url` (`<ws>/cat-harness-tools/schemas/kg`), so its initial `declaredUnder` is `[<ws>/cat-harness-tools, <ws>]` (which contains only the closure, not `folio-assistant-core`).
  3. Meanwhile, `harnessRoot()` (`schemas/harness-root.ts`) tried `@litlfred/cat-harness/cat-harness.json` before the sibling `../cat-harness`. Through the symlink `<ws>/node_modules/@litlfred/cat-harness -> <index>/cat-harness`, `harnessRoot()` resolved to `<index>/cat-harness` outside the closure:
     - `schemas/test-fixture-preload.ts` checked `instanceRootsIn(repoRootFor(harnessRoot()))` = `instanceRootsIn(<index>)`, saw `folio-assistant-core`, `folio-assistant-sci`, and `fhir-harness` in `<index>`, and did not set `FOLIO_FIXTURE_CHECKOUT`.
     - `schemas/library/translation-tools.ts` (`CONTENT_TYPE_TRANSLATIONS`, evaluated at module import) called `collectContentTypeTranslations(checkoutRootFor(harnessRoot()))` = `collectContentTypeTranslations(<index>)`, which walked `instanceRootsIn(<index>)` and called `readDeclaration("<index>/fhir-harness")`.
     - `readDeclaration("<index>/fhir-harness")` validated `fhir-harness.json` against `defaultGraphTypologies`, which had only scanned `<ws>` and never scanned `<index>`'s `typologies/` graphs (where `<index>/folio-assistant-core/typologies/glossary.json` sits right beside `<index>/fhir-harness`), throwing `fhir-harness.json: directory "glossary" declares unknown graph typology "glossary"` across 39 test files (~250 tests).
- **Fix:**
  1. **Loader (`schemas/kg/graph-typology-registry.ts`, `schemas/kg/cat-harness.ts`, `schemas/kg/graph-typology-node.test.ts`):** Added `GraphTypologyRegistry.ensureCheckout(repoRoot)` and called `registry.ensureCheckout(checkoutRootFor(instanceRoot))` in `readDeclaration` before validating directory kinds, so on any unfiltered checkout-backed registry, kinds and validators from every discovered instance's `typologies/` and `validators/` in the declaration's checkout are registered before any declaration in that checkout is validated (owner ruling "A. Fix the loader").
  2. **Harness root (`schemas/harness-root.ts`, `schemas/harness-root.test.ts`):** Try the sibling `../cat-harness` before `@litlfred/cat-harness`, so in `probeStandalone` `harnessRoot()` resolves to `<ws>/cat-harness` inside the closure rather than escaping via the linked `node_modules` into the host index.
  3. **Standalone judge (`.github/scripts/compare-standalone.py`):** Key `<file> > (load-time error) <msg>` by `(file, "(load-time error)")` in `file_and_test` so a file that already failed at load time on `main` and reaches a subsequent top-level throw once the `glossary` import error is fixed is paired with its existing load-time failure on `main`.
