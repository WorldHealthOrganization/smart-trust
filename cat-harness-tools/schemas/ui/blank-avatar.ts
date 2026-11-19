/**
 * The blank avatar on its own, with no `node:` import, so a browser bundle can
 * use it: the navbar client (the tools layer's `scripts/lib/navbar.ts`)
 * compares a glyph with it, and `avatars.ts` reads `node:fs` / `node:url`,
 * which Bun's browser build refuses (`navbar:assets:check`). `avatars.ts`
 * re-exports it.
 *
 * @module schemas/blank-avatar
 * @graphNode none — one constant, re-exported by schemas/content/avatars.ts
 */
import type { Avatar } from "../content/avatars";

/**
 * What a layer, role or kind with no declared avatar gets.
 *
 * Owner ruling, 2026-09-20: *"there is always an avatar, even when there is none
 * (always have default blank/themecolor if no avatar. etc)"*.
 *
 * Absence of an avatar is not absence of a mark: a layer, role or kind
 * with no declared avatar gets a BLANK one drawn in its theme's colour,
 * rather than a gap or generic question mark fallback.
 *
 * Distinct from {@link GENERIC}, which is the question mark for undetermined kinds.
 */
export const BLANK_AVATAR: Avatar = {
  glyph: "M3 3h18v18H3z",
  tone: 0,
  reads: "a blank mark — no avatar declared; rendered in theme colour",
};
