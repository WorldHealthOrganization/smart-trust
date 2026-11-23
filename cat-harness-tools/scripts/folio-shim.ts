/**
 * Bring a folio's builders shim up to the vocabularies its profile uses.
 *
 * The science layer's kinds (`definition`, `theorem`, `lemma`,
 * `proposition`, `corollary`, `conjecture`, `proof`) are typed, and built, by
 * its vocabulary module, not by cat-harness. A `folio/schema/builders.ts` that
 * re-exports only cat-harness's builders cannot find `theorem(…)`. This adds
 * the missing `export * from "…/<vocabulary module>"` lines and leaves every
 * other line as the folio's author left it (the shim says "Safe to edit; not
 * regenerated").
 *
 *   bun run cat folio:shim [--root <folio repo>]          # add what is missing
 *   bun run cat folio:shim:check [--root <folio repo>]    # report it, exit 1 if any
 *
 * Exit: 0 nothing missing (or added), 1 missing under --check, 2 could not
 * determine (no shim, a shim with no cat-harness re-export, no profile).
 *
 * @module scripts/folio-shim
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { folioDir } from "../schemas/kg/cat-harness.js";
import { readDeclaredFolioProfile } from "../pipeline/profile-check.ts";
import { missingReexports, shimAssistant } from "./lib/folio-shim.ts";

export interface ShimOutcome {
  state: "current" | "missing" | "updated" | "undetermined";
  shim: string;
  lines: string[];
  detail: string;
}

/** Check, or bring up to date, the shim of the folio at `root`. */
export function folioShim(root: string, opts: { check: boolean }): ShimOutcome {
  const shim = join(folioDir(root), "schema", "builders.ts");
  if (!existsSync(shim)) return { state: "undetermined", shim, lines: [], detail: "no builders shim here" };
  const text = readFileSync(shim, "utf-8");
  if (shimAssistant(text) === undefined) {
    return { state: "undetermined", shim, lines: [], detail: "the shim re-exports no cat-harness builders, so the platform path is unknown" };
  }
  const { profile, declaredBy } = readDeclaredFolioProfile(root);
  if (profile === undefined) return { state: "undetermined", shim, lines: [], detail: `no profile: ${declaredBy}` };
  const lines = missingReexports(text, profile);
  if (lines.length === 0) return { state: "current", shim, lines, detail: `${profile} profile (${declaredBy})` };
  if (opts.check) return { state: "missing", shim, lines, detail: `${profile} profile (${declaredBy})` };
  writeFileSync(shim, `${text.endsWith("\n") ? text : `${text}\n`}${lines.map((l) => `${l}\n`).join("")}`);
  return { state: "updated", shim, lines, detail: `${profile} profile (${declaredBy})` };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 ? argv[at + 1]! : process.cwd());
  const r = folioShim(root, { check: argv.includes("--check") });
  const said = r.lines.map((l) => `  ${l}`).join("\n");
  if (r.state === "undetermined") {
    console.log(`? ${r.shim}: could not determine — ${r.detail}`);
    process.exit(2);
  }
  if (r.state === "current") console.log(`✓ ${r.shim}: re-exports every vocabulary its ${r.detail} uses`);
  if (r.state === "updated") console.log(`✓ ${r.shim}: added, for its ${r.detail}:\n${said}`);
  if (r.state === "missing") {
    console.log(`✗ ${r.shim}: lacks, for its ${r.detail}:\n${said}\nRun: bun run cat folio:shim`);
    process.exit(1);
  }
}
