import { describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkInlineScripts, inlineScripts, pageProblems, scriptProblem } from "../check-inline-scripts.ts";

/**
 * The owner's report of 2026-10-15: `/en/cat-harness/schemas/bootstrap/` as it
 * was PUBLISHED, cut down. The generator wrote `var h = '<h2>' + … + '</h2>'`
 * and `h += "<table>…"`; the theme's passes rewrote both.
 */
const PUBLISHED = `<p>x</p>
<script>
function detail(d) {
  var h = '
<h2>
    <a href="#sc-title" class="anchor-heading" aria-labelledby="sc-title"><svg viewBox="0 0 16 16" aria-hidden="true"><use xlink:href="#svg-link"></use></svg></a> ' + esc(d.name) + '
</h2>
    <p class="sub">';
  return h;
}
</script>`;

/** The same script as the generator wrote it, which is what the chrome now ships. */
const GENERATED = `<p>x</p>
<script>
function detail(d) {
  var h = '<h2>' + esc(d.name) + '</h2><p class="sub">';
  h += "<table><caption class=\\"sub\\">Fields</caption></table>";
  return h;
}
</script>`;

describe("check-inline-scripts — what ships must still parse (owner, 2026-10-15)", () => {
  test("the published bootstrap schema page is refused", () => {
    const p = pageProblems("en/cat-harness/schemas/bootstrap/index.html", PUBLISHED);
    expect(p).toHaveLength(1);
    expect(p[0].line).toBe(2);
    expect(p[0].reason).toContain("anchor-heading");
  });

  test("the generator's own script, untouched, passes: raw <h2> and <table> in a string are not the defect", () => {
    expect(pageProblems("p.html", GENERATED)).toEqual([]);
  });

  test("the table-wrapper pass is refused even where no anchor pass ran", () => {
    expect(scriptProblem(`h += "<div class="table-wrapper"><table>";`)).toContain("table-wrapper");
  });

  test("a rewrite that keeps the script parsing is still refused by its signature", () => {
    expect(scriptProblem(`var h = "<a class=\\"anchor-heading\\">"; var k = '<div class="table-wrapper">';`)).toContain("table-wrapper");
  });

  test("any other build step that breaks a script is refused by the parse", () => {
    expect(scriptProblem("var a = 'broken\nacross lines';")).toContain("does not parse");
  });

  test("only inline classic scripts are judged: src, JSON, modules and templates are not", () => {
    const html = [
      `<script src="a.js"></script>`,
      `<script type="application/ld+json">{"a": 1}</script>`,
      `<script type="application/json">{not js}</script>`,
      `<script type="module">import x from "./x.js";</script>`,
      `<script type="text/x-template"><h2>t</h2></script>`,
      `<script type="text/javascript">var a = 1;</script>`,
      `<script>var b = 2;</script>`,
    ].join("\n");
    expect(inlineScripts(html).map((s) => s.body)).toEqual(["var a = 1;", "var b = 2;"]);
  });

  test("a built site: every page walked, each problem named by page and line", () => {
    const site = mkdtempSync(join(tmpdir(), "inline-scripts-"));
    try {
      mkdirSync(join(site, "en/schemas"), { recursive: true });
      writeFileSync(join(site, "index.html"), GENERATED);
      writeFileSync(join(site, "en/schemas/index.html"), PUBLISHED);
      writeFileSync(join(site, "en/schemas/data.json"), "{}");
      const r = checkInlineScripts(site);
      expect(r.pages).toBe(2);
      expect(r.scripts).toBe(2);
      expect(r.problems.map((p) => `${p.page}:${p.line}`)).toEqual(["en/schemas/index.html:2"]);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});
