#!/usr/bin/env bun
/**
 * staging-share — a STAGING preview stores only the files that differ from
 * the live site, and serves the rest from the live site's copy.
 *
 * @module scripts/staging-share
 * @covers none — a PUBLISHER step: it prunes one preview directory and writes
 * its fallback worker; it judges no graph
 *
 * ```sh
 * bun run cat-harness-tools/scripts/staging-share.ts plan  --root pages --preview pages/STAGING/<slug> --slug <slug>
 * bun run cat-harness-tools/scripts/staging-share.ts apply --root pages --preview pages/STAGING/<slug> --slug <slug>
 * bun run cat-harness-tools/scripts/staging-share.ts write-404 --site _site
 * ```
 *
 * A full-copy preview duplicates most of the live site, and every copy is
 * checked out, pushed, and uploaded by every Pages deploy.
 *
 * ## What counts as the same
 *
 * A non-HTML file: the same bytes. An HTML page: the same bytes once the
 * edits a preview makes to EVERY page are set aside on both sides, and only
 * those, each named in {@link normalisePreviewHtml}:
 *
 * - the staging banner fragment ({@link FRAGMENT}, constant);
 * - the SEO identity claims a preview strips (`stripSeo`), stripped from the
 *   live page too;
 * - the `fa-staging` and `fa-search-index` meta values;
 * - TypeDoc's ` (staging: <slug>)` title suffix.
 *
 * A difference anywhere else keeps the preview's own copy: a page that reads
 * differently is never served from the live site.
 *
 * ## How a shared file is served
 *
 * GitHub Pages has no fallback, so the browser does it. `apply` writes
 * `staging-sw.js` at the preview root: a service worker scoped to the
 * preview that answers a 404 inside the preview with the live site's file at
 * the same path. A live HTML page served that way gets the preview's marks
 * back (banner, `fa-staging`, `fa-search-index`), so a reader can never take
 * it for the live site: the banner says FEATURE BRANCH before any fetch.
 *
 * The banner's own script registers the worker on every preview page, and
 * reloads once when the page was not yet controlled, so the first visit's
 * shared stylesheets and scripts are fetched through it. A deep link to a
 * shared page reaches GitHub's 404 before any worker exists, so the live
 * site's root `404.html` ({@link NOT_FOUND_HTML}, `write-404`) registers the
 * preview's worker and reloads. Where no worker can run, that page says the
 * page is unchanged on the branch and links to the live copy; it never
 * pretends to be the preview.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { FRAGMENT } from "./staging-banner.ts";
import { stripSeo } from "./strip-preview-seo.ts";
import { parseRetained, readRetained, RETAINED_FILE, type Retained } from "./keep-shared-payloads.ts";
import { blobId, forEachBlob, isRegular, objectFormat, prefetchBlobs, sparseEntries, type GitEntry } from "./lib/git-blobs.ts";
import { isPreviewPath } from "./lib/preview-prefix.ts";
import { SITE_REPORT as PREVIEW_QA_REPORT } from "./preview-qa.ts";

/**
 * Files a preview always keeps: they describe this preview, or serve it. The
 * root `index.html` too: it is the page the PR comment links to, the page
 * that installs the worker on a first visit, and the file `staging-review`
 * lists to tell that a preview was published.
 */
export const NEVER_SHARED = new Set(["index.html", "staging.json", "shared.json", "staging-sw.js", "staging-banner.js", "404.html", "build.json", "_build-record.json", PREVIEW_QA_REPORT]);

const META_STAGING = /<meta name="fa-staging" content="[^"]*">/g;
const META_SEARCH = /<meta name="fa-search-index" content="([^"]*)">/g;

/** A preview page with the per-preview edits set aside. */
export function normalisePreviewHtml(html: string, slug: string): string {
  return html
    .split(FRAGMENT).join("")
    .replace(META_STAGING, '<meta name="fa-staging" content="">')
    .replace(META_SEARCH, '<meta name="fa-search-index" content="">')
    .split(` (staging: ${slug})`).join("");
}

/** A live page as the preview's would read, its edits set aside the same way. */
export function normaliseLiveHtml(html: string): string {
  return stripSeo(html).html
    .replace(META_STAGING, '<meta name="fa-staging" content="">')
    .replace(META_SEARCH, '<meta name="fa-search-index" content="">');
}

/** Whether a preview file can be served from the live site's copy. */
export function sameAsLive(rel: string, preview: Buffer, live: Buffer, slug: string): boolean {
  if (NEVER_SHARED.has(rel)) return false;
  if (preview.equals(live)) return true;
  if (!rel.endsWith(".html")) return false;
  return normalisePreviewHtml(preview.toString("utf-8"), slug) === normaliseLiveHtml(live.toString("utf-8"));
}

function filesUnder(dir: string, out: string[] = [], root: string = dir): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) filesUnder(full, out, root);
    else out.push(relative(root, full));
  }
  return out;
}

export interface SharePlan {
  shared: string[];
  kept: number;
  bytesShared: number;
}

/**
 * Which of the preview's files are the live site's, compared against `root`.
 *
 * `root` may be a SPARSE checkout of the publish branch (cone `STAGING/<slug>`,
 * `STAGING/_retired`, `_render-log`, cloned `--filter=blob:none`). A live file
 * outside the cone (a skip-worktree index entry, whatever is on disk at its
 * path) is then read from git: the same bytes is the same blob id, so a
 * non-HTML file needs no blob, and only the live HTML pages whose bytes differ
 * are fetched, in one request, to compare with the per-preview edits set
 * aside. Every other file is read from the working tree, so a full checkout,
 * which has no such entry, gives the plan it always gave.
 */
export function planShare(root: string, preview: string, slug: string): SharePlan {
  const outside = sparseEntries(root);
  const files = filesUnder(preview);
  const verdict = new Map<string, boolean>();
  const fromGit: { rel: string; live: GitEntry }[] = [];
  // A blob main keeps only for older previews (keep-shared-payloads.ts) is never
  // borrowed: it goes once those previews rotate off, and this one would 404.
  const retained = new Set(Object.keys(retainedAt(root, outside).kept));
  for (const rel of files) {
    const live = join(root, rel);
    if (isPreviewPath(rel) || retained.has(rel)) { verdict.set(rel, false); continue; }
    // Outside the cone the index is what is published, whatever is on disk there.
    const entry = outside?.get(rel);
    if (entry === undefined && existsSync(live)) {
      verdict.set(rel, statSync(live).isFile() && sameAsLive(rel, readFileSync(join(preview, rel)), readFileSync(live), slug));
      continue;
    }
    // A link is never compared through git: keeping it costs bytes, never a wrong page.
    if (entry === undefined || !isRegular(entry.mode)) { verdict.set(rel, false); continue; }
    fromGit.push({ rel, live: entry });
  }
  if (fromGit.length > 0) {
    const format = objectFormat(root);
    const pages = new Map<string, string[]>();
    for (const { rel, live } of fromGit) {
      if (NEVER_SHARED.has(rel)) { verdict.set(rel, false); continue; }
      if (blobId(readFileSync(join(preview, rel)), format) === live.oid) { verdict.set(rel, true); continue; }
      if (!rel.endsWith(".html")) { verdict.set(rel, false); continue; }
      pages.set(live.oid, [...(pages.get(live.oid) ?? []), rel]);
    }
    const oids = [...pages.keys()];
    prefetchBlobs(root, oids);
    forEachBlob(root, oids, (oid, bytes) => {
      for (const rel of pages.get(oid) ?? []) verdict.set(rel, sameAsLive(rel, readFileSync(join(preview, rel)), bytes, slug));
    });
  }
  const shared: string[] = [];
  let kept = 0;
  let bytesShared = 0;
  for (const rel of files) {
    if (verdict.get(rel) === true) { shared.push(rel); bytesShared += statSync(join(preview, rel)).size; }
    else kept++;
  }
  return { shared, kept, bytesShared };
}

/** The retained record, from the working tree or, outside a sparse checkout's cone, from its blob. */
function retainedAt(root: string, outside: Map<string, GitEntry> | undefined): Retained {
  const entry = outside?.get(RETAINED_FILE);
  if (entry === undefined) return readRetained(root);
  let text = "";
  prefetchBlobs(root, [entry.oid]);
  forEachBlob(root, [entry.oid], (_oid, bytes) => { text = bytes.toString("utf-8"); });
  return parseRetained(text);
}

/** The `fa-search-index` value the preview's pages carry, for pages served from the live site. */
export function searchStateOf(preview: string): string {
  const index = join(preview, "index.html");
  if (!existsSync(index)) return "";
  const m = /<meta name="fa-search-index" content="([^"]*)">/.exec(readFileSync(index, "utf-8"));
  return m ? m[1]! : "";
}

/**
 * The preview's service worker. One file per preview, small, and its only
 * per-preview value is the search-index state the live pages are marked with.
 */
export function workerSource(searchState: string): string {
  return `/* staging-share: serve the live site's copy of a file this preview shares (cat-harness-tools scripts/staging-share.ts). */
var FRAGMENT=${JSON.stringify(FRAGMENT)};
var SEARCH=${JSON.stringify(searchState)};
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
function bodyAt(h){var re=/<body[^>]*>/gi,m;while((m=re.exec(h))){var o=h.lastIndexOf('<!--',m.index),c=h.lastIndexOf('-->',m.index);if(o<0||c>o)return m.index+m[0].length;}return -1;}
function mark(h){
  h=h.replace(/<meta name="fa-staging" content="[^"]*">/g,'<meta name="fa-staging" content="preview">');
  h=h.replace(/<meta name="fa-search-index" content="[^"]*">/g,'<meta name="fa-search-index" content="'+SEARCH+'">');
  if(h.indexOf('data-fa-staging-banner')<0){var at=bodyAt(h);if(at>=0)h=h.slice(0,at)+FRAGMENT+h.slice(at);}
  return h;
}
self.addEventListener('fetch',function(e){
  var req=e.request;if(req.method!=='GET')return;
  var u=new URL(req.url),scope=new URL(self.registration.scope);
  if(u.origin!==scope.origin||u.pathname.indexOf(scope.pathname)!==0)return;
  var live=scope.pathname.replace(/(?:branches|STAGING)\\/[^/]+\\/$/,'')+u.pathname.slice(scope.pathname.length);
  e.respondWith(fetch(req).then(function(r){
    if(r.status!==404)return r;
    return fetch(live+u.search,{credentials:'same-origin'}).then(function(m){
      if(!m.ok)return r;
      if((m.headers.get('content-type')||'').indexOf('text/html')<0)return m;
      return m.text().then(function(t){return new Response(mark(t),{status:200,headers:{'content-type':'text/html; charset=utf-8'}});});
    }).catch(function(){return r;});
  }));
});
`;
}

/**
 * The live site's root `404.html`. GitHub Pages serves it for every missing
 * path, a preview's shared pages included, before any worker is installed.
 */
export const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Page not found</title>
<style>body{font-family:system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5}</style></head>
<body><h1>Page not found</h1><p id="fa-404-detail">This page does not exist on this site.</p>
<p><a id="fa-404-live" href="/">Go to the home page</a></p>
<script>(function(){
var path=location.pathname,m=path.match(/^(.*\\/(?:branches|STAGING)\\/[^/]+\\/)/);if(!m)return;
var root=m[1],live=root.replace(/(?:branches|STAGING)\\/[^/]+\\/$/,'')+path.slice(root.length);
var d=document.getElementById('fa-404-detail'),a=document.getElementById('fa-404-live');
a.href=live;a.textContent='Open the live site\\u2019s copy of this page';
d.textContent='This preview does not carry this page. It may be unchanged on the branch, so the preview serves the live site\\u2019s copy through a script.';
var key='fa-share-404:'+path;
if(sessionStorage.getItem(key)&&navigator.serviceWorker&&navigator.serviceWorker.controller){d.textContent='Neither this preview nor the live site has this page.';a.href=root;a.textContent='Go to the preview\u2019s home page';return;}
if(!('serviceWorker' in navigator)||sessionStorage.getItem(key)){d.textContent+=' That did not work in this browser.';return;}
d.textContent+=' Loading it\\u2026';
navigator.serviceWorker.register(root+'staging-sw.js',{scope:root}).then(function(){return navigator.serviceWorker.ready;})
  .then(function(){sessionStorage.setItem(key,'1');location.reload();})
  .catch(function(){d.textContent='This preview does not carry this page, and it has no way to serve the live copy (it may have been removed).';});
})();</script></body></html>
`;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function need(name: string): string {
  const v = flag(name);
  if (!v) { console.error(`staging-share: --${name} is required`); process.exit(2); }
  return v;
}

function mb(n: number): string {
  return `${(n / 1048576).toFixed(1)} MB`;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === "write-404") {
    const site = need("site");
    writeFileSync(join(site, "404.html"), NOT_FOUND_HTML);
    console.log(`staging-share: wrote ${join(site, "404.html")}`);
  } else if (cmd === "plan" || cmd === "apply") {
    const root = need("root"), preview = need("preview"), slug = need("slug");
    const plan = planShare(root, preview, slug);
    console.log(`staging-share: ${plan.shared.length} file(s) (${mb(plan.bytesShared)}) are the live site's; ${plan.kept} kept in the preview`);
    if (cmd === "apply") {
      for (const rel of plan.shared) rmSync(join(preview, rel));
      writeFileSync(join(preview, "staging-sw.js"), workerSource(searchStateOf(preview)));
      writeFileSync(join(preview, "shared.json"), JSON.stringify({ version: 1, shared: plan.shared.length, kept: plan.kept }, null, 2) + "\n");
      console.log(`staging-share: removed ${plan.shared.length} shared file(s); wrote staging-sw.js and shared.json`);
    }
  } else {
    console.error("usage: staging-share.ts plan|apply --root <live dir> --preview <preview dir> --slug <slug> | write-404 --site <dir>");
    process.exit(2);
  }
}
