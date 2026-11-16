/**
 * The TOPIC level of a skills directory, and the one walk that honours it.
 *
 * @module scripts/skill-topics
 * @covers cat-harness
 *
 * A topic directory HOLDS packages — `skills/<topic>/<package>/`, e.g.
 * `skills/kg/graph-management/` — and `skills/skills.json` is the labelling
 * node that says which subdirectories are topics: nesting is described FROM
 * WITHIN, by a file in the directory whose children it names, never by the
 * root declaration reaching down a path it cannot verify.
 *
 * ## One walk, returning directories rather than packages
 *
 * Every caller that walks a skills directory uses this, so none can disagree
 * about which directories are topics. Callers do NOT agree on what makes a
 * package — one asks for a skill `.md`, another for `package-manifest.json` —
 * so this returns the CANDIDATE directories and each caller keeps its own
 * test.
 *
 * ## Declaration over location
 *
 * Only a subdirectory `skills.json` names is descended into. A directory that
 * merely looks like a topic (holds subdirectories, no skills) is not one. A
 * present but malformed `skills.json` throws, and so does a topic it names
 * that does not exist: a declared-but-absent directory is the defect, not a
 * no-op.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { SkillTopicsSchema, type SkillTopic } from "../schemas/kg/skill-topics.ts";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.ts";
import { groupedChildrenIn } from "./concern-groups.ts";

/**
 * The labelling node's file name, inside the skills directory it labels.
 *
 * ASKED OF THE KIND, like `BEAN_GRAPH_FILE`: the same file is the `skills`
 * kind's `declarationFile`, which the directory resolver reads for the
 * layer directories declared inside `skills/` (bean cmsl). One node with
 * two lists, `topics` here and `directories` there, and one place its name is
 * written.
 */
export const TOPICS_FILE = defaultGraphTypologies.get("skills")?.declarationFile ?? "skills.json";

export type { SkillTopic };

/** A candidate package directory, and where it sits. */
export interface PackageDir {
  /** The directory's basename — the package name `skill_fetch` takes. */
  name: string;
  /** Absolute path. */
  dir: string;
  /** Relative to the skills directory: `crdm`, or `kg/graph-management`. */
  rel: string;
  /** The topic it sits in, when it sits in one. */
  topic?: string;
}

/**
 * The topics `<skillsDir>/skills.json` declares; `[]` when there is no file.
 *
 * Throws on a malformed file, a topic whose path is not one plain segment, or
 * a topic whose directory does not exist.
 */
export function topicsOf(skillsDir: string): SkillTopic[] {
  const file = join(skillsDir, TOPICS_FILE);
  if (!existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${String(e)}`);
  }
  const result = SkillTopicsSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`${file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  return result.data.topics.map((t) => {
    const dir = join(skillsDir, t.path);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new Error(`${file}: topic "${t.id}" names ${t.path}/, which does not exist`);
    }
    return t;
  });
}

/**
 * Every candidate package directory under a skills directory: its direct
 * subdirectories that are not topics, and the subdirectories of each declared
 * topic. Sorted by `rel`, so every caller sees one order.
 */
export function packageDirsIn(skillsDir: string): PackageDir[] {
  if (!existsSync(skillsDir)) return [];
  // Validates this directory's own topics (throws on a declared-but-absent
  // one), then the ONE grouped walk every grouping kind shares (placement
  // PR0c): it also descends into a topic INHERITED from the same-named
  // `skills/` below, so core's `skills/library/` is a member of the harness's
  // `library` topic rather than a package called "library".
  topicsOf(skillsDir);
  return groupedChildrenIn(skillsDir, "skills").map((c) => ({
    name: c.name,
    dir: c.dir,
    rel: c.rel,
    ...(c.group === undefined ? {} : { topic: c.group }),
  }));
}
