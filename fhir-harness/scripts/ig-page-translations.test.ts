import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { catalogueAliases, dirFor, fragmentFor, localizeIncludes, hasTranslation, localeFrontMatter, localesFor, pageLocales, pageReview, relinkForLocale, resolveLangFragments, signedOff, translatePage, translateWithIncludes, UN_LOCALES, UNREVIEWED_BLOCK_CLASS, UNREVIEWED_NOTICE, UNREVIEWED_NOTICE_CSS, unreviewedLabel, unreviewedNoticeLiquid } from "./ig-page-translations.ts";

const po = (pairs: [string, string][]) => pairs.map(([i, s]) => `msgid "${i}"\nmsgstr "${s}"`).join("\n\n") + "\n";

function fixture(): string {
  const d = mkdtempSync(join(tmpdir(), "ig-tr-"));
  for (const [loc, body] of [["fr", po([["Hello world.", "Bonjour le monde."]])], ["ar", po([["Hello world.", ""]])]] as const) {
    mkdirSync(join(d, loc, "pagecontent"), { recursive: true });
    writeFileSync(join(d, loc, "pagecontent", "index.po"), body);
  }
  mkdirSync(join(d, "en", "pagecontent"), { recursive: true });
  writeFileSync(join(d, "en", "pagecontent", "index.po"), po([["Hello world.", "Hello world."]]));
  return d;
}

describe("ig-page-translations (fhir-harness#382)", () => {
  test("a locale with an empty catalogue, and the source locale, are not offered", () => {
    const locs = pageLocales(fixture());
    expect(locs.map((l) => l.locale)).toEqual(["fr"]);
    expect(locs[0]!.status).toBe("unverified");
    expect(localesFor("index", locs)).toEqual(["en", "fr"]);
    expect(localesFor("other", locs)).toEqual(["en"]);
  });

  test("a page that names another catalogue is translated from it, and reviewed against its record", () => {
    const d = fixture();
    writeFileSync(join(d, "fr", "journeys.po"), po([["Born abroad.", "Né à l'étranger."]]));
    const pages: Record<string, string> = { journeys: "<!-- translations: journeys -->\n\nBorn abroad.\n", escape: "<!-- translations: ../secret -->\n", index: "Hello world.\n" };
    const aliases = catalogueAliases(Object.keys(pages), (s) => pages[s]);
    expect([...aliases]).toEqual([["journeys", "journeys"]]);
    const [fr] = pageLocales(d, aliases);
    expect(translatePage(pages.journeys!, fr!.catalogues.get("journeys")!).md).toContain("Né à l'étranger.");
    expect(fr!.catalogueRel?.get("journeys")).toBe("journeys");
    expect(fr!.catalogues.get("index")).toBeDefined();
    expect(pageReview(fr!, "journeys", pages.journeys).reviewed).toBe(false);
  });

  test("no translations directory: no locales", () => {
    expect(pageLocales(undefined)).toEqual([]);
    expect(pageLocales(join(tmpdir(), "does-not-exist-382"))).toEqual([]);
  });

  test("injects the catalogue into the page", () => {
    const [fr] = pageLocales(fixture());
    const t = translatePage("# Title\n\nHello world.\n", fr!.catalogues.get("index")!);
    expect(t.md).toContain("Bonjour le monde.");
    expect(t.translated).toBe(1);
  });

  test("a locale is verified only with a named sign-off", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-tr-s-"));
    writeFileSync(join(d, "status.json"), JSON.stringify({ official: true }));
    expect(signedOff(d)).toBe(false);
    writeFileSync(join(d, "status.json"), JSON.stringify({ official: true, signedOffBy: "Reviewer", signedOffAt: "2026-11-11" }));
    expect(signedOff(d)).toBe(true);
  });

  test("relative links climb out of the locale folder unless the target is translated", () => {
    const here = new Set(["concepts.html"]);
    const md = '[a](concepts.html) [b](faq.html#x) ![i](diagram.svg) [c](https://x.org) [d](#top) [e]({{site.baseurl}}/y) <a href="artifacts.html">f</a> <img src="/abs.png">';
    expect(relinkForLocale(md, here)).toBe(
      '[a](concepts.html) [b](../faq.html#x) ![i](../diagram.svg) [c](https://x.org) [d](#top) [e]({{site.baseurl}}/y) <a href="../artifacts.html">f</a> <img src="/abs.png">',
    );
  });

  test("Arabic is right to left", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("fr")).toBe("ltr");
  });

  test("a page made only of includes is translated through them (home page)", () => {
    const [fr] = pageLocales(fixture());
    const src: Record<string, string> = { home: "{% include index.md %}\n\n{% include other.md %}\n", index: "Hello world.\n", other: "Not translated.\n" };
    const pages = new Set(Object.keys(src));
    const sourceOf = (s: string) => src[s];
    expect(hasTranslation("home", fr!, sourceOf, pages)).toBe(true);
    expect(hasTranslation("other", fr!, sourceOf, pages)).toBe(false);
    const t = translateWithIncludes("home", fr!, sourceOf, pages);
    expect(t.md).toContain("Bonjour le monde.");
    expect(t.md).toContain("{% include other.md %}");
  });
});

describe("lang-fragment: a translated page reads its locale's own fragment", () => {
  test("names the fragment as the IG Publisher does", () => {
    expect(fragmentFor("journey-cards.html", "ar")).toBe("journey-cards-ar.html");
    expect(fragmentFor("ip-statements.xhtml", "zh")).toBe("ip-statements-zh.xhtml");
    expect(fragmentFor("notes", "fr")).toBe("notes-fr");
  });

  test("the locale's fragment when the IG has it, the source's otherwise; the source page always the source's", () => {
    const has = (n: string) => n === "journey-cards-ar.html";
    const md = "<div>{% lang-fragment journey-cards.html %}</div>\n{%- lang-fragment journey-hero.html -%}";
    expect(resolveLangFragments(md, "ar", has)).toBe("<div>{% include journey-cards-ar.html %}</div>\n{% include journey-hero.html %}");
    expect(resolveLangFragments(md, "fr", has)).toBe("<div>{% include journey-cards.html %}</div>\n{% include journey-hero.html %}");
    expect(resolveLangFragments(md, undefined, () => true)).toBe("<div>{% include journey-cards.html %}</div>\n{% include journey-hero.html %}");
  });

  test("a translated page keeps its lang-fragment for the build to resolve", () => {
    const md = "{% lang-fragment journey-hero.html %}\n\nThis guide supports pilgrims.\n";
    const t = translatePage(md, new Map([["This guide supports pilgrims.", "Ce guide aide les pèlerins."]]));
    expect(t.md).toContain("{% lang-fragment journey-hero.html %}");
    expect(t.md).toContain("Ce guide aide les pèlerins.");
  });
});

describe("a translated page's HTML and SVG includes are in its language", () => {
  const files: Record<string, string> = {
    "fig.html": `<div><label>As drawn</label></div><div><a href="model.html"><img src="v.svg" alt="The view"/></a></div>\n<div>{% include fig.svg %}</div>`,
    "fig.svg": `<svg><a href="https://x/a.html"><title>Trust Anchor: the root.</title><text font-size="18" text-anchor="middle"><tspan x="50" y="20">Trust Anchor</tspan></text></a></svg>`,
    "own-fr.html": "<p>Mine</p>",
    "own.html": "<p>Mine</p>",
  };
  const store = (written: Map<string, string>) => ({
    read: (n: string) => files[n],
    has: (n: string) => n in files,
    write: (n: string, t: string) => void written.set(n, t),
  });
  const fr = { locale: "fr", includes: new Map([["fig.html", new Map([["As drawn", "Tel que dessiné"], ["The view", "La vue"]])], ["fig.svg", new Map([["Trust Anchor", "Ancre"], ["Trust Anchor: the root.", "Ancre : la racine."]])]]) };

  test("each include becomes a locale copy, translated and relinked, its own includes too", () => {
    const written = new Map<string, string>();
    const r = localizeIncludes("Intro\n\n{% include fig.html %}\n", fr, store(written), new Set());
    expect(r.md).toBe("Intro\n\n{% include fig-fr.html %}\n");
    const html = written.get("fig-fr.html")!;
    expect(html).toContain("Tel que dessiné");
    expect(html).toContain('alt="La vue"');
    expect(html).toContain('href="../model.html"');
    expect(html).toContain("{% include fig-fr.svg %}");
    const svg = written.get("fig-fr.svg")!;
    expect(svg).toContain(">Ancre</tspan>");
    expect(svg).toContain("<title>Ancre : la racine.</title>");
    expect(svg).toContain('href="https://x/a.html"');
    expect(r.translated).toBe(4);
  });

  test("the IG's own locale file wins, and an include the IG does not hold is left alone", () => {
    const written = new Map<string, string>();
    const r = localizeIncludes("{% include own.html %} {% include made.svg %} {% include page.md %}", fr, store(written), new Set());
    expect(r.md).toBe("{% include own-fr.html %} {% include made.svg %} {% include page.md %}");
    expect(written.size).toBe(0);
  });

  test("an include with no catalogue is still relinked for the locale folder", () => {
    const written = new Map<string, string>();
    localizeIncludes("{% include fig.html %}", { locale: "ar", includes: new Map() }, store(written), new Set());
    expect(written.get("fig-ar.html")).toContain('href="../model.html"');
    expect(written.get("fig-ar.html")).toContain("As drawn");
  });
});

describe("unreviewed translations are announced (fail closed)", () => {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const SRC = "# Title\n\nHello world.\n";
  function locale(sidecar?: Record<string, unknown>, status?: Record<string, unknown>): string {
    const d = mkdtempSync(join(tmpdir(), "ig-tr-rev-"));
    mkdirSync(join(d, "fr", "pagecontent"), { recursive: true });
    writeFileSync(join(d, "fr", "pagecontent", "index.po"), po([["Hello world.", "Bonjour le monde."]]));
    if (sidecar) writeFileSync(join(d, "fr", "pagecontent", "index.json"), JSON.stringify(sidecar));
    if (status) writeFileSync(join(d, "fr", "status.json"), JSON.stringify(status));
    return d;
  }
  const signed = (hash: string) => ({ sourceHash: hash, status: { official: true, signedOffBy: "A. Reviewer", signedOffAt: "2026-11-13T00:00:00Z" } });

  test("no review record means not reviewed", () => {
    const [fr] = pageLocales(locale());
    expect(pageReview(fr!, "index", SRC)).toMatchObject({ reviewed: false, why: "no record that a person reviewed it" });
  });

  test("an agent translation marked unofficial is not reviewed", () => {
    const [fr] = pageLocales(locale({ sourceHash: sha(SRC).slice(0, 12), status: { official: false, generatedBy: "agent" } }));
    expect(pageReview(fr!, "index", SRC).reviewed).toBe(false);
  });

  test("a page sign-off against the current source is reviewed", () => {
    const [fr] = pageLocales(locale(signed(sha(SRC).slice(0, 12))));
    expect(pageReview(fr!, "index", SRC)).toMatchObject({ reviewed: true, by: "A. Reviewer" });
  });

  test("a sign-off against an earlier source is not reviewed", () => {
    const [fr] = pageLocales(locale(signed(sha("older").slice(0, 12))));
    expect(pageReview(fr!, "index", SRC)).toMatchObject({ reviewed: false, why: "signed off against an earlier source" });
  });

  test("a locale sign-off counts only for the source file it names", () => {
    const rec = { official: true, signedOffBy: "B", signedOffAt: "t", sourceFile: "input/pagecontent/index.md", sourceHash: sha(SRC) };
    expect(pageReview(pageLocales(locale(undefined, rec))[0]!, "index", SRC).reviewed).toBe(true);
    expect(pageReview(pageLocales(locale(undefined, { ...rec, sourceFile: "input/pagecontent/other.md" }))[0]!, "index", SRC).reviewed).toBe(false);
    expect(pageReview(pageLocales(locale(undefined, { ...rec, flaggedForReview: true }))[0]!, "index", SRC).reviewed).toBe(false);
  });

  test("unreviewed words are fenced as a marked block, reviewed ones are not", () => {
    const [fr] = pageLocales(locale());
    const pages = new Set(["index"]);
    const mark = { unreviewed: () => true, label: unreviewedLabel("fr") };
    const t = translateWithIncludes("index", fr!, () => SRC, pages, 0, mark);
    expect(t.contributors).toEqual(["index"]);
    expect(t.md).toContain(`<div class="${UNREVIEWED_BLOCK_CLASS}" data-tr-catalogue="index" data-tr-label="Non relu par une personne" markdown="1">`);
    expect(translateWithIncludes("index", fr!, () => SRC, pages, 0, { ...mark, unreviewed: () => false }).md).not.toContain(UNREVIEWED_BLOCK_CLASS);
  });

  test("the front matter says reviewed only when told so", () => {
    expect(localeFrontMatter({ lang: "fr", available: ["en", "fr"], source: "index.html" }).translation_reviewed).toBe(false);
    expect(localeFrontMatter({ lang: "fr", available: ["en", "fr"], source: "index.html", reviewed: true }).translation_reviewed).toBe(true);
    expect(localeFrontMatter({ lang: "en", available: ["en", "fr"] })).not.toHaveProperty("translation_reviewed");
  });

  test("the notice renders in the page language and English, linking to the source, and only when unreviewed", async () => {
    const { Liquid } = await import("liquidjs");
    const liquid = new Liquid();
    const tpl = unreviewedNoticeLiquid();
    const fr = await liquid.parseAndRender(tpl, { page: { lang: "fr", translation_source: "index.html" } });
    expect(fr).toContain("Traduction automatique");
    expect(fr).toContain("Machine translation");
    // English is one short line under the French notice, not the whole notice again.
    expect(fr).toContain('class="ig-tr-notice__en" lang="en"');
    expect(fr).not.toContain("This page was translated automatically");
    expect(fr).toContain('href="../index.html"');
    expect(fr).toContain("fa-translation-warning");
    const other = await liquid.parseAndRender(tpl, { page: { lang: "de", translation_source: "index.html" } });
    expect(other).toContain("This page was translated automatically");
    expect(other).not.toContain("Traduction automatique");
    expect(await liquid.parseAndRender(tpl, { page: { lang: "fr", translation_source: "index.html", translation_reviewed: true } })).not.toContain("ig-tr-notice");
    expect(await liquid.parseAndRender(tpl, { page: { lang: "en" } })).not.toContain("ig-tr-notice");
    for (const l of Object.keys(UNREVIEWED_NOTICE)) expect(UN_LOCALES as readonly string[]).toContain(l);
  });

  test("the thin layout's stylesheet carries the notice's rules verbatim, so that layout inlines none", async () => {
    // Owner, 2026-11-13: the IG's ONE stylesheet. The thin layout links
    // `ig-artifact.css` and inlines no <style>; this keeps the two copies equal.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css"), "utf-8");
    expect(css).toContain(UNREVIEWED_NOTICE_CSS);
    expect(unreviewedNoticeLiquid({ inlineStyle: false })).not.toContain("<style");
    expect(unreviewedNoticeLiquid()).toContain(`<style>${UNREVIEWED_NOTICE_CSS}</style>`);
  });
});
