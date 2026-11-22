/**
 * cat-harness-tools' own Tool nodes — the `tools` graph of the implementation
 * layer.
 *
 * @module cat-harness-tools/tools
 * @graphNode tool
 *
 * Reached through tool auto-discovery ({@link ./discover.ts}), never by an
 * import, like every other layer's `tools` graph.
 *
 * A Tool whose `invoke.inProcess.module` is code in THIS layer is declared
 * here, beside that code, so its module path is instance-relative and names
 * no directory outside this layer (`check:import-direction` would refuse
 * one that did). Tools invoked by shell (`bun run cat-harness-tools/scripts/…`)
 * stay declared in cat-harness: a command line is not a module path.
 *
 * Each Tool is declared in `<id>/<id>.ts` beside this file, with its scripts
 * and tests when they are its alone; this file only loads the folders
 * (`toolsFromFolders`, which holds the folder = file = id convention).
 */
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { declarationPathIn } from "../schemas/kg/cat-harness.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";
import { toolsFromFolders } from "../schemas/tools/tool-folders.js";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { hostSchemaBase } from "../scripts/lib/host-schema.ts";

/**
 * The base the I/O type IRIs are minted against when the caller names none:
 * the HARNESS's declared `canonicalUrl`, because the tool-type vocabulary is
 * the harness's and is published once, under its own directory at its base
 * (`hostSchemaBase`, #676) — the same answer `discover.ts` passes every
 * layer's `tools()`. An empty base would mint relative IRIs, which the
 * Tool schema refuses at load (measured standalone).
 */
function harnessBase(): string {
  const p = declarationPathIn(HARNESS_ROOT);
  if (p === undefined || !existsSync(p)) return "";
  try {
    return hostSchemaBase((JSON.parse(readFileSync(p, "utf-8")) as { canonicalUrl?: string }).canonicalUrl ?? "");
  } catch {
    return "";
  }
}

export function tools(baseUrl?: string): ToolDefinition[] {
  return toolsFromFolders(dirname(fileURLToPath(import.meta.url)), baseUrl ?? harnessBase());
}
