/**
 * Tests for putting a built page's own locale on its `<html>` element.
 *
 * Bean `zru7`. The falsifier these are built around: **the pass must change the
 * two attributes it is for and nothing else.** It rewrites every page of a built
 * site before deploy, so "the Arabic page says `ar` now" is worth little beside a
 * silent change to the other attributes on the tag, or to the 600-odd pages that
 * are not translations.
 *
 * There is no `_site` in a checkout, so the script is `ci-only` in `gates.ts` and
 * this file is what covers its logic here — the same split `strip-preview-seo.ts`
 * and `publish-verify.ts` use.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { declaredLang, setLang, run, RTL_LOCALES } from "../../set-html-lang.ts";

/** A built page as the pipeline emits it: a meta block plus a theme `<html>` tag. */
function page(lang: string | null, htmlTag = '<html lang="en-US">'): string {
  const meta =
    lang === null
      ? ""
      : `<script id="fa-translation-meta" type="application/json">${JSON.stringify({
          lang,
          supportedLocales: ["ar", "en", "es", "fr", "ru", "zh"],
        })}</script>`;
  return `<!doctype html>\n${htmlTag}\n<head><title>t</title>${meta}</head>\n<body><p>x</p></body>\n</html>\n`;
}

describe("declaredLang — the page's own statement, not its path", () => {
  it("reads the locale out of the meta block", () => {
    expect(declaredLang(page("zh"))).toBe("zh");
    expect(declaredLang(page("ar"))).toBe("ar");
  });

  it("returns null when there is no meta block at all", () => {
    // Most of this site is not a translation. Inventing a locale for those pages
    // would be worse than leaving them.
    expect(declaredLang(page(null))).toBeNull();
  });

  it("distinguishes UNREADABLE from absent", () => {
    // Two different facts, and collapsing them is the `dh4f` shape: a page whose
    // declaration cannot be read is not a page that declared nothing.
    const broken = '<html lang="en-US"><script id="fa-translation-meta">{not json</script>';
    expect(declaredLang(broken)).toBe("unreadable");
    expect(declaredLang(page(null))).toBeNull();
  });

  it("treats an empty or non-string lang as no declaration", () => {
    const empty = `<html lang="en-US"><script id="fa-translation-meta">{"lang":""}</script>`;
    const numeric = `<html lang="en-US"><script id="fa-translation-meta">{"lang":7}</script>`;
    expect(declaredLang(empty)).toBeNull();
    expect(declaredLang(numeric)).toBeNull();
  });
});

describe("setLang", () => {
  it("replaces the theme's site-wide lang with the page's own", () => {
    const { html, changed } = setLang(page("zh"), "zh");
    expect(changed).toBe(true);
    expect(html).toContain('<html lang="zh">');
    expect(html).not.toContain("en-US");
  });

  it("adds dir=rtl for a right-to-left locale, and only for those", () => {
    expect(setLang(page("ar"), "ar").html).toContain('dir="rtl"');
    // An LTR page gets NO `dir` rather than `dir="ltr"`: `ltr` is the default, so
    // writing it would add an attribute to 600-odd pages to say what their
    // absence already says.
    expect(setLang(page("es"), "es").html).not.toContain("dir=");
  });

  it("covers every locale RTL_LOCALES names", () => {
    // Named as a list so a fifth entry cannot be added without a test reaching it.
    for (const loc of RTL_LOCALES) {
      expect(setLang(page(loc), loc).html).toContain('dir="rtl"');
    }
  });

  it("PRESERVES every other attribute, and their order", () => {
    // The falsifier. The theme may put its own attributes on the tag, and a
    // rewrite that reprinted it would drop them with nothing said.
    const tag = '<html lang="en-US" class="js" data-theme="dark" prefix="og: x">';
    const { html } = setLang(page("fr", tag), "fr");
    expect(html).toContain('<html lang="fr" class="js" data-theme="dark" prefix="og: x">');
  });

  it("LEAVES a tag whose language already agrees, keeping its region", () => {
    // THE DEFECT THIS PINS, and it was found by running the pass over the real
    // built site rather than by reasoning. A naive "does the value equal the
    // locale" test wanted to rewrite **1317 of 1408** pages, because the theme
    // emits `en-US` while every page — source pages included — declares `lang:
    // en`. Those are the same language and `en-US` is the MORE specific of them,
    // so replacing it with `en` would discard a region for no reader's benefit on
    // 1247 pages that have nothing to do with this bean. With the primary-subtag
    // rule the count is exactly **70**, which is the measured number of
    // non-English translated pages.
    const { html, changed } = setLang(page("en", '<html lang="en-US">'), "en");
    expect(changed).toBe(false);
    expect(html).toContain('<html lang="en-US">');
  });

  it("still corrects a tag whose language DIFFERS, region or not", () => {
    expect(setLang(page("zh", '<html lang="en-US">'), "zh").html).toContain('<html lang="zh">');
    expect(setLang(page("fr", '<html lang="en">'), "fr").html).toContain('<html lang="fr">');
  });

  it("compares subtags case-insensitively", () => {
    // `EN-us` and `en` are the same language; a case difference is not a defect.
    expect(setLang(page("en", '<html lang="EN-us">'), "en").changed).toBe(false);
  });

  it("adds dir to an RTL page whose language ALREADY agrees", () => {
    // The half-corrected state the runtime patch leaves on first paint: the tag
    // says `ar` but carries no direction. `dir` is decided independently of the
    // language check for exactly this case.
    const { html, changed } = setLang(page("ar", '<html lang="ar">'), "ar");
    expect(changed).toBe(true);
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it("adds lang when the tag carries none", () => {
    const { html, changed } = setLang(page("ru", "<html>"), "ru");
    expect(changed).toBe(true);
    expect(html).toContain('<html lang="ru">');
  });

  it("replaces an existing dir rather than appending a second one", () => {
    const { html } = setLang(page("ar", '<html lang="en-US" dir="ltr">'), "ar");
    expect(html).toContain('dir="rtl"');
    expect(html.match(/dir=/g)).toHaveLength(1);
  });

  it("is idempotent — a second pass changes nothing", () => {
    const once = setLang(page("ar"), "ar");
    const twice = setLang(once.html, "ar");
    expect(twice.changed).toBe(false);
    expect(twice.html).toBe(once.html);
  });

  it("reports no change rather than throwing when there is no html tag", () => {
    const { html, changed } = setLang("<p>a fragment</p>", "fr");
    expect(changed).toBe(false);
    expect(html).toBe("<p>a fragment</p>");
  });

  it("touches ONLY the html tag — the rest of the document is byte-identical", () => {
    // A closing `</html>`, the body, and the meta block itself all survive. A
    // regex loose enough to hit `</html>` would corrupt every page.
    const src = page("zh");
    const { html } = setLang(src, "zh");
    const strip = (s: string): string => s.replace(/<html\b[^>]*>/i, "<HTML-TAG>");
    expect(strip(html)).toBe(strip(src));
    expect(html).toContain("</html>");
    expect(html).toContain('id="fa-translation-meta"');
  });
});

/** A throwaway built site. */
function site(pages: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "set-html-lang-"));
  for (const [rel, text] of Object.entries(pages)) {
    const abs = join(dir, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, text);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("run over a built tree", () => {
  it("corrects the translations, counts the rest, and writes only what changed", () => {
    const { dir, cleanup } = site({
      "index.html": page(null),
      "es/index.html": page("es"),
      "ar/index.html": page("ar"),
      "guides/zh/agent-onboarding.html": page("zh"),
      "assets/notes.txt": "not a page",
    });
    const r = run({ site: dir });
    expect(r.pages).toBe(4);
    expect(r.declared).toBe(3);
    expect(r.changed).toBe(3);
    expect(r.noMeta).toBe(1);
    expect(r.unreadable).toEqual([]);
    expect(r.noHtmlTag).toEqual([]);

    // Nested pages are reached — the `9rnf` defect, one directory level down.
    expect(readFileSync(join(dir, "guides/zh/agent-onboarding.html"), "utf-8")).toContain('<html lang="zh">');
    expect(readFileSync(join(dir, "ar/index.html"), "utf-8")).toContain('dir="rtl"');
    // The page that declared nothing is untouched, byte for byte.
    expect(readFileSync(join(dir, "index.html"), "utf-8")).toBe(page(null));
    cleanup();
  });

  it("`--check` reports what would change and writes NOTHING", () => {
    const { dir, cleanup } = site({ "fr/index.html": page("fr") });
    const before = readFileSync(join(dir, "fr/index.html"), "utf-8");
    const r = run({ site: dir, check: true });
    expect(r.changed).toBe(1);
    expect(readFileSync(join(dir, "fr/index.html"), "utf-8")).toBe(before);
    cleanup();
  });

  it("is idempotent over a tree — the second run corrects nothing", () => {
    const { dir, cleanup } = site({ "ar/index.html": page("ar"), "zh/index.html": page("zh") });
    expect(run({ site: dir }).changed).toBe(2);
    expect(run({ site: dir }).changed).toBe(0);
    cleanup();
  });

  it("reports an unreadable meta block rather than skipping it quietly", () => {
    const { dir, cleanup } = site({
      "x/index.html": '<html lang="en-US"><script id="fa-translation-meta">{oops</script></html>',
    });
    const r = run({ site: dir });
    expect(r.unreadable).toHaveLength(1);
    expect(r.noMeta).toBe(0);
    cleanup();
  });

  it("reports a declared page with no html tag rather than counting it corrected", () => {
    const { dir, cleanup } = site({
      "x/frag.html": '<script id="fa-translation-meta">{"lang":"fr"}</script><p>x</p>',
    });
    const r = run({ site: dir });
    expect(r.noHtmlTag).toHaveLength(1);
    expect(r.changed).toBe(0);
    cleanup();
  });
});
