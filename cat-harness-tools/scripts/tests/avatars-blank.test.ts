/**
 * Tests for the themed blank avatar fallback.
 *
 * Bean `folio-assistant-4kj4`. Owner ruling, 2026-09-20:
 * *"there is always an avatar, even when there is none (always have default blank/themecolor if no avatar. etc)"*.
 *
 * @module scripts/tests/avatars-blank.test
 */
import { describe, expect, it } from "bun:test";

import {
  allAvatars,
  avatarFor,
  avatarOrBlank,
  BLANK_AVATAR,
  blankAvatar,
  GENERIC,
  hasAvatar,
} from "../../schemas/content/avatars.js";
import { navMarkFields } from "../lib/harness-mark.js";
import { navbarCss, navbarRegionsHtml } from "../lib/navbar.js";
import { railModel } from "../lib/harness-rail.js";
import { graphTypologyRowDecor } from "../lib/graph-typology-nav.js";

describe("BLANK_AVATAR definition", () => {
  it("has a distinct glyph that matches a blank square box", () => {
    expect(BLANK_AVATAR.glyph).toBe("M3 3h18v18H3z");
  });

  it("is distinct from GENERIC (the question mark)", () => {
    expect(BLANK_AVATAR.glyph).not.toBe(GENERIC.glyph);
    expect(BLANK_AVATAR.reads).not.toBe(GENERIC.reads);
    expect(BLANK_AVATAR.reads).toContain("blank mark");
  });

  it("is distinct from every declared avatar in the registry", () => {
    for (const [kind, avatar] of allAvatars()) {
      expect(BLANK_AVATAR.glyph, `Kind ${kind} has identical glyph to BLANK_AVATAR`).not.toBe(avatar.glyph);
    }
  });

  it("blankAvatar(tone) creates an avatar with the given hue tone", () => {
    const a = blankAvatar(210);
    expect(a.glyph).toBe(BLANK_AVATAR.glyph);
    expect(a.tone).toBe(210);
    expect(a.reads).toBe(BLANK_AVATAR.reads);
  });

  it("avatarOrBlank returns the declared avatar for known kinds and blankAvatar for unknown", () => {
    expect(hasAvatar("docs")).toBe(true);
    expect(avatarOrBlank("docs", 120)).toEqual(avatarFor("docs"));

    const unknown = "unknown-arbitrary-kind-without-art";
    expect(hasAvatar(unknown)).toBe(false);
    const fallback = avatarOrBlank(unknown, 145);
    expect(fallback.glyph).toBe(BLANK_AVATAR.glyph);
    expect(fallback.tone).toBe(145);
  });
});

describe("navbar rendering of themed blank mark", () => {
  it("renders a fa-nav-blank span with the resolved theme tone", () => {
    const html = navbarRegionsHtml(
      railModel({
        instance: "cat-harness",
        toRoot: "..",
        links: [],
        harnesses: [
          {
            href: "../unadorned-instance/",
            label: "unadorned-instance",
            glyphPath: BLANK_AVATAR.glyph,
            blank: true,
            tone: 215,
          },
        ],
      }),
    );

    const at = html.indexOf('<div class="fa-nav-bottom">');
    const bottomHtml = html.slice(at);
    expect(bottomHtml).toContain('<span class="fa-nav-glyph fa-nav-tone fa-nav-blank" style="--fa-nav-hue:215" aria-hidden="true"></span>');
    // Ensure no SVG glyph path or initial letter text was rendered inside the blank mark.
    // Scoped to the harness ROW: the group's own summary draws a mark (GROUP_GLYPHS).
    // Up to the row's end: the Harnesses icon after the panel draws an SVG of its own.
    const from = bottomHtml.indexOf('<a href="../unadorned-instance/"');
    const row = bottomHtml.slice(from, bottomHtml.indexOf("</a>", from));
    expect(row).not.toContain('<svg viewBox="0 0 24 24"');
  });

  it("navbarCss includes the .fa-nav-glyph.fa-nav-blank rule", () => {
    const css = navbarCss();
    expect(css).toContain(".fa-nav-glyph.fa-nav-blank");
  });
});

describe("harness-mark navMarkFields", () => {
  it("returns blank: true when mark is blank", () => {
    const fields = navMarkFields({ glyph: BLANK_AVATAR.glyph, title: BLANK_AVATAR.reads, blank: true }, 180);
    expect(fields.blank).toBe(true);
    expect(fields.glyphPath).toBe(BLANK_AVATAR.glyph);
    expect(fields.tone).toBe(180);
  });
});

describe("graphTypologyRowDecor fallback", () => {
  it("falls back to BLANK_AVATAR when kind has no declared avatar", () => {
    const decor = graphTypologyRowDecor("undeclared-graph-typology", "instance-a", 270);
    expect(decor.kind).toBe(true);
    expect(decor.glyphPath).toBe(BLANK_AVATAR.glyph);
    expect(decor.tone).toBe(270);
    expect(decor.blank).toBe(true);
  });
});
