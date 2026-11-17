/**
 * Duplicate ids are counted in TAGS only, and the nav checkbox is rendered once — bean `uknu`.
 *
 * @module cat-harness/scripts/tests/duplicate-ids.test
 */
import { describe, expect, test } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { readFileSync } from "../../test/support/site-fs.ts";
import { join } from "node:path";

import { duplicateIds, idOf } from "../check-duplicate-ids.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";

const INCLUDE = join(HARNESS_ROOT, "docs", "_includes", "generated", "navbar-footer.html");
const INCLUDE_NOT_BUILT = siteNotBuilt("the generated sidebar include `navbar:include` writes at publish (gitignored)", INCLUDE);

describe("duplicateIds", () => {
  test("two elements with one id is a finding", () => {
    expect([...duplicateIds(`<div id="a"></div><input id="a"><p id="b"></p>`)]).toEqual([["a", 2]]);
  });
  test("an id inside a code sample is text, not markup (the two first-run false hits)", () => {
    const html = `<a id="x"></a><code>&lt;a id="x"&gt;</code><code>&lt;a id="&lt;label&gt;"&gt;</code>`;
    expect(duplicateIds(html).size).toBe(0);
  });
  test("a script body is skipped, but the script tag's own id counts once", () => {
    const html = `<script type="application/json" id="meta">{"id": "meta", "x": "<b id=\\"meta\\">"}</script>`;
    expect(duplicateIds(html).size).toBe(0);
  });
  test("single-quoted and unquoted ids are read", () => {
    expect([...duplicateIds(`<i id='q'></i><i id=q></i>`)]).toEqual([["q", 2]]);
  });
});

describe("only an attribute named id counts", () => {
  test("id= inside another attribute's value is text (jekyll-seo-tag's og:title, folio-assistant#2628)", () => {
    const html = `<meta property="og:title" content="carry id=”x”"><meta name="twitter:title" content="carry id=”x”">`;
    expect(duplicateIds(html).size).toBe(0);
    expect(duplicateIds(`<a title='say id="y"'></a><b title='say id="y"'></b>`).size).toBe(0);
  });

  test("a real duplicate after other attributes is still found", () => {
    expect(duplicateIds(`<input id="a"><input class="b" data-id="z" id="a">`)).toEqual(new Map([["a", 2]]));
  });

  test("idOf ignores data-id and similar names, and is case-insensitive", () => {
    expect(idOf(`<div data-id="d" aria-labelledby="l">`)).toBeUndefined();
    expect(idOf(`<div ID="u">`)).toBe("u");
    expect(idOf(`<input disabled id=bare>`)).toBe("bare");
  });
});

describe.skipIf(INCLUDE_NOT_BUILT)("the generated navbar include: one checkbox, labels in every copy", () => {
  // `sjic`: this markup used to be hand-written in `nav_footer_custom.html`,
  // which is now a single `{% include %}`. The `uknu` property it guards —
  // one input per PAGE across the two copies just-the-docs renders — is
  // unchanged and is now the generator's to hold.
  // `describe.skipIf` still runs this body, so the read is guarded too.
  const src = INCLUDE_NOT_BUILT ? "" : readFileSync(INCLUDE, "utf8");
  const code = src.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "");

  test("the checkbox input appears once, and only for the first rendered copy", () => {
    const inputs = code.match(/<input[^>]*class="fa-nav-open"/g) ?? [];
    expect(inputs.length).toBe(1);
    expect(code).toMatch(/\{%-?\s*if fa_nav_copy == 1\s*-?%\}\s*<input[^>]*id="fa-nav-open"/);
  });
  test("no label drives the checkbox here — the theme's avatar is the control (#1757)", () => {
    // PER RENDERED VARIANT, not per file. The generated include carries the
    // canonical and staging renderings behind one Liquid conditional.
    //
    // There were two labels per page, the `☰` and the `[x]`, and the owner
    // asked for both to go: `docs-ui.js` already makes `.site-title` (the
    // avatar) toggle this checkbox, so they were the same control drawn three
    // times. The checkbox stays — the stylesheet reads it — with one writer.
    const variants = code.split("{%- else -%}");
    expect(variants.length).toBe(2);
    for (const v of variants) expect(v.match(/for="fa-nav-open"/g)).toBeNull();
  });
});
