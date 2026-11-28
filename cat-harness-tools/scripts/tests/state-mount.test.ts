/**
 * state-mount on REAL repositories: a `file://` remote, real checkouts, no
 * mocks. The failure this module exists for is a FETCH that does not happen,
 * so a stubbed fetch would test the stub. Since bean `nij4` the mounting is
 * branch-store's `mountTip`; these pin what `state:mount` adds over it — the
 * dispatch on the declared source, the three-state report, and that a dirty
 * mount is never re-read over.
 *
 * @module scripts/tests/state-mount
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { contentAt, resolveTipLocation, tipLocations } from "../branch-store.js";
import { STATE_IGNORE_BEGIN, STATE_IGNORE_END, delegatedReport, delegatedStores, mountState, report, staleLayerMounts, withStateIgnoreBlock } from "../state-mount.js";
import { cleanup, git, MANIFEST, stateFixture, TIP_SOURCE, BRANCH } from "./state-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

afterEach(cleanup);

describe("inert until the cutover", () => {
  test("a directory-sourced subgraph is `not-enabled`, not a failure", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a", { kind: "directory" });
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("not-enabled");
    expect(existsSync(join(root, "todos"))).toBe(false);
    // The report must NOT shout: crying wolf here is what teaches an agent to ignore the loud case.
    expect(report(r)).not.toContain("🛑");
    expect(report(r)).toContain("read from the checkout");
  });

  test("a commit-keyed branch is qa-store's, not a mount's", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a", { ...TIP_SOURCE, keyedBy: "commit" });
    expect(mountState({ repoRoot: root, store }).state).toBe("not-enabled");
  });
});

describe("mounting, dispatched on the declared source", () => {
  test("a tip-keyed branch source is mounted at the declared path", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("mounted");
    expect(r.graphs).toMatchObject([{ id: "todos", state: "mounted", branch: BRANCH, files: 2 }]);
    expect(readFileSync(join(root, "todos/a.md"), "utf-8")).toBe("A\n");
    // Only the subgraph's own files: the branch root's manifest stays on the branch.
    expect(existsSync(join(root, "todos/manifest.json"))).toBe(false);
    expect(report(r)).toContain("bun run cat state:push");
  });

  test("a clean mount behind the branch is moved forward", () => {
    const f = stateFixture("state-mount-t-");
    const { root, store } = f.checkout("a");
    const first = mountState({ repoRoot: root, store });
    expect(first.state).toBe("mounted");
    expect(f.sibling("s", root).write([{ path: "todos/b.md", content: "B\n", expect: null }], "more").state).toBe("pushed");

    const moved = mountState({ repoRoot: root, store });
    expect(moved.state).toBe("mounted");
    const tipOf = (r: typeof moved) => {
      const g = r.graphs[0];
      return g?.state === "mounted" ? g.tip : "";
    };
    expect(tipOf(moved)).not.toBe(tipOf(first));
    expect(readFileSync(join(root, "todos/b.md"), "utf-8")).toBe("B\n");
  });

  test("--id narrows to one subgraph, and an id kept on no branch is a failure", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    expect(mountState({ repoRoot: root, store, id: "todos" }).state).toBe("mounted");
    const r = mountState({ repoRoot: root, store, id: "nope" });
    expect(r.state).toBe("failed");
    expect(r.reason).toContain("nope");
  });
});

describe("it never discards work", () => {
  test("a mount with unpushed edits is reported stale and left exactly as it is", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    const edited = join(root, "todos/a.md");
    writeFileSync(edited, "EDITED IN FLIGHT\n");

    const r = mountState({ repoRoot: root, store });
    // Still on disk and readable: present, so the sweep is not failed over it.
    expect(r.state).toBe("mounted");
    expect(r.graphs[0]).toMatchObject({ id: "todos", state: "stale" });
    expect(readFileSync(edited, "utf-8")).toBe("EDITED IN FLIGHT\n");
    expect(report(r)).toContain("Nothing was discarded");
  });

  // 2026-10-15: a layer re-laid over a nested mount took its files and left
  // its marker; "stale — push them" then sent the deletion of the whole graph.
  test("a mount that is GONE is re-mounted, not reported stale with its deletion to push", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    rmSync(join(root, "todos"), { recursive: true, force: true });

    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("mounted");
    expect(r.graphs[0]).toMatchObject({ id: "todos", state: "mounted", files: 2 });
    expect(readFileSync(join(root, "todos/a.md"), "utf-8")).toBe("A\n");
  });

  test("a directory the checkout still tracks is refused, never overwritten, and NOT read as stale", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    // `todos/` tracked on this branch: the cutover has not happened here.
    mkdirSync(join(root, "todos"));
    writeFileSync(join(root, "todos/local.md"), "main's copy\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "tracked");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("failed");
    expect(r.graphs[0]).toMatchObject({ state: "refused" });
    expect(readFileSync(join(root, "todos/local.md"), "utf-8")).toBe("main's copy\n");
  });
});

describe("stale is ASKED, never inferred from a refusal plus a marker", () => {
  test("a mounted graph whose path the checkout then tracks is refused, not stale — it exits non-zero", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    // The marker stays; the path is now tracked, so mountTip refuses it.
    // FORCED: since a successful mount ignores its path, a plain `add -A`
    // no longer tracks it, which is the accident this setup has to override.
    git(root, "add", "-A");
    git(root, "add", "-f", "todos");
    git(root, "commit", "-q", "-m", "tracked after mounting");
    const r = mountState({ repoRoot: root, store });
    expect(r.graphs[0]?.state).toBe("refused");
    expect(r.state).toBe("failed");
  });
});

describe("contentAt: a reader is told when the content is not on disk (bean 9c7h)", () => {
  test("kept on a branch and not mounted is `not-mounted`, never an empty directory", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    const before = contentAt("todos", root);
    expect(before.state).toBe("not-mounted");
    if (before.state === "not-mounted") expect(before.reason).toContain("state:mount");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    expect(contentAt("todos", root)).toMatchObject({ state: "present", via: "mount" });
  });

  test("kept in the checkout is `present` with no mount needed; an undeclared id says so", () => {
    const { root } = stateFixture("state-mount-t-").checkout("a", { kind: "directory" });
    expect(contentAt("todos", root)).toMatchObject({ state: "present", via: "checkout" });
    expect(contentAt("nope", root).state).toBe("undeclared");
  });
});

describe("the resolved source, not only legacy storage (bean doy3)", () => {
  test("a graph declared with `source` is found by tipLocations and resolveTipLocation", () => {
    const { root } = stateFixture("state-mount-t-").checkout("a");
    expect(tipLocations(root)).toEqual([{ id: "todos", path: "todos", branch: BRANCH, keyedBy: "tip" }]);
    expect(resolveTipLocation("todos", root)).toEqual({ id: "todos", path: "todos", branch: BRANCH, keyedBy: "tip" });
  });

  test("a directory source is the checkout itself: not a tip location, and resolveTipLocation says so", () => {
    const { root } = stateFixture("state-mount-t-").checkout("a", { kind: "directory" });
    expect(tipLocations(root)).toEqual([]);
    expect(() => resolveTipLocation("todos", root)).toThrow("kept in the checkout");
  });
});

describe("failure is LOUD, and says what not to believe", () => {
  test("an absent branch fails, and the report warns against trusting an empty work-plan", () => {
    const { root, store } = stateFixture("state-mount-t-", null).checkout("a");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("failed");
    const text = report(r);
    expect(text).toContain("🛑");
    expect(text).toContain("do not trust an empty work-plan");
    expect(text).toContain("not** evidence that there is no work");
  });

  test("a branch without the manifest is not a state branch", () => {
    const { root, store } = stateFixture("state-mount-t-", { "todos/a.md": "A\n" }).checkout("a");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.state).toBe("corrupt");
    expect(existsSync(join(root, "todos/a.md"))).toBe(false);
  });

  test("a foreign manifest schema is refused", () => {
    const foreign = JSON.stringify({ ...JSON.parse(MANIFEST), $schema: "qa-reports-manifest/v1" });
    const { root, store } = stateFixture("state-mount-t-", { "manifest.json": foreign, "todos/a.md": "A\n" }).checkout("a");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.reason).toContain("not state-manifest/v1");
  });

  test("a commit-keyed manifest is refused — the keying is the contract, not the name", () => {
    const commitKeyed = JSON.stringify({ ...JSON.parse(MANIFEST), keyedBy: "commit" });
    const { root, store } = stateFixture("state-mount-t-", { "manifest.json": commitKeyed, "todos/a.md": "A\n" }).checkout("a");
    const r = mountState({ repoRoot: root, store });
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.reason).toContain("keyed by commit");
  });
});

describe("a store state:mount does not mount names the Tool that does (bean j9cs)", () => {
  // cat-harness's OWN store only: this file runs standalone too
  // (check:cat-harness-standalone), where no other harness's declaration or
  // Tool exists. A dependency's store naming a Tool nobody declares is
  // check:tools' finding (danglingStorageTools), which sees the whole tree.
  test("cat-harness's site store names the Tool that publishes it", () => {
    const stores = delegatedStores(resolve(dirname(HARNESS_ROOT)));
    expect(stores.find((s) => s.id === "site")).toMatchObject({ keyedBy: "route", branch: "gh-pages", tool: "gh-pages" });
  });

  test("a family store's Tool is resolved to the command it declares", () => {
    const root = mkdtempSync(join(tmpdir(), "state-mount-tool-"));
    try {
      const entry = {
        id: "cache",
        path: "cache/",
        graphTypologies: ["lake-cache"],
        storage: { branchPrefix: "p/cache/", keyedBy: "family", keyFrom: "<member>", tool: "site-build-local" },
      };
      writeFileSync(join(root, "t.json"), JSON.stringify({ name: "t", directories: [entry] }, null, 2) + "\n");
      expect(delegatedStores(root)).toEqual([
        { id: "cache", path: "cache/", branch: "p/cache/", keyedBy: "family", tool: "site-build-local", invoke: "bun run cat preview:site" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a store with no declared Tool says so rather than leaving the cell blank", () => {
    const out = delegatedReport([{ id: "x", path: "x/", branch: "p/", keyedBy: "family" }]);
    expect(out).toContain("none declared");
    expect(delegatedReport([])).toBe("");
  });
});

describe("a successful mount is ignored by the checkout", () => {
  test("the mounted path lands in a generated .gitignore block, and git ignores it", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    const text = readFileSync(join(root, ".gitignore"), "utf-8");
    expect(text).toContain(`${STATE_IGNORE_BEGIN}\n/todos/**\n${STATE_IGNORE_END}`);
    expect(git(root, "status", "--porcelain", "--", "todos").trim()).toBe("");
  });

  test("mounting ONE graph keeps every declared graph's line, and leaves .gitignore byte-identical (bean 792f)", () => {
    // Bean `792f`: `state:mount -- --id beans` was seen dropping
    // `/merge-reviews/**` from the block. `--id` narrows the MOUNT, never the
    // block: the block is written from every declared tip graph.
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    const dirs = [
      { id: "todos", path: "todos/", graphTypologies: ["todos"], source: TIP_SOURCE },
      // The graph the bean saw dropped, declared but not the one mounted.
      { id: "merge-reviews", path: "merge-reviews/", graphTypologies: ["merge-reviews"], source: { kind: "branch", branch: "cat/cat-harness/merge-reviews", keyedBy: "tip" } },
    ];
    writeFileSync(join(root, "t.json"), JSON.stringify({ name: "t", directories: dirs }, null, 2) + "\n");
    const before = `node_modules\n${STATE_IGNORE_BEGIN}\n/merge-reviews/**\n/todos/**\n${STATE_IGNORE_END}\n`;
    writeFileSync(join(root, ".gitignore"), before);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "two declared tip graphs");
    expect(mountState({ repoRoot: root, store, id: "todos" }).state).toBe("mounted");
    expect(readFileSync(join(root, ".gitignore"), "utf-8")).toBe(before);
  });

  test("a FULL mount over layer mounts older than the lock leaves .gitignore byte-identical (bean x38u)", () => {
    // Bean `x38u`: in every fresh session the layer mounts on disk were
    // older than index.lock.json, and a plain `state:mount` (no `--id`)
    // rewrote the block from their declarations, dropping a graph only the
    // PINNED declaration names. Here the committed block names
    // `/who-iris/test/attestations/**`, which the on-disk declaration lacks.
    const { root, store } = stateFixture("state-mount-t-").checkout("a");
    const before = `node_modules\n${STATE_IGNORE_BEGIN}\n/todos/**\n/who-iris/test/attestations/**\n${STATE_IGNORE_END}\n`;
    writeFileSync(join(root, ".gitignore"), before);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "block from the pinned declarations");
    for (const layerMounts of ["missing", "could-not-determine"] as const) {
      const r = mountState({ repoRoot: root, store, layerMounts });
      expect(r.state).toBe("mounted");
      expect(r.reason).toContain(".gitignore left unchanged");
      expect(readFileSync(join(root, ".gitignore"), "utf-8")).toBe(before);
    }
    // Over CURRENT layer mounts the declarations are authoritative, and the
    // block is written from them.
    expect(mountState({ repoRoot: root, store, layerMounts: "mounted" }).state).toBe("mounted");
    expect(readFileSync(join(root, ".gitignore"), "utf-8")).toBe(`node_modules\n${STATE_IGNORE_BEGIN}\n/todos/**\n${STATE_IGNORE_END}\n`);
  });

  test("a mount that did not happen writes nothing", () => {
    const { root, store } = stateFixture("state-mount-t-").checkout("a", { kind: "directory" });
    mountState({ repoRoot: root, store });
    const file = join(root, ".gitignore");
    expect(existsSync(file) ? readFileSync(file, "utf-8") : "").not.toContain(STATE_IGNORE_BEGIN);
  });

  test("the block is replaced in place, keeping everything around it", () => {
    const before = `node_modules\n${STATE_IGNORE_BEGIN}\n/old/**\n${STATE_IGNORE_END}\n_site/\n`;
    expect(withStateIgnoreBlock(before, [{ path: "todos" }, { path: "issue-marks/" }])).toBe(
      `node_modules\n${STATE_IGNORE_BEGIN}\n/issue-marks/**\n/todos/**\n${STATE_IGNORE_END}\n_site/\n`,
    );
  });

  test("unpaired markers are refused, not guessed at", () => {
    expect(() => withStateIgnoreBlock(`${STATE_IGNORE_BEGIN}\n/x/**\n`, [{ path: "todos" }])).toThrow(/unpaired/);
  });
});

describe("checkout-relative markers and damaged mounts (bean 1ple)", () => {
  test("a mount missing >50% of its recorded files is reported as damaged? rather than unpushed change(s)", () => {
    const seed = {
      "manifest.json": MANIFEST,
      "todos/a.md": "A\n",
      "todos/b.md": "B\n",
      "todos/c.md": "C\n",
      "todos/d.md": "D\n",
    };
    const { root, store } = stateFixture("state-mount-t-", seed).checkout("a");
    expect(mountState({ repoRoot: root, store }).state).toBe("mounted");
    rmSync(join(root, "todos/a.md"));
    rmSync(join(root, "todos/b.md"));
    rmSync(join(root, "todos/c.md"));

    const r = mountState({ repoRoot: root, store });
    const g = r.graphs[0];
    expect(g?.state).toBe("stale");
    if (g?.state === "stale") {
      expect(g.damaged).toBe(true);
    }
    const text = report(r);
    expect(text).toContain("damaged?");
    expect(text).not.toContain("push them with `bun run cat state:push`");
    expect(text).toContain("--allow-mass-delete");
  });
});

describe("staleLayerMounts — the .gitignore block is rewritten only over current layer mounts (beans 792f, x38u)", () => {
  test("a checkout with no lock has nothing to be stale against", () => {
    const root = mkdtempSync(join(tmpdir(), "stale-layers-"));
    try {
      expect(staleLayerMounts(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("CORRUPTED: a layer mount that does not match the lock is stale, and says what to run", () => {
    for (const state of ["missing", "could-not-determine"] as const) {
      const why = staleLayerMounts("/nowhere", () => state);
      expect(why).toContain(state);
      expect(why).toContain("state:mount");
    }
    for (const state of ["mounted", "unverified-approver", "not-enabled"] as const) expect(staleLayerMounts("/nowhere", () => state)).toBeUndefined();
  });
});
