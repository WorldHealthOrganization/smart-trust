/**
 * User stories — what a reader acting in a role is trying to do.
 *
 * A story is told AS a role, so it points at the role and the role names no
 * story (data-modelling step 8).
 *
 * The file is `scenarios/stories.json`, beside `roles.json` in the same
 * `scenarios` graph — the kind the registry names for "Actors, the Roles they
 * take on, and the User Stories those Roles serve".
 *
 * @graphNode schema
 * @module schemas/user-story
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { RoleRefSchema, type RoleGraph } from "./role-graph";

/** The file holding a layer's user stories, inside its `scenarios` graph. */
export const USER_STORIES_FILENAME = "stories.json";

/** One user story: as <role>, I want <want>. */
export const UserStorySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "a story id is lower-case kebab"),
    /**
     * The role this story is told as.
     *
     * @ref RoleDefSchema
     */
    role: RoleRefSchema,
    /** What the reader wants to do, in their terms — "I want to …". */
    want: z.string().min(1),
    /** Why, when it is not obvious from the want — "so that …". */
    soThat: z.string().min(1).optional(),
  })
  .strict();
export type UserStory = z.infer<typeof UserStorySchema>;

export const UserStoryGraphSchema = z.object({
  name: z.string().min(1),
  stories: z.array(UserStorySchema).default([]),
});
export type UserStoryGraph = z.infer<typeof UserStoryGraphSchema>;

/**
 * Read `stories.json` from a `scenarios` directory.
 *
 * Absent → `undefined`. Unparseable, or a duplicate id → throws. `_`-prefixed
 * keys are documentation and are dropped, as in the role graph.
 */
export function readUserStories(scenariosDir: string): UserStoryGraph | undefined {
  const p = join(scenariosDir, USER_STORIES_FILENAME);
  if (!existsSync(p)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const top = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([k]) => !k.startsWith("_")),
  );
  const parsed = UserStoryGraphSchema.safeParse(top);
  if (!parsed.success) {
    throw new Error(`${p}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const seen = new Set<string>();
  for (const s of parsed.data.stories) {
    if (seen.has(s.id)) throw new Error(`${p}: story id "${s.id}" is declared twice`);
    seen.add(s.id);
  }
  return parsed.data;
}

/**
 * The stories whose role is not declared in `graph`.
 *
 * Only stories naming THIS layer's roles (no `instance`) are judged; a
 * story pointing into another layer is that layer's role graph's
 * question, and answering it from here would report a sibling's role as
 * missing.
 */
export function danglingStoryRoles(stories: UserStoryGraph, graph: RoleGraph): UserStory[] {
  const declared = new Set(graph.roles.map((r) => r.id));
  return stories.stories.filter((s) => s.role.instance === undefined && !declared.has(s.role.role));
}
