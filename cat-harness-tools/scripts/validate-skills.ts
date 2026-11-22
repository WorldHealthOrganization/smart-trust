#!/usr/bin/env ts-node
/**
 * @module validate-skills
 * @covers skills
 * @description Validates all skill package manifests against SkillPackageManifest schema,
 * and the actor, capability, requirement and skill-definition JSON files in
 * their declared homes against their respective schemas.
 *
 * Usage: bun run cat check:skills
 */

import type { z } from "zod";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { kgRoots } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { vacuityRefusal, type Source } from "./vacuity-refusal.ts";
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


import {
  SkillPackageManifestSchema,
  ActorDefinitionSchema,
  CapabilityDefinitionSchema,
  RequirementSchema,
  SkillDefinitionSchema,
} from "../schemas/kg/skill-package.js";
import { actorsDir, capabilitiesDir } from "../schemas/process/role-graph.js";
import { instanceDirectoriesForGraph, repoRootFor } from "../schemas/kg/cat-harness.js";
import { skillDefinitionDirs } from "../schemas/kg/skill-definitions-dir.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(HARNESS_ROOT);

let errors = 0;
let validated = 0;

/** Every place this gate looked, so a refusal can NAME them (`iym1`). */
const sources: Source[] = [];

function validateDir(dir: string, schema: z.ZodType<unknown>, label: string): void {
  const present = existsSync(dir);
  const files = present ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  sources.push({ label, dir, present, found: files.length });
  if (!present) return;
  for (const file of files) {
    const path = join(dir, file);
    try {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      schema.parse(data);
      console.log(`  ✓ ${label}/${file}`);
      validated++;
    } catch (e) {
      console.error(`  ✗ ${label}/${file}: ${e instanceof Error ? e.message : String(e)}`);
      errors++;
    }
  }
}

console.log("Validating skill framework files...\n");

// Validate actors
// From the DECLARED home (bean rqao). This read `<cat-harness>/.claude/skills/actors`,
// a directory that never existed, so it validated zero actors while reporting
// a clean run: the dh4f class. `repoRootFor(rootDir)` is the repository.
validateDir(
  actorsDir(repoRootFor(rootDir)) ?? (() => { throw new Error("the platform declares no `scenarios` graph, so the actor registry (bean rqao) has no home to read"); })(),
  ActorDefinitionSchema,
  "actors",
);

// Validate capabilities
validateDir(
  capabilitiesDir(repoRootFor(rootDir)) ?? (() => { throw new Error("the platform declares no `scenarios` graph, so the capability registry (bean rqao) has no home to read"); })(),
  CapabilityDefinitionSchema,
  "capabilities",
);

// Validate requirements
validateDir(
  join(kgRoot(rootDir), "requirements"),
  RequirementSchema,
  "requirements",
);

// Validate skill definitions.
//
// `.claude/skills/local/` was the one JSON directory this script's own
// docstring claimed to cover and did not, so a definition could name a
// nonexistent conformance keyword, a stray field, or a missing `roles` and
// nothing would say so until something tried to load it. Only `.json` here —
// the directory also holds `.md` instruction bodies, which `validateDir`
// already filters out.
// Split by theme across the layers that own them (bean `rqao`).
for (const dir of skillDefinitionDirs(rootDir)) {
  validateDir(dir, SkillDefinitionSchema, "skill-definitions");
}

// Validate skill package manifests
//
// Every skills graph the layer declares, its opt-in sub-graphs' included
// (cat-harness#991 step 23.2: `sdlc/skills/` and `work-plan/skills/` hold
// packages too). The convention only when nothing is declared.
const declaredSkillDirs = instanceDirectoriesForGraph(rootDir, "skills");
const skillsDirs = declaredSkillDirs.length > 0 ? declaredSkillDirs : [join(rootDir, "skills")];
for (const skillsDir of skillsDirs) {
  // Topic-aware (bean `9umr`): a package may sit one level down, inside a topic
  // `skills/skills.json` declares.
  const pkgDirs = packageDirsIn(skillsDir);
  sources.push({
    label: `packages (${relative(rootDir, skillsDir)})`,
    dir: skillsDir,
    present: existsSync(skillsDir),
    found: pkgDirs.filter((d) => existsSync(join(d.dir, "package-manifest.json"))).length,
  });
  if (!existsSync(skillsDir)) continue;
  for (const pkg of pkgDirs) {
    const manifestPath = join(pkg.dir, "package-manifest.json");
    const shown = relative(rootDir, manifestPath);
    if (existsSync(manifestPath)) {
      try {
        const data = JSON.parse(readFileSync(manifestPath, "utf-8"));
        SkillPackageManifestSchema.parse(data);
        console.log(`  ✓ ${shown}`);
        validated++;
      } catch (e) {
        console.error(`  ✗ ${shown}: ${e instanceof Error ? e.message : String(e)}`);
        errors++;
      }
    }
  }
}

console.log(`\nValidated: ${validated}, Errors: ${errors}`);

// Emptiness is checked BEFORE the error count, and exits 2 rather than 1: a run
// that examined nothing has not established that there are no errors, so
// reporting "0 errors" first would be answering a question it never asked. Exit
// 2 is this repository's "could not determine", distinct from 1 for "determined,
// and it is wrong" — the same split `check:bun-pin` and `check:red-gate-is-last`
// use for a scan that matched no site.
const refusal = vacuityRefusal({ script: "check:skills", covers: "skills" }, sources);
if (refusal !== undefined) {
  console.error(`\n${refusal}`);
  process.exit(2);
}

process.exit(errors > 0 ? 1 : 0);
