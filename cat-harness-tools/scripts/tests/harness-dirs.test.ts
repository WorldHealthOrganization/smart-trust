/**
 * The harness's two stores: where they are, who agrees about it, and whether an
 * agent can still work the plan when the `beans` CLI is not installed.
 *
 * Three claims are worth a test here, and they are the three that would fail
 * silently:
 *
 *   1. `beans/beans.json`, `.beans.yml` and `workflow/store.ts` agree. The graph
 *      is the DECLARATION (it used to be `harness.config.json`'s `harness`
 *      block, which is why these tests moved); the other two are copies that
 *      exist for reasons that cannot be removed — a third-party binary, and a
 *      hot path. Nothing but a check stops them drifting, at which point beans
 *      go to a store nothing else reads.
 *   2. The fallback writes what the CLI reads. If the layouts diverge, the
 *      fallback becomes a shadow store and the divergence is discovered by
 *      whoever loses work to it.
 *   3. `create` refuses a duplicate title. The CLI's own `create` does not, and
 *      an unguarded loop over it produced 14,688 duplicates in one afternoon.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { WORKFLOW_DIR } from "../../src/workflow/store.js";
import { MOUNT_MARKER_SCHEMA, markerPath } from "../branch-store.ts";
import { beansYmlPath, checkHarnessDirs } from "../check-harness-dirs.js";
import { readHarnessConfig, resolveHarnessConfigPath } from "../../schemas/kg/harness-config.js";
import {
  createBean,
  findBean,
  listBeans,
  noteBean,
  readStoreConfig,
  updateBean,
} from "../beans-fallback.js";
import { repoRootFor, declarationPathIn } from "../../schemas/kg/cat-harness.js";
import { configNameFor, writeInstanceConfig } from "../../test/support/instance-fixture.js";

// The REPOSITORY root, and it has to be said out loud now: `"..", ".."` from
// here reaches the LAYER, and this file's subject — `.beans.yml`, `beans/`
// and `workflow/store.ts` — is the repository's throughout. The constant kept
// the right name and the wrong value through the move (bean `wggr`), so eleven
// assertions ran against `cat-harness/beans/`, a directory that has never
// existed, and read as a store that disagreed with itself.
const REPO_ROOT = repoRootFor(resolve(import.meta.dir, "..", ".."));

/**
 * A throwaway store shaped exactly like the real one.
 *
 * `root` IS a repository root — a fixture has no enclosing layer, so
 * `repoRootFor(root)` is `/tmp` and every file the fixture wrote landed beside
 * every other test's. Same over-reach as the `check-agents-xref` fixture, and
 * the same lesson: `repoRootFor` means "up from an INSTANCE root".
 */
function scratchStore(): string {
  const root = mkdtempSync(join(tmpdir(), "beans-fallback-"));
  writeFileSync(
    join(root, ".beans.yml"),
    "beans:\n    path: beans/defs\n    prefix: test-\n    id_length: 4\n    default_status: todo\n    default_type: task\n",
  );
  mkdirSync(join(root, "beans", "defs"), { recursive: true });
  return root;
}

/** Write a bean graph under `root/beans/`. */
function writeGraph(root: string, directories: Array<{ id: string; path: string; graphTypologies: string[] }>): void {
  mkdirSync(join(root, "beans"), { recursive: true });
  writeFileSync(
    join(root, "beans", "beans.json"),
    JSON.stringify({ name: "test", directories }, null, 2),
  );
}

describe("the two stores are visible and agreed upon", () => {
  test("this repo's declaration, .beans.yml and store.ts all say the same thing", () => {
    const r = checkHarnessDirs(REPO_ROOT);
    expect(r.problems).toEqual([]);
    expect(r.beansYmlPath).toBe(r.declaredWorkPlan);
    expect(r.compiledWorkflowState).toBe(r.declaredWorkflowState);
  });

  test("neither store is hidden behind a dot — that is the whole point", () => {
    const r = checkHarnessDirs(REPO_ROOT);
    expect(r.declaredWorkPlan.startsWith(".")).toBe(false);
    expect(r.declaredWorkflowState.startsWith(".")).toBe(false);
    expect(WORKFLOW_DIR).toBe(join("beans", "workflows"));
  });

  test("the work plan is where it says it is, and is not empty", () => {
    const r = checkHarnessDirs(REPO_ROOT);
    expect(r.declaredWorkPlan).toBe(join("beans", "defs"));
    expect(r.beanCount).toBeGreaterThan(0);
  });

  test("a disagreement is a failure, not a shrug", () => {
    const root = scratchStore();
    try {
      // The folio declares one path; the CLI is pointed at another.
      writeGraph(root, [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }]);
      writeFileSync(join(root, ".beans.yml"), "beans:\n    path: somewhere-else\n");
      const r = checkHarnessDirs(root);
      expect(r.problems.some((p) => p.includes("Work-plan path disagrees"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a dot-prefixed declaration is refused", () => {
    const root = scratchStore();
    try {
      // `beans/.defs` — visible root, hidden node. A path cannot escape the
      // graph root, so this is the shape the guard has to catch.
      writeGraph(root, [{ id: "defs", path: ".defs", graphTypologies: ["bean-defs"] }]);
      writeFileSync(join(root, ".beans.yml"), "beans:\n    path: beans/.defs\n");
      mkdirSync(join(root, "beans", ".defs"), { recursive: true });
      const r = checkHarnessDirs(root);
      expect(r.problems.some((p) => p.includes("hidden behind a dot"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no config at all is 'not configured', never a failure", () => {
    const root = scratchStore();
    try {
      const r = checkHarnessDirs(root);
      expect(r.configured).toBe(false);
      expect(r.problems).toEqual([]);
      expect(r.notes.join(" ")).toContain("default");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("beansYmlPath reads the key, and reports absence rather than guessing", () => {
    expect(beansYmlPath(REPO_ROOT)).toBe(join("beans", "defs"));
    expect(beansYmlPath(tmpdir())).toBeUndefined();
  });
});

describe("the fallback can work the plan, not just read it", () => {
  test("it honours .beans.yml's prefix and id length", () => {
    const root = scratchStore();
    try {
      const cfg = readStoreConfig(root);
      expect(cfg.dir).toBe(join("beans", "defs"));
      expect(cfg.prefix).toBe("test-");
      const { bean } = createBean(root, { title: "First item" });
      expect(bean.id.startsWith("test-")).toBe(true);
      expect(bean.id.slice("test-".length)).toHaveLength(cfg.idLength);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("create, claim, update and note all round-trip through the file", () => {
    const root = scratchStore();
    try {
      const { bean } = createBean(root, { title: "Round trip", body: "## What\n\nA body.\n" });
      expect(bean.status).toBe("todo");

      const claimed = updateBean(root, bean.id, { status: "in-progress" });
      expect(claimed.status).toBe("in-progress");
      // The body survives a front-matter rewrite — the whole risk of editing YAML
      // in place is clobbering what is underneath it.
      expect(claimed.body).toContain("A body.");

      const noted = noteBean(root, bean.id, "found the cause");
      expect(noted.body).toContain("found the cause");
      expect(noted.body).toContain("A body.");
      expect(noted.status).toBe("in-progress");

      expect(listBeans(root)).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an id can be given bare or fully prefixed", () => {
    const root = scratchStore();
    try {
      const { bean } = createBean(root, { title: "Either way" });
      const bare = bean.id.slice("test-".length);
      expect(findBean(root, bean.id)?.id).toBe(bean.id);
      expect(findBean(root, bare)?.id).toBe(bean.id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("create refuses a duplicate title and points at the existing bean", () => {
    const root = scratchStore();
    try {
      const first = createBean(root, { title: "Only once" });
      expect(first.duplicateOf).toBeUndefined();

      const second = createBean(root, { title: "Only once" });
      expect(second.duplicateOf).toBeDefined();
      expect(second.bean.id).toBe(first.bean.id);
      expect(listBeans(root)).toHaveLength(1);

      // --force is the deliberate escape hatch, and it has to be asked for.
      const forced = createBean(root, { title: "Only once", force: true });
      expect(forced.duplicateOf).toBeUndefined();
      expect(listBeans(root)).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("what it writes parses as the layout the CLI expects", () => {
    const root = scratchStore();
    try {
      const { bean } = createBean(root, { title: "Layout check", type: "bug", status: "in-progress" });
      const raw = readFileSync(bean.path, "utf-8");
      expect(raw.startsWith("---\n")).toBe(true);
      // The id comment on the first front-matter line is how the CLI names a bean.
      expect(raw).toContain(`# ${bean.id}`);
      for (const key of ["title:", "status:", "type:", "priority:", "created_at:", "updated_at:"]) {
        expect(raw).toContain(key);
      }
      expect(bean.path.endsWith(`${bean.id}--layout-check.md`)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("it reads this repo's real store, which the CLI also reads", () => {
    // The strongest available assertion that the two are one store: the beans
    // this session created through the CLI are visible to the fallback.
    const beans = listBeans(REPO_ROOT);
    // Not a size floor: the active store is open work, which a drain empties
    // on purpose (cat-harness-tools#1248). It must hold beans, and every one must parse.
    expect(beans.length).toBeGreaterThan(0);
    expect(beans.every((b) => b.id.startsWith("folio-assistant-"))).toBe(true);
    expect(beans.every((b) => b.title !== "(untitled)")).toBe(true);
  });
});

describe("the config name — `<instance>.config.json`, and only that", () => {
  test("the config is found by the name its INSTANCE declares", () => {
    // Not a global filename any more. The name comes from the layer's own
    // `harness.json`, which is what lets one checkout hold several configured
    // layers without either of them answering for the other.
    const root = scratchStore();
    try {
      writeInstanceConfig(root, JSON.stringify({ contentType: "document" }));
      expect(resolveHarnessConfigPath(root)!.path.endsWith(configNameFor(root))).toBe(true);
      expect(readHarnessConfig(root)?.contentType).toBe("document");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a directory that declares NO instance has no config name to look for", () => {
    // The third state, and it is not "absent". A config filename is composed
    // from a name, and an undeclared directory has none — so the honest
    // answer to "where is its config" is that nobody can say, rather than a
    // global filename guessed back into existence. `folio_init` writes the
    // declaration and the config together for exactly this reason.
    const root = scratchStore();
    try {
      // May be absent already — the point of the fixture is a directory that
      // declares nothing, and `declarationPathIn` is `undefined` for one.
      const declared = declarationPathIn(root);
      if (declared !== undefined) rmSync(declared, { force: true });
      writeFileSync(join(root, "anything.config.json"), JSON.stringify({ contentType: "paper" }));
      expect(resolveHarnessConfigPath(root)).toBeUndefined();
      expect(readHarnessConfig(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("folio.config.json is NOT read — the old name is dead, not deprecated", () => {
    // A fallback would leave a folio half-configured by a path nothing else
    // agrees about. Not configured is the honest state, and the loud one.
    const root = scratchStore();
    try {
      writeFileSync(join(root, "folio.config.json"), JSON.stringify({ contentType: "paper" }));
      expect(resolveHarnessConfigPath(root)).toBeUndefined();
      expect(readHarnessConfig(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an absent config is `undefined`, not an error — the platform has none", () => {
    const root = scratchStore();
    try {
      expect(resolveHarnessConfigPath(root)).toBeUndefined();
      expect(readHarnessConfig(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the bean graph, not the harness config, is what declares the stores", () => {
    // `harness.workPlan` / `harness.workflowState` were REMOVED from the schema
    // (bean x89g). A folio that still carries them is not misconfigured — the
    // fields are simply ignored, and the graph answers instead.
    const root = scratchStore();
    try {
      writeGraph(root, [
        { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
        { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
      ]);
      writeInstanceConfig(root, JSON.stringify({ harness: { workPlan: "ignored", workflowState: "also-ignored" } }),
      );
      const r = checkHarnessDirs(root);
      expect(r.configured).toBe(true);
      expect(r.declaredWorkPlan).toBe(join("beans", "defs"));
      expect(r.problems).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no graph is 'not configured' and uses the documented default", () => {
    const root = scratchStore();
    try {
      const r = checkHarnessDirs(root);
      expect(r.configured).toBe(false);
      // The default agrees with .beans.yml, so absence is not a false alarm.
      expect(r.problems).toEqual([]);
      expect(r.notes.join(" ")).toContain("default");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a graph that will not parse FAILS — it never falls back to defaults", () => {
    // Present-but-unreadable is the third state that must not be silent: a
    // graph nobody can parse leaves every consumer guessing where beans live.
    const root = scratchStore();
    try {
      mkdirSync(join(root, "beans"), { recursive: true });
      writeFileSync(join(root, "beans", "beans.json"), "{ not json");
      const r = checkHarnessDirs(root);
      expect(r.problems.some((p) => p.includes("will not parse"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const TIP = { branch: "cat/cat-harness/beans", keyedBy: "tip" } as const;

function branchRepo(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "harness-dirs-branch-"));
  writeFileSync(
    join(root, "cat-harness.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "cat-harness", directories: dirs }, null, 2),
  );
  writeFileSync(join(root, ".beans.yml"), "beans:\n    path: beans/defs\n");
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: root });
  spawnSync("git", ["config", "user.name", "t"], { cwd: root });
  return root;
}

function mountBranch(root: string, id: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const p = markerPath(root, id);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id, branch: TIP.branch, path: "beans", into, tip: "0".repeat(40), files: {} }));
}

describe("branch-mounted beans store", () => {
  test("when beans is on a branch and unmounted, it reports the unmounted reason rather than missing directory", () => {
    const root = branchRepo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: TIP.branch, keyedBy: "tip" } }]);
    try {
      const r = checkHarnessDirs(root);
      expect(r.problems.some((p) => p.includes("is on cat/cat-harness/beans and is not mounted"))).toBe(true);
      expect(r.problems.some((p) => p.includes("which does not exist"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("when beans is on a branch and mounted, it checks the mount and passes", () => {
    const root = branchRepo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: TIP.branch, keyedBy: "tip" } }]);
    const into = join(root, "mounted-beans");
    mountBranch(root, "beans", into);
    writeGraph(into, [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }]);
    mkdirSync(join(into, "defs"), { recursive: true });
    writeFileSync(join(into, "defs", "test-1234.md"), "---\nid: test-1234\n---\n");
    try {
      const r = checkHarnessDirs(root);
      expect(r.problems).toEqual([]);
      expect(r.beanCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

