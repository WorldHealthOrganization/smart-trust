/**
 * Markdown parsing, shared by everything that reads a block's prose.
 *
 * Extracted from `render-latex.ts` on 2026-09-18 because it is not about
 * LaTeX. `validate-defterm.ts` and `codemod-refterm.ts` walk the Markdown AST
 * to find `:defterm` and `:refterm` directives; `build.ts` scans the same prose
 * for the glossary terms a document references. None of that renders anything,
 * and a generic document folio — which has no TeX at all — needs all of it.
 *
 * Living inside a 1,900-line LaTeX renderer made the generic pipeline depend on
 * the science layer: four wrong-direction import edges in `check:partition`,
 * every one of them a circular dependency after the repo split.
 *
 * ## The one LaTeX-shaped thing here, and why it stays
 *
 * {@link protectPipesInInlineMath} rewrites `|` inside `$…$` before parsing.
 * That is a workaround for micromark's GFM table extension, which is a *flow*
 * construct and splits rows on `|` before remark-math tokenises inline maths —
 * so `$\langle a|b\rangle$` spills into table cells. The bug is in the
 * interaction of two Markdown extensions, not in LaTeX, and any consumer
 * parsing maths-bearing Markdown hits it. It belongs with the parser.
 *
 * @module pipeline/markdown-ast
 */

import { remark } from "remark";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
// Selective GFM: gfm-autolink-literal is excluded because it OOMs on dotted
// Lean identifiers (e.g. "QOU.Archimedean.Foo.bar"). Tables and strikethrough
// are loaded individually from remark-gfm's transitive deps.
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import type { Root } from "mdast";
import type { Block } from "../schemas/types.ts";
// Type-only, for their side effect: each augments mdast's `RootContentMap`
// with the node types its remark plugin produces.
import type {} from "mdast-util-math";
import type {} from "mdast-util-directive";

export const mdParser = remark()
  .data("micromarkExtensions", [gfmTable(), gfmStrikethrough()])
  .data("fromMarkdownExtensions", [
    gfmTableFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
  ])
  .use(remarkDirective)
  .use(remarkMath);

/**
 * Protect bare `|` inside inline `$...$` math from the GFM table parser.
 *
 * micromark's gfm-table is a *flow* construct: it splits table rows on `|`
 * before remark-math tokenises inline math, so a cell like
 * `$|\mathrm{tr}_M(\rho(\beta))|$` or `$\langle a|b\rangle$` spills into
 * extra columns ("Extra alignment tab has been changed to \cr" — a fatal
 * pdflatex error) and the orphaned `$` get escaped to literal text.
 *
 * Replace each bare `|` inside an inline math span with `\vert ` — which is
 * output-identical in math mode — so the table parser sees no spurious
 * delimiters. Real cell separators (`|` outside math) and fenced code
 * blocks are left untouched.
 */
export function protectPipesInInlineMath(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    lines[i] = lines[i].replace(/\$[^$\n]+\$/g, (seg) =>
      seg.replace(/(?<!\\)\|/g, "\\vert "),
    );
  }
  return lines.join("\n");
}

/**
 * Parse markdown content via remark, caching the resulting AST.
 * Multiple render functions (markdownToLatex, extractMathContent)
 * may be called on the same content within a single build — this
 * avoids redundant parses.  Bounded to 512 entries to cap memory.
 */
const MD_AST_CACHE_LIMIT = 512;
const _mdAstCache = new Map<string, Root>();
export function parseMdCached(md: string): Root {
  let tree = _mdAstCache.get(md);
  if (!tree) {
    tree = mdParser.parse(protectPipesInInlineMath(md));
    if (_mdAstCache.size >= MD_AST_CACHE_LIMIT) {
      // Evict oldest entry (first inserted key)
      const firstKey = _mdAstCache.keys().next().value;
      if (firstKey !== undefined) _mdAstCache.delete(firstKey);
    }
    _mdAstCache.set(md, tree);
  }
  return tree;
}

/**
 * Scan every loaded block for glossary-term references and return the
 * document-wide `term:<slug>` set for {@link RenderOptions.referencedTerms}.
 */
export function collectReferencedTerms(
  blocks: Map<string, { block: Block; mdContent: string; sourceDir?: string }>,
): Set<string> {
  const refs = new Set<string>();
  for (const { mdContent } of blocks.values()) {
    if (!mdContent) continue;
    for (const m of mdContent.matchAll(
      /:refterm\[([^\]]*)\](?:\{#([^}]+)\})?/g,
    )) {
      refs.add(`term:${m[2] ?? m[1]}`);
    }
    for (const m of mdContent.matchAll(/\\refterm\{([^}]+)\}/g)) {
      refs.add(`term:${m[1]}`);
    }
  }
  return refs;
}

/** Clear the markdown AST cache (e.g. between builds in watch mode). */
export function clearMdAstCache(): void {
  _mdAstCache.clear();
}
