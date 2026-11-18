---
# note on cat-tools-pfng from claude/pfng-claim-smart-base
$schema: folio-bean-note/v1
bean: cat-tools-pfng
branch: "claude/pfng-claim-smart-base"
created: "2026-11-15"
---
## claim smart-base

Taken by agy. Branch: translations/opus-mt-candidates in litlfred/smart-base.

## done smart-base

PR: https://github.com/litlfred/smart-base/pull/412 (branch `translations/opus-mt-candidates`, head `80eb827423c1250862dd5a01d48bdd76a5430c3a`).

### Per-Locale Candidate & Fuzzy-Fill Counts (`opus-mt`, 10 BPMN process catalogues per locale)
- `ar`: 10/10 catalogues, 502 candidates recorded, 3 refused (placeholder check), 6 `fail` cleared -> **496 fuzzy, 9 empty** (`0/505 translated`)
- `es`: 10/10 catalogues, 504 candidates recorded, 1 refused (placeholder check), 0 `fail` cleared -> **504 fuzzy, 1 empty** (`0/505 translated`)
- `fr`: 10/10 catalogues, 504 candidates recorded, 1 refused (placeholder check), 3 `fail` cleared -> **501 fuzzy, 4 empty** (`0/505 translated`)
- `ru`: 10/10 catalogues, 478 candidates recorded, 27 refused (placeholder/entity check), 8 `fail` cleared -> **470 fuzzy, 35 empty** (`0/505 translated`)
- `zh`: 10/10 catalogues, 504 candidates recorded, 1 refused (placeholder check), 5 `fail` cleared -> **499 fuzzy, 6 empty** (`0/505 translated`)
- **Total:** 2,492 candidates recorded, 2,470 fuzzy fills, 55 empty, 0 official.

### Glossary Review (`translation:glossary` & `translation:glossary:check`)
- All 5 locales (`ar, es, fr, ru, zh`): 34 fixed terms, 10 catalogues, 0 findings (0 in-sense violations), 0 pending adjudication.

### Blind Back-Translation Round-Trip Verdicts (150 strings across 50 non-block BPMN catalogues)
- **Back-Translator Agent:** `pfng-back-translator` (`conversationId: b74edc58-437c-4972-a8ca-69891d29d3e5`) — saw only target-language `msgstr`, zero workspace tools used.
- **Adjudicator Agent:** `pfng-adjudicator` (`conversationId: 95e7388e-1b6d-4b74-8ef3-0f150c7e14cd`) — saw only `(id, English msgid, English back-translation)`, zero workspace tools used.
- **Summary:** `ar` 17 pass / 7 warn / 6 fail; `es` 24 pass / 6 warn / 0 fail; `fr` 21 pass / 6 warn / 3 fail; `ru` 19 pass / 3 warn / 8 fail; `zh` 17 pass / 8 warn / 5 fail. All 22 `fail` entries cleared to empty `msgstr`.

| Locale | Catalogue | `msgid` (prefix) | Verdict | Adjudicator Note |
|---|---|---|---|---|
| `ar` | `processes/SGAuthoring.DAKLifecycle` | "Also incorporates clinical feedback. Data-entry forms are drawn here a..." | `warn` | minor spacing drift in "(wireframe - design - review)" |
| `ar` | `processes/SGAuthoring.DAKLifecycle` | "Author BPMN business processes (Component 4)" | `pass` | preserved |
| `ar` | `processes/SGAuthoring.DAKLifecycle` | "Author CodeSystems, ValueSets, ConceptMaps" | `pass` | preserved |
| `ar` | `processes/act-on-decision-support` | "Apply the PlanDefinition" | `pass` | preserved |
| `ar` | `processes/act-on-decision-support` | "Optional: pick a coded reason or type one, or neither; one FHIR Proven..." | `pass` | preserved |
| `ar` | `processes/act-on-decision-support` | "PlanDefinition/$apply for this client (or a CDS Hooks call): every pro..." | `fail` | FHIR operation "PlanDefinition/$apply" corrupted into "Definition/request" |
| `ar` | `processes/classify-and-code-content` | "A person in the l1-extraction-reviewer role. Reads each sentence propo..." | `fail` | dropped initial role sentence "A person in the l1-extraction-reviewer role." and split "signedOffBy" |
| `ar` | `processes/classify-and-code-content` | "All L1 coverage exclusions are signed by l1-extraction-reviewer, slot ..." | `warn` | status value "authored" drifted to "author" and "l1-extraction-reviewer" lost second hyphen |
| `ar` | `processes/classify-and-code-content` | "All signed: on to terminologist/ontologist review. Any rejected as nor..." | `pass` | preserved |
| `ar` | `processes/dak-l3-ig` | "L2 DAK to L3 FHIR IG" | `pass` | preserved |
| `ar` | `processes/dak-l3-ig` | "L3 FHIR IG pipeline (fhir-harness)" | `pass` | preserved |
| `ar` | `processes/dak-l3-ig` | "One lane: this process adds one step, the mapping from the DAK's L2 co..." | `pass` | preserved |
| `ar` | `processes/diig-investment-path` | "DIIG Chapter 4. Select interventions for the prioritized challenges, a..." | `fail` | inverted polarity: "A deleted alternative leaves..." became "A deleted alternative does not leave..." |
| `ar` | `processes/diig-investment-path` | "DIIG Chapter 8. Establish a logic model, plan the monitoring and evalu..." | `pass` | preserved |
| `ar` | `processes/diig-investment-path` | "DIIG Chapter 9. The case made to whoever pays, and what follows. Scali..." | `warn` | minor idiom drift ("whoever pays" -> "whoever pays the price") |
| `ar` | `processes/dth-authoring` | "1 · Ingest sources into library/ [library-ingestion]" | `warn` | directory path "library/" rendered as "the library /" |
| `ar` | `processes/dth-authoring` | "Account for every normative sentence [l1-coverage]" | `pass` | preserved |
| `ar` | `processes/dth-authoring` | "Business processes · BPMN [bpmn-authoring]" | `fail` | dropped "[bpmn-authoring]" skill tag and misexpanded BPMN as "Business Process Management Network" |
| `ar` | `processes/l2-component-edit-review` | "L2 component edit and review" | `pass` | preserved |
| `ar` | `processes/l2-component-edit-review` | "One L2 DAK component — agent edits, a person reviews" | `warn` | awkward phrasing ("agent edits, a person reviews" -> "editing agents, personal reviews") |
| `ar` | `processes/l2-component-edit-review` | "The calling track continues with this component. Anything derived from..." | `fail` | edge identifier "wasDerivedFrom" corrupted to "pushed-from" |
| `ar` | `processes/l2-dak-authoring` | "`changes needed` goes back to the author and the reworked DAK is assem..." | `pass` | preserved |
| `ar` | `processes/l2-dak-authoring` | "`claimed`: the bean is in progress and this process works it. `not you..." | `fail` | skill identifier "(bean-coordination)" corrupted into "(inter-human coordination)" |
| `ar` | `processes/l2-dak-authoring` | "Assemble and validate the DAK" | `pass` | preserved |
| `ar` | `processes/questionnaire-data-capture` | "Capture data with an SDC questionnaire" | `pass` | preserved |
| `ar` | `processes/questionnaire-data-capture` | "Read from the Questionnaire, not decided: an SDC extraction extension ..." | `warn` | camelCase extension identifiers (targetStructureMap, itemExtractionContext, observationExtract) split into spaced words |
| `ar` | `processes/questionnaire-data-capture` | "Run SDC $extract by the method the Questionnaire declares and save the..." | `warn` | "$extract" lost "$" prefix and "Bundle" dropped after "transaction" |
| `ar` | `processes/smart-guideline-end-to-end` | "1 · Identify L1 guidelines and recommendations" | `pass` | preserved |
| `ar` | `processes/smart-guideline-end-to-end` | "2 · Ingest into the L1 KG" | `pass` | preserved |
| `ar` | `processes/smart-guideline-end-to-end` | "3 · Choose L2 dependencies (WHO / jurisdiction DAKs)" | `pass` | preserved |
| `es` | `processes/SGAuthoring.DAKLifecycle` | "Also incorporates clinical feedback. Data-entry forms are drawn here a..." | `pass` | preserved |
| `es` | `processes/SGAuthoring.DAKLifecycle` | "Author BPMN business processes (Component 4)" | `pass` | preserved |
| `es` | `processes/SGAuthoring.DAKLifecycle` | "Author CodeSystems, ValueSets, ConceptMaps" | `pass` | preserved |
| `es` | `processes/act-on-decision-support` | "Apply the PlanDefinition" | `pass` | preserved |
| `es` | `processes/act-on-decision-support` | "Optional: pick a coded reason or type one, or neither; one FHIR Proven..." | `warn` | minor omission in "who decided what about which guidance" -> "who decided what guidance" |
| `es` | `processes/act-on-decision-support` | "PlanDefinition/$apply for this client (or a CDS Hooks call): every pro..." | `pass` | preserved |
| `es` | `processes/classify-and-code-content` | "A person in the l1-extraction-reviewer role. Reads each sentence propo..." | `pass` | preserved |
| `es` | `processes/classify-and-code-content` | "All L1 coverage exclusions are signed by l1-extraction-reviewer, slot ..." | `warn` | status value "authored" drifted to "author" |
| `es` | `processes/classify-and-code-content` | "All signed: on to terminologist/ontologist review. Any rejected as nor..." | `warn` | "authoring agent" simplified to "author" |
| `es` | `processes/dak-l3-ig` | "L2 DAK to L3 FHIR IG" | `pass` | preserved |
| `es` | `processes/dak-l3-ig` | "L3 FHIR IG pipeline (fhir-harness)" | `pass` | preserved |
| `es` | `processes/dak-l3-ig` | "One lane: this process adds one step, the mapping from the DAK's L2 co..." | `pass` | preserved |
| `es` | `processes/diig-investment-path` | "DIIG Chapter 4. Select interventions for the prioritized challenges, a..." | `warn` | sentence boundary merged between "`methodology-adoption`'s fourth refusal" and "A deleted alternative..." |
| `es` | `processes/diig-investment-path` | "DIIG Chapter 8. Establish a logic model, plan the monitoring and evalu..." | `pass` | preserved |
| `es` | `processes/diig-investment-path` | "DIIG Chapter 9. The case made to whoever pays, and what follows. Scali..." | `pass` | preserved |
| `es` | `processes/dth-authoring` | "1 · Ingest sources into library/ [library-ingestion]" | `warn` | directory path "library/" rendered as "the library /" |
| `es` | `processes/dth-authoring` | "Account for every normative sentence [l1-coverage]" | `pass` | preserved |
| `es` | `processes/dth-authoring` | "Business processes · BPMN [bpmn-authoring]" | `pass` | preserved |
| `es` | `processes/l2-component-edit-review` | "L2 component edit and review" | `pass` | preserved |
| `es` | `processes/l2-component-edit-review` | "One L2 DAK component — agent edits, a person reviews" | `pass` | preserved |
| `es` | `processes/l2-component-edit-review` | "The calling track continues with this component. Anything derived from..." | `pass` | preserved |
| `es` | `processes/l2-dak-authoring` | "`changes needed` goes back to the author and the reworked DAK is assem..." | `pass` | preserved |
| `es` | `processes/l2-dak-authoring` | "`claimed`: the bean is in progress and this process works it. `not you..." | `warn` | skill identifier "(bean-coordination)" lost hyphen |
| `es` | `processes/l2-dak-authoring` | "Assemble and validate the DAK" | `pass` | preserved |
| `es` | `processes/questionnaire-data-capture` | "Capture data with an SDC questionnaire" | `pass` | preserved |
| `es` | `processes/questionnaire-data-capture` | "Read from the Questionnaire, not decided: an SDC extraction extension ..." | `pass` | preserved |
| `es` | `processes/questionnaire-data-capture` | "Run SDC $extract by the method the Questionnaire declares and save the..." | `pass` | preserved |
| `es` | `processes/smart-guideline-end-to-end` | "1 · Identify L1 guidelines and recommendations" | `pass` | preserved |
| `es` | `processes/smart-guideline-end-to-end` | "2 · Ingest into the L1 KG" | `pass` | preserved |
| `es` | `processes/smart-guideline-end-to-end` | "3 · Choose L2 dependencies (WHO / jurisdiction DAKs)" | `pass` | preserved |
| `fr` | `processes/SGAuthoring.DAKLifecycle` | "Also incorporates clinical feedback. Data-entry forms are drawn here a..." | `fail` | dropped initial sentence "Also incorporates clinical feedback." and corrupted "wireframe-design-review" to "fireframe-design-review" |
| `fr` | `processes/SGAuthoring.DAKLifecycle` | "Author BPMN business processes (Component 4)" | `pass` | preserved |
| `fr` | `processes/SGAuthoring.DAKLifecycle` | "Author CodeSystems, ValueSets, ConceptMaps" | `pass` | preserved |
| `fr` | `processes/act-on-decision-support` | "Apply the PlanDefinition" | `pass` | preserved |
| `fr` | `processes/act-on-decision-support` | "Optional: pick a coded reason or type one, or neither; one FHIR Proven..." | `warn` | minor compression in "who decided what about which guidance" -> "who decided which guidance" |
| `fr` | `processes/act-on-decision-support` | "PlanDefinition/$apply for this client (or a CDS Hooks call): every pro..." | `pass` | preserved |
| `fr` | `processes/classify-and-code-content` | "A person in the l1-extraction-reviewer role. Reads each sentence propo..." | `fail` | dropped initial role sentence "A person in the l1-extraction-reviewer role." |
| `fr` | `processes/classify-and-code-content` | "All L1 coverage exclusions are signed by l1-extraction-reviewer, slot ..." | `warn` | status value "authored" drifted to "the author" |
| `fr` | `processes/classify-and-code-content` | "All signed: on to terminologist/ontologist review. Any rejected as nor..." | `pass` | preserved |
| `fr` | `processes/dak-l3-ig` | "L2 DAK to L3 FHIR IG" | `pass` | preserved |
| `fr` | `processes/dak-l3-ig` | "L3 FHIR IG pipeline (fhir-harness)" | `warn` | "(fhir-harness)" shortened to "(harness)" |
| `fr` | `processes/dak-l3-ig` | "One lane: this process adds one step, the mapping from the DAK's L2 co..." | `pass` | preserved |
| `fr` | `processes/diig-investment-path` | "DIIG Chapter 4. Select interventions for the prioritized challenges, a..." | `pass` | preserved |
| `fr` | `processes/diig-investment-path` | "DIIG Chapter 8. Establish a logic model, plan the monitoring and evalu..." | `pass` | preserved |
| `fr` | `processes/diig-investment-path` | "DIIG Chapter 9. The case made to whoever pays, and what follows. Scali..." | `pass` | preserved |
| `fr` | `processes/dth-authoring` | "1 · Ingest sources into library/ [library-ingestion]" | `warn` | directory path "library/" rendered as "the library /" |
| `fr` | `processes/dth-authoring` | "Account for every normative sentence [l1-coverage]" | `fail` | skill identifier "[l1-coverage]" corrupted to "[coverage 1)" |
| `fr` | `processes/dth-authoring` | "Business processes · BPMN [bpmn-authoring]" | `warn` | skill identifier "[bpmn-authoring]" drifted to "[bpmn-author]" |
| `fr` | `processes/l2-component-edit-review` | "L2 component edit and review" | `pass` | preserved |
| `fr` | `processes/l2-component-edit-review` | "One L2 DAK component — agent edits, a person reviews" | `pass` | preserved |
| `fr` | `processes/l2-component-edit-review` | "The calling track continues with this component. Anything derived from..." | `pass` | preserved |
| `fr` | `processes/l2-dak-authoring` | "`changes needed` goes back to the author and the reworked DAK is assem..." | `pass` | preserved |
| `fr` | `processes/l2-dak-authoring` | "`claimed`: the bean is in progress and this process works it. `not you..." | `warn` | skill identifier "(bean-coordination)" lost hyphen |
| `fr` | `processes/l2-dak-authoring` | "Assemble and validate the DAK" | `pass` | preserved |
| `fr` | `processes/questionnaire-data-capture` | "Capture data with an SDC questionnaire" | `pass` | preserved |
| `fr` | `processes/questionnaire-data-capture` | "Read from the Questionnaire, not decided: an SDC extraction extension ..." | `pass` | preserved |
| `fr` | `processes/questionnaire-data-capture` | "Run SDC $extract by the method the Questionnaire declares and save the..." | `pass` | preserved |
| `fr` | `processes/smart-guideline-end-to-end` | "1 · Identify L1 guidelines and recommendations" | `pass` | preserved |
| `fr` | `processes/smart-guideline-end-to-end` | "2 · Ingest into the L1 KG" | `pass` | preserved |
| `fr` | `processes/smart-guideline-end-to-end` | "3 · Choose L2 dependencies (WHO / jurisdiction DAKs)" | `pass` | preserved |
| `ru` | `processes/SGAuthoring.DAKLifecycle` | "Also incorporates clinical feedback. Data-entry forms are drawn here a..." | `fail` | dropped entire second sentence about wireframe-design-review and L3 Questionnaire derivation |
| `ru` | `processes/SGAuthoring.DAKLifecycle` | "Author BPMN business processes (Component 4)" | `pass` | preserved |
| `ru` | `processes/SGAuthoring.DAKLifecycle` | "Author CodeSystems, ValueSets, ConceptMaps" | `fail` | FHIR resource types "CodeSystems, ValueSets, ConceptMaps" corrupted into generic phrases ("code systems, value assessment systems, conceptual systems") |
| `ru` | `processes/act-on-decision-support` | "Apply the PlanDefinition" | `pass` | preserved |
| `ru` | `processes/act-on-decision-support` | "Optional: pick a coded reason or type one, or neither; one FHIR Proven..." | `pass` | preserved |
| `ru` | `processes/act-on-decision-support` | "The app or EHR: applies the PlanDefinition and writes what the health ..." | `fail` | dropped normative sentence "Decides nothing clinical." |
| `ru` | `processes/classify-and-code-content` | "A person in the l1-extraction-reviewer role. Reads each sentence propo..." | `fail` | dropped initial role sentence "A person in the l1-extraction-reviewer role." and "silently" |
| `ru` | `processes/classify-and-code-content` | "All L1 coverage exclusions are signed by l1-extraction-reviewer, slot ..." | `fail` | "slot codings" corrupted to "read interval codes" and "authored" to "authors" |
| `ru` | `processes/classify-and-code-content` | "All signed: on to terminologist/ontologist review. Any rejected as nor..." | `pass` | preserved |
| `ru` | `processes/dak-l3-ig` | "L2 DAK to L3 FHIR IG" | `pass` | preserved |
| `ru` | `processes/dak-l3-ig` | "L3 FHIR IG pipeline (fhir-harness)" | `pass` | preserved |
| `ru` | `processes/dak-l3-ig` | "One lane: this process adds one step, the mapping from the DAK's L2 co..." | `pass` | preserved |
| `ru` | `processes/diig-investment-path` | "A health programme needs digital support" | `pass` | preserved |
| `ru` | `processes/diig-investment-path` | "Costed implementation plan, and its case" | `pass` | preserved |
| `ru` | `processes/diig-investment-path` | "Determine appropriate digital health interventions" | `pass` | preserved |
| `ru` | `processes/dth-authoring` | "1 · Ingest sources into library/ [library-ingestion]" | `fail` | skill identifier "[library-ingestion]" corrupted to "[library message]" |
| `ru` | `processes/dth-authoring` | "Account for every normative sentence [l1-coverage]" | `pass` | preserved |
| `ru` | `processes/dth-authoring` | "Business processes · BPMN [bpmn-authoring]" | `fail` | skill identifier "[bpmn-authoring]" corrupted to "[author]" |
| `ru` | `processes/l2-component-edit-review` | "adjudication: pending on derived edges becomes the recorded outcome." | `warn` | prefixed "Case" to "adjudication: pending" |
| `ru` | `processes/l2-component-edit-review` | "Ask for review with staging deep links" | `warn` | "with staging deep links" drifted to "by setting deep links" |
| `ru` | `processes/l2-component-edit-review` | "L2 component edit and review" | `pass` | preserved |
| `ru` | `processes/l2-dak-authoring` | "`claimed`: the bean is in progress and this process works it. `not you..." | `warn` | "(bean-coordination)" truncated to "(coordination)" |
| `ru` | `processes/l2-dak-authoring` | "Assemble and validate the DAK" | `pass` | preserved |
| `ru` | `processes/l2-dak-authoring` | "Build the L1 library from Component 1" | `pass` | preserved |
| `ru` | `processes/questionnaire-data-capture` | "Capture data with an SDC questionnaire" | `pass` | preserved |
| `ru` | `processes/questionnaire-data-capture` | "Read from the Questionnaire, not decided: an SDC extraction extension ..." | `fail` | SDC extension identifiers "itemExtractionContext" and "observationExtract" corrupted to "count ExtractContext" and "conservationExtract" |
| `ru` | `processes/questionnaire-data-capture` | "The DAK's process reaches a step that records data on a form: register..." | `pass` | preserved |
| `ru` | `processes/smart-guideline-end-to-end` | "1 · Identify L1 guidelines and recommendations" | `pass` | preserved |
| `ru` | `processes/smart-guideline-end-to-end` | "2 · Ingest into the L1 KG" | `pass` | preserved |
| `ru` | `processes/smart-guideline-end-to-end` | "3 · Choose L2 dependencies (WHO / jurisdiction DAKs)" | `pass` | preserved |
| `zh` | `processes/SGAuthoring.DAKLifecycle` | "Also incorporates clinical feedback. Data-entry forms are drawn here a..." | `fail` | dropped initial sentence "Also incorporates clinical feedback." |
| `zh` | `processes/SGAuthoring.DAKLifecycle` | "Author BPMN business processes (Component 4)" | `pass` | preserved |
| `zh` | `processes/SGAuthoring.DAKLifecycle` | "Author CodeSystems, ValueSets, ConceptMaps" | `pass` | preserved |
| `zh` | `processes/act-on-decision-support` | "Apply the PlanDefinition" | `fail` | FHIR resource "PlanDefinition" corrupted to "PlanDescription" |
| `zh` | `processes/act-on-decision-support` | "Optional: pick a coded reason or type one, or neither; one FHIR Proven..." | `fail` | inverted "or neither" into "or both" |
| `zh` | `processes/act-on-decision-support` | "PlanDefinition/$apply for this client (or a CDS Hooks call): every pro..." | `pass` | preserved |
| `zh` | `processes/classify-and-code-content` | "A person in the l1-extraction-reviewer role. Reads each sentence propo..." | `fail` | dropped "proposed for exclusion" and corrupted "signedOffBy" to "signed as offoffBy" |
| `zh` | `processes/classify-and-code-content` | "All L1 coverage exclusions are signed by l1-extraction-reviewer, slot ..." | `warn` | status value "authored" drifted to "the author" and casing changed in "l1-Extraction-Reviewer" |
| `zh` | `processes/classify-and-code-content` | "All signed: on to terminologist/ontologist review. Any rejected as nor..." | `pass` | preserved |
| `zh` | `processes/dak-l3-ig` | "L2 DAK to L3 FHIR IG" | `pass` | preserved |
| `zh` | `processes/dak-l3-ig` | "L3 FHIR IG pipeline (fhir-harness)" | `fail` | "(fhir-harness)" corrupted to "(rift valley)" |
| `zh` | `processes/dak-l3-ig` | "One lane: this process adds one step, the mapping from the DAK's L2 co..." | `warn` | minor casing drift on "Process_L3Fhir" -> "process_L3Fhir" |
| `zh` | `processes/diig-investment-path` | "DIIG Chapter 4. Select interventions for the prioritized challenges, a..." | `pass` | preserved |
| `zh` | `processes/diig-investment-path` | "DIIG Chapter 8. Establish a logic model, plan the monitoring and evalu..." | `pass` | preserved |
| `zh` | `processes/diig-investment-path` | "DIIG Chapter 9. The case made to whoever pays, and what follows. Scali..." | `pass` | preserved |
| `zh` | `processes/dth-authoring` | "1 · Ingest sources into library/ [library-ingestion]" | `warn` | directory path "library/" rendered as "the library /" and dropped middle dot |
| `zh` | `processes/dth-authoring` | "Account for every normative sentence [l1-coverage]" | `pass` | preserved |
| `zh` | `processes/dth-authoring` | "Business processes · BPMN [bpmn-authoring]" | `warn` | prepended extra middle dot "·" |
| `zh` | `processes/l2-component-edit-review` | "L2 component edit and review" | `pass` | preserved |
| `zh` | `processes/l2-component-edit-review` | "One L2 DAK component — agent edits, a person reviews" | `pass` | preserved |
| `zh` | `processes/l2-component-edit-review` | "The calling track continues with this component. Anything derived from..." | `warn` | edge identifier "wasDerivedFrom" translated as "derived" |
| `zh` | `processes/l2-dak-authoring` | "`changes needed` goes back to the author and the reworked DAK is assem..." | `pass` | preserved |
| `zh` | `processes/l2-dak-authoring` | "`claimed`: the bean is in progress and this process works it. `not you..." | `warn` | skill identifier "(bean-coordination)" lost hyphen |
| `zh` | `processes/l2-dak-authoring` | "Assemble and validate the DAK" | `pass` | preserved |
| `zh` | `processes/questionnaire-data-capture` | "Capture data with an SDC questionnaire" | `pass` | preserved |
| `zh` | `processes/questionnaire-data-capture` | "Read from the Questionnaire, not decided: an SDC extraction extension ..." | `warn` | camelCase extension identifiers (targetStructureMap, itemExtractionContext, observationExtract) split into spaced words |
| `zh` | `processes/questionnaire-data-capture` | "Run SDC $extract by the method the Questionnaire declares and save the..." | `warn` | omitted "whole" after "transaction Bundle" |
| `zh` | `processes/smart-guideline-end-to-end` | "1 · Identify L1 guidelines and recommendations" | `pass` | preserved |
| `zh` | `processes/smart-guideline-end-to-end` | "2 · Ingest into the L1 KG" | `pass` | preserved |
| `zh` | `processes/smart-guideline-end-to-end` | "3 · Choose L2 dependencies (WHO / jurisdiction DAKs)" | `pass` | preserved |

## claim smart-base-clinical

PFNG Sibling 2 (agent session e667391f-7418-4786-bf4b-9d08d07cc4a3) claiming litlfred/smart-base-clinical.

## done smart-base-clinical

no catalogues — `litlfred/smart-base-clinical` (default branch `main`) has 0 `.pot` / `.po` files, `smart-base-clinical.json` declares `"directories": []` ("It holds no process or encounter catalogue yet (bean 2ipj). Declared with no directories yet"), and `translation:pot` / `translation:candidates` produce 0 templates (`translation:candidates` exits 2: declares no `translation-sources` directory). Per `cat-tools-pfng`, noted as having no catalogues.

## claim smart-ra

PFNG Sibling 2 (agent session e667391f-7418-4786-bf4b-9d08d07cc4a3) claiming litlfred/smart-ra.

## done smart-ra

no catalogues — `litlfred/smart-ra` (default branch `main`, declaration `dpi-h-ra.json`) has no `translations/` directory (0 `.pot` / `.po` files), declares no `translation-sources`, `processes`, or `user-scenario` directory in `dpi-h-ra.json`, and has 0 `"status": "authored"` glossary terms across `glossary/*.glossary.json` (`dpi-h-ra.glossary.json`: 72 `candidate` + 2 `could-not-extract`; `dpi-h-ra-acronyms.glossary.json`: 18 `candidate`; `organizations.glossary.json`: 17 `candidate`; `full-stac.glossary.json`: 7 `candidate` + 3 `could-not-extract`). Running `translation:pot`, `glossary:pot`, and `translation:candidates` produces 0 templates (`translation:candidates` exits 2: declares no `translation-sources` directory). Per `cat-tools-pfng`, noted as having no catalogues.
