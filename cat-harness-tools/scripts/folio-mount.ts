/**
 * The folio mount: how a page that is NOT folio-assistant's carries the
 * reader's folio, so every harness offers the same folio.
 *
 * The glass (R25) comes down OVER whatever is being browsed, so `mountGlass()`
 * appends to `document.body` and is called from `init()` unconditionally; it
 * needs no `<main>`, `.main-content` or sidebar header, which a replica page
 * must not grow. `test/content/glass.e2e.ts` proves it against such a
 * fixture. This module ships the mount and nothing else.
 *
 * It is a fragment, not a port: a page gets the platform's own stylesheet and
 * script by reference (`board-windows` §"The folio belongs to the HARNESS":
 * the test is *"is this the same folio"*), so there is no second
 * implementation to drift.
 *
 * ## Why the root is derived in the browser
 *
 * These pages are served from **two** mount routes — `/<instance>/` and
 * `/docs/<instance>/` — so a document-relative `href` 404s under one of them,
 * and an absolute site URL would bake in the publication base (what
 * `canonicalUrl` exists to stop) and break staging previews under
 * `/branches/<branch>/`. `siteRootOf` below derives the root and the inlined
 * `client` applies the SAME pattern object, passed in by the caller, so there
 * is one expression. `folio-mount.test.ts` runs the shipped bytes to check it.
 *
 * ## The route shape is the CALLER's
 *
 * The caller passes the pattern that finds its own layer root, so the
 * platform names no library; the platform owns the mount, the marker and the
 * gate.
 *
 * @module scripts/folio-mount
 */

import { commentGuard } from "./html-comments.ts";

/**
 * The attribute the gate looks for.
 *
 * On the injected `<script>` element itself rather than on a wrapper `<div>`:
 * a wrapper would be a visible node on a page whose whole requirement is to
 * look untouched, and the glass builds its own chrome into `document.body`
 * when it mounts.
 */
export const MARKER = "data-fa-folio-mount";

/**
 * Derive the site root from a pathname, given the pattern that finds the
 * layer's own root.
 *
 * `pattern` is a regular expression whose **first capture group is the site
 * root, including its trailing slash**. For a layer `<name>`, mounted at both
 * `/<name>/` and `/docs/<name>/`:
 *
 *     /^(.*?)(?:docs\/)?<name>\//
 *
 * Non-greedy, so it anchors on the FIRST occurrence: a library item whose
 * slug happened to contain the layer name cannot move the root.
 *
 * Returns `null` when the pathname does not match — a real state, not a
 * failure to paper over. The client leaves the page alone rather than
 * guessing a root and requesting two assets that 404.
 */
export function siteRootOf(pathname: string, pattern: RegExp): string | null {
  const m = pathname.match(pattern);
  return m && m[1] != null ? m[1] : null;
}

/**
 * The client half, inlined verbatim.
 *
 * Inlined for the same reason `staging-banner`'s is: a `<script src>` for the
 * bootstrap would itself need a document-relative href, reintroducing the
 * per-mount variation this exists to remove. It is ~700 bytes; the two real
 * assets it appends are ordinary cached requests.
 *
 * `media="print"`/`onload` is NOT used to defer the stylesheet. The glass is
 * interactive chrome and a flash of an unstyled handle is worse than a
 * marginally later paint — and the handle is the one control a reader needs
 * to find without being told.
 */
function client(patternSource: string): string {
  return `(function(){
var m=location.pathname.match(new RegExp(${JSON.stringify(patternSource)}));
if(!m||m[1]==null)return;
var r=m[1];
var l=document.createElement('link');
l.rel='stylesheet';l.href=r+'assets/css/docs-ui.css';
document.head.appendChild(l);
var s=document.createElement('script');
s.src=r+'assets/js/docs-ui.js';s.defer=true;
document.head.appendChild(s);
})();`;
}

/**
 * The fragment a generator injects, for a page whose site root is found by
 * `pattern`.
 *
 * Constant for a given pattern — it carries no per-page fact, so every page
 * of a layer gets byte-identical bytes. That is `g196`'s property and it
 * matters here for the same reason: a fragment varying per page makes every
 * rebuild a new blob in `gh-pages`.
 */
export function fragment(pattern: RegExp): string {
  return `<script ${MARKER}>${client(pattern.source)}</script>`;
}

/**
 * Whether a document already carries the mount.
 *
 * Asks for the marker rather than for the script's text, so a page that
 * carries the fragment inside an HTML comment — the `ur84` failure — is not
 * counted as mounted, through the SAME scanner `bodyInsertionPoint` uses
 * (`html-comments.ts`) rather than a second copy of it. `hasMount` asks
 * deliberately the same question the gate asks, so a page that passes the
 * gate is a page this function calls mounted.
 */
export function hasMount(html: string): boolean {
  const i = html.indexOf(MARKER);
  if (i < 0) return false;
  return !commentGuard(html)(i);
}
