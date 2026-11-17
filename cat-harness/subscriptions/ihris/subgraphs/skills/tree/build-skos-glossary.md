---
name: build-skos-glossary
description: >
  Build this folio's glossary: every term extracted from its sources as W3C
  SKOS (folio-assistant core's folio-glossary/v1), linked to external SKOS
  concepts only where a verified mapping says so, and published on the site's
  glossary/ page, in its search and as SKOS JSON-LD.
input: src/schemas/skills/build-skos-glossary/input.schema.json
output: src/schemas/skills/build-skos-glossary/output.schema.json
---

# Build the SKOS glossary

Owner, 2026-09-23: *"everything extracted to glosasay / skos? accesible in ihris page/search?"*, *"it should be part of general pracice w/ glossary/ page"*, and *"can glossary be refefences to external skos schema?"*. So: **reference first, define second.** This folio follows folio-assistant's own skill `glossary-terms` and schema (`folio-assistant-core/schemas/glossary.ts`, folio-assistant issue #1217, PR #1218), and re-decides nothing in them.

## Where terms go

`glossary/` at the repository root, declared in `ihris.json` with `graphTypologies: ["glossary"]`: one `<scheme>.glossary.json` per source. The files are generated (AGENTS.md §2.3): change the inputs or `src/tools/build_glossary.py` (Tool `ihris-build-glossary`), never a scheme.

| source | scheme | state |
|---|---|---|
| a toolkit stage's "Technical terms" | `toolkit-technical-terms` | `authored`: term and definition verbatim, while `library/ihris-toolkit/ihris-toolkit.json` records the licence (the owner's permission); `candidate` without it |
| the 2009 use-case reports' glossaries | `use-cases-2009` | as `src/tools/ingest_use_cases.py` records them. Their summary names a glossary; no report holds one, so the scheme has no terms, and says so |
| an iHRIS code list with default records | `code-list-<form>` | `candidate` (notation = record id, prefLabel = `name`), or `authored` when the record carries a definition (ISCO-88's `description`) |

Sample records are left out: they illustrate one deployment and are never a standard code set, as in the DAK.

## Matches: never invented

A term gets a SKOS match **only** from a ConceptMap the repository already verified (`src/ihris-data-dictionary/terminology/`, built by `build_dak.py`): `equal`/`equivalent` → `exactMatch`, `wider`/`subsumes` → `broadMatch`, `narrower`/`specializes` → `narrowMatch`, nothing else. The target must be an external scheme `ihris.json` references in `remoteGraphs` with `graphTypologies: ["glossary"]`:

- EU Publications Office country table: `http://publications.europa.eu/resource/authority/country/` + ISO 3166-1 alpha-3 (from pycountry, the data the map was verified with);
- EU Publications Office currency table: `.../authority/currency/` + ISO 4217;
- ESCO for ISCO-08: `http://data.europa.eu/esco/isco/C` + the code.

**One second basis, owner-accepted: ValueSet identity.** No ConceptMap targets ISCO-08. `build_dak.py` binds each `isco_08_*` list, as a ValueSet (`<canonical>/ValueSet/isco_08_<level>`), to the ILO's ISCO-08 system itself, so an iHRIS record id *is* the ISCO-08 code. The owner ruled on 2026-09-24 (ihris PR #19, *"Accept ValueSet identity"*) that this is enough for `exactMatch`. So the 4 ISCO-08 schemes link every code to ESCO, and each scheme's description names the ValueSet and the ruling. The accepted systems are `VALUESET_IDENTITY` in `build_glossary.py`, only the ILO ISCO-08 system; adding one is the owner's call, never a builder's. ISCO-88 has no such binding and no ESCO scheme, so it links nowhere; its definitions stay verbatim (owner, 2026-09-24).

**The IRIs are built by each publisher's published pattern and were not dereferenced**: a Claude Code cloud session cannot reach those hosts (AGENTS.md §6). Never copy an external concept's definition.

## Conventions: folio-assistant's, followed

Owner, 2026-09-24: *"What does folio-assistant do? B should follow. Update skills so known."* Both are folio-assistant's rules, stated in its skill `glossary-terms`:

- **IRIs are in the namespace of the sub-instance that owns the source** (owner, 2026-09-24: *"make sure all glossary terms properly localed to ihris so [no] collision w/ other subgraphs. general rule/skill"*). The pattern is `<publication root><sub-instance>/ns#glossary/<scheme>/<term>` (core's `instanceNs` and `termIri`). It is never the root instance's namespace, even though `glossary/` is declared at the root, and never the path of the file that first defined the term: moving an asset must not move a term. `build_glossary.py` `scheme_owner` decides the owner:

  | scheme | owner | namespace |
  |---|---|---|
  | toolkit technical terms | `ihris-toolkit` | `https://litlfred.github.io/ihris/ihris-toolkit/ns#` |
  | use-case glossaries | `ihris-use-cases` | `https://litlfred.github.io/ihris/ihris-use-cases/ns#` |
  | a code list | the package whose data model **declares** the form; if several packages declare it, the earliest in dependency order (i2ce, then ihris-common, then the products) | e.g. `role`: `https://litlfred.github.io/ihris/i2ce/ns#` |

  A code list that later packages extend stays one scheme, owned by its definer, and each term's `source` still names the package that contributed it. The SKOS is published as `assets/glossary/<owner>--<scheme>.skos.jsonld`. QA `glossary-namespaces` checks that:
  - the owner is a declared sub-instance, never the root;
  - every term's source is the owner or a package that extends it;
  - no scheme IRI is minted twice;
  - the published SKOS mints nothing outside the owner's namespace.

  This is folio-assistant's rule (skill `glossary-terms`, Conventions), applied here.
- **One ConceptScheme per code list**, as folio-assistant's `schemas/code-list.ts` (`codeListToSkos`) does: a code is addressable in its own list, and two lists may share a code without sharing a concept. So `isco_08_unit`'s `1111` and any other list's `1111` are different concepts; a relation between them is a SKOS match, never a merge.

## Steps

1. Change an input (ingest a stage, re-run an ingester, rebuild the DAK), then run `python3 src/tools/build_glossary.py`. Run it twice: the output is byte-identical.
2. Build the site (`build-ihris-site`): `glossary/index.html` (A–Z, a live filter, each term with its code, state, definition, matches and source; Sources with each scheme's SKOS JSON-LD and the external schemes; schema.org `DefinedTermSet`), and the glossary half of `data-model/search.html`.
3. Run AGENTS.md §3. `validate.py` fails on a stale glossary (`--check`); `validate-folio.ts` validates each scheme with core's `GlossarySchema` and fails unless core's own `toSkos()` equals the SKOS JSON-LD the site published (the Python mirror in `build_glossary.py`, which the Pages workflow needs because it has no bun).

## QA

`src/tools/qa.py`, schema `folio-glossary/v1`: `glossary-schemes`, `glossary-ids`, `glossary-namespaces`, `glossary-matches` (recomputed from the ConceptMaps and the ISCO-08 ValueSets), `glossary-counts`, `glossary-verbatim` (the source JSON, and the captured toolkit page), `glossary-page` (every term once). Each was shown to fail on a mutation (bean `ihris-glsk`).
