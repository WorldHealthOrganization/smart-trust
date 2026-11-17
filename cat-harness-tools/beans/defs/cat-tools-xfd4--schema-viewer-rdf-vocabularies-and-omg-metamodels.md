---
# cat-tools-xfd4
title: 'SCHEMA VIEWER: RDF vocabularies and the BPMN/DMN metamodels drawn as classes'
status: completed
type: feature
created_at: 2026-11-15T07:20:00Z
updated_at: 2026-11-15T18:16:00Z
---

Increment 3 of the one class model (beans cat-tools-4xq6, cat-tools-t6fz). Owner chose option A for the source: the npm `@vocabulary/*` packages (zazuko/rdf-vocabularies), pinned in this layer's package.json.

- [x] `scripts/rdf-vocabulary.ts`: oxigraph reads each declared `@vocabulary/*` package's N-Quads; a class the vocabulary defines is a «owl» or «rdfs» box, `rdfs:subClassOf` is generalisation, an `owl:Restriction` bounds a field, a property is a field of its domain typed by its range (`owl:unionOf` domains on each member), domain and range are entailed through `rdfs:subPropertyOf` and say so, properties with no domain go in the vocabulary's own «rdf» box, a missing range reads `(no range)`
- [x] Read: SKOS, Dublin Core (terms, elements 1.1, DCAM), DCAT, RDF, RDFS, OWL, CSVW, PROV, FOAF, ORG, Web Annotation, Hydra, BIBO, iCal, XSD (datatypes only)
- [x] `scripts/moddle-metamodel.ts`: BPMN 2.0, BPMN DI, DC, DI and DMN 1.3 from the bpmn-moddle and dmn-moddle descriptors, «moddle»; the descriptors state no lower bound, so fields read `?..1` / `?..*`
- [x] Not read, and reported in `unread` (`vocabularies.unread` in package.json): ODRL and the SPAR ontologies (FaBiO, DoCO, DEO, CiTO) have no package
- [x] QA criterion `class-model-vocabularies-recorded`: a vocabulary read that no external-schema record names is a finding (today DCAT, iCal's `icaltzd#` namespace, DMN's DC/DI, and bpmn.io's `bioc`/`biodi`)
- [x] Tests + Gherkin (`scripts/tests/rdf-vocabulary.test.ts`)
- [x] Owner chose C (2026-11-15T07:33Z): schema.org read only for the classes the corpus names (`vocabularies.referencedOnly`); today schema:DefinedTerm and schema:MediaObject, from fhir-harness's IG artefact JSON-LD shapes, which link to them by id-ref
- [x] Records for the vocabularies QA finds unrecorded (cat-harness `external-schemas/`)

_2026-11-15T07:20:00Z_ — Rebuilt from the design of the CLI session that stalled on credits before committing (its two failing tests, the property-on-domain one and the diagram-row one, pass here: the diagram test reads the row from the model and from the SVG's text, not from markup).

_2026-11-15T08:05:00Z_ — Owner card answered C. A follow-up PR, stacked on #2276, reads schema.org only where the corpus names a class. It also reads `schema:domainIncludes` and `schema:rangeIncludes`, which are noted on each field.

_2026-11-15T18:16:00Z_ — Recorded the six unrecorded vocabulary and metamodel namespaces in `cat-harness/external-schemas/` (`litlfred/cat-harness#1360`: `w3c-dcat-3.json` for `http://www.w3.org/ns/dcat#`, `bpmn-io-di.json` for `http://bpmn.io/schema/bpmn/biocolor/1.0` and `http://bpmn.io/schema/dmn/biodi/2.0`, `w3c-rdf-calendar.json` updated with `http://www.w3.org/2002/12/cal/icaltzd#`, and `omg-dmn-1.3.json` updated with `http://www.omg.org/spec/DMN/20180521/DC/` and `http://www.omg.org/spec/DMN/20180521/DI/`). `class-model-vocabularies-recorded` now passes with 0 findings across all 27 installed RDF vocabularies and moddle metamodels.
