---
satisfies:
  - "req:content-lifecycle#test-before-publish"
input: schemas/skills/content-test/input.schema.json
output: schemas/skills/content-test/output.schema.json
---

# Content Testing

End-to-end testing of content artifacts in realistic scenarios.

## Responsibilities
- Execute test plans and test scripts
- Run the content type's own build, extraction, and verification checks (as
  specified by the layer that ships the content type)
- **Dispatch the repo's CI workflow on your branch and fold the result into
  the PR** — see below; a local build is not CI green
- Test cross-component integration
- Run regression tests against previous versions
- Document test results

## Running CI, not just assuming it

A local build runs on a warm cache, your toolchain and your flags; CI runs
cold on its own. A local green is evidence about your machine, not about the
branch.

Push, then dispatch the workflow against your branch
(`gh workflow run <workflow>.yml --ref <branch>`, or the `actions_run_trigger`
MCP tool), wait for it, and record **run URL + conclusion** in the PR body.
Red → fix and re-dispatch. If dispatch is refused for lack of `actions: write`,
say so in the PR and give the command a maintainer should run.

Also check **when CI last ran** (`actions_list` → `list_workflow_runs`): a
workflow nothing dispatches can sit red on `main` while the content it checks
stops building.

## A green build only covers what the target reaches

Before reading "build green" as a claim about the corpus, check what the build
target actually compiles. Build systems often default to **narrow roots**: the
target compiles its root plus whatever that root imports, not every source in
the directory. Where sources are *found* and what is *built* are separate
settings.

The check is cheap in any build system — count build artifacts against
sources. A ratio far from 1 means the green is scoped, and **any corpus-wide
number read off that build — open-obligation counts, coverage, warning totals
— is an undercount by construction.** Say what the build covered, not just
that it passed.

## Actors
- QC Reviewer (lead)
- Technical Modeller / Verification Specialist (supplied by the content-type layer)
- Business Analyst (scenario testing)

## Inputs
- Approved content artifacts
- Test plans and test data
- Expected outcomes / golden files

## Outputs
- Test results report
- Coverage metrics
- Regression comparison
- Issue list (if failures)

## Where the results go — not into a commit

A test run's results are **derived**: re-running the plan over the same tree
and data reproduces them. They are kept where every derived QA result is
kept — the orphan **`qa-reports`** branch, keyed by the
commit they were computed on (`main/<sha>/`, `pr/<n>/<sha>/`), written by
`bun run cat qa:publish` (the CI job `qa-publish`) and read back with `bun run
qa:fetch`. **Do not regenerate a results file in order to commit it.**

Two things a test run produces are not derived, and they stay on `main`:

- **A reviewer's judgement** of a case — an SME or QC reviewer's verdict, an
  agent's adjudication — goes to `test/attestations/` (`qa-attestations/v1`),
  because no re-run can reproduce it.
- **A certification** — an accountable decision taken on a plan's rollup —
  also stays on `main`, beside the attestations, and is then signed through
  `qa-report-signing` (opt-in `cat-harness.sdlc`).

"Regression comparison" against a previous version is a comparison against
its **stored** results: `--against <ref>` on a gate, or `qa:fetch --ref` for a
report. A previous version with no stored entry is UNKNOWN — say so; never
read it as "no regressions".
