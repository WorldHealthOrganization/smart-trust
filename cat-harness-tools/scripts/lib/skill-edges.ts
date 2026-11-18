/**
 * The two list-valued edges a skill's front matter may carry under the
 * 2026-10-16 lane / role / skill model: `uses-methodology:` and `tested-by:`.
 *
 * Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling",
 * implementation spec §2 and §4):
 *
 * - **`uses-methodology:`** — Skill → Methodology, the viewer thread's edge
 *   (litlfred/cat-harness#325, `schemas/process/methodology.ts`). The DEPENDENT node
 *   names the general one: the skill names the methodology, the methodology
 *   names no skill. Same direction as task → skill.
 * - **`tested-by:`** — a CONTRACT skill names its tests: repo-relative paths
 *   to test files or checks. The widened definition of Skill — *"a responsibility
 *   an Actor carries out to complete a Task: as natural-language instructions
 *   to follow, as a contract to be tested against, or both"* — is what makes a
 *   data store's or a registry's Role a real Role, and `tested-by` is how a
 *   reader tells a contract that is checked from one that is only written down.
 *
 * Both are READ WHEN PRESENT AND SHOWN AS NOTHING WHEN ABSENT. Neither key is
 * required, and an absent key is not an empty list: the reader here returns
 * `undefined` for "the skill does not say", so a consumer cannot mistake
 * silence for a declared "none".
 *
 * Spelled here as well as in cat-harness until this layer's pin of cat-harness
 * exports the field names — the same arrangement as `USES_METHODOLOGY` in
 * `check-methodology-evidence.ts` on the viewer thread's branch (#422).
 *
 * @module scripts/lib/skill-edges
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { isSkillMd, skillMdDirs } from "../known-skills.ts";

/** Skill → Methodology, cat-harness `schemas/process/methodology.ts` (#325). */
export const USES_METHODOLOGY = "uses-methodology";
/** A contract skill's tests, implementation spec §4. */
export const TESTED_BY = "tested-by";

/** What one skill's front matter says about the two edges. `undefined` = not said. */
export interface SkillEdges {
  usesMethodology?: string[];
  testedBy?: string[];
}

/** The YAML between the opening and closing `---`, or undefined. */
function frontMatterBlock(text: string): string | undefined {
  if (!text.startsWith("---")) return undefined;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return undefined;
  return text.slice(text.indexOf("\n", 3) + 1, end + 1);
}

/** A string or list of strings → the list; anything else → undefined. */
function stringList(v: unknown): string[] | undefined {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
  return undefined;
}

/**
 * The two edges from one skill file's text. Pure. Unparseable front matter
 * yields `{}` — that is the skill gates' finding, not this reader's.
 */
export function skillEdgesOf(text: string): SkillEdges {
  const fm = frontMatterBlock(text);
  if (fm === undefined || (!fm.includes(USES_METHODOLOGY) && !fm.includes(TESTED_BY))) return {};
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = parseYaml(fm) as Record<string, unknown> | undefined;
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object") return {};
  const uses = stringList(parsed[USES_METHODOLOGY]);
  const tested = stringList(parsed[TESTED_BY]);
  return { ...(uses !== undefined ? { usesMethodology: uses } : {}), ...(tested !== undefined ? { testedBy: tested } : {}) };
}

/**
 * skill name → its edges, over every skill file each root declares. A skill
 * that says neither is absent from the map. The first root to hold a name
 * wins, in the order given — callers pass the layer roots they already
 * resolve skills against.
 */
export function skillEdgeIndex(roots: readonly string[]): Map<string, SkillEdges> {
  const out = new Map<string, SkillEdges>();
  const seen = new Set<string>();
  for (const root of roots) {
    let dirs: string[][];
    try {
      dirs = skillMdDirs(root);
    } catch {
      continue;
    }
    for (const parts of dirs) {
      const dir = join(root, ...parts);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).sort()) {
        const abs = join(dir, f);
        if (!f.endsWith(".md") || seen.has(abs) || !isSkillMd(abs)) continue;
        seen.add(abs);
        const name = f.slice(0, -3);
        if (out.has(name)) continue;
        const edges = skillEdgesOf(readFileSync(abs, "utf-8"));
        if (edges.usesMethodology !== undefined || edges.testedBy !== undefined) out.set(name, edges);
      }
    }
  }
  return out;
}
