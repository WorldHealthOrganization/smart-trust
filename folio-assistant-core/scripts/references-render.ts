#!/usr/bin/env bun
/**
 * references-render: write a document's References chapter from the KG
 * reference nodes its block cites, instead of typing it. The Tool
 * `references-render`.
 *
 * Owner, 2026-11-02 (card Q-REFKG-4, "A Build the renderer"):
 * *"folio-assistant-core renders a block's cited references; dth References
 * chapters generated from KG nodes."* And: *"each document should have a
 * bibliography page which includes referenced content in the document."*
 *
 * ## Which blocks
 *
 * A block is a reference list when its `.ts` says so in `meta`:
 *
 * ```ts
 * export default prose({
 *   label: "prose:references",
 *   cites: ["who-hrhis-mds-2015", "who-workforce-2030-2016"],
 *   meta: { referenceList: { style: "short", list: "bullet" } },
 * });
 * ```
 *
 * `cites` is the list, in the order printed; each key names a
 * `folio-reference/v1` node (`schemas/reference.ts`) in one of the layer's
 * own `references` directories. The block's `.md` sibling is the output: it
 * is generated whole, so nothing is typed in it.
 *
 * ## How an entry is printed
 *
 * - When the node has `printed`, that text, verbatim. It is how a committee's
 *   wording survives where no style reproduces it: the renderer never changes a
 *   word of a printed entry.
 * - Otherwise the block's `style`:
 *   - `who` (default): WHO style (Vancouver): `Authors. Title, edition. In:
 *     Container. Place: Publisher; Year (URL, accessed 15 October 2024).`, or
 *     for a journal article `Authors. Title. Journal. Year;Vol(Issue):Pages.
 *     doi:…`.
 *   - `short`: `Authors. Title. Year.`, the form a working draft's outline
 *     lists its sources in.
 *
 * `list` is `numbered` (default, `1. …`) or `bullet` (`- …`). `accessed:
 * false` leaves the access date out of each entry, for a document that states
 * it once for the whole list.
 *
 * `--check` writes nothing, and fails when a list on disk is not what its
 * nodes draw. Run it after editing a reference node: the chapter follows.
 *
 * Usage:
 *   bun run cat references:render --instance <dir> [--check]
 *
 * @module folio-assistant-core/scripts/references-render
 * @covers references, folio — it reads a layer's reference nodes and writes its reference-list blocks
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";

import { readDeclaration, resolveDirectories } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { loadBlockModule } from "@litlfred/cat-harness-tools/pipeline/block-module.ts";
import { ReferenceNodeSchema, type CslName, type ReferenceNode } from "../schemas/reference.ts";

export const TOOL_ID = "references-render";

/** `meta.referenceList` on a block: how its cited nodes are listed. */
export const ReferenceListOptionsSchema = z
  .object({
    style: z.enum(["who", "short"]).default("who"),
    list: z.enum(["numbered", "bullet"]).default("numbered"),
    /** WHO style prints each link's access date in the entry; `false` when the document says it once for the list. */
    accessed: z.boolean().default(true),
  })
  .strict();
export type ReferenceListOptions = z.infer<typeof ReferenceListOptionsSchema>;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** `s.` unless it already ends a sentence. */
const stop = (s: string): string => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** A WHO-style name: `Family Given`, or the literal. */
function whoName(n: CslName): string {
  return n.literal ?? [n.family, n.given].filter(Boolean).join(" ");
}

/** The names as WHO lists them: six, then `et al.`. */
function whoNames(names: readonly CslName[] | undefined): string | undefined {
  if (!names?.length) return undefined;
  const shown = names.slice(0, 6).map(whoName).join(", ");
  return names.length > 6 ? `${shown} et al` : shown;
}

function year(ref: ReferenceNode): string | undefined {
  const p = ref.issued?.["date-parts"]?.[0]?.[0];
  return p !== undefined && String(p).trim() ? String(p) : ref.issued?.literal ?? ref.issued?.raw;
}

/** `15 October 2024`, from a CSL `accessed` date, or undefined when it has no day. */
function accessedText(ref: ReferenceNode): string | undefined {
  const a = (ref as { accessed?: { "date-parts"?: Array<Array<number | string>> } }).accessed?.["date-parts"]?.[0];
  if (!a || a.length < 3) return undefined;
  const m = MONTHS[Number(a[1]) - 1];
  return m ? `${Number(a[2])} ${m} ${a[0]}` : undefined;
}

const str = (ref: ReferenceNode, k: string): string | undefined => {
  const v = (ref as Record<string, unknown>)[k];
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
};

/** One reference in WHO style. */
export function whoEntry(ref: ReferenceNode, opts: { accessed?: boolean } = {}): string {
  const parts: string[] = [];
  const authors = whoNames(ref.author);
  const editors = whoNames(ref.editor);
  if (authors) parts.push(stop(authors));
  else if (editors) parts.push(`${editors}, ${ref.editor!.length > 1 ? "editors" : "editor"}.`);
  const edition = str(ref, "edition");
  if (ref.title) parts.push(stop(edition ? `${ref.title}, ${edition}` : ref.title));
  const y = year(ref);
  const accessed = opts.accessed === false ? undefined : accessedText(ref);
  if (ref.type === "article-journal" && ref["container-title"]) {
    let where = `${ref["container-title"]}. ${y ?? ""}`;
    if (ref.volume !== undefined) where += `;${ref.volume}${ref.issue !== undefined ? `(${ref.issue})` : ""}`;
    if (ref.page) where += `:${ref.page}`;
    parts.push(stop(where));
    if (ref.DOI) parts.push(`doi:${ref.DOI}.`);
    else if (ref.URL) parts.push(`(${ref.URL}${accessed ? `, accessed ${accessed}` : ""}).`);
    return parts.join(" ");
  }
  if (ref["container-title"]) parts.push(stop(`In: ${ref["container-title"]}`));
  const place = str(ref, "publisher-place");
  const pub = [place && ref.publisher ? `${place}: ${ref.publisher}` : ref.publisher ?? place, y].filter(Boolean).join("; ");
  const link = ref.URL ? ` (${ref.URL}${accessed ? `, accessed ${accessed}` : ""})` : "";
  if (pub || link) parts.push(`${pub}${link}.`.trimStart());
  return parts.join(" ");
}

/** One reference in the short form: `Authors. Title. Year.` */
export function shortEntry(ref: ReferenceNode): string {
  const authors = (ref.author ?? []).map(whoName);
  const y = year(ref);
  return [authors.length ? stop(authors.join(", ")) : undefined, ref.title ? stop(ref.title) : undefined, y ? `${y}.` : undefined]
    .filter(Boolean)
    .join(" ");
}

/** The text a reference list prints for one node: its `printed` text, or the style's. */
export function entryText(ref: ReferenceNode, opts: Partial<ReferenceListOptions> = {}): string {
  if (ref.printed !== undefined) return ref.printed;
  return opts.style === "short" ? shortEntry(ref) : whoEntry(ref, opts);
}

/** The whole list, as the block's `.md` holds it. */
export function renderReferenceList(refs: readonly ReferenceNode[], opts: Partial<ReferenceListOptions> = {}): string {
  const o = ReferenceListOptionsSchema.parse(opts);
  return refs.map((r, i) => `${o.list === "bullet" ? "-" : `${i + 1}.`} ${entryText(r, o)}`).join("\n") + "\n";
}

/** Every reference node in the layer's own `references` directories, by key. */
export function referenceNodesOf(instanceRoot: string): Map<string, { ref: ReferenceNode; file: string }> {
  const decl = readDeclaration(instanceRoot);
  if (!decl) throw new Error(`${instanceRoot}: no cat-harness declaration`);
  const out = new Map<string, { ref: ReferenceNode; file: string }>();
  for (const d of resolveDirectories([{ name: decl.name, root: instanceRoot, own: true }]).filter((d) => d.own)) {
    if (!(d.graphTypologies ?? []).includes("references") || !existsSync(d.absPath)) continue;
    for (const f of readdirSync(d.absPath).filter((f) => f.endsWith(".json")).sort()) {
      const file = join(d.absPath, f);
      const r = ReferenceNodeSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!r.success) throw new Error(`${relative(instanceRoot, file)}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      if (out.has(r.data.id)) throw new Error(`reference key "${r.data.id}" is claimed by ${relative(instanceRoot, out.get(r.data.id)!.file)} and ${relative(instanceRoot, file)}`);
      out.set(r.data.id, { ref: r.data, file });
    }
  }
  return out;
}

/** The `.ts` files under the layer's own folio directories that mention `referenceList`. */
function candidateBlocks(instanceRoot: string): string[] {
  const decl = readDeclaration(instanceRoot)!;
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && readFileSync(p, "utf8").includes("referenceList")) out.push(p);
    }
  };
  for (const d of resolveDirectories([{ name: decl.name, root: instanceRoot, own: true }]).filter((d) => d.own)) {
    if ((d.graphTypologies ?? []).includes("folio") && existsSync(d.absPath)) walk(d.absPath);
  }
  return out.sort();
}

/** Each reference-list block of the layer, and the `.md` it should hold. */
export async function referenceListsOf(instanceRoot: string): Promise<Array<{ block: string; md: string; content: string }>> {
  const nodes = referenceNodesOf(instanceRoot);
  const out: Array<{ block: string; md: string; content: string }> = [];
  for (const ts of candidateBlocks(instanceRoot)) {
    const loaded = await loadBlockModule(ts);
    const meta = loaded?.block.meta as Record<string, unknown> | undefined;
    if (!loaded || meta?.referenceList === undefined) continue;
    const block = relative(instanceRoot, ts);
    const opts = ReferenceListOptionsSchema.safeParse(meta.referenceList);
    if (!opts.success) throw new Error(`${block}: meta.referenceList: ${opts.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    const cites = (loaded.block.cites as string[] | undefined) ?? [];
    if (cites.length === 0) throw new Error(`${block}: a reference list cites nothing; list its references in \`cites\``);
    const missing = cites.filter((k) => !nodes.has(k));
    if (missing.length) throw new Error(`${block}: cites ${missing.map((k) => `"${k}"`).join(", ")}, which no reference node of this instance holds`);
    out.push({ block, md: block.replace(/\.ts$/, ".md"), content: renderReferenceList(cites.map((k) => nodes.get(k)!.ref), opts.data) });
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const root = resolve(arg("instance") ?? ".");
  const check = process.argv.includes("--check");
  const lists = await referenceListsOf(root);
  let stale = 0;
  for (const o of lists) {
    const p = join(root, o.md);
    if (existsSync(p) && readFileSync(p, "utf8") === o.content) continue;
    if (check) {
      stale++;
      console.log(`✗ ${o.md} is not what its reference nodes draw; run references:render to rewrite it`);
    } else {
      writeFileSync(p, o.content);
      console.error(`wrote ${o.md}`);
    }
  }
  if (check && stale === 0) console.log(`✓ ${lists.length} reference list(s) match their reference nodes`);
  if (stale) process.exit(1);
}
