/**
 * The rail of a site whose checkout declares NO layer and only names the
 * harness it lands on (`index.config.json` `site.landing`; an IG repository
 * built by `build-instance-site.ts` with an identity). Owner, 2026-10-14, on
 * litlfred/smart-hiv: *"active graphs have broken links, they go back to
 * smart-base, not smart-hiv"* — the rail was the landing's: its name in the
 * header, every one of its graphs as the site's, and its own row in the
 * Harnesses list linking to the IG's root.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { declaredGraphs, publishedGraphs, railStandalonePages } from "../mount-instance-docs.js";
import { railDataJson, railPageOf, type RailShared } from "../lib/harness-rail.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt, STANDALONE } from "../../test/support/checkout.ts";
import { ensureThemesCss } from "../../test/support/themes-css.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

/** Every case here pins the platform's chrome, themes.css included, which `themes:css` writes at publish (gitignored). */
const THEMES_CSS_NOT_BUILT = siteNotBuilt(
  "site-chrome/assets/css/themes.css, which `themes:css` writes at publish (gitignored) and the landing site ships as its pinned copy",
  join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/css/themes.css")),
);

const BASE = "https://example.org/fa";
const page = (body: string) => `<!doctype html>\n<html><head><title>t</title></head><body>${body}</body></html>\n`;

/** The rail a browser draws for `rel`: the page's own block joined to the shared data. */
function railOf(root: string, rel: string): { shared: RailShared; toRoot: string } {
  const html = readFileSync(join(root, rel), "utf-8");
  const p = railPageOf(html);
  expect(p).toBeDefined();
  const file = join(root, "assets/navbar", `${p!.data}.js`);
  expect(existsSync(file)).toBe(true);
  const shared = JSON.parse(railDataJson(readFileSync(file, "utf-8")).split("@fa-rail-to-root@").join(p!.toRoot).split("@fa-rail-root@").join(p!.root)) as RailShared;
  return { shared, toRoot: p!.toRoot };
}

/** The landing is smart-base, whose declaration labels its row "SMART Base"; only a composed checkout holds it. */
const NO_SMART_BASE = notApplicableAlone("smart-base, the harness this site lands on, whose declaration names its Harnesses row");

describe.skipIf(THEMES_CSS_NOT_BUILT)("a site that only LANDS on a harness: the rail is the site's, not the landing's", () => {
  beforeAll(() => {
    if (!STANDALONE) ensureThemesCss(HARNESS_ROOT);
  });
  // The landing's graph whose page this fixture site holds, read from the same data the rail reads:
  // one the landing DECLARES, since the rail lists no other. A closure without
  // the landing mounted (the standalone check) has none, and the site holds none.
  const held = [...publishedGraphs("cat-harness", "smart-base", "")].find(
    ([kind, f]) => f.href !== undefined && f.sameAs === undefined && declaredGraphs("smart-base", new Map(), new Map([[kind, f]])).some((l) => l.href !== undefined),
  );

  function build(): string {
    const root = mkdtempSync(join(tmpdir(), "landing-rail-"));
    mkdirSync(join(root, "deep"), { recursive: true });
    writeFileSync(join(root, "index.html"), page("<h1>IG</h1>"));
    writeFileSync(join(root, "deep", "page.html"), page("<h1>Deep</h1>"));
    if (held) {
      const dir = join(root, held[1].href!.replace(/^\/+/, ""));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.html"), page("<h1>Held</h1>"));
    }
    railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "WHO SMART Guidelines - HIV", instance: "smart-base", landing: true });
    return root;
  }

  test("the header names the site, not the harness it lands on", () => {
    const { shared } = railOf(build(), "index.html");
    expect(shared.instance).toBe("WHO SMART Guidelines - HIV");
    expect(shared.mark).toBeUndefined();
  });

  test("every graph row links within the site, and only to a page the site holds", () => {
    const root = build();
    for (const rel of ["index.html", "deep/page.html"]) {
      const { shared, toRoot } = railOf(root, rel);
      for (const l of shared.links) {
        expect(l.href).toBeDefined();
        expect(l.href!.startsWith(`${toRoot}/`)).toBe(true);
        expect(l.href!.startsWith(BASE)).toBe(false);
        const target = join(root, rel, "..", l.href!);
        expect(existsSync(target.endsWith(".html") ? target : join(target, "index.html"))).toBe(true);
      }
    }
    if (held) expect(railOf(root, "index.html").shared.links.length).toBeGreaterThan(0);
  });

  test.skipIf(NO_SMART_BASE)("the Harnesses list starts with the site, at its root; the landing links to its own page on the platform", () => {
    const { shared, toRoot } = railOf(build(), "deep/page.html");
    const rows = shared.harnesses ?? [];
    expect(rows[0]).toEqual({ label: "WHO SMART Guidelines - HIV", href: `${toRoot}/` });
    const landing = rows.find((r) => r.label === "SMART Base");
    expect(landing?.href).toBe(`${BASE}/smart-base/`);
    // No other row claims the site's root.
    expect(rows.slice(1).every((r) => r.href === undefined || r.href.startsWith(`${BASE}/`))).toBe(true);
  });

  test.skipIf(NO_SMART_BASE)("without `landing` the rail stays the instance's, as before (bean mftp)", () => {
    const root = mkdtempSync(join(tmpdir(), "landing-rail-off-"));
    writeFileSync(join(root, "index.html"), page("<h1>IG</h1>"));
    railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-immz", instance: "smart-base" });
    const { shared } = railOf(root, "index.html");
    expect(shared.instance).toBe("SMART Base");
    expect(shared.harnesses?.[0]).toMatchObject({ label: "SMART Base", href: "./" });
  });
});
