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
import { checkWireframes } from "../check-wireframes.ts";

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
