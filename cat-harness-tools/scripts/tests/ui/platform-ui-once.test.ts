/**
 * docs-ui.js is loaded once per page.
 *
 * Observed 2026-10-20 on litlfred.github.io/smart-trust-tools: the home page
 * drew the language and QA badge bar twice. The theme's layout loads
 * `/<base>/assets/js/docs-ui.js?v=…`, and the rail pass, reaching the theme's
 * pages through `themeSource`, added `./assets/js/docs-ui.js` again: 244 of
 * 400 pages of that build loaded it twice. `withPlatformUi` now adds nothing
 * to a page that already loads it.
 */
import { describe, expect, test } from "bun:test";

import { PLATFORM_UI_ATTR, withPlatformUi } from "../../mount-instance-docs.ts";

const count = (html: string) => html.match(/docs-ui\.js/g)?.length ?? 0;
const page = (head: string) => `<!doctype html><html><head><title>t</title>${head}</head><body><h1>t</h1></body></html>`;

describe("withPlatformUi", () => {
  test("adds docs-ui to a page that has none", () => {
    const out = withPlatformUi(page(""), ".", "https://example.org/platform");
    expect(count(out)).toBe(1);
    expect(out).toContain(PLATFORM_UI_ATTR);
  });

  test("adds nothing to a theme page whose layout already loads docs-ui.js", () => {
    const theme = page(`<script src="/smart-trust-tools/assets/js/docs-ui.js?v=1792523751" defer></script>`);
    const out = withPlatformUi(theme, ".", "https://example.org/platform");
    expect(count(out)).toBe(1);
    expect(out).not.toContain(`./assets/js/docs-ui.js`);
  });

  test("is idempotent on its own output", () => {
    const once = withPlatformUi(page(""), ".");
    expect(withPlatformUi(once, ".")).toBe(once);
  });

  test("a script merely named like docs-ui is not mistaken for it", () => {
    const other = page(`<script src="/x/assets/js/docs-ui-extra.js"></script>`);
    const out = withPlatformUi(other, ".");
    expect(count(out)).toBe(1); // the platform's, added; docs-ui-extra.js is another script
    expect(out).toContain(PLATFORM_UI_ATTR);
  });
});
