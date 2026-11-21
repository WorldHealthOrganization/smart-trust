/**
 * Helpers for reading author-written manifest entries.
 *
 * Both resolvers — `adapters/mcp-server/server.ts` and
 * `adapters/paper/resolver.ts` — walk the same `.ts` manifests and had grown
 * their own byte-identical copies of `tryParseLeanRef` and `sectionBlockNames`,
 * each taking `any`. Two copies of a shape decision is how the two resolvers
 * came to disagree about which `sections[]` entries count: one skipped
 * everything without a `blocks` array, the other skipped only bare references.
 *
 * One copy, one predicate, one place to pin in a test.
 *
 * @module folio-assistant/adapters/manifest-entries
 */

import type { Block, Section, SectionRef } from "../schemas/types.js";

/**
 * Is this `sections[]` entry a bare reference to a section file, rather than
 * an inline section?
 *
 * The test is "names a target AND carries no blocks", not merely "has no
 * blocks": a `{ title, subsections }` entry is an inline section that happens
 * to keep every block in its subsections, and classifying it as a reference
 * drops all of them. `Section.blocks` is required by the schema, but authored
 * manifests omit it in exactly that case, which is why the runtime test cannot
 * be replaced by the static type.
 */
export function isSectionRef(sec: Section | SectionRef): sec is SectionRef {
  return "name" in sec && !("blocks" in sec);
}

/**
 * Flatten a section manifest into the ordered list of block root-names it
 * contributes: the section's own `blocks`, then each subsection's `blocks` in
 * declaration order.
 *
 * The viewer / MCP resolution layer has no subsection nesting, so subsection
 * content is surfaced inline under the parent section. The order mirrors the
 * LaTeX renderer (`render-latex.ts`: parent blocks first, then each
 * `\subsection` with its blocks), keeping viewer and PDF block order in sync.
 * Without this, blocks living only inside `subsections[]` never reach any
 * resolver consumer and the section renders empty in the viewer.
 */
export function sectionBlockNames(sec: Section): string[] {
  const own: string[] = Array.isArray(sec.blocks) ? sec.blocks : [];
  const subs: string[] = Array.isArray(sec.subsections)
    ? sec.subsections.flatMap((s) => (s && !isSectionRef(s) && Array.isArray(s.blocks) ? s.blocks : []))
    : [];
  return subs.length ? [...own, ...subs] : own;
}

/**
 * A block's `lean` field, for the kinds that declare one.
 *
 * `Block` is a discriminated union and only the provable kinds carry `lean`,
 * so `blk.lean` is a type error on the union — which is why both resolvers
 * reached it through an `any`-typed block instead. Note there is no companion
 * `blk.status`: `FormalizationStatus` is documented as derived at build time
 * from .lean content and "NOT stored in content block .ts manifests", so every
 * `blk.status` read against a manifest was `undefined`. Derive it from this
 * instead, via `leanStatusBucket`.
 */
export function blockLean(blk: Block) {
  return "lean" in blk ? blk.lean : undefined;
}

/** As `blockLean`, for the other fields only some block kinds declare. */
export const blockProofs = (b: Block) => ("proofs" in b ? b.proofs : undefined);
export const blockExamples = (b: Block) => ("examples" in b ? b.examples : undefined);
export const blockTex = (b: Block) => ("tex" in b ? b.tex : undefined);
export const blockCaption = (b: Block) => ("caption" in b ? b.caption : undefined);

// `tryParseLeanRef` lived here and is GONE, not moved.
//
// It returned a `ParsedLeanRef` — package, decl, module, bare name — and both
// resolvers immediately turned that into file paths with a decl-prefix walk of
// their own. Every part of it is the formalism layer's vocabulary, which core no
// longer holds (owner ruling 2026-09-27: the `lean.ref` grammar is science
// vocabulary). Both call sites now ask `schemas/formal-ref.ts` for candidate
// PATHS instead, so the parse never crosses the boundary and there is nothing
// left for this helper to hand back.
//
// Its purpose — one copy of a shape decision, per this module's own header —
// is served better by the resolver than by a shared parse: the two resolvers
// had duplicated the path walk even while sharing the parse, which is the
// divergence this file was created to stop.
