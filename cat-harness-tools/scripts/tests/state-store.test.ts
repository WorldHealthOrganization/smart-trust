/**
 * state-store over a REAL bare remote, following `branch-store.test.ts`'s
 * practice: a `file://` remote, a fresh private store per simulated container,
 * no mocks. A lost update is something two remotes and a ref lock do, and
 * stubbing git would only test the stub.
 *
 * @module scripts/tests/state-store
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BranchStoreUsageError, MANIFEST_SCHEMA, type BranchStoreOptions, type TipLocation } from "../branch-store.js";
import { StateStore } from "../state-store.js";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const BRANCH = "cat/cat-harness/state";
const LOCATION: TipLocation = { id: "beans-defs", path: "beans/defs", branch: BRANCH, keyedBy: "tip" };
const MANIFEST = JSON.stringify({ $schema: MANIFEST_SCHEMA, status: "seed", authoritative: false, subgraph: "beans", keyedBy: "tip" });

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "state-store-t-"));
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
  const container = (name: string, extra: Partial<BranchStoreOptions> = {}): BranchStoreOptions => ({
    repoRoot: work,
    remote: url,
    storeDir: join(base, `store-${name}.git`),
    sleep: () => {},
    log: () => {},
    ...extra,
  });
  const seed = (files: Record<string, string>) => {
    const dir = join(base, "seed");
    mkdirSync(dir);
    git(dir, "init", "-q", "-b", "seed");
    for (const [p, t] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), t);
    }
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "seed");
    git(dir, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);
  };
  return { base, bare, url, work, container, seed, tip: () => git(bare, "rev-parse", `refs/heads/${BRANCH}`).trim() };
}

function seeded(f: ReturnType<typeof fixture>): void {
  f.seed({
    "manifest.json": MANIFEST,
    "README.md": "# state\n",
    "beans/defs/a.md": "---\ntitle: A\n---\n",
    "beans/defs/nested/c.md": "c\n",
    "beans/defs/obj.json": '{"n":1}',
    "beans/defs/bad.json": "{ not json",
    "todos/t.md": "elsewhere\n",
  });
}

describe("paths are relative to the DECLARED directory", () => {
  test("a read names the file, never the directory's prefix", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    expect(s.branchPath()).toBe("beans/defs");
    expect(s.branchPath("a.md")).toBe("beans/defs/a.md");
    const r = s.readFile("a.md");
    expect(r.state).toBe("hit");
    if (r.state === "hit") expect(r.text).toBe("---\ntitle: A\n---\n");
    expect(s.readFile("nested/c.md").state).toBe("hit");
  });

  test("a `..` segment is refused, so one id cannot read another's state", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    expect(() => s.branchPath("../../todos/t.md")).toThrow(BranchStoreUsageError);
    // ...and the file it was reaching for IS there, so the refusal is the only thing stopping it.
    expect(StateStore.at({ id: "todos", path: "todos", branch: BRANCH, keyedBy: "tip" }, f.container("b")).readFile("t.md").state).toBe("hit");
  });

  test("listDir and readTree are scoped to the directory", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    const d = s.listDir();
    expect(d.state).toBe("hit");
    if (d.state === "hit") expect(d.entries.map((e) => e.name).sort()).toEqual(["a.md", "bad.json", "nested", "obj.json"]);
    const t = s.readTree();
    expect(t.state).toBe("hit");
    if (t.state === "hit") {
      expect([...t.files.keys()].some((p) => p.startsWith("todos/"))).toBe(false);
      expect([...t.files.keys()]).toContain("beans/defs/nested/c.md");
    }
  });

  test("readJson parses, and unparseable JSON is corrupt rather than missing", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    const ok = s.readJson<{ n: number }>("obj.json");
    expect(ok.state).toBe("hit");
    if (ok.state === "hit") expect(ok.value.n).toBe(1);
    expect(s.readJson("bad.json").state).toBe("corrupt");
    expect(s.readJson("nope.json").state).toBe("miss");
  });
});

describe("writes splice, and never overwrite blind", () => {
  test("a write lands at the directory's path on the branch", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    const r = s.write([{ path: "new.md", content: "new\n", expect: null }], "add new");
    expect(r.state).toBe("pushed");
    expect(git(f.bare, "show", `${r.commit}:beans/defs/new.md`)).toBe("new\n");
    // Another directory's state is carried across untouched.
    expect(git(f.bare, "show", `${r.commit}:todos/t.md`)).toBe("elsewhere\n");
  });

  test("an `expect` the tip disagrees with is a conflict that pushes nothing", () => {
    const f = fixture();
    seeded(f);
    const mine = StateStore.at(LOCATION, f.container("a"));
    const read = mine.readFile("a.md");
    if (read.state !== "hit") throw new Error("seed read failed");
    StateStore.at(LOCATION, f.container("b")).write([{ path: "a.md", content: "theirs\n" }], "theirs");
    const before = f.tip();
    const r = mine.write([{ path: "a.md", content: "mine\n", expect: read.blob }], "mine");
    expect(r.state).toBe("conflict");
    expect(r.conflicts?.[0]).toMatchObject({ path: "beans/defs/a.md", expected: read.blob });
    expect(f.tip()).toBe(before);
  });
});

describe("two sessions editing the SAME bean — bean 2h76's measurement", () => {
  test("update() re-reads and re-applies, so neither edit is lost", () => {
    const f = fixture();
    seeded(f);
    let raced = false;
    // `mine` is mid-write when `sibling` edits the SAME file and pushes first.
    const mine = StateStore.at(
      LOCATION,
      f.container("mine", {
        beforePush: () => {
          if (raced) return;
          raced = true;
          const sib = StateStore.at(LOCATION, f.container("sibling"));
          expect(sib.update("a.md", (cur) => `${cur ?? ""}sibling was here\n`, "sibling").state).toBe("pushed");
        },
      }),
    );

    const r = mine.update("a.md", (cur) => `${cur ?? ""}mine was here\n`, "mine");
    expect(r.state).toBe("pushed");
    expect(raced).toBe(true);

    // BOTH lines survive: the retry recomputed from what was actually on the branch.
    const final = git(f.bare, "show", `refs/heads/${BRANCH}:beans/defs/a.md`);
    expect(final).toContain("sibling was here");
    expect(final).toContain("mine was here");
    expect(final.startsWith("---\ntitle: A\n---\n")).toBe(true);
  });

  test("update() reports conflict rather than looping forever when it cannot settle", () => {
    const f = fixture();
    seeded(f);
    // A sibling that writes before EVERY push: no number of re-reads can win.
    const mine = StateStore.at(
      LOCATION,
      f.container("mine", {
        beforePush: () => {
          // input-site: inert #ed28659d — a unique scratch name or throwaway token; no assertion depends on its value
          StateStore.at(LOCATION, f.container(`sib-${Math.random()}`)).write([{ path: "a.md", content: `${Math.random()}\n` }], "sibling");
        },
      }),
    );
    const r = mine.update("a.md", (cur) => `${cur ?? ""}mine\n`, "mine", { attempts: 2 });
    expect(r.state).toBe("conflict");
    expect(r.reason).toContain("after 2 read-modify-write attempts");
  });

  test("a creator that loses the race is told, not silently second", () => {
    const f = fixture();
    seeded(f);
    const mine = StateStore.at(LOCATION, f.container("a"));
    StateStore.at(LOCATION, f.container("b")).write([{ path: "fresh.md", content: "theirs\n", expect: null }], "theirs");
    // `expect: null` means "must not exist" — the second creator conflicts.
    expect(mine.write([{ path: "fresh.md", content: "mine\n", expect: null }], "mine").state).toBe("conflict");
  });

  test("update() on unchanged content pushes nothing", () => {
    const f = fixture();
    seeded(f);
    const s = StateStore.at(LOCATION, f.container("a"));
    const before = f.tip();
    const r = s.update("a.md", (cur) => cur ?? "", "no-op");
    expect(r.state).toBe("unchanged");
    expect(f.tip()).toBe(before);
  });
});

describe("the declaration is the source of the branch", () => {
  test("openFor refuses an id no declaration carries", () => {
    const f = fixture();
    expect(() => StateStore.openFor("no-such-directory-id", f.container("a"))).toThrow(BranchStoreUsageError);
  });
});
