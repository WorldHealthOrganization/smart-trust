---
# folio-assistant-jh2j
$schema: bean/1.0.0
title: 'TOOL 7/13: Task_Render — LaTeX / PDF rendering (16 files, 3 entry points)'
status: completed
type: task
priority: normal
created_at: 2026-09-20T04:34:56Z
updated_at: 2026-10-08T08:05:00Z
parent: folio-assistant-d308
---

Group 7 of 13 in `d308`. **16 files, 3 entry points.**

`render-latex`, `generate-block-tex`, `generate-main-tex`, `latex-preflight`,
`latex-overfull-report`, `audit-tex-source`, `validate-tex`, `latexmk-compile`,
`render-changed-blocks`, `render-on-change`, `render-pre-commit`,
`render-discovery`, `render-value`, `headless-render-qc`, `refresh-authors-note`,
`scripts/render-tex/`.

**BPMN:** `authoring-a-paper · Task_Render`, `serviceTask`, refs
`latex-authoring`. Note `authoring-a-document · Task_Render` is a DIFFERENT
step — the document render path takes no TeX (see `content-profiles`), so a
single Tool must not claim both.

**Target repo (#223):** `folio-asst-sci`, together with `deploy/` and
`scripts/docker-latex-build/` (5 HOST files that render TeX in a container).

## Done when

**One checklist, and this is it.** A ticked restatement used to sit at the bottom
of this bean under `### Done when` while these items read open — the
`shadow-checklist` shape, which `check:bean-bodies` failed on 2026-09-26. The
section a reader and every tool consult said "not done" about work that had
landed six days earlier. Merged upward rather than re-ticked in place, because a
second checklist is free to disagree with the first and this one did.

- [x] a Tool node for the TeX render path — **three**, with `satisfies` read
      from the script bodies rather than assumed
- [x] the render path's `satisfies` is settled: **`latex-validation`**, and
      `latex-authoring` is **WITHDRAWN with its reason** rather than quietly
      reworded. This item originally read *"`satisfies` includes
      `latex-authoring`"* — a presumed answer, and the wrong one. That skill's
      contract requires `documentClass` and `mainFile`, what you are AUTHORING,
      and nothing in the corpus accepts either (`generate-main-tex` takes
      `--preamble`, `--chapters-dir`, `--out`). Forcing the edge would make the
      node lie about its interface. Same shape as `proof-verification` one group
      over, and the argument is in `tools/index.ts` at the TeX group.
      `latex-validation` matches the two nodes exactly and has no contract to
      contradict.
- [x] it does NOT claim `authoring-a-document · Task_Render` — none of the three does
- [x] `requires` honest — `chromium` on the Playwright one, `bun` on the others;
      `--compile` notes that pdflatex is NOT claimed by the base `requires`
- [x] `tool-coverage` reflects it — `rendered-verification` left the uncovered list
- [x] **the exit-2 contract across the family** — owner's call, Finding 1
- [x] **a skill for compiling, or `latexmk-compile.sh` recorded as unsatisfiable** — owner's call, Finding 2

---

## 2026-09-20: two nodes, and `latex-authoring` is the second unsatisfiable contract

`latex-preflight` and `latex-overfull` satisfy **`latex-validation`**, which matches
them exactly — *"validate LaTeX source files for syntactic correctness, structural
consistency, and adherence to project conventions"* — and has no contract to
contradict. Complementary rather than alternative: one stops a compile from
failing, the other reports a defect in a compile that succeeded.

### `latex-authoring` has a contract and no mechanism — the second instance

Its contract requires **`documentClass`** and **`mainFile`**: what you are
AUTHORING. Nothing in the corpus accepts either — `generate-main-tex` takes
`--preamble`, `--chapters-dir` and `--out`.

That is the same shape as `proof-verification` one group over, whose contract
requires `projectRoot` and finds no taker. Two instances make it a pattern worth
naming:

> **An authoring skill's contract names the artefact being created. The corpus has
> checking mechanisms.** A contract written from the authoring side does not become
> satisfiable by pointing a checker at it, and forcing the edge would make the node
> lie about its interface.

So this is a **corpus gap, not a graph gap**, in both cases. Closing either needs a
Tool that actually authors — one that takes a `documentClass` and a `mainFile`, or
a `projectRoot`. Neither exists, and inventing a `satisfies` edge would hide that.

### Running them caught a gap in my own node

Both refuse cleanly with exit **2** — could-not-determine, verified by reading the
message rather than inferring from the code:

- `latex-preflight`: *"main.tex not found … Generate it first"*
- `latex-overfull`: *"usage: latex-overfull-report.ts \<main.log\> [--min N] …"*

That second message revealed the log is a **required positional**, which my first
draft of the node did not declare — it listed only the flags, which would have told
a caller the log was optional and sent them to a usage error. Found by running the
command, not by reading it. Fixed before the node shipped.

`requires` distinguishes the two deliberately: preflight reads SOURCE and needs no
TeX distribution; overfull reads a LOG and so needs a build to have happened.
Stated so a caller does not assume both have the same prerequisites.

### Falsifier

`latex-validation` left `tools:coverage`'s uncovered tiers. Verified: typecheck,
`check:tools`, 3310 tests with 0 failures, 46 gates — the whole set.

### Still open on this bean

`latex-authoring` (the unsatisfiable contract above), and the remaining TeX
scripts — `validate-tex`, `audit-tex-source`, `latexmk-compile`, `render-latex`,
`generate-block-tex`, `generate-main-tex`, `headless-render-qc`.

_2026-09-26T03:34:29Z_ — Claimed by claude/fervent-mccarthy-nw4olk — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

---

## 2026-09-26 — the remaining seven, read and dispositioned

Three nodes, two libraries, two findings. Measured on `f5456796ea`, and the
premise held: **none of the seven had a `package.json` script**, so nothing in
the repository named any of them — `d308`'s claim exactly.

### Three nodes

| node | satisfies | mechanism |
|---|---|---|
| `tex-snippet-validate` | `latex-validation` | `content/pipeline/validate-tex.ts` |
| `tex-source-audit` | `latex-validation` | `content/pipeline/audit-tex-source.ts` |
| `headless-render-qc` | **`rendered-verification`** | `scripts/headless-render-qc.ts` |

`alternativeTo` is EMPTY on all three. The three `latex-validation` tools are a
SEQUENCE, not arms: `latex-preflight` gates the source before a compile,
`tex-snippet-validate` parses the snippets in it, `tex-source-audit` catches the
hazards that read as prose, `latex-overfull` reads the log after. Calling any two
alternatives would tell a caller that running one covers another.

### `rendered-verification`, not `html-rendering-qc` — and the first guess was wrong

Established by reading the skill BODIES rather than matching names.
`html-rendering-qc` (*"Audit `.md` content files for patterns that cause
rendering failures"*) and `markdown-render-check` (*"verify the file renders
correctly on GitHub"*) are both **source-side**. `rendered-verification` is the
one about *"LOOKING at it in a browser … driving it with Playwright in this
environment"* — which is what `headless-render-qc.ts` does. It left the uncovered
list; `html-rendering-qc` stays in tier C, deliberately unclaimed.

### Two libraries, no node — the `81t5` criterion

`render-latex.ts` and `generate-block-tex.ts` are reached through their consumers
(`render-changed-blocks`, `adapters/document/tools/render.ts`, and for
`render-latex` several `schemas/` modules). Same criterion that already exempted
`pdf-extract` and `pdf-structure`: reachable through a neighbour is reachable.

### Finding 1 — five of the family exit 1 where the house rule wants 2

Measured by RUNNING each, not by reading it:

| script | run in the platform | exit |
|---|---|---|
| `validate-tex` | `Files scanned: 0` | **1** |
| `audit-tex-source` | *"No .md files found … refusing to report success"* | **1** |
| `headless-render-qc` | `No paper.json found` | **1** |
| `latexmk-compile.sh` | usage | **1** |
| `generate-main-tex` | a STACK TRACE from its own source | **1** |

Every one is a could-not-determine — this repository carries no folio — spelled
as a finding. And the divergence is INSIDE one family: `latex-preflight` and
`latex-overfull`, the two nodes this bean already landed, both exit **2**
correctly.

`audit-tex-source` is the sharp case: its message is exactly right (*"This audits
a FOLIO's content; folio-assistant is the platform"*) and its exit code
contradicts it. **Not fixed here.** Changing five scripts' exit codes is a
behaviour change the owner should take deliberately, and each node documents the
exit a caller will actually get rather than the one the rule wants — a node that
lies about its exit is worse than one that records the inconsistency.

### Finding 2 — `latexmk-compile.sh` is the `yean` shape, and it guards a boundary

Not noded. It *"compiles LaTeX with safe shell-escape handling"*, and the reason
is security: `-shell-escape` is enabled only on trusted push events, *"to prevent
arbitrary command execution from untrusted TeX content"* on a PR.

It cannot satisfy `latex-authoring`: that contract requires `documentClass` AND
`mainFile`, and this takes only a tex file. A **second instance** of the
unsatisfiable-authoring-contract pattern this bean already named. And no skill in
the corpus is about **compiling** — the six TeX/render skills in tier C are
caching, incremental render, source checks and verification. That is `yean`: a
mechanism with no skill, and authoring one is a claim about the capability
vocabulary every dependent instance inherits, which `yean` established is the
owner's call.

### Also recorded, deliberately not fixed

`headless-render-qc.ts`'s error message names `content/pipeline/export-json.ts` —
a real platform file under a stale root. `check:usage-paths` does not touch it
(a different file, not a self-reference) and `check:command-paths` does not judge
it (`content/` is in `FOLIO_OWNED`). The script runs INSIDE a folio, so the
folio-correct spelling depends on layout I would be guessing at — which is the
audience ambiguity `check:command-paths` declines on purpose. Left for `52dz`.

### Status

Merged into the canonical `## Done when` at the top of this bean on 2026-09-26.
A checklist here restated that one and diverged from it — it recorded
`latex-validation` where the canonical item still asked for `latex-authoring`,
so the divergence was a CHANGED GOAL hiding as a duplicate. That is what
`shadow-checklist` is for, and it is why the remedy was to merge the two rather
than to tick the original five in place.

---

## 2026-10-07 — Owner rulings resolved: Findings 1 & 2 landed

Completed under owner rulings:
1. **Finding 1 (Exit 2 contract)**: Harmonised exit 2 on could-not-determine across:
   - `cat-harness/content/pipeline/audit-tex-source.ts`
   - `cat-harness/content/pipeline/generate-main-tex.ts`
   - `cat-harness/content/pipeline/validate-tex.ts`
   - `cat-harness/scripts/headless-render-qc.ts`
   - `cat-harness/scripts/latexmk-compile.sh`
   Verified with `cat-harness/scripts/tests/latex-exit2-contract.test.ts`.
2. **Finding 2 (`latex-compilation` skill & Tool node)**:
   - Minted `latex-compilation` skill in `folio-assistant-sci/skills/content/folio-paper-adapter/`.
   - Added to `folio-assistant-sci`'s `package-manifest.json` and `scenarios/roles.json` (`build-pipeline` role).
   - Added `latexmk-compile` Tool node in `cat-harness/tools/index.ts` satisfying `latex-compilation`.
   - Regenerated tools viewer, documentation reference, and glossary via `bun run tools:viz` and `bun run skill:register`.

## Completed on landed evidence
Landed on `main` in PR #2423 (`feat(latex): harmonise exit-2 contract and mint latex-compilation skill (folio-assistant-jh2j)`), commit `afa1948b01a8`.
