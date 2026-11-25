---
# cat-tools-q8gk
$schema: bean/1.0.0
title: 'SECURITY GATE ALWAYS REFUSES OUTSIDE THE COMPOSED ROOT: materialized-fixity is pinned to a folio-assistant-core script, and four checks crash or go undetermined from a layer checkout'
status: completed
type: bug
priority: normal
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-10-31T08:50:00Z
parent: cat-tools-sr31
---

RED FLAG category: `false-green` (here a false red). Severity: minor. QA.

From a cat-harness-tools checkout composed only with itself (2026-10-31), `bun run cat-harness-tools/scripts/security-gate.ts` prints `REFUSED — 7 blocking check(s) failed or could not be run`:

- `check:materialized-fixity` is pinned in `PINNED_CHECK_COMMANDS` (`security-gate.ts:107`) to `folio-assistant-core/scripts/check-materialized-fixity.ts`, a script no layer manifest declares. It is `unknown` everywhere except a full composition.
- `check:secret-leaks` and `check:qa-reviewer-permission` fail to import `@litlfred/bootstrap-tools/schemas/release-iri.ts`.
- `check:bun-pin` throws ENOENT from `scandir` (`check-bun-pin.ts:135`) instead of reporting `unknown`.
- `check:dependency-advisories` runs `bun audit` in the parent directory, which has no package.json.

So a layer cannot run its own release security gate, and `bun audit` findings in the layer (cat-tools-d3vq) are invisible to it.

## Done when

- [x] Each check either runs from a layer checkout or reports a named `unknown` without a stack trace.
- [x] materialized-fixity is resolved from whichever layer declares it, not a hard-coded path.
