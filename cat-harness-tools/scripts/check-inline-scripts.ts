#!/usr/bin/env bun
/**
 * Every inline script a built site ships must still parse.
 *
 * @module scripts/check-inline-scripts
 * @covers none — it reads a built site's HTML, not a graph
 *
 * The theme's markup passes (heading anchors, table wrappers) can rewrite an
 * inline `<script>`'s text as if it were markup, breaking a string literal
 * while every generator's output is correct and every source gate green. The
 * chrome keeps those passes out of `<script>` and `<style>` (cat-harness
 * `site-chrome/_includes/vendor/anchor_headings.html` and
 * `_layouts/table_wrappers.html`); this checks what SHIPS, so any build step
 * that rewrites a script's text is caught.
 *
 * ## What it asks, per inline CLASSIC script
 *
 * 1. **It parses** (`new Function(body)` compiles and does not run it).
 * 2. **It carries no theme rewrite**: `class="anchor-heading"` or
 *    `class="table-wrapper"` inside a script is the passes' signature, even
 *    where the result still happens to parse.
 *
 * A script with `src=`, or a `type` that is not JavaScript (JSON, a module,
 * a template), is not a classic script and is not judged: `new Function`
 * cannot parse a module, and data is not code.
 *
 * ```
 * bun run cat-harness-tools/scripts/check-inline-scripts.ts --site _site
 * ```
 * Exit: 0 every inline script is sound · 1 one or more is not · 2 could not run.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** The text a theme markup pass leaves behind in whatever it rewrites. */
export const REWRITE_SIGNATURES = ['class="anchor-heading"', 'class="table-wrapper"'] as const;

/** A `type` that marks a classic script; absent counts as one. */
const CLASSIC_TYPES = /^(?:|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/i;

export interface ScriptProblem {
  /** Site-relative page. */
  page: string;
  /** 1-based line of the `<script` tag in the page. */
  line: number;
  /** What is wrong: a parse error's message, or the signature found. */
  reason: string;
}

/** The inline classic scripts of one page: body, and the line its tag is on. */
export function inlineScripts(html: string): { body: string; line: number }[] {
  const out: { body: string; line: number }[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] ?? "";
    if (!CLASSIC_TYPES.test(type)) continue;
    out.push({ body: m[2], line: html.slice(0, m.index).split("\n").length });
  }
  return out;
}

/** What is wrong with one script body, or undefined. */
export function scriptProblem(body: string): string | undefined {
  for (const s of REWRITE_SIGNATURES) if (body.includes(s)) return `carries ${s}: a theme markup pass rewrote the script's text`;
  try {
    new Function(body);
  } catch (e) {
    return `does not parse: ${(e as Error).message}`;
  }
  return undefined;
}

/** Every problem in one page's HTML. */
export function pageProblems(page: string, html: string): ScriptProblem[] {
  const out: ScriptProblem[] = [];
  for (const s of inlineScripts(html)) {
    const reason = scriptProblem(s.body);
    if (reason) out.push({ page, line: s.line, reason });
  }
  return out;
}

/**
 * Every problem in a built site. The same body is judged once: a site's head
 * scripts repeat on every page.
 */
export function checkInlineScripts(site: string): { pages: number; scripts: number; problems: ScriptProblem[] } {
  const seen = new Map<string, string | undefined>();
  const problems: ScriptProblem[] = [];
  let pages = 0;
  let scripts = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === ".git" || name === "node_modules") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".html")) {
        pages++;
        const html = readFileSync(p, "utf-8");
        for (const s of inlineScripts(html)) {
          scripts++;
          if (!seen.has(s.body)) seen.set(s.body, scriptProblem(s.body));
          const reason = seen.get(s.body);
          if (reason) problems.push({ page: relative(site, p).split(sep).join("/"), line: s.line, reason });
        }
      }
    }
  };
  walk(site);
  return { pages, scripts, problems };
}

if (import.meta.main) {
  const i = process.argv.indexOf("--site");
  const site = i >= 0 ? process.argv[i + 1] : undefined;
  if (!site || !existsSync(site)) {
    console.error("usage: check-inline-scripts.ts --site <built site directory>");
    process.exit(2);
  }
  const r = checkInlineScripts(site);
  console.log(`inline scripts: ${r.scripts} on ${r.pages} html pages, ${r.problems.length} unsound`);
  for (const p of r.problems.slice(0, 50)) console.error(`  ✗ ${p.page}:${p.line} ${p.reason}`);
  process.exit(r.problems.length ? 1 : 0);
}
