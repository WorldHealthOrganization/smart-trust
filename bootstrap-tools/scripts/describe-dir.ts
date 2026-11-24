/**
 * What a file or a directory IS, read from itself — extractive, offline, no
 * model.
 *
 * @module bootstrap-tools/scripts/describe-dir
 * @covers code
 *
 * The directory READMEs (`subgraph-readmes.ts`) describe each row from the
 * Knowledge Graph first: a directory's declared `description`, or one the
 * calling harness resolved for a subdirectory. Most subdirectories are not
 * declared, and a table of "_nothing declares what this holds_" told a reader
 * on GitHub nothing about, say, a paper's directory whose manifest names the
 * paper on its first line (owner, 2026-11-18: *"README.md's should be more
 * intelligent on their render and summarize the contents of their
 * subgraph/dir better"*).
 *
 * So an undeclared subdirectory is described from what it holds, by the first
 * of these that yields a line ({@link describeSubdirectory}):
 *
 * 1. its own `README.md` — the first paragraph of prose, else its heading;
 * 2. a self-describing file in it, in {@link SELF_DESCRIBING} order: a
 *    manifest named after the directory (`<dir>/<dir>.json`, `.ts`, `.js`),
 *    then the conventional `package.json`, `manifest.json`, `index.json`,
 *    `structure.json`, `summary.json`, `index.ts`, `index.js`, `__init__.py`;
 * 3. failing all of those, the KINDS of file it holds (`.md`, `.ts`, …).
 *
 * Every answer but the last says where it came from, so a reader can tell a
 * derived line from a declared one and knows which file to edit to change it.
 *
 * ## What it will not print: a count
 *
 * Bean `ba9e`: a file count changes on every commit that adds a file, and 207
 * such counts in 54 committed READMEs made almost every merge conflict. The
 * kinds fallback is therefore a SET of extensions in name order — invariant
 * under adding a file of a kind already there. Nothing here returns a number.
 *
 * ## Only committed files are read
 *
 * The caller passes the list of files it lists (the committed tree), and a
 * source is consulted only when it is in that list, so an untracked scratch
 * file can never move a committed README.
 */
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** How much of a file is read to describe it: its opening, never a whole archive. */
export const HEAD_BYTES = 16384;

/** The first {@link HEAD_BYTES} of a file, as UTF-8. */
export function headOf(path: string, bytes = HEAD_BYTES): string {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString("utf-8");
  } finally {
    closeSync(fd);
  }
}

/** Longest line a table cell carries before it is cut with `…`. */
export const CELL_CHARS = 160;

/**
 * Collapse whitespace, drop markdown emphasis and links (keeping their text),
 * and cut at {@link CELL_CHARS}. A cut never leaves a code span open: an odd
 * backtick is dropped with what follows it, since an unclosed span would
 * swallow the rest of the table row.
 */
export function oneLine(text: string, max = CELL_CHARS): string {
  const flat = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\*\*|__/g, "")
    .trim();
  return cut(flat, max);
}

/** `s` cut to `max` characters with `…`, never leaving a code span open. */
/**
 * HTML comments removed by a scanner, not a regular expression: from each
 * `<!--` to the nearest `-->` or `--!>` (both end a comment in HTML), and an
 * unterminated `<!--` to the end of the text, repeated until nothing it
 * returns contains `<!--` (a crafted `<!<!---->--` cannot rebuild one).
 */
export function stripHtmlComments(text: string): string {
  // Joining the text on either side of a removed comment can form a new
  // opener ("<!<!---->--x" -> "<!--x"), so repeat until none is left. Each
  // pass removes at least four characters, so this ends.
  let s = text;
  while (s.includes("<!--")) s = stripOnce(s);
  return s;
}

function stripOnce(text: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const open = text.indexOf("<!--", i);
    if (open === -1) return out + text.slice(i);
    out += text.slice(i, open);
    const ends = [text.indexOf("-->", open + 4), text.indexOf("--!>", open + 4)].filter((e) => e !== -1);
    if (ends.length === 0) return out;
    const end = Math.min(...ends);
    i = end + (text.startsWith("--!>", end) ? 4 : 3);
  }
}

/**
 * Text read out of an arbitrary file, made safe for a markdown table cell:
 * comments removed ({@link stripHtmlComments}), then every `<` outside a code
 * span written `&lt;`, so no raw HTML (a tag, or a comment opener left by
 * anything upstream) reaches the README. `|` is escaped later, where the row
 * is written.
 */
export function cellSafe(text: string): string {
  return stripHtmlComments(text)
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/</g, "&lt;")))
    .join("");
}

function cut(s: string, max: number): string {
  s = cellSafe(s);
  if (s.length <= max) return s;
  let head = s.slice(0, max - 3).trimEnd();
  if ((head.match(/`/g) ?? []).length % 2 === 1) head = head.slice(0, head.lastIndexOf("`")).trimEnd();
  return `${head}…`;
}

/**
 * The summary line of a block of documentation: the first sentence of its
 * first paragraph. A doc comment usually opens on a title line followed by a
 * blank line, and running the title into the next paragraph made one long
 * false sentence ("…Diffraction Paper by Roger Bach…").
 */
export function summaryLine(doc: string): string {
  const para = doc.trim().split(/\n\s*\n/)[0] ?? "";
  return firstSentence(para);
}

/** The first sentence of `text`, markdown emphasis removed, at most ~160 characters. */
export function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").replace(/\*\*|__/g, "").trim();
  const end = flat.search(/[.!?](\s|$)/);
  return cut(end === -1 ? flat : flat.slice(0, end + 1), CELL_CHARS);
}

/**
 * The text of a file's leading documentation, by its language, or `undefined`.
 *
 * - `.ts` `.tsx` `.js` `.mjs` `.cjs`: the first `/** … *\/` block in the file's
 *   opening lines (imports may precede it), with `@tags` dropped;
 * - `.py`: the module docstring, else the leading `#` comment block;
 * - `.sh` `.bash` `.toml` `.yml` `.yaml` `.rb` `.pl`: the leading `#` block, after a shebang;
 * - `.lean`: the first `/-! … -/` module docstring;
 * - `.feature`: the text of its `Feature:` line.
 *
 * A licence header is not documentation, so a block that opens on a
 * copyright or SPDX line is skipped.
 */
export function leadingDoc(text: string, ext: string): string | undefined {
  const head = text.split("\n").slice(0, 80).join("\n");
  const notLicence = (s: string | undefined) =>
    s !== undefined && s.trim() !== "" && !/^\s*(copyright|spdx-license|\(c\)|licensed under)/i.test(s) ? s : undefined;
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts"].includes(ext)) {
    for (const m of head.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
      const body = m[1]!
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, ""))
        .filter((l) => !/^\s*@\w/.test(l))
        .join("\n");
      const ok = notLicence(body);
      if (ok) return ok;
    }
    return undefined;
  }
  if (ext === ".feature") {
    // Gherkin names itself on its `Feature:` line; the scenarios below are not a summary.
    const m = /^\s*Feature:\s*(.+)$/m.exec(head);
    return notLicence(m?.[1]);
  }
  if (ext === ".lean") {
    const m = /\/-!([\s\S]*?)-\//.exec(text);
    return notLicence(m?.[1]?.replace(/^\s*#+\s*/gm, ""));
  }
  if (ext === ".py") {
    const lines = head.split("\n");
    let i = 0;
    while (i < lines.length && (/^#!|^#.*coding[:=]/.test(lines[i]!) || lines[i]!.trim() === "")) i++;
    const rest = lines.slice(i).join("\n");
    const doc = /^[rRuU]?("""|''')([\s\S]*?)\1/.exec(rest);
    if (doc) return notLicence(doc[2]);
  }
  if ([".py", ".sh", ".bash", ".toml", ".yml", ".yaml", ".rb", ".pl"].includes(ext)) {
    const lines = head.split("\n");
    let i = lines[0]?.startsWith("#!") ? 1 : 0;
    while (i < lines.length && lines[i]!.trim() === "") i++;
    const block: string[] = [];
    for (; i < lines.length && /^\s*#/.test(lines[i]!); i++) block.push(lines[i]!.replace(/^\s*#+\s?/, ""));
    // A rule of `====` or `----` is decoration, not a sentence.
    return notLicence(block.filter((l) => !/^[\s=\-*#_~]*$/.test(l)).join("\n"));
  }
  return undefined;
}

/**
 * The noun for a file nothing inside describes, by its extension. Neutral on
 * purpose: it names what KIND of thing the file is and claims nothing about
 * its content.
 */
const KIND_NOUNS: Array<[RegExp, string]> = [
  [/\.(tar\.gz|tgz|tar|zip|gz|bz2|xz|7z)$/i, "a compressed archive"],
  [/\.pdf$/i, "a PDF document"],
  [/\.(png|jpe?g|gif|webp|bmp|ico)$/i, "an image"],
  [/\.(lock|lockb)$|^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock)$/i, "a dependency lockfile"],
  [/\.(csv|tsv)$/i, "tabular data"],
  [/\.(ttl|nq|nt|rdf|owl)$/i, "RDF data"],
  [/\.(html?)$/i, "a web page"],
  [/\.(css|scss)$/i, "a stylesheet"],
  [/\.(woff2?|ttf|otf)$/i, "a font"],
  [/\.(mp4|webm|mov|mp3|wav|ogg)$/i, "media"],
];

/** {@link KIND_NOUNS}' answer for `name`, or `undefined`. */
export function kindNoun(name: string): string | undefined {
  return KIND_NOUNS.find(([re]) => re.test(name))?.[1];
}

/**
 * A plain-text file's first line, when it reads as a title: at least two words
 * of three letters or more. A data file's first line (`1 a0dsskgw A T O M I C`)
 * is not one, and is not printed.
 */
export function textTitle(text: string): string | undefined {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l !== "");
  if (line === undefined) return undefined;
  const words = line.match(/\p{L}{3,}/gu) ?? [];
  return words.length >= 2 ? oneLine(line) : undefined;
}

/**
 * A JSON object's own name for itself: the first string among `title`,
 * `metadata.title`, `label`, `description`, `summary` and `brief`. The order
 * puts a name before a paragraph, so a document's title wins over its
 * abstract.
 */
export function jsonTitle(j: unknown): string | undefined {
  if (typeof j !== "object" || j === null || Array.isArray(j)) return undefined;
  const o = j as Record<string, unknown>;
  const meta = typeof o.metadata === "object" && o.metadata !== null ? (o.metadata as Record<string, unknown>) : {};
  for (const v of [o.title, meta.title, o.label]) if (typeof v === "string" && v.trim() !== "") return oneLine(v);
  for (const v of [o.description, o.summary, o.brief]) if (typeof v === "string" && v.trim() !== "") return firstSentence(v);
  return undefined;
}

/**
 * A README's own account of what it describes: its first paragraph of prose,
 * else its first heading.
 *
 * Skipped on the way: front matter, HTML comments and tags, block quotes (the
 * generated-by banner is one), headings, lists, tables, fences and badge or
 * image lines. Two paragraphs are this writer's own and say nothing about the
 * directory, so they are not taken: the placeholder *"No description is
 * declared for …"* and the *"Part of …"* line.
 */
export function readmeSummary(md: string, dirName?: string): string | undefined {
  let text = stripHtmlComments(md.replace(/^---\n[\s\S]*?\n---\n/, ""));
  text = text.replace(/```[\s\S]*?```/g, "");
  let heading: string | undefined;
  for (const block of text.split(/\n\s*\n/)) {
    const b = block.trim();
    if (b === "") continue;
    const h = /^#{1,6}\s+(.+)$/m.exec(b);
    if (h && b.startsWith("#")) {
      heading ??= h[1]!.replace(/`/g, "").trim();
      continue;
    }
    if (/^(>|<|\||[-*+] |\d+\. |!\[|\[!\[)/.test(b)) continue;
    if (/^_?No description is declared/.test(b) || /^Part of \[/.test(b)) continue;
    // Links are dropped to their text before the cut, so a cut cannot land
    // inside one; the writer links defined terms again afterwards.
    return firstSentence(b.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
  }
  if (heading !== undefined && heading.toLowerCase() !== dirName?.toLowerCase()) return oneLine(heading);
  return undefined;
}

/**
 * The files, relative to a subdirectory, that may describe it — in the order
 * they are tried after its README. `{dir}` is the subdirectory's own name.
 */
export const SELF_DESCRIBING = [
  "{dir}.json",
  "{dir}.ts",
  "{dir}.js",
  "package.json",
  "manifest.json",
  "index.json",
  "structure.json",
  "summary.json",
  "index.ts",
  "index.js",
  "__init__.py",
] as const;

/** How many kinds the fallback names before it says "and others". */
export const KINDS_SHOWN = 5;

/**
 * The kinds of file in `files`, as a phrase: `` `.md`, `.ts` and `.lean` files
 * ``. Name order, so the phrase is invariant under adding a file of a kind
 * already present (bean `ba9e`).
 */
export function kindsPhrase(files: readonly string[]): string {
  const kinds = [...new Set(files.map((f) => {
    const base = f.slice(f.lastIndexOf("/") + 1);
    if (/\.tar\.gz$/i.test(base)) return ".tar.gz";
    const e = extname(base);
    return e === "" ? "(no extension)" : e.toLowerCase();
  }))].sort();
  const shown = kinds.slice(0, KINDS_SHOWN).map((k) => (k.startsWith("(") ? k : `\`${k}\``));
  const list = shown.length <= 1 ? (shown[0] ?? "") : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return `${list}${kinds.length > KINDS_SHOWN ? " and other" : ""} files`;
}

/** A subdirectory's description, and the file it was read from (`""` for the kinds fallback). */
export interface DerivedDescription {
  text: string;
  /** The file it came from, relative to the subdirectory; `""` when it is the kinds of file it holds. */
  from: string;
}

/**
 * What the subdirectory `abs` holds, read from itself.
 *
 * @param files every committed file under it, relative to it — the only files consulted
 * @returns `undefined` only for a subdirectory holding no file at all
 */
export function describeSubdirectory(abs: string, files: readonly string[]): DerivedDescription | undefined {
  if (files.length === 0) return undefined;
  const held = new Set(files);
  const name = abs.replace(/\/+$/, "").slice(abs.replace(/\/+$/, "").lastIndexOf("/") + 1);
  const read = (f: string): string | undefined => {
    const p = join(abs, f);
    try {
      return existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf-8") : undefined;
    } catch {
      return undefined;
    }
  };
  if (held.has("README.md")) {
    const s = readmeSummary(read("README.md") ?? "", name);
    if (s) return { text: s, from: "README.md" };
  }
  for (const pattern of SELF_DESCRIBING) {
    const f = pattern.replace("{dir}", name);
    if (!held.has(f)) continue;
    const text = read(f);
    if (text === undefined) continue;
    let s: string | undefined;
    if (f.endsWith(".json")) {
      try {
        s = jsonTitle(JSON.parse(text));
      } catch {
        s = undefined;
      }
    } else {
      const doc = leadingDoc(text, extname(f));
      s = doc ? summaryLine(doc) : undefined;
    }
    if (s) return { text: s, from: f };
  }
  return { text: kindsPhrase(files), from: "" };
}
