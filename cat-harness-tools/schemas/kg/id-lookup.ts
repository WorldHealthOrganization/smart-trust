/**
 * A prefix-sharded identifier lookup for nodes a folio REFERENCES but does not
 * hold.
 *
 * @module cat-harness/schemas/id-lookup
 * @graphNode schema
 *
 * ## Where it sits in search
 *
 * Search indexes only MATERIALISED content (lunr, in the plain docs pipeline),
 * this prefix-sharded lookup covers REFERENCED nodes, and delegation to the
 * source is the fallback wherever `canDelegateSearch` allows.
 *
 * ## The shape
 *
 * One `manifest.json` per index, and one JSON shard per (namespace, prefix).
 * An identifier `kind/local` lives in namespace `kind`, in the shard named by
 * the first `prefixLength` characters of `local`. A reader who types an
 * identifier fetches the manifest once and then one shard, so what they
 * download is bounded by {@link SHARD_BUDGET_BYTES}, not by the corpus.
 *
 * ## The prefix length is measured, not chosen
 *
 * {@link choosePrefixLength} takes the smallest length at which no shard in
 * that namespace exceeds the budget, per namespace: uniform hex UUIDs and
 * word-skewed slugs need different lengths.
 *
 * The budget (64 KiB) is a CEILING — a ~50 KB in-memory target rounded up to
 * a power of two — so a typical shard is well below it.
 */
import { z } from "zod";

export const ID_LOOKUP_MANIFEST_SCHEMA_TAG = "folio-id-lookup-manifest/v1";

/** The ceiling on one shard's serialised size, in bytes. Basis in the module comment. */
export const SHARD_BUDGET_BYTES = 64 * 1024;

/** One referenced node, as the lookup returns it. */
export interface IdEntry {
  /** `kind/local`, lower-case, as the catalogue names the node. */
  id: string;
  title: string;
  /** Where the node is held: the source's own page for it. */
  url: string;
}

/**
 * The three materialisation states, as a catalogue node records them. Restated
 * here, deliberately, rather than imported: this layer sits BELOW the
 * content layer that owns the full catalogue-node schema, and nothing may point
 * up the dependency arrow (owner ruling 2026-10-01, bean `rfuq`). The content
 * layer validates whole nodes in its own gates; this module reads three fields.
 */
export const CATALOGUE_MATERIALIZATION_STATES = ["unknown", "referenced", "materialized"] as const;

/**
 * The PART of a catalogue node the lookup reads — `id`, `title`, the node's own
 * materialisation state and, for a referenced node, where upstream holds it.
 * A projection, not the node: every other field is ignored rather than checked,
 * because judging a whole node is the content layer's job and restating its
 * schema here would be a second answer free to drift from the first.
 */
export const CatalogueNodeReadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  materialization: z.object({
    state: z.enum(CATALOGUE_MATERIALIZATION_STATES),
    provenance: z.object({ upstream: z.string().min(1).optional() }).optional(),
  }),
});
export type CatalogueNodeRead = z.infer<typeof CatalogueNodeReadSchema>;

const NAMESPACE = /^[a-z0-9-]+$/;

/** Split `kind/local`. Mirrors `splitId` in `id-lookup/lookup.js`. */
export function splitId(id: string): { ns: string; local: string } | null {
  const i = id.indexOf("/");
  if (i <= 0) return null;
  return { ns: id.slice(0, i), local: id.slice(i + 1) };
}

/** The shard file for a local part at a prefix length. Mirrors `shardFile` in `id-lookup/lookup.js`. */
export function shardFile(ns: string, local: string, prefixLength: number): string {
  let safe = "";
  for (const ch of local.slice(0, prefixLength)) {
    safe += /^[a-z0-9._-]$/.test(ch) ? ch : "~" + ch.codePointAt(0)!.toString(16).padStart(2, "0");
  }
  return `${ns}/p${safe}.json`;
}

export const ShardSchema = z
  .object({
    prefix: z.string(),
    /** `[id, title, url]`, sorted by id. Arrays rather than objects: the keys would be most of the bytes. */
    entries: z.array(z.tuple([z.string().min(1), z.string().min(1), z.string().url()])).min(1),
  })
  .strict();
export type Shard = z.infer<typeof ShardSchema>;

export const NamespaceIndexSchema = z
  .object({
    prefixLength: z.number().int().nonnegative(),
    entryCount: z.number().int().positive(),
    /** Every shard file in this namespace, relative to it. A prefix not listed has no entries, so no request is needed to say so. */
    shards: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const IdLookupManifestSchema = z
  .object({
    $schema: z.literal(ID_LOOKUP_MANIFEST_SCHEMA_TAG),
    /** The corpus this indexes, by its layer name. */
    source: z.string().min(1),
    /** Which nodes, and from where. A count with no statement of what was counted cannot be checked. */
    selection: z.string().min(1),
    budgetBytes: z.number().int().positive(),
    entryCount: z.number().int().positive(),
    namespaces: z.record(z.string().regex(NAMESPACE), NamespaceIndexSchema),
  })
  .strict();
export type IdLookupManifest = z.infer<typeof IdLookupManifestSchema>;

/** Serialise a shard. Compact, one line, sorted: the bytes are the budget. */
export function serialiseShard(prefix: string, entries: IdEntry[]): string {
  const rows = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((e) => [e.id, e.title, e.url]);
  return JSON.stringify({ prefix, entries: rows }) + "\n";
}

/** Refuse what the client could not find again: no namespace, upper case (the client lower-cases), whitespace, duplicates. */
export function validateEntries(entries: IdEntry[]): void {
  const seen = new Set<string>();
  for (const e of entries) {
    const s = splitId(e.id);
    if (!s || !NAMESPACE.test(s.ns) || s.local.length === 0) {
      throw new Error(`id "${e.id}" is not kind/local with a [a-z0-9-] kind; the lookup could not place it`);
    }
    if (e.id !== e.id.toLowerCase() || /\s/.test(e.id)) {
      throw new Error(`id "${e.id}" has upper case or whitespace; the client normalises input to trimmed lower case, so it could never be found`);
    }
    if (seen.has(e.id)) throw new Error(`id "${e.id}" appears twice; a lookup must return one node`);
    seen.add(e.id);
  }
}

/** Group one namespace's entries by shard file, keeping each shard's raw prefix. */
function groupBy(entries: IdEntry[], ns: string, n: number): Map<string, { prefix: string; entries: IdEntry[] }> {
  const out = new Map<string, { prefix: string; entries: IdEntry[] }>();
  for (const e of entries) {
    const local = splitId(e.id)!.local;
    const f = shardFile(ns, local, n);
    const g = out.get(f);
    if (g) g.entries.push(e);
    else out.set(f, { prefix: local.slice(0, n), entries: [e] });
  }
  return out;
}

/**
 * The smallest prefix length at which no shard exceeds `budget` bytes, for one
 * namespace's entries. Throws when no length fits — one entry larger than the
 * budget, say — because a shard over budget is what this exists to prevent.
 */
export function choosePrefixLength(ns: string, entries: IdEntry[], budget: number): number {
  const longest = Math.max(...entries.map((e) => splitId(e.id)!.local.length));
  for (let n = 0; n <= longest; n++) {
    let fits = true;
    for (const g of groupBy(entries, ns, n).values()) {
      if (Buffer.byteLength(serialiseShard(g.prefix, g.entries)) > budget) {
        fits = false;
        break;
      }
    }
    if (fits) return n;
  }
  throw new Error(`namespace "${ns}": no prefix length keeps every shard under ${budget} bytes`);
}

/**
 * Build an index: every file to write, relative to the index directory, with
 * its content. Deterministic — the same entries give the same bytes, in any
 * input order — so `--check` can compare byte for byte.
 */
export function buildIdLookup(
  entries: IdEntry[],
  opts: { source: string; selection: string; budget?: number },
): { manifest: IdLookupManifest; files: Map<string, string> } {
  if (entries.length === 0) {
    throw new Error("no entries: an index over nothing would answer every lookup 'absent', which reads as a result");
  }
  validateEntries(entries);
  const budget = opts.budget ?? SHARD_BUDGET_BYTES;
  const byNs = new Map<string, IdEntry[]>();
  for (const e of entries) {
    const ns = splitId(e.id)!.ns;
    (byNs.get(ns) ?? byNs.set(ns, []).get(ns)!).push(e);
  }
  const files = new Map<string, string>();
  const namespaces: IdLookupManifest["namespaces"] = {};
  for (const ns of [...byNs.keys()].sort()) {
    const group = byNs.get(ns)!;
    const n = choosePrefixLength(ns, group, budget);
    const shards: string[] = [];
    for (const [f, g] of groupBy(group, ns, n)) {
      files.set(f, serialiseShard(g.prefix, g.entries));
      shards.push(f.slice(ns.length + 1));
    }
    shards.sort();
    namespaces[ns] = { prefixLength: n, entryCount: group.length, shards };
  }
  const manifest: IdLookupManifest = {
    $schema: ID_LOOKUP_MANIFEST_SCHEMA_TAG,
    source: opts.source,
    selection: opts.selection,
    budgetBytes: budget,
    entryCount: entries.length,
    namespaces,
  };
  // Compact, like the shards: at full IRIS scale the shard list is thousands of names.
  files.set("manifest.json", JSON.stringify(manifest) + "\n");
  return { manifest, files: new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) };
}
