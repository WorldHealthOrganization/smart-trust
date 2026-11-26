#!/usr/bin/env bun
/**
 * Minify the BUILT site in place — drop the comments a reader never sees, and
 * the inter-tag whitespace a browser never renders.
 *
 * @module scripts/minify-site
 * @covers none — `.github/workflows/` is not a declared graph typology, and the
 *   subject here is the assembled `_site/`, which is not one either. Its
 *   logic is covered by `minify-site.test.ts` in `bun test`, which runs over
 *   pages built as strings; its WIRING by `check:invocation-parity` and
 *   `gates.test.ts`'s step classification.
 *
 * ## A post-build pass, run LAST
 *
 * HTML comments (mostly prose from `_includes/head_custom.html`, serialised
 * into every page) are a large share of the published bytes. The site is
 * built with `actions/jekyll-build-pages@v1`, whose plugin allow-list has no
 * minifier, so this post-processes the emitted tree like
 * `strip-preview-seo.ts`, `set-html-lang.ts`, `rail-standalone-pages.ts` and
 * `staging-banner.ts` do: no gem, no theme fork, no `_config.yml`.
 *
 * Every step that reads or rewrites the built HTML before a deploy —
 * `check:duplicate-ids`, `check:escaped-markup`, `check:maintained-artefacts`,
 * `site-links.ts`, `publish-verify.ts`, `set-html-lang.ts`,
 * `rail-standalone-pages.ts`, `staging-banner.ts` — runs before this pass, and
 * two of them (`staging-banner`, `folio-mount`) decide whether a marker is
 * live by asking whether it sits inside a COMMENT (`html-comments.ts`). So
 * none of them sees minified input. **Moving this step earlier would silently
 * change what those checks judge.**
 *
 * ## What is NOT touched, and the rule rather than the list
 *
 * Whitespace is semantic inside `<pre>`, `<code>`, `<textarea>`, `<script>`,
 * `<style>` and `<title>`, so their content is copied through byte for byte —
 * including any `<!--` inside a script string, which a regex over the whole
 * document would read as a comment and this does not.
 *
 * An UNCLOSED one of those falls through to being treated as an ordinary tag,
 * so a malformed page loses no content, but its interior whitespace is then
 * collapsed — the one case where this pass could change a rendering, accepted
 * because an unclosed `<script>` or `<pre>` cannot survive Jekyll's markdown
 * conversion.
 *
 * Outside those, the rule comes from CSS: in normal flow **any run of
 * whitespace renders as exactly one space**. So a whitespace-only run between
 * two tags collapses to one space, and is dropped entirely only where that
 * space could not be rendered — next to a block-level boundary, or anywhere
 * inside an `<svg>` away from its text elements. Inline neighbours (`</a>` …
 * `<a>`, `</code>` … `<code>`) keep the single space, because `a b` and `ab`
 * are different words: `>\s+<` → `><` would delete the space in
 * `<a>one</a> <a>two</a>`, which is why this is a tokenizer and not a regex.
 *
 * ## The three classes of comment that stay
 *
 * 1. **Conditional comments** (`<!--[if …]>`, `<![endif]-->`). Markup to a
 *    browser that honours them, not prose.
 * 2. **Licence and attribution notices**, e.g. `<!-- Feather. MIT License: … -->`
 *    and `<!-- Bootstrap Icons. MIT License: … -->`: MIT requires the notice
 *    to travel with the copy.
 * 3. **Region markers** — `<!-- x:begin -->` / `<!-- x:end -->`, the idiom
 *    `readme-sections.ts`, `agent-memory.ts` and `merge-conflict-patterns.ts`
 *    read (`fa-first-paint`, `kg:subgraph`, `kg:toc`, `kg:roles`,
 *    `kg:processes`, `kg:files`). A marker exists to be found by a tool, so
 *    it is kept even in the published copy.
 *
 * ## Idempotent
 *
 * A second run writes nothing — `minify-site.test.ts` asserts
 * `minifyHtml(minifyHtml(x)) === minifyHtml(x)` over every fixture — because
 * `restore-staging.ts` lays previously-published previews back into `_site`,
 * and a pass that drifted on re-entry would rewrite them on every deploy.
 *
 * ## Shared scripts and stylesheets — the same pass, a second walk
 *
 * The chrome every page loads (`docs-ui.js`, `docs-ui.css`, `edit-links.js`,
 * `navbar-row.js` …) is written to be read: about half of `docs-ui.js` is
 * comments. `runMinifyAssets` minifies every `.js`, `.mjs` and `.css` in the
 * built tree, after the HTML walk, under the same rule — the BUILT copy only;
 * the committed source stays readable, so every check that compares a
 * committed generated asset (`edit-links.js`, `navbar.js`) with its generator
 * still sees the readable text, and `fa_asset_version` still hashes it.
 * No source map is published, which is the convention already
 * (`sourcemap: never`, `build-instance-site.ts`): the readable copy is the
 * source in the repository the page's edit link points at.
 *
 * - **JS** goes through `Bun.Transpiler` with whitespace
 *   minification only (comments and whitespace). Identifiers are NOT renamed: a classic script's
 *   top-level names are globals other scripts read, and the transpiler would
 *   rename them. Nothing is tree-shaken either (`Bun.build` drops unused
 *   top-level functions, which in a classic script are globals).
 * - **`"use strict"`** — the transpiler parses as a module and drops every
 *   directive. A file whose ONLY directive opens the outermost IIFE that is
 *   the whole script (the chrome's shape), or the script itself, gets one
 *   directive back at the top, which is the same semantics. Any other placement
 *   is copied through untouched rather than silently made sloppy.
 * - **CSS** goes through `Bun.build` with `minify`, every import external.
 * - **Licence comments** (`/*!`, `@license`, `@preserve`) are carried over.
 * - **Not touched:** anything under a `vendor/` directory, `*.min.*` files,
 *   the pinned pdf.js viewer, and any file the minifier cannot parse — it is
 *   left as it was and counted, never reported as an error.
 *
 * Minifying changes WHAT a script is, not WHEN it loads, so the print path is
 * unaffected: nothing here defers or skips a byte a printed page needs.
 *
 * ## Three states, never two
 *
 * Exit 0 the tree was walked and the result reported · 2 the site directory
 * could not be read, never reported as "0 bytes saved". Same rule as
 * `strip-preview-seo.ts`.
 *
 *   bun run cat-harness-tools/scripts/minify-site.ts --site ./_site [--check]
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, relative } from "path";
import { isVendoredViewer } from "./pdf-viewer.ts";

/**
 * Elements whose CONTENT is copied through byte for byte.
 *
 * `script`, `style`, `textarea` and `title` are raw-text or escapable-raw-text
 * elements in the HTML spec — their content is not markup, so there are no
 * inter-tag boundaries in it to collapse. `pre` and `code` are here for the
 * other reason: their content IS markup, but its whitespace is displayed
 * (`pre`) or is a code sample a reader will copy (`code`). A `<code>` inside a
 * `<pre>` is covered twice over, which is free.
 */
const VERBATIM = ["script", "style", "textarea", "title", "pre", "code"] as const;

/**
 * Elements beside which a single space cannot be rendered.
 *
 * Not a style guess: each generates a block-level box (or no box at all), so
 * whitespace at its boundary is stripped by the inline-formatting rules rather
 * than shown. Everything NOT here is treated as inline, which is the safe
 * default — an unknown element (a web component, an `<mi>`) keeps its space.
 */
const BLOCK = new Set([
  "html", "head", "body", "meta", "link", "base", "noscript", "template", "script", "style", "title",
  "div", "p", "ul", "ol", "li", "dl", "dt", "dd", "menu", "address", "hr", "br",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "td", "th",
  "section", "article", "aside", "nav", "header", "footer", "main", "hgroup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "form", "fieldset", "legend", "optgroup", "option", "datalist",
  "blockquote", "figure", "figcaption", "details", "summary", "dialog", "pre",
]);

/**
 * Inside an `<svg>`, whitespace between elements is not text at all — except
 * around these, where it is part of a rendered string.
 */
const SVG_TEXT = new Set(["text", "tspan", "textpath"]);

/** A comment that is kept, and which of the three classes kept it. */
export type KeptComment = "conditional" | "licence" | "marker";

/** `<!--[if lt IE 9]>`, and the `<![endif]-->` that closes a revealed one. */
const CONDITIONAL = /^<!--\s*\[\s*if\b|^<!--\s*<!\[endif\]|\[endif\]\s*-->$/i;

/** MIT and friends: the notice a licence requires to travel with the copy. */
const LICENCE = /licen[cs]e|copyright|\(c\)\s*(19|20)\d{2}|SPDX-License-Identifier|@license|@preserve/i;

/** The `<!-- x:begin -->` / `<!-- x:end -->` idiom, and `<!-- detail -->`. */
const MARKER = /^<!--\s*(?:[a-z0-9][a-z0-9:_-]*:(?:begin|end)|detail|puml-sha256:[0-9a-f]+)\s*-->$/i;

/** Why this comment stays, or `null` when it does not. */
export function keepComment(comment: string): KeptComment | null {
  if (CONDITIONAL.test(comment)) return "conditional";
  if (MARKER.test(comment)) return "marker";
  if (LICENCE.test(comment)) return "licence";
  return null;
}

/** What one document's pass changed. */
export interface MinifyCounts {
  /** Comments removed. */
  comments: number;
  /** Comments kept, by the class that kept them. */
  kept: Record<KeptComment, number>;
  /** Whitespace-only inter-tag runs dropped entirely. */
  dropped: number;
  /** Whitespace-only inter-tag runs reduced to one space. */
  squeezed: number;
}

export const NO_COUNTS = (): MinifyCounts => ({
  comments: 0,
  kept: { conditional: 0, licence: 0, marker: 0 },
  dropped: 0,
  squeezed: 0,
});

export function addCounts(a: MinifyCounts, b: MinifyCounts): MinifyCounts {
  return {
    comments: a.comments + b.comments,
    kept: {
      conditional: a.kept.conditional + b.kept.conditional,
      licence: a.kept.licence + b.kept.licence,
      marker: a.kept.marker + b.kept.marker,
    },
    dropped: a.dropped + b.dropped,
    squeezed: a.squeezed + b.squeezed,
  };
}

type Token =
  /** A tag, with its lower-cased element name; `close` for `</x>`. */
  | { kind: "tag"; text: string; name: string; close: boolean }
  /** A verbatim region: its open tag, content and close tag, as one string. */
  | { kind: "verbatim"; text: string; name: string }
  | { kind: "comment"; text: string }
  | { kind: "text"; text: string };

/**
 * Find the end of a tag that starts at `from`, respecting quoted attributes.
 *
 * `<meta content="a > b">` is one tag, and `indexOf(">")` says it is not. This
 * corpus has attributes holding JSON and prose, so that is not hypothetical.
 * Returns the index just past the `>`, or `html.length` for an unterminated tag.
 */
function tagEnd(html: string, from: number): number {
  let quote = "";
  for (let i = from + 1; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i + 1;
    }
  }
  return html.length;
}

/** `<div class=…>` → `div`; `</div>` → `div`; `<!doctype html>` → `!doctype`. */
function tagName(tag: string): string {
  const m = /^<\/?\s*([a-zA-Z0-9!:_-]+)/.exec(tag);
  return m ? m[1].toLowerCase() : "";
}

/** Split a document into tags, comments, verbatim regions and text. */
export function tokenize(html: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) out.push({ kind: "text", text: html.slice(i, lt) });

    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      const end = close < 0 ? html.length : close + 3;
      out.push({ kind: "comment", text: html.slice(lt, end) });
      i = end;
      continue;
    }

    const end = tagEnd(html, lt);
    const tag = html.slice(lt, end);
    const name = tagName(tag);

    // A verbatim element swallows everything up to its own close tag. An
    // unclosed one (or a self-closed `<pre/>`) falls through to a plain tag,
    // so a malformed page loses no content.
    if ((VERBATIM as readonly string[]).includes(name) && !tag.startsWith("</") && !/\/>$/.test(tag)) {
      const closeRe = new RegExp(`</\\s*${name}\\s*>`, "i");
      const rest = html.slice(end);
      const m = closeRe.exec(rest);
      if (m) {
        out.push({ kind: "verbatim", text: tag + rest.slice(0, m.index + m[0].length), name });
        i = end + m.index + m[0].length;
        continue;
      }
    }
    out.push({ kind: "tag", text: tag, name, close: tag.startsWith("</") });
    i = end;
  }
  return out;
}

/** Whether a whitespace run beside this token's element can render as a space. */
function blockish(tok: Token | undefined, insideSvg: boolean): boolean {
  if (!tok) return true; // Start or end of document: nothing to separate.
  if (tok.kind === "comment" || tok.kind === "text") return false;
  const { name } = tok;
  if (name.startsWith("!")) return true; // `<!doctype html>`
  if (insideSvg) return !SVG_TEXT.has(name);
  return BLOCK.has(name);
}

/**
 * Minify one page.
 *
 * Returns the new text and what changed, rather than writing — so `--check`
 * reports without touching the tree and the counts are testable with no
 * filesystem, the same split `strip-preview-seo.ts` uses.
 */
export function minifyHtml(html: string): { html: string; counts: MinifyCounts } {
  const counts = NO_COUNTS();
  const toks = tokenize(html);

  // Pass 1 — drop the comments that go, and fold the whitespace that was
  // separating them into one run, so `  <!-- a -->\n  <!-- b -->\n  <div>`
  // leaves ONE whitespace token before `<div>` rather than three.
  const kept: Token[] = [];
  for (const t of toks) {
    if (t.kind === "comment") {
      const why = keepComment(t.text);
      if (why) {
        counts.kept[why] += 1;
        kept.push(t);
      } else {
        counts.comments += 1;
      }
      continue;
    }
    const last = kept[kept.length - 1];
    if (t.kind === "text" && last?.kind === "text" && /^\s*$/.test(t.text) && /^\s*$/.test(last.text)) {
      kept[kept.length - 1] = { kind: "text", text: last.text + t.text };
      continue;
    }
    kept.push(t);
  }

  // Pass 2 — emit, deciding each whitespace-only run against its neighbours.
  // `svg` is tracked by depth rather than by a flag: a page carries 150 of
  // them and they do not nest, but a `<foreignObject>` subtree would.
  let svgDepth = 0;
  const out: string[] = [];
  for (let n = 0; n < kept.length; n++) {
    const t = kept[n];
    if (t.kind === "tag" && t.name === "svg") svgDepth += t.close ? -1 : /\/>$/.test(t.text) ? 0 : 1;
    if (svgDepth < 0) svgDepth = 0;

    if (t.kind !== "text" || !/^\s+$/.test(t.text)) {
      out.push(t.text);
      continue;
    }
    const prev = kept[n - 1];
    const next = kept[n + 1];
    // Only a run BETWEEN tags is ours. Whitespace touching text is part of
    // the text, and `Cats </em>and dogs` must keep its space.
    if ((prev && prev.kind === "text") || (next && next.kind === "text")) {
      out.push(t.text);
      continue;
    }
    const insideSvg = svgDepth > 0;
    if (blockish(prev, insideSvg) || blockish(next, insideSvg)) {
      counts.dropped += 1;
    } else if (t.text === " ") {
      out.push(t.text); // Already minimal: not a change, so not a count.
    } else {
      counts.squeezed += 1;
      out.push(" ");
    }
  }
  return { html: out.join(""), counts };
}

/** Every `.html` file under `dir`, depth-first. */
function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue; // A broken symlink is not a page; skip rather than fail the build.
    }
    if (st.isDirectory()) found.push(...htmlFiles(path));
    else if (/\.html?$/i.test(entry)) found.push(path);
  }
  return found;
}

export interface RunOptions {
  /** The built site to walk — `_site` in both publishing workflows. */
  site: string;
  /** Report without writing. */
  check?: boolean;
}

export interface RunResult {
  exitCode: number;
  text: string;
  counts: MinifyCounts;
  bytesBefore: number;
  bytesAfter: number;
  filesChanged: number;
  filesSeen: number;
}

const mib = (b: number) => `${(b / 1048576).toFixed(1)} MiB`;

/** Walk a built site and minify every page. */
export function runMinifySite(opts: RunOptions): RunResult {
  let files: string[];
  try {
    // The pinned pdf.js viewer is Mozilla's page, not one of ours: rewriting
    // it would ship bytes no release of theirs contains (bean `folio-assistant-5ea6`).
    files = htmlFiles(opts.site).filter((f) => !isVendoredViewer(relative(opts.site, f)));
  } catch (e) {
    return {
      exitCode: 2,
      text: `could not read ${opts.site}: ${(e as Error).message}`,
      counts: NO_COUNTS(),
      bytesBefore: 0,
      bytesAfter: 0,
      filesChanged: 0,
      filesSeen: 0,
    };
  }

  let counts = NO_COUNTS();
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    const { html, counts: c } = minifyHtml(text);
    before += Buffer.byteLength(text);
    after += Buffer.byteLength(html);
    if (html === text) continue;
    counts = addCounts(counts, c);
    changed += 1;
    if (!opts.check) writeFileSync(file, html);
  }

  const saved = before - after;
  const pct = before === 0 ? 0 : (100 * saved) / before;
  const verb = opts.check ? "would save" : "saved";
  return {
    exitCode: 0,
    text:
      `${files.length} page(s) seen, ${changed} changed — ${verb} ${mib(saved)} of ` +
      `${mib(before)} (${pct.toFixed(2)}%). Removed ${counts.comments} comment(s); ` +
      `kept ${counts.kept.licence} licence, ${counts.kept.conditional} conditional, ` +
      `${counts.kept.marker} marker. Whitespace runs: ${counts.dropped} dropped, ` +
      `${counts.squeezed} reduced to one space.`,
    counts,
    bytesBefore: before,
    bytesAfter: after,
    filesChanged: changed,
    filesSeen: files.length,
  };
}

// ── Shared scripts and stylesheets ──────────────────────────────────────

/** A licence comment the minified copy must keep (MIT requires it to travel). */
const LICENCE_BLOCK = /\/\*(?:![\s\S]*?|\*?[\s\S]*?(?:@license|@preserve)[\s\S]*?)\*\//g;

/** A `"use strict"` directive on its own line — the only form this corpus writes. */
const STRICT_LINE = /^[ \t]*(["'])use strict\1;?[ \t]*$/gm;

/** Strip block and line comments from a SHORT prefix (never a whole file). */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
}

/** The opening of an IIFE: `(function () {`, `;(function(){`, `(() => {`, `!function(){`. */
const IIFE_OPEN = /^\s*[;!]?\s*\(?\s*(?:function\s*\(\s*\)|\(\s*\)\s*=>)\s*\{\s*$/;

/** The minified shape of a script that is ONE IIFE and nothing else. */
const IIFE_WHOLE = /^(?:\(function\(\)\{|\(\(\)=>\{|!function\(\)\{)[\s\S]*\}\)?\(\);?\s*$/;

/**
 * Where a script's strictness lives, so the minified copy can keep it.
 *
 * `none` — no directive. `whole` — one directive, which covers the whole
 * script (at its top, or opening the IIFE the script is). `other` — anything
 * else; the caller then leaves the file as it was.
 */
export function strictness(src: string): "none" | "whole" | "other" {
  const hits = [...src.matchAll(STRICT_LINE)];
  if (hits.length === 0) return "none";
  if (hits.length > 1) return "other";
  const before = stripComments(src.slice(0, hits[0].index));
  if (/^\s*$/.test(before)) return "whole";
  return IIFE_OPEN.test(before) ? "whole" : "other";
}

/** Prepend the licence comments the minifier dropped. */
function keepLicences(src: string, out: string): string {
  const lost = (src.match(LICENCE_BLOCK) ?? []).filter((c) => !out.includes(c));
  return lost.length ? `${lost.join("\n")}\n${out}` : out;
}

const transpiler = new Bun.Transpiler({ loader: "js", minifyWhitespace: true });

/** Minify one script, or `null` when it is left as it was (and why not, in `skip`). */
export function minifyJs(src: string): { text: string } | { skip: string } {
  const strict = strictness(src);
  if (strict === "other") return { skip: "use strict placed where minifying would drop it" };
  let out: string;
  try {
    out = transpiler.transformSync(src).trim();
  } catch (e) {
    return { skip: `does not parse: ${(e as Error).message.split("\n")[0]}` };
  }
  if (strict === "whole") {
    // A directive that opened the IIFE goes back at the top of the script:
    // the script IS that IIFE, so the scope it covers is the same.
    const opensIife = !/^\s*$/.test(stripComments(src.slice(0, [...src.matchAll(STRICT_LINE)][0].index)));
    if (opensIife && !IIFE_WHOLE.test(out)) return { skip: "use strict opens an IIFE that is not the whole script" };
    // On its own line, so a second pass reads it as a directive again.
    out = `"use strict";\n${out}`;
  }
  return { text: `${keepLicences(src, out)}\n` };
}

/** Minify one stylesheet with Bun's CSS minifier, every import left external. */
export async function minifyCss(src: string): Promise<{ text: string } | { skip: string }> {
  const dir = mkdtempSync(join(tmpdir(), "minify-css-"));
  try {
    const at = join(dir, "in.css");
    writeFileSync(at, src);
    const r = await Bun.build({ entrypoints: [at], minify: true, external: ["*"], throw: false });
    if (!r.success || r.outputs.length !== 1) {
      return { skip: `does not parse: ${r.logs.map(String).join("; ").split("\n")[0] || "no output"}` };
    }
    return { text: `${keepLicences(src, (await r.outputs[0].text()).trim())}\n` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A script or stylesheet this pass may rewrite: ours, not a vendored copy. */
export function isOwnAsset(siteRelative: string): boolean {
  const p = siteRelative.split(/[\\/]/).join("/");
  if (!/\.(?:m?js|css)$/i.test(p)) return false;
  if (/\.min\.(?:m?js|css)$/i.test(p)) return false;
  if (p.split("/").includes("vendor") || p.split("/").includes("node_modules")) return false;
  return !isVendoredViewer(p);
}

function allFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) found.push(...allFiles(path));
    else found.push(path);
  }
  return found;
}

export interface AssetResult {
  exitCode: number;
  text: string;
  bytesBefore: number;
  bytesAfter: number;
  /** gzip -9 of the same files, before and after: what a reader downloads. */
  gzipBefore: number;
  gzipAfter: number;
  filesChanged: number;
  filesSeen: number;
  /** Files left as they were, with why. */
  skipped: { path: string; why: string }[];
}

const gz = (s: string) => Bun.gzipSync(Buffer.from(s), { level: 9 }).length;
const kib = (b: number) => `${(b / 1024).toFixed(0)} KiB`;

/** Walk a built site and minify every script and stylesheet of ours. */
export async function runMinifyAssets(opts: RunOptions): Promise<AssetResult> {
  let files: string[];
  try {
    files = allFiles(opts.site).filter((f) => isOwnAsset(relative(opts.site, f)));
  } catch (e) {
    return {
      exitCode: 2, text: `could not read ${opts.site}: ${(e as Error).message}`,
      bytesBefore: 0, bytesAfter: 0, gzipBefore: 0, gzipAfter: 0, filesChanged: 0, filesSeen: 0, skipped: [],
    };
  }
  let before = 0, after = 0, gzBefore = 0, gzAfter = 0, changed = 0;
  const skipped: { path: string; why: string }[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    const r = /\.css$/i.test(file) ? await minifyCss(src) : minifyJs(src);
    const text = "text" in r && r.text.length < src.length ? r.text : src;
    if ("skip" in r) skipped.push({ path: relative(opts.site, file), why: r.skip });
    before += Buffer.byteLength(src);
    after += Buffer.byteLength(text);
    gzBefore += gz(src);
    gzAfter += gz(text);
    if (text === src) continue;
    changed += 1;
    if (!opts.check) writeFileSync(file, text);
  }
  const verb = opts.check ? "would save" : "saved";
  return {
    exitCode: 0,
    text:
      `${files.length} script(s) and stylesheet(s) seen, ${changed} changed — ${verb} ` +
      `${kib(before - after)} of ${kib(before)} raw, ${kib(gzBefore - gzAfter)} of ${kib(gzBefore)} gzip. ` +
      `${skipped.length} left as they were` +
      (skipped.length ? `: ${skipped.map((s) => `${s.path} (${s.why})`).join("; ")}` : "") + ".",
    bytesBefore: before,
    bytesAfter: after,
    gzipBefore: gzBefore,
    gzipAfter: gzAfter,
    filesChanged: changed,
    filesSeen: files.length,
    skipped,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const siteAt = args.indexOf("--site");
  const opts = {
    site: siteAt >= 0 ? args[siteAt + 1] : "_site",
    check: args.includes("--check") || args.includes("--dry-run"),
  };
  const result = runMinifySite(opts);
  console.log(result.text);
  if (result.exitCode !== 0) process.exit(result.exitCode);
  const assets = await runMinifyAssets(opts);
  console.log(assets.text);
  process.exit(assets.exitCode);
}
