/**
 * `regen --changed <base>` and the narrowed fixpoint — bean `94zs`.
 *
 * The falsifier for both is one sentence: **a pair whose declared input
 * changed is never skipped.** Every test below is a case of it or of its
 * corollary, that not knowing is never a skip.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  affects,
  changedBaseFromArgv,
  changedSince,
  diffSnapshots,
  footprintOf,
  hasAgainstRef,
  patternHits,
  snapshotTree,
  type Footprint,
} from "../changed-paths.ts";
import { TRACKED, expandGlobs } from "../input-hash.ts";
import { regenArgs } from "../merge-base.ts";
import { exitCodeFor, regenToFixpoint, type Pair, type Runner } from "../regen-after-merge.ts";
import { TASK_IO, pairIO } from "../task-io.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = repoRootFor(join(HARNESS_ROOT));

function sh(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString();
}

/** A throwaway repository with a script, a module it imports, and inputs. */
function fixtureRepo(): { dir: string; scripts: Record<string, string>; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "changed-paths-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "src", "check.ts"), 'import { x } from "./lib.ts";\nconsole.log(x);\n');
  writeFileSync(join(dir, "src", "lib.ts"), "export const x = 1;\n");
  writeFileSync(join(dir, "src", "other.ts"), "export const y = 2;\n");
  writeFileSync(join(dir, "data", "a.json"), "{}\n");
  writeFileSync(join(dir, "unrelated.md"), "hi\n");
  const scripts = { "p:check": "bun src/check.ts --check", p: "bun src/check.ts" };
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts }, null, 2));
  sh(dir, "git", "init", "-q", "-b", "main");
  sh(dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  sh(dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "base");
  return { dir, scripts, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const NARROW = { inputs: ["data/**/*.json"], outputs: [] };

describe("an undeclared or {tracked} pair is never skipped", () => {
  test("no input declaration: always asked, even when nothing changed", () => {
    const fp = footprintOf(ROOT, {}, ["x:check"], { outputs: [] });
    expect(affects(fp, new Set()).affected).toBe(true);
    expect(affects(fp, new Set()).why).toMatch(/no input declaration/);
  });

  test("{tracked}: asked whenever ANY path changed", () => {
    const fp = footprintOf(ROOT, {}, ["x:check"], { inputs: [TRACKED], outputs: [] });
    expect(affects(fp, new Set(["anything/at/all.txt"])).affected).toBe(true);
  });

  test("{tracked} with nothing changed is the one honest skip — the tree it read is the tree", () => {
    const fp = footprintOf(ROOT, {}, ["x:check"], { inputs: [TRACKED], outputs: [] });
    expect(affects(fp, new Set()).affected).toBe(false);
  });

  test("a change set that could not be measured asks every pair", () => {
    const fp: Footprint = { patterns: ["a/*"], files: new Set(["a/b"]), dirs: new Set(["a"]), scriptNames: [] };
    expect(affects(fp, undefined).affected).toBe(true);
  });

  test("a footprint that cannot be computed is always asked (glob over nothing)", () => {
    const r = fixtureRepo();
    try {
      const fp = footprintOf(r.dir, r.scripts, ["p:check", "p"], { inputs: ["nothing/**/*.x"], outputs: [] });
      expect("always" in fp).toBe(true);
      expect(affects(fp, new Set(["unrelated.md"])).affected).toBe(true);
    } finally {
      r.cleanup();
    }
  });

  test("FALSIFIER: a narrowly declared pair passing --against is asked with NO path changed", () => {
    const r = fixtureRepo();
    try {
      const scripts = {
        "q:check": "bun src/check.ts --check --against main",
        q: "bun src/check.ts",
        // Nested through `bun run`, and the `=` spelling.
        "n:check": "bun run inner",
        inner: "bun src/check.ts --against=refs/heads/main",
      };
      for (const names of [["q:check", "q"], ["n:check"]]) {
        const fp = footprintOf(r.dir, scripts, names, NARROW);
        const a = affects(fp, new Set());
        expect(a.affected).toBe(true);
        expect(a.why).toMatch(/judges against a qa-reports baseline, which is not a path/);
      }
      // The control: the same pair without --against is skippable.
      expect(affects(footprintOf(r.dir, r.scripts, ["p:check", "p"], NARROW), new Set()).affected).toBe(false);
    } finally {
      r.cleanup();
    }
  });

  test("hasAgainstRef: both spellings, quoted, and absent", () => {
    expect(hasAgainstRef("bun x.ts --against main")).toBe(true);
    expect(hasAgainstRef('bun x.ts "--against=main"')).toBe(true);
    expect(hasAgainstRef("bun x.ts --againstish")).toBe(false);
    expect(hasAgainstRef(undefined)).toBe(false);
  });

  test("a command that is not a script file is always asked", () => {
    const r = fixtureRepo();
    try {
      const fp = footprintOf(r.dir, { "t:check": "tsc --noEmit" }, ["t:check"], NARROW);
      expect("always" in fp).toBe(true);
    } finally {
      r.cleanup();
    }
  });
});

describe("intersection selection over a declared footprint", () => {
  const r = fixtureRepo();
  const fp = footprintOf(r.dir, r.scripts, ["p:check", "p"], NARROW);
  r.cleanup();

  test("the footprint holds the declared files AND the script's import closure", () => {
    expect("files" in fp).toBe(true);
    if (!("files" in fp)) return;
    expect([...fp.files].sort()).toEqual(["data/a.json", "src/check.ts", "src/lib.ts"]);
  });

  test("an unrelated change is not asked, and says why", () => {
    const a = affects(fp, new Set(["unrelated.md", "src/other.ts"]));
    expect(a.affected).toBe(false);
    expect(a.why).toMatch(/none of 2 changed path/);
  });

  test("a declared input changed: asked", () => {
    expect(affects(fp, new Set(["unrelated.md", "data/a.json"])).affected).toBe(true);
  });

  test("an IMPORTED module changed: asked (the closure, not just the entry)", () => {
    expect(affects(fp, new Set(["src/lib.ts"])).affected).toBe(true);
  });

  test("a NEW or DELETED file under a declared glob: asked, though it is not in today's expansion", () => {
    expect(affects(fp, new Set(["data/new/deep.json"])).affected).toBe(true);
  });

  test("a changed directory or gitlink holding declared files: asked", () => {
    expect(affects(fp, new Set(["data"])).affected).toBe(true);
  });

  test("bun.lock changed: asked", () => {
    expect(affects(fp, new Set(["bun.lock"])).affected).toBe(true);
  });

  test("package.json: asked only when a command the pair runs changed — and when that cannot be told", () => {
    const changed = new Set(["package.json"]);
    expect(affects(fp, changed).affected).toBe(true);
    expect(affects(fp, changed, { scriptsChanged: () => true }).affected).toBe(true);
    expect(affects(fp, changed, { scriptsChanged: () => false }).affected).toBe(false);
  });
});

describe("FALSIFIER over the real declaration table: no declared input can change unseen", () => {
  // Every narrow (non-{tracked}) declaration in task-io.ts: changing ANY file
  // it expands to, or any file its pattern could name, must ask the pair.
  const scripts = existsSync(join(ROOT, "package.json"))
    ? (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { scripts: Record<string, string> }).scripts
    : scriptsOf(ROOT);
  const narrow = Object.entries(TASK_IO).filter(([, io]) => io.inputs !== undefined && !io.inputs.includes(TRACKED));

  test.each(narrow.map(([check]) => check))("%s: each declared file, changed alone, asks it", (check) => {
    const io = pairIO(check)!;
    const fp = footprintOf(ROOT, scripts, [check], io);
    if (!("files" in fp)) return; // always asked, or {tracked}: nothing narrow to falsify
    const files = expandGlobs(ROOT, [...(io.inputs ?? []), ...(io.outputs ?? [])]);
    expect("files" in files).toBe(true);
    if (!("files" in files)) return;
    expect(files.files.length).toBeGreaterThan(0);
    for (const f of files.files) expect(affects(fp, new Set([f])).affected).toBe(true);
    for (const f of fp.files) expect(affects(fp, new Set([f])).affected).toBe(true);
  });
});

describe("patternHits", () => {
  test("glob, plain file, path under a plain directory, and a directory above one", () => {
    expect(patternHits("a/**/*.md", "a/b/c.md")).toBe(true);
    expect(patternHits("a/**/*.md", "a/b/c.ts")).toBe(false);
    expect(patternHits("a/b.md", "a/b.md")).toBe(true);
    expect(patternHits("a/dir", "a/dir/x.ts")).toBe(true);
    expect(patternHits("a/dir/x.ts", "a/dir")).toBe(true);
    expect(patternHits("a/dir", "a/dirt")).toBe(false);
  });
});

describe("the change set is MEASURED from git", () => {
  test("changedSince: committed since the base, the working tree, and untracked files", () => {
    const r = fixtureRepo();
    try {
      const base = sh(r.dir, "git", "rev-parse", "HEAD").trim();
      writeFileSync(join(r.dir, "src", "lib.ts"), "export const x = 3;\n");
      sh(r.dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "lib");
      writeFileSync(join(r.dir, "data", "a.json"), '{"b":1}\n');
      writeFileSync(join(r.dir, "data", "new.json"), "{}\n");
      const ch = changedSince(r.dir, base);
      expect("paths" in ch).toBe(true);
      if (!("paths" in ch)) return;
      expect([...ch.paths].sort()).toEqual(["data/a.json", "data/new.json", "src/lib.ts"]);
    } finally {
      r.cleanup();
    }
  });

  test("changedSince: an unknown base is UNDETERMINED, never an empty change", () => {
    const r = fixtureRepo();
    try {
      expect("undetermined" in changedSince(r.dir, "no-such-ref")).toBe(true);
    } finally {
      r.cleanup();
    }
  });

  test("snapshots: what a writer changed, including reverting a dirty file to HEAD", () => {
    const r = fixtureRepo();
    try {
      writeFileSync(join(r.dir, "unrelated.md"), "dirty\n");
      const before = snapshotTree(r.dir)!;
      writeFileSync(join(r.dir, "unrelated.md"), "hi\n"); // back to HEAD's content
      writeFileSync(join(r.dir, "data", "a.json"), '{"c":1}\n');
      const after = snapshotTree(r.dir)!;
      expect([...diffSnapshots(before, after)].sort()).toEqual(["data/a.json", "unrelated.md"]);
      expect(diffSnapshots(after, snapshotTree(r.dir)!).size).toBe(0);
    } finally {
      r.cleanup();
    }
  });
});

describe("merge:main hands regen the fork point, or nothing", () => {
  test("a fork point becomes --changed; none (shallow, --full-regen) is the full run", () => {
    // Both lead with `--no-mount`: merge:main has just run `state:mount`
    // against the merged declarations, so regen must not mount again
    // (asserted from regen's side in regen-after-merge.test.ts).
    expect(regenArgs("abc123")).toEqual(["--no-mount", "--changed", "abc123"]);
    expect(regenArgs(undefined)).toEqual(["--no-mount"]);
  });

  test("the fork-point union sees a path EITHER side changed (bean lxpq's case)", () => {
    const r = fixtureRepo();
    const git = (...a: string[]) => sh(r.dir, "git", "-c", "user.email=t@t", "-c", "user.name=t", ...a);
    try {
      const fork = git("rev-parse", "HEAD").trim();
      git("checkout", "-qb", "side");
      writeFileSync(join(r.dir, "data", "a.json"), '{"main":1}\n');
      git("commit", "-qam", "main side");
      git("checkout", "-q", "main");
      writeFileSync(join(r.dir, "src", "lib.ts"), "export const x = 9;\n");
      git("commit", "-qam", "branch side");
      git("merge", "--no-ff", "--no-commit", "side"); // uncommitted, as merge-base.ts leaves it
      const ch = changedSince(r.dir, fork);
      expect("paths" in ch).toBe(true);
      if (!("paths" in ch)) return;
      expect([...ch.paths].sort()).toEqual(["data/a.json", "src/lib.ts"]);
    } finally {
      r.cleanup();
    }
  });
});

describe("--changed argv", () => {
  test("both spellings, absent, and a missing value", () => {
    expect(changedBaseFromArgv(["--changed", "abc"])).toBe("abc");
    expect(changedBaseFromArgv(["--changed=abc"])).toBe("abc");
    expect(changedBaseFromArgv(["--explain"])).toBeUndefined();
    expect(() => changedBaseFromArgv(["--changed", "--explain"])).toThrow();
  });
});

describe("the fixpoint with --changed and narrowing", () => {
  /**
   * Files are a map; a check is current when its output equals what it
   * derives from. `b` writes `bOut`, which `a` reads. `c` reads only `cIn`.
   * Each pair's footprint is the set of keys it reads.
   */
  function world() {
    const f: Record<string, number> = { bIn: 1, bOut: 0, aOut: 0, cIn: 0, cOut: 0 };
    const reads: Record<string, string[]> = {
      "a:check": ["bOut", "aOut"],
      "b:check": ["bIn", "bOut"],
      "c:check": ["cIn", "cOut"],
    };
    const asked: string[] = [];
    const scripts: Record<string, () => boolean> = {
      "a:check": () => f.aOut === f.bOut,
      a: () => ((f.aOut = f.bOut), true),
      "b:check": () => f.bOut === f.bIn,
      b: () => ((f.bOut = f.bIn), true),
      "c:check": () => f.cOut === f.cIn,
      c: () => ((f.cOut = f.cIn), true),
    };
    const runner: Runner = (s) => {
      asked.push(s);
      return scripts[s]!();
    };
    const narrow = {
      begin: () => {
        const before = { ...f };
        return () => new Set(Object.keys(f).filter((k) => f[k] !== before[k]));
      },
      affects: (pair: Pair, changed: ReadonlySet<string> | undefined) => {
        if (changed === undefined) return { affected: true, why: "unmeasured" };
        const hit = reads[pair.check]!.some((k) => changed.has(k));
        return { affected: hit, why: hit ? "read a changed key" : "read nothing that changed" };
      },
    };
    return { f, asked, runner, narrow };
  }
  const pairs: Pair[] = [
    { check: "a:check", writer: "a" },
    { check: "b:check", writer: "b" },
    { check: "c:check", writer: "c" },
  ];

  test("the second pass asks only what the first pass's writes touched — and still settles", async () => {
    const w = world();
    const r = await regenToFixpoint(pairs, w.runner, 6, { narrow: w.narrow });
    expect(r.settled).toBe(true);
    expect(w.f.aOut).toBe(w.f.bOut);
    // Pass 1 asks all three; b writes bOut. Pass 2 asks a and b (they read
    // bOut), NOT c. a writes aOut. Pass 3 asks only a, which is current.
    const checksAsked = w.asked.filter((s) => s.endsWith(":check"));
    expect(checksAsked.filter((s) => s === "c:check")).toHaveLength(1);
    expect(r.passes).toBe(3);
    expect(r.results.map((x) => x.outcome)).toEqual(["regenerated", "regenerated", "current"]);
    expect(r.results[2]!.assumed).toBeUndefined(); // c WAS asked, in pass 1
  });

  test("an unmeasurable change re-asks everyone", async () => {
    const w = world();
    const r = await regenToFixpoint(pairs, w.runner, 6, {
      narrow: { begin: () => () => undefined, affects: w.narrow.affects },
    });
    expect(r.settled).toBe(true);
    expect(w.asked.filter((s) => s === "c:check").length).toBe(r.passes);
  });

  test("--changed: an untouched pair is not asked and is marked ASSUMED; a touched one is", async () => {
    const w = world();
    const r = await regenToFixpoint(pairs, w.runner, 6, {
      narrow: w.narrow,
      firstPass: (p) => w.narrow.affects(p, new Set(["bIn"])),
    });
    expect(r.settled).toBe(true);
    expect(w.asked).not.toContain("c:check");
    expect(r.results[2]).toMatchObject({ outcome: "current", assumed: true });
    // b's input changed: never skipped. Its write then reaches a.
    expect(w.asked).toContain("b:check");
    expect(w.f.aOut).toBe(w.f.bOut);
  });

  test("FALSIFIER: --changed naming a pair's input never skips it, even when every other pair is skipped", async () => {
    for (const key of ["bIn", "bOut", "aOut", "cIn", "cOut"]) {
      const w = world();
      w.f.cIn = 5; // c is stale; only a change set naming cIn or cOut may reach it
      await regenToFixpoint(pairs, w.runner, 6, {
        narrow: w.narrow,
        firstPass: (p) => w.narrow.affects(p, new Set([key])),
      });
      if (key === "cIn" || key === "cOut") expect(w.f.cOut).toBe(5);
      else expect(w.asked).not.toContain("c:check");
    }
  });

  // ── A BARREN pass settles (bean `xpcu`, 2026-10-06) ──────────────────
  // Measured: `fsh-guts:viz` exits non-zero on every pass, and the run went to
  // the pass cap re-asking every undeclared pair, then recorded no hash.
  describe("a pass whose writers repaired nothing and changed nothing settles", () => {
    /** `d:check` always fails; its writer is broken. `touch` says whether the broken writer edits a file anyway. */
    function broken(w: ReturnType<typeof world>, opts: { exits: boolean; touch?: boolean }): Runner {
      return (s) => {
        if (s === "d:check") return (w.asked.push(s), false);
        if (s === "d") {
          w.asked.push(s);
          if (opts.touch) w.f.cIn += 1; // a partial write before failing
          return opts.exits;
        }
        return w.runner(s);
      };
    }
    // `d` reads everything, like an undeclared pair: always re-asked.
    const withD: Pair[] = [...pairs, { check: "d:check", writer: "d" }];
    const narrowAll = (w: ReturnType<typeof world>) => ({
      begin: w.narrow.begin,
      affects: (p: Pair, ch: ReadonlySet<string> | undefined) =>
        p.check === "d:check" ? { affected: true, why: "undeclared" } : w.narrow.affects(p, ch),
    });

    test("a writer that FAILS and changes nothing: settled at the first barren pass, verdict kept", async () => {
      const w = world();
      let barren = 0;
      const r = await regenToFixpoint(withD, broken(w, { exits: false }), 6, {
        narrow: narrowAll(w),
        onBarren: () => barren++,
      });
      expect(r.settled).toBe(true);
      expect(barren).toBe(1);
      // Pass 1 repairs b and a; pass 2 repairs a; pass 3 is barren (only d).
      expect(r.passes).toBeLessThan(6);
      expect(r.results[3]!.outcome).toBe("writer-failed");
      expect(exitCodeFor({ results: r.results, settled: r.settled }).code).toBe(1); // never a clean exit
    });

    test("an UNREPAIRED writer (exits 0, check still red) that changes nothing settles too", async () => {
      const w = world();
      const r = await regenToFixpoint(withD, broken(w, { exits: true }), 6, { narrow: narrowAll(w) });
      expect(r.settled).toBe(true);
      expect(r.results[3]!.outcome).toBe("unrepaired");
    });

    test("FALSIFIER: a failing writer that CHANGES the tree is not barren — the run goes on", async () => {
      const w = world();
      const r = await regenToFixpoint(withD, broken(w, { exits: false, touch: true }), 4, { narrow: narrowAll(w) });
      expect(r.settled).toBe(false);
      expect(r.passes).toBe(4);
    });

    test("FALSIFIER: an unmeasurable change set never settles a pass that ran a writer", async () => {
      const w = world();
      const r = await regenToFixpoint(withD, broken(w, { exits: false }), 4, {
        narrow: { begin: () => () => undefined, affects: () => ({ affected: true, why: "unmeasured" }) },
      });
      expect(r.settled).toBe(false);
    });

    test("FALSIFIER: a pass that REPAIRED something is never barren, even with no measured change", async () => {
      // A writer whose effect the snapshot cannot see (an ignored file) yet
      // turned its check green: the next pass must still run.
      const f = { fixed: false };
      let asks = 0;
      const runner: Runner = (s) => (s === "p:check" ? (asks++, f.fixed) : ((f.fixed = true), true));
      const r = await regenToFixpoint([{ check: "p:check", writer: "p" }], runner, 6, {
        narrow: { begin: () => () => new Set<string>(), affects: () => ({ affected: true, why: "x" }) },
      });
      expect(r.settled).toBe(true);
      expect(r.passes).toBe(2); // pass 1 regenerated; pass 2 ran no writer
      expect(asks).toBe(3);
    });
  });

  test("without hooks every pass asks every pair — the old behaviour", async () => {
    const w = world();
    const r = await regenToFixpoint(pairs, w.runner, 6);
    expect(w.asked.filter((s) => s === "c:check").length).toBe(r.passes);
  });
});
