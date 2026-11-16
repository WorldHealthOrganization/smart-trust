/**
 * lock:coherence:check — a lock's harness pins agree with the pinned
 * harnesses' own locks (owner, 2026-11-11, after who-iris main went red at
 * a43a4d27 on skewed pins).
 *
 * Two halves: the rule over fixtures (no git), and the git reader over local
 * repositories built here, so the whole path runs with no network.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Relation } from "../git-ancestry.ts";
import {
  LockReader,
  exitCodeOf,
  formatFreshness,
  formatReport,
  judgeFreshness,
  judgeLockCoherence,
  lockWrittenAt,
  pinsOf,
  repoKey,
  type LowerLock,
  type MainHead,
  type MainSince,
  type Pin,
} from "../check-lock-coherence.ts";

const sha = (c: string) => c.repeat(40);

// A linear history per repository: t1 < t2 < t3, h1 < h2; `side` is off t1.
const ORDER: Record<string, string[]> = {
  "litlfred/tools": [sha("1"), sha("2"), sha("3")],
  "litlfred/harness": [sha("a"), sha("b")],
};
const SIDE = sha("9"); // a tools commit on another line, after t1

function relate(repository: string, a: string, b: string): Relation {
  if (a === b) return { rel: "same" };
  if (a === SIDE || b === SIDE) {
    const other = a === SIDE ? b : a;
    if (other === sha("1")) return a === SIDE ? { rel: "a-descends" } : { rel: "b-descends" };
    return { rel: "diverged" };
  }
  const o = ORDER[repoKey(repository)]!;
  const ia = o.indexOf(a);
  const ib = o.indexOf(b);
  if (ia < 0 || ib < 0) return { rel: "unknown", reason: "not in the fixture" };
  return ia > ib ? { rel: "a-descends" } : { rel: "b-descends" };
}

const pin = (harness: string, ref: string): Pin => ({ harness, repository: `litlfred/${harness}`, ref });

/** The lower locks: core pins tools and harness; harness pins only tools. */
function lowers(coreTools: string, coreHarness: string, harnessTools: string) {
  return (p: Pin): LowerLock => {
    if (p.harness === "core") return { state: "lock", pins: [pin("harness", coreHarness), pin("tools", coreTools)] };
    if (p.harness === "harness") return { state: "lock", pins: [pin("tools", harnessTools)] };
    return { state: "absent" };
  };
}

describe("the rule: this lock's pin of X contains every pinned harness's pin of X", () => {
  test("a matched lock passes: every pin equal to, or newer than, what the lower locks pin", () => {
    const root = [pin("core", sha("c")), pin("harness", sha("b")), pin("tools", sha("3"))];
    const r = judgeLockCoherence(root, lowers(sha("2"), sha("b"), sha("3")), relate);
    expect(r.disagreements).toEqual([]);
    expect(r.undetermined).toEqual([]);
    expect(r.compared).toBe(3);
    expect(r.agree).toBe(3);
    expect(r.noLock).toEqual(["tools"]);
    expect(exitCodeOf(r)).toBe(0);
  });

  test("a mismatched lock fails: tools pinned older than core's own lock pins it", () => {
    const root = [pin("core", sha("c")), pin("harness", sha("b")), pin("tools", sha("1"))];
    const r = judgeLockCoherence(root, lowers(sha("3"), sha("b"), sha("1")), relate);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(1);
    expect(r.disagreements).toHaveLength(1);
    const d = r.disagreements[0]!;
    expect(d).toMatchObject({ harness: "tools", layerRef: sha("1"), lowerRef: sha("3"), relation: "behind" });
    expect(d.via.harness).toBe("core");
    expect(d.fix).toContain(`re-pin tools to ${sha("3")} or a later commit`);
    const text = formatReport(r, "fixture", true);
    expect(text).toContain("FAILED");
    expect(text).toContain(sha("1"));
    expect(text).toContain(sha("3"));
  });

  test("diverged pins fail too: neither contains the other", () => {
    const root = [pin("core", sha("c")), pin("harness", sha("b")), pin("tools", SIDE)];
    const r = judgeLockCoherence(root, lowers(sha("2"), sha("b"), sha("1")), relate);
    expect(r.disagreements.map((d) => [d.via.harness, d.relation])).toEqual([["core", "diverged"]]);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(1);
  });

  test("every disagreeing pair is reported, each with both SHAs", () => {
    const root = [pin("core", sha("c")), pin("harness", sha("a")), pin("tools", sha("1"))];
    const r = judgeLockCoherence(root, lowers(sha("2"), sha("b"), sha("3")), relate);
    expect(r.disagreements.map((d) => [d.harness, d.via.harness, d.layerRef[0], d.lowerRef[0]])).toEqual([
      ["harness", "core", "a", "b"],
      ["tools", "core", "1", "2"],
      ["tools", "harness", "1", "3"],
    ]);
  });

  test("a lower lock that could not be read is undetermined, never agreement", () => {
    const root = [pin("core", sha("c")), pin("tools", sha("3"))];
    const r = judgeLockCoherence(root, () => ({ state: "could-not-determine", reason: "fetch failed" }), relate);
    expect(r.undetermined).toHaveLength(2);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(2);
  });

  test("an unknown ancestry is undetermined, never agreement", () => {
    const root = [pin("core", sha("c")), pin("tools", sha("7"))];
    const r = judgeLockCoherence(root, lowers(sha("2"), sha("b"), sha("3")), relate);
    expect(r.agree).toBe(0);
    expect(r.undetermined.map((u) => u.harness)).toEqual(["tools"]);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(2);
  });

  test("pins are matched by repository, so a renamed harness is still compared", () => {
    const root = [pin("core", sha("c")), { harness: "tools-renamed", repository: "https://github.com/LitlFred/tools.git", ref: sha("1") }];
    const r = judgeLockCoherence(root, lowers(sha("2"), sha("b"), sha("3")), relate);
    expect(r.disagreements.map((d) => d.harness)).toEqual(["tools-renamed"]);
  });

  test("pinsOf reads mounts[] and refuses a malformed entry", () => {
    expect(pinsOf({ mounts: [pin("tools", sha("1"))], instances: [] })).toEqual([pin("tools", sha("1"))]);
    expect(() => pinsOf({ instances: [] })).toThrow("mounts");
    expect(() => pinsOf({ mounts: [{ harness: "x" }] })).toThrow("mounts[]");
  });
});

const mains = (m: Record<string, string>) => (p: Pin): MainHead => (m[p.harness] ? { sha: m[p.harness]! } : { reason: "fetch failed" });

describe("freshness: every pin at its repository's main, or ahead of it", () => {
  const agreeing = judgeLockCoherence([], () => ({ state: "absent" }), relate);

  test("pins at main, or descending from it, are fresh", () => {
    const f = judgeFreshness([pin("tools", sha("3")), pin("harness", sha("b"))], mains({ tools: sha("2"), harness: sha("b") }), relate);
    expect(f).toMatchObject({ checked: 2, fresh: 2, stale: [], undetermined: [] });
    expect(exitCodeOf(agreeing, f)).toBe(0);
  });

  test("a pin behind main fails, naming the harness, both SHAs and the re-pin", () => {
    const f = judgeFreshness([pin("tools", sha("3")), pin("harness", sha("a"))], mains({ tools: sha("3"), harness: sha("b") }), relate);
    expect(f.stale).toEqual([
      expect.objectContaining({ harness: "harness", ref: sha("a"), main: sha("b"), relation: "behind" }),
    ]);
    expect(f.stale[0]!.fix).toContain(`re-pin harness to main (${sha("b")})`);
    expect(exitCodeOf(agreeing, f)).toBe(1);
    const text = formatFreshness(f, "fixture");
    expect(text).toContain("FAILED");
    expect(text).toContain(sha("a"));
    expect(text).toContain(sha("b"));
  });

  test("the a43a4d27 shape: lower layers ahead of core's pins agree, but a stale core fails freshness", () => {
    // The layer pins tools at t3 and harness at b, ahead of what core's lock pins; core itself is old.
    const root = [pin("core", sha("c")), pin("harness", sha("b")), pin("tools", sha("3"))];
    const agree = judgeLockCoherence(root, lowers(sha("2"), sha("a"), sha("2")), relate);
    expect(agree.disagreements).toEqual([]);
    const coreRelate = (repo: string, a: string, b: string): Relation =>
      repoKey(repo) === "litlfred/core" ? (a === b ? { rel: "same" } : { rel: "b-descends" }) : relate(repo, a, b);
    const f = judgeFreshness(root, mains({ core: sha("d"), harness: sha("b"), tools: sha("3") }), coreRelate);
    expect(f.stale.map((s) => s.harness)).toEqual(["core"]);
    expect(exitCodeOf(agree, f)).toBe(1);
  });

  test("a pin diverged from main fails", () => {
    const f = judgeFreshness([pin("tools", SIDE)], mains({ tools: sha("3") }), relate);
    expect(f.stale.map((s) => s.relation)).toEqual(["diverged"]);
  });

  test("a main that cannot be read is undetermined (exit 2), never fresh", () => {
    const f = judgeFreshness([pin("tools", sha("3"))], mains({}), relate);
    expect(f.fresh).toBe(0);
    expect(f.undetermined).toHaveLength(1);
    expect(exitCodeOf(agreeing, f)).toBe(2);
  });

  test("an ancestry against main that cannot be evaluated is undetermined (exit 2)", () => {
    const f = judgeFreshness([pin("tools", sha("7"))], mains({ tools: sha("3") }), relate);
    expect(f.undetermined).toHaveLength(1);
    expect(exitCodeOf(agreeing, f)).toBe(2);
  });

  test("a disagreement still fails with every pin fresh", () => {
    const root = [pin("core", sha("c")), pin("tools", sha("1"))];
    const r = judgeLockCoherence(root, lowers(sha("3"), sha("b"), sha("1")), relate);
    const f = judgeFreshness(root, mains({ core: sha("c"), tools: sha("1") }), relate);
    expect(f.stale).toEqual([]);
    expect(exitCodeOf(r, f, { agreement: true })).toBe(1);
  });
});

describe("only the top-level lock decides (owner, 2026-11-13)", () => {
  test("by default a disagreement is reported, not a failure, when every pin is fresh", () => {
    const root = [pin("core", sha("c")), pin("tools", sha("1"))];
    const r = judgeLockCoherence(root, lowers(sha("3"), sha("b"), sha("1")), relate);
    const f = judgeFreshness(root, mains({ core: sha("c"), tools: sha("1") }), relate);
    expect(r.disagreements).toHaveLength(1);
    expect(exitCodeOf(r, f)).toBe(0);
    const text = formatReport(r, "fixture");
    expect(text).toContain("DIFFERS");
    expect(text).not.toContain("FAILED");
  });

  test("by default an undetermined lower lock does not fail either", () => {
    const root = [pin("core", sha("c"))];
    const r = judgeLockCoherence(root, () => ({ state: "could-not-determine", reason: "offline" }), relate);
    expect(r.undetermined).toHaveLength(1);
    expect(exitCodeOf(r)).toBe(0);
  });

  test("a stale pin still fails by default", () => {
    const root = [pin("core", sha("c")), pin("tools", sha("1"))];
    const r = judgeLockCoherence(root, lowers(sha("1"), sha("b"), sha("1")), relate);
    const f = judgeFreshness(root, mains({ core: sha("c"), tools: sha("2") }), relate);
    expect(exitCodeOf(r, f)).toBe(1);
  });
});

describe("fresh at re-pin time (owner, 2026-11-13, card \"Lock gate\")", () => {
  const agreeing = judgeLockCoherence([], () => ({ state: "absent" }), relate);
  const T = 1_000;
  // harness: a (pinned) → b on main's first-parent chain; b's date decides.
  const since = (at: number) => (): MainSince => ({ commits: [{ sha: sha("b"), at }] });
  const behind = [pin("harness", sha("a"))];
  const atMain = mains({ harness: sha("b") });

  test("a pin behind main is fresh when every commit main gained after it is newer than T", () => {
    const f = judgeFreshness(behind, atMain, relate, { writtenAt: { at: T, sha: sha("e") }, mainSince: since(T + 60) });
    expect(f).toMatchObject({ fresh: 1, stale: [], undetermined: [] });
    expect(f.freshAtRepin).toEqual([expect.objectContaining({ harness: "harness", ref: sha("a"), main: sha("b") })]);
    expect(exitCodeOf(agreeing, f)).toBe(0);
    const text = formatFreshness(f, "fixture");
    expect(text).toContain("but main moved after the lock was written");
    expect(text).toContain("fresh at re-pin time");
  });

  test("a pin behind main is stale when main already had a commit dated at or before T", () => {
    const f = judgeFreshness(behind, atMain, relate, { writtenAt: { at: T, sha: sha("e") }, mainSince: since(T) });
    expect(f.stale).toEqual([expect.objectContaining({ harness: "harness", relation: "behind", hadAtT: { sha: sha("b"), at: T } })]);
    expect(exitCodeOf(agreeing, f)).toBe(1);
    expect(formatFreshness(f, "fixture")).toContain("the lock was written behind main");
  });

  test("a diverged pin is stale whatever the dates", () => {
    const f = judgeFreshness([pin("tools", SIDE)], mains({ tools: sha("3") }), relate, {
      writtenAt: { at: T, sha: sha("e") },
      mainSince: since(T + 60),
    });
    expect(f.stale.map((s) => s.relation)).toEqual(["diverged"]);
    expect(exitCodeOf(agreeing, f)).toBe(1);
  });

  test("a T that cannot be found is undetermined (exit 2), never fresh", () => {
    const f = judgeFreshness(behind, atMain, relate, { writtenAt: { reason: "not a git repository" }, mainSince: since(T + 60) });
    expect(f.fresh).toBe(0);
    expect(f.undetermined).toHaveLength(1);
    expect(exitCodeOf(agreeing, f)).toBe(2);
  });

  test("main's history after the pin that cannot be read is undetermined (exit 2)", () => {
    const f = judgeFreshness(behind, atMain, relate, { writtenAt: { at: T, sha: sha("e") }, mainSince: () => ({ reason: "offline" }) });
    expect(f.undetermined).toHaveLength(1);
    expect(exitCodeOf(agreeing, f)).toBe(2);
  });

  test("at run time (--at-run-time) the same pin is stale: the old rule", () => {
    const f = judgeFreshness(behind, atMain, relate);
    expect(f.stale.map((s) => s.harness)).toEqual(["harness"]);
    expect(f.writtenAt).toBeUndefined();
    expect(exitCodeOf(agreeing, f)).toBe(1);
  });
});

// ── The git reader, over local repositories ─────────────────────────────────

function g(dir: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", dir, ...args], {
    encoding: "utf-8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function commit(dir: string, file: string, body: string, date?: string): string {
  writeFileSync(join(dir, file), body);
  g(dir, "add", "-A");
  if (date) {
    const r = spawnSync("git", ["-C", dir, "commit", "-q", "-m", file], {
      encoding: "utf-8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
    if (r.status !== 0) throw new Error(`git commit: ${r.stderr}`);
  } else g(dir, "commit", "-q", "-m", file);
  return g(dir, "rev-parse", "HEAD");
}

const lockOf = (pins: Pin[]) => JSON.stringify({ $schema: "cat-harness-mount-lock/v1", mounts: pins, instances: [] }, null, 2);

describe("the git reader: real commits, real locks", () => {
  let root: string;
  const urls: Record<string, string> = {};
  let t1 = "";
  let t2 = "";
  let core1 = "";

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "lock-coherence-"));
    for (const name of ["tools", "core"]) {
      const dir = join(root, "src", name);
      spawnSync("mkdir", ["-p", dir]);
      g(dir, "init", "-q", "-b", "main");
      g(dir, "config", "uploadpack.allowFilter", "true");
      g(dir, "config", "uploadpack.allowAnySHA1InWant", "true");
      urls[`litlfred/${name}`] = `file://${dir}`;
    }
    const tools = join(root, "src", "tools");
    t1 = commit(tools, "a.txt", "1");
    t2 = commit(tools, "a.txt", "2");
    // core, at its pin, was built against tools t2.
    core1 = commit(join(root, "src", "core"), "index.lock.json", lockOf([pin("tools", t2)]));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const reader = () => new LockReader(join(root, `cache-${Math.random().toString(36).slice(2)}`), (r) => urls[repoKey(r)]!);
  const judge = (toolsPin: string) => {
    const rd = reader();
    return judgeLockCoherence(
      [pin("core", core1), pin("tools", toolsPin)],
      (p) => rd.lockAt(p.repository, p.ref),
      (repo, a, b) => rd.relate(repo, a, b),
    );
  };

  test("matched: tools pinned where core's lock pins it passes", () => {
    const r = judge(t2);
    expect(r.disagreements).toEqual([]);
    expect(r.agree).toBe(1);
    expect(r.noLock).toEqual(["tools"]);
    expect(exitCodeOf(r)).toBe(0);
  });

  test("mismatched: tools pinned older than core's lock pins it fails, naming both SHAs", () => {
    const r = judge(t1);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(1);
    expect(r.disagreements).toEqual([
      expect.objectContaining({ harness: "tools", layerRef: t1, lowerRef: t2, relation: "behind" }),
    ]);
  });

  test("freshness: a pin at main passes, one behind main fails, naming main's SHA", () => {
    const rd = reader();
    const fresh = judgeFreshness([pin("tools", t2)], (p) => rd.mainOf(p.repository), (r, a, b) => rd.relate(r, a, b));
    expect(fresh).toMatchObject({ fresh: 1, stale: [], undetermined: [] });
    const rd2 = reader();
    const stale = judgeFreshness([pin("tools", t1)], (p) => rd2.mainOf(p.repository), (r, a, b) => rd2.relate(r, a, b));
    expect(stale.stale).toEqual([expect.objectContaining({ harness: "tools", ref: t1, main: t2, relation: "behind" })]);
  });

  test("freshness: a repository whose main cannot be fetched is undetermined", () => {
    const rd = new LockReader(join(root, "cache-missing"), () => `file://${join(root, "nope")}`);
    const f = judgeFreshness([pin("tools", t2)], (p) => rd.mainOf(p.repository), (r, a, b) => rd.relate(r, a, b));
    expect(f.undetermined).toHaveLength(1);
    expect(exitCodeOf(judgeLockCoherence([], () => ({ state: "absent" }), () => ({ rel: "same" })), f)).toBe(2);
  });

  test("at re-pin time: T from the lock's own repository, against main's dated first-parent chain", () => {
    // A repository with dated commits: p1 10:00, p2 10:10 (main 10:20 later).
    const dir = join(root, "src", "dated");
    spawnSync("mkdir", ["-p", dir]);
    g(dir, "init", "-q", "-b", "main");
    urls["litlfred/dated"] = `file://${dir}`;
    const p1 = commit(dir, "a.txt", "1", "2026-01-01T10:00:00Z");
    const p2 = commit(dir, "a.txt", "2", "2026-01-01T10:10:00Z");
    const p3 = commit(dir, "a.txt", "3", "2026-01-01T10:20:00Z");
    // The layer's checkout: the lock is written at 10:15, then an unrelated commit at 10:30.
    const layer = join(root, "src", "layer");
    spawnSync("mkdir", ["-p", layer]);
    g(layer, "init", "-q", "-b", "main");
    const lock = join(layer, "index.lock.json");
    const repinCommit = commit(layer, "index.lock.json", lockOf([pin("dated", p2)]), "2026-01-01T10:15:00Z");
    commit(layer, "other.txt", "x", "2026-01-01T10:30:00Z");
    const T = lockWrittenAt(lock);
    expect(T).toEqual({ at: Date.parse("2026-01-01T10:15:00Z") / 1000, sha: repinCommit });

    const judgeAt = (ref: string, at?: string) => {
      const rd = reader();
      return judgeFreshness(
        [pin("dated", ref)],
        (p) => rd.mainOf(p.repository),
        (r, a, b) => rd.relate(r, a, b),
        at === "run" ? undefined : { writtenAt: lockWrittenAt(lock), mainSince: (p, m) => rd.mainSince(p.repository, p.ref, m) },
      );
    };
    // p2 was main at 10:15; main gained p3 at 10:20 > T: fresh.
    const fresh = judgeAt(p2);
    expect(fresh).toMatchObject({ fresh: 1, stale: [], undetermined: [] });
    expect(fresh.freshAtRepin).toEqual([expect.objectContaining({ ref: p2, main: p3, firstAfter: { sha: p3, at: Date.parse("2026-01-01T10:20:00Z") / 1000 } })]);
    // p1 was already behind at 10:15 (p2 at 10:10 ≤ T): stale.
    const stale = judgeAt(p1);
    expect(stale.stale).toEqual([expect.objectContaining({ ref: p1, main: p3, relation: "behind", hadAtT: expect.objectContaining({ sha: p2 }) })]);
    // At run time, p2 is behind main now: stale.
    expect(judgeAt(p2, "run").stale.map((s) => s.ref)).toEqual([p2]);

    // An uncommitted lock is being written now: T is now.
    writeFileSync(lock, lockOf([pin("dated", p3)]));
    expect(lockWrittenAt(lock, "HEAD", () => 42)).toEqual({ at: 42, sha: "uncommitted" });
  });

  test("T of a lock outside any git repository is unknown", () => {
    const dir = mkdtempSync(join(tmpdir(), "lock-no-git-"));
    try {
      writeFileSync(join(dir, "index.lock.json"), lockOf([]));
      expect(lockWrittenAt(join(dir, "index.lock.json"))).toEqual({ reason: expect.stringContaining("not in a git repository") });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a pin that cannot be fetched is undetermined", () => {
    const r = judge("f".repeat(40));
    expect(r.disagreements).toEqual([]);
    expect(exitCodeOf(r, undefined, { agreement: true })).toBe(2);
  });
});
