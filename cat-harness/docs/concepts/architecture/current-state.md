---
layout: default
title: Current state
parent: Architecture
nav_order: 2
---

# Current state — what this repo actually is
{: .no_toc }

1. TOC
{:toc}

---

> The figures on this page describe the single `folio-assistant` checkout the
> split starts from, measured with the commands shown. They are a snapshot:
> re-run the command before quoting a number.

## The one-sentence summary

`folio-assistant` is a **Tool repo and a Content repo in one checkout**, with a
Test repo's worth of fixtures distributed through both, and no boundary that
anything enforces except review. This page makes that specific enough to plan
against.

## Size and shape

```sh
for d in src schemas skills content adapters scripts docs; do
  n=$(find $d -type f \( -name '*.ts' -o -name '*.py' -o -name '*.sh' -o -name '*.md' -o -name '*.json' \) | wc -l)
  l=$(find $d -type f \( -name '*.ts' -o -name '*.py' -o -name '*.sh' \) -exec cat {} + | wc -l)
  echo "$d: $n files, $l code lines"
done
```

| directory | files | code lines | what it is authoritative for | kind |
|---|---:|---:|---|---|
| `scripts/` | 232 | 49,348 | build, QA, Lean, LaTeX, translation, CI helpers | **Tool**, mostly |
| `content/` | 431 | 46,401 | the **pipeline** — validators, QA, render, graph | **Tool** (despite the name) |
| `adapters/` | 27 | 10,205 | per-content-type tools (`document`, `paper`, `mcp-server`) | **Tool** |
| `schemas/` | 77 | 9,707 | the content-object model + per-skill JSON Schemas | **Content** (schema half) |
| `src/` | 41 | 8,120 | the MCP server, core, and 11 generic tools | **Tool** |
| `skills/` | 144 | 435 | 9 skill packages — almost entirely prose | **Content** (skill definitions) |
| `docs/` | 165 | — | this site | self-documentation |

Two things fall out of that table immediately.

**`content/` contains no content.** It holds `content/pipeline/` (110 files) and
`content/docs/`. Actual folio content lives in a *separate* repository. The
directory is named for what it operates on, not what it holds — hence the
`content/` → `folio/` rename.

**`skills/` is 144 files and 435 lines of code.** Skill packages are
overwhelmingly Markdown instructions plus a `package-manifest.json`. That is the
taxonomy working as intended: a Skill is a *described* unit of work, and the
Tools that satisfy it live elsewhere. It is also why `skills/` is the cheapest
thing in the repo to split out.

## Where the domains already separate — and where they do not

The answer is an import-graph partition, `bun run cat check:partition`
(`scripts/repo-partition.ts`), not a filename match: a filename match finds
`lean-build-bg.sh` and misses a Lean special case inside a generic validator.

The tool walks every `.ts` module under `src/`, `schemas/`, `adapters/`,
`content/`, `scripts/`, `test/` and `types/`, resolves each relative import
(the codebase writes bare, `.js`-for-`.ts`, and directory forms, so all three
are tried), assigns each module to one of the five proposed repositories, and
reports the edges that cross a boundary **in the wrong direction**.

### The partition

**341 modules, 670 internal import edges** (2026-09-18):

| proposed repo | modules | by rule | hand-triaged | by keyword | fell through |
|---|---:|---:|---:|---:|---:|
| `cat-harness` | 58 | 43 | 15 | 0 | 0 |
| the content core | **129** | 120 | 9 | 0 | 0 |
| the science layer | 36 | 8 | 8 | 20 | 0 |
| `smart-kg` | **0** | 0 | 0 | 0 | 0 |
| the DAK layer | 4 | 1 | 0 | 3 | 0 |
| *(test material)* | 114 | 110 | 0 | 4 | 0 |
| **unassigned** | **0** | — | — | — | 0 |

`hand-triaged` is its own column on purpose. Thirty-two platform
meta-scripts — `gen-*`, `check-*`, `render-*` — were reported unassigned by the
structural rules and then read one at a time, by one question:
*does this read or write **platform**, or **content**?* The answer genuinely
differs per file and no path pattern separates them —
`scripts/gen-skill-docs.ts` is harness because Skills are a harness concept,
while `scripts/gen-schema-docs.ts` is core because the content-object model is
core's. They are recorded as `triage`, not `rule`, so the judgements can be
revisited.

Two things in that table are worth reading carefully.

**`smart-kg` is zero.** Not small — zero. Nothing in this repo is WHO L1
material today, which confirms from the code what
[the future state](future-state.html#smart-kg) says from the prose: the L1/L2
line has to be drawn by someone with the domain context, because there is no
existing code to infer it from. It makes `smart-kg` **new construction, like the
Test repos** — not an extraction.

**the DAK layer is four modules.** The WHO material here is overwhelmingly prose,
BPMN and schemas rather than TypeScript, so a module-count partition understates
it badly. Do not read 4 as "nearly done".

### The wrong-direction edges — Phase I's worklist

**46 edges** import across a proposed boundary in a direction the dependency
DAG forbids. Every module **this tool scans** is classified, so this is a
complete count over that set rather than a floor:

> **It is not a complete count over the checkout.** `check:partition`'s root is
> **one layer**, so imports between layers that exist side by side are
> outside the scan. The cross-layer axis is
> `bun run cat kg:detangle:direction`, blocking in CI. The table below is the
> **within-layer** worklist.

| importer | imports from | edges |
|---|---|---:|
| `cat-harness` | the content core | **21** |
| the content core | the science layer | **20** |
| `cat-harness` | the science layer | 3 |
| the content core | the DAK layer | 2 |

`bun run cat check:partition:edges` prints all 46 by name. The two large groups have
different causes and different fixes.

**core → sci (20)** is Lean and LaTeX reaching into generic code.
`content/pipeline/build.ts` imports `render-latex`, `generate-main-tex`,
`latex-preflight` and `lean-coverage`; `qa-utils.ts` imports `lean-signature`;
`schemas/constraints.ts` imports `lean-packages`. This is the seven math block
kinds' machinery embedded in the document pipeline — the profile split
`AGENTS.md` describes at the *schema* level, not yet carried through to imports.
It is the expected shape of the problem, and the most mechanical to fix.

**harness → core (21)** is the more serious one. `src/core/feedback.ts`,
`src/routes/feedback.ts`, `src/types.ts` and `schemas/assistant-types.ts` all
import `schemas/types.ts` — the content-object model. That is the harness's
defining constraint, [that it does not "do" anything](future-state.html#cat-harness),
failing in practice: **a harness that imports the content model cannot be
extracted from underneath core.** It makes `cat-harness` harder to extract
than the science layer, not easier, which is the opposite of the intuition that
the most-depended-upon repo comes out first.

**Classifying more modules finds more violations, not fewer**, so when
re-running this, check the unassigned column first: the edge count is only
complete once it is zero. **The harness → core count grows as ordinary work
lands**, because nothing stops a new harness module importing
`schemas/types.ts`; that is the case for a CI gate (`check:partition --strict`)
once the count is driven down.

## The mechanism the split already has

This is the most important finding on the page, and it cuts both ways.

`<name>.config.json` already declares cross-layer dependencies:

```jsonc
"dependencies": {
  "folioAssistant": [
    { "name": "<dak-layer>", "git": "…", "ref": "main",
      "provides": ["skills", "content", "translations"] }
  ]
}
```

`schemas/harness-config.ts` implements a **depth-first, listed-order, later-
overlays-earlier** resolution with cycle detection — explicitly the FHIR/SUSHI
dependency methodology, applied upstream of it. `resolveDependencyTree`
(`schemas/harness-config.ts:239`) and `flattenDependencies` are real, tested code.

**That is exactly the mechanism a five-repo future state needs.** The split does
not require inventing composition; it requires finishing it.

### What is wired, and what is not

`resolveSkillDirs` computes the cross-layer skill overlay, and
`LOCAL_PACKAGES` in `scripts/skill-packages.ts` is built from it. The
translation fallback chain (`content/pipeline/po-resolve.ts`) is the other
consumer of the module. **Two resolution paths are unbuilt**: content-directory
overlay, and QA criteria from a dependency. Building them is Phase I work,
because every later phase assumes a dependency can contribute skills and
content.

### What a dependency can contribute

Schemas, block kinds, an adapter and MCP tools can come from a dependency:
[Phase 0.1](migration-plan.html#01--make-the-dependency-model-able-to-carry-the-split--decided-and-built)
added `schemas/contributions.ts` and `loadContributions()`. A dependency
declares `"contributes": "./contributions.ts"` and adds block kinds, an adapter
and MCP tools at load time. Collisions throw rather than resolving by load
order; a diamond dependency graph is explicitly not a collision. Without it the
science layer, which owns the math block kinds, the paper adapter and
`lean_build`, could ship only prose.

## The failure mode this repo has already paid for

Pipeline scripts that compute paths from their own location — correct before
the platform/folio split, wrong after — report success over a corpus they never
read:

| script | before | after |
|---|---|---|
| `validate-tex` | "No errors found", exit 0, over 0 files | 1 file, 2 snippets, both valid |
| `conditional-class-banner-audit` | ✓ over 0 blocks, exit 0 — **a CI gate** | refuses, exit 1 |
| `audit-tex-source` | "✓ No TeX-source hazards detected" over 0 files | scans the real corpus |

**Every repo boundary the migration creates can reproduce this defect**, and a
green check is its symptom. So an empty corpus must exit non-zero, and each extraction is verified by running
the moved tool against a synthetic folio, not by observing that CI is still
green.

## What this repo is authoritative for today

Reading the taxonomy against the measurements:

- **Tool** — the MCP server (`src/server.ts`, 11 generic tools), the content
  pipeline, the adapters, the build/QA/render scripts. This is the bulk.
- **Content** — the content-object model (`schemas/types.ts`,
  `constraints.ts`, `builders.ts`), the block kinds, the 9 skill packages, and
  the BPMN processes under `processes/`. These are schemas and Skill
  definitions: Content-repo material by the taxonomy, even though no subject
  matter lives here.
- **Test** — no Test repo exists. Fixtures are distributed: `test/`,
  `scripts/tests/`, and the synthetic-folio helpers. There
  are no Test Plans and no Gherkin. Test data is **not** a folio content type,
  which the taxonomy says it should be.
- **Consumer** — `ui/`, `viewer/`, `home_page/` and `blueprint/` are in-repo
  clients of the model.

The Test repo is the one kind not begun: everything else exists in some form
and needs sorting, whereas the Test repo needs building.

---

Next: [Future state](future-state.html) — the five target repositories.
