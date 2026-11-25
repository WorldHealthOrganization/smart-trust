---
# folio-assistant-bo44
$schema: bean/1.0.0
title: 'WRITER-ONLY GATES: nine check scripts always write their sidecar and cannot fail on its content — the general form of uju6/i2kp'
status: completed
type: bug
priority: high
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-07T14:55:47Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §4 item 0.3 and §4.3. The handover (session 01NtKBtj6Yk4kSTVMX3z2Tgy) named this sweep "the general form", and nobody has run it.

`uju6` classified 4 of 103 `check:*` scripts. It looked for misspelled writers, not for scripts that write their own sidecar, and so it missed `check:source-licence` (`i2kp`, #1751, draft #1753).

Measured at `61b1e747`: these writers have no judge mode and no `:check` twin:
- `check:wireframes`
- `check:layout-norms`
- `check:rendered-labels`
- `check:source-licence` (`i2kp`)
- `check:methodology-evidence`
- `check:lane-documentation`
- `check:l1-complete`
- `kg:export`
- `check:avatar-coverage`

**Why this is also step one of the arc:** once QA leaves main there is no committed copy to compare against, so every writer must be able to JUDGE a fresh run. Build the judge mode as "compute and judge" (four states: ok / finding / unknown / error), not as "compare with the committed file", so it survives the move unchanged.

## Done when
- [x] each of the 9 has a judge mode with a stated four-state exit table — 8 of the 9 plus two found by the sweep (`check:harness-state`, `skill:register`); `check:l1-complete` is NOT a writer (below)
- [x] each is wired into the gate set that CI runs (`gates.ts` derives it from the workflow)
- [x] a test corrupts each one's input and sees exit 1 — `cat-harness/scripts/tests/judge-mode.test.ts`, plus `writesReport` in `skill-register.test.ts`
- [ ] `i2kp` is either folded in or closed on #1753's evidence — its defect 1 is folded in here (`check:source-licence:check`); its defect 2 (`kg:audit:all:check` never asked by `regen`) is untouched, so i2kp stays open for that half

## Re-measured, 2026-10-01 (branch `claude/bo44-writer-only-gates`, base `1541e368`)

Each of the nine was READ and RUN. What the bean's list got right and wrong:

| script | writes when run? | exit before `bo44` | note |
|---|---|---|---|
| `check:wireframes` | yes, always (unless `--json`) | 0 / 1 gap / 2 nothing declared | red on this tree: 6 gaps (three renamed `docs-auto` skill indexes) |
| `check:layout-norms` | yes, always — and `--update` writes the baseline | 0 / 1 un-baselined pair / 2 | red on this tree: `smart-base/methodologies contains …/processes` |
| `check:rendered-labels` | yes, always (churn-guarded) | 0 / 1 / 2 | |
| `check:source-licence` | yes, unless `--json` | 0 / 1 malformed / 2 no entries | `i2kp` |
| `check:methodology-evidence` | yes, always (churn-guarded) | 0 / 1 hard finding / 2 | |
| `check:lane-documentation` | yes, unless `--json` | 0 / 1 finding — **and 1 for zero diagrams** | |
| `check:l1-complete` | **no** — writes only under `--write` | 0 / 1 unmet / 2 | **misclassified**: not a writer. But its `--check` COMPARES with the committed `library-qa` sidecars, so it will not survive the arc as it stands (left, see below) |
| `kg:export` | yes: `_kg/<stub>.jsonld` (ignored) and its sidecar | 0 / 1 | not in the gate set at all before this |
| `check:avatar-coverage` | yes — **including under its existing `--check`** | 0 always; 1 under `--check` | had no package script and no CI step |
| `skill:register:check` | yes — rewrote `skill-register.qa-results.json` when it differed | 0 / 1 / 2 | confirmed |

"Cannot fail on its content" was too strong for most of them: seven already exited 1 on their gating families. The defect is that **the gate form wrote** — so CI's step repaired the committed record (it never compared it), and locally `gates`' mutation guard reported them as changing the tree (4 of the baseline's mutations below).

### The general sweep — every `check:*` / `*:check` script, two passes

Method: a fresh clone at `5a3f3dbe` per pass, `bun run <script>` with a 300 s timeout, `git status --porcelain` (submodules included) before and after, `git checkout`/`git clean` between runs. The two sweep scripts lived in a session scratchpad and are not committed; the method above is the reproduction.

- **Pass 1, the tree as committed:** 6 of 222 modified tracked files.
- **Pass 2, every tracked `qa-results/v1` sidecar's `producer.script_hash` hand-staled before each run** (the `ymsu` method). `writeQaResult`'s churn guard leaves a CURRENT sidecar untouched, so pass 1 cannot see a writer whose record happens to be current. 11 of 222 rewrote a sidecar — pass 2 sees only that family, pass 1 sees everything else.
- **Union: 11 of 222 `check:*`/`*:check` scripts write when run**, plus `kg:export` and `check-avatar-coverage.ts` outside the script list. 1 undetermined: `check:quiet-claims` timed out (300 s) in both passes; `translation:block-qa:check` timed out in pass 1 and did not write in pass 2.

The writers: `check:harness-state`, **`check:harness-state:check` (a wired CI gate — the tenth, not on the bean's list)**, `check:lane-documentation`, `check:layout-norms`, `check:methodology-evidence`, `check:reference-direction`, `check:reference-direction:strict`, `check:rendered-labels`, `check:source-licence`, `check:wireframes`, `skill:register:check`.

| script | exit (pass 1) | writes as-is (pass 1) | rewrites a hand-staled sidecar (pass 2) |
|---|---|---|---|
| `check:harness-state` | 0 | no | `harness-state.qa-results.json` |
| `check:harness-state:check` | 1 | no | `harness-state.qa-results.json` |
| `check:lane-documentation` | 0 | no | `lane-documentation.qa-results.json` |
| `check:layout-norms` | 1 | `layout-norms.qa-results.json` | `layout-norms.qa-results.json` |
| `check:methodology-evidence` | 0 | no | `methodology-evidence.qa-results.json` |
| `check:reference-direction` | 1 | `reference-direction.qa-results.json` | `reference-direction.qa-results.json` |
| `check:reference-direction:strict` | 1 | `reference-direction.qa-results.json` | `reference-direction.qa-results.json` |
| `check:rendered-labels` | 0 | no | `rendered-labels.qa-results.json` |
| `check:source-licence` | 0 | `source-licence.qa-results.json` | `source-licence.qa-results.json` |
| `check:wireframes` | 1 | `wireframes.qa-results.json` | `wireframes.qa-results.json` |
| `skill:register:check` | 1 | `skill-register.qa-results.json` | `skill-register.qa-results.json` |
| `kg:export` | — | — | `kg-export.qa-results.json` |
| `check:quiet-claims` | timeout (SIGTERM) | UNKNOWN (timed out) | UNKNOWN (timed out) |
| `translation:block-qa:check` | timeout (SIGTERM) | UNKNOWN (timed out) | no |

<details><summary>All 223 rows</summary>

| script | exit (pass 1) | writes as-is | rewrites staled sidecar |
|---|---|---|---|
| `agent-memory:check` | 0 | no | no |
| `root-scan-census:check` | 0 | no | no |
| `audit:coverage:check` | 1 | no | no |
| `avatars:css:check` | 0 | no | no |
| `bat:sync:check` | 0 | no | no |
| `lsi:viz:check` | 1 | no | no |
| `lsi:skills:check` | 1 | no | no |
| `boards:default:check` | 0 | no | no |
| `bootstrap:schemas:check` | 0 | no | no |
| `check:actor-reach` | 0 | no | no |
| `check:agent-entry-links` | 0 | no | no |
| `check:agents-claims` | 0 | no | no |
| `check:agents-xref` | 0 | no | no |
| `check:agents-xref:strict` | 0 | no | no |
| `check:anchor-names` | 0 | no | no |
| `check:artefact-verification` | 0 | no | no |
| `check:available-locales` | 0 | no | no |
| `check:red-gate-is-last` | 0 | no | no |
| `check:bun-pin` | 0 | no | no |
| `check:bun-runtime` | 0 | no | no |
| `check:artifact-index` | 0 | no | no |
| `check:asset-roles` | 0 | no | no |
| `check:avatar-instances` | 0 | no | no |
| `check:bean-bodies` | 0 | no | no |
| `check:bean-front-matter` | 0 | no | no |
| `check:bean-issue-links` | 0 | no | no |
| `check:bean-parent-prose` | 0 | no | no |
| `check:bean-parent-prose:check` | 0 | no | no |
| `check:bean-parents` | 0 | no | no |
| `check:bean-blocks` | 0 | no | no |
| `check:bean-archive` | 0 | no | no |
| `check:bean-restates-skill` | 0 | no | no |
| `check:bean-rollup` | 0 | no | no |
| `check:bootstrap-concepts` | 0 | no | no |
| `check:catalogue` | 0 | no | no |
| `check:ci-health` | 0 | no | no |
| `check:published-packages` | 0 | no | no |
| `check:ci-invocations` | 0 | no | no |
| `check:code-accounting` | 0 | no | no |
| `check:command-paths` | 0 | no | no |
| `check:context-emission` | 0 | no | no |
| `check:corpus-gate` | 2 | no | no |
| `check:concern-groups` | 0 | no | no |
| `check:declaration-claims` | 0 | no | no |
| `check:declaration-filename` | 0 | no | no |
| `check:declared-assets` | 0 | no | no |
| `check:declared-dirs` | 0 | no | no |
| `check:test-budgets` | 2 | no | no |
| `check:environment` | 0 | no | no |
| `check:declared-paths` | 0 | no | no |
| `check:dependency-advisories` | 0 | no | no |
| `check:docs-populated` | 0 | no | no |
| `check:docs-templates` | 0 | no | no |
| `check:duplicate-ids` | 2 | no | no |
| `check:escaped-markup` | 2 | no | no |
| `check:escaped-markup:source` | 0 | no | no |
| `check:fallback-roles` | 0 | no | no |
| `check:folio-mount` | 0 | no | no |
| `check:glossary` | 1 | no | no |
| `check:term-mapping` | 1 | no | no |
| `check:graph-kind-work` | 0 | no | no |
| `check:harness-dirs` | 0 | no | no |
| `check:harness-state` | 0 | no | `harness-state.qa-results.json` |
| `check:harness-state:check` | 1 | no | `harness-state.qa-results.json` |
| `check:head-has-run` | 1 | no | no |
| `check:image-roles` | 0 | no | no |
| `check:instance-config` | 0 | no | no |
| `check:instance-graph` | 1 | no | no |
| `check:instance-render` | 0 | no | no |
| `check:invocation-parity` | 0 | no | no |
| `check:kind-validators` | 0 | no | no |
| `check:kind-validators:require-all` | 0 | no | no |
| `check:l1-complete` | 0 | no | no |
| `check:uploads-retired` | 0 | no | no |
| `check:lane-documentation` | 0 | no | `lane-documentation.qa-results.json` |
| `check:layout-norms` | 1 | `layout-norms.qa-results.json` | `layout-norms.qa-results.json` |
| `check:lockfile-pinning` | 0 | no | no |
| `check:maintained-artefacts` | 2 | no | no |
| `check:materialized-fixity` | 0 | no | no |
| `check:merged` | 1 | no | no |
| `check:methodology-evidence` | 0 | no | `methodology-evidence.qa-results.json` |
| `check:model-languages` | 0 | no | no |
| `check:module-scope-resolution` | 0 | no | no |
| `check:orphan-verdicts` | 0 | no | no |
| `check:soft-hyphens` | 0 | no | no |
| `check:structure-accessor` | 0 | no | no |
| `check:partition` | 0 | no | no |
| `check:reference-direction` | 1 | `reference-direction.qa-results.json` | `reference-direction.qa-results.json` |
| `check:import-direction` | 0 | no | no |
| `check:reference-direction:strict` | 1 | `reference-direction.qa-results.json` | `reference-direction.qa-results.json` |
| `check:reference-direction:check` | 1 | no | no |
| `check:partition:edges` | 0 | no | no |
| `check:portable-paths` | 0 | no | no |
| `check:process-documentation` | 0 | no | no |
| `check:prov-qaqc` | 0 | no | no |
| `check:prs-have-runs` | 1 | no | no |
| `check:publishable` | 0 | no | no |
| `check:published-instance-exports` | 0 | no | no |
| `check:published-refs` | 0 | no | no |
| `check:python-deps` | 0 | no | no |
| `check:qa-reviewer-permission` | 0 | no | no |
| `check:quiet-claims` | timeout (SIGTERM) | UNKNOWN (timed out) | UNKNOWN (timed out) |
| `check:raci` | 0 | no | no |
| `check:read-only-graphs` | 0 | no | no |
| `check:ready-to-close` | 0 | no | no |
| `check:remote-skills` | 0 | no | no |
| `check:rendered-labels` | 0 | no | `rendered-labels.qa-results.json` |
| `check:requirements` | 0 | no | no |
| `check:retired-front-matter` | 0 | no | no |
| `check:schema-nodes` | 0 | no | no |
| `check:secret-leaks` | 0 | no | no |
| `check:session-staleness` | 1 | no | no |
| `check:skills` | 0 | no | no |
| `check:source-licence` | 0 | `source-licence.qa-results.json` | `source-licence.qa-results.json` |
| `check:stale-field-advice` | 0 | no | no |
| `check:stale-paths` | 0 | no | no |
| `check:subgraph-coverage` | 0 | no | no |
| `check:subgraphs` | 0 | no | no |
| `check:tabular-stubs` | 0 | no | no |
| `check:instance-themes` | 0 | no | no |
| `check:instance-themes:check` | 0 | no | no |
| `check:navbar-consistency` | 0 | no | no |
| `check:navbar-consistency:check` | 0 | no | no |
| `check:navbar-consistency:strict` | 1 | no | no |
| `check:theme-art` | 0 | no | no |
| `check:theme-art:check` | 0 | no | no |
| `check:tools` | 1 | no | no |
| `check:upload-names` | 0 | no | no |
| `check:upload-names:check` | 0 | no | no |
| `check:upload-names:fix` | 0 | no | no |
| `check:undeclared-files` | 0 | no | no |
| `check:undeclared-files:check` | 0 | no | no |
| `check:upstream-pins` | 1 | no | no |
| `check:usage-paths` | 0 | no | no |
| `check:version-bump` | 0 | no | no |
| `check:viewer-backticks` | 0 | no | no |
| `check:viewer-nav` | 0 | no | no |
| `check:voice-skills` | 0 | no | no |
| `check:voices` | 0 | no | no |
| `check:waivers` | 0 | no | no |
| `check:wireframes` | 1 | `wireframes.qa-results.json` | `wireframes.qa-results.json` |
| `check:workflow-coverage` | 0 | no | no |
| `check:workflow-injection` | 0 | no | no |
| `check:workflow-paths` | 0 | no | no |
| `check:workflow-policy` | 0 | no | no |
| `check:workflow-refs` | 1 | no | no |
| `check:workflow-script-paths` | 0 | no | no |
| `check:workflows` | 0 | no | no |
| `check:xml-comments` | 0 | no | no |
| `code-lists:check` | 0 | no | no |
| `deps:python:check` | 0 | no | no |
| `docs:auto:check` | 1 | no | no |
| `docs:harness:check` | 1 | no | no |
| `docs:pages:check` | 0 | no | no |
| `external-schemas:check` | 0 | no | no |
| `external-schemas:viz:check` | 0 | no | no |
| `folio:viz:check` | 0 | no | no |
| `fsh-guts:viz:check` | 0 | no | no |
| `gen:jsonld:check` | 0 | no | no |
| `glossary:check` | 0 | no | no |
| `glossary:pot:check` | 0 | no | no |
| `handler:index:check` | 0 | no | no |
| `harness:dirs:check` | 0 | no | no |
| `health:check` | 2 | no | no |
| `id-lookup:check` | 0 | no | no |
| `ingest:ig-chrome:check` | 2 | no | no |
| `ingest:ig-menu:check` | 2 | no | no |
| `ingest:ig:check` | 1 | no | no |
| `iris:covers:check` | 0 | no | no |
| `iris:pages:check` | 0 | no | no |
| `kg:audit:check` | 1 | no | no |
| `kg:audit:all:check` | 1 | no | no |
| `kg:detangle:check` | 1 | no | no |
| `kg:locale:check` | 0 | no | no |
| `kg:schema:check` | 0 | no | no |
| `kg:subscribe:check` | 0 | no | no |
| `landing:data:check` | 0 | no | no |
| `landing:sticky:check` | 0 | no | no |
| `library:viz:check` | 1 | no | no |
| `methodologies:viz:check` | 0 | no | no |
| `navbar:geometry:check` | 0 | no | no |
| `navbar:include:check` | 0 | no | no |
| `bootstrap:vocabulary:check` | 0 | no | no |
| `check:bootstrap-standalone` | 0 | no | no |
| `ns:check` | 0 | no | no |
| `processes:viz:check` | 0 | no | no |
| `subscriptions:viz:check` | 0 | no | no |
| `readme:sync:check` | 0 | no | no |
| `readme:sync:root:check` | 0 | no | no |
| `readme:sync:all:check` | 0 | no | no |
| `readme:sync:bootstrap:check` | 0 | no | no |
| `check:tools-closure` | 0 | no | no |
| `check:node-iris` | 0 | no | no |
| `iri:sync:check` | 0 | no | no |
| `library:readmes:check` | 0 | no | no |
| `readme:subgraphs:check` | 1 | no | no |
| `render:bpmn:check` | 0 | no | no |
| `schema:viz:check` | 1 | no | no |
| `skill:register:check` | 1 | `skill-register.qa-results.json` | `skill-register.qa-results.json` |
| `skills:docs:check` | 1 | no | no |
| `smart-trust:pages:check` | 0 | no | no |
| `state:visualizer:check` | 0 | no | no |
| `theme:page:check` | 0 | no | no |
| `themes:css:check` | 0 | no | no |
| `tools:viz:check` | 0 | no | no |
| `translate-bpmn:bootstrap:check` | 1 | no | no |
| `translate-bpmn:check` | 0 | no | no |
| `translate-kg-viewer:check` | 0 | no | no |
| `translation:block-qa:check` | timeout (SIGTERM) | UNKNOWN (timed out) | no |
| `translation:catalogue:check` | 0 | no | no |
| `translation:drift:check` | 0 | no | no |
| `translation:obsolete:check` | 0 | no | no |
| `translation:pot:check` | 0 | no | no |
| `translated-links:check` | 0 | no | no |
| `translation:index:check` | 0 | no | no |
| `translation:status:check` | 0 | no | no |
| `uml:overview:check` | 0 | no | no |
| `upload-step:docs:check` | 0 | no | no |
| `skill:commands:check` | 0 | no | no |
| `uploads:viz:check` | 1 | no | no |
| `voices:viz:check` | 0 | no | no |
| `wireframe:check` | 2 | no | no |
| `kg:export` | — | — | `kg-export.qa-results.json` |

</details>

## What was done

`cat-harness/scripts/qa-results.ts` gains the judge helpers: `Judgement` (`ok`/`finding`/`unknown`/`error`), `JUDGEMENT_EXIT` (0/1/2/2 — unknown outranks a finding), `judging()` (`--check`), `judgementOf`, `unknownFlags`/`judgeUsage` (an unknown flag in judge mode is a usage error, exit 2, so a typo never runs the writer), and `concludeJudgement`, which prints the verdict and returns the exit. It also prints ONE advisory line when the committed sidecar is not what this run computed (`qaResultState`) — never gating, because "stale" stops being a state when QA leaves `main` (proposal §2.3), but still SEEN until then, so this is not the weakening `qaResultState`'s docblock warns about.

Each of the ten producers gained a pure `<x>Document(report)` (the sidecar both forms render), an exported `judge<X>(report)`, and a `--check` branch that computes, judges on the producer's own severity line and writes nothing — no sidecar, no baseline, no `_kg/` document. Deviations from the writer, stated where decided: lane-documentation's zero diagrams and kg-export's unread sources are exit **2** (could not determine) where the writer said 1; `--update`/`--out`/`--qa-root` are refused in judge mode.

`package.json`: `check:{wireframes,layout-norms,rendered-labels,source-licence,methodology-evidence,lane-documentation,avatar-coverage}:check`, `kg:export:check`, and `check:avatar-coverage`. `code-quality-gates.yml` runs the judge form of the six that were wired and adds `check:avatar-coverage:check` and `kg:export:check`; `check:harness-state:check` and `skill:register:check` were already wired and now write nothing. The seven bare forms are `SCRIPT_EXEMPTIONS` (`report`) with the reason. `regen-after-merge` pairs `X:check` with writer `X` by convention, so no `WRITER_OVERRIDES` entry is needed.

`i2kp`'s own prescription was `qaResultState` comparison (`current`/`stale`/`absent`/`unreadable`). That is NOT what this does, deliberately: the brief for this bean was compute-and-judge so the gate survives QA leaving `main`. The comparison survives only as the advisory line.

## Left

- `check:l1-complete -- --check` compares committed `library-qa` sidecars — a compare gate the arc will break (Phase 3), red on this tree.
- `check:reference-direction` / `:strict` write their sidecar; they are not in CI (`check:reference-direction:check` is the compare form, also not in CI).
- `check:quiet-claims` is undetermined (timeout ×2).
- `i2kp` defect 2 (`kg:audit:all:check` and `regen`).
- The real findings the judge forms now report on this tree: wireframes (6 gaps), layout-norms (1 pair), harness-state (stale health report) — all red at the base too.

## `bun run cat gates`, before and after

Both runs in a fresh clone (base `5a3f3dbe` = `1541e368` + the claim; after `1ac56949`), on a shared machine.

| | base | after |
|---|---|---|
| gates | 201 | 203 (+`kg:export:check`, +`check:avatar-coverage:check`) |
| failed | **26** | **23** |
| gates that CHANGED THE REPOSITORY | **4** (`skill:register:check`, `check:layout-norms`, `check:source-licence`, `check:wireframes`) | **0** |
| `bun test` `(fail)` lines | 34 | 25, none new |

- No new failure. The two "new" names, `check:layout-norms:check` and `check:wireframes:check`, are the renamed `check:layout-norms` and `check:wireframes`, which were red at the base on the same findings.
- Gone: `audit:coverage:require-all` and `:strict`, where this branch regenerated the sidecar. `check:subgraphs` was red at the base on "1 file could not be read" and is green after. That looks like contention, because it is green when run alone at the base too.
- `main` is red for unrelated reasons, which this branch leaves alone: `bun test`, `check:glossary`, `check:term-mapping`, `check:tools`, `check:workflow-refs`, `docs:auto:check`, `docs:harness:check`, `kg:audit:check`, `kg:audit:all:check`, `kg:detangle:check`, `lsi:*`, `readme:subgraphs:check`, `skills:docs:check`, `translate-bpmn:bootstrap:check`, `translation:catalogue:check`, `check:instance-graph`, `check:l1-complete -- --check`, `check:harness-state:check` and `skill:register:check`.
- `eslint` on every changed file is clean. `tsc --noEmit -p tsconfig.json` passes with 0 errors.

_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.
