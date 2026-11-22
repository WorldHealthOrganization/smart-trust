---
# folio-assistant-1s5s
$schema: bean/1.0.0
title: The published package's PYTHON half runs nowhere — CI's pytest job globs a directory that does not contain it
status: completed
type: task
priority: normal
created_at: 2026-09-26T09:13:49Z
updated_at: 2026-09-26T10:38:03Z
parent: folio-assistant-1xhc
---

Split out of `rsi6` 2026-09-26. **That bean was closed `completed` carrying two
unchecked boxes**, which the store's own rule forbids — "ONLY if the bean has
no unchecked todo items left". Recorded here rather than quietly re-ticked,
because a completed bean holding live work is exactly the shape that makes the
store unreadable, and this session has spent the day filing that class against
other people's records.

## The measurement

`@litlfred/block-qa-schema` ships a Python half — `python/block_qa_schema/` —
with a **300-line, 17-test** suite at `tests/test_python.py`. It runs nowhere.

The `Python unused/wildcard imports (hard)` job in `code-quality-gates.yml`
ends with a step named *"Python tests"*, and its glob is:

    cat-harness/scripts/tests/*.test.py

The package's tests are at `cat-harness/schemas/block-qa-schema/tests/` and are
named `test_python.py`, so they fail the glob on BOTH the directory and the
naming convention. Neither half of the package was reachable by CI until
`check:published-packages` landed, and that gate runs `bun run test` — the
JavaScript half only.

## Why it is not fixed with its sibling

The JS half's fix was inside a gate this session owns. This one changes the
**Python job's own step** — a different job, and one whose glob other packages
may rely on. Widening it is a decision about what that job is for, not a
repair, and the repo's rule is not to widen someone else's gate unasked.

Two shapes are plausible and they are not equivalent:

- teach the Python job to discover tests the way `check:published-packages`
  discovers packages — from the git index, per publishable package;
- or give `check:published-packages` a Python arm, so one gate owns "the
  packages this repo ships work", in both languages.

The second keeps the question in one place and is probably right. It also
needs `pytest` on the runner for that step, which the Python job already
installs and the TypeScript job does not.

## Done when

- [x] `tests/test_python.py` runs in CI, and its tests are counted — **18**,
      not the 17 this bean claimed; three are `@parametrize`d two ways.
      Re-derived from `python3 -m pytest -q`, not quoted. They all pass, and
      always would have: the suite was never broken, only unreachable.
- [x] Verified by BREAKING it — three ways, since one break only exercises one
      of the three ways this can read green over nothing. See §"Falsified" below.
- [x] Whichever job owns it says so in a comment — BOTH do. The `typescript`
      job's new `setup-python` step explains why a TypeScript job installs
      Python; the `python` job's test step now opens by saying it is for this
      repository's own scripts and NOT for published packages, which is where
      the next person will look first and where the wrong repair suggests
      itself.

## The second box `rsi6` carried, recorded and NOT actioned

Whether a published package should be **version-checked against the platform
it ships beside**: `block-qa-schema` pins `typescript ^7` while the root pins
`^6`. That divergence is what made the `rsi6` breakage possible. It is a
policy question — must a shipped package track the platform's toolchain, or is
independence the point of publishing it? — and nobody has been asked.


## The premise in this bean was WRONG, and it changed the answer

This bean said shape 2 "needs pytest on the runner for that step, **which the
Python job already installs**". It does not. Measured 2026-09-26 against
`.github/workflows/code-quality-gates.yml`:

- the `python-imports` job installs `ruff` and `requirements.txt` — grep for
  `pytest` across the whole workflow file returns **nothing**;
- its test step runs each file as a **bare script**: `python3 "$t"`;
- `requirements.txt` is GENERATED from `schemas/python-deps.ts` (bean `68dt`)
  and carries neither `pytest` nor `pydantic`.

That does not merely make shape 1 inferior — it makes it **non-functional, in
the exact way this bean exists to prevent**. `test_python.py` has no `__main__`
runner and uses `pytest.raises` and `@pytest.mark.parametrize`. Run as
`python3 test_python.py` it either dies on `import pytest` or — with pytest
present — defines eighteen functions, executes **none**, and exits **0**.
Widening the glob would have reported a pass it never computed: the `5rfy`
gate-that-never-fires shape, which is what `rsi6` and `1s5s` are both about.

So shape 2 was taken, and the reason is stronger than "probably right".

## What landed

- `check-published-packages.ts` now discovers `pyproject.toml` from the git
  index alongside `package.json`. One directory shipping to both registries is
  **two entries and two verdicts** — the halves fail independently, which is
  this bean's own finding, so a single verdict would let the npm half vouch
  for the Python one.
- Nothing about a runner is hardcoded. A package declares pytest by carrying
  `[tool.pytest.ini_options]`, and declares its test dependencies under
  `[project.optional-dependencies] test`, which is what the gate installs. A
  package declaring neither is reported, not guessed at.
- PEP 621 has no `private` flag, so the Python exclusion honours the
  `Private ::` classifier convention rather than inventing a field nobody writes.
- An absent interpreter is a **FINDING, not a skip** — "python3 is not here"
  and "the Python half passed" must never render identically.
- `actions/setup-python@v7` added to the `typescript` job, where the gate runs.
- 12 new tests at `cat-harness/scripts/tests/published-packages.test.ts` over
  the discovery, with git-repo fixtures rather than a mocked `git ls-files` —
  a mock would test the mock, and "what git accounts for" IS the contract.

## Falsified

Each break run against the real gate, then reverted and re-confirmed green:

1. **A failing Python assertion** → exit 1; the assertion text is quoted in the
   tail, `1 failed, 18 passed`.
2. **pytest collects nothing** (tests file hidden) → exit 1, exit code **5**,
   glossed in the output as `COLLECTED NO TESTS`. This is the `vitest run`
   "No test files found" false-green in another costume — the one `rsi6` found
   the hard way — so it is named rather than left as a bare exit code.
3. **No `python3` on PATH** (run under a minimal PATH holding only bun/git/sh)
   → exit 1, reported as `could not prepare`, not as a skip.

And the tests were falsified too, since a test that cannot fail is the same
defect one level up: breaking the `Private ::` exclusion fails exactly the
`Private ::` test; replacing `git ls-files` with a filesystem walk fails
exactly the `ramz`-rule test. Nothing else moved in either run.

## Split out

Bean `872t` — the Python half's **wheel build** is still unchecked, so the two
halves are guarded unequally. Recorded rather than decided: it costs a second
install on every PR, and the real argument for it is that the tests import from
`pythonpath` rather than from the built wheel, so a wheel whose `force-include`d
schema files went missing would pass every test there is.


## Summary of Changes

Merged to `main` as `804866262a8` (PR #1391).

- `check-published-packages.ts` discovers `pyproject.toml` from the git index
  alongside `package.json`; one directory shipping to both registries yields
  **two entries and two verdicts**.
- Runner and dependencies are read from the package, never hardcoded:
  `[tool.pytest.ini_options]` declares pytest, `[project.optional-dependencies]
  test` declares what gets installed. `Private ::` honoured for the PEP 621
  exclusion. An absent interpreter is a FINDING, not a skip.
- `actions/setup-python@v7` added to the `typescript` job; scoping comments in
  both jobs, the `python` job's leading.
- 12 discovery tests over git-repo fixtures.

Verified: merged-tree `bun run cat gates` **152 of 154** with no tree-guard finding;
CI 9 green including e2e. The 2 local / 1 CI red is the `t8g3` drift held red on
`main` by decision (#1384), not this work.

Corrected here rather than quietly: this bean said the Python job "already
installs" pytest — it does not — and said the suite was 17 tests — it is 18.

Split out and NOT actioned: `872t` (the Python half's wheel build is still
unchecked) and `m5gx` (a red test at step 5 makes 149 gate commands unreachable
in CI, which is why this bean's own gate is locally verified and not
runner-verified). This bean's second recorded box — version-pinning a published
package against the platform — remains the owner's and unasked.
