---
# cat-tools-d5j0
$schema: bean/1.0.0
title: 'subgraph:jsonld drops the `bootstrap` prefix from cat-harness''s ns/subgraph/v1.jsonld when the checkout holding cat-harness does not hold bootstrap, so the committed file reads as stale'
status: completed
type: bug
priority: normal
tags:
    - ci
    - jsonld
created_at: 2026-11-03T07:15:45Z
updated_at: 2026-11-04T06:54:25Z
parent: folio-assistant-1xhc
---

`gen-subgraph-jsonld.ts` writes cat-harness's `ns/subgraph/v1.jsonld` from `subgraphContext(prefixesInScope(root))`. Its set of own-namespace prefixes depends on which instances the checkout around `root` happens to hold, not on the declarations alone. When the checkout holding cat-harness does not also hold `bootstrap`, which cat-harness `needs`, the writer drops the `"bootstrap": "https://litlfred.github.io/bootstrap/v0/ns/"` term. `publish-check.ts` then reports cat-harness's committed file as a COMMITTED artefact that moved. Its remedy, "run `bun run cat subgraph:jsonld` and commit it", would be wrong: the committed file has the prefix and is correct for a full index.

## The failure, measured

Measured on 2026-11-03 in session https://claude.ai/code/session_01EucfRoX2s5Q9rHUMB8HHbH, with the layers cloned side by side as README §"Working on it from a plain clone" describes: cat-harness 1e9b973, cat-harness-tools 4c9daf5, bootstrap and bootstrap-tools at main. Running `bun cat-harness-tools/scripts/gen-subgraph-jsonld.ts` from the directory that holds them:

- It warns: "`bootstrap`, named in /home/user/cat-harness's `needs`, matches no instance in this checkout".
- `prefixesInScope("/home/user/cat-harness")` returns `["cat-harness"]`.
- `ns/subgraph/v1.jsonld` loses the `bootstrap` line. (It also loses `deprecated` and `isReplacedBy`, a separate and real staleness: eab1407 removed both from `buildContext`.)

## Cause

`prefixesInScope` starts from `checkoutRootFor(root)` and walks `needs` through `readInstanceDecls` of that checkout only. A `needs` name with no instance in it is skipped silently (`if (byName.has(m))`). In the sibling layout, `checkoutRootFor` stops at cat-harness's own `.git`, so the checkout is cat-harness alone. `readInstanceDecls("/home/user")` does find bootstrap, but nothing asks it. The same applies to any mount set that carries cat-harness without bootstrap.

`subgraphContext` then removes the prefix and expands every term defined through it to its full IRI. The N-Quads are unchanged, but the bytes are not, and both `--check` and publish-check compare bytes.

## Done when

- The context written for an instance is the same whatever else the checkout holds. A needed instance that is absent from the checkout still has its prefix in scope.
  - The obvious source for that prefix is `ownPrefixTable()`, which already has the stub. Another is the lock's record of the instance. The fix picks one and says why.
  - An absent needed instance must not be confused with a `needs` name that no table knows. That case stays a finding.
- A test builds the context for a fixture instance whose needed instance is absent from the checkout and asserts the needed prefix is still bound. It also asserts the result equals the context built with the needed instance present.
- In the sibling layout above, `bun run cat-harness-tools/scripts/publish-check.ts subgraph:jsonld` no longer reports `bootstrap` as a change to cat-harness's `ns/subgraph/v1.jsonld`.
- Other byte differences in that file are still reported, so the check stays strict. Today's real case is the `deprecated`/`isReplacedBy` drop, which is fixed by regenerating the file in cat-harness, not here.

*2026-11-04T06:54:25Z* — Fixed (session https://claude.ai/code/session_01EucfRoX2s5Q9rHUMB8HHbH). `prefixesInScope` keeps a needed instance the checkout does not hold when its name is an own prefix (`ownPrefixTable()`), with its stub taken as its name. Its own `needs` are not followed, because there is no declaration to read. A name that is no own prefix still binds nothing, and the generator's existing warning ("named in … `needs`, matches no instance in this checkout") still reports it.

- [x] Same context whatever else the checkout holds: `scripts/tests/subgraph-prefix-scope.test.ts` compares fixture checkouts with and without bootstrap. It fails 3 of 5 without the fix.
- [x] An unknown `needs` name stays out of scope and is still warned about.
- [x] Sibling layout, cat-harness main 5e07b09: the writer leaves `ns/subgraph/v1.jsonld` byte-identical. `publish-check.ts` itself cannot run there, because it calls `bun run cat` and needs a composed index's root `package.json`, so this was measured with the writer and not the gate.
- [x] Other byte differences still fail: nothing in `--check` or `publish-check` was relaxed.
