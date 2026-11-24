#!/usr/bin/env bun
/**
 * No page in the published tree carries a block-level HTML tag as escaped TEXT.
 *
 * @module scripts/check-escaped-markup
 * @covers skills, docs — the SOURCE mode judges published markdown bodies in
 *   those two declared graphs. The built-tree mode judges a rendered site,
 *   which is not a declared graph and is covered by `docs-site.yml` instead.
 *
 * ## The failure
 *
 * A malformed opening tag emitted by an include into a MARKDOWN page (e.g.
 * two attributes with no whitespace between them, after a Liquid `-%}`
 * strips a newline) stops Kramdown recognising the block as HTML, so it
 * escapes the whole block and the page shows
 *
 *     <div class="fa-sticky-board fa-landing-board">&lt;article class="fa-sticky …"
 *
 * as visible text. The template is valid source; only the built tree shows
 * the defect, so source checks, `bun test` and declaration checks all pass.
 * This asks the general question — does the built tree contain an escaped
 * block-level tag — for any include and any page.
 *
 * Inline elements are NOT scanned: `&lt;picture&gt;` in a code span or a
 * prose mention of `&lt;source&gt;` is legitimate documentation. A
 * BLOCK-level tag rendered as text never is.
 *
 * ## `<code>` and `<pre>` are excluded
 *
 * Escaped markup inside them is DISPLAYED markup (e.g. a path template like
 * `&lt;section&gt;/&lt;block&gt;/translations/&lt;locale&gt;/block.po`);
 * outside them it is LEAKED markup. Code and pre regions are blanked before
 * scanning.
 *
 * ## Three states
 *
 * - **clean** — no page carries an escaped block tag.
 * - **found** — at least one does. A reader sees markup as words.
 * - **could not determine** — there is no tree to look in. **Not a pass.**
 *
 * Exit 2 on could-not-determine, distinct from exit 1 on a real finding: a
 * check that passes where nobody built the site is green exactly where it is
 * blind.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-escaped-markup.ts ./_site
 *   bun run cat check:escaped-markup -- ./_site
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * Block-level tags whose appearance as escaped text is always a defect.
 *
 * Kept to elements that carry page STRUCTURE. `<picture>`, `<source>`, `<img>`
 * and friends are left out on purpose — they are written about in prose here,
 * and a check that fires on documentation is a check that gets switched off.
 */
export const BLOCK_TAGS = [
  "article",
  "section",
  "aside",
  "nav",
  "main",
  "header",
  "footer",
  "figure",
  "ul",
  "ol",
  "table",
] as const;

/** One escaped block tag found in one built page. */
export interface EscapedTag {
  /** Path of the page, relative to the built tree. */
  page: string;
  /** The tag name, without brackets. */
  tag: string;
  /** Whether it was the opening or the closing tag. */
  kind: "open" | "close";
  /** A trimmed excerpt, for a report somebody can act on without grepping. */
  excerpt: string;
}

/**
 * A page is a candidate when it is HTML. Anything else in a built tree — assets,
 * JSON, the render log — may legitimately contain escaped markup as DATA.
 */
function isHtml(name: string): boolean {
  return name.endsWith(".html") || name.endsWith(".htm");
}

/** Every `.html` file beneath `dir`, depth-first. */
export function htmlPages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && isHtml(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/**
 * Blank every `<code>` and `<pre>` region, preserving byte offsets.
 *
 * Replacing rather than deleting keeps every later `index` meaningful, so an
 * excerpt still quotes the page a reader would open. Exported because the
 * exclusion is the check's one judgement call and therefore the thing a test
 * must be able to aim at directly.
 */
export function blankCodeRegions(html: string): string {
  return html.replace(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/g, (m) => " ".repeat(m.length));
}

/**
 * Find escaped block tags in one page's text.
 *
 * Matches `&lt;article` and `&lt;/article&gt;` shapes. The opening form requires
 * the tag name to be followed by whitespace or `&gt;`, so `&lt;articles` in prose
 * about the word does not register.
 */
export function escapedTagsIn(page: string, html: string): EscapedTag[] {
  const found: EscapedTag[] = [];
  const scannable = blankCodeRegions(html);
  for (const tag of BLOCK_TAGS) {
    const open = new RegExp(`&lt;${tag}(?=[\\s]|&gt;)`, "g");
    const close = new RegExp(`&lt;/${tag}&gt;`, "g");
    for (const [re, kind] of [
      [open, "open"],
      [close, "close"],
    ] as const) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(scannable)) !== null) {
        found.push({
          page,
          tag,
          kind,
          // Excerpt from the ORIGINAL, so the report quotes what is on the page
          // rather than the blanked copy the scan ran over.
          excerpt: html.slice(m.index, m.index + 110).replace(/\s+/g, " ").trim(),
        });
      }
    }
  }
  return found;
}

/** One markdown table that reached the page as a paragraph of pipes. */
export interface LeakedTable {
  /** Path of the page, relative to the built tree. */
  page: string;
  /** The header row as it reads on the page, trimmed. */
  excerpt: string;
}

/**
 * A markdown table's DELIMITER row, as it reads once kramdown has given up on it.
 *
 * Kramdown's typographic pass turns `---` into an em dash, so on the page the
 * row is `|—|—|—|—|` rather than `|---|---|` — and a longer run comes out MIXED,
 * `——-` or `—–`. So a cell is any run of hyphens, en and em dashes (or their
 * entities), with the `:---:` alignment colons, because which spelling a build
 * emits is the converter's choice and not a fact to rely on.
 *
 * ## Where the row may sit
 *
 * Kramdown keeps the paragraph's lines, so the row is usually a line of its
 * own — but the LAST row of a leaked table closes the paragraph on the same
 * line, `|—|—|</p>`, and the first may open it, `<p>|—|`. So a row starts at a
 * line start or straight after a tag's `>`, and ends at a line end or right
 * before a `<`. A header-only table (no body rows) leaks in exactly that
 * shape, which is why the first, `$`-anchored version of this pattern missed
 * every one of them.
 *
 * One cell is enough: a one-column table leaks as `|—|`. Without the leading
 * pipe, GFM still reads `---|---`, so that spelling counts from two cells up.
 */
const DASH_RUN = String.raw`(?:[-—–]|&mdash;|&ndash;|&#8212;|&#8211;)+`;
const DELIMITER_CELL = String.raw`[ \t]*:?${DASH_RUN}:?[ \t]*`;
/**
 * The whole of one candidate segment is a delimiter row. A row holds no `<`,
 * `>` or line break, so a match always spans one segment from boundary to
 * boundary: a line start or `>` before it, a line end or `<` after it. Testing
 * only the segments that hold a `|` (every row has one) finds exactly what a
 * `(?<=^|>)…(?=$|<)` scan with the `m` flag finds, without a lookbehind tried
 * at every character of every page — on a 29,727-page site that scan took
 * longer than the job's whole time limit.
 */
const DELIMITER_ROW = new RegExp(
  String.raw`^[ \t]*(?:\|(?:${DELIMITER_CELL}\|)+|${DELIMITER_CELL}(?:\|${DELIMITER_CELL})+\|?)[ \t]*$`,
);

/** A character `^` or `$` stops at under the `m` flag. */
const isLineBreak = (c: string): boolean => c === "\n" || c === "\r" || c === "\u2028" || c === "\u2029";

/** Where each delimiter row in `text` starts, in order. */
export function delimiterRowStarts(text: string): number[] {
  const starts: number[] = [];
  let pipe = text.indexOf("|");
  while (pipe !== -1) {
    let start = pipe;
    while (start > 0 && text[start - 1] !== ">" && !isLineBreak(text[start - 1]!)) start -= 1;
    // A `>` ends this segment too, but a row cannot end there: it starts the next one.
    let end = pipe;
    while (end < text.length && text[end] !== "<" && text[end] !== ">" && !isLineBreak(text[end]!)) end += 1;
    if (text[end] !== ">" && DELIMITER_ROW.test(text.slice(start, end))) starts.push(start);
    pipe = text.indexOf("|", end);
  }
  return starts;
}

/**
 * Plain text for a report, never HTML: each `<…>` tag is dropped whole, and any
 * angle bracket a nested or broken tag left behind goes too, so the result holds
 * no `<` or `>` at all. One pass over the characters; the same output as
 * removing `<[^>]+>` and then `[<>]`.
 */
export function plainText(x: string): string {
  let out = "";
  for (let i = 0; i < x.length; i += 1) {
    const c = x[i]!;
    if (c === "<") {
      const close = x.indexOf(">", i + 1);
      if (close > i + 1) i = close;
      continue;
    }
    if (c !== ">") out += c;
  }
  return out;
}

/**
 * The text of the last non-empty line above `at`, as plain text: a line ends at
 * a newline or a `<br>`. Reads backwards in growing windows, so a page with many
 * leaked tables is not re-split from its first byte once per table.
 */
function lineAbove(html: string, at: number): string {
  for (let size = 4096; ; size *= 4) {
    const from = Math.max(0, at - size);
    const pieces = html
      .slice(from, at)
      .split(/\n|<br\s*\/?>/i)
      .map((x) => plainText(x).replace(/\s+/g, " ").trim());
    // The first piece may be cut by the window, so it counts only at the start of the page.
    for (let i = pieces.length - 1; i >= (from === 0 ? 0 : 1); i -= 1) if (pieces[i]!.length > 0) return pieces[i]!;
    if (from === 0) return "";
  }
}

/**
 * Blank every region whose text is not prose, preserving byte offsets: the
 * `<code>`/`<pre>` of {@link blankCodeRegions}, and `<script>`, `<style>` and
 * `<textarea>`, whose contents are data a page carries, never a table it shows.
 */
export function blankRawRegions(html: string): string {
  return blankCodeRegions(html).replace(/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length));
}

/**
 * Find markdown tables that were printed as text.
 *
 * ## The failure this exists for — bean `7w1a`
 *
 * The methodologies page shipped with its whole selection table as a paragraph
 * of pipes: a truncated cell cut a code span open, the stray backtick paired
 * with one in a later cell, and kramdown stopped reading the block as a table.
 * Every source-side test was green, because the SOURCE was a well-formed table
 * except for one backtick, and the column test counts pipes. Only the built
 * page shows it — the same lesson as the escaped `<article>`, one syntax over.
 *
 * ## And the two it then missed
 *
 * A table with a header and delimiter but no body row — kramdown drops it and
 * leaves a paragraph ending `|—|—|</p>` — and a table straight under a heading
 * with no blank line between. Thirty-one generated pages shipped the first;
 * neither was reported, because the row did not end its line.
 *
 * A delimiter row is never prose. Inside `<code>`/`<pre>` it is a document
 * SHOWING a table's source, and inside `<script>`/`<style>`/`<textarea>` it is
 * data, so those regions are blanked first.
 */
export function leakedTablesIn(page: string, html: string): LeakedTable[] {
  const found: LeakedTable[] = [];
  const scannable = blankRawRegions(html);
  for (const at of delimiterRowStarts(scannable)) {
    // The header row is the text just above the delimiter: that is what a
    // reader would recognise, and what names the table in a report.
    found.push({ page, excerpt: lineAbove(html, at).slice(0, 110) });
  }
  return found;
}

/** Scan a built tree. */
export function checkEscapedMarkup(siteDir: string): {
  pages: number;
  found: EscapedTag[];
  leakedTables: LeakedTable[];
} {
  const pages = htmlPages(siteDir);
  const found: EscapedTag[] = [];
  const leakedTables: LeakedTable[] = [];
  for (const p of pages) {
    const html = readFileSync(p, "utf-8");
    found.push(...escapedTagsIn(relative(siteDir, p), html));
    leakedTables.push(...leakedTablesIn(relative(siteDir, p), html));
  }
  return { pages: pages.length, found, leakedTables };
}

/* ────────────────────────────────────────────────────────────────────────────
 * THE SOURCE SIDE — the CAUSE, where the built-tree scan above sees the EFFECT
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Markdown source lines that open a raw HTML block kramdown will never close.
 *
 * ## The mechanism, and why the built-tree scan cannot prevent it
 *
 * A markdown line whose FIRST character is `<` followed by a name makes
 * kramdown open a raw HTML block. With no matching close tag the rest of the
 * page stays raw, so every heading, list and table after it renders as literal
 * text. The usual cause is an inline code span **wrapped across a line break**,
 * leaving its continuation at column 0 — `page_start == page_end ==` then
 * `<slide>\`` on the next line.
 *
 * The scan above catches this, but only on a BUILT tree, and the build runs in
 * `docs-site.yml` AFTER merge. Measured on main 2026-10-01:
 * `check:escaped-markup` occurs **once** in all of `.github/workflows/` and
 * **zero** times in `code-quality-gates.yml`. So a pull request could not fail
 * on it, and five of these shipped green and reddened `main`:
 *
 * | fixed in | the line that opened the block |
 * |---|---|
 * | `7w1a` (four at once) | `<agentId>`, `<branch>`, `<file.json>`, `<name>.config.json` |
 * | #1726 / #1730 | `<slide>` — nine consecutive `Docs site` failures on `main` |
 *
 * Each was repaired by reflowing the one source that had it. Bean `7pp6`: a
 * fix repeated five times is a missing gate, not five accidents.
 *
 * ## Both axes are narrowed, and the sweep is why
 *
 * A sweep of 2314 markdown files returned 6 column-0 matches. **Four were not
 * this defect** — two autolinks `<https://…>`, one real `<caption>`, and the
 * generated copy of the fifth. Designing from the one example would have
 * produced a check that fires on valid markdown and on the
 * `<details markdown="1">` that `7w1a` DELIBERATELY introduced. `BLOCK_TAGS`
 * above states the stake: *a check that fires on documentation is a check that
 * gets switched off.*
 *
 * - **SCOPE** — the caller names the directories, and generated reference trees
 *   are excluded by {@link GENERATED_PREFIXES}: those must never be hand-edited,
 *   so flagging one points at the wrong file. The SOURCE carries the defect.
 * - **STATE** — column 0 only, outside fenced regions and front matter. A
 *   `` `<slug>` `` mid-line is the normal, safe way to write a placeholder; the
 *   defect is specifically a span wrapped so its continuation begins a line.
 *
 * **Deliberately not covered:** ingested `library/` content. One latent instance
 * is there — Lean anonymous-constructor syntax `<kunnethMap_injective C D n,`
 * in the formal-math layer's `library/arxiv-2602.16554v1/sections/sec-014-…md` —
 * and `library/` publishes **0 of 1460** built pages, so covering it would fail
 * a gate over a page nobody renders. Recorded on `7pp6` rather than swept in.
 *
 * **Why the directories are arguments rather than derived:** resolving them from
 * the instance declarations was tried first. `resolveDirectories` over the local
 * root alone returns 5 graph typologies, not the full declared set, and a sweep that
 * under-matches reads as a clean corpus — so the scope is explicit and the
 * zero-file guard in `main` is what stops a wrong path passing.
 */

/** Element names that are REAL html here, so a line may legitimately open with one. */
export const MARKDOWN_HTML_NAMES: ReadonlySet<string> = new Set([
  "a", "abbr", "article", "aside", "audio", "b", "blockquote", "br", "button",
  "caption", "code", "col", "colgroup", "dd", "details", "div", "dl", "dt", "em",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "i", "iframe", "img", "input", "kbd", "label", "li", "main",
  "nav", "noscript", "ol", "p", "picture", "pre", "s", "script", "section", "small", "source",
  "span", "strong", "style", "sub", "summary", "sup", "svg", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul", "video",
]);

/**
 * Generated trees, excluded on purpose.
 *
 * `AGENTS.md`: *"Never hand-edit either generated dir."* A finding there names a
 * file nobody may fix, while the source that produced it goes unreported — so
 * the check would be both useless and actively misleading. The built-tree scan
 * still covers whatever a generator emits that no source line explains.
 *
 * **A SEGMENT, not a prefix, and a test is why.** The first spelling was
 * `docs/reference/skill-instructions/` matched against the path relative to the
 * SCAN directory — so scanning `cat-harness/docs` produced
 * `reference/skill-instructions/…`, the prefix never matched, and the generated
 * tree was scanned after all. The exclusion silently did nothing; only an
 * assertion over the real walk found it.
 */
export const GENERATED_SEGMENTS = [
  "/reference/skill-instructions/",
  "/reference/skills/",
] as const;

/** One markdown line that opens a raw HTML block. */
export interface SourceLeak {
  /** Path as given to the scanner. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** The name kramdown will read as a tag. */
  tag: string;
  /** The line, trimmed for the report. */
  excerpt: string;
}

/**
 * Column-0 pseudo-tags in one markdown source.
 *
 * Front matter is skipped because a `---` delimited header is YAML, not
 * markdown, and kramdown never sees it. Fenced regions are skipped because
 * their whole point is that the converter does not read them — and an INDENTED
 * code block cannot trip this check at all, since a line indented four spaces
 * does not begin with `<`. That is the column-0 rule paying for itself.
 */
export function leakingLinesIn(file: string, text: string): SourceLeak[] {
  const out: SourceLeak[] = [];
  const lines = text.split("\n");
  let fence: string | undefined;
  let i = 0;

  // YAML front matter: only when `---` is the very first line.
  if (lines[0]?.trim() === "---") {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== "---") i += 1;
    i += 1;
  }

  for (; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const opener = /^\s*(```+|~~~+)/.exec(line);
    if (opener !== undefined && opener !== null) {
      const marker = opener[1]!.slice(0, 3);
      if (fence === undefined) fence = marker;
      else if (marker === fence) fence = undefined;
      continue;
    }
    if (fence !== undefined) continue;

    // Column 0 only. An html comment is not a tag, and `<` not followed by a
    // letter cannot open one.
    if (!line.startsWith("<") || line.startsWith("<!")) continue;
    const m = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(line);
    if (m === null) continue;

    // An autolink — `<https://…>`, `<mailto:…>` — is valid markdown, and two of
    // them are in this corpus. The scheme is what distinguishes it from a tag.
    if (/^<\/?[A-Za-z][A-Za-z0-9+.-]*:/.test(line)) continue;

    const tag = m[1]!;
    // A dotted name is never an element: `<file.json>`, `<name>.config.json`.
    if (MARKDOWN_HTML_NAMES.has(tag.toLowerCase()) && !tag.includes(".")) continue;
    out.push({ file, line: i + 1, tag, excerpt: line.trim().slice(0, 90) });
  }
  return out;
}

/** A markdown pipe table that kramdown will print as a paragraph. */
export interface SourceTable {
  /** Path as given to the scanner. */
  file: string;
  /** 1-based line number of the table's header row. */
  line: number;
  /**
   * `no-body` — a header and delimiter with no row under them, which kramdown
   * drops; `no-blank-line` — the header follows a non-blank line (a heading
   * included), so kramdown reads the table as part of that block.
   */
  defect: "no-body" | "no-blank-line";
  /** The header row, trimmed for the report. */
  excerpt: string;
}

/** A GFM delimiter row in SOURCE: hyphen cells, optional colons, at least one pipe. */
const SOURCE_DELIMITER = /^ {0,3}(?:\|?(?:[ \t]*:?-+:?[ \t]*\|)+(?:[ \t]*:?-+:?[ \t]*)?|[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?)[ \t]*$/;

/** A line that can be a table row: it carries a pipe and is not indented code. */
function isPipeRow(line: string): boolean {
  return line.includes("|") && !/^(?: {4}|\t)/.test(line);
}

/**
 * Pipe tables in one markdown source that will not render as tables.
 *
 * The built-tree scan above sees these once they have leaked; this sees the
 * cause, so a pull request fails before the site is built. A table is a pipe
 * row followed by a {@link SOURCE_DELIMITER} row, where the pipe row is the
 * FIRST of its block — so a body row of `| - | - |` inside a table is not
 * mistaken for a second table's delimiter.
 *
 * - **no-body** — nothing under the delimiter, or a line with no pipe. A line
 *   opening a Liquid tag (`{%`) is left alone: the rows may be generated there.
 * - **no-blank-line** — the line above the header is not blank. A heading
 *   counts against it too: kramdown needs the blank line after a heading
 *   before it reads a table.
 *
 * Front matter and fenced regions are skipped, as in {@link leakingLinesIn}.
 */
export function brokenTablesIn(file: string, text: string): SourceTable[] {
  const out: SourceTable[] = [];
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const skip = new Array<boolean>(lines.length).fill(false);
  let start = 0;
  if (lines[0]?.trim() === "---") {
    start = 1;
    while (start < lines.length && lines[start]?.trim() !== "---") start += 1;
    start += 1;
    for (let k = 0; k < Math.min(start, lines.length); k += 1) skip[k] = true;
  }
  let fence: string | undefined;
  for (let i = start; i < lines.length; i += 1) {
    const opener = /^\s*(```+|~~~+)/.exec(lines[i] ?? "");
    if (opener !== null) {
      const marker = opener[1]!.slice(0, 3);
      if (fence === undefined) fence = marker;
      else if (marker === fence) fence = undefined;
      skip[i] = true;
      continue;
    }
    if (fence !== undefined) skip[i] = true;
  }

  for (let i = start + 1; i < lines.length; i += 1) {
    const delim = lines[i] ?? "";
    const header = lines[i - 1] ?? "";
    if (skip[i] || skip[i - 1] || !SOURCE_DELIMITER.test(delim) || !isPipeRow(header)) continue;
    const above = i - 2 >= start ? lines[i - 2] : undefined;
    // The header must OPEN its block: a pipe row above it means this is a body
    // row of dashes inside a table that began earlier.
    if (above !== undefined && !skip[i - 2] && isPipeRow(above) && !/^\s*#/.test(above)) continue;
    const excerpt = header.trim().slice(0, 90);

    const below = lines[i + 1];
    const liquid = below !== undefined && /^\s*\{%/.test(below);
    if (!liquid && (below === undefined || skip[i + 1] || !isPipeRow(below) || below.trim() === "")) {
      out.push({ file, line: i, defect: "no-body", excerpt });
    }
    if (above !== undefined && !skip[i - 2] && above.trim() !== "") {
      out.push({ file, line: i, defect: "no-blank-line", excerpt });
    }
  }
  return out;
}

/** Every `.md` beneath `dir`, depth-first, skipping the generated trees. */
export function markdownSources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".md")) {
        // Matched on the ABSOLUTE path: a prefix relative to the scan dir
        // depends on where the caller started, which is how the first version
        // of this exclusion came to do nothing at all.
        const abs = `/${resolve(p).split(sep).join("/").replace(/^\/+/, "")}`;
        if (GENERATED_SEGMENTS.some((g) => abs.includes(g))) continue;
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

/** Scan markdown sources under each directory. */
export function checkSourceLeaks(dirs: readonly string[]): {
  files: number;
  found: SourceLeak[];
  tables: SourceTable[];
} {
  const found: SourceLeak[] = [];
  const tables: SourceTable[] = [];
  let files = 0;
  for (const dir of dirs) {
    for (const p of markdownSources(dir)) {
      files += 1;
      const rel = relative(process.cwd(), p);
      const text = readFileSync(p, "utf-8");
      found.push(...leakingLinesIn(rel, text));
      tables.push(...brokenTablesIn(rel, text));
    }
  }
  return { files, found, tables };
}

function sourceMain(args: readonly string[]): void {
  if (args.length === 0) {
    console.error("usage: check-escaped-markup --source <dir> [<dir>…]");
    console.error("  Nothing was checked. That is `could not determine`, not a pass.");
    process.exit(2);
  }
  const dirs: string[] = [];
  for (const a of args) {
    const d = resolve(a);
    if (!existsSync(d) || !statSync(d).isDirectory()) {
      console.error(`could not determine: ${a} is not a directory.`);
      process.exit(2);
    }
    dirs.push(d);
  }

  const { files, found, tables } = checkSourceLeaks(dirs);
  if (files === 0) {
    // The same vacuity guard the built-tree mode carries, for the same reason:
    // a green run over zero files reads as coverage that is not there (`dh4f`).
    console.error(`could not determine: no .md under ${args.join(", ")}.`);
    console.error("  Either these are the wrong directories or the tree is empty.");
    process.exit(2);
  }

  if (tables.length > 0) {
    console.error(`✗ ${tables.length} markdown table(s) that will render as text, across ${files} source(s):\n`);
    for (const t of tables) console.error(`    · ${t.file}:${t.line}  ${t.defect}  ${t.excerpt}`);
    console.error(
      "\nKramdown drops a pipe table with no body row, and reads a table whose header follows a\n" +
        "non-blank line — a heading included — as part of that block. Either way the page shows\n" +
        "the rows as a paragraph, the delimiter typeset as dashes. Add a blank line above the\n" +
        "header; for a table with no rows, write a sentence instead of the table.\n",
    );
  }
  if (found.length > 0) {
    console.error(`✗ ${found.length} line(s) open a raw HTML block, across ${files} markdown source(s):\n`);
    for (const f of found) console.error(`    · ${f.file}:${f.line}  <${f.tag}>  ${f.excerpt}`);
    console.error(
      "\nA markdown line whose FIRST character is `<` makes kramdown open a raw HTML block,\n" +
        "and with no closing tag the REST OF THE PAGE stays raw — headings, lists and tables\n" +
        "after it render as literal text. The usual cause is an inline code span wrapped across\n" +
        "a line break, leaving its continuation at column 0.\n\n" +
        "Reflow the line so nothing begins with `<`, or wrap the placeholder in a code span and\n" +
        "keep it on one line. This is bean `7pp6`; the same defect was repaired by hand five\n" +
        "times before this check existed (`7w1a` four, #1730 one), each time only after it had\n" +
        "already reddened `main`.",
    );
    process.exit(1);
  }
  if (tables.length > 0) process.exit(1);
  console.log(`✓ no markdown source line opens a raw HTML block or breaks a table, across ${files} source(s)`);
}

function main(): void {
  if (process.argv[2] === "--source") {
    sourceMain(process.argv.slice(3));
    return;
  }
  const dir = process.argv[2];
  if (dir === undefined) {
    console.error("usage: check-escaped-markup <built-site-dir>");
    console.error("         check-escaped-markup --source <dir> [<dir>…]");
    console.error("  Nothing was checked. That is `could not determine`, not a pass.");
    process.exit(2);
  }
  const siteDir = resolve(dir);
  if (!existsSync(siteDir) || !statSync(siteDir).isDirectory()) {
    console.error(`could not determine: ${dir} is not a directory.`);
    console.error("  Assemble the site first. An unbuilt tree clears nothing.");
    process.exit(2);
  }

  const { pages, found, leakedTables } = checkEscapedMarkup(siteDir);
  if (pages === 0) {
    // Vacuity guard: a green run over zero pages reads as coverage that is not
    // there, which is the whole failure mode this script was written after.
    console.error(`could not determine: no .html under ${dir}.`);
    console.error("  Either the build wrote nothing or this is reading the wrong tree.");
    process.exit(2);
  }

  if (leakedTables.length > 0) {
    console.error(`✗ ${leakedTables.length} markdown table(s) printed as text across ${pages} page(s):\n`);
    for (const t of leakedTables) console.error(`    · ${t.page}  ${t.excerpt}`);
    console.error(
      "\nThe converter did not read these as tables, so the reader sees rows of pipes. The usual\n" +
        "cause is one cell that leaves a code span open — an odd number of backticks on the row —\n" +
        "or a pipe inside a cell that is not escaped. Look at the source row, then the built page.\n",
    );
  }
  if (found.length > 0) {
    console.error(`✗ ${found.length} escaped block tag(s) across ${pages} page(s):\n`);
    const byPage = new Map<string, EscapedTag[]>();
    for (const f of found) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f]);
    for (const [page, tags] of byPage) {
      console.error(`  ${page}`);
      for (const t of tags) console.error(`    · <${t.kind === "close" ? "/" : ""}${t.tag}>  ${t.excerpt}`);
    }
    console.error(
      "\nA block-level tag rendered as TEXT means the markdown converter refused it as HTML,\n" +
        "which almost always means the opening tag is malformed. The usual cause is a Liquid\n" +
        "whitespace strip (`-%}`) eating the separator between two attributes, so the tag\n" +
        "reads `…value=\"x\"next-attr=…`. Look at the built page, not the template: the\n" +
        "template is generally valid HTML and only the build shows what happened to it.",
    );
    process.exit(1);
  }
  if (leakedTables.length > 0) process.exit(1);
  console.log(`✓ no escaped block-level markup and no table printed as text across ${pages} page(s)`);
}

if (import.meta.main) main();
