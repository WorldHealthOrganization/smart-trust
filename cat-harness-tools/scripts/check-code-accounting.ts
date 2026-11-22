#!/usr/bin/env bun
/**
 * check-code-accounting.ts — the two questions about a code file, kept APART.
 *
 * A QA axis reports these SEPARATELY, never as one number:
 *
 * | | question | kind of property |
 * |---|---|---|
 * | **1** | is this file in a directory some layer DECLARES? | filesystem |
 * | **2** | is it reachable from a Tool node, and so from a process step? | graph |
 *
 * They fail independently and are fixed by different work: a file can sit in
 * a declared directory and be reachable from nothing, or be reachable from a
 * Tool in a directory no layer names. One percentage would be true of
 * neither, and a rise in one could hide a fall in the other.
 *
 * ## Question 1 has two readings
 *
 * *In a directory declared as `code`* is narrower than *in any declared
 * directory*. `cat-harness/schemas/` is declared as `schemas`, which is
 * correct for schema modules. So the question that matters is **accounted
 * for**, and `code` is one of several kinds that account for a file. Both
 * readings are printed, and must not be compared as one metric.
 *
 * ## Question 2 is a CLOSURE, not a count of entry points
 *
 * A Tool binds an entry point; everything that entry point imports rides
 * along. So the closure is walked — `import`/`export … from` over relative
 * specifiers — and the entry-point count is printed BESIDE it.
 *
 * The closure is a floor: a module reached by a bare specifier, a dynamic
 * `import()` or a path built at runtime is counted unreachable, which
 * under-claims rather than over-claims.
 *
 * ADVISORY. It reports; it does not fail.
 *
 * @module scripts/check-code-accounting
 * @covers code
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";

import { directoriesForGraph, layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";

/**
 * Every `.ts` under `root` that GIT accounts for, excluding dot directories.
 *
 * `xd1g`. This walked the filesystem behind a hand-written
 * `node_modules`-and-dot-directories skip list, so it counted build output as
 * repository source. Measured at the conversion: **1472 files before, 1471
 * after**, and the one it dropped is
 * `cat-harness/schemas/block-qa-schema/dist/index.d.ts` — a gitignored
 * `dist/`, being accounted for by the check whose subject is accounting for
 * code. Nothing was gained, so the change is a strict narrowing to the real
 * rule.
 *
 * The dot-directory rule is stated here rather than inherited: git's corpus
 * INCLUDES `.github/` and `.claude/`, so `gitFiles` deliberately does not fold
 * one in — see its docblock.
 */
export function typescriptFiles(root: string): string[] {
  return gitFiles(
    root,
    (rel) => rel.endsWith(".ts") && !rel.split("/").some((seg) => seg.startsWith(".")),
  ).files;
}

export interface DeclaredDirs {
  /** Absolute paths of every declared directory, whatever its kind. */
  any: string[];
  /** ...and the subset whose `graphTypologies` include `code`. */
  code: string[];
}

export function declaredDirectories(repoRoot: string): DeclaredDirs {
  const any: string[] = [];
  const code: string[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue; // `check:declaration-filename` is what reports an unreadable one
    }
    for (const e of decl?.directories ?? []) {
      const abs = resolve(root, e.path);
      any.push(abs);
      if ((e.graphTypologies ?? []).includes("code")) code.push(abs);
    }
  }
  return { any, code };
}

const under = (file: string, dirs: readonly string[]): boolean =>
  dirs.some((d) => file.startsWith(`${d}/`));

/**
 * Every `.ts` entry point a Tool node names, resolved through `package.json`.
 *
 * A Tool's `invoke.shell` is usually `bun run <script-name>`, and the script
 * resolves to a path — sometimes through another script. Following that chain
 * is what makes the count about CODE rather than about how a command happened
 * to be spelled; stopping at the script name would report the 20-odd tools
 * that name a path and miss the rest.
 */
export function toolEntryPoints(repoRoot: string): { shells: number; entries: string[] } {
  const pkgPath = join(repoRoot, "package.json");
  const scripts = existsSync(pkgPath) ? scriptsOf(repoRoot) : {};

  const shells: string[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    // ASKED OF THE DECLARATION, not composed. A layer says where its
    // `tools` graph lives, and `join(root, "tools")` would be this script
    // deciding that a second time — the literal `check:declared-paths`
    // refuses, and rightly: a layer that declared its tools elsewhere
    // would be silently skipped by a hardcoded path while this reported a
    // clean sweep over it.
    for (const dir of directoriesForGraph(root, "tools")) {
      const f = join(dir, "index.ts");
      if (!existsSync(f)) continue;
      for (const m of readFileSync(f, "utf8").matchAll(/shell:\s*"([^"]+)"/g)) shells.push(m[1]!);
    }
  }

  const entries = new Set<string>();
  const follow = (cmd: string, depth: number): void => {
    // A chain longer than this is a script calling itself, which is a defect
    // for another check; here it must simply terminate.
    if (depth > 6) return;
    for (const m of cmd.matchAll(/(?:^|&&|\|\||;)\s*bun run (?:cat )?([^\s&|;]+)/g)) {
      const token = m[1]!;
      if (token.endsWith(".ts")) entries.add(token);
      else if (scripts[token]) follow(scripts[token], depth + 1);
    }
  };
  for (const s of shells) follow(s, 0);
  return { shells: shells.length, entries: [...entries].sort() };
}

/**
 * Everything reachable from `entries` by static RELATIVE imports.
 *
 * A floor. See the module header: a bare specifier, a dynamic `import()` or a
 * runtime-built path is not followed, so a module reached only that way counts
 * as unreachable. Under-claiming is the safe direction for a coverage number.
 */
export function reachableFrom(repoRoot: string, entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const resolveSpec = (fromFile: string, spec: string): string | undefined => {
    if (!spec.startsWith(".")) return undefined;
    const base = resolve(dirname(fromFile), spec).replace(/\.js$/, "");
    for (const cand of [`${base}.ts`, join(base, "index.ts"), base]) {
      if (cand.endsWith(".ts") && existsSync(cand)) return cand;
    }
    return undefined;
  };
  const stack = entries.map((e) => resolve(repoRoot, e)).filter((f) => existsSync(f));
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) {
      const next = resolveSpec(file, m[1]!);
      if (next !== undefined && !seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

export interface Accounting {
  total: number;
  /** Q1, wide reading: in any declared directory. */
  declaredAny: number;
  /** Q1, narrow reading: in a directory declared `code`. */
  declaredCode: number;
  /** Q1 residue, grouped by the first two path segments. */
  unaccounted: { where: string; files: number }[];
  /** Q2. */
  toolShells: number;
  toolEntries: number;
  reachable: number;
}

export function audit(repoRoot: string): Accounting {
  const files = typescriptFiles(repoRoot);
  const dirs = declaredDirectories(repoRoot);
  const { shells, entries } = toolEntryPoints(repoRoot);
  const reach = reachableFrom(repoRoot, entries);

  const outside = files.filter((f) => !under(f, dirs.any));
  const grouped = new Map<string, number>();
  for (const f of outside) {
    const key = relative(repoRoot, f).split("/").slice(0, 2).join("/");
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return {
    total: files.length,
    declaredAny: files.filter((f) => under(f, dirs.any)).length,
    declaredCode: files.filter((f) => under(f, dirs.code)).length,
    unaccounted: [...grouped.entries()]
      .map(([where, n]) => ({ where, files: n }))
      .sort((a, b) => b.files - a.files),
    toolShells: shells,
    toolEntries: entries.length,
    reachable: files.filter((f) => reach.has(f)).length,
  };
}

const pct = (n: number, of: number): string => (of === 0 ? "n/a" : `${Math.round((n / of) * 100)}%`);

export function formatReport(a: Accounting): string {
  const out: string[] = [
    `Code accounting — ${a.total} .ts file(s). TWO questions, reported apart (bean \`ylj7\`).`,
    "",
    "  1. DECLARED — is the file in a directory some instance declares?",
    `       ${String(a.declaredAny).padStart(5)} in any declared directory   ${pct(a.declaredAny, a.total)}`,
    `       ${String(a.declaredCode).padStart(5)} in one declared \`code\`      ${pct(a.declaredCode, a.total)}`,
    `       ${String(a.total - a.declaredAny).padStart(5)} accounted for by nothing`,
  ];
  for (const g of a.unaccounted) out.push(`             ${String(g.files).padStart(4)}  ${g.where}`);
  out.push(
    "",
    "  2. REACHABLE — can a Tool node get to it, and so a process step?",
    `       ${String(a.toolShells).padStart(5)} Tool node(s) naming a command`,
    `       ${String(a.toolEntries).padStart(5)} distinct .ts entry point(s) they resolve to`,
    `       ${String(a.reachable).padStart(5)} file(s) reachable from one        ${pct(a.reachable, a.total)}`,
    "",
    "The two are NOT averaged, and must not be. They fail independently, they are",
    "fixed by different work, and a rise in one can hide a fall in the other —",
    "which is the defect `ylj7` was opened for.",
    "",
    "Question 2's figure is a FLOOR: the walk follows static relative imports only,",
    "so a module reached by a bare specifier, a dynamic import or a runtime path",
    "counts as unreachable. It under-claims rather than over-claims.",
  );
  return out.join("\n");
}

if (import.meta.main) {
  const repoRoot = resolve(repoRootFor(HARNESS_ROOT));
  const a = audit(repoRoot);
  console.log(process.argv.includes("--json") ? JSON.stringify(a, null, 2) : formatReport(a));
  // ADVISORY — see the module header. Both questions have open beans.
  process.exit(0);
}
