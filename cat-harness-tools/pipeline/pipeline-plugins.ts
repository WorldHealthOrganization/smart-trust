/**
 * The slots through which GENERIC pipeline code reaches a higher layer's code.
 *
 * ## Why (bean `squu`, owner ruling 2026-10-01 ~18:15)
 *
 * The sci-bound pipeline files — the Lean lexer, the LaTeX preflight, Lean
 * coverage, one folio's chapter profiles — go straight to the science layer,
 * the top layer. A generic module that imports one of them would, after that
 * move, be a lower → higher import, which `check:import-direction` rejects.
 * So the generic caller asks for a KIND here and the science layer fills it
 * through the `pipeline-plugins` graph it declares (one node per slot).
 * Neither side names the other's files: the edge is inverted, not hidden.
 *
 * ## The shape is the one the repository already uses
 *
 * A slot is a {@link PipelinePluginContribution} on {@link ContributionRegistry},
 * loaded by the same dependency walk as content adapters, QA checkers, render
 * targets and MCP tools (`schemas/content/contributions.ts`). A kind claimed by two
 * contributors THROWS — the `contributions.ts` rule, kept for the reason it was
 * made: which Lean lexer runs must not depend on the order dependencies are
 * listed in.
 *
 * ## Why the registry is held here, and filled lazily
 *
 * `ContributionRegistry` is deliberately a layer, not module state. The
 * callers here are synchronous and deep — a checker in the sweep's hot loop, a
 * module-load side effect, a build step — and threading a registry through
 * each would change the signatures the QA dispatch tables are keyed on. So
 * this module holds ONE registry for the process, filled on first use from the
 * running folio's declared dependencies (`loadContributionsSync` from
 * `contributionsRoot()`), and a test or a caller that has already loaded one
 * hands it over with {@link usePipelinePluginRegistry}.
 *
 * Lazy is what keeps behaviour identical: every entry point that imported a
 * leaf directly — the sweep, the build, `q-usage-audit`, a test — reaches the
 * same function through the slot with no new setup step to forget.
 *
 * ## An unfilled slot is an error that says what is missing
 *
 * {@link pipelinePlugin} throws {@link UnregisteredPipelinePluginError}, naming
 * the kind, the root whose dependencies were walked, and which slots WERE
 * filled. It is never defaulted: a Lean lexer that silently does nothing would
 * make every Lean-sibling check pass. A caller for whom absence is a real,
 * reportable state uses {@link optionalPipelinePlugin} and says so.
 *
 * @module pipeline/pipeline-plugins
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { directoriesForGraph, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { ContributionRegistry, type FolioContribution } from "../schemas/content/contributions.ts";
import { loadContributionsSync } from "../schemas/kg/harness-config.ts";
import type { TabularCsvwTables } from "../schemas/library/tabular-csvw.ts";
import type { ExtractionStep } from "../schemas/library/entry-extraction.ts";
import type { Block } from "../schemas/types.ts";
import { checkoutInstanceRoots } from "../scripts/viewer-declarations.ts";
import { contributionsRoot } from "./repo-root";

// ── The slots, and what fills each ─────────────────────────────────
//
// Shapes are restated structurally rather than imported from the modules that
// implement them: importing even a type from a sci-bound file is a reference
// from this layer into that one.

/** A declaration's name and its offset in comment-stripped Lean source. */
export interface LeanDeclStart {
  name: string;
  at: number;
}

/** Lean source lexing — implemented by `lean-lexer.ts`. */
export interface LeanLexerPlugin {
  /** Blank comments, preserving offsets and line numbers. */
  stripLeanComments(src: string): string;
  /** Every declaration start in comment-stripped source, in order. */
  declarationStarts(stripped: string): LeanDeclStart[];
}

/** One issue the LaTeX preflight found. */
export interface LatexPreflightIssue {
  check: string;
  macro: string;
  file: string;
  line: number;
  message: string;
}

/** The LaTeX preflight's verdict on one compile unit. */
export interface LatexPreflightResult {
  ok: boolean;
  issues: LatexPreflightIssue[];
  definedCount: number;
  usedCount: number;
  allowlistCount: number;
  filesScanned: number;
}

/** Macro lint over a generated compile unit — implemented by `latex-preflight.ts`. */
export interface LatexPreflightPlugin {
  runPreflight(mainTexPath: string): LatexPreflightResult;
}

/** Lean coverage — implemented by `scripts/lean-coverage.ts`. */
export interface LeanCoveragePlugin {
  /** The `.lean` file a block's manifest points at, or `null`. */
  resolveLeanFile(tsPath: string, src: string, leanRoot: string): string | null;
  /** Whether a `.lean` file is sorry-free, and its validation state. */
  leanFileStatus(leanPath: string): {
    sorryFree: boolean;
    validation: "stub" | "leanok" | "not_checked";
  };
  /** A paper's coverage statistics. Opaque here; `readme-sections.ts` types the fields it reads. */
  computeStats(paperDir: string, contentRoot: string): unknown;
}

/**
 * Delimited text and workbooks read as CSVW — implemented by the content
 * core, beside its CSV and xlsx extractors (bean `urat`). The owner's ruling
 * of 2026-10-20 moved this ingest step up into that layer; this layer may not
 * name it, so ingest reaches the extractors through this slot.
 */
export interface TabularCsvwPlugin {
  /**
   * The `folio-tabular-csvw/v1` tables for a source, or `null` when the
   * source is not a table this reader takes. The ingest runner adds `source`
   * and `narrative`; a reader never sees them (bean `urat`, step 5).
   * `mimetype` is the sniffed one
   * (`null` for text with no magic bytes, as a CSV is).
   */
  extract(source: Buffer, opts: { url: string; docId: string; mimetype: string | null }): TabularCsvwTables | null;
}

/**
 * A block's live status, overlaid on its manifest as the builder loads it —
 * implemented by the science layer's `pipeline/lean-status-overlay.ts`, which
 * sets `lean.sorryFree` and `lean.validation` from the block's resolved `.lean`
 * (bean `saqd`, row `pipeline/build.ts`). `paperDir` is the paper manifest's
 * directory; `tsPath` the block's `.ts`. The overlay mutates `block` in place.
 *
 * OPTIONAL: a composition that mounts no formalisation layer has no live
 * status to overlay, and the builder keeps the manifest's own values — which
 * is what the PDF then shows, not a pass.
 */
export interface BlockStatusOverlayPlugin {
  overlay(block: Block, tsPath: string, paperDir: string): void;
}

/** Where a library-entry arm runs: a PROMOTED entry, in its library, in its layer. */
export interface LibraryEntryArmContext {
  /** The layer that holds the library (`--instance`, else the working layer). */
  instanceRoot: string;
  /** The library directory, absolute. */
  library: string;
  /** The entry directory, absolute. */
  entry: string;
  slug: string;
}

/**
 * Extraction steps a higher layer runs over each promoted library entry —
 * a reference-list reader, a glossary reader (owner, 2026-11-14: "not sure
 * all have biblio, glossary, ... fully extracted"). Those readers live in the
 * content core, which this layer may not name, so `cat ingest` reaches them
 * through this slot after promotion. Each arm returns its own
 * `extraction.json` step (`schemas/library/entry-extraction.ts`), which the
 * ingest records under `kind`.
 *
 * OPTIONAL: a composition that does not fill it has no such arm, and the ingest
 * records each kind it would have covered as `not-extracted`, saying the slot
 * is unfilled — never `none-in-source`.
 */
export interface LibraryEntryArmsPlugin {
  arms(ctx: LibraryEntryArmContext): Array<{ kind: string; run(): ExtractionStep }>;
}

/** Every slot, keyed by the kind string a contributor registers under. */
export interface PipelinePlugins {
  "lean-lexer": LeanLexerPlugin;
  "latex-preflight": LatexPreflightPlugin;
  "lean-coverage": LeanCoveragePlugin;
  "tabular-csvw": TabularCsvwPlugin;
  "block-status-overlay": BlockStatusOverlayPlugin;
  "library-entry-arms": LibraryEntryArmsPlugin;
}

export type PipelinePluginKind = keyof PipelinePlugins;

/** The kinds, as data — for reports and for the test that pins the set. */
export const PIPELINE_PLUGIN_KINDS: readonly PipelinePluginKind[] = [
  "lean-lexer",
  "latex-preflight",
  "lean-coverage",
  "tabular-csvw",
  "block-status-overlay",
];

// ── The process registry ───────────────────────────────────────────

/**
 * Slots a composition need not fill, asked for only through
 * {@link optionalPipelinePlugin}. Kept out of {@link PIPELINE_PLUGIN_KINDS},
 * whose every member a full checkout is expected to fill.
 */
export const OPTIONAL_PIPELINE_PLUGIN_KINDS: readonly PipelinePluginKind[] = ["library-entry-arms"];

/** Thrown when a slot is asked for and nothing filled it. */
export class UnregisteredPipelinePluginError extends Error {
  constructor(
    readonly kind: string,
    readonly root: string | undefined,
    readonly filled: string[],
    /** Layers in the checkout that DECLARE a node for this slot — read from their declarations. */
    readonly declaredBy: string[] = [],
  ) {
    super(
      `No dependency contributes the pipeline plugin "${kind}". ` +
        (root === undefined
          ? "The registry in use was supplied by the caller, not loaded from a folio. "
          : `Walked the dependencies declared from ${root}. `) +
        (filled.length
          ? `Slots that ARE filled: ${filled.join(", ")}. `
          : "No slot is filled at all. ") +
        `"${kind}" is generic pipeline code reaching a higher layer's code ` +
        (declaredBy.length
          ? `(declared in this checkout by ${declaredBy.join(", ")}): declare that instance as a dependency.`
          : "(no instance in this checkout declares it): declare a dependency whose `pipeline-plugins` " +
            "graph holds a node for this slot."),
    );
    this.name = "UnregisteredPipelinePluginError";
  }
}

let registry: ContributionRegistry | undefined;
/** Where `registry` was loaded from; `undefined` when a caller supplied it. */
let loadedFrom: string | undefined;

/**
 * Use this registry for every slot lookup in the process, or `undefined` to
 * go back to loading lazily from the running folio.
 *
 * For tests, and for an entry point that has already loaded contributions
 * from a root other than {@link contributionsRoot} and wants the slots to agree
 * with them.
 */
export function usePipelinePluginRegistry(next: ContributionRegistry | undefined): void {
  registry = next;
  loadedFrom = undefined;
}

function current(): ContributionRegistry {
  if (!registry) {
    const root = contributionsRoot();
    registry = loadContributionsSync<FolioContribution, ContributionRegistry>(
      root,
      new ContributionRegistry(),
    );
    loadedFrom = root;
  }
  return registry;
}

/**
 * What fills a slot. Throws {@link UnregisteredPipelinePluginError} when
 * nothing does — never a default.
 */
export function pipelinePlugin<K extends PipelinePluginKind>(kind: K): PipelinePlugins[K] {
  const reg = current();
  const impl = reg.pipelinePlugin(kind);
  if (impl === undefined) {
    throw new UnregisteredPipelinePluginError(
      kind,
      loadedFrom,
      reg.contributedPipelinePlugins().map((p) => `${p.kind} (${p.contributor})`),
      slotDeclaredBy(loadedFrom ?? resolve(import.meta.dir, "..", ".."), kind),
    );
  }
  return impl as PipelinePlugins[K];
}

/**
 * The layers in the checkout at `repoRoot` whose declared
 * `pipeline-plugins` graph holds a node for `slot` — what the error offers as
 * the dependency to declare, read from the declarations rather than written
 * down, so this generic module names no layer above it
 * (check:reference-direction). Only the DECLARATION is read: nothing is
 * loaded, so a broken contributor cannot hide behind the error it would fix.
 * Empty when none does, or when the checkout cannot be read.
 */
export function slotDeclaredBy(repoRoot: string, slot: string): string[] {
  const out: string[] = [];
  let roots: string[];
  try {
    roots = checkoutInstanceRoots(repoRoot);
  } catch {
    return out;
  }
  for (const root of roots) {
    try {
      const name = readDeclaration(root)?.name;
      if (name === undefined) continue;
      const fills = directoriesForGraph(root, "pipeline-plugins").some(
        (dir) =>
          existsSync(dir) &&
          readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .some((f) => (JSON.parse(readFileSync(join(dir, f), "utf-8")) as { slot?: unknown }).slot === slot),
      );
      if (fills && !out.includes(name)) out.push(name);
    } catch {
      // An unreadable declaration or node is another gate's finding; the
      // error this feeds must still be raised.
    }
  }
  return out.sort();
}

/**
 * What fills a slot, or `undefined` when nothing does.
 *
 * Only for a caller whose own output already has a "could not determine"
 * state to put this in — absence must surface somewhere, never as a pass.
 */
export function optionalPipelinePlugin<K extends PipelinePluginKind>(
  kind: K,
): PipelinePlugins[K] | undefined {
  return current().pipelinePlugin(kind) as PipelinePlugins[K] | undefined;
}

// ── Delegates under the implementing module's own names ────────────
//
// A caller switches from the leaf to the slot by changing its import
// SPECIFIER and nothing else. That is deliberate, and not only for a small
// diff: a QA checker's freshness key is a hash over its own text and the
// top-level declarations it reaches (`qa-criterion-hash.ts`). A local wrapper
// `const` would be a new reached declaration and would move the key of every
// checker that calls it, re-staling verdicts for a change that alters no
// behaviour. Import bindings are not declarations, so this way the keys stay.
//
// Each resolves its slot at CALL time, never at import time, so importing a
// module that uses one loads no contributor until the function actually runs.

/** `lean-lexer` slot: blank Lean comments, preserving offsets and lines. */
export function stripLeanComments(src: string): string {
  return pipelinePlugin("lean-lexer").stripLeanComments(src);
}

/** `lean-lexer` slot: declaration starts in comment-stripped Lean source. */
export function declarationStarts(stripped: string): LeanDeclStart[] {
  return pipelinePlugin("lean-lexer").declarationStarts(stripped);
}

/** `latex-preflight` slot: macro lint over a generated compile unit. */
export function runPreflight(mainTexPath: string): LatexPreflightResult {
  return pipelinePlugin("latex-preflight").runPreflight(mainTexPath);
}

/** `lean-coverage` slot: coverage statistics for a paper. */
export function computeStats(paperDir: string, contentRoot: string): {
  provable: { total: number; with_lean_file: number; sorry_free: number; percent_sorry_free: number };
  conjectures: {
    total: number;
    with_lean_file: number;
    class_axiomatized: number;
    percent_class_axiomatized: number;
    primary: number;
    primary_class_axiomatized: number;
    percent_primary_class_axiomatized: number;
  };
  definitions: { total: number; with_lean_file: number };
} {
  return pipelinePlugin("lean-coverage").computeStats(paperDir, contentRoot) as ReturnType<typeof computeStats>;
}

/**
 * `tabular-csvw` slot: a delimited-text or workbook source as CSVW, or `null`.
 * Required, not optional: an ingest that reaches here with nothing filling the
 * slot refuses with the slot's own error, which names what is missing — it
 * never falls back to `folio-tabular-records/v1`.
 */
export function extractTabularCsvw(
  source: Buffer,
  opts: { url: string; docId: string; mimetype: string | null },
): TabularCsvwTables | null {
  return pipelinePlugin("tabular-csvw").extract(source, opts);
}
