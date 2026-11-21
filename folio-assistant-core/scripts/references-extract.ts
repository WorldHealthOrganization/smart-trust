/**
 * Split each library entry's reference lists into `folio-reference/v1` nodes,
 * one per cited work, so every document that has a reference list gets its
 * own bibliography.
 *
 * Owner, 2026-11-11: *"i want all who-iris docs that have references put into
 * their own biblio"*. The node shape is the one every other bibliography
 * already uses (`schemas/reference.ts`): `provenance: "extracted"`,
 * `derivedFrom` the section file the list was read from, and `printed` the
 * entry exactly as the document prints it. The bibliography page groups the
 * nodes by the library entry their `derivedFrom` sits under, which is the
 * per-document bibliography (`scripts/bibliography-page.ts`, per-asset views).
 *
 * ## What it reads
 *
 * The L1 sections of each entry of the instance's `library` directory
 * (`library/<slug>/sections/*.md`, written by the L1 ingest). A reference list
 * is either a whole section whose title is a reference-list heading, or the
 * lines after such a heading inside a section. Headings are matched in the six
 * UN languages and Portuguese (References, Bibliography, Further reading,
 * Références, Referencias, Литература, المراجع, 参考文献, …). A heading with
 * no entries after it (a table of contents line, say) yields nothing.
 *
 * ## What it writes
 *
 * `<references dir>/<slug>.<section>.<n>.json`: the slug of the library entry,
 * the section id without its title words, and the entry's number in that list
 * (its printed number when the list is numbered). The key is the file name, as
 * the `references` kind requires, and is stable while the section is.
 *
 * Fields are only those read without guessing: `printed` (always), `URL` (the
 * first web address), `DOI`, `ISBN`, `issued` (the publication year, not the
 * access date), `accessed`, and `type` (`article-journal` when the entry has a
 * journal's year;volume:pages, else `document`). No title or author is parsed:
 * WHO, Vancouver and author-year styles disagree on where a title ends, and a
 * wrong title is worse than none, because the page then shows `printed`.
 * When the URL is an IRIS handle the instance's catalogue holds, `heldAt`
 * names the library copy.
 *
 * `--check` writes nothing and fails when a node on disk differs from what the
 * sections give now, or a node has no list left to come from.
 *
 * Usage: bun run folio-assistant-core/scripts/references-extract.ts --instance <dir> [--entry <slug>] [--check]
 *
 * @module folio-assistant-core/scripts/references-extract
 * @covers library, references — it reads library sections and writes reference nodes
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { instanceDirectoryForGraph } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { STRUCTURE_FILENAME } from "@litlfred/cat-harness-tools/schemas/content/document-structure.js";
import { REFERENCE_SCHEMA_TAG, ReferenceNodeSchema, type ReferenceNode } from "../schemas/reference.ts";

/** A line that is only a reference-list heading. */
export const REFERENCE_HEADING = new RegExp(
  "^\\s*(?:#+\\s*)?(?:\\d+(?:\\.\\d+)*\\.?\\s+)?(?:" +
    [
      "references?",
      "selected references",
      "key references",
      "references and (?:further|additional) reading",
      "bibliography",
      "further reading",
      "literature cited",
      "works cited",
      "r[ée]f[ée]rences(?: bibliographiques)?",
      "bibliographie",
      "referencias(?: bibliogr[áa]ficas)?",
      "bibliograf[íi]a",
      "refer[êe]ncias(?: bibliogr[áa]ficas)?",
      "литература",
      "список литературы",
      "библиография",
      "ссылки",
      "المراجع",
      "مراجع",
      "参考文献",
      "参考资料",
    ].join("|") +
    ")\\s*:?\\s*$",
  "i",
);

/** A line that opens something other than a reference list: the list ends there. */
const STOP_HEADING =
  /^\s*(?:(?:annex(?:e|es)?|appendix|appendices|anexo|приложение|ملحق|附件|chapter|chapitre|cap[íi]tulo|глава|الفصل|第.章|glossary|glossaire|glosario|acknowledg(?:e)?ments?|remerciements|agradecimientos)\b[^.]{0,80}|index)\s*$/i;

/** A line that ends a list wherever it sits: a contents leader, a table or figure, a page header the extractor kept. */
const LIST_END = /(?:\.\s?){8,}|^\s*(?:table|figure|fig\.|box|tableau|figura|cuadro|таблица|рисунок|جدول|الشكل|表|图)\s*\d|^\s*page\s*\|/i;

/** A numbered entry's opening: `1.`, `1)`, `[1]`, or a bare `1` before text. */
const NUMBERED = /^\s*\[?(\d{1,3})(?:[.)\]]|\s)\s*(.*)$/;

/** Text that looks like a cited work: a year or a web address or a DOI. */
const CITATION_SIGNAL = /\b(?:1[89]\d\d|20\d\d)\b|https?:\/\/|www\.|\b10\.\d{4,9}\//;

/** Clauses that date the reading, not the work. */
const ACCESSED =
  /[,;(]?\s*(?:last\s+)?(?:accessed|consult[ée](?:\s+le)?|consultado(?:\s+el)?|acesso em|дата обращения|تاريخ الاطلاع|访问日期|(?:date )?retrieved)\s*:?\s*([^)]*?\b(?:1[89]\d\d|20\d\d))\s*\)?/i;

export interface ExtractedList {
  /** The section file, relative to the instance root. */
  section: string;
  /** The section id (`sec-014`, `page-120`). */
  sectionId: string;
  /** Each entry's printed number (sequential when unnumbered) and text. */
  entries: { n: number; text: string }[];
}

const frontMatter = (t: string): { meta: Record<string, string>; body: string } => {
  if (!t.startsWith("---")) return { meta: {}, body: t };
  const end = t.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: t };
  const meta: Record<string, string> = {};
  for (const l of t.slice(3, end).split("\n")) {
    const m = /^(\w+):\s*(.*)$/.exec(l);
    if (m) meta[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
  }
  return { meta, body: t.slice(end + 4).replace(/^\n/, "") };
};

/** Lines that are page furniture inside a list: page numbers, and running heads printed more than once. */
function furniture(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const k = l.trim();
    if (k && !REFERENCE_HEADING.test(k) && !STOP_HEADING.test(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // A bare number followed by a tab or a stop is an entry's mark, not a page number.
  const marks = new Set(lines.filter((l) => /^\s*\d{1,3}(?:[.)\]]|\t)\s*$/.test(l)).map((l) => l.trim()));
  const out = new Set<string>();
  for (const [k, c] of counts) {
    if ((/^\d{1,4}$/.test(k) && !marks.has(k)) || /^[ivxlc]{1,6}$/i.test(k)) out.add(k);
    // A section tab or running head in capitals (INTRODUCTION, METHODS).
    else if (k.length < 40 && !/\d/.test(k) && k === k.toUpperCase() && /\p{Lu}/u.test(k)) out.add(k);
    else if (c > 1 && k.length < 120 && !CITATION_SIGNAL.test(k) && !NUMBERED.test(k)) out.add(k);
  }
  return out;
}

/** Join an entry's wrapped lines: a web address or a hyphen at a line end continues without a space. */
export function joinLines(lines: string[]): string {
  let s = "";
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (!s) {
      s = l;
      continue;
    }
    const lastToken = s.slice(s.lastIndexOf(" ") + 1);
    const inUrl = /^\(?(?:https?:\/\/|www\.)/.test(lastToken) && !/[),]$/.test(lastToken);
    s += inUrl || /[-/_]$/.test(s) ? l : ` ${l}`;
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Split the lines of one reference list into entries. */
export function splitEntries(lines: string[]): { n: number; text: string }[] {
  const skip = furniture(lines);
  const kept = lines.filter((l) => !skip.has(l.trim()));
  // Numbered when the list opens with 1 and counts up.
  let expect = 1;
  const starts: { at: number; n: number; rest: string }[] = [];
  for (let i = 0; i < kept.length; i++) {
    const m = NUMBERED.exec(kept[i]!);
    if (m && Number(m[1]) === expect) {
      starts.push({ at: i, n: expect, rest: m[2] ?? "" });
      expect++;
    }
  }
  if (starts.length >= 2 && starts[0]!.at <= 2) {
    return starts
      .map((s, k) => {
        const end = k + 1 < starts.length ? starts[k + 1]!.at : kept.length;
        return { n: s.n, text: joinLines([s.rest, ...kept.slice(s.at + 1, end)]) };
      })
      .filter((e) => e.text.length > 0);
  }
  // Unnumbered: an entry ends on a line that closes a citation (a full stop or
  // a closing bracket after a year or address), and the next opens with a capital.
  const out: { n: number; text: string }[] = [];
  let cur: string[] = [];
  const flush = () => {
    const text = joinLines(cur);
    if (text) out.push({ n: out.length + 1, text });
    cur = [];
  };
  for (let i = 0; i < kept.length; i++) {
    const l = kept[i]!.trim();
    if (!l) {
      if (cur.length && CITATION_SIGNAL.test(cur.join(" "))) flush();
      continue;
    }
    cur.push(l);
    const next = kept.slice(i + 1).find((x) => x.trim())?.trim() ?? "";
    const closes = /[.)\]]$/.test(l) && !/\b(?:et al|eds?|Dr|St|vol|no|pp|Inc|Ltd|[A-Z])\.$/.test(l);
    if (closes && CITATION_SIGNAL.test(cur.join(" ")) && /^[\p{Lu}\p{Lo}"“'‘[(]/u.test(next)) flush();
  }
  flush();
  return out;
}

/** Where a list inside a section body ends (a stop heading, or ten lines with no citation in them): its lines and the index just past the last line it read. */
function listSpan(lines: string[], from: number): { lines: string[]; end: number } {
  const out: string[] = [];
  let end = from;
  let dry = 0;
  for (let i = from; i < lines.length; i++) {
    const l = lines[i]!;
    if (STOP_HEADING.test(l) || LIST_END.test(l) || (i > from && REFERENCE_HEADING.test(l))) {
      // A running head or section tab between two entries of a numbered list
      // (a page break): the list goes on when the next lines open an entry.
      const after = lines.slice(i + 1).filter((x) => x.trim()).slice(0, 3);
      const opensEntry = Number(NUMBERED.exec(after[0] ?? "")?.[1] ?? 0) > 1;
      const midEntry = out.length > 0 && !/[.)]\s*$/.test(out[out.length - 1]!.trim()) && CITATION_SIGNAL.test(after.join(" "));
      if (!LIST_END.test(l) && (opensEntry || midEntry)) continue;
      break;
    }
    if (/^#{1,6}\s/.test(l) && !CITATION_SIGNAL.test(l)) break;
    dry = CITATION_SIGNAL.test(l) || NUMBERED.test(l) ? 0 : dry + 1;
    if (dry > 15) break;
    out.push(l);
    end = i + 1;
  }
  // Drop the trailing lines after the last citation signal.
  while (out.length && !CITATION_SIGNAL.test(out[out.length - 1]!) && !/[.)]$/.test(out[out.length - 1]!.trim())) out.pop();
  return { lines: out, end };
}

/** Longer than any one citation: the list ran on into the text after it, so the entry is left out rather than kept wrong. */
const MAX_ENTRY = 800;

/** An entry that can be a citation: not run on into the text after it, long enough, punctuated, and not an in-text (Author, year). */
export const isCitation = (e: { text: string }): boolean =>
  e.text.length <= MAX_ENTRY &&
  (/https?:\/\//.test(e.text) || (e.text.length >= 30 && /[.,;:]/.test(e.text))) &&
  !/^\([^()]*\d{4}\)$/.test(e.text);

/** A list must look like one: at least one entry long enough to be a citation, and most entries with a year or address. */
function looksLikeList(entries: { text: string }[], wholeSection: boolean): boolean {
  if (!entries.length) return false;
  const cited = entries.filter((e) => e.text.length >= 25 && CITATION_SIGNAL.test(e.text)).length;
  if (cited === 0) return false;
  if (!wholeSection && entries.length < 2) return false;
  return cited / entries.length >= 0.5;
}

/** Every reference list of one library entry, in section order. */
export function listsOf(instanceRoot: string, entryDir: string): ExtractedList[] {
  const sections = join(entryDir, "sections");
  if (!existsSync(sections)) return [];
  const out: ExtractedList[] = [];
  const read = readdirSync(sections)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const path = join(sections, f);
      const { meta, body } = frontMatter(readFileSync(path, "utf-8"));
      const all = body.split("\n");
      const skip = furniture(all);
      return {
        f,
        meta,
        section: relative(instanceRoot, path),
        sectionId: (meta.section_id ?? basename(f, ".md")).replace(/^((?:sec|page|part)-\d+[a-z]?).*$/, "$1"),
        lines: all.filter((l) => !skip.has(l.trim())),
      };
    });
  // A list read on into the next page sections: the lines it took there are not a list of their own.
  const taken = new Map<number, number>();
  for (let k = 0; k < read.length; k++) {
    const { meta, section, sectionId } = read[k]!;
    // A page-at-a-time entry (one section per page) carries a list across
    // pages: read on into the following page sections.
    const pages = sectionId.startsWith("page-") ? read.slice(k + 1, k + 7).filter((r) => r.sectionId.startsWith("page-")) : [];
    const own = read[k]!.lines;
    const continued = [...own, ...pages.flatMap((r) => r.lines)];
    const whole = REFERENCE_HEADING.test(meta.section_title ?? "");
    const skipTo = taken.get(k) ?? 0;
    const starts = whole ? [0] : own.flatMap((l, i) => (i >= skipTo && REFERENCE_HEADING.test(l) ? [i + 1] : []));
    for (const at of starts) {
      // A whole section may repeat its own heading on its first lines. When an
      // inferred split put a line of the page before above that heading (a
      // footnote: "2 All linked references were accessed on ..."), the list
      // starts after the heading: reading from the stray line, the heading
      // ended the list at its first line (9789240101197-eng kept 1 of 26).
      const heading = own.findIndex((l, i) => i < 6 && REFERENCE_HEADING.test(l));
      const from = whole
        ? Math.max(own.findIndex((l, i) => i > heading && l.trim() && !REFERENCE_HEADING.test(l)), 0)
        : at;
      // Read on into the next pages only when the list starts with citations
      // (on this page, or on the next page's first lines): a heading at a
      // page's foot over a page of prose is not a list.
      const opening = [...own.slice(from), ...(pages[0]?.lines ?? [])].filter((l) => l.trim()).slice(0, 4).join(" ");
      const lines = pages.length && CITATION_SIGNAL.test(opening) ? continued : own;
      const span = listSpan(lines, from);
      const entries = splitEntries(span.lines).filter(isCitation);
      if (!looksLikeList(entries, whole)) continue;
      out.push({ section, sectionId, entries });
      let rest = span.end - own.length;
      for (let j = 0; rest > 0 && j < pages.length; j++) {
        const idx = read.indexOf(pages[j]!);
        taken.set(idx, Math.min(rest, pages[j]!.lines.length));
        rest -= pages[j]!.lines.length;
      }
    }
  }
  // Two lists in one section (chapter-end lists): number them apart.
  const seen = new Map<string, number>();
  for (const l of out) {
    const k = l.sectionId;
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c > 1) l.sectionId = `${k}-${c}`;
  }
  return out;
}

/** The IRIS handle a URL names (`10665/43432` → `10665-43432`), if any. */
export function irisHandle(url: string): string | undefined {
  const m = /(?:iris\.who\.int|apps\.who\.int\/iris|who\.int\/iris)\/(?:handle|bitstream(?:\/handle)?)\/10665\/(\d+)/i.exec(url);
  return m ? `10665-${m[1]}` : undefined;
}

/** Text without C0/C1 control characters or DEL; whitespace controls become a space. */
export function stripControl(s: string): string {
  return s.replace(/[\t\n\r]/g, " ").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/ {2,}/g, " ").trim();
}

/** The node for one printed entry: only fields read without guessing. */
export function toReference(key: string, printedRaw: string, derivedFrom: string): ReferenceNode {
  // A PDF's text layer can carry control characters (a BEL before a WHO
  // reference in 10665-349550); they are no part of the printed entry, and
  // YAML refuses them in a page's front matter.
  const printed = stripControl(printedRaw);
  const node: ReferenceNode = { $schema: REFERENCE_SCHEMA_TAG, id: key, type: "document", provenance: "extracted", derivedFrom, printed };
  const accessed = ACCESSED.exec(printed);
  const dated = accessed ? printed.replace(accessed[0], " ") : printed;
  const url = /(?:https?:\/\/|www\.)[^\s,;<>"]+/.exec(printed)?.[0]?.replace(/[.)\]]+$/, "");
  if (url && /\.[a-z]{2,}(?:[/:?#]|$)/i.test(url.replace(/^(?:https?:\/\/)?www\./, ""))) node.URL = url.startsWith("www.") ? `https://${url}` : url;
  const doi = /\b(10\.\d{4,9}\/[^\s,;<>"]+)/.exec(printed)?.[1]?.replace(/[.)\]]+$/, "");
  if (doi) node.DOI = doi;
  const isbn = /\bISBN[:\s]*((?:97[89][-\s]?)?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX])\b/i.exec(printed)?.[1];
  if (isbn) node.ISBN = isbn.replace(/\s/g, "-");
  // The work's year: the last year outside the access date and the address.
  const years = [...dated.replace(/(?:https?:\/\/|www\.)\S+/g, " ").matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
  const journal = /\b(1[89]\d\d|20\d\d)\s*[;,]\s*\d+\s*(?:\(\s*[\w-]+\s*\))?\s*:\s*[\w-]+/.exec(dated);
  const year = journal ? Number(journal[1]) : years[years.length - 1];
  if (year) node.issued = { "date-parts": [[year]] };
  if (journal) node.type = "article-journal";
  if (accessed) node.accessed = { raw: accessed[1]!.trim() };
  return node;
}

/** Which catalogue node each IRIS handle is, and the library copy when one is held. */
function heldItems(instanceRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  const library = instanceDirectoryForGraph(instanceRoot, "library");
  if (!library || !existsSync(library)) return out;
  for (const slug of readdirSync(library)) if (/^10665-\d+$/.test(slug) && existsSync(join(library, slug, STRUCTURE_FILENAME))) out.set(slug, relative(instanceRoot, join(library, slug)));
  return out;
}

export interface ExtractResult {
  /** Path (relative to the instance root) → file text. */
  files: Map<string, string>;
  /** Per library entry: how many lists and references. */
  perEntry: { slug: string; lists: number; references: number }[];
  /** The references directory, relative to the instance root. */
  dir: string;
}

export function extract(instanceRoot: string, only?: string): ExtractResult {
  const library = instanceDirectoryForGraph(instanceRoot, "library");
  const refs = instanceDirectoryForGraph(instanceRoot, "references");
  if (!library) throw new Error(`${instanceRoot}: no library directory declared`);
  if (!refs) throw new Error(`${instanceRoot}: no references directory declared; declare one (graphTypologies ["references"]) to hold the extracted nodes`);
  const held = heldItems(instanceRoot);
  const files = new Map<string, string>();
  const perEntry: ExtractResult["perEntry"] = [];
  for (const slug of readdirSync(library).sort()) {
    if (only && slug !== only) continue;
    const dir = join(library, slug);
    if (!existsSync(join(dir, "sections"))) continue;
    const lists = listsOf(instanceRoot, dir);
    let n = 0;
    for (const l of lists) {
      for (const e of l.entries) {
        const key = `${slug}.${l.sectionId}.${e.n}`;
        const node = toReference(key, e.text, l.section);
        const handle = node.URL ? irisHandle(node.URL) : undefined;
        if (handle && handle !== slug && held.has(handle)) node.heldAt = held.get(handle);
        const r = ReferenceNodeSchema.safeParse(node);
        if (!r.success) throw new Error(`${key}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        files.set(relative(instanceRoot, join(refs, `${key}.json`)), `${JSON.stringify(node, null, 2)}\n`);
        n++;
      }
    }
    if (lists.length) perEntry.push({ slug, lists: lists.length, references: n });
  }
  return { files, perEntry, dir: relative(instanceRoot, refs) };
}

/** What {@link extract} gives against what is on disk: the nodes that differ, and the extracted ones with no list left to come from. */
export function plan(instanceRoot: string, only?: string): ExtractResult & { changed: string[]; stale: string[] } {
  const r = extract(instanceRoot, only);
  const stale = onDisk(instanceRoot, r.dir, only).filter((p) => !r.files.has(p));
  const changed = [...r.files].filter(([p, t]) => !existsSync(join(instanceRoot, p)) || readFileSync(join(instanceRoot, p), "utf-8") !== t).map(([p]) => p);
  return { ...r, changed, stale };
}

/** Write the {@link plan}: changed nodes written, stale extracted ones removed. Authored nodes are never touched. */
export function write(instanceRoot: string, only?: string): ReturnType<typeof plan> {
  const p = plan(instanceRoot, only);
  for (const f of p.stale) rmSync(join(instanceRoot, f));
  for (const f of p.changed) {
    mkdirSync(join(instanceRoot, f, ".."), { recursive: true });
    writeFileSync(join(instanceRoot, f), p.files.get(f)!);
  }
  return p;
}

/** The extracted nodes on disk: `provenance: "extracted"` files of the references directory (authored ones are left alone). */
function onDisk(instanceRoot: string, dir: string, only?: string): string[] {
  const abs = join(instanceRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".json") && (!only || f.startsWith(`${only}.`)))
    .filter((f) => {
      try {
        return (JSON.parse(readFileSync(join(abs, f), "utf-8")) as { provenance?: string }).provenance === "extracted";
      } catch {
        return false;
      }
    })
    .map((f) => join(dir, f));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(opt("--instance") ?? ".");
  const only = opt("--entry");
  const check = args.includes("--check");
  const { perEntry, changed, stale } = check ? plan(root, only) : write(root, only);
  const total = perEntry.reduce((s, e) => s + e.references, 0);
  if (check) {
    if (changed.length || stale.length) {
      console.error(`references:extract: ${changed.length} node(s) differ from their sections and ${stale.length} have no list left to come from; run without --check`);
      for (const p of [...changed, ...stale].slice(0, 20)) console.error(`  ${p}`);
      process.exit(1);
    }
    console.log(`references:extract: ${total} reference(s) from ${perEntry.length} document(s), current`);
  } else {
    console.log(`references:extract: ${total} reference(s) from ${perEntry.length} document(s); ${changed.length} written, ${stale.length} removed`);
  }
}
