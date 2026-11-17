/**
 * A folio's builders shim: which vocabulary modules it re-exports.
 *
 * Every block manifest imports its builders from `folio/schema/builders.ts`,
 * which `init-folio` writes as a re-export of cat-harness-tools'
 * `schemas/builders` (cat-harness's until bean `8lcl` moved the code). Since the owner's ruling of 2026-10-22 a layer above
 * cat-harness types its own kinds in a vocabulary module
 * (`@litlfred/cat-harness/schemas/content/vocabulary-modules.ts`), and its builders
 * (`theorem`, `definition`, …) are that module's, not cat-harness's. So the shim
 * also re-exports each vocabulary module whose kinds the folio's profile
 * admits: a paper folio the science layer's `mathpaper`, a document folio
 * nothing more.
 *
 * Used by `init-folio` for a new folio and by `folio:shim` for an existing one,
 * so the two cannot disagree.
 *
 * @module scripts/lib/folio-shim
 */
import { dirname, relative } from "node:path";

import { CONTENT_PROFILES, type ContentProfile, PROFILE_BLOCK_KINDS } from "../../schemas/content/block-kinds.ts";
import { vocabularies } from "../../schemas/content/vocabulary-modules.ts";

import { HARNESS_ROOT } from "./roots.ts";

/**
 * The vocabulary modules a folio of `contentType` re-exports, each as a path
 * from the platform checkout's root without its `.ts` (the root holds
 * cat-harness and the layers beside it). Empty for a content type that is not a
 * profile, or whose profile admits no module's kinds.
 */
export function vocabularyModulesFor(contentType: string): string[] {
  if (!(CONTENT_PROFILES as readonly string[]).includes(contentType)) return [];
  const admitted = new Set<string>(PROFILE_BLOCK_KINDS[contentType as ContentProfile]);
  const platformRoot = dirname(HARNESS_ROOT);
  return vocabularies()
    .filter((v) => Object.keys(v.builders).length > 0 && [...v.schemas.keys()].some((k) => admitted.has(k)))
    .map((v) => relative(platformRoot, v.module).split("\\").join("/").replace(/\.ts$/, ""));
}

/** The shim line re-exporting one module, from `folio/schema/` through `assistant`. */
export function reexportLine(assistant: string, module: string): string {
  return `export * from "../../${assistant}/${module}";`;
}

/**
 * The `assistant` path a shim was written with, read off its cat-harness
 * re-export (`export * from "../../<assistant>/cat-harness-tools/schemas/builders"`,
 * or `cat-harness/` in a shim written before bean `8lcl`),
 * or `undefined` when it has none.
 */
export function shimAssistant(shim: string): string | undefined {
  // `cat-harness-tools/` since bean `8lcl`; `cat-harness/` in a shim written before it.
  return /export \* from "\.\.\/\.\.\/(.+)\/cat-harness(?:-tools)?\/schemas\/builders(?:\.ts)?";/.exec(shim)?.[1];
}

/** The re-export lines `shim` lacks for a folio of `contentType`. */
export function missingReexports(shim: string, contentType: string): string[] {
  const assistant = shimAssistant(shim);
  if (assistant === undefined) return [];
  return vocabularyModulesFor(contentType)
    .map((m) => reexportLine(assistant, m))
    .filter((line) => !shim.includes(line));
}
