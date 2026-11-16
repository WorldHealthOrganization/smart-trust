#!/usr/bin/env bun
/**
 * check-ig-citations.ts — every reference an IG page makes is in the KG
 * bibliography.
 *
 * Owner, 2026-11-02: IG references pages were hand-maintained and "need to
 * migrate them all to KG managed", with a "QA check for things not in [the]
 * harnessed biblio". The KG bibliography is the one `bibliography-page.ts`
 * (folio-assistant-core) publishes: every `folio-reference/v1` node in a
 * declared `references` directory, every Dublin Core record in a declared
 * `catalogue` directory, and every entry of a declared `library` directory
 * (bean folio-assistant-djj5, owner 2026-11-03: "any references that were
 * ingested should be under library/"). This gate reads the IG's own pages and reports what
 * they cite that the bibliography does not hold.
 *
 * ## What it reads
 *
 * - The IG's OWN bibliography, declared at the checkout root (`<name>.json`
 *   with `directories`): each directory whose
 *   `graphTypologies` names `references` (one `<key>.json` CSL-JSON node each)
 *   or `catalogue` (`records/<slug>.dc.json`) or `library` (`<slug>/` or
 *   `<group>/<slug>/` holding a `manifest.jsonld`; its slug is its key, its
 *   manifest's `sourceUrl` and `meta.doi` its links, and an ISBN in the slug
 *   its id). Keys, URLs, DOIs, ISBNs and IRIS handles are collected, so a link
 *   to a WHO publication's page names the catalogue record that holds its ISBN.
 *   `references` is read while an IG still holds one; the owner retired it
 *   (bean djj5), and a work that is not ingested is a catalogue record.
 * - The IG's pages, `input/pagecontent/*.md`.
 *
 * ## What it reports
 *
 * - **dangling citation** — a link to an entry's own page
 *   (`…/bibliography/<sub-graph>/<key>/`, folio-assistant-core#678) that no
 *   entry of the IG's bibliography has.
 * - **anchor citation** — a link to `#ref-<key>`. A bibliography entry is a
 *   KG node with its own slash address; the `#ref-` anchors are gone (owner,
 *   2026-11-08: "clean break old IRIs"), so such a link is rewritten to the
 *   entry's page.
 * - **page reference list** — a list written on the page between
 *   `references:begin` / `references:end`. The IG is one document with one
 *   bibliography page, the KG one; a page cites an entry there instead.
 * - **hand-written reference** — a list item or `[N]` paragraph in a
 *   references section (the page `references.md`, or the text under a
 *   heading named References / Bibliography / Sources) that is not written
 *   from the KG (outside `references:begin` / `references:end`) and carries no
 *   link to a bibliography entry. A note that only links works the
 *   bibliography holds passes.
 * - **unlisted link** — an external link in a references section, outside a
 *   generated list, whose URL is no bibliography entry's URL or DOI.
 *
 * ## Ratchet
 *
 * An IG that declares no bibliography (no `references` or `catalogue`
 * directory) has not adopted the KG one yet: its findings are printed as
 * advisories and the gate passes, so a re-pin never turns an untouched site
 * red. Once the IG declares a bibliography, every finding fails the gate.
 *
 * An IG with no references section and no citation is reported as
 * having nothing to judge, and passes.
 *
 *   bun run smart-base/scripts/check-ig-citations.ts [--root <dir>] [--with <layer dir>]... [--json]
 *
 * Exit: 0 every reference is in the bibliography, 1 a finding.
 *
 * @module smart-base/scripts/check-ig-citations
 * @covers references, catalogue, library
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export interface Bibliography {
  keys: Set<string>;
  /** Each entry's own page under the bibliography route: `<sub-graph>/<segment>`. */
  pages: Set<string>;
  urls: Set<string>;
  /** ISBNs and IRIS handles (`10665/N`) of catalogue records: a link that carries one names that record. */
  ids: Set<string>;
  /** Directories read, repo-relative. */
  dirs: string[];
}

export interface Finding {
  file: string;
  line: number;
  rule: "dangling-citation" | "anchor-citation" | "hand-written-reference" | "unlisted-link" | "page-reference-list";
  detail: string;
}

/** A URL as compared: no scheme, no `www.`, no trailing slash or fragment, host lower-cased. */
export function normUrl(u: string): string {
  let s = u.trim().replace(/&amp;/g, "&").replace(/^https?:\/\//i, "").replace(/#.*$/, "").replace(/\/+$/, "");
  s = s.replace(/^www\./i, "");
  const slash = s.indexOf("/");
  return slash < 0 ? s.toLowerCase() : s.slice(0, slash).toLowerCase() + s.slice(slash);
}

const anchorKey = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "-");
/** The path segment of an entry's own page: folio-assistant-core `referenceSegment`. */
export const pageSegment = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^\.+/, "");

function addEntry(b: Bibliography, key: string, urls: unknown[], subgraph?: string): void {
  b.keys.add(key);
  b.keys.add(anchorKey(key));
  if (subgraph) b.pages.add(`${subgraph}/${pageSegment(key)}`);
  for (const u of urls) {
    if (typeof u !== "string" || !u) continue;
    for (const isbn of u.match(/\b97[89]\d{10}\b/g) ?? []) b.ids.add(isbn);
    for (const h of u.match(/\b10665\/\d+\b/g) ?? []) b.ids.add(h);
    if (/^10\.\d+\//.test(u)) b.urls.add(normUrl(`doi.org/${u}`));
    else if (/^https?:\/\//i.test(u)) b.urls.add(normUrl(u));
  }
}

/** The values of a Dublin Core record's identifier fields (`folio-dublin-core/v1` `fields`, or flat keys). */
function dcIdentifiers(r: Record<string, unknown>): unknown[] {
  const out: unknown[] = ([] as unknown[]).concat(r.identifier ?? [], r["dc:identifier"] ?? [], r.url ?? [], r.handle ?? []);
  if (Array.isArray(r.fields)) {
    for (const f of r.fields as { element?: string; values?: { value?: string }[] }[]) {
      if (f?.element === "identifier") for (const v of f.values ?? []) out.push(v?.value);
    }
  }
  return out;
}

/**
 * The IG's own bibliography: the layer declared at `root` (and, for a run
 * with no checkout of its own, the declarations in `extra`). Only the own
 * layer counts: the IG is one document, and its bibliography page lists
 * what the document cites (owner, 2026-11-02: "each document should have a
 * bibliography page which includes referenced content in the document").
 * A work a dependency already holds (a who-iris catalogue record) gets an
 * entry of the IG's own when the IG cites it.
 */
export function readBibliography(root: string, extra: string[] = []): Bibliography {
  const b: Bibliography = { keys: new Set(), pages: new Set(), urls: new Set(), ids: new Set(), dirs: [] };
  for (const base of [root, ...extra]) readDeclared(base, root, b);
  return b;
}

function readDeclared(base: string, root: string, b: Bibliography): void {
  for (const f of readdirSync(base).filter((f) => f.endsWith(".json"))) {
    let decl: { directories?: { id?: string; path?: string; graphTypologies?: string[] }[] };
    try {
      decl = JSON.parse(readFileSync(join(base, f), "utf-8"));
    } catch {
      continue;
    }
    if (!Array.isArray(decl?.directories)) continue;
    for (const d of decl.directories) {
      const t = d.graphTypologies ?? [];
      if (!d.path || !(t.includes("references") || t.includes("catalogue") || t.includes("library"))) continue;
      const dir = join(base, d.path);
      if (!existsSync(dir)) continue;
      // Library entries are bibliography entries, but declaring a library is not
      // adopting the KG bibliography: many IGs hold sources they never cite.
      if (t.includes("references") || t.includes("catalogue")) b.dirs.push(relative(root, dir) || ".");
      if (t.includes("library")) readLibrary(dir, b, d.id);
      if (t.includes("references")) {
        for (const g of readdirSync(dir).filter((g) => g.endsWith(".json"))) {
          try {
            const e = JSON.parse(readFileSync(join(dir, g), "utf-8"));
            addEntry(b, e.id ?? g.replace(/\.json$/, ""), [e.URL, e.DOI, ...(Array.isArray(e.links) ? e.links.map((l: { url?: string }) => l?.url) : [])], d.id);
          } catch {
            /* not a node: check:kind-validators reports it */
          }
        }
      }
      if (t.includes("catalogue")) {
        const rec = join(dir, "records");
        if (!existsSync(rec) || !statSync(rec).isDirectory()) continue;
        for (const g of readdirSync(rec).filter((g) => g.endsWith(".dc.json"))) {
          try {
            const r = JSON.parse(readFileSync(join(rec, g), "utf-8"));
            addEntry(b, g.replace(/\.dc\.json$/, ""), dcIdentifiers(r), d.id);
          } catch {
            /* reported by the catalogue's own gate */
          }
        }
      }
    }
  }
}

/** One library entry: a directory holding `manifest.jsonld`, flat or filed in one concern group. */
function readLibrary(dir: string, b: Bibliography, subgraph?: string): void {
  const entry = (slug: string, at: string): boolean => {
    const m = join(at, "manifest.jsonld");
    if (!existsSync(m)) return false;
    let man: { sourceUrl?: unknown; meta?: { doi?: unknown } } = {};
    try {
      man = JSON.parse(readFileSync(m, "utf-8"));
    } catch {
      /* the library's own gates report it */
    }
    addEntry(b, slug, [man.sourceUrl, man.meta?.doi, slug], subgraph);
    return true;
  };
  for (const g of readdirSync(dir).sort()) {
    const at = join(dir, g);
    if (!statSync(at).isDirectory() || entry(g, at)) continue;
    for (const s of readdirSync(at).sort()) {
      const sat = join(at, s);
      if (statSync(sat).isDirectory()) entry(s, sat);
    }
  }
}

/** Whether the bibliography holds the work a URL names: its URL, DOI, ISBN or IRIS handle. */
export function knownUrl(b: Bibliography, u: string): boolean {
  if (b.urls.has(normUrl(u))) return true;
  return [...(u.match(/\b97[89]\d{10}\b/g) ?? []), ...(u.match(/\b10665\/\d+\b/g) ?? [])].some((id) => b.ids.has(id));
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const REF_HEADING = /^(\d+(\.\d+)*\.?\s+)?(references|bibliography|sources|further reading|works cited|literature)\s*:?$/i;
const CITE = /href="([^"#]*)#ref-([A-Za-z0-9._:+-]+)"|\]\(([^)\s#]*)#ref-([A-Za-z0-9._:+-]+)\)/g;
/** A link to an entry's own page: `…/bibliography/<sub-graph>/<segment>/`. */
const CITE_PAGE = /href="[^"#]*?bibliography\/([^"\/#]+)\/([^"\/#]+)\/"|\]\([^)\s#]*?bibliography\/([^)\/\s#]+)\/([^)\/\s#]+)\/\)/g;
const CITES = /#ref-|bibliography\/[^\s"()\/#]+\/[^\s"()\/#]+\//;
const LINK = /href="(https?:\/\/[^"]+)"|\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g;
/** An HTML comment's end: `-->`, or `--!>`, which browsers also accept. */
const COMMENT_END = /--!?>/;
const ITEM = /^\s*(<li\b|[-*+]\s+\S|\d+[.)]\s+\S|<p[^>]*>\s*\[\d+\]|\[\d+\]\s)/;

/** A line's text, for a report: tags removed until none are left, and any stray `<` or `>` dropped. */
function stripTags(s: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(/<[^<>]*>/g, "");
  } while (s !== prev);
  return s.replace(/[<>]/g, "").replace(/&nbsp;/g, " ").trim();
}

/** A Markdown (`## x`) or HTML (`<h2>x</h2>`) heading: its level and text. */
function heading(line: string): { level: number; text: string } | null {
  const md = HEADING.exec(line);
  if (md) return { level: md[1]!.length, text: stripTags(md[2]!) };
  const html = /^\s*<h([1-6])[^>]*>(.*?)<\/h\1>/i.exec(line);
  return html ? { level: Number(html[1]), text: stripTags(html[2]!) } : null;
}

/** The findings on one page. */
export function judgePage(file: string, src: string, b: Bibliography): Finding[] {
  const out: Finding[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const wholePage = /(^|\/)references\.md$/i.test(file);
  let inGenerated = false;
  let inComment = false;
  let refLevel = wholePage ? 0 : -1; // -1: not in a references section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes("references:begin")) {
      inGenerated = true;
      out.push({ file, line: i + 1, rule: "page-reference-list", detail: "a reference list on the page; the IG's one bibliography page lists its references, and a citation links to its entry there" });
    }
    if (inGenerated) {
      if (line.includes("references:end")) inGenerated = false;
      continue;
    }
    if (inComment) {
      if (COMMENT_END.test(line)) inComment = false;
      continue;
    }
    if (/<!--/.test(line) && !COMMENT_END.test(line)) {
      inComment = true;
      continue;
    }
    const h = heading(line);
    if (h) {
      const level = h.level;
      if (REF_HEADING.test(h.text)) refLevel = wholePage ? 0 : level;
      else if (!wholePage && refLevel > 0 && level <= refLevel) refLevel = -1;
    }
    for (const m of line.matchAll(CITE)) {
      const k = m[2] ?? m[4]!;
      const page = [...b.pages].find((p) => p.endsWith(`/${pageSegment(k)}`));
      out.push({
        file,
        line: i + 1,
        rule: "anchor-citation",
        detail: page ? `#ref-${k} is an anchor; link the entry's own page, bibliography/${page}/` : `#ref-${k} is an anchor, and no entry of the KG bibliography has that key`,
      });
    }
    for (const m of line.matchAll(CITE_PAGE)) {
      const at = `${m[1] ?? m[3]}/${m[2] ?? m[4]}`;
      if (!b.pages.has(at)) out.push({ file, line: i + 1, rule: "dangling-citation", detail: `bibliography/${at}/ is no entry of the KG bibliography` });
    }
    if (refLevel < 0 || h) continue;
    const links = [...line.matchAll(LINK)].map((m) => m[1] ?? m[2] ?? m[3]!);
    for (const u of links) {
      if (!knownUrl(b, u)) out.push({ file, line: i + 1, rule: "unlisted-link", detail: `${u} is no entry's URL in the KG bibliography` });
    }
    if (ITEM.test(line) && !CITES.test(line) && links.length === 0) {
      const text = stripTags(line).replace(/^[-*+]\s+|^\d+[.)]\s+/, "").replace(/\*\*/g, "").trim();
      // A group label ("Implementation tools:") introduces entries; it is not one.
      if (text.length > 3 && !/:$/.test(text)) out.push({ file, line: i + 1, rule: "hand-written-reference", detail: `"${text.slice(0, 90)}${text.length > 90 ? "…" : ""}" is written by hand, not from the KG bibliography` });
    }
  }
  return out;
}

export function judge(root: string, extra: string[] = []): { bib: Bibliography; findings: Finding[]; pages: number } {
  const bib = readBibliography(root, extra);
  const dir = join(root, "input", "pagecontent");
  const findings: Finding[] = [];
  let pages = 0;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      pages++;
      findings.push(...judgePage(`input/pagecontent/${f}`, readFileSync(join(dir, f), "utf-8"), bib));
    }
  }
  return { bib, findings, pages };
}

/** An IG has adopted the KG bibliography once it declares a references or catalogue directory. */
export function adopted(bib: Bibliography): boolean {
  return bib.dirs.length > 0;
}

function main(): void {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root = resolve(at >= 0 ? args[at + 1]! : ".");
  // `--with <dir>`: another directory whose declarations count as the IG's own.
  const extra = args.flatMap((a, i) => (a === "--with" && args[i + 1] ? [resolve(args[i + 1]!)] : []));
  const { bib, findings, pages } = judge(root, extra);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ bibliography: { entries: bib.keys.size, dirs: bib.dirs }, pages, findings }, null, 2));
  } else {
    for (const f of findings) console.error(`${f.file}:${f.line}: ${f.rule}: ${f.detail}`);
    console.log(`ig-citations: ${pages} page(s), bibliography ${bib.dirs.join(", ") || "(none declared)"}; ${findings.length} finding(s)`);
  }
  if (findings.length && !adopted(bib)) {
    console.log("ig-citations: advisory only — this IG declares no KG bibliography yet (no references/catalogue directory); declare one to enforce.");
    process.exit(0);
  }
  process.exit(findings.length ? 1 : 0);
}

if (import.meta.main) main();
