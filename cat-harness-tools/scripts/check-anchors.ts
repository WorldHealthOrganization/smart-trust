#!/usr/bin/env bun
/**
 * Accessibility and QA: every page and viewer can be linked into, and leads
 * back to its source.
 *
 * @module scripts/check-anchors
 * @covers none — it reads a built site's HTML, not a graph
 *
 * Every section on every page should have a named (slug) `#` link a reader
 * can share, and a viewer should lead back to its document.
 *
 * ## What it asks, per HTML page
 *
 * 1. **Every heading has a named anchor.** An `<h2>`–`<h4>` outside scripts,
 *    styles and navigation carries an `id`.
 * 2. **The anchors can be reached.** A page with anchored headings offers a
 *    way to copy them: the shared link runtime (`edit-links.js`, inline or as
 *    a file, which puts 🔗 in each block's and heading's icon group), or the
 *    theme's heading anchors.
 * 3. **A review page leads back to its document.** A change-review page
 *    (`id="changes"`) has the "Back to the document" line (`id="source-docs"`).
 *
 * It REPORTS; it does not stop a publish. The build prints the count and the
 * first pages, the way it prints the content's own unresolved links.
 *
 * ```
 * bun run cat-harness-tools/scripts/check-anchors.ts --site _site
 * ```
 * Exit: 0 nothing to report · 1 one or more pages to fix · 2 could not run.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface AnchorProblem {
  /** Site-relative page. */
  page: string;
  /** What is missing, in words a reader can act on. */
  reason: string;
}

/** The page's markup with scripts, styles, templates and navigation removed. */
function visibleMarkup(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<template\b[\s\S]*?<\/template>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, "");
}

function text(inner: string): string {
  return inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** What one page is missing. An empty list is a page that passes. */
export function anchorProblems(page: string, html: string): AnchorProblem[] {
  const out: AnchorProblem[] = [];
  const body = visibleMarkup(html);
  let anchored = 0;
  const bare: string[] = [];
  for (const m of body.matchAll(/<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
    if (/\sid\s*=\s*["'][^"']+["']/i.test(m[2]!)) anchored++;
    else {
      const t = text(m[3]!);
      if (t) bare.push(t);
    }
  }
  if (bare.length) {
    const shown = bare.slice(0, 3).map((t) => `"${t.length > 60 ? t.slice(0, 57) + "…" : t}"`).join(", ");
    out.push({ page, reason: `${bare.length} heading(s) with no named anchor: ${shown}${bare.length > 3 ? ", …" : ""}` });
  }
  const runtime = /edit-links\.js|window\.faEditLinks/.test(html);
  const themeAnchors = /class="anchor-heading"/.test(body);
  const ownButtons = /class="anchor-btn"|anchorButton\(/.test(html);
  if (anchored && !runtime && !themeAnchors && !ownButtons) {
    out.push({ page, reason: `${anchored} anchored heading(s), but no 🔗 to copy a link: load the shared link runtime (edit-links.js)` });
  }
  if (/\bid="changes"/.test(html) && /<h1>What changed<\/h1>/.test(html) && !/\bid="source-docs"/.test(html)) {
    out.push({ page, reason: "review page with no link back to the source document" });
  }
  return out;
}

/** Every page of a built site, and what each is missing. */
export function checkAnchors(site: string): { pages: number; problems: AnchorProblem[] } {
  const problems: AnchorProblem[] = [];
  let pages = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === ".git" || name === "node_modules") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".html")) {
        pages++;
        problems.push(...anchorProblems(relative(site, p).split(sep).join("/"), readFileSync(p, "utf-8")));
      }
    }
  };
  walk(site);
  return { pages, problems };
}

if (import.meta.main) {
  const i = process.argv.indexOf("--site");
  const site = i >= 0 ? process.argv[i + 1] : undefined;
  if (!site || !existsSync(site)) {
    console.error("usage: check-anchors.ts --site <built site directory>");
    process.exit(2);
  }
  const r = checkAnchors(site);
  const pagesHit = new Set(r.problems.map((p) => p.page)).size;
  console.log(`anchors: ${r.pages} html pages, ${pagesHit} to fix`);
  for (const p of r.problems.slice(0, 50)) console.error(`  · ${p.page}: ${p.reason}`);
  process.exit(r.problems.length ? 1 : 0);
}
