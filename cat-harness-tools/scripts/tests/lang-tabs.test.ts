import { describe, expect, test } from "bun:test";

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { langTabs } from "../lib/lang-tabs.ts";
import { fallbackCandidates, writeLocaleFallback404, FALLBACK_MARK } from "../lib/locale-fallback-404.ts";
import { checkLinks } from "../build-instance-site.ts";

const META = (lang: string, available: string[]) =>
  `<script type="application/json" id="fa-translation-meta">${JSON.stringify({ lang, supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"], availableLocales: available })}</script>`;
const ALT = (loc: string, href: string) => `<link rel="alternate" hreflang="${loc}" href="${href}">`;

describe("language tabs — where the chrome's tabs link (owner, 2026-11-13: who-iris/fr/ 404)", () => {
  test("a declared hreflang alternate is the tab's href; the /<locale>/ guess only without one", async () => {
    const html = `<head>${ALT("fr", "who-iris/fr/index.html")}${META("en", ["en", "fr", "es"])}</head>`;
    expect(await langTabs(html, "/who-iris/index.html")).toEqual([
      { locale: "fr", href: "who-iris/fr/index.html", from: "alternate" },
      { locale: "es", href: "/who-iris/es/index.html", from: "convention" },
    ]);
  });

  test("a page under a locale-prefixed tree swaps its segment in place (the who-iris glossary pages)", async () => {
    expect(await langTabs(META("fr", ["en", "fr", "es"]), "/who-iris/fr/folio-assistant-core/glossary/index.html")).toEqual([
      { locale: "en", href: "/who-iris/folio-assistant-core/glossary/index.html", from: "convention" },
      { locale: "es", href: "/who-iris/es/folio-assistant-core/glossary/index.html", from: "convention" },
    ]);
    expect(await langTabs(META("fr", ["en", "fr", "es"]), "/r/x/fr/a.html")).toContainEqual({ locale: "es", href: "/r/x/es/a.html", from: "convention" });
  });

  test("an unavailable locale draws no link, and a page with no meta block draws no tabs", async () => {
    expect(await langTabs(`${META("en", [])}`, "/r/a.html")).toEqual([]);
    expect(await langTabs("<p>no chrome</p>", "/r/a.html")).toEqual([]);
  });

  test("a translated page's English tab strips its own locale segment", async () => {
    expect(await langTabs(META("fr", ["en", "fr"]), "/r/fr/a.html")).toEqual([{ locale: "en", href: "/r/a.html", from: "convention" }]);
  });

  test("the publish link check refuses a tab that reaches no page: the who-iris home as it was", async () => {
    const site = mkdtempSync(join(tmpdir(), "lang-tabs-"));
    mkdirSync(join(site, "who-iris", "fr"), { recursive: true });
    writeFileSync(join(site, "who-iris", "fr", "index.html"), "fr");
    // The meta says French and Spanish exist; the page declares no alternates, so the tabs guess /<locale>/.
    writeFileSync(join(site, "index.html"), `<head>${META("en", ["en", "fr", "es"])}</head>`);
    const r = await checkLinks(site, "/who-iris/", new Set(["index.html"]));
    expect(r.misses).toEqual([
      "index.html: /who-iris/fr/index.html (language tab fr, by convention)",
      "index.html: /who-iris/es/index.html (language tab es, by convention)",
    ]);
    // With the page's own alternates, the French tab follows them and resolves; Spanish still has no page.
    writeFileSync(join(site, "index.html"), `<head>${ALT("fr", "who-iris/fr/index.html")}${META("en", ["en", "fr", "es"])}</head>`);
    expect((await checkLinks(site, "/who-iris/", new Set())).misses).toEqual(["index.html: /who-iris/es/index.html (language tab es, by convention)"]);
  });
});

describe("the 404 page's English fallback", () => {
  const L = ["ar", "zh", "en", "fr", "ru", "es"];
  test("a locale segment is replaced by en/, then removed; never the path asked for", () => {
    expect(fallbackCandidates("/who-iris/fr/", L)).toEqual(["/who-iris/en/", "/who-iris/"]);
    expect(fallbackCandidates("/r/branches/x/es/glossary/a.html", L)).toEqual(["/r/branches/x/en/glossary/a.html", "/r/branches/x/glossary/a.html"]);
    expect(fallbackCandidates("/who-iris/en/", L)).toEqual(["/who-iris/"]);
    expect(fallbackCandidates("/who-iris/missing.html", L)).toEqual([]);
    for (const p of ["/fr/", "/a/fr/b", "/en/"]) expect(fallbackCandidates(p, L)).not.toContain(p);
  });

  test("a site without a 404 page gets one; a site with one keeps it and gains the fallback, once", () => {
    const site = mkdtempSync(join(tmpdir(), "404-"));
    expect(writeLocaleFallback404(site, "/r/", L)).toBe("written");
    const page = readFileSync(join(site, "404.html"), "utf-8");
    expect(page).toContain(FALLBACK_MARK);
    expect(page).toContain('href="/r/"');
    // The script is after the notice it fills.
    expect(page.indexOf("fa-locale-fallback-note")).toBeLessThan(page.indexOf(`<script id="${FALLBACK_MARK}"`));
    expect(writeLocaleFallback404(site, "/r/", L)).toBe("present");

    const own = mkdtempSync(join(tmpdir(), "404-own-"));
    writeFileSync(join(own, "404.html"), "<html><body><h1>Lost</h1></body></html>");
    expect(writeLocaleFallback404(own, "/r/", L)).toBe("added");
    const kept = readFileSync(join(own, "404.html"), "utf-8");
    expect(kept).toContain("<h1>Lost</h1>");
    expect(kept.match(new RegExp(FALLBACK_MARK, "g"))).toHaveLength(1);
    expect(kept.endsWith("</script></body></html>")).toBe(true);
  });
});
