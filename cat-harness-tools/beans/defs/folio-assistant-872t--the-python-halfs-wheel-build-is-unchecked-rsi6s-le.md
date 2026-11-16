---
# folio-assistant-872t
$schema: bean/1.0.0
title: The Python half's WHEEL BUILD is unchecked — rsi6's lesson applied to only one of the two halves
status: completed
type: task
priority: normal
created_at: 2026-09-26T09:53:40Z
updated_at: 2026-10-09T11:36:00Z
parent: folio-assistant-1xhc
---

Split out of `1s5s` 2026-09-26, while wiring the Python half into
`check:published-packages`. Recorded rather than decided, because the answer
costs something on every CI run and nobody has been asked.

## The asymmetry

`rsi6`'s finding was that **a package that ships and is not built lands green
and broken** — measured, not predicted: PR #914 bumped `typescript` 5.9.3 →
7.0.2, passed ten checks, and left `@litlfred/block-qa-schema` unbuildable.

`1s5s` extended the gate to the package's Python half. It now runs that half's
**tests** — 18, via `python3 -m pytest`, discovered from `pyproject.toml`.
It does **not** build it. So the two halves are now guarded unequally:

| half | build checked | tests checked |
|---|---|---|
| npm  | yes — `bun run build` (tsup + tsc) | yes — `bun run test` |
| PyPI | **no**                             | yes — `python3 -m pytest` |

The gate reports that absence in its `skipped` channel rather than passing
over it, which is why this is a recorded question and not a hidden one.

## Why it was not just done

A wheel build needs `python3 -m build` (plus `hatchling`) on the runner, in the
`typescript` job, which until today had no Python at all. That is a second
install on every PR for a question nobody has asked, and the repo's rule is not
to widen a gate's cost unasked.

There is also a real argument it is unnecessary here: `pyproject.toml` uses
`hatchling` with a pure-Python `packages = ["python/block_qa_schema"]` plus two
`force-include`d JSON files. Nothing compiles, so the class of breakage `rsi6`
found — a toolchain bump reaching into compiler internals — has no analogue on
this side. The counter-argument is that `force-include` silently ships nothing
if a path moves, and the tests import `block_qa_schema` from `pythonpath`
rather than from the built wheel, so a wheel missing its schema files would
pass every test that exists.

**That last sentence is the whole case**, and it is the `rsi6` shape exactly:
the thing under test is not the thing that ships.

## Done when

[x] A decision is recorded either way — build the wheel in CI, or state why
    the Python half does not need it, with the `force-include` risk named.
[-] If built: verified by BREAKING it — move or rename one `force-include`d
    schema path and confirm the job goes red. A build that emits an empty
    wheel exits 0. (N/A — decision made not to build wheel in CI).
[x] If not built: the gate's `skipped` line for this package says WHY, so the
    next reader does not re-open the question from scratch.

## Not in scope

Whether a published package should be version-checked against the platform it
ships beside (`typescript ^7` here vs root `^6`) — that is `1s5s`'s second
recorded box and is the owner's, still unasked.

## Closed 2026-10-09

- **Decision**: The Python half does not build a wheel in CI. It is a pure-Python package using `hatchling` (no C extensions or compilation steps) whose test suite runs via `pytest`. Requiring a wheel build in CI would require installing `build` and `hatchling` in the runner's environment on every CI run for little benefit over pytest.
- **Risk noted**: The `force-include` schemas in `pyproject.toml` remain unverified by the build step; if a referenced schema path moves, the wheel could omit it while pytest tests against `pythonpath` still pass.
- **Gate updated**: `check-published-packages.ts` was updated so when `pkg.build === undefined` for a PyPI package, the skipped message specifically explains:
  `block-qa-schema [pypi] (cat-harness/schemas/block-qa-schema) — no \`build\` step (pure-Python hatchling; force-include schemas unverified by build)`
- **Verification**:
  - `bun test scripts/tests/published-packages.test.ts` passed (15 pass, 0 fail).
  - `bun scripts/check-published-packages.ts` reports the explicit skip explanation.
  - Code changes committed in `cat-harness-tools` as commit `4de70ac`.
