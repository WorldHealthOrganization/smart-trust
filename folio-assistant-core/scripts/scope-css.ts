/**
 * Scope generated CSS under one class, for a page that sits inside the site's
 * Jekyll layout and must restyle nothing of the theme's: the themed document
 * page (`build-document-site.ts --document-layout`) and the comment notes
 * `public-comment-site.ts` adds to it.
 */

/**
 * Rules for the block panel (`.fa-block-panel`, edit-links runtime). The
 * runtime appends the panel to the page's body, outside the page class, so a
 * scoped rule never reached it: on a themed page the panel opened unstyled at
 * the foot of the page (smart-ra, 2026-11-02). Its class is the runtime's own,
 * so leaving these rules global restyles nothing of the theme's.
 */
const GLOBAL = /(^|\s)\.fa-block-panel(?![\w-])/;

/** One selector under `scope`. */
function scopeSelector(p: string, scope: string): string {
  if (/^(:root|html|body)$/.test(p)) return scope;
  if (GLOBAL.test(p)) return p;
  // A state class on the root (`html.fa-bp .x`, which the runtime sets once it
  // has run) stays on the root, with the scope after it. `scope html.fa-bp .x`
  // matched nothing, so the block panel's rules never applied on a themed page.
  const root = p.match(/^((?::root|html|body)(?:[.:[][^\s>+~]*)?)(\s*[>+~]?\s*)([\s\S]*)$/);
  if (root && root[3] && /^(?::root|html|body)[.:[]/.test(p)) return `${root[1]} ${scope} ${root[3]}`;
  return `${scope} ${p}`;
}

/**
 * Put every rule of `css` under `scope`: `a, b {…}` becomes `scope a, scope b {…}`,
 * `:root`, `html` and `body` become `scope` itself, `html.x a` becomes
 * `html.x scope a`, block-panel rules stay global (see {@link GLOBAL}), and
 * `@media` / `@supports` blocks are scoped inside. Comments are dropped. For
 * flat generated CSS (the block actions'), not a general CSS parser.
 */
export function scopeCss(css: string, scope: string): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const sel = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    for (; j < src.length && depth > 0; j++) depth += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0;
    const inner = src.slice(open + 1, j - 1);
    if (/^@(media|supports)\b/.test(sel)) out += `${sel} {\n${scopeCss(inner, scope)}}\n`;
    else if (sel.startsWith("@")) out += `${sel} {${inner}}\n`;
    else if (sel) out += `${sel.split(",").map((p) => scopeSelector(p.trim(), scope)).join(", ")} {${inner}}\n`;
    i = j;
  }
  return out;
}
