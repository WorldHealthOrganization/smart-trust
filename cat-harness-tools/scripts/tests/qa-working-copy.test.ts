/**
 * The QA working copy says which tree it was built from, and regen rebuilds
 * it before any pass that would read a stale one — bean `7how`.
 *
 * The falsifier is one sentence: **a generator never reads a QA copy built
 * from another tree.** The state tests check the stamp can tell; the fixpoint
 * tests check regen acts on it, including when `--changed` would otherwise
 * not ask the pair that reads it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BUILDING_ENV, STAMP_PATH, ensureWorkingCopy, qaChanged, requireCurrentWorkingCopy, workingCopyState } from "../qa-working-copy.ts";
import { regenToFixpoint, type Pair, type Runner } from "../regen-after-merge.ts";

function sh(cwd: string, ...args: string[]): void {
  const r = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${args.join(" ")}: ${r.stderr.toString()}`);
}

/**
 * A repository whose "QA writer" copies `src.txt` into the ignored `qa/`
 * root — so the copy is a function of the tree, as the real one is.
 */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "qa-working-copy-"));
  sh(dir, "git", "init", "-q");
  writeFileSync(join(dir, ".gitignore"), "qa/\nbuild/\n");
  writeFileSync(join(dir, "src.txt"), "one\n");
  sh(dir, "git", "add", "-A");
  sh(dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const build = ["sh", "-c", "mkdir -p qa && cp src.txt qa/copy.txt"];
  const opts = { roots: ["qa"], steps: [build], stdio: "pipe" as const };
  return { dir, opts, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the stamp says which tree the copy was built from", () => {
  test("no stamp is STALE, never current — a copy nobody stamped could be from any tree", () => {
    const f = fixture();
    try {
      mkdirSync(join(f.dir, "qa"));
      writeFileSync(join(f.dir, "qa", "copy.txt"), "one\n");
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("stale");
    } finally {
      f.cleanup();
    }
  });

  test("built here, nothing moved: CURRENT, and a second ensure builds nothing", () => {
    const f = fixture();
    try {
      const r = ensureWorkingCopy(f.dir, f.opts);
      expect(r).toMatchObject({ ran: true, ok: true });
      expect(r.ran && r.ok && [...r.changed]).toEqual(["qa/copy.txt"]);
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("current");
      expect(ensureWorkingCopy(f.dir, f.opts).ran).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  test("a tracked edit makes it STALE, and ensure rebuilds and reports what changed", () => {
    const f = fixture();
    try {
      ensureWorkingCopy(f.dir, f.opts);
      writeFileSync(join(f.dir, "src.txt"), "two\n");
      expect(workingCopyState(f.dir, ["qa"])).toMatchObject({ state: "stale", why: expect.stringContaining("tree changed") });
      const r = ensureWorkingCopy(f.dir, f.opts);
      expect(r.ran && r.ok && [...r.changed]).toEqual(["qa/copy.txt"]);
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("current");
    } finally {
      f.cleanup();
    }
  });

  test("COMMITTING does not stale the copy — the digest is of content, not of git's bookkeeping", () => {
    const f = fixture();
    try {
      writeFileSync(join(f.dir, "src.txt"), "two\n");
      writeFileSync(join(f.dir, "new.txt"), "x\n");
      ensureWorkingCopy(f.dir, f.opts);
      sh(f.dir, "git", "add", "-A");
      sh(f.dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "merge");
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("current");
    } finally {
      f.cleanup();
    }
  });

  test("an untracked, non-ignored file is part of the tree too", () => {
    const f = fixture();
    try {
      ensureWorkingCopy(f.dir, f.opts);
      writeFileSync(join(f.dir, "new.txt"), "x\n");
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("stale");
    } finally {
      f.cleanup();
    }
  });

  test("the copy edited or partly deleted since it was built is STALE (the #2267 partial tree)", () => {
    const f = fixture();
    try {
      ensureWorkingCopy(f.dir, f.opts);
      writeFileSync(join(f.dir, "qa", "copy.txt"), "hand edit\n");
      expect(workingCopyState(f.dir, ["qa"])).toMatchObject({ state: "stale", why: expect.stringContaining("QA tree changed") });
      ensureWorkingCopy(f.dir, f.opts);
      unlinkSync(join(f.dir, "qa", "copy.txt"));
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("stale");
    } finally {
      f.cleanup();
    }
  });

  test("a failed step leaves NO stamp, so a half-built copy never reads as current", () => {
    const f = fixture();
    try {
      ensureWorkingCopy(f.dir, f.opts);
      writeFileSync(join(f.dir, "src.txt"), "two\n");
      const r = ensureWorkingCopy(f.dir, { ...f.opts, steps: [["sh", "-c", "exit 3"]] });
      expect(r).toMatchObject({ ran: true, ok: false, exit: 3 });
      expect(existsSync(join(f.dir, STAMP_PATH))).toBe(false);
      expect(workingCopyState(f.dir, ["qa"]).state).toBe("stale");
    } finally {
      f.cleanup();
    }
  });

  test("force builds even when current", () => {
    const f = fixture();
    try {
      ensureWorkingCopy(f.dir, f.opts);
      expect(ensureWorkingCopy(f.dir, { ...f.opts, force: true }).ran).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  test("a generator running INSIDE a build does not ask for another (no recursion through readme:subgraphs)", () => {
    const f = fixture();
    const prev = process.env[BUILDING_ENV];
    try {
      process.env[BUILDING_ENV] = "1";
      requireCurrentWorkingCopy(f.dir, "test");
      expect(existsSync(join(f.dir, STAMP_PATH))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env[BUILDING_ENV];
      else process.env[BUILDING_ENV] = prev;
      f.cleanup();
    }
  });

  test("a build's steps run with the building flag set", () => {
    const f = fixture();
    try {
      const r = ensureWorkingCopy(f.dir, { ...f.opts, steps: [["sh", "-c", `test "$${BUILDING_ENV}" = 1`]] });
      expect(r).toMatchObject({ ran: true, ok: true });
    } finally {
      f.cleanup();
    }
  });

  test("qaChanged sees edits, additions and deletions", () => {
    const a = new Map([["x", "1"], ["y", "2"]]);
    const b = new Map([["x", "1"], ["y", "3"], ["z", "4"]]);
    expect([...qaChanged(a, b)].sort()).toEqual(["y", "z"]);
    expect([...qaChanged(b, a)].sort()).toEqual(["y", "z"]);
  });
});

describe("regen rebuilds the copy before a pass reads it", () => {
  /**
   * `src` is tracked; `qa` is the copy built from it (by `beforePass`, as
   * `ensureWorkingCopy` does); `u:check` is uml:overview — it reads `qa` and
   * owns `uOut`. `s:check` owns `src` itself, standing in for any regen
   * writer that changes something the QA writers read.
   */
  function world(init: { src: number; qa: number; uOut: number; sWant: number }) {
    const f = { ...init };
    let built = init.qa === init.src ? init.src : undefined;
    const reads: Record<string, string[]> = { "u:check": ["qa", "uOut"], "s:check": ["src"] };
    const asked: string[] = [];
    const scripts: Record<string, () => boolean> = {
      "u:check": () => f.uOut === f.qa,
      u: () => ((f.uOut = f.qa), true),
      "s:check": () => f.src === f.sWant,
      s: () => ((f.src = f.sWant), true),
    };
    const runner: Runner = (s) => {
      asked.push(s);
      return scripts[s]!();
    };
    const narrow = {
      begin: () => {
        const before = { ...f };
        return () => new Set(Object.keys(f).filter((k) => k !== "qa" && f[k as keyof typeof f] !== before[k as keyof typeof f]));
      },
      affects: (pair: Pair, changed: ReadonlySet<string> | undefined) => {
        if (changed === undefined) return { affected: true, why: "unmeasured" };
        const hit = reads[pair.check]!.some((k) => changed.has(k));
        return { affected: hit, why: hit ? "read a changed key" : "read nothing that changed" };
      },
    };
    const builds: number[] = [];
    const beforePass = (pass: number) => {
      if (built === f.src) return undefined;
      builds.push(pass);
      const old = f.qa;
      f.qa = f.src;
      built = f.src;
      return old === f.qa ? new Set<string>() : new Set(["qa"]);
    };
    return { f, asked, runner, narrow, beforePass, builds };
  }
  const pairs: Pair[] = [
    { check: "s:check", writer: "s" },
    { check: "u:check", writer: "u" },
  ];

  test("FALSIFIER: a writer changes what the QA copy is built from — the copy is rebuilt and its reader re-asked", async () => {
    const w = world({ src: 1, qa: 1, uOut: 1, sWant: 2 });
    const r = await regenToFixpoint(pairs, w.runner, 6, { narrow: w.narrow, beforePass: w.beforePass });
    expect(r.settled).toBe(true);
    expect(w.builds).toEqual([2]);
    expect(w.f).toMatchObject({ src: 2, qa: 2, uOut: 2 });
    expect(r.results.map((x) => x.outcome)).toEqual(["regenerated", "regenerated"]);
  });

  test("without the hook the same run settles on a page built from the OLD copy — what the hook prevents", async () => {
    const w = world({ src: 1, qa: 1, uOut: 1, sWant: 2 });
    const r = await regenToFixpoint(pairs, w.runner, 6, { narrow: w.narrow });
    expect(r.settled).toBe(true);
    expect(w.f.uOut).toBe(1); // stale: src is 2
  });

  test("a stale copy at the start is rebuilt in pass 1 and its reader asked though --changed declined it", async () => {
    const w = world({ src: 2, qa: 1, uOut: 1, sWant: 2 });
    const r = await regenToFixpoint(pairs, w.runner, 6, {
      narrow: w.narrow,
      beforePass: w.beforePass,
      firstPass: () => ({ affected: false, why: "--changed: untouched" }),
    });
    expect(w.builds).toEqual([1]);
    expect(w.f.uOut).toBe(2);
    expect(r.results.find((x) => x.check === "u:check")?.outcome).toBe("regenerated");
    expect(r.settled).toBe(true);
  });

  test("a current copy builds nothing and changes no selection", async () => {
    const w = world({ src: 2, qa: 2, uOut: 2, sWant: 2 });
    const r = await regenToFixpoint(pairs, w.runner, 6, { narrow: w.narrow, beforePass: w.beforePass });
    expect(w.builds).toEqual([]);
    expect(r.passes).toBe(1);
    expect(r.results.map((x) => x.outcome)).toEqual(["current", "current"]);
  });

  test("a copy that cannot be built ends the run — it is never read half-built", async () => {
    const w = world({ src: 1, qa: 1, uOut: 1, sWant: 2 });
    const failing = (pass: number) => {
      if (pass > 1) throw new Error("qa:refresh exited 1");
      return undefined;
    };
    await expect(regenToFixpoint(pairs, w.runner, 6, { narrow: w.narrow, beforePass: failing })).rejects.toThrow("qa:refresh");
  });
});
