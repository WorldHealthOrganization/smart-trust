#!/usr/bin/env bun
/**
 * LSI over content BLOCKS — bean `folio-assistant-ec2a`, first half.
 *
 * `lsi-indexing` (cat-harness-tools `scripts/lsi.ts`) indexes a library by
 * SECTION file, so a query can answer "this is about section X of document D"
 * but never "this is about block Y". The block is the unit everything else
 * here addresses — `@id`, review verdicts, todos — and qou's 141 duplicate
 * groups were mostly one thing filed twice, which a block-level index can
 * name. The owner, 2026-10-10 (drain session ml9h): *accept scope, blocks
 * first* — the block indexer in folio-assistant-core first, then the
 * `lean-decl` kind in folio-assistant-sci, then a cross-graph `lsi:near`.
 *
 * ## Why it lives in core
 *
 * What a block IS — its kinds, where its text is — is content vocabulary, and
 * core owns that (`AGENTS.md`). The LSI engine is a tool, and lives below
 * (`cat-harness-tools/pipeline/lsi.ts`); core may import the tools
 * layer, never the reverse (ruling C1, epic `7x5n`). So this file decides what
 * a block's text is and hands units to the engine.
 *
 * ## A block's text, by kind
 *
 * Measured over every library in the index checkout, 2026-10-12: 4,549 block
 * nodes — 4,072 `prose`, 476 `figure`, 1 `table`.
 *
 * | kind | text |
 * |---|---|
 * | `prose` | the section file its `text` points at (relative to the block) |
 * | `figure` | its `title`/`label` and `narrative.text` — the description a reader without the image gets |
 * | `table` | its `label`, `title` and `headers` |
 *
 * A figure's narrative is the half the section index never saw: 476 units of
 * text that are in no section file. A block whose text cannot be read — a
 * prose block pointing at a missing file, a kind this table does not know —
 * is COUNTED as unreadable and reported, never silently dropped: an index
 * built over less than the corpus must say so.
 *
 * ## The id is the block's IRI
 *
 * A unit's id is the block's `@id` (`library/<entry>/blocks/<block>`), so a
 * neighbour or query hit names the block the way every other reader names it.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/lsi-blocks.ts [--library <dir>]... [--json] [--near "<text>"] [--top N]
 *
 * With no `--library`, every directory any layer in the checkout declares
 * with the `library` typology.
 *
 * @module folio-assistant-core/scripts/lsi-blocks
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { libraryEntries } from "./lib/library-entries.ts";

import { declaredGraphs, instanceRootsIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { narrativeFor, type NarrativeSlot } from "@litlfred/cat-harness-tools/schemas/content/narrative.js";
import { buildLsi, neighboursOf, query, type LsiUnit } from "@litlfred/cat-harness-tools/pipeline/lsi.ts";

/** A block node as the corpus writes it — only the fields a block's text is read from. */
interface BlockNode {
  "@id"?: string;
  kind?: string;
  title?: string;
  label?: string;
  text?: string;
  /** One narrative, or one per language (bean `cat-tools-e1lo`, stage 3). */
  narrative?: { text?: string | null; lang?: string } | Array<{ text?: string | null; lang?: string }>;
  headers?: unknown;
}

export interface BlockUnits {
  units: LsiUnit[];
  /** Blocks whose text could not be read, with why. Never dropped silently. */
  unreadable: Array<{ file: string; reason: string }>;
  /** Blocks read, per kind. */
  byKind: Record<string, number>;
}

/** The text of one block, or why there is none. */
export function blockText(block: BlockNode, blockFile: string): { text: string } | { reason: string } {
  const heading = [block.title, block.label].filter((s): s is string => typeof s === "string" && s.length > 0).join(" — ");
  switch (block.kind) {
    case "prose": {
      if (typeof block.text !== "string") return { reason: "a prose block with no `text` reference" };
      const file = resolve(dirname(blockFile), block.text);
      if (!existsSync(file)) return { reason: `its text ${block.text} does not exist` };
      return { text: [heading, readFileSync(file, "utf8")].filter(Boolean).join("\n\n") };
    }
    case "figure": {
      // A slot may hold one narrative or one per language; a single-text
      // reader takes the one `narrativeFor` picks (locale match, else first).
      const slot = block.narrative;
      const narrative = slot && (!Array.isArray(slot) || slot.length > 0) ? narrativeFor(slot as NarrativeSlot).text : undefined;
      if (!heading && !narrative) return { reason: "a figure with no title, label or narrative" };
      return { text: [heading, narrative].filter(Boolean).join("\n\n") };
    }
    case "table": {
      const headers = Array.isArray(block.headers) ? block.headers.flat(2).filter((h) => typeof h === "string").join(" ") : "";
      if (!heading && !headers) return { reason: "a table with no label, title or headers" };
      return { text: [heading, headers].filter(Boolean).join("\n\n") };
    }
    default:
      return { reason: `kind ${JSON.stringify(block.kind)} has no text rule here` };
  }
}

/** Every block of every entry in the given library directories. */
export function blockUnits(libraries: string[]): BlockUnits {
  const out: BlockUnits = { units: [], unreadable: [], byKind: {} };
  const seen = new Map<string, string>();
  for (const lib of libraries) {
    if (!existsSync(lib)) continue;
    // Flat or filed in a concern group (bean `6fez`).
    for (const { dir: entryDir } of libraryEntries(lib)) {
      const dir = join(entryDir, "blocks");
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).filter((f) => f.endsWith(".jsonld")).sort()) {
        const file = join(dir, name);
        let block: BlockNode;
        try {
          block = JSON.parse(readFileSync(file, "utf8"));
        } catch (e) {
          out.unreadable.push({ file, reason: `does not parse: ${(e as Error).message.split("\n")[0]}` });
          continue;
        }
        const t = blockText(block, file);
        if ("reason" in t) {
          out.unreadable.push({ file, reason: t.reason });
          continue;
        }
        const id = block["@id"] ?? relative(lib, file).replace(/\.jsonld$/, "");
        // `@id` is relative to each layer's base, so two libraries could
        // mint one. None do (2026-10-12); if one does, the second is reported
        // rather than silently overwriting the first's coordinates.
        if (seen.has(id)) {
          out.unreadable.push({ file, reason: `@id ${id} is already used by ${seen.get(id)}` });
          continue;
        }
        seen.set(id, file);
        out.units.push({ id, text: t.text });
        out.byKind[block.kind!] = (out.byKind[block.kind!] ?? 0) + 1;
      }
    }
  }
  return out;
}

/** The library directories the layers in `repoRoot` declare. */
export function declaredLibraries(repoRoot: string): string[] {
  const dirs = new Set<string>();
  for (const root of instanceRootsIn(repoRoot)) {
    for (const g of declaredGraphs(root)) {
      if (g.absPath && g.graphTypologies.includes("library")) dirs.add(g.absPath);
    }
  }
  return [...dirs].sort();
}

/** The index options this script builds with, shared with the `lsi:near` provider so both index the same way. */
export const BLOCK_INDEX_OPTIONS = { k: 100, weighting: "log-entropy", minDf: 2, maxDfShare: 0.5, powerIterations: 4, seed: 1990 } as const;

/**
 * The `lsiUnitProviders` entry `blocks` (bean `ec2a` step 3): every block of
 * every declared library, for cross-graph `lsi:near` in cat-harness-tools
 * (`pipeline/lsi-near-across.ts`, which owns the contract). `ctx.roots`, from
 * `--root blocks=<dir>`, replaces the declared libraries when given.
 *
 * A block's `@id` is its own explicit reference: a query that writes it out
 * names the block, unscored.
 */
export function lsiNearUnits(ctx: { checkoutRoot: string; roots: string[] }): {
  units: LsiUnit[];
  unreadable: Array<{ file: string; reason: string }>;
  notSearched?: string;
  buildOptions?: typeof BLOCK_INDEX_OPTIONS;
  refKeys?: Array<[string, string]>;
} {
  const libraries = ctx.roots.length ? ctx.roots.map((r) => resolve(r)) : declaredLibraries(ctx.checkoutRoot);
  if (libraries.length === 0) return { units: [], unreadable: [], notSearched: "no library is declared in this checkout" };
  const b = blockUnits(libraries);
  return { units: b.units, unreadable: b.unreadable, buildOptions: BLOCK_INDEX_OPTIONS, refKeys: b.units.map((u) => [u.id, u.id]) };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const libs = argv.flatMap((a, i) => (argv[i - 1] === "--library" ? [resolve(a)] : []));
  const repoRoot = resolve(import.meta.dir, "..", "..");
  const libraries = libs.length ? libs : declaredLibraries(repoRoot);
  const b = blockUnits(libraries);
  if (b.units.length === 0) {
    console.error(`UNKNOWN — no block could be read from ${libraries.length} library director(ies); nothing to index.`);
    process.exit(2);
  }
  const ix = buildLsi(b.units, BLOCK_INDEX_OPTIONS);
  const at = argv.indexOf("--near");
  const top = argv.includes("--top") ? Number(argv[argv.indexOf("--top") + 1]) : 10;
  if (at >= 0) {
    const text = argv[at + 1] ?? "";
    const hits = b.units.some((u) => u.id === text) ? neighboursOf(ix, text, top) : query(ix, text, top);
    for (const h of hits) console.log(`${h.cosine.toFixed(3)}  ${h.id}`);
    process.exit(0);
  }
  const summary = {
    libraries: libraries.map((l) => relative(repoRoot, l)),
    blocks: b.units.length,
    byKind: b.byKind,
    unreadable: b.unreadable.length,
    terms: ix.terms.length,
    k: ix.k,
    retained: Number(ix.retained.toFixed(4)),
    fingerprint: ix.fingerprint,
  };
  if (argv.includes("--json")) console.log(JSON.stringify({ ...summary, unreadableBlocks: b.unreadable.map((u) => ({ ...u, file: relative(repoRoot, u.file) })) }, null, 2));
  else {
    console.log(`${summary.blocks} block(s) indexed from ${libraries.length} librar(ies): ${Object.entries(b.byKind).map(([k, n]) => `${n} ${k}`).join(", ")}; ${summary.terms} terms, k=${summary.k}, retained ${(summary.retained * 100).toFixed(1)}%.`);
    if (b.unreadable.length) {
      console.log(`${b.unreadable.length} block(s) could not be read — the index covers less than the corpus:`);
      for (const u of b.unreadable.slice(0, 20)) console.log(`  ${relative(repoRoot, u.file)}: ${u.reason}`);
      if (b.unreadable.length > 20) console.log(`  … and ${b.unreadable.length - 20} more (--json lists all)`);
    }
  }
  process.exit(b.unreadable.length ? 1 : 0);
}
