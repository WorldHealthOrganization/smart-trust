/**
 * library-keywords — keywords for every section and every document of every
 * declared library, from the LSI term weights (log-entropy: frequent here,
 * rare across the corpus).
 *
 * Per library root, the units are exactly the LSI tool's (`unitsOf` in
 * `scripts/lsi.ts`: one per `sections/*.md`, specimen pages excluded), and the
 * matrix is `buildTermMatrix` — one vocabulary, one weighting, shared with
 * the index. Per entry it writes `library/<slug>/keywords.json`
 * (`folio-keywords/v1`):
 *
 * - `document` — up to 12, pooled over the entry's sections;
 * - `sections.<id>` — up to 8 per section (none for a section under the LSI
 *   tool's minimum length, which the index does not take either);
 * - `evidence` on each keyword: `heading` when every word of it appears in a
 *   heading the extraction found — the section's own title for a section
 *   keyword, any TOC title or figure caption for a document keyword.
 *
 * ## Built at publish, outside the ingest record (cat-harness#1144)
 *
 * The owner (2026-11-08): keywords are EXTRACTED content, so they do not live
 * in the original ingest record. The writer no longer touches
 * `library/<slug>/`; it writes the derived keywords graph
 * (`folio-keywords/v2`, {@link keywordsGraphs}) to
 * `<site>/assets/keywords/<instance>/<slug>.jsonld`, one node per entry linked
 * to it by `about`, plus an `index.json` of every node. The route is declared
 * `builtAtPublish`, so `--check` has nothing committed to compare. Readers
 * (the library viewer, the keyword viewer) compute the same graph in memory
 * rather than depend on the write order. A committed `keywords.json` from
 * before the move is LEGACY: the `library-keywords` health check lists each
 * one for removal.
 *
 * Every node is keyed by VARIANT ({@link KEYWORD_VARIANTS}), so methods can
 * be compared side by side; today there is one, the weighting the LSI index
 * uses, scored on the surface matrix.
 *
 * Usage: bun run cat library:keywords [--site <dir>] [--check]
 *
 * @covers library
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { buildLsi, buildTermMatrix, keywordsOf, latentTermScores, tokenize, type Keyword, type KeywordScoring, type LsiUnit, type TermMatrix } from "../pipeline/lsi.ts";
import { buildCa } from "../pipeline/ca.ts";
import { readStructure } from "../schemas/content/document-structure.ts";
import {
  KEYWORDS_FILE,
  KEYWORDS_GRAPH_DIR,
  KEYWORDS_GRAPH_SCHEMA_ID,
  type KeywordVariant,
  type KeywordsGraph,
  type ScoredKeyword,
} from "../schemas/library/library-keywords.ts";
import { baseDocsDir } from "./compose-docs.js";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { siteTarget } from "./lib/site-target.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { libraryEntryDir, libraryOfEntry } from "./lib/library-entry-graphs.ts";
export { KEYWORDS_FILE };
import type { PdfStructure } from "../schemas/ui/pdf-structure.ts";
import { readLibraryGraph } from "./library-graph.ts";
import { unitsOf } from "./lsi.ts";

const ROOT = resolve(dirname(HARNESS_ROOT));
export const DOC_TOP = 12;
export const SECTION_TOP = 8;

/** Does every word of `term` appear among the tokens of `text`? */
export function namedBy(term: string, text: string): boolean {
  const toks = new Set(tokenize(text));
  return term.split(" ").every((w) => toks.has(w));
}

function withEvidence(ks: Keyword[], headings: string[]): ScoredKeyword[] {
  return ks.map((k) => ({ ...k, evidence: headings.some((h) => namedBy(k.term, h)) ? ["heading" as const] : [] }));
}

/**
 * The variants every node carries, in display order (owner, 2026-11-08: compare
 * LSI keyword algorithms, option B — the weighting × space grid plus
 * correspondence analysis). The first is the default the library viewer shows,
 * and the keywords this platform wrote before the comparison.
 *
 * - `surface`: the weighted term matrix itself; a keyword is a word the text uses.
 * - `latent`: the rank-k reconstruction (Deerwester et al. 1990); a keyword may
 *   be a word the text never uses but its co-occurrence structure implies.
 * - `latent-rerank`: latent scores, restricted to words the text uses.
 * - CA: the reconstituted departure from independence (Qi et al. 2023), with
 *   length and frequency margins removed.
 */
export const LATENT_K = 100;
/** How many top latent terms a unit's keywords are chosen from. */
const LATENT_CANDIDATES = 300;
export const KEYWORD_VARIANTS: readonly KeywordVariant[] = [
  { id: "lsi-log-entropy-surface", method: "lsi", weighting: "log-entropy", space: "surface" },
  { id: "lsi-tfidf-surface", method: "lsi", weighting: "tfidf", space: "surface" },
  { id: "lsi-log-entropy-latent", method: "lsi", weighting: "log-entropy", space: "latent", k: LATENT_K },
  { id: "lsi-tfidf-latent", method: "lsi", weighting: "tfidf", space: "latent", k: LATENT_K },
  { id: "lsi-log-entropy-latent-rerank", method: "lsi", weighting: "log-entropy", space: "latent-rerank", k: LATENT_K },
  { id: "ca-latent", method: "correspondence-analysis", weighting: "raw", space: "latent", k: LATENT_K },
];

/** One entry's keywords in every variant, before it is a graph node. */
export interface EntryKeywords {
  corpus: { library: string; sections: number; terms: number };
  document: Record<string, ScoredKeyword[]>;
  sections: Record<string, Record<string, ScoredKeyword[]>>;
}

/** A variant's scorer: the matrix its phrases are read from, and the scores for a set of units. */
interface Scorer {
  m: TermMatrix;
  opts: (cols: number[], headings: string[]) => KeywordScoring;
}

function scorers(units: LsiUnit[], variants: readonly KeywordVariant[]): Map<string, Scorer> {
  const matrices = new Map<string, TermMatrix>();
  const matrix = (w: KeywordVariant["weighting"]): TermMatrix => {
    if (!matrices.has(w)) matrices.set(w, buildTermMatrix(units, { weighting: w }));
    return matrices.get(w)!;
  };
  const out = new Map<string, Scorer>();
  for (const v of variants) {
    if (v.space === "surface") {
      out.set(v.id, { m: matrix(v.weighting), opts: () => ({}) });
      continue;
    }
    const index = v.method === "correspondence-analysis" ? buildCa(units, { k: v.k ?? LATENT_K }) : buildLsi(units, { weighting: v.weighting, k: v.k ?? LATENT_K });
    // Phrases and the words a text uses are read from a weighted matrix; CA's
    // own is raw counts, so its phrases come from the log-entropy matrix, by term.
    const m = matrix(v.method === "correspondence-analysis" ? "log-entropy" : v.weighting);
    const row = new Map(m.terms.map((t, i) => [t, i]));
    const remap = index.terms === m.terms ? undefined : index.terms.map((t) => row.get(t));
    const anyTerm = v.space === "latent";
    const back = remap ? new Map(remap.flatMap((r, i) => (r === undefined ? [] : [[r, i] as [number, number]]))) : undefined;
    out.set(v.id, {
      m,
      opts: (cols, headings) => {
        // A re-rank scores only the words the units use (their rows in `m`)
        // and the words their headings name, which may not be in the body;
        // a latent variant takes the top few hundred of the whole vocabulary.
        let rows: number[] | undefined;
        if (!anyTerm) {
          const seen = new Set<number>();
          for (const j of cols) for (let p = m.A.colPtr[j]; p < m.A.colPtr[j + 1]; p++) seen.add(m.A.rowIdx[p]);
          for (const w of headings.flatMap((h) => tokenize(h))) if (row.has(w)) seen.add(row.get(w)!);
          rows = [...seen].flatMap((r) => (back ? (back.has(r) ? [back.get(r)!] : []) : [r]));
        }
        const raw = latentTermScores(index, cols, rows ? { rows } : { top: LATENT_CANDIDATES });
        if (!remap) return { scores: raw, anyTerm };
        const scores = new Map<number, number>();
        for (const [i, w] of raw) {
          const r = remap[i];
          if (r !== undefined) scores.set(r, w);
        }
        return { scores, anyTerm };
      },
    });
  }
  return out;
}

/** Every entry's keywords under one library root, in every variant. */
export function libraryKeywords(libRoot: string, repoRoot = ROOT, variants: readonly KeywordVariant[] = KEYWORD_VARIANTS): Map<string, EntryKeywords> {
  const units = unitsOf(libRoot, ["library"]);
  const out = new Map<string, EntryKeywords>();
  if (units.length < 3) return out;
  const score = scorers(units, variants);
  const terms = score.get(variants[0]!.id)!.m.terms.length;
  const libRel = relative(repoRoot, libRoot);
  // Column indices per entry, and per section id.
  const bySlug = new Map<string, { cols: number[]; sections: Map<string, number> }>();
  units.forEach((u, j) => {
    // [<group>/]<slug>/sections/<id>.md — filed in a concern group or not (bean `6fez`).
    const rel = relative(libRel, u.id).split("/");
    const slug = rel[rel.length - 3];
    const sid = rel[rel.length - 1].replace(/\.md$/, "");
    const e = bySlug.get(slug) ?? { cols: [] as number[], sections: new Map<string, number>() };
    e.cols.push(j);
    e.sections.set(sid, j);
    bySlug.set(slug, e);
  });
  for (const [slug, e] of bySlug) {
    // Headings through the shared accessor (bean rkqp). No structure, or
    // one that will not read, means no heading evidence — never no keywords.
    const read = readStructure(libraryEntryDir(libRoot, slug) ?? join(libRoot, slug));
    const structure = "reason" in read ? undefined : read;
    const titleOf = new Map<string, string>((structure?.sections ?? []).map((s) => [s.id, s.title]));
    const raw = structure?.variant === "pdf" ? (structure.raw as PdfStructure) : undefined;
    const docHeadings: string[] = [
      ...(raw?.toc ?? []).map((t) => t.title),
      ...(raw?.figures ?? []).map((f) => f.title),
      ...(raw ? [] : [...titleOf.values()]),
    ];
    const sections: Record<string, Record<string, ScoredKeyword[]>> = {};
    const document: Record<string, ScoredKeyword[]> = {};
    for (const v of variants) {
      const sc = score.get(v.id)!;
      for (const [sid, j] of [...e.sections].sort(([a], [b]) => a.localeCompare(b))) {
        const own = titleOf.has(sid) ? [titleOf.get(sid)!] : [];
        (sections[sid] ??= {})[v.id] = withEvidence(keywordsOf(sc.m, [j], [units[j].text], SECTION_TOP, own, sc.opts([j], own)), own);
      }
      document[v.id] = withEvidence(keywordsOf(sc.m, e.cols, e.cols.map((j) => units[j].text), DOC_TOP, [], sc.opts(e.cols, [])), docHeadings);
    }
    out.set(slug, { corpus: { library: libRel, sections: units.length, terms }, document, sections });
  }
  return out;
}

/** One library entry, as the library graph names it. */
export interface EntryRef {
  id: string;
  instance: string;
  dir: string;
}

export function entriesOf(repoRoot: string): EntryRef[] {
  // Discovery starts from the cat-harness declaration, as gen-library-viz does.
  const g = readLibraryGraph([join(repoRoot, "cat-harness"), repoRoot], repoRoot);
  return (g?.entries ?? []).map((e) => ({ id: e.id, instance: e.instance, dir: e.dir }));
}

/**
 * The derived keywords graph: one `folio-keywords/v2` node per library entry
 * that has keywords, under `within` when given. Writes nothing.
 */
export function keywordsGraphs(within?: string, repoRoot = ROOT, variants: readonly KeywordVariant[] = KEYWORD_VARIANTS): KeywordsGraph[] {
  const entries = entriesOf(repoRoot).filter((e) => {
    const abs = join(repoRoot, e.dir);
    return within === undefined || abs === resolve(within) || abs.startsWith(resolve(within) + "/");
  });
  // The LIBRARY each entry is in, not its parent: a filed entry's parent is a
  // concern group (bean `6fez`), and weighting keywords over one group alone
  // would change every entry's scores.
  const byRoot = new Map<string, EntryRef[]>();
  for (const e of entries) {
    const root = libraryOfEntry(join(repoRoot, e.dir));
    byRoot.set(root, [...(byRoot.get(root) ?? []), e]);
  }
  const out: KeywordsGraph[] = [];
  for (const [root, es] of [...byRoot].sort(([a], [b]) => a.localeCompare(b))) {
    const kws = libraryKeywords(root, repoRoot, variants);
    for (const e of es.sort((a, b) => a.id.localeCompare(b.id))) {
      const k = kws.get(e.id);
      if (k === undefined) continue;
      out.push({
        $schema: KEYWORDS_GRAPH_SCHEMA_ID,
        "@type": "cat-harness:DerivedKeywords",
        entry: e.id,
        instance: e.instance,
        about: `library/${e.id}`,
        corpus: k.corpus,
        variants: [...variants],
        document: k.document,
        sections: k.sections,
      });
    }
  }
  return out;
}

/** One entry's keywords, for the health check: how many, and whether a legacy committed file is still there. */
export interface KeywordsState {
  /** The entry's directory, relative to the repository root. */
  entry: string;
  /** Document keywords in the default variant; 0 is an entry the extraction gave nothing. */
  keywords: number;
  /** A `keywords.json` still committed inside the entry — the pre-#1144 location. */
  legacy: boolean;
}

/** Every library entry under `within`, with its keyword count and legacy-file state. Writes nothing. */
export function keywordsStates(within?: string, repoRoot = ROOT): { libraries: number; entries: KeywordsState[] } {
  const all = entriesOf(repoRoot).filter((e) => {
    const abs = join(repoRoot, e.dir);
    return within === undefined || abs === resolve(within) || abs.startsWith(resolve(within) + "/");
  });
  // The default variant only: the count is the question, not the comparison.
  const graphs = new Map(keywordsGraphs(within, repoRoot, KEYWORD_VARIANTS.slice(0, 1)).map((g) => [`${g.instance}/${g.entry}`, g]));
  const v = KEYWORD_VARIANTS[0]!.id;
  const libraries = new Set(all.map((e) => libraryOfEntry(join(repoRoot, e.dir)))).size;
  const entries = all
    .map((e) => ({
      entry: e.dir,
      keywords: graphs.get(`${e.instance}/${e.id}`)?.document[v]?.length ?? 0,
      legacy: existsSync(join(repoRoot, e.dir, KEYWORDS_FILE)),
    }))
    .sort((a, b) => a.entry.localeCompare(b.entry));
  return { libraries, entries };
}

/** Where a node is written, relative to the site's base docs directory. */
export function keywordsGraphPath(g: Pick<KeywordsGraph, "instance" | "entry">): string {
  return `${KEYWORDS_GRAPH_DIR}/${encodeURIComponent(g.instance)}/${encodeURIComponent(g.entry)}.jsonld`;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const harnessRoot = join(ROOT, "cat-harness");
  const docsBase = siteTarget(baseDocsDir(ROOT));
  const builtHere =
    !process.argv.includes("--site") &&
    isBuiltAtPublish(readDeclaration(harnessRoot)?.builtAtPublish ?? [], relative(harnessRoot, join(baseDocsDir(ROOT), KEYWORDS_GRAPH_DIR) + "/").split("\\").join("/"));
  if (check && builtHere) {
    console.log(`library:keywords: ${KEYWORDS_GRAPH_DIR}/ is built at publish (builtAtPublish), not committed — nothing to compare; \`bun run cat library:keywords\` writes it`);
    process.exit(0);
  }
  const graphs = keywordsGraphs();
  const files = new Map<string, string>(graphs.map((g) => [keywordsGraphPath(g), JSON.stringify(g, null, 2) + "\n"]));
  files.set(
    `${KEYWORDS_GRAPH_DIR}/index.json`,
    JSON.stringify({ $schema: "folio-keywords-index/v1", variants: KEYWORD_VARIANTS, nodes: graphs.map((g) => ({ instance: g.instance, entry: g.entry, href: keywordsGraphPath(g) })) }, null, 2) + "\n",
  );
  if (check) {
    const stale = [...files].filter(([p, t]) => !existsSync(join(docsBase, p)) || readFileSync(join(docsBase, p), "utf8") !== t);
    for (const [p] of stale) console.error(`  ✗ ${p} is missing or stale`);
    console.log(stale.length ? `${stale.length} keywords node(s) stale — run \`bun run cat library:keywords\`` : `${graphs.length} keywords node(s) current`);
    process.exit(stale.length ? 1 : 0);
  }
  // The directory is this writer's alone: cleared first, so an entry removed
  // or renamed leaves no node behind.
  rmSync(join(docsBase, KEYWORDS_GRAPH_DIR), { recursive: true, force: true });
  for (const [p, t] of files) {
    mkdirSync(dirname(join(docsBase, p)), { recursive: true });
    writeFileSync(join(docsBase, p), t);
  }
  console.log(`library:keywords: ${graphs.length} keywords node(s) → ${relative(ROOT, join(docsBase, KEYWORDS_GRAPH_DIR))}/ (built at publish; nothing written inside any entry)`);
}
