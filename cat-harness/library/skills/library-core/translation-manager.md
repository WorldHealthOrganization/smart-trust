---
name: translation-manager
description: >-
  Translation lifecycle management for folio content. Covers gettext PO/POT
  extraction and injection, TranslationNode manifests as KG nodes,
  official vs unofficial translations, staleness tracking, sign-off workflow,
  automatic badge rendering, the poSources fallback resolution chain, and
  translating into several locales as a team: one extraction, a PR per
  locale to main, FHIR terms as CodeSystem supplements, the untainted round
  trip as run, and the per-locale QA report.
graph-typologies:
  - translation-sources
---

# Translation manager

> Skill id: `translation-manager` · Package:
> `folio-core`

Manage the translation lifecycle for folio content. This skill covers the full
round trip from source content to translated content, including extraction,
translation, injection, quality assurance, sign-off, and automatic badge
rendering.

## Reference

The authoritative documentation is
[`docs/guides/translation-support.md`](../../../docs/guides/translation-support.md). Read it
before using this skill. This file is the operational checklist, not the
architecture.

## The two-axis model

A content node varies along two axes:

1. **Format** — `.md` (Markdown), `.lean` (Lean 4), `.tex` (LaTeX), `.bpmn`,
   `.dmn`, etc.
2. **Language** — BCP 47 locale tags (`en`, `fr`, `es`, `ar`, `zh`, `ru`).

The format axis is handled by companions. The language axis is handled by the
PO/POT pipeline with `TranslationNode` manifests in `translations/<locale>/`.

## TranslationNode — .po/.pot files as KG nodes

Each `.po`/`.pot` pair is wrapped by a `.ts` manifest that makes it a
**first-class node in the knowledge graph**:

```typescript
import type { TranslationNode } from "../../schemas/translation";

const node: TranslationNode = {
  label: "trans:fr/index",
  locale: "fr",
  sourceFile: "docs/index.md",
  potFile: "translations/fr/index.pot",
  poFile: "translations/fr/index.po",
  status: { locale: "fr", official: false, generatedBy: "agent" },
  coverage: { translated: 37, total: 37, pct: 100 },
};
export default node;
```

The manifest carries the status, coverage, and QA results inline — no
separate `status.json` or `.qa.json` files.

## PO source resolution (fallback behavior)

Content blocks can declare explicit PO sources via `poSources[]` on
`BlockBase`. When not declared, the pipeline resolves by convention:

1. **Block-level:** `translations/<locale>/<block-stem>.po`
2. **Chapter-level:** `translations/<locale>/<chapter-slug>.po`
3. **Folio-level:** `translations/<locale>/global.po`
4. **Dependency walk:** walk `<name>.config.json` dependencies depth-first

When `poSources` is declared, only the listed files are consulted (no
fallback). Later entries override earlier for the same msgid.

## What is translatable

| Content | Translatable? | Notes |
|---|---|---|
| Block titles | ✅ | From `.ts` manifests |
| Prose bodies (`.md`) | ✅ | Segmented by paragraph |
| Chapter/section titles | ✅ | From `chapter.ts` / `section.ts` |
| Kind headings | ✅ | "Definition", "Theorem", etc. → locale catalogue |
| LaTeX math | ❌ | Universal notation |
| Block labels | ❌ | Structural identifiers |
| Code blocks | ❌ | Programming language content |
| Lean companions | ❌ | Formal mathematics |
| FHIR resources | ⚠️ | Use FHIR's own `designation` system, not gettext |

## The exported GRAPH per locale

The graph a machine consumes is translated per locale, not only the rendered
page: `bun run cat kg:locale` writes it (`kg:locale:bootstrap` for the nested
layer, `kg:locale:check` in the gate set).

Four rules; an implementation breaks the first by default.

**1. The core graph must not reference its translations.** No
`hasTranslation`, no `availableLocales`, no `translationOf`, no per-locale
`@id`, no locale key in the `@context`. The obvious implementation hangs a
pointer off each node; that grows the core by an edge per locale per node and
makes bootstrap's graph reference artefacts it does not own and cannot
validate. The arrow runs **one way** — a per-locale document references the
core, never the reverse — and the core is complete with no translation
existing. The same relation
[`board-diagram-interchange`](../../../skills/ui/ui-core/board-diagram-interchange.md) states for a board
and its folio. `localeDocumentsUnreferenced` checks it rather than trusting it.

**2. A translated node keeps its `@id`.** A translation is not a new term.
Locale-suffixed IRIs are ruled out by that, not chosen against.

**3. The language tag rides the VALUE, never the document.** A blanket
`"@language": "fr"` would assert French over every string that fell through —
and fall-through is the normal case, because `parsePo` takes only non-empty
`msgstr` and skips fuzzy entries. A translated value is
`{"@value": …, "@language": …}`; a fall-through stays a plain string under the
document's declared `sourceLanguage`. Fall-through is then visible *in the
data* rather than inferable from a coverage number.

**4. A catalogue is scoped to the asset it was extracted from.** Merging every
`.po` under a locale lets a docs page's `"yes"` → `"oui"` translate every BPMN
gateway branch label — output that looks right while no diagram catalogue
exists, so it can only be caught by provenance, not by reading the output. So
a `.po` is read only when its stem names an asset the graph projects. A
residual is accepted and named: a msgid from diagram A applies to an identical
string on a node from diagram B — not a new assumption, since `kg-export`
already dedupes lane-derived `Role` nodes by lane name across every diagram.

**What the gate is not.** `kg:locale:check` says nothing about how much is
translated. Where a diagram template has no `.po` in a locale, the exporter
writes nothing and reports the locale saying so. A locale with nothing to say is
**reported**, never a missing file a reader cannot tell from a broken build;
`--all-locales` emits a source-language copy per locale for the other reading.

## Workflow

### 1. Extract (POT generation)

```sh
bun run pipeline/pot-extract.ts [--chapter <dir>] [--block <label>]
```

Or use the `translation_extract` MCP tool. Produces `.pot` files at the
configured granularity.

### 2. Build the locale term base, and review it

**Before translating**, build the term base for the target locale from the
layered glossaries, review it, and translate with it. See
[The locale term base](#the-locale-term-base) for where each layer's glossary
is and the precedence rule. The term base is the merge
`translation:glossary:check` checks against, so build it the way that check
does, not by hand from one layer.

Review it before you use it: a term the more authoritative layer has fixed is
not re-translated, and a term with no fixed form in any layer is a decision
you make once, here, not again in every block.

### 3. Translate

Translate with the term base open. Options, in order of preference:

1. **Existing `.po` from SMART Base** — if the DAK already has translations
   from Weblate/Crowdin, use them.
2. **Open machine translation, as candidates** — `bun run cat
   translation:candidates --instance <root> --engine opus-mt` (OPUS-MT,
   Helsinki-NLP Marian models, CC-BY 4.0, run locally), or
   `--engine opus-mt,libretranslate --url <yours>` to add a self-hosted
   LibreTranslate as a second source. The Tool is
   [`translation-candidates`](../../../tools/translation-candidates/translation-candidates.json).
   Each source's text for each empty or fuzzy string is a CANDIDATE, appended
   to `<locale>/<catalogue>.candidates.json` (`translation-candidates/v1`). A
   candidate whose placeholders or markup do not round-trip is not recorded.
   Candidates are never a barrier to having a translation: an EMPTY `msgstr`
   gets the first good candidate, `#, fuzzy`. A non-empty `msgstr` is never
   overwritten, and `official` is never set. `--init` starts a `.po` from a
   template that has none.
   No hosted freemium API is used. The DeepL / Google Translate route through
   `po-translate` is no longer recommended, because it needs a quota and sends
   the text to a third party. Paid services (DeepL, Google Cloud Translation,
   Azure Translator, Amazon Translate) are deliberately not candidate sources
   here.
3. **Agent translation** — LLM translation of `.pot` → `.po`. Also tagged
   unofficial. An agent's text can be recorded as a candidate with
   `source.kind: "agent"` through the same writer.
4. **Human translation** — the gold standard.

A candidate is a draft, never a verdict. Candidates reach a person through
the translation review page (`review.html`, beside the status page). There a
reviewer picks one candidate per string, accepts the fuzzy default, or types
their own text. The resulting issue becomes the recorded adjudication, and it
names the source of the picked candidate. A catalogue whose author wrote
`DO NOT MACHINE-FILL` in its header (the viewer's `kg-viewer.po`) still gets
candidates for a reviewer. Its `.po` is never machine-filled: the tool
refuses that, and so does an agent.

#### Modal strength: a recommendation stays a recommendation

A lowercase **should** is a recommendation, and its translation is the
locale's recommendation form, never its obligation form. Turning it into
"must" strengthens the claim, and in a guide it then reads as a conformance
rule. Lowercase **must**, **shall** and **needs to** are obligations. The
uppercase BCP 14 keywords (RFC 2119, RFC 8174: MUST, SHALL, SHOULD, MAY) keep
the fixed renderings the locale's term base gives them.

| locale | should (recommendation) | must / shall (obligation) |
|---|---|---|
| ar | ينبغي، يُستحسن | يجب |
| es | debería, se recomienda | debe |
| fr | devrait, il est recommandé de | doit |
| ru | следует, рекомендуется | должен |
| zh | 应当, 宜, 建议 | 必须 |

A brief may not normalise one into the other, for consistency or anything
else. A lexical round-trip screen cannot see this shift either: the words of a
back-translation overlap whether it says "should" or "must". So the
adjudicator reads every string whose source has a modal (see "What counts as
drift").

### 4. Inject (PO → translated Markdown)

```sh
bun run pipeline/po-inject.ts --locale <locale> [--chapter <dir>]
```

Or use the `translation_inject` MCP tool. Reads `.po` files and produces
translated `.md` in `docs/<locale>/` for docs pages, or in the content
directory for content blocks.

### 5. Create TranslationNode manifest

After injection, create or update the `.ts` manifest:

```sh
# The pipeline does this automatically, or create manually:
translations/<locale>/<stem>.ts
```

The manifest carries status, coverage, and round-trip QA results inline.
Validate with `TranslationNodeSchema` from `schemas/content/translation.ts`.

### 6. Round-trip QA

After injection, run round-trip translation QA:

```sh
bun run pipeline/translation-qa.ts --locale <locale>
```

Or use the `translation_validate` MCP tool for coverage and staleness.
**Semantic verification is per block and lives in the sidecar**, not in a
node-level summary field: `TranslationNode.roundTripQA` was removed with the
numbers it held. See §"Per-block translation QA" below, and route drift to a
human reviewer.

### 7. Glossary consistency

**After translating**, check that every glossary term was translated the way
the term base fixes it, and the same way everywhere:

```sh
bun run cat translation:glossary:check --instance <dir> --locale <locale>
```

The check enforces a fixed term wherever the source uses it **in its glossary
sense**; see [The locale term base](#the-locale-term-base) for how the sense is
decided. It exits 1 on an in-sense use whose `msgstr` does not render the fixed
translation. A use still pending adjudication is listed and fails nothing. To
have the pending uses ruled on, list them for the adjudicator and record the
answers:

```sh
bun run cat translation:glossary:check --instance <dir> --pending --json
bun run cat translation:glossary:check --instance <dir> --record <verdicts.json>
```

Fix each violation in the `.po`, not in the injected output, and re-inject.
Then include the check's glossary section in the KG QA report, so the reviewer
who signs off sees it. That section lists violations, exceptions, pending
uses and other-sense uses. A violation the translator believes is right is not
fixed by editing the term base in the layer: a term a lower layer fixes is
changed in that layer, or it goes to the adjudicator.

### 8. Sign-off

A human reviewer signs off at the desired level:

```sh
bun run pipeline/translation-signoff.ts --locale <locale> --level <block|section|chapter|folio> [--path <content-path>]
```

Or use the `translation_signoff` MCP tool. Updates the `TranslationNode`
manifest with sign-off metadata and source hash.

#### Before sign-off: review and adjudication, catalogue by catalogue

A reviewer who reads one catalogue and finds it acceptable, or finds a
mistranslation and picks a candidate or writes their own text, records that
through the review page, a `translation-adjudication/v1` issue and a PR — the
loop in [`translation-adjudication`](translation-adjudication.md), drawn as
[`translation-review-adjudication.bpmn`](../../processes/translation-review-adjudication.bpmn).
It marks a catalogue **reviewed** (or **flagged**, when a suggestion was
applied) and never official: the sign-off above stays a separate act.
Candidate translations from any engine — an agent model, OPUS-MT,
LibreTranslate / Argos — are produced through
[`translation-candidate-source`](translation-candidate-source.md), and **an
empty `msgstr` gets the first candidate, marked fuzzy**: candidates are never
a barrier to having a translation.

### 9. Staleness watch

On every content change, the pipeline checks whether any official translation's
`sourceHash` no longer matches the source `.md`. Stale translations are flagged
in the viewer and in `translation_status` output.

## Translating into several locales as a team

The workflow above is one catalogue's life. When several locales are produced
from the same source at the same time, by several translators, the steps are
the same and the order around them matters more. The process is
[`multi-locale-translation.bpmn`](../../processes/multi-locale-translation.bpmn),
with its round trip in
[`translation-round-trip.bpmn`](../../processes/translation-round-trip.bpmn)
and its upkeep in
[`translation-refresh.bpmn`](../../processes/translation-refresh.bpmn),
whose steps the [`translation-refresh`](translation-refresh.md) skill gives as
commands. Five lanes: the **owner** (scope, merge window, sign-off), one
**source-language lead**, one **locale translator** per locale, a
**back-translator** and a **round-trip adjudicator**.

### Extract once, and merge the source first

The source-language lead extracts every template once: the pages, the
diagrams (`translate-bpmn --extract`, which writes this harness's own diagrams
into its own `translations/`) and the glossary schemes. All of them go into
**one** source PR to main, and it merges before any locale starts, so every
translator branches from the same main. **A translator never re-extracts.** A
locale that seems to need a different template has found a defect in the
extraction, and that is reported to the lead.

### Each locale is its own PR to main

Each locale lands as its own PR, based on main and targeting main. **Never
into the source branch**: a PR into an unmerged branch lands only when that
branch does, and a branch that has merged and then receives more commits
carries work main will never see. Once a source PR has merged, its branch
receives nothing more; a later source fix is a new PR.

### What a locale contributes

- `translations/<locale>/**.po`, mirroring the templates' layout.
- A translation-node manifest beside each catalogue, `official: false`,
  `generatedBy: "agent"` (or `"human"`). **No `status.json`**: status is a
  property of the manifest, and officiality is a person's sign-off, never the
  translator's.
- **FHIR terms as CodeSystem supplements**, one file per locale, holding the
  locale's designations for every code system it translates. Never an edit
  inside a resource: an inline designation is a change to the source, every
  locale's edits then collide in the same file, and the supplement is the
  mechanism FHIR has for exactly this. The supplements must compile with no
  SUSHI error and pass their structural checks (each one names the code
  system it supplements, at its version, and carries only codes it defines).
- **Source-text errors are reported, never fixed in the translation.** The
  translator renders the source as it stands and notes the location; the lead
  files every such note as **one** issue on the source. A fix to the source is
  a source PR, and the next refresh carries it to every locale.

### The deterministic gates

Before any round trip, every gate passes:

| gate | command |
|---|---|
| templates current | `translate-bpmn:check`, and the layer's page and glossary template checks |
| every catalogue matches its template | `translation:drift:check --instance <root>`, `translation:obsolete:check --instance <root>` |
| coverage | `translation:status --instance <root>`; a published page has its catalogue: `translation:catalogue:check` |
| placeholders, tags and URLs preserved | `translation:page-qa --instance <root>` (`translation-terms-preserved`) |
| officiality agrees | `check:translation-officiality` |
| the graph per locale | `kg:locale:check` |
| translated links resolve | `translated-links:check` |
| supplements compile | the layer's supplement build: 0 SUSHI errors, structural checks pass |

### The untainted round trip, as run

The discipline is [`untainted-verification`](../../../skills/process/process-core/untainted-verification.md)
and §"The agentic round trip" below; this is how it was run across several
locales.

1. **The sample**, chosen by the translator before any result is seen: every
   diagram label, every persona and scenario string, and a seeded random
   fraction of the rest, with the seed recorded so the sample can be drawn
   again. A refresh samples only the strings it changed.
2. **The back-translator** gets the target strings alone, keyed by an opaque
   id, and renders them into the source language with no tools.
3. **A mechanical pre-screen** over every (source, back-translation) pair
   flags a pair whose negation, modal, quantifier, number or code tokens
   differ, and a pair whose word overlap is low. It only orders the reading.
4. **The adjudicator reads every flagged pair in full**, with the source and
   the back-translation and never the target, and rules each drift or not
   drift with its reason.
5. **Both halves are stated.** Drift: a claim added, dropped, weakened,
   strengthened or reversed; a term of art swapped for one that means
   something else; a named entity, number or quantifier moved. Not drift, and
   the cases that came up most: inflection; a purpose clause rendered in the
   subjunctive (Russian `чтобы` + past tense reads back as "so that … would");
   an acronym left uninflected in a language that inflects nouns; an acronym
   spelled out with the acronym kept beside it.
6. Each drift is fixed on the locale's PR, and the fix is noted beside the
   ruling. When two separate parties cannot be dispatched, the producer
   records "could not dispatch" with the reason: never a pass.
7. **Each ruling is keyed by content, never by position.** A ruling on a
   catalogue string is pinned by `field_hash.msgid`, the hash of the source
   it judged, and `field_hash.msgstr`, the hash of the translation; a reader
   pairs strings with rulings by those hashes. Its `index` is only an order
   for reading. So:

   | the catalogue | what follows |
   |---|---|
   | gains a string | no ruling is found for it, and the report fails loudly: run the round trip on that string |
   | changes a translation | its ruling's msgstr hash no longer matches: reported **stale**, never counted as a pass; run the round trip on that string |
   | loses or reorders strings | nothing is invalidated, and **no agent is re-run**; once the removal is on main, the layer's prune command (who-iris: `translation-qa:prune`) drops the removed strings' rulings and renumbers the rest |

   Rulings may be recorded before the PR whose strings they judge merges
   (they live on a state branch, the strings on main), so a ruling no string
   claims is not an error. The prune command is a dry run until `--write`,
   drops only rulings whose string main once held and no longer does, and
   never changes or invents a verdict. Run it after the removal merges, never
   on the removing branch: the state branch serves main too.

### Glossary precedence, and sense checks

The term base is layered, in this order: **the normative reference glossaries
first** (the standards bodies' own term lists the layer declares), **then
each layer in the order the index config lists it, and the layer's own
glossary last**. A later layer adds terms; it never overrides a translation an
earlier one fixed in the same subject area. `translation:glossary:check
--instance <dir> --locale <locale>` checks a locale against that merge.

A platform term found in text of another subject area (the harness's
`policy`, say, in a health guide's prose) is a **sense check** for a person to
read, not a violation. It fails nothing.

### The QA report, one per locale

Each locale's report goes under `test/results/translation-qa/`: beside the
per-catalogue sidecars `translation:page-qa` writes, a report that names
coverage, each gate's result, the round trip (sampled, flagged, drift, not
drift, and every drift ruling with its fix), the glossary violations and sense
checks, and the source errors reported. The lead reads it before merging the
locale's PR, inside the owner's merge window.

### Harness commands for another layer's catalogues

Every command here reads a layer through its own declaration, so one
composed checkout serves every layer it mounts:

- **`--instance <dir>`** on `translation:drift:check` (each locale's `.po`
  against the `.pot` beside it, in the layer's `translation-sources`
  directory; a layer with no site has its catalogues compared and its
  pages reported unreadable), `translation:obsolete:check` (msgids a
  catalogue carries that its source no longer yields; exits 2 when the
  layer declares no catalogue directory), `translation:index:check` (the
  layer's own site; exits 2 when it declares no Jekyll site) and
  `translation:status` (prints the per-locale table, writes nothing; exits 2
  without a `translation-sources` declaration).
- **`translation:page-qa`** (`translation-block-qa.ts --catalogues`): every
  `<translations>/<locale>/<rel>.po` with its `.pot` beside it, not already
  measured as a block or page, is measured against its template, with a
  sidecar at `test/results/translation-qa/translations/<rel>.<locale>.translation-qa.json`
  in the layer's QA tree. `--instance <dir>` sweeps another layer.
- **`po-inject`** takes its units from `segmentMarkdown` in `pot-extract.ts`,
  the same segmentation the extractor writes the catalogue from, so a wrapped
  paragraph, list item or blockquote is looked up as the one `msgid` it was
  extracted as.
- **`translation:glossary:check`** is the glossary-consistency command named
  above.

Exit 2 from any of them is "could not determine", and is reported, never read
as clean.

## Per-block translation QA, and the agentic round trip

Two sweeps, two subjects, and confusing them is how a site reports a
translation nobody measured.

- **`translation-qa-sweep.ts`** measures the docs **site**: how much of each
  page exists in each language. It writes `docs/_data/translation-qa.json` and
  feeds the badge under a page title.
- **`translation-block-qa.ts`** measures a **block**, one sidecar per
  `(block, locale)`: `<stem>.<locale>.translation-qa.json`, in the
  `block-qa/v1` entry shape, which is what the per-block `TR` icon opens.

```sh
bun run cat translation:block-qa          # write the sidecars
bun run cat translation:block-qa:check    # fail if any is stale
```

### What a script may claim, and what it may not

Three criteria are deterministic and carry a `script` witness:
`translation-coverage`, `translation-terms-preserved` (acronyms, numbers and
URLs that must survive translation and did not — the class a fluent
mistranslation passes) and `translation-not-echo` (a "translation" identical to
its source; a *warn*, because that is right for a proper noun and wrong for a
sentence).

`translation-semantic-roundtrip` is written **with no entry**. A round trip
asks whether the MEANING survived, and that needs a translator that has not
seen the original. The only back-translation available to a script here is the
PO's own `msgid→msgstr` map read backwards, which returns the source exactly,
always: a perfect similarity score measuring the lookup table. **Do not fill
this criterion mechanically.** A green tick nobody should trust is worse than a
gap that says it is a gap — a reader who sees the tick stops asking.

> This was not hypothetical. `translations/fr/index.ts` carried
> `roundTripQA: { fail: 21, total: 36, method: "jaccard-word-overlap" }`, and
> its own `description` explained those failures away as expected "with limited
> vocabulary back-translator" — a measurement whose author has to explain it
> away is about the instrument, not the translation. The generator's
> back-translation map held **6 entries for 36 strings**: every string nobody
> had back-translated scored 0 similarity and was counted as drift, so `fail:
> 21` was a count of absences. A second script back-translated by applying a
> 40-pair word-substitution table to the French and wrote the result as a
> `block-qa/v1` sidecar with an **agent** reviewer.
>
> All of it is removed — the numbers, the `roundTripQA` field, the page badge
> that displayed them, and both scripts.

### The agentic round trip — an INSTANCE of untainted verification

**The discipline is generic and lives in
`untainted-verification`**: the two parties, why
neither may see what would let it shortcut, the `TOOLS_USED` declaration that
is recorded rather than assumed, which party rules, how both are written as
witnesses, the `model` / `model_source` rule, and the two traps — a sweep
replaces only entries whose reviewer is itself, and a verdict is hashed to what
it was about. Read that first. **This section is only what translation adds.**

The round trip was where that discipline was first written down, and
generalising it turned up a defect in the generalisation: the spine's
`UntaintedDispatch` was typed over `CompanionRole`, and **`po` is deliberately
not one** — a PO is a companion of a *(block, locale)* pair, not of a block. So
the founding case could not be expressed in the type taken from it. The
abstraction was widened rather than the case bent; `untaintedPartitionDefects`
now takes its artefact universe as a parameter.

#### The declaration

`ROUNDTRIP_DISPATCH` in `pipeline/translation-block-qa.ts`:

| party | sees | never sees |
|---|---|---|
| **back-translator** | `po` — the target text, and nothing else | `md`, `ts` |
| **adjudicator** | `md` — the original, plus the back-translation | `po` |

Disjoint, which is the whole rule in one line. Shown the source, a
back-translator writes the source back and the check passes vacuously —
measuring the lookup table rather than the translation. That is not a warning
here any more: `untaintedPartitionDefects` reports it, and a test asserts it.

#### What counts as drift, and what does not

**Both halves, always.** Told only what to look for, an adjudicator returns a
style review and every translation fails.

> Synonyms, articles and re-ordering are **not** drift. A claim added, dropped,
> weakened, strengthened or reversed **is**; so is a term of art swapped for
> something that means a different thing, and a named entity or quantifier
> moved.

A modal is a claim's strength: "should" read back as "must", or "may" as
"should", **is** drift, however close the words are.

This is the part that does **not** generalise — the spine requires a `drift`
statement and checks only that one exists, because "states what is not drift as
well as what is" is a reading, and a gate pretending to measure it would be the
defect the whole mechanism exists to stop.

#### Recording it

```sh
bun run pipeline/translation-roundtrip.ts --payload <file.json>
```

Where it lands: `translation-block-qa` writes `translation-semantic-roundtrip:
[]` on every run, and before `mergeCriteria` an unrelated re-run deleted a
round trip a pair of agents had produced — silently, with nothing in the output
to say so. That incident is why the spine carries the replace-only-your-own
rule.

Staleness is per locale here: the entries hash the `.md`, the `.ts` and the
`.po`, so editing the source stales **every** locale's round trip and editing
one translation stales only that locale's.

#### The instrument, not the translation

`translations/fr/index.ts` carried `roundTripQA: { fail: 21, total: 36, method:
"jaccard-word-overlap" }`, and its own `description` explained those failures
away as expected *"with limited vocabulary back-translator"*.

The generator's back-translation map held **6 entries for 36 strings**: every
string nobody had back-translated scored 0 similarity and was counted as drift,
so `fail: 21` was a count of absences. A second script back-translated by
applying a 40-pair word-substitution table to the French and wrote the result
as a `block-qa/v1` sidecar with an **agent** reviewer.

All of it is removed — the numbers, the `roundTripQA` field, the page badge
that displayed them, and both scripts. **A measurement whose author has to
explain it away is about the instrument, not the subject.**

## Automatic badge rendering

Translation badges are **automatically rendered** on every docs page by
`docs-ui.js`. There is no need to manually add badge includes or front matter.

### How it works

1. **`head_custom.html`** publishes a `<script type="application/json"
   id="fa-translation-meta">` block on every page, reading from page front
   matter
2. **`docs-ui.js`** reads that block and auto-injects into the page title:
   - **🌐 Language coverage badge** — `0/5 languages` (grey), `1/5` (amber),
     `5/5` (green)
   - **⚠️ Unverified warning** — auto-injected when `translation_status:
     unverified`

### Front matter for the translation pipeline to stamp

The translation pipeline stamps this front matter on generated pages:

```yaml
# Source pages (English):
lang: en
available_locales: ["en", "fr"]    # every locale the page can be read in

# Translated pages:
lang: fr
translation_status: unverified     # or "official"
translation_source: index.md       # source file
available_locales: ["en", "fr"]
```

### The locale term base
{: #the-locale-term-base }

A glossary term must be translated the same way on every page, and the same
way in every layer that uses it. The term base is the one place that says how.

**Where the terms come from.** Each layer's glossary is the directory it
declares with the `glossary` graph typology in its `<instance>.json` (a
`*.glossary.json` SKOS scheme per file); a layer without that declaration
has no glossary of its own and inherits its dependencies'. The terms'
translations today are the per-scheme catalogues
`translations/<locale>/glossary/<instance>--<scheme>.po` written from those
schemes, and the pins in `translations/<locale>/glossary.po` below.

**Subject areas.** Owner, 2026-11-07 (glossary review, "scoped fixed
terms"). Each glossary scheme declares the subject area its translations bind
in, as `subject` (`dcterms:subject`, a local id such as `harness-vocabulary`
or `digital-health-trust`); a term may override its scheme's. A term with no
subject, on itself or its scheme, binds only within its own scheme.

**Precedence applies within a subject area.** The term base for a locale is
the glossaries of the layer and every layer it `needs`, merged in layer
order: **within one subject area, the more authoritative (lower) layer fixes a
term's translation; a layer only adds.** A layer may add a term
no layer below defines, and may fix its translation. It may not give a term a
lower layer has fixed, in the same subject area, a second translation; that is
a violation, reported by `translation:glossary:check`, never an override.

**A term used in sense keeps its fixed translation.** Owner, 2026-11-07: if a
glossary term is used in the narrative in the correct context, the translated
narrative uses the glossary translation. The same word is not always the same
concept. The harness's `policy` is fixed as `策略` (an access policy), but a
health guide's "policy" is `政策`. So the sense of each use is decided by rule
first, then by an agent:

- **By rule.** A use in a page or catalogue whose subject area is the term's
  own is in sense automatically.
- **By an adjudicator.** Any other use is *pending* until an untainted
  adjudicator agent rules on it. The agent is given the term, its `skos`
  definition and the source sentence. It rules `in-sense` or `other-sense`
  with a one-line reason. Alternatively it records an *exception*: in sense,
  but the fixed term is wrong here because of a reason it gives.
- **What the check does with each state.** An in-sense use (by rule or by
  verdict) whose `msgstr` does not render the fixed translation is a
  violation, and the check fails. A pending use is listed and fails nothing.
  An `other-sense` use is not checked. An exception passes and is listed.
- **Keeping the English term.** A `msgstr` that keeps the English term
  verbatim renders it only where the term is part of a code or resource name.
  The same term left in English in prose does not render it.
- **Where verdicts are kept.** They are stored durably in the layer, in a
  committed file beside its catalogues. Each is keyed by the term's id and a
  hash of the `msgid`. Sense is a property of the source, so one verdict
  serves every locale and each use is asked about once. A changed `msgid`
  invalidates its verdict, and the use is asked again.
- **Who decides.** Each verdict names who decided it, an agent or person id,
  never a model. The check itself never asks a model.

**How a fixed translation is recorded.** It is derived, never flagged: a term
whose status is `authored` and whose scheme catalogue
(`translations/<locale>/glossary/<instance>--<scheme>.po`) holds a non-empty,
non-fuzzy `msgstr` for its `prefLabel` is fixed. There is no `#, fixed` flag
and no translated label in the glossary JSON, so the catalogue stays the one
place a translation lives. Whether a person has signed it off is the term's
`translationStatus`, per locale, `official` or `unofficial` (absent means
unofficial). A pinned `msgstr` in `glossary.po` below is a QA hint, not a term
base entry.

### The terminology glossary — `translations/<locale>/glossary.po`

`translation-terms-preserved` can see that a source term is absent from a
translation. It cannot see whether that is a correct localisation or a silent
loss: `WHO` missing from a French sentence is either `OMS` or a dropped term,
and guessing either way is worse than saying so. The glossary is how a folio
tells it which.

| entry | meaning | when the term is absent |
|---|---|---|
| `msgstr "OMS"` | the expected form, pinned | **fail** — the glossary said what it should be |
| `msgstr "FHIR"` (identity) | must survive verbatim | **fail** |
| `#, localised` | rendered in the target language, form NOT pinned | **pass** |
| no entry | unknown | **warn** |

**`#, localised` exists so a glossary needs no translated content.** Pinning a
form means authoring target-language material; the flag says the one thing the
checker needs — *this term gets localised, I am not pinning how* — and it is
reviewable by someone who reads only English. Pin a form when you want the
stricter check.

**It is a reading rule and cannot become a mute button**, which is the property
to preserve if you touch it. `localised` only converts a would-be finding about
that term into a pass: it never reaches `strict` tokens (a URL or a number
consults no glossary — nothing localises a `3`), it cannot act on a term it does
not name, an entry with neither a form nor the flag is *unfinished* rather than
permission, and each locale's file is read alone, so marking a term in French
says nothing about Arabic. Every one of those is a test in
`translation-block-qa.test.ts`.

The file is hand-authored and has no POT — `schemas/content/translation.ts` declares
that slot, and `TranslationNode.potFile` is optional for exactly this. Work item
`he0e`.

**`available_locales` includes the SOURCE language, and that is not a
formality.** It is the list a reader's language bar and coverage badge are
computed from — "which languages can I read this page in" — and the page is
certainly readable in the one it was written in. It is *not* the list of
translations that exist, which is what `availableLocales()` in
`pipeline/po-resolve.ts` returns by resolving
`translations/<locale>/<stem>.po`; that lookup can never name the source
language, because there is no `translations/en/` and there never will be. Use
`localesAvailableFor()` in `pipeline/translation-index.ts` to go from
one to the other.

Both halves of the corpus — generated and hand-authored translated pages —
must stamp the same meaning, or a badge reads a numerator larger than its
denominator.

**Do not stamp `qa_translation_*` keys**: stamped from a node-level round
trip, they publish every string nobody back-translated as semantic drift.
Per-block QA is the record: the `TR`
icon beside each block opens `<stem>.<locale>.translation-qa.json`, where a
verdict names the witness that reached it.

`docs-ui.js` injects the unverified-translation warning itself, from the page's
own front matter. **There is no include to add**: `buildLanguageBar` renders
the six UN languages and greys out the ones not yet translated. Do not add a
`translation-warning.html`, `language-selector.html` or
`qa-translation-badge.html` include.

## The navbar filters by locale
{: #the-navbar-filters-by-locale }

Translated pages are labelled as translated content in the graph and are not
shown in the navbar unless their locale is selected; with no translation, the
navbar falls back to the source language. Three rules, and each is enforced
somewhere different because each can break somewhere different.

### 1. A page is a translation because the PAGE says so

Three fields in its own front matter, and nothing else anywhere:

```yaml
lang: fr                              # this page is French
nav_exclude: true                     # keep it OUT of the static nav
translation_source: index.md          # which page it expresses
```

`pipeline/translation-index.ts` walks the site and reads those. A page
with no `lang` is the layer's **source language** — absent means the
default, not unknown.

**Never match a directory name against a list of language subtags.** A
layout coincidence is not a contract, and it is wrong in both directions: a folio with a `no/` chapter (Norwegian, or the English word) is
silently hidden from its own navbar, and a `pt-BR/` or `translated-fr/`
directory is silently shown as source. Neither announces itself — the navbar
simply has the wrong entries in it. Put the French page at `accueil-fr.md`
beside its source and it is indexed correctly; put an English page in a folder
called `fr/` and it is left alone.

**There is deliberately no `translated-content` graph typology.** A
declaration per locale subtree restates what every page already says and
grows as O(locales × subtrees). What is translatable is a node's content
(Markdown, BPMN, …), not its schema: translatability is a property of a
**format within a content type**. Each layer that owns a content type
declares, under `contentTranslations` in its own `<instance>.json`, which
formats have an extract/inject pair, and
`schemas/library/translation-tools.ts` collects them — Markdown, LaTeX, PlantUML,
SVG, ArchiMate, Excel, BPMN, FSH, FHIR JSON — and `isTranslatable(contentType,
extension)` is the predicate. The index asks it rather than inventing a second
answer, so a `.json` beside a page is data and never a language.

`translations/` **is** declared, as `translation-sources`. That one earns a
kind: a `.po` catalogue is not content in any language, so no file inside it
can declare one.

**There is no `nav_order` on a translated page.** It stands where its *source*
stands, because it replaces that item rather than joining the list. A
`nav_order` beside a `nav_exclude` is two facts that contradict each other, and
the check refuses it.

### 2. `nav_exclude` is the half that JavaScript cannot do

just-the-docs builds the navbar **at build time**, from front matter, on a
static site serving the same HTML to every reader. It cannot know which locale
anybody chose, so a translated page left in the nav is in it **for
everybody**. A script can swap a nav item; it cannot
un-render one without a flash of the wrong nav first.

So the translations leave the static nav entirely, and a reader with no
JavaScript gets the **source-language** navbar — the correct degraded answer
rather than an arbitrary one.

### 3. The swap, and the fallback that is not a code path

`pipeline/translation-index.ts` writes `docs/_data/translations.json`; `_includes/head_custom.html` publishes it
into every page as `#fa-translation-index`; `mountNavLocale` in
`site-chrome/assets/js/docs-ui.js` reads it.

With a non-source locale selected, each nav item that **has** a page in that
locale is rewritten in place — same position, same parent, translated title,
translated href, and its own `dir` so an Arabic item inside an English column
is not laid out backwards.

**Fallback is the absence of a rewrite.** An item with no page in the selected
locale is not touched, so it keeps its source-language title and link. There is
deliberately no branch for it: a fallback implemented as its own code path is a
code path that can be wrong, and this one cannot be.

Which locale is "selected", in precedence order: `?lang=` on the URL, then the
page's own `lang` when the page *is* a translation, then the remembered
`fa-locale`, then the source language. A locale the index has never heard of is
not honoured — labelling the navbar `tlh` while every item is in English is a
claim the page cannot support.

### Three states, and the third is why the index is published as `null`

| `data-fa-nav-index` | when | what the navbar does |
|---|---|---|
| `ok` | the index parsed and holds pages | filter it |
| `empty` | it parsed and holds none | nothing to swap; every item is source language |
| `unknown` | no island, unparseable, or `index: null` because the data file was absent at build time | left **exactly** as built |

`empty` and `unknown` produce the same navbar and are **not the same answer**:
one is *"this folio has no translations"*, the other is *"this build could not
tell"*. A build that could not determine the translation set must never render
as a folio that has none — so `translation:index` exits **2** rather than
writing a partial index over a complete one, and the deploy fails rather than
publishing it.

### Adding a locale

1. Write the pages, each carrying `lang`, `nav_exclude: true` and
   `translation_source`. Where they sit is up to you — the convention here is
   `<dir>/<locale>/<page>.md`, and nothing depends on it.
2. `bun run cat translation:index` and commit `docs/_data/translations.json`.

There is no third step and no declaration to remember. The thing that IS easy
to forget is `nav_exclude`, which is why `translation:index:check` fails
without it: a translated page left in the static nav is in it for every
reader, whatever locale they chose, which is the bug this section records.

## Official vs unofficial

| Attribute | Official | Unofficial |
|---|---|---|
| Human sign-off | ✅ Required | ❌ Not required |
| Viewer badge | ✅ Green | 🔄 Grey/amber |
| Source hash tracking | ✅ Yes | ❌ No |
| Staleness detection | ✅ Yes | N/A |
| Can be shown in viewer | Always | Configurable (`officialRequired` in config) |

## Six UN languages

The default `supportedLocales` in the layer's config (its `index.config.json` entry):

| Code | Language | Native |
|---|---|---|
| `ar` | Arabic | العربية |
| `zh` | Chinese | 中文 |
| `en` | English | English |
| `fr` | French | Français |
| `ru` | Russian | Русский |
| `es` | Spanish | Español |

Folios may add or remove locales. The viewer reads the list from config.

## translations/ directory rules

The `translations/` directory contains **only** three file types:

1. `.pot` — POT templates (extractable strings)
2. `.po` — PO translated strings
3. `.ts` — TranslationNode manifests (KG nodes)

**Do not** put `.md`, `.qa.json`, or `status.json` files in `translations/`.
Rendered output lives in `docs/<locale>/`; QA and status are properties of
the TranslationNode manifest.

**A layer with no `translations` directory of its own is hosted.**
`translationsHomeFor` (`schemas/kg/cat-harness.ts`) puts its templates in the
extracting harness's `translations/<locale>/<stub>/` —
`cat-harness/translations/<locale>/bootstrap/processes/*.pot` for bootstrap's
three diagrams — rather than inside the layer, which holds no translation
machinery. The templates are extracted from the bootstrap the harness has
pinned; when bootstrap is its own repository they stay here, since a
template is the harness's work over bootstrap's text, not part of it
([`kg-separation`](../../../skills/kg/graph-management/kg-separation.md) §"The pair").

## A layer that defines its own translator

A layer built on this one may define its own translator actor and translation
subsystem. Then the rule is **load it; never vendor it**: the subsystem is
invoked from that layer's checkout, not copied here, and that layer's skills
say how. This skill names no layer above it.

## IG Publisher i18n

For FHIR IG folios, the IG Publisher's own i18n system is used in parallel:

- `i18n-default-lang` in `sushi-config.yaml` — source language.
- `i18n-lang` — target languages.
- `translation-sources` — path to `input/translations/{lang}/` containing
  per-resource `.po` files.
- Run with `-generation-off -validation-off` flags for fast translation-only
  builds.

The prose translation pipeline (this skill) and the FHIR resource translation
pipeline (IG Publisher) are complementary and independent.

## Do not

- **Do not manually add badge includes.** `docs-ui.js` renders them
  automatically from front matter. The include it replaced is **deleted, not
  deprecated** — an include that still exists is one somebody adds back.
- **Do not publish a semantic-QA number a script cannot establish.** A
  back-translation from this repo's own PO map, or from a word-substitution
  table, scores the table rather than the translation — and a string with no
  back-translation at all scores 0 and reads as drift. If no independent
  back-translator has run, the criterion has no verdict, and saying so is the
  honest output.
- **Do not infer a locale from a directory name.** `docs/fr/index.md` is
  French because it says `lang: fr`. A subtag match is wrong in both
  directions and neither failure announces itself — see
  [The navbar filters by locale](#the-navbar-filters-by-locale).
- **Do not add a graph typology for translated content.** It is the same kind of
  thing as the page it translates, differing by a field the file declares.
  Translatability is a property of a FORMAT within a content type —
  `schemas/library/translation-tools.ts` and `isTranslatable` — not of a directory.
- **Do not leave a translated page in the static nav.** `nav_exclude: true` is
  what keeps it out, and no amount of client-side work substitutes for it: the
  nav is built once, for every reader, before anybody has chosen a locale.
- **Do not put non-PO files in translations/.** Only `.pot`, `.po`, and `.ts`
  manifests belong there. Rendered `.md` goes in `docs/<locale>/`.
- **Do not vendor SMART Base translation scripts.** Load from checkout.
- **Do not translate math, labels, or code.** Exclude in extraction.
- **Do not auto-sign-off.** Official status requires a human.
- **Do not re-extract per locale.** Templates are extracted once, merged to
  main in one source PR, and every locale starts from them.
- **Do not open a locale PR into the source branch**, and do not push to a
  branch whose PR has merged. Each locale is its own PR to main.
- **Do not fix the source in a translation.** Report it as one issue.
- **Do not edit a FHIR resource to translate it.** Its terms go into the
  locale's CodeSystem supplement.
- **Do not re-translate a term a lower layer fixes in the same subject area.**
  Translate with the locale term base, and fix a violation where the term is
  fixed. A use in another subject area is enforced once an adjudicator rules
  it in sense; until then it is pending, not a violation.
- **Do not treat staleness as "wrong".** A stale translation is still useful;
  it just needs re-review.
- **Do not conflate FHIR resource translation with prose translation.** They
  are different pipelines with different tooling.
- **Do not auto-remove staging previews.** Require `staging:cleanup` label.

## Content-type-specific translation tools

Each content type declares what formats it can translate and what scripts
handle each format. The declaration belongs to the layer that OWNS the
content type, under `contentTranslations` in its `<instance>.json`;
`schemas/library/translation-tools.ts` collects every present layer's profiles and
refuses a content type declared twice. A module or diagram path in a profile
resolves from the declaring layer, then down its `needs` chain. The
profiles:

| Content type | Formats | RTL |
|---|---|---|
| **document** | Markdown | ✅ |
| **paper** | Markdown + LaTeX | — |
| **dak** (WHO L2) | Markdown + PlantUML + SVG + ArchiMate + Excel + BPMN | ✅ |
| **ig** (WHO L3) | Markdown + FSH + FHIR JSON | ✅ |

The generic pipeline (`pot-extract.ts`, `po-inject.ts`) handles Markdown.
Adapter-specific tools extend it with format-specific extractors. The
Python originals from SMART Base live in `scripts/translation/` and are
referenced in the registry.

### RTL support

Arabic (and Hebrew, Farsi, Urdu) pages are detected at load time by
`docs-ui.js` and get `dir="rtl"` on `<html>`. The CSS in `docs-ui.css`
provides smooth 0.4s transitions for sidebar and content layout:

- Sidebar slides to the right side
- Content flows RTL
- Mermaid diagrams and badges stay LTR
- BPMN diagrams need re-rendering with translated labels

### Staging review

When presenting translated content for review, use the `staging-review`
skill to provide before/after URL comparison tables. See
`schemas/sdlc/staging.ts` for the `StagingComparison` schema.

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md).
