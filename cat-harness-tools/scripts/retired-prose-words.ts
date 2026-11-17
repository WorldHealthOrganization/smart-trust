#!/usr/bin/env bun
/**
 * Words a harness's narrative text has retired, found where they come back.
 *
 * @module scripts/retired-prose-words
 *
 * Work item folio-assistant-dkqd. Owner, 2026-11-04: *"make sure that those
 * notions of beans in the narrative text are changed to work item"*, prose
 * only: the `beans` CLI, `beans/`, `bean/1.0.0` and every other identifier
 * keep their names. The retired words and their replacements are DATA, the
 * `retired-prose-words` code list a layer declares, so this names no word.
 *
 * ## What counts as prose
 *
 * A word is reported only outside these spans, which are left alone because
 * the word in them is a NAME or somebody else's words:
 *
 * - front matter, except the value of `description:`;
 * - fenced code, inline code, link targets, reference definitions, bare URLs;
 * - HTML comments and tags;
 * - headings, because changing one changes its anchor and breaks every link;
 * - double-quoted text: an owner's verbatim words, and §"…" references to a
 *   heading that keeps the old word;
 * - a word joined to an identifier by `-`, `_`, `/`, `.`, `@`, `#` or a backtick.
 *
 * A span may cross a line break, never a blank line: a backtick that opens at
 * the end of one line and closes on the next is still code.
 *
 * Generated files (`do not edit`, or `generated:` front matter) are skipped:
 * their generator is where a word is fixed.
 *
 * ## Exit codes
 *
 * 0 none found · 1 found · 2 could not determine (no code list declared, or
 * no Markdown read), which is never reported as clean.
 *
 * Usage: bun run cat-harness-tools/scripts/retired-prose-words.ts [--instance ROOT]
 *
 * Enforced by `scripts/tests/retired-prose-words.test.ts`, which CI runs over
 * the harness, rather than by a `check:` script no gates workflow runs yet.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { codeListDirs, loadCodeLists } from "../schemas/library/code-list.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { builtAtPublishOf, withoutBuiltAtPublish } from "./mount-from-lock.ts";

/** The code list a layer declares its retired words in. */
export const RETIRED_WORDS_LIST = "retired-prose-words";

/** Top-level directories whose Markdown is not this layer's own prose. */
const NOT_OWN_PROSE = new Set(["library", "translations", "upstream", "uploads", "test", "node_modules"]);

/** The record `kg:materialize` writes beside another graph's bytes; a directory holding one is not walked. */
export const MATERIALIZATION_RECORD = "materialization.json";

/** Any character except one that would cross a blank line. */
const NB = String.raw`(?:(?!\n[ \t]*\n)[\s\S])`;

const PROTECTED = new RegExp(
  [
    String.raw`^[ \t]*(\`\`\`|~~~).*\n[\s\S]*?^[ \t]*\1.*$`, // fenced block
    String.raw`<!--[\s\S]*?-->`, // html comment
    String.raw`^[ \t]{0,3}#{1,6}[ \t].*$`, // heading
    String.raw`^[ \t]*\[[^\]\n]+\]:[ \t]*\S.*$`, // reference definition
    `\`${NB}*?\``, // inline code
    String.raw`\]\(` + `${NB}*?\\)`, // link target
    String.raw`<[A-Za-z/!][^>\n]*>`, // html tag or autolink
    `"${NB}*?"`, // quoted text
    `“${NB}*?”`,
    String.raw`https?:\/\/[^\s)>\]]+`, // bare URL
  ].join("|"),
  "gm",
);

/** One retired word, where it was found. */
export interface RetiredWordHit {
  readonly line: number;
  readonly word: string;
  readonly instead: string;
  readonly text: string;
}

/** A matcher for the retired words, case-insensitive, never inside an identifier. */
function wordPattern(words: readonly string[]): RegExp {
  const alts = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(String.raw`(?<![\w\-/.@#\`$])(` + alts.join("|") + String.raw`)(?![\w\-/\`])`, "gi");
}

/** The parts of `src` that are prose, as [offset, text] pairs. */
export function proseSpans(src: string): Array<[number, string]> {
  let body = src;
  let base = 0;
  const spans: Array<[number, string]> = [];
  /** The prose parts of one description line, with the same protections as the body. */
  const descriptionLine = (offset: number, text: string): void => {
    // A YAML double-quoted scalar's own quotes are syntax, not a quotation:
    // blank them (same length, so offsets hold) before finding real quotes.
    const unquoted = text.replace(/^(\s*)"(.*)"(\s*)$/, (_m, a: string, b: string, c: string) => `${a} ${b} ${c}`);
    let pos = 0;
    for (const m of unquoted.matchAll(PROTECTED)) {
      spans.push([offset + pos, unquoted.slice(pos, m.index)]);
      pos = m.index! + m[0].length;
    }
    spans.push([offset + pos, unquoted.slice(pos)]);
  };
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
  if (fm) {
    // Only the value of `description:` (and its continuation lines) is prose.
    let offset = 4;
    let inDesc = false;
    for (const line of fm[1]!.split("\n")) {
      if (/^[A-Za-z_][\w-]*:/.test(line)) {
        inDesc = line.startsWith("description:");
        if (inDesc) descriptionLine(offset + "description:".length, line.slice("description:".length));
      } else if (inDesc) {
        descriptionLine(offset, line);
      }
      offset += line.length + 1;
    }
    base = fm[0].length;
    body = src.slice(base);
  }
  let pos = 0;
  for (const m of body.matchAll(PROTECTED)) {
    spans.push([base + pos, body.slice(pos, m.index)]);
    pos = m.index! + m[0].length;
  }
  spans.push([base + pos, body.slice(pos)]);
  return spans;
}

/** Every retired word in the prose of one Markdown document. */
export function findRetiredWords(src: string, retired: ReadonlyMap<string, string>): RetiredWordHit[] {
  const re = wordPattern([...retired.keys()]);
  const hits: RetiredWordHit[] = [];
  const lineAt = (offset: number) => src.slice(0, offset).split("\n").length;
  for (const [offset, text] of proseSpans(src)) {
    for (const m of text.matchAll(re)) {
      const at = offset + m.index!;
      const line = lineAt(at);
      const word = m[1]!;
      hits.push({ line, word, instead: retired.get(word.toLowerCase()) ?? "", text: src.split("\n")[line - 1]!.trim() });
    }
  }
  return hits;
}

/** Whether a Markdown file is generated, so its generator, not the file, is where a word is fixed. */
export function isGenerated(src: string): boolean {
  const head = src.slice(0, 800).toLowerCase();
  return head.includes("do not edit") || head.includes("do not hand-edit") || /^generated:/m.test(src.slice(0, 400));
}

/** The retired words a layer declares, retired word → its replacement, or `undefined` when it declares none. */
export async function retiredWordsOf(instanceRoot: string): Promise<Map<string, string> | undefined> {
  const list = loadCodeLists(await codeListDirs(instanceRoot)).get(RETIRED_WORDS_LIST);
  if (list === undefined) return undefined;
  return new Map(list.codes.map((c) => [c.code.toLowerCase(), c.label]));
}

/**
 * The layer's own authored Markdown, relative to the layer root.
 *
 * A directory walk rather than `git ls-files`: a layer mounted into a composed
 * checkout carries no `.git` of its own (that is how CI runs it), and a git
 * listing there answers "no files", which this would report as clean.
 * Dot-directories are not walked, and nothing the layer declares
 * `builtAtPublish` is listed: those pages are written by a publish build, are
 * never committed, and so are their generator's prose. They are on disk only
 * where a build has run (CI's QA working copy), which made the scan's answer
 * depend on where it ran (folio-assistant#2954).
 */
export function ownProseFiles(instanceRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (rel === "" && NOT_OWN_PROSE.has(e.name)) continue;
        if (e.name === "node_modules") continue;
        // Another graph's bytes, materialised here with a digest beside them
        // (`kg:materialize`): its owner's prose, not this layer's, and
        // editing it in place breaks fixity (folio-assistant main, 2026-11-05).
        if (existsSync(join(dir, e.name, MATERIALIZATION_RECORD))) continue;
        walk(join(dir, e.name), r);
      } else if (e.isFile() && e.name.endsWith(".md")) out.push(r);
    }
  };
  walk(instanceRoot, "");
  return withoutBuiltAtPublish(out, builtAtPublishOf(instanceRoot)).sort();
}

/** Every retired word in a layer's own prose, by file. */
export async function scanInstance(instanceRoot: string): Promise<
  { state: "undetermined"; reason: string } | { state: "scanned"; files: number; hits: Array<{ file: string } & RetiredWordHit> }
> {
  const root = resolve(instanceRoot);
  const retired = await retiredWordsOf(root);
  if (retired === undefined) return { state: "undetermined", reason: `no \`${RETIRED_WORDS_LIST}\` code list is declared` };
  const files = ownProseFiles(root);
  if (files.length === 0) return { state: "undetermined", reason: "no Markdown was read" };
  const hits: Array<{ file: string } & RetiredWordHit> = [];
  let read = 0;
  for (const rel of files) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf-8");
    if (isGenerated(src)) continue;
    read += 1;
    for (const h of findRetiredWords(src, retired)) hits.push({ file: rel, ...h });
  }
  return { state: "scanned", files: read, hits };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--instance");
  const root = resolve(i !== -1 ? argv[i + 1]! : HARNESS_ROOT);
  const result = await scanInstance(root);
  if (result.state === "undetermined") {
    console.error(`retired prose words: could not determine for ${root} — ${result.reason}. Not clean.`);
    process.exit(2);
  }
  for (const h of result.hits) console.log(`${h.file}:${h.line}: "${h.word}" — say "${h.instead}"  | ${h.text.slice(0, 120)}`);
  const where = relative(process.cwd(), root) || ".";
  if (result.hits.length > 0) {
    console.error(`\n${result.hits.length} retired word(s) in the prose of ${where}/ (${result.files} file(s) read).`);
    process.exit(1);
  }
  console.log(`no retired words in the prose of ${where}/ (${result.files} file(s) read)`);
}
