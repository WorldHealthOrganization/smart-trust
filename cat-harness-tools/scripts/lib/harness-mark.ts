/**
 * A harness's navbar MARK, read one way by every surface that draws it.
 *
 * Bean `2vpn`, owner 2026-10-04 (paraphrased): the IRIS replica was missing
 * its top icon on the left-hand navbar, and *"all needs to be consistent and
 * consolidated"*. The IRIS replica DECLARED a mark —
 * its open-book glyph in WHO blue, since the owner removed its emblem on
 * 2026-09-23 — and the header drew the letter "W" on every page anyway. Two
 * defects composed:
 *
 * - `harness-tiles.ts` resolved a navbar mark only from a theme card or a
 *   declared `icon`, so a glyph-only layer had no `mark` at all;
 * - the mounted and viewer pages read the row's `icon` rather than its `mark`,
 *   so even a THEME avatar never reached them — only a layer with a
 *   declared `icon` (cat-harness) ever drew an image there.
 *
 * Three readers each converted a row by hand (`gen-navbar-include.ts`,
 * `mount-instance-docs.ts` twice), which is how one of them drifted to `icon`.
 * This module is the conversion; `harness-tiles.ts` is the resolution. A
 * reader that builds a {@link NavItem} from `harness.json` calls
 * {@link navMarkFields} and adds nothing of its own.
 *
 * @module cat-harness/scripts/lib/harness-mark
 */
import type { NavItem } from "./navbar.js";

/** A declared crop: the part of the image that IS the avatar, as fractions. */
export interface MarkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * What `harness-tiles.ts` writes as a row's `mark`: an image (`src`, with its
 * declared `region` and the `crop` solved for Liquid) or a registry glyph
 * (`glyph`, SVG path data in a 24×24 box). Exactly one of `src` and `glyph`.
 */
export interface HarnessMark {
  src?: string;
  glyph?: string;
  title: string;
  region?: MarkRegion;
  crop?: { width: number; height: number; left: number; top: number };
  /** The image's declared `ground` (`KgImageSchema`): `none` draws no tone behind it. */
  ground?: "tone" | "none";
  blank?: boolean;
}

/**
 * The navbar fields for a row's mark and tone.
 *
 * `rebase` turns the row's site-relative `src` into what the page can load —
 * the identity for the Jekyll include (Liquid re-bases it), `toRoot + src` for
 * a mounted or viewer page. `tone` passes through as written: a 0 is
 * `GENERIC`'s tone (`schemas/content/avatars.ts`), and `navbar.ts`'s `mark()` draws
 * no tone for it — which is the generic fallback, not a dropped hue.
 */
export function navMarkFields(
  mark: HarnessMark | null | undefined,
  tone: number | undefined,
  rebase: (src: string) => string = (s) => s,
): Pick<NavItem, "avatar" | "glyphPath" | "tone" | "blank"> {
  const toneField = typeof tone === "number" ? { tone } : {};
  if (mark?.src) {
    return {
      avatar: {
        src: rebase(mark.src),
        ...(mark.title ? { title: mark.title } : {}),
        ...(mark.region ? { region: mark.region } : {}),
        ...(mark.ground ? { ground: mark.ground } : {}),
      },
      ...toneField,
    };
  }
  if (mark?.blank) {
    return {
      blank: true,
      ...(mark.glyph ? { glyphPath: mark.glyph } : {}),
      ...toneField,
    };
  }
  if (mark?.glyph) return { glyphPath: mark.glyph, ...toneField };
  return toneField;
}
