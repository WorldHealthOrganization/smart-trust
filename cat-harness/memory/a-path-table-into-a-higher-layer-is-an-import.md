---
$schema: folio-memory/v1
id: a-path-table-into-a-higher-layer-is-an-import
label: trap
summary: "a table of `../<instance>/…` module paths is an upward import no static gate sees — invert it into the higher instance's declaration"
createdAt: 2026-09-30
references:
  - kind: agent
    id: platform-boundary-guard
archived: true
---
> **Archived on arrival, for budget, not relevance.** `platform-boundary-guard`'s
> injected `MEMORY.md` had 2 lines of headroom under the 200-line cut (198
> measured, 2026-09-30); injecting this pushed an existing TRAP past it. Which
> entry makes way is a call for whoever owns the agent, so this stays a node in
> the `memory` graph and out of the prompt until then.

`cat-harness/src/builtin-adapters.ts` held a relative path into the science harness's
`adapters/paper/index.ts` and one into the content harness's `adapters/document/index.ts`,
both layers above it, loaded by a VARIABLE
`import(abs)`. With the static axis measured at 0, it was still the edge that kept
cat-harness from lifting into its own repository — and `check:partition`,
`kg:detangle:direction` and `check:reference-direction` were all green over it.

**Fix shape (work item `p11x`)**: the higher instance DECLARES what it ships
(`contentAdapters` in its `<instance>.json`), the lower one DISCOVERS it
(`instanceRootsIn`), and any ordering the table encoded by row position becomes
a declared fact (`extends`). No instance name remains in the harness.

**Gate**: `bun run cat check:import-direction --all`. It flags `../<instance>/…`
module-path literals as well as specifiers, and prints `import(expr)` as
could-not-determine. Re-measure; never quote its counts.
