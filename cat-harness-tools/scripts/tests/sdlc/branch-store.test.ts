/**
 * branch-store on REAL git repositories — a bare remote reached over
 * `file://`, a fresh private store per simulated container. No mocks and no
 * network: a rejected push and a lost race are things a remote does, and
 * stubbing git would only test the stub (qa-store.test.ts's practice).
 *
 * @module scripts/tests/branch-store
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BranchStore, BranchStoreUsageError, MANIFEST_SCHEMA, type BranchStoreOptions } from "../../branch-store.js";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const BRANCH = "cat/cat-harness/beans";

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Fixture {
  bare: string;
  url: string;
  work: string;
  container: (name: string, extra?: Partial<BranchStoreOptions>) => BranchStoreOptions;
  /** Push an orphan branch holding `files` (path → text) as the remote's `branch`. */
  seed: (branch: string, files: Record<string, string>) => string;
  tip: (branch: string) => string;
}

function fixture(): Fixture {
  const base = mkdtempSync(join(tmpdir(), "branch-store-t-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  git(work, "remote", "add", "origin", url);
  let n = 0;
  return {
    bare,
    url,
    work,
    container: (name, extra = {}) => ({
      repoRoot: work,
      remote: url,
      storeDir: join(base, `store-${name}.git`),
      sleep: () => {},
      log: () => {},
      ...extra,
    }),
    seed: (branch, files) => {
      const dir = join(base, `seed-${++n}`);
      mkdirSync(dir);
      git(dir, "init", "-q", "-b", "seed");
      for (const [p, t] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, p)), { recursive: true });
        writeFileSync(join(dir, p), t);
      }
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "-m", "seed");
      git(dir, "push", "-q", url, `HEAD:refs/heads/${branch}`);
      return git(dir, "rev-parse", "HEAD").trim();
    },
    tip: (branch) => git(bare, "rev-parse", `refs/heads/${branch}`).trim(),
  };
}

const MANIFEST = JSON.stringify({ $schema: MANIFEST_SCHEMA, status: "seed", authoritative: false, subgraph: "beans", keyedBy: "tip" });

function seeded(f: Fixture): string {
  return f.seed(BRANCH, {
    "README.md": "# beans\n",
    "manifest.json": MANIFEST,
    "beans/defs/a.md": "---\ntitle: A\n---\n",
    "beans/defs/b.md": "---\ntitle: B\n---\n",
    "beans/workflows/w.json": '{"$schema":"folio-workflow-instance/v1"}',
    "beans/bad.json": "{ not json",
  });
}

describe("reading", () => {
  test("hit: a file, JSON, a directory listing and a tree, at the tip", () => {
    const f = fixture();
    const tip = seeded(f);
    const s = BranchStore.open(BRANCH, f.container("r"));
    const r = s.readFile("beans/defs/a.md");
    expect(r).toMatchObject({ state: "hit", branch: BRANCH, tip, path: "beans/defs/a.md", text: "---\ntitle: A\n---\n" });
    expect(s.readJson("beans/workflows/w.json")).toMatchObject({ state: "hit", value: { $schema: "folio-workflow-instance/v1" } });
    const ls = s.listDir("beans");
    expect(ls.state).toBe("hit");
    if (ls.state === "hit") expect(ls.entries.map((e) => `${e.type}:${e.name}`)).toEqual(["blob:bad.json", "tree:defs", "tree:workflows"]);
    const t = s.readTree("beans/defs");
    expect(t.state).toBe("hit");
    if (t.state === "hit") expect([...t.files.keys()].sort()).toEqual(["beans/defs/a.md", "beans/defs/b.md"]);
  });

  test("miss: a path not at the tip, and a branch the remote does not have", () => {
    const f = fixture();
    seeded(f);
    expect(BranchStore.open(BRANCH, f.container("r")).readFile("beans/defs/zzz.md").state).toBe("miss");
    expect(BranchStore.open("cat/cat-harness/todos", f.container("r2")).readFile("todos/x.md").state).toBe("miss");
  });

  test("candidate names are asked in one ls-remote, and the first present one is read", () => {
    const f = fixture();
    seeded(f);
    const s = BranchStore.open(["cat/cat-harness/beans-new", BRANCH], f.container("c"));
    expect(s.readFile("beans/defs/a.md")).toMatchObject({ state: "hit", branch: BRANCH });
    expect(s.branch).toBe(BRANCH);
  });

  test("corrupt: unparseable JSON, a directory read as a file, a file listed as a directory", () => {
    const f = fixture();
    seeded(f);
    const s = BranchStore.open(BRANCH, f.container("r"));
    expect(s.readJson("beans/bad.json").state).toBe("corrupt");
    expect(s.readFile("beans/defs").state).toBe("corrupt");
    expect(s.listDir("beans/defs/a.md").state).toBe("corrupt");
  });

  test("corrupt: a branch with no manifest, a foreign one, or a commit-keyed one is not a state branch", () => {
    const f = fixture();
    f.seed("none", { "beans/defs/a.md": "x" });
    f.seed("foreign", { "manifest.json": JSON.stringify({ $schema: "qa-reports-manifest/v1", keyedBy: "tip" }), "beans/defs/a.md": "x" });
    f.seed("commit", { "manifest.json": JSON.stringify({ $schema: MANIFEST_SCHEMA, keyedBy: "commit" }), "beans/defs/a.md": "x" });
    for (const b of ["none", "foreign", "commit"]) {
      const r = BranchStore.open(b, f.container(b)).readFile("beans/defs/a.md");
      expect(r.state).toBe("corrupt");
    }
  });

  test("unknown: an unreachable remote is never a miss", () => {
    const f = fixture();
    const r = BranchStore.open(BRANCH, f.container("u", { remote: "file:///nonexistent/remote.git" })).readFile("beans/defs/a.md");
    expect(r.state).toBe("unknown");
  });

  test("a path escaping the branch is a usage error, not a miss", () => {
    const f = fixture();
    seeded(f);
    const s = BranchStore.open(BRANCH, f.container("r"));
    expect(() => s.readFile("../etc/passwd")).toThrow(BranchStoreUsageError);
    expect(() => s.readFile("/beans")).toThrow(BranchStoreUsageError);
  });
});

describe("writing", () => {
  test("a splice write changes only the named paths and carries every other file across", () => {
    const f = fixture();
    const seed = seeded(f);
    const s = BranchStore.open(BRANCH, f.container("w"));
    const r = s.write(
      [
        { path: "beans/defs/a.md", content: "---\ntitle: A2\n---\n" },
        { path: "beans/defs/c.md", content: "new\n" },
        { path: "beans/bad.json", content: null },
      ],
      "beans: edit a, add c, drop bad",
    );
    expect(r).toMatchObject({ state: "pushed", attempts: 1 });
    expect(f.tip(BRANCH)).toBe(r.commit!);
    expect(git(f.bare, "rev-parse", `${r.commit}^`).trim()).toBe(seed);
    const files = git(f.bare, "ls-tree", "-r", "--name-only", r.commit!).trim().split("\n").sort();
    expect(files).toEqual(["README.md", "beans/defs/a.md", "beans/defs/b.md", "beans/defs/c.md", "beans/workflows/w.json", "manifest.json"]);
    expect(git(f.bare, "show", `${r.commit}:beans/defs/a.md`)).toBe("---\ntitle: A2\n---\n");
    for (const kept of ["README.md", "manifest.json", "beans/defs/b.md", "beans/workflows/w.json"]) {
      expect(git(f.bare, "rev-parse", `${r.commit}:${kept}`)).toBe(git(f.bare, "rev-parse", `${seed}:${kept}`));
    }
    // A fresh container reads what was written.
    expect(BranchStore.open(BRANCH, f.container("w2")).readFile("beans/defs/c.md")).toMatchObject({ state: "hit", text: "new\n" });
  });

  test("writing the content already at the tip pushes nothing", () => {
    const f = fixture();
    const seed = seeded(f);
    const r = BranchStore.open(BRANCH, f.container("w")).write([{ path: "beans/defs/b.md", content: "---\ntitle: B\n---\n" }], "noop");
    expect(r.state).toBe("unchanged");
    expect(f.tip(BRANCH)).toBe(seed);
  });

  test("a tip that moved between fetch and push is rejected, and the retry lands on the new tip without losing the sibling's write", () => {
    const f = fixture();
    seeded(f);
    const sibling = BranchStore.open(BRANCH, f.container("sibling"));
    let siblingCommit: string | undefined;
    const sleeps: number[] = [];
    const me = BranchStore.open(
      BRANCH,
      f.container("me", {
        sleep: (ms) => sleeps.push(ms),
        beforePush: (attempt) => {
          if (attempt === 1) siblingCommit = sibling.write([{ path: "beans/defs/sib.md", content: "sibling\n" }], "sibling").commit;
        },
      }),
    );
    const r = me.write([{ path: "beans/defs/mine.md", content: "mine\n" }], "mine");
    expect(r).toMatchObject({ state: "pushed", attempts: 2 });
    expect(sleeps.length).toBe(1);
    expect(siblingCommit).toBeDefined();
    // Linear: the sibling's commit is the parent of ours — nothing was overwritten.
    expect(git(f.bare, "rev-parse", `${r.commit}^`).trim()).toBe(siblingCommit!);
    expect(git(f.bare, "show", `${r.commit}:beans/defs/sib.md`)).toBe("sibling\n");
    expect(git(f.bare, "show", `${r.commit}:beans/defs/mine.md`)).toBe("mine\n");
  });

  test("an `expect` the tip disagrees with stops the write as conflict and pushes nothing", () => {
    const f = fixture();
    seeded(f);
    const a = BranchStore.open(BRANCH, f.container("a"));
    const read = a.readFile("beans/defs/a.md");
    if (read.state !== "hit") throw new Error("seed read failed");
    // Someone else edits the same file first.
    BranchStore.open(BRANCH, f.container("b")).write([{ path: "beans/defs/a.md", content: "theirs\n" }], "theirs");
    const before = f.tip(BRANCH);
    const r = a.write([{ path: "beans/defs/a.md", content: "mine\n", expect: read.blob }], "mine");
    expect(r.state).toBe("conflict");
    expect(r.conflicts?.[0]).toMatchObject({ path: "beans/defs/a.md", expected: read.blob });
    expect(f.tip(BRANCH)).toBe(before);
    // `expect: null` — must not exist — conflicts with an existing file too.
    expect(a.write([{ path: "beans/defs/b.md", content: "x", expect: null }], "create").state).toBe("conflict");
  });

  test("an absent branch is never created by a write; seeding is a steward act", () => {
    const f = fixture();
    const r = BranchStore.open("cat/cat-harness/todos", f.container("w")).write([{ path: "todos/x.md", content: "x" }], "x");
    expect(r.state).toBe("absent");
    expect(spawnSync("git", ["rev-parse", "--verify", "-q", "refs/heads/cat/cat-harness/todos"], { cwd: f.bare }).status).not.toBe(0);
  });

  test("the branch's own manifest and README cannot be written", () => {
    const f = fixture();
    seeded(f);
    const s = BranchStore.open(BRANCH, f.container("w"));
    expect(() => s.write([{ path: "manifest.json", content: "{}" }], "x")).toThrow(BranchStoreUsageError);
    expect(() => s.write([{ path: "README.md", content: "x" }], "x")).toThrow(BranchStoreUsageError);
  });

  test("never force-pushes: no push in the module carries -f, --force or a + refspec", () => {
    const src = readFileSync(join(import.meta.dir, "..", "..", "branch-store.ts"), "utf-8");
    const pushes = src.split("\n").filter((l) => /"push"/.test(l));
    expect(pushes.length).toBeGreaterThan(0);
    for (const l of pushes) {
      expect(l).not.toMatch(/"-f"|"--force|--force-with-lease|`\+/);
    }
  });
});

// ── Route keying (bean 1j3q) ──────────────────────────────────────────────
//
// `route` is the same branch mechanism as `tip` and differs in exactly one
// thing: a write may not carry `expect`, because a rendered page has one
// writer and the newer generation wins. These tests pin that difference from
// both sides — a route store must refuse `expect`, and must still accept a
// same-path overwrite that a tip store would have called a `conflict`.

const ROUTE_BRANCH = "cat/cat-harness/auto-docs";
const ROUTE_MANIFEST = JSON.stringify({
  $schema: MANIFEST_SCHEMA,
  status: "seed",
  authoritative: false,
  subgraph: "auto-docs",
  keyedBy: "route",
});

function seededRoute(f: Fixture): string {
  return f.seed(ROUTE_BRANCH, {
    "README.md": "# auto-docs\n",
    "manifest.json": ROUTE_MANIFEST,
    "uml/overview/index.html": "<p>old</p>\n",
  });
}

describe("route keying", () => {
  test("a route-keyed store reads its own branch", () => {
    const f = fixture();
    seededRoute(f);
    const s = BranchStore.open(ROUTE_BRANCH, f.container("route-read", { keyedBy: "route" }));
    const r = s.readFile("uml/overview/index.html");
    expect(r.state).toBe("hit");
    if (r.state === "hit") expect(r.text).toBe("<p>old</p>\n");
  });

  test("the manifest must agree with the keying the caller opened for, BOTH ways", () => {
    const f = fixture();
    seededRoute(f); // keyedBy: route on the branch
    seeded(f); // keyedBy: tip on BRANCH

    // route branch read as tip → corrupt, and the reason names both values.
    const asTip = BranchStore.open(ROUTE_BRANCH, f.container("rk-1")).readFile("uml/overview/index.html");
    expect(asTip.state).toBe("corrupt");
    if (asTip.state === "corrupt") expect(asTip.reason).toMatch(/keyed by route, not tip/);

    // tip branch read as route → corrupt too. A one-way check would let a
    // state branch be written with last-write-wins semantics.
    const asRoute = BranchStore.open(BRANCH, f.container("rk-2", { keyedBy: "route" })).readFile("beans/defs/a.md");
    expect(asRoute.state).toBe("corrupt");
    if (asRoute.state === "corrupt") expect(asRoute.reason).toMatch(/keyed by tip, not route/);
  });

  test("a route-keyed write REFUSES `expect`, naming the paths", () => {
    const f = fixture();
    seededRoute(f);
    const s = BranchStore.open(ROUTE_BRANCH, f.container("route-expect", { keyedBy: "route" }));
    expect(() =>
      s.write([{ path: "uml/overview/index.html", content: Buffer.from("<p>new</p>\n"), expect: null }], "m"),
    ).toThrow(BranchStoreUsageError);
    try {
      s.write([{ path: "uml/overview/index.html", content: Buffer.from("x"), expect: "deadbeef" }], "m");
      throw new Error("expected a refusal");
    } catch (e) {
      expect((e as Error).message).toMatch(/uml\/overview\/index\.html/);
      expect((e as Error).message).toMatch(/one writer/);
    }
    // Refused BEFORE anything is pushed: the tip is untouched.
    expect(s.readFile("uml/overview/index.html").state).toBe("hit");
  });

  test("the same overwrite that is a tip `conflict` is a plain push when route-keyed", () => {
    const f = fixture();
    seededRoute(f);
    const route = BranchStore.open(ROUTE_BRANCH, f.container("route-w", { keyedBy: "route" }));
    const before = f.tip(ROUTE_BRANCH);

    // No `expect`: last generation wins, and the old blob is simply replaced.
    const w = route.write([{ path: "uml/overview/index.html", content: Buffer.from("<p>new</p>\n") }], "regen");
    expect(w.state).toBe("pushed");
    expect(f.tip(ROUTE_BRANCH)).not.toBe(before);
    const after = BranchStore.open(ROUTE_BRANCH, f.container("route-r2", { keyedBy: "route" })).readFile("uml/overview/index.html");
    expect(after.state).toBe("hit");
    if (after.state === "hit") expect(after.text).toBe("<p>new</p>\n");

    // The contrast, on the tip-keyed branch, with a stale `expect`: conflict.
    seeded(f);
    const tip = BranchStore.open(BRANCH, f.container("tip-w"));
    const c = tip.write([{ path: "beans/defs/a.md", content: Buffer.from("z"), expect: "0".repeat(40) }], "m");
    expect(c.state).toBe("conflict");
  });

  test("route-keyed writes are still not allowed to touch the manifest or README", () => {
    const f = fixture();
    seededRoute(f);
    const s = BranchStore.open(ROUTE_BRANCH, f.container("route-reserved", { keyedBy: "route" }));
    for (const p of ["manifest.json", "README.md"]) {
      expect(() => s.write([{ path: p, content: Buffer.from("x") }], "m")).toThrow(BranchStoreUsageError);
    }
  });
});
