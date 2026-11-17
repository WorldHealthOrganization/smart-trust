/**
 * Every token a theme emits is consumed, and the priority signal survives theming.
 *
 * Two failures this pins, both of which render fine and are wrong:
 *
 *   - an EMITTED, UNCONSUMED token. `--fa-sticky-accent` shipped in exactly
 *     that state on the first pass: written into `themes.css` eight times and
 *     read by nothing, so a theme author could change it and see no effect and
 *     have no way to find out why. CSS ignores it silently, which is what makes
 *     it worth a test rather than a review.
 *   - a theme RECOLOURING the priority stripe. The stripe is a width as well as
 *     a colour because colour alone carrying a signal fails WCAG SC 1.4.1, and
 *     critical/high keep their hues so the same urgency does not read
 *     differently on two boards.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { renderThemesCss } from "../../gen-themes-css.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
// The site root is `siteDirFor`'s answer, not a literal — see
// `site-dir-single-answer.test.ts`, which failed on this line first.
const UI = readFileSync(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css")), "utf8");

/** Role names the generated stylesheet defines. */
function emittedTokens(): string[] {
  return [...new Set([...renderThemesCss().matchAll(/--fa-sticky-([a-z-]+):/g)].map((m) => m[1]!))];
}

describe("no token is emitted and unread", () => {
  test("there are tokens to check — otherwise this proves nothing", () => {
    expect(emittedTokens().length).toBeGreaterThan(4);
  });

  test.each(emittedTokens())("`--fa-sticky-%s` is consumed by the stylesheet", (token) => {
    expect(UI.includes(`var(--fa-sticky-${token}`)).toBe(true);
  });
});

describe("the priority signal is not a theme's to recolour", () => {
  test("critical and high keep their own hue", () => {
    for (const p of ["critical", "high"]) {
      const rule = UI.match(new RegExp(`\\.fa-sticky-p-${p}\\s*\\{[^}]*\\}`))?.[0] ?? "";
      expect({ p, themed: rule.includes("var(--fa-sticky-accent") }).toEqual({ p, themed: false });
    }
  });

  test("the stripe keeps a non-colour channel", () => {
    // `border-left-width` is the second channel. If a change ever removes it,
    // colour becomes the sole carrier and SC 1.4.1 is broken for every theme
    // at once.
    expect(UI).toContain("border-left-width: 5px;");
  });
});
