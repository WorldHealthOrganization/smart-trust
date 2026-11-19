/**
 * The state mount with a branch PER GRAPH — D4 option (b), owner ruling
 * 2026-10-03: *"Keep per-graph branches"*, *"i dont think we need a speciifc
 * "state" branch or mount, several potnential subgraphs can be a part of
 * state"*.
 *
 * Bean `2h76`, and the acceptance list in
 * `beans/notes/folio-assistant-2h76--2026-10-03--claude-festive-galileo-s7ibx0.md`.
 *
 * ## Why these are REAL repositories
 *
 * Same reason as `state-mount.test.ts`: the failure this module exists for is
 * a fetch that does not happen, so a stubbed fetch tests the stub. Each
 * fixture builds a `file://` bare remote and seeds one orphan branch per
 * declared subgraph, exactly as the cutover will.
 *
 * ## What each test pins
 *
 * | test | the rule |
 * |---|---|
 * | two branches mount | the `branches.length > 1` refusal is gone; **this one fails against the pre-2026-10-03 code** |
 * | each at its declared path | a graph lands where its declaration says, not under one shared `state/` |
 * | one bad branch | bean `1xhc` — a graph that failed must not let its siblings read clean |
 * | exit code | `session-start-coord-sweep.sh` calls this with `|| true`, so the printed finding and the exit status are the only carriers |
 * | nothing declared | `not-enabled` stays quiet and exits 0 |
 *
 * @module scripts/tests/state-mount-per-branch
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { mountState, report } from "../../state-mount.js";
import { pushState, report as pushReport } from "../../state-push.js";
import { TOOLS_ROOT } from "../../lib/roots.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const MANIFEST = JSON.stringify({ $schema: "state-manifest/v1", status: "seed", authoritative: false, keyedBy: "tip" });

const BEANS_BRANCH = "cat/cat-harness/beans";
const TODOS_BRANCH = "cat/cat-harness/todos";

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Subgraph {
  /** The declared directory id. */
  id: string;
  /** Repository-relative declared path — where the mount must land. */
  path: string;
  branch: string;
  graphTypologies: string[];
  /** Branch-relative path → content. `null` seeds no branch at all. */
  files: Record<string, string> | null;
}

/**
 * A checkout declaring `subs` as tip-keyed directories, with each one's branch
 * seeded on a shared `file://` remote.
 */
function fixture(subs: Subgraph[]) {
  const base = mkdtempSync(join(tmpdir(), "state-mount-pb-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  const url = `file://${bare}`;

  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  // The layer declaration IS the authority on which directory lives where.
  writeFileSync(
    join(work, "fixture.json"),
    JSON.stringify(
      {
        $schema: "cat-harness-declaration/1.0.0",
        name: "fixture",
        directories: subs.map((s) => ({
          id: s.id,
          path: `${s.path}/`,
          graphTypologies: s.graphTypologies,
          storage: { branch: s.branch, keyedBy: "tip" },
        })),
      },
      null,
      2,
    ),
  );
  writeFileSync(join(work, "README.md"), "root\n");
  git(work, "add", "fixture.json", "README.md");
  git(work, "commit", "-q", "-m", "root");
  git(work, "remote", "add", "origin", url);

  for (const s of subs) {
    if (!s.files) continue; // deliberately absent: a miss, not an empty mount
    const seed = join(base, `seed-${s.id}`);
    mkdirSync(seed);
    git(seed, "init", "-q", "-b", "seed");
    for (const [p, t] of Object.entries(s.files)) {
      mkdirSync(dirname(join(seed, p)), { recursive: true });
      writeFileSync(join(seed, p), t);
    }
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", `seed ${s.id}`);
    git(seed, "push", "-q", url, `HEAD:refs/heads/${s.branch}`);
  }
  return { base, bare, url, work };
}

/** The two-graph case the owner ruled for: beans on its branch, todos on its own. */
const TWO: Subgraph[] = [
  {
    id: "beans-defs",
    path: "beans/defs",
    branch: BEANS_BRANCH,
    graphTypologies: ["bean-defs"],
    files: { "manifest.json": MANIFEST, "beans/defs/a.md": "A\n" },
  },
  {
    id: "todos",
    path: "todos",
    branch: TODOS_BRANCH,
    graphTypologies: ["todos"],
    files: { "manifest.json": MANIFEST, "todos/t1.md": "T\n" },
  },
];

describe("a branch per graph (D4 option b)", () => {
  // THE RED TEST. Against the pre-ruling code this is `failed` with
  // "needs a mount per branch, which is not built".
  test("two declared tip branches both mount — the >1 refusal is gone", () => {
    const f = fixture(TWO);
    const r = mountState({ repoRoot: f.work });

    expect(r.state).toBe("mounted");
    expect(report(r)).not.toContain("🛑");
    expect(r.graphs.map((g) => g.id).sort()).toEqual(["beans-defs", "todos"]);
    expect(r.graphs.every((g) => g.state === "mounted")).toBe(true);
    // Each graph came from the branch ITS OWN declaration names.
    expect(r.graphs.find((g) => g.id === "beans-defs")?.branch).toBe(BEANS_BRANCH);
    expect(r.graphs.find((g) => g.id === "todos")?.branch).toBe(TODOS_BRANCH);
  });

  test("each graph lands at its own declared path, not under a shared state/", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");

    expect(readFileSync(join(f.work, "beans/defs/a.md"), "utf-8")).toBe("A\n");
    expect(readFileSync(join(f.work, "todos/t1.md"), "utf-8")).toBe("T\n");
    // The branch's own root files describe the branch, not the subgraph: a
    // mount of `beans/defs` must not drop a manifest into the checkout.
    expect(existsSync(join(f.work, "beans/defs/manifest.json"))).toBe(false);
    expect(existsSync(join(f.work, "state"))).toBe(false);
  });

  test("the declared path is read from the declaration, so two graphs never collide", () => {
    const f = fixture(TWO);
    const r = mountState({ repoRoot: f.work });
    if (r.state !== "mounted") throw new Error(`expected mounted, got ${r.state}: ${r.reason}`);
    const paths = r.graphs.map((g) => g.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.sort()).toEqual(["beans/defs", "todos"]);
  });
});

describe("one graph failing never lets the others read clean (bean 1xhc)", () => {
  /** beans is seeded; todos' branch was never pushed. */
  const MIXED: Subgraph[] = [TWO[0]!, { ...TWO[1]!, files: null }];

  test("the aggregate is `partial`, names the failure, and keeps the good mount", () => {
    const f = fixture(MIXED);
    const r = mountState({ repoRoot: f.work });

    // NOT "mounted": one graph is not there.
    expect(r.state).toBe("partial");
    const beans = r.graphs.find((g) => g.id === "beans-defs");
    const todos = r.graphs.find((g) => g.id === "todos");
    expect(beans?.state).toBe("mounted");
    expect(todos?.state).not.toBe("mounted");
    // The one that worked still worked — a partial is not a rollback.
    expect(readFileSync(join(f.work, "beans/defs/a.md"), "utf-8")).toBe("A\n");
  });

  test("the report shouts, names the graph that failed, and says what not to believe", () => {
    const f = fixture(MIXED);
    const text = report(mountState({ repoRoot: f.work }));

    expect(text).toContain("🛑");
    expect(text).toContain("todos");
    expect(text).toContain("do not trust an empty work-plan");
    // And it must not imply the whole mount is gone: beans IS readable.
    expect(text).toContain("beans-defs");
  });

  test("a corrupt branch is a failure for THAT graph only", () => {
    const f = fixture([
      TWO[0]!,
      { ...TWO[1]!, files: { "manifest.json": JSON.stringify({ $schema: "qa-reports-manifest/v1", keyedBy: "tip" }), "todos/t1.md": "T\n" } },
    ]);
    const r = mountState({ repoRoot: f.work });
    expect(r.state).toBe("partial");
    expect(r.graphs.find((g) => g.id === "beans-defs")?.state).toBe("mounted");
    expect(r.graphs.find((g) => g.id === "todos")?.state).toBe("corrupt");
  });

  test("every graph failing is `failed`, not `partial`", () => {
    const f = fixture([
      { ...TWO[0]!, files: null },
      { ...TWO[1]!, files: null },
    ]);
    const r = mountState({ repoRoot: f.work });
    expect(r.state).toBe("failed");
    expect(r.graphs.every((g) => g.state !== "mounted")).toBe(true);
    expect(report(r)).toContain("🛑");
  });
});

describe("state:push splices back PER BRANCH, not to one", () => {
  /** What `branch` holds at `path`, read straight off the bare remote. */
  function onBranch(bare: string, branch: string, path: string): string {
    return git(bare, "show", `${branch}:${path}`);
  }

  test("each graph's edit lands on its OWN branch, and neither reverts the other", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");

    writeFileSync(join(f.work, "beans/defs/a.md"), "A edited\n");
    writeFileSync(join(f.work, "todos/t1.md"), "T edited\n");

    const r = pushState({ repoRoot: f.work, message: "per-branch splice" });
    expect(r.state).toBe("pushed");
    expect(r.graphs?.map((g) => g.id).sort()).toEqual(["beans-defs", "todos"]);
    expect(r.graphs?.every((g) => g.state === "pushed")).toBe(true);
    // Each graph went to the branch ITS OWN declaration names.
    expect(r.graphs?.find((g) => g.id === "beans-defs")?.branch).toBe(BEANS_BRANCH);
    expect(r.graphs?.find((g) => g.id === "todos")?.branch).toBe(TODOS_BRANCH);

    expect(onBranch(f.bare, BEANS_BRANCH, "beans/defs/a.md")).toBe("A edited\n");
    expect(onBranch(f.bare, TODOS_BRANCH, "todos/t1.md")).toBe("T edited\n");
    // The todos edit did NOT go to the beans branch, and vice versa.
    expect(() => onBranch(f.bare, BEANS_BRANCH, "todos/t1.md")).toThrow();
    expect(() => onBranch(f.bare, TODOS_BRANCH, "beans/defs/a.md")).toThrow();
  });

  test("a new file is created on its own graph's branch", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    writeFileSync(join(f.work, "todos/t2.md"), "T2\n");

    expect(pushState({ repoRoot: f.work }).state).toBe("pushed");
    expect(onBranch(f.bare, TODOS_BRANCH, "todos/t2.md")).toBe("T2\n");
  });

  test("--dry-run previews every graph and sends nothing", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    writeFileSync(join(f.work, "beans/defs/a.md"), "A edited\n");

    const r = pushState({ repoRoot: f.work, dryRun: true });
    expect(r.state).toBe("would-push");
    expect(r.graphs?.length).toBe(2);
    // Nothing moved on the remote.
    expect(onBranch(f.bare, BEANS_BRANCH, "beans/defs/a.md")).toBe("A\n");
  });

  test("no graph with changes is `nothing`, not a failure", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    expect(pushState({ repoRoot: f.work }).state).toBe("nothing");
  });

  test("nothing mounted is `no-mount`, the same answer the single mount gives", () => {
    const f = fixture(TWO);
    expect(pushState({ repoRoot: f.work }).state).toBe("no-mount");
  });

  test("one graph failing to push leaves the other's push standing (bean 1xhc)", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    writeFileSync(join(f.work, "beans/defs/a.md"), "A edited\n");
    writeFileSync(join(f.work, "todos/t1.md"), "T edited\n");

    // A sibling edits the SAME todos file on its branch: that graph conflicts.
    const seed2 = join(f.base, "sibling");
    mkdirSync(seed2);
    git(seed2, "clone", "-q", f.url, "--branch", TODOS_BRANCH, seed2);
    writeFileSync(join(seed2, "todos/t1.md"), "T from a sibling\n");
    git(seed2, "add", "-A");
    git(seed2, "commit", "-q", "-m", "sibling");
    git(seed2, "push", "-q", "origin", `HEAD:refs/heads/${TODOS_BRANCH}`);

    const r = pushState({ repoRoot: f.work });
    expect(r.state).toBe("partial");
    expect(r.graphs?.find((g) => g.id === "beans-defs")?.state).toBe("pushed");
    expect(r.graphs?.find((g) => g.id === "todos")?.state).toBe("conflict");

    // beans landed; todos did NOT, and the sibling's edit was not overwritten.
    expect(onBranch(f.bare, BEANS_BRANCH, "beans/defs/a.md")).toBe("A edited\n");
    expect(onBranch(f.bare, TODOS_BRANCH, "todos/t1.md")).toBe("T from a sibling\n");
    // The unsettled edit is still on disk — nothing was discarded.
    expect(readFileSync(join(f.work, "todos/t1.md"), "utf-8")).toBe("T edited\n");

    const text = pushReport(r);
    expect(text).toContain("🛑");
    expect(text).toContain("todos");
    expect(text).toContain("Nothing was discarded");
    expect(text).toContain("beans-defs");
  });

  test("a partial push exits non-zero through the CLI", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    writeFileSync(join(f.work, "beans/defs/a.md"), "A edited\n");
    writeFileSync(join(f.work, "todos/t1.md"), "T edited\n");
    const seed2 = join(f.base, "sibling2");
    mkdirSync(seed2);
    git(seed2, "clone", "-q", f.url, "--branch", TODOS_BRANCH, seed2);
    writeFileSync(join(seed2, "todos/t1.md"), "T from a sibling\n");
    git(seed2, "add", "-A");
    git(seed2, "commit", "-q", "-m", "sibling");
    git(seed2, "push", "-q", "origin", `HEAD:refs/heads/${TODOS_BRANCH}`);

    const r = spawnSync("bun", ["run", join(import.meta.dir, "..", "..", "state-push.ts")], { cwd: f.work, encoding: "utf-8" });
    expect(r.status).not.toBe(0);
    expect((r.stdout ?? "") + (r.stderr ?? "")).toContain("🛑");
  });

  test("binary, executable and symlink survive the per-branch round trip", () => {
    const f = fixture(TWO);
    expect(mountState({ repoRoot: f.work }).state).toBe("mounted");
    const bytes = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x00, 0x7f]);
    writeFileSync(join(f.work, "todos/blob.bin"), bytes);
    writeFileSync(join(f.work, "todos/run.sh"), "#!/bin/sh\necho hi\n", { mode: 0o755 });
    symlinkSync("t1.md", join(f.work, "todos/link.md"));

    expect(pushState({ repoRoot: f.work }).state).toBe("pushed");
    // Bytes, not text: a utf-8 round trip would corrupt these silently.
    const got = spawnSync("git", ["show", `${TODOS_BRANCH}:todos/blob.bin`], { cwd: f.bare, maxBuffer: 1 << 20 });
    expect(Buffer.compare(got.stdout, bytes)).toBe(0);
    expect(git(f.bare, "ls-tree", TODOS_BRANCH, "todos/run.sh")).toContain("100755");
    expect(git(f.bare, "ls-tree", TODOS_BRANCH, "todos/link.md")).toContain("120000");
    expect(onBranch(f.bare, TODOS_BRANCH, "todos/link.md")).toBe("t1.md");
  });
});

describe("the exit code carries the finding", () => {
  // The sweep calls this with `|| true`, so a non-zero exit is the only thing
  // a wrapper cannot turn into silence. Run the real CLI.
  function run(root: string): { status: number; out: string } {
    const r = spawnSync("bun", ["run", join(TOOLS_ROOT, "scripts", "state-mount.ts")], { cwd: root, encoding: "utf-8" });
    return { status: r.status ?? 128, out: (r.stdout ?? "") + (r.stderr ?? "") };
  }

  test("a partial mount exits non-zero", () => {
    const f = fixture([TWO[0]!, { ...TWO[1]!, files: null }]);
    const r = run(f.work);
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("🛑");
  });

  test("every graph mounted exits 0", () => {
    const f = fixture(TWO);
    const r = run(f.work);
    expect(r.status).toBe(0);
    expect(r.out).not.toContain("🛑");
  });

  test("nothing declared stays quiet and exits 0 — failing here is the crying wolf", () => {
    const f = fixture([]);
    const r = run(f.work);
    expect(r.status).toBe(0);
    expect(r.out).not.toContain("🛑");
    expect(r.out).toContain("Not enabled");
  });
});
