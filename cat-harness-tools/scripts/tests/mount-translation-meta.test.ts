/**
 * Mounted pages carry the docs pages' own locale chrome — issue #2219.
 *
 * A mount is finished HTML that Jekyll never lays out, so the
 * `fa-translation-meta` block `_includes/head_custom.html` writes was missing
 * and `docs-ui.js` drew no band globe on `/who-iris/`. The block written here
 * must be the INCLUDE'S block (owner: "USE THE SAME CHROME AS
 * FOLIO-ASSISTANT"), so these tests pin its shape to the include's fields and
 * its defaults to what the include writes for an untranslated page.
 *
 * @module scripts/tests/mount-translation-meta.test
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join, resolve } from "path";

import { TRANSLATION_META_ID, translationMetaBlock, withTranslationMeta } from "../lib/translation-meta.ts";
import { UN_LOCALES } from "../../schemas/content/translation.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const parse = (block: string) =>
  JSON.parse(/<script type="application\/json" id="fa-translation-meta">([\s\S]*)<\/script>/.exec(block)![1]!);

describe("translationMetaBlock", () => {
  const meta = parse(translationMetaBlock(join(REPO, "who-iris")));

  it("declares every supported locale, and none of them as translated", () => {
    expect(meta.lang).toBe("en");
    expect(meta.supportedLocales).toEqual([...UN_LOCALES]);
    // `[]` is the include's default for a page with no `available_locales`:
    // docs-ui.js then greys every locale but the page's own.
    expect(meta.availableLocales).toEqual([]);
  });

  it("carries only fields the include writes", () => {
    const include = readFileSync(join(REPO, "cat-harness/site-chrome/_includes/head_custom.html"), "utf-8");
    const start = include.indexOf(`id="${TRANSLATION_META_ID}"`);
    expect(start).toBeGreaterThan(0);
    const body = include.slice(start, include.indexOf("</script>", start));
    for (const k of Object.keys(meta)) expect(body).toContain(`"${k}"`);
  });
});

describe("withTranslationMeta", () => {
  const block = '<script type="application/json" id="fa-translation-meta">{}</script>';

  it("puts the block in the head, once", () => {
    const once = withTranslationMeta("<html><head><title>x</title></head><body></body></html>", block);
    expect(once).toBe(`<html><head><title>x</title>${block}</head><body></body></html>`);
    expect(withTranslationMeta(once, block)).toBe(once);
  });

  it("leaves a page that already has its own block, or no head, alone", () => {
    const own = '<head><script type="application/json" id="fa-translation-meta">{"lang":"fr"}</script></head>';
    expect(withTranslationMeta(own, block)).toBe(own);
    expect(withTranslationMeta("<p>fragment</p>", block)).toBe("<p>fragment</p>");
  });
});
