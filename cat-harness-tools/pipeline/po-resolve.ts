/**
 * PO source resolution — the 4-step fallback chain for locating PO files.
 *
 * When a content block does NOT declare `poSources[]` (the common case),
 * this module resolves PO files by convention:
 *
 * 1. **Block-level:** `translations/<locale>/<block-stem>.po`
 * 2. **Chapter-level:** `translations/<locale>/<chapter-slug>.po`
 * 3. **Folio-level:** `translations/<locale>/global.po`
 * 4. **Dependency walk:** walk `harness.config.json` dependencies depth-first,
 *    looking for matching PO files in each dependency's `translations/<locale>/`
 *
 * When `poSources[]` IS declared, only the listed files are consulted
 * (no fallback). Each source is loaded in order; later entries override
 * earlier for the same msgid.
 *
 * @module pipeline/po-resolve
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  readHarnessConfig,
  orderedDependencies,
  type HarnessConfig,
} from "../schemas/kg/harness-config.ts";
import { directoryForGraph } from "../schemas/kg/cat-harness.js";

// ── Types ───────────────────────────────────────────────────────

/** A resolved PO source: the path and how it was found. */
export interface ResolvedPoSource {
  /** Absolute path to the .po file. */
  path: string;
  /** How this source was resolved. */
  resolution: "explicit" | "block" | "chapter" | "folio" | "dependency";
  /** For dependency resolution: which dependency provided it. */
  dependencyName?: string;
}

/** Options for PO source resolution. */
export interface PoResolveOptions {
  /** Absolute path to the folio root directory. */
  folioRoot: string;
  /** BCP 47 locale tag of the target language. */
  locale: string;
  /** Block stem (filename without extension), e.g. "agent-onboarding". */
  blockStem: string;
  /** Chapter slug (directory name), e.g. "chapter-01". Optional. */
  chapterSlug?: string;
  /** Explicit poSources from BlockBase.poSources. Optional. */
  poSources?: string[];
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Where a folio keeps its `.po` and `.pot` files.
 *
 * THREE SOURCES, in this order, and the order is the whole point:
 *
 * 1. `harness.config.json`'s `translation.translationDir`, if set. An explicit
 *    per-folio override stays authoritative — a folio that named a directory
 *    meant it, and changing that silently would be worse than any tidiness.
 * 2. the **declaration** — `harness.json`'s `translation-sources` graph. This
 *    is what the rest of the pipeline reads, including
 *    `translationSourcesDir` in `src/tools/translation.ts`.
 * 3. the convention, `translations/`, for a layer that declares neither.
 *
 * Step 2 was MISSING and it cost a red build. The directory was declared in TWO
 * places — here by convention and in `harness.json` as a graph — and `wggr`
 * moved the declared one to `folio-assistant/translations/`. This function went
 * on composing `folioRoot/translations`, so every PO lookup resolved to a path
 * that no longer existed and `translation:block-qa:check` reported a sidecar
 * with "no PO source any more". The same fact in two places, free to drift,
 * exactly as `AGENTS.md` warns.
 *
 * Reading the declaration here removes the second place rather than adding a
 * third: this layer sets no `translationDir` and now needs none.
 */
function translationDir(folioRoot: string, config?: HarnessConfig | null): string {
  const explicit = config?.translation?.translationDir;
  if (explicit) return join(folioRoot, explicit);
  const declared = directoryForGraph(folioRoot, "translation-sources");
  // declared-path-literal: the convention fallback for a folio that declares
  // neither, matching `translationSourcesDir` in src/tools/translation.ts.
  return declared ?? join(folioRoot, "translations");
}

// ── Folio context ───────────────────────────────────────────────

/**
 * The half of PO resolution that depends on the FOLIO only, never on the block.
 *
 * Steps 1–3 compose paths under the folio's own translation directory and
 * step 4 walks its ordered dependencies — and both of those are a function of
 * `folioRoot` alone. Resolving them per call made a sweep pay for the layer
 * graph once per (block, locale): measured 2026-10-03, 86 s of the 93 s
 * `translation-block-qa --check` was `orderedDependencies` and 12 s more was
 * `directoryForGraph`, re-reading every declaration for every pair (bean `ksg3`).
 *
 * A caller resolving many blocks builds this ONCE and passes it in. It is a
 * value, not a module-level cache, on purpose: tests build fixture folios and
 * edit them between calls, and a cache keyed on the path would answer for the
 * folio as it was.
 */
export interface PoResolveContext {
  /** The folio's own translation directory (see `translationDir`). */
  translationDir: string;
  /** Each dependency that provides translations, deepest first, with its directory. */
  dependencies: { name: string; translationDir: string }[];
}

/** Build the folio-level context `resolvePoSources` needs. */
export function poResolveContext(folioRoot: string): PoResolveContext {
  const dependencies: PoResolveContext["dependencies"] = [];
  // Dependency walk — deepest first, each dependency once (bean a1lq).
  // Uses the canonical resolution from schemas/kg/harness-config.ts.
  for (const resolved of orderedDependencies(folioRoot)) {
    // Skip deps that don't provide translations
    if (
      resolved.dependency.provides &&
      !resolved.dependency.provides.includes("translations")
    ) {
      continue;
    }
    dependencies.push({
      name: resolved.dependency.name,
      translationDir: translationDir(resolved.rootPath, resolved.config),
    });
  }
  return {
    translationDir: translationDir(folioRoot, readHarnessConfig(folioRoot)),
    dependencies,
  };
}

// ── Resolution ──────────────────────────────────────────────────

/**
 * Resolve PO sources for a content block using the 4-step fallback chain.
 *
 * Returns all matched PO files in resolution order. The caller should
 * load them in order, with later entries overriding earlier for the
 * same msgid.
 *
 * @returns Array of resolved PO sources (may be empty if none found).
 */
export function resolvePoSources(
  options: PoResolveOptions,
  /** The folio-level half, built once by a caller resolving many blocks. */
  context?: PoResolveContext,
): ResolvedPoSource[] {
  const { folioRoot, locale, blockStem, chapterSlug, poSources } = options;

  // ── Explicit poSources (no fallback) ──
  if (poSources && poSources.length > 0) {
    return poSources
      .map((src): ResolvedPoSource | null => {
        const abs = src.startsWith("/") ? src : join(folioRoot, src);
        if (!existsSync(abs)) return null;
        return { path: abs, resolution: "explicit" };
      })
      .filter((s): s is ResolvedPoSource => s !== null);
  }

  // ── Fallback chain ──
  const results: ResolvedPoSource[] = [];
  const ctx = context ?? poResolveContext(folioRoot);
  const localeDir = join(ctx.translationDir, locale);

  // Step 1: Block-level
  const blockPo = join(localeDir, `${blockStem}.po`);
  if (existsSync(blockPo)) {
    results.push({ path: blockPo, resolution: "block" });
  }

  // Step 2: Chapter-level
  if (chapterSlug) {
    const chapterPo = join(localeDir, `${chapterSlug}.po`);
    if (existsSync(chapterPo)) {
      results.push({ path: chapterPo, resolution: "chapter" });
    }
  }

  // Step 3: Folio-level
  const globalPo = join(localeDir, "global.po");
  if (existsSync(globalPo)) {
    results.push({ path: globalPo, resolution: "folio" });
  }

  // Step 4: Dependency walk — the order `poResolveContext` fixed.
  for (const dep of ctx.dependencies) {
    const depLocaleDir = join(dep.translationDir, locale);

    // Look for block-level match in the dependency
    const depBlockPo = join(depLocaleDir, `${blockStem}.po`);
    if (existsSync(depBlockPo)) {
      results.push({
        path: depBlockPo,
        resolution: "dependency",
        dependencyName: dep.name,
      });
    }

    // Look for global PO in the dependency
    const depGlobalPo = join(depLocaleDir, "global.po");
    if (existsSync(depGlobalPo)) {
      results.push({
        path: depGlobalPo,
        resolution: "dependency",
        dependencyName: dep.name,
      });
    }
  }

  return results;
}

/**
 * Load and merge PO translations from multiple resolved sources.
 *
 * Later sources override earlier for the same msgid, so the most
 * specific source should be last in the array (which is what
 * resolvePoSources returns: block → chapter → folio → deps).
 *
 * @param sources - Resolved PO sources from resolvePoSources()
 * @param parsePo - The PO parser function (from po-inject.ts)
 * @returns Merged msgid → msgstr dictionary
 */
export function mergePoSources(
  sources: ResolvedPoSource[],
  parsePo: (content: string) => Map<string, string>,
): Map<string, string> {
  const merged = new Map<string, string>();

  // Global/folio sources load first (least specific), then chapter, then block
  // resolvePoSources returns them in specificity order already (block first),
  // but we want least-specific first so more-specific overrides.
  const reversed = [...sources].reverse();

  for (const source of reversed) {
    const content = readFileSync(source.path, "utf-8");
    const entries = parsePo(content);
    for (const [msgid, msgstr] of entries) {
      merged.set(msgid, msgstr);
    }
  }

  return merged;
}

/**
 * List available locales for a given source file by scanning the translations
 * directory.
 *
 * Used by the translation pipeline to stamp `available_locales` in page
 * front matter, which docs-ui.js reads for automatic badge rendering.
 *
 * @param folioRoot - Absolute path to the folio root directory.
 * @param sourceStem - File stem to check for (e.g. "index", "agent-onboarding").
 * @returns Array of BCP 47 locale codes that have a .po file for this stem.
 */
export function availableLocales(
  folioRoot: string,
  sourceStem: string,
): string[] {
  const config = readHarnessConfig(folioRoot);
  const transDir = translationDir(folioRoot, config);
  const locales: string[] = [];

  if (!existsSync(transDir)) return locales;

  // Scan locale subdirectories
  try {
    const entries = readdirSync(transDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const locale = entry.name;
      // Check if this locale has a .po file for the given stem
      const poFile = join(transDir, locale, `${sourceStem}.po`);
      if (existsSync(poFile)) {
        locales.push(locale);
      }
    }
  } catch {
    // Directory not readable
  }

  return locales.sort();
}
