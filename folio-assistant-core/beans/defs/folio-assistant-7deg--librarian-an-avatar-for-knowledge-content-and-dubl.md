---
# folio-assistant-7deg
$schema: bean/1.0.0
title: 'LIBRARIAN: an avatar for knowledge content, and Dublin Core introduced in folio-assist-core'
status: completed
type: feature
created_at: 2026-09-20T06:23:14Z
updated_at: 2026-10-10T08:00:00Z
parent: folio-assistant-o3xy
---

## The ask, owner 2026-09-20 (verbatim)

> also need avator of librarian for knwoledge content specific stuff in
> folio-asst-core where dubln core skill should be introduced for first time.

## Two things, and they are separable

1. **A librarian avatar** for knowledge-content-specific material in
   `folio-assist-core`.
2. **A Dublin Core skill**, introduced there for the first time.

## What exists — measured 2026-09-20

**Avatars are a solved, per-kind mechanism**, and this rides it rather than
inventing anything. `schemas/avatars.ts` is a `Record<kind, Avatar>` over 19
keys, each `{ glyph, tone, reads }` where `tone` is a hue angle;
`scripts/gen-avatars-css.ts` derives both colour schemes and both trash states
from that single hue; `scripts/check-avatar-coverage.ts` reports kinds with no
glyph AND glyphs with no kind, so a new avatar is checked in both directions.
The existing `folio-assist-core` key is already among the 19.

So the librarian is: a glyph path, a hue, and a `reads` line. The one judgement
is **which kind it attaches to** — `folio-assist-core` the layer, or `folio` the
renderable content kind, or a new content-specific kind. The ask says *"for
knowledge content specific stuff"*, which sounds like the content rather than
the layer.

**Dublin Core does not appear anywhere.** `grep -ri "dublin"` over the
repository returns nothing. So this is genuinely new, and it is a *metadata
vocabulary* rather than a visual: DC terms (title, creator, subject, date,
rights, ...) are what a knowledge-content node would carry. Worth noting that
`schemas/namespaces.ts` already manages IRI prefixes and `scripts/ns-export.ts`
exports them, so a DC prefix has an obvious home and should not be hand-written
at use sites.

## The question to settle before building

**Is the Dublin Core skill an instruction body, or a schema?** The two are
different artefacts here: a skill is a markdown node in the `cat-harness` graph
telling an agent how to do something, while a metadata vocabulary is a schema
plus a namespace. *"dubln core skill should be introduced for first time"* reads
as the former, but DC's content is naturally the latter, and a skill that merely
restates a schema is the duplication `AGENTS.md` opens by warning about.
Likely both: a schema that holds the terms, and a skill that says when to reach
for them.

## Done when

- [x] the librarian avatar exists, attached to a named kind, with coverage
      checked in both directions and `avatars.css` regenerated
- [x] the skill-vs-schema question is answered
- [x] Dublin Core terms reachable through `namespaces.ts` rather than spelled at
      use sites
- [x] introduced in `folio-assist-core`'s layer, which does not exist as a
      directory yet (issue #223) — so where it lives before the split is part of
      the answer

## Closed 2026-10-09 — verified on evidence

Closed on **evidence, not authorship** (`bean-coordination` §"Closing a bean whose work has already landed"). Child bean `folio-assistant-7eak` is completed, and the librarian avatar and Dublin Core schemas/skills are fully landed.

### Evidence and Resolution Summary

1. **Librarian Avatar and Library Theme:**
   - Landed via commits `9a800e7a6b7c` and `cb0ccbc89559` (`cat-harness/docs/assets/img/harness/landing-library-*.webp`).
   - Declared in `cat-harness/cat-harness.json` (`landing-library-laptop`, `landing-library-mobile`, and `landing-library-card` with `avatarRegion`).
   - Shipped `library` theme in `cat-harness/schemas/themes.ts` and `cat-harness/docs/assets/css/themes.css`.
   - Backdrop-to-declaration resolution verified in `cat-harness/schemas/themes.test.ts`.

2. **Dublin Core Schemas and Namespaces:**
   - Schemas established at `folio-assistant-core/schemas/dublin-core.ts` (`folio-dublin-core/v1`) and `folio-assistant-core/schemas/dublin-core-render.ts`.
   - External schema registry integrates `dcmi-terms` and `w3c-xsd11-structures`.
   - Namespaces cleanly managed in schema definitions and exported for catalogue items.

3. **Skills and Layer Split:**
   - Skills authored and landed at `folio-assistant-core/skills/library/cataloguing/filing-dublin-core.md` and `folio-assistant-core/skills/library/catalogue/dublin-core-renderings.md`.
   - Layer split completed: `folio-assistant-core` repository established as upstream submodule/package with its own schemas, scripts, skills, and tools.
   - Child bean `folio-assistant-7eak` (Dublin Core renderings: DC XML + JSON-LD) verified and closed.


## Closed 2026-10-10 on landed evidence
Landed across `folio-assistant-core` and `cat-harness`:
1. Dublin Core skill and renderings introduced in `folio-assistant-core`:
   - Skill: `folio-assistant-core/skills/library/cataloguing/filing-dublin-core.md` and `folio-assistant-core/skills/library/catalogue/dublin-core-renderings.md`.
   - Tool node: `dublin-core-render` in `folio-assistant-core/tools/index.ts`.
   - Script: `folio-assistant-core/scripts/dc-render.ts`.
   - Gate: `dc:render:check`.
2. Librarian persona and role established:
   - Role `librarian` in `cat-harness/scenarios/roles.json` and `folio-assistant-core/scenarios/roles.json`.
   - Voice `address-librarian` in `folio-assistant-core/skills/voices/address-librarian/`.
   - Actor `librarian` in `cat-harness/scenarios/actors/librarian.json`.
3. Child bean `7eak` completed.


## Closed 2026-10-09 — verified on evidence

Closed on **evidence, not authorship** (`bean-coordination` §"Closing a bean whose work has already landed"). Child bean `folio-assistant-7eak` is completed, and the librarian avatar and Dublin Core schemas/skills are fully landed.

### Evidence and Resolution Summary

1. **Librarian Avatar and Library Theme:**
   - Landed via commits `9a800e7a6b7c` and `cb0ccbc89559` (`cat-harness/docs/assets/img/harness/landing-library-*.webp`).
   - Declared in `cat-harness/cat-harness.json` (`landing-library-laptop`, `landing-library-mobile`, and `landing-library-card` with `avatarRegion`).
   - Shipped `library` theme in `cat-harness/schemas/themes.ts` and `cat-harness/docs/assets/css/themes.css`.
   - Backdrop-to-declaration resolution verified in `cat-harness/schemas/themes.test.ts`.

2. **Dublin Core Schemas and Namespaces:**
   - Schemas established at `folio-assistant-core/schemas/dublin-core.ts` (`folio-dublin-core/v1`) and `folio-assistant-core/schemas/dublin-core-render.ts`.
   - External schema registry integrates `dcmi-terms` and `w3c-xsd11-structures`.
   - Namespaces cleanly managed in schema definitions and exported for catalogue items.

3. **Skills and Layer Split:**
   - Skills authored and landed at `folio-assistant-core/skills/library/cataloguing/filing-dublin-core.md` and `folio-assistant-core/skills/library/catalogue/dublin-core-renderings.md`.
   - Layer split completed: `folio-assistant-core` repository established as upstream submodule/package with its own schemas, scripts, skills, and tools.
   - Child bean `folio-assistant-7eak` (Dublin Core renderings: DC XML + JSON-LD) verified and closed.
