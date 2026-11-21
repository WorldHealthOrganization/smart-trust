/**
 * Render tools.
 *
 * Registered by the **document** adapter (no LaTeX toolchain required):
 *   document_render_md   — Assemble the folio to one Markdown file
 *   document_render_html — Markdown → standalone HTML (pandoc)
 *   document_render_pdf  — Markdown → PDF via an HTML engine, no TeX
 *
 * Registered additionally by the **paper** adapter (needs TeX Live):
 *   paper_render_pdf   — Render full paper, chapter, or section to PDF
 *   paper_render_html  — Render main.tex to HTML (via pandoc)
 *   formula_render     — Quick-render a single formula/diagram to PNG
 *
 * The two families are separate registration functions rather than one list
 * because the difference between the content types is exactly which of them
 * a folio can run: `paper_render_pdf` shells out to `latexmk`, and a document
 * folio is defined by not needing a TeX installation to publish.
 *
 * @module folio-assistant/adapters/document/tools/render
 */

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { referenceDirs } from "@litlfred/cat-harness-tools/pipeline/reference-entries.ts";
import { realPathWithin, resolveWithin, safeSegment } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { z } from "zod";
import { execSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve, dirname } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Paper } from "@litlfred/cat-harness-tools/schemas/types.js";
import { REPO_ROOT, BUILD_DIR, MAIN_TEX, CHAPTERS_DIR } from "../paths.js";
import { expectedInstanceConfigPath } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.js";
// Note: paths are resolved from the paper adapter's paths module.

/** Check if a command is available on PATH. */
function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * The LaTeX-backed render tools. Requires `latexmk` / `pdflatex` at call time
 * — each tool probes for its binary and reports its absence rather than
 * failing opaquely, so registering them on a machine without TeX is safe.
 */
export function registerLatexRenderTools(server: McpServer): void {

  // ── paper_render_pdf ─────────────────────────────────────────

  server.tool(
    "paper_render_pdf",
    "Render the paper (or a chapter/section/block) to PDF using latexmk. " +
    "Returns the path to the generated PDF and a scraped log summary.",
    {
      scope: z.enum(["full", "chapter", "section", "block"]).default("full")
        .describe("What to render: full paper, single chapter, section, or individual content block"),
      target: z.string().optional()
        .describe("Chapter, section, or block identifier. Required if scope != full. " +
          "For blocks, use the block root name (e.g. 'def-observable')."),
      engine: z.enum(["pdflatex", "lualatex", "xelatex"]).default("pdflatex")
        .describe("LaTeX engine to use"),
      clean: z.boolean().default(false)
        .describe("Run latexmk -C first to clean auxiliary files"),
      print_mode: z.enum(["formal", "compact"]).default("compact")
        .describe("Print mode: formal (with affiliations) or compact (dense, no affiliations)"),
      upload_drive: z.boolean().default(false)
        .describe("Push the rendered PDF to Google Drive (requires Drive MCP configured)"),
      drive_folder: z.string().optional()
        .describe("Override Drive destination folder (default: from <name>.config.json googleDrive.folderPath)"),
    },
    async ({ scope, target, engine, clean, print_mode, upload_drive, drive_folder }) => {
      if (target !== undefined && safeSegment(target) === undefined) {
        return {
          content: [{ type: "text" as const, text: `Error: Refused: invalid target segment '${target}'` }],
          isError: true,
        };
      }
      // Check deps
      if (!hasCommand("latexmk")) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: latexmk not installed. Run: ./scripts/mcp-server/install.sh\n" +
              "Or install TeX Live: apt install texlive-full (Ubuntu) / port install texlive (macOS)",
          }],
        };
      }

      if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });

      // Helper: push a PDF to Drive (fire-and-forget, returns link or error string)
      const pushToDrive = (pdfPath: string, subfolder: string): string => {
        const gdriveMcp = join(REPO_ROOT, "src", "google-drive-mcp.py");
        if (!existsSync(gdriveMcp)) return "(Drive MCP not found)";
        // Read base folder from harness.config.json or env
        let baseFolder = process.env.GDRIVE_FOLDER_PATH ?? "";
        if (!baseFolder) {
          const cfgPath = expectedInstanceConfigPath(REPO_ROOT);
          // `undefined` = nothing declares a layer here; nothing to read.
          if (cfgPath !== undefined && existsSync(cfgPath)) {
            try {
              const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
              baseFolder = cfg?.googleDrive?.folderPath ?? "";
            } catch { /* ignore */ }
          }
        }
        const folder = drive_folder ?? (baseFolder ? `${baseFolder}/${subfolder}` : subfolder);
        const r = spawnSync("python3", [gdriveMcp, "--upload", pdfPath, "--folder", folder, "--json"], {
          stdio: "pipe", timeout: 60_000,
        });
        if (r.status !== 0) return `Drive upload failed: ${r.stderr?.toString().trim()}`;
        try {
          const out = JSON.parse(r.stdout.toString().trim());
          return out.webViewLink ?? out.link ?? "(uploaded, no link returned)";
        } catch {
          return "(upload complete, response not JSON)";
        }
      };

      try {
        // ── Block render ─────────────────────────────────────────────────────
        if (scope === "block") {
          if (!target) {
            return { content: [{ type: "text" as const, text: "Error: --target required for scope=block (block root name, e.g. 'def-observable')" }] };
          }
          const blockPdfsDir = join(BUILD_DIR, "block-pdfs");
          mkdirSync(blockPdfsDir, { recursive: true });

          // Find the block's .ts and .md in content/
          const folioRoot = folioDir(REPO_ROOT);
          const found = spawnSync("find", [folioRoot, "-name", `${target}.ts`, "-not", "-path", "*/node_modules/*"], {
            stdio: "pipe",
          });
          const tsPath = found.stdout?.toString().trim().split("\n").find(p => p);
          if (!tsPath || !existsSync(tsPath)) {
            return { content: [{ type: "text" as const, text: `Error: block '${target}' not found under folio/` }] };
          }
          const blockDir = dirname(tsPath);
          const mdPath = join(blockDir, `${target}.md`);
          const preamblePath = join(REPO_ROOT, "latex", "preamble.tex");

          // Load paper manifest (first parent .ts in the paper dir)
          const paperDirParts = blockDir.replace(folioRoot + "/", "").split("/");
          const paperSlug = paperDirParts[0];
          const paperManifestPath = join(folioRoot, paperSlug, `${paperSlug}.ts`);
          let paper: Paper;
          try {
            const paperMod = await import(paperManifestPath);
            paper = paperMod.default as Paper;
          } catch {
            return { content: [{ type: "text" as const, text: `Error: could not load paper manifest: ${paperManifestPath}` }] };
          }

          const blockMod = await import(tsPath);
          const block = blockMod.default;
          const mdContent = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";
          const sourceDir = resolve(blockDir).replace(REPO_ROOT + "/", "");

          const { generateBlockStandaloneTex } = await import(
            join(REPO_ROOT, "content", "pipeline", "generate-block-tex.ts")
          );
          const texContent = generateBlockStandaloneTex(
            paper, block, mdContent, target, sourceDir,
            { preamblePath, bibliographyPath: referenceDirs(REPO_ROOT)[0] },
          );
          const texPath = join(blockPdfsDir, `${target}.tex`);
          writeFileSync(texPath, texContent);

          const engineFlag = engine === "pdflatex" ? "-pdf" : engine === "lualatex" ? "-lualatex" : "-xelatex";
          const compileResult = spawnSync("latexmk", [
            engineFlag,
            `-jobname=${target}`,
            `-output-directory=${blockPdfsDir}`,
            "-interaction=nonstopmode",
            "-file-line-error",
            texPath,
          ], { cwd: REPO_ROOT, stdio: "pipe", timeout: 120_000 });

          const pdfPath = join(blockPdfsDir, `${target}.pdf`);
          const logPath = join(blockPdfsDir, `${target}.log`);
          const logText = existsSync(logPath) ? readFileSync(logPath, "utf-8") : compileResult.stdout?.toString() ?? "";

          // Scrape log for human-relevant output only
          const relevantLog = logText.split("\n")
            .filter(l => /^! |^Overfull \\[hv]box|LaTeX Warning: Reference|LaTeX Error:/.test(l))
            .slice(0, 40).join("\n");

          const ok = compileResult.status === 0 && existsSync(pdfPath);
          let driveMsg = "";
          if (upload_drive && ok) {
            const link = pushToDrive(pdfPath, "blocks");
            driveMsg = `\nDrive: ${link}`;
          }

          return {
            content: [{
              type: "text" as const,
              text: ok
                ? `Block PDF: ${pdfPath}\nSize: ${(readFileSync(pdfPath).length / 1024).toFixed(0)} KB${driveMsg}` +
                  (relevantLog ? `\n\nLog issues:\n${relevantLog}` : "")
                : `Block compilation failed (exit ${compileResult.status}).\n\nLog issues:\n${relevantLog || logText.slice(-2000)}`,
            }],
          };
        }

        // ── Full / chapter render ────────────────────────────────────────────
        let texFile = MAIN_TEX;
        let jobName = "quantum-observable-universe";

        if (scope === "chapter" && target) {
          // Build a standalone chapter
          const chapterTex = join(CHAPTERS_DIR, `${target}.tex`);
          if (!existsSync(chapterTex)) {
            return {
              content: [{ type: "text" as const, text: `Error: chapter file not found: ${chapterTex}` }],
            };
          }
          // Create a minimal wrapper that includes just this chapter
          const wrapper = `\\documentclass{article}
\\input{${join(REPO_ROOT, "preamble")}}
\\begin{document}
\\input{${chapterTex}}
\\end{document}`;
          const wrapperPath = join(BUILD_DIR, `chapter-${target}.tex`);
          writeFileSync(wrapperPath, wrapper);
          texFile = wrapperPath;
          jobName = `chapter-${target}`;
        }

        // Write print-mode preamble (formal mode enables affiliations)
        if (print_mode === "formal") {
          writeFileSync(
            join(REPO_ROOT, "print-mode.tex"),
            "\\showaffiliationstrue\n",
          );
        } else {
          writeFileSync(
            join(REPO_ROOT, "print-mode.tex"),
            "% compact mode — affiliations disabled\n",
          );
        }

        // Clean if requested
        if (clean) {
          spawnSync("latexmk", ["-C"], { cwd: REPO_ROOT, stdio: "pipe" });
        }

        // Run latexmk
        const engineFlag = engine === "pdflatex" ? "-pdf"
          : engine === "lualatex" ? "-lualatex"
          : "-xelatex";

        const result = spawnSync("latexmk", [
          engineFlag,
          `-jobname=${jobName}`,
          `-output-directory=${BUILD_DIR}`,
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-file-line-error",
          texFile,
        ], {
          cwd: REPO_ROOT,
          stdio: "pipe",
          timeout: 300_000, // 5 min
        });

        const pdfPath = join(BUILD_DIR, `${jobName}.pdf`);
        const log = result.stderr?.toString().slice(-2000) || "";

        if (result.status === 0 && existsSync(pdfPath)) {
          let driveMsg = "";
          if (upload_drive) {
            const subfolder = scope === "chapter" ? "chapters" : "";
            const link = pushToDrive(pdfPath, subfolder);
            driveMsg = `\nDrive: ${link}`;
          }
          return {
            content: [{
              type: "text" as const,
              text: `PDF rendered successfully: ${pdfPath}\n` +
                `Size: ${(readFileSync(pdfPath).length / 1024).toFixed(0)} KB${driveMsg}`,
            }],
          };
        } else {
          return {
            content: [{
              type: "text" as const,
              text: `LaTeX compilation failed (exit ${result.status}).\n\nLast 2000 chars of log:\n${log}`,
            }],
          };
        }
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── paper_render_html ────────────────────────────────────────

  server.tool(
    "paper_render_html",
    "Render the paper (or chapter) to HTML using pandoc with KaTeX math. " +
    "Returns the path to the generated HTML file.",
    {
      scope: z.enum(["full", "chapter"]).default("full")
        .describe("What to render"),
      target: z.string().optional()
        .describe("Chapter identifier (required if scope=chapter)"),
      math_renderer: z.enum(["katex", "mathjax"]).default("katex")
        .describe("Math rendering engine for HTML output"),
    },
    async ({ scope, target, math_renderer }) => {
      if (target !== undefined && safeSegment(target) === undefined) {
        return {
          content: [{ type: "text" as const, text: `Error: Refused: invalid target segment '${target}'` }],
          isError: true,
        };
      }
      if (!hasCommand("pandoc")) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: pandoc not installed. Run: ./scripts/mcp-server/install.sh\n" +
              "Or install: apt install pandoc (Ubuntu) / port install pandoc (macOS)",
          }],
        };
      }

      if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });

      try {
        let inputFile = MAIN_TEX;
        let outputName = "quantum-observable-universe";

        if (scope === "chapter" && target) {
          const chapterTex = join(CHAPTERS_DIR, `${target}.tex`);
          if (!existsSync(chapterTex)) {
            return {
              content: [{ type: "text" as const, text: `Error: chapter not found: ${chapterTex}` }],
            };
          }
          inputFile = chapterTex;
          outputName = `chapter-${target}`;
        }

        const outputPath = join(BUILD_DIR, `${outputName}.html`);
        const mathFlag = math_renderer === "katex" ? "--katex" : "--mathjax";

        const result = spawnSync("pandoc", [
          inputFile,
          "-o", outputPath,
          "--standalone",
          mathFlag,
          "--toc",
          "--number-sections",
          `--metadata=title:Quantum Observable Universe`,
        ], {
          cwd: REPO_ROOT,
          stdio: "pipe",
          timeout: 120_000,
        });

        if (result.status === 0 && existsSync(outputPath)) {
          return {
            content: [{
              type: "text" as const,
              text: `HTML rendered: ${outputPath}\n` +
                `Size: ${(readFileSync(outputPath).length / 1024).toFixed(0)} KB\n` +
                `Math: ${math_renderer}`,
            }],
          };
        } else {
          const err = result.stderr?.toString().slice(-1000) || "unknown error";
          return {
            content: [{ type: "text" as const, text: `Pandoc failed (exit ${result.status}):\n${err}` }],
          };
        }
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── formula_render ───────────────────────────────────────────

  server.tool(
    "formula_render",
    "Quick-render a single LaTeX formula or tikzcd diagram to PNG. " +
    "Useful for previewing complex math before committing.",
    {
      latex: z.string().describe("LaTeX code (math mode content or full environment)"),
      display_math: z.boolean().default(true)
        .describe("Wrap in display math mode (\\[...\\]) if true"),
      packages: z.array(z.string()).default(["amsmath", "amssymb", "tikz-cd"])
        .describe("Additional LaTeX packages to load"),
      dpi: z.number().default(300)
        .describe("Output resolution in DPI"),
    },
    async ({ latex, display_math, packages, dpi }) => {
      for (const pkg of packages) {
        if (!/^[A-Za-z0-9._-]+$/.test(pkg) || safeSegment(pkg) === undefined) {
          return {
            content: [{ type: "text" as const, text: `Error: Refused: invalid LaTeX package name '${pkg}'` }],
            isError: true,
          };
        }
      }
      if (/\\(?:input|include|openin|openout|read|write18|immediate|verbatiminput|lstinputlisting|catcode)\b/.test(latex)) {
        return {
          content: [{ type: "text" as const, text: "Error: Refused: dangerous LaTeX file/shell primitive in formula" }],
          isError: true,
        };
      }
      if (!hasCommand("pdflatex")) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: pdflatex not installed. Run: ./scripts/mcp-server/install.sh",
          }],
        };
      }

      if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });

      try {
        const usePackages = packages.map(p => `\\usepackage{${p}}`).join("\n");
        const body = display_math ? `\\[${latex}\\]` : latex;

        const doc = `\\documentclass[preview,border=2pt]{standalone}
${usePackages}
\\begin{document}
${body}
\\end{document}`;

        const tmpTex = join(BUILD_DIR, "formula-preview.tex");
        const tmpPdf = join(BUILD_DIR, "formula-preview.pdf");
        const tmpPng = join(BUILD_DIR, "formula-preview.png");

        writeFileSync(tmpTex, doc);

        // Compile to PDF
        const pdfResult = spawnSync("pdflatex", [
          "-no-shell-escape",
          "-interaction=nonstopmode",
          "-halt-on-error",
          `-output-directory=${BUILD_DIR}`,
          tmpTex,
        ], { cwd: BUILD_DIR, stdio: "pipe", timeout: 30_000 });

        if (pdfResult.status !== 0) {
          const log = pdfResult.stdout?.toString().slice(-1000) || "";
          return {
            content: [{ type: "text" as const, text: `Formula compilation failed:\n${log}` }],
          };
        }

        // Convert PDF → PNG (if pdftoppm or convert available)
        if (hasCommand("pdftoppm")) {
          spawnSync("pdftoppm", [
            `-r`, String(dpi), "-png", "-singlefile",
            tmpPdf, join(BUILD_DIR, "formula-preview"),
          ], { stdio: "pipe" });
        } else if (hasCommand("convert")) {
          spawnSync("convert", [
            "-density", String(dpi), tmpPdf, tmpPng,
          ], { stdio: "pipe" });
        }

        const outputFile = existsSync(tmpPng) ? tmpPng : tmpPdf;
        const outputType = existsSync(tmpPng) ? "PNG" : "PDF";

        return {
          content: [{
            type: "text" as const,
            text: `Formula rendered (${outputType}): ${outputFile}\n` +
              `Size: ${(readFileSync(outputFile).length / 1024).toFixed(1)} KB`,
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Formula render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );
}

// ── Document render tools (no TeX) ───────────────────────────────

/**
 * PDF engines pandoc can drive **without** a TeX installation, in the order
 * they are tried.
 *
 * `wkhtmltopdf` is last deliberately: it is unmaintained upstream and its
 * CSS support predates flexbox, so it is a fallback rather than a choice.
 * `weasyprint` and `prince` both render the same HTML the `document_render_html`
 * tool produces, which is what makes the PDF and the HTML agree.
 */
const HTML_PDF_ENGINES = ["weasyprint", "prince", "wkhtmltopdf"] as const;

/**
 * Resolve the document manifest to render.
 *
 * Deliberately fails rather than guessing when a folio holds more than one
 * document and the caller named none: rendering the wrong one produces a
 * plausible artifact, which is worse than an error.
 */
function resolveStyleSheet(css: string): { path: string } | { error: string } {
  if (css.startsWith("/") || css.startsWith("\\") || css.includes("\0")) {
    return { error: `Error: Refused: stylesheet path '${css}' must be relative to the repository root` };
  }
  const resolved = resolveWithin(REPO_ROOT, css);
  if (resolved === undefined) {
    return { error: `Error: Refused: stylesheet path '${css}' escapes repository root` };
  }
  if (existsSync(resolved) && realPathWithin(REPO_ROOT, resolved) === undefined) {
    return { error: `Error: Refused: stylesheet symlink '${css}' escapes repository root` };
  }
  return { path: resolved };
}

function resolveDocumentManifest(name?: string): { path: string; slug: string } | string {
  if (name !== undefined && safeSegment(name) === undefined) {
    return `Error: Refused: invalid document segment '${name}'`;
  }
  const folioRoot = folioDir(REPO_ROOT);
  if (!existsSync(folioRoot)) {
    return `Error: no folio/ directory at ${REPO_ROOT}. Run folio_init first, or point --repo at your folio.`;
  }
  const candidates = readdirSync(folioRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => existsSync(join(folioRoot, slug, `${slug}.ts`)));

  if (candidates.length === 0) {
    return `Error: no document manifest found. Expected folio/<slug>/<slug>.ts under ${folioRoot}.`;
  }
  if (name) {
    if (!candidates.includes(name)) {
      return `Error: no such document '${name}'. Available: ${candidates.join(", ")}`;
    }
    return { path: join(folioRoot, name, `${name}.ts`), slug: name };
  }
  if (candidates.length > 1) {
    return `Error: ${candidates.length} documents in this folio — pass \`document\`. Available: ${candidates.join(", ")}`;
  }
  return { path: join(folioRoot, candidates[0], `${candidates[0]}.ts`), slug: candidates[0] };
}

/** Format the issue list a build returns, or a clean bill of health. */
function summariseIssues(issues: { level: string; message: string }[]): string {
  if (issues.length === 0) return "No issues.";
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const lines = [`${errors.length} error(s), ${warns.length} warning(s):`];
  for (const i of issues.slice(0, 20)) lines.push(`  [${i.level}] ${i.message}`);
  if (issues.length > 20) lines.push(`  … ${issues.length - 20} more`);
  return lines.join("\n");
}

/**
 * The render tools a document folio gets: Markdown assembly, and HTML/PDF
 * output that needs no TeX.
 *
 * Registered by {@link DocumentContentAdapter}; the paper adapter registers
 * these **and** {@link registerLatexRenderTools}, because a paper is a
 * document that additionally has a LaTeX pipeline.
 */
export function registerDocumentRenderTools(server: McpServer): void {

  // ── document_render_md ───────────────────────────────────────

  server.tool(
    "document_render_md",
    "Assemble the document (chapters → sections → blocks) into one Markdown " +
    "file. No LaTeX toolchain required. This is the input the HTML and PDF " +
    "renderers consume, and is worth rendering on its own to inspect ordering.",
    {
      document: z.string().optional()
        .describe("Document slug under folio/ (auto-detected if the folio holds one)"),
    },
    async ({ document }) => {
      const resolved = resolveDocumentManifest(document);
      if (typeof resolved === "string") {
        return { content: [{ type: "text" as const, text: resolved }], isError: true };
      }
      try {
        const { buildDocumentMarkdown } = await import("@litlfred/cat-harness-tools/pipeline/render-markdown.js");
        const result = await buildDocumentMarkdown(resolved.path);
        if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
        const outPath = join(BUILD_DIR, `${resolved.slug}.md`);
        writeFileSync(outPath, result.markdown, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: `Markdown assembled: ${outPath}\n` +
              `Chapters: ${result.chapterSlugs.length} · Blocks: ${result.blockCount} · ` +
              `${(result.markdown.length / 1024).toFixed(0)} KB\n\n${summariseIssues(result.issues)}`,
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── document_render_html ─────────────────────────────────────

  server.tool(
    "document_render_html",
    "Render the document to standalone HTML via pandoc, from the assembled " +
    "Markdown. No LaTeX toolchain required.",
    {
      document: z.string().optional()
        .describe("Document slug under folio/ (auto-detected if the folio holds one)"),
      toc: z.boolean().default(true).describe("Emit a table of contents"),
      css: z.string().optional()
        .describe("Path to a stylesheet to inline, relative to the repo root"),
      math_renderer: z.enum(["katex", "mathjax", "none"]).default("katex")
        .describe("Math rendering engine. 'none' leaves $…$ untouched — correct for a document with no mathematics."),
    },
    async ({ document, toc, css, math_renderer }) => {
      if (document !== undefined && safeSegment(document) === undefined) {
        return {
          content: [{ type: "text" as const, text: `Error: Refused: invalid document segment '${document}'` }],
          isError: true,
        };
      }
      const checkedCss = css !== undefined ? resolveStyleSheet(css) : undefined;
      if (checkedCss && "error" in checkedCss) {
        return {
          content: [{ type: "text" as const, text: checkedCss.error }],
          isError: true,
        };
      }
      if (!hasCommand("pandoc")) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: pandoc not installed. Install: apt install pandoc (Ubuntu) / brew install pandoc (macOS).",
          }],
        };
      }
      const resolved = resolveDocumentManifest(document);
      if (typeof resolved === "string") {
        return { content: [{ type: "text" as const, text: resolved }], isError: true };
      }
      try {
        const { buildDocumentMarkdown } = await import("@litlfred/cat-harness-tools/pipeline/render-markdown.js");
        const result = await buildDocumentMarkdown(resolved.path);
        if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
        const mdPath = join(BUILD_DIR, `${resolved.slug}.md`);
        writeFileSync(mdPath, result.markdown, "utf-8");

        const outPath = join(BUILD_DIR, `${resolved.slug}.html`);
        const args = [mdPath, "-o", outPath, "--standalone", "--from", "gfm+raw_html"];
        if (toc) args.push("--toc", "--number-sections");
        if (math_renderer === "katex") args.push("--katex");
        else if (math_renderer === "mathjax") args.push("--mathjax");
        if (checkedCss) {
          const cssPath = checkedCss.path;
          if (!existsSync(cssPath)) {
            return { content: [{ type: "text" as const, text: `Error: stylesheet not found: ${cssPath}` }] };
          }
          args.push("--css", cssPath, "--embed-resources");
        }

        const r = spawnSync("pandoc", args, { cwd: REPO_ROOT, stdio: "pipe", timeout: 120_000 });
        if (r.status !== 0 || !existsSync(outPath)) {
          return {
            content: [{
              type: "text" as const,
              text: `Pandoc failed (exit ${r.status}):\n${r.stderr?.toString().slice(-1000) || "unknown error"}`,
            }],
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: `HTML rendered: ${outPath}\n` +
              `Size: ${(readFileSync(outPath).length / 1024).toFixed(0)} KB · Math: ${math_renderer}\n\n` +
              summariseIssues(result.issues),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── document_render_pdf ──────────────────────────────────────

  server.tool(
    "document_render_pdf",
    "Render the document to PDF through an HTML engine (weasyprint, prince, " +
    "or wkhtmltopdf) — no TeX installation required. Reports which engines " +
    "are missing rather than falling back to LaTeX.",
    {
      document: z.string().optional()
        .describe("Document slug under folio/ (auto-detected if the folio holds one)"),
      engine: z.enum(["auto", ...HTML_PDF_ENGINES]).default("auto")
        .describe("PDF engine. 'auto' picks the first installed of weasyprint, prince, wkhtmltopdf."),
      css: z.string().optional()
        .describe("Path to a print stylesheet, relative to the repo root"),
    },
    async ({ document, engine, css }) => {
      if (document !== undefined && safeSegment(document) === undefined) {
        return {
          content: [{ type: "text" as const, text: `Error: Refused: invalid document segment '${document}'` }],
          isError: true,
        };
      }
      const checkedCss = css !== undefined ? resolveStyleSheet(css) : undefined;
      if (checkedCss && "error" in checkedCss) {
        return {
          content: [{ type: "text" as const, text: checkedCss.error }],
          isError: true,
        };
      }
      if (!hasCommand("pandoc")) {
        return { content: [{ type: "text" as const, text: "Error: pandoc not installed. Install: apt install pandoc." }] };
      }
      const chosen = engine === "auto" ? HTML_PDF_ENGINES.find(hasCommand) : engine;
      if (!chosen) {
        // An absent toolchain reports as absent. It never falls through to
        // latexmk: a document folio is defined by not requiring TeX, so a
        // PDF that silently came from LaTeX would misreport what the folio
        // actually needs to build.
        return {
          content: [{
            type: "text" as const,
            text: "Error: no TeX-free PDF engine installed. Install one of:\n" +
              HTML_PDF_ENGINES.map((e) => `  ${e}`).join("\n") +
              "\n\n  pip install weasyprint      (recommended)\n" +
              "  apt install wkhtmltopdf\n\n" +
              "`document_render_html` works without any of them.",
          }],
        };
      }
      if (engine !== "auto" && !hasCommand(chosen)) {
        return { content: [{ type: "text" as const, text: `Error: requested engine '${chosen}' is not installed.` }] };
      }

      const resolved = resolveDocumentManifest(document);
      if (typeof resolved === "string") {
        return { content: [{ type: "text" as const, text: resolved }], isError: true };
      }
      try {
        const { buildDocumentMarkdown } = await import("@litlfred/cat-harness-tools/pipeline/render-markdown.js");
        const result = await buildDocumentMarkdown(resolved.path);
        if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
        const mdPath = join(BUILD_DIR, `${resolved.slug}.md`);
        writeFileSync(mdPath, result.markdown, "utf-8");

        const outPath = join(BUILD_DIR, `${resolved.slug}.pdf`);
        const args = [mdPath, "-o", outPath, "--from", "gfm+raw_html",
          `--pdf-engine=${chosen}`, "--toc", "--number-sections"];
        if (checkedCss) {
          const cssPath = checkedCss.path;
          if (!existsSync(cssPath)) {
            return { content: [{ type: "text" as const, text: `Error: stylesheet not found: ${cssPath}` }] };
          }
          args.push("--css", cssPath);
        }

        const r = spawnSync("pandoc", args, { cwd: REPO_ROOT, stdio: "pipe", timeout: 300_000 });
        if (r.status !== 0 || !existsSync(outPath)) {
          return {
            content: [{
              type: "text" as const,
              text: `pandoc --pdf-engine=${chosen} failed (exit ${r.status}):\n` +
                `${r.stderr?.toString().slice(-1500) || "unknown error"}`,
            }],
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: `PDF rendered: ${outPath}\n` +
              `Engine: ${chosen} (no TeX) · Size: ${(readFileSync(outPath).length / 1024).toFixed(0)} KB\n\n` +
              summariseIssues(result.issues),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Render error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );
}
