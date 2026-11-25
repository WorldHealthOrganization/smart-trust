#!/usr/bin/env bun
/**
 * Render ```tex blocks from .md files to SVG.
 *
 * Walks the content tree, extracts ```tex fenced code blocks from .md files,
 * renders each to SVG via pdflatex + dvisvgm, and updates the sibling .ts
 * manifest with `rendered` asset references.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts
 *   bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts --paper quantum-observable-universe
 *   bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts --force   # re-render even if SVG exists
 *   bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts --dry-run # show what would be rendered
 *
 * Output:
 *   content/<paper>/<chapter>/rendered/<block>-<index>.svg
 *
 * @module scripts/render-tex/render-tex-blocks
 */

import { folioDirDeferred } from "../../schemas/kg/cat-harness.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, dirname, basename } from "path";
import { createHash } from "crypto";
import { Glob } from "bun";
import { HARNESS_ROOT } from "../lib/roots.ts";

// ── Config ───────────────────────────────────────────────────────

const INSTANCE_ROOT = join(HARNESS_ROOT);
const folioDirOf = folioDirDeferred(INSTANCE_ROOT, import.meta.url);
const PREAMBLE_PATH = join(import.meta.dir, "preamble.tex");

const args = process.argv.slice(2);
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}
function argVal(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const PAPER = argVal("paper", "quantum-observable-universe");
const FORCE = hasFlag("force");
const DRY_RUN = hasFlag("dry-run");

// ── TeX preamble for standalone rendering ────────────────────────

const DEFAULT_PREAMBLE = `\\documentclass[tikz,border=2pt]{standalone}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{tikz-cd}
\\usepackage{mathrsfs}
\\usepackage[T1]{fontenc}

% Match paper macros
\\DeclareMathOperator{\\ev}{ev}
\\DeclareMathOperator{\\coev}{coev}
\\DeclareMathOperator{\\id}{id}
\\DeclareMathOperator{\\Hom}{Hom}
\\DeclareMathOperator{\\Rep}{Rep}
`;

function getPreamble(): string {
  if (existsSync(PREAMBLE_PATH)) {
    return readFileSync(PREAMBLE_PATH, "utf-8");
  }
  return DEFAULT_PREAMBLE;
}

// ── Extract ```tex blocks from markdown ──────────────────────────

interface TexBlock {
  index: number;
  source: string;
  hash: string;
}

function extractTexBlocks(md: string): TexBlock[] {
  const blocks: TexBlock[] = [];
  const lines = md.split("\n");
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    if (lines[i].trimStart().startsWith("```tex")) {
      i++;
      const texLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        texLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const source = texLines.join("\n").trim();
      const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
      blocks.push({ index: blockIndex, source, hash });
      blockIndex++;
    } else {
      i++;
    }
  }

  return blocks;
}

// ── Render a single TeX block to SVG ─────────────────────────────

async function renderToSvg(
  texSource: string,
  outputPath: string,
): Promise<{ ok: boolean; error?: string }> {
  const tmpDir = join(INSTANCE_ROOT, "build", "tex-tmp", `render-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Wrap in standalone document
  const preamble = getPreamble();
  let doc: string;

  // If the tex source already contains \begin{document}, use as-is with preamble
  if (texSource.includes("\\begin{document}")) {
    doc = texSource;
  } else {
    // Strip \[ \] wrappers if present (standalone doesn't need them for display math)
    let body = texSource;
    body = body.replace(/^\s*\\\[\s*/, "").replace(/\s*\\\]\s*$/, "");

    // Strip stray \label{}, \caption{}, \centering
    body = body.replace(/\\label\{[^}]*\}/g, "");
    body = body.replace(/\\caption\{[^}]*\}/g, "");
    body = body.replace(/\\centering\s*/g, "");
    // Strip float wrappers (table, figure) — standalone doesn't support floats
    body = body.replace(/^\s*\\begin\{(table|figure)\*?\}(\[.*?\])?\s*/g, "");
    body = body.replace(/\s*\\end\{(table|figure)\*?\}\s*$/g, "");

    // Detect and convert top-level math environments to standalone-compatible forms
    const alignMatch = body.match(/^\s*\\begin\{(align|gather)\*?\}/);
    const eqMatch = body.match(/^\s*\\begin\{equation\*?\}/);

    if (alignMatch) {
      // Convert align/align*/gather/gather* → aligned/gathered inside $...$
      const envName = alignMatch[1];
      const innerEnv = envName === "align" ? "aligned" : "gathered";
      body = body.replace(/^\s*\\begin\{(align|gather)\*?\}/, `\\begin{${innerEnv}}`);
      body = body.replace(/\\end\{(align|gather)\*?\}\s*$/, `\\end{${innerEnv}}`);
      // Clean up trailing artifacts before \end{aligned/gathered}:
      // - Remove dangling \\ or \\[...] before \end
      // - Remove trailing comma + whitespace before \end
      // - Collapse blank lines (they create \par in math mode)
      body = body.replace(/[,\s]*\\\\(\[.*?\])?\s*(\\end\{)/g, "\n$2");
      body = body.replace(/,\s*(\\end\{)/g, "\n$1");
      body = body.replace(/\n\s*\n/g, "\n");
      doc = `${preamble}\n\\begin{document}\n$\\displaystyle ${body}$\n\\end{document}\n`;
    } else if (eqMatch) {
      // Strip equation/equation* wrapper
      body = body.replace(/^\s*\\begin\{equation\*?\}(\[.*?\])?\s*/, "");
      body = body.replace(/\s*\\end\{equation\*?\}\s*$/, "");
      body = body.replace(/\n\s*\n/g, "\n");
      doc = `${preamble}\n\\begin{document}\n$\\displaystyle ${body}$\n\\end{document}\n`;
    } else {
      // Check if it's a tikzcd or other environment (not inside a math env)
      const hasEnvironment = /\\begin\{/.test(body);
      // Some environments (array, cases, matrix, etc.) require math mode
      const needsMathMode = /\\begin\{(array|cases|[pbBvV]?matrix|smallmatrix)/.test(body);
      if (hasEnvironment && needsMathMode) {
        body = body.replace(/\n\s*\n/g, "\n");
        doc = `${preamble}\n\\begin{document}\n$\\displaystyle ${body}$\n\\end{document}\n`;
      } else if (hasEnvironment) {
        doc = `${preamble}\n\\begin{document}\n${body}\n\\end{document}\n`;
      } else {
        // Pure math — wrap in displaymath, collapse blank lines
        body = body.replace(/\n\s*\n/g, "\n");
        doc = `${preamble}\n\\begin{document}\n$\\displaystyle ${body}$\n\\end{document}\n`;
      }
    }
  }

  const texPath = join(tmpDir, "block.tex");
  writeFileSync(texPath, doc);

  // pdflatex → PDF
  const pdfProc = Bun.spawn(
    ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "block.tex"],
    { cwd: tmpDir, stdout: "pipe", stderr: "pipe" },
  );
  const pdfExit = await pdfProc.exited;

  if (pdfExit !== 0) {
    const log = existsSync(join(tmpDir, "block.log"))
      ? readFileSync(join(tmpDir, "block.log"), "utf-8").split("\n").slice(-20).join("\n")
      : await new Response(pdfProc.stderr).text();
    return { ok: false, error: `pdflatex failed (exit ${pdfExit}):\n${log}` };
  }

  // PDF → SVG via dvisvgm (pdf mode)
  const pdfPath = join(tmpDir, "block.pdf");
  const svgProc = Bun.spawn(
    ["dvisvgm", "--pdf", "--no-fonts", "--exact-bbox", "-o", outputPath, pdfPath],
    { cwd: tmpDir, stdout: "pipe", stderr: "pipe" },
  );
  const svgExit = await svgProc.exited;

  if (svgExit !== 0) {
    const err = await new Response(svgProc.stderr).text();
    return { ok: false, error: `dvisvgm failed (exit ${svgExit}):\n${err}` };
  }

  // Clean up tmp
  try {
    const rmProc = Bun.spawn(["rm", "-rf", tmpDir]);
    await rmProc.exited;
  } catch {}

  return { ok: true };
}

// ── Update .ts manifest with rendered references ─────────────────

function updateManifest(
  tsPath: string,
  rendered: { mime: string; url: string; blockIndex: number; hash: string }[],
): void {
  let src = readFileSync(tsPath, "utf-8");

  // Remove existing rendered field if present
  src = src.replace(/\s*rendered:\s*\[[\s\S]*?\],?\n?/g, "");

  // Build the rendered array string
  const entries = rendered
    .map(
      (r) =>
        `    { mime: "${r.mime}", url: "${r.url}", blockIndex: ${r.blockIndex}, hash: "${r.hash}" }`,
    )
    .join(",\n");
  const renderedStr = `  rendered: [\n${entries},\n  ],`;

  // Insert before the closing }); or the last });
  // Find the position of the last field before });
  const closingMatch = src.match(/(\n\s*}\s*\)\s*;?\s*)$/);
  if (closingMatch && closingMatch.index !== undefined) {
    const insertPos = closingMatch.index;
    // Check if there's a trailing comma needed
    const beforeClose = src.slice(0, insertPos);
    const needsComma = !beforeClose.trimEnd().endsWith(",");
    src =
      beforeClose.trimEnd() +
      (needsComma ? "," : "") +
      "\n" +
      renderedStr +
      "\n" +
      closingMatch[1];
  }

  writeFileSync(tsPath, src);
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const paperDir = join(folioDirOf(), PAPER);
  if (!existsSync(paperDir)) {
    console.error(`Paper directory not found: ${paperDir}`);
    process.exit(1);
  }

  console.log(`Rendering TeX blocks for: ${PAPER}`);
  if (DRY_RUN) console.log("  (dry run — no files will be written)\n");

  // Find all .md files under the paper directory
  const glob = new Glob("**/*.md");
  const mdFiles: string[] = [];
  for await (const match of glob.scan({ cwd: paperDir })) {
    mdFiles.push(match);
  }
  mdFiles.sort();

  let totalBlocks = 0;
  let rendered = 0;
  let skipped = 0;
  let errors = 0;

  for (const mdRel of mdFiles) {
    const mdPath = join(paperDir, mdRel);
    const md = readFileSync(mdPath, "utf-8");
    const blocks = extractTexBlocks(md);

    if (blocks.length === 0) continue;

    const dir = dirname(mdPath);
    const rootName = basename(mdRel, ".md");
    const renderDir = join(dir, "rendered");
    const tsPath = join(dir, `${rootName}.ts`);

    console.log(`\n  ${mdRel} — ${blocks.length} TeX block(s)`);

    if (!existsSync(tsPath)) {
      console.log(`    ⚠ No .ts manifest found, skipping`);
      continue;
    }

    const renderedAssets: {
      mime: string;
      url: string;
      blockIndex: number;
      hash: string;
    }[] = [];

    for (const block of blocks) {
      totalBlocks++;
      const svgName = `${rootName}-${block.index}.svg`;
      const svgPath = join(renderDir, svgName);

      // Check if SVG already exists with matching hash
      if (!FORCE && existsSync(svgPath)) {
        // Check hash file
        const hashPath = svgPath + ".hash";
        if (existsSync(hashPath)) {
          const existingHash = readFileSync(hashPath, "utf-8").trim();
          if (existingHash === block.hash) {
            console.log(`    [${block.index}] ✓ up to date (${svgName})`);
            skipped++;
            renderedAssets.push({
              mime: "image/svg+xml",
              url: `rendered/${svgName}`,
              blockIndex: block.index,
              hash: block.hash,
            });
            continue;
          }
        }
      }

      if (DRY_RUN) {
        console.log(`    [${block.index}] would render → ${svgName}`);
        rendered++;
        continue;
      }

      // Render
      mkdirSync(renderDir, { recursive: true });
      console.log(`    [${block.index}] rendering → ${svgName}...`);

      const result = await renderToSvg(block.source, svgPath);
      if (result.ok) {
        // Write hash file for incremental builds
        writeFileSync(svgPath + ".hash", block.hash);
        rendered++;
        console.log(`    [${block.index}] ✓ rendered`);
        renderedAssets.push({
          mime: "image/svg+xml",
          url: `rendered/${svgName}`,
          blockIndex: block.index,
          hash: block.hash,
        });
      } else {
        errors++;
        console.log(`    [${block.index}] ✗ ${result.error}`);
      }
    }

    // Update .ts manifest
    if (!DRY_RUN && renderedAssets.length > 0) {
      console.log(`    → updating ${basename(tsPath)}`);
      updateManifest(tsPath, renderedAssets);
    }
  }

  console.log(`\nDone: ${rendered} rendered, ${skipped} skipped, ${errors} errors (${totalBlocks} total)`);
  if (errors > 0) process.exit(1);
}

main();
