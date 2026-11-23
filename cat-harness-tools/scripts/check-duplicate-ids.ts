#!/usr/bin/env bun
/**
 * No built page may carry the same `id` twice.
 *
 * Usage:
 *   bun run cat check:duplicate-ids <site-dir>     # a built site (e.g. preview:site's output)
 *
 * ## Why it runs on a BUILT site
 *
 * The defect is invisible in source: an include that declares an `id` once
 * (e.g. `nav_footer_custom.html`) can be rendered twice per page by the
 * theme, and every `<label for>` then resolves to the first copy.
 *
 * ## A tag-scoped scan, not a text search
 *
 * A text search for `id="` also matches the id inside a code sample, which
 * kramdown renders as `&lt;a id="…"&gt;` with the quotes unescaped. An `id=`
 * counts here only inside a real start tag, one that opens with a literal
 * `<`, and `<script>`/`<style>` bodies are skipped. No parser dependency is
 * needed.
 *
 * @module scripts/check-duplicate-ids
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { isVendoredViewer } from "./pdf-viewer.ts";

/**
 * A start tag's `id` attribute, read attribute by attribute.
 *
 * A regex for `id=` over the whole tag also matches text INSIDE another
 * attribute's value. jekyll-seo-tag writes a page title into
 * `<meta property="og:title" content="…">` and `twitter:title`, curling its
 * quotes, so a bean titled `… carry id="fa-nav-open"` reported
 * `”fa-nav-open”` twice on a page that held no duplicate id
 * (folio-assistant#2628, 2026-10-23).
 */
export function idOf(tag: string): string | undefined {
  const attrs = tag.replace(/^<[a-zA-Z][a-zA-Z0-9-]*/, "");
  for (const a of attrs.matchAll(/\s([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    if (a[1]!.toLowerCase() === "id") return a[2] ?? a[3] ?? a[4];
  }
  return undefined;
}

/** The ids that occur more than once in one HTML document, with their counts. */
export function duplicateIds(html: string): Map<string, number> {
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => m.replace(/>[\s\S]*<\//, "></"));
  const counts = new Map<string, number>();
  for (const tag of body.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^<>]*>/g)) {
    const v = idOf(tag[0]);
    if (v === undefined || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return new Map([...counts].filter(([, n]) => n > 1));
}

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}

if (import.meta.main) {
  const site = process.argv[2];
  if (!site) {
    console.error("usage: bun run cat check:duplicate-ids <built-site-dir>   (bun run cat preview:site prints one)");
    process.exit(2);
  }
  const files = htmlFiles(site);
  if (files.length === 0) {
    console.error(`check:duplicate-ids — no .html under ${site}. That is not a clean result.`);
    process.exit(2);
  }
  let bad = 0;
  let vendored = 0;
  for (const f of files) {
    // The pinned pdf.js viewer is Mozilla's markup; it declares `id="buttons"`
    // twice at v6.4.299, and nobody here can fix that without forking it
    // (bean `folio-assistant-5ea6`). Counted and said, not silently passed.
    if (isVendoredViewer(relative(site, f))) {
      vendored += 1;
      continue;
    }
    const d = duplicateIds(readFileSync(f, "utf8"));
    if (d.size === 0) continue;
    bad += 1;
    if (bad <= 20) console.error(`  ✗ ${relative(site, f)}: ${[...d].map(([id, n]) => `${id} ×${n}`).join(", ")}`);
  }
  if (bad) {
    console.error(`\ncheck:duplicate-ids — ${bad} of ${files.length} page(s) carry a duplicate id.`);
    process.exit(1);
  }
  console.log(
    `check:duplicate-ids — ${files.length - vendored} page(s), no duplicate id` +
      (vendored ? `; ${vendored} vendored pdf.js page(s) out of scope (not ours).` : "."),
  );
}
