/**
 * The shape of `skills.json`, the labelling node that says which
 * subdirectories of a skills directory are TOPICS.
 *
 * @module schemas/skill-topics
 * @graphNode schema
 *
 * Its own module, depending on zod alone, because `scripts/skill-topics.ts`
 * parses with it and that is imported by `scripts/known-skills.ts` — a
 * schema file that pulled in `cat-harness.ts` would make the skill walk
 * import the whole declaration reader. Registered as the `skill-topics/v1`
 * family of the `skills` graph typology, so `check:kind-validators` grades the
 * committed file against the same schema the reader parses with.
 */
import { z } from "zod";

export const SKILL_TOPICS_TAG = "skill-topics/v1";

export const SkillTopicSchema = z
  .object({
    id: z.string().min(1),
    /** One plain segment: a topic is a direct subdirectory, never deeper. */
    path: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "one plain segment"),
    title: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

/**
 * A LAYER directory declared from inside `skills/` (bean `cmsl`, owner
 * 2026-09-30): `voices/`, or the science layer's `lean/`. The resolver in
 * `cat-harness.ts` promotes each to a directory of the layer, exactly as if
 * `<instance>.json` declared it. Only the fields that resolver needs are
 * required here — this module depends on zod alone (see above), so the full
 * `ContentDirectorySchema` stays in `cat-harness.ts` and the rest passes through.
 */
export const SkillsDirectoryEntrySchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    /**
     * Marks the entry as a subgraph of the LAYER rather than a part of the
     * skills graph. Replaced `dependents` on 2026-09-30 (option A), when
     * inheritance became automatic and the per-entry field was retired.
     */
    subgraph: z.literal(true),
    graphTypologies: z.array(z.string().min(1)).min(1),
  })
  .passthrough();

export const SkillTopicsSchema = z
  .object({
    $schema: z.literal(SKILL_TOPICS_TAG),
    _comment: z.string().optional(),
    topics: z.array(SkillTopicSchema),
    /** One node, two lists: the layer directories declared from within. */
    directories: z.array(SkillsDirectoryEntrySchema).optional(),
  })
  .strict();

export type SkillTopic = z.infer<typeof SkillTopicSchema>;
