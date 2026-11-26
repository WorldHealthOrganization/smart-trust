# AGENTS.md — folio-assist-core

The agent guidance that governs work here is the root
[`AGENTS.md`](../AGENTS.md); everything it says about beans, briefs, process
state and continual progress applies unchanged.

What is specific to this layer, and it is one rule:

> **Core owns content vocabulary; the harness owns the harness.**
> A schema describing what a folio HOLDS, where it CAME FROM, or how much of it
> is actually PRESENT belongs here. A schema describing skills, workflows,
> roles or tools belongs in `cat-harness/`.

`BASE_GRAPH_TYPOLOGIES` in `cat-harness/schemas/cat-harness.ts` records the
rule, and `cat-harness/schemas/folio-graph-typology.ts` shows what goes wrong
when a layer owns a kind it cannot serve.

**Before adding anything here**, read [`README.md`](README.md) — in particular
the three materialisation states, which have no default and are checked rather
than assumed. The state names (and fixity) are the one exception to the rule
above: they live in `cat-harness-tools/schemas/kg/materialization-state.ts`,
and the gates that judge content stay here.

## The skills this layer publishes

<!-- skills:index:begin -->

_54 skills in 11 directories, generated from each skill's front matter. `bun run cat readme:sync` rewrites this list and `readme:sync:check` fails when it is stale. Skills this repository inherits are listed by the repositories that publish them._

**`skills/`** (1)

| Skill | What it is for |
|---|---|
| [`deep-document-research`](skills/deep-document-research.md) | Answer a question from a corpus this folio already holds, iteratively, and stop on a stated condition. |

**`skills/content/content-lifecycle-ext/`** (10)

| Skill | What it is for |
|---|---|
| [`block-change-summary`](skills/content/content-lifecycle-ext/block-change-summary.md) | Post-delivery content block change summary for a folio edit-set: extract changed block labels across `.md`, `.ts` and content-type sibling files, present a per-chapter table with `.md`-first GitHub… |
| [`content-author`](skills/content/content-lifecycle-ext/content-author.md) | Content Authoring |
| [`content-plan`](skills/content/content-lifecycle-ext/content-plan.md) | Content Planning |
| [`content-publish`](skills/content/content-lifecycle-ext/content-publish.md) | Content Publication |
| [`content-retire`](skills/content/content-lifecycle-ext/content-retire.md) | Content Retirement |
| [`corpus-commit-contract`](skills/content/content-lifecycle-ext/corpus-commit-contract.md) | The contract the `corpus` role is held to when an accepted edit is committed into it: take the write only on the editor's acceptance, as one change with its QA sidecars, under the commit-hygiene… |
| [`diff`](skills/content/content-lifecycle-ext/diff.md) | Show per-block content changes with viewer links, changelog, and undo impact analysis |
| [`quality-control`](skills/content/content-lifecycle-ext/quality-control.md) | Apply the publication quality gates to an aggregate of QA output, and decide whether it clears. |
| [`registry-authority-contract`](skills/content/content-lifecycle-ext/registry-authority-contract.md) | The contract the `external-registry` role is held to when a candidate source is checked against the body that publishes it: resolve the identifier through its own API and return the record, so… |
| [`review-comments`](skills/content/content-lifecycle-ext/review-comments.md) | Reviewer comments on a folio's edit-set, from a tagged pull-request comment to a structured todo on the review page. |

**`skills/content/folio-document-adapter/`** (16)

| Skill | What it is for |
|---|---|
| [`block-actions`](skills/content/folio-document-adapter/block-actions.md) | Every block of a rendered document links back to where it can be changed: [edit] opens the block's Markdown source in GitHub's editor, and [feedback] opens a GitHub issue about that block, from the… |
| [`document-authoring`](skills/content/folio-document-adapter/document-authoring.md) | Author a **document** folio: policy guidance, a standard, a report, a handbook — anything whose content is structured prose rather than machine- checked mathematics. |
| [`document-publishing`](skills/content/folio-document-adapter/document-publishing.md) | Take a document folio from corpus to published artifact — without a TeX installation. |
| [`document-structure`](skills/content/folio-document-adapter/document-structure.md) | Decide and maintain the chapter/section skeleton of a document folio. |
| [`dsa-checksum`](skills/content/folio-document-adapter/dsa-checksum.md) | Compute and record the SHA-256 cryptographic digest of a signed Data Sharing Agreement's legal text as a W3C DCAT 3 `spdx:checksum` (`spdx:Checksum` with `spdx:checksumAlgorithm_sha256` and… |
| [`folio-content-lifecycle`](skills/content/folio-document-adapter/folio-content-lifecycle.md) | The content-folio half of the content-lifecycle skills (the harness's content-feedback, content-review, content-test, content-validate and evidence-appraisal; this layer's content-plan,… |
| [`folio-content-profiles`](skills/content/folio-document-adapter/folio-content-profiles.md) | The content-folio half of the harness's content-profiles skill: how a document folio is structured prose and how a paper folio extends it, block-kind discovery across block-kinds/ graphs,… |
| [`folio-editorial-workflow`](skills/content/folio-document-adapter/folio-editorial-workflow.md) | The content-folio half of the harness's editor, content-graph, md-authoring, canonical-watcher, and uses-editorial-review skills: routes glossary and notation work to ontologist and glossary-build,… |
| [`folio-getting-started`](skills/content/folio-document-adapter/folio-getting-started.md) | The content-folio half of the harness's getting-started skill: binds collab/processes/conduct/getting-started.bpmn and decisions/folio-intent.dmn, interprets describeRepository() content-type… |
| [`folio-repo-conversion`](skills/content/folio-document-adapter/folio-repo-conversion.md) | The content-folio half of the harness's repo-conversion skill: outside-content evidence and refutation candidate scanning, content-type marker declarations, and dispatching library and content… |
| [`normative-statements`](skills/content/folio-document-adapter/normative-statements.md) | Carry a **recommendation, requirement or rule** in a document folio — the thing an L1 health-policy guidance note, a standard, or a terms-of-reference document exists to state. |
| [`public-comment-channels`](skills/content/folio-document-adapter/public-comment-channels.md) | Set up the channels a public-comment release goes out on (an offline Excel sheet, a Google Form, a GitHub issue form, and the review sheet), each limited to the release's fixed references, with the… |
| [`public-comment`](skills/content/folio-document-adapter/public-comment.md) | Run a **public review** of a document folio. |
| [`review-log-watch`](skills/content/folio-document-adapter/review-log-watch.md) | Poll a review log (a drafting Contributor Feedback sheet, or a public-comment sheet's Review Change Sets) and its folio repository's issues mechanically, with Tool `review-log-watch`, and start… |
| [`review-sheet-agent-columns`](skills/content/folio-document-adapter/review-sheet-agent-columns.md) | Whenever an agent works on a change set of a folio whose review sheet is kept by the Tool `review-sheet-sync`, it writes the Agent tabs' columns for that change set and its comments as it goes:… |
| [`review-sheet-script`](skills/content/folio-document-adapter/review-sheet-script.md) | Build, install and reuse the Google Apps Script that keeps a review sheet's links and joined columns current (Tool `review-sheet-sync`). |

**`skills/content/requirements-planning/`** (2)

| Skill | What it is for |
|---|---|
| [`plan-request-gate`](skills/content/requirements-planning/plan-request-gate.md) | When somebody asks for a PLAN — "plan", "approach", "proposal", "how would you", "come up with" — produce a requirements document and a work plan, post or commit them where the governing methodology… |
| [`requirement-definition`](skills/content/requirements-planning/requirement-definition.md) | What a requirement IS, said once for both requirements methodologies: a statement, a conformance level, a source, at least one success criterion with its verification method, and a sign-off owner. |

**`skills/library/catalogue/`** (1)

| Skill | What it is for |
|---|---|
| [`dublin-core-renderings`](skills/library/catalogue/dublin-core-renderings.md) | Render a catalogue's Dublin Core records in the two standard forms an outside reader can use: Dublin Core XML, which a harvester reads, and JSON-LD bound to DCMI Metadata Terms. |

**`skills/library/cataloguing/`** (9)

| Skill | What it is for |
|---|---|
| [`archiving-arxiv`](skills/library/cataloguing/archiving-arxiv.md) | Materializing a paper from arXiv — why the version suffix is part of the identity rather than a detail, what to keep beside the PDF, and which facts must be read from the published API rather than… |
| [`archiving-web-pages`](skills/library/cataloguing/archiving-web-pages.md) | Capturing a web page so it can be cited later — the two fidelities, what each one is evidence of, and why capturing only one of them loses something that cannot be recovered. |
| [`bib-human-review`](skills/library/cataloguing/bib-human-review.md) | Human-validated bibliography workflow. |
| [`bib-qa`](skills/library/cataloguing/bib-qa.md) | Bibliography quality-assurance agent — validates every reference in content/schema/references.ts against several QA checks: URL availability, URL resolution, metadata completeness, citation… |
| [`filing-dublin-core`](skills/library/cataloguing/filing-dublin-core.md) | Cataloguing a source as it arrives — which facts are `dcterms`, which are this project's own, and why the line is drawn by the vocabulary rather than by convenience. |
| [`glossary-build`](skills/library/cataloguing/glossary-build.md) | Glossary Build Skill |
| [`glossary-terms`](skills/library/cataloguing/glossary-terms.md) | Add terms to a layer's glossary: local SKOS terms (folio-glossary/v1) with a definition, a code and links to external SKOS concepts, and references to whole external schemes. |
| [`mesh-subject-indexing`](skills/library/cataloguing/mesh-subject-indexing.md) | Assign Medical Subject Headings (MeSH) to a work as a DRAFT for a person to review, in the four stages of skill-pipeline-subject-indexing: over-generate concepts, filter them by NLM's own rules,… |
| [`ontologist`](skills/library/cataloguing/ontologist.md) | Semantic Ontologist — scans narrative text for ambiguous terms, generates a formal glossary/registry, and produces a mapping linking narrative strings to formal identifiers. |

**`skills/library/ingestion/`** (6)

| Skill | What it is for |
|---|---|
| [`document-intake`](skills/library/ingestion/document-intake.md) | Process uploaded documents (PDFs, scans, LaTeX, structured/normative guidelines, etc.) from uploads/ into structured content objects. |
| [`figure-rebuild`](skills/library/ingestion/figure-rebuild.md) | Turn a figure into a computable diagram: every figure of a source publication when a folio is built from its L1 entry, and any hand-drawn figure in a folio, an IG or a demonstrator that is redrawn… |
| [`l1-coverage`](skills/library/ingestion/l1-coverage.md) | Check that an L1 extraction accounted for every normative sentence in its source publication — captured as a node, or excluded for a fixed-list reason a person signed off. |
| [`l1-document-ingestion`](skills/library/ingestion/l1-document-ingestion.md) | The detailed method for turning a DOCUMENT in `uploads/` into a complete L1 entry in `library/<bib-slug>/` — which rung reads it and why, what a complete L1 entry holds, why an inferred structure is… |
| [`publish-extracted-statements`](skills/library/ingestion/publish-extracted-statements.md) | The standard step of adding source documents to a folio's working artifact: every statement extracted from a library source is published readably in the artifact's own pages AND in the shared… |
| [`tabular-metadata`](skills/library/ingestion/tabular-metadata.md) | Extract tabular metadata from a CSV or spreadsheet as CSVW — tables, rows, headers, columns, datatypes and location on sheet — recording every field as determined or explicitly undetermined. |

**`skills/review/`** (1)

| Skill | What it is for |
|---|---|
| [`review`](skills/review/review.md) | Where to start when a person or an agent reviews a document folio larger than one chapter, such as a DAK or an L1 digital transformation handbook. |

**`dsa/skills/dsa/`** (3) (opt-in `folio-assistant-core.dsa`)

| Skill | What it is for |
|---|---|
| `dsa-catalogue-status` | Set the life-cycle status (`adms:status`, W3C DCAT 3 §6.4.30) on a Data Sharing Agreement's DCAT 3 catalogue record when the agreement is amended, renewed, terminated, or expires, while keeping all… |
| `dsa-dcat-record` | Write the W3C DCAT 3 `dcat:Resource` and `dcat:Distribution` catalogue record for a Data Sharing Agreement (`dcat:downloadURL`, `spdx:checksum`, `odrl:hasPolicy`) and link versions with… |
| `dsa-odrl-source` | Bind a computable Data Sharing Agreement's W3C ODRL 2.2 `Agreement` to its signed legal text distribution using DCMI Metadata Terms `dcterms:source`, naming the exact `dcat:Distribution` whose… |

**`board/skills/board/`** (2) (opt-in `folio-assistant-core.board`)

| Skill | What it is for |
|---|---|
| `folio-board-diagram-interchange` | The content-folio half of the harness's board-diagram-interchange skill: binds processes/ui/board-place-note.bpmn and board-relocate.bpmn, folio board filters over pages and block kinds, and… |
| `folio-board-windows` | The content-folio half of the harness's board-windows skill: binds processes/ui/board-open-close.bpmn, folio-glass pinning (todo/<id> and landing/<slot>), and content-type card chrome ([x],… |

**`library-extras/skills/library-extras/`** (3) (opt-in `folio-assistant-core.library-extras`)

| Skill | What it is for |
|---|---|
| `audio-transcription` | Turn recorded speech (a meeting recording, a video with audio, an interview) into a transcript the library can cite, and choose WHICH open-source recogniser to run for the job: whisper.cpp by… |
| `bib-photo-ingestion-watcher` | Integration-watcher for bib physical-review issues. |
| `oxigraph-catalogue-search` | How to compile, partition, distribute via CDN, and query digital library catalogue and Qualified Dublin Core metadata using Oxigraph in-memory WebAssembly on the static edge. |

<!-- skills:index:end -->
