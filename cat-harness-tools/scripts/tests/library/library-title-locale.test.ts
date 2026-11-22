// The listing's title cell (owner, 2026-11-13): "when display title not in
// locale, then display locale if present under original ... also some titles
// are really long. need cap + hover for complete". The shipped script, run
// against stubs on a page under /en/, as library-entry-iri.test.ts runs it.
import { describe, expect, test } from "bun:test";
import { VIEWER_CSS, VIEWER_JS } from "../../gen-library-viz.ts";

const pageUrl = "https://example.test/site/en/harness/library/layer-a/";
// input-site: inert #6842edec — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
const run = new Function("document", "location", "fetch", "window", "history", `${VIEWER_JS}\nreturn { COLS: COLS };`) as (
  ...a: unknown[]
) => { COLS: { k: string; f: (e: unknown) => string }[] };
const { COLS } = run(
  {
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: (sel: string) =>
      sel === ".lib-page" ? { dataset: { kgData: "../../../../assets/library/index.json", kgScope: "layer-a", kgLibRoot: "../" } } : null,
  },
  { href: pageUrl, pathname: new URL(pageUrl).pathname, hash: "" },
  () => new Promise(() => {}),
  { addEventListener: () => {} },
  { replaceState: () => {} },
);
const title = COLS.find((c) => c.k === "title")!;

describe("a title not in the page's language", () => {
  test("shows the reader's language under it when an edition has one", () => {
    const html = title.f({ instance: "layer-a", id: "doc-fr", title: "La stratégie", lang: "fr", titles: { en: "The strategy" } });
    expect(html).toContain('lang="fr">La stratégie</a><span class="lib-title-locale" lang="en" title="The strategy">The strategy</span>');
  });
  test("shows nothing extra when there is none, or when the title is already in it", () => {
    expect(title.f({ instance: "layer-a", id: "doc-zh", title: "战略", lang: "zh" })).not.toContain("lib-title-locale");
    expect(title.f({ instance: "layer-a", id: "doc-en", title: "The strategy", lang: "en", titles: { fr: "La stratégie" } })).not.toContain(
      "lib-title-locale",
    );
  });
});

describe("a long title", () => {
  test("is capped at three lines, with the whole of it on hover and in the DOM", () => {
    const long = "Отчет ".repeat(200).trim();
    const html = title.f({ instance: "layer-a", id: "doc-ru", title: long, lang: "ru" });
    expect(html).toContain(`title="${long}"`);
    expect(html).toContain(`>${long}</a>`);
    expect(VIEWER_CSS).toMatch(/td\.t-title a\.lib-title, [^{]*\{[^}]*-webkit-line-clamp:3; line-clamp:3; overflow:hidden;/);
  });
});
