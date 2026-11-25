/**
 * The test files a change can affect: every file `bun test` would run whose
 * relative-import closure holds a changed path.
 *
 * The pre-push hook runs these instead of the whole suite (owner,
 * 2026-11-05, "Affected tests only"; bean `folio-assistant-fn8q`). The whole
 * suite took 31 of the 55 minutes of a local fast-gate run on a 4-CPU agent
 * container, and CI runs it anyway, sharded, so nothing here replaces it.
 *
 * ## What the closure does NOT see, and why that is acceptable here
 *
 * A test reads the tree like a gate does (bean `4rbc`): fixtures, directory
 * walks and spawned scripts are inputs the import closure does not name. So a
 * change can redden a test this does not select. That is the trade the owner
 * chose: the hook catches the reds an import can explain, before the push,
 * and CI's whole suite catches the rest, after it. A selection is never
 * reported as the suite passing.
 *
 * ## When the answer is "all of them"
 *
 * A change to what every test runs under (the lockfile, a manifest, a bunfig,
 * a tsconfig, a test preload) can affect every test, so it selects them all,
 * and the hook leaves the suite to CI rather than run it for 30 minutes.
 *
 * A computed `import()` or an import that does not resolve is walked past:
 * the literal imports around it still count, and the edge it hides is CI's to
 * catch, like a fixture read. Selecting every test behind such a module was
 * tried first and measured useless (2026-11-05): a handful of hub modules put
 * 433 of 1533 test files behind one, so a one-line change to a Markdown file
 * selected 28% of the suite.
 *
 * Deliberately free of package imports, like the hook that calls it.
 *
 * @module scripts/affected-tests
 * @graphNode none — a helper of the pre-push hook, not a gate itself
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { directRelativeImports } from "./input-hash.ts";
import { TEST_FILE_RE } from "./input-sites.ts";

/** What `bun test` collects by default: `*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*`. One regex, `input-sites.ts`'s. */
export { TEST_FILE_RE };

/** Directories `bun test` does not reach in these checkouts, or that hold no source. */
// input-site: inert #01918c0a — names the build output directories the test walk skips; never reads them
const SKIP_DIRS = new Set(["node_modules", "build", "_site", "fsh-guts", "dist", "coverage"]);

/** Files every test runs under: a change to one of them can affect them all. */
const RUNTIME_FILES = new Set(["bun.lock", "bun.lockb", "package.json", "bunfig.toml", "tsconfig.json"]);

/** Every test file under `root`, repo-relative and sorted. */
export function testFilesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(abs);
      } else if (TEST_FILE_RE.test(e.name)) out.push(relative(root, abs));
    }
  };
  walk(root);
  return out.sort();
}

/** The `[test] preload` entries of `root/bunfig.toml`, repo-relative. */
export function testPreloads(root: string): string[] {
  const f = join(root, "bunfig.toml");
  if (!existsSync(f)) return [];
  const m = /^\s*preload\s*=\s*\[([^\]]*)\]/m.exec(readFileSync(f, "utf-8"));
  if (!m) return [];
  return [...m[1]!.matchAll(/["']([^"']+)["']/g)].map((x) => relative(root, resolve(root, x[1]!)));
}

export type Selection =
  | { kind: "some"; files: string[]; why: Record<string, string> }
  | { kind: "all"; why: string };

/**
 * The tests among `tests` that `changed` can affect. `changed` and the result
 * are repo-relative. Each selected file says why, so a run can be explained.
 */
export function affectedTests(root: string, changed: readonly string[], tests: readonly string[] = testFilesUnder(root)): Selection {
  const preloads = new Set(testPreloads(root));
  const runtime = changed.find((c) => RUNTIME_FILES.has(basename(c)) || preloads.has(c));
  if (runtime !== undefined) return { kind: "all", why: `${runtime} is part of what every test runs under` };

  const changedAbs = new Set(changed.map((c) => resolve(root, c)));
  // One read per file, shared by every test's walk.
  const edges = new Map<string, string[]>();
  const importsOf = (abs: string): string[] => {
    let e = edges.get(abs);
    if (e === undefined) {
      try {
        e = directRelativeImports(abs).targets;
      } catch {
        e = []; // unreadable: walked past, like a computed import
      }
      edges.set(abs, e);
    }
    return e;
  };

  const files: string[] = [];
  const why: Record<string, string> = {};
  for (const t of tests) {
    const start = resolve(root, t);
    const seen = new Set<string>();
    const stack = [start];
    let hit: string | undefined;
    while (stack.length > 0 && hit === undefined) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      if (changedAbs.has(f)) {
        hit = f === start ? "the test file itself changed" : `imports ${relative(root, f)}`;
        break;
      }
      stack.push(...importsOf(f));
    }
    if (hit !== undefined) {
      files.push(t);
      why[t] = hit;
    }
  }
  return { kind: "some", files, why };
}
