/**
 * A site's QA pages show what its build published with (owner, 2026-11-14: a
 * shortfall is a QA report, not a refusal): which pages carry the panel, how
 * it is added, and what its script draws for each answer the three reports
 * can give.
 *
 * @module scripts/tests/ui/site-qa-panel
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { placeSiteQaPanel, SITE_QA_JS, SITE_QA_MARK, siteQaPanel, siteQaRoutes, toSiteRoot, withSiteQaPanel } from "../../site-qa-panel.ts";

const EXPECTED = [
  { route: "en/cat-harness/qa/", visualiser: "qa" },
  { route: "en/cat-harness/qa/layer-a/", visualiser: "qa", instance: "layer-a" },
  { route: "en/cat-harness/qa/layer-b/", visualiser: "qa", instance: "layer-b" },
  { route: "en/cat-harness/beans/", visualiser: "beans" },
];

describe("which pages carry the panel", () => {
  test("a QA visualiser's own page and its page for the site's layer, no other", () => {
    expect(siteQaRoutes(EXPECTED, new Set(["qa"]), "layer-a")).toEqual(["en/cat-harness/qa/", "en/cat-harness/qa/layer-a/"]);
    expect(siteQaRoutes(EXPECTED, new Set(["qa"]), undefined)).toEqual(["en/cat-harness/qa/"]);
    expect(siteQaRoutes(EXPECTED, new Set(), "layer-a")).toEqual([]);
  });

  test("the path up to the site root is relative, one step per route segment", () => {
    expect(toSiteRoot("en/cat-harness/qa/layer-a/")).toBe("../../../..");
    expect(toSiteRoot("qa/")).toBe("..");
    expect(toSiteRoot("")).toBe(".");
  });
});

describe("adding the panel", () => {
  const PAGE = "<!doctype html><html><head><title>QA</title></head><body><h1>QA</h1></body></html>";

  test("it goes before </body>, once, reading the reports relative to the page", () => {
    const once = withSiteQaPanel(PAGE, "en/qa/");
    expect(once.indexOf(SITE_QA_MARK)).toBeLessThan(once.indexOf("</body>"));
    expect(once).toContain('data-dir="../../assets/site-qa"');
    expect(withSiteQaPanel(once, "en/qa/")).toBe(once);
  });

  test("it holds nothing Liquid would evaluate, and links the reports for a reader without JavaScript", () => {
    const html = siteQaPanel("..");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("{%");
    expect(html).toContain('<a href="../assets/site-qa/parity.json">');
  });

  test("only pages the site holds are changed; a missing route is not created", () => {
    const site = mkdtempSync(join(tmpdir(), "site-qa-"));
    mkdirSync(join(site, "en/qa"), { recursive: true });
    writeFileSync(join(site, "en/qa/index.html"), PAGE);
    expect(placeSiteQaPanel(site, ["en/qa/", "en/qa/missing/"])).toEqual(["en/qa/"]);
    expect(readFileSync(join(site, "en/qa/index.html"), "utf-8")).toContain(SITE_QA_MARK);
  });
});

/** Runs the page script over one box with `fetch` answered from `answers` (file name → JSON, a status, or "throw"). */
async function runScript(answers: Record<string, unknown>): Promise<{ text: string; urls: string[] }> {
  const texts: string[] = [];
  const node = (): Record<string, unknown> => ({
    className: "",
    set textContent(v: string) {
      if (v) texts.push(v);
    },
    appendChild: (c: unknown) => c,
  });
  const box = { ...node(), getAttribute: (k: string) => (k === "data-dir" ? "../../assets/site-qa" : null) };
  const urls: string[] = [];
  const document = { querySelectorAll: () => [box], createElement: () => node() };
  const fetch = async (u: string) => {
    urls.push(u);
    const v = answers[u.split("/").pop()!];
    if (v === "throw") throw new Error("network down");
    if (v === undefined || typeof v === "number") return { ok: false, status: v ?? 404, json: async () => ({}) };
    if (v === "not json") return { ok: true, status: 200, json: async () => Promise.reject(new SyntaxError("bad")) };
    return { ok: true, status: 200, json: async () => v };
  };
  runInNewContext(SITE_QA_JS, { document, fetch, Promise, Error, String, Array, JSON });
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  return { text: texts.join("\n"), urls };
}

const PARITY = {
  $schema: "site-parity-report/v1",
  outcome: "published-with-shortfall",
  shortfall: ["the harness icon row (#fa-navbar-row): on the current root's index.html, not on the candidate's"],
  droppedByRuling: [{ what: "the theme's side bar (#site-nav)", ruling: "layout C, 2026-10-15" }],
};
const BUILD = {
  $schema: "site-build-qa/v1",
  findings: [
    { check: "coverage", detail: "en/x/qa/ (x declares `qa`)" },
    { check: "inline-scripts", detail: "a.html:3 unterminated string" },
    { check: "coverage", detail: "en/x/todos/ (x declares `todos`)" },
  ],
};
const LINKS = { $schema: "site-link-report/v1", pages: 12, unresolved: [{ page: "a.html", href: "b.html" }], selfAddress: [], content: [], diagrams: 0, inDiagrams: [] };

describe("the panel's script", () => {
  test("reads the three reports from the page's relative path", async () => {
    const r = await runScript({ "parity.json": PARITY, "build.json": BUILD, "links.json": LINKS });
    expect(r.urls).toEqual(["../../assets/site-qa/parity.json", "../../assets/site-qa/build.json", "../../assets/site-qa/links.json"]);
  });

  test("draws each shortfall, the findings grouped by check, and the links", async () => {
    const { text } = await runScript({ "parity.json": PARITY, "build.json": BUILD, "links.json": LINKS });
    expect(text).toContain("It was published lacking 1 thing(s) the published site carried:");
    expect(text).toContain("the harness icon row (#fa-navbar-row)");
    expect(text).toContain("the theme's side bar (#site-nav) (layout C, 2026-10-15)");
    expect(text).toContain("3 finding(s), published rather than refused:");
    expect(text).toContain("coverage (2)");
    expect(text).toContain("inline-scripts (1)");
    expect(text).toContain("12 page(s) checked: 1 unresolved");
    expect(text).toContain("a.html: b.html");
  });

  test("a build that lost nothing, and published with nothing to report, says so", async () => {
    const { text } = await runScript({
      "parity.json": { ...PARITY, outcome: "carries-everything", shortfall: [], droppedByRuling: [] },
      "build.json": { $schema: "site-build-qa/v1", findings: [] },
      "links.json": { ...LINKS, unresolved: [] },
    });
    expect(text).toContain("It carries everything the published site carried.");
    expect(text).toContain("No findings: the build published with nothing to report.");
  });

  test("a missing report is unknown, not zero, and says why it may be missing", async () => {
    const { text } = await runScript({ "links.json": LINKS });
    expect(text).toContain("parity.json: no parity report: this build was a preview, or had no published site to compare with. Unknown, not zero.");
    expect(text).toContain("build.json: no build report: this site was built before builds recorded one. Unknown, not zero.");
    expect(text).not.toContain("No findings");
  });

  test("an unreachable, failing, malformed or foreign report is unknown, not zero", async () => {
    const { text } = await runScript({ "parity.json": "throw", "build.json": 500, "links.json": "not json" });
    expect(text).toContain("parity.json: it could not be reached (network down). Unknown, not zero.");
    expect(text).toContain("build.json: it answered HTTP 500. Unknown, not zero.");
    expect(text).toContain("links.json: it is not JSON. Unknown, not zero.");
    const foreign = await runScript({ "parity.json": { $schema: "other/v1" }, "build.json": BUILD, "links.json": LINKS });
    expect(foreign.text).toContain("parity.json: it is not a site-parity-report/v1. Unknown, not zero.");
  });
});
