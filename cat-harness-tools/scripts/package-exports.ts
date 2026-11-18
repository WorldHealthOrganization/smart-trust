#!/usr/bin/env bun
/**
 * A package's `exports` are DERIVED from the `code` subgraphs it declares and
 * ships, so another layer can import this one by package name.
 *
 * @covers cat-harness, code — it derives a package's `exports` from the `code` directories its declaration names, and judges `package.json` against them
 * @module scripts/package-exports
 *
 * ## The rule
 *
 * A directory this layer declares with graph typology `code` (top level or
 * from within, through `instanceDirectories`) is a named subgraph of code. A
 * subpath `./<dir>/*` is exported exactly when `<dir>/` is
 *
 * 1. declared with graph typology `code`, and
 * 2. SHIPPED: named in `package.json` `files`.
 *
 * The second condition keeps tests private without a list of exceptions:
 * `test/` is declared code and is not shipped, so it is not exported. Each
 * directory gets the pair `cat-harness`'s own package uses —
 * `./<dir>/*.js` → `./<dir>/*.ts` (so a `.js` specifier finds the source) and
 * `./<dir>/*` → `./<dir>/*`.
 *
 * Keys without a `*` are NAMED entry points (`.`, `./server`, …). They stay
 * hand-written — a name is a choice, not a fact a declaration holds — and this
 * script checks only that each one points into a declared `code` directory.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/package-exports.ts [--root <instance>]          # check
 *   bun run cat-harness-tools/scripts/package-exports.ts [--root <instance>] --write  # rewrite exports
 *
 * Exit codes: 0 in agreement · 1 drift (each difference named) · 2 cannot
 * tell (no declaration, no `package.json`, or no shipped `code` directory —
 * an empty set is a finding, never a pass).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { instanceDirectories } from "../schemas/kg/cat-harness.js";
import { TOOLS_ROOT } from "./lib/roots.ts";

/** `"src/"` for `"src"`, `"./src/"` and `"src/"` alike. */
function dirKey(p: string): string {
  return p.replace(/^\.\//, "").replace(/\/*$/, "/");
}

export interface ExportsReport {
  /** The `code` directories declared AND shipped — what is exported. */
  exported: string[];
  /** Declared `code` directories not in `files`, so deliberately not exported. */
  unshipped: string[];
  /** The `exports` object this rule gives, named entries first. */
  expected: Record<string, string>;
  /** Each difference from `package.json`, in words. Empty when they agree. */
  drift: string[];
}

/** Derive the expected `exports` of the package at `root` and compare it with the one written. */
export function packageExports(root: string): ExportsReport | { cannotTell: string } {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return { cannotTell: `no package.json at ${root}` };
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { exports?: Record<string, string>; files?: string[] };
  const dirs = instanceDirectories(root);
  if (dirs.length === 0) return { cannotTell: `no declared directory at ${root}` };

  const code = [...new Set(dirs.filter((d) => d.graphTypologies?.includes("code")).map((d) => dirKey(d.path)))].sort();
  const shipped = new Set((pkg.files ?? []).map(dirKey));
  const exported = code.filter((d) => shipped.has(d));
  const unshipped = code.filter((d) => !shipped.has(d));
  if (exported.length === 0) return { cannotTell: `no declared code directory is named in package.json files at ${root}` };

  const written = pkg.exports ?? {};
  const named = Object.entries(written).filter(([k]) => !k.includes("*"));
  const expected: Record<string, string> = Object.fromEntries(named);
  for (const d of exported) {
    expected[`./${d}*.js`] = `./${d}*.ts`;
    expected[`./${d}*`] = `./${d}*`;
  }

  const drift: string[] = [];
  for (const [k, v] of named) {
    if (!exported.some((d) => v.startsWith(`./${d}`)))
      drift.push(`named entry ${k} → ${v} is not inside a declared, shipped code directory`);
  }
  for (const [k, v] of Object.entries(expected)) {
    if (!k.includes("*")) continue;
    if (written[k] === undefined) drift.push(`missing ${k} → ${v}`);
    else if (written[k] !== v) drift.push(`${k} → ${written[k]}, expected ${v}`);
  }
  for (const k of Object.keys(written)) {
    if (k.includes("*") && expected[k] === undefined) drift.push(`${k} exports a directory that is not declared code and shipped`);
  }
  return { exported, unshipped, expected, drift };
}

/** Rewrite `package.json` `exports` in place, keeping every other key and its order. */
export function writePackageExports(root: string, expected: Record<string, string>): void {
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.exports = expected;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : TOOLS_ROOT);
  const r = packageExports(root);
  if ("cannotTell" in r) {
    console.error(`package-exports: cannot tell — ${r.cannotTell}`);
    process.exit(2);
  }
  if (argv.includes("--write")) {
    writePackageExports(root, r.expected);
    console.log(`package-exports: wrote ${r.exported.length} directories (${r.exported.join(", ")})`);
    process.exit(0);
  }
  if (r.drift.length > 0) {
    console.error(`package-exports: ${r.drift.length} difference(s) in ${join(root, "package.json")}:`);
    for (const d of r.drift) console.error(`  - ${d}`);
    console.error("Fix: bun run cat-harness-tools/scripts/package-exports.ts --write");
    process.exit(1);
  }
  console.log(`package-exports: ${r.exported.length} directories exported; not shipped, so not exported: ${r.unshipped.join(", ") || "none"}`);
}
