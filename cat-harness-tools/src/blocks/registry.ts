/**
 * Block Module Registry — lazy-loading registry for content block types.
 *
 * Provides:
 *   - Eager registration of block kinds with lazy loaders
 *   - On-demand module loading via dynamic import()
 *   - Caching (each module loaded at most once)
 *   - Dependency preloading hints for the viewer
 *
 * Usage:
 *   import { registry } from "./blocks/registry";
 *   registry.register({ kind: "simulator", displayName: "Simulator", loader: () => import("./simulator") });
 *   const mod = await registry.get("simulator");
 *   const html = mod?.renderHtml?.(block);
 *
 * @module folio-assistant/blocks/registry
 */

import type { BlockModule, BlockModuleEntry } from "./types.js";

class BlockModuleRegistry {
  private entries = new Map<string, BlockModuleEntry>();

  /** Register a block module (eagerly stores metadata, lazily loads implementation). */
  register(entry: BlockModuleEntry): void {
    this.entries.set(entry.kind, entry);
  }

  /** Get a loaded block module by kind. Loads on first access, then caches. */
  async get(kind: string): Promise<BlockModule | null> {
    const entry = this.entries.get(kind);
    if (!entry) return null;

    if (entry._cached) return entry._cached;

    try {
      const mod = await entry.loader();
      entry._cached = mod;
      return mod;
    } catch (e) {
      console.error(`[blocks] Failed to load module for "${kind}":`, e);
      return null;
    }
  }

  /** Check if a module is registered for the given kind. */
  has(kind: string): boolean {
    return this.entries.has(kind);
  }

  /** Check if a module is already loaded (cached). */
  isLoaded(kind: string): boolean {
    return !!this.entries.get(kind)?._cached;
  }

  /** Get all registered kinds. */
  kinds(): string[] {
    return [...this.entries.keys()];
  }

  /** Get viewer dependencies for a kind (without loading the module). */
  viewerDependencies(kind: string): string[] {
    return this.entries.get(kind)?.viewerDependencies ?? [];
  }

  /** Preload modules for given kinds (e.g., visible blocks in the viewport). */
  async preload(kinds: string[]): Promise<void> {
    const unique = [...new Set(kinds)].filter(k => this.has(k) && !this.isLoaded(k));
    await Promise.allSettled(unique.map(k => this.get(k)));
  }

  /** Get display name for a kind without loading the module. */
  displayName(kind: string): string {
    return this.entries.get(kind)?.displayName ?? kind;
  }
}

/** Singleton registry instance. */
export const registry = new BlockModuleRegistry();

// ── Register built-in block types ──────────────────────────────────
// Each registration is just metadata + a lazy loader.
// The actual module code is only loaded when first accessed.

const BLOCK_KINDS: Array<Pick<BlockModuleEntry, "kind" | "displayName" | "viewerDependencies">> = [
  { kind: "definition", displayName: "Definition" },
  { kind: "theorem", displayName: "Theorem" },
  { kind: "lemma", displayName: "Lemma" },
  { kind: "proposition", displayName: "Proposition" },
  { kind: "corollary", displayName: "Corollary" },
  { kind: "conjecture", displayName: "Conjecture" },
  { kind: "example", displayName: "Example" },
  { kind: "remark", displayName: "Remark" },
  { kind: "proof", displayName: "Proof" },
  { kind: "prose", displayName: "Prose" },
  { kind: "equation", displayName: "Equation", viewerDependencies: ["katex"] },
  { kind: "diagram", displayName: "Diagram" },
  { kind: "simulator", displayName: "Simulator", viewerDependencies: ["katex"] },
  // `algorithm` and `table` are in the schema's `Block` union and were missing
  // here, so neither had a registered renderer. They were missing from four
  // other hand-maintained kind lists too; see `BLOCK_KINDS` in schemas/types.
  { kind: "algorithm", displayName: "Algorithm" },
  { kind: "table", displayName: "Table" },
  // `figure` — an image extracted from a source document, bean `d5f1`. Listed
  // here by hand like the rest; the list is checked against the schema's
  // `BLOCK_KINDS` by `scripts/tests/block-kinds.test.ts`, which is what caught
  // `algorithm` and `table` going unrendered and what caught this one.
  { kind: "figure", displayName: "Figure" },
  // `recommendation` — a document folio's normative statement, bean `55ao`.
  // Its node is declared by the content core above this layer; registered
  // ahead of it so the kind is never discovered without a renderer.
  { kind: "recommendation", displayName: "Recommendation" },
];

// Register all built-in kinds with stub loaders.
// Actual per-kind module implementations will be added as the migration
// progresses. For now, each loads a shared fallback renderer.
for (const { kind, displayName, viewerDependencies } of BLOCK_KINDS) {
  registry.register({
    kind,
    displayName,
    viewerDependencies,
    loader: async () => ({
      kind,
      displayName,
      // Renderers will be implemented per-kind as the migration progresses.
      // For now, return the kind info so the registry is functional.
    }),
  });
}
