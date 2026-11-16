/**
 * `preview-qa.ts`: the change's cone (tests by import closure, gates by the CI
 * cone), judged against main's stored answer, and shown on top of a preview's
 * QA pages with the main report below it, unchanged.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  deltaOf,
  END,
  injectSection,
  injectSite,
  isQaPage,
  judge,
  junitFailures,
  main as cli,
  markdown,
  type PreviewSelection,
  renderSection,
  selectCone,
  changedPaths,
  SITE_REPORT,
  START,
  stripSection,
  testArgs,
} from "../preview-qa.ts";

let root: string;
const put = (files: Record<string, string>) => {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
};
const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf-8" }).trim();

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preview-qa-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const junit = (cases: Record<string, Record<string, boolean>>) => {
  let n = 0;
  const suites = Object.entries(cases).map(([file, tests]) => {
    const tc = Object.entries(tests).map(([name, ok]) => {
      n++;
      return ok ? `<testcase name="${name}" />` : `<testcase name="${name}"><failure message="x" /></testcase>`;
    });
    return `<testsuite name="${file}"><testsuite name="suite">${tc.join("")}</testsuite></testsuite>`;
  });
  return `<?xml version="1.0"?><testsuites tests="${n}">${suites.join("")}</testsuites>`;
};

const sel = (files: string[], changed = ["src/a.ts"]): PreviewSelection => ({
  $schema: "preview-qa-selection/v1",
  base: "main",
  head: "abcdef1234567",
  changed,
  tests: { kind: "some", files, why: Object.fromEntries(files.map((f) => [f, "imports src/a.ts"])) },
});

describe("preview-qa select", () => {
  test("selects the tests whose import closure holds a changed path, from the branch's diff", async () => {
    put({
      "src/a.ts": "export const a = 1;\n",
      "src/c.ts": "export const c = 3;\n",
      "test/a.test.ts": 'import { a } from "../src/a.ts";\n',
      "test/c.test.ts": 'import { c } from "../src/c.ts";\n',
    });
    git("init", "-q", "-b", "main");
    git("-c", "user.name=t", "-c", "user.email=t@t", "add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");
    git("checkout", "-qb", "change");
    writeFileSync(join(root, "src/a.ts"), "export const a = 2;\n");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "change a");
    const changed = changedPaths(root, "main");
    expect(changed).toEqual(["src/a.ts"]);
    const s = await selectCone(root, changed, { base: "main", head: "x" });
    expect(s.tests.kind).toBe("some");
    if (s.tests.kind === "some") expect(s.tests.files).toEqual(["test/a.test.ts"]);
    expect(testArgs(s, "my-layer")).toEqual(["./my-layer/test/a.test.ts"]);
    expect(testArgs(s, "")).toEqual(["./test/a.test.ts"]);
  });

  test("a change to what every test runs under selects all of them, and none is given to bun test", async () => {
    put({ "package.json": "{}\n", "test/a.test.ts": "" });
    const s = await selectCone(root, ["package.json"], { base: "main", head: "x" });
    expect(s.tests.kind).toBe("all");
    expect(testArgs(s, "layer")).toEqual([]);
  });
});

describe("preview-qa judge", () => {
  test("reads failing cases by file from a junit report", () => {
    const j = junitFailures(junit({ "test/a.test.ts": { ok: true, bad: false }, "test/b.test.ts": { ok: true } }));
    expect(j.total).toBe(3);
    expect([...j.files].sort()).toEqual(["test/a.test.ts", "test/b.test.ts"]);
    expect([...(j.byFile.get("test/a.test.ts") ?? [])]).toEqual(["test/a.test.ts > suite > bad"]);
    expect(j.byFile.has("test/b.test.ts")).toBe(false);
  });

  test("marks each check new, fixed, both, still or clean against main", () => {
    expect(deltaOf("fail", "pass", ["x"], [], true)).toBe("new");
    expect(deltaOf("pass", "fail", [], ["x"], true)).toBe("fixed");
    expect(deltaOf("fail", "fail", ["x"], ["y"], true)).toBe("both");
    expect(deltaOf("fail", "fail", [], [], true)).toBe("still");
    expect(deltaOf("fail", "fail", ["x"], [], true)).toBe("new");
    expect(deltaOf("pass", "pass", [], [], true)).toBe("clean");
    expect(deltaOf("undetermined", "pass", [], [], true)).toBe("new");
  });

  test("a red check whose main answer is not stored is unknown, never new", () => {
    const r = judge({
      selection: sel(["test/a.test.ts"]),
      head: { junit: junit({ "layer/test/a.test.ts": { bad: false } }), gates: { "g:check": { exit: 1 } } },
      prefix: "layer",
    });
    expect(r.main.available).toBe(false);
    expect(r.results.map((x) => [x.kind, x.delta])).toEqual([["gate", "unknown"], ["test", "unknown"]]);
    expect(r.notes.join(" ")).toContain("not stored");
  });

  test("judges the selected tests and the gates the cone ran, and counts the gates outside it", () => {
    const r = judge({
      selection: sel(["test/a.test.ts", "test/b.test.ts", "test/c.test.ts"]),
      prefix: "layer",
      head: {
        junit: junit({ "layer/test/a.test.ts": { one: false }, "layer/test/b.test.ts": { two: true }, "layer/test/c.test.ts": { three: true } }),
        gates: {
          "l:check:new": { exit: 1 },
          "l:check:fixed": { exit: 0 },
          "l:check:both": { exit: 1 },
          "l:check:still": { exit: 1 },
          "l:check:na": { exit: 78 },
          "l:check:outside": { skipped: "unchanged", unchanged: "1234567" },
          "l:check:off": { skipped: "needs a token" },
        },
      },
      main: {
        sha: "fedcba9876543",
        junit: junit({ "layer/test/a.test.ts": { one: true }, "layer/test/b.test.ts": { two: false }, "layer/test/c.test.ts": { three: true } }),
        gates: { "l:check:new": { exit: 0 }, "l:check:fixed": { exit: 1 }, "l:check:both": { exit: 1 }, "l:check:still": { exit: 1 }, "l:check:na": { exit: 78 } },
      },
      findings: { head: { "l:check:both": ["e1", "e2"], "l:check:still": ["s"] }, main: { "l:check:both": ["e2", "e3"], "l:check:still": ["s"] } },
    });
    const by = Object.fromEntries(r.results.map((x) => [x.name, x.delta]));
    expect(by).toEqual({
      "test/a.test.ts": "new",
      "test/b.test.ts": "fixed",
      "test/c.test.ts": "clean",
      "l:check:new": "new",
      "l:check:fixed": "fixed",
      "l:check:both": "both",
      "l:check:still": "still",
      "l:check:na": "clean",
    });
    const both = r.results.find((x) => x.name === "l:check:both")!;
    expect(both.added).toEqual(["e1"]);
    expect(both.removed).toEqual(["e3"]);
    expect(r.cone.outside).toBe(1);
    expect(r.cone.gates).not.toContain("l:check:off");
    expect(r.results[0]!.delta).toBe("new");
    expect(r.counts).toEqual({ new: 2, both: 1, unknown: 0, still: 1, fixed: 2, clean: 2 });
    expect(markdown(r)).toContain("**new** gate `l:check:new`");
  });

  test("a change that reaches every test runs none and says so", () => {
    const s: PreviewSelection = { ...sel([]), tests: { kind: "all", why: "bun.lock is part of what every test runs under" } };
    const r = judge({ selection: s, head: { junit: junit({}), gates: {} }, main: { junit: junit({}), gates: {} } });
    expect(r.results).toEqual([]);
    expect(r.notes[0]).toContain("No tests were run");
    expect(r.notes[0]).toContain("release");
  });
});

describe("preview-qa page", () => {
  const page = '<!doctype html><html><head><title>QA</title></head><body><header>h</header><main class="qa"><h1>Main QA</h1><p>report</p></main></body></html>';
  const report = judge({
    selection: sel(["test/a.test.ts"]),
    head: { junit: junit({ "test/a.test.ts": { one: false } }), gates: { "g:check": { exit: 0 } } },
    main: { junit: junit({ "test/a.test.ts": { one: true } }), gates: { "g:check": { exit: 1 } }, sha: "fedcba9" },
  });

  test("puts the section first in main, with the main report below it unchanged", () => {
    const out = injectSection(page, renderSection(report, { sha: "abcdef1" }));
    const a = out.indexOf(START);
    expect(a).toBeGreaterThan(out.indexOf('<main class="qa">'));
    expect(a).toBeLessThan(out.indexOf("<h1>Main QA</h1>"));
    expect(out).toContain("This change (preview)");
    expect(out).toContain("pq-new");
    expect(out).toContain("pq-fixed");
    expect(stripSection(out).replace(/\n/g, "")).toBe(page);
  });

  test("injecting twice replaces the section rather than stacking a second one", () => {
    const once = injectSection(page, renderSection(report, { sha: "abcdef1" }));
    const twice = injectSection(once, renderSection(undefined, { sha: "abcdef1" }));
    expect(twice.split(START).length).toBe(2);
    expect(twice.split(END).length).toBe(2);
    expect(twice).toContain("not run");
  });

  test("a preview with no cone run, or one for another commit, says so and how to start one", () => {
    expect(renderSection(undefined, { sha: "abcdef1" })).toContain("Label the PR <code>preview</code>");
    expect(renderSection(report, { sha: "0000000" })).toContain("not this commit");
  });

  test("escapes what it shows", () => {
    const r = judge({ selection: sel([]), head: { junit: junit({}), gates: { "<x>": { exit: 1 } } } });
    const html = renderSection(r, { sha: "abcdef1" });
    expect(html).toContain("&lt;x&gt;");
    expect(html).not.toContain("<x>");
  });

  test("finds the QA pages of a site, and puts the report beside them", () => {
    expect(isQaPage("qa.html")).toBe(true);
    expect(isQaPage("docs/qa/index.html")).toBe(true);
    expect(isQaPage("site-qa.html")).toBe(true);
    expect(isQaPage("index.html")).toBe(false);
    expect(isQaPage("x.html", '<meta name="cat:qa-report" content="1">')).toBe(true);
    put({ "site/qa.html": page, "site/index.html": page, "site/docs/qa/index.html": page });
    const done = injectSite(join(root, "site"), report, { sha: "abcdef1" });
    expect(done.sort()).toEqual(["docs/qa/index.html", "qa.html"]);
    expect(readFileSync(join(root, "site/index.html"), "utf-8")).toBe(page);
    expect(JSON.parse(readFileSync(join(root, "site", SITE_REPORT), "utf-8")).$schema).toBe("preview-qa/v1");
  });

  test("the CLI judges and injects from files", async () => {
    put({
      "sel.json": JSON.stringify(sel(["test/a.test.ts"])),
      "head/junit.xml": junit({ "test/a.test.ts": { one: false } }),
      "head/gates.json": JSON.stringify({ "g:check": { exit: 0 } }),
      "main/junit.xml": junit({ "test/a.test.ts": { one: true } }),
      "main/gates.json": JSON.stringify({ "g:check": { exit: 0 } }),
      "main/from.json": JSON.stringify({ main: "fedcba9876", run: "https://example.invalid/run" }),
      "site/qa.html": page,
    });
    const at = (p: string) => join(root, p);
    expect(await cli(["judge", "--selection", at("sel.json"), "--head-dir", at("head"), "--main-dir", at("main"), "--out", at("pq.json"), "--md", at("pq.md")])).toBe(0);
    const r = JSON.parse(readFileSync(at("pq.json"), "utf-8"));
    expect(r.main).toEqual({ available: true, sha: "fedcba9876", run: "https://example.invalid/run" });
    expect(r.counts.new).toBe(1);
    expect(await cli(["inject", "--site", at("site"), "--report", at("pq.json"), "--sha", "abcdef1"])).toBe(0);
    expect(readFileSync(at("site/qa.html"), "utf-8")).toContain("This change (preview)");
  });
});
