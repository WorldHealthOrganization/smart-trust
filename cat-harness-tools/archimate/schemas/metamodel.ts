/**
 * The metamodel a model actually uses, derived from the model and checked
 * against ArchiMate's relationship table. Never drawn by hand.
 *
 * @graphNode schema
 * @module cat-harness/archimate/schemas/metamodel
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * Owner, 2026-10-31: "i dont really like native UML, rather derived", then
 * "make mechanical tools as parts of skills/processes". A reference
 * architecture's metamodel (which element types it uses, and which
 * relationships it draws between them) used to be a hand-drawn view, with
 * placeholder elements named after the types. Here it is computed:
 *
 * - every element type in the model, with how many elements it has;
 * - every pattern (source type, relationship type, target type), with how many
 *   relationships follow it and which ones;
 * - for each pattern, whether ArchiMate allows it (Appendix B, as Archi holds
 *   it: `archimate-relationships.json`, written by
 *   `scripts/import-archi-relationships.ts`);
 * - the placeholder elements: an element whose name is its own type's name
 *   ("Goal", "Application Component (MS)"). They are how a metamodel gets
 *   drawn by hand, so they and their relationships are listed, and kept out of
 *   the patterns, which describe the architecture itself.
 *
 * The same result is written as JSON, as Graphviz DOT (laid out to SVG by
 * `archimate-pages`), and as a Mermaid class diagram.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layerOf, type ArchimateLayer, type ArchimateModel } from "./archimate.ts";

/** The committed table, beside this module. */
export const TABLE_FILE = join(dirname(fileURLToPath(import.meta.url)), "archimate-relationships.json");

/**
 * The table's `$schema` family. Its validator node is cat-harness's
 * `validators/archimate-relationship-table.json`, on the `schemas` kind.
 */
export const RELATIONSHIP_TABLE_TAG = "archimate-relationship-table/v1";

/** ArchiMate's relationship table as Archi holds it, written by `import-archi-relationships.ts`. */
export const RelationshipTableSchema = z
  .object({
    $schema: z.literal(RELATIONSHIP_TABLE_TAG),
    /** The ArchiMate version the table encodes (Archi's `<relationships version>`). */
    archimateVersion: z.string().min(1),
    source: z
      .object({ repository: z.string().url(), commit: z.string().regex(/^[0-9a-f]{40}$/), path: z.string().min(1), license: z.string().min(1), copyright: z.string().min(1) })
      .strict(),
    /** Key letter → Archi relationship type, e.g. `r` → `RealizationRelationship`. */
    keys: z.record(z.string().regex(/^[a-z]$/), z.string().regex(/Relationship$/)),
    /** Source type → target type → the key letters allowed between them. */
    allowed: z.record(z.string().min(1), z.record(z.string().min(1), z.string().regex(/^[a-z]*$/))),
  })
  .strict();
export type RelationshipTable = z.infer<typeof RelationshipTableSchema>;

let cached: RelationshipTable | undefined;
/** The committed relationship table. */
export function relationshipTable(): RelationshipTable {
  return (cached ??= RelationshipTableSchema.parse(JSON.parse(readFileSync(TABLE_FILE, "utf8"))));
}

/**
 * Whether ArchiMate allows `relationship` from `source` to `target`; undefined
 * when the table does not know one of the types (an Archi diagram type, say),
 * so "not allowed" is never claimed without the table saying so.
 */
export function isAllowed(table: RelationshipTable, source: string, relationship: string, target: string): boolean | undefined {
  const row = table.allowed[source];
  if (row === undefined || (table.allowed[target] === undefined && target !== "Relationship")) return undefined;
  const letters = row[target] ?? "";
  return [...letters].some((ch) => relKind(table.keys[ch] ?? "") === relKind(relationship));
}

/** A relationship type without Archi's suffix: `RealizationRelationship` and `Realization` are both `Realization`. */
export const relKind = (relationship: string): string => relationship.replace(/Relationship$/, "");

/** `ApplicationComponent` → `Application Component`. */
export const typeName = (type: string): string => type.replace(/([a-z])([A-Z])/g, "$1 $2");

/**
 * An element named after its own type, give or take a parenthesised suffix:
 * "Goal", "application component", "Capability (MS)".
 */
export function isPlaceholder(e: { type: string; name: string }): boolean {
  // A Grouping or Junction left with its default name is structure, not a stand-in for a type.
  if (e.type === "Grouping" || e.type === "Junction") return false;
  const n = e.name.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  return n !== "" && n === typeName(e.type).toLowerCase();
}

export interface MetamodelType {
  type: string;
  layer: ArchimateLayer;
  /** Elements of this type, placeholders not counted. */
  elements: number;
  /** Their ids, in model order: what a reader opens from the type's box. */
  ids: string[];
}

export interface MetamodelPattern {
  source: string;
  /** The relationship type as the model reader gives it, e.g. `Realization`. */
  relationship: string;
  target: string;
  count: number;
  /** Allowed by ArchiMate's table; undefined when the table does not know a type. */
  allowed: boolean | undefined;
  /** The relationships that follow it, by id, in model order. */
  relationships: string[];
}

export interface Metamodel {
  $schema: "archimate-metamodel/v1";
  model: string;
  name: string;
  archimateVersion: string;
  types: MetamodelType[];
  patterns: MetamodelPattern[];
  placeholders: Array<{ id: string; type: string; name: string }>;
  /** Relationships with a placeholder at either end: the hand-drawn metamodel, left out of `patterns`. */
  placeholderRelationships: string[];
  /** Relationships following a pattern ArchiMate does not allow. */
  notAllowed: number;
}

/** The metamodel `model` uses. Deterministic: types and patterns sorted by count, then name. */
export function metamodelOf(model: ArchimateModel, modelId: string, table: RelationshipTable = relationshipTable()): Metamodel {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const relIds = new Set(model.relationships.map((r) => r.id));
  const placeholders = model.elements.filter(isPlaceholder);
  const ph = new Set(placeholders.map((e) => e.id));
  const typeIds = new Map<string, string[]>();
  for (const e of model.elements) if (!ph.has(e.id)) typeIds.set(e.type, [...(typeIds.get(e.type) ?? []), e.id]);
  const typeOfEnd = (id: string): string | undefined => elements.get(id)?.type ?? (relIds.has(id) ? "Relationship" : undefined);
  const patterns = new Map<string, MetamodelPattern>();
  const placeholderRelationships: string[] = [];
  for (const r of model.relationships) {
    if (ph.has(r.source) || ph.has(r.target)) {
      placeholderRelationships.push(r.id);
      continue;
    }
    const s = typeOfEnd(r.source);
    const t = typeOfEnd(r.target);
    if (s === undefined || t === undefined) continue; // a dangling end: archimate-check's finding, not this one
    const key = `${s}\u0000${r.type}\u0000${t}`;
    const p = patterns.get(key) ?? { source: s, relationship: r.type, target: t, count: 0, allowed: isAllowed(table, s, r.type, t), relationships: [] };
    p.count++;
    p.relationships.push(r.id);
    patterns.set(key, p);
  }
  const byCount = <T extends { count?: number; elements?: number }>(n: (x: T) => string) => (a: T, b: T) =>
    (b.count ?? b.elements ?? 0) - (a.count ?? a.elements ?? 0) || n(a).localeCompare(n(b));
  const list = [...patterns.values()].sort(byCount((p) => `${p.source} ${p.relationship} ${p.target}`));
  return {
    $schema: "archimate-metamodel/v1",
    model: modelId,
    name: model.name,
    archimateVersion: table.archimateVersion,
    types: [...typeIds].map(([type, ids]) => ({ type, layer: layerOf(type), elements: ids.length, ids })).sort(byCount((t) => t.type)),
    patterns: list,
    placeholders: placeholders.map((e) => ({ id: e.id, type: e.type, name: e.name })),
    placeholderRelationships,
    notAllowed: list.filter((p) => p.allowed === false).reduce((n, p) => n + p.count, 0),
  };
}

/** How each relationship reads, as a verb from source to target. */
export const VERB: Record<string, string> = {
  Composition: "composed of",
  Aggregation: "aggregates",
  Assignment: "assigned to",
  Realization: "realises",
  Specialization: "specialises",
  Serving: "serves",
  Access: "accesses",
  Influence: "influences",
  Triggering: "triggers",
  Flow: "flows to",
  Association: "associated with",
};
export const verbOf = (relationship: string): string => VERB[relKind(relationship)] ?? typeName(relKind(relationship)).toLowerCase();

/** ArchiMate's line for each relationship, in Graphviz's terms. */
const DOT_EDGE: Record<string, string> = {
  Composition: `dir=both, arrowtail=diamond, arrowhead=none`,
  Aggregation: `dir=both, arrowtail=odiamond, arrowhead=none`,
  Assignment: `dir=both, arrowtail=dot, arrowhead=normal`,
  Realization: `style=dashed, arrowhead=empty`,
  Specialization: `arrowhead=empty`,
  Serving: `arrowhead=vee`,
  Access: `style=dotted, arrowhead=vee, arrowsize=0.6`,
  Influence: `style=dashed, arrowhead=vee`,
  Triggering: `arrowhead=normal`,
  Flow: `style=dashed, arrowhead=normal`,
  Association: `arrowhead=none`,
};

const LAYER_FILL: Record<ArchimateLayer, string> = {
  Strategy: "#f5deaa",
  Business: "#ffffb5",
  Application: "#b5ffff",
  Technology: "#c9e7b7",
  Physical: "#c9e7b7",
  Motivation: "#ccccff",
  "Implementation & Migration": "#ffe0e0",
  Other: "#ffffff",
};

/** ArchiMate's layers, top to bottom, as a layered view stacks them. */
export const LAYER_ORDER: ArchimateLayer[] = ["Motivation", "Strategy", "Business", "Application", "Technology", "Physical", "Implementation & Migration", "Other"];

const dq = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * The metamodel as Graphviz DOT: one box per type, grouped by ArchiMate layer
 * (motivation on top, technology at the bottom).
 *
 * Owner, 2026-10-31, of the first drawing (one line per pattern, 73 on
 * smart-ra 0.2.0): "so many dense arrows! whats going on? no grouping?". So
 * the picture is kept readable, and the tables beside it stay complete:
 *
 * - patterns between the same two types share ONE line, labelled with each
 *   relationship and its count;
 * - a type's relationships to itself ("Goal aggregates Goal") are written in
 *   its box, not drawn as loops;
 * - `associated with`, the one relationship that says nothing about how two
 *   things relate, is left out unless `associations` is set.
 *
 * A pattern ArchiMate does not allow is always drawn, red and marked ✗.
 */
export function metamodelDot(
  mm: Metamodel,
  opts: {
    associations?: boolean;
    /**
     * Only these relationship categories (`categoryOf`), and only the types
     * their lines touch, so Graphviz lays the filtered picture out afresh
     * instead of the page hiding lines in the full one. Absent, all of them.
     */
    categories?: readonly string[];
    /** Where a box and a line go when clicked: the page's section for that type or pair. Absent, nothing links. */
    href?: { type: (type: string) => string; pair: (source: string, target: string) => string };
  } = {},
): string {
  const link = (url: string | undefined, tip: string): string => (url ? `, URL=${dq(url)}, target="_top", tooltip=${dq(tip)}` : "");
  const cats = opts.categories === undefined ? undefined : new Set(opts.categories);
  const shown = mm.patterns.filter(
    (p) => (opts.associations || relKind(p.relationship) !== "Association" || p.allowed === false) && (cats === undefined || cats.has(categoryOf(p.relationship))),
  );
  // Filtered, a type with no line of those categories is left out, so it takes no room.
  const used = new Set<string>([...(cats === undefined ? mm.types.map((t) => t.type) : []), ...shown.filter((p) => ![p.source, p.target].some((t) => t === "Grouping" || t === "Junction")).flatMap((p) => [p.source, p.target])]);
  const count = new Map(mm.types.map((t) => [t.type, t.elements]));
  const byLayer = new Map<ArchimateLayer, string[]>();
  // Groupings and junctions are how a view is drawn, not what the architecture holds.
  for (const t of [...used].filter((t) => t !== "Relationship" && t !== "Grouping" && t !== "Junction").sort()) {
    const l = layerOf(t);
    byLayer.set(l, [...(byLayer.get(l) ?? []), t]);
  }
  const label = (p: MetamodelPattern): string => `${p.allowed === false ? "✗ " : ""}${verbOf(p.relationship)} ×${p.count}`;
  // Self-relationships go in the box; the rest are grouped by ordered pair.
  const selfOf = new Map<string, string[]>();
  const pairs = new Map<string, MetamodelPattern[]>();
  for (const p of shown) {
    if ([p.source, p.target].some((t) => t === "Grouping" || t === "Junction")) continue;
    if (p.source === p.target) selfOf.set(p.source, [...(selfOf.get(p.source) ?? []), label(p)]);
    else pairs.set(`${p.source}\u0000${p.target}`, [...(pairs.get(`${p.source}\u0000${p.target}`) ?? []), p]);
  }
  const lines = [
    `digraph ${dq(`${mm.name} — metamodel in use`)} {`,
    // Each layer is one rank (rank=same), stacked by heavy invisible lines,
    // so the picture reads layer by layer as an ArchiMate layered view does;
    // the pattern lines still order the boxes within a layer, which is what
    // keeps them short.
    `  graph [rankdir=TB, newrank=true, fontname="Helvetica", fontsize=11, nodesep=0.6, ranksep=1.3];`,
    `  node [shape=box, style="filled", fontname="Helvetica", fontsize=11, margin="0.14,0.08"];`,
    `  edge [fontname="Helvetica", fontsize=9, color="#555555", fontcolor="#333333"];`,
  ];
  const layers = LAYER_ORDER.filter((l) => byLayer.has(l));
  layers.forEach((layer, i) => {
    const types = byLayer.get(layer)!;
    lines.push(`  subgraph cluster_${i} {`, `    label=${dq(layer)}; class=${dq(`mm-layer-${layerSlug(layer)}`)}; labeljust=l; style="rounded,filled"; fillcolor="#f7f7f7"; color="#bbbbbb"; fontcolor="#666666";`, `    rank=same;`);
    for (const t of types) {
      const self = selfOf.get(t);
      const text = `${typeName(t)}\n${count.get(t) ?? 0} element(s)${self ? `\n(to itself: ${self.join(", ")})` : ""}`;
      lines.push(`    ${dq(t)} [label=${dq(text)}, class=${dq(`mm-layer-${layerSlug(layer)}`)}, fillcolor=${dq(LAYER_FILL[layer])}${link(opts.href?.type(t), `${typeName(t)}: its elements`)}];`);
    }
    lines.push(`  }`);
  });
  for (let i = 1; i < layers.length; i++) lines.push(`  ${dq(byLayer.get(layers[i - 1])![0])} -> ${dq(byLayer.get(layers[i])![0])} [style=invis, constraint=true, weight=10];`);
  if (used.has("Relationship")) lines.push(`  "Relationship" [label="(a relationship)", shape=plaintext, style=""];`);
  for (const ps of pairs.values()) {
    const bad = ps.some((p) => p.allowed === false);
    const kinds = new Set(ps.map((p) => relKind(p.relationship)));
    const style = kinds.size === 1 ? DOT_EDGE[[...kinds][0]] ?? "" : "arrowhead=vee";
    // Classes the page's filters read: each category the line carries, and the layers at its ends.
    const cls = [
      ...new Set(ps.map((p) => `mm-cat-${categoryOf(p.relationship)}`)),
      `mm-from-${layerSlug(layerOf(ps[0].source))}`,
      `mm-to-${layerSlug(layerOf(ps[0].target))}`,
    ].join(" ");
    lines.push(
      `  ${dq(ps[0].source)} -> ${dq(ps[0].target)} [label=${dq(ps.map(label).join("\n"))}, class=${dq(cls)}, ${style}${bad ? `, color="#c0392b", fontcolor="#c0392b", penwidth=2` : ""}` +
        `${link(opts.href?.pair(ps[0].source, ps[0].target), `${typeName(ps[0].source)} → ${typeName(ps[0].target)}: its relationships`)}];`,
    );
  }
  lines.push(`}`);
  return `${lines.join("\n")}\n`;
}

/**
 * ArchiMate 3.2 §5's own grouping of the relationships: what the page's
 * filters are by. Specialization is in none of the three.
 */
export const RELATIONSHIP_CATEGORY: Record<string, "structural" | "dependency" | "dynamic" | "other"> = {
  Composition: "structural",
  Aggregation: "structural",
  Assignment: "structural",
  Realization: "structural",
  Serving: "dependency",
  Access: "dependency",
  Influence: "dependency",
  Association: "dependency",
  Triggering: "dynamic",
  Flow: "dynamic",
  Specialization: "other",
};
export const categoryOf = (relationship: string): string => RELATIONSHIP_CATEGORY[relKind(relationship)] ?? "other";
/** A layer as a class-name word: `Implementation & Migration` → `implementation-migration`. */
export const layerSlug = (layer: string): string => layer.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

/** The page anchor of a type's section and of a pair's first pattern row. */
export const typeAnchor = (type: string): string => `type-${type}`;
export const pairAnchor = (source: string, target: string): string => `pattern-${source}-${target}`;

/** Mermaid's class-diagram arrow for each relationship, source on the left. */
const MERMAID_ARROW: Record<string, string> = {
  Composition: "*--",
  Aggregation: "o--",
  Realization: "..|>",
  Specialization: "--|>",
  Serving: "-->",
  Triggering: "-->",
  Assignment: "-->",
  Access: "..>",
  Influence: "..>",
  Flow: "..>",
  Association: "--",
};

/** The metamodel as a Mermaid class diagram, for readers and tools that take Mermaid. */
export function metamodelMermaid(mm: Metamodel): string {
  const id = (t: string): string => (t === "Relationship" ? "ArchimateRelationship" : t);
  const lines = ["classDiagram", `  %% ${mm.name}: metamodel in use, derived by archimate-metamodel. Do not edit.`];
  for (const t of mm.types) lines.push(`  class ${id(t.type)}["${typeName(t.type)}"]`, `  <<${t.layer}>> ${id(t.type)}`);
  for (const p of mm.patterns) {
    lines.push(`  ${id(p.source)} ${MERMAID_ARROW[relKind(p.relationship)] ?? "--"} ${id(p.target)} : ${p.allowed === false ? "✗ " : ""}${verbOf(p.relationship)} ×${p.count}`);
  }
  return `${lines.join("\n")}\n`;
}

/** The relationship categories the drawing has lines of, in ArchiMate's order. */
export function drawnCategories(mm: Metamodel): string[] {
  const present = new Set(mm.patterns.filter((p) => p.source !== p.target).map((p) => categoryOf(p.relationship)));
  return ["structural", "dependency", "dynamic", "other"].filter((c) => present.has(c));
}

/**
 * Every proper, non-empty set of the drawn categories, each to be laid out on
 * its own (the full set is `metamodel.svg`). Four categories give at most 14.
 */
export function categorySubsets(mm: Metamodel): string[][] {
  const all = drawnCategories(mm);
  const out: string[][] = [];
  for (let bits = 1; bits < (1 << all.length) - 1; bits++) out.push(all.filter((_, i) => bits & (1 << i)));
  return out;
}

/** The file a set of categories is drawn to: `metamodel.svg` for all of them, else `metamodel.<cats>.svg`. */
export const metamodelSvgName = (cats: readonly string[], all: readonly string[]): string =>
  cats.length === all.length ? "metamodel.svg" : `metamodel.${all.filter((c) => cats.includes(c)).join("-")}.svg`;
