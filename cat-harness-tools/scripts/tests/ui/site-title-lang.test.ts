/**
 * The sidebar title is marked with ITS OWN language (bean `giiw`; owner,
 * 2026-10-06: *"flow LTR unless title is translated to a RTL (hebrew,arabic)
 * then do it RTL"*). The layout half is `site-title-rtl.e2e.ts`; this pins the
 * markup half, which the e2e fixture can only assume.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const TITLE = readFileSync(join(ROOT, siteDirFor(ROOT), "_includes", "title.html"), "utf8");

describe("title.html marks the site title with its own language", () => {
  test("the title span carries lang and dir, never the page's", () => {
    expect(TITLE).toMatch(/<span class="fa-site-title" lang="\{\{ title_lang \}\}" dir="\{\{ title_dir \}\}">/);
  });
  test("the language is the translation index's source locale, defaulting to English", () => {
    expect(TITLE).toContain('assign title_lang = site.data.translations.sourceLocale | default: "en"');
  });
  test("a right-to-left title language turns the direction; anything else reads left to right", () => {
    expect(TITLE).toContain('assign title_dir = "ltr"');
    for (const rtl of ["ar", "he", "fa", "ur"]) expect(TITLE).toContain(`title_lang == "${rtl}"`);
  });
});
