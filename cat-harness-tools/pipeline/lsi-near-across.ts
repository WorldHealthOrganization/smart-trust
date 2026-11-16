/**
 * `lsi:near` across graphs. Bean `ec2a` step 3, proposal
 * `cat-harness/docs/proposals/lsi-cross-graph-near-2026-10-24.md`, owner
 * decision A (2026-10-24): **one list per graph**.
 *
 * ## Why the lists are never merged
 *
 * Each graph gets its own index: its own vocabulary, global weights and SVD
 * basis. A cosine of 0.6 in the block space and 0.6 in the declaration space
 * are not the same quantity, so this module never sorts two graphs' hits into
 * one ranking. Each list is labelled with its graph, and its scores are
 * cosines in that graph's space only (REQ-001).
 *
 * ## Explicit before latent
 *
 * A query that names a unit, such as a block `@id` or a qualified Lean name,
 * names it deterministically. Those units are listed first, under `explicit`,
 * with no score (REQ-002), as `lsi-epics.ts` puts explicit evidence ahead of
 * latent evidence. The latent hits that follow leave them out.
 *
 * ## Where a graph's units come from
 *
 * A layer DECLARES its providers under `lsiUnitProviders` in its
 * `<instance>.json` (cat-harness `LsiUnitProviderDeclaration`). This module
 * reads those declarations and imports each provider by variable path, as
 * `src/builtin-adapters.ts` does for content adapters. It names no layer above
 * itself and knows nothing of blocks or Lean (REQ-003, `check:import-direction`).
 *
 * ## No data is not "no hits"
 *
 * A graph that could not be indexed (its provider was missing, failed, or
 * had no input) is reported as **not searched**, with the reason (REQ-005).
 * A query that shares no term with a graph's vocabulary is reported as such,
 * not as an empty result.
 *
 * It writes nothing (REQ-004, method `lsi` refusal 3).
 *
 * @module pipeline/lsi-near-across
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  findDeclarationFile,
  layerRootsIn,
  LsiUnitProviderDeclarationSchema,
  type LsiUnitProviderDeclaration,
} from "../schemas/kg/cat-harness.js";
import { buildLsi, foldIn, rank, tokenize, type LsiOptions, type LsiUnit } from "./lsi";

/** What a provider is called with. */
export interface LsiProviderContext {
  /** The checkout the providers were discovered in. */
  checkoutRoot: string;
  /** Input directories given for this graph on the command line (`--root <graphKind>=<dir>`). May be empty. */
  roots: string[];
}

/** What a provider returns. */
export interface LsiProviderResult {
  units: LsiUnit[];
  /** Inputs that could not be read, with why. The index covers less than the corpus when this is non-empty. */
  unreadable: Array<{ file: string; reason: string }>;
  /** Set when the provider could not index anything, with why (for example, no input root was given). */
  notSearched?: string;
  /** Options for this graph's index, over the defaults below. */
  buildOptions?: LsiOptions;
  /** `[reference text, unit id]` pairs: a query containing the text names the unit explicitly. */
  refKeys?: Array<[string, string]>;
}

/** The function an `lsiUnitProviders` entry names. */
export type LsiUnitProvider = (ctx: LsiProviderContext) => LsiProviderResult | Promise<LsiProviderResult>;

/** One declared provider, located. */
export interface DiscoveredLsiProvider {
  graphKind: string;
  /** The declaring layer's `name`. */
  instance: string;
  /** Absolute path of the provider module. */
  modulePath: string;
  export: string;
}

/** The index options every graph starts from, as `lsi_query` and the block and declaration indexers use. */
export const NEAR_ACROSS_DEFAULTS: LsiOptions = { k: 100, seed: 1990 };

/** Below this many units a graph is not indexed: too little to factor. Same floor as `lsi_query`. */
const MIN_UNITS = 3;

/**
 * Every `lsiUnitProviders` entry declared by a layer in `checkoutRoot`.
 *
 * A declaration that cannot be read, or two layers declaring one
 * `graphKind`, is RECORDED in `problems`. Two declarations of one kind are
 * both left out: which one wins is not decided by scan order.
 */
export function discoverLsiUnitProviders(checkoutRoot: string): { providers: DiscoveredLsiProvider[]; problems: string[] } {
  const found: DiscoveredLsiProvider[] = [];
  const problems: string[] = [];
  for (const root of layerRootsIn(checkoutRoot)) {
    const file = findDeclarationFile(root);
    if (file === undefined) continue;
    let raw: { name?: unknown; lsiUnitProviders?: unknown };
    try {
      raw = JSON.parse(readFileSync(join(root, file), "utf-8"));
    } catch (e) {
      problems.push(`${relative(checkoutRoot, join(root, file))}: could not be read (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (raw.lsiUnitProviders === undefined) continue;
    const name = typeof raw.name === "string" ? raw.name : relative(checkoutRoot, root);
    const parsed = LsiUnitProviderDeclarationSchema.array().safeParse(raw.lsiUnitProviders);
    if (!parsed.success) {
      problems.push(`${name}: \`lsiUnitProviders\` is malformed (${parsed.error.issues.map((i: { message: string }) => i.message).join("; ")})`);
      continue;
    }
    for (const p of parsed.data as LsiUnitProviderDeclaration[]) {
      found.push({ graphKind: p.graphKind, instance: name, modulePath: join(root, p.module), export: p.export });
    }
  }
  const byKind = new Map<string, DiscoveredLsiProvider[]>();
  for (const p of found) byKind.set(p.graphKind, [...(byKind.get(p.graphKind) ?? []), p]);
  const providers: DiscoveredLsiProvider[] = [];
  for (const [kind, ps] of byKind) {
    if (ps.length > 1) problems.push(`graph kind "${kind}" is declared by ${ps.map((p) => `"${p.instance}"`).join(" and ")}; neither is searched until one declaration goes`);
    else providers.push(ps[0]!);
  }
  return { providers, problems };
}

/** The units a query names outright, in the order the query names them. */
export function explicitRefs(text: string, refKeys: ReadonlyArray<readonly [string, string]>): string[] {
  if (refKeys.length === 0) return [];
  const byKey = new Map<string, string[]>();
  for (const [key, id] of refKeys) byKey.set(key, [...(byKey.get(key) ?? []), id]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.match(/[\p{L}\p{N}_.'/@:-]+/gu) ?? []) {
    const token = raw.replace(/[.:,'-]+$/u, "");
    for (const id of byKey.get(token) ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/** One graph's answer. */
export interface GraphNear {
  graphKind: string;
  /** The layer that declared the provider, when one did. */
  instance?: string;
  /** Set when the graph was not searched, with why. Nothing else is meaningful then. */
  notSearched?: string;
  units: number;
  unreadable: number;
  /** Units the query names outright. Not scored. */
  explicit: string[];
  /** True when no term of the query is in this graph's vocabulary: not the same as "nothing is near". */
  vocabularyMiss: boolean;
  /** Latent hits, best first; cosines in THIS graph's space only. */
  hits: Array<{ id: string; cosine: number; lexical: boolean }>;
}

/** Index one graph's units and answer the query in it. Pure: no I/O. */
export function nearInGraph(graphKind: string, result: LsiProviderResult, text: string, top = 5, instance?: string): GraphNear {
  const base = { graphKind, ...(instance !== undefined ? { instance } : {}), units: result.units.length, unreadable: result.unreadable.length, explicit: [], vocabularyMiss: false, hits: [] };
  if (result.notSearched !== undefined) return { ...base, notSearched: result.notSearched };
  if (result.units.length < MIN_UNITS) return { ...base, notSearched: `${result.units.length} unit(s): too few to index` };
  const explicit = explicitRefs(text, result.refKeys ?? []);
  const ix = buildLsi(result.units, { ...NEAR_ACROSS_DEFAULTS, ...result.buildOptions });
  const q = foldIn(ix, text);
  if (q.every((x) => x === 0)) return { ...base, explicit, vocabularyMiss: true };
  const words = tokenize(text);
  const bodies = new Map(result.units.map((u) => [u.id, u.text.toLowerCase()]));
  const hits = rank(ix, q, top, new Set(explicit)).map((h) => ({
    id: h.id,
    cosine: h.cosine,
    lexical: words.some((w) => bodies.get(h.id)!.includes(w)),
  }));
  return { ...base, explicit, hits };
}

/** Load a discovered provider's function. Throws with the reason when the module or export is wrong. */
export async function loadLsiUnitProvider(p: DiscoveredLsiProvider): Promise<LsiUnitProvider> {
  // input-site: imports **/*.ts #2c2bcc37 — the LSI unit provider module a layer declaration names, which may sit anywhere in its tree
  const mod = (await import(p.modulePath)) as Record<string, unknown>;
  const fn = mod[p.export];
  if (typeof fn !== "function") throw new Error(`${relative(process.cwd(), p.modulePath)} has no exported function \`${p.export}\``);
  return fn as LsiUnitProvider;
}

/**
 * The query in every requested graph, one result per graph.
 *
 * `graphs` limits the search to those kinds; a requested kind that no
 * layer declares comes back as not searched. Left out, every declared
 * provider is searched.
 */
export async function nearAcross(
  text: string,
  opts: { checkoutRoot: string; graphs?: string[]; roots?: Record<string, string[]>; top?: number },
): Promise<{ results: GraphNear[]; problems: string[] }> {
  const { providers, problems } = discoverLsiUnitProviders(opts.checkoutRoot);
  const byKind = new Map(providers.map((p) => [p.graphKind, p]));
  const kinds = opts.graphs ?? providers.map((p) => p.graphKind);
  const results: GraphNear[] = [];
  for (const kind of kinds) {
    const p = byKind.get(kind);
    const empty: LsiProviderResult = { units: [], unreadable: [] };
    if (!p) {
      results.push(nearInGraph(kind, { ...empty, notSearched: "no instance in this checkout declares it" }, text));
      continue;
    }
    let result: LsiProviderResult;
    try {
      const fn = await loadLsiUnitProvider(p);
      result = await fn({ checkoutRoot: opts.checkoutRoot, roots: opts.roots?.[kind] ?? [] });
    } catch (e) {
      result = { ...empty, notSearched: `its provider failed: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}` };
    }
    results.push(nearInGraph(kind, result, text, opts.top ?? 5, p.instance));
  }
  return { results, problems };
}

/** The printed form: one block per graph, never one merged list. */
export function formatNearAcross(results: GraphNear[], problems: string[] = []): string[] {
  const out: string[] = [];
  for (const r of results) {
    const from = r.instance ? ` (${r.instance})` : "";
    if (r.notSearched !== undefined) {
      out.push(`${r.graphKind}${from}: not searched (${r.notSearched})`);
      continue;
    }
    const partial = r.unreadable ? `, ${r.unreadable} input(s) unreadable, so the index covers less than the corpus` : "";
    out.push(`${r.graphKind}${from}: ${r.units} units${partial}. Cosines are in this graph's own space; do not compare them with another list.`);
    for (const id of r.explicit) out.push(`  explicit        ${id}`);
    if (r.vocabularyMiss) out.push("  no term of the query is in this graph's vocabulary (this is not \"nothing is near\")");
    for (const h of r.hits) out.push(`  ${h.cosine.toFixed(2)}  ${h.lexical ? "lexical+latent" : "latent only   "}  ${h.id}`);
  }
  for (const p of problems) out.push(`problem: ${p}`);
  return out;
}

/** `--graphs a,b` and repeated `--root <kind>=<dir>` from an argv. */
export function parseNearAcrossArgs(argv: string[]): { graphs?: string[]; roots: Record<string, string[]> } {
  const roots: Record<string, string[]> = {};
  let graphs: string[] | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--graphs" && argv[i + 1] !== undefined) graphs = argv[++i]!.split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--root" && argv[i + 1] !== undefined) {
      const spec = argv[++i]!;
      const at = spec.indexOf("=");
      if (at > 0) (roots[spec.slice(0, at)] ??= []).push(spec.slice(at + 1));
    }
  }
  return { ...(graphs !== undefined ? { graphs } : {}), roots };
}
