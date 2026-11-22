import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "path";

import { loadDecisionTable, type DecisionTable } from "../../src/workflow/decision-table.ts";
import {
  assess,
  closureOf,
  exitCodeFor,
  HEAVY_MOVER_LABEL,
  parseBunTest,
  parseJunitFailures,
  planLayer,
  probeUpwardPaths,
  readLayers,
  SEED_READINESS_DECISION,
  seedReadinessDmn,
  SETTLED_REQUIRES_REHEARSAL,
  type ForgeSnapshot,
  type LayerDecl,
  type PrFile,
  type PrPathSet,
  type Probes,
} from "../seed-ready";

/**
 * `seed:ready` judges a layer by evaluating the REAL decision table, so these
 * tests load it rather than a copy: a threshold changed in the DMN has to show
 * up here, or the test would be asserting a number the gate no longer uses.
 */
let table: DecisionTable;
beforeAll(async () => {
  table = await loadDecisionTable(seedReadinessDmn(), SEED_READINESS_DECISION);
});

// A stack shaped like the real one, with directories that do not collide by prefix.
const DECLS: LayerDecl[] = [
  { name: "base", dir: "base", needs: [] },
  { name: "base-tools", dir: "base-tools", needs: ["base"] },
  { name: "harness", dir: "harness", needs: ["base", "base-tools"], stagedIn: "o/r" },
  { name: "harness-tools", dir: "harness-tools", needs: ["harness"], stagedIn: "o/r" },
  { name: "core", dir: "core", needs: ["harness", "harness-tools"] },
  { name: "folio", dir: "folio", needs: ["core"] },
];

const plan = planLayer(DECLS, "harness");

let n = 100;
function pr(files: Array<string | PrFile>, opts: Partial<PrPathSet> = {}): PrPathSet {
  const fs = files.map((f) => (typeof f === "string" ? { path: f, status: "modified" } : f));
  return { number: n++, title: "t", draft: false, labels: [], changedFiles: fs.length, files: fs, ...opts };
}

const forge = (prs: PrPathSet[] | undefined): ForgeSnapshot => ({
  repository: "o/r",
  heavyMoverLabelExists: true,
  prs,
  errors: [],
});

const CLEAN_PROBES: Probes = {
  standalone: { state: "measured", count: 0, findings: [] },
  upward: { state: "measured", count: 0, findings: [] },
};

const verdictOf = (r: ReturnType<typeof assess>, id: string) => r.criteria.find((c) => c.id === id)!.verdict;

describe("the layer map comes from `needs`", () => {
  test("depth is the longest chain, and the next layer is one level up", () => {
    expect(plan.depth).toBe(2);
    expect(plan.next.map((d) => d.name)).toEqual(["harness-tools"]);
    const tools = planLayer(DECLS, "harness-tools");
    expect(tools.depth).toBe(3);
    expect(tools.next.map((d) => d.name)).toEqual(["core"]);
  });

  test("an unknown name and a cycle both throw rather than answer about another stack", () => {
    expect(() => planLayer(DECLS, "nope")).toThrow(/no instance declaration names/);
    const cyc: LayerDecl[] = [
      { name: "a", dir: "a", needs: ["b"] },
      { name: "b", dir: "b", needs: ["a"] },
    ];
    expect(() => planLayer(cyc, "a")).toThrow(/cycle/);
  });

  test("the closure a rehearsal copies is the layer and everything it needs", () => {
    expect(closureOf(DECLS, "harness").map((d) => d.name).sort()).toEqual(["base", "base-tools", "harness"]);
  });
});

describe("the gateway", () => {
  test("a quiet source and a clean rehearsal answer settled", () => {
    const r = assess(plan, forge([pr(["folio/x.md"])]), table, CLEAN_PROBES);
    expect(r.outcome).toBe("settled");
    expect(exitCodeFor(r.outcome)).toBe(0);
    expect(r.criteria.every((c) => c.verdict === "pass")).toBe(true);
  });

  test("without --rehearse the answer is unknown, never settled (owner, 2026-10-02)", () => {
    expect(SETTLED_REQUIRES_REHEARSAL).toBe(true);
    const r = assess(plan, forge([]), table, {
      standalone: { state: "not-run", note: "not requested" },
      upward: { state: "measured", count: 0, findings: [] },
    });
    expect(verdictOf(r, "standalone")).toBe("could-not-determine");
    expect(r.outcome).toBe("unknown");
    expect(exitCodeFor(r.outcome)).toBe(2);
  });

  test("a labelled heavy mover over the layer is not yet; one elsewhere is not counted", () => {
    const here = assess(plan, forge([pr(["harness/a.ts"], { labels: [HEAVY_MOVER_LABEL] })]), table, CLEAN_PROBES);
    expect(verdictOf(here, "heavy-movers")).toBe("fail");
    expect(here.rule).toBe("Rule_HeavyMover");
    const elsewhere = assess(plan, forge([pr(["folio/a.ts"], { labels: [HEAVY_MOVER_LABEL] })]), table, CLEAN_PROBES);
    expect(verdictOf(elsewhere, "heavy-movers")).toBe("pass");
  });

  test("a label that cannot be read is could-not-determine, not a pass", () => {
    const r = assess(plan, { ...forge([]), heavyMoverLabelExists: undefined }, table, CLEAN_PROBES);
    expect(verdictOf(r, "heavy-movers")).toBe("could-not-determine");
    expect(r.outcome).toBe("unknown");
  });

  test("any open PR on the next layer is not yet", () => {
    const r = assess(plan, forge([pr(["harness-tools/x.ts"])]), table, CLEAN_PROBES);
    expect(verdictOf(r, "next-layer")).toBe("fail");
    expect(r.outcome).toBe("not yet");
  });

  test("the layer-load limit is the table's: five pass, six fail", () => {
    const five = Array.from({ length: 5 }, () => pr(["harness/x.md"]));
    expect(verdictOf(assess(plan, forge(five), table, CLEAN_PROBES), "layer-load")).toBe("pass");
    const six = [...five, pr(["harness/y.md"])];
    const r = assess(plan, forge(six), table, CLEAN_PROBES);
    expect(verdictOf(r, "layer-load")).toBe("fail");
    expect(r.outcome).toBe("not yet");
  });

  test("a move is a deletion in the layer or a rename across its edge; an addition is not", () => {
    const moves = (f: PrFile) => verdictOf(assess(plan, forge([pr([f])]), table, CLEAN_PROBES), "layer-moves");
    expect(moves({ path: "harness/new.ts", status: "added" })).toBe("pass");
    expect(moves({ path: "harness/gone.ts", status: "removed" })).toBe("fail");
    expect(moves({ path: "core/moved.ts", status: "renamed", previousPath: "harness/moved.ts" })).toBe("fail");
    expect(moves({ path: "harness/in.ts", status: "renamed", previousPath: "folio/in.ts" })).toBe("fail");
  });

  test("a regenerated, content-named file is not a move: deleting it changes what no seeded path means (owner, 2026-10-06)", () => {
    const moves = (f: PrFile) => verdictOf(assess(plan, forge([pr([f])]), table, CLEAN_PROBES), "layer-moves");
    expect(moves({ path: "harness/docs/assets/navbar/rail-1tstgx8dr3c.js", status: "removed" })).toBe("pass");
    expect(moves({ path: "harness/docs/payload/sha256/0a58f990.json", status: "removed" })).toBe("pass");
    expect(moves({ path: "harness/docs/payload/sha256/new", status: "renamed", previousPath: "harness/docs/payload/sha256/old" })).toBe("pass");
    // Only the generator's own names: an authored file beside them still counts,
    // and so does a rename with one authored end.
    expect(moves({ path: "harness/docs/assets/navbar/navbar.js", status: "removed" })).toBe("fail");
    expect(moves({ path: "harness/docs/assets/navbar/rail-x.js", status: "renamed", previousPath: "harness/scripts/rail.js" })).toBe("fail");
    // One real move among regenerated ones is still a moving PR.
    const mixed = verdictOf(
      assess(plan, forge([pr([{ path: "harness/docs/assets/navbar/rail-a1.js", status: "removed" }, { path: "harness/scripts/gone.ts", status: "removed" }])]), table, CLEAN_PROBES),
      "layer-moves",
    );
    expect(mixed).toBe("fail");
  });

  test("a PR GitHub truncated is undetermined unless what WAS seen already counts", () => {
    const blind = pr(["folio/x.md"], { changedFiles: 4000 });
    const r = assess(plan, forge([blind]), table, CLEAN_PROBES);
    expect(verdictOf(r, "layer-load")).toBe("could-not-determine");
    expect(r.outcome).toBe("unknown");

    // A certain finding is never hidden by an unknown one.
    const seen = pr(["harness/x.md"], { changedFiles: 4000, labels: [HEAVY_MOVER_LABEL] });
    const r2 = assess(plan, forge([seen]), table, CLEAN_PROBES);
    expect(verdictOf(r2, "heavy-movers")).toBe("fail");
    expect(r2.outcome).toBe("not yet");
  });

  test("open PRs that could not be listed make every PR criterion could-not-determine", () => {
    const r = assess(plan, forge(undefined), table, CLEAN_PROBES);
    for (const id of ["heavy-movers", "next-layer", "layer-load", "layer-moves"]) {
      expect(verdictOf(r, id)).toBe("could-not-determine");
    }
    expect(r.outcome).toBe("unknown");
  });

  test("a red rehearsal or an upward path is not yet; a probe that errored is unknown", () => {
    const red = assess(plan, forge([]), table, {
      ...CLEAN_PROBES,
      standalone: { state: "measured", count: 3, findings: ["a", "b", "c"] },
    });
    expect(red.rule).toBe("Rule_Standalone");
    const missed = assess(plan, forge([]), table, {
      ...CLEAN_PROBES,
      upward: { state: "measured", count: 1, findings: ["tool-module x: src/x.ts resolves only in core"] },
    });
    expect(missed.rule).toBe("Rule_UpwardPaths");
    const broke = assess(plan, forge([]), table, { ...CLEAN_PROBES, upward: { state: "error", note: "x" } });
    expect(verdictOf(broke, "upward-paths")).toBe("could-not-determine");
    expect(broke.outcome).toBe("unknown");
  });
});

describe("the probes", () => {
  test("bun test's summary is read for the failure count and names", () => {
    const out = "(pass) a\n(fail) b > c [1.2ms]\n\n 10 pass\n 1 fail\n 22 expect() calls\n";
    expect(parseBunTest(out)).toEqual({ failed: 1, names: ["b > c"], loadErrors: [] });
    const two = "x/a.test.ts:\n(fail) d > e [3.00ms]\n\ny/b.test.ts:\n(fail) d > e [10.1ms]\n 2 fail\n";
    expect(parseBunTest(two)).toEqual({ failed: 2, names: ["x/a.test.ts > d > e", "y/b.test.ts > d > e"], loadErrors: [] });
    // bun's GitHub Actions spelling of the same output keys the same (#1977).
    const ci = "::group::x/a.test.ts:\n(fail) d > e [3.00ms]\n\n::endgroup::\n 1 fail\n";
    expect(parseBunTest(ci)).toEqual({ failed: 1, names: ["x/a.test.ts > d > e"], loadErrors: [] });
    expect(parseBunTest("Killed")).toBeUndefined();
  });

  test("a file that fails to LOAD is named, though the JUnit report has no case for it", () => {
    // bun 1.3.14's console output, captured: `a.test.ts` imports a module that
    // is not there, so it counts in `2 fail` while the report names only `c`.
    const out = [
      "b.test.ts:",
      "error: expect(received).toBe(expected)",
      "(fail) c [0.10ms]",
      "",
      "a.test.ts:",
      "",
      "# Unhandled error between tests",
      "-------------------------------",
      "error: Cannot find module './nope.ts' from '/tmp/rehearsal-x1/layer/a.test.ts'",
      "-------------------------------",
      "",
      " 1 pass",
      " 2 fail",
      " 1 error",
    ].join("\n");
    const p = parseBunTest(out);
    expect(p?.failed).toBe(2);
    expect(p?.names).toEqual(["b.test.ts > c"]);
    // No temporary path survives, so the name compares equal across runs.
    expect(p?.loadErrors).toEqual(["a.test.ts > (load-time error) Cannot find module './nope.ts' from 'a.test.ts'"]);
  });

  test("a load error not spelled `error:` stays with its own file, not the next one", () => {
    // bun 1.3.14 prints a system error as `ENOENT: …` and a TypeError as
    // `TypeError: …`, under a code frame. Waiting for `error:` filed the NEXT
    // file's message under this one, so keys moved whenever run order did
    // (PR #2486's standalone ratchet).
    const out = [
      "a.test.ts:",
      "",
      "# Unhandled error between tests",
      "-------------------------------",
      "46 |   return parse(",
      "47 |     JSON.parse(readFileSync(p)),",
      "                    ^",
      "TypeError: path must be a string or a file descriptor",
      ' code: "ERR_INVALID_ARG_TYPE"',
      "",
      "      at decl (/tmp/rehearsal-x1/layer/a.test.ts:47:16)",
      "-------------------------------",
      "",
      "b.test.ts:",
      "",
      "# Unhandled error between tests",
      "-------------------------------",
      "ENOENT: no such file or directory, open '/tmp/rehearsal-x1/.github/workflows/x.yml'",
      "-------------------------------",
      "",
      "c.test.ts:",
      "",
      "# Unhandled error between tests",
      "-------------------------------",
      "error: ENOENT: no such file or directory, open '/tmp/rehearsal-x1/AGENTS.md'",
      "-------------------------------",
      "",
      " 0 pass",
      " 3 fail",
    ].join("\n");
    expect(parseBunTest(out)?.loadErrors).toEqual([
      "a.test.ts > (load-time error) TypeError: path must be a string or a file descriptor",
      "b.test.ts > (load-time error) ENOENT: no such file or directory, open 'x.yml'",
      "c.test.ts > (load-time error) ENOENT: no such file or directory, open 'AGENTS.md'",
    ]);
  });

  test("the JUnit report is read for failing names, keyed file > describe > test", () => {
    // bun 1.3.14's own report for two files, one nested describe (#1977).
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<testsuites name="bun test" tests="3" failures="2">',
      '  <testsuite name="t.test.ts" file="t.test.ts" tests="2" failures="1">',
      '    <testsuite name="D" file="t.test.ts" line="2">',
      '      <testsuite name="E" file="t.test.ts" line="2">',
      '        <testcase name="x &gt; y" classname="E &amp;gt; D" file="t.test.ts" line="2">',
      '          <failure type="AssertionError" />',
      "        </testcase>",
      "      </testsuite>",
      "    </testsuite>",
      '    <testcase name="ok" classname="" file="t.test.ts" line="3" assertions="0" />',
      "  </testsuite>",
      '  <testsuite name="sub/u.test.ts" file="sub/u.test.ts" tests="1" failures="1">',
      '    <testcase name="z" classname="" file="sub/u.test.ts" line="2">',
      '      <failure type="AssertionError" />',
      "    </testcase>",
      "  </testsuite>",
      "</testsuites>",
    ].join("\n");
    expect(parseJunitFailures(xml)).toEqual(["t.test.ts > D > E > x > y", "sub/u.test.ts > z"]);
    expect(parseJunitFailures("Killed")).toBeUndefined();
  });

  test("upward paths: cat-harness declares paths, and none resolves only above it (measured 2026-10-04)", () => {
    const repoRoot = resolve(import.meta.dir, "../../..");
    const decls = readLayers(repoRoot);
    const p = probeUpwardPaths(repoRoot, "cat-harness", decls);
    expect(p.state).toBe("measured");
    if (p.state === "measured") {
      // Not vacuous: the three registries are read, and there are many paths.
      expect(p.note).toMatch(/^\d+ declared path/);
      expect(Number(p.note!.split(" ")[0])).toBeGreaterThan(20);
      expect(p.count).toBe(p.findings.length);
      expect(p.findings).toEqual([]);
    }
  });

  test("a path found only in an instance above the layer is counted, and one in the layer is not", () => {
    const repoRoot = resolve(import.meta.dir, "../../..");
    const decls = readLayers(repoRoot);
    // folio-assistant-core declares Tool modules of its own; each resolves in
    // core itself (own) — so core's count is also the paths it cannot keep.
    const p = probeUpwardPaths(repoRoot, "folio-assistant-core", decls);
    expect(p.state).toBe("measured");
    const none = probeUpwardPaths(repoRoot, "no-such-layer", decls);
    expect(none.state).toBe("error");
  });

  test("a path into a seeding partner (`seedsWith`) is stated, not counted — and is counted without it", () => {
    // Owner, 2026-10-04: cat-harness's Tool nodes resolve into
    // cat-harness-tools (its implementer, "Trap 1"), and the two are seeded
    // together. Both directions on the REAL checkout, so the exemption can
    // neither hide a path into some other layer nor be vacuous.
    const repoRoot = resolve(import.meta.dir, "../../..");
    const decls = readLayers(repoRoot);
    const withPair = probeUpwardPaths(repoRoot, "cat-harness", decls);
    const alone = probeUpwardPaths(
      repoRoot,
      "cat-harness",
      decls.map((d) => ({ ...d, seedsWith: undefined })),
    );
    expect(withPair.state).toBe("measured");
    expect(alone.state).toBe("measured");
    if (withPair.state !== "measured" || alone.state !== "measured") return;
    expect(alone.count).toBeGreaterThan(0);
    expect(alone.findings.every((f) => f.includes("resolves only in cat-harness-tools"))).toBe(true);
    expect(withPair.count).toBe(0);
    expect(withPair.note).toContain(`${alone.count} resolve into \`cat-harness-tools\``);
  });

});
