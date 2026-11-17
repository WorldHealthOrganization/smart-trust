/**
 * `computation-witness/v1` — the runtime schema for a folio's
 * `<name>.witness.json`: the record a computation writes of what it computed,
 * with what, and whether its assertions held.
 *
 * @module schemas/computation-witness
 * @graphNode schema
 *
 * ## Two schemas
 *
 * Most existing witnesses do not meet the producer contract (missing
 * `engine` or `assertions`, a boolean `auditOnly`, non-numeric assertion
 * values), so the module describes both what is and what is meant:
 *
 * - {@link ComputationWitnessSchema} — the **envelope**: what every witness
 *   actually is. Every field optional and typed as the corpus types it, so a
 *   field that IS present cannot be the wrong shape. This is the kind's
 *   validator; a file it rejects is malformed, not merely unconventional.
 * - {@link ComputationWitnessConformanceSchema} — the **contract**: what a
 *   producer is meant to write. A file the envelope accepts and this rejects
 *   is a FINDING against its producer, reported by
 *   `scripts/witness-conformance.ts` and never repaired by editing the
 *   witness, which is generator output.
 *
 * Neither changes a witness: a witness's numbers are never edited.
 *
 * ## No reliable `$schema` tag
 *
 * Few witnesses carry a `$schema`, and not in one spelling. So the kind names
 * one `validator` rather than per-tag `nodeSchemas`, and a reader selects
 * witnesses by the `.witness.json` suffix ({@link WITNESS_SUFFIX}).
 */
import { z } from "zod";

/** Number or string: a value serialised from arbitrary precision is a string. */
const Scalar = z.union([z.number(), z.string()]);

/**
 * An assertion as the corpus writes it. `computed` and `expected` are
 * `unknown` because the corpus holds every JSON type there, booleans and
 * lists most of all; narrowing them would reject a measurement for its type.
 */
export const WitnessAssertionSchema = z
  .object({
    name: z.string().optional(),
    computed: z.unknown().optional(),
    expected: z.unknown().optional(),
    passed: z.boolean().nullable().optional(),
    tolerance: z.union([Scalar, z.null()]).optional(),
    unit: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
  })
  .passthrough();

const OptString = z.string().nullable().optional();

/** The envelope: every witness on disk. See the module doc. */
export const ComputationWitnessSchema = z
  .object({
    // Any string: 22 qou witnesses carry one of seven spellings, six naming the
    // witness schema by URL or path and one (`q-usage-audit/v1`) another family.
    $schema: z.string().optional(),
    // A string, except in two witnesses that record a structured engine.
    engine: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
    engineVersion: OptString,
    computedAt: OptString,
    commitSha: OptString,
    scriptFile: OptString,
    scriptHash: OptString,
    scriptCommitSha: OptString,
    name: OptString,
    description: OptString,
    contentBlock: OptString,
    // A string (the audit doc it reports to) in 620 witnesses, a boolean in 144.
    auditOnly: z.union([z.string(), z.boolean()]).nullable().optional(),
    durationMs: z.number().nullable().optional(),
    allPassed: z.boolean().nullable().optional(),
    // A list of assertion objects (three witnesses list a bare string among
    // them), or, in 46 witnesses, an object keyed by assertion name.
    assertions: z
      .union([z.array(z.union([WitnessAssertionSchema, z.string()])), z.record(z.string(), z.unknown())])
      .optional(),
    caveats: z.unknown().optional(),
    parameters: z.unknown().optional(),
    data: z.unknown().optional(),
    precisionMetadata: z.unknown().optional(),
  })
  .passthrough();
export type ComputationWitnessFile = z.infer<typeof ComputationWitnessSchema>;

/**
 * The engines the contract names. A finding, not a fault, when a witness uses
 * another: the corpus spells combinations freely (`sympy+mpmath`,
 * `python-exact`), and whether to fold those into this list is a decision
 * about the vocabulary rather than about any one witness.
 */
export const CONTRACT_ENGINES = [
  "snappea",
  "snappy",
  "sympy",
  "mpmath",
  "sage",
  "python",
  "numpy",
  "scipy",
  "closed-form",
  "python+mpmath",
  "python+numpy+cvxpy",
] as const;

/**
 * The contract: what a producer is meant to write. Ported unchanged in
 * substance from qou's `@litlfred/witness-schema` 0.1.1, so this measures the
 * corpus against the shape its own authors declared rather than one invented
 * here.
 */
export const ComputationWitnessConformanceSchema = z
  .object({
    engine: z.enum(CONTRACT_ENGINES),
    engineVersion: z.string(),
    computedAt: z.string(),
    assertions: z.array(
      z
        .object({
          name: z.string(),
          computed: Scalar,
          expected: Scalar,
          passed: z.boolean().optional(),
          tolerance: Scalar.optional(),
          unit: z.string().optional(),
          source: z.string().optional(),
        })
        .passthrough(),
    ),
    commitSha: z.string().optional(),
    scriptCommitSha: z.string().optional(),
    scriptHash: z.string().optional(),
    scriptFile: z.string().optional(),
    auditOnly: z.string().optional(),
    allPassed: z.boolean().optional(),
  })
  .passthrough();

/** The file suffix every witness producer writes. */
export const WITNESS_SUFFIX = ".witness.json";

/**
 * Fields that change on every run of an unchanged producer — commit, timing
 * and environment — and so carry no information about what it COMPUTED.
 *
 * Masked at every depth when deciding whether a re-run reproduced a witness.
 * The list is litlfred/qou's `_EPHEMERAL_META_FIELDS` (`qou_substrate.witness`),
 * where it was settled one field at a time against real reds (`elapsed_s`,
 * owner ruling 2026-09-05), adopted here unchanged so the platform and the
 * producer library agree on what "the same witness" means. `environment` is
 * masked for the comparison and READ separately, because a witness computed
 * under different package versions is not a reproduction test at all.
 */
export const WITNESS_EPHEMERAL_FIELDS: ReadonlySet<string> = new Set([
  "commitSha",
  "scriptCommitSha",
  "computedAt",
  "durationMs",
  "durationSeconds",
  "duration_sec",
  "environment",
  "elapsed_seconds",
  "elapsed_sec",
  "elapsed_s",
]);

/** A copy of `node` with every {@link WITNESS_EPHEMERAL_FIELDS} key removed, at every depth. */
export function stripEphemeral(node: unknown, extra: ReadonlySet<string> = new Set()): unknown {
  if (Array.isArray(node)) return node.map((n) => stripEphemeral(n, extra));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!WITNESS_EPHEMERAL_FIELDS.has(k) && !extra.has(k)) out[k] = stripEphemeral(v, extra);
    }
    return out;
  }
  return node;
}
