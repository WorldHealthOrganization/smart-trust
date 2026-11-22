/**
 * Generate a per-block standalone .tex file for independent compilation.
 *
 * Each block is wrapped in a minimal but complete LaTeX document that uses
 * the same shared preamble and paper macros as the full paper, so the
 * typography, environments (\begin{theorem}, \begin{definition}, etc.) and
 * custom commands are identical to what the reader will see in the published
 * PDF.
 *
 * Design decisions:
 *   - \documentclass{book} (not \standalone) so the block environments defined
 *     in the shared preamble (which targets book/report geometry) compile
 *     without modification.
 *   - Margin annotations (\blockannot, \chapterannot, \sectionannot,
 *     \marginnote, \blockmargin) are stripped: they reference a live GitHub
 *     repo URL and require the full margin layout — neither is meaningful in
 *     a single-block preview PDF.
 *   - Cross-references (\hyperref, \nameref, \uses) are preserved: pdflatex
 *     will emit "reference undefined" warnings but will NOT error.  The log
 *     scraper in render-changed-blocks.ts treats these as warnings, not errors.
 *   - A \bibliographystyle + \bibliography tail is emitted so \cite{} calls
 *     resolve when a references.bib file is present; if it is absent pdflatex
 *     only warns.
 *
 * Usage (from the CLI in render-changed-blocks.ts, or directly):
 *   import { generateBlockStandaloneTex } from "./generate-block-tex";
 *
 * @module pipeline/generate-block-tex
 */

import { readFileSync } from "fs";
import type { Paper, Block } from "../schemas/types.ts";
import { renderBlock } from "./render-latex";

// ── Annotation macros to strip from standalone output ────────────────────────
// These macros are defined in the full preamble but depend on full-paper
// context (margin layout, live GitHub links, tracker integrations).  They are
// safe to no-op in a standalone block preview.
const ANNOTATION_MACROS = [
  "blockannot",
  "chapterannot",
  "sectionannot",
  "blockmargin",
];

/**
 * Strip annotation macro calls from rendered LaTeX.
 *
 * Handles both optional-argument forms:
 *   \blockannot[status]{label}{decl}{path}
 *   \blockannot{label}{decl}{path}
 * and the simpler:
 *   \chapterannot{slug}{label}
 *   \sectionannot{label}
 *
 * Strategy: replace each \macroname[...]{...}{...}... call with an empty
 * string.  We remove the whole call including all brace groups that follow
 * (up to 4 groups) and an optional [...] prefix argument.
 */
export function stripAnnotations(latex: string): string {
  let result = latex;
  for (const macro of ANNOTATION_MACROS) {
    // Match: \macroname followed by optional [arg] then 1–4 {arg} groups.
    // Uses a simple iterative replacement (no regex backtracking on nested
    // braces) — sufficient because annotation arguments never contain
    // nested braces deeper than one level.
    const re = new RegExp(
      `\\\\${macro}(?:\\[[^\\]]*\\])?(?:\\{[^}]*\\}){1,4}`,
      "g",
    );
    result = result.replace(re, "");
  }
  // Also strip bare \marginnote[...]{...} which the preamble defines for
  // margin content — standalone pages have no margin layout to put it in.
  result = result.replace(/\\marginnote(?:\[[^\]]*\])?\{[^}]*\}/g, "");
  return result;
}

/**
 * Escape text for use in LaTeX metadata fields (title, author).
 * Uses a single-pass function callback so backslash is never interpreted
 * as a replacement pattern (avoids incomplete-sanitization).
 */
function escapeLatexMeta(text: string): string {
  const escapes: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    "_": "\\_",
  };
  return text.replace(/[\\&#%_]/g, (ch) => escapes[ch] ?? ch);
}

export interface BlockStandaloneOptions {
  /** Path to the shared preamble.tex. */
  preamblePath: string;
  /**
   * Working directory for \bibliography{references}.
   * latexmk must be run from a directory where references.bib can be found,
   * or this path can be an absolute path to the .bib file (without extension).
   * Defaults to "references" (relative).
   */
  bibliographyPath?: string;
}

/**
 * Generate a standalone .tex document for a single content block.
 *
 * @param paper      - The paper manifest (for title, authors, macros).
 * @param block      - The block manifest object.
 * @param mdContent  - The block's .md narrative content.
 * @param blockName  - The block's root name (e.g. "def-observable").
 * @param sourceDir  - The block's chapter directory, relative to repo root
 *                     (e.g. "content/quantum-observable-universe/ch1-setup").
 *                     Used for the source-link in \blockannot (stripped here,
 *                     but passed through to renderBlock for completeness).
 * @param opts       - Options: preamble path, bibliography path.
 * @returns Complete LaTeX source for a standalone compilable document.
 */
export function generateBlockStandaloneTex(
  paper: Paper,
  block: Block,
  mdContent: string,
  blockName: string,
  sourceDir: string | undefined,
  opts: BlockStandaloneOptions,
): string {
  const lines: string[] = [];

  // ── 1. Shared preamble (inlined) ──────────────────────────────────────────
  const preamble = readFileSync(opts.preamblePath, "utf-8");
  lines.push(preamble.trimEnd());
  lines.push("");

  // ── 2. Paper macros ───────────────────────────────────────────────────────
  if (paper.macros && Object.keys(paper.macros).length > 0) {
    lines.push("% ── Paper macros ────────────────────────────────────────────────────────────");
    for (const [name, macro] of Object.entries(paper.macros)) {
      const comment = macro.unicode ? `  % ${macro.unicode}` : "";
      lines.push(`\\newcommand{\\${name}}{${macro.tex}}${comment}`);
    }
    lines.push("");
  }

  // ── 3. Standalone-mode annotation no-ops ──────────────────────────────────
  // Re-define annotation macros as no-ops so any stray call that the regex
  // stripper misses (e.g. in raw \tex blocks) doesn't abort compilation.
  lines.push("% ── Annotation no-ops (standalone preview) ─────────────────────────────────");
  lines.push("\\renewcommand{\\blockannot}[4][]{}");
  lines.push("\\renewcommand{\\chapterannot}[2]{}");
  lines.push("\\renewcommand{\\sectionannot}[1]{}");
  lines.push("\\renewcommand{\\marginnote}[2][]{}");
  lines.push("");

  // ── 4. Metadata ───────────────────────────────────────────────────────────
  const blockTitle = ("title" in block && block.title)
    ? String(block.title)
    : ("label" in block && block.label)
      ? String(block.label)
      : blockName;
  const authorName = escapeLatexMeta(paper.authors[0] || "");
  lines.push("% ── Metadata ────────────────────────────────────────────────────────────────");
  lines.push(`\\title{${escapeLatexMeta(blockTitle)} \\\\ {\\small ${escapeLatexMeta(paper.title)}}}`);
  lines.push(`\\author{${authorName}}`);
  lines.push(`\\date{${paper.date ? escapeLatexMeta(paper.date) : "\\today"}}`);
  lines.push("");
  lines.push("\\hypersetup{");
  lines.push(`  pdftitle  = {${escapeLatexMeta(blockTitle)}},`);
  lines.push(`  pdfauthor = {${escapeLatexMeta(paper.authors.join(", "))}},`);
  lines.push("  colorlinks = true,");
  lines.push("  linkcolor  = blue,");
  lines.push("  citecolor  = blue,");
  lines.push("  urlcolor   = blue,");
  lines.push("}");
  lines.push("");

  // ── 5. Document body ──────────────────────────────────────────────────────
  lines.push("\\begin{document}");
  lines.push("\\maketitle");
  lines.push("");

  // Render the block using the same pipeline as the full paper.
  const blockLatex = renderBlock(block, mdContent, sourceDir, blockName);
  // Strip margin annotations (belt-and-suspenders on top of the \renewcommand
  // no-ops above — the regex catches calls emitted by renderBlock itself).
  const cleanLatex = stripAnnotations(blockLatex);
  lines.push(cleanLatex);
  lines.push("");

  // ── 6. Bibliography tail ──────────────────────────────────────────────────
  // Emitting these unconditionally is harmless when no .bib is present —
  // pdflatex warns but does not error.
  const bibPath = opts.bibliographyPath ?? "references";
  lines.push("\\bibliographystyle{plain}");
  lines.push(`\\bibliography{${bibPath}}`);
  lines.push("");
  lines.push("\\end{document}");

  return lines.join("\n") + "\n";
}
