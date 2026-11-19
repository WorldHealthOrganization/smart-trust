/**
 * The Jekyll sidebar include writes no `id` twice on a built page.
 *
 * just-the-docs renders its footer extension point TWICE per page (once in
 * `.side-bar`, once in a `.d-md-none` block). The Harnesses panel's
 * `id="fa-nav-harnesses"` was written plainly into the include, so it
 * appeared twice on 11,518 of 23,545 built pages and `check:duplicate-ids`
 * failed the train (folio-assistant#3124). The include now suffixes every id
 * it writes per copy: the first copy keeps the plain id, the second gets `-2`.
 *
 * Rendered here with Liquid the way the theme renders it, so the test reads
 * what a reader's browser gets rather than the template.
 */
import { describe, expect, test } from "bun:test";
import { Liquid } from "liquidjs";

import { duplicateIds } from "../../check-duplicate-ids.ts";
import { render, type Harness } from "../../gen-navbar-include.ts";
import type { NavItem } from "../../lib/navbar.ts";

const HARNESSES: Harness[] = [
  { name: "alpha", label: "Alpha", href: "/alpha/", instantiated: true },
  { name: "beta", label: "Beta", href: "/beta/", instantiated: true },
];
// A folded row, so the fold ids are covered as well as the panel's.
const PAGES: NavItem[] = [{ label: "Guide", href: "/guide/", fold: "pages", children: [{ label: "A", href: "/guide/a/" }] }];

/** One built page: the include rendered twice in one page context, as just-the-docs does. */
async function builtPage(staging = ""): Promise<string> {
  const include = render(HARNESSES, "T", false, PAGES);
  // `dynamicPartials: false`: an unquoted include name, as Jekyll writes it.
  const engine = new Liquid({
    dynamicPartials: false,
    templates: {
      "nav.html": include,
      "page.html": `<div class="side-bar">{% include nav.html %}</div><div class="d-md-none">{% include nav.html %}</div>`,
    },
  });
  engine.registerFilter("relative_url", (v: unknown) => String(v));
  return engine.renderFile("page.html", { site: { data: { build: { staging_slug: staging } } } });
}

const attrs = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map((m) => m[1]!);

describe("the sidebar include, rendered twice per page", () => {
  for (const [deploy, slug] of [["canonical", ""], ["staging", "some-branch"]] as const) {
    test(`${deploy}: id="fa-nav-harnesses" exactly once, and no id twice`, async () => {
      const page = await builtPage(slug);
      expect(page.split('id="fa-nav-harnesses"').length - 1).toBe(1);
      expect(page).toContain('id="fa-nav-harnesses-2"');
      expect([...duplicateIds(page)]).toEqual([]);
    });

    test(`${deploy}: every aria-controls names an id on the page, each its own`, async () => {
      const page = await builtPage(slug);
      const ids = new Set(attrs(page, "id"));
      const controls = attrs(page, "aria-controls");
      expect(controls).toContain("fa-nav-harnesses");
      expect(controls).toContain("fa-nav-harnesses-2");
      for (const c of controls) expect(ids.has(c)).toBe(true);
      expect(new Set(controls).size).toBe(controls.length);
    });
  }
});
