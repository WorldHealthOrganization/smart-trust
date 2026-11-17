/**
 * Read RDF vocabularies — SKOS, Dublin Core, DCAT, RDFS/OWL, CSVW, PROV, FOAF,
 * ORG, Web Annotation, Hydra, BIBO, iCal — into the schema graph's class model,
 * so the schemas viewer draws `skos:Concept` with the same boxes, fields,
 * cardinalities and edges as a Zod module, a JSON Schema or a FHIR model.
 *
 * @module scripts/rdf-vocabulary
 * @graphNode none — a reader over published RDF vocabularies, not a schema itself
 *
 * ## Where the vocabularies come from (owner, option A, bean `cat-tools-xfd4`)
 *
 * The npm `@vocabulary/*` packages (zazuko/rdf-vocabularies). Each ships the
 * vocabulary as plain N-Quads and says its own prefix and namespace in its
 * `package.json` (`vocabulary.prefix`, `vocabulary.namespace`). Which ones are
 * read is what a layer's `package.json` DEPENDS on — pinned to an exact version
 * like any other dependency — never a list kept here. A vocabulary with no
 * package (ODRL is not in the bundle) is named under that `package.json`'s
 * `vocabularies.unread`, with the reason, and reported as not read: nothing is
 * stood in for it.
 *
 * A package named under `vocabularies.referencedOnly` (schema.org: 1,011
 * classes; owner, 2026-11-15, option C) is read only for the classes the
 * corpus NAMES — a CURIE or IRI in a field type or literal, such as a JSON-LD
 * shape's `"@type": z.literal("schema:DefinedTerm")` — with the properties
 * whose domain is one of them. Its other classes stay external, linked names,
 * never unresolved ones, and with nothing named the package is not parsed.
 * schema.org states `schema:domainIncludes` / `schema:rangeIncludes` rather
 * than `rdfs:domain` / `rdfs:range`; they are read when no `rdfs:` one is
 * stated, and the field says so, since they carry no entailment.
 *
 * ## What becomes what
 *
 * | vocabulary | class model |
 * |---|---|
 * | a class it DEFINES (`owl:Class`, `rdfs:Class`, or a type that is a subclass of one, in its namespace) | one box, `«owl»` or `«rdfs»`, named `prefix:Local`, `canonical` = its IRI |
 * | a class it only MENTIONS (another namespace) | no box; a reference to it resolves to that vocabulary's box when it is read, and is unresolved otherwise |
 * | `rdfs:subClassOf` a named class | generalisation |
 * | `rdfs:subClassOf` an `owl:Restriction` | the bounds of that property on this class, never a superclass |
 * | a property with `rdfs:domain` C | a field of C, typed by its `rdfs:range` |
 * | `owl:unionOf` domain | a field of each member |
 * | a property with no domain, or a domain in another vocabulary | a field of the vocabulary's own `«rdf»` box |
 * | a named individual typed by one of its classes | a value of that class (`oa:Motivation`, `csvw:Direction`) |
 *
 * ## Entailment, stated
 *
 * A property with no domain or range of its own takes its super-property's,
 * through `rdfs:subPropertyOf` (RDFS rule `rdfs7` with `rdfs2`/`rdfs3`):
 * `skos:broader` has neither, `skos:semanticRelation` has domain
 * `skos:Concept`, so `skos:broader` is a field of `skos:Concept`. The field
 * says where its domain came from (`{domain via skos:semanticRelation}`) — an
 * entailed fact is drawn as entailed, not as stated.
 *
 * ## Cardinality
 *
 * RDF is open-world: a property with no restriction may have any number of
 * values, `0..*`, which is what the vocabulary SAYS, not a guess. An
 * `owl:FunctionalProperty` is `0..1`. An `owl:Restriction` on the class gives
 * its own bounds (`owl:cardinality`, `owl:minCardinality`,
 * `owl:maxCardinality`, the qualified forms, and `owl:someValuesFrom` as a
 * least of one).
 *
 * ## Could not determine
 *
 * A property with no range, stated or entailed, is typed `(no range)` — a
 * range is never invented. A package that is declared and not installed, or
 * holds no N-Quads, is reported in `unread`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import oxigraph from "oxigraph";

import type { ClassModelRef, SchemaDecl, SchemaEdge, SchemaField, SchemaGraphModule } from "./schema-graph.ts";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCT = "http://purl.org/dc/terms/";
/** schema.org, as `@vocabulary/schema` writes it (http, not https). */
const SDO = "http://schema.org/";

/** The scope of the npm packages this reader reads. */
export const VOCABULARY_SCOPE = "@vocabulary/";

/** Where an XSD datatype is defined. */
const XSD_SPEC = "https://www.w3.org/TR/xmlschema11-2/";
/** Where RDF's own literal types are defined. */
const RDF_CONCEPTS = "https://www.w3.org/TR/rdf11-concepts/";

/** Namespaces every vocabulary may write in, so a range in them reads `xsd:string`, not an IRI. */
const BASE_PREFIXES: Record<string, string> = { [RDF]: "rdf", [RDFS]: "rdfs", [OWL]: "owl", [XSD]: "xsd" };

/** A `@vocabulary/*` dependency a `package.json` declares. */
export interface DeclaredVocabulary {
  /** The npm package name, `@vocabulary/skos`. */
  pkg: string;
  /** The version the `package.json` pins. */
  version: string;
  /**
   * Read only the classes the corpus names (`vocabularies.referencedOnly`):
   * schema.org is 1,011 classes, and the corpus types two shapes by it
   * (owner, 2026-11-15, option C).
   */
  referencedOnly?: true;
}

/** A vocabulary the layer names as not read, and why (`vocabularies.unread` in its `package.json`). */
export interface UnreadVocabulary {
  namespace: string;
  reason: string;
}

/** What the reader read of one vocabulary, for the QA report and the viewer. */
export interface VocabularyRead {
  prefix: string;
  namespace: string;
  /** `@vocabulary/skos@1.0.6`, or the metamodel package a non-RDF reader read. */
  source: string;
  /** The module (the N-Quads file) its declarations are in. */
  module: string;
  classes: number;
  properties: number;
  /** Only the classes the corpus names were read (`vocabularies.referencedOnly`). */
  referencedOnly?: true;
}

/**
 * The `@vocabulary/*` packages `packageJson` depends on, and the vocabularies it
 * names as not read. An absent or unparseable file declares nothing.
 */
export function declaredVocabularies(packageJson: string): { declared: DeclaredVocabulary[]; unread: UnreadVocabulary[] } {
  if (!existsSync(packageJson)) return { declared: [], unread: [] };
  let pj: { dependencies?: Record<string, string>; vocabularies?: { unread?: Record<string, string>; referencedOnly?: string[] } };
  try {
    pj = JSON.parse(readFileSync(packageJson, "utf-8"));
  } catch {
    return { declared: [], unread: [] };
  }
  const declared = Object.entries(pj.dependencies ?? {})
    .filter(([n]) => n.startsWith(VOCABULARY_SCOPE))
    .map(([pkg, version]) => ({ pkg, version, ...(pj.vocabularies?.referencedOnly?.includes(pkg) ? { referencedOnly: true as const } : {}) }))
    .sort((a, b) => a.pkg.localeCompare(b.pkg));
  const unread = Object.entries(pj.vocabularies?.unread ?? {})
    .map(([namespace, reason]) => ({ namespace, reason }))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
  return { declared, unread };
}

type Term = { termType: string; value: string };
type Quad = { subject: Term; predicate: Term; object: Term & { language?: string } };

/** One loaded vocabulary, before it is turned into declarations. */
interface Loaded {
  prefix: string;
  namespace: string;
  source: string;
  module: string;
  store: InstanceType<typeof oxigraph.Store>;
  /** Read only these classes (IRIs), and only the properties whose domain is one of them. */
  only?: ReadonlySet<string>;
}

/**
 * The classes of a vocabulary the corpus names, for a `referencedOnly`
 * vocabulary: given its prefix and namespace, the class IRIs. An empty set
 * reads nothing of it.
 */
export type Mentions = (prefix: string, namespace: string) => ReadonlySet<string>;

/**
 * Read the vocabularies a layer declares.
 *
 * `packageJson` is the declaring layer's `package.json`; each package is
 * resolved from there, as Node would. `rel` turns an absolute path into the
 * repo-relative module path; `instance` is the declaring layer's name.
 */
export function readRdfVocabularies(
  packageJson: string,
  rel: (p: string) => string,
  instance: string,
  mentions: Mentions = () => new Set(),
): {
  modules: SchemaGraphModule[];
  decls: SchemaDecl[];
  edges: SchemaEdge[];
  refs: ClassModelRef[];
  vocabularies: VocabularyRead[];
  unread: string[];
} {
  const { declared, unread: named } = declaredVocabularies(packageJson);
  const unread = named.map((u) => `${u.namespace}: not read — ${u.reason}`);
  const req = createRequire(packageJson);
  const loaded: Loaded[] = [];
  for (const { pkg, version, referencedOnly } of declared) {
    let pjPath: string;
    try {
      pjPath = req.resolve(`${pkg}/package.json`);
    } catch {
      unread.push(`${pkg}@${version}: declared and not installed — nothing is read for it`);
      continue;
    }
    const dir = dirname(pjPath);
    let meta: { version?: string; vocabulary?: { prefix?: string; namespace?: string } };
    try {
      meta = JSON.parse(readFileSync(pjPath, "utf-8"));
    } catch (e) {
      unread.push(`${pkg}: package.json unreadable — ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    const prefix = meta.vocabulary?.prefix;
    const namespace = meta.vocabulary?.namespace;
    const files = readdirSync(dir).filter((f) => f.endsWith(".nq")).sort();
    if (!prefix || !namespace || files.length === 0) {
      unread.push(`${pkg}: states no vocabulary prefix and namespace, or ships no N-Quads`);
      continue;
    }
    const only = referencedOnly ? mentions(prefix, namespace) : undefined;
    // Nothing named: nothing to load. The 2.6 MB of schema.org is not parsed for no box.
    if (only && only.size === 0) continue;
    const store = new oxigraph.Store();
    try {
      for (const f of files) store.load(readFileSync(join(dir, f), "utf-8"), { format: "application/n-quads" });
    } catch (e) {
      unread.push(`${pkg}: N-Quads unparseable — ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    loaded.push({ prefix, namespace, source: `${pkg}@${meta.version ?? version}`, module: rel(join(dir, files[0]!)), store, ...(only ? { only } : {}) });
  }
  const out = readLoadedVocabularies(loaded, instance);
  return { ...out, unread };
}

/**
 * Read vocabularies given as N-Quads text, without packages — for a test, or
 * a caller holding the text already.
 */
export function readRdfVocabularyTexts(
  vocabs: readonly { prefix: string; namespace: string; nquads: string; module: string; source?: string; only?: ReadonlySet<string> }[],
  instance = "test",
): ReturnType<typeof readLoadedVocabularies> {
  return readLoadedVocabularies(
    vocabs.map((v) => {
      const store = new oxigraph.Store();
      store.load(v.nquads, { format: "application/n-quads" });
      return { prefix: v.prefix, namespace: v.namespace, source: v.source ?? v.module, module: v.module, store, ...(v.only ? { only: v.only } : {}) };
    }),
    instance,
  );
}

function readLoadedVocabularies(
  loaded: readonly Loaded[],
  instance: string,
): { modules: SchemaGraphModule[]; decls: SchemaDecl[]; edges: SchemaEdge[]; refs: ClassModelRef[]; vocabularies: VocabularyRead[] } {
  const prefixes: Record<string, string> = { ...BASE_PREFIXES };
  for (const v of loaded) prefixes[v.namespace] = v.prefix;
  // Longest namespace first, so `dc/terms/` is not read as `dc/` + `terms/…`.
  const nsList = Object.keys(prefixes).sort((a, b) => b.length - a.length);
  const curie = (iri: string): string => {
    const ns = nsList.find((n) => iri.startsWith(n) && iri.length > n.length);
    return ns ? `${prefixes[ns]}:${iri.slice(ns.length)}` : `<${iri}>`;
  };

  const modules: SchemaGraphModule[] = [];
  const decls: SchemaDecl[] = [];
  const edges: SchemaEdge[] = [];
  const refs: ClassModelRef[] = [];
  const vocabularies: VocabularyRead[] = [];

  for (const v of loaded) {
    const r = readOne(v, curie);
    modules.push({
      module: v.module,
      instance,
      name: v.prefix,
      graphNode: "schema",
      summary: r.title ? `${r.title} (${v.source})` : v.source,
      isTest: false,
      decls: r.decls.map((d) => d.id),
    });
    decls.push(...r.decls);
    edges.push(...r.edges);
    refs.push(...r.refs);
    vocabularies.push({ prefix: v.prefix, namespace: v.namespace, source: v.source, module: v.module, classes: r.classes, properties: r.properties, ...(v.only ? { referencedOnly: true as const } : {}) });
  }
  return { modules, decls, edges, refs, vocabularies };
}

/** The literal and datatype IRIs a range may name, to the specification that defines them. */
function datatypeLink(iri: string): string | undefined {
  if (iri.startsWith(XSD)) return `${XSD_SPEC}#${iri.slice(XSD.length)}`;
  if (iri === `${RDF}langString`) return `${RDF_CONCEPTS}#dfn-language-tagged-string`;
  if (iri === `${RDF}HTML`) return `${RDF_CONCEPTS}#section-html`;
  if (iri === `${RDF}XMLLiteral`) return `${RDF_CONCEPTS}#section-XMLLiteral`;
  if (iri === `${RDF}PlainLiteral`) return "https://www.w3.org/TR/rdf-plain-literal/";
  if (iri === `${RDFS}Literal`) return `${RDF_CONCEPTS}#dfn-literal`;
  return undefined;
}

function readOne(
  v: Loaded,
  curie: (iri: string) => string,
): { decls: SchemaDecl[]; edges: SchemaEdge[]; refs: ClassModelRef[]; title?: string; classes: number; properties: number } {
  const { store, namespace: ns, module } = v;
  const nn = (iri: string) => oxigraph.namedNode(iri);
  const match = (s: Term | null, p: string | null, o: Term | null): Quad[] =>
    store.match(s as never, p ? nn(p) : null, o as never, null) as unknown as Quad[];
  const objects = (s: Term, p: string): Term[] => match(s, p, null).map((q) => q.object);
  const named = (s: Term, p: string): string[] => objects(s, p).filter((o) => o.termType === "NamedNode").map((o) => o.value);
  const own = (iri: string): boolean => iri.startsWith(ns) && iri.length > ns.length;
  /** An English (or untagged) literal for `s` under any of `ps`, first line. */
  const text = (s: Term, ...ps: string[]): string | undefined => {
    for (const p of ps) {
      const lits = objects(s, p).filter((o) => o.termType === "Literal") as (Term & { language?: string })[];
      const pick = lits.find((l) => !l.language || l.language === "en" || l.language.startsWith("en-")) ?? lits[0];
      const line = pick?.value.split("\n").map((l) => l.trim()).find(Boolean);
      if (line) return line;
    }
    return undefined;
  };
  /** The members of an RDF list. */
  const list = (head: Term): Term[] => {
    const out: Term[] = [];
    let cur: Term | undefined = head;
    for (let i = 0; cur && cur.value !== `${RDF}nil` && i < 1000; i++) {
      const first = objects(cur, `${RDF}first`)[0];
      if (first) out.push(first);
      cur = objects(cur, `${RDF}rest`)[0];
    }
    return out;
  };

  // The class-like and property-like TYPES, closed over rdfs:subClassOf inside
  // the vocabulary: `hydra:Class` is a subclass of `rdfs:Class`, `hydra:Link`
  // of `rdf:Property`, so what they type is a class or a property.
  const closure = (roots: string[]): Set<string> => {
    const set = new Set(roots);
    for (let changed = true; changed; ) {
      changed = false;
      for (const q of match(null, `${RDFS}subClassOf`, null)) {
        if (q.subject.termType === "NamedNode" && set.has(q.object.value) && !set.has(q.subject.value)) {
          set.add(q.subject.value);
          changed = true;
        }
      }
    }
    return set;
  };
  const classTypes = closure([`${OWL}Class`, `${RDFS}Class`]);
  const propTypes = closure([
    `${RDF}Property`, `${OWL}ObjectProperty`, `${OWL}DatatypeProperty`, `${OWL}AnnotationProperty`,
    `${OWL}OntologyProperty`, `${OWL}FunctionalProperty`, `${OWL}InverseFunctionalProperty`,
    `${OWL}TransitiveProperty`, `${OWL}SymmetricProperty`,
  ]);
  const typesOf = new Map<string, Set<string>>();
  for (const q of match(null, `${RDF}type`, null)) {
    if (q.subject.termType !== "NamedNode") continue;
    const s = typesOf.get(q.subject.value) ?? new Set<string>();
    s.add(q.object.value);
    typesOf.set(q.subject.value, s);
  }
  const isA = (iri: string, set: Set<string>): boolean => [...(typesOf.get(iri) ?? [])].some((t) => set.has(t));
  const datatypeTypes = new Set([`${RDFS}Datatype`]);

  const classIris = [...typesOf.keys()].filter((i) => own(i) && isA(i, classTypes) && !isA(i, propTypes) && (!v.only || v.only.has(i))).sort();
  const propIris = [...typesOf.keys()].filter((i) => own(i) && isA(i, propTypes)).sort();
  /** A class this reading leaves out on purpose (a `referencedOnly` vocabulary): a reference to it stays an external, linked name. */
  const leftOut = (iri: string): boolean => !!v.only && own(iri) && !v.only.has(iri);
  const classSet = new Set(classIris);

  const idOf = (iri: string): string => `${module}#${curie(iri)}`;
  const ownBoxName = v.prefix;
  const ownBoxId = `${module}#${ownBoxName}`;
  const decls = new Map<string, SchemaDecl>();
  const edges: SchemaEdge[] = [];
  const refs: ClassModelRef[] = [];
  const blank = (name: string, id: string, kind: SchemaDecl["kind"], extra: Partial<SchemaDecl> = {}): SchemaDecl => ({
    id, name, module, kind, fields: [], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true, ...extra,
  });

  for (const iri of classIris) {
    const s = nn(iri);
    const owl = (typesOf.get(iri) ?? new Set()).has(`${OWL}Class`);
    const doc = text(s, `${SKOS}definition`, `${RDFS}comment`, `${DCT}description`);
    const d = blank(curie(iri), idOf(iri), owl ? "owl-class" : "rdfs-class", { canonical: iri, ...(doc ? { doc } : {}) });
    // A named superclass is generalisation; a restriction is handled below.
    for (const sup of named(s, `${RDFS}subClassOf`).sort()) {
      if (sup === iri || sup === `${OWL}Thing` || sup === `${RDFS}Resource`) continue;
      d.extendsNames.push(curie(sup));
      refs.push({ from: d.id, ref: sup, module, via: "", kind: "extends", optional: false, array: false, by: "canonical", ...(leftOut(sup) ? { quietMiss: true as const } : {}) });
    }
    // Named individuals of the class: its values, as an enum's.
    d.values = [...typesOf.entries()]
      .filter(([i, ts]) => own(i) && ts.has(iri) && !classSet.has(i))
      .map(([i]) => curie(i))
      .sort();
    decls.set(iri, d);
  }

  /** A property's own `p` values, else its nearest super-property's, with the one it came from. */
  const entailed = (iri: string, p: string): { values: Term[]; via?: string } => {
    const seen = new Set<string>();
    let frontier = [iri];
    for (let depth = 0; frontier.length && depth < 16; depth++) {
      const next: string[] = [];
      for (const cur of frontier) {
        if (seen.has(cur)) continue;
        seen.add(cur);
        const got = objects(nn(cur), p);
        if (got.length) return { values: got, ...(cur !== iri ? { via: cur } : {}) };
        next.push(...named(nn(cur), `${RDFS}subPropertyOf`));
      }
      frontier = next;
    }
    return { values: [] };
  };
  /** A domain or range term → the named classes it means (an `owl:unionOf` is each member). */
  const classesOf = (term: Term): string[] => {
    if (term.termType === "NamedNode") return [term.value];
    if (term.termType !== "BlankNode") return [];
    const union = objects(term, `${OWL}unionOf`)[0];
    return union ? list(union).filter((t) => t.termType === "NamedNode").map((t) => t.value) : [];
  };

  /** Restrictions per class: property IRI → bounds and an explicit filler. */
  const restricted = new Map<string, Map<string, { min?: number; max?: number; filler?: string }>>();
  for (const iri of classIris) {
    for (const sup of objects(nn(iri), `${RDFS}subClassOf`)) {
      if (sup.termType !== "BlankNode") continue;
      if (!objects(sup, `${RDF}type`).some((t) => t.value === `${OWL}Restriction`)) continue;
      const on = named(sup, `${OWL}onProperty`)[0];
      if (!on) continue;
      const num = (p: string): number | undefined => {
        const lit = objects(sup, `${OWL}${p}`)[0];
        return lit ? Number(lit.value) : undefined;
      };
      const r = restricted.get(iri) ?? new Map();
      const b = r.get(on) ?? {};
      const exact = num("cardinality") ?? num("qualifiedCardinality");
      if (exact !== undefined) b.min = b.max = exact;
      const min = num("minCardinality") ?? num("minQualifiedCardinality");
      if (min !== undefined) b.min = min;
      const max = num("maxCardinality") ?? num("maxQualifiedCardinality");
      if (max !== undefined) b.max = max;
      if (named(sup, `${OWL}someValuesFrom`).length) b.min = Math.max(b.min ?? 0, 1);
      b.filler = named(sup, `${OWL}onClass`)[0] ?? named(sup, `${OWL}onDataRange`)[0] ?? named(sup, `${OWL}allValuesFrom`)[0] ?? named(sup, `${OWL}someValuesFrom`)[0] ?? b.filler;
      r.set(on, b);
      restricted.set(iri, r);
    }
  }

  const ownBox = (): SchemaDecl => {
    let d = decls.get(ownBoxId);
    if (!d) {
      d = blank(ownBoxName, ownBoxId, "rdf-property-set", { doc: `properties ${v.prefix} states no domain in its own classes for` });
      decls.set(ownBoxId, d);
    }
    return d;
  };

  const addField = (
    d: SchemaDecl,
    propIri: string,
    rangeIri: string | undefined,
    notes: string[],
    bounds?: { min?: number; max?: number },
    union: readonly string[] = [],
  ): void => {
    const functional = (typesOf.get(propIri) ?? new Set()).has(`${OWL}FunctionalProperty`);
    const name = curie(propIri);
    // Several ranges are a union, written as one; with no edge, since no one class is the type.
    const type = rangeIri ? curie(rangeIri) : union.length > 1 ? union.map(curie).sort().join(" | ") : "(no range)";
    const max: number | "*" = bounds?.max ?? (functional ? 1 : "*");
    const min = bounds?.min ?? 0;
    const doc = text(nn(propIri), `${SKOS}definition`, `${RDFS}comment`, `${DCT}description`);
    const datatype = rangeIri !== undefined && (datatypeLink(rangeIri) !== undefined || isA(rangeIri, datatypeTypes));
    const link = rangeIri ? (datatypeLink(rangeIri) ?? (classSet.has(rangeIri) ? undefined : rangeIri)) : undefined;
    const field: SchemaField = {
      name,
      type,
      optional: min === 0,
      array: max === "*" || max > 1,
      names: [],
      min,
      max,
      ...(doc ? { doc } : {}),
      ...(link ? { typeLinks: { [type]: link } } : {}),
      ...(notes.length ? { constraint: notes.join(", ") } : {}),
    };
    if (d.fields.some((f) => f.name === name && f.type === type)) return;
    d.fields.push(field);
    // A datatype (`csvw:uriTemplate`, an XSD type) is a value, linked; a class is an edge.
    if (rangeIri && !datatype) {
      refs.push({ from: d.id, ref: rangeIri, module, via: name, kind: "field", optional: field.optional, array: field.array, by: "canonical", ...(leftOut(rangeIri) ? { quietMiss: true as const } : {}) });
    }
  };

  for (const p of propIris) {
    // schema.org states neither rdfs:domain nor rdfs:range: it says
    // `schema:domainIncludes` / `schema:rangeIncludes`, which are weaker (an
    // expectation, no entailment). Read when there is no rdfs: one, and noted.
    let dom = entailed(p, `${RDFS}domain`);
    let domIncludes = false;
    if (dom.values.length === 0 && (dom = entailed(p, `${SDO}domainIncludes`)).values.length) domIncludes = true;
    let rng = entailed(p, `${RDFS}range`);
    let rngIncludes = false;
    if (rng.values.length === 0 && (rng = entailed(p, `${SDO}rangeIncludes`)).values.length) rngIncludes = true;
    const ranges = rng.values.flatMap(classesOf);
    const range = ranges.length === 1 ? ranges[0] : undefined;
    const notes: string[] = [];
    if (domIncludes) notes.push("domainIncludes");
    if (rngIncludes) notes.push("rangeIncludes");
    if (dom.via) notes.push(`domain via ${curie(dom.via)}`);
    if (rng.via) notes.push(`range via ${curie(rng.via)}`);
    const domains = dom.values.flatMap(classesOf).filter((c) => c !== `${OWL}Thing` && c !== `${RDFS}Resource`);
    const home = domains.filter((c) => decls.has(c));
    const foreign = domains.filter((c) => !decls.has(c));
    for (const c of home) addField(decls.get(c)!, p, range, notes, restricted.get(c)?.get(p), ranges);
    // A property of a class left out on purpose is left out with it.
    if (home.length === 0 && v.only) continue;
    if (home.length === 0) {
      const n = [...notes];
      if (foreign.length) n.unshift(`domain ${foreign.map(curie).join(" ∪ ")}`);
      addField(ownBox(), p, range, n, undefined, ranges);
    }
  }
  // A restriction on a property the class is not the domain of: the class
  // still states it, so it is a field of the class.
  for (const [c, byProp] of restricted) {
    const d = decls.get(c)!;
    for (const [p, b] of byProp) {
      const name = curie(p);
      const existing = d.fields.find((f) => f.name === name);
      if (existing) continue;
      const range = b.filler ?? entailed(p, `${RDFS}range`).values.flatMap(classesOf)[0];
      addField(d, p, range, ["by restriction"], b);
    }
  }

  const ontology = match(null, `${RDF}type`, nn(`${OWL}Ontology`))[0]?.subject;
  const title = ontology ? text(ontology, `${DCT}title`, "http://purl.org/dc/elements/1.1/title", `${RDFS}label`) : undefined;
  const all = [...decls.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { decls: all, edges, refs, ...(title ? { title } : {}), classes: classIris.length, properties: v.only ? all.reduce((n, d) => n + d.fields.length, 0) : propIris.length };
}
