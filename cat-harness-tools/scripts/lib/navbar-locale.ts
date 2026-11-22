/**
 * The browser half of the rail in the page's language: which strings file a
 * page loads, and how a label is swapped. Browser-safe (no `node:` imports),
 * because `navbar-client.ts` bundles it; the writer is `navbar-strings.ts`.
 *
 * @module scripts/lib/navbar-locale
 */
import { RAIL_DATA_DIR } from "./harness-rail.ts";
import { PAGE_BAR_CLASS } from "./page-layout-classes.ts";

/** The global the strings files fill, keyed by locale. */
export const NAV_STRINGS_GLOBAL = "FaNavStrings";

/** A locale's strings file, relative to the site root. */
export function navbarStringsFile(locale: string): string {
  return `${RAIL_DATA_DIR}/strings-${locale}.js`;
}

/**
 * The locale a page's rail should be drawn in, from its `<html lang>`: `undefined`
 * for no `lang` and for English, the language the rail's own words and the
 * shared rail data are written in, so an English page asks for no file.
 */
export function railLocale(lang: string | null | undefined): string | undefined {
  const l = (lang ?? "").trim().toLowerCase();
  if (!l || l === "en" || l.startsWith("en-")) return undefined;
  // A BCP 47 tag's shape and nothing else: it becomes part of a script's address.
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(l) ? l : undefined;
}

/**
 * The rail's `data-fa-root` as a script base, or `undefined`: only a relative
 * path of `.`/`..` segments (`.`, `..`, `../..`), which is all the rail writes.
 * Anything else (a scheme, a host, an absolute path) loads nothing.
 */
export function railRootPath(root: string | null | undefined): string | undefined {
  const r = (root ?? "").trim().replace(/\/+$/, "") || ".";
  return /^\.\.?(?:\/\.\.)*$/.test(r) ? r : undefined;
}

/**
 * Swap the rail's labels, names and tooltips for their translations, in place.
 *
 * EXACT MATCH OR NOTHING: a label is replaced only when its whole trimmed text
 * is a key, so a label with no entry keeps its English and nothing is ever half
 * translated. The text node is replaced, never the element, so the marks, the
 * links and every attribute the other scripts read stay as built.
 */
export function localiseRail(nav: ParentNode, map: Readonly<Record<string, string>>): number {
  let swapped = 0;
  nav.querySelectorAll(".fa-nav-label").forEach((el) => {
    el.childNodes.forEach((n) => {
      if (n.nodeType !== 3) return;
      const text = n.textContent ?? "";
      const key = text.trim();
      const to = key ? map[key] : undefined;
      if (to === undefined) return;
      n.textContent = text.replace(key, to);
      swapped++;
    });
  });
  return swapped + swapNames(nav, map);
}

/** The names and tooltips under `root` that a translation replaces, whole. */
const NAME_ATTRS = ["aria-label", "data-fa-tip", "title", "placeholder"] as const;

function swapNames(root: ParentNode, map: Readonly<Record<string, string>>): number {
  let swapped = 0;
  root.querySelectorAll(NAME_ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
    for (const attr of NAME_ATTRS) {
      const v = el.getAttribute(attr);
      const to = v ? map[v.trim()] : undefined;
      if (to !== undefined) {
        el.setAttribute(attr, to);
        swapped++;
      }
    }
  });
  return swapped;
}

/** A node as the swap reads it: enough of the DOM for the tests to fake. */
interface TextTree {
  nodeType: number;
  nodeName?: string;
  textContent: string | null;
  childNodes?: ArrayLike<TextTree> & Iterable<TextTree>;
}

/** Text that is code or style, never words: its text nodes are left alone. */
const NOT_WORDS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "CODE"]);

function swapText(n: TextTree, map: Readonly<Record<string, string>>): number {
  if (n.nodeType === 3) {
    const text = n.textContent ?? "";
    const key = text.trim();
    const to = key ? map[key] : undefined;
    if (to === undefined) return 0;
    n.textContent = text.replace(key, to);
    return 1;
  }
  if (n.nodeType !== 1 || NOT_WORDS.has((n.nodeName ?? "").toUpperCase())) return 0;
  let swapped = 0;
  for (const c of Array.from(n.childNodes ?? [])) swapped += swapText(c, map);
  return swapped;
}

/**
 * The page's top bar (the shared layout's {@link PAGE_BAR_CLASS}: an IG's menu
 * and title) in the page's language, by the same rule as the rail: a text node
 * or a name is replaced only when its whole trimmed text is a key. A site's
 * `navbar.po` already holds those labels, since the rail's tree is drawn from
 * the same menu (owner, 2026-11-13: "translate the top menu bar too").
 */
export function localisePageBar(doc: ParentNode, map: Readonly<Record<string, string>>): number {
  let swapped = 0;
  doc.querySelectorAll(`.${PAGE_BAR_CLASS}`).forEach((bar) => {
    swapped += swapText(bar as unknown as TextTree, map) + swapNames(bar, map);
  });
  return swapped;
}
