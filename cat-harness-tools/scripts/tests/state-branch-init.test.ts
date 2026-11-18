/**
 * state-branch-init on REAL repositories: a `file://` remote, real checkouts.
 * A layer's initialization creates the state branches it declares (owner,
 * 2026-11-17); these pin that it does, that it is idempotent, that it never
 * creates a mounted dependency's branch or one onto an empty remote, and that
 * a push this token may not make is ONE actionable line naming the command.
 *
 * @module scripts/tests/state-branch-init
 */
import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { BranchStore, tipLocations, type TipLocation } from "../branch-store.js";
import { mountState, report } from "../state-mount.js";
import {
  createStateBranch,
  dependencyRemedy,
  initDeclaredStateBranches,
  initExitCode,
  initLocation,
  initRemedy,
  INIT_COMMAND,
  ownStateLocations,
  stateBranchFiles,
} from "../state-branch-init.js";
import { BRANCH, cleanup, git, stateFixture } from "./state-fixture.js";

afterEach(cleanup);

/** A checkout declaring `todos/` on BRANCH, whose remote has `main` and no state branch. */
function freshLayer(prefix = "state-init-t-") {
  const f = stateFixture(prefix, null);
  const co = f.checkout("a");
  git(co.root, "push", "-q", "origin", "main");
  return { f, ...co };
}

function remoteHas(bare: string, branch: string): boolean {
  return spawnSync("git", ["--git-dir", bare, "rev-parse", "--verify", "-q", `refs/heads/${branch}`]).status === 0;
}

describe("the standard layout", () => {
  test("beans, todos and fsh-guts start from their own files; any other graph from a .gitkeep", () => {
    const beans = stateBranchFiles("cat/x/beans", "beans", "beans/", "x");
    expect(Object.keys(beans).sort()).toEqual(["README.md", "beans/beans.json", "beans/defs/.gitkeep", "manifest.json"]);
    expect(JSON.parse(beans["beans/beans.json"]!).name).toBe("x");
    const m = JSON.parse(beans["manifest.json"]!);
    expect(m).toMatchObject({ $schema: "state-manifest/v1", authoritative: true, subgraph: "beans", keyedBy: "tip", graphs: [{ path: "beans" }] });
    expect(Object.keys(stateBranchFiles("cat/x/todos", "todos", ".todos", "x"))).toEqual(
      expect.arrayContaining([".todos/todos.json", ".todos/items/.gitkeep", ".todos/feedback/.gitkeep", ".todos/verdicts/.gitkeep"]),
    );
    expect(Object.keys(stateBranchFiles("cat/x/fsh-guts", "fsh-guts", "fsh-guts/", "x"))).toContain("fsh-guts/retired/.gitkeep");
    expect(Object.keys(stateBranchFiles("cat/x/health", "health", "health", "x"))).toContain("health/.gitkeep");
  });
});

describe("creating a missing declared branch", () => {
  test("a missing own branch is created with a manifest every reader verifies, and a second run leaves it alone", () => {
    const { f, root, store } = freshLayer();
    expect(remoteHas(f.bare, BRANCH)).toBe(false);
    const r = initDeclaredStateBranches({ repoRoot: root, store });
    expect(r.branches).toMatchObject([{ id: "todos", branch: BRANCH, state: "created" }]);
    expect(initExitCode(r)).toBe(0);
    expect(remoteHas(f.bare, BRANCH)).toBe(true);
    // branch-store's own verified read accepts it: a state branch, not a bare ref.
    const read = BranchStore.open(BRANCH, { repoRoot: root, ...store, storeDir: join(f.base, "verify.git") }).readFile("todos/todos.json");
    expect(read.state).toBe("hit");

    const tip = f.tip();
    const again = initDeclaredStateBranches({ repoRoot: root, store });
    expect(again.branches[0]?.state).toBe("exists");
    expect(f.tip()).toBe(tip);
  });

  test("--dry-run says it would create and pushes nothing", () => {
    const { f, root, store } = freshLayer();
    const r = initDeclaredStateBranches({ repoRoot: root, store, dryRun: true });
    expect(r.branches[0]?.state).toBe("would-create");
    expect(remoteHas(f.bare, BRANCH)).toBe(false);
  });

  test("an EMPTY remote is refused: the first branch pushed would become its default", () => {
    const f = stateFixture("state-init-t-", null);
    const { root, store } = f.checkout("a");
    const loc = tipLocations(root)[0]!;
    const r = initLocation(loc, { repoRoot: root, store });
    expect(r.state).toBe("refused");
    expect(r.reason).toContain("main");
    expect(remoteHas(f.bare, BRANCH)).toBe(false);
  });

  test("a push the token may not make is `denied`, with one line naming the command", () => {
    const { f, root, store } = freshLayer();
    const hook = join(f.bare, "hooks", "pre-receive");
    writeFileSync(hook, "#!/bin/sh\necho 'remote: Permission to x denied to bot (403)' >&2\nexit 1\n");
    chmodSync(hook, 0o755);
    const r = createStateBranch(BRANCH, stateBranchFiles(BRANCH, "todos", "todos", "t"), { repoRoot: root, store });
    expect(r.state).toBe("denied");
    expect(initRemedy(r)).toContain(INIT_COMMAND);
    expect(remoteHas(f.bare, BRANCH)).toBe(false);
  });
});

describe("only the layer's OWN branches", () => {
  test("a mounted dependency's graph and an unowned repository-scope graph are never the root's to create", () => {
    const { root } = freshLayer();
    const own = tipLocations(root);
    expect(ownStateLocations(root, own).map((l) => l.id)).toEqual(["todos"]);
    const dep: TipLocation = { ...own[0]!, repository: "someone/dep", instance: "dep" };
    const unowned: TipLocation = { ...own[0]!, unownedBy: "dep" };
    expect(ownStateLocations(root, [dep, unowned])).toEqual([]);
  });

  test("the remedy for a dependency's missing branch names its repository and the command to run THERE", () => {
    const line = dependencyRemedy({ branch: "cat/dth-pc/beans", repository: "litlfred/dth-pc", instance: "dth-pc" });
    expect(line).toContain("litlfred/dth-pc");
    expect(line).toContain("cat/dth-pc/beans");
    expect(line).toContain(INIT_COMMAND);
  });
});

describe("state:mount is a layer-initialization path", () => {
  test("with initMissing, a missing own branch is created and then mounted", () => {
    const { f, root, store } = freshLayer();
    const r = mountState({ repoRoot: root, store, initMissing: true });
    expect(r.state).toBe("mounted");
    expect(r.graphs[0]).toMatchObject({ id: "todos", state: "mounted" });
    expect(r.graphs[0]?.reason).toContain("layer initialization");
    expect(existsSync(join(root, "todos/todos.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, "todos/todos.json"), "utf-8")).name).toBe("t");
    expect(remoteHas(f.bare, BRANCH)).toBe(true);
  });

  test("without it (CI's direct call), the miss is reported and nothing is pushed", () => {
    const { f, root, store } = freshLayer();
    const r = mountState({ repoRoot: root, store });
    expect(r.graphs[0]?.state).toBe("miss");
    expect(remoteHas(f.bare, BRANCH)).toBe(false);
  });

  test("where the push is denied, the mount fails LOUD with the one remedy line", () => {
    const { f, root, store } = freshLayer();
    const hook = join(f.bare, "hooks", "pre-receive");
    writeFileSync(hook, "#!/bin/sh\necho 'remote: Permission denied (403)' >&2\nexit 1\n");
    chmodSync(hook, 0o755);
    const r = mountState({ repoRoot: root, store, initMissing: true });
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.state).toBe("miss");
    expect(r.graphs[0]?.reason).toContain(INIT_COMMAND);
    expect(report(r)).toContain(INIT_COMMAND);
  });
});

describe("the CLI: `state:seed --init`", () => {
  test("creates the missing branch and exits 0; a re-run reports it present", () => {
    const { f, root, store } = freshLayer();
    const run = () =>
      spawnSync("bun", [join(import.meta.dir, "..", "state-seed.ts"), "--init", "--repo-root", root, "--json"], {
        cwd: root,
        encoding: "utf-8",
        env: { ...process.env, BRANCH_STORE_DIR: store.storeDir },
      });
    const first = run();
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout).branches[0].state).toBe("created");
    expect(remoteHas(f.bare, BRANCH)).toBe(true);
    const second = run();
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout).branches[0].state).toBe("exists");
  });
});

describe("a new layer's scaffold creates its declared state branches", () => {
  test("initInstance, on a checkout whose remote has main, creates cat/<slug>/<id> for every branch-kept state graph", async () => {
    const { initInstance } = await import("../init-folio.js");
    const f = stateFixture("state-init-scaffold-", null);
    const d = join(f.base, "layer");
    git(f.base, "init", "-q", "-b", "main", d);
    git(d, "remote", "add", "origin", f.url);
    git(d, "commit", "-q", "--allow-empty", "-m", "first");
    git(d, "push", "-q", "origin", "main");
    const slug = "x-layer";
    const r = initInstance({ targetDir: d, slug, title: "X", link: "submodule", skipVcs: true });
    const branchKept = r.stateGraphs.filter((g) => g.source.kind === "branch");
    expect(branchKept.map((g) => g.id).sort()).toEqual(["beans", "fsh-guts", "todos"]);
    for (const g of branchKept) {
      expect(g.created).toBe("created");
      expect(remoteHas(f.bare, `cat/${slug}/${g.id}`)).toBe(true);
    }
    // Idempotent: a re-run of the scaffold over the same repository leaves them.
    const again = initInstance({ targetDir: d, slug, title: "X", link: "submodule", skipVcs: true });
    expect(again.stateGraphs.filter((g) => g.source.kind === "branch").every((g) => g.created === "exists")).toBe(true);
  });

  test("with no origin there is nowhere to create them, and the note names the command", async () => {
    const { initInstance } = await import("../init-folio.js");
    const f = stateFixture("state-init-scaffold-", null);
    const d = join(f.base, "layer");
    git(f.base, "init", "-q", "-b", "main", d);
    const r = initInstance({ targetDir: d, slug: "x-layer", title: "X", link: "submodule", skipVcs: true });
    expect(r.stateGraphs.every((g) => g.created === undefined)).toBe(true);
    expect(r.notes.join("\n")).toContain(INIT_COMMAND);
  });
});
