/**
 * Acronyms in prose, and whether a glossary a folio can see already holds
 * them (owner, 2026-10-31: "make QA review identify acronyms for potential
 * inclusion"). The rule is here; the per-block QA checker is
 * `pipeline/qa-checkers-acronyms.ts` and the folio-wide report is
 * `scripts/glossary-acronyms.ts`.
 *
 * An acronym found here is a CANDIDATE for the glossary. Nothing is added to a
 * glossary by this module: a person decides, as for every candidate term
 * (bean `lqo9`).
 *
 * @graphNode none — functions that find acronyms in prose; no schema
 * @module folio-assistant-core/schemas/acronyms
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

import { GlossarySchema, type LangText } from "./glossary.ts";

/** A token is at most this many characters, so an all-capitals heading word is not read as one. */
const MAX_LEN = 10;
const ROMAN = /^[IVXLCDM]+$/;

/**
 * Whether a token reads as an acronym: two or more capitals, and capitals are
 * at least half of its letters (`WHO`, `GS1`, `eLMIS`, `OpenHIE`, `WHODrug`,
 * `ICD-11`), but not `McDonald` or a Roman numeral.
 */
export function isAcronym(token: string): boolean {
  if (token.length < 2 || token.length > MAX_LEN) return false;
  if (ROMAN.test(token) || isCode(token)) return false;
  const letters = token.replace(/[^A-Za-z]/g, "");
  const caps = letters.replace(/[^A-Z]/g, "").length;
  return caps >= 2 && caps * 2 >= letters.length;
}

/**
 * A folio's own identifiers, not acronyms: `PC-R-05`, `PC-BP-01` (two or
 * more hyphens before a number) and `MFR001` (three or more trailing digits).
 * `ICD-11` and `ITU-T` stay acronyms.
 */
export function isCode(token: string): boolean {
  return /^[A-Z]+(-[A-Z]+)+-\d+$/.test(token) || /\d{3,}$/.test(token);
}

/** `GTINs` is `GTIN`, `FAQs` is `FAQ`: a plural is counted under its singular. */
export function singular(token: string): string {
  return /^[A-Z0-9&-]{2,}s$/.test(token) ? token.slice(0, -1) : token;
}

/**
 * The words of a text that are not written in capitals, lower-cased. An
 * all-capitals token of four or more letters whose lower-case form is among
 * them (`RESOURCES` beside "resources", `RWANDA` beside "Rwanda") is a word
 * set in capitals, such as a figure label, and not an acronym. Shorter ones
 * are too often real acronyms (`WHO` beside "who") for that test, so only
 * English function words are dropped: {@link SHOUTED_SHORT}.
 */
export function lowerWords(md: string): Set<string> {
  return new Set((proseOf(md).match(/\b[A-Za-z]*[a-z][A-Za-z]*\b/g) ?? []).filter((w) => w.length >= 4).map((w) => w.toLowerCase()));
}

/** Short English words that a capitalised heading spells, and that are never this handbook's acronyms. */
export const SHOUTED_SHORT = new Set(["OF", "IN", "OR", "IS", "TO", "ON", "AT", "BY", "AN", "AS", "BE", "THE", "AND", "FOR", "USE", "SET", "NEW", "ALL", "NOT", "ARE", "WITH"]);

/** Whether `token` is a word written in capitals, given the text's other words. */
export function isShouted(token: string, words: ReadonlySet<string>): boolean {
  return SHOUTED_SHORT.has(token) || (/^[A-Z]{4,}$/.test(token) && words.has(token.toLowerCase()));
}

/** Markdown that is not prose: code, link targets, HTML tags, autolinks. */
function proseOf(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
}

const TOKEN = /(?<![\w&-])[A-Za-z][A-Za-z0-9&]*(?:-[A-Za-z0-9]+)*(?![\w&])/g;

export interface AcronymHit {
  acronym: string;
  line: number;
}

/**
 * Every acronym in a Markdown text, with its 1-based line, in order, plurals
 * under their singular. `words` are lower-case words that mark an
 * all-capitals token as a shouted word (default: the text's own).
 */
export function findAcronyms(md: string, words: ReadonlySet<string> = lowerWords(md)): AcronymHit[] {
  const out: AcronymHit[] = [];
  proseOf(md)
    .split("\n")
    .forEach((text, i) => {
      for (const m of text.matchAll(TOKEN)) {
        const a = singular(m[0]);
        if (isAcronym(a) && !isShouted(a, words)) out.push({ acronym: a, line: i + 1 });
      }
    });
  return out;
}

/**
 * Expansions the text itself gives, as "Long Name (ACR)": the shortest run
 * of words before the parenthesis that starts with the acronym's first
 * letter. A guess for a person to check, never a definition.
 */
export function inlineExpansions(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const text = proseOf(md).replace(/\s+/g, " ");
  for (const m of text.matchAll(/\(\s*([A-Za-z][A-Za-z0-9&-]*)\s*\)/g)) {
    const acr = m[1]!;
    if (!isAcronym(singular(acr)) || out.has(singular(acr))) continue;
    const words = text.slice(Math.max(0, m.index! - 200), m.index!).trim().split(" ");
    const letters = acr.replace(/[^A-Za-z]/g, "").length;
    for (let n = 1; n <= Math.min(words.length, letters + 3); n++) {
      const w = words[words.length - n]!;
      if (/[|*]/.test(w)) break;
      if (w[0]?.toLowerCase() === acr[0]!.toLowerCase() && /^[A-Z]/.test(w)) {
        out.set(singular(acr), words.slice(words.length - n).join(" ").replace(/[,;:]$/, ""));
        break;
      }
    }
  }
  return out;
}

/**
 * The rows of every Markdown table whose first header cell says
 * "Abbreviation" or "Acronym": a handbook's own list, read as-is.
 */
export function abbreviationTable(md: string): Map<string, string> {
  const out = new Map<string, string>();
  let inTable = false;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (/^(abbreviations?|acronyms?)$/i.test(cells[0] ?? "")) {
      inTable = true;
      continue;
    }
    if (!inTable || /^:?-+:?$/.test(cells[0] ?? "")) continue;
    if (cells[0] && cells[1]) out.set(cells[0], cells[1]);
  }
  return out;
}

function texts(t: LangText): string[] {
  return typeof t === "string" ? [t] : Object.values(t);
}

/**
 * The labels every glossary a file can see holds: `notation`, `prefLabel`
 * and `altLabel` of each term. A glossary is visible when it sits in a
 * `glossary/` directory of an ancestor of the file, or of a direct child of
 * that ancestor (a mounted layer, such as `dpi-h-ra/glossary/`).
 */
export function visibleLabels(file: string): Set<string> {
  const labels = new Set<string>();
  const dirs = new Set<string>();
  for (let d = dirname(resolve(file)); ; d = dirname(d)) {
    const here = join(d, "glossary");
    if (existsSync(here)) {
      dirs.add(here);
      for (const child of readdirSync(d)) {
        const g = join(d, child, "glossary");
        if (!child.startsWith(".") && child !== "node_modules" && existsSync(g)) dirs.add(g);
      }
    }
    if (d === parse(d).root) break;
  }
  for (const dir of dirs) {
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".glossary.json"))) {
      const parsed = GlossarySchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
      if (!parsed.success) continue;
      for (const t of parsed.data.terms) {
        if (t.notation) labels.add(t.notation);
        texts(t.prefLabel).forEach((x) => labels.add(x));
        (t.altLabel ?? []).forEach((x) => labels.add(x));
      }
    }
  }
  return labels;
}

/** The acronyms in `hits` that no label in `labels` names, each once, with its first line. */
export function missingAcronyms(hits: readonly AcronymHit[], labels: ReadonlySet<string>): AcronymHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (labels.has(h.acronym) || seen.has(h.acronym)) return false;
    seen.add(h.acronym);
    return true;
  });
}

const wordCache = new Map<string, Set<string>>();

function mdUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...mdUnder(p));
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/**
 * The lower-case words of the whole folio a file is in: every Markdown file
 * under `folio/` of the nearest ancestor that has a `glossary/`, read once
 * per folio. So a figure's `RESOURCES` is known as a word when the prose
 * anywhere says "resources".
 */
export function folioWords(file: string): Set<string> {
  for (let d = dirname(resolve(file)); ; d = dirname(d)) {
    if (existsSync(join(d, "glossary"))) {
      const folio = folioDir(d);
      const top = existsSync(folio) ? folio : d;
      let words = wordCache.get(top);
      if (!words) {
        words = new Set<string>();
        for (const f of mdUnder(top)) for (const w of lowerWords(readFileSync(f, "utf-8"))) words.add(w);
        wordCache.set(top, words);
      }
      return words;
    }
    if (d === parse(d).root) return new Set();
  }
}
