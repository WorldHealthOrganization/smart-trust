---
# folio-assistant-w82m
$schema: bean/1.0.0
title: 'TEST COST: kg-export ''a preview says so'' builds the export twice and sits at bun''s 5 s timeout (fails alone, locally, on main too)'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T16:56:12Z
updated_at: 2026-09-23T16:59:22Z
parent: folio-assistant-1xhc
---

Measured 2026-09-23. The test `kg export > a preview says so in its type and links every node back to canonical` (`cat-harness/scripts/tests/kg-export.test.ts:440`) calls `buildExport()` twice, once for the preview and once for canonical, with nothing cached. On a session container it takes about 5.2 s when run alone. That is over bun's default 5 s test timeout, and the same on `main` (`04b8ed02`) as on a feature branch. Run as part of the whole file, it passes, because earlier tests warm the build. So `bun run cat gates` fails locally on this test alone while CI, on faster runners, passes it.

It is not a flake. It is a test whose cost is right at its limit, and every new KG node pushes it closer.

## Done when
- [x] the test shares one canonical export with the other tests in the file (computed once in `beforeAll`), or declares a timeout with the reason written beside it
- [x] `bun test cat-harness/scripts/tests/kg-export.test.ts -t 'a preview says so'` passes alone on a session container

## Summary of Changes

The test now reads the shared canonical `EXPORT` fixture (module level, the file's existing one — the same thing `beforeAll` would have held) instead of calling `buildExport()` a second time. The seven source-provenance tests did the same full rebuild each, only ever reading the default export, and now share it too.

Measured on a session container, 2026-09-23:

| run | before | after |
|---|---|---|
| `-t 'a preview says so'` alone (includes the fixture build) | 8.68 s | 4.29 s |
| whole `kg-export.test.ts` | 26.51 s | 13.25 s |

50 pass, 0 fail, 6,256 expect() calls — unchanged. No timeout was raised: the cost was removed rather than allowed.
