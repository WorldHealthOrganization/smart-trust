/**
 * Prefix-sharded identifier lookup: the client. Plain ES module, no
 * dependencies, no build step.
 *
 * Bean `folio-assistant-4pm8`. Search indexes only MATERIALISED content; a
 * node that is only REFERENCED is found by its identifier through this
 * lookup, which fetches one small JSON shard named by the identifier's
 * prefix and never the whole index.
 *
 * It lives in `cat-harness-tools/id-lookup/` and nowhere else (it lived in
 * `large-datasets/` until bean `j7ql`). The plain docs pipeline is
 * "no extensions. no fancy. no js (if possible)", so nothing under
 * `cat-harness/docs/` may load this file. The indexes it reads are hosted by
 * the layer each one is about, e.g. `who-iris/id-lookup/`.
 *
 * `shardFile` and `splitId` must agree with `scripts/lib/id-shards.ts`, which
 * writes the shards. `id-shards.test.ts` compares them over every identifier
 * in the committed index, so a change to one side alone fails a test.
 */

/** Split `kind/local` into its namespace and local part, or null when it has no namespace. */
export function splitId(id) {
  const i = id.indexOf("/");
  if (i <= 0) return null;
  return { ns: id.slice(0, i), local: id.slice(i + 1) };
}

/**
 * The shard file for a local part at a prefix length, relative to the index
 * root. `p` is prepended so a prefix of length 0 (`p.json`) needs no special
 * name. Characters outside `[a-z0-9._-]` are written as `~` plus two hex
 * digits so that every prefix names exactly one portable file.
 */
export function shardFile(ns, local, prefixLength) {
  const prefix = local.slice(0, prefixLength);
  let safe = "";
  for (const ch of prefix) {
    safe += /^[a-z0-9._-]$/.test(ch) ? ch : "~" + ch.codePointAt(0).toString(16).padStart(2, "0");
  }
  return ns + "/p" + safe + ".json";
}

/** Trim and lower-case what a reader typed. The build refuses upper-case ids, so this loses nothing. */
export function normalise(input) {
  return String(input).trim().toLowerCase();
}

/** How many parsed shards are kept. Bounds memory at about this many times the shard budget, whatever the corpus size. */
export const SHARD_CACHE_SIZE = 8;

/**
 * Open an index. `base` is the URL of the directory holding `manifest.json`.
 * The manifest is fetched once; each lookup then fetches at most one shard per
 * namespace it has to try, and keeps the last few.
 */
export async function openIndex(base, fetchImpl = fetch) {
  const root = base.endsWith("/") ? base : base + "/";
  const res = await fetchImpl(root + "manifest.json");
  if (!res.ok) throw new Error("manifest.json: HTTP " + res.status);
  const manifest = await res.json();
  const cache = new Map();
  const listed = {};
  for (const [ns, n] of Object.entries(manifest.namespaces)) listed[ns] = new Set(n.shards);

  async function shard(file) {
    let p = cache.get(file);
    if (p) {
      cache.delete(file); // re-insert: Map order is the recency order
    } else {
      p = fetchImpl(root + file).then((r) => {
        if (!r.ok) throw new Error(file + ": HTTP " + r.status);
        return r.json();
      });
      p.catch(() => cache.delete(file)); // a failed read is not remembered as an answer
    }
    cache.set(file, p);
    if (cache.size > SHARD_CACHE_SIZE) cache.delete(cache.keys().next().value);
    return p;
  }

  /** The candidate (namespace, local) pairs for an input: one if it names a namespace, else every namespace. */
  function candidates(id) {
    const s = splitId(id);
    if (s && manifest.namespaces[s.ns]) return [s];
    return Object.keys(manifest.namespaces)
      .sort()
      .map((ns) => ({ ns, local: id }));
  }

  /**
   * Resolve one identifier. Returns `{ state: "found", entry, fetched }`,
   * `{ state: "absent", fetched }`, or `{ state: "too-short", need }`.
   * An identifier whose shard is not listed is ABSENT, which the manifest
   * lets us say without a request; a listed shard that fails to load throws,
   * because "could not read" is not "not there".
   */
  async function lookup(input) {
    const id = normalise(input);
    const fetched = [];
    for (const { ns, local } of candidates(id)) {
      const n = manifest.namespaces[ns];
      if (local.length < n.prefixLength) return { state: "too-short", need: n.prefixLength };
      const file = shardFile(ns, local, n.prefixLength);
      if (!listed[ns].has(file.slice(ns.length + 1))) continue;
      fetched.push(file);
      const rows = (await shard(file)).entries;
      const full = ns + "/" + local;
      const row = rows.find((r) => r[0] === full);
      if (row) return { state: "found", entry: { id: row[0], title: row[1], url: row[2] }, fetched };
    }
    return { state: "absent", fetched };
  }

  return { manifest, lookup };
}
