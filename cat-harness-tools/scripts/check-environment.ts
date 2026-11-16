#!/usr/bin/env bun
/**
 * Is this checkout's ENVIRONMENT telling the truth about the repository?
 *
 * Every gate here answers a question about what the repository contains. This
 * script answers a prior one: *could any answer be trusted at all?* — because a
 * tool that resolves a module, walks a directory or counts a corpus reads the
 * filesystem, and the filesystem holds things the repository does not.
 *
 * ## What it detects
 *
 * Residue the repository does not contain that distorts a reading:
 *
 * - a `node_modules` or `dist` inside a package (e.g.
 *   `block-qa-schema/node_modules`), counted as phantom KG nodes;
 * - a SYMLINKED root `node_modules`, which hands `gitCorpus` phantom paths;
 * - a nested REAL `node_modules`, so root `tsc` resolves a different SDK.
 *
 * The last is a TRAP: a stale nested lockfile can only be fixed by
 * `bun install` **in that directory**, and that install is what creates the
 * distortion.
 *
 * ## Exit codes — this is a THIRD STATE, never a finding
 *
 *     0  the environment matches what the repository declares
 *     2  distorted: a reading taken now cannot be trusted
 *
 * **There is deliberately no exit 1.** A distortion is not a defect in this
 * repository's source: a gate that cannot run must not read as green, nor as
 * a finding. `gates.ts` consults this BEFORE running anything and refuses the
 * whole run, since results computed against a lying filesystem look like
 * evidence.
 *
 * ## A precondition, not one of the gates
 *
 * CI installs only from the repository root, so this condition cannot arise
 * there and a workflow step could never fire. It is exempt in
 * `SCRIPT_EXEMPTIONS` with that reason rather than wired into a workflow to
 * satisfy `check:unrun-scripts`.
 *
 * ```sh
 * bun run cat check:environment          # 0 clean, 2 distorted
 * ```
 *
 * @covers schemas
 * @graphNode tool
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { HARNESS_ROOT } from "./lib/roots.ts";

const REPO = resolve(dirname(HARNESS_ROOT));

/** One way the filesystem disagrees with the repository. */
export type Distortion = {
  /** Repository-relative path of the residue. */
  path: string;
  /** What a tool reading it would get wrong. */
  effect: string;
  /** The bean that measured this shape. */
  bean: string;
};

/**
 * Directories never descended into.
 *
 * The root `node_modules` is EXCLUDED FROM THE WALK rather than reported: it is
 * what the repository declares, and every nested `node_modules` inside it is its
 * own business. Walking it would also report thousands of paths and take long
 * enough that nobody would run this.
 */
// input-site: inert #72110b80 — names a build-output directory only to leave it out of a walk
const SKIP = new Set(["node_modules", ".git", ".lake", "_kg", "dist", ".bun"]);

/**
 * Every `node_modules` under `root` that is not `root/node_modules`.
 *
 * Bounded: the walk never enters a `node_modules` it finds, so the cost is the
 * repository's own directory count and not the dependency tree's.
 */
export function nestedNodeModules(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable is not a distortion; it is nothing to say
    }
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const p = join(dir, e.name);
      if (e.name === "node_modules") {
        if (p !== join(root, "node_modules")) found.push(p);
        continue; // never descend into one
      }
      if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
      walk(p, depth + 1);
    }
  };
  walk(root, 0);
  return found.sort();
}

/**
 * What a nested install actually changes, read from the package rather than assumed.
 *
 * Reporting "there is a node_modules here" is a shape; reporting WHICH version of
 * a shared dependency it shadows is the thing that lets a reader connect it to the
 * 12 errors. `3vc1`'s cause was `@modelcontextprotocol/sdk` resolving to 1.28.0
 * nested against the root's hoisted 1.30.0 — established from that package's own
 * `package.json`, which is why this looks there too.
 */
export function shadowedPackages(nested: string, root: string): string[] {
  const out: string[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(nested, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .flatMap((e) =>
        e.name.startsWith("@")
          ? readdirSync(join(nested, e.name), { withFileTypes: true })
              .filter((s) => s.isDirectory())
              .map((s) => `${e.name}/${s.name}`)
          : [e.name],
      );
  } catch {
    return out;
  }
  for (const name of names) {
    const here = version(join(nested, name));
    const there = version(join(root, "node_modules", name));
    if (here && there && !sameApiLine(here, there)) {
      out.push(`${name} ${here} here vs ${there} at the root`);
    }
  }
  return out.sort();
}

/**
 * Are two versions close enough that a typecheck cannot tell them apart?
 *
 * ## Why MAJOR.MINOR, and why this line is evidence rather than principle
 *
 * The first version of this compared versions for EQUALITY, and that was a false
 * positive — caught by running it, not by reasoning about it. Bean `3vc1`'s own fix
 * regenerated `adapters/mcp-server`'s stale lockfile, which took the nested SDK from
 * 1.28.0 to 1.30.1 against the root's 1.30.0. Root `tsc` then reported **0 errors**
 * while this guard still said DISTORTED and refused every gate run.
 *
 * Two measurements, and they bracket the line:
 *
 * | nested vs root | differs at | root `tsc --noEmit` |
 * |---|---|---|
 * | 1.28.0 vs 1.30.0 | **minor** | **12 errors in 6 files** |
 * | 1.30.1 vs 1.30.0 | **patch** | **0 errors** |
 *
 * So major-only would have missed the case this guard exists for, and exact equality
 * refuses a harmless tree. Major.minor is the only line the evidence supports.
 *
 * **Stated as a heuristic, because it is one.** Whether a version difference changes
 * a typecheck cannot be known without typechecking twice, which is the thing this
 * runs BEFORE. A patch release that changed a type would slip past — and that is the
 * failure this accepts in exchange for not refusing a correctly set-up checkout,
 * which is the worse of the two and was measured: the equality version blocked
 * `bun run cat gates` on a tree whose typecheck was clean.
 *
 * A malformed version is treated as NOT matching, so an unreadable pair is reported
 * rather than waved through — `could not tell` belongs on the refusing side here,
 * because the alternative is a silent pass.
 */
function sameApiLine(a: string, b: string): boolean {
  const line = (v: string): string | undefined => {
    const m = /^(\d+)\.(\d+)\./.exec(v.trim());
    return m ? `${m[1]}.${m[2]}` : undefined;
  };
  const la = line(a);
  const lb = line(b);
  if (la === undefined || lb === undefined) return false;
  return la === lb;
}

/** A package's declared version, or `undefined` if it cannot be read. */
function version(pkgDir: string): string | undefined {
  try {
    const raw = readFileSync(join(pkgDir, "package.json"), "utf-8");
    return (JSON.parse(raw) as { version?: string }).version;
  } catch {
    // Absent or unparseable is not a distortion — it is nothing to say. A
    // comparison needs BOTH versions, and `shadowedPackages` drops the pair.
    return undefined;
  }
}

/**
 * Does any `.ts` under `dir` (excluding installs) import `name`?
 *
 * ## Why the predicate is IMPORTS and not "there is a nested install"
 *
 * A first version of this script reported every nested `node_modules` as a
 * distortion, and that is **wrong** — measured before it shipped, which is the
 * only reason it is not in the history. `cat-harness/schemas/block-qa-schema`
 * is a declared sub-package with its OWN `bun.lock` and `package.json`, so its
 * `node_modules` is the expected result of installing it. Refusing on that would
 * have blocked every local gate run in a correctly set-up checkout: a far worse
 * defect than the one this guards.
 *
 * "Inside the root `tsconfig.json`'s `include`" does not discriminate either.
 * BOTH directories are inside it — `cat-harness/adapters/**` and
 * `cat-harness/schemas/**` — and only one causes errors.
 *
 * What discriminates is measured:
 *
 * | nested install | shadows | its sources import it? | root `tsc` |
 * |---|---|---|---|
 * | `adapters/mcp-server` | `@modelcontextprotocol/sdk` 1.28.0 vs 1.30.0 | **yes**, 4+ files | **12 errors in 6 files** |
 * | `schemas/block-qa-schema` | `typescript` 7.0.2 vs 6.0.3, `commander` | **no** | 0 errors |
 *
 * So a nested install matters exactly when the sources beside it import a package
 * it resolves differently from the root. Anything else is a sub-package doing what
 * it is declared to do, and saying so would be noise that trains a reader to
 * ignore this check.
 */
export function importsPackage(dir: string, name: string): boolean {
  const pattern = new RegExp(`(from|import|require\\()\\s*\\(?["'\`]${name.replace(/[/@.]/g, "\\$&")}(/|["'\`])`);
  const walk = (d: string, depth: number): boolean => {
    if (depth > 6) return false;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || SKIP.has(e.name) || e.name.startsWith(".")) continue;
        if (walk(p, depth + 1)) return true;
        continue;
      }
      if (!e.name.endsWith(".ts") && !e.name.endsWith(".tsx")) continue;
      try {
        if (pattern.test(readFileSync(p, "utf-8"))) return true;
      } catch {
        /* unreadable is nothing to say */
      }
    }
    return false;
  };
  return walk(dir, 0);
}

/**
 * In a git worktree or regular checkout, find the parent checkout root.
 * Returns undefined if not in a git repository or if git rev-parse fails.
 */
function commonRepoRoot(root: string): string | undefined {
  try {
    const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf-8" });
    if (c.status !== 0) return undefined;
    const gitDir = c.stdout.trim();
    if (!gitDir) return undefined;
    const base = gitDir.endsWith("/.git") ? gitDir.slice(0, -5) : gitDir.endsWith("/.git/") ? gitDir.slice(0, -6) : dirname(gitDir);
    return realpathSync(base);
  } catch {
    return undefined;
  }
}

/**
 * Every distortion in this checkout, or `[]` when the environment is honest.
 *
 * A nested install that shadows nothing its own sources import is NOT returned —
 * see {@link importsPackage} for the measurement that settled the predicate.
 */
export function distortions(root: string): Distortion[] {
  const out: Distortion[] = [];

  // `qook`: a SYMLINKED root `node_modules` made `gitCorpus` hand every consumer
  // a path that is not in the repository. Checked with `lstat`, because `stat`
  // follows the link and reports the directory it points at — which is exactly
  // the substitution being looked for.
  //
  // However, check:merged creates a throwaway worktree and symlinks the parent checkout's
  // node_modules into it by design to avoid a second install. An internal symlink whose
  // target resolves within the parent repository checkout is permitted (owner ruling 2026-10-07).
  const rootModules = join(root, "node_modules");
  if (existsSync(rootModules)) {
    try {
      if (lstatSync(rootModules).isSymbolicLink()) {
        const target = realpathSync(rootModules);
        const parentRoot = commonRepoRoot(root);
        const isInternal = parentRoot && (target === join(parentRoot, "node_modules") || target.startsWith(parentRoot + "/"));
        if (!isInternal) {
          out.push({
            path: "node_modules",
            effect:
              "the root `node_modules` is a SYMLINK pointing outside this repository checkout, so any tool that resolves a real path through it reports a location this repository does not contain",
            bean: "qook",
          });
        }
      }
    } catch {
      /* unreadable is nothing to say */
    }
  }

  // `3vc1`: a nested install whose shadowed packages are IMPORTED by the sources
  // beside it. The version pair is reported because the shape alone does not tell
  // a reader why a typecheck moved.
  for (const nested of nestedNodeModules(root)) {
    const owner = dirname(nested);
    const harmful = shadowedPackages(nested, root).filter((line) =>
      importsPackage(owner, line.split(" ")[0]!),
    );
    if (harmful.length === 0) continue;
    out.push({
      path: relative(root, nested),
      effect:
        `a nested install shadows ${harmful.length} package(s) that the sources beside it IMPORT — ` +
        `${harmful.slice(0, 3).join("; ")}${harmful.length > 3 ? "; …" : ""}`,
      bean: "3vc1",
    });
  }

  return out;
}

if (import.meta.main) {
  const found = distortions(REPO);
  if (found.length === 0) {
    // Says what was CHECKED, not "clean". There may well be a nested install
    // here — `schemas/block-qa-schema` is a declared sub-package and has one —
    // and claiming "no nested install" would be false. What is asserted is the
    // narrower, true thing: none of them shadows a package its own sources import.
    const nested = nestedNodeModules(REPO).map((n) => relative(REPO, n));
    console.log(
      `✓ environment is not distorting a reading — root \`node_modules\` is a real ` +
        `directory, and ${nested.length} nested install(s) shadow nothing their own sources import` +
        (nested.length ? `:\n${nested.map((n) => `    · ${n}`).join("\n")}` : ""),
    );
    process.exit(0);
  }
  console.error("could not determine: this checkout's environment is DISTORTED.\n");
  for (const d of found) {
    console.error(`  ✗ ${d.path}`);
    console.error(`      ${d.effect}`);
    console.error(`      measured on bean \`${d.bean}\``);
  }
  console.error(
    "\nA reading taken now is not about this repository. Move the residue aside and\n" +
      "re-run — and note that for a nested install this is a TRAP rather than a\n" +
      "mistake: regenerating a nested lockfile REQUIRES `bun install` in that\n" +
      "directory, so doing the correct thing is what created this. Bean `3vc1`.\n" +
      "\nThis is exit 2, not 1: nothing here is a finding about the source.",
  );
  process.exit(2);
}
