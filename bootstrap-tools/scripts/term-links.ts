/**
 * Link every defined term in a piece of Markdown prose to its definition.
 *
 * A capitalized defined term is a link wherever it
 * appears in prose, not only at its first use, so a reader landing mid-page
 * can still reach the definition in one click.
 *
 * ## What is linked, and what is left alone
 *
 * - A term is matched by its spaced name (`Knowledge Graph`), singular or
 *   plural, as a whole, case-sensitive word; longer names first, so
 *   `Node Kind` is never also read as `Node`.
 * - Left alone: fenced code and inline code, headings, the text and target of
 *   an existing link, HTML tags, and **bold** spans — the bold names in a
 *   Role table (`**Knowledge Graph Data Store**`) are names of their own, and
 *   linking a word inside one would split it.
 *
 * Pure: text in, text out. Callers decide where each term's link goes,
 * because the right relative path depends on where the README is.
 *
 * @module bootstrap-tools/scripts/term-links
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** One term: its key (`KnowledgeGraph`) and the link to write for it. */
export interface TermTarget {
  key: string;
  href: string;
}

/** `KnowledgeGraph` → `Knowledge Graph`. */
export const spacedTerm = (key: string): string => key.replace(/([a-z])([A-Z])/g, "$1 $2");

/** `Knowledge Graph` → `knowledge-graph`: the anchor bootstrap's schema page gives each term. */
export const termAnchor = (key: string): string => spacedTerm(key).toLowerCase().replace(/ /g, "-");

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The regions of a line that are NOT prose: inline code, an existing link
 * (text and target), an HTML tag, a bold span, an autolink.
 */
const PROTECTED = /`[^`]*`|\[[^\]]*\]\([^)]*\)|<[^>]+>|\*\*[^*]+\*\*|https?:\/\/\S+/g;

/**
 * A term and its plurals, as a regular expression: `Node Kinds`, `Classes`,
 * and `Graph Typologies` for a term ending in a consonant and `y`.
 */
export function pluralised(term: string): string {
  const e = esc(term);
  return /[^aeiou]y$/i.test(term) ? `${e.slice(0, -1)}(?:y|ies)` : `${e}(?:s|es)?`;
}

/** The term a matched occurrence is a form of. */
export function singular(match: string, known: { has(k: string): boolean }): string {
  for (const c of [match, match.replace(/ies$/, "y"), match.replace(/es$/, ""), match.replace(/s$/, "")]) if (known.has(c)) return c;
  return match;
}

/** Link every term occurrence in `markdown`, returning the text and how many links were added. */
export function linkTerms(markdown: string, targets: readonly TermTarget[]): { text: string; added: number } {
  // No terms, no links: an empty alternation would match the empty string at
  // every word boundary (measured: a fixture with no bootstrap got `[](undefined)`
  // around every word).
  if (targets.length === 0) return { text: markdown, added: 0 };
  const byLength = [...targets].sort((a, b) => spacedTerm(b.key).length - spacedTerm(a.key).length);
  const pattern = new RegExp(`\\b(?:${byLength.map((t) => pluralised(spacedTerm(t.key))).join("|")})\\b`, "g");
  const hrefOf = new Map(targets.map((t) => [spacedTerm(t.key), t.href]));
  let added = 0;
  let fenced = false;
  const lines = markdown.split("\n");
  // A table's header row is followed by its `|---|` separator: a column name,
  // not prose, and a link there would read as a sort control.
  const isHeader = (i: number) => /^\s*\|/.test(lines[i]!) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "");
  const out = lines.map((line, i) => {
    if (isHeader(i)) return line;
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return line;
    }
    if (fenced || /^\s{0,3}#/.test(line) || /^\s*<!--/.test(line)) return line;
    // Split into protected and prose pieces, and link only the prose.
    let result = "";
    let last = 0;
    const linkProse = (prose: string) =>
      prose.replace(pattern, (m: string) => {
        added++;
        return `[${m}](${hrefOf.get(singular(m, hrefOf))!})`;
      });
    for (const m of line.matchAll(PROTECTED)) {
      result += linkProse(line.slice(last, m.index)) + m[0];
      last = m.index! + m[0].length;
    }
    return result + linkProse(line.slice(last));
  });
  return { text: out.join("\n"), added };
}

/** Occurrences of a term in prose that are NOT links — what a guard test fails on. */
export function unlinkedTerms(markdown: string, targets: readonly TermTarget[]): string[] {
  const found: string[] = [];
  const { text } = linkTerms(markdown, targets.map((t) => ({ key: t.key, href: "\u0000" })));
  for (const m of text.matchAll(/\[([^\]]+)\]\(\u0000\)/g)) found.push(m[1]!);
  return found;
}

/**
 * Where bootstrap's schema page is published: the directory README Pages
 * serves at `schemas/` (GitHub Pages' `jekyll-readme-index` makes a
 * directory's README its index). A README outside bootstrap links here, and
 * only here.
 */
export const BOOTSTRAP_SCHEMA_PAGE = "https://litlfred.github.io/bootstrap/schemas/";

/**
 * bootstrap's defined terms, each linked to its row in bootstrap's schema page.
 *
 * Inside bootstrap — `fromDir` at or under a directory whose `bootstrap.json`
 * names `bootstrap` and which carries `schemas/README.md` — the link is
 * relative, so it works in a clone with nothing published. Anywhere else it is
 * the published page, whatever sits beside the README: a sibling checkout, a
 * monorepo, or nothing at all. The output must not depend on the layout it
 * was generated in (2026-10-01: bootstrap-tools' README gained `../bootstrap/`
 * links when regenerated next to bootstrap, and none standing alone).
 *
 * `repoRoot` is kept for callers and no longer decides anything.
 */
export function bootstrapTermTargets(_repoRoot: string, fromDir: string, keys: readonly string[]): TermTarget[] {
  const own = bootstrapRootAbove(resolve(fromDir));
  const href = own ? relative(resolve(fromDir), join(own, "schemas", "README.md")).split("\\").join("/") : BOOTSTRAP_SCHEMA_PAGE;
  return keys.map((key) => ({ key, href: `${href}#${termAnchor(key)}` }));
}

/** The nearest directory at or above `dir` that is bootstrap itself, if any. */
function bootstrapRootAbove(dir: string): string | undefined {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, "schemas", "README.md")) && declaredName(d) === "bootstrap") return d;
    if (dirname(d) === d) return undefined;
  }
}

/** The `name` the `bootstrap.json` in `root` declares, if it parses. */
function declaredName(root: string): string | undefined {
  try {
    const d = JSON.parse(readFileSync(join(root, "bootstrap.json"), "utf-8")) as { name?: unknown };
    return typeof d.name === "string" ? d.name : undefined;
  } catch {
    return undefined;
  }
}
