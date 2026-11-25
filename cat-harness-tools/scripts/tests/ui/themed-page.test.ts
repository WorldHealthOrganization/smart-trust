/**
 * `themedPage` puts a generated viewer onto the site's `default` layout — the
 * one layout that carries the top band (search, Folio, language).
 *
 * @module scripts/tests/themed-page.test
 */
import { describe, expect, test } from "bun:test";

import { subjectNav, subjectNavCss, themedBody, themedPage, unscopedSelectors, yamlQuoted } from "../../lib/themed-page.ts";
import { withRenderedByFrontMatter } from "../../viewer-declarations.js";
import { isStandalonePage } from "../../viewer-page.ts";

const page = (body: string, title = "A page") =>
  themedPage({ title, generator: "cat-harness/scripts/gen-x.ts", command: "bun run x", body });

describe("themedPage", () => {
  test("front matter: the default layout, a quoted title, out of the theme's nav", () => {
    const out = page("<h1 id=\"t\">Hi</h1>", 'Say "hi" \\ there');
    expect(out.startsWith("---\nlayout: default\n")).toBe(true);
    expect(out).toContain('title: "Say \\"hi\\" \\\\ there"\n');
    expect(out).toContain("nav_exclude: true\n---\n");
    // Not a standalone document, so no rail is injected into it.
    expect(isStandalonePage(out)).toBe(false);
    expect(out).not.toMatch(/<!doctype|<html|<head|<body/i);
  });

  test("the body sits inside one Liquid raw block, and a closing tag in it cannot end it early", () => {
    const out = page("<p>{{ x }} and {% endraw %} here</p>");
    const raws = out.match(/\{% raw %\}/g) ?? [];
    // One opener of our own, plus the one the escape reopens with.
    expect(raws.length).toBe(2);
    expect(out.trimEnd().endsWith("{% endraw %}")).toBe(true);
    expect(out).toContain('{% endraw %}{{ "{" }}{% raw %}% endraw %}');
  });

  test("rendered-by goes into the same front matter, and no `renders` list does", () => {
    // Owner, 2026-10-09: the harness declares each visualiser; a page names
    // only the Tool that drew it.
    const out = withRenderedByFrontMatter(page("<p>x</p>"), "x-viewer");
    expect(out).toMatch(/^---\n[\s\S]*\nrendered-by: x-viewer\n---\n/);
    expect(out).not.toMatch(/^renders:/m);
  });

  test("themedBody recovers the body a layout stand-in serves", () => {
    expect(themedBody(page('<div class="x">\n<p>y</p>\n</div>\n'))).toBe('<div class="x">\n<p>y</p>\n</div>');
  });

  test("subjectNav: relative links to every subject page, the current one plain text", () => {
    const index = subjectNav({ subjects: ["a", "b"], cls: "x" });
    expect(index).toContain('<span aria-current="page">All instances</span>');
    expect(index).toContain('<a href="a/">a</a>');
    const onA = subjectNav({ subjects: ["a", "b"], current: "a", cls: "x" });
    expect(onA).toContain('<a href="../">All instances</a>');
    expect(onA).toContain('<span aria-current="page">a</span>');
    expect(onA).toContain('<a href="../b/">b</a>');
    expect(subjectNav({ subjects: [], cls: "x" })).toBe("");
    expect(unscopedSelectors(`<style>${subjectNavCss("x")}</style>`, ".x")).toEqual([]);
  });

  test("unscopedSelectors names a rule that would restyle the theme", () => {
    const css = '<style>.x a { color: red } :root[data-fa-scheme="light"] .x { --c: 1 } @media (max-width: 9px) { .x p { margin: 0 } } body { margin: 0 } a, .x b { color: red }</style>';
    expect(unscopedSelectors(css, ".x")).toEqual(["body", "a"]);
  });

  test("yamlQuoted escapes the two characters YAML treats specially", () => {
    expect(yamlQuoted('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});
