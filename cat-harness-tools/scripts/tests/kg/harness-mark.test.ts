/**
 * `navMarkFields` — the ONE conversion from a `harness.json` row's mark to
 * navbar fields (bean `2vpn`). Three readers used to do it by hand, and the
 * mounted pages drifted to reading `icon`, so who-iris drew "W" everywhere.
 */
import { describe, expect, test } from "bun:test";

import { navMarkFields } from "../../lib/harness-mark.ts";
describe("navMarkFields", () => {
  test("an image mark becomes an avatar, re-based, with its declared crop", () => {
    const f = navMarkFields(
      { src: "/docs/who-iris/assets/img/who-emblem.svg", title: "WHO emblem", region: { x: 0, y: 0, w: 0.3, h: 1 } },
      198,
      (s) => `../..${s}`,
    );
    expect(f).toEqual({
      avatar: { src: "../../docs/who-iris/assets/img/who-emblem.svg", title: "WHO emblem", region: { x: 0, y: 0, w: 0.3, h: 1 } },
      tone: 198,
    });
  });

  test("a glyph mark becomes glyphPath — never a letter", () => {
    expect(navMarkFields({ glyph: "M3 18h18", title: "a base" }, 199)).toEqual({ glyphPath: "M3 18h18", tone: 199 });
  });

  test("a declared ground rides along, so the navbar can leave the tone out (issue #46, gap 5)", () => {
    expect(navMarkFields({ src: "/assets/img/logo.svg", title: "logo", ground: "none" }, 208, (s) => `.${s}`)).toEqual({
      avatar: { src: "./assets/img/logo.svg", title: "logo", ground: "none" },
      tone: 208,
    });
  });

  test("no mark leaves only the tone, and the navbar draws the initial", () => {
    expect(navMarkFields(undefined, 212)).toEqual({ tone: 212 });
    expect(navMarkFields(null, undefined)).toEqual({});
  });
});
