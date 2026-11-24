/**
 * `graphReadPath` — the checkout, or the mount, or a refusal.
 *
 * Bean `9ofm` row D. Against real git and a real mount marker: the question
 * "what does this checkout know" is answered by git and the marker, and a stub
 * of either would assert the stub.
 *
 * @module scripts/tests/graph-read
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MOUNT_MARKER_SCHEMA, markerPath } from "../branch-store.ts";
import { readBeanFiles, readBeanStore } from "../bean-store-read.ts";
import { fallbackStoreDir, listBeans, readStoreConfig } from "../beans-fallback.ts";
import { beanDefsDir, readBeans, resolveBeanDefs } from "../beans.ts";
import { enclosingCheckout, graphReadPath, mustReadGraph } from "../graph-read.ts";
import { notApplicableAlone } from "../../test/support/checkout.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const TIP = { branch: "cat/cat-harness/beans", keyedBy: "tip" } as const;

function git(root: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(`${args.join(" ")} -> ${r.status}`).toBe(`${args.join(" ")} -> 0`);
}

/** A git repository declaring exactly `dirs`. */
function repo(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "graph-read-"));
  made.push(root);
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }, null, 2));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@t");
  git(root, "config", "user.name", "t");
  return root;
}

function mount(root: string, id: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const p = markerPath(root, id);
  mkdirSync(join(p, ".."), { recursive: true });
  // The declared path of the graph `id` (every fixture here declares `<id>/`): a marker
  // naming another path is another graph's, and `tipPresence` refuses it.
  writeFileSync(p, JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id, branch: TIP.branch, path: id, into, tip: "0".repeat(40), files: {} }));
}

describe("a directory that never moved", () => {
  test("reads from the checkout, and says so", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"] }]);
    mkdirSync(join(root, "beans"));
    expect(graphReadPath("beans", root)).toEqual({ state: "ok", at: join(root, "beans"), from: "checkout", id: "beans", path: "beans" });
  });

  test("a COMMIT-keyed branch directory still reads from the checkout: only a tip mount relocates a read", () => {
    const root = repo([{ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "cat/cat-harness/qa-reports", keyedBy: "commit" } }]);
    expect(graphReadPath("qa", root)).toMatchObject({ state: "ok", from: "checkout" });
  });
});

describe("a tip-keyed directory, through the cutover", () => {
  test("BEFORE: declaration flipped, files still tracked — the checkout IS the store", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    mkdirSync(join(root, "beans"));
    writeFileSync(join(root, "beans", "a.md"), "x\n");
    git(root, "add", "beans/a.md");

    expect(graphReadPath("beans", root)).toEqual({
      state: "ok",
      at: join(root, "beans"),
      from: "checkout",
      id: "beans",
      path: "beans",
      notCutOver: true,
    });
  });

  test("AFTER: mounted — the marker's `into`, which need not be the declared path", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(root, "elsewhere");
    mount(root, "beans", into);
    expect(graphReadPath("beans", root)).toEqual({ state: "ok", at: into, from: "mount", id: "beans", path: "beans" });
  });

  test("BETWEEN: cut over and NOT mounted — refused, never a plausible empty directory", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const r = graphReadPath("beans", root);
    expect(r.state).toBe("refused");
    if (r.state !== "refused") throw new Error("unreachable");
    // The remedy, and the reason a fallback would be wrong.
    expect(r.reason).toContain("bun run cat state:mount");
    expect(r.reason).toContain("EMPTY graph");
    expect(r.reason).not.toContain(join(root, "beans") + '"');
  });

  test("the SAME call serves before and after the cutover — the migration is not two migrations", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    mkdirSync(join(root, "beans"));
    writeFileSync(join(root, "beans", "a.md"), "x\n");
    git(root, "add", "beans/a.md");
    const before = graphReadPath("beans", root);

    // The cutover: the files leave the checkout and the mount arrives.
    git(root, "rm", "-q", "--cached", "beans/a.md");
    rmSync(join(root, "beans"), { recursive: true, force: true });
    mount(root, "beans", join(root, "beans"));
    const after = graphReadPath("beans", root);

    expect(before.state).toBe("ok");
    expect(after.state).toBe("ok");
    // Same path either side; only `from` and `notCutOver` move.
    expect((after as { at: string }).at).toBe((before as { at: string }).at);
    expect((before as { from: string }).from).toBe("checkout");
    expect((after as { from: string }).from).toBe("mount");
  });
});

describe("what it refuses to guess", () => {
  test("an unknown id is `undeclared`, not a composed path", () => {
    const root = repo([]);
    const r = graphReadPath("nope", root);
    expect(r.state).toBe("undeclared");
    expect((r as { reason: string }).reason).toContain('no declared directory has id "nope"');
  });

  test("a declaration carrying both `source` and `storage` is refused with the resolver's message", () => {
    const root = repo([
      { id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP, source: { kind: "branch", branch: TIP.branch, keyedBy: "tip" } },
    ]);
    const r = graphReadPath("beans", root);
    expect(r.state).toBe("refused");
    expect((r as { reason: string }).reason).toContain("two answers to where its content comes from");
  });

  test("the modern `source` spelling reaches the same answer as the legacy `storage`", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: TIP.branch, keyedBy: "tip" } }]);
    const into = join(root, "beans");
    mount(root, "beans", into);
    expect(graphReadPath("beans", root)).toEqual({ state: "ok", at: into, from: "mount", id: "beans", path: "beans" });
  });
});

describe("mustReadGraph", () => {
  test("hands back the path when there is one", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"] }]);
    mkdirSync(join(root, "beans"));
    expect(mustReadGraph("beans", root)).toEqual({ at: join(root, "beans"), from: "checkout" });
  });

  test("throws carrying the remedy — a crash beats a clean run over an empty directory", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    expect(() => mustReadGraph("beans", root)).toThrow(/cannot read graph "beans".*state:mount/s);
  });
});

// ── The bean store through `graphReadPath` (bean `9ofm` row D) ──────────────
//
// `bean-store-read.ts` is where eight gates reach the work plan, so the states
// it can report are what each of them acts on. Asserted against a real
// repository and a real marker.
describe("readBeanStore relocates, and refuses", () => {
  /** A repository whose root layer declares `beans`, with a bean graph in it. */
  function beansRepo(storage?: Record<string, unknown>): string {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }]);
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }),
    );
    writeFileSync(join(root, "beans", "defs", "x.md"), "---\n# fx-1\ntitle: one\nstatus: todo\ntype: task\n---\nbody\n");
    return root;
  }

  test("not moved: reads the checkout, and finds the bean", () => {
    const root = beansRepo();
    const s = readBeanStore(root);
    expect(s.state).toBe("read");
    if (s.state !== "read") throw new Error("unreachable");
    expect(s.beans.map((b) => b.id)).toEqual(["fx-1"]);
  });

  test("declaration flipped, files still tracked: still reads the checkout", () => {
    const root = beansRepo(TIP);
    git(root, "add", "-A");
    const s = readBeanStore(root);
    expect(s.state).toBe("read");
    if (s.state !== "read") throw new Error("unreachable");
    expect(s.beans.map((b) => b.id)).toEqual(["fx-1"]);
  });

  test("cut over and mounted: reads the MOUNT, and `defs` resolves within it", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(root, "mounted-beans");
    mkdirSync(join(into, "defs"), { recursive: true });
    writeFileSync(
      join(into, "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }),
    );
    writeFileSync(join(into, "defs", "y.md"), "---\n# fx-2\ntitle: two\nstatus: todo\ntype: task\n---\nbody\n");
    mount(root, "beans", into);

    const s = readBeanStore(root);
    expect(s.state).toBe("read");
    if (s.state !== "read") throw new Error("unreachable");
    expect(s.dir).toBe(join(into, "defs"));
    expect(s.beans.map((b) => b.id)).toEqual(["fx-2"]);
  });

  test("cut over and NOT mounted: `unreachable`, which is NOT `declared-but-absent`", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const s = readBeanStore(root);
    expect(s.state).toBe("unreachable");
    if (s.state !== "unreachable") throw new Error("unreachable");
    // The remedy is the difference between the two states.
    expect(s.reason).toContain("state:mount");
  });

  test("readBeanFiles THROWS on `unreachable` — five gates read through it and `null` is a pass", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    expect(() => readBeanFiles(root)).toThrow(/cannot read the bean store.*state:mount/s);
    // ...while a repository that genuinely has no store still gets `null`.
    expect(readBeanFiles(repo([]))).toBeNull();
  });
});

// ── The readers that funnel through `resolveBeanDefs` (bean `9ofm` row D) ───
describe("resolveBeanDefs carries the third state, so ten call sites inherit it", () => {
  function beansRepo(storage?: Record<string, unknown>): string {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }]);
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }),
    );
    writeFileSync(join(root, "beans", "defs", "x.md"), "---\n# fx-1\ntitle: one\nstatus: todo\ntype: task\n---\nbody\n");
    return root;
  }

  test("not moved: `dir` resolves in the checkout and `unreachable` is unset", () => {
    const root = beansRepo();
    expect(resolveBeanDefs(root)).toEqual({ dir: join(root, "beans", "defs"), declared: true });
    expect(beanDefsDir(root)).toBe(join(root, "beans", "defs"));
  });

  test("mounted: `dir` resolves INSIDE the mount, so `defs` follows the graph", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(root, "mounted");
    mkdirSync(join(into, "defs"), { recursive: true });
    writeFileSync(join(into, "beans.json"), JSON.stringify({ name: "f", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }));
    mount(root, "beans", into);
    expect(resolveBeanDefs(root).dir).toBe(join(into, "defs"));
  });

  test("unreachable: `dir` is null but `declared` stays true — the declaration is CORRECT", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const r = resolveBeanDefs(root);
    expect(r.dir).toBeNull();
    expect(r.declared).toBe(true);
    expect(r.unreachable).toContain("state:mount");
  });

  test("beanDefsDir THROWS on unreachable: its `null` already means 'no store' to ten callers", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    expect(() => beanDefsDir(root)).toThrow(/cannot resolve the bean store.*state:mount/s);

    // ...while a repository with NO declaration at all still gets the
    // schema's default path, which is the documented behaviour: an unmigrated
    // folio has no `beans` entry, and that is fine rather than wrong.
    const bare = repo([]);
    expect(beanDefsDir(bare)).toBe(join(bare, "beans", "defs"));

    // `null` is for a bean graph that declares no `bean-defs` NODE — a
    // different question from either of the two above.
    const noNode = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"] }]);
    mkdirSync(join(noNode, "beans"), { recursive: true });
    // At least one directory (the schema requires it), of a kind that is NOT
    // `bean-defs` — that is what "declares no bean-defs node" means.
    writeFileSync(
      join(noNode, "beans", "beans.json"),
      JSON.stringify({ name: "f", directories: [{ id: "notes", path: "notes", graphTypologies: ["bean-notes"] }] }),
    );
    expect(beanDefsDir(noNode)).toBeNull();
  });

  test("readBeans inherits it rather than reporting an empty roadmap", () => {
    const root = beansRepo();
    expect(readBeans(root)?.map((b) => b.id)).toEqual(["fx-1"]);
    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    expect(() => readBeans(cut)).toThrow(/cannot resolve the bean store/);
  });
});

describe("beans-fallback: the CLI-absent reader relocates, and refuses", () => {
  /** A repo declaring `beans`, with `.beans.yml` pointing at `beans/defs`. */
  function fallbackRepo(storage?: Record<string, unknown>): string {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }]);
    writeFileSync(join(root, ".beans.yml"), "path: beans/defs\nprefix: fx-\nid_length: 4\n");
    return root;
  }

  test("not moved: the `.beans.yml` path, unchanged", () => {
    const root = fallbackRepo();
    const cfg = readStoreConfig(root);
    expect(cfg.dir).toBe("beans/defs");
    expect(fallbackStoreDir(root, cfg)).toEqual({ at: join(root, "beans", "defs") });
  });

  test("mounted: the part inside the graph is REBASED onto the mount, the rest kept", () => {
    const root = fallbackRepo(TIP);
    const into = join(root, "elsewhere");
    mount(root, "beans", into);
    // `beans/defs` under a graph declared at `beans` -> `<mount>/defs`.
    expect(fallbackStoreDir(root, readStoreConfig(root))).toEqual({ at: join(into, "defs") });
  });

  test("unreachable: refused, and `listBeans` THROWS rather than returning []", () => {
    const root = fallbackRepo(TIP);
    const cfg = readStoreConfig(root);
    const w = fallbackStoreDir(root, cfg);
    expect("refused" in w).toBe(true);
    // `[]` here reads as "there is no work" — bean `35nj`'s measured cost.
    expect(() => listBeans(root, cfg)).toThrow(/cannot read the bean store/);
  });

  test("a `.beans.yml` path OUTSIDE the declared graph is left alone, not invented onto it", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    writeFileSync(join(root, ".beans.yml"), "path: somewhere/else\n");
    const cfg = readStoreConfig(root);
    expect(fallbackStoreDir(root, cfg)).toEqual({ at: join(root, "somewhere", "else") });
  });
});

// ── The three readers migrated in row D step 4 (bean `9ofm`) ───────────────
describe("todos, issue-marks and the claim writer resolve by declared ID", () => {
  test("issue-marks: `seenPath` lands in the mount, and REFUSES when the graph is unreachable", async () => {
    const { seenPath } = await import("../../src/issue-watch/seen-comments.ts");

    const plain = repo([{ id: "issue-marks", path: "issue-marks/", graphTypologies: ["issue-marks"] }]);
    expect(seenPath(plain, "o", "r", 7)).toBe(join(plain, "issue-marks", "o-r-7.json"));

    const mounted = repo([{ id: "issue-marks", path: "issue-marks/", graphTypologies: ["issue-marks"], storage: { branch: "cat/cat-harness/issue-marks", keyedBy: "tip" } }]);
    const into = join(mounted, "im-mount");
    mount(mounted, "issue-marks", into);
    expect(seenPath(mounted, "o", "r", 7)).toBe(join(into, "o-r-7.json"));

    // Unreachable: a path under the repo root would make `loadSeen` report
    // "not seen" for every comment, forever, in silence.
    const cut = repo([{ id: "issue-marks", path: "issue-marks/", graphTypologies: ["issue-marks"], storage: { branch: "cat/cat-harness/issue-marks", keyedBy: "tip" } }]);
    expect(() => seenPath(cut, "o", "r", 7)).toThrow(/cannot resolve the issue-marks graph/);
  });

  // The checkout's REAL todo graph is the composed checkout's, kept on its
  // state branch: standing alone there is none to resolve to, so this one is
  // not applicable there. The three branch states are fixtures above and run
  // everywhere.
  test.skipIf(
    notApplicableAlone("the todo graph (`todos/`, kept on its state branch and mounted only in a composed checkout)"),
  )("todos: `TODO_ROOT` still resolves to the checkout's real todos directory (inert today)", async () => {
    const { TODO_ROOT } = await import("../todos.ts");
    // `TODO_ROOT` is bound to this checkout rather than a fixture, so what is
    // asserted here is that the relocation left today's answer alone. The
    // three branch states of the same call are covered by `graphReadPath`'s
    // own tests and, end to end, by the `issue-marks` case above — which goes
    // through the identical `graphReadPath(<id>, root)` shape.
    expect(TODO_ROOT().replace(/\\/g, "/")).toMatch(/\/todos$/);
  });

  // SUPERSEDED, deliberately. This asserted the #2042 REFUSAL — "a claim
  // pushed to main lands where no reader looks". The owner ruled 2026-10-04
  // that claims move to the branch store "when the readers and writers are
  // all ready for cutover", so the refusal is now a WRITER and
  // `claimOnDefaultBranch` DISPATCHES to it. What is still true, and is what
  // this now pins, is that it no longer pushes to the default branch.
  test("claim-bean DISPATCHES to the branch store once the store is mounted — it no longer pushes to main", async () => {
    const { claimOnDefaultBranch } = await import("../claim-bean.ts");

    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(cut, "beans-mount");
    mount(cut, "beans", into);
    const r = claimOnDefaultBranch("fx-1", "some-branch", { repo: cut });

    // No remote here, so the branch-store path cannot reach a tip — the point
    // is WHICH path ran. The old refusal's wording is gone, and the reason now
    // names the branch store rather than the default branch.
    expect(r.state).toBe("unknown");
    expect(r.reason ?? "").not.toContain("where no reader looks");
    expect(r.reason ?? "").toMatch(/cat\/cat-harness\/beans|branch store|tip-keyed/i);
  });

  test("claim-bean is UNCHANGED while the checkout still tracks the files — `notCutOver` is the discriminator", async () => {
    const { claimOnDefaultBranch } = await import("../claim-bean.ts");

    // Declaration names the branch, files still tracked => the default branch
    // IS the store, so this must behave exactly as before. It gets past the
    // pre-flight and fails later, on the store lookup, not on the guard.
    const notCutOver = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    mkdirSync(join(notCutOver, "beans", "defs"), { recursive: true });
    writeFileSync(join(notCutOver, "beans", "defs", "a.md"), "---\n# fx-1\ntitle: t\nstatus: todo\ntype: task\n---\nb\n");
    git(notCutOver, "add", "beans/defs/a.md");

    const r = claimOnDefaultBranch("fx-1", "some-branch", { repo: notCutOver });
    expect(r.reason ?? "").not.toContain("where no reader looks");
    expect(r.reason ?? "").not.toContain("not mounted here");
  });
});

// ── Row D step 5: the whole bean graph relocates, not just `defs` ──────────
describe("resolveBeanGraphNode and the workflow instance store", () => {
  /** A repo whose bean graph declares `defs` AND `workflows`. */
  function graphRepo(storage?: Record<string, unknown>): string {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }]);
    mkdirSync(join(root, "beans", "workflows"), { recursive: true });
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({
        name: "fixture",
        directories: [
          { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
          { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
        ],
      }),
    );
    return root;
  }

  test("every node of the graph moves, not only `defs`", async () => {
    const { resolveBeanGraphNode } = await import("../beans.ts");

    const plain = graphRepo();
    expect(resolveBeanGraphNode(plain, "workflow-state").dir).toBe(join(plain, "beans", "workflows"));

    // Mounted: `workflows` follows the graph, exactly as `defs` does.
    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(cut, "mount");
    mkdirSync(join(into, "workflows"), { recursive: true });
    writeFileSync(
      join(into, "beans.json"),
      JSON.stringify({ name: "f", directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
    );
    mount(cut, "beans", into);
    expect(resolveBeanGraphNode(cut, "workflow-state").dir).toBe(join(into, "workflows"));
  });

  test("unreachable is carried, not turned into a path that happens not to exist", async () => {
    const { resolveBeanGraphNode } = await import("../beans.ts");
    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const r = resolveBeanGraphNode(cut, "workflow-state");
    expect(r.dir).toBeNull();
    expect(r.declared).toBe(true);
    expect(r.unreachable).toContain("state:mount");
  });

  test("`WORKFLOW_DIR` is UNCHANGED — the gate that compares it to the declaration still has its subject", async () => {
    const { WORKFLOW_DIR } = await import("../../src/workflow/store.ts");
    expect(WORKFLOW_DIR).toBe(join("beans", "workflows"));
  });

  test("`workflowDir` relocates, memoises, and throws rather than listing an absent directory", async () => {
    const { workflowDir, clearWorkflowDirCache } = await import("../../src/workflow/store.ts");
    clearWorkflowDirCache();

    const plain = graphRepo();
    expect(workflowDir(plain)).toBe(join(plain, "beans", "workflows"));
    // Memoised: a second call is the same answer without re-resolving.
    expect(workflowDir(plain)).toBe(join(plain, "beans", "workflows"));

    clearWorkflowDirCache();
    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    // `listInstances` would return [] and every running workflow would read as
    // never started; `saveInstance` would write where nothing looks.
    expect(() => workflowDir(cut)).toThrow(/cannot resolve the workflow instance directory/);
    clearWorkflowDirCache();
  });

  test("`workflowStateAbsent`: only a mount's recorded ABSENCE is not-applicable; unreachable is not", async () => {
    const { workflowStateAbsent } = await import("../../src/workflow/store.ts");
    const { recordAbsence } = await import("../branch-store.ts");
    expect(workflowStateAbsent(graphRepo())).toBeUndefined();

    const cut = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    expect(workflowStateAbsent(cut)).toBeUndefined();

    recordAbsence(cut, { id: "beans", path: "beans" }, "cat-harness", "declared for every checkout by cat-harness, not by this root, and this checkout's remote carries no cat/cat-harness/* branch");
    expect(workflowStateAbsent(cut)).toContain("carries no cat/cat-harness/* branch");
  });
});

describe("a branch FAMILY (bean lehh)", () => {
  test("is refused, never read as the empty declared path", () => {
    const root = repo([
      {
        id: "ig-ast",
        path: "ig-ast/",
        graphTypologies: ["docs"],
        storage: { branchPrefix: "cat/fhir-harness/fhir-ast/", keyedBy: "family", keyFrom: "the IG's package id" },
      },
    ]);
    const r = graphReadPath("ig-ast", root);
    expect(r.state).toBe("refused");
    expect(JSON.stringify(r)).toContain("FAMILY");
  });
});

describe("enclosingCheckout — markers are looked up in the checkout that holds the instance", () => {
  const top = mkdtempSync(join(tmpdir(), "enclosing-checkout-"));
  afterAll(() => rmSync(top, { recursive: true, force: true }));
  mkdirSync(join(top, ".git"), { recursive: true });
  mkdirSync(join(top, "cat-harness", "test"), { recursive: true });

  test("an instance mounted in an index resolves to the index root, where the markers are", () => {
    expect(enclosingCheckout(join(top, "cat-harness"))).toBe(top);
  });
  test("a checkout root is its own answer, so a caller that already passes it is unchanged", () => {
    expect(enclosingCheckout(top)).toBe(top);
  });
  test("with no .git above, the root itself, as before", () => {
    const bare = mkdtempSync(join(tmpdir(), "no-checkout-"));
    try {
      expect(enclosingCheckout(bare)).toBe(bare);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
