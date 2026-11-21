#!/usr/bin/env ts-node
/**
 * @module generate-schemas
 * @description Generates JSON Schema files from Zod schemas.
 *
 * Reads all Zod schemas from schemas/constraints.ts and writes
 * corresponding JSON Schema files to schemas/generated/.
 *
 * Usage: bun run cat-harness-tools/scripts/generate-schemas.ts
 */

import { namedJsonSchema } from "../schemas/kg/to-json-schema.ts";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  ActorDefinitionSchema,
  CapabilityDefinitionSchema,
  SkillDefinitionSchema,
  RequirementSchema,
  SkillRegistrySchema,
  RoleAssignmentSchema,
  DockerRequirementsSchema,
  SkillPackageManifestSchema,
  SkillCapabilityRefSchema,
  SkillDependencySchema,
  RequirementStatementSchema,
  RequirementStatementRefSchema,
  SessionHookSchema,
  HookCommandSchema,
  SkillPackageRefSchema,
  RemotePackageRefSchema,
  RemoteSyncConfigSchema,
} from "../schemas/constraints.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
// declared-path-literal: bean 70lx — this was a self-relative URL; the code moved to cat-harness-tools and the content it names did not
const outDir = join(HARNESS_ROOT, "schemas", "generated");

mkdirSync(outDir, { recursive: true });

const schemas = {
  "ActorDefinition": ActorDefinitionSchema,
  "CapabilityDefinition": CapabilityDefinitionSchema,
  "SkillDefinition": SkillDefinitionSchema,
  "SkillCapabilityRef": SkillCapabilityRefSchema,
  "SkillDependency": SkillDependencySchema,
  "Requirement": RequirementSchema,
  "RequirementStatement": RequirementStatementSchema,
  "RequirementStatementRef": RequirementStatementRefSchema,
  "SkillRegistry": SkillRegistrySchema,
  "SkillPackageRef": SkillPackageRefSchema,
  "SessionHook": SessionHookSchema,
  "HookCommand": HookCommandSchema,
  "RoleAssignment": RoleAssignmentSchema,
  "DockerRequirements": DockerRequirementsSchema,
  "SkillPackageManifest": SkillPackageManifestSchema,
  "RemotePackageRef": RemotePackageRefSchema,
  "RemoteSyncConfig": RemoteSyncConfigSchema,
};

console.log("Generating JSON Schemas...\n");

for (const [name, schema] of Object.entries(schemas)) {
  const jsonSchema = namedJsonSchema(schema, name);

  const filePath = join(outDir, `${name}.schema.json`);
  writeFileSync(filePath, JSON.stringify(jsonSchema, null, 2) + "\n");
  console.log(`  ✓ ${name}.schema.json`);
}

console.log(`\nGenerated ${Object.keys(schemas).length} JSON Schema files in schemas/generated/`);
