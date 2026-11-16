---
name: recommendation-extraction
description: >
  Extract the recommendations of an L1 source as L1 3.0 recommendation and
  remark nodes, then describe each one's scenario: the persona (role) who acts
  on it, the business process they act in, and the user story, as smart-kg L2
  user-scenario candidates that reuse the target guide's own vocabulary. Read
  before extracting recommendations from a WHO guideline or position paper
  with no printed "Recommendation N" labels, before linking a recommendation
  to a DAK persona or process, and whenever a recommendation has to say who
  does it and where. Covers the hybrid extraction (mechanical candidates, agent
  structuring, verbatim and 100 % coverage gates), the reuse-first precedence
  for personas and processes, the WARNING format, and sign-off.
input: L1/schemas/skills/recommendation-extraction/input.schema.json
output: L1/schemas/skills/recommendation-extraction/output.schema.json
uses-methodology:
  - terminology-coding
---

# recommendation-extraction

> Skill id: `recommendation-extraction` · Package: `authoring-who-smart-guidelines` ·
> Follows [`dak-l1-library`](dak-l1-library.md), which builds the library and
> the layout graph this extracts from.

A recommendation that does not say who does it, and during what, cannot be
implemented. This skill extracts each recommendation verbatim and records,
per recommendation, the persona who acts on it, the business process they
act in, and whether the guideline is **clinical**, **public-health** or
**health-system-strengthening**, before any L2 asset is drawn. It reuses
existing vocabulary and processes first, and warns when none fits.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/recommendation-extraction/input.schema.json) and [`output.schema.json`](../../schemas/skills/recommendation-extraction/output.schema.json).

- **In:** `l1Sources`, [`dak-l1-library`](dak-l1-library.md)'s output, and the `targetGuide` whose personas and processes the scenarios reuse first.
- **Out:** `l1Kg`: per included source, its `extractionPath` (`library/<bib>/l1-extraction/`), `sourceVersion`, the recommendation, remark, practice and scenario-candidate counts, the `coverage` and every `WARNING`. Stages 3 ([`l2-dependency-choice`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dependency-choice.md)), 4 and 5 take it as their `l1Kg`.

As stage 2 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md),
a source is **skipped only when it is already in a KG**: its extraction
directory exists, is declared, and is at the same source version
(`skipped: true`). A library entry with no extraction still needs it, after
`bun run cat ingest` and [`dak-l1-library`](dak-l1-library.md)'s
generic-document layer have put it in `library/`. Skipping is per source.

## The two halves

| half | produces | layer | schema |
|---|---|---|---|
| extraction | `recommendation` and `remark` nodes, verbatim — or, for implementation guidance, `implementation-practice` nodes | L1 | L1 **3.0**, `smart-base/L1/schemas/l1.ts` (`KGRecommendation`); `implementation-practice` is the `l1-library` extension, `smart-base/L1/schemas/l1-library.ts` (`KGImplementationPractice`); not smart-kg 1.0 |
| scenario | one `user-scenario` candidate per recommendation, joined to `persona` and `business-process` | L2 | smart-kg `ontology/l2/l2.json`, unchanged; smart-base `UserScenario.fsh` |

No L1 field carries the scenario: L1 holds what WHO says; who does it, and
during which process, is adaptation, which is L2's.

### Implementation guidance prints practices, not recommendations

A recommendation is a GRC-approved normative statement made by a guideline.
A publication whose `publicationType` is **`implementation-guidance`** or
**`methodology`** (a "how to" document, such as a digital transformation
handbook with its own "Best practices" lists) makes no recommendations of
its own (handbook for guideline development §1.9). What it prints as
normative is an **`implementation-practice`** node, never a `recommendation`
with a new kind code.

- Record the type in the curation as `publication.publicationType`. With
  `implementation-guidance` or `methodology`, every `as: recommendation`
  decision emits an `implementation-practice` node at
  `<publication>/implementation-practice/<key>`, and the graph names
  `l1-library.context.jsonld` so the validator scopes L1 + the extension.
- The class lives in `smart-base/L1/schemas/l1-library.ts`; `l1.ts` stays the
  L1 3.0 layer, unextended.
- It carries `identifier`, `statement` (verbatim) and `contentHash`; no
  `kind`, `direction`, `strength` or certainty. A `kind` on such a decision
  is refused.
- **No remark.** L1 3.0's `remark` is minted under a recommendation, so a
  `remark` decision in such a publication is refused: exclude the sentence
  or make it its own practice.
- `smart-base/L1/schemas/validate.ts` refuses a `recommendation` defined in an
  implementation-guidance or methodology publication.
- The output graph is `l1.json`.

## Part 1 — extraction (hybrid)

Candidates are mechanical, structure is the agent's, and the gates are
mechanical.

1. **Ingest the source** (see `dak-l1-library` steps 1–2):
   `bun run cat ingest uploads/<doc_id>/<doc_id>.pdf --library <lib>`.
2. **Fast path — a guideline that prints labels.** When the source prints
   `Recommendation N:` labels,
   `bun run smart-base/L1/scripts/extract-smart-kg-l1.ts --entry smart-base/library/<id>`
   extracts them by label (it writes L1 1.0). A source with no labels, such
   as the measles position paper, takes the hybrid path below.
3. **List the normative sentences.** Run core's `l1-coverage` with an empty
   capture list; every sentence carrying a marker (`should`, `shall`, `must`,
   `recommend*`, `should not`, `may be given/administered/offered/…`) comes
   back as `unaccounted`, with its page:

   ```sh
   echo '[]' > captured.json
   bun run cat l1:coverage --text pages.json --captured captured.json --out candidates.json
   ```

   `--text` is body text only, page-tagged; strip references and running
   headers first.
4. **Structure them.** The agent turns each candidate into an L1 3.0
   `recommendation` (`identifier`, `statement`, `kind`, `population`,
   `intervention`, `setting`, …) or a `remark` (`text`, `remarkType`)
   attached by `hasRemark`:
   - `statement` and `text` are **verbatim**: the printed words, line breaks
     joined, nothing else changed;
   - a sentence that is history, background or a manufacturer's statement is
     **proposed** for exclusion (step 5), not forced into a node;
   - GRADE strength and certainty are set only where the source prints them;
   - every node is `inferred`, with a note and evidence (page and quote).
5. **Gate: 100 % accounted for.** Re-run with the captured statements and the
   exclusions:

   ```sh
   bun run cat l1:coverage --text pages.json --captured captured.json \
     --exclusions exclusions.json --out coverage.json
   ```

   Exit 0 only at 100 %. An exclusion counts only with `signedOffBy`: **an
   agent may propose one, only a person signs it**, and the reason is one of
   `background-fact`, `manufacturer-statement`, `editorial`,
   `research-question` or `duplicate-of:<id>`.
6. **Gate: the graph's shape.** Validate the L1 3.0 document with the Zod
   port: `npx tsx validate.ts <graph.json>` from `smart-base/L1/schemas/`.

### Part 1 as a tool: `l1-recommendation-candidates`

Steps 3–6 are the named skill
[`recommendation-candidates`](recommendation-candidates.md), satisfied by
the Tool `smart-base/L1/tools/l1-recommendation-candidates/`, run twice around
the agent's judgement:

```sh
# 1. mechanical: the work list — every normative sentence, with hints; nothing decided
bun run smart-base/L1/scripts/l1-recommendation-candidates.ts --entry smart-base/library/<id> --out <dir>
# 2. agent: write <dir>/curation.yaml (l1-recommendation-curation/v1), one decision per location
# 3. mechanical: the gates, and the L1 3.0 graph
bun run smart-base/L1/scripts/l1-recommendation-candidates.ts --entry smart-base/library/<id> \
  --curation <dir>/curation.yaml --out <dir> [--check]
```

**The curation is the agent's step.** The script hints
(`licence-or-imprint`, `glossary-page`, `layout-fragment`) and proposes the
publication's identity from the printed ISBN; it never decides. Per
candidate location (`p<page>:s<n>`, `l1-coverage`'s own), the agent records
one of:

| `as` | means | fields |
|---|---|---|
| `recommendation` | an L1 `recommendation` node | `key`; `statement` only to narrow a joined list to one bullet, or to join a split sentence; `kind` only where printed |
| `remark` | a `remark` of a recommendation, by `hasRemark` | `of`, `remarkType` |
| `part-of` | inside another recommendation's statement | `of` |
| `exclude` | a PROPOSED exclusion, one of the fixed reasons | `reason`; `signedOffBy` is a person's acting as `l1-extraction-reviewer`, never an agent's |

Every decision carries a `basis`. A location may carry a list of
`recommendation` decisions: the splitter reads a bulleted list as one
sentence.

It **refuses** a statement not printed in the entry (normalised), an
override that neither contains nor is contained in its candidate, a location
the entry does not hold, a reused key, and a remark of an undeclared key,
then checks the graph with `smart-base/L1/schemas/validate.ts`. It writes
`recommendation-candidates.json` (the work list), `l1.json`,
`exclusions.proposed.json`, `extraction-warnings.md` and `run-context.json`.

**Who signs an exclusion.** Each record in `exclusions.proposed.json` names
its signer as a role-graph `RoleRef`
(`cat-harness-tools/schemas/process/role-graph.ts`):
`"signerRole": {"role": "l1-extraction-reviewer"}`, declared in
`smart-base/scenarios/roles.json` (a person, inheriting the harness's
`reviewer`). It stays unsigned until a person in that role reads the
sentence against the printed page and signs it in `Lane_ExtractionReviewer`
of [`classify-and-code-content.bpmn`](../../processes/classify-and-code-content.bpmn),
following [`classify-and-code-content`](classify-and-code-content.md) and
[`terminology-coding`](../../../methodologies/terminology-coding.md).

**Provenance.** Each run of either tool writes a cat-harness
`folio-run-context/v1` (`cat-harness-tools/schemas/sdlc/run-context.ts`) as
`run-context.json` beside its output: the platform commit, the mounts, the
script and its hash, and the inputs' hash basis, as `pdf-ocr.py` writes at
ingest. The work list cites it by reference. `--check` ignores it, as it
ignores `generatedAt`.

**Declare every output directory, in the same commit.** Each `--out`
directory in or beside a library (`library/<entry>/l1-extraction/`, a
sibling such as `library/l1-recommendation-scenarios/` that Part 2 writes,
or `l1-extractions/<entry>/`) is declared in the layer's `<name>.json`
with `"graphTypologies": ["l1-extraction"]`, one entry per directory, never
a wildcard (smart-base's `l1-extraction-9789240116191-eng` is the pattern).
An undeclared one fails folio-assistant's `check:l1-complete`, and with it
the QA working copy, every test shard and gate reading it, and the staging
build. When the entry lives in another layer's library, hold the output
at `l1-extractions/<entry>/`, never in a `library/<entry>/` folder: that
reads as a duplicate of the entry, which the library ingest refuses. Before
staging, run `bun run cat check:l1-complete` in a folio-assistant checkout
that mounts the layer at the commit being staged; it must exit 0.

## Part 2 — the scenario

Its mechanical step is the named skill
[`recommendation-scenarios`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-scenarios.md) (Tool
`l1-recommendation-scenarios`).

### The shape: L2 nodes, reused unchanged

Per recommendation, one `user-scenario` (smart-base `UserScenario`: `title`,
`id`, `description`, `personas[]`) joined by three edges smart-kg L2
already licenses:

```
recommendation   implementedBy  user-scenario
user-scenario    involves       persona
business-process realises       user-scenario
```

The `description` is a user story:

> As a *&lt;persona&gt;*, during *&lt;process&gt;*, I *&lt;act&gt;* so that *&lt;outcome&gt;*.

Each link records its **source**, as an intake `classifications` entry does
(`cat-harness-tools/schemas/library/intake.ts`):

| source | meaning | smart-kg derivation |
|---|---|---|
| `declared` | a person said so; names `by` | `decided` |
| `context` | the section the statement is printed under settles it | `inferred` |
| `inferred` | an agent's reading of the statement | `inferred` |

and a **status**: `candidate` until a person reviews the entry.

### Reuse first, stop at the first hit

Persona, business-process and guideline-domain coding apply the
[`terminology-coding`](../../../methodologies/terminology-coding.md) methodology
(backed by [`classify-and-code-content`](classify-and-code-content.md), the
[`terminology-lookup`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/tools/terminology-lookup/terminology-lookup.ts)
Tool, and [`glossary-terms`](../../../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md)):

| what | 1st | 2nd | otherwise |
|---|---|---|---|
| persona | the target guide's own personas | smart-base's generic `DAK.Persona.*` (`input/fsh/actors/`, ISCO / CDHI) | a glossary **candidate**, and a WARNING |
| process | the target guide's own processes | a domain process catalogue — none exists yet (smart-base-clinical holds no processes): report "catalogue absent" | `could-not-determine`, and a WARNING |
| domain | `clinical` \| `public-health` \| `health-system-strengthening`, per scenario, with its source | | |

**Never invent a process.** A process not in the guide is
`could-not-determine`, and the warning says why: it is the evidence that the
guide (or a catalogue) is missing one. Choose the persona who **acts** on
the statement, not the one it is about: "Vaccine should be offered to
travellers" is acted on by the health worker. A persona a guide's
description does not cover (an immunization DAK's health worker treating
measles) falls to the next rung rather than being stretched.

Read the **statement**, not its section: "Countries should achieve ≥95 %
coverage" sits under *WHO position* and is acted on through coverage
analysis (IMMZ.I), while "MCVs should not be given to individuals with …
severe immunosuppression" is a per-client check (IMMZ.D, IMMZ.D5). A
national policy, schedule-design or programme decision is not a per-client
process.

### Run it

1. **The vocabulary.** For the target guide, read its `business-processes.md`
   and `personas.md` from a guide checkout; for the generic rung, read
   smart-base's ActorDefinitions:

   ```sh
   bun run smart-base/scripts/l1-scenario-vocabulary.ts --guide <guide checkout> --out guide-vocabulary.json
   bun run smart-base/scripts/l1-scenario-vocabulary.ts --fsh-actors <smart-base checkout>/input/fsh/actors --out smart-base-generic-personas.json
   ```

   Each file records the repository, the commit, and the file and line of
   every entry. The guide's name, namespace and repository come from the
   checkout's `<name>.json` and `sushi-config.yaml` `canonical`. Persona ids
   are `slug(title)` where the guide prints none (as smart-kg `kgid.mjs`
   mints a persona IRI); process ids are the printed Process IDs.
2. **The mapping** (`l1-scenario-mapping/v1`, YAML), authored: per
   recommendation, its `personas` (an `id`, or a `candidate` term), its
   `process` (an `id`, or `could-not-determine`), `act`, `outcome` and
   `domain`, **each with a `source` and a `basis`** quoting the statement,
   the vocabulary row or the person's ruling.
3. **The candidates:**

   ```sh
   bun run smart-base/scripts/l1-recommendation-scenarios.ts \
     --l1 <recommendations.yaml | l1-graph.json> --vocabulary guide-vocabulary.json \
     --generic smart-base-generic-personas.json --mapping mapping.yaml --out <dir> [--check]
   ```

   It writes `scenario-candidates.l2.json` (an L2 graph document) and
   `scenario-warnings.md`, and **refuses**:
   - an id the vocabulary does not hold;
   - a recommendation with no mapping entry (coverage is 100 %);
   - a mapping entry for a recommendation the source does not hold;
   - a `declared` link that names nobody.
4. **Tier 2.** `node tools/validate.mjs <l1-graph.json> scenario-candidates.l2.json`
   in a smart-kg checkout; give it the L1 document too, or every
   `implementedBy` edge reads as dangling.

### The WARNING format

One line per warning, greppable, in the report and on stderr:

```
WARNING process-not-determined <key>: no <guide> process (<ids>) realises this; domain process catalogue absent. <basis>
WARNING persona-glossary-candidate <key>: persona "<term>" is a glossary candidate — … <basis>
```

A warning is not a refusal: the run succeeds, and the warnings are the work
list for whoever owns the guide's processes or the glossary.

### Review and sign-off

Everything this skill writes is a **candidate**. A person reviews an entry
and records it in the mapping (`review: {by, at}`); the run then marks that
entry's links `reviewed`. A person may also turn a link `declared` (with
`by`). An agent never writes either. Part 1's exclusions are signed only by
a person acting as `l1-extraction-reviewer`.

## What smart-kg L2 could not hold

`user-scenario` declares only `id`, `title`, `description`, `sourceKind`,
`source` and `resolutionStatus`, and tier 2 refuses any other node property.
So `domain`, each link's `linkSource` and the `reviewStatus` go on the
edges' open `properties`; the act and outcome live only inside
`description`.

## What it feeds, later

The scenarios are the hinge to L2. Each `realises` edge names the process,
and so the **BPMN** whose lane is the persona, a scenario will be drawn in;
the recommendation's conditions become **DMN** rules (for measles, the
IMMZ.D2.DT.Measles.* and IMMZ.D5 tables); and the user story becomes a
functional **requirement** (`functional-requirement fulfilledBy persona`).
None of that is drawn here. `could-not-determine` scenarios have no process
to draw into yet.

## The worked examples

**An ingested handbook, end to end.**
`smart-base/l1-extractions/9789240116191-eng/` is the *Digital
transformation handbook for health product catalogue* (WHO, 2025; its
sections are in `who-iris/library/9789240116191-eng/`) run through both
tools: 48 normative sentences. It is implementation guidance, so the
curation took **22 implementation practices** and proposed 30 exclusions
(licence text, glossary definitions, background on SMART Guidelines,
chapter checkpoints, and the definition of the data owner on page 26), each
naming `l1-extraction-reviewer` as signer and none signed, so coverage reads
18/48 until a person signs them. The scenarios reuse the handbook's own
roles (data owner, custodian, steward, project manager, solution architect:
18 links), one generic `DAK.Persona.DataManager`, and 3 glossary candidates
(the national regulatory authority, twice, and the master data governance
group). The handbook prints no business process with an id and no
health-system catalogue exists, so all 22 are `could-not-determine`: 26
warnings, one of them `practice-implementedBy-unlicensed` (smart-kg's L2
licenses `implementedBy` from a recommendation only, so from a practice it
is a proposal for L2). The test `l1-recommendation-candidates.test.ts`
keeps it current.

**An authored L1, scenario half only.** The 75 recommendations of the WHO
measles position paper (WER 92(17), 2017), mapped against the immunization
guide's personas and processes, with the vocabulary, mapping, output and
warnings, live in that guide's library with the check that keeps them
current:
<https://github.com/litlfred/smart-immunizations/tree/main/library/l1-recommendation-scenarios/measles>.
smart-base holds no guide's example. The generic rung it was run with is
`smart-base/scripts/fixtures/l1-recommendation-scenarios/smart-base-generic-personas.json`,
shared with the handbook example.

**An authored L1 from pictures.** When the source prints its
recommendations only as images (a schedule poster, a slide deck), Part 1
finds nothing and the L1 is authored from the inspected image narratives
and transcriptions of the rendered page. Its check is the step skill
[`transcription-verbatim`](transcription-verbatim.md) (Tool
`l1-transcription-verbatim`): every statement verbatim in the narrative or
transcription it names, every transcription word corroborated by the text
layer unless listed under `inspectionOnly` with its basis. The Uganda
schedule poster and UNEPI deck
(<https://github.com/litlfred/smart-immunizations-uganda/tree/main/library/l1-recommendation-scenarios/uganda>)
are the worked example.
