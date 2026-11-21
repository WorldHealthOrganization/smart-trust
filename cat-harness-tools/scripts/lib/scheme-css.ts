/**
 * Dark-scheme CSS that follows the reader's light/dark switch — issue #2208.
 *
 * A page written with `@media (prefers-color-scheme: dark) { … }` follows the
 * OPERATING SYSTEM and nothing else. On a folio's site the navbar's light bulb
 * sets `data-fa-scheme` on `<html>` (`docs-ui.js`'s `applyScheme`), and a page
 * styled only by the media query ignores it: owner, 2026-10-05, on smart-ra's
 * public-comment page, *"the LHS navbar icons work for the links … but not for
 * the other javscript ones like light bulb"*.
 *
 * {@link darkRules} writes the same rules twice, so one switch decides:
 *
 * - under the media query, unless the reader picked LIGHT
 *   (`:root:not([data-fa-scheme="light"])`) — the OS still decides for a reader
 *   who never pressed the switch;
 * - unconditionally under `:root[data-fa-scheme="dark"]` — a reader who picked
 *   DARK gets it on a light OS.
 *
 * Flat rules only (`selector, selector { declarations }`): a nested block is
 * refused rather than mangled, because a rule silently dropped from one of
 * the two copies is a page that is half dark.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { HARNESS_ROOT } from "./roots.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

const NOT_LIGHT = `:root:not([data-fa-scheme="light"])`;
const DARK = `:root[data-fa-scheme="dark"]`;

/** Scope one selector under `root`: `:root` itself becomes `root`, anything else a descendant of it. */
function scoped(selector: string, root: string): string {
  const s = selector.trim();
  return s === ":root" ? root : s.startsWith(":root") ? root + s.slice(":root".length) : `${root} ${s}`;
}

/** `rules` re-scoped under `root`. */
function under(rules: string, root: string): string {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let consumed = 0;
  for (const m of rules.matchAll(re)) {
    if (rules.slice(consumed, m.index).trim() !== "") break;
    consumed = m.index! + m[0].length;
    out.push(`${m[1]!.split(",").map((sel) => scoped(sel, root)).join(", ")} {${m[2]}}`);
  }
  if (rules.slice(consumed).trim() !== "") {
    throw new Error(`scheme-css: darkRules takes flat rules only; could not read ${JSON.stringify(rules.slice(consumed, consumed + 60))}`);
  }
  return out.join(" ");
}

/**
 * The dark-scheme `rules`, applied when the OS is dark and the reader has not
 * picked light, or whenever the reader has picked dark.
 */
export function darkRules(rules: string): string {
  return `@media (prefers-color-scheme: dark) { ${under(rules, NOT_LIGHT)} }\n  ${under(rules, DARK)}\n  ` +
    `:root[data-fa-scheme="light"] { color-scheme: light; } :root[data-fa-scheme="dark"] { color-scheme: dark; }`;
}

/**
 * The reader's colour scheme, decided before first paint on a page that writes
 * its own `<head>` — bean `dc64`, and the owner's rule of 2026-10-15, *"follow
 * os else light"*: the reader's stored choice (`fa-color-scheme`), then the
 * OS's `prefers-color-scheme`, then LIGHT.
 *
 * The dashboards (beans, todos, translation status) and a folio's railed pages
 * style both schemes through `data-fa-scheme` on `<html>`. On a themed page
 * the first-paint snippet in `head_custom.html` sets it; these pages do not
 * include that file, so this puts the SAME snippet in their head.
 *
 * ONE SOURCE. The script is LIFTED from between `head_custom.html`'s
 * `fa-first-paint` markers ({@link firstPaintSchemeScript}), not written again
 * here: it was a second copy until 2026-10-15, with its own fallback (no
 * attribute at all, so the page's CSS default — dark — decided), and two
 * copies of a rule are two answers free to disagree. On a page with no
 * just-the-docs its theme-sheet swap finds no `jtd` and does nothing.
 */
export function withSavedScheme(html: string): string {
  const script = firstPaintSchemeScript().replace(/^<script\b/i, `<script ${SCHEME_MARK}`);
  // A snippet THIS function put there earlier — or a page that copied one —
  // is brought up to the current rule rather than trusted for carrying the
  // mark: `slices/search.html` shipped the 2026-10-05 rule (the stored choice
  // and nothing else, so the static dark sheet decided for everyone else) a
  // day after the rule changed, because the mark alone made this a no-op.
  if (html.includes(SCHEME_MARK)) {
    let first = true;
    const out = html.replace(MARKED, () => {
      if (!first) return "";
      first = false;
      return script;
    });
    // A mark that is not on a <script> is prose, not a snippet: fall through.
    if (!first) return out;
  }
  // A themed page already carries the snippet itself, from head_custom.html.
  if (html.includes(firstPaintSchemeScript())) return html;
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head) return html;
  const at = head.index + head[0].length;
  return html.slice(0, at) + "\n" + script + "\n" + html.slice(at);
}

const SCHEME_MARK = `data-folio-saved-scheme`;
/** A marked snippet, whatever rule it carries. */
const MARKED = new RegExp(`<script ${SCHEME_MARK}>[\\s\\S]*?</script>`, "g");

/** The markers `head_custom.html` wraps its first-paint block in. */
export const FIRST_PAINT_BEGIN = "<!-- fa-first-paint:begin -->";
export const FIRST_PAINT_END = "<!-- fa-first-paint:end -->";

let firstPaintCache: string | undefined;
/**
 * The first-paint `<script>…</script>` exactly as `head_custom.html` ships it —
 * the one place the scheme rule is written. Throws if it cannot be found: a
 * silent default would put a different rule on these pages than on the rest
 * of the site.
 */
export function firstPaintSchemeScript(): string {
  if (firstPaintCache) return firstPaintCache;
  // declared-path-literal: a platform asset of the harness, not a folio
  // directory. It is the one place the rule is defined.
  const head = readFileSync(pathToFileURL(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "_includes/head_custom.html"))), "utf-8");
  const a = head.indexOf(FIRST_PAINT_BEGIN);
  const b = head.indexOf(FIRST_PAINT_END);
  const block = a >= 0 && b > a ? head.slice(a + FIRST_PAINT_BEGIN.length, b) : "";
  const m = /<script>[\s\S]*?<\/script>/.exec(block);
  if (!m) throw new Error("scheme-css: head_custom.html no longer carries a fa-first-paint <script> — standalone pages cannot follow the reader's scheme");
  if (!m[0].includes(JSON.stringify(schemeKey()))) {
    throw new Error(`scheme-css: the first-paint snippet does not read docs-ui.js's SCHEME_KEY (${schemeKey()}) — the two would disagree`);
  }
  firstPaintCache = m[0];
  return firstPaintCache;
}

let schemeKeyCache: string | undefined;
/** The key `docs-ui.js` stores the reader's scheme under. Throws if it cannot be found: a silent default would disconnect every page. */
export function schemeKey(): string {
  if (schemeKeyCache) return schemeKeyCache;
  // declared-path-literal: a platform asset beside this module, not a folio
  // directory. It is the one place the key is defined.
  const js = readFileSync(pathToFileURL(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js"))), "utf-8");
  const m = /var SCHEME_KEY = "([^"]+)";/.exec(js);
  if (!m) throw new Error("viewer-page: docs-ui.js no longer declares SCHEME_KEY — the dashboards cannot follow the reader's scheme");
  schemeKeyCache = m[1]!;
  return schemeKeyCache;
}
