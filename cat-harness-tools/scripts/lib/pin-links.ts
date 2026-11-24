/**
 * Links to a layer at its pin, resolved in the browser.
 *
 * @module scripts/lib/pin-links
 * @graphNode none — a post-build pass over a built site, not a schema
 * @covers none — it reads the built site's HTML, not a declared graph
 *
 * A page that links a layer's file at the commit the index pins
 * (`https://github.com/litlfred/folio-assistant-core/blob/<pin>/x.md`) changes
 * on every re-pin of that layer, though nothing on the page did: one core
 * re-pin rewrote 22 hand-written docs pages (bean `fwtz`, "Shrinking the cone
 * itself"). The same holds for links into the site's own repository at the
 * build commit, which change on every deploy.
 *
 * So the pin moves out of the page and into ONE fetched file, the rule the
 * tiles already follow (cat-harness#434). This pass rewrites each such link to
 * `…/blob/HEAD/x.md` with `data-fa-pin="<mount path>"`, writes the pins to
 * `pins.json` at the site root, and adds a small script that swaps `HEAD` for
 * the pinned commit when the page loads. A re-pin then changes `pins.json`
 * only. Without script, or before `pins.json` arrives, the link still opens
 * the file, on the repository's default branch.
 *
 * Only the pins of THIS build are rewritten: a link at any other commit (a
 * layer site built elsewhere, a quoted historical commit) is a fact of its
 * page and stays as written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

/** One pin: where a repository is mounted in the checkout, and the commit it is at. */
export interface Pin {
  /** Checkout-relative mount path, "" for the checkout itself. */
  path: string;
  repository: string;
  ref: string;
}

/** The site-root file the browser reads the pins from. */
export const PINS_FILE = "pins.json";
/** The script that resolves the links, at the site root. */
export const PIN_SCRIPT = "assets/js/fa-pin-links.js";
/** Marks the script tag, so a page carries it once. */
const SCRIPT_MARK = "data-fa-pins";

/** The key a pin is published under: its mount path, "." for the checkout itself. */
export const pinKey = (p: Pin): string => p.path || ".";

/** `{ <key>: <ref> }`, the content of `pins.json`. */
export function pinsJson(pins: readonly Pin[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of [...pins].sort((a, b) => pinKey(a).localeCompare(pinKey(b)))) out[pinKey(p)] = p.ref;
  return out;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The page with every link at one of `pins` made pin-free, and how many were.
 * Only full 40-hex refs are matched, in `href` and `src`, for `blob` and
 * `tree` URLs. Idempotent: a rewritten link no longer names a commit.
 */
export function unpinHtml(html: string, pins: readonly Pin[]): { html: string; count: number } {
  const byRepoRef = new Map<string, Pin>();
  for (const p of pins) {
    if (!/^[0-9a-f]{40}$/.test(p.ref)) continue;
    const k = `${p.repository.toLowerCase()}@${p.ref}`;
    if (!byRepoRef.has(k)) byRepoRef.set(k, p);
  }
  if (byRepoRef.size === 0) return { html, count: 0 };
  const refs = [...new Set([...byRepoRef.values()].map((p) => p.ref))].map(esc).join("|");
  const re = new RegExp(`\\s(href|src)="https://github\\.com/([\\w.-]+/[\\w.-]+)/(blob|tree)/(${refs})(/[^"]*)?"`, "g");
  let count = 0;
  const out = html.replace(re, (whole, attr: string, repo: string, kind: string, ref: string, rest: string | undefined) => {
    const pin = byRepoRef.get(`${repo.toLowerCase()}@${ref}`);
    if (!pin) return whole;
    count++;
    return ` ${attr}="https://github.com/${repo}/${kind}/HEAD${rest ?? ""}" data-fa-pin="${pinKey(pin)}"`;
  });
  return { html: out, count };
}

/** The script tag for a page at `page` (site-relative), with relative paths so a staging preview reads its own pins. */
export function scriptTag(page: string): string {
  const up = posix.relative(posix.dirname(page), ".") || ".";
  const rel = (p: string): string => (up === "." ? p : `${up}/${p}`);
  return `<script src="${rel(PIN_SCRIPT)}" ${SCRIPT_MARK}="${rel(PINS_FILE)}" defer></script>`;
}

/** The page with the script tag added once, before `</body>` (or at the end). */
export function withScript(html: string, page: string): string {
  if (html.includes(SCRIPT_MARK)) return html;
  const tag = scriptTag(page);
  const i = html.lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + tag + html.slice(i) : html + tag;
}

/**
 * The href the browser should use: `HEAD` swapped for the pinned commit, or
 * the href unchanged when the key has no pin. The same logic as
 * {@link PIN_LINKS_JS}, which `pin-links.test.ts` holds equal to it.
 */
export function pinnedHref(href: string, key: string, pins: Record<string, string>): string {
  const ref = pins[key];
  if (!ref || !/^[0-9a-f]{7,40}$/.test(ref)) return href;
  return href.replace(/^(https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/)HEAD(?=\/|$)/, `$1${ref}`);
}

/** The browser script. ES5, no dependencies; one fetch per page view. */
export const PIN_LINKS_JS = `/* Links to a layer at its pin, resolved from pins.json (cat-harness-tools scripts/lib/pin-links.ts). */
function faPinnedHref(href, key, pins) {
  var ref = pins[key];
  if (!ref || !/^[0-9a-f]{7,40}$/.test(ref)) return href;
  return href.replace(/^(https:\\/\\/github\\.com\\/[^/]+\\/[^/]+\\/(?:blob|tree)\\/)HEAD(?=\\/|$)/, "$1" + ref);
}
(function () {
  if (typeof document === "undefined") return;
  var s = document.currentScript || document.querySelector("script[${SCRIPT_MARK}]");
  var src = s && s.getAttribute("${SCRIPT_MARK}");
  if (!src || !window.fetch) return;
  fetch(src, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (pins) {
    var els = document.querySelectorAll("[data-fa-pin]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], attr = el.hasAttribute("href") ? "href" : "src", v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, faPinnedHref(v, el.getAttribute("data-fa-pin"), pins));
    }
  }).catch(function () {});
})();
`;

/**
 * Rewrite every page in `pages` (site-relative) under `site`, then write
 * `pins.json` and the script. Returns how many pages and links changed.
 * Writes no file when no page carries a pinned link, so such a site gains
 * none.
 */
export function unpinSite(site: string, pages: readonly string[], pins: readonly Pin[]): { pages: number; links: number } {
  let changedPages = 0;
  let links = 0;
  let carrying = 0;
  for (const page of pages) {
    const file = join(site, page);
    const before = readFileSync(file, "utf-8");
    const r = unpinHtml(before, pins);
    const carries = r.count > 0 || before.includes("data-fa-pin=");
    const after = carries ? withScript(r.html, page) : r.html;
    if (carries) carrying++;
    if (after !== before) {
      writeFileSync(file, after);
      changedPages++;
    }
    links += r.count;
  }
  if (carrying > 0) {
    writeFileSync(join(site, PINS_FILE), JSON.stringify(pinsJson(pins), null, 2) + "\n");
    const js = join(site, PIN_SCRIPT);
    if (!existsSync(dirname(js))) mkdirSync(dirname(js), { recursive: true });
    writeFileSync(js, PIN_LINKS_JS);
  }
  return { pages: changedPages, links };
}
