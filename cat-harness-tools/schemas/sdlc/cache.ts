/**
 * Caches — one node per CI cache a layer DECLARES: its key recipe, where its
 * entries live, who produces and consumes them, its trust class and budget.
 * **Never the entries.**
 *
 * @module schemas/cache
 * @graphNode schema
 *
 * Rule 6 of cache-first CI (skill `cache-first-ci`, owner 2026-11-05): every
 * cache is a node of kind `cache`, and a viewer shows each cache's stored key
 * against the key today's pins imply, so staleness is COMPUTED, never
 * claimed. Rule 7: a harness DECLARES its caches; the implementation is one,
 * here (`cached-step`, `cache:key`).
 *
 * ## Two families of one kind
 *
 * - `cache/1.0.0` — one cache this layer declares ({@link CacheSchema}).
 * - `cache-inventory/1.0.0` — a dated snapshot of the caches found across the
 *   harness repositories, before each declares its own
 *   ({@link CacheInventorySchema}). A snapshot says when and how it was taken;
 *   it is never read as a declaration.
 *
 * ## What the node does NOT hold
 *
 * The stored key, the age, the size and the hit rate of a cache are facts
 * about the cache service, not about the declaration: they come from the
 * daily cache report (`cache-report.sh`) and are joined by the viewer. A node
 * carrying them would be a claim that goes stale the day it is written.
 *
 * ## The key is derived (bean `4rbc`)
 *
 * {@link KeyRecipeSchema} names HOW the key is computed — `cache:key` (the
 * f017 fingerprint), `cache:key --base` (the cone's tree-free base), the
 * runner's `hashFiles` over a lock, or a mount-free script that implements a
 * recipe (`.github/ci-image/key.sh`) — never a list of inputs typed by hand.
 * `hand-listed` exists only to RECORD a key found that way, so the viewer can
 * say so; it is a finding, not a recipe to copy.
 */
import { z } from "zod";
import { nodeKind } from "../kg/node-kind.ts";

export const CACHE_SCHEMA_TAG = "cache/1.0.0";
export const CACHE_INVENTORY_SCHEMA_TAG = "cache-inventory/1.0.0";

/** Where a cache's entries live (the inventory's kinds). */
export const CACHE_KINDS = [
  "actions-cache",
  "artifact-reuse",
  "ghcr-image",
  "git-ref",
  "branch-store",
  "on-disk",
  "setup-action-cache",
] as const;
export const CacheKindSchema = z.enum(CACHE_KINDS);

/**
 * The trust classes of cache-first CI.
 *
 * - `a` — verified against a reference derived from THIS tree (lock digests): a bad entry is only a miss.
 * - `a-provenance` — verified against a manifest it carries, AND a source rule (main's scope, or same head / parent / tree).
 * - `b` — a verdict: reported SKIPPED, re-verified later.
 * - `c` — saved from main only.
 * - `unclassified` — found by the inventory, not yet ruled on. Never read as any of the above.
 */
export const TRUST_CLASSES = ["a", "a-provenance", "b", "c", "unclassified"] as const;
export const TrustClassSchema = z.enum(TRUST_CLASSES);

export const KEY_SOURCES = ["cache:key", "cache:key --base", "hashFiles", "script", "hand-listed", "per-run"] as const;

export const KeyRecipeSchema = z
  .object({
    source: z.enum(KEY_SOURCES),
    /** `cache:key` / `cache:key --base`: the package script fingerprinted. */
    script: z.string().min(1).optional(),
    /** `hashFiles`: the files, checkout-relative (a lock, never a hand-picked glob of sources). */
    files: z.array(z.string().min(1)).min(1).optional(),
    /** `script`: the mount-free implementation of the recipe. */
    implementation: z.string().min(1).optional(),
    /** The key text as the workflow writes it, for the reader. */
    expression: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const need = (field: "script" | "files" | "implementation") => {
      if (r[field] === undefined) ctx.addIssue({ code: "custom", message: `a \`${r.source}\` recipe needs \`${field}\``, path: [field] });
    };
    if (r.source === "cache:key" || r.source === "cache:key --base") need("script");
    if (r.source === "hashFiles") need("files");
    if (r.source === "script") need("implementation");
    if ((r.source === "hand-listed" || r.source === "per-run") && r.expression === undefined) {
      ctx.addIssue({ code: "custom", message: `a \`${r.source}\` key is a finding: record its \`expression\``, path: ["expression"] });
    }
  });
export type KeyRecipe = z.infer<typeof KeyRecipeSchema>;

const Uses = z.array(z.string().regex(/^[^:\s]+(:\d+(-\d+)?)?( .*)?$/, "a use is `path[:line[-line]]`")).min(1);

export const CacheSchema = z
  .object({
    $schema: z.literal(CACHE_SCHEMA_TAG),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    /** The layer whose workflows and scripts hold it. */
    instance: z.string().min(1),
    kind: CacheKindSchema,
    trustClass: TrustClassSchema,
    /** The key prefix, image, ref or path the entries live under. */
    location: z.string().min(1),
    keyRecipe: KeyRecipeSchema,
    /** What the key is a function of, in words — derived, never a hand glob list (a lock is allowed). */
    derivedInputs: z.string().min(1),
    holds: z.string().min(1),
    producer: z.string().min(1),
    /**
     * Who is known to read it, in words — INFORMATIVE. Which targets need a
     * cache is derived, never taken from here (owner, 2026-11-05: "not all
     * rendering/CI/merge processes need all caches"): a target needs it when
     * the target's recorded read set (the CI cone, the writer cone) touches
     * one of {@link materializes}, plus the `needs` closure of what it needs.
     */
    consumers: z.array(z.string().min(1)).min(1),
    /**
     * The paths a restore lays down (checkout-relative, or `~/` for the
     * home directory) — what lets a target's read set say it needs this
     * cache. Absent: no read set can name it, so a plan restores it only
     * through another cache's `needs`, or not at all (the safe direction:
     * the target builds).
     */
    materializes: z.array(z.string().min(1)).min(1).optional(),
    /**
     * Whether the producer reads MUTABLE STATE the tree does not pin — a
     * branch-kept graph (`state:mount`: the work plan `beans/`, `qa-reports`,
     * fsh-guts…). A producer that reads one must carry that ref's commit in
     * its key, or its entry is never current (#2966: the publish pages read
     * the work plan's finished instances, and a cache keyed on the tree
     * alone served a stale page). REQUIRED, so no node is silent on it:
     * - `none`: shown to read no state mount (by construction, or by a
     *   recorded read set that touches no state path);
     * - `keyed`: every state ref it reads is in the key (`refs`);
     * - `unkeyed`: it reads state the key does not carry — never current;
     * - `unmeasured`: not shown either way yet — never current.
     */
    stateInputs: z.discriminatedUnion("reads", [
      z.object({ reads: z.literal("none"), how: z.string().min(1) }).strict(),
      z.object({ reads: z.literal("keyed"), refs: z.array(z.string().min(1)).min(1), how: z.string().min(1) }).strict(),
      z.object({ reads: z.literal("unkeyed"), refs: z.array(z.string().min(1)).min(1).optional(), how: z.string().min(1) }).strict(),
      z.object({ reads: z.literal("unmeasured"), how: z.string().min(1).optional() }).strict(),
    ]),
    /** The ids of the caches this one is built over, so restores and refreshes go in order (`Process_Cache`). */
    needs: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).optional(),
    /**
     * How a stale entry is brought up to date: `incremental` (only what
     * changed — the changed writers, modules, layers or IG delta — over the
     * restored entry) or `whole`. A refresh never rebuilds wholesale when an
     * incremental one is valid (owner, 2026-11-05).
     */
    refresh: z.object({ mode: z.enum(["incremental", "whole"]), how: z.string().min(1) }).strict().optional(),
    savePolicy: z.string().min(1),
    /** How a restored entry is checked, or why it is not. */
    verify: z.string().min(1),
    budget: z.object({ maxBytes: z.number().int().positive().optional(), note: z.string().min(1).optional() }).strict().optional(),
    owner: z.string().min(1).optional(),
    uses: Uses,
    notes: z.string().min(1).optional(),
  })
  .strict();
export type Cache = z.infer<typeof CacheSchema>;

export const CacheInventoryEntrySchema = z
  .object({
    repo: z.string().min(1),
    id: z.string().min(1),
    kind: CacheKindSchema,
    locations: z.array(z.string().min(1)),
    key: z.string().nullable().optional(),
    restoreKeys: z.string().nullable().optional(),
    holds: z.string().optional(),
    producer: z.string().optional(),
    consumers: z.string().optional(),
    savePolicy: z.string().optional(),
    keyDerivation: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const CacheInventorySchema = z
  .object({
    $schema: z.literal(CACHE_INVENTORY_SCHEMA_TAG),
    /** When the snapshot was taken (ISO date) and how. A snapshot is never a declaration. */
    takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    method: z.string().min(1),
    repositories: z.array(z.string().min(1)).min(1),
    entries: z.array(CacheInventoryEntrySchema),
  })
  .strict();
export type CacheInventory = z.infer<typeof CacheInventorySchema>;

/** One stored-entry fact from the cache report, joined by the viewer (never kept in a node). */
export interface StoredFacts {
  key?: string;
  sizeBytes?: number;
  lastAccessedAt?: string;
  hitRate?: number;
  lastProducerRun?: string;
}

export type Staleness =
  | { state: "current"; key: string }
  | { state: "stale"; stored: string; implied: string }
  | { state: "undetermined"; why: string };

/**
 * Staleness, computed: the implied key against the stored key. Either side
 * unknown is `undetermined`, never `current`.
 */
/** Why a node's entry can never be current because of the state it reads, or undefined. */
export function stateBlocker(c: Pick<Cache, "stateInputs">): string | undefined {
  const s = c.stateInputs;
  if (s.reads === "unkeyed") return `its producer reads state the key does not carry${s.refs ? ` (${s.refs.join(", ")})` : ""}`;
  if (s.reads === "unmeasured") return "whether its producer reads a state branch is not measured yet";
  return undefined;
}

/**
 * Staleness, computed: the implied key against the stored key. Either side
 * that cannot be read is undetermined, and so is a node whose producer reads
 * state its key does not carry, or might ({@link stateBlocker}).
 */
export function nodeStaleness(c: Pick<Cache, "stateInputs">, implied: string | { undetermined: string }, stored: StoredFacts | undefined, prefix = ""): Staleness {
  const blocked = stateBlocker(c);
  if (blocked !== undefined) return { state: "undetermined", why: blocked };
  return staleness(implied, stored, prefix);
}

export function staleness(implied: string | { undetermined: string }, stored: StoredFacts | undefined, prefix = ""): Staleness {
  if (typeof implied !== "string") return { state: "undetermined", why: `the implied key: ${implied.undetermined}` };
  if (stored?.key === undefined) return { state: "undetermined", why: "no stored key read (the daily cache report supplies it)" };
  const want = `${prefix}${implied}`;
  return stored.key === want || stored.key.endsWith(implied) ? { state: "current", key: stored.key } : { state: "stale", stored: stored.key, implied: want };
}

/**
 * The two families as NODE KINDS, so `node-kinds:check` counts them kinded
 * (a new family may not join the unkinded baseline). Made from the strict
 * schemas' shapes, so the validator nodes that name these kinds judge a file
 * exactly as the schemas do.
 */
const { $schema: _cacheTag, ...cacheFields } = CacheSchema.shape;
const { $schema: _inventoryTag, ...inventoryFields } = CacheInventorySchema.shape;
// A versioned kind generates its own `$schema`, so the shapes are passed without theirs.
export const CacheKind = nodeKind(CACHE_SCHEMA_TAG, [], cacheFields, { strict: true });
export const CacheInventoryKind = nodeKind(CACHE_INVENTORY_SCHEMA_TAG, [], inventoryFields, { strict: true });

