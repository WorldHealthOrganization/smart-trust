/**
 * The shape of a kind's FROM-WITHIN declaration file when it names concern
 * groups: `processes/processes.json`, `schemas/schemas.json`,
 * `library/library.json`, `uml/uml.json`, a test directory's `code.json`.
 *
 * @module schemas/concern-groups
 * @graphNode schema
 *
 * ## Codes, not restated labels
 *
 * A group is NAMED by its code from `code-lists/concern-group.json`, which
 * carries the title and definition once, and its directory is the code:
 * `processes/sdlc/`. Location is the grouping. (`skills/skills.json` keeps a
 * title and description per topic; other kinds do not restate them.)
 *
 * ## Two lists, one node — the `skills.json` shape
 *
 * `groups` names the concern groups; `directories` names LAYER
 * directories declared from within (`"subgraph": true`), which the resolver
 * in `cat-harness.ts` promotes exactly as it does for `skills.json`.
 *
 * Depends on zod alone, for the reason `skill-topics.ts` gives: the group
 * walker is imported by the skill walk, which must not pull in the whole
 * declaration reader.
 */
import { z } from "zod";

export const CONCERN_GROUPS_TAG = "concern-groups/v1";

/** A group's code: one plain segment, which is also its directory name. */
export const ConcernGroupCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "one plain segment");

export const ConcernGroupsSchema = z
  .object({
    $schema: z.literal(CONCERN_GROUPS_TAG),
    _comment: z.string().optional(),
    /** The concern groups this directory holds, by code; each is `<dir>/<code>/`. */
    groups: z.array(ConcernGroupCodeSchema),
    /** Layer directories declared from within, as in `skills.json`. */
    directories: z
      .array(
        z
          .object({
            id: z.string().min(1),
            path: z.string().min(1),
            subgraph: z.literal(true),
            graphTypologies: z.array(z.string().min(1)).min(1),
          })
          .passthrough(),
      )
      .optional(),
  })
  .strict();

export type ConcernGroups = z.infer<typeof ConcernGroupsSchema>;
