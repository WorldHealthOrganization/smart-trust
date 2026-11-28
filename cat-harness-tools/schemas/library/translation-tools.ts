/**
 * Content-type-specific translation tool registry.
 *
 * Each content adapter declares the translation formats it handles and
 * the scripts/extractors for each format. This schema is the bridge
 * between the generic translation pipeline (pot-extract, po-inject,
 * po-resolve) and the content-type-specific scripts ported from
 * WHO's SMART Base repository.
 *
 * ## Architecture
 *
 * ```
 * adapters/<type>/tools/translation.ts  — adapter-specific extract/inject
 * pipeline/pot-extract.ts       — generic Markdown extraction
 * pipeline/po-inject.ts         — generic Markdown injection
 * pipeline/po-resolve.ts        — PO source resolution (4-step)
 * scripts/translation/*.py             — SMART Base Python originals
 * ```
 *
 * The generic pipeline handles Markdown (every content type has it).
 * Adapter-specific translation tools extend it with format-specific
 * extractors (PlantUML, SVG, ArchiMate, FHIR, FSH, LaTeX, etc.).
 *
 * ## Which content types are translatable
 *
 * Not listed here. Each instance that owns a content type declares its
 * profile under `contentTranslations` in its own `<instance>.json`, and
 * {@link CONTENT_TYPE_TRANSLATIONS} collects whatever instances are present.
 *
 * @module schemas/translation-tools
 * @graphNode schema
 */

import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkoutRootFor,
  ContentTypeTranslationSchema,
  readDeclaration,
  TranslatableFormatSchema,
  type ContentTypeTranslation,
  type TranslatableFormat,
} from "../kg/cat-harness.ts";
import { declarationChain, resolveImplementingPath } from "../kg/harness-config.ts";
import { layerRootsIn } from "../kg/instance-roots.ts";

import { harnessRoot } from "../harness-root.ts";
import { subgraphHarnessPath } from "../../scripts/lib/harness-layout.ts";
import { workflowFiles } from "../../scripts/known-skills.ts";
// The two profile schemas live with the declaration that carries them
// (`contentTranslations`, bean `0r7u`); re-exported so callers keep one import.
export { ContentTypeTranslationSchema, TranslatableFormatSchema };
export type { ContentTypeTranslation, TranslatableFormat };

// ── Registry ────────────────────────────────────────────────────

/**
 * One instance's declared profile, with the instance that declared it.
 *
 * `declaredBy` is what a path in the profile resolves against: the declaring
 * instance first, then down its `needs` chain ({@link resolveTranslationPath}).
 */
export type DeclaredContentTypeTranslation = ContentTypeTranslation & { declaredBy: string };

/**
 * Every present instance's declared `contentTranslations` (bean `0r7u`, step 0
 * part 3; owner ruling 2026-10-06, "each instance declares its own").
 *
 * This was a literal table of four content types (`document`, `paper`, `dak`,
 * `ig`) here in cat-harness, every one owned by a layer above it. Each now
 * lives in its owner's `<instance>.json`. A content type declared twice
 * THROWS: two owners of one profile is a placement defect, not a merge.
 * Standalone, with no instance above cat-harness present, the list is empty,
 * and nothing is translatable here, which is true of a layer with no content.
 */
export function collectContentTypeTranslations(repoRoot: string): DeclaredContentTypeTranslation[] {
  const out: DeclaredContentTypeTranslation[] = [];
  const ownerOf = new Map<string, string>();
  for (const instance of layerRootsIn(repoRoot)) {
    for (const ct of readDeclaration(instance)?.contentTranslations ?? []) {
      const prior = ownerOf.get(ct.contentType);
      if (prior !== undefined) {
        throw new Error(`content type "${ct.contentType}" has a translation profile in both ${prior} and ${instance}`);
      }
      ownerOf.set(ct.contentType, instance);
      out.push({ ...ct, declaredBy: instance });
    }
  }
  return out;
}

/**
 * Where a path a profile names actually is: the declaring instance first, then
 * each instance it `needs`, nearest first. `undefined` when none holds it.
 *
 * The old table spelled a path into another instance as `../<instance>/…`,
 * relative to cat-harness. One entry named `processes/publication-workflow.bpmn`,
 * which never existed, so the re-render skipped it silently, and a skipped
 * diagram looks like one that needed no work. `check:workflow-refs` asks this
 * function, so a path no instance in the chain holds is still a finding.
 */
export function resolveTranslationPath(ct: DeclaredContentTypeTranslation, rel: string): string | undefined {
  const chain = declarationChain(ct.declaredBy).map((c) => c.root).reverse();
  // A path into a harness folder that moved into a named sub-graph (sdlc,
  // work-plan, library) is also tried in its new spelling, so a layer that
  // still names the old one resolves while the pins catch up. Transitional,
  // like `harness-layout.ts` itself.
  const spellings = [...new Set([rel, subgraphHarnessPath(rel)])];
  for (const root of chain) {
    for (const r of spellings) {
      const abs = join(root, r);
      if (existsSync(abs)) return abs;
    }
  }
  // The code moved to the layer that implements the declaring instance (bean 70lx).
  for (const root of chain) {
    const r = resolveImplementingPath(root, rel);
    if (r.state === "found") return join(r.root, rel);
  }
  // A bare diagram FILE NAME (`draft-to-publication.bpmn`) is found through the
  // declared process graphs of the chain, wherever the owning layer placed it.
  // A path into another layer is a fact about that layer's layout, and it
  // changes when the layer regroups its diagrams (into an opt-in group, say),
  // so a profile names a diagram it does not own by name. Every group on disk
  // is read, switched on or not: the profile is a declaration, and a root
  // leaving the group off does not make it wrong.
  if (/^[^/]+\.(?:bpmn|dmn)$/.test(rel)) {
    for (const root of chain) {
      let files: string[];
      try {
        files = workflowFiles(root, "instance", { enabledSubgraphs: "all" });
      } catch {
        continue; // an unreadable declaration is check:harness-dirs' to report
      }
      const hits = files.filter((f) => basename(f) === rel);
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) return undefined; // ambiguous: a finding, not a pick
    }
  }
  return undefined;
}

export const CONTENT_TYPE_TRANSLATIONS: DeclaredContentTypeTranslation[] = collectContentTypeTranslations(
  // `import.meta.url`, not Bun's `import.meta.dir`: Playwright loads this module
  // under Node, where `import.meta.dir` is undefined.
  checkoutRootFor(harnessRoot() ?? dirname(dirname(dirname(fileURLToPath(import.meta.url))))),
);

/**
 * Look up translation capabilities for a content type.
 */
export function getContentTypeTranslation(
  contentType: string,
): ContentTypeTranslation | undefined {
  return CONTENT_TYPE_TRANSLATIONS.find((ct) => ct.contentType === contentType);
}

/**
 * Get all translatable formats across all content types.
 */
export function allTranslatableFormats(): TranslatableFormat[] {
  return CONTENT_TYPE_TRANSLATIONS.flatMap((ct) => ct.formats);
}

/**
 * Check if a file extension is translatable for a given content type.
 */
export function isTranslatable(
  contentType: string,
  extension: string,
): boolean {
  const ct = getContentTypeTranslation(contentType);
  if (!ct) return false;
  return ct.formats.some((f) => f.extensions.includes(extension));
}
