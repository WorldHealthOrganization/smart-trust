/**
 * glossary-from-source: read a source's glossary and abbreviations sections
 * into `candidate` terms of a `folio-glossary/v1` scheme, verbatim, each with
 * the line it came from. The Tool `glossary-from-source`.
 *
 * Owner, 2026-11-01 (folio-assistant-core#498, card Q-GLO-1 C): one shared
 * ingest step for L1, DTH and DAK sources, in place of a script per handbook
 * (dth-phc's `source_candidates.py`, dth-hrh's workbook import, the GDHCN
 * framework glossary of the trust-network guide). "I don't want to get heavy /
 * prescriptive": it reads what the source already prints and decides nothing.
 *
 * ## What it reads
 *
 * Markdown files: an L1 entry's `sections/*.md`, or a folio block. In each,
 *
 * - a table of two or more columns: the first cell is the term, the second its
 *   definition. A header row (`Term`, `Acronym`, `Abbreviation`, ...) is
 *   skipped, and `<br>` becomes a line break;
 * - a definition line: `**Term**: definition`, `Term – definition` or
 *   `Term — definition`.
 *
 * A file whose front matter `section_title` (an L1 section) or first heading
 * names abbreviations or acronyms is read as abbreviations: the first cell is
 * the acronym, the second its expansion. Otherwise it is read as terms. With
 * `--from DIR`, every `.md` under DIR whose section title names a glossary,
 * definitions, terms, abbreviations or acronyms is read; files can also be
 * named one by one with `--terms` and `--abbreviations`.
 *
 * ## What it writes
 *
 * - Each term: `prefLabel` and `definition` as printed, `status: candidate`,
 *   and `source: <file>#L<line>`. A label that ends in an acronym in brackets,
 *   "Digital adaptation kits (DAKs)", gives the acronym as `notation`.
 * - Each acronym: its expansion is matched to a term's label, ignoring case;
 *   the term gets the acronym as `notation`. An acronym with no term becomes a
 *   term of its own, labelled with its expansion and with no definition.
 * - The scheme file is MERGED, never replaced: a term a person has moved past
 *   `candidate` (`authored`) or edited by hand keeps every field; only
 *   `candidate` terms the tool wrote are refreshed. Only a person moves a term
 *   to `authored` (bean `lqo9`, the `glossary-terms` skill).
 *
 *   bun run folio-assistant-core/scripts/glossary-from-source.ts \
 *     --out glossary/<scheme>.glossary.json --id <scheme> --title "<title>" \
 *     [--from library/<bib>/sections] [--terms FILE]... [--abbreviations FILE]... [--check]
 *
 * `--check` writes nothing and fails when the file would change.
 *
 * @module folio-assistant-core/scripts/glossary-from-source
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { GLOSSARY_SCHEMA_ID, GlossarySchema, type Glossary, type Term } from "../schemas/glossary.ts";

/** One row read from a source. */
export interface SourceRow {
  /** First cell: a term, or an acronym. */
  head: string;
  /** Second cell: a definition, or an expansion. */
  body: string;
  /** 1-based line in the file. */
  line: number;
}

export type SectionKind = "terms" | "abbreviations";

/**
 * A glossary or abbreviations TITLE: the words open the title, after any
 * number or "Annex G." prefix. Matched anywhere, "Step 2. Define coding
 * scheme, data definitions and structures" (9789240116191-eng) read as a
 * glossary and gave three noise candidates.
 */
const TITLE_PREFIX = String.raw`^\s*(?:(?:annex|appendix|chapter|part|section)\s+[\w.-]+[.:]?\s*|\d+(?:\.\d+)*\.?\s+|[A-Z]\.\s+|[ivxlc]{1,6}\.\s+)*(?:list\s+of\s+)?(?:[\p{L}-]+\s+){0,2}`;
const GLOSSARY_TITLE = new RegExp(`${TITLE_PREFIX}(glossary|definitions?|terms?( and definitions)?|terminology)\\b`, "iu");
const ABBREV_TITLE = new RegExp(`${TITLE_PREFIX}(abbreviations?|acronyms?)\\b`, "iu");
const HEADER = /^(terms?|acronyms?|abbreviations?|definitions?|descriptions?|meaning|expansion|full (form|name)|concept)$/i;

/** The section title a file states: its L1 front matter's `section_title`, else its first heading. */
export function sectionTitle(md: string): string | undefined {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1];
  const t = fm ? /^section_title:\s*"?(.*?)"?\s*$/m.exec(fm)?.[1] : undefined;
  return t ?? /^#{1,6}\s+(.+)$/m.exec(md)?.[1]?.trim();
}

/** Which kind of section a file is, from its title, or undefined when it is neither. */
export function sectionKind(md: string): SectionKind | undefined {
  // A control character the text layer left in a title ("II.\u0003Definition of key terms").
  const t = (sectionTitle(md) ?? "").replace(/\p{Cc}/gu, " ");
  if (ABBREV_TITLE.test(t)) return "abbreviations";
  if (GLOSSARY_TITLE.test(t)) return "terms";
  return undefined;
}

const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/\\\|/g, "|")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

/** Split a Markdown table row into cells, honouring `\|`. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => clean(c));
}

/** Every term/definition (or acronym/expansion) row a Markdown file prints, in order. */
export function readRows(md: string): SourceRow[] {
  const lines = md.split("\n");
  const out: SourceRow[] = [];
  let inFm = lines[0] === "---";
  for (let i = inFm ? 1 : 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (inFm) {
      if (line === "---") inFm = false;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|?\s*:?-{3,}/.test(line)) continue;
      const [head, body] = cells(line);
      if (!head || !body || (HEADER.test(head) && HEADER.test(body))) continue;
      out.push({ head, body, line: i + 1 });
      continue;
    }
    const def = /^\s*(?:[-*]\s+)?\*\*([^*]{1,120}?)\*\*\s*[:–—-]?\s+(.+)$/.exec(line) ?? /^\s*(?:[-*]\s+)?([^\s:–—|#][^:–—|]{0,80}?)\s+[–—]\s+(.+)$/.exec(line);
    if (def) out.push({ head: clean(def[1]!).replace(/[:.]$/, ""), body: clean(def[2]!), line: i + 1 });
  }
  return out;
}

/** An L1 library section: front matter written by an ingest rung (`doc_id`, `source_pdf`). */
export function isL1Section(md: string): boolean {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? "";
  return /^doc_id:/m.test(fm) && /^(source_pdf|source_sha256|section_id):/m.test(fm);
}

/** A line that can be a term (or an acronym) printed on its own: short, no closing punctuation, not a bullet. */
const termLike = (l: string): boolean =>
  l.length > 0 && l.length <= 60 && l.split(/\s+/).length <= 8 && !/[.,;:]$/.test(l) && /^[\p{L}\p{N}(“"']/u.test(l) && !/^[•∞▪–—-]/.test(l);
/** An acronym printed on its own line: one or two tokens, with at least two capitals (eLMIS, DH&I WG, GHSC-PSM). */
const acronymLike = (l: string): boolean =>
  l.length <= 20 && /^[\p{L}\p{N}&/.\-]+(?: [\p{L}\p{N}&/.\-]+)?$/u.test(l) && (l.match(/\p{Lu}/gu)?.length ?? 0) >= 2;
/** A line that closes a sentence, with any reference marks after it ("...transformation.1, 2"). */
const closes = (l: string): boolean => /[.)”"’]\s*(?:\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)?\s*$/.test(l);

/**
 * Rows of a glossary as a PDF prints it and an L1 rung extracts it: the term
 * on a line of its own (wrapped over at most three short lines), its
 * definition on the lines after it, up to the line that closes a sentence
 * before the next term. An abbreviations section prints the acronym on one
 * line and its expansion on the next. Lines that repeat the section's own
 * heading, a column header (Term, Definition) or a page number are skipped.
 */
export function stackedRows(md: string, kind: SectionKind): SourceRow[] {
  const all = md.split("\n");
  const start = all[0] === "---" ? all.indexOf("---", 1) + 1 : 0;
  const title = (sectionTitle(md) ?? "").trim().toLowerCase();
  const lines: { t: string; n: number }[] = [];
  for (let i = start; i < all.length; i++) {
    const t = all[i]!.trim();
    if (!t || /^\d{1,4}$/.test(t) || /^[ivxlc]{1,6}$/i.test(t)) continue;
    if (t.toLowerCase() === title || HEADER.test(t) || /^(glossary|abbreviations?( and acronyms)?|acronyms|part|annex [a-z0-9]+)$/i.test(t)) continue;
    // A heading worded apart from the section title, and a "Part 2:" column label.
    if (/^(definitions? of terms|terms and definitions)\b/i.test(t) || /^part\s+[ivx\d]+\s*:?$/i.test(t)) continue;
    lines.push({ t, n: i + 1 });
  }
  const out: SourceRow[] = [];
  if (kind === "abbreviations") {
    for (let i = 0; i < lines.length; i++) {
      const { t, n } = lines[i]!;
      if (!acronymLike(t)) continue;
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !acronymLike(lines[j]!.t) && body.length < 3) body.push(lines[j++]!.t);
      if (body.length) out.push({ head: t, body: clean(body.join(" ")), line: n });
      i = j - 1;
    }
    return out;
  }
  for (let i = 0; i < lines.length; ) {
    // The term: one to three term-like lines, then a line that is not one, or
    // the first line of a definition that opens with a capital.
    const head: string[] = [];
    let j = i;
    while (j < lines.length && head.length < 3 && termLike(lines[j]!.t)) {
      head.push(lines[j]!.t);
      j++;
      const next = lines[j]?.t ?? "";
      if (/^\p{Lu}/u.test(next) && head.length && !/^\p{Ll}/u.test(next)) break;
    }
    if (!head.length || j >= lines.length) {
      i = Math.max(j, i + 1);
      continue;
    }
    const body: string[] = [];
    while (j < lines.length) {
      body.push(lines[j]!.t);
      j++;
      if (closes(body[body.length - 1]!) && (j >= lines.length || termLike(lines[j]!.t))) break;
    }
    const text = clean(body.join(" ").replace(/(\.)\s*\d{1,3}(?:\s*,\s*\d{1,3})*\s*$/, "$1"));
    if (closes(body[body.length - 1]!) && text.length >= 15) out.push({ head: clean(head.join(" ")), body: text, line: lines[i]!.n });
    i = j;
  }
  return out;
}

/**
 * The rows of a section: Markdown tables and definition lines, or, for an L1
 * section, the stacked PDF layout when it reads more rows (a dash inside a
 * line of prose is not a glossary).
 */
export function rowsOf(md: string, kind: SectionKind): SourceRow[] {
  const rows = readRows(md);
  if (!isL1Section(md)) return rows;
  const stacked = stackedRows(md, kind);
  return stacked.length > rows.length ? stacked : rows;
}

/** A term id from a label: lower case, ASCII letters and digits, hyphens. */
export function termId(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\(([^)]*)\)/g, " $1 ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "term"
  );
}

/** A label that ends in an acronym in brackets: the label without it, and the acronym. */
export function splitAcronym(label: string): { label: string; acronym?: string } {
  const m = /^(.*\S)\s*\(([\p{Lu}\p{N}][\p{L}\p{N}\-]*)\)$/u.exec(label);
  if (!m || !/\p{Lu}.*\p{Lu}/u.test(m[2]!)) return { label };
  return { label: m[1]!, acronym: m[2]!.replace(/s$/, "") };
}

export interface Input {
  /** Repository-relative path, as written into `source`. */
  path: string;
  kind: SectionKind;
  md: string;
}

const STAMP = "Verbatim from the source; a candidate until an editor adopts it (glossary-from-source).";

/** The candidate terms the inputs give, in reading order, terms before acronyms are folded in. */
export function candidates(inputs: readonly Input[]): Term[] {
  const terms: Term[] = [];
  const byId = new Map<string, Term>();
  const byLabel = new Map<string, Term>();
  const add = (t: Term) => {
    let id = t.id;
    for (let n = 2; byId.has(id); n++) id = `${t.id}-${n}`;
    const term = { ...t, id };
    terms.push(term);
    byId.set(id, term);
    byLabel.set(String(term.prefLabel).toLowerCase(), term);
    return term;
  };
  for (const inp of inputs.filter((i) => i.kind === "terms")) {
    for (const r of rowsOf(inp.md, "terms")) {
      const { label, acronym } = splitAcronym(r.head);
      if (byLabel.has(label.toLowerCase())) continue;
      add({
        id: termId(label),
        prefLabel: label,
        definition: r.body,
        ...(acronym ? { notation: acronym } : {}),
        scopeNote: STAMP,
        source: `${inp.path}#L${r.line}`,
        status: "candidate",
      });
    }
  }
  for (const inp of inputs.filter((i) => i.kind === "abbreviations")) {
    for (const r of rowsOf(inp.md, "abbreviations")) {
      const acronym = r.head;
      const expansion = splitAcronym(r.body).label;
      const known = byLabel.get(expansion.toLowerCase());
      if (known) {
        if (!known.notation) known.notation = acronym;
        continue;
      }
      add({ id: termId(expansion), prefLabel: expansion, notation: acronym, scopeNote: STAMP, source: `${inp.path}#L${r.line}`, status: "candidate" });
    }
  }
  return terms;
}

/** Whether a term is one this tool wrote and may refresh: a candidate carrying its stamp. */
const ours = (t: Term) => t.status === "candidate" && t.scopeNote === STAMP;

/**
 * `found` merged into `existing`: every term a person owns stays as it is, in
 * place; this tool's own candidates are refreshed or added after them.
 */
export function merge(existing: Glossary | undefined, found: readonly Term[], meta: { id: string; title: string }): Glossary {
  const kept = (existing?.terms ?? []).filter((t) => !ours(t));
  const keptIds = new Set(kept.map((t) => t.id));
  const keptLabels = new Set(kept.map((t) => String(typeof t.prefLabel === "string" ? t.prefLabel : (t.prefLabel.en ?? "")).toLowerCase()));
  const fresh = found.filter((t) => !keptIds.has(t.id) && !keptLabels.has(String(t.prefLabel).toLowerCase()));
  return GlossarySchema.parse({
    ...(existing ?? { $schema: GLOSSARY_SCHEMA_ID, id: meta.id, title: meta.title }),
    terms: [...kept, ...fresh],
  });
}

const NUMBER = /^((?:\d+|[A-Z])(?:\.\d+)*)\.?\s+(.*)$/;

/**
 * A section that IS one term, as a specification prints its glossary: the
 * heading is the term ("2.1.1. Actor") and the first paragraph its
 * definition. Read as a one-row table.
 */
export function termSection(md: string): string | undefined {
  const title = sectionTitle(md);
  const label = title ? (NUMBER.exec(title)?.[2] ?? title).trim() : undefined;
  const lines = md.split("\n");
  const fmEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  let at = -1;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (l && !/^(#|<a\s|>|\||```|!\[)/.test(l)) {
      at = i;
      break;
    }
  }
  if (!label || at < 0) return undefined;
  let end = at;
  while (end + 1 < lines.length && lines[end + 1]!.trim()) end++;
  const para = lines.slice(at, end + 1).join(" ").trim();
  // Padded with blank lines so the row sits on the paragraph's own line, and
  // `source` names the line the definition is printed on.
  return `${"\n".repeat(at)}| ${label.replace(/\|/g, "\\|")} | ${para.replace(/\|/g, "\\|")} |`;
}

/**
 * Every `.md` under `dir` whose section is a glossary or abbreviations
 * section, plus each numbered section under a glossary section whose number
 * extends it ("2.1.1" under "2"): a term printed as a heading of its own.
 */
export function sectionsUnder(repo: string, dir: string): Input[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : n.endsWith(".md") ? [p] : [];
    });
  const out: Input[] = [];
  const parents: string[] = [];
  for (const p of walk(dir).sort()) {
    const md = readFileSync(p, "utf-8");
    const kind = sectionKind(md);
    const num = NUMBER.exec(sectionTitle(md) ?? "")?.[1];
    if (kind) {
      if (kind === "terms" && num) parents.push(`${num}.`);
      // A titled section is an input even when no row is read from it: the
      // arm must say "found but not read" (partial), never "none in the
      // source", for a glossary that is there.
      if (rowsOf(md, kind).length || isL1Section(md)) out.push({ path: relative(repo, p), kind, md });
      continue;
    }
    if (num && parents.some((n) => `${num}.`.startsWith(n))) {
      const row = termSection(md);
      if (row) out.push({ path: relative(repo, p), kind: "terms", md: row });
    }
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const all = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]!] : []));
  const one = (flag: string) => all(flag)[0];
  const repo = process.cwd();
  const out = one("--out");
  const id = one("--id");
  // A new scheme's title is free text, so a Tool passes it on stdin, never as
  // a word of argv (check:tools' injection rule). A person may still use --title.
  const needsTitle = !!out && !existsSync(out) && !one("--title");
  const title = one("--title") ?? (needsTitle && !process.stdin.isTTY ? (await Bun.stdin.text()).trim() || undefined : undefined);
  if (!out || (!existsSync(out) && (!id || !title))) {
    console.error("usage: glossary-from-source --out <file> [--id <scheme> --title <title> | title on stdin] [--from DIR] [--terms FILE]... [--abbreviations FILE]... [--check]");
    process.exit(2);
  }
  const inputs: Input[] = [
    ...all("--from").flatMap((d) => sectionsUnder(repo, resolve(d))),
    ...all("--terms").map((p) => ({ path: relative(repo, resolve(p)), kind: "terms" as const, md: readFileSync(p, "utf-8") })),
    ...all("--abbreviations").map((p) => ({ path: relative(repo, resolve(p)), kind: "abbreviations" as const, md: readFileSync(p, "utf-8") })),
  ];
  if (!inputs.length) {
    console.error("✗ no glossary or abbreviations section found in the inputs");
    process.exit(1);
  }
  const existing = existsSync(out) ? GlossarySchema.parse(JSON.parse(readFileSync(out, "utf-8"))) : undefined;
  const found = candidates(inputs);
  const g = merge(existing, found, { id: id ?? existing!.id, title: title ?? existing!.title });
  const text = `${JSON.stringify(g, null, 2)}\n`;
  const summary = `${found.length} candidate(s) from ${inputs.length} section(s); ${g.terms.length} term(s) in ${out}`;
  if (args.includes("--check")) {
    if (!existsSync(out) || readFileSync(out, "utf-8") !== text) {
      console.error(`✗ ${out} is stale: ${summary}. Run without --check.`);
      process.exit(1);
    }
    console.log(`✓ ${summary}`);
    process.exit(0);
  }
  writeFileSync(out, text);
  console.log(`✓ wrote ${summary}`);
}
