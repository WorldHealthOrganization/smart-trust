/**
 * A root is measured against its OWN gate set (owner, cat-harness-tools#281:
 * "hold smart-ra to its own gate set").
 *
 * Two fixture roots: a HARNESS root, which carries the harness's
 * `code-quality-gates.yml` and is measured against it as before, and a
 * CONTENT root, which carries none and is measured against the gates
 * `layer-pr-checks.yml` runs for it — derived once, by `run-gates.py`, and read
 * here through `run-gates.py --list`. Plus the `qa:refresh` half: a writer
 * that does not apply to a content root is reported not applicable, with its
 * reason, and a real failure there stays a failure.
 *
 * @module scripts/tests/root-gate-set
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { GATES_WORKFLOW, LAYER_PR_CHECKS, loadGates, loadGatesCiRuns, loadUnresolved } from "../gates.ts";
import { layerScript } from "../run-script.ts";
import { GateSetUndetermined, rootGateSet, rootProfile } from "../lib/root-gate-set.ts";
import { QA_WRITERS, assess, notApplicableWriters, type QaWriter } from "../qa-refresh.ts";
import type { MovedInventory } from "../qa-verify-moved.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function write(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/**
 * A content root: it declares `doc` at the root, which needs the layer `lib`.
 * `lib` declares two gates, a build script that is not one, and one gate whose
 * input only CI supplies (`check:corpus-gate`).
 */
function contentRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "gate-set-content-"));
  made.push(root);
  write(root, "doc.json", { $schema: "cat-harness-declaration/v1", name: "doc", needs: ["lib"] });
  write(root, "package.json", { name: "doc", scripts: { cat: "bun cat-harness-tools/scripts/run-script.ts", "check:own": "bun own.ts" } });
  write(root, "lib/lib.json", { $schema: "cat-harness-declaration/v1", name: "lib" });
  write(root, "lib/package.json", {
    name: "lib",
    scripts: {
      "check:a": "bun a.ts",
      "foo:check": "bun foo.ts",
      "uml:overview:check": "bun uml.ts",
      "readme:subgraphs:check": "bun readme.ts",
      build: "bun build.ts",
      "check:corpus-gate": "bun corpus.ts",
    },
    checkoutScripts: { "check:b": "bun b.ts" },
  });
  return root;
}

/** The same root, made a harness by carrying the harness's own CI recipe. */
function harnessRoot(): string {
  const root = contentRoot();
  write(
    root,
    GATES_WORKFLOW,
    "name: gates\njobs:\n  typescript:\n    steps:\n      - name: Harness gate\n        run: bun run cat check:harness-only\n",
  );
  return root;
}

describe("which gate set a root is measured against", () => {
  test("a root with the harness's gates workflow is a harness; one without is a content root", () => {
    expect(rootProfile(harnessRoot())).toBe("harness");
    expect(rootProfile(contentRoot())).toBe("content");
  });

  test("a content root's gates are the ones its PR checks run, derived by run-gates.py", () => {
    const set = rootGateSet(contentRoot());
    expect(set.own).toEqual(["doc"]);
    expect(set.harness).toEqual(["doc", "lib"]);
    expect(set.runner).toBe("bun run cat");
    const names = Object.keys(set.gates);
    // the graph checks, the root's own and its dependency's declared gates,
    // the checkout scripts every caller runs, and nothing that is not a gate
    expect(names).toContain("graph:doc:kg-audit");
    expect(names).toContain("doc:check:own");
    expect(names).toContain("lib:check:a");
    expect(names).toContain("lib:foo:check");
    expect(names).toContain("lib:uml:overview:check");
    expect(names).toContain("lib:readme:subgraphs:check");
    expect(names).toContain("lib:check:b");
    expect(names).toContain("cat-harness-tools:index-config:inline:check");
    expect(names).toContain("cat-harness-tools:agent-memory:check");
    expect(names).toContain("cat-harness-tools:skill:commands:check");
    expect(names.some((n) => n.endsWith(":build"))).toBe(false);
    expect(set.gates["lib:check:a"]).toBe("bun run cat check:a");
  });

  test("loadGates reads that set for a content root, under the shared PR checks", () => {
    const gates = loadGates(contentRoot());
    expect(gates.every((g) => g.job === LAYER_PR_CHECKS)).toBe(true);
    expect(gates.map((g) => g.command)).toContain("bun run cat foo:check");
    expect(gates.map((g) => g.command)).not.toContain("bun run cat check:harness-only");
  });

  test("a gate CI runs with an input this side lacks is unresolved here, and still in what CI runs", () => {
    const prev = process.env.GATE_DIFF_BASE;
    delete process.env.GATE_DIFF_BASE;
    try {
      const root = contentRoot();
      expect(loadUnresolved(root).map((g) => g.step)).toEqual(["lib:check:corpus-gate"]);
      expect(loadGates(root).map((g) => g.step)).not.toContain("lib:check:corpus-gate");
      expect(loadGatesCiRuns(root).map((g) => g.step)).toContain("lib:check:corpus-gate");
    } finally {
      if (prev !== undefined) process.env.GATE_DIFF_BASE = prev;
    }
  });

  test("a harness root is still measured against its own workflow, not the derived set", () => {
    const gates = loadGates(harnessRoot());
    expect(gates.map((g) => g.command)).toEqual(["bun run cat check:harness-only"]);
    expect(gates[0]!.job).toBe("typescript");
  });

  test("a root with no instance has no gate set: refused, never an empty pass", () => {
    const bare = mkdtempSync(join(tmpdir(), "gate-set-bare-"));
    made.push(bare);
    expect(() => rootGateSet(bare)).toThrow(GateSetUndetermined);
    expect(() => loadGates(bare)).toThrow(/NOT a pass/);
  });
});

/**
 * cat-harness-tools#1701: bootstrap-tools' committed-tree gates in an index
 * root whose git ignores the bootstrap mounts (smart-ips-pilgrimage) have an
 * empty corpus there, so they are skipped with their reason; a root whose git
 * tracks bootstrap runs them as before. `merge:request:check` needs a request
 * file this runner never has.
 */
describe("gates whose subject this root's git does not hold", () => {
  function git(root: string, ...args: string[]): void {
    const r = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "ignore", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(r.stderr)}`);
  }
  function indexRoot(ignoreMounts: boolean): string {
    const root = mkdtempSync(join(tmpdir(), "gate-set-index-"));
    made.push(root);
    write(root, "doc.json", { $schema: "cat-harness-declaration/v1", name: "doc", needs: ["bootstrap-tools", "cat-harness-tools"] });
    write(root, "package.json", { name: "doc", scripts: { cat: "bun cat-harness-tools/scripts/run-script.ts" } });
    write(root, "bootstrap/bootstrap.json", { name: "bootstrap", needs: [] });
    write(root, "bootstrap/README.md", "# bootstrap\n");
    write(root, "bootstrap-tools/bootstrap-tools.json", { name: "bootstrap-tools", needs: ["bootstrap"] });
    write(root, "bootstrap-tools/package.json", {
      name: "bootstrap-tools",
      scripts: { "book:check": "bun book.ts --check", "check:standalone": "bun standalone.ts", "check:closure": "bun closure.ts" },
    });
    write(root, "cat-harness-tools/cat-harness-tools.json", { $schema: "cat-harness-declaration/v1", name: "cat-harness-tools" });
    write(root, "cat-harness-tools/package.json", { name: "cat-harness-tools", scripts: { "merge:request:check": "bun mr.ts" } });
    if (ignoreMounts) write(root, ".gitignore", "/bootstrap/\n/bootstrap-tools/\n/cat-harness-tools/\n");
    git(root, "init", "-q");
    git(root, "add", "-A");
    return root;
  }

  test("in a root that ignores the mounts, bootstrap-tools' committed-tree gates are skipped with their reason", () => {
    const set = rootGateSet(indexRoot(true));
    expect(set.skipped["bootstrap-tools:book:check"]?.kind).toBe("untracked-corpus");
    expect(set.skipped["bootstrap-tools:book:check"]?.skipped).toContain("cat-harness-tools#1701");
    expect(set.skipped["bootstrap-tools:check:standalone"]?.kind).toBe("untracked-corpus");
    // a bootstrap-tools gate that is not about the committed tree still runs
    expect(Object.keys(set.gates)).toContain("bootstrap-tools:check:closure");
  });

  test("in a root whose git tracks bootstrap, they run exactly as before", () => {
    const set = rootGateSet(indexRoot(false));
    expect(Object.keys(set.gates)).toContain("bootstrap-tools:book:check");
    expect(Object.keys(set.gates)).toContain("bootstrap-tools:check:standalone");
    expect(set.skipped["bootstrap-tools:book:check"]).toBeUndefined();
  });

  test("merge:request:check needs a request file, so it is skipped as needs-input", () => {
    expect(rootGateSet(indexRoot(true)).skipped["cat-harness-tools:merge:request:check"]?.kind).toBe("needs-input");
  });
});

describe("qa:refresh in a content root", () => {
  const writers: QaWriter[] = [
    { id: "check:declared", run: ["check:declared"], writes: ["x/test/results/a.json"], because: "t" },
    { id: "p2:refusals", run: ["p2:refusals"], writes: ["x/test/results/p2.json"], because: "t" },
    { id: "docs:pages", run: ["docs:pages"], writes: ["x/test/results/w/**"], readsState: true, because: "t" },
    { id: "sweep", run: ["lib/sweep.ts", "docs"], writes: ["x/test/results/s.json"], because: "t" },
  ];
  const declares = (s: string): boolean => s !== "p2:refusals";

  test("an undeclared script and unmounted state are not applicable, each with its reason", () => {
    const na = notApplicableWriters(writers, { profile: "content", declares, stateMounted: false });
    expect(na.map((n) => n.id)).toEqual(["p2:refusals", "docs:pages"]);
    expect(na[0]!.why).toContain("declared by no instance");
    expect(na[1]!.why).toContain("state branches");
  });

  test("with state mounted, a state reader runs", () => {
    const na = notApplicableWriters(writers, { profile: "content", declares, stateMounted: true });
    expect(na.map((n) => n.id)).toEqual(["p2:refusals"]);
  });

  test("in a harness root nothing is excused: a missing script there is a broken declaration", () => {
    expect(notApplicableWriters(writers, { profile: "harness", declares, stateMounted: false })).toEqual([]);
  });

  test("a not-applicable writer is neither empty nor failed; a real failure still fails", () => {
    const inventory: MovedInventory = {
      directories: [{ path: "x/test/results", files: [{ path: "x/test/results/a.json", bytes: 1 }, { path: "x/test/results/s.json", bytes: 1 }] }],
      bytes: 2,
    } as unknown as MovedInventory;
    const notApplicable = notApplicableWriters(writers, { profile: "content", declares, stateMounted: false });
    const ok = assess({
      mode: "computed",
      inventory,
      writers,
      notApplicable,
      runs: [
        { id: "check:declared", exit: 0, seconds: 0 },
        { id: "sweep", exit: 0, seconds: 0 },
      ],
    });
    expect(ok.complete).toBe(true);
    expect(ok.empty).toEqual([]);
    expect(ok.notApplicable.map((n) => n.id)).toEqual(["p2:refusals", "docs:pages"]);

    const bad = assess({
      mode: "computed",
      inventory,
      writers,
      notApplicable,
      runs: [
        { id: "check:declared", exit: 1, seconds: 0 },
        { id: "sweep", exit: 0, seconds: 0 },
      ],
    });
    expect(bad.complete).toBe(false);
    expect(bad.failed).toEqual(["check:declared"]);
  });

  test("the writers that read state graphs say so", () => {
    const reads = QA_WRITERS.filter((w) => w.readsState).map((w) => w.id).sort();
    expect(reads).toEqual(["check:harness-state", "check:unlinked-beans", "docs:pages", "skill:register"]);
  });

  test("a layer's own `scripts` entry (not in `checkoutScripts`) is resolved in that layer's directory by `run-script.ts`", () => {
    const root = contentRoot();
    const entry = layerScript(root, "foo:check");
    expect(entry).toEqual({
      name: "foo:check",
      command: "bun foo.ts",
      cwd: join(root, "lib"),
      manifest: join("lib", "package.json"),
    });
    expect(layerScript(root, "check:b")).toBeUndefined();
    expect(layerScript(root, "no-such:script")).toBeUndefined();
  });
});
