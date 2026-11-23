/**
 * A document site per declared locale (owner, option A, 2026-11-18): the
 * pure helpers, then a two-block folio declaring fr, ar and de with French
 * and Arabic catalogues built end to end, then the French page in a browser.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";

import { initFolio } from "@litlfred/cat-harness-tools/scripts/init-folio.js";
import { buildDocumentSite } from "./build-document-site.ts";
import { rebaseHtmlUrls } from "./document-site-route.ts";
import { declaredLocales, directionOf, hreflangLinks, languageSwitcher, markUntranslated, nativeName, translationNote } from "./document-locales.ts";

const REPO_ROOT = resolve(import.meta.dir, "../..");

describe("the helpers", () => {
  test("declaredLocalesOnlyWhenDeclared", () => {
    expect(declaredLocales(undefined)).toEqual({ source: "en", targets: [] });
    expect(declaredLocales({ defaultLocale: "en", supportedLocales: ["ar", "en", "fr", "fr", "Not a tag"] })).toEqual({ source: "en", targets: ["ar", "fr"] });
    expect(declaredLocales({ defaultLocale: "fr", supportedLocales: ["en", "fr"] })).toEqual({ source: "fr", targets: ["en"] });
  });

  test("directionAndNativeName", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("fa-IR")).toBe("rtl");
    expect(directionOf("fr")).toBe("ltr");
    expect(nativeName("fr")).toBe("français");
    expect(nativeName("ar")).toBe("العربية");
    // An unknown tag never throws; it is named by its code.
    expect(nativeName("qaa").toLowerCase()).toBe("qaa");
  });

  test("untranslatedBlocksAreTheSourceMarked", () => {
    const src = `# T\n\n<a id="b:1"></a>\nHello.\n\n<a id="b:2"></a>\nWorld.\n`;
    const fr = `# T\n\n<a id="b:1"></a>\nBonjour.\n\n<a id="b:2"></a>\nWorld.\n`;
    const m = markUntranslated(fr, src, new Set(["b:1", "b:2"]));
    expect(m.translated).toBe(1);
    expect(m.total).toBe(2);
    expect(m.markdown).toContain("Bonjour.");
    expect(m.markdown).toContain(`<div class="fa-untranslated" lang="en" dir="ltr">\n\n<p class="fa-untranslated-mark">(untranslated)</p>\n\nWorld.\n\n</div>`);
    expect(m.markdown).not.toMatch(/fa-untranslated[^\n]*\n\n[^\n]*\n\nBonjour/);
  });

  test("switcherNamesEachVersionInItsOwnLanguage", () => {
    expect(languageSwitcher("en", ["en"], "doc")).toBe("");
    const nav = languageSwitcher("fr", ["en", "fr", "ar"], "doc");
    expect(nav).toContain(`aria-label="Language"`);
    expect(nav).toContain(`<a href="../../fr/doc/index.html" hreflang="fr" lang="fr" aria-current="page">français</a>`);
    expect(nav).toContain(`<a href="../../ar/doc/index.html" hreflang="ar" lang="ar">العربية</a>`);
    // The source stays under the page locale, wherever its pages are routed.
    expect(languageSwitcher("fr", ["fr", "en"], "doc", (l) => (l === "fr" ? "en" : l))).toContain(`href="../../en/doc/index.html" hreflang="fr"`);
  });

  test("hreflangForEveryVersionAndXDefault", () => {
    expect(hreflangLinks("en", ["en"], "doc")).toBe("");
    expect(hreflangLinks("en", ["en", "fr"], "doc")).toBe(
      `<link rel="alternate" hreflang="en" href="../../en/doc/index.html">\n` +
        `<link rel="alternate" hreflang="fr" href="../../fr/doc/index.html">\n` +
        `<link rel="alternate" hreflang="x-default" href="../../en/doc/index.html">\n`,
    );
  });

  test("noteSaysUnofficialAndHowMuch", () => {
    expect(translationNote("en", 1, 2)).toContain("Unofficial translation: 1 of 2 blocks translated.");
    expect(translationNote("en", 1, 2)).toContain(`lang="en"`);
  });
});

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

const po = (entries: [string, string][]) =>
  `msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n` + entries.map(([id, str]) => `msgid ${JSON.stringify(id)}\nmsgstr ${JSON.stringify(str)}\n`).join("\n");

/** The scaffolded handbook with a second block, declaring fr, ar and de; French and Arabic catalogues translate the first block only. */
function twoLocaleFolio(): string {
  const d = mkdtempSync(join(tmpdir(), "docsite-locales-"));
  roots.push(d);
  initFolio({ targetDir: d, slug: "handbook", title: "Handbook", authors: ["A"], contentType: "document", skipVcs: true, link: "submodule" } as Parameters<typeof initFolio>[0]);
  symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
  const ch = join(d, "folio", "handbook", "introduction");
  writeFileSync(join(ch, "scope.ts"), `import { prose } from "../../schema/builders";\n\nexport default prose({ label: "prose:scope", title: "Scope", uses: [] });\n`);
  // A figure the page links relative to itself: the translated pages must reach it too.
  writeFileSync(join(ch, "scope.md"), "Scope text stays in English.\n\n![A figure](media/figure.png)\n");
  mkdirSync(join(d, "folio", "handbook", "media"), { recursive: true });
  writeFileSync(join(d, "folio", "handbook", "media", "figure.png"), "png");
  const node = JSON.parse(readFileSync(join(ch, "overview.jsonld"), "utf-8"));
  writeFileSync(join(ch, "scope.jsonld"), JSON.stringify({ ...node, "@id": "papers/handbook/blocks/prose-scope", label: "prose:scope", title: "Scope", text: "scope.md" }, null, 2) + "\n");
  const chapter = join(ch, "introduction.ts");
  writeFileSync(chapter, readFileSync(chapter, "utf-8").replace(`blocks: ["overview"]`, `blocks: ["overview", "scope"]`));
  const cfgPath = join(d, "index.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
  cfg.instances[0].translation = { defaultLocale: "en", supportedLocales: ["en", "fr", "ar", "de"] };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const first = "This is the first block of the handbook.";
  writeFileSync(join(ch, "overview.md"), `${first}\n`);
  for (const [loc, title, text] of [
    ["fr", "Vue d'ensemble", "Ceci est le premier bloc du manuel."],
    ["ar", "نظرة عامة", "هذه هي الكتلة الأولى من الدليل."],
  ] as const) {
    mkdirSync(join(d, "translations", loc), { recursive: true });
    writeFileSync(join(d, "translations", loc, "global.po"), po([["Overview", title], [first, text]]));
  }
  return d;
}

describe("a site per declared locale", () => {
  test("eachTranslatedLocaleGetsItsPage", async () => {
    const d = twoLocaleFolio();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    // fr and ar have catalogues; de is declared but translates nothing, so it gets no page.
    expect(r.documents[0]!.translations?.map((t) => [t.locale, t.translated, t.total])).toEqual([
      ["fr", 1, 2],
      ["ar", 1, 2],
    ]);
    expect(existsSync(join(out, "fr", "handbook", "index.html"))).toBe(true);
    expect(existsSync(join(out, "ar", "handbook", "index.html"))).toBe(true);
    expect(existsSync(join(out, "de", "handbook", "index.html"))).toBe(false);

    const fr = readFileSync(join(out, "fr", "handbook", "index.html"), "utf-8");
    expect(fr).toContain(`<html lang="fr">`);
    expect(fr).toContain("Ceci est le premier bloc du manuel.");
    // The untranslated block is the source, marked, in its own language.
    expect(fr).toMatch(/<div class="fa-untranslated" lang="en" dir="ltr">[\s\S]*\(untranslated\)[\s\S]*Scope text stays in English\.[\s\S]*<\/div>/);
    expect(fr).toContain("Unofficial translation: 1 of 2 blocks translated.");
    expect(fr).toContain(`<link rel="alternate" hreflang="x-default" href="../../en/handbook/index.html">`);
    // The block anchors survive, so links into the page still land.
    expect(fr).toContain('<a id="prose:overview"></a>');

    const ar = readFileSync(join(out, "ar", "handbook", "index.html"), "utf-8");
    expect(ar).toContain(`<html lang="ar" dir="rtl">`);

    const en = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(en).toContain(`<html lang="en">`);
    expect(en).toContain(`<nav class="fa-lang-switch" aria-label="Language">`);
    expect(en).toContain(`<link rel="alternate" hreflang="fr" href="../../fr/handbook/index.html">`);
    expect(en).not.toContain("fa-untranslated\"");

    const landing = readFileSync(join(out, "index.html"), "utf-8");
    expect(landing).toContain(`<a href="fr/handbook/index.html" hreflang="fr" lang="fr">français</a>`);
  }, 60_000);

  test("noDeclarationNoLocalePages", async () => {
    const d = twoLocaleFolio();
    const cfgPath = join(d, "index.config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
    delete cfg.instances[0].translation;
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    expect(r.documents[0]!.translations).toBeUndefined();
    expect(existsSync(join(out, "fr"))).toBe(false);
    expect(readFileSync(join(out, "en", "handbook", "index.html"), "utf-8")).not.toContain("fa-lang-switch");
  }, 60_000);

  test("themedTranslatedPageCarriesItsLang", async () => {
    const d = twoLocaleFolio();
    const out = join(d, "_site");
    await buildDocumentSite(d, out, { documentLayout: "default" });
    const fr = readFileSync(join(out, "fr", "handbook", "index.html"), "utf-8");
    expect(fr).toMatch(/^---\nlayout: default\ntitle: .*\nlang: "fr"\n/);
  }, 60_000);

  test("switcherInBrowser", async () => {
    // e2e: the French page as a browser lays it out, and the switcher's links land.
    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return; // no browser here; the markup tests above still hold
    }
    const browser = await chromium.launch().catch(() => undefined);
    if (browser === undefined) return;
    const d = twoLocaleFolio();
    const out = join(d, "_site");
    await buildDocumentSite(d, out, { actions: false });
    try {
      const p = await browser.newPage();
      await p.goto(`file://${join(out, "fr", "handbook", "index.html")}`);
      expect(await p.evaluate(() => document.documentElement.lang)).toBe("fr");
      const nav = p.getByRole("navigation", { name: "Language" });
      expect(await nav.getByRole("link").allInnerTexts()).toEqual(["English", "français", "العربية"]);
      expect(await nav.getByRole("link", { name: "français" }).getAttribute("aria-current")).toBe("page");
      // The untranslated block is visibly marked and is announced in English.
      const mark = p.locator(".fa-untranslated");
      expect(await mark.getAttribute("lang")).toBe("en");
      expect(await mark.locator(".fa-untranslated-mark").isVisible()).toBe(true);
      expect(await p.getByText("Ceci est le premier bloc du manuel.").isVisible()).toBe(true);
      // Arabic: right to left, reached from the switcher.
      await nav.getByRole("link", { name: "العربية" }).click();
      expect(p.url()).toEndWith("/ar/handbook/index.html");
      expect(await p.evaluate(() => getComputedStyle(document.body).direction)).toBe("rtl");
      // And back to the source.
      await p.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "English" }).click();
      expect(p.url()).toEndWith("/en/handbook/index.html");
      expect(await p.evaluate(() => document.documentElement.lang)).toBe("en");
    } finally {
      await browser.close();
    }
  }, 60_000);
});

/** Every relative URL a built page holds, with the site path it resolves to. */
function relativeUrls(out: string, page: string): { url: string; target: string }[] {
  const html = readFileSync(join(out, page), "utf-8");
  const urls = [...html.matchAll(/\s(?:href|src|data|poster|xlink:href)="([^"]*)"/g)].map((m) => m[1]!);
  return urls
    .filter((u) => u !== "" && !/^(?:#|\/|\?|[a-z][a-z0-9+.-]*:)/i.test(u))
    .map((url) => ({ url, target: posix.join(posix.dirname(page), url.replace(/[?#].*$/, "")) }));
}

describe("a translated page's links (glossary links from es/ landed in es/folio-assistant-core/)", () => {
  test("rebasedFromTheSourcePageToEachLocale", () => {
    const html = `<p><a href="../folio-assistant-core/glossary/instance/dpi-h-ra/#t">t</a> <img src="media/f.png"> <object data="../x/v.svg"></object> <a href="#here">h</a> <a href="https://who.int/">w</a> <a href="/abs">a</a></p>`;
    for (const loc of ["ar", "es", "fr", "ru", "zh"]) {
      const out = rebaseHtmlUrls(html, "en/dpi-h-ra", `${loc}/dpi-h-ra`);
      expect(out).toContain(`href="../../en/folio-assistant-core/glossary/instance/dpi-h-ra/#t"`);
      expect(out).toContain(`src="../../en/dpi-h-ra/media/f.png"`);
      expect(out).toContain(`data="../../en/x/v.svg"`);
      expect(out).toContain(`href="#here"`);
      expect(out).toContain(`href="https://who.int/"`);
      expect(out).toContain(`href="/abs"`);
    }
    expect(rebaseHtmlUrls(html, "en/dpi-h-ra", "en/dpi-h-ra")).toBe(html);
  });

  test("everyRelativeLinkOfATranslatedPageLands", async () => {
    const d = twoLocaleFolio();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { actions: false });
    expect(r.errors).toEqual([]);
    const en = relativeUrls(out, "en/handbook/index.html");
    expect(en.map((u) => u.url)).toContain("media/figure.png");
    for (const loc of ["fr", "ar"]) {
      const urls = relativeUrls(out, `${loc}/handbook/index.html`);
      // The figure is reached where the source page's copy is, not a copy beside each translation.
      expect(urls.map((u) => u.url)).toContain("../../en/handbook/media/figure.png");
      const broken = urls.filter((u) => !existsSync(join(out, ...u.target.split("/"))) && !existsSync(join(out, dirname(u.target))));
      expect(broken).toEqual([]);
      // Nothing points into the locale's own tree but its own and the other versions' pages.
      for (const u of urls) if (u.target.startsWith(`${loc}/`)) expect(u.target).toBe(`${loc}/handbook/index.html`);
    }
  }, 60_000);
});
