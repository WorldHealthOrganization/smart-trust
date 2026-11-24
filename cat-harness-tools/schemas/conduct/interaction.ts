/**
 * How a person wants to be asked — the `interaction` graph's one node kind.
 *
 * @module schemas/interaction
 * @graphNode schema
 * @covers none — a schema module, not a gate. `check:kind-validators` is what
 *   runs it, and this file is the thing it runs.
 *
 * `cat-harness/memory/interaction.json` is read at the start of every session
 * by `scripts/session-start-coord-sweep.sh` (jq), which on a parse failure
 * only prints a line — so a malformed node degrades silently. This schema is
 * what catches it.
 *
 * ## What is required
 *
 * A profile list is required and may be **empty** — an empty list is a person
 * who has said nothing, which differs from a person with no entry (the
 * `default` block carries that). `note` and `source` are optional.
 *
 * Unknown keys are ALLOWED (a non-strict object), on the rule `KgAssetSchema`
 * states: a downstream layer may carry a key this layer does not know yet.
 * Anything this layer relies on is named here.
 */
import { z } from "zod";

/** The `$schema` tag a node of this kind carries. */
export const INTERACTION_SCHEMA_TAG = "folio-interaction/v1";

/**
 * One person's preferences, or the fallback for somebody with no entry.
 *
 * The same shape for both, because they answer the same question at different
 * subjects — and a separate `default` shape would let the two drift, which is
 * how a fallback stops being a real answer.
 */
export const InteractionProfileSchema = z.object({
  /**
   * Other identities this person CHOOSES to publish — a login email, a second
   * handle. The entry's key is the GitHub handle (owner 2026-10-06: one person
   * may hold more than one Claude account, so no login email is an identity).
   */
  aliases: z.array(z.string()).optional(),
  /**
   * Named profiles, e.g. `low-dexterity`. Free strings on purpose: the
   * vocabulary is open and a closed enum here would reject a profile a
   * downstream layer has a name for and this layer does not.
   */
  profiles: z.array(z.string()),
  /** What the profile means for this person, in their terms or the agent's. */
  note: z.string().optional(),
  /** How it came to be known — `stated by the user`, a policy, an inference. */
  source: z.string().optional(),
});

export type InteractionProfile = z.infer<typeof InteractionProfileSchema>;

/** The whole node. */
export const InteractionNodeSchema = z.object({
  $schema: z.literal(INTERACTION_SCHEMA_TAG),
  /** Prose for a reader who opens the file; never read by a process. */
  $comment: z.string().optional(),
  /**
   * Keyed by GitHub handle (owner 2026-10-06); other identities go in each
   * entry's `aliases`. An email key from before still parses, and still
   * matches when it is the session's login.
   *
   * Required, and may be empty: a repository where nobody has stated anything
   * still HAS an interaction graph, and `{}` says so where an absent key would
   * be indistinguishable from a node that forgot to include it.
   */
  users: z.record(z.string(), InteractionProfileSchema),
  /** What to assume for somebody with no entry above. */
  default: InteractionProfileSchema.optional(),
});

export type InteractionNode = z.infer<typeof InteractionNodeSchema>;
