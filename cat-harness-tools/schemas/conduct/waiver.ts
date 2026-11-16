/**
 * A confirmation the owner has given **in advance**, scoped and dated.
 *
 * Skill: [`confirmation-waiver`](../skills/conduct/conduct-core/confirmation-waiver.md).
 * A person may waive confirmation rights for a session or a process run; the
 * waiver is context-dependent and kept with memory.
 *
 * ## A kind of its own, not a memory label
 *
 * A waiver is `context` like `memory` — a running process READS it and no step
 * writes it — so it is declared over the same directory. It is a separate kind
 * because {@link MemoryNodeSchema} carries **no status by design**, and a
 * waiver's entire content is that it expires.
 *
 * ## Every field is required
 *
 * A waiver moves a decision from the agent to the person; each field closes
 * off a way to fake that move:
 *
 * - no `grantedBy` → an agent's own decision wearing a hat;
 * - no `quote` → the agent's paraphrase, which can widen a scope silently;
 * - no `gate` → a blanket permission nobody can audit;
 * - no `scope` → a grant that outlives the situation that justified it;
 * - no `expires` → indistinguishable from one nobody remembered to withdraw.
 *
 * So the schema has no `.optional()` anywhere, and a malformed waiver is not a
 * lenient waiver — it is **no waiver**, and the gate it named still stands.
 *
 * @graphNode schema
 * @module folio-assistant/schemas/waiver
 */

import { z } from "zod";

/**
 * The gates a waiver may relax.
 *
 * **This list is the vocabulary, and it is closed on purpose.** The skill
 * publishes the same table with the rule each row relaxes; a gate class that
 * is not here cannot be waived, which is what stops the vocabulary drifting
 * into "everything".
 *
 * What is deliberately ABSENT is as load-bearing as what is present: bean
 * deletion, and any rule whose text is *never*. A waiver relaxes a rule that
 * says **ask first**. A prohibition is not a confirmation the owner is owed,
 * so there is nothing there to give back — and for bean deletion the
 * non-destructive move (`scrapped`, with reasons) is always available.
 */
export const WAIVABLE_GATES = [
  "merge-to-main",
  "bean-close",
  "deletion",
  "swarm-spawn",
  "process-reentry",
  "issue-close",
] as const;
export type WaivableGate = (typeof WAIVABLE_GATES)[number];

/**
 * How far a waiver reaches.
 *
 * Three forms, and none of them is "always". `session:` and `process:` are the
 * two the owner named; `until:` is the general case they are both instances
 * of, kept because a grant over a working afternoon fits neither id.
 */
export const WaiverScopeSchema = z
  .string()
  .min(1)
  .regex(
    /^(session:[A-Za-z0-9_-]+|process:[A-Za-z0-9_.-]+|until:\d{4}-\d{2}-\d{2}T[\d:]+Z)$/,
    'a scope is "session:<id>", "process:<instance-id>" or "until:<ISO-8601 Z>"',
  )
  .describe('How far this waiver reaches: session:<id>, process:<instance-id>, or until:<ISO-8601>');

/** One waiver node, under the `memory/waivers/` part of the memory directory. */
export const WaiverNodeSchema = z
  .object({
    /** Tag identifying the file's contract, per the directory conventions. */
    $schema: z.literal("folio-waiver/v1"),
    /** Node id — the file's basename. */
    id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "an id is lowercase alphanumerics and hyphens"),
    /** The person granting it, by the identity this repository already knows them by. */
    grantedBy: z.string().min(1),
    /**
     * The grantor's **own words**, verbatim.
     *
     * Not a summary. The agent's paraphrase is the thing under suspicion here:
     * a reader auditing the grant has only this string to check the scope
     * against, and a tidied one can be wider than what was said.
     */
    quote: z.string().min(1),
    /** Which gate is waived. Never "everything" — see {@link WAIVABLE_GATES}. */
    gate: z.enum(WAIVABLE_GATES),
    /** How far it reaches. */
    scope: WaiverScopeSchema,
    /** When it was granted (ISO 8601). */
    grantedAt: z.string().min(1),
    /** When it stops applying (ISO 8601). Required — see the module note. */
    expires: z.string().min(1),
    /**
     * Anything the grant carried that the gate needs to check against — a swarm's
     * agent count and model level, the issues an `issue-close` waiver names, the
     * artefact class a `deletion` waiver is limited to.
     *
     * Required, and an empty string is a legitimate value meaning *the gate
     * class alone bounds it*. Optional would let the narrowing be forgotten,
     * which is the one direction a waiver must never drift.
     */
    bounds: z.string(),
  })
  .strict()
  .describe("A confirmation granted in advance, scoped and expiring.");
export type WaiverNode = z.infer<typeof WaiverNodeSchema>;

/**
 * Is this waiver still in force at `now`?
 *
 * Returns a THREE-state answer, not a boolean, and the third is the one that
 * gets skipped: a clock or a timestamp that cannot be read is not "expired"
 * and not "in force" — it is unknown, and an unknown waiver has not waived
 * anything. The gate asks.
 */
export function waiverState(w: WaiverNode, now: Date): "in-force" | "expired" | "unknown" {
  const t = Date.parse(w.expires);
  if (Number.isNaN(t)) return "unknown";
  return t > now.getTime() ? "in-force" : "expired";
}
