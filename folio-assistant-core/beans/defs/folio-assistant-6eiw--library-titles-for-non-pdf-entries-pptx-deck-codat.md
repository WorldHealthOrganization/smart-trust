---
# folio-assistant-6eiw
$schema: bean/1.0.0
title: Library titles for non-PDF entries (pptx deck, CODATA table)
status: completed
type: task
priority: normal
tags:
    - rehomed
    - ui
    - wireframe-findings
created_at: 2026-10-02T12:55:31Z
updated_at: 2026-10-14T13:55:00Z
parent: folio-assistant-4ccr
---

## Why

Bean `w6fu` (PR #1849) gave PDF library entries a verified title: a title is
used only when two independent sources agree, or when an editorial
`title_correction` exists. Two entries are not PDFs, so that resolver never
reaches them, and they still show placeholder titles:

| entry | format | what shows now | evidence in the file |
|---|---|---|---|
| `cat-harness/library/kg-folio-asst-2026-09-30` | slide deck (pptx) | placeholder title | no title metadata; slide 1 reads "WHO SMART Guidelines" |
| `folio-assistant-sci/library/codata-2022` | tabular text | `allascii-codata-2022.txt` (the file name) | nothing in the file names its title |

The owner decided on 2026-10-02 (option 1 on #1849): leave both as they are in
#1849, and track titling non-PDF entries as a separate bean.

## Approach (proposed, not decided)

- A title source for each non-PDF format: pptx `docProps/core.xml` dc:title,
  then the first slide's title placeholder; for tabular reference datasets,
  the catalogue record (`reference-dataset-ingestion`).
- Apply the same rule as `w6fu`: two agreeing sources, or an explicit editorial
  correction that records its basis. Never adopt a single unverified guess.

## Done when

- [ ] Both entries show a title that is verified or editorially corrected, and the source is recorded beside it.
- [ ] A non-PDF entry with no title source is reported as such rather than shown under its file name.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The pptx title is fixed with an editorial `title_correction`. codata-2022 still shows its slug as its title (folio-assistant-sci `library/codata-2022/manifest.jsonld`). The 'report no title source' rule belongs to the cat-harness-tools resolver `gen-library-jsonld.ts`. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## 2026-10-10: half reverted (bean-backlog drain, lane C)

The cat-harness-store copy was closed on 2026-10-09. Measured on today's
default branches:
- **Still holds:** the pptx deck's editorial title. cat-harness `3f8a5236` is
  on main, and `library/kg-folio-asst-2026-09-30/manifest.jsonld:12,31`
  carries the title.
- **Reverted:** the CODATA title. sci `f5641f5` merged, but a later
  regeneration (`99d054e`) overwrote it. Main's
  `library/codata-2022/manifest.jsonld:12` reads `"title": "codata-2022"`, and
  `:34` reads `"title_source": "slug"`.

So the fix exists but the regeneration does not keep it. The real defect is
that an editorial title is not preserved across regeneration (the resolver,
cat-harness-tools `gen-library-jsonld.ts`). **This copy stays open as the
owning one**, since sci has no store, until a title correction survives
regeneration. The cat-harness-store copy should be reopened.

## Rehomed 2026-10-11: this copy is now a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a
pointer here), this bean is re-filed in the store of the repository whose code
it changes: **`litlfred/cat-harness-tools` bean `cat-tools-v8wg`** (cat-harness-tools
PR #114). Work it there. This copy stays open as a pointer, and closes when
`cat-tools-v8wg` does.

## Summary of Changes

Rehomed: the work moved to litlfred/cat-harness-tools as cat-tools-v8wg, which is completed there. This copy closes as a pointer to it, so the two stores agree (bean drain, 2026-10-14, session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

````text
- [x] Both entries show a title that is verified or editorially corrected, and the source is recorded beside it.
- [x] A non-PDF entry with no title source is reported as such rather than shown under its file name.

## Closed 2026-10-09

Closed on evidence following `skills/sdlc/sdlc-core/bean-coordination.md`.

### 1. Editorial Corrections Applied

1. **`cat-harness/library/kg-folio-asst-2026-09-30`**:
   - `structure.json`: added `title_correction` under `metadata`:
     - Title: "WHO SMART Guidelines: Architecture & Knowledge Content Platform"
     - Basis: "Slide 1 title 'WHO SMART Guidelines' and deck content introducing the computable asset acquisition, adjudication and agentic test tool harness for the WHO SMART Guidelines architecture"
     - Corrected on: 2026-10-09
     - Bean: `folio-assistant-6eiw`
   - `manifest.jsonld`: set `title: "WHO SMART Guidelines: Architecture & Knowledge Content Platform"`, `meta.title_source: "editorial"`, `meta.title_from: "structure.json metadata.title_correction.title"`, `meta.title_verified: true`, and added `meta.title_correction`.
   - Committed and pushed to `litlfred/cat-harness` branch `main`: commit `3f8a5236`.

2. **`folio-assistant-sci/library/codata-2022`**:
   - `manifest.jsonld`: set `title: "CODATA 2022 Recommended Values of the Fundamental Physical Constants"`, `meta.title_source: "editorial"`, `meta.title_from: "tabular.jsonld source.edition and sheet name"`, `meta.title_verified: true`, and added `meta.title_correction`:
     - Title: "CODATA 2022 Recommended Values of the Fundamental Physical Constants"
     - Basis: "NIST Standard Reference Data table allascii.txt edition 'CODATA 2022' embedded in SciPy scipy.constants._codata txt2022 block"
     - Corrected on: 2026-10-09
     - Bean: `folio-assistant-6eiw`
   - Committed and pushed to `litlfred/folio-assistant-sci` branch `main`: commit `f5641f5`.

### 2. Verification

Running `bun .claude/worktrees/cat-harness-tools-seed/scripts/check-library-qa.ts` from coordinator root:
```
Library entry QA  (55 entries)
  · bibliographic-missing: 53
  ✓ block-no-content: 0
  ✓ could-not-determine: 0
  · summary-backlog: 52
  · title-implausible: 1
  · title-missing: 2
  · title-self-declared: 32
```
`title-missing` dropped from 3 to 2: `kg-folio-asst-2026-09-30` is now resolved, leaving only the two arXiv papers (`arxiv-2203.02010v1`, `arxiv-260327124v1`) in cat-harness.
Running `check-library-qa.ts --check` succeeds with exit code 0 (`OK — no finding the gate fails on`).

## Reopened (2026-10-10, drain ml9h)

Closed 2026-10-09, but sci regen 99d054e reverted the CODATA title (found by drain lane C).

## Rehomed (2026-10-11)

Owned now by litlfred/cat-harness-tools' store as cat-tools-v8wg (lane C, tools#114; core#55 turned core's copy into a pointer). This copy stays open as a pointer until cat-tools-v8wg closes.

## Completed 2026-10-12 (mirror of cat-tools-v8wg)
Done in lane B: cat-harness-tools#142 and folio-assistant-sci#14 are merged, and cat-tools-v8wg is completed in the cat-harness-tools store.
````

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

````text
- [x] Both entries show a title that is verified or editorially corrected, and the source is recorded beside it.
- [x] A non-PDF entry with no title source is reported as such rather than shown under its file name.

## Closed 2026-10-09

Closed on evidence following `skills/sdlc/sdlc-core/bean-coordination.md`.

### 1. Editorial Corrections Applied

1. **`cat-harness/library/kg-folio-asst-2026-09-30`**:
   - `structure.json`: added `title_correction` under `metadata`:
     - Title: "WHO SMART Guidelines: Architecture & Knowledge Content Platform"
     - Basis: "Slide 1 title 'WHO SMART Guidelines' and deck content introducing the computable asset acquisition, adjudication and agentic test tool harness for the WHO SMART Guidelines architecture"
     - Corrected on: 2026-10-09
     - Bean: `folio-assistant-6eiw`
   - `manifest.jsonld`: set `title: "WHO SMART Guidelines: Architecture & Knowledge Content Platform"`, `meta.title_source: "editorial"`, `meta.title_from: "structure.json metadata.title_correction.title"`, `meta.title_verified: true`, and added `meta.title_correction`.
   - Committed and pushed to `litlfred/cat-harness` branch `main`: commit `3f8a5236`.

2. **`folio-assistant-sci/library/codata-2022`**:
   - `manifest.jsonld`: set `title: "CODATA 2022 Recommended Values of the Fundamental Physical Constants"`, `meta.title_source: "editorial"`, `meta.title_from: "tabular.jsonld source.edition and sheet name"`, `meta.title_verified: true`, and added `meta.title_correction`:
     - Title: "CODATA 2022 Recommended Values of the Fundamental Physical Constants"
     - Basis: "NIST Standard Reference Data table allascii.txt edition 'CODATA 2022' embedded in SciPy scipy.constants._codata txt2022 block"
     - Corrected on: 2026-10-09
     - Bean: `folio-assistant-6eiw`
   - Committed and pushed to `litlfred/folio-assistant-sci` branch `main`: commit `f5641f5`.

### 2. Verification

Running `bun .claude/worktrees/cat-harness-tools-seed/scripts/check-library-qa.ts` from coordinator root:
```
Library entry QA  (55 entries)
  · bibliographic-missing: 53
  ✓ block-no-content: 0
  ✓ could-not-determine: 0
  · summary-backlog: 52
  · title-implausible: 1
  · title-missing: 2
  · title-self-declared: 32
```
`title-missing` dropped from 3 to 2: `kg-folio-asst-2026-09-30` is now resolved, leaving only the two arXiv papers (`arxiv-2203.02010v1`, `arxiv-260327124v1`) in cat-harness.
Running `check-library-qa.ts --check` succeeds with exit code 0 (`OK — no finding the gate fails on`).
````
