#!/usr/bin/env bun
/**
 * Every artefact a Tool claims to maintain is actually in the published tree.
 *
 * @module scripts/check-maintained-artefacts
 *
 * `maintains` on a Tool node asserts the Tool is authoritative for a
 * **published** artefact. `kg:schema:check` reconciles only claims whose Tool
 * invokes `bun run cat kg:schema`; this checks every claim against the
 * assembled `_site/`. It reads the tree the workflow built rather than
 * building its own.
 *
 * - **present** — the artefact is a file in the tree. The claim holds.
 * - **absent** — it is not (exit 1).
 * - **could not determine** — there is no tree to look in (exit 2, not a pass).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-maintained-artefacts.ts ./_site
 *   bun run cat check:maintained-artefacts -- ./_site
 */
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { tools } from "../tools/discover.js";

/** One claim, and whether the tree bears it out. */
export interface ArtefactCheck {
  tool: string;
  artefact: string;
  source: string;
  present: boolean;
}

/**
 * Check every `maintains` claim against a built tree.
 *
 * Takes the directory rather than finding it, so a caller in a workflow and a
 * caller in a test exercise the same code path.
 */
export function checkMaintainedArtefacts(siteDir: string): ArtefactCheck[] {
  const out: ArtefactCheck[] = [];
  for (const t of tools()) {
    for (const m of t.maintains ?? []) {
      const p = join(siteDir, m.artefact);
      // A directory is not an artefact: `maintains.artefact` names a document a
      // consumer dereferences, and a directory at that path would serve an index
      // or a 404 depending on the host. Treated as absent so the claim is
      // reported rather than passing on a coincidence of the filesystem.
      const present = existsSync(p) && statSync(p).isFile();
      out.push({ tool: t.id, artefact: m.artefact, source: m.source, present });
    }
  }
  return out.sort((a, b) => a.artefact.localeCompare(b.artefact));
}

function main(): void {
  const dir = process.argv[2];
  if (dir === undefined) {
    console.error("usage: check-maintained-artefacts <built-site-dir>");
    console.error("  Nothing was checked. That is `could not determine`, not a pass.");
    process.exit(2);
  }
  const siteDir = resolve(dir);
  if (!existsSync(siteDir) || !statSync(siteDir).isDirectory()) {
    console.error(`could not determine: ${dir} is not a directory.`);
    console.error("  Assemble the site first. An unbuilt tree clears nothing.");
    process.exit(2);
  }

  const checks = checkMaintainedArtefacts(siteDir);
  if (checks.length === 0) {
    // Vacuity guard, the same one the workflow-yaml suite carries: a green run
    // over zero rows reads as coverage that is not there.
    console.error("could not determine: no Tool node declares `maintains`.");
    console.error("  Either the graph lost its declarations or this is reading the wrong one.");
    process.exit(2);
  }

  const missing = checks.filter((c) => !c.present);
  for (const c of checks) {
    console.log(`  ${c.present ? "✓" : "✗"} ${c.artefact}  (${c.tool} ← ${c.source})`);
  }
  if (missing.length > 0) {
    console.error(`\n✗ ${missing.length} of ${checks.length} maintained artefact(s) are not in the tree:`);
    for (const c of missing) {
      console.error(
        `  · ${c.artefact}\n` +
          `      Tool "${c.tool}" claims it, produced from ${c.source}, and the built site does not carry it.\n` +
          `      Either the build stopped writing it — a 404 for every consumer following the claim — or the\n` +
          `      claim names the wrong path. Fix the build, or fix the declaration; do not drop the claim to\n` +
          `      silence this.`,
      );
    }
    process.exit(1);
  }
  console.log(`\n✓ all ${checks.length} maintained artefact(s) present in the built tree`);
}

if (import.meta.main) main();
