/**
 * The keyword viewer page (cat-harness#1144, owner 2026-11-08, card "B"):
 * the derived keywords graph read back as a back-of-book index, with the six
 * variants side by side and how well each agrees with three references.
 *
 * @module cat-harness-tools/scripts/lib/keywords-page
 *
 * The references, each a different kind of evidence of what a text is about:
 *
 * - **Headings**: a section keyword its own heading names (`evidence:
 *   ["heading"]`). The document saying it of itself.
 * - **Author keywords**: the "Keywords:" or "Index Terms" line an author put
 *   in the text. Ingestion records no PDF metadata keywords, so this line is
 *   the author-supplied list we hold.
 * - **Glossary**: a keyword that is the label of a term in a glossary of the
 *   checkout. A glossary holds formal definitions; a keyword is not one, so
 *   this measures overlap, not correctness.
 *
 * Pure: {@link keywordsPage} draws a {@link KeywordsPageModel} and reads
 * nothing; {@link keywordsPageModel} reads the checkout.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { instanceDirectoriesForGraph, layerRootsIn } from "../../schemas/kg/cat-harness.ts";
import { tokenize } from "../../pipeline/lsi.ts";
import type { KeywordVariant, KeywordsGraph, ScoredKeyword } from "../../schemas/library/library-keywords.ts";
import type { LibraryLinks, LibraryResolver } from "./library-links.ts";
import { schemeSourceLanguage, sourceText, sourceTexts } from "../../schemas/content/lang-text.ts";

/** One entry, reduced to what the page draws. */
export interface KeywordsPageEntry {
  instance: string;
  entry: string;
  /** The entry's page, relative to the keyword page; absent when not published. */
  href?: string;
  document: Record<string, ScoredKeyword[]>;
  sections: Record<string, Record<string, ScoredKeyword[]>>;
  /** The author's own keywords, from a "Keywords:" or "Index Terms" line; empty when none. */
  author: string[];
}

export interface KeywordsPageModel {
  variants: KeywordVariant[];
  entries: KeywordsPageEntry[];
  /** Glossary labels, normalised by {@link norm}. */
  glossary: Set<string>;
  /** The glossary files the labels came from, relative to the checkout. */
  glossaryFiles: string[];
}

/** A term as the index sees it: its tokens, in order. "Evidence Reviews" and "evidence review" agree. */
export function norm(term: string): string {
  return tokenize(term).join(" ");
}

const AUTHOR_LINE = /^\s*\**\s*(?:keywords|key words|index terms)\s*\**\s*[:—–-]+\s*(.+)$/im;

/** The author's keywords in one text, or none. */
export function authorKeywords(text: string): string[] {
  const m = AUTHOR_LINE.exec(text);
  if (!m) return [];
  return m[1]!
    .split(/[,;·•]/)
    .map((s) => s.replace(/[.\s]+$/, "").trim())
    .filter((s) => s.length > 1 && s.length < 80);
}

/** Does keyword `k` name author keyword `a`: every token of `k` is a token of `a`? */
function names(k: string, a: string): boolean {
  const at = new Set(a.split(" "));
  const kt = k.split(" ").filter(Boolean);
  return kt.length > 0 && kt.every((t) => at.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}

const mean = (xs: number[]): number | undefined => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
const pct = (x: number | undefined): string => (x === undefined ? "—" : `${Math.round(100 * x)}%`);

/** Every variant's agreement with each reference, and with every other variant. */
export interface Agreement {
  /** variant id → mean share of section keywords their heading names. */
  heading: Map<string, number | undefined>;
  /** variant id → share of author keywords some document keyword names, over entries with an author line. */
  author: Map<string, number | undefined>;
  /** variant id → mean share of document keywords that are a glossary label. */
  glossary: Map<string, number | undefined>;
  /** `a|b` → mean Jaccard overlap of the two variants' document keywords. */
  pairs: Map<string, number | undefined>;
  /** How many entries carry an author keyword line. */
  authorEntries: number;
}

export function agreement(model: KeywordsPageModel): Agreement {
  const ids = model.variants.map((v) => v.id);
  const terms = (ks: ScoredKeyword[] | undefined) => new Set((ks ?? []).map((k) => norm(k.term)));
  const out: Agreement = { heading: new Map(), author: new Map(), glossary: new Map(), pairs: new Map(), authorEntries: model.entries.filter((e) => e.author.length).length };
  for (const v of ids) {
    const h: number[] = [];
    for (const e of model.entries)
      for (const s of Object.values(e.sections)) {
        const ks = s[v] ?? [];
        if (ks.length) h.push(ks.filter((k) => k.evidence.includes("heading")).length / ks.length);
      }
    out.heading.set(v, mean(h));
    let found = 0,
      total = 0;
    for (const e of model.entries) {
      if (!e.author.length) continue;
      const doc = [...terms(e.document[v])];
      for (const a of e.author.map(norm)) {
        total++;
        if (doc.some((k) => names(k, a))) found++;
      }
    }
    out.author.set(v, total ? found / total : undefined);
    const g: number[] = [];
    for (const e of model.entries) {
      const doc = [...terms(e.document[v])];
      if (doc.length) g.push(doc.filter((k) => model.glossary.has(k)).length / doc.length);
    }
    out.glossary.set(v, mean(g));
  }
  for (const a of ids)
    for (const b of ids) out.pairs.set(`${a}|${b}`, mean(model.entries.map((e) => jaccard(terms(e.document[a]), terms(e.document[b])))));
  return out;
}

/** A table cell: backslashes first, so a trailing `\` cannot unescape the `\|` after it. */
const cell = (s: string): string => s.replace(/[\\|]/g, "\\$&").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const code = (s: string): string => "`" + s.replace(/`/g, "'") + "`";

function entryLink(e: KeywordsPageEntry): string {
  const label = `${code(e.entry)}<br><small>${cell(e.instance)}</small>`;
  return e.href ? `[${code(e.entry)}](${e.href})<br><small>${cell(e.instance)}</small>` : label;
}

/** The page's anchor for a letter of the index. */
const letterOf = (term: string): string => {
  const c = term.charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

export function keywordsPage(model: KeywordsPageModel, generated: string, evidenceHref = "../"): string {
  const ids = model.variants.map((v) => v.id);
  const def = ids[0]!;
  const ag = agreement(model);
  const L: string[] = [];
  L.push("---");
  L.push('title: "Keywords"');
  L.push('description: "Keywords extracted from every library entry, as a back-of-book index, with six extraction variants side by side and how well each agrees with headings, the authors\' own keywords and the glossaries."');
  L.push(generated);
  L.push("---");
  L.push("");
  L.push(
    "Keywords are **extracted content**: they are built when the site is published, into the derived keywords graph (" +
      code("assets/keywords/") +
      ", " +
      code("folio-keywords/v2") +
      "), never into an entry's ingest record. " +
      `${model.entries.length} entries; the methods and the papers behind them are on the [Indexing evidence](${evidenceHref}) page.`,
  );
  L.push("");
  L.push("## The variants");
  L.push("");
  L.push("| Variant | Method | Weighting | Terms scored |");
  L.push("|---|---|---|---|");
  const scored: Record<KeywordVariant["space"], string> = {
    surface: "the words the text uses",
    latent: "latent scores, any term of the library",
    "latent-rerank": "latent scores, only the words the text or its headings use",
  };
  for (const v of model.variants)
    L.push(`| ${code(v.id)}${v.id === def ? " (default)" : ""} | [${code(v.method)}](${evidenceHref}#${v.method}) | ${v.weighting} | ${scored[v.space]}${v.k ? `, k = ${v.k}` : ""} |`);
  L.push("");
  L.push("## How the variants agree");
  L.push("");
  L.push(
    "Each column is a share, averaged over entries (or sections, for headings). " +
      "**Headings**: section keywords their own heading names. " +
      `**Author keywords**: the authors' own "Keywords:" or "Index Terms" line, found by some document keyword (${ag.authorEntries} entries carry one; ingestion records no PDF metadata keywords). ` +
      "**Glossary**: document keywords that are a glossary term's label. A higher share is agreement, not correctness: a latent variant is meant to propose words the text does not use.",
  );
  L.push("");
  L.push("| Variant | Headings | Author keywords | Glossary |");
  L.push("|---|---|---|---|");
  for (const v of ids) L.push(`| ${code(v)} | ${pct(ag.heading.get(v))} | ${pct(ag.author.get(v))} | ${pct(ag.glossary.get(v))} |`);
  L.push("");
  L.push("Overlap between variants: the mean Jaccard overlap of their document keywords.");
  L.push("");
  L.push(`| | ${ids.map((_, i) => `V${i + 1}`).join(" | ")} |`);
  L.push(`|---|${ids.map(() => "---").join("|")}|`);
  ids.forEach((a, i) => L.push(`| V${i + 1} ${code(a)} | ${ids.map((b) => pct(ag.pairs.get(`${a}|${b}`))).join(" | ")} |`));
  L.push("");
  if (model.glossaryFiles.length) {
    L.push(`<small>Glossary labels: ${model.glossary.size}, from ${model.glossaryFiles.map(code).join(", ")}.</small>`);
    L.push("");
  }

  // The back-of-book index: the default variant's document keywords.
  const index = new Map<string, { label: string; entries: KeywordsPageEntry[]; sections: number }>();
  for (const e of model.entries) {
    for (const k of e.document[def] ?? []) {
      const n = norm(k.term);
      const x = index.get(n) ?? { label: k.term, entries: [], sections: 0 };
      x.entries.push(e);
      x.sections += Object.values(e.sections).filter((s) => (s[def] ?? []).some((sk) => norm(sk.term) === n)).length;
      index.set(n, x);
    }
  }
  const sorted = [...index.values()].sort((a, b) => a.label.localeCompare(b.label));
  const letters = [...new Set(sorted.map((x) => letterOf(x.label)))];
  L.push("## Index");
  L.push("");
  L.push(`The ${code(def)} document keywords, A–Z, with the entries that carry each and how many of their sections do too.`);
  L.push("");
  L.push(letters.map((c) => `[${c}](#kw-${c === "#" ? "other" : c.toLowerCase()})`).join(" · "));
  L.push("");
  for (const c of letters) {
    L.push(`### ${c} {#kw-${c === "#" ? "other" : c.toLowerCase()}}`);
    L.push("");
    for (const x of sorted.filter((y) => letterOf(y.label) === c)) {
      const where = x.entries.map((e) => (e.href ? `[${cell(e.entry)}](${e.href})` : cell(e.entry))).join(", ");
      L.push(`- **${cell(x.label)}**: ${where}${x.sections ? ` <small>(${x.sections} section${x.sections === 1 ? "" : "s"})</small>` : ""}`);
    }
    L.push("");
  }

  L.push("## Each entry, side by side");
  L.push("");
  for (const e of model.entries) {
    L.push(`<details markdown="1"><summary>${cell(e.entry)} <small>${cell(e.instance)}</small></summary>`);
    L.push("");
    L.push(`${entryLink(e)}${e.author.length ? ` · author keywords: ${e.author.map(cell).join(", ")}` : ""}`);
    L.push("");
    L.push(`| # | ${ids.map(code).join(" | ")} |`);
    L.push(`|---|${ids.map(() => "---").join("|")}|`);
    const rows = Math.max(0, ...ids.map((v) => (e.document[v] ?? []).length));
    for (let r = 0; r < rows; r++) L.push(`| ${r + 1} | ${ids.map((v) => cell(e.document[v]?.[r]?.term ?? "")).join(" | ")} |`);
    L.push("");
    L.push("</details>");
    L.push("");
  }
  L.push("---");
  L.push("");
  L.push("Generated by " + code("bun run cat lsi:viz") + " from the derived keywords graph (" + code("library-keywords.ts") + ", cat-harness#1144).");
  return L.join("\n") + "\n";
}

/** Glossary labels from every `<instance>/glossary/*.glossary.json` in the checkout. Generated KG glossaries (names of skills, Tools) are not read. */
export function glossaryLabels(repo: string): { labels: Set<string>; files: string[] } {
  const labels = new Set<string>();
  const files: string[] = [];
  // Every layer's declared `glossary` graphs, not a `glossary/` found by name.
  for (const dir of layerRootsIn(repo).flatMap((inst) => instanceDirectoriesForGraph(inst, "glossary"))) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".glossary.json")).sort()) {
      try {
        const g = JSON.parse(readFileSync(join(dir, f), "utf8")) as { terms?: { prefLabel?: unknown; altLabel?: unknown }[] };
        const lang = schemeSourceLanguage(g);
        // The SOURCE text of each label: a translated label is a language
        // map (`folio-glossary/v1`), and dropping it dropped the term.
        for (const t of g.terms ?? [])
          for (const l of [sourceText(t.prefLabel, lang), ...sourceTexts(t.altLabel, lang)])
            if (typeof l === "string" && norm(l)) labels.add(norm(l));
        files.push(relative(repo, join(dir, f)).split(sep).join(posix.sep));
      } catch {
        // A glossary that does not parse is the glossary check's to report.
      }
    }
  }
  return { labels, files };
}

/** The author keywords of an entry: from the first section file that carries the line. */
export function entryAuthorKeywords(entryDir: string): string[] {
  const dir = join(entryDir, "sections");
  if (!existsSync(dir)) return [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".md")).sort()) {
    const k = authorKeywords(readFileSync(join(dir, f), "utf8"));
    if (k.length) return k;
  }
  return [];
}

/** Where an entry is read: its own page, else its row in the library viewer, else its item page. */
function hrefOf(l: LibraryLinks | undefined, fromPage: string): string | undefined {
  if (l === undefined) return undefined;
  const from = posix.dirname(fromPage);
  if (l.entry !== undefined) return `${posix.relative(from, l.entry) || "."}/`;
  if (l.viewer !== undefined) {
    const [path, hash] = l.viewer.split("#");
    return `${posix.relative(from, path!) || "."}/#${hash}`;
  }
  return l.readme;
}

/** The model over a checkout, from graphs already built. */
export function keywordsPageModel(
  graphs: readonly KeywordsGraph[],
  repo: string,
  dirOf: (g: KeywordsGraph) => string | undefined,
  links: LibraryResolver | undefined,
  fromPage: string,
  variants: readonly KeywordVariant[],
): KeywordsPageModel {
  const { labels, files } = glossaryLabels(repo);
  const entries = graphs.map((g): KeywordsPageEntry => {
    const l = links?.links(g.entry, g.instance);
    const dir = dirOf(g);
    return {
      instance: g.instance,
      entry: g.entry,
      ...(hrefOf(l, fromPage) !== undefined ? { href: hrefOf(l, fromPage)! } : {}),
      document: g.document,
      sections: g.sections,
      author: dir ? entryAuthorKeywords(dir) : [],
    };
  });
  return { variants: [...variants], entries, glossary: labels, glossaryFiles: files };
}
