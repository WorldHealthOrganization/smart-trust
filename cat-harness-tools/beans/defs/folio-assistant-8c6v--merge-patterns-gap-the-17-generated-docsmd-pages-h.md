---
# folio-assistant-8c6v
$schema: bean/1.0.0
title: 'MERGE PATTERNS GAP: the 17 generated docs/*.md pages have no declared merge-conflict pattern, so merge:main refuses them although their own front matter says do-not-hand-edit'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T08:55:15Z
updated_at: 2026-10-03T11:20:40Z
parent: folio-assistant-d33q
---

Found 2026-10-03 while measuring PR #1888's merge with `main` for session
`folio-assistant-a8`: of its 55 conflicts, 53 classified to a declared pattern
and **2 refused**, and both were the same page in its two forms —
`cat-harness/content/docs/publication-workflow/every-workflow-in-the-repo.md`
(authored source) and `cat-harness/docs/process/publication-workflow.md` (its generated
mirror). The mirror's own front matter reads:

```
generated: scripts/gen-docs-pages.ts — do not hand-edit; run `bun run cat docs:pages`
```

So a file that declares itself generated and forbids hand-editing is the one a
merge hands back for hand-editing.

## Measured, not estimated

| | |
|---|---|
| files under `cat-harness/docs/` carrying `generated: scripts/gen-docs-pages.ts` | **17** |
| of those, classifying `refuse / — none —` under `classify()` | **17** |
| any of them named in `.gitattributes` | **0** |

The 17: `agentic-harness.md`, `beans-and-todos.md`, `content-types.md`,
`crdm-methodology.md`, `document-ingestion.md`, `evidence.md`,
`fhir-content.md`, `guides/who-smart-dak.md`, `guides/who-smart-ig.md`,
`guides/writing-a-document.md`, `guides/writing-a-paper.md`, `harness.md`,
`harnessed-kg-overview.md`, `ig-publisher.md`, `knowledge-graph.md`,
`managing-agent-context.md`, `publication-workflow.md`.

## The carry-forward check `8rff` requires — done, and it passes

`8rff`'s discipline is **confirm the writer by reading the script**, because
`glossary-export.ts` looked whole-file-written and in fact carries a term's
earlier names forward into `skos:hiddenLabel`, which is why the ledger stays
refused. So:

`emit()` at `cat-harness/scripts/gen-docs-pages.ts:878` is **compare-or-write**.
Under `--check` it reads the existing file and compares; otherwise it is a bare
`writeFileSync(path, content)` of the whole content. The **only** read of a
prior `docs/*.md` output in the script is line 881, **inside the `--check`
branch**, for that comparison. Every other read is of an INPUT — the authored
`content/docs/<slug>/<block>.md` via `readBlock` (:229), BPMN XML (:1114), todo
pages (:1400), manifests (:938). **Nothing is carried forward**, so `take-base`
loses nothing here, exactly as it did for `gen-skill-docs.ts` in `8rff`.

## Scope: only the `page` kind, and that is why this is not a second answer

`gen-docs-pages.ts` writes three kinds (its own docblock at :852), and the
other two are **already covered** — checked rather than assumed:

| kind | example | pattern today |
|---|---|---|
| `page` | `docs/publication-workflow.md` | **— none — → refuse** ← the gap |
| `data` | `docs/assets/todos/index.json` | `site-data` / `take-base` |
| `verdict` | `test/results/witnesses/*.witness.json` | `qa-witnesses` / `take-base` |

So this adds one pattern for one kind, rather than restating coverage that
exists.

**The `page` kind is gated on EXACT content** (`--check` fails on any
difference, by design: "a difference is somebody who added a node, renamed a
block, ran a first sweep, or moved a sidecar, and did not regenerate"). That
makes `take-base` plus regenerate the *verifiable* resolution — the gate proves
the regenerated file is right — and it is the reason this pattern is safe to
gate rather than merely convenient.

## Done when

- [ ] one `take-base` PATTERNS entry covering the generated `docs/*.md` pages,
      with its reason, placed so it does not shadow an existing pattern
      (`viewer-pages`, `docs-auto` and `glossary` all match under
      `cat-harness/docs/` — first match wins, so ORDER has to be checked, not
      assumed)
- [ ] a skill section for it in `merge-conflict-patterns.md`, per §"Adding a
      pattern"
- [ ] a classify test pinning the pair that makes it safe: the generated
      `docs/publication-workflow.md` is `take-base` while its **authored
      source** `content/docs/publication-workflow/every-workflow-in-the-repo.md`
      stays `refuse` — step 3's "test that the unsafe neighbour is refused,
      not only that the case resolves"
- [ ] `bun run cat merge:overlap` re-run shows these 17 no longer counted as
      authored

## What this does NOT claim

The authored half stays refused on purpose. On #1888 both sides had only
**added** rows to it (+1 ours, +2 main's), so that instance is a lossless
union — but a union of additions is a property of that instance, not of the
path, and the next conflict there could be a contested edit. The pattern covers
the mirror only.

Related: `8rff` (the three families this is the fourth of, completed),
`d33q` (parent), `ba9e` (the other chronically-conflicting generated family).

_2026-10-03T09:17:35Z_ — Claimed by claude/docs-pages-merge-pattern-declare-8c6v — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


_2026-10-03_ — PR #1971 (`claude/docs-pages-merge-pattern-declare-8c6v`), head `cc1b199`. Declared `docs-pages` in `merge-conflict-patterns.ts` — NOT `.gitattributes`: `merge-pipeline-paths.ts` imports `classify` from the PATTERNS array, which its own docblock calls the single answer. Followed #1943's shape: one entry, a test pair, a skill section.

The 17 slugs are ENUMERATED, not globbed: `cat-harness/docs/*.md` is a mix — 13 of 31 generated at top level, 4 of 9 in `guides/` — so a directory glob would take a side on 23 authored pages. A test derives the subjects from the pages' own FRONT MATTER so the enumeration cannot go stale.

Measured on the merged tree: under `origin/main`'s 23 patterns all 17 refuse; under this branch's 24 all 17 classify to `docs-pages`; 0 false positives over 22,636 tracked paths, 0 of 789 `cat-harness/content/**` files, 0 of 23 authored docs siblings.

**The test caught drift on its first merge, and the drift was self-inflicted.** The first cut tested the whole file and counted an 18th page: `docs/reference/skill-instructions/merge-conflict-patterns.md`, the generated body of the skill documenting this pattern, which quotes the `generated:` marker in a code fence — 'a docblock that documents a tag necessarily contains the tag' (`audit-coverage`). Merge behaviour was never wrong (its front matter names `gen-skill-docs.ts` and `skill-instructions` is declared first), but the detector was. Now front-matter-only, with a test pinning all three facts.

Gates: 215 of 216 passed; the one failure is `bun test` whose 15 failures are ALL 5000ms timeouts (15 timeouts / 15 failures, zero assertion failures), and all four files involved pass in isolation. `merge-base.test.ts` 28/28. `skill:register:check` exit 0 on its own (bean `ymsu`).

NOT closed: CI has produced zero runs because `main` moved four times during the session and the head keeps re-conflicting on the same three generated LSI artefacts (all `take-base`-covered). Handed to the Merge Manager; #1966 supersedes this entry if it lands.


_2026-10-03_ — **All four `## Done when` items satisfied.** PR #1971 merged to main by litlfred at 11:14:38Z, merge commit `76cdd687a20`, with the `merge-main` label applied by the Merge Manager (not by this session). `origin/main` now carries 24 PATTERNS entries including `docs-pages`, and all 17 pages classify to it under the BASE's own patterns.

Item 4 verified rather than assumed: `bun run cat merge:overlap` re-run after the merge lists **none** of the 17 generated pages as an authored path, while the authored source `content/docs/publication-workflow/every-workflow-in-the-repo.md` still appears 16 times — which is correct and deliberate, since that half genuinely needs a person.
