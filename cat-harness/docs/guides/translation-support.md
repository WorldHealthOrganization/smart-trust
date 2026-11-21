---
layout: default
title: Translation support
nav_order: 12
documents:
  - translation-sources
---

# Translation support
{: .no_toc }

This document is the single reference for how translation works in
folio-assistant. It covers the content model, the gettext PO/POT pipeline,
the official/unofficial distinction, staleness tracking, the viewer language
switcher, and the integration with WHO SMART Base's existing translation
subsystem.

1. TOC
{:toc}

---

## Terminology

| Term | Meaning |
|---|---|
| **Source language** | The language in which a content node is authored. Defaults to `en` unless the folio declares otherwise. |
| **Target language** | A language into which the source is translated. |
| **Official translation** | A translation that has received human adjudication / sign-off. Persisted as a sibling content node. |
| **Unofficial translation** | An agentic (machine) translation, starting from `.po` if available. Has not been reviewed by a human. |
| **Stale translation** | An official translation whose source content has changed since sign-off. Requires re-adjudication. |
| **PO file** | A GNU gettext Portable Object file containing msgid/msgstr pairs. |
| **POT file** | A PO Template — the extracted translatable strings without translations. |
| **Content node** | A block, section, chapter, or any structural unit in `content/`. |
| **UN languages** | Arabic (`ar`), Chinese (`zh`), English (`en`), French (`fr`), Russian (`ru`), Spanish (`es`). |

---

## Content model for translations

### Principle: translations are content nodes

An official translation of a content node is persisted **as its own translated
content node**. This follows the FRBR pattern: a block varies along two axes —
**format** (`.md`, `.lean`, `.tex`) and **language** — and the translation is an
Expression of the same Work.

```
translations/
├── fr/
│   ├── index.ts             # TranslationNode manifest (KG node)
│   ├── index.pot            # POT template (extractable strings)
│   ├── index.po             # PO translated strings
│   ├── agent-onboarding.ts
│   ├── agent-onboarding.pot
│   ├── agent-onboarding.po
│   ├── glossary.ts          # shared glossary PO (no POT)
│   └── glossary.po
├── es/
│   └── ...
└── ar/
    └── ...
```

The `translations/` directory contains **only** `.pot` templates, `.po`
translated files, and their JSON manifests (`"$schema": "translation-node/v1"`),
in subdirectories that mirror the source path. Rendered
output (`.md`) lives in `docs/<locale>/`; QA results and status metadata
are properties of the `TranslationNode` manifest, not separate files.

### TranslationNode — manifests as KG nodes

Each `.po`/`.pot` pair is wrapped by a JSON manifest that makes it a
**first-class node in the knowledge graph**:

```typescript
import type { TranslationNode } from "../../schemas/translation";

const node: TranslationNode = {
  label: "trans:fr/index",        // KG-addressable label
  locale: "fr",
  sourceFile: "docs/index.md",
  potFile: "translations/fr/index.pot",
  poFile: "translations/fr/index.po",
  status: { locale: "fr", official: false, generatedBy: "agent" },
  coverage: { translated: 37, total: 37, pct: 100 },
};
export default node;
```

This makes translation files:
- **Addressable by label** (`"trans:fr/index"`)
- **Referenceable** in `poSources[]` on content blocks
- **Validatable** by the same Zod-based schema infrastructure
- **Queryable** as edges in the knowledge graph

### Language and PO sources on `BlockBase`

The block manifest has two optional fields for translation:

```typescript
export interface BlockBase {
  // ... existing fields ...
  /** BCP 47 language tag of the source content. Defaults to folio's defaultLocale. */
  lang?: string;
  /**
   * One or more PO file sources for this block. Each entry is a path
   * to a .po file or a TranslationNode .ts manifest. Multiple entries
   * enable compositional translation (e.g. glossary + block-level PO).
   */
  poSources?: string[];
}
```

### PO source resolution (fallback behavior)

When `poSources` is **not declared** (the common case), the pipeline
resolves PO files by convention:

1. **Block-level:** `translations/<locale>/<block-stem>.po`
2. **Chapter-level:** `translations/<locale>/<chapter-slug>.po`
3. **Folio-level:** `translations/<locale>/global.po`
4. **Dependency walk:** walk `<name>.config.json` dependencies depth-first,
   looking for matching PO files in each dependency's `translations/<locale>/`

When `poSources` **is declared**, only the listed files are consulted (no
fallback). Each source is loaded in array order; later entries override
earlier ones for the same msgid, so the most specific source should be last.

### Chapter and section level translations

The same convention applies at every level of the content hierarchy. The
`translations/` directory is always at the folio root — not nested inside
`content/<chapter>/` — because PO files are translation artifacts, not
content companions. They are referenced from content blocks via `poSources[]`
or resolved by the fallback chain above.

---

## Official vs unofficial translations

### Unofficial (agentic)

1. An agent generates a translation using available `.po` files or LLM
   translation.
2. The result is written to `translations/<locale>/block.md` and
   `translations/<locale>/block.po`.
3. `status.json` records `{ "official": false, "generatedBy": "agent", "generatedAt": "..." }`.
4. The translation is usable but carries a visible "unofficial" badge in the
   viewer.

### Official (human-adjudicated)

1. A human reviewer reviews the unofficial translation.
2. They sign off at whatever level in the `content/` hierarchy they choose
   (a single block, a section, a chapter, or the entire folio).
3. `status.json` is updated: `{ "official": true, "signedOffBy": "reviewer-id", "signedOffAt": "ISO-date", "sourceHash": "<sha256-of-source-md>" }`.
4. The viewer shows an "official" badge and removes the "unofficial" warning.

### Staleness detection

When the source content changes:

1. The pipeline computes `sha256(block.md)` and compares it to the
   `sourceHash` in each translation's `status.json`.
2. If they differ, the translation is marked **stale**: `{ "official": true, "stale": true, ... }`.
3. The viewer shows a "stale — needs re-adjudication" indicator.
4. The translation remains visible but with a warning. A human must re-sign-off
   to clear the stale flag, which also updates `sourceHash`.

### Sign-off at any hierarchy level

A user can sign off at any level of the `content/` tree:

- **Block level:** signs off one block's translation.
- **Section level:** signs off all blocks in the section.
- **Chapter level:** signs off all blocks in the chapter.
- **Folio level:** signs off the entire folio's translation for a locale.

The sign-off is recorded in `status.json` at the level chosen. A lower-level
sign-off overrides a higher-level one for that specific node.

---

## Gettext PO/POT pipeline

### Why gettext

Gettext is the WHO SMART Base standard for translations. It provides:

1. A proven extraction → translation → injection cycle.
2. Compatibility with professional translation tools (Weblate, Crowdin,
   Launchpad, Poedit, Lokalize).
3. Fuzzy matching for partial translations after source changes.
4. Context and plural support.

### Pipeline overview

```
                     PRE-PROCESSING (SMART Base)
                     ─────────────────────────────
                     Markdown → segment → normalize
                           ↓
┌──────────────────────────────────────────────────────┐
│  EXTRACT                                              │
│  content/**/*.md  →  pot-extract  →  messages.pot     │
│  (per-block or per-chapter granularity)               │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  TRANSLATE                                            │
│  messages.pot  →  translator  →  <locale>/messages.po │
│  (Weblate / Crowdin / agent / human)                 │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  INJECT                                               │
│  <locale>/messages.po  →  po-inject  →  block.md     │
│  (produces translated .md in translations/<locale>/) │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
                     POST-PROCESSING
                     ─────────────────────────────
                     Re-assemble → validate → render
```

### Pre-processing (from SMART Base)

The extraction state machine is a direct port of SMART Base's
`extract_translations.py` (function `extract_markdown`, lines 700–856) and
its text-cleaning helper `_clean_markdown_text` (lines 633–697). The same
state machine handles:

1. **YAML front matter** — skipped entirely (delimited by `---`).
2. **Fenced code blocks** — tracked by fence character and length, skipped.
3. **HTML skip blocks** — `<style>`, `<script>`, `<pre>` content skipped.
4. **Headings** — each heading text → one `msgid`.
5. **List items** — bullet/number stripped, item text → one `msgid`.
6. **Blockquotes** — `>` prefix stripped, content → one `msgid`.
7. **Table cells** — each cell → one `msgid`, separator rows skipped.
8. **Kramdown attributes** — `{: .class}`, `{:toc}` skipped entirely.
9. **Paragraph accumulation** — continuation lines joined, flushed on blank.
10. **Text cleaning** — inline markdown stripped: HTML comments, images (→ alt
    text), links (→ link text), autolinks, code spans, bold/italic markers,
    HTML tags, Liquid {% raw %}`{% %}`{% endraw %} tags, Liquid {% raw %}`{{ expr }}`{% endraw %} → `{lqd_expr}` gettext
    brace variables.

The TypeScript port lives in `content/pipeline/pot-extract.ts`
(`extractMarkdown` + `cleanMarkdownText`). It is **copied into
folio-assistant** (not loaded from SMART Base) because the markdown parsing
is generic prose processing. SMART Base Python originals remain as-is.

**Source scripts in SMART Base** (`input/scripts/`):

| Script | Lines | Role |
|---|---|---|
| `extract_translations.py` | 1,158 | POT extraction: PlantUML, SVG, ArchiMate, **Markdown** |
| `inject_translations.py` | 933 | PO injection: PlantUML, SVG, ArchiMate, **Markdown** |
| `extract_script_strings.py` | 276 | Script/template string extraction |
| `pull_translations.py` | 269 | Orchestrator for Weblate/Crowdin/Launchpad pulls |
| `pull_weblate_translations.py` | 401 | Weblate API sync |
| `pull_crowdin_translations.py` | 313 | Crowdin API sync |
| `pull_launchpad_translations.py` | 196 | Launchpad API sync |
| `register_translation_project.py` | 630 | Per-project Weblate registration |
| `register_all_dak_projects.py` | 182 | Bulk DAK project registration |
| `generate_weblate_yaml.py` | 274 | Weblate component discovery config |

### Post-processing

After injection, the translated markdown goes through post-processing that:

1. **Unshields placeholders** — replaces `{1}`, `{2}` etc. back with the
   original math, code, and label tokens.
2. **Validates structure** — checks that the translated markdown has the same
   block structure as the source (same number of paragraphs, same heading
   levels, same list nesting).
3. **Validates completeness** — flags any `msgid` with an empty `msgstr` as
   an untranslated segment.
4. **Runs linting** — catches common translation artifacts (doubled
   punctuation, unclosed brackets, orphaned placeholders).

### Extraction (POT generation)

The `pot-extract` tool scans content nodes and extracts translatable strings:

- **Block titles** — from `block.ts` manifests.
- **Prose bodies** — from `block.md` files, segmented by paragraph.
- **Chapter and section titles** — from `chapter.ts` and `section.ts`.
- **Kind headings** — now a translatable catalogue in `schemas/translation.ts`.
- **Alt text and captions** — from `diagram` and `table` blocks.

Non-translatable content is excluded via shielding:
- LaTeX math (`$...$`, `$$...$$`, `\begin{equation}...`)
- Block labels (`def:quantum-universe`)
- Code blocks (fenced and inline)
- `lean` companion content
- URLs and file paths

### Injection (PO → Markdown)

The `po-inject` tool takes a completed `.po` file and produces a translated
`.md` file:

1. Reads the source `.md` and the `.po` file.
2. For each translatable segment, substitutes the `msgstr` for the `msgid`.
3. Unshields placeholder tokens back to their original content.
4. Preserves non-translatable elements (math, labels, code) in place.
5. Writes the result to `translations/<locale>/block.md`.

### Round-trip QA

Semantic verification is per BLOCK, not per page, and it is not a script's to assert: `content/pipeline/translation-block-qa.ts` writes what a script can establish (coverage, preserved terms, untranslated echoes) and leaves
`translation-semantic-roundtrip` with no verdict. A real round trip needs a back-translator that has not seen the original — a pair of agents, recorded by `content/pipeline/translation-roundtrip.ts`. See
`library/skills/library-core/translation-manager.md`.

---

## Human translator process

The human translator workflow is a dedicated path for professional translation,
distinct from the agentic/machine path. See BPMN:
`library/processes/human-translation-workflow.bpmn`.

### Steps

1. **Translation coordinator** identifies content requiring human translation
   and selects the target locale.
2. **POT extraction** produces the translatable string set.
3. **Translation assignment** — the coordinator assigns the POT to a qualified
   translator (ideally a domain SME for the content area).
4. **Translation** — the human translator works in their preferred tool
   (Poedit, Weblate, Crowdin, or directly editing `.po` files). They receive:
   - The `.pot` file with source strings
   - Context notes (block kind, chapter title, surrounding content)
   - A glossary of domain terms with approved translations
5. **Completeness check** — the coordinator verifies that all `msgid` entries
   have `msgstr` translations. Partial translations are acceptable but flagged.
6. **PO injection** — the completed `.po` file is injected to produce
   translated markdown.
7. **SME review** — a subject-matter expert (may be the same translator or a
   different domain expert) reviews the translation for clinical/technical
   accuracy. This is especially critical for WHO content where terminology
   precision has policy implications.
8. **Round-trip QA** — back-translation comparison (see Round-trip QA above).
9. **Sign-off** — the reviewer signs off, making the translation official.

### WHO disclaimer

For WHO SMART Guidelines content, all derivative translations must embed the
WHO legal disclaimer stating that:
- The translation was not created by WHO.
- The English edition is the authoritative and binding original.
- WHO is not responsible for the content or accuracy of the translation.

This disclaimer is automatically appended during post-processing when the
folio's `contentType` includes WHO/DAK content.

---

## Unverified translation display

Unverified (unofficial) translated content displays a visible warning in the
viewer:

### Warning indicator

- **Icon:** ⚠️ amber triangle, positioned next to the locale badge.
- **Notice text:** _"This translation has not been verified by a human
  reviewer. It may contain errors."_
- **How-to-fix:** The notice includes an actionable link/instruction:
  _"To verify: review the translation and use `translation_signoff` to mark
  it as official."_

### Stale translation indicator

- **Icon:** 🔄 circular arrows, next to the locale badge.
- **Notice text:** _"This translation was verified, but the source content
  has changed since. Re-review is needed."_
- **How-to-fix:** _"Source changed on \<date\>. Review the diff and re-sign-off
  with `translation_signoff`."_

### Viewer rendering rules

| Status | Badge | Background | Content shown? |
|---|---|---|---|
| Official, current | ✅ `Official` (green) | Normal | Yes |
| Official, stale | 🔄 `Stale` (amber) | Yellow tint | Yes, with warning |
| Unofficial | ⚠️ `Unverified` (grey) | Grey tint | Yes, with warning (unless `officialRequired`) |
| No translation | — `Not translated` | — | Source language shown |

---

## Dependency walking
{: #dependency-walking }

Folio-assistant layers can declare **content and skill dependencies** on
other folio-assistant layers, following the same methodology as FHIR/SUSHI
dependencies but upstream from them.

### Declaration

In `<name>.config.json`:

```json
{
  "dependencies": [
    {
      "name": "WHO SMART Base",
      "uri": "https://github.com/WorldHealthOrganization/smart-base",
      "version": "1.0.0"
    },
    {
      "name": "smart-immunization",
      "uri": "https://github.com/WorldHealthOrganization/smart-immunization",
      "version": "0.1.0"
    }
  ]
}
```

### Resolution order

When loading skills and content, the folio-assistant agent starts at the **root
folio** and walks the dependency tree **depth-first, in the order dependencies
are listed**, overlaying content and skills on top. A dependency's translations
are visible to the root folio but do not override the root's own translations.

For translation specifically:
1. Root folio's block-level translations
2. Root folio's global `translations/` directory
3. First dependency's translations (recursively)
4. Second dependency's translations (recursively)
5. ... and so on
6. Agent fallback (generate unofficial translation)

---

## Configuration

### `<name>.config.json` additions

```json
{
  "translation": {
    "defaultLocale": "en",
    "supportedLocales": ["en", "ar", "zh", "fr", "ru", "es"],
    "translationDir": "translations",
    "potGranularity": "block",
    "officialRequired": false
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultLocale` | string | `"en"` | BCP 47 tag for the source language. |
| `supportedLocales` | string[] | `["en", "ar", "zh", "fr", "ru", "es"]` | The six UN languages by default. Folios may add or remove. |
| `translationDir` | string | `"translations"` | Subdirectory name within content nodes. |
| `potGranularity` | `"block"` \| `"chapter"` \| `"folio"` | `"block"` | Whether to generate one POT per block, per chapter, or one for the whole folio. |
| `officialRequired` | boolean | `false` | If true, only official translations are shown in the viewer. |

---

## Viewer language switcher

### Location

A **globe icon** (🌐) in the left sidebar, positioned after the QR code icon
and before the bibliography. On mobile, it appears in the sidebar overlay.

### Behaviour

1. Click the globe to open a dropdown listing the folio's `supportedLocales`.
2. Each locale shows its native name and a status indicator:
   - ✅ Official translation available
   - 🔄 Unofficial translation available
   - ⚠️ Official but stale
   - — No translation
3. Selecting a locale:
   - Swaps all prose content to the selected locale's translations.
   - Kind headings (`Definition`, `Theorem`, etc.) switch to the locale's
     equivalents.
   - Non-translatable content (math, code, labels, Lean) is unchanged.
   - The URL gains a `?lang=<locale>` parameter for bookmarking.
4. The selected locale persists in `localStorage`.

### Kind heading translations

Kind headings come from a translatable catalogue:

```typescript
const KIND_HEADINGS: Record<string, Record<string, string>> = {
  en: { definition: "Definition", theorem: "Theorem", ... },
  fr: { definition: "Définition", theorem: "Théorème", ... },
  es: { definition: "Definición", theorem: "Teorema", ... },
  ar: { definition: "تعريف", theorem: "مبرهنة", ... },
  zh: { definition: "定义", theorem: "定理", ... },
  ru: { definition: "Определение", theorem: "Теорема", ... },
};
```

---

## Generated interfaces — the knowledge-graph viewer

Everything above extracts from **authored** files. The knowledge-graph viewer
(`scripts/kg-viewer.ts`) is not one: it is a generator that writes a
single-file HTML page, and its interface strings sit inside the code that
emits it.

The strings are not extracted from the generated page, because its regeneration
would churn every entry and invalidate every sign-off without a single string
having changed; they are lifted into a declared table in the source,
`scripts/kg-viewer-strings.ts`, and extracted from **there**:

```sh
bun run cat translate-kg-viewer --extract [--locale fr]  # table → translations/<loc>/kg-viewer.pot
bun run cat translate-kg-viewer:check                    # drift between table, .pot and .po
bun run cat kg:viewer                                    # reads every .po, embeds the catalogues
```

It is the same pipeline as everything else — `formatPot` from
`content/pipeline/pot-extract.ts`, `parsePo` from `po-inject.ts` — with the
same shape as `scripts/translate-bpmn.ts`, which does this for diagram labels.
**There is no inject step**: generating the page *is* the injection, so a
separate translated copy would be an artefact nothing serves.

`--check` distinguishes two things that look alike:

| finding | fails the check? | why |
|---|---|---|
| `.pot` no longer matches the table | **yes** | a translator is working from a document that no longer describes the page |
| a translation dropped a `{placeholder}` | **yes** | the sentence silently loses its number |
| an entry for a string the page no longer says | **yes** | dead work, and a msgid nothing will ever look up |
| a string with no translation yet | no | the ordinary state of a translation in progress; the page falls back to English per string |

### The boundary is drawn on the page

The chrome is translatable. **The graph is not**: node titles, descriptions and
property names arrive in the JSON-LD document in whatever language the corpus
is written in, and no catalogue in the viewer can reach them.

The page says so, in the language the reader chose, whenever that is not
English, because otherwise a reader cannot tell a missing translation from a
corpus that is simply English.

### The catalogues are stubs, filled by a translator

`translations/<locale>/kg-viewer.po` exists for every locale with every
`msgid` present and every `msgstr` **empty**. The viewer interface is not
machine-translated, because a machine translation into a language nobody here
reads cannot be checked here; a translator fills the catalogues. Until one does, the
viewer offers English alone — an empty catalogue is not a
language the page can show, so it is not listed. Fill a `.po`, run
`bun run cat kg:viewer`, and that language appears in the switcher.

The language switcher is a UI control and carries the obligations in
[`ui-accessibility`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/ui-accessibility.html):
each option named in its own language with `lang` set, accessible names
translated alongside visible text, the change announced, and `dir` flipped for
a right-to-left language. The reader's choice is the **same `fa-locale`
localStorage key the docs site writes**, overridable per link with `?lang=`.

---

## Integration with WHO SMART Base

The WHO SMART Base repository contains a ~5,500-line translation subsystem
that wires Weblate, Crowdin, and Launchpad with extraction, injection,
per-project registration, and completeness reporting. This subsystem is the
upstream authority for DAK translation workflows.

### What to import vs wrap

Following the principle in the DAK layer's `skills/content/authoring-who-smart-guidelines/smart-base-tools.md`
— **load it; never vendor it** — folio-assistant does not copy SMART Base's
translation scripts. Instead:

1. **Extraction/injection scripts** are invoked from a SMART Base checkout
   (like `bpmn2fsh` and `dmn2html` today).
2. **PO file format** is shared — SMART Base produces PO, folio-assistant
   consumes it, and vice versa.
3. **Completeness reporting** is re-used — SMART Base's coverage metrics
   become inputs to folio-assistant's QA sweep.

### IG Publisher translation

IG Publisher has its own translation support for FHIR resources. This is a
separate pipeline from prose translation:

- FHIR resources carry `language` and `designation` elements.
- ValueSet translations use FHIR's native `designation` system.
- IG Publisher's translation framework is documented in the FHIR spec.

The prose translation pipeline and the FHIR translation pipeline are
independent.

---

## MCP tools

The following MCP tools are registered:

| Tool | Adapter | Description |
|---|---|---|
| `translation_extract` | generic | Extract translatable strings to a POT file. |
| `translation_inject` | generic | Inject translations from a PO file into content nodes. |
| `translation_status` | generic | Report translation coverage and staleness per locale. |
| `translation_signoff` | generic | Mark a translation as officially signed off at a given level. |
| `translation_validate` | generic | Run round-trip QA on translations. |

These are generic tools (not adapter-specific) because translation applies to
all content types — documents, papers, and DAK folios alike.

---

## BPMN workflow

The translation workflow integrates with the existing content lifecycle:

```
See: library/processes/translation-workflow.bpmn
```

### Stages

1. **Content authored** — source content exists in the default locale.
2. **POT extracted** — translatable strings are extracted.
3. **Translation produced** — agent or human creates PO file + translated `.md`.
4. **Round-trip QA** — back-translation detects semantic drift.
5. **Human review gateway** — drift or bad terminology routes to reviewer.
6. **Sign-off** — human adjudicator marks translation as official.
7. **Staleness watch** — source changes trigger re-extraction + stale marking.

---

## Content audit: block kinds and translation support

Every block kind must support translation. The audit:

| Kind | Translatable content | Non-translatable | Notes |
|---|---|---|---|
| `definition` | title, `.md` body | label, `.lean` | `lean` field is language-independent |
| `theorem` | title, `.md` body | label, `.lean` | |
| `lemma` | title, `.md` body | label, `.lean` | |
| `proposition` | title, `.md` body | label, `.lean` | |
| `corollary` | title, `.md` body | label, `.lean` | |
| `algorithm` | title, `.md` body | label, `.lean` (opt) | |
| `conjecture` | title, `.md` body | label | |
| `example` | title, `.md` body | label | |
| `remark` | title, `.md` body | label | |
| `proof` | title, `.md` body | label, `.lean` (opt) | |
| `simulator` | title, `.md` body | label, `.py`/`.html` code | Simulator code is not translated |
| `prose` | title, `.md` body | label | Primary translation target |
| `equation` | title, caption | label, TeX math | Math notation is universal |
| `diagram` | title, caption, alt text | label, SVG/image | Alt text IS translatable |
| `table` | title, caption, cell text | label | Table content is translatable |
| DAK kinds | title, `.md` body | label, FHIR resources | FHIR resources use their own i18n |

**Finding:** All block kinds support translation through their title and `.md`
body. The extraction pipeline handles the non-translatable exclusions (math,
code, labels) uniformly.

---

## References

- [GNU gettext manual](https://www.gnu.org/software/gettext/manual/)
- [BCP 47 — Tags for Identifying Languages](https://www.rfc-editor.org/info/bcp47)
- [FRBR — Functional Requirements for Bibliographic Records](https://www.ifla.org/references/best-practice-for-national-bibliographic-agencies-in-a-digital-age/resource-description-and-standards/bibliographic-control/functional-requirements-the-frbr-family-of-models/functional-requirements-for-bibliographic-records-frbr/)
- [Dublin Core `dcterms:language`](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#http://purl.org/dc/terms/language)
- WHO SMART Base translation subsystem (~5,500 lines, Weblate/Crowdin/Launchpad)
