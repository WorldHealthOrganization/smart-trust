/**
 * Which skills say a PERSON may invoke them — the list both the MCP prompts and
 * `.claude/commands/` are derived from.
 *
 * @module scripts/invocable-skills
 * @covers cat-harness
 *
 * The derivation reads skill front matter, so it is harness logic, imported by
 * `scripts/gen-skill-commands.ts` and by `skill-prompts.ts` (which only
 * registers the prompts on an MCP server).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { frontMatter, nodeSummary } from "./front-matter.js";
import { LOCAL_PACKAGES } from "./skill-packages.js";

/** A skill that declares `user_invocable: true`. */
export interface InvocableSkill {
  /** The declared `name:` — the command a person types. */
  name: string;
  /** The package `skill_fetch` serves it from. */
  packageName: string;
  /** Absolute path to the skill body. */
  path: string;
  /** The declared description, or the first heading; undefined when neither. */
  summary?: string;
}

export interface InvocableSkillList {
  skills: InvocableSkill[];
  /**
   * A name declared by more than one file. The first (by package, then file)
   * is served; the rest are reported, because a command that silently means
   * one of two skills is worse than a command that is missing.
   */
  duplicates: { name: string; paths: string[] }[];
}

/** True when the file's YAML front matter carries `user_invocable: true`. */
export function declaresUserInvocable(text: string): boolean {
  if (!text.startsWith("---")) return false;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return false;
  return /^user_invocable:\s*true\s*$/m.test(text.slice(3, end));
}

/**
 * Every `user_invocable` skill in the given packages, sorted by name.
 *
 * A file that declares `user_invocable: true` but no `name:` is skipped: the
 * name IS the command, and inventing one from the filename would be a command
 * nobody declared.
 */
export function userInvocableSkills(packages: Record<string, string> = LOCAL_PACKAGES): InvocableSkillList {
  const byName = new Map<string, InvocableSkill[]>();
  for (const packageName of Object.keys(packages).sort()) {
    const dir = packages[packageName];
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const path = join(dir, f);
      const text = readFileSync(path, "utf8");
      if (!declaresUserInvocable(text)) continue;
      const name = frontMatter(text).name;
      if (!name) continue;
      const entry = { name, packageName, path, summary: nodeSummary(text) };
      byName.set(name, [...(byName.get(name) ?? []), entry]);
    }
  }
  const skills: InvocableSkill[] = [];
  const duplicates: InvocableSkillList["duplicates"] = [];
  for (const [name, entries] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
    skills.push(entries[0]);
    if (entries.length > 1) duplicates.push({ name, paths: entries.map((e) => e.path) });
  }
  return { skills, duplicates };
}
