/**
 * Where the JSON workflow-skill definitions and the conventions live.
 *
 * They are split BY THEME across the harnesses that own the subject: WHO
 * SMART / FHIR in the DAK and FHIR IG layers, the content lifecycle and
 * document authoring in the content core, mathematical papers in the science
 * layer, BPMN/DMN authoring and the conventions in `cat-harness`. Each
 * layer keeps its own `skill-definitions/` inside a declared `skills`
 * directory, and every reader asks this module for all of them.
 *
 * @module schemas/skill-definitions-dir
 * @graphNode schema
 */
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { instanceDirectoriesForGraph, layerRootsIn, ownDirectoryById } from "./cat-harness.js";
import { layerRootNamed } from "./instance-roots";
import { CONVENTION_GROUP } from "../process/convention.js";

/** The subdirectory of a declared `skills` graph that holds JSON `SkillDefinition`s. */
export const SKILL_DEFINITIONS_DIRNAME = "skill-definitions";

/**
 * Every `skill-definitions/` directory in the checkout at `repoRoot`: a
 * declared `skills` directory named so, or one found inside a declared
 * `skills` directory. Sorted and de-duplicated; empty when none exists.
 */
export function skillDefinitionDirs(repoRoot: string): string[] {
  const out = new Set<string>();
  for (const root of layerRootsIn(repoRoot)) {
    // The declared `skills` directories, plus the conventional `skills/` a
    // layer declaring none still has (the DAK and science layers):
    // declaring `skills/skill-definitions/` there would nest one declared
    // directory inside the conventional one, which layout-norms refuses.
    const candidates = new Set([...instanceDirectoriesForGraph(root, "skills"), ownDirectoryById(root, "skills", "skills")]);
    for (const dir of candidates) {
      const clean = dir.replace(/\/+$/, "");
      if (basename(clean) === SKILL_DEFINITIONS_DIRNAME) {
        if (existsSync(clean)) out.add(resolve(clean));
      } else {
        const inner = join(clean, SKILL_DEFINITIONS_DIRNAME);
        if (existsSync(inner)) out.add(resolve(inner));
      }
    }
  }
  return [...out].sort();
}

/**
 * The conventions directory: `conventions/` in the platform's declared
 * `skills` graph, or `undefined` when there is none.
 */
export function conventionsDir(repoRoot: string): string | undefined {
  // The platform layer by its declaration, as role-graph.ts's
  // scenariosSubdir finds it (bean `uxn1`); its skills directory by id, since
  // several directories declare the `skills` kind.
  const platform = layerRootNamed(repoRoot, "cat-harness");
  if (platform === undefined) return undefined;
  const skills = ownDirectoryById(platform, "skills", "skills");
  const dir = join(skills, CONVENTION_GROUP);
  return existsSync(dir) ? dir : undefined;
}
