/**
 * fhir-harness's Tool nodes — the `tools` graph for the bare FHIR IG layer.
 *
 * @module fhir-harness/tools
 * @graphNode tool
 *
 * ## Two build tools, and they are here because the layering rule put them here
 *
 * Both arrive from the WHO SMART Base IG repository's build labelled
 * **"DAK Postprocessing"**, and neither is DAK-shaped: ANY implementation
 * guide depending on `hl7.fhir.uv.cql` produces `Library` resources carrying
 * base64 payloads and inline CQL/ELM, and the same build's own
 * *"Delete files >100MB before deployment"* step is that concern one layer
 * down.
 *
 * The placement question in
 * [`smart-stack-layering`](https://github.com/litlfred/folio-assistant/blob/main/smart-base/skills/content/authoring-who-smart-guidelines/smart-stack-layering.md)
 * asks *would a non-WHO FHIR IG need this?*, and requires the answer to be
 * backed by naming one. It can be named, so they are here.
 *
 * **This file is the layering made real rather than asserted.** They were
 * described as belonging here in the previous round and still declared
 * nowhere — and a layer boundary that exists only in prose is one no
 * consumer can act on.
 *
 * ## What is NOT here, and must not drift in
 *
 * Nothing that knows about `dak.config.json`, a DAK name or label, or any
 * `smart.who.int` canonical. `ig-build-pipeline` carries the full refusal
 * list. A WHO reference added here fails no gate; it just quietly makes the
 * layer unusable for the non-WHO IG it exists for.
 *
 * ## One Tool per folder — bean `tdir`
 *
 * Each Tool is declared in `<id>/<id>.ts` beside this file, with its scripts
 * and tests when they are its alone; this file only loads the folders
 * (`toolsFromFolders`, which holds the folder = file = id convention).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolDefinition } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";
import { toolsFromFolders } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

/** The LAYER root — `<repo>/fhir-harness`, where `fhir-harness.json` lives. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function decl(): { canonicalUrl?: string } {
  const p = declarationPathIn(ROOT);
  if (p === undefined || !existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as { canonicalUrl?: string };
  } catch {
    return {};
  }
}

export function tools(baseUrl?: string): ToolDefinition[] {
  return toolsFromFolders(dirname(fileURLToPath(import.meta.url)), baseUrl ?? decl().canonicalUrl ?? "");
}
