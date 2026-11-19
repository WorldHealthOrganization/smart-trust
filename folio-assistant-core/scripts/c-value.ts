#!/usr/bin/env bun
/**
 * C-value candidate terms from prose: the scoring step of the
 * `automatic-term-extraction` method (cat-harness `methodologies/`).
 *
 * @module folio-assistant-core/scripts/c-value
 *
 * The measure is Frantzi & Ananiadou, "Extracting Nested Collocations",
 * COLING 1996 (`library/frantzi-ananiadou-1996-c-value`), §3:
 *
 * - `a` has the same frequency as the longer candidates that contain it → 0;
 * - `a` is in no longer candidate → `(|a| − 1) · n(a)` (eq. 2);
 * - otherwise → `(|a| − 1) · (n(a) − t(a) / c(a))` (eq. 3),
 *
 * where `n(a)` is the frequency of `a`, `t(a)` its total frequency inside
 * longer candidates and `c(a)` the number of those candidates. Strings are
 * visited from the longest down; each candidate with a C-value above 0 adds
 * `n(a) − t(a)` to `t(b)` and 1 to `c(b)` for every substring `b`. The test
 * reproduces the paper's Table 2 ("Wall Street") exactly.
 *
 * Every output is a CANDIDATE. Nothing here writes a glossary: a person
 * decides which candidates are terms (`glossary-terms`).
 *
 * ```sh
 * bun run folio-assistant-core/scripts/c-value.ts FILE.md [FILE.md ...] [--max-length 5] [--min-freq 3] [--top 50] [--edge-stopwords] [--json]
 * ```
 *
 * Without `--edge-stopwords` the output is the 1996 method as published, and
 * on prose its top candidates are function phrases ("it is", "rather than"):
 * the paper itself says many candidates "may seem unimportant" (§4). The
 * later C-value papers add linguistic filters; they are not held, so none is
 * applied by default.
 */
import { readFileSync } from "node:fs";

export interface CValueRow {
  /** The n-gram, words joined by single spaces. */
  term: string;
  length: number;
  /** n(a): how often it occurs, inside longer strings or not. */
  freq: number;
  /** t(a): its total frequency inside longer candidates. */
  nested: number;
  /** c(a): how many longer candidates contain it. */
  containers: number;
  cValue: number;
}

/** Every contiguous sub-sequence of `words` of length 2 up to `words.length - 1`. */
function substrings(words: string[]): string[] {
  const out = new Set<string>();
  for (let len = 2; len < words.length; len++) {
    for (let i = 0; i + len <= words.length; i++) out.add(words.slice(i, i + len).join(" "));
  }
  return [...out];
}

/**
 * C-value for every n-gram of length 2 or more in `freq` (n-gram → frequency),
 * by the 1996 algorithm. Returned longest first, then by C-value.
 */
export function cValues(freq: ReadonlyMap<string, number>): CValueRow[] {
  const t = new Map<string, number>();
  const c = new Map<string, number>();
  const grams = [...freq.keys()].filter((g) => g.split(" ").length >= 2);
  grams.sort((a, b) => b.split(" ").length - a.split(" ").length || a.localeCompare(b));
  const rows: CValueRow[] = [];
  for (const g of grams) {
    const words = g.split(" ");
    const n = freq.get(g)!;
    const ta = t.get(g) ?? 0;
    const ca = c.get(g) ?? 0;
    let cv: number;
    if (ca === 0) cv = (words.length - 1) * n;
    else if (ta >= n) cv = 0;
    else cv = (words.length - 1) * (n - ta / ca);
    rows.push({ term: g, length: words.length, freq: n, nested: ta, containers: ca, cValue: cv });
    if (cv > 0) {
      for (const b of substrings(words)) {
        if (!freq.has(b)) continue;
        t.set(b, (t.get(b) ?? 0) + (n - ta));
        c.set(b, (c.get(b) ?? 0) + 1);
      }
    }
  }
  return rows;
}

/**
 * Words of one text, lower-cased, split into runs that n-grams may not cross:
 * a sentence or clause ends at `. ; : ! ? ( ) [ ] ,` and at a blank line.
 * Markdown code spans and fenced blocks are dropped first.
 */
export function segments(text: string): string[][] {
  const prose = text.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/```[\s\S]*?```/g, "\n\n").replace(/`[^`\n]*`/g, " ");
  return prose
    .split(/[.;:!?()[\],]+|\n\s*\n/)
    .map((s) => s.toLowerCase().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [])
    .filter((w) => w.length > 0);
}

/** The articles the 1996 paper removed from the end of n-grams (§4, with a POS tagger; here, by list). */
export const ARTICLES = new Set(["a", "an", "the"]);

/**
 * Function words an n-gram may not begin or end with, under `edgeStopwords`.
 * Stopword removal is preprocessing the survey names (Tran et al., §5.1); this
 * list is a short English one chosen here, not taken from a source.
 */
export const STOPWORDS = new Set(
  "a an the and or but nor of in on at to for from by with as into onto over under about between through during is are was were be been being it its this that these those there here which who whom whose what when where why how not no do does did done has have had can could may might must shall should will would than then so such also only very more most less least each every any all some other another same own".split(" "),
);

export interface CountOptions {
  maxLength: number;
  minFreq: number;
  /** Drop n-grams whose last word is an article, as the paper did (§4). Default true. */
  trimArticles?: boolean;
  /** Drop n-grams that begin or end with a word in {@link STOPWORDS}. Default false. */
  edgeStopwords?: boolean;
}

/** n-gram frequencies over `texts`, lengths 2..maxLength, kept when at least `minFreq`. */
export function countNgrams(texts: string[], o: CountOptions): Map<string, number> {
  const all = new Map<string, number>();
  for (const text of texts) {
    for (const seg of segments(text)) {
      for (let len = 2; len <= o.maxLength; len++) {
        for (let i = 0; i + len <= seg.length; i++) {
          const g = seg.slice(i, i + len);
          if ((o.trimArticles ?? true) && ARTICLES.has(g[g.length - 1]!)) continue;
          if (o.edgeStopwords && (STOPWORDS.has(g[0]!) || STOPWORDS.has(g[g.length - 1]!))) continue;
          const k = g.join(" ");
          all.set(k, (all.get(k) ?? 0) + 1);
        }
      }
    }
  }
  return new Map([...all].filter(([, n]) => n >= o.minFreq));
}

/** Candidates ranked by C-value, zeros left out. */
export function rankCandidates(texts: string[], o: CountOptions): CValueRow[] {
  return cValues(countNgrams(texts, o))
    .filter((r) => r.cValue > 0)
    .sort((a, b) => b.cValue - a.cValue || a.term.localeCompare(b.term));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string, dflt: number): number => {
    const i = args.indexOf(name);
    if (i < 0) return dflt;
    const v = Number(args[i + 1]);
    if (!Number.isInteger(v) || v < 1) throw new Error(`${name} takes a whole number of 1 or more`);
    args.splice(i, 2);
    return v;
  };
  const maxLength = opt("--max-length", 5);
  const minFreq = opt("--min-freq", 3);
  const top = opt("--top", 50);
  const json = args.includes("--json");
  const edgeStopwords = args.includes("--edge-stopwords");
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error("usage: c-value.ts FILE [FILE ...] [--max-length 5] [--min-freq 3] [--top 50] [--edge-stopwords] [--json]");
    process.exit(2);
  }
  const rows = rankCandidates(files.map((f) => readFileSync(f, "utf-8")), { maxLength, minFreq, edgeStopwords }).slice(0, top);
  if (json) console.log(JSON.stringify({ status: "candidate", maxLength, minFreq, edgeStopwords, candidates: rows }, null, 2));
  else {
    console.log("| # | candidate | C-value | freq | nested in |\n|---|---|---|---|---|");
    rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.term} | ${r.cValue.toFixed(2)} | ${r.freq} | ${r.containers} |`));
  }
}
