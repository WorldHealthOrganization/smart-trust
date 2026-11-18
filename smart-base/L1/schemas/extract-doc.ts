/**
 * What every knowledge-graph EXTRACTOR shares: the node and edge builders, the
 * document envelope, and the few XML and CLI helpers WHO smart-kg's extractors
 * each carried a copy of (`tools/extract-*.mjs`, main 3f5e477).
 *
 * The envelope is stamped from the TYPED layer spec the extractor emits — its
 * `@context` is that layer's context URL and its `ontologyVersion` the layer's
 * `schemaVersion` — so `validate.ts` `check()` reads a document against the
 * layer it says it belongs to. smart-kg read the version from
 * `ontology/l1/l1.json` on disk (`ontology.mjs` `ontologyVersion()`).
 *
 * Nothing here names a layer above L1: an extractor passes its own spec in.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contextUrl } from "./context.ts";
import type { GraphDocument, GraphEdge, GraphNode } from "./graph.ts";
import type { LayerSpec } from "./ontology.ts";

export type { GraphDocument, GraphEdge, GraphNode };
export type Derivation = GraphNode["derivation"];
export type Evidence = NonNullable<GraphNode["evidence"]>;
export type ProvenanceSource = NonNullable<GraphDocument["wasDerivedFrom"]>[number];

/** The optional fields a node or edge may carry beyond its identity. */
export interface Extra {
  derivation?: Derivation;
  note?: string;
  evidence?: Evidence;
  qualifier?: string;
  properties?: Record<string, unknown>;
}

/**
 * Drop what a typed property cannot hold: `null`, `undefined`, an empty string
 * and an empty array, recursively. smart-kg wrote `hitPolicy: null` to say "the
 * file does not say"; the migrated layers type every property (`z.string().min(1)`,
 * a list `.min(1)`) and an absent property says the same thing.
 */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => compact(v)).filter((v) => !isEmpty(v)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const c = compact(v);
      if (!isEmpty(c)) out[k] = c;
    }
    return out as T;
  }
  return value;
}
const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** A node builder bound to one extractor's skill id. Properties are {@link compact}ed. */
export const nodeBuilder =
  (skill: string) =>
  (id: string, type: string, label: string | null | undefined, properties: Record<string, unknown>, extra: Extra = {}): GraphNode => {
    const { qualifier: _q, properties: _p, ...rest } = extra;
    return {
      id,
      type,
      // A label is required and non-empty; the id stands in when the source names nothing.
      label: label && label.trim() ? label : id,
      properties: compact(properties),
      derivation: "derived",
      skill,
      ...rest,
    };
  };

/** An edge builder bound to one extractor's skill id. */
export const edgeBuilder =
  (skill: string) =>
  (predicate: string, source: string, target: string, extra: Extra = {}): GraphEdge => {
    // Spread then overwrite, so `properties` keeps the key position smart-kg wrote it at.
    return {
      type: "Statement",
      predicate,
      source,
      target,
      derivation: "derived",
      skill,
      ...extra,
      ...(extra.properties ? { properties: compact(extra.properties) } : {}),
    };
  };

/** smart-kg's timestamp: ISO 8601 to the second, UTC. */
export const generatedAt = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

/** The graph document an extractor emits, for the layer `spec` declares. */
export function graphDocument(
  spec: LayerSpec,
  id: string,
  wasDerivedFrom: ProvenanceSource[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphDocument {
  return {
    "@context": contextUrl(spec.layer.toLowerCase()),
    id,
    type: "Entity",
    ontologyVersion: spec.schemaVersion,
    generatedAt: generatedAt(),
    wasDerivedFrom,
    nodes,
    edges,
  };
}

/** Node count per class, for an extractor's stderr summary. */
export function countByType(nodes: { type: string }[]): Record<string, number> {
  const by: Record<string, number> = {};
  for (const n of nodes) by[n.type] = (by[n.type] ?? 0) + 1;
  return by;
}

// ---- XML, read with regular expressions as smart-kg reads it ---------------------------------------

/**
 * An element's text with its markup removed. Applied until nothing changes, because one pass of a
 * tag pattern can leave a tag behind (`<<b>b>` loses `<b>` and leaves `<b>`); the entities are
 * decoded after, never before, so an escaped `&lt;b&gt;` in the text stays text.
 */
export function stripTags(s: string): string {
  let out = s;
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(/<[^<>]*>/g, "");
  }
  return out;
}

/** The five predefined XML entities. */
export const xmlDecode = (s: unknown): string =>
  String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** An attribute of a tag (the first `name="..."` in it), decoded; null when absent. */
export const xmlAttr = (tag: string, name: string): string | null => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? xmlDecode(m[1]) : null;
};

// ---- CLI ---------------------------------------------------------------------------------------

/** The value after `flag` on the command line, or null. */
export const argOf = (argv: string[], flag: string): string | null => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : (argv[i + 1] ?? null);
};

/** True when the module at `url` is the script node/tsx was asked to run. */
export const isMain = (url: string): boolean => !!process.argv[1] && fileURLToPath(url) === resolve(process.argv[1]);
