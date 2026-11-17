/**
 * smart-base's Tool nodes — the `tools` graph for the WHO SMART base layer.
 *
 * @module smart-base/tools
 * @graphNode tool
 *
 * ## Declared here, executed upstream
 *
 * The capabilities `WorldHealthOrganization/smart-base` hosts are declared
 * here, where the harness can bind and audit them, so that repository can
 * become an ordinary FHIR IG. A Tool node is a declaration — what the
 * capability is, what it consumes and produces, which skill it satisfies and
 * how it is invoked. The upstream code is not vendored
 * ([`smart-base-tools`](../../smart-base/skills/content/authoring-who-smart-guidelines/smart-base-tools.md)).
 *
 * ## Two tools are deliberately absent
 *
 * `strip_library_binaries.py` and `strip_library_content.py` are not
 * DAK-specific (any IG depending on `hl7.fhir.uv.cql` produces oversized
 * `Library` resources), so by
 * [`smart-stack-layering`](../../smart-base/skills/content/authoring-who-smart-guidelines/smart-stack-layering.md)
 * they are fhir-harness's `strip-library-binaries` and
 * `strip-library-content`.
 *
 * ## `install: { none: true }`
 *
 * Every Tool here except `immz-schedule-app-local` runs a script already on
 * disk (upstream Python in the checkout at `SMART_BASE_HOME` or in `input/`,
 * or bun scripts under `smart-base/scripts/`), and says so explicitly: nothing
 * to install, as distinct from an unfinished record.
 *
 * ## One Tool per folder
 *
 * Each Tool is declared in `<id>/<id>.ts` beside this file, with its scripts
 * and tests when they are its alone; this file only loads the folders
 * (`toolsFromFolders`, which holds the folder = file = id convention).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { declarationPathIn, toolsFromFolders, type ToolDefinition } from "../platform/index.js";

/** The LAYER root — `<repo>/smart-base`, where `smart-base.json` lives. */
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

export { SMART_PUBLISHER_SITE_REPOS, smartSiteRepoArgs } from "./lib.ts";

export function tools(baseUrl?: string): ToolDefinition[] {
  return toolsFromFolders(dirname(fileURLToPath(import.meta.url)), baseUrl ?? decl().canonicalUrl ?? "");
}
