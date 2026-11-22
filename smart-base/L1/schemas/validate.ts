/**
 * Check a knowledge-graph document: tier 1 (form, `graph.ts`) then tier 2
 * (against the ontology: L1 3.0, and the `l1-library` extension when the
 * document names it).
 *
 * Tier 2 is a port of WHO smart-kg `tools/validate.mjs` `validateGraph` (main
 * 3f5e477), rule for rule and message for message, so a document's verdict
 * did not depend on which of the two checked it. (The test that held the two
 * to the same answers ran against a smart-kg checkout and was removed when
 * smart-kg was deprecated, owner 2026-10-16.) It adds ONE rule smart-kg cannot have, because
 * smart-kg types only bound properties: every property VALUE must satisfy its
 * declared type (`issued` is a date, `cells` an array, `ordinal` an integer).
 * Those findings carry the prefix `property value`, so a reader can tell the
 * new ones from the ported ones.
 *
 *   npx tsx validate.ts path/to/graph.json [more.json ...]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { GraphDocumentSchema, type GraphDocument } from "./graph.ts";
import { contentHash, contentText, norm } from "./kgid.ts";
import { LAYERS } from "./layers.ts";
import { bindingOf, propertiesSchemaFor, type ClassSpec, type EdgeRule, type LayerSpec, type Predicate, type ValueSet } from "./ontology.ts";

export interface Verdict {
  errors: string[];
  warnings: string[];
  metrics: Record<string, unknown>;
}

/** The layers smart-base holds, by name: found from the named subgraphs' declarations (layers.ts). */
export { LAYERS };

/** Which layer a document names through its @context — smart-kg's rule. */
export function layerOf(doc: { "@context"?: unknown }): string {
  const ctx = typeof doc["@context"] === "string" ? doc["@context"] : "";
  const m = /\/(l\d+(?:-[a-z0-9]+)*)\.context\.jsonld$/.exec(ctx);
  return m ? m[1]! : "l1";
}

export interface Scope {
  own: LayerSpec;
  classes: Map<string, ClassSpec>;
  predicates: Map<string, Predicate>;
  edges: EdgeRule[];
  valueSets: Map<string, ValueSet>;
}

/** A layer with its imports resolved — smart-kg's `loadLayer` + `scopeOf`. */
export function scopeOf(name: string, seen = new Set<string>()): Scope {
  const own = LAYERS[name];
  if (!own) throw new Error(`layer "${name}" is not held by this package (it holds ${Object.keys(LAYERS).join(", ")})`);
  if (seen.has(name)) throw new Error(`circular ontology import at "${name}"`);
  seen.add(name);
  const scope: Scope = { own, classes: new Map(), predicates: new Map(), edges: [], valueSets: new Map() };
  for (const dep of own.imports ?? []) {
    const sub = scopeOf(dep, seen);
    if (sub.own.schemaVersion !== own.schemaVersion) {
      throw new Error(`${name} is schemaVersion ${own.schemaVersion} but imports ${dep} at ${sub.own.schemaVersion}`);
    }
    for (const [k, v] of sub.classes) scope.classes.set(k, v);
    for (const [k, v] of sub.predicates) scope.predicates.set(k, v);
    for (const [k, v] of sub.valueSets) scope.valueSets.set(k, v);
    scope.edges.push(...sub.edges);
  }
  for (const c of own.classes) scope.classes.set(c.id, c);
  for (const p of own.predicates) scope.predicates.set(p.predicate, p);
  for (const v of own.valueSets) scope.valueSets.set(v.id, v);
  scope.edges.push(...own.edges);
  return scope;
}

type AnyNode = { id: string; type: string; properties?: Record<string, unknown> };
const RANK: Record<string, number> = { derived: 0, inferred: 1, decided: 2 };

/** Tier 2. `external`: nodes defined in sibling documents of the same graph. */
export function validateGraph(doc: GraphDocument, scope: Scope = scopeOf("l1"), external = new Map<string, AnyNode>()): Verdict {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { classes, valueSets } = scope;
  const openQualifier = new Set([...scope.predicates.values()].filter((p) => p.openQualifier).map((p) => p.predicate));
  const licensed = new Map<string, EdgeRule[]>();
  const between = new Map<string, Set<string>>();
  for (const e of scope.edges) {
    const key = `${e.predicate}|${e.source}|${e.target}`;
    if (!licensed.has(key)) licensed.set(key, []);
    licensed.get(key)!.push(e);
    const pair = `${e.source}|${e.target}`;
    if (!between.has(pair)) between.set(pair, new Set());
    between.get(pair)!.add(e.qualifier ? `${e.predicate} («${e.qualifier}»)` : e.predicate);
  }

  if (doc.ontologyVersion !== scope.own.schemaVersion) {
    errors.push(
      `ontologyVersion "${doc.ontologyVersion}" does not match the ontology's schemaVersion ` +
        `"${scope.own.schemaVersion}". Nothing below was checked.`,
    );
    return { errors, warnings, metrics: {} };
  }

  const nodes = new Map<string, GraphDocument["nodes"][number]>();
  for (const n of doc.nodes) {
    if (nodes.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    nodes.set(n.id, n);
    if (!classes.has(n.type)) errors.push(`node "${n.id}" has type "${n.type}", which the ontology does not declare`);
    if ((n.derivation === "inferred" || n.derivation === "decided") && !(n.note && n.evidence)) {
      errors.push(
        `node "${n.id}" is ${n.derivation} and carries no ${n.note ? "evidence" : "note"}. ` +
          `A claim that was not mechanically derived must say why and point at the source.`,
      );
    }
  }
  const byClass: Record<string, number> = {};
  for (const n of nodes.values()) byClass[n.type] = (byClass[n.type] ?? 0) + 1;

  const byPredicate: Record<string, number> = {};
  let crossDocument = 0;
  for (const e of doc.edges) {
    byPredicate[e.predicate] = (byPredicate[e.predicate] ?? 0) + 1;
    const s = nodes.get(e.source) ?? external.get(e.source);
    const t = nodes.get(e.target) ?? external.get(e.target);
    if (!s) {
      errors.push(`edge ${e.predicate} names source "${e.source}", which is defined in no document checked in this run`);
      continue;
    }
    if (!t) {
      errors.push(
        `edge ${e.predicate} names target "${e.target}", which is defined in no document checked in this run. ` +
          `If it belongs to another layer's document, pass that file too.`,
      );
      continue;
    }
    if ((external.has(e.source) && !nodes.has(e.source)) || (external.has(e.target) && !nodes.has(e.target))) crossDocument++;
    if (!classes.has(s.type) || !classes.has(t.type)) continue;
    const candidates = licensed.get(`${e.predicate}|${s.type}|${t.type}`);
    if (!candidates) {
      const alt = [...(between.get(`${s.type}|${t.type}`) ?? [])];
      errors.push(
        `edge "${s.type} ${e.predicate} ${t.type}" is not licensed by the ontology. ` +
          (alt.length
            ? `Between those classes the model licenses: ${alt.join(", ")}. ` +
              `An unlicensed edge is usually a missing intermediate node rather than a wrong predicate.`
            : `The model licenses no edge at all between those classes.`),
      );
      continue;
    }
    if (e.qualifier !== undefined && !openQualifier.has(e.predicate) && !candidates.some((c) => c.qualifier === e.qualifier)) {
      const known = candidates.map((c) => c.qualifier ?? "(none)").join(", ");
      warnings.push(
        `edge "${s.type} ${e.predicate} ${t.type}" carries qualifier «${e.qualifier}»; ` +
          `the model has: ${known}. More often a model that has moved on than a defect in the graph.`,
      );
    }
    const minEdge = candidates.map((c) => c.minDerivation).find(Boolean);
    if (minEdge && RANK[e.derivation]! < RANK[minEdge]!) {
      errors.push(`edge "${s.type} ${e.predicate} ${t.type}" is "${e.derivation}", but the model requires at least "${minEdge}" for it`);
    }
    if (e.derivation === "decided" && !(e.evidence?.by && e.evidence?.at)) {
      errors.push(`edge "${s.type} ${e.predicate} ${t.type}" is "decided" and its evidence does not say who decided and when (evidence.by, evidence.at)`);
    }
    if ((e.derivation === "inferred" || e.derivation === "decided") && !(e.note && e.evidence)) {
      errors.push(`edge "${s.type} ${e.predicate} ${t.type}" is ${e.derivation} and carries no ${e.note ? "evidence" : "note"}.`);
    }
  }

  // Property names (ported), then values against bindings (ported), then types (new).
  const codesOf = (id: string) => (valueSets.get(id)?.codes ?? []).map((c) => c.code);
  for (const n of nodes.values()) {
    const c = classes.get(n.type);
    if (!c) continue;
    const allowed = new Set(Object.keys(c.properties));
    for (const key of Object.keys(n.properties ?? {})) {
      if (!allowed.has(key)) errors.push(`node "${n.id}" (${n.type}) has property "${key}", which the class does not declare`);
    }
    for (const [prop, binding] of Object.entries(c.valueSets ?? {})) {
      const { set, severity } = bindingOf(binding);
      const value = n.properties?.[prop];
      if (value === undefined || value === null) continue;
      const codes = codesOf(set);
      if (!codes.includes(value as string)) {
        (severity === "warning" ? warnings : errors).push(
          `node "${n.id}" (${n.type}) has ${prop} "${String(value)}", which is not a code in value set "${set}". Permitted: ${codes.join(", ")}`,
        );
      }
    }
    if (Array.isArray(n.properties?.identifiers) && valueSets.has("identifier-type")) {
      for (const idf of n.properties.identifiers as { type?: string }[]) {
        if (!codesOf("identifier-type").includes(idf?.type as string)) {
          errors.push(`node "${n.id}" has an identifier of type "${String(idf?.type)}", which is not a code in value set "identifier-type"`);
        }
      }
    }
    // New: typed values. Bound codes are already reported above, so only other issues are added.
    const bound = new Set(Object.keys(c.valueSets ?? {}));
    const typed = propertiesSchemaFor(c).safeParse(Object.fromEntries(Object.entries(n.properties ?? {}).filter(([k]) => allowed.has(k))));
    if (!typed.success) {
      for (const issue of typed.error.issues) {
        const prop = String(issue.path[0]);
        if (bound.has(prop) && issue.path.length === 1) continue;
        if (prop === "identifiers" && issue.path[2] === "type") continue;
        errors.push(`property value: node "${n.id}" (${n.type}) ${issue.path.join(".")}: ${issue.message}`);
      }
    }
  }

  for (const n of nodes.values()) {
    const pattern = classes.get(n.type)?.iriPattern;
    if (pattern && !new RegExp(pattern).test(n.id)) {
      errors.push(`node "${n.id}" (${n.type}) does not have the IRI shape its class requires (${pattern}). Mint it with tools/kgid.mjs so re-extraction yields the same node.`);
    }
  }

  for (const n of nodes.values()) {
    const fields = classes.get(n.type)?.contentFields;
    if (!fields) continue;
    const text = contentText(n, fields);
    if (text === null) continue;
    const have = n.properties?.contentHash;
    if (have === undefined) {
      warnings.push(`node "${n.id}" (${n.type}) has no contentHash; a corrected PDF cannot be checked against it node by node`);
    } else if (have !== contentHash(text)) {
      errors.push(`node "${n.id}" (${n.type}) has a contentHash that does not match its ${fields.join(" + ")}. Recompute it with tools/kgid.mjs contentHash().`);
    }
  }

  for (const n of nodes.values()) {
    const min = classes.get(n.type)?.minDerivation;
    const what = `node "${n.id}"`;
    if (min && RANK[n.derivation] !== undefined && RANK[n.derivation]! < RANK[min]!) {
      errors.push(`${what} is "${n.derivation}", but the model requires at least "${min}" for it`);
    }
    if (n.derivation === "decided" && !(n.evidence?.by && n.evidence?.at)) {
      errors.push(`${what} is "decided" and its evidence does not say who decided and when (evidence.by, evidence.at)`);
    }
  }

  const edgesFrom = (id: string, predicate: string) => doc.edges.filter((e) => e.source === id && e.predicate === predicate);
  const nodeAt = (id: string): AnyNode | undefined => nodes.get(id) ?? external.get(id);
  const prop = (n: AnyNode | undefined, k: string) => n?.properties?.[k] as string | undefined;

  for (const n of nodes.values()) {
    if (n.type !== "recommendation") continue;
    const p = n.properties ?? {};
    const kind = p.kind;
    const has = (k: string) => p[k] !== undefined && p[k] !== null;
    if (has("strength") && !has("direction")) {
      errors.push(`recommendation "${n.id}" carries a strength without a direction. A strength says how firmly WHO recommends for or against something; record which.`);
    }
    if (kind === "good-practice-statement" || kind === "no-recommendation") {
      const graded = ["strength", "overallCertainty", ...(kind === "no-recommendation" ? ["direction"] : [])].filter(has);
      if (graded.length) {
        errors.push(
          `recommendation "${n.id}" is kind "${kind}" and carries ${graded.join(", ")}. ` +
            `${kind === "no-recommendation" ? "No recommendation was made" : "A good practice statement is ungraded"}, so there is nothing to grade.`,
        );
      }
    }
    for (const e of edgesFrom(n.id, "definedIn")) {
      const pub = nodeAt(e.target);
      const grc = prop(pub, "grcStatus");
      const ptype = prop(pub, "publicationType");
      if (ptype === "implementation-guidance" || ptype === "methodology") {
        errors.push(`recommendation "${n.id}" is defined in "${e.target}", a ${ptype} publication, which makes no recommendations of its own (handbook §1.9). What it prints is an implementation-practice (the l1-library extension; owner ruling 1b, 2026-10-12).`);
      }
      if (grc === "not-reviewed") {
        errors.push(`recommendation "${n.id}" is defined in "${e.target}", which is recorded as not reviewed by the GRC. Recommendations come from GRC-approved guidelines.`);
      } else if (pub && grc === undefined) {
        warnings.push(`recommendation "${n.id}" is defined in "${e.target}", which records no GRC status`);
      }
    }
    const sources = [String(p.statement ?? "")];
    for (const e of edgesFrom(n.id, "hasRemark")) sources.push(prop(nodeAt(e.target), "text") ?? "");
    for (const e of edgesFrom(n.id, "presentedIn")) {
      const where = nodeAt(e.target);
      sources.push(prop(where, "caption") ?? "", prop(where, "heading") ?? "");
      for (const up of doc.edges.filter((x) => x.predicate === "contains" && x.target === e.target)) {
        const parent = nodeAt(up.source);
        sources.push(prop(parent, "caption") ?? "", prop(parent, "heading") ?? "");
      }
    }
    const haystack = norm(sources.join(" \n "));
    for (const slot of ["intervention", "population", "setting", "provider", "timing"]) {
      if (has(slot) && !haystack.includes(norm(p[slot]))) {
        warnings.push(`recommendation "${n.id}" has ${slot} "${String(p[slot])}", which is not quoted from its statement, remarks, or the caption or heading it is printed under`);
      }
    }
    if (has("overallCertainty")) {
      const ORDER = ["very-low", "low", "moderate", "high"];
      const critical: string[] = [];
      for (const s of edgesFrom(n.id, "supportedBy")) {
        const ev = nodeAt(s.target);
        const cert = prop(ev, "certainty");
        if (!cert) continue;
        for (const f of edgesFrom(s.target, "forOutcome")) if (prop(nodeAt(f.target), "importance") === "critical") critical.push(cert);
      }
      if (critical.length) {
        const lowest = critical.reduce((a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b));
        if (ORDER.indexOf(String(p.overallCertainty)) > ORDER.indexOf(lowest)) {
          warnings.push(`recommendation "${n.id}" states overallCertainty "${String(p.overallCertainty)}", higher than the lowest certainty on its critical outcomes ("${lowest}"; handbook §9.6)`);
        }
      }
    }
  }

  for (const n of nodes.values()) {
    if (n.type !== "publication-element" || n.properties?.elementType !== "table") continue;
    const { columns, columnMap } = n.properties as { columns?: string[]; columnMap?: Record<string, string> };
    if (!Array.isArray(columns) || !columnMap) continue;
    const mapped = columns.map((c, i) => (columnMap[c] ? i : -1)).filter((i) => i >= 0);
    for (const e of edgesFrom(n.id, "contains")) {
      const row = nodeAt(e.target);
      const cells = row?.properties?.cells as (string | null)[] | undefined;
      if (row?.properties?.rowType !== "data" || !Array.isArray(cells)) continue;
      const presented = doc.edges.some((x) => x.predicate === "presentedIn" && x.target === row.id);
      for (const i of mapped) {
        if (presented && cells[i] !== null && cells[i] !== undefined) {
          errors.push(`row "${row.id}" stores column "${columns[i]}", which the table fills from ${columnMap[columns[i]!]} of the content presented there. Store it once: set the cell to null.`);
        }
      }
    }
  }

  const resolved = (id: string, seen = new Set<string>()): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    if (edgesFrom(id, "resolvesTo").length) return true;
    return edgesFrom(id, "numberedAs").some((e) => prop(nodeAt(e.target), "resolutionStatus") === "resolved" && resolved(e.target, seen));
  };
  for (const n of nodes.values()) {
    if (n.type !== "citation" && n.type !== "reference-entry") continue;
    const status = n.properties?.resolutionStatus;
    const direct = edgesFrom(n.id, "resolvesTo").length > 0;
    if (n.type === "citation" && n.properties?.citationKind === "placeholder") {
      if (direct || status === "resolved") {
        errors.push(`citation "${n.id}" is a placeholder and claims a resolution. A placeholder marks a missing source; it never resolves.`);
      }
    } else if (status === "resolved" && !resolved(n.id)) {
      errors.push(`${n.type} "${n.id}" claims resolutionStatus "resolved" but has no resolvesTo edge`);
    }
    if (direct && status !== "resolved") warnings.push(`${n.type} "${n.id}" has a resolvesTo edge but resolutionStatus is "${String(status)}"`);
    if (!n.properties?.text) errors.push(`${n.type} "${n.id}" carries no verbatim text, so nothing can be checked against the source`);
  }

  const RESOLVABLE = new Set(valueSets.has("resolution-status") ? codesOf("resolution-status") : ["unresolved", "resolved", "ambiguous"]);
  const joins: Record<string, number> = { resolved: 0, unresolved: 0, ambiguous: 0 };
  for (const e of doc.edges) {
    const status = e.properties?.resolutionStatus;
    if (status === undefined) continue;
    if (typeof status !== "string" || !RESOLVABLE.has(status)) {
      errors.push(`edge "${e.predicate}" carries resolutionStatus "${String(status)}"; permitted values are ${[...RESOLVABLE].join(", ")}`);
      continue;
    }
    joins[status] = (joins[status] ?? 0) + 1;
    if (status !== "resolved") continue;
    const t = nodes.get(e.target) ?? external.get(e.target);
    const ts = t?.properties?.resolutionStatus;
    if (ts && ts !== "resolved") {
      errors.push(`edge "${e.predicate}" claims resolutionStatus "resolved" but its target "${e.target}" is itself "${String(ts)}". A join cannot be resolved against a placeholder.`);
    }
    if ((e.derivation === "inferred" || e.derivation === "decided") && !e.evidence?.location) {
      errors.push(`edge "${e.predicate}" claims a resolved match but points at no evidence. A match made by string equality must say which file and which line it was made against.`);
    }
  }

  return {
    errors,
    warnings,
    metrics: {
      nodes: nodes.size,
      edges: doc.edges.length,
      byClass,
      byPredicate,
      ...(joins.resolved! + joins.unresolved! + joins.ambiguous! ? { joins } : {}),
      ...(crossDocument ? { crossDocumentEdges: crossDocument } : {}),
    },
  };
}

/** Tier 1 then tier 2, for one parsed JSON value. */
export function check(raw: unknown, external = new Map<string, AnyNode>()): Verdict {
  const layer = layerOf((raw ?? {}) as { "@context"?: unknown });
  let scope: Scope;
  try {
    scope = scopeOf(layer);
  } catch (err) {
    return { errors: [(err as Error).message], warnings: [], metrics: {} };
  }
  const parsed = GraphDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `tier 1: ${i.path.join(".") || "(document)"}: ${i.message}`), warnings: [], metrics: {} };
  }
  return validateGraph(parsed.data, scope, external);
}

function main(argv: string[]): number {
  const files = argv.filter((a) => !a.startsWith("--"));
  if (!files.length) {
    console.error("usage: validate.ts <graph-document.json>...");
    return 2;
  }
  const docs = files.map((f) => ({ f, raw: JSON.parse(readFileSync(f, "utf8")) as { nodes?: AnyNode[] } }));
  const every = new Map<string, AnyNode>();
  for (const { raw } of docs) for (const n of raw.nodes ?? []) if (!every.has(n.id)) every.set(n.id, n);
  let failed = false;
  for (const { f, raw } of docs) {
    const v = check(raw, every);
    const m = v.metrics as { nodes?: number; edges?: number; byClass?: Record<string, number> };
    console.log(
      `${f} [${layerOf(raw as { "@context"?: unknown })}]: ${m.nodes ?? "?"} nodes, ${m.edges ?? "?"} edges` +
        (m.byClass ? ` [${Object.entries(m.byClass).map(([k, n]) => `${k}:${n}`).join(" ")}]` : ""),
    );
    for (const w of v.warnings) console.warn(`  warning: ${w}`);
    for (const e of v.errors) console.error(`  error: ${e}`);
    if (v.errors.length) failed = true;
    else console.log("  conforms to the ontology");
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
