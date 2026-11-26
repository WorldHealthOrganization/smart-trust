#!/usr/bin/env ts-node
/**
 * @module generate-registry
 * @description Scans .claude/skills/ and skills/ directories to produce a unified SkillRegistry.
 *
 * Outputs:
 *   - .claude/skills/registry.json
 *
 * Usage: bun run cat-harness-tools/scripts/generate-registry.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ActorDefinition, CapabilityDefinition, HookCommand, Requirement, RoleAssignment,
  SessionHook, SkillDefinition, SkillRegistry,
} from "../schemas/conduct/assistant-types.ts";
import type { SkillPackageManifest } from "../schemas/kg/skill-package.ts";
import { kgRoots } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { actorsDir, capabilitiesDir } from "../schemas/process/role-graph.ts";
import { skillDefinitionDirs } from "../schemas/kg/skill-definitions-dir.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * The declared knowledge-graph root, or the convention.
 *
 * declared-path-literal: the fallback is at the call site so the choice is
 * visible. `kgRoots()` returns a LIST because a topical layout has several;
 * this site wants one directory, and takes the first, which is the layer's
 * own root in every layout shipped so far.
 */
function kgRoot(root: string): string {
  return kgRoots(root)[0] ?? join(root, "skills");
}


// `.claude/skills/` and `skills/` are PLATFORM directories, so rooting at this
// file's own location is right here — unlike the content pipeline, which must
// find the folio.
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * TWO roots, because this script reads from both and they stopped being one
 * directory with the move (bean `wggr`).
 *
 * `.claude/` and `package.json` belong to the REPOSITORY. The knowledge graph
 * and `skills/requirements/` belong to the LAYER. A sweep that moved the
 * single `rootDir` to the repository root got the first three right and made
 * the registry scan for skill packages one level above them — it emitted ZERO
 * packages where six exist, and "no packages" is a plausible-looking answer.
 */
const instanceDir = join(HARNESS_ROOT);
const rootDir = repoRootFor(instanceDir);

/**
 * The registry, plus the generation stamp that is not part of the schema.
 *
 * This used to be a parallel hand-written interface whose six collections were
 * all `any[]`. Two things went wrong behind that. It omitted
 * `roleAssignments` — a required field of `SkillRegistry`, with a populated
 * `.claude/scenarios/role-assignments.json` sitting on disk that nothing
 * loaded, so every generated registry claimed the repo had no role rules at
 * all. And `hooks` was emitted in the shape of raw `.claude/settings.json`
 * entries rather than `SessionHook`, so `commands[]` held
 * `{matcher, hooks[]}` objects instead of `HookCommand`s and `matcher` was
 * never set. Naming the real type is what makes both impossible.
 */
type RegistryOutput = SkillRegistry & { generatedAt: string };

function loadJsonFiles<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), "utf-8")) as T;
      } catch {
        console.warn(`  ⚠ Failed to parse ${join(dir, f)}`);
        return null;
      }
    })
    .filter((x): x is T => x !== null);
}

/**
 * Role-assignment rules, highest priority first.
 *
 * The file holds `{ assignments: [...] }`; a bare array is also accepted so a
 * hand-written file in either shape loads.
 */
function loadRoleAssignments(): RoleAssignment[] {
  const p = join(rootDir, ".claude", "scenarios", "role-assignments.json");
  if (!existsSync(p)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    const list: RoleAssignment[] = Array.isArray(raw)
      ? raw as RoleAssignment[]
      : (raw as { assignments?: RoleAssignment[] }).assignments ?? [];
    return [...list].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  } catch {
    console.warn(`  ⚠ Failed to parse ${p}`);
    return [];
  }
}

function loadPackageManifests(): SkillPackageManifest[] {
  const skillsDir = kgRoot(instanceDir);
  if (!existsSync(skillsDir)) return [];
  // Topic-aware (bean `9umr`): a package may sit one level down, inside a
  // topic `skills/skills.json` declares.
  return packageDirsIn(skillsDir)
    .map(d => {
      const manifestPath = join(d.dir, "package-manifest.json");
      if (!existsSync(manifestPath)) return null;
      try {
        return JSON.parse(readFileSync(manifestPath, "utf-8")) as SkillPackageManifest;
      } catch {
        console.warn(`  ⚠ Failed to parse ${manifestPath}`);
        return null;
      }
    })
    .filter((x): x is SkillPackageManifest => x !== null);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("Generating skill registry...\n");

const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")) as { name?: string };

const registry: RegistryOutput = {
  schemaVersion: "1.0",
  repository: pkg.name || "folio-assistant",
  generatedAt: new Date().toISOString(),
  actors: loadJsonFiles<ActorDefinition>(actorsDir(rootDir) ?? (() => { throw new Error("the platform declares no `scenarios` graph, so the actor registry (bean rqao) has no home to read"); })()),
  capabilities: loadJsonFiles<CapabilityDefinition>(capabilitiesDir(rootDir) ?? (() => { throw new Error("the platform declares no `scenarios` graph, so the capability registry (bean rqao) has no home to read"); })()),
  skills: skillDefinitionDirs(rootDir).flatMap((d) => loadJsonFiles<SkillDefinition>(d)),
  requirements: loadJsonFiles<Requirement>(join(instanceDir, "skills", "requirements")),
  packages: loadPackageManifests(),
  hooks: [],
  roleAssignments: loadRoleAssignments(),
};

// Load hooks from settings if they exist
const settingsPath = join(rootDir, ".claude", "settings.json");
if (existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      hooks?: Record<string, Array<{ matcher?: string; hooks?: HookCommand[] }>>;
    };
    if (settings.hooks) {
      // `.claude/settings.json` nests one level deeper than `SessionHook`:
      //   { "<Event>": [ { matcher?, hooks: [ {type, command, timeout?} ] } ] }
      // The old mapping wrapped that middle object straight into
      // `commands[]`, so the registry advertised `HookCommand`s that were
      // really `{matcher, hooks}` records, and dropped `matcher` entirely.
      registry.hooks = Object.entries(settings.hooks).flatMap(
        ([event, entries]) => (Array.isArray(entries) ? entries : [entries]).map((entry) => ({
          event: event as SessionHook["event"],
          matcher: entry?.matcher,
          commands: (Array.isArray(entry?.hooks) ? entry.hooks : []) as HookCommand[],
        })),
      );
    }
  } catch {
    console.warn("  ⚠ Failed to parse .claude/settings.json");
  }
}

const outDir = join(rootDir, ".claude", "skills");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "registry.json"), JSON.stringify(registry, null, 2) + "\n");

console.log(`  ✓ .claude/skills/registry.json`);
console.log(`    Actors: ${registry.actors.length}`);
console.log(`    Capabilities: ${registry.capabilities.length}`);
console.log(`    Skills: ${registry.skills.length}`);
console.log(`    Requirements: ${registry.requirements.length}`);
console.log(`    Packages: ${registry.packages.length}`);
console.log(`    Hooks: ${registry.hooks.length}`);
console.log(`    Role assignments: ${registry.roleAssignments.length}`);
console.log("\nDone.");
