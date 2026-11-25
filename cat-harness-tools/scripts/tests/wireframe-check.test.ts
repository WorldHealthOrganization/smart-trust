/**
 * `wireframe:check` takes the `wireframe-design-review` skill's required input
 * — `use`, `topic`, `surface` — and USES each (owner, 2026-10-14): the Tool node
 * `wireframe-check` declares the three ports so its `satisfies` edge is true,
 * and a port the script ignored would be that edge in name only.
 *
 * These tests drive `resolveRun`, the part that turns argv into the run. The
 * rendering half needs Chromium and is not exercised here.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UsageError, parseArgs, resolveRun } from "../wireframe-check.mjs";
import { checkWireframes, judgeWireframes, renderedByKeys, wireframeGaps, wireframesDocument } from "../check-wireframes.ts";
import { JUDGEMENT_EXIT } from "../qa-results.ts";

const exitOf = (j: keyof typeof JUDGEMENT_EXIT) => JUDGEMENT_EXIT[j];

/** An index-shaped checkout: one layer holding an as-is wireframe and a design proposal. */
const ROOT = mkdtempSync(join(tmpdir(), "wireframe-check-"));
const WF = join(ROOT, "cat-harness", "docs", "wireframes");
const PROP = join(ROOT, "cat-harness", "docs", "proposals");
const put = (p: string, body = "<html><body>real</body></html>") => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
};
put(join(WF, "beans", "as-is.html"));
put(join(WF, "navbar", "as-is.html"));
put(join(WF, "harness-config", "a.html"));
put(join(WF, "harness-config", "b.html"));
put(join(PROP, "new-board", "wireframes", "a.html"));
put(join(PROP, "new-board", "wireframes", "b.html"));
put(join(PROP, "lonely", "wireframes", "a.html"));
writeFileSync(
  join(WF, "index.json"),
  JSON.stringify({ wireframes: { beans: { covers: ["cat-harness/beans"] }, navbar: { covers: [] } } }),
);
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const run = (...argv: string[]) => resolveRun(argv, ROOT);
const refuses = (argv: string[], msg: RegExp) => {
  expect(() => resolveRun(argv, ROOT)).toThrow(UsageError);
  expect(() => resolveRun(argv, ROOT)).toThrow(msg);
};

describe("the three inputs are required, and typed as the Tool types them", () => {
  test("each missing flag is refused by name", () => {
    refuses(["--topic", "beans", "--surface", "cat-harness/beans"], /--use is required/);
    refuses(["--use", "as-is", "--surface", "cat-harness/beans"], /--topic is required/);
    refuses(["--use", "as-is", "--topic", "beans"], /--surface is required/);
  });

  test("a value outside the type is refused, a shell payload included", () => {
    refuses(["--use", "redesign", "--topic", "beans", "--surface", "x"], /--use must be one of/);
    refuses(["--use", "as-is", "--topic", "Beans; rm -rf /", "--surface", "x"], /--topic must be kebab-case/);
    refuses(["--use", "as-is", "--topic", "beans", "--surface", "$(id)"], /--surface must be/);
  });

  test("an unknown flag, or a flag with no value, is refused", () => {
    expect(() => parseArgs(["--bogus", "x"])).toThrow(/unknown flag/);
    expect(() => parseArgs(["--use"])).toThrow(/needs a value/);
  });
});

describe("--topic scopes which wireframes are checked", () => {
  test("with no candidates, it checks every .html of the topic's directory, and the report goes to its checks/", () => {
    const r = run("--use", "as-is", "--topic", "beans", "--surface", "cat-harness/beans");
    expect(r.candidates).toEqual([join(WF, "beans", "as-is.html")]);
    expect(r.assetDir).toBe(join(WF, "beans"));
    expect(r.out).toBe(join(WF, "beans", "checks"));
    expect({ use: r.use, topic: r.topic, surface: r.surface }).toEqual({
      use: "as-is",
      topic: "beans",
      surface: "cat-harness/beans",
    });
  });

  test("design use looks in the proposal's asset directory", () => {
    const r = run("--use", "design", "--topic", "new-board", "--surface", "cat-harness/beans");
    expect(r.assetDir).toBe(join(PROP, "new-board", "wireframes"));
    expect(r.candidates.length).toBe(2);
  });

  test("a candidate outside the topic's directory is refused", () => {
    refuses(
      ["--use", "as-is", "--topic", "beans", "--surface", "cat-harness/beans", "cat-harness/docs/wireframes/navbar/as-is.html"],
      /not in it: cat-harness\/docs\/wireframes\/navbar/,
    );
  });

  test("a candidate inside it is taken as given, and --out still wins", () => {
    const r = run(
      "--use", "as-is", "--topic", "beans", "--surface", "cat-harness/beans",
      "cat-harness/docs/wireframes/beans/as-is.html", "--out", "elsewhere",
    );
    expect(r.candidates).toEqual([join(WF, "beans", "as-is.html")]);
    expect(r.out).toBe(join(ROOT, "elsewhere"));
  });

  test("a topic with no directory is refused rather than checking nothing", () => {
    refuses(["--use", "as-is", "--topic", "no-such", "--surface", "no-such"], /no wireframes for topic "no-such"/);
  });
});

describe("--use sets the rule for the candidate set", () => {
  test("design compares at least two candidates", () => {
    refuses(["--use", "design", "--topic", "lonely", "--surface", "x"], /at least two candidates; topic "lonely" has 1/);
  });

  test("design may still sit in docs/wireframes/<topic>/, where older design work is", () => {
    expect(run("--use", "design", "--topic", "harness-config", "--surface", "harness-config").candidates.length).toBe(2);
  });

  test("as-is candidates are marked as-is", () => {
    refuses(["--use", "as-is", "--topic", "harness-config", "--surface", "harness-config"], /not marked: a.html, b.html/);
  });
});

describe("--surface must be what an as-is wireframe covers", () => {
  test("a ref the index lists for the topic, or the topic itself for shared chrome", () => {
    expect(run("--use", "as-is", "--topic", "navbar", "--surface", "navbar").surface).toBe("navbar");
    refuses(["--use", "as-is", "--topic", "beans", "--surface", "cat-harness/todos"], /one of: beans, cat-harness\/beans/);
  });
});

describe("check:wireframes reads the recorded topic", () => {
  test("a report written for another topic is not counted as this wireframe's", () => {
    const dir = join(ROOT, "cw");
    put(join(dir, "beans", "as-is.html"));
    writeFileSync(join(dir, "beans", "intent.md"), "intent");
    mkdirSync(join(dir, "beans", "checks"), { recursive: true });
    writeFileSync(join(dir, "beans", "checks", "report.json"), JSON.stringify({ topic: "todos", candidates: [] }));
    writeFileSync(join(dir, "index.json"), JSON.stringify({ wireframes: { beans: { covers: [] } } }));
    const r = checkWireframes(ROOT, dir);
    expect(r.incomplete).toContainEqual({ wireframe: "beans", problem: 'checks/report.json was written for topic "todos"' });
  });
});

describe("check:wireframes reads each instance's own index (cat-harness-tools#281)", () => {
  test("a second instance's wireframe is named <instance>/<topic> and judged by its bare topic", () => {
    const own = join(ROOT, "own");
    const other = join(ROOT, "other");
    for (const d of [own, other]) {
      put(join(d, "page", "as-is.html"));
      writeFileSync(join(d, "page", "intent.md"), "intent");
      mkdirSync(join(d, "page", "checks"), { recursive: true });
      writeFileSync(join(d, "page", "checks", "report.json"), JSON.stringify({ topic: "page", candidates: [] }));
      writeFileSync(join(d, "index.json"), JSON.stringify({ wireframes: { page: { covers: [] } } }));
    }
    const r = checkWireframes(ROOT, [
      { dir: own, prefix: "" },
      { dir: other, prefix: "content-layer/" },
    ]);
    const names = r.incomplete.map((i) => i.wireframe);
    // Neither is refused for its topic: the report says "page", and "page" is each one's topic.
    expect(r.incomplete.filter((i) => i.problem.includes("was written for topic"))).toEqual([]);
    expect(names).toContain("page");
    expect(names).toContain("content-layer/page");
  });
});

describe("a wireframe covers every visualiser a writer draws (renderedBy:<tool>)", () => {
  /** A wireframe directory whose report passes at both viewports. */
  const passing = (dir: string, topic: string, covers: string[]) => {
    put(join(dir, topic, "as-is.html"));
    writeFileSync(join(dir, topic, "intent.md"), "intent");
    mkdirSync(join(dir, topic, "checks"), { recursive: true });
    const entries = ["web", "mobile"].map((viewport) => ({ viewport, criterion: "renders", result: "pass" }));
    writeFileSync(join(dir, topic, "checks", "report.json"), JSON.stringify({ topic, candidates: [{ file: "as-is.html", entries }] }));
    return [topic, { covers }] as const;
  };
  const RENDERERS = new Map([
    ["dth-hrh/archimate", "archimate-pages"],
    ["dpi-h-ra/archimate", "archimate-pages"],
    ["dth-sfp/archimate", "archimate-pages"],
    ["dth-sfp/glossary", "glossary-page"],
  ]);

  test("renderedByKeys names every declared visualiser drawn by that Tool, and nothing for another form", () => {
    expect(renderedByKeys("renderedBy:archimate-pages", RENDERERS)).toEqual(["dpi-h-ra/archimate", "dth-hrh/archimate", "dth-sfp/archimate"]);
    expect(renderedByKeys("renderedBy:no-such-tool", RENDERERS)).toEqual([]);
    expect(renderedByKeys("dth-sfp/archimate", RENDERERS)).toBeUndefined();
    expect(renderedByKeys("renderedBy:Not A Tool", RENDERERS)).toBeUndefined();
  });

  test("every visualiser rendered by the writer inherits its wireframe; one drawn by another Tool does not", () => {
    const dir = join(ROOT, "by-writer");
    const index = Object.fromEntries([passing(dir, "archimate-pages", ["renderedBy:archimate-pages"])]);
    writeFileSync(join(dir, "index.json"), JSON.stringify({ wireframes: index }));
    const r = checkWireframes(ROOT, [{ dir, prefix: "cat-harness-tools/" }], [], RENDERERS);
    expect(r.covered).toEqual([
      { ref: "dpi-h-ra/archimate", wireframe: "cat-harness-tools/archimate-pages" },
      { ref: "dth-hrh/archimate", wireframe: "cat-harness-tools/archimate-pages" },
      { ref: "dth-sfp/archimate", wireframe: "cat-harness-tools/archimate-pages" },
    ]);
    expect(r.uncovered).toEqual([{ ref: "dth-sfp/glossary" }]);
    expect(r.unknownRef).toEqual([]);
    expect(r.incomplete).toEqual([]);
  });

  test("a writer no mounted layer declares a visualiser for is not a stale ref", () => {
    const dir = join(ROOT, "by-writer-alone");
    const index = Object.fromEntries([passing(dir, "archimate-pages", ["renderedBy:archimate-pages"])]);
    writeFileSync(join(dir, "index.json"), JSON.stringify({ wireframes: index }));
    const r = checkWireframes(ROOT, [{ dir, prefix: "" }], [], new Map([["cat-harness/beans", "state-visualizer"]]));
    expect(r.unknownRef).toEqual([]);
    expect(r.uncovered).toEqual([{ ref: "cat-harness/beans" }]);
  });

  test("a wireframe naming the visualiser by its route key wins over the writer's", () => {
    const shared = join(ROOT, "by-writer-shared");
    const own = join(ROOT, "by-writer-own");
    writeFileSync(
      (mkdirSync(shared, { recursive: true }), join(shared, "index.json")),
      JSON.stringify({ wireframes: Object.fromEntries([passing(shared, "archimate-pages", ["renderedBy:archimate-pages"])]) }),
    );
    writeFileSync(
      (mkdirSync(own, { recursive: true }), join(own, "index.json")),
      JSON.stringify({ wireframes: Object.fromEntries([passing(own, "archimate", ["dth-sfp/archimate"])]) }),
    );
    // The shared one is read first, as the tools layer's is; the layer's own still covers its page.
    const r = checkWireframes(ROOT, [{ dir: shared, prefix: "cat-harness-tools/" }, { dir: own, prefix: "dth-sfp/" }], [], RENDERERS);
    expect(r.covered).toContainEqual({ ref: "dth-sfp/archimate", wireframe: "dth-sfp/archimate" });
    expect(r.covered).toContainEqual({ ref: "dth-hrh/archimate", wireframe: "cat-harness-tools/archimate-pages" });
  });
});

describe("an uncovered visualiser is advisory (owner, 2026-11-24)", () => {
  /** A wireframe directory with whatever of intent, candidate and report it is given. */
  const wireframe = (
    dir: string,
    topic: string,
    covers: string[],
    opts: { intent?: boolean; candidate?: boolean; report?: { viewport: string; criterion: string; result: string }[] } = {},
  ) => {
    mkdirSync(join(dir, topic), { recursive: true });
    if (opts.intent !== false) writeFileSync(join(dir, topic, "intent.md"), "intent");
    if (opts.candidate !== false) put(join(dir, topic, "as-is.html"));
    if (opts.report !== undefined) {
      mkdirSync(join(dir, topic, "checks"), { recursive: true });
      writeFileSync(join(dir, topic, "checks", "report.json"), JSON.stringify({ topic, candidates: [{ file: "as-is.html", entries: opts.report }] }));
    }
    writeFileSync(join(dir, "index.json"), JSON.stringify({ wireframes: { [topic]: { covers } } }));
  };
  const pass = ["web", "mobile"].map((viewport) => ({ viewport, criterion: "renders", result: "pass" }));
  const RENDERERS = new Map([
    ["cat-harness/beans", "state-visualizer"],
    ["cat-harness/software-libraries", "software-libraries-page"],
  ]);

  test("a declared visualiser no wireframe covers is a note, not a gap: exit 0", () => {
    const dir = join(ROOT, "advisory-uncovered");
    wireframe(dir, "beans", ["cat-harness/beans"], { report: pass });
    const r = checkWireframes(ROOT, [{ dir, prefix: "" }], [], RENDERERS);
    expect(r.uncovered).toEqual([{ ref: "cat-harness/software-libraries" }]);
    expect(wireframeGaps(r)).toBe(0);
    expect(exitOf(judgeWireframes(r))).toBe(0);
    // Still reported in the sidecar, marked advisory.
    const fam = wireframesDocument(r).families.uncovered!;
    expect(fam.count).toBe(1);
    expect(fam.summary).toMatch(/^ADVISORY/);
  });

  test("a wireframe with no intent or no candidate stays red", () => {
    const noIntent = join(ROOT, "advisory-no-intent");
    wireframe(noIntent, "beans", ["cat-harness/beans"], { intent: false, report: pass });
    const a = checkWireframes(ROOT, [{ dir: noIntent, prefix: "" }], [], RENDERERS);
    expect(a.incomplete).toContainEqual({ wireframe: "beans", problem: "no intent.md" });
    expect(exitOf(judgeWireframes(a))).toBe(1);

    const noCandidate = join(ROOT, "advisory-no-candidate");
    wireframe(noCandidate, "beans", ["cat-harness/beans"], { candidate: false });
    const b = checkWireframes(ROOT, [{ dir: noCandidate, prefix: "" }], [], RENDERERS);
    expect(b.incomplete).toContainEqual({ wireframe: "beans", problem: "no candidate .html" });
    expect(exitOf(judgeWireframes(b))).toBe(1);
  });

  test("a candidate with no check report, a missing viewport or a failing check stays red", () => {
    const noReport = join(ROOT, "advisory-no-report");
    wireframe(noReport, "beans", ["cat-harness/beans"]);
    const a = checkWireframes(ROOT, [{ dir: noReport, prefix: "" }], [], RENDERERS);
    expect(a.incomplete.some((i) => i.problem.startsWith("no checks/report.json"))).toBe(true);
    expect(exitOf(judgeWireframes(a))).toBe(1);

    const webOnly = join(ROOT, "advisory-web-only");
    wireframe(webOnly, "beans", ["cat-harness/beans"], { report: [pass[0]!] });
    const b = checkWireframes(ROOT, [{ dir: webOnly, prefix: "" }], [], RENDERERS);
    expect(b.missingViewport).toEqual([{ wireframe: "beans", candidate: "as-is.html", viewport: "mobile" }]);
    expect(exitOf(judgeWireframes(b))).toBe(1);

    const failing = join(ROOT, "advisory-failing");
    wireframe(failing, "beans", ["cat-harness/beans"], { report: [pass[0]!, { viewport: "mobile", criterion: "no-overflow", result: "fail" }] });
    const c = checkWireframes(ROOT, [{ dir: failing, prefix: "" }], [], RENDERERS);
    expect(c.failing).toEqual([{ wireframe: "beans", candidate: "as-is.html", viewport: "mobile", criterion: "no-overflow" }]);
    expect(exitOf(judgeWireframes(c))).toBe(1);
  });
});
