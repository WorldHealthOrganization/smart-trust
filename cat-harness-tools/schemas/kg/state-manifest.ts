#!/usr/bin/env bun
/**
 * The ROOT MANIFEST of a special branch — what the branch is, where it came
 * from, and whether it is the store or a copy.
 *
 * Every `state-manifest/v1` branch carries a root `manifest.json` stating the
 * facts a reader cannot recover from the branch's files: its status, the
 * commit it was seeded from, when, and how it is written. This is that field
 * set, so the branch README is RENDERED from it (`branch:readme`) rather than
 * kept by hand.
 *
 * ## Two shapes, discriminated by the keying
 *
 * | keyedBy | branches | carries |
 * |---|---|---|
 * | `tip` | beans, todos, fsh-guts, health, issue-marks, merge-queue, state | `subgraph`, `source {ref, sha}`, `seededAt`, `refreshedAt?`, `graphs[]` |
 * | `route` | uml-overview, ig-docs | `seededFrom`, `seededAt`, `writer`, `gate`, `bean`, `directories[]` |
 *
 * They differ because the WRITE differs (`subgraph-source.ts`): a tip-keyed
 * branch is somebody's state, seeded once from `main` and then edited; a
 * route-keyed one is regenerable output with one named generator and the gate
 * that checks it.
 *
 * `qa-reports` is commit-keyed and carries no manifest at all; it is not a
 * `state-manifest/v1` branch, and its README is rendered from its declaration
 * alone (see `branch:readme`).
 *
 * ## Extra keys are kept, not refused
 *
 * Both shapes are `passthrough`, so recorded notes such as a retired branch's
 * `retiredAt`, `retiredReason`, `supersededBy` and `_comment` entries
 * survive.
 *
 * @module cat-harness/schemas/state-manifest
 * @graphNode schema
 */
import { z } from "zod";

export const STATE_MANIFEST_TAG = "state-manifest/v1";

/** A git object name. Full length: a short sha is a guess about tomorrow's history. */
const Sha = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character git object name");
const When = z.string().min(1);

/**
 * What the branch is to its readers.
 *
 * - `active` — the store; read and written.
 * - `store` — the same, as `merge-queue` spells it. Kept as written rather than
 *   rewritten in a schema change: the manifest is on a branch other sessions
 *   write.
 * - `seed` — a copy taken ahead of a cutover; `main` is still the source.
 * - `retired` — kept as a record; nothing reads it.
 */
export const BranchStatusSchema = z.enum(["active", "store", "seed", "retired"]);
export type BranchStatus = z.infer<typeof BranchStatusSchema>;

export const TipManifestSchema = z
  .object({
    $schema: z.literal(STATE_MANIFEST_TAG),
    keyedBy: z.literal("tip"),
    status: BranchStatusSchema,
    /** True when THIS branch, not `main`, is where readers must look. */
    authoritative: z.boolean(),
    /** The subgraph it holds. Absent only on the retired multi-graph `state` branch. */
    subgraph: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    /** The commit the content was seeded from. */
    source: z.object({ ref: z.string().min(1), sha: Sha }).passthrough(),
    seededAt: When.optional(),
    refreshedAt: When.optional(),
    graphs: z.array(z.object({ path: z.string().min(1), tree: Sha.optional(), files: z.number().int().nonnegative().optional() }).passthrough()),
  })
  .passthrough();

export const RouteManifestSchema = z
  .object({
    $schema: z.literal(STATE_MANIFEST_TAG),
    keyedBy: z.literal("route"),
    status: BranchStatusSchema,
    authoritative: z.boolean(),
    seededFrom: Sha,
    seededAt: When,
    /** The ONE generator that writes it. */
    writer: z.string().min(1),
    /** The command that checks the generator's output. */
    gate: z.string().min(1),
    bean: z.string().min(1).optional(),
    directories: z.array(z.object({ id: z.string().min(1), path: z.string().min(1) }).passthrough()).min(1),
  })
  .passthrough();

export const StateManifestSchema = z.discriminatedUnion("keyedBy", [TipManifestSchema, RouteManifestSchema]);
export type StateManifest = z.infer<typeof StateManifestSchema>;
export type TipManifest = z.infer<typeof TipManifestSchema>;
export type RouteManifest = z.infer<typeof RouteManifestSchema>;
