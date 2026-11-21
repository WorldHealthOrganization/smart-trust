/**
 * The glob front-matter scopes, expanded to exact paths (owner, 2026-10-14:
 * "Explicit scopes"; `lib/default-scope-globs.ts`).
 *
 * Pinned: each generated list is the glob's own match set (against an
 * independent glob implementation, Bun's, and against Ruby's `Dir.glob`, the
 * one Jekyll calls, when a Ruby is on the PATH); the pages each list covers
 * are the pages the glob covered under BOTH Jekylls' subpath tests;
 * `process/*` never reaches `processes/`; and the composed real tree is left
 * with no glob scope.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

import { expandGlobScopes, globScopeMatches, isGlobScopePath, spliceDefaults } from "../lib/default-scope-globs.ts";
import { compose, docsLayers, expandComposedScopes } from "../compose-docs.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO = resolve(dirname(HARNESS_ROOT));

/** Every file under `dir`, relative, `/`-separated. */
function filesIn(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(dir, prefix))) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(dir, rel)).isDirectory()) out.push(...filesIn(dir, rel));
    else out.push(rel);
  }
  return out;
}

/** Jekyll 3.10's subpath test: some ascendant of the page path EQUALS the scope path. */
const subpath3 = (page: string, scope: string): boolean => {
  const segs = page.split("/");
  for (let i = segs.length; i > 0; i--) if (segs.slice(0, i).join("/") === scope) return true;
  return false;
};
/** Jekyll 4's: `path.start_with?(parent_path)`. */
const subpath4 = (page: string, scope: string): boolean => page.startsWith(scope);

/** The pages a scope covers: through its glob's matches, or as an exact path. */
const covered = (files: string[], scopes: string[], matches: (p: string, s: string) => boolean) =>
  files.filter((f) => scopes.some((s) => matches(f, s))).sort();

/** Bun's glob, the independent reference: files and directories, no dotfiles. */
const bunGlob = (root: string, pattern: string): string[] =>
  [...new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: false, dot: false })].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** Ruby's `Dir.glob`, which is what Jekyll calls, or undefined with no Ruby. */
function rubyGlob(root: string, pattern: string): string[] | undefined {
  const r = spawnSync("ruby", ["-e", "Dir.chdir(ARGV[0]); puts Dir.glob(ARGV[1]).sort", root, pattern], { encoding: "utf-8" });
  if (r.status !== 0 || r.error) return undefined;
  return r.stdout.split("\n").filter(Boolean);
}

function fixture(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "scopeglobs-"));
  for (const f of files) {
    mkdirSync(join(root, f, ".."), { recursive: true });
    writeFileSync(join(root, f), "x");
  }
  return root;
}

const FILES = [
  "process/index.md",
  "process/fr/index.md",
  "process/.hidden.md",
  "processes/a.md",
  "processes/b/c.md",
  "start/a.md",
  "start/a.md.orig",
  "start/fr/a.md",
  "start-here.md",
  "index.md",
];

describe("a glob scope's exact paths are the glob's own matches", () => {
  test("`process/*` matches its own entries, never `processes/`, and no dotfile", () => {
    const root = fixture(FILES);
    expect(globScopeMatches(root, "process/*")).toEqual(["process/fr", "process/index.md"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("equal to Bun's glob and to Ruby's Dir.glob on the fixture", () => {
    const root = fixture(FILES);
    for (const g of ["process/*", "start/*", "processes/*", "*.md", "start/?.md", "*/fr"]) {
      const mine = globScopeMatches(root, g);
      expect(mine).toEqual(bunGlob(root, g));
      const ruby = rubyGlob(root, g);
      if (ruby) expect(mine).toEqual(ruby);
    }
    rmSync(root, { recursive: true, force: true });
  });

  test("the expanded scopes cover exactly the glob's pages, under Jekyll 3.10 AND Jekyll 4", () => {
    const root = fixture(FILES);
    const files = filesIn(root);
    for (const g of ["process/*", "start/*", "processes/*"]) {
      const exact = globScopeMatches(root, g);
      // The glob as each Jekyll evaluates it: every Dir.glob match, then that
      // version's subpath test. The exact scopes: the same test on each path.
      expect(covered(files, exact, subpath3)).toEqual(covered(files, bunGlob(root, g), subpath3));
      expect(covered(files, exact, subpath4)).toEqual(covered(files, bunGlob(root, g), subpath4));
    }
    expect(covered(files, globScopeMatches(root, "process/*"), subpath4).some((f) => f.startsWith("processes/"))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  test("a glob feature it does not implement is refused, not approximated", () => {
    const root = fixture(FILES);
    for (const g of ["**/*.md", "start/[a-z]*", "{start,process}/*", "/start/*", "../x/*", "start/*/"]) {
      expect(() => globScopeMatches(root, g)).toThrow();
    }
    rmSync(root, { recursive: true, force: true });
  });
});

describe("expandGlobScopes", () => {
  test("replaces each glob entry in place, values copied, other entries untouched", () => {
    const root = fixture(FILES);
    const cfg = {
      title: "t",
      defaults: [
        { scope: { path: "start" }, values: { parent: "Start" } },
        { scope: { path: "process/*" }, values: { permalink: "/p/:basename" } },
        { scope: { path: "index.md" }, values: { layout: "home" } },
      ],
    };
    const r = expandGlobScopes(cfg, root);
    expect((r.config as typeof cfg).defaults).toEqual([
      { scope: { path: "start" }, values: { parent: "Start" } },
      { scope: { path: "process/fr" }, values: { permalink: "/p/:basename" } },
      { scope: { path: "process/index.md" }, values: { permalink: "/p/:basename" } },
      { scope: { path: "index.md" }, values: { layout: "home" } },
    ]);
    expect(r.expanded).toEqual([{ glob: "process/*", paths: ["process/fr", "process/index.md"] }]);
    // Copies, so the YAML writer emits no anchors.
    const d = (r.config as typeof cfg).defaults;
    expect(d[1]!.values).not.toBe(d[2]!.values);
    expect(cfg.defaults[1]!.scope.path).toBe("process/*");
    rmSync(root, { recursive: true, force: true });
  });

  test("a config with no glob scope is returned as given", () => {
    const cfg = { defaults: [{ scope: { path: "start" }, values: { parent: "S" } }] };
    const r = expandGlobScopes(cfg, tmpdir());
    expect(r.config).toBe(cfg);
    expect(r.expanded).toEqual([]);
  });

  test("refuses when a longer overlapping scope sets the same key — precedence could flip", () => {
    const root = fixture(FILES);
    const cfg = {
      defaults: [
        { scope: { path: "process/*" }, values: { permalink: "/a" } },
        { scope: { path: "process/fr" }, values: { permalink: "/b" } },
      ],
    };
    expect(() => expandGlobScopes(cfg, root)).toThrow(/precedence/);
    // A SHORTER scope setting the same key lost to the glob and loses to every
    // exact path too, so it is no conflict.
    const ok = { defaults: [{ scope: { path: "" }, values: { permalink: "/x" } }, cfg.defaults[0]!] };
    expect(() => expandGlobScopes(ok, root)).not.toThrow();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("spliceDefaults rewrites the defaults block and no other byte", () => {
  const text = [
    "# head comment",
    "title: 'quoted: kept'",
    "footer_content: >-",
    "  folded text,",
    "  kept as written.",
    "defaults:",
    "  - scope:",
    '      path: "start/*"',
    "    values:",
    "      permalink: /x",
    "# a comment that belongs to the next key",
    "",
    "exclude:",
    "  - vendor",
    "",
  ].join("\n");

  test("everything outside the block is byte-identical", () => {
    const next = [{ scope: { path: "start/a.md" }, values: { permalink: "/x" } }];
    const out = spliceDefaults(text, next);
    const lines = out.split("\n");
    expect(lines.slice(0, 5)).toEqual(text.split("\n").slice(0, 5));
    expect(out.endsWith("# a comment that belongs to the next key\n\nexclude:\n  - vendor\n")).toBe(true);
    expect((parseYaml(out) as { defaults: unknown }).defaults).toEqual(next);
  });

  test("a config with no block `defaults:` is refused, not re-serialised", () => {
    expect(() => spliceDefaults("title: t\n", [])).toThrow();
    expect(() => spliceDefaults("defaults: [{scope: {path: a}}]\n", [])).toThrow();
  });
});

describe("on the REAL composed tree", () => {
  test("no glob scope is left, and each one became exactly its glob's matches", () => {
    const docs = docsLayers(REPO).layers.filter((l) => !l.repositoryScoped);
    // The globs as AUTHORED, across the layers, which is what must be expanded.
    const authored = new Set<string>();
    for (const l of docs) {
      let cfg: { defaults?: { scope?: { path?: unknown } }[] } | null = null;
      try {
        cfg = parseYaml(readFileSync(join(l.dir, "_config.yml"), "utf-8"));
      } catch {
        continue;
      }
      for (const e of cfg?.defaults ?? []) if (isGlobScopePath(e.scope?.path)) authored.add(e.scope!.path as string);
    }
    // Vacuity guard: the harness's docs config declares its globs (the seven
    // chapter folders); a test over none would pass for any composer.
    expect(authored.size).toBeGreaterThan(0);

    const dest = join(mkdtempSync(join(tmpdir(), "scopesreal-")), "site");
    compose(dest, REPO);
    const merged = readFileSync(join(dest, "_config.yml"), "utf-8");
    const scopes = expandComposedScopes(dest);
    const composed = parseYaml(readFileSync(join(dest, "_config.yml"), "utf-8")) as {
      defaults: { scope: { path: string } }[];
    };
    expect(composed.defaults.filter((e) => isGlobScopePath(e.scope?.path))).toEqual([]);

    // Every OTHER key keeps its value: only `defaults` was rewritten.
    const { defaults: _a, ...restBefore } = parseYaml(merged) as Record<string, unknown>;
    const { defaults: _b, ...restAfter } = composed as unknown as Record<string, unknown>;
    expect(restAfter).toEqual(restBefore);

    expect(new Set(scopes.map((s) => s.glob))).toEqual(authored);
    for (const s of scopes) {
      expect(s.paths).toEqual(bunGlob(dest, s.glob));
      const ruby = rubyGlob(dest, s.glob);
      if (ruby) expect(s.paths).toEqual(ruby);
      for (const p of s.paths) expect(composed.defaults.some((e) => e.scope.path === p)).toBe(true);
    }
    // `process/*` reaches nothing under `processes/`.
    const proc = scopes.find((s) => s.glob === "process/*");
    if (proc) expect(proc.paths.every((p) => p.startsWith("process/"))).toBe(true);
    rmSync(join(dest, ".."), { recursive: true, force: true });
  }, 120_000);
});
