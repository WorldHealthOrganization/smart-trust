/**
 * RDF vocabularies and OMG metamodels in the one class model (bean
 * `cat-tools-xfd4`): `scripts/rdf-vocabulary.ts` reads the `@vocabulary/*`
 * N-Quads, `scripts/moddle-metamodel.ts` the BPMN and DMN moddle descriptors,
 * and both are drawn by the renderer every other source uses.
 *
 * @module scripts/tests/rdf-vocabulary.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { diagramOfDecls, renderClassDiagram } from "../class-diagram.ts";
import { classModelQa } from "../class-model-qa.ts";
import { readModdleMetamodels } from "../moddle-metamodel.ts";
import { declaredVocabularies, readRdfVocabularies, readRdfVocabularyTexts } from "../rdf-vocabulary.ts";
import { cardinalityOf, classMentions, resolveClassModelRefs, type SchemaDecl, type SchemaEdge } from "../schema-graph.ts";
import { sourceOfKind, typeLink } from "../type-links.ts";

const EX = "http://example.org/ex#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const FOAF = "http://xmlns.com/foaf/0.1/";
const G = `<${EX}>`;

/** One N-Quad in the vocabulary's graph. */
const q = (s: string, p: string, o: string): string => `${s} ${p} ${o} ${G} .`;
const iri = (s: string): string => `<${s}>`;
const a = iri(`${RDF}type`);

const NQUADS = [
  q(iri(`${EX}Thing`), a, iri(`${OWL}Class`)),
  q(iri(`${EX}Thing`), iri(`${RDFS}comment`), '"Anything at all."@en'),
  q(iri(`${EX}Place`), a, iri(`${OWL}Class`)),
  q(iri(`${EX}Place`), iri(`${RDFS}subClassOf`), iri(`${EX}Thing`)),
  q(iri(`${EX}Place`), iri(`${RDFS}subClassOf`), "_:r1"),
  q("_:r1", a, iri(`${OWL}Restriction`)),
  q("_:r1", iri(`${OWL}onProperty`), iri(`${EX}code`)),
  q("_:r1", iri(`${OWL}cardinality`), `"1"^^<${XSD}nonNegativeInteger>`),
  q(iri(`${EX}Region`), a, iri(`${RDFS}Class`)),
  q(iri(`${EX}Region`), iri(`${RDFS}subClassOf`), iri(`${EX}Place`)),
  q(iri(`${EX}Colour`), a, iri(`${OWL}Class`)),
  q(iri(`${EX}red`), a, iri(`${EX}Colour`)),
  q(iri(`${EX}green`), a, iri(`${EX}Colour`)),
  // A class this vocabulary only MENTIONS: no box.
  q(iri(`${FOAF}Agent`), a, iri(`${OWL}Class`)),
  q(iri(`${EX}name`), a, iri(`${OWL}DatatypeProperty`)),
  q(iri(`${EX}name`), a, iri(`${OWL}FunctionalProperty`)),
  q(iri(`${EX}name`), iri(`${RDFS}domain`), iri(`${EX}Thing`)),
  q(iri(`${EX}name`), iri(`${RDFS}range`), iri(`${XSD}string`)),
  q(iri(`${EX}code`), a, iri(`${OWL}DatatypeProperty`)),
  q(iri(`${EX}code`), iri(`${RDFS}range`), iri(`${XSD}token`)),
  q(iri(`${EX}relation`), a, iri(`${OWL}ObjectProperty`)),
  q(iri(`${EX}relation`), iri(`${RDFS}domain`), iri(`${EX}Place`)),
  q(iri(`${EX}relation`), iri(`${RDFS}range`), iri(`${EX}Place`)),
  q(iri(`${EX}neighbour`), a, iri(`${OWL}ObjectProperty`)),
  q(iri(`${EX}neighbour`), iri(`${RDFS}subPropertyOf`), iri(`${EX}relation`)),
  q(iri(`${EX}tag`), a, iri(`${RDF}Property`)),
  q(iri(`${EX}colour`), a, iri(`${OWL}ObjectProperty`)),
  q(iri(`${EX}colour`), iri(`${RDFS}domain`), "_:u1"),
  q("_:u1", iri(`${OWL}unionOf`), "_:l1"),
  q("_:l1", iri(`${RDF}first`), iri(`${EX}Thing`)),
  q("_:l1", iri(`${RDF}rest`), "_:l2"),
  q("_:l2", iri(`${RDF}first`), iri(`${EX}Region`)),
  q("_:l2", iri(`${RDF}rest`), iri(`${RDF}nil`)),
  q(iri(`${EX}colour`), iri(`${RDFS}range`), iri(`${EX}Colour`)),
  q(iri(`${EX}knows`), a, iri(`${OWL}ObjectProperty`)),
  q(iri(`${EX}knows`), iri(`${RDFS}domain`), iri(`${EX}Thing`)),
  q(iri(`${EX}knows`), iri(`${RDFS}range`), iri(`${FOAF}Person`)),
].join("\n");

/** The fixture read and resolved, as `readSchemaGraph` resolves it. */
function readFixture(): { decls: SchemaDecl[]; edges: SchemaEdge[]; unresolved: Map<string, string[]> } {
  const read = readRdfVocabularyTexts([{ prefix: "ex", namespace: EX, nquads: NQUADS, module: "vocab/ex.nq", source: "@vocabulary/ex@1.0.0" }]);
  const byId = new Map(read.decls.map((d) => [d.id, d]));
  const resolved = resolveClassModelRefs(read.refs, byId);
  return { decls: read.decls, edges: [...read.edges, ...resolved.edges], unresolved: resolved.unresolved };
}

const byName = (decls: readonly SchemaDecl[], name: string): SchemaDecl => {
  const d = decls.find((x) => x.name === name);
  if (!d) throw new Error(`no declaration ${name}: ${decls.map((x) => x.name).join(", ")}`);
  return d;
};
const fieldOf = (d: SchemaDecl, name: string) => {
  const f = d.fields.find((x) => x.name === name);
  if (!f) throw new Error(`${d.name} has no field ${name}: ${d.fields.map((x) => x.name).join(", ")}`);
  return f;
};

describe("RDF vocabulary reader", () => {
  const { decls, edges, unresolved } = readFixture();

  it("draws each class its own vocabulary defines, as «owl» or «rdfs», and not one it only mentions", () => {
    expect(decls.filter((d) => d.kind !== "rdf-property-set").map((d) => d.name).sort()).toEqual(["ex:Colour", "ex:Place", "ex:Region", "ex:Thing"]);
    expect(byName(decls, "ex:Thing").kind).toBe("owl-class");
    expect(byName(decls, "ex:Region").kind).toBe("rdfs-class");
    expect(sourceOfKind("owl-class")).toBe("owl");
    expect(sourceOfKind("rdfs-class")).toBe("rdfs");
    expect(byName(decls, "ex:Thing").canonical).toBe(`${EX}Thing`);
    expect(byName(decls, "ex:Thing").doc).toBe("Anything at all.");
    expect(byName(decls, "ex:Colour").values).toEqual(["ex:green", "ex:red"]);
  });

  it("draws rdfs:subClassOf as generalisation, and a restriction as the field's bounds, not as a superclass", () => {
    const place = byName(decls, "ex:Place");
    expect(place.extendsNames).toEqual(["ex:Thing"]);
    expect(edges.filter((e) => e.from === place.id && e.kind === "extends").map((e) => e.to)).toEqual([byName(decls, "ex:Thing").id]);
    expect(byName(decls, "ex:Region").extendsNames).toEqual(["ex:Place"]);
    const code = fieldOf(place, "ex:code");
    expect(cardinalityOf(code)).toBe("1..1");
    expect(code.constraint).toBe("by restriction");
  });

  it("puts a property on its domain, typed by its range: functional is 0..1, unrestricted is 0..*", () => {
    const name = fieldOf(byName(decls, "ex:Thing"), "ex:name");
    expect(name.type).toBe("xsd:string");
    expect(cardinalityOf(name)).toBe("0..1");
    const relation = fieldOf(byName(decls, "ex:Place"), "ex:relation");
    expect(relation.type).toBe("ex:Place");
    expect(cardinalityOf(relation)).toBe("0..*");
    // A union domain is a field of each member.
    expect(fieldOf(byName(decls, "ex:Thing"), "ex:colour").type).toBe("ex:Colour");
    expect(fieldOf(byName(decls, "ex:Region"), "ex:colour").type).toBe("ex:Colour");
    expect(edges).toContainEqual(expect.objectContaining({ from: byName(decls, "ex:Thing").id, to: byName(decls, "ex:Colour").id, via: "ex:colour", kind: "field" }));
  });

  it("entails a domain and range through rdfs:subPropertyOf, and says where they came from", () => {
    const neighbour = fieldOf(byName(decls, "ex:Place"), "ex:neighbour");
    expect(neighbour.type).toBe("ex:Place");
    expect(neighbour.constraint).toBe("domain via ex:relation, range via ex:relation");
  });

  it("states a property with no domain in its vocabulary's own box, and a missing range as such", () => {
    const box = byName(decls, "ex");
    expect(box.kind).toBe("rdf-property-set");
    expect(sourceOfKind(box.kind)).toBe("rdf");
    expect(fieldOf(box, "ex:tag").type).toBe("(no range)");
    // `ex:code` has no domain either; the restriction put it on ex:Place too.
    expect(fieldOf(box, "ex:code").type).toBe("xsd:token");
  });

  it("links an XSD range to the XML Schema spec, and reports a class from a vocabulary not read as unresolved", () => {
    const name = fieldOf(byName(decls, "ex:Thing"), "ex:name");
    expect(typeLink("owl", name.type, name.typeLinks)).toBe("https://www.w3.org/TR/xmlschema11-2/#string");
    const thing = byName(decls, "ex:Thing");
    expect(unresolved.get(thing.id)).toEqual([`${FOAF}Person`]);
    expect(fieldOf(thing, "ex:knows").type).toBe(`<${FOAF}Person>`);
  });

  it("draws in the one look, labelled «owl» / «rdfs» upper right", () => {
    const model = diagramOfDecls(decls, edges, { label: "ex" });
    const thing = model.classes.find((c) => c.name === "ex:Thing")!;
    expect(thing.source).toBe("owl");
    expect(model.classes.find((c) => c.name === "ex:Region")!.source).toBe("rdfs");
    // The row as the diagram writes it, from the model rather than the SVG,
    // whose type is wrapped in its own link and <tspan>.
    const name = thing.fields.find((f) => f.name === "ex:name")!;
    expect(`${name.name} : ${name.type} [${name.card}]`).toBe("ex:name : xsd:string [0..1]");
    expect(name.href).toBe("https://www.w3.org/TR/xmlschema11-2/#string");
    const svg = renderClassDiagram(model);
    expect(svg).toContain("«owl»");
    expect(svg).toContain("«rdfs»");
    // Every text node of the SVG, joined: the row reads the same once the markup is gone.
    const text = [...svg.matchAll(/>([^<]*)</g)].map((m) => m[1]).join("");
    expect(text).toContain("ex:name : xsd:string [0..1]");
  });
});

describe("a vocabulary read only where the corpus names it (schema.org, owner option C)", () => {
  const SDO = "http://schema.org/";
  const sq = (s: string, p: string, o: string): string => `${s} ${p} ${o} <${SDO}> .`;
  const nquads = [
    sq(iri(`${SDO}Thing`), a, iri(`${RDFS}Class`)),
    sq(iri(`${SDO}CreativeWork`), a, iri(`${RDFS}Class`)),
    sq(iri(`${SDO}CreativeWork`), iri(`${RDFS}subClassOf`), iri(`${SDO}Thing`)),
    sq(iri(`${SDO}MediaObject`), a, iri(`${RDFS}Class`)),
    sq(iri(`${SDO}MediaObject`), iri(`${RDFS}subClassOf`), iri(`${SDO}CreativeWork`)),
    sq(iri(`${SDO}contentUrl`), a, iri(`${RDF}Property`)),
    sq(iri(`${SDO}contentUrl`), iri(`${SDO}domainIncludes`), iri(`${SDO}MediaObject`)),
    sq(iri(`${SDO}contentUrl`), iri(`${SDO}rangeIncludes`), iri(`${SDO}URL`)),
    sq(iri(`${SDO}encodesCreativeWork`), a, iri(`${RDF}Property`)),
    sq(iri(`${SDO}encodesCreativeWork`), iri(`${SDO}domainIncludes`), iri(`${SDO}MediaObject`)),
    sq(iri(`${SDO}encodesCreativeWork`), iri(`${SDO}rangeIncludes`), iri(`${SDO}CreativeWork`)),
    sq(iri(`${SDO}height`), a, iri(`${RDF}Property`)),
    sq(iri(`${SDO}height`), iri(`${SDO}domainIncludes`), iri(`${SDO}MediaObject`)),
    sq(iri(`${SDO}height`), iri(`${SDO}rangeIncludes`), iri(`${SDO}Distance`)),
    sq(iri(`${SDO}height`), iri(`${SDO}rangeIncludes`), iri(`${SDO}QuantitativeValue`)),
    sq(iri(`${SDO}author`), a, iri(`${RDF}Property`)),
    sq(iri(`${SDO}author`), iri(`${SDO}domainIncludes`), iri(`${SDO}CreativeWork`)),
  ].join("\n");

  it("finds a class named by CURIE or by IRI in either scheme, and not a property", () => {
    const text = 'z.literal("schema:MediaObject") "https://schema.org/DefinedTerm" schema:name';
    expect([...classMentions(text, "schema", SDO)].sort()).toEqual([`${SDO}DefinedTerm`, `${SDO}MediaObject`]);
  });

  it("draws only the named class, with its domainIncludes properties, and leaves its superclass an external name", () => {
    const read = readRdfVocabularyTexts([{ prefix: "schema", namespace: SDO, nquads, module: "schema.nq", only: new Set([`${SDO}MediaObject`]) }]);
    expect(read.decls.map((d) => d.name)).toEqual(["schema:MediaObject"]);
    expect(read.vocabularies[0]!.referencedOnly).toBe(true);
    const media = read.decls[0]!;
    expect(media.extendsNames).toEqual(["schema:CreativeWork"]);
    expect(fieldOf(media, "schema:contentUrl").constraint).toBe("domainIncludes, rangeIncludes");
    // Two rangeIncludes are one union type, with no edge to either.
    expect(fieldOf(media, "schema:height").type).toBe("schema:Distance | schema:QuantitativeValue");
    // A property of a class not read is not read either.
    expect(media.fields.some((f) => f.name === "schema:author")).toBe(false);
    const resolved = resolveClassModelRefs(read.refs, new Map(read.decls.map((d) => [d.id, d])));
    // CreativeWork is left out on purpose, so it is no unresolved reference.
    expect(resolved.unresolved.size).toBe(0);
    expect(resolved.edges).toEqual([]);
  });
});

describe("installed vocabularies", () => {
  const layerPackage = join(import.meta.dir, "..", "..", "package.json");
  const rel = (p: string): string => p;

  it("reads SKOS from its installed package: skos:broader lands on skos:Concept by entailment", () => {
    const read = readRdfVocabularies(layerPackage, rel, "cat-harness-tools");
    const skos = read.vocabularies.find((v) => v.prefix === "skos")!;
    expect(skos.source).toMatch(/^@vocabulary\/skos@\d/);
    const concept = byName(read.decls, "skos:Concept");
    const broader = fieldOf(concept, "skos:broader");
    expect(broader.type).toBe("skos:Concept");
    expect(broader.constraint).toContain("domain via skos:semanticRelation");
    // CSVW and PROV are read the same way.
    expect(read.decls.some((d) => d.name === "csvw:Table")).toBe(true);
    expect(read.decls.some((d) => d.name === "prov:Activity")).toBe(true);
    // schema.org is referencedOnly: with nothing named, it is not even parsed.
    expect(read.vocabularies.some((v) => v.prefix === "schema")).toBe(false);
    expect(read.vocabularies.length).toBeGreaterThan(10);
    const sdo = readRdfVocabularies(layerPackage, rel, "cat-harness-tools", (prefix, ns) => (prefix === "schema" ? new Set([`${ns}DefinedTerm`]) : new Set()));
    expect(sdo.decls.filter((d) => d.name.startsWith("schema:")).map((d) => d.name)).toEqual(["schema:DefinedTerm"]);
    expect(fieldOf(byName(sdo.decls, "schema:DefinedTerm"), "schema:termCode").type).toBe("schema:Text");
    // ODRL has no package: reported as not read, nothing stood in for it.
    expect(read.unread.some((u) => u.startsWith("http://www.w3.org/ns/odrl/2/: not read"))).toBe(true);
    expect(read.decls.some((d) => d.name.startsWith("odrl:"))).toBe(false);
  });

  it("reports a declared package that is not installed, and stands nothing in for it", () => {
    const dir = mkdtempSync(join(tmpdir(), "rdf-vocab-"));
    const pj = join(dir, "package.json");
    writeFileSync(pj, JSON.stringify({ dependencies: { "@vocabulary/not-a-real-vocabulary-xfd4": "1.0.0", left: "1" }, vocabularies: { unread: { "http://example.org/none#": "no package" } } }));
    expect(declaredVocabularies(pj).declared).toEqual([{ pkg: "@vocabulary/not-a-real-vocabulary-xfd4", version: "1.0.0" }]);
    const read = readRdfVocabularies(pj, rel, "test");
    expect(read.decls).toEqual([]);
    expect(read.unread).toEqual([
      "http://example.org/none#: not read — no package",
      "@vocabulary/not-a-real-vocabulary-xfd4@1.0.0: declared and not installed — nothing is read for it",
    ]);
  });

  it("reads the BPMN metamodel from bpmn-moddle: generalisation, containment, references by id, and an upper bound only", () => {
    const read = readModdleMetamodels(layerPackage, rel, "cat-harness-tools");
    const proc = byName(read.decls, "bpmn:Process");
    expect(proc.kind).toBe("moddle-class");
    expect(sourceOfKind(proc.kind)).toBe("moddle");
    expect(proc.extendsNames).toEqual(["bpmn:FlowElementsContainer", "bpmn:CallableElement"]);
    expect(cardinalityOf(fieldOf(proc, "artifacts"))).toBe("?..*");
    expect(cardinalityOf(fieldOf(proc, "isClosed"))).toBe("?..1");
    expect(read.refs).toContainEqual(expect.objectContaining({ from: proc.id, via: "definitionalCollaborationRef", kind: "id-ref", ref: "http://www.omg.org/spec/BPMN/20100524/MODEL#Collaboration" }));
    expect(byName(read.decls, "bpmn:ProcessType").values).toEqual(["None", "Public", "Private"]);
    // DMN through dmn-moddle, and the DI packages BPMN diagrams are drawn with.
    expect(read.decls.some((d) => d.name === "dmn:Decision")).toBe(true);
    expect(read.decls.some((d) => d.name === "dc:Bounds")).toBe(true);
    expect(read.unread).toEqual([]);
  });
});

describe("class model QA over vocabularies", () => {
  it("QA: a vocabulary no external-schema record names is a finding", () => {
    const g = {
      roots: [], modules: [], decls: [], edges: [], refProblems: [], unread: [],
      vocabularies: [
        { prefix: "skos", namespace: "http://www.w3.org/2004/02/skos/core#", source: "@vocabulary/skos@1.0.6", module: "skos.nq", classes: 4, properties: 28 },
        { prefix: "dcat", namespace: "http://www.w3.org/ns/dcat#", source: "@vocabulary/dcat@2.0.0", module: "dcat.nq", classes: 9, properties: 37 },
      ],
    };
    const records = [{ id: "w3c-skos", namespaces: ["http://www.w3.org/2004/02/skos/core#"] }];
    const c = classModelQa(g, records).criteria["class-model-vocabularies-recorded"]!;
    expect(c.result).toBe("fail");
    expect(c.findings.map((f) => f.where)).toEqual(["dcat.nq"]);
    // No registry found is unknown, never a pass; no vocabulary read is n/a.
    expect(classModelQa(g).criteria["class-model-vocabularies-recorded"]!.result).toBe("unknown");
    expect(classModelQa({ ...g, vocabularies: [] }, records).criteria["class-model-vocabularies-recorded"]!.result).toBe("n/a");
  });
});
