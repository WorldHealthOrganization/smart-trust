---
name: theming
description: >
  The map of this subgraph: theming is split on PIPELINE STAGE first — intake,
  declaration, generation, contrast — with producer/consumer as the direction
  each stage faces, and per-artefact specialisation last. Read this to find
  which stage owns the fact you need; read the stage for the fact.
---

# Theming, split on the stage it fails at

**Every file here is named for the skill it declares.** `servableSkills()` in
`scripts/kg-audit.ts` derives a skill's id from its FILENAME, while
`package-manifest.json` lists its `name:`, so a file whose basename differs
from its `name:` is reported as `manifest-skill-exists`.

**This map is a skill, not a `README.md`.** `isSkillMd` is
declaration-over-location: a markdown file in a `cat-harness` directory that
does not declare `$schema:` **is** a skill, so a README here would enter the
graph as one with no `name`, unreachable through `skill_fetch`.

**This is a PACKAGE under `skills/`, not a top-level declared directory**:
`kg-audit`'s `skillFiles()` walks `skills/`, so a top-level topical directory
would drop its skills out of skill QA.

## The axis, and the ordering matters more than the names

Three levels: pipeline stage first, producer/consumer as the direction each
stage faces, and per-artefact specialisation last.

| | stage | faces | what it owns |
|---|---|---|---|
| 1 | [`theme-art-intake`](theme-art-intake.md) | **producer** | art arrives; accepted with its declaration written, or refused with a named reason |
| 2 | `theme-declaration` (opt-in `cat-harness.platform-ui`) | **producer** | what a theme IS as data — palette, three layouts, `textRegion`, `avatarRegion` |
| 3 | `theme-generation` | **consumer** | `themes.css`, and the fallback that paints over its own art |
| 4 | `theme-contrast` | **consumer** | scrims, WCAG, and why the measurement is over pure black |
| — | `theme-artefacts` | specialisation | sticky, landing board, docs background, navbar avatar — only what DIFFERS |

**Stage is primary because that is how failures arrive**: each one is at one
stage. **Going artefact-first would duplicate intake and contrast into every
artefact**, and a rule kept in one artefact's prose gets rediscovered rather
than read. Stage-first with specialisation last means a
new artefact inherits the stages and declares only its difference. The avatar
crop boxes are the worked example: the *rule* that a crop is declared data
belongs to `declaration`, and the *boxes themselves* are navbar-avatar
specialisation in `artefacts`.

**Producer/consumer is not a second partition of the same set.** It says which
direction a stage faces. It is what makes *"a theme with no CSS rule falls back
to an opaque surface and paints over its own art"* a **consumer** fact rather
than a generation detail: the generator did its job, and the reader of a
missing rule is where it goes wrong.

## Which stage owns your question

| the symptom | the stage |
|---|---|
| art was rejected, or you do not know what to supply | `theme-art-intake` |
| "where do I put this number" — a crop box, a palette value, a layout | `theme-declaration` |
| the theme renders as a flat surface with no art | `theme-generation` — **run `bun run cat themes:css`** |
| text on art is hard to read, or you need a scrim ratio | `theme-contrast` |
| it is right everywhere except on one surface | `theme-artefacts` |
| a page flashes white (or light) before going dark on load | `theme-artefacts` §"The page ground: the first paint is DARK" |

## What else is theming, outside this directory

The code: `schemas/ui/themes.ts`, `schemas/ui/theme.ts`,
`schemas/content/landing-sticky.ts`, the generated `docs-ui.css`, `themes:css`
and `check:theme-art`. `skills/ui/ui-core/theme-ui-review.md` stays in
`ui-core`: it is a UI review skill, and theming is one of its subjects rather
than its subject, and a directory that takes every file with `theme` in its name
is a directory nobody can describe. The stages share this one directory until a
stage has enough skills to fill its own, because a declared directory with
nothing in it makes a consumer scan an empty tree and report a clean run.

## Looking at it

`bun run cat theme:sheet` renders every theme — palette, measured contrast, and
each layout's art with its `textRegion` and `avatarRegion` drawn. It PRINTS and
never gates, because the question it answers is one no assertion can carry: the
schema can prove a box is square and inside the frame, not that it frames the
subject.
