/**
 * Bean `xpcu` — the regen/gates worker pool and input-hash skipping.
 *
 * The four properties the steward asked to be pinned: a pair whose inputs are
 * unchanged is skipped; a pair whose inputs cannot be determined RUNS; pairs
 * with overlapping (or undeclared) outputs never run at the same time; and
 * output comes out in the original order whatever order the work finishes in.
 *
 * "every declared script exists in package.json" lives in
 * `test/task-pool-checkout.test.ts` (bean `ho66`): `TASK_IO` names scripts
 * declared by layers above cat-harness, which only the whole checkout's
 * script table holds.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  conflicts,
  jobsFromArgv,
  orderedEmitter,
  pathsOverlap,
  runPool,
  type PoolTask,
} from "../task-pool.ts";
import {
  cacheEnabled,
  decide,
  entryFiles,
  FileDigests,
  fingerprint,
  againstRefsOf,
  loadCache,
  RECIPE_VERSION,
  recordCheckRun,
  saveCache,
  sourceClosure,
  TRACKED,
  type BaselineResolver,
  type HashCache,
  type PairIO,
} from "../input-hash.ts";
import {
  cacheKey,
  hashesToRecord,
  pairSkip,
  regenPass,
  regenToFixpoint,
  type Pair,
  type Result,
  type Runner,
} from "../regen-after-merge.ts";
import { GateSkipper, gateSegments, type Gate } from "../gates.ts";
import { TASK_IO, collectTaskIo, pairIO, gateReadsOnly } from "../task-io.ts";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("input-hash skipping", () => {
  let root: string;
  const scripts = { "x:check": "bun run scripts/x.ts --check", x: "bun run scripts/x.ts" };
  const io = { inputs: ["src/**/*.md"], outputs: ["out/x.json"] };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "xpcu-"));
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "out"));
    writeFileSync(join(root, "scripts", "x.ts"), 'import { y } from "./y.ts";\nconsole.log(y);\n');
    writeFileSync(join(root, "scripts", "y.ts"), "export const y = 1;\n");
    writeFileSync(join(root, "src", "a.md"), "alpha\n");
    writeFileSync(join(root, "out", "x.json"), "{}\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const fp = () => fingerprint(root, scripts, ["x:check", "x"], io);

  test("an unchanged tree hashes the same, so the recorded pair is SKIPPED", () => {
    const first = fp();
    expect("hash" in first).toBe(true);
    const cache: HashCache = { version: 1, pairs: { k: (first as { hash: string }).hash } };
    const d = decide(cache, "k", fp());
    expect(d.skip).toBe(true);
    expect(d.why).toContain("unchanged");
  });

  test("a changed input, output, script, or IMPORTED module changes the hash, so it runs", () => {
    const base = (fp() as { hash: string }).hash;
    const cache: HashCache = { version: 1, pairs: { k: base } };
    for (const [file, text] of [
      ["src/a.md", "beta\n"],
      ["out/x.json", '{"edited":true}\n'],
      ["scripts/x.ts", 'import { y } from "./y.ts";\nconsole.log(y, 2);\n'],
      ["scripts/y.ts", "export const y = 2;\n"],
    ] as const) {
      writeFileSync(join(root, file), text);
      const d = decide(cache, "k", fp());
      expect(d.skip, `editing ${file} must invalidate`).toBe(false);
      expect(d.why).toContain("changed");
    }
  });

  test("a new file under a declared glob changes the hash", () => {
    const base = (fp() as { hash: string }).hash;
    writeFileSync(join(root, "src", "b.md"), "new\n");
    expect(decide({ version: 1, pairs: { k: base } }, "k", fp()).skip).toBe(false);
  });

  test("the closure follows relative imports and records the script itself", () => {
    const e = entryFiles(root, scripts, "x:check");
    expect(e).toEqual(["scripts/x.ts"]);
    expect(sourceClosure(root, e!)).toEqual({ files: ["scripts/x.ts", "scripts/y.ts"] });
  });

  test("an import written inside a template literal is text, not an edge", () => {
    writeFileSync(
      join(root, "scripts", "y.ts"),
      'export const y = 2;\nexport const shim = (d: string) => `export * from "../../${d}/schemas/builders";\n`;\n',
    );
    expect(sourceClosure(root, ["scripts/x.ts"])).toEqual({ files: ["scripts/x.ts", "scripts/y.ts"] });
  });

  test("an unresolvable literal import still makes the closure undetermined", () => {
    writeFileSync(join(root, "scripts", "y.ts"), 'import { z } from "./nowhere.ts";\nexport const y = z;\n');
    const c = sourceClosure(root, ["scripts/x.ts"]);
    expect("undetermined" in c && c.undetermined).toContain("imports unresolvable ./nowhere.ts");
  });

  describe("COULD NOT DETERMINE is never clean — the pair runs", () => {
    const cacheWith = (h: string): HashCache => ({ version: 1, pairs: { k: h } });

    test("no input declaration", () => {
      const f = fingerprint(root, scripts, ["x:check"], undefined);
      expect("undetermined" in f).toBe(true);
      const d = decide(cacheWith("anything"), "k", f);
      expect(d.skip).toBe(false);
      expect(d.why).toContain("could not be determined");
    });

    test("a declared glob that matches nothing", () => {
      const f = fingerprint(root, scripts, ["x:check"], { inputs: ["nowhere/**/*.md"], outputs: [] });
      expect(f).toEqual({ undetermined: "declared glob nowhere/**/*.md matches no file" });
      expect(decide(cacheWith("x"), "k", f).skip).toBe(false);
    });

    test("a command that is not a readable script (a binary)", () => {
      const f = fingerprint(root, { "t:check": "tsc --noEmit" }, ["t:check"], io);
      expect("undetermined" in f).toBe(true);
    });

    test("a non-literal dynamic import, whose target cannot be followed", () => {
      writeFileSync(join(root, "scripts", "y.ts"), "const m = 'z';\nexport const y = await import(`./${m}.ts`);\n");
      const f = fp();
      expect("undetermined" in f && f.undetermined).toContain("non-literal dynamic import");
    });

    test("an unreadable cache is an EMPTY cache: everything runs", () => {
      mkdirSync(join(root, "build", "regen-cache"), { recursive: true });
      writeFileSync(join(root, "build", "regen-cache", "input-hashes.json"), "{not json");
      const c = loadCache(root);
      expect(c.pairs).toEqual({});
      expect(decide(c, "k", fp()).skip).toBe(false);
    });
  });

  describe("an --against baseline is an input the tree does not hold", () => {
    const against = { "b:check": "bun run scripts/x.ts --check --against main", b: "bun run scripts/x.ts" };
    const resolverFor = (ids: Record<string, string>): BaselineResolver => (ref) =>
      ids[ref] !== undefined ? { id: ids[ref]! } : { undetermined: `miss: no entry for ${ref}` };
    const fpWith = (r?: BaselineResolver) => fingerprint(root, against, ["b:check", "b"], io, undefined, r);

    test("the refs a command passes are found, through `bun run` nesting and `=`", () => {
      expect(againstRefsOf(against, "b:check")).toEqual(["main"]);
      expect(againstRefsOf(against, "b")).toEqual([]);
      const nested = { outer: "bun run inner && bun run scripts/x.ts --against=pr/7", inner: "bun run scripts/x.ts --check --against main" };
      expect(againstRefsOf(nested, "outer")).toEqual(["main", "pr/7"]);
      expect(againstRefsOf({ bad: "bun run scripts/x.ts --against --check" }, "bad")).toEqual([""]);
    });

    test("a MOVED baseline changes the hash although no file did, so the pair runs", () => {
      const before = fpWith(resolverFor({ main: "main/aaa tree1" }));
      expect("hash" in before).toBe(true);
      const cache: HashCache = { version: RECIPE_VERSION, pairs: { k: (before as { hash: string }).hash } };
      expect(decide(cache, "k", fpWith(resolverFor({ main: "main/aaa tree1" }))).skip).toBe(true);
      expect(decide(cache, "k", fpWith(resolverFor({ main: "main/bbb tree2" }))).skip).toBe(false);
    });

    test("a baseline that cannot be resolved is undetermined, never clean", () => {
      const f = fpWith(resolverFor({}));
      expect("undetermined" in f && f.undetermined).toContain("baseline --against main");
      expect(decide({ version: RECIPE_VERSION, pairs: { k: "x" } }, "k", f).skip).toBe(false);
    });

    test("no resolver at all is undetermined too — the pair runs", () => {
      const f = fpWith(undefined);
      expect("undetermined" in f && f.undetermined).toContain("no resolver");
    });

    test("a pair that passes no --against is unaffected by the resolver", () => {
      const a = fingerprint(root, scripts, ["x:check", "x"], io, undefined, resolverFor({}));
      expect(a).toEqual(fp());
    });
  });

  test("the cache round-trips through build/ (ignored by version control)", () => {
    saveCache(root, { version: RECIPE_VERSION, pairs: { k: "abc" } });
    expect(loadCache(root).pairs).toEqual({ k: "abc" });
  });

  test("CI and --no-cache disable the cache, so CI behaviour is unchanged", () => {
    expect(cacheEnabled([], {})).toBe(true);
    expect(cacheEnabled([], { CI: "true" })).toBe(false);
    expect(cacheEnabled([], { CI: "1" })).toBe(false);
    expect(cacheEnabled([], { CI: "false" })).toBe(true);
    expect(cacheEnabled(["--no-cache"], {})).toBe(false);
    expect(decide(undefined, "k", fp()).skip).toBe(false);
  });
});

describe("regen with skipping wired in", () => {
  test("a skipped pair is reported current+skipped and its check is NOT run", async () => {
    const ran: string[] = [];
    const runner: Runner = (s) => (ran.push(s), true);
    const pairs: Pair[] = [
      { check: "a:check", writer: "a", io: { inputs: ["x"], outputs: ["a"] } },
      { check: "b:check", writer: "b" },
    ];
    const r = await regenPass(pairs, runner, {
      skip: (p) => (p.check === "a:check" ? { skip: true, why: "unchanged" } : { skip: false, why: "undeclared" }),
    });
    expect(ran).toEqual(["b:check"]);
    expect(r.results[0]).toEqual({ check: "a:check", writer: "a", outcome: "current", skipped: true });
  });

  test("hashes are recorded only for green pairs in a SETTLED run", () => {
    const pairs: Pair[] = [
      { check: "a:check", writer: "a" },
      { check: "b:check", writer: "b" },
      { check: "c:check", writer: "c" },
    ];
    const results = [
      { check: "a:check", writer: "a", outcome: "current" as const },
      { check: "b:check", writer: "b", outcome: "unrepaired" as const },
      { check: "c:check", writer: "c", outcome: "current" as const },
    ];
    const fpOf = (p: Pair) => (p.check === "c:check" ? { undetermined: "no decl" } : { hash: `h-${p.check}`, files: 1 });
    const prev: HashCache = { version: 1, pairs: { [cacheKey(pairs[1]!)]: "old", [cacheKey(pairs[2]!)]: "old" } };
    const settled = hashesToRecord(pairs, results, true, fpOf, prev);
    expect(settled.pairs).toEqual({ [cacheKey(pairs[0]!)]: "h-a:check" });
    // A run that did NOT settle records nothing new and drops what it touched.
    expect(hashesToRecord(pairs, results, false, fpOf, prev).pairs).toEqual({});
  });
});

describe("overlap serialization", () => {
  test("glob prefixes decide overlap, conservatively", () => {
    expect(pathsOverlap(["docs/a/*.md"], ["docs/**"])).toBe(true);
    expect(pathsOverlap(["docs/a.md"], ["docs/a.md"])).toBe(true);
    expect(pathsOverlap(["docs/a/**"], ["docs/b/**"])).toBe(false);
    expect(pathsOverlap(["out/x.json"], ["out/y.json"])).toBe(false);
  });

  test("an UNDECLARED output conflicts with everything; a reader conflicts with a writer of its inputs", () => {
    expect(conflicts({ outputs: undefined }, { outputs: [] })).toBe(true);
    expect(conflicts({ outputs: [] }, { outputs: [] })).toBe(false);
    expect(conflicts({ outputs: ["a/**"] }, { outputs: ["b/**"], inputs: ["a/x.json"] })).toBe(true);
    expect(conflicts({ outputs: ["b/**"], inputs: ["a/x.json"] }, { outputs: ["a/**"] })).toBe(true);
  });

  /** Tasks that record how many of a group are inside their run at once. */
  function tracked(specs: { id: string; outputs: string[] | undefined; ms: number }[]) {
    const live = new Set<string>();
    const overlaps: [string, string][] = [];
    let peak = 0;
    const tasks: PoolTask<string>[] = specs.map((s) => ({
      id: s.id,
      outputs: s.outputs,
      run: async () => {
        for (const other of live) overlaps.push([other, s.id]);
        live.add(s.id);
        peak = Math.max(peak, live.size);
        await tick(s.ms);
        live.delete(s.id);
        return s.id;
      },
    }));
    return { tasks, overlaps, peak: () => peak };
  }

  test("disjoint declared outputs DO run concurrently", async () => {
    const t = tracked([
      { id: "a", outputs: ["a/**"], ms: 30 },
      { id: "b", outputs: ["b/**"], ms: 30 },
      { id: "c", outputs: ["c/**"], ms: 30 },
    ]);
    await runPool(t.tasks, 3);
    expect(t.peak()).toBe(3);
  });

  test("overlapping outputs never run together, and keep their order", async () => {
    const order: string[] = [];
    const t = tracked([
      { id: "w1", outputs: ["docs/**"], ms: 40 },
      { id: "free", outputs: ["other/**"], ms: 5 },
      { id: "w2", outputs: ["docs/page.md"], ms: 5 },
    ]);
    await runPool(t.tasks, 4, (_i, id) => order.push(id));
    expect(t.overlaps.some(([a, b]) => [a, b].sort().join() === "w1,w2")).toBe(false);
    expect(order.indexOf("w1")).toBeLessThan(order.indexOf("w2"));
    // ...while the unrelated one did overlap w1.
    expect(t.overlaps.some(([a, b]) => [a, b].sort().join() === "free,w1")).toBe(true);
  });

  test("an UNDECLARED task runs alone: a barrier with nothing beside it", async () => {
    const t = tracked([
      { id: "a", outputs: ["a/**"], ms: 20 },
      { id: "u", outputs: undefined, ms: 20 },
      { id: "b", outputs: ["b/**"], ms: 20 },
    ]);
    await runPool(t.tasks, 4);
    expect(t.overlaps.filter(([x, y]) => x === "u" || y === "u")).toEqual([]);
    expect(t.overlaps).toEqual([]);
  });

  test("regen: a WRITER never runs beside a check or another writer, and writers keep pair order", async () => {
    // Four read-only-declared pairs; b and d are stale. Their checks share the
    // pool, but each writer (and its re-ask) must run with nothing else live.
    const live = new Set<string>();
    const besideWriter: string[] = [];
    const order: string[] = [];
    let writerLive = false;
    const stale = new Set(["b", "d"]);
    const runner: Runner = async (s) => {
      const isWriter = !s.endsWith(":check");
      if (writerLive || (isWriter && live.size > 0)) besideWriter.push(s);
      if (isWriter) writerLive = true;
      live.add(s);
      order.push(s);
      await tick(isWriter ? 15 : s === "a:check" ? 25 : 5);
      live.delete(s);
      if (isWriter) {
        writerLive = false;
        stale.delete(s);
        return true;
      }
      return !stale.has(s.slice(0, -":check".length));
    };
    const pairs: Pair[] = ["a", "b", "c", "d"].map((n) => ({ check: `${n}:check`, writer: n, io: { outputs: [] } }));
    const r = await regenPass(pairs, runner, { jobs: 4 });
    expect(besideWriter).toEqual([]);
    expect(order.filter((s) => !s.endsWith(":check"))).toEqual(["b", "d"]);
    expect(r.results.map((x) => x.outcome)).toEqual(["current", "regenerated", "current", "regenerated"]);
  });

  test("regen pairs without declarations reproduce the serial order exactly", async () => {
    const calls: string[] = [];
    const runner: Runner = async (s) => {
      calls.push(s);
      await tick(1);
      return !s.endsWith(":check") || s !== "b:check" || calls.includes("b");
    };
    await regenPass(
      [
        { check: "a:check", writer: "a" },
        { check: "b:check", writer: "b" },
        { check: "c:check", writer: "c" },
      ],
      runner,
      { jobs: 4 },
    );
    expect(calls).toEqual(["a:check", "b:check", "b", "b:check", "c:check"]);
  });
});

describe("output order is the original order", () => {
  test("orderedEmitter holds a fast late task until every earlier one has printed", () => {
    const out: number[] = [];
    const e = orderedEmitter<string>((i) => out.push(i));
    e.push(2, "c");
    e.push(1, "b");
    expect(out).toEqual([]);
    e.push(0, "a");
    expect(out).toEqual([0, 1, 2]);
    e.push(3, "d");
    expect(out).toEqual([0, 1, 2, 3]);
  });

  test("runPool resolves in INPUT order though tasks finish in reverse", async () => {
    const tasks: PoolTask<number>[] = [40, 30, 20, 10].map((ms, i) => ({
      id: String(i),
      outputs: [],
      run: async () => (await tick(ms), i),
    }));
    const finished: number[] = [];
    const printed: number[] = [];
    const e = orderedEmitter<number>((i) => printed.push(i));
    const r = await runPool(tasks, 4, (i, v) => (finished.push(i), e.push(i, v)));
    expect(finished).toEqual([3, 2, 1, 0]);
    expect(printed).toEqual([0, 1, 2, 3]);
    expect(r).toEqual([0, 1, 2, 3]);
  });

  test("regen's per-pair report is in pair order under a parallel pool", async () => {
    const seen: string[] = [];
    const delay: Record<string, number> = { "a:check": 30, "b:check": 1, "c:check": 15 };
    const runner: Runner = async (s) => (await tick(delay[s] ?? 0), true);
    const pairs: Pair[] = ["a", "b", "c"].map((n) => ({ check: `${n}:check`, writer: n, io: { outputs: [] } }));
    await regenPass(pairs, runner, { jobs: 3, report: (p) => seen.push(p.check) });
    expect(seen).toEqual(["a:check", "b:check", "c:check"]);
  });

  test("the fixpoint still holds under a parallel pool", async () => {
    // B writes what A reads; both checks declared read-only, so they share the pool.
    const v = { bInput: 1, bOut: 0, aOut: 0 };
    const fns: Record<string, () => boolean> = {
      "a:check": () => v.aOut === v.bOut,
      a: () => ((v.aOut = v.bOut), true),
      "b:check": () => v.bOut === v.bInput,
      b: () => ((v.bOut = v.bInput), true),
    };
    const runner: Runner = async (s) => (await tick(1), fns[s]!());
    const pairs: Pair[] = [
      { check: "a:check", writer: "a", io: { outputs: [] } },
      { check: "b:check", writer: "b", io: { outputs: [] } },
    ];
    const r = await regenToFixpoint(pairs, runner, 3, { jobs: 2 });
    expect(r.settled).toBe(true);
    expect(v.aOut).toBe(v.bOut);
  });

  test("v3nf: SERIAL and PARALLEL give the same verdicts and the same tree", async () => {
    // A chain (c reads b's output, b reads a's), a stale independent pair, a
    // broken writer, a red check with no writer, and an undeclared barrier —
    // with random delays so the pool's completion order differs from pair order.
    const world = () => {
      const v: Record<string, number> = { aIn: 1, aOut: 0, bOut: 0, cOut: 0, dIn: 7, dOut: 0, eOut: 0 };
      const fns: Record<string, () => boolean> = {
        "a:check": () => v.aOut === v.aIn,
        a: () => ((v.aOut = v.aIn), true),
        "b:check": () => v.bOut === v.aOut * 2,
        b: () => ((v.bOut = v.aOut * 2), true),
        "c:check": () => v.cOut === v.bOut + 1,
        c: () => ((v.cOut = v.bOut + 1), true),
        "d:check": () => v.dOut === v.dIn,
        d: () => ((v.dOut = v.dIn), true),
        "e:check": () => v.eOut === 1,
        e: () => false, // a writer that fails and changes nothing
        "f:check": () => false,
        "u:check": () => true,
      };
      return { v, fns };
    };
    // Reverse chain order, so a pass reads before the write it depends on.
    const pairs: Pair[] = [
      { check: "c:check", writer: "c", io: { outputs: [] } },
      { check: "b:check", writer: "b", io: { outputs: [] } },
      { check: "u:check", writer: "u" }, // undeclared: a barrier
      { check: "a:check", writer: "a", io: { outputs: [] } },
      { check: "d:check", writer: "d", io: { outputs: [] } },
      { check: "e:check", writer: "e", io: { outputs: [] } },
      { check: "f:check", writer: undefined, io: { outputs: [] } },
    ];
    const run = async (jobs: number) => {
      const w = world();
      let seed = 42;
      const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % 7);
      const runner: Runner = async (s) => (await tick(rand()), w.fns[s]!());
      const r = await regenToFixpoint(pairs, runner, 8, { jobs });
      return { results: r.results, settled: r.settled, tree: w.v };
    };
    const serial = await run(1);
    for (const jobs of [2, 3, 8]) expect(await run(jobs)).toEqual(serial);
    expect(serial.results.map((x) => x.outcome)).toEqual([
      "regenerated",
      "regenerated",
      "current",
      "regenerated",
      "regenerated",
      "writer-failed",
      "no-writer",
    ]);
  });
});

describe("gates: read-only gates are batched, everything else is a barrier", () => {
  const g = (command: string): Gate => ({ job: "j", step: "s", command });

  test("consecutive read-only gates form one segment; a writer splits them", () => {
    const ro = new Set(["bun run r1", "bun run r2", "bun run r3"]);
    const segs = gateSegments(
      [g("bun run r1"), g("bun run r2"), g("bun test"), g("bun run r3")],
      (x) => ro.has(x.command),
    );
    expect(segs.map((s) => [s.parallel, s.gates.map((x) => x.command)])).toEqual([
      [true, ["bun run r1", "bun run r2"]],
      [false, ["bun test"]],
      [true, ["bun run r3"]],
    ]);
  });

  test("an undeclared gate is never read-only", () => {
    expect(gateReadsOnly("bun test")).toBe(false);
    expect(gateReadsOnly("bun run no-such-script-anywhere")).toBe(false);
  });
});

describe("--jobs", () => {
  test("parses both spellings and refuses nonsense rather than defaulting", () => {
    expect(jobsFromArgv(["--jobs", "3"], 9)).toBe(3);
    expect(jobsFromArgv(["--jobs=2"], 9)).toBe(2);
    expect(jobsFromArgv([], 9)).toBe(9);
    expect(() => jobsFromArgv(["--jobs", "abc"], 9)).toThrow();
    expect(() => jobsFromArgv(["--jobs", "0"], 9)).toThrow();
  });
});

describe("task-io declarations", () => {
  test("an undeclared check has no io, so its pair runs alone and is never skipped", () => {
    expect(pairIO("no-such:check")).toBeUndefined();
  });

  test("every declared check that may share the pool is a READ-ONLY declaration", () => {
    for (const [name, io] of Object.entries(TASK_IO)) {
      if (io.outputs !== undefined) expect(io.outputs, `${name} declares outputs; only [] is supported`).toEqual([]);
    }
  });
});

// ── Bean `f017`: a CHECK's own record, shared by `regen` and `gates` ──────
//
// The falsifier the bean names: a check skipped while something it reads has
// changed. Each test below changes one thing a check reads and asserts it is
// RUN; the rest pin that nothing but a real, passing, undisturbed run is ever
// recorded.
describe("f017: check-level records — skipped only on a hash a passing run left", () => {
  let root: string;
  const scripts = { "x:check": "bun run scripts/x.ts --check", "t:check": "bun run scripts/t.ts --check" };
  const table: Record<string, PairIO> = {
    "x:check": { inputs: ["src/**/*.md"], outputs: [] },
    "t:check": { inputs: [TRACKED], outputs: [] },
  };
  const ioOf = (s: string) => table[s];
  const git = (...args: string[]) => {
    const r = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "f017-"));
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "elsewhere"));
    writeFileSync(join(root, "scripts", "x.ts"), 'import { y } from "./y.ts";\nconsole.log(y);\n');
    writeFileSync(join(root, "scripts", "y.ts"), "export const y = 1;\n");
    writeFileSync(join(root, "scripts", "t.ts"), "console.log(1);\n");
    writeFileSync(join(root, "src", "a.md"), "alpha\n");
    writeFileSync(join(root, "elsewhere", "read-by-t.json"), "{}\n");
    writeFileSync(join(root, ".gitignore"), "build/\n");
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const fresh = () => new FileDigests(root);
  const skipper = () => new GateSkipper(root, scripts, loadCache(root), undefined, ioOf);
  /** The cache OFF (`--no-cache`, `CI`). */
  const offSkipper = () => new GateSkipper(root, scripts, undefined, undefined, ioOf);
  /** One passing, undisturbed run of `script`, recorded and saved. */
  const passOnce = (s: GateSkipper, script: string) => {
    const d = s.decide(`bun run ${script}`, fresh())!;
    s.record(script, true, d.fp, fresh());
    s.save();
  };

  test("a passing, undisturbed run is recorded, and the next run on the same inputs SKIPS", () => {
    passOnce(skipper(), "x:check");
    const d = skipper().decide("bun run x:check", fresh())!;
    expect(d.skip).toBe(true);
    expect(d.why).toContain("unchanged since this check last passed");
  });

  test.each([
    ["a declared input edited", () => writeFileSync(join(root, "src", "a.md"), "beta\n")],
    ["a new file under a declared glob", () => writeFileSync(join(root, "src", "b.md"), "new\n")],
    ["the script itself edited", () => writeFileSync(join(root, "scripts", "x.ts"), 'import { y } from "./y.ts";\n')],
    ["a module it IMPORTS edited", () => writeFileSync(join(root, "scripts", "y.ts"), "export const y = 2;\n")],
  ])("%s → it RUNS", (_name, change) => {
    passOnce(skipper(), "x:check");
    change();
    const d = skipper().decide("bun run x:check", fresh())!;
    expect(d.skip).toBe(false);
  });

  test("{tracked}: editing ANY file in the tree — even one no glob names — makes it run", () => {
    // The undeclared-read falsifier, for the declaration every gate that can
    // skip today uses: a whole-tree reader is never skipped past a change it
    // might read, tracked or untracked, committed or not.
    passOnce(skipper(), "t:check");
    expect(skipper().decide("bun run t:check", fresh())!.skip).toBe(true);
    writeFileSync(join(root, "elsewhere", "read-by-t.json"), '{"changed":true}\n');
    expect(skipper().decide("bun run t:check", fresh())!.skip).toBe(false);
    git("checkout", "--", "elsewhere/read-by-t.json");
    expect(skipper().decide("bun run t:check", fresh())!.skip).toBe(true);
    writeFileSync(join(root, "elsewhere", "untracked.txt"), "new\n");
    expect(skipper().decide("bun run t:check", fresh())!.skip).toBe(false);
  });

  test("a moved --against baseline makes it run, though no file changed", () => {
    const s2 = { ...scripts, "x:check": "bun run scripts/x.ts --check --against main" };
    let id = "entry-1";
    const baseline: BaselineResolver = () => ({ id });
    const mk = () => new GateSkipper(root, s2, loadCache(root), baseline, ioOf);
    const first = mk();
    const d = first.decide("bun run x:check", fresh())!;
    first.record("x:check", true, d.fp, fresh());
    first.save();
    expect(mk().decide("bun run x:check", fresh())!.skip).toBe(true);
    id = "entry-2";
    expect(mk().decide("bun run x:check", fresh())!.skip).toBe(false);
  });

  test("a RED run records nothing — and forgets an earlier pass", () => {
    passOnce(skipper(), "x:check");
    const s = skipper();
    const d = s.decide("bun run x:check", fresh())!;
    s.record("x:check", false, d.fp, fresh());
    s.save();
    expect(loadCache(root).checks?.["x:check"]).toBeUndefined();
    expect(skipper().decide("bun run x:check", fresh())!.skip).toBe(false);
  });

  test("inputs that MOVED while it ran record nothing, though it passed", () => {
    const s = skipper();
    const d = s.decide("bun run x:check", fresh())!;
    writeFileSync(join(root, "src", "a.md"), "edited mid-run\n"); // a writer beside it, or a person
    s.record("x:check", true, d.fp, fresh());
    s.save();
    expect(loadCache(root).checks?.["x:check"]).toBeUndefined();
  });

  test("never skipped: undeclared, not exactly one script, undetermined, or the cache off", () => {
    passOnce(skipper(), "x:check");
    expect(skipper().decide("bun run other:check", fresh())).toBeUndefined();
    expect(skipper().decide("bun run x:check --extra", fresh())).toBeUndefined();
    expect(skipper().decide("bunx tsc --noEmit", fresh())).toBeUndefined();
    expect(offSkipper().decide("bun run x:check", fresh())).toBeUndefined();
    rmSync(join(root, "src", "a.md")); // the glob now matches nothing: undetermined
    const d = skipper().decide("bun run x:check", fresh())!;
    expect(d.skip).toBe(false);
    expect(d.why).toContain("could not be determined");
  });

  test("the cache off records nothing either", () => {
    const s = offSkipper();
    s.record("x:check", true, { hash: "h", files: 1 }, fresh());
    s.save();
    expect(loadCache(root).checks).toEqual({});
  });

  test("save() keeps entries another process wrote since this one loaded", () => {
    const mine = skipper();
    saveCache(root, { version: RECIPE_VERSION, pairs: {}, checks: { "other:check": "theirs" } });
    const d = mine.decide("bun run x:check", fresh())!;
    mine.record("x:check", true, d.fp, fresh());
    mine.save();
    expect(Object.keys(loadCache(root).checks ?? {}).sort()).toEqual(["other:check", "x:check"]);
  });

  test("recordCheckRun: only passed AND before === after records", () => {
    const c: HashCache = { version: RECIPE_VERSION, pairs: {}, checks: { s: "old" } };
    recordCheckRun(c, "s", true, { hash: "a", files: 1 }, { hash: "a", files: 1 });
    expect(c.checks!.s).toBe("a");
    recordCheckRun(c, "s", true, { hash: "a", files: 1 }, { hash: "b", files: 1 });
    expect(c.checks!.s).toBeUndefined();
    c.checks!.s = "a";
    recordCheckRun(c, "s", true, { undetermined: "x" }, { undetermined: "x" });
    expect(c.checks!.s).toBeUndefined();
    c.checks!.s = "a";
    recordCheckRun(c, "s", false, { hash: "a", files: 1 }, { hash: "a", files: 1 });
    expect(c.checks!.s).toBeUndefined();
  });
});

describe("f017: regen records and reads the CHECK's own entry", () => {
  const pairs: Pair[] = [
    { check: "run:check", writer: "run" },
    { check: "skipped:check", writer: "skipped" },
    { check: "assumed:check", writer: "assumed" },
    { check: "derived:check", writer: "derived" },
    { check: "red:check", writer: "red" },
  ];
  const results: Result[] = [
    { check: "run:check", writer: "run", outcome: "regenerated" },
    { check: "skipped:check", writer: "skipped", outcome: "current", skipped: true },
    { check: "assumed:check", writer: "assumed", outcome: "current", skipped: true, assumed: true },
    { check: "derived:check", writer: "derived", outcome: "current", derived: true },
    { check: "red:check", writer: "red", outcome: "unrepaired" },
  ];
  const fp = (p: Pair) => ({ hash: `pair-${p.check}`, files: 1 });
  const fpCheck = (c: string) => ({ hash: `check-${c}`, files: 1 });
  const prev = (): HashCache => ({ version: RECIPE_VERSION, pairs: {}, checks: { "red:check": "old", "derived:check": "kept" } });

  test("only a check that RAN and came back green in a settled run is recorded", () => {
    const next = hashesToRecord(pairs, results, true, fp, prev(), fpCheck);
    // skipped: no run stands behind it now; assumed: --changed premise;
    // derived: pair-cover answered for it — each keeps what a real run left.
    expect(next.checks).toEqual({ "run:check": "check-run:check", "derived:check": "kept" });
  });

  test("an unsettled run records no check and drops the ones it asked", () => {
    const next = hashesToRecord(pairs, results, false, fp, prev(), fpCheck);
    expect(next.checks).toEqual({ "derived:check": "kept" });
  });

  test("without fpCheck the check entries are carried through untouched", () => {
    expect(hashesToRecord(pairs, results, true, fp, prev()).checks).toEqual(prev().checks);
  });

  test("pairSkip: a check-level record skips the pair; a stale one does not", () => {
    const pair: Pair = { check: "g:check", writer: "g", io: { inputs: [TRACKED], outputs: [] } };
    const cache: HashCache = { version: RECIPE_VERSION, pairs: {}, checks: { "g:check": "check-g:check" } };
    expect(pairSkip(cache, pair, fp, fpCheck).skip).toBe(true);
    expect(pairSkip(cache, pair, fp, () => ({ hash: "moved", files: 1 })).skip).toBe(false);
    expect(pairSkip(undefined, pair, fp, fpCheck).skip).toBe(false);
    expect(pairSkip(cache, pair, fp, () => ({ undetermined: "x" })).skip).toBe(false);
  });

  test("a folded check's result is marked derived, so it records no check entry", async () => {
    const ran: string[] = [];
    const runner: Runner = (s) => (ran.push(s), true);
    const folded: Pair[] = [
      { check: "kg:audit:all:check", writer: "kg:audit:all" },
      { check: "kg:audit:check", writer: "kg:audit" },
    ];
    const r = await regenPass(folded, runner, {});
    expect(ran).toEqual(["kg:audit:all:check"]);
    expect(r.results[1]!.derived).toBe(true);
    expect(r.results[0]!.derived).toBeUndefined();
  });
});

describe("task-io: each instance declares its own tasks (bean 0r7u)", () => {
  let root: string;
  const writeInstance = (name: string, taskIo?: Record<string, unknown>) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, `${name}.json`),
      JSON.stringify({ name, version: "0.1.0", directories: [], ...(taskIo === undefined ? {} : { taskIo }) }),
    );
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "task-io-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("standalone, with no instance above, the result is the own rows alone", () => {
    writeInstance("acme");
    expect(collectTaskIo(root, { "own:check": { outputs: [] } })).toEqual({ "own:check": { outputs: [] } });
  });

  test("a declared row is collected from the instance that owns it", () => {
    writeInstance("acme", { "acme:check": { inputs: ["{tracked}"], outputs: [], because: "read for writes" } });
    expect(collectTaskIo(root, {})).toEqual({ "acme:check": { inputs: ["{tracked}"], outputs: [] } });
  });

  test("a task declared by two owners is refused, not silently resolved", () => {
    writeInstance("acme", { "x:check": { outputs: [] } });
    expect(() => collectTaskIo(root, { "x:check": { outputs: [] } })).toThrow(/one task, one owner/);
  });

  test("no instance above cat-harness-tools is named in the own table", () => {
    const upper = /^(smart-|iris:|ig-ast:|p2:|check:(glossary|catalogue|voices|artifact-index|materialized-fixity)$)/;
    const own = collectTaskIo(join(root, "absent"));
    for (const k of Object.keys(own)) expect(upper.test(k), `${k} belongs in its owner's declaration`).toBe(false);
  });
});
