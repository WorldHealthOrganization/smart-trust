/**
 * Negative tests for the validator (`../validate.ts`) — a port of WHO smart-kg
 * `tools/negative-test.mjs` (main 3f5e477), case for case.
 *
 * A validator is only worth its output if it FAILS on the things it claims to
 * catch. Each case mutates a valid document into a specific defect and asserts
 * the error names it. Some cases assert the opposite — that something
 * legitimate is NOT reported — because a check that fires on the normal case
 * trains people to ignore it.
 *
 * The documents are built here rather than committed: a committed fixture large
 * enough to be interesting is a dataset wearing a fixture's name. They are run
 * through `check()` — tier 1 (form) then tier 2 (the ontology) — with the other
 * documents of the set as `external`, so a reference into another layer's
 * document resolves as it does in a real run.
 *
 * Adapted to the migrated typed layers where smart-kg's fixture used a value
 * the typed property rejects (marked ADAPTED below); no case was weakened.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  citationId,
  contentHash,
  contentText,
  evidenceId,
  healthInterventionId,
  indicatorId,
  keyQuestionId,
  L1_NAMESPACE,
  outcomeId,
  publicationElementId,
  publicationId,
  recommendationId,
  referenceEntryId,
  remarkId,
  sectionId,
} from "../kgid.ts";
import { LAYERS } from "../layers.ts";
import { check, layerOf } from "../validate.ts";

type Props = { [k: string]: unknown };
interface Extra {
  derivation?: "derived" | "inferred" | "decided";
  note?: string;
  evidence?: { location: string; quote?: string; by?: string; at?: string };
  qualifier?: string;
  properties?: Props;
}
interface FNode extends Extra {
  id: string;
  type: string;
  label: string;
  properties: Props;
}
interface FEdge extends Extra {
  type: "Statement";
  predicate: string;
  source: string;
  target: string;
}
interface Doc {
  "@context": string;
  id: string;
  type: "Entity";
  ontologyVersion: string;
  generatedAt: string;
  wasDerivedFrom: { path: string; sha256: string }[];
  nodes: FNode[];
  edges: FEdge[];
}

const NS = "https://example.org/dak";
// Every layer shares one schemaVersion; read it rather than pin a copy that goes stale.
const VERSION = LAYERS.l1!.schemaVersion;
const doc = (layer: string, nodes: FNode[], edges: FEdge[]): Doc => ({
  "@context": `http://smart.who.int/kg/${layer}.context.jsonld`,
  id: `${NS}/kg/${layer}`,
  type: "Entity",
  ontologyVersion: VERSION,
  generatedAt: "2026-01-01T00:00:00Z",
  wasDerivedFrom: [{ path: "fixture", sha256: "0".repeat(64) }],
  nodes,
  edges,
});
const n = (id: string, type: string, label: string, properties: Props = {}, extra: Extra = {}): FNode => ({ id, type, label, properties, derivation: "derived", ...extra });
const e = (predicate: string, source: string, target: string, extra: Extra = {}): FEdge => ({ type: "Statement", predicate, source, target, derivation: "derived", ...extra });

// An inferred claim must say why and point at a source; these keep that true by default so a case
// that removes one is testing the check rather than tripping over boilerplate.
const inferred = (why: string): Extra => ({ derivation: "inferred", note: why, evidence: { location: "fixture#1", quote: "…" } });
const ie = (predicate: string, source: string, target: string, extra: Extra = {}): FEdge =>
  e(predicate, source, target, { derivation: "inferred", note: "read from the guideline PDF", evidence: { location: "fixture", quote: "…" }, ...extra });

const DMN_FILE = `${NS}/artifact/DT.EXAMPLE`;
const CITATION = citationId(NS, "Example guideline (1)");
const PLACEHOLDER = citationId(NS, "[Add appropriate reference]");
const REF1 = referenceEntryId(DMN_FILE, "1");

// L1 is WHO content, so its fixture uses the real ANC (2016) and HIV strategic information (2022)
// guidelines this model was checked against, with IRIs minted the way an extractor would mint them.
// Wording is quoted from the PDFs. Kinds those two guidelines do not exercise -- a good practice
// statement, a no-recommendation -- sit in a clearly fictional example publication.
const ANC = publicationId([{ type: "isbn", value: "978-92-4-154991-2" }]);
const ANC_ANNEX = publicationId([{ type: "iris-handle", value: "example/anc-2016-web-annexes" }]);
const ANC_SEC = sectionId(ANC, "3.A.1");
const ANC_T1 = publicationElementId(ANC, "Table 1");
const ANC_ROW = publicationElementId(ANC, "Table 1", "row 2");
const ANC_FN = publicationElementId(ANC, "Table 1", "row 2", "footnote a");
const A111 = recommendationId(ANC, "A.1.1");
const A111_REMARK = remarkId(A111, 1);
const KQ = keyQuestionId(ANC, "A.1.1");
const EGWG = outcomeId(ANC, "excessive gestational weight gain");
const EVID = evidenceId(ANC, "A.1.1", "excessive gestational weight gain");
const DIET_HI = healthInterventionId("UHC", "example-diet-counselling");
const HIV = publicationId([{ type: "isbn", value: "978-92-4-005531-5" }]);
const PRV3 = indicatorId(HIV, "PRV.3");
const EX = publicationId([{ type: "isbn", value: "0000000000000" }]);
const GPS = recommendationId(EX, "1");
const NOREC = recommendationId(EX, "2");
const CODE = `${L1_NAMESPACE}/code/icd-11/example`;

const pdf = (where: string, q: string): Extra => ({ derivation: "inferred", note: "extracted from the guideline PDF",
                              evidence: { location: where, quote: q } });
const hashed = (props: Props, fields: string[]): Props => ({ ...props, contentHash: contentHash(contentText({ properties: props }, fields)!) });
const A111_STATEMENT = "Counselling about healthy eating and keeping physically active during pregnancy is " +
  "recommended for pregnant women to stay healthy and to prevent excessive weight gain during pregnancy.";

const L1 = doc("l1", [
  n(CITATION, "citation", "Example guideline (1)",
    { text: "Example guideline (1)", numbering: "1", citationKind: "reference", resolutionStatus: "unresolved" }),
  n(PLACEHOLDER, "citation", "[Add appropriate reference]",
    { text: "[Add appropriate reference]", citationKind: "placeholder", resolutionStatus: "unresolved" }),
  n(REF1, "reference-entry", "(1)",
    { number: "1", text: "Example guideline. Geneva: Example; 2024 (https://example.org/guideline).",
      url: "https://example.org/guideline", resolutionStatus: "unresolved" }),
  n(ANC, "publication", "WHO recommendations on antenatal care for a positive pregnancy experience",
    { title: "WHO recommendations on antenatal care for a positive pregnancy experience", issued: "2016",
      identifiers: [{ type: "isbn", value: "978-92-4-154991-2" }], publicationType: "standard-guideline",
      grcStatus: "approved", sha256: "338300b76172d410b91048209305fac53e1166c3be295a18b3f2c0c7c6b54182" },
    pdf("anc.pdf p. ii", "ISBN 978 92 4 154991 2")),
  n(ANC_ANNEX, "publication", "ANC 2016 web annexes",
    { title: "WHO recommendations on antenatal care for a positive pregnancy experience: web annexes",
      identifiers: [{ type: "iris-handle", value: "example/anc-2016-web-annexes" }], publicationType: "supplement" },
    pdf("anc-web-annexes.pdf p. 1", "web annexes")),
  n(ANC_SEC, "publication-section", "A.1 Dietary interventions",
    { heading: "A.1: Dietary interventions", number: "3.A.1", pageRange: "15-16" }, pdf("anc.pdf p. 15", "A.1: Dietary interventions")),
  n(ANC_T1, "publication-element", "Table 1",
    { elementType: "table", label: "Table 1", pageRange: "xi-xiv",
      caption: "These recommendations apply to pregnant women and adolescent girls within the context of routine ANC",
      columns: ["", "Recommendation", "Type of recommendation"],
      columnMap: { "Recommendation": "statement", "Type of recommendation": "kind+direction" } },
    pdf("anc.pdf p. xi", "Table 1: Summary list of WHO recommendations on antenatal care")),
  n(ANC_ROW, "publication-element", "Table 1 / A.1.1",
    { elementType: "table-row", rowType: "data", ordinal: 2, cells: ["Dietary interventions", null, null] },
    pdf("anc.pdf p. xi", "Dietary interventions")),
  n(ANC_FN, "publication-element", "footnote a", { elementType: "footnote", label: "a" },
    pdf("anc.pdf p. xi", "a. A healthy diet contains adequate energy…")),
  n(A111, "recommendation", "A.1.1",
    hashed({ identifier: "A.1.1", statement: A111_STATEMENT, kind: "recommendation", direction: "for",
             intervention: "Counselling about healthy eating and keeping physically active",
             population: "pregnant women", status: "current" }, ["statement"]),
    pdf("anc.pdf p. 15", "RECOMMENDATION A.1.1: Counselling about healthy eating…")),
  n(A111_REMARK, "remark", "A.1.1 remark 1",
    hashed({ text: "A healthy diet contains adequate energy, protein, vitamins and minerals, obtained through " +
             "the consumption of a variety of foods.", remarkType: "definition", ordinal: 1 }, ["text"]),
    pdf("anc.pdf p. 15", "A healthy diet contains adequate energy…")),
  n(KQ, "key-question", "KQ A.1.1",
    hashed({ identifier: "A.1.1", text: "For pregnant women (P), do diet and/or exercise interventions (I) " +
             "compared with standard ANC (C) improve maternal and perinatal outcomes (O)?",
             population: "pregnant women", intervention: "diet and/or exercise interventions",
             comparator: "standard ANC" }, ["text"]),
    pdf("anc-web-annexes.pdf p. 1", "A.1.1: For pregnant women (P)…")),
  n(EGWG, "outcome", "EGWG",
    { name: "excessive gestational weight gain", importance: "critical", aliases: ["excessive weight gain", "EGWG"],
      category: "Maternal morbidity" }, pdf("anc-web-annexes.pdf p. 1", "Maternal morbidity (excessive weight gain…)")),
  n(EVID, "evidence", "A.1.1 / EGWG",
    hashed({ evidenceType: "effect", certainty: "high", studyCount: 24,
             summary: "High-certainty evidence shows that women receiving diet and/or exercise interventions as " +
                      "part of ANC to prevent EGWG are less likely to experience EGWG." }, ["summary"]),
    pdf("anc.pdf p. 16", "High-certainty evidence shows…")),
  n(DIET_HI, "health-intervention", "Diet counselling (example code)",
    { name: "Diet counselling in pregnancy", interventionType: "behavioural" }, pdf("fixture: example catalogue code", "…")),
  n(HIV, "publication", "Consolidated guidelines on person-centred HIV strategic information",
    { title: "Consolidated guidelines on person-centred HIV strategic information", issued: "2022",
      identifiers: [{ type: "isbn", value: "978-92-4-005531-5" }], publicationType: "consolidated-guideline" },
    pdf("hiv-si.pdf p. ii", "ISBN 978-92-4-005531-5")),
  n(PRV3, "indicator", "PRV.3 PrEP coverage",
    hashed({ refNo: "PRV.3", shortName: "PrEP coverage", changeStatus: "new",
             definition: "% of people prescribed PrEP among those identified as being at elevated risk for HIV acquisition" },
           ["definition", "numerator", "denominator"]),
    pdf("hiv-si.pdf p. 294", "PRV.3 PrEP coverage (NEW)")),
  n(EX, "publication", "Example guideline (fictional)",
    { title: "Example guideline", identifiers: [{ type: "isbn", value: "0000000000000" }],
      publicationType: "standard-guideline", grcStatus: "approved" }, pdf("fixture", "…")),
  n(GPS, "recommendation", "Example good practice statement",
    hashed({ statement: "Vaccinators should record every dose given.", kind: "good-practice-statement",
             direction: "for" }, ["statement"]), pdf("fixture", "Vaccinators should record every dose given.")),
  n(NOREC, "recommendation", "Example no-recommendation",
    hashed({ statement: "No recommendation can be made on a booster dose.", kind: "no-recommendation" }, ["statement"]),
    pdf("fixture", "No recommendation can be made on a booster dose.")),
  n(CODE, "terminology-code", "example code", { system: "ICD-11", code: "example", display: "pregnancy (example)" }),
], [
  e("numberedAs", CITATION, REF1),
  ie("hasSupplement", ANC, ANC_ANNEX),
  ie("contains", ANC, ANC_SEC),
  ie("contains", ANC, ANC_T1, { qualifier: "unsectioned" }),
  ie("contains", ANC_T1, ANC_ROW, { qualifier: "part" }),
  ie("contains", ANC_ROW, ANC_FN, { qualifier: "part" }),
  ie("definedIn", A111, ANC),
  ie("presentedIn", A111, ANC_ROW),
  ie("presentedIn", A111, ANC_SEC),
  ie("hasRemark", A111, A111_REMARK),
  ie("definedIn", A111_REMARK, ANC),
  ie("presentedIn", A111_REMARK, ANC_FN),
  ie("answers", A111, KQ),
  ie("definedIn", KQ, ANC),
  ie("hasOutcome", KQ, EGWG),
  ie("definedIn", EGWG, ANC),
  ie("addresses", EVID, KQ),
  ie("forOutcome", EVID, EGWG),
  ie("definedIn", EVID, ANC),
  ie("supportedBy", A111, EVID),
  ie("recommends", A111, DIET_HI),
  ie("aboutIntervention", KQ, DIET_HI),
  ie("crossReferences", A111, CODE, { qualifier: "population" }),
  ie("definedIn", PRV3, HIV),
  ie("definedIn", GPS, EX),
  ie("definedIn", NOREC, EX),
]);

const DAK = `${NS}/kg/dak`;
const PERSONA = `${NS}/persona/data-clerk`;
const REQ = `${NS}/requirement/record-a-visit`;
const STMT = `${REQ}/statement/rec-01`;

const L2 = doc("l2", [
  n(DAK, "dak", "Example DAK", { id: "example.dak", name: "Example", title: "Example DAK",
    version: "0.1.0", status: "draft", canonicalUrl: NS, publisherName: "Example" }),
  n(PERSONA, "persona", "Data Clerk",
    { id: "Example.Persona.DataClerk", title: "Data Clerk", name: "DataClerk",
      sourceKind: "instance", resolutionStatus: "resolved" }),
  n(REQ, "functional-requirement", "Can record a visit",
    { id: "Example.Skills.RecordVisit", title: "Can record a visit", sourceKind: "instance" }),
  n(STMT, "requirement-statement", "REC-01",
    { key: "REC-01", label: "Record a visit", requirement: "Can record a visit.", conformance: "SHALL" }),
  // Moved from L1 in 3.0: a DAK file is the DAK's material. The citation it carries is an L1 node.
  n(DMN_FILE, "external-artifact", "Example decision table", { iri: DMN_FILE, targetKind: "dmn" }),
], [
  e("appearsIn", CITATION, DMN_FILE),
  e("hasComponent", DAK, PERSONA, { qualifier: "personas", ...inferred("presence in the input tree") }),
  e("hasComponent", DAK, REQ, { qualifier: "requirements", ...inferred("presence in the input tree") }),
  e("hasStatement", REQ, STMT),
  e("fulfilledBy", REQ, PERSONA, {
    properties: { resolutionStatus: "resolved", matchedOn: "actor Canonical() == ActorDefinition instance id" },
    ...inferred("resolved by canonical reference, not by name matching"),
  }),
]);

const BPMN = `${NS}/artifact/Example.bpmn`;
const el = (id: string): string => `${BPMN}#${id}`;
const GHOST = `${NS}/persona/ward-clerk`;

const L2_BPMN = doc("l2-bpmn", [
  n(BPMN, "bpmn-definitions", "Example collaboration",
    { id: "Definitions_Example", source: "fixture", sha256: "1".repeat(64) }),
  n(el("Process_1"), "bpmn-process", "Main", { id: "Process_1", name: "Main", isExecutable: false }),
  n(el("Pool_1"), "bpmn-participant", "Ward Clerk",
    { id: "Pool_1", name: "Ward Clerk", processRef: "Process_1" }),
  n(el("Task_1"), "bpmn-task", "Register client",
    { id: "Task_1", name: "Register client", taskType: "task", isSubProcess: false }),
  n(el("Task_2"), "bpmn-task", "Record visit",
    { id: "Task_2", name: "Record visit", taskType: "task", isSubProcess: false }),
  // A role the process names that no ActorDefinition defines. Marked unresolved so the gap is a
  // node that can be queried for, rather than a dangling edge any store would drop.
  n(GHOST, "persona", "Ward Clerk", { title: "Ward Clerk", resolutionStatus: "unresolved" },
    inferred("referenced by a BPMN participant but defined nowhere")),
], [
  e("contains", BPMN, el("Process_1")),
  e("contains", BPMN, el("Pool_1")),
  e("contains", el("Process_1"), el("Task_1")),
  e("contains", el("Process_1"), el("Task_2")),
  e("flowsTo", el("Task_1"), el("Task_2"), { properties: { flowId: "Flow_1", hasConditionExpression: false } }),
  e("performedBy", el("Pool_1"), GHOST, {
    properties: { resolutionStatus: "unresolved", matchedOn: "participant @name == ActorDefinition title" },
    ...inferred("no ActorDefinition carries this title"),
  }),
]);

const DMN = DMN_FILE;
const dEl = (id: string): string => `${DMN}#${id}`;
const ELEMENT = `${NS}/data-element/hiv-status`;

const L2_DMN = doc("l2-dmn", [
  n(DMN, "dmn-definitions", "Example decision",
    { id: "DT.EXAMPLE", source: "fixture", sha256: "2".repeat(64) }),
  n(dEl("Decision_1"), "dmn-decision", "Determine eligibility",
    { id: "Decision_1", question: "Is the client eligible?" }),
  // ADAPTED: smart-kg wrote hitPolicy: null for "the file does not say"; the migrated layer types it
  // as a non-empty string, and an absent property says the same thing (the extractors omit it).
  n(dEl("Table_1#table"), "dmn-decision-table", "Table", { id: "Table_1" }),
  n(dEl("Input_1"), "dmn-input-clause", "HIV status",
    { id: "Input_1", label: "HIV status", expression: "HIV status", typeRef: "string", ordinal: 0 }),
  n(dEl("Rule_1"), "dmn-rule", "rule 1", { id: "Rule_1", ordinal: 0 }),
  n(ELEMENT, "data-element", "HIV status",
    { name: "HIV status", extractionRule: "bare-expression", resolutionStatus: "unresolved" },
    inferred("recovered from a DMN input expression; no dictionary was available")),
], [
  e("contains", DMN, dEl("Decision_1")),
  e("contains", dEl("Decision_1"), dEl("Table_1#table")),
  e("contains", dEl("Table_1#table"), dEl("Input_1")),
  e("contains", dEl("Table_1#table"), dEl("Rule_1")),
  e("reads", dEl("Input_1"), ELEMENT, {
    properties: { resolutionStatus: "unresolved", extractionRule: "bare-expression" },
    ...inferred("the element name was read out of free text"),
  }),
  // Crosses into L1: the target is defined in the L1 document, not this one.
  e("citesSource", dEl("Rule_1"), CITATION, {
    properties: { text: "Example guideline (1)" },
    evidence: { location: "fixture#Rule_1", quote: "Example guideline (1)" },
  }),
]);

const DSL = `${NS}/decision-support-logic/ex-d2`;
const PLANDEF = `${NS}/PlanDefinition/EXD2DTExample`;
const LIB = `${NS}/Library/EXD2DTExampleLogic`;

const L3 = doc("l3", [
  n(DSL, "decision-support-logic", "EX.D2", { id: "EX.D2", sourceKind: "url", source: "fixture" }),
  n(PLANDEF, "plan-definition", "EX.D2.DT.Example", {
    canonical: PLANDEF, resourceType: "PlanDefinition",
    // Read off the artefact, never asserted by the ontology: smart-base defines SG* profiles, the
    // published SOP names CRMI/CPG, and the immunizations IG uses CPG exclusively.
    // ADAPTED: the migrated layer types profile as a list of canonicals (FHIR meta.profile, 0..*).
    profile: ["http://hl7.org/fhir/uv/cpg/StructureDefinition/cpg-recommendationdefinition"],
    status: "draft", version: "0.1.0", title: "EX.D2.DT.Example", name: "EXD2DTExample",
    publisher: "World Health Organization (WHO)", experimental: false }),
  n(LIB, "library", "EXD2DTExampleLogic", {
    canonical: LIB, resourceType: "Library", status: "draft", version: "0.1.0",
    name: "EXD2DTExampleLogic", publisher: "World Health Organization (WHO)" }),
], [
  e("implementedBy", DSL, PLANDEF, {
    properties: { resolutionStatus: "unresolved", extractionRule: "title == L2 decision table id",
                  targetPath: "PlanDefinition.action[0]" },
    ...inferred("matched by the SOP id convention; no back-pointer extension exists in the estate"),
  }),
  e("uses", PLANDEF, LIB),
  e("citesSource", PLANDEF, CITATION, {
    properties: { text: "Example guideline (1)" },
    evidence: { location: "fixture#relatedArtifact", quote: "Example guideline (1)" },
  }),
]);


const ALL = [L1, L2, L2_BPMN, L2_DMN, L3];

const clone = (o: Doc): Doc => JSON.parse(JSON.stringify(o)) as Doc;
const index = (...docs: Doc[]) => new Map(docs.flatMap((d) => d.nodes.map((x) => [x.id, x] as const)));
const find = (d: Doc, type: string): FNode => d.nodes.find((x) => x.type === type)!;
const findEdge = (d: Doc, predicate: string): FEdge => d.edges.find((x) => x.predicate === predicate)!;
const byId = (d: Doc, id: string): FNode => d.nodes.find((x) => x.id === id)!;
/** A property of a node's `properties` that is itself a list or object, for a mutation. */
const deep = <T>(v: unknown): T => v as T;

type Expect = RegExp | null | { warning: RegExp } | { noWarning: RegExp };
type Case = [name: string, base: Doc, mutate: ((d: Doc) => void) | null, expect: Expect];

const cases: Case[] = [
  // --- rules that predate the subgraphs ---------------------------------------------------------
  ["unknown class is rejected", L1, (d) => { find(d, "remark").type = "wormhole"; }, /does not declare/],
  ["dangling edge target is rejected", L1, (d) => { findEdge(d, "answers").target = "urn:nope"; }, /defined in no document/],
  ["undeclared property is rejected", L1, (d) => { find(d, "publication").properties.colour = "blue"; }, /does not declare/],
  ["inferred node without evidence is rejected", L1, (d) => { delete byId(d, A111).evidence; }, /carries no evidence/],
  ["citation claiming resolution without a resolvesTo edge is rejected", L1, (d) => {
    byId(d, CITATION).properties.resolutionStatus = "resolved";
  }, /claims resolutionStatus "resolved" but has no resolvesTo/],
  ["a citation with no verbatim text is rejected", L1, (d) => {
    delete byId(d, CITATION).properties.text;
  }, /carries no verbatim text/],
  ["version mismatch stops the run", L1, (d) => { d.ontologyVersion = "0.9"; }, /Nothing below was checked/],

  // --- L1 3.0: value sets and GRADE -------------------------------------------------------------
  ["a strength outside the value set is rejected", L1, (d) => {
    byId(d, A111).properties.strength = "Strong";
  }, /not a code in value set "recommendation-strength"/],
  ["a publication type outside the value set is rejected", L1, (d) => {
    byId(d, ANC).properties.publicationType = "guideline";
  }, /not a code in value set "publication-type"/],
  ["an invented identifier type is rejected", L1, (d) => {
    deep<{ type: string }[]>(byId(d, ANC).properties.identifiers)[0]!.type = "isbn13";
  }, /not a code in value set "identifier-type"/],
  ["an invented resolutionStatus on a citation node is rejected", L1, (d) => {
    byId(d, CITATION).properties.resolutionStatus = "probably";
  }, /not a code in value set "resolution-status"/],
  ["a strength without a direction is rejected", L1, (d) => {
    delete byId(d, A111).properties.direction; byId(d, A111).properties.strength = "strong";
  }, /strength without a direction/],
  ["a good practice statement carrying a strength is rejected", L1, (d) => {
    byId(d, GPS).properties.strength = "strong";
  }, /A good practice statement is ungraded/],
  ["a no-recommendation carrying a direction is rejected", L1, (d) => {
    byId(d, NOREC).properties.direction = "against";
  }, /No recommendation was made/],
  ["a direction with no strength is legitimate (ANC prints none)", L1, null, null],

  // --- L1 3.0: what was removed stays removed ----------------------------------------------------
  ["PICO is not hung off the recommendation", L1, (d) => {
    d.nodes.push(n(`${KQ}/comparator`, "comparator", "standard ANC", { description: "standard ANC" }));
  }, /does not declare/],
  ["schedule is no longer a class", L1, (d) => {
    d.nodes.push(n(`${ANC}/schedule/x`, "schedule", "x", {}));
  }, /does not declare/],
  ["a citation's location is no longer a property", L1, (d) => {
    byId(d, CITATION).properties.location = "fixture#Rule_1";
  }, /does not declare/],
  ["appearsIn is not licensed in L1 any more: DAK files are L2's", L1, (d) => {
    d.nodes.push(n(DMN_FILE, "external-artifact", "x", { iri: DMN_FILE }));
    d.edges.push(e("appearsIn", CITATION, DMN_FILE));
  }, /does not declare|not licensed/],
  ["evidence does not answer a key question; a recommendation does", L1, (d) => {
    d.edges.push(ie("answers", EVID, KQ));
  }, /is not licensed by the ontology/],

  // --- L1 3.0: identity, hashes, provenance --------------------------------------------------------
  ["an IRI minted outside the scheme is rejected", L1, (d) => {
    const x = byId(d, PRV3); x.id = "https://example.org/indicator/prv3";
  }, /does not have the IRI shape/],
  ["a web-only WHO source takes its IRI from its address", L1, (d) => {
    const url = "https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables";
    d.nodes.push({ id: publicationId([{ type: "url", value: url }]), type: "publication", label: "summary tables",
      properties: { title: "WHO recommendations for routine immunization – summary tables", identifiers: [{ type: "url", value: url }],
                    publicationType: "summary-table" },
      derivation: "inferred", note: "IMMZ DAK reference 29", evidence: { location: "immz-dak.pdf p. 85", quote: url } });
  }, null],
  ["a publication IRI under an unlisted identifier type is rejected", L1, (d) => {
    byId(d, ANC).id = ANC.replace("/isbn-", "/web-");
  }, /does not have the IRI shape/],
  ["a contentHash that does not match the stored text is rejected", L1, (d) => {
    byId(d, A111).properties.statement += " (edited)";
  }, /contentHash that does not match/],
  ["content read from a PDF may not claim to be derived", L1, (d) => {
    const x = byId(d, A111); x.derivation = "derived";
  }, /requires at least "inferred"/],
  ["a resolvesTo edge may not claim to be derived", L1, (d) => {
    d.edges.push(e("resolvesTo", REF1, ANC));
  }, /requires at least "inferred"/],
  ["a decided judgement must say who and when", L1, (d) => {
    d.edges.push(ie("resolvesTo", REF1, ANC, { derivation: "decided" }));
  }, /who decided and when/],
  ["a decided judgement that says who and when is accepted", L1, (d) => {
    byId(d, REF1).properties.resolutionStatus = "resolved";
    d.edges.push(ie("resolvesTo", REF1, ANC, { derivation: "decided",
      evidence: { location: "fixture", quote: "…", by: "reviewer@example.org", at: "2026-10-01" } }));
  }, null],
  ["a citation resolves through its reference entry", L1, (d) => {
    byId(d, REF1).properties.resolutionStatus = "resolved";
    byId(d, CITATION).properties.resolutionStatus = "resolved";
    d.edges.push(ie("resolvesTo", REF1, ANC));
  }, null],
  ["a placeholder never resolves", L1, (d) => {
    d.edges.push(ie("resolvesTo", PLACEHOLDER, ANC));
  }, /is a placeholder and claims a resolution/],

  // --- L1 3.0: GRC, quoting, certainty, one copy of the words -------------------------------------
  ["a recommendation from a guideline recorded as not GRC-reviewed is rejected", L1, (d) => {
    byId(d, ANC).properties.grcStatus = "not-reviewed";
  }, /recorded as not reviewed by the GRC/],
  ["unrecorded GRC status is a warning, not an error", L1, (d) => {
    delete byId(d, ANC).properties.grcStatus;
  }, { warning: /records no GRC status/ }],
  ["a slot not quoted from the source is a warning", L1, (d) => {
    byId(d, A111).properties.setting = "in low-income countries";
  }, { warning: /setting "in low-income countries", which is not quoted/ }],
  ["a slot quoted from the table caption is not a finding", L1, (d) => {
    byId(d, A111).properties.population = "pregnant women and adolescent girls";
  }, { noWarning: /population .* not quoted/ }],
  ["overall certainty above the lowest critical outcome is a warning", L1, (d) => {
    byId(d, EVID).properties.certainty = "low";
    byId(d, EVID).properties.contentHash = contentHash(contentText(byId(d, EVID), ["summary"])!);
    byId(d, A111).properties.overallCertainty = "high";
  }, { warning: /higher than the lowest certainty on its critical outcomes/ }],
  ["a row that stores a cell filled from content is rejected", L1, (d) => {
    deep<(string | null)[]>(byId(d, ANC_ROW).properties.cells)[1] = A111_STATEMENT;
  }, /Store it once/],
  ["an unknown code system is a warning, not an error", L1, (d) => {
    byId(d, CODE).properties.system = "snomed";
  }, { warning: /not a code in value set "terminology-system"/ }],

  // --- the DAK component layer ------------------------------------------------------------------
  ["unlicensed edge is rejected", L2, (d) => {
    d.edges.push(e("contains", find(d, "requirement-statement").id, find(d, "persona").id));
  }, /is not licensed by the ontology/],
  ["a canonical join resolved with no evidence is rejected", L2, (d) => {
    delete findEdge(d, "fulfilledBy").evidence;
  }, /points at no evidence|carries no evidence/],
  ["an invented resolutionStatus is rejected", L2, (d) => {
    findEdge(d, "fulfilledBy").properties!.resolutionStatus = "probably";
  }, /permitted values are/],
  ["an undeclared property on a DAK component is rejected", L2, (d) => {
    find(d, "dak").properties.budget = "none of your business";
  }, /does not declare/],

  // --- the BPMN subgraph -------------------------------------------------------------------------
  ["a subgraph may not license an edge its ontology does not", L2_BPMN, (d) => {
    d.edges.push(e("flowsTo", find(d, "bpmn-participant").id, find(d, "bpmn-task").id));
  }, /is not licensed by the ontology/],
  ["a join resolved against a placeholder is rejected", L2_BPMN, (d) => {
    findEdge(d, "performedBy").properties!.resolutionStatus = "resolved";
  }, /cannot be resolved against a placeholder/],

  // --- the DMN subgraph --------------------------------------------------------------------------
  ["a DMN clause may not read a persona", L2_DMN, (d) => {
    d.edges.push(e("reads", find(d, "dmn-input-clause").id, PERSONA));
  }, /is not licensed by the ontology/],
  ["an unknown class is rejected in a subgraph too", L2_DMN, (d) => {
    find(d, "dmn-rule").type = "dmn-wormhole";
  }, /does not declare/],

  // --- what must NOT be reported ------------------------------------------------------------------
  ["a free-text BPMN branch label is not a finding", L2_BPMN, (d) => {
    findEdge(d, "flowsTo").qualifier = "Something nobody has written before";
  }, null],
  ["an unresolved join is a legitimate state", L2_BPMN, null, null],
  ["a reference into another layer's document resolves across the set", L2_DMN, null, null],
  ["the DAK component layer conforms", L2, null, null],
  ["L1 conforms", L1, null, null],

  // --- L3: the thin index ------------------------------------------------------------------------
  ["an unlicensed L3 edge is rejected", L3, (d) => {
    // A Library does not implement a decision-support-logic component; a PlanDefinition does.
    d.edges.push(e("implementedBy", find(d, "library").id, find(d, "plan-definition").id));
  }, /is not licensed by the ontology/],
  ["an L3 class may not reach a persona", L3, (d) => {
    d.edges.push(e("uses", find(d, "plan-definition").id, PERSONA));
  }, /is not licensed by the ontology/],
  ["a convention-matched implementedBy claiming resolution needs evidence", L3, (d) => {
    const x = findEdge(d, "implementedBy");
    x.properties!.resolutionStatus = "resolved";
    delete x.evidence;
  }, /points at no evidence|carries no evidence/],
  ["an undeclared property on an L3 node is rejected", L3, (d) => {
    find(d, "plan-definition").properties.actionCount = 3;
  }, /does not declare/],
  ["an unresolved implementedBy is a legitimate state", L3, null, null],
  ["the L3 index conforms, and cites L1 across documents", L3, null, null],
];

// Looped-test convention `id[${key}]` (owner, 2026-11-06): a fixed id, so one Scenario's
// `@test:` tag names every case; the case's own name is the key.
for (const [name, base, mutate, expect] of cases) {
  test(`negativeCase[${name}]`, () => {
    const d = clone(base);
    if (mutate) mutate(d);
    assert.equal(layerOf(d), layerOf(base));
    const { errors, warnings } = check(d, index(d, ...ALL.filter((x) => x !== base)));
    if (expect && !(expect instanceof RegExp)) {
      // A warning case asserts the finding is reported AND that it is only a warning; a noWarning
      // case asserts a legitimate source is not flagged. Both also require no errors.
      assert.deepEqual(errors, [], `unexpected error: ${errors[0]}`);
      if ("warning" in expect) assert.ok(warnings.some((w) => expect.warning.test(w)), `expected warning /${expect.warning.source}/, got: ${warnings.join(" | ").slice(0, 300) || "(none)"}`);
      else assert.ok(!warnings.some((w) => expect.noWarning.test(w)), `unexpected warning: ${warnings.find((w) => expect.noWarning.test(w))}`);
      return;
    }
    if (expect === null) {
      assert.deepEqual(errors, [], `unexpected: ${errors[0]}`);
      return;
    }
    assert.ok(errors.some((x) => expect.test(x)), `expected /${expect.source}/, got: ${errors.length ? errors.join(" | ").slice(0, 400) : "(no errors at all)"}`);
  });
}
