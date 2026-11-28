#!/usr/bin/env bun
/**
 * Materialise every directory this layer declares or inherits.
 *
 * The CLI face of {@link materialiseDeclaredDirectories}. Run by
 * `scripts/session-start-coord-sweep.sh` and by `init-folio`, so that a
 * declared directory exists in every checkout. A declared-but-absent
 * directory is where a consumer scans nothing and reports a clean run (e.g. a
 * missing `library/` reads as "nobody has ingested anything").
 *
 *     bun run cat harness:dirs            # create what is missing
 *     bun run cat harness:dirs --check    # report only; exit 1 if anything is missing
 *
 * @module scripts/harness-dirs
 * @covers cat-harness
 */

import { resolve } from "node:path";
import {
  checkoutRootFor,
  materialiseDirectories,
  readDeclaration,
  resolveDirectories,
  type ResolvedDirectory,
} from "../schemas/kg/cat-harness.ts";
import { declarationChain } from "../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * Why a repository-scoped entry this harness declares is NOT this checkout's,
 * or `undefined` when it is (cat-harness-tools#1701).
 *
 * cat-harness declares checkout-level directories (`checkout-uploads` at
 * `uploads/`) because "the index root declares no instance, so the instance
 * that owns the harness owns the checkout-level graphs". In a checkout whose
 * ROOT is itself an instance (an IG repository that is its own index, e.g.
 * smart-ips-pilgrimage) that premise is false: the root owns its checkout's
 * directories, and one it does not declare is not this harness's to demand.
 * The index (no root declaration) and a standalone harness (the harness IS
 * the root) are judged exactly as before.
 */
export function notThisCheckouts(dir: ResolvedDirectory, harnessRoot: string): string | undefined {
  if (dir.scope !== "repository") return undefined;
  // A branch-kept entry is never created here anyway (the materialiser skips
  // content off the checkout); `state:mount` reports its absence.
  if ((dir as { source?: { kind?: string } }).source?.kind === "branch") return undefined;
  const checkout = resolve(checkoutRootFor(harnessRoot));
  if (checkout === resolve(harnessRoot)) return undefined;
  let rootDecl: ReturnType<typeof readDeclaration>;
  try {
    rootDecl = readDeclaration(checkout);
  } catch {
    return undefined; // an unreadable root declaration determines nothing
  }
  if (!rootDecl) return undefined;
  const claimed = resolveDirectories([{ name: rootDecl.name, root: checkout, own: true }]).some(
    (d) => resolve(d.absPath) === resolve(dir.absPath),
  );
  if (claimed) return undefined;
  return `the checkout's root instance ${rootDecl.name} owns its checkout-level directories and declares none at ${dir.path}; declare it at the root to keep it here`;
}

if (import.meta.main) {
const root = resolve(HARNESS_ROOT);
const check = process.argv.includes("--check");

const dirs = resolveDirectories(declarationChain(root));
const excused = new Map<ResolvedDirectory, string>();
for (const d of dirs) {
  const why = notThisCheckouts(d, root);
  if (why) excused.set(d, why);
}
const results = materialiseDirectories(dirs.filter((d) => !excused.has(d)), root, { dryRun: check });
for (const [d, why] of excused) {
  console.log(`  · ${d.path.replace(/\/+$/, "")} (repo) ${d.declaredBy}: not applicable here — ${why}`);
}
if (results.length === 0) {
  // Third state, reported as itself. No declaration is legitimate — an
  // unmigrated layer falls back to today's conventions — and must not be
  // rendered as "all directories present".
  console.log(
    "harness dirs: this instance declares no directories (no <name>.json, " +
      "or it declares none). Nothing to materialise; not the same as nothing missing.",
  );
  process.exit(0);
}

const missing = results.filter((r) => r.created);
for (const r of results) {
  // The DECLARED path plus its scope, not `relative(root, absPath)`: that
  // renders a repository-scoped entry as `../beans`, which reads as a
  // traversal somebody wrote rather than as the name `beans/` under the root
  // the declaration names.
  const where = r.path.replace(/\/+$/, "") || ".";
  const scope = r.scope === "repository" ? " (repo)" : "";
  const state = r.created ? (check ? "MISSING" : "created") : "ok";
  const marker = r.markerWritten ? "  +keep-marker" : "";
  console.log(`  ${state.padEnd(8)} ${(where + scope).padEnd(22)} ${r.declaredBy}${marker}`);
}

console.log(
  `\nharness dirs: ${results.length} declared, ${missing.length} ${
    check ? "missing" : "created"
  }${excused.size ? `, ${excused.size} not applicable here` : ""}.`,
);
if (check && missing.length > 0) process.exit(1);
}
