/**
 * Remove the SEO IDENTITY CLAIMS from a built preview site.
 *
 * A staging preview is a build of a branch, served from
 * `…/branches/<slug>/`. `jekyll-seo-tag` gives every page three assertions
 * about its own identity, composed from `site.url + baseurl + page.url`:
 *
 *   <link rel="canonical" href="https://…/branches/<slug>/x.html">
 *   <meta property="og:url" content="https://…/branches/<slug>/x.html">
 *   <script type="application/ld+json">{… "@type":"WebPage","url":"…"}</script>
 *
 * **A preview must not make them.** `canonical` tells a crawler which URL is
 * authoritative, so a branch build claiming it invites the preview into a
 * search index in place of the published page; `og:url` and the JSON-LD
 * block make the same claim to link unfurlers and structured-data consumers.
 *
 * This is a correctness fix, not a size fix: pages still carry other
 * slug-bearing references.
 *
 * Why a post-build pass rather than Jekyll config: `jekyll-seo-tag` ships in the
 * `github-pages` gem set that `actions/jekyll-build-pages` runs, it has no global
 * off switch, and the `{% seo %}` call lives in the REMOTE theme's `head.html`.
 * Suppressing it at the source would mean vendoring that file — which is the
 * upstream-coupling hazard each folio's Jekyll config pins the theme to avoid.
 * (That file's path is not named here: a glob segment in it would close this
 * comment.) A pass over the emitted tree couples to nothing.
 *
 * Running it twice is a no-op: the second run finds nothing to remove.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

/** What a single file's pass removed. */
export interface StripResult {
  canonical: number;
  ogUrl: number;
  jsonLd: number;
}

/** Sum of two results, so a tree walk can fold without a mutable accumulator. */
export function addResults(a: StripResult, b: StripResult): StripResult {
  return {
    canonical: a.canonical + b.canonical,
    ogUrl: a.ogUrl + b.ogUrl,
    jsonLd: a.jsonLd + b.jsonLd,
  };
}

export const EMPTY: StripResult = { canonical: 0, ogUrl: 0, jsonLd: 0 };

/**
 * `application/ld+json` blocks whose payload is a schema.org node ABOUT THE PAGE.
 *
 * Narrow on purpose. A folio may legitimately embed JSON-LD that is CONTENT —
 * the knowledge-graph export is a JSON-LD document, and a page could inline a
 * fragment of one — and removing that would delete data rather than a claim. So
 * the match requires `@context` to be schema.org AND a `url` key, which is
 * exactly the `jekyll-seo-tag` shape and not the shape of a `cat:`/`fac:` graph.
 */
const SEO_LD_JSON =
  /[ \t]*<script type="application\/ld\+json">\s*\{[^<]*?"@context"\s*:\s*"https?:\/\/schema\.org"[^<]*?"url"\s*:[^<]*?\}\s*<\/script>\n?/gi;

const CANONICAL = /[ \t]*<link[^>]+\brel=(["'])canonical\1[^>]*>\n?/gi;
const OG_URL = /[ \t]*<meta[^>]+\bproperty=(["'])og:url\1[^>]*>\n?/gi;

/**
 * Strip the three claims from one page's HTML.
 *
 * Returns the new text and what was removed, rather than writing — so a caller
 * can report a dry run, and so the counts are testable without a filesystem.
 */
export function stripSeo(html: string): { html: string; removed: StripResult } {
  const removed: StripResult = { canonical: 0, ogUrl: 0, jsonLd: 0 };
  let out = html.replace(CANONICAL, () => {
    removed.canonical += 1;
    return "";
  });
  out = out.replace(OG_URL, () => {
    removed.ogUrl += 1;
    return "";
  });
  out = out.replace(SEO_LD_JSON, () => {
    removed.jsonLd += 1;
    return "";
  });
  return { html: out, removed };
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
  /** The built site to walk — `_site` in the staging workflow. */
  site: string;
  /** Report without writing. */
  dryRun?: boolean;
}

export interface RunResult {
  exitCode: number;
  text: string;
  removed: StripResult;
  filesChanged: number;
  filesSeen: number;
}

/**
 * Walk a built site and strip every page's SEO identity claims.
 *
 * **An unreadable site directory is an error, never a clean pass** — the same
 * third-state rule the rest of this repository runs on. A pass that could not
 * read the tree has not established that the tree is clean, and reporting "0
 * removed" would be indistinguishable from a site that had none.
 */
export function runStripPreviewSeo(opts: RunOptions): RunResult {
  let files: string[];
  try {
    files = htmlFiles(opts.site);
  } catch (e) {
    return {
      exitCode: 2,
      text: `could not read ${opts.site}: ${(e as Error).message}`,
      removed: EMPTY,
      filesChanged: 0,
      filesSeen: 0,
    };
  }

  let removed = EMPTY;
  let changed = 0;
  for (const file of files) {
    const before = readFileSync(file, "utf-8");
    const { html, removed: r } = stripSeo(before);
    if (html === before) continue;
    removed = addResults(removed, r);
    changed += 1;
    if (!opts.dryRun) writeFileSync(file, html);
  }

  const verb = opts.dryRun ? "would remove" : "removed";
  return {
    exitCode: 0,
    text:
      `${files.length} page(s) seen, ${changed} changed — ${verb} ` +
      `${removed.canonical} canonical, ${removed.ogUrl} og:url, ` +
      `${removed.jsonLd} schema.org JSON-LD block(s).`,
    removed,
    filesChanged: changed,
    filesSeen: files.length,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const siteAt = args.indexOf("--site");
  const result = runStripPreviewSeo({
    site: siteAt >= 0 ? args[siteAt + 1] : "_site",
    dryRun: args.includes("--dry-run"),
  });
  console.log(result.text);
  process.exit(result.exitCode);
}
