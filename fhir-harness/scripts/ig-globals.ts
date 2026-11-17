/**
 * The IG's global profiles, as the IG Publisher's `globals-table.xhtml` shows
 * them: one row per resource type with the profile every instance of that type
 * must conform to, or a sentence saying there are none.
 *
 * The Publisher generates the fragment, so an IG site built without it showed
 * a "not rendered" marker in its place (the WHO SMART Base IG `index.md`, 2026-10-09).
 * This computes the rows; `templates/ig-site/globals-table.liquid` only lays
 * them out. The declaration is the AST's ImplementationGuide `global` first,
 * `sushi-config.yaml`'s `global` map where there is no AST — the same order
 * the dependency table uses (`ig-dependencies.ts`).
 *
 * @module fhir-harness/scripts/ig-globals
 */

export interface GlobalProfile {
  /** A FHIR resource type. */
  type: string;
  /** The canonical URL of the profile instances of `type` must conform to. */
  profile: string;
}

/** The fragment this replaces. */
export const GLOBALS_FRAGMENT = "globals-table.xhtml";

const byType = (a: GlobalProfile, b: GlobalProfile) => a.type.localeCompare(b.type) || a.profile.localeCompare(b.profile);

/** From an ImplementationGuide resource's `global` (`[{ type, profile }]`). */
export function globalsFromImplementationGuide(ig: Record<string, unknown>): GlobalProfile[] {
  const g = Array.isArray(ig.global) ? (ig.global as Array<Record<string, unknown>>) : [];
  return g
    .filter((x) => typeof x.type === "string" && typeof x.profile === "string")
    .map((x) => ({ type: x.type as string, profile: x.profile as string }))
    .sort(byType);
}

/** From `sushi-config.yaml`'s `global` map (`Type: profile` or `Type: [profiles]`). */
export function globalsFromSushiConfig(sushi: Record<string, unknown>): GlobalProfile[] {
  const g = sushi.global && typeof sushi.global === "object" && !Array.isArray(sushi.global) ? (sushi.global as Record<string, unknown>) : {};
  const out: GlobalProfile[] = [];
  for (const [type, v] of Object.entries(g)) {
    for (const p of Array.isArray(v) ? v : [v]) if (typeof p === "string" && p) out.push({ type, profile: p });
  }
  return out.sort(byType);
}
