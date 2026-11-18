/**
 * Knowledge-graph layer L2, version 3.0, as typed data.
 *
 * MIGRATED from WorldHealthOrganization/smart-kg `ontology/l2/l2.json` at
 * commit 3f5e477b9628fa818e71a2b2298371196c5af97c (main), the commit L1 was migrated from.
 * Every note, predicate, edge, grounding and omission is carried verbatim. What is
 * NEW is each property's type, Zod schema and FHIR mapping, and the value sets
 * that bind properties smart-kg named in prose (each says so in its note).
 * Also applied: litlfred/smart-kg main's requirement work
 * (0e11ce1, folio-assistant#2406): the `verifiedBy` predicate, `successCriteria`
 * on requirement-statement, and requirement -> recommendation `derivedFrom` edges.
 * Its older schedule edges were superseded by 3.0 and are not taken.
 *
 * smart-kg is deprecated (owner, 2026-10-16): this file is the source of truth.
 * `npm run build` in smart-base/L1/schemas/ regenerates `generated/` and the FSH.
 */
import type { LayerSpec, ValueSet } from "../../L1/schemas/ontology.ts";
import { p } from "../../L1/schemas/props.ts";
import { L1_VALUE_SETS } from "../../L1/schemas/l1.ts";

export const MIGRATED_FROM = { repository: "https://github.com/WorldHealthOrganization/smart-kg", path: "ontology/l2/l2.json", commit: "3f5e477b9628fa818e71a2b2298371196c5af97c" } as const;

export const L2_VALUE_SETS: ValueSet[] = [
  {
    "id": "artifact-kind",
    "note": "What kind of file an external artefact is. Moved with the class from L1, where it was free text.",
    "source": "Files observed in smart-base and in WHO's immunizations DAK (canonical http://smart.who.int/immunizations)",
    "codes": [
      {
        "code": "dmn",
        "definition": "A DMN decision table."
      },
      {
        "code": "bpmn",
        "definition": "A BPMN process."
      },
      {
        "code": "fhir-resource",
        "definition": "A FHIR resource, addressed by canonical URL."
      },
      {
        "code": "spreadsheet",
        "definition": "A workbook, such as the decision-support logic or indicators workbook."
      },
      {
        "code": "feature-file",
        "definition": "A Gherkin feature file."
      },
      {
        "code": "document",
        "definition": "Any other document."
      }
    ]
  },
  {
    "id": "publication-status",
    "note": "FHIR PublicationStatus, which DAK.fsh's status and every L3 resource's status take. Added by the smart-base migration: smart-kg named these properties without binding them.",
    "source": "http://hl7.org/fhir/ValueSet/publication-status",
    "codes": [
      {
        "code": "draft",
        "definition": "This resource is still under development and is not yet considered to be ready for normal use."
      },
      {
        "code": "active",
        "definition": "This resource is ready for normal use."
      },
      {
        "code": "retired",
        "definition": "This resource has been withdrawn or superseded and should no longer be used."
      },
      {
        "code": "unknown",
        "definition": "The authoring system does not know which of the status values currently applies for this resource."
      }
    ]
  },
  {
    "id": "conformance-expectation",
    "note": "The conformance verb of a requirement statement. Added by the smart-base migration from smart-kg's propertyNote, which named the four values in prose.",
    "source": "http://hl7.org/fhir/ValueSet/conformance-expectation",
    "codes": [
      {
        "code": "SHALL",
        "definition": "Support for the specified capability is required to be considered conformant."
      },
      {
        "code": "SHOULD",
        "definition": "Support for the specified capability is strongly encouraged."
      },
      {
        "code": "MAY",
        "definition": "Support for the specified capability is not necessary to be considered conformant."
      },
      {
        "code": "SHOULD-NOT",
        "definition": "Support for the specified capability is strongly discouraged."
      }
    ]
  },
  {
    "id": "verification-method",
    "note": "How a success criterion is verified: the classic verification methods, the same field name and codes as folio-assistant's requirement.ts `successCriteria`, so the two map 1:1. From litlfred/smart-kg main (folio-assistant#2406).",
    "source": "folio-assistant-core schemas requirement.ts successCriteria.verification",
    "codes": [
      {
        "code": "test",
        "definition": "Verified by executing a test."
      },
      {
        "code": "inspection",
        "definition": "Verified by examining the artefact."
      },
      {
        "code": "review",
        "definition": "Verified by a person's review."
      },
      {
        "code": "analysis",
        "definition": "Verified by analysis or calculation."
      }
    ]
  }
];

const VS = Object.fromEntries(L2_VALUE_SETS.map((v) => [v.id, v])) as Record<string, ValueSet>;
const L1_VS = Object.fromEntries(L1_VALUE_SETS.map((v) => [v.id, v])) as Record<string, ValueSet>;

export const L2: LayerSpec = {
  schemaVersion: "3.0",
  layer: "L2",
  namespace: "http://smart.who.int/kg/",
  source: "authored",
  note: "The DAK component layer. DAK.fsh declares NINE components and this layer carries all of them -- eight as classes here, and healthInterventions as l1:health-intervention, which L1 already declares as its hinge to L2 -- plus a TENTH, scheduling-logic, which DAK.fsh omits and the published SOP treats as an active L2 input. The internals of BPMN and DMN files are NOT here: they are separate subgraphs, l2-bpmn and l2-dmn, because a DAK component points at a file by URI and what is inside that file is a different question with a different vocabulary, a different extractor and a different failure mode. This layer also carries the L1->L2 hop, because l1 cannot name an l2 class without a circular import.",
  imports: ["l1"],
  groundedIn: [
    {
      "what": "The DAK logical model itself",
      "where": "smart-base input/fsh/models/DAK.fsh",
      "detail": "\"Logical Model for representing a complete Digital Adaptation Kit (DAK) with metadata and all 9 DAK components\": healthInterventions, personas, userScenarios, businessProcesses, dataElements, decisionLogic, indicators, requirements, testScenarios. Each is `0..* <Component>Source`. The class list below is that list, not a subset of it."
    },
    {
      "what": "The uniform source pattern every component uses",
      "where": "smart-base input/fsh/models/DAKComponentSources.fsh",
      "detail": "Nine parallel Source types, each offering exactly one of `url`, `canonical` or an inline `instance`. A component is therefore reachable three different ways, and `sourceKind` on each class below records which was used -- a canonical reference and a raw URL do not carry the same guarantees and flattening them would hide that."
    },
    {
      "what": "A real DAK instance",
      "where": "smart-base dak.json",
      "detail": "Carries id, name, title, version, status, publicationUrl, previewUrl, canonicalUrl, license, copyrightYear and publisher -- and none of the nine component arrays, because smart-base defines the model rather than instantiating a DAK. The `dak` class records exactly the metadata that file carries."
    },
    {
      "what": "41 committed requirement instances",
      "where": "smart-base input/fsh/actors/SGAuthoring.Skills.*.fsh",
      "detail": "SGRequirements instances carrying 170 statements (155 SHALL, 15 SHOULD) and 47 actor references across 10 personas, each written as `actor[+] = Canonical(SGAuthoring.Persona.X)`. This is the richest structured content in the repository and the one place a DAK component references another BY CANONICAL rather than by name."
    },
    {
      "what": "The three id-reference joins the model declares",
      "where": "smart-base input/fsh/models/BusinessProcessWorkflow.fsh, UserScenario.fsh, ProgramIndicator.fsh",
      "detail": "`scenario 0..* id` (\"References to user scenario IDs\"), `personas 0..* id` (\"References to persona IDs\"), and `references 0..* id` (\"References to Health Intervention IDs\"). All three are bare id strings with no declared target profile -- resolvable only by matching against the ids of instances that may or may not exist."
    },
    {
      "what": "The published SOP's L2 content types, which do not match DAK.fsh's nine",
      "where": "smart-ig-starter-kit input/pagecontent/l2_l3_overview.md",
      "detail": "The SOP's \"Input for authoring L3\" table lists ten content types: Health Interventions, Generic Personas, User Scenarios, Processes, Data Elements, Decision Tables, Scheduling Logic, Indicators, Functional Requirements, Non-functional Requirements. DAK.fsh lists nine and they are not the same nine -- it has testScenarios and a single combined requirements component, and no Scheduling Logic. This layer keeps DAK.fsh's list because that is the machine-readable model the extractor reads, and adds scheduling-logic because the SOP treats it as an active L2 input, WHO's ArchiMate model declares it a BusinessObject, and l1:schedule-entry otherwise has nowhere to land. The divergence is recorded here rather than silently reconciled; it is a question for the technical working group, not for this repository."
    }
  ],
  valueSets: L2_VALUE_SETS,
  predicates: [
    {
      "predicate": "hasComponent",
      "iri": "http://smart.who.int/kg/hasComponent",
      "note": "A DAK contains one of its nine components. The qualifier carries the component name from DAK.fsh, so `dak hasComponent persona` and `dak hasComponent program-indicator` stay distinguishable when a query walks the kit."
    },
    {
      "predicate": "sourcedFrom",
      "iri": "http://smart.who.int/kg/sourcedFrom",
      "note": "A component points at the file that defines it. TWO TARGETS ARE LICENSED, and which one an instance uses says how much is known about the file. Where a subgraph models that file type, the target is the file itself -- `business-process sourcedFrom bpmn-definitions`, licensed in l2-bpmn -- and the graph walks straight on into the file's contents. Where none does (a Gherkin feature, a FHIR canonical, or a BPMN this graph simply does not hold), the target is an l1:external-artifact carrying a URI and nothing else. Prefer the first: routing through external-artifact when the file IS modelled adds a hop through a node that, at instance level, is the same node."
    },
    {
      "predicate": "realises",
      "iri": "http://smart.who.int/kg/realises",
      "note": "A business process realises a user scenario. From `scenario 0..* id` on BusinessProcessWorkflow -- a bare id string, so an instance carries a resolutionStatus."
    },
    {
      "predicate": "involves",
      "iri": "http://smart.who.int/kg/involves",
      "note": "A user scenario involves a persona. From `personas 0..* id` on UserScenario -- again bare ids, again a resolutionStatus."
    },
    {
      "predicate": "fulfilledBy",
      "iri": "http://smart.who.int/kg/fulfilledBy",
      "note": "A functional requirement is fulfilled by a persona. THE ONE JOIN IN THIS LAYER THAT IS NOT STRING MATCHING: the committed instances write `actor[+] = Canonical(SGAuthoring.Persona.BusinessAnalyst)`, a canonical reference that resolves without guessing. It is the counter-example that shows the other joins are a choice, not a necessity."
    },
    {
      "predicate": "hasStatement",
      "iri": "http://smart.who.int/kg/hasStatement",
      "note": "A requirement carries numbered, labelled statements with a conformance verb. 170 of them exist today."
    },
    {
      "predicate": "listsTask",
      "iri": "http://smart.who.int/kg/listsTask",
      "note": "BusinessProcessWorkflow declares `task 0..*` with identifier, name and description -- the same tasks the BPMN file draws. Two representations of one list, joined by identifier, which is why dak-task exists as a node rather than a property."
    },
    {
      "predicate": "references",
      "iri": "http://smart.who.int/kg/references",
      "note": "A program indicator names the health interventions that give it context. From `references 0..* id` on ProgramIndicator -- bare id strings again, so an instance carries a resolutionStatus. Distinct from derivedFrom: referencing an intervention for context is not the same claim as restating a normative indicator."
    },
    {
      "predicate": "describes",
      "iri": "http://smart.who.int/kg/describes",
      "note": "A DAK-level task entry describes an element of a BPMN file. Declared here and licensed in l2-bpmn, where the target class lives."
    },
    {
      "predicate": "implementedBy",
      "iri": "http://smart.who.int/kg/implementedBy",
      "note": "Reused from l1, and licensed here for the L1->L2 hop that L1 could not declare itself: l1 cannot name an l2 class without a circular import, but l2 imports l1 and sees both ends. A recommendation is implemented by the DAK component that realises it. Always `inferred`, never `derived` -- deciding that a process realises a recommendation is adaptation, the judgement a DAK exists to record, and it carries a resolutionStatus like every other cross-artefact claim. Note health-intervention has NO implementedBy edge: the published SOP gives Health Interventions an L3 row of `n/a / n/a / n/a` and calls L1 recommendations inputs rather than outputs, so the trace runs through processes, decisions and indicators instead."
    },
    {
      "predicate": "derivedFrom",
      "iri": "http://smart.who.int/kg/derivedFrom",
      "note": "This normative content restates or operationalises that recommendation."
    },
    {
      "predicate": "appearsIn",
      "iri": "http://smart.who.int/kg/appearsIn",
      "note": "A citation string appears in an L2 or L3 artefact at a stated location."
    },
    {
      "predicate": "verifiedBy",
      "iri": "http://smart.who.int/kg/verifiedBy",
      "note": "A requirement statement is verified by a test scenario. The statement is the granularity at which conformance is asserted, so it is also the granularity at which a test is claimed to check it. The edge records the claim that a scenario exists for the statement; whether the scenario actually exercises each success criterion is a review question, recorded per criterion by `verification` on successCriteria, not by this edge."
    }
  ],
  classes: [
    {
      id: "dak",
      name: "Digital Adaptation Kit",
      kind: "Kit",
      iri: "http://smart.who.int/kg/dak",
      note: "The kit itself. Properties are exactly the metadata fields DAK.fsh declares and dak.json carries -- no more, so that a dak node can be produced from a real file without anything being invented.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        name: p.string("Name", "The computable name: the CamelCase identifier a Canonical() reference matches on."),
        title: p.string("Title", "The human-readable title."),
        description: p.markdown("Description", "A description, as the source gives it."),
        version: p.string("Version", "The business version, as declared."),
        status: p.code(VS["publication-status"], "error", "Status", "The DAK's publication status (DAK.fsh, FHIR PublicationStatus)."),
        publicationUrl: p.uri("Publication URL", "Where the DAK is published (DAK.fsh)."),
        previewUrl: p.uri("Preview URL", "Where the development build is previewed (DAK.fsh)."),
        canonicalUrl: p.uri("Canonical URL", "The canonical base; equals publicationUrl on a release branch and previewUrl on a development branch."),
        license: p.string("License", "The licence, as DAK.fsh declares it (an SPDX code)."),
        copyrightYear: p.string("Copyright year", "The copyright year or range, as declared."),
        publisherName: p.string("Publisher name", "The publisher's name."),
        publisherUrl: p.uri("Publisher URL", "The publisher's web address."),
      },
      valueSets: {
        "status": "publication-status"
      },
      propertyNote: "canonicalUrl equals publicationUrl on a release branch and previewUrl on a development branch, per DAK.fsh. Both are kept because which one canonicalUrl currently equals is what says whether a graph describes a release or a build.",
    },
    {
      id: "persona",
      name: "Generic Persona",
      kind: "Component",
      iri: "http://smart.who.int/kg/persona",
      note: "DAK component 2. Grounded in GenericPersona.fsh -- title, id, description, otherNames, iscoCode bound to ISCO08ValueSet -- and in the 22 committed ActorDefinition instances that carry name, title, type and description. The two disagree about where ISCO lives, which the properties record rather than smooth over.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        title: p.string("Title", "The human-readable title."),
        name: p.string("Name", "The computable name: the CamelCase identifier a Canonical() reference matches on."),
        description: p.markdown("Description", "A description, as the source gives it."),
        otherNames: p.list(p.string("Other names", "Another name the persona is known by.")),
        iscoCode: p.list(p.string("ISCO code", "An ISCO-08 occupation code (GenericPersona.fsh `iscoCode 0..*`). Usually empty: the committed ActorDefinitions give ISCO in prose.")),
        personaType: p.string("Persona type", "The kind of persona, as declared."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "`title` is the human-readable label a BPMN pool matches on; `name` is the CamelCase identifier a Canonical() reference matches on. They are different strings for the same persona and conflating them is precisely how the pool join breaks. GenericPersona.fsh declares `iscoCode 0..* code`, but the committed ActorDefinitions record ISCO in prose inside description, so iscoCode is usually empty and is not authoritative.",
    },
    {
      id: "user-scenario",
      name: "User Scenario",
      kind: "Component",
      iri: "http://smart.who.int/kg/user-scenario",
      note: "DAK component 3. A narrative describing how personas interact. Carries `personas 0..* id`, which is the only structured link between the narrative layer and the personas it names.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        title: p.string("Title", "The human-readable title."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "business-process",
      name: "Business Process Workflow",
      kind: "Component",
      iri: "http://smart.who.int/kg/business-process",
      note: "DAK component 4. NOT the BPMN file -- the component that points at one. `source 1..1 uri` is that pointer, and the BPMN's interior is the l2-bpmn subgraph, reached through the external-artifact this sourcedFrom targets.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        description: p.markdown("Description", "A description, as the source gives it."),
        objectives: p.markdown("Objectives", "The process objectives (BusinessProcessWorkflow.fsh `objectives 1..1 markdown`); only ever from the FSH instance."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "`objectives 1..1 markdown` is required by BusinessProcessWorkflow.fsh and has no counterpart anywhere in BPMN XML, so it can only ever come from the FSH instance. resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "dak-task",
      name: "Task Entry",
      kind: "Element",
      iri: "http://smart.who.int/kg/dak-task",
      note: "One entry of BusinessProcessWorkflow's `task 0..*` backbone: identifier, name, description. A node rather than a property because the same task is also drawn in the BPMN file, and the two lists have to be joinable to be checkable against each other.",
      properties: {
        identifier: p.string("Identifier", "The identifier, as declared."),
        name: p.string("Name", "The computable name: the CamelCase identifier a Canonical() reference matches on."),
        description: p.markdown("Description", "A description, as the source gives it."),
      },
    },
    {
      id: "data-element",
      name: "Core Data Element",
      kind: "Component",
      iri: "http://smart.who.int/kg/data-element",
      note: "DAK component 5. CoreDataElement.fsh calls itself \"the ONE EXCEPTION to allowing FHIR R4 models into the DAK LMs\": `type` is one of valueset | codesystem | conceptmap | logicalmodel and `canonical 1..1 uri` points at it. The canonical is recorded; nothing inside it is copied, because FHIR is its own query layer.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        name: p.string("Name", "The name a DMN input expression referenced, for a recovered element."),
        type: p.string("Type", "The data type, as the data dictionary declares it."),
        canonical: p.uri("Canonical", "The canonical URL. Only a resolved component carries one."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
        extractionRule: p.string("Extraction rule", "How a data element recovered from a DMN input expression was found."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "`name`, `resolutionStatus` and `extractionRule` are for elements recovered from DMN input expressions rather than declared in a dictionary. A recovered element is a name that was REFERENCED, not a definition that was found, and only a resolved one may carry a canonical.",
    },
    {
      id: "decision-support-logic",
      name: "Decision-Support Logic",
      kind: "Component",
      iri: "http://smart.who.int/kg/decision-support-logic",
      note: "DAK component 6. The whole model is an id, an optional description and `source 1..1 uri` to a DMN file. Nothing about the decision itself -- which is the gap the l2-dmn subgraph fills.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "scheduling-logic",
      name: "Scheduling Logic",
      kind: "Component",
      iri: "http://smart.who.int/kg/scheduling-logic",
      note: "When an intervention is due, as a DAK component. NOT declared by DAK.fsh -- it is added here because the published SOP lists Scheduling Logic as an active L2 input (spreadsheets under input/scheduling-logic), WHO's ArchiMate model declares it a BusinessObject realised by PlanDefinition, and L1's schedules needed an L2 component to reach (since L1 3.0, a recommendation's timing slot). Note that the SOP's own L3 row for scheduling is present but HTML-commented-out and there is no l3_schedulinglogic.md page, so WHO has drafted the mapping and not activated it; the L3 edge is licensed here as a deliberate departure, recorded rather than hidden.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "program-indicator",
      name: "Program Indicator",
      kind: "Component",
      iri: "http://smart.who.int/kg/program-indicator",
      note: "DAK component 7. Named program-indicator and not `indicator` because L1 already declares an `indicator` -- one normatively defined in a publication. They are different things: this is the DAK's operational measure, and `derivedFrom` is how it points at the normative one. Collapsing them would silently merge a WHO definition with a country's implementation of it.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        name: p.string("Name", "The computable name: the CamelCase identifier a Canonical() reference matches on."),
        definition: p.markdown("Definition", "The definition, as the source gives it."),
        numerator: p.markdown("Numerator", "The numerator, in prose: not a computable expression."),
        denominator: p.markdown("Denominator", "The denominator, in prose: not a computable expression."),
        disaggregation: p.markdown("Disaggregation", "How the indicator is disaggregated, in prose."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "numerator, denominator and disaggregation are all `1..1 markdown` -- prose, not a computable expression. Nothing here should be read as a calculable measure; the L3 FHIR Measure is where that would live. resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "functional-requirement",
      name: "Functional Requirement",
      kind: "Component",
      iri: "http://smart.who.int/kg/functional-requirement",
      note: "DAK component 8, first half. The as-a/I-want/so-that shape: `activity`, `capability[x]`, `benefit[x]`, and `actor 0..* Reference(SGActor)`. The 41 committed instances use the R5 SGRequirements profile rather than this logical model, so a real instance carries `statement` entries and a userstory extension; both shapes are accommodated and `profile` records which was read.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        activity: p.markdown("Activity", "The activity the requirement supports."),
        capability: p.markdown("Capability", "The capability required (\"As a … I want …\")."),
        benefit: p.markdown("Benefit", "The benefit (\"so that …\")."),
        classification: p.string("Classification", "The classification, as declared."),
        title: p.string("Title", "The human-readable title."),
        description: p.markdown("Description", "A description, as the source gives it."),
        profile: p.list(p.uri("Profile", "A profile canonical the artefact declares (meta.profile or the requirement's profile).")),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "non-functional-requirement",
      name: "Non-Functional Requirement",
      kind: "Component",
      iri: "http://smart.who.int/kg/non-functional-requirement",
      note: "DAK component 8, second half. `requirement 1..1 markdown`, an optional category and classification codings. Kept separate from the functional half because the fields genuinely differ -- a non-functional requirement has no actor and no benefit.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        requirement: p.markdown("Requirement", "The requirement text."),
        category: p.string("Category", "The category, as declared."),
        classification: p.string("Classification", "The classification, as declared."),
        title: p.string("Title", "The human-readable title."),
        description: p.markdown("Description", "A description, as the source gives it."),
        profile: p.list(p.uri("Profile", "A profile canonical the artefact declares (meta.profile or the requirement's profile).")),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "requirement-statement",
      name: "Requirement Statement",
      kind: "Element",
      iri: "http://smart.who.int/kg/requirement-statement",
      note: "One numbered, labelled statement inside a requirement, with a conformance verb. A node rather than a property because conformance is queried across a whole DAK -- 'every SHALL in this kit, and what fulfils it' is the question requirements exist to answer. It also carries its own success criteria, so 'what would show this SHALL is met' is answerable per statement rather than per requirement.",
      properties: {
        key: p.string("Key", "The statement's key, unique within its requirement."),
        label: p.markdown("Label", "The statement text, with its conformance verb."),
        requirement: p.string("Requirement", "The id of the requirement the statement belongs to."),
        conformance: p.code(VS["conformance-expectation"], "error", "Conformance", "The FHIR ConformanceExpectation verb: SHALL, SHOULD, MAY or SHOULD-NOT."),
        successCriteria: p.backbone("Success criteria", "What would show the statement is met, each a checkable sentence with its verification method (folio-assistant requirement.ts `successCriteria`, 1:1).", { key: p.string("Key", "Unique within the statement, e.g. SC-1."), criterion: p.markdown("Criterion", "A checkable sentence."), verification: p.code(VS["verification-method"], "error", "Verification", "How the criterion is verified.") }),
      },
      valueSets: {
        "conformance": "conformance-expectation"
      },
      propertyNote: "conformance is the FHIR ConformanceExpectation verb: SHALL, SHOULD, MAY or SHOULD-NOT. Across the 41 committed instances it is 155 SHALL and 15 SHOULD. successCriteria is a LIST of objects, each {key, criterion, verification}: `key` is unique within the statement (e.g. SC-1), `criterion` is a checkable sentence, and `verification` is one of test | inspection | review | analysis -- the same field name and enum as folio-assistant's requirement.ts `successCriteria`, so the two map 1:1. smart-base types it, so the shape is enforced by the schema; a statement with no successCriteria is still valid (the 170 statements committed in smart-base carry none).",
    },
    {
      id: "test-scenario",
      name: "Test Scenario",
      kind: "Component",
      iri: "http://smart.who.int/kg/test-scenario",
      note: "DAK component 9. `feature 1..1 uri` to a Gherkin feature file, plus an optional description. The feature file's interior is not modelled: no DAK in this estate ships one yet, so a subgraph for it would have no instance to check it against.",
      properties: {
        id: p.string("Id", "The identifier the source declares (an FSH instance id, a BPMN or DMN element id)."),
        feature: p.string("Feature", "The Gherkin feature file the scenario is in."),
        description: p.markdown("Description", "A description, as the source gives it."),
        sourceKind: p.string("Source kind", "What kind of artefact the component was read from (an FSH instance, a spreadsheet, a BPMN file)."),
        source: p.string("Source", "Where the node was read from: a repository path or URL."),
        resolutionStatus: p.code(L1_VS["resolution-status"], "error", "Resolution status", "Whether the component something names was found: `unresolved` when nothing declares it, so the gap is queryable."),
      },
      valueSets: {
        "resolutionStatus": "resolution-status"
      },
      propertyNote: "resolutionStatus is `unresolved` on a component that something else names but no DAK declares -- an L3 artefact whose title carries the component id, for instance. The node exists so the gap is queryable and carries the referenced id and nothing else.",
    },
    {
      id: "external-artifact",
      name: "External artefact",
      kind: "Reference",
      iri: "http://smart.who.int/kg/external-artifact",
      note: "A DAK file addressed by canonical URL: a BPMN process, a DMN decision table, a FHIR resource, a workbook. Deliberately opaque: it carries an IRI and a kind, and nothing about its interior. The L2-BPMN, L2-DMN and L3 classes that describe a file's interior elaborate this class at the same IRI. Moved here from L1 in 3.0 unchanged: a DAK file is the DAK's material, not WHO content.",
      properties: {
        iri: p.uri("IRI", "The canonical IRI the file is addressed by."),
        targetKind: p.code(VS["artifact-kind"], "error", "Target kind", "What kind of file the artefact is."),
        version: p.string("Version", "The business version, as declared."),
      },
      valueSets: {
        "targetKind": "artifact-kind"
      },
    }
  ],
  edges: [
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "health-intervention",
      "qualifier": "healthInterventions"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "persona",
      "qualifier": "personas"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "user-scenario",
      "qualifier": "userScenarios"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "business-process",
      "qualifier": "businessProcesses"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "data-element",
      "qualifier": "dataElements"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "decision-support-logic",
      "qualifier": "decisionLogic"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "program-indicator",
      "qualifier": "indicators"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "functional-requirement",
      "qualifier": "requirements"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "non-functional-requirement",
      "qualifier": "requirements"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "test-scenario",
      "qualifier": "testScenarios"
    },
    {
      "predicate": "hasComponent",
      "source": "dak",
      "target": "scheduling-logic",
      "qualifier": "schedulingLogic"
    },
    {
      "predicate": "sourcedFrom",
      "source": "scheduling-logic",
      "target": "external-artifact"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "business-process"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "decision-support-logic"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "persona"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "user-scenario"
    },
    {
      "predicate": "implementedBy",
      "source": "indicator",
      "target": "program-indicator"
    },
    {
      "predicate": "sourcedFrom",
      "source": "business-process",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "decision-support-logic",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "test-scenario",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "data-element",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "persona",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "user-scenario",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "program-indicator",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "functional-requirement",
      "target": "external-artifact"
    },
    {
      "predicate": "sourcedFrom",
      "source": "non-functional-requirement",
      "target": "external-artifact"
    },
    {
      "predicate": "realises",
      "source": "business-process",
      "target": "user-scenario"
    },
    {
      "predicate": "involves",
      "source": "user-scenario",
      "target": "persona"
    },
    {
      "predicate": "fulfilledBy",
      "source": "functional-requirement",
      "target": "persona"
    },
    {
      "predicate": "hasStatement",
      "source": "functional-requirement",
      "target": "requirement-statement"
    },
    {
      "predicate": "hasStatement",
      "source": "non-functional-requirement",
      "target": "requirement-statement"
    },
    {
      "predicate": "listsTask",
      "source": "business-process",
      "target": "dak-task"
    },
    {
      "predicate": "references",
      "source": "program-indicator",
      "target": "health-intervention"
    },
    {
      "predicate": "derivedFrom",
      "source": "program-indicator",
      "target": "indicator"
    },
    {
      "predicate": "crossReferences",
      "source": "persona",
      "target": "terminology-code"
    },
    {
      "predicate": "crossReferences",
      "source": "data-element",
      "target": "terminology-code"
    },
    {
      "predicate": "crossReferences",
      "source": "program-indicator",
      "target": "terminology-code"
    },
    {
      "predicate": "crossReferences",
      "source": "functional-requirement",
      "target": "terminology-code"
    },
    {
      "predicate": "crossReferences",
      "source": "non-functional-requirement",
      "target": "terminology-code"
    },
    {
      "predicate": "appearsIn",
      "source": "citation",
      "target": "external-artifact"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "external-artifact"
    },
    {
      "predicate": "implementedBy",
      "source": "indicator",
      "target": "external-artifact"
    },
    {
      "predicate": "implementedBy",
      "source": "health-intervention",
      "target": "external-artifact"
    },
    {
      "predicate": "implementedBy",
      "source": "recommendation",
      "target": "scheduling-logic",
      "note": "Replaces schedule and schedule-entry implementedBy scheduling-logic: L1 3.0 carries timing on the recommendation."
    },
    {
      "predicate": "derivedFrom",
      "source": "functional-requirement",
      "target": "recommendation",
      "note": "Reuses l1's derivedFrom at its own IRI rather than redeclaring it, as program-indicator derivedFrom indicator already does. Licensed here because l1 cannot name an l2 class. The requirement-level trace a reviewer asks for -- which recommendation this requirement comes from -- and a judgement: `inferred` or `decided`, with a note and evidence, never `derived`."
    },
    {
      "predicate": "derivedFrom",
      "source": "non-functional-requirement",
      "target": "recommendation",
      "note": "Reuses l1's derivedFrom at its own IRI rather than redeclaring it, as program-indicator derivedFrom indicator already does. Licensed here because l1 cannot name an l2 class. The requirement-level trace a reviewer asks for -- which recommendation this requirement comes from -- and a judgement: `inferred` or `decided`, with a note and evidence, never `derived`."
    },
    {
      "predicate": "verifiedBy",
      "source": "requirement-statement",
      "target": "test-scenario"
    }
  ],
  deliberatelyOmitted: [
    {
      "what": "A class for healthInterventions",
      "why": "DAK component 1 is already l1:health-intervention, which L1 declares as its hinge to L2 and grounds in this same HealthInterventions.fsh. A second class for it would be two names for one thing across a layer boundary -- the exact failure the shared-IRI rule exists to prevent."
    },
    {
      "what": "A `derivedFrom` edge from a data element to a recommendation",
      "why": "Plausible -- a dictionary entry often exists because a recommendation asks for it -- but no committed artefact records the link, and nothing in CoreDataElement.fsh provides for it. Same rule that excluded `writes` from the DMN subgraph."
    },
    {
      "what": "A class per *Source type",
      "why": "The nine Source types in DAKComponentSources.fsh are one pattern repeated nine times: url, canonical, or inline instance. That is a property of the reference (`sourceKind`), not nine classes."
    },
    {
      "what": "The interior of BPMN and DMN files",
      "why": "Separate subgraphs -- l2-bpmn and l2-dmn. A component points at a file by URI; what is inside it has its own vocabulary (OMG's, not WHO's), its own extractor and its own failure modes, and mixing the two would make the DAK component layer unreadable."
    },
    {
      "what": "The interior of a Gherkin feature file",
      "why": "No DAK in this estate ships one. A subgraph with no instance to check it against is speculative vocabulary."
    },
    {
      "what": "The contents of any FHIR canonical",
      "why": "ValueSets, CodeSystems, ConceptMaps and logical models have a validator, a publisher and canonical references already. Record the URL; re-represent nothing."
    },
    {
      "what": "An `implementedBy` edge from health-intervention",
      "why": "The published SOP's authored-L3 table gives Health Interventions `n/a` in all three columns, and the L2 guidance calls health interventions and the L1 recommendations behind them inputs rather than outputs. WHO's ArchiMate model disagrees -- it has `L3: Plan Definition realises Health Intervention` -- and that contradiction is recorded rather than resolved here. L1 reaches L3 through business-process, decision-support-logic and program-indicator instead."
    }
  ],
};
