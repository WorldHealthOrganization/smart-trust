/**
 * Content validation and build tools.
 *
 * Tools:
 *   content_validate      — Validate content objects (schema + constraints + AST)
 *   content_profile_check — Check every block against the folio's declared profile
 *   content_build         — Build content objects → LaTeX chapters
 *   content_list          — List all content objects with status
 *
 * @module folio-assistant/adapters/document/tools/validate
 */

import { z } from "zod";
import { spawnSync, type SpawnSyncReturns } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join, basename, resolve } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { safeSegment, writableWithin } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { REPO_ROOT, folioDirOf, get } from "../paths.js";
import { checkFolioProfile, formatProfileCheck } from "@litlfred/cat-harness-tools/pipeline/profile-check.js";
import {
  readBlockManifest,
  readUnlabelledBlockManifest,
} from "@litlfred/cat-harness-tools/pipeline/qa-utils.js";
import { refuseTool, resolvePipelineScript } from "./_pipeline.js";
// Note: paths are resolved from the document adapter's paths module.

/** Find all paper directories under folio/. */
function discoverPapers(): string[] {
  if (!existsSync(folioDirOf())) return [];
  return readdirSync(folioDirOf(), { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith(".") &&
      d.name !== "schema" && d.name !== "pipeline" && d.name !== "node_modules")
    .map(d => d.name);
}

/** Find all .ts manifest files in a directory (non-recursive). */
function findManifests(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".ts") && !f.startsWith("_") && !f.startsWith("index"))
    .map(f => basename(f, ".ts"));
}

/** Find all chapter dirs under a paper dir. */
function findChapterDirs(paperDir: string): string[] {
  if (!existsSync(paperDir)) return [];
  return readdirSync(paperDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

/**
 * Where the validation pipeline lives, or `undefined` if it is nowhere.
 *
 * Two layouts are in the wild and both are legitimate:
 *
 * - the folio carries its own `content/pipeline/` (the `qou` layout, from
 *   when the platform was vendored inside the content repo), and
 * - the folio carries only `content/schema/` and reaches the pipeline in the
 *   platform checkout — which is what `folio_init` scaffolds.
 *
 * The folio's own copy wins when present, so a folio that has deliberately
 * forked the pipeline keeps its fork. Resolving ONLY to the folio's copy is
 * what made this tool report a clean bill of health on every scaffolded folio
 * — see {@link runValidatePipeline}.
 */
export function resolveValidateScript(): string | undefined {
  // Delegates to the shared resolver so this and every `runPipeline` tool
  // cannot drift on which layouts they support. They had separate copies of
  // this logic for exactly one commit, which is one too many.
  return resolvePipelineScript("validate");
}

/**
 * Did the pipeline actually run, or did it fail to start?
 *
 * The distinction is the whole point of this function. `validate.ts` exits
 * non-zero when it FINDS problems, so a non-zero status alone is a normal,
 * informative outcome. What is not normal is exiting non-zero having printed
 * nothing to stdout: that is the shape of a module-not-found, a syntax error,
 * or a missing runtime — the pipeline never reached a single check.
 *
 * Before this, the caller counted `✗` and `⚠` in an empty stdout, got zero of
 * each, and reported "Validation: 0 error(s), 0 warning(s)". The stderr was
 * appended far below the headline. Every folio `folio_init` scaffolds hit
 * exactly that path, because none of them has `content/pipeline/`.
 *
 * "Absent tool ⇒ n/a, never a false pass" is the rule this restores.
 */
export function pipelineFailedToRun(r: SpawnSyncReturns<Buffer>, stdout: string): boolean {
  if (r.error) return true;              // spawn itself failed (no `bun`, timeout)
  if (r.status === null) return true;    // killed by signal / timed out
  return r.status !== 0 && stdout.trim() === "";
}

export function registerValidateTools(server: McpServer): void {

  // ── content_validate ─────────────────────────────────────────

  server.tool(
    "content_validate",
    "Validate content objects: Zod schema checks, constraint rules " +
    "(file existence, cross-refs, lean requirements), and LaTeX AST " +
    "validation of rendered output.",
    {
      paper: z.string().optional()
        .describe("Paper name (auto-detected if only one paper exists)"),
      chapter: z.string().optional()
        .describe("Specific chapter dir to validate (default: all)"),
    },
    async ({ paper, chapter }) => {
      try {
        if (paper !== undefined && safeSegment(paper) === undefined) {
          return refuseTool("content_validate", `invalid paper segment '${paper}'`);
        }
        if (chapter !== undefined && safeSegment(chapter) === undefined) {
          return refuseTool("content_validate", `invalid chapter segment '${chapter}'`);
        }
        const papers = discoverPapers();
        if (papers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No papers found in folio/" }],
          };
        }

        const paperName = paper || papers[0];
        const paperDir = join(folioDirOf(), paperName);

        if (!existsSync(paperDir)) {
          return {
            content: [{ type: "text" as const, text: `Paper not found: ${paperDir}` }],
          };
        }

        // Run validation pipeline via bun
        const results: string[] = [];
        let totalErrors = 0;
        let totalWarnings = 0;
        /** Set when the pipeline could not be run at all — never a clean report. */
        let pipelineError: string | undefined;

        const script = resolveValidateScript();
        if (chapter && !existsSync(join(paperDir, chapter))) {
          return {
            content: [{ type: "text" as const, text: `Chapter not found: ${join(paperDir, chapter)}` }],
          };
        }

        if (!script) {
          // Reported as an error, not as a clean run with a footnote. A folio
          // whose schema and constraint checks did not execute has not been
          // validated, whatever the block-level checks below say.
          pipelineError =
            "Could not locate `content/pipeline/validate.ts` in either this folio " +
            `(${join(folioDirOf(), "pipeline")}) or the platform checkout. ` +
            "Schema and constraint validation DID NOT RUN.";
        } else {
          const target = chapter ? join(paperDir, chapter) : paperDir;
          const result = spawnSync("bun", ["run", script, target], {
            cwd: folioDirOf(),
            stdio: "pipe",
            timeout: chapter ? 60_000 : 120_000,
          });
          const output = result.stdout?.toString() || "";
          const stderr = result.stderr?.toString() || "";

          if (pipelineFailedToRun(result, output)) {
            pipelineError =
              `\`${script}\` failed to run (exit ${result.status ?? "signal"}). ` +
              "Schema and constraint validation DID NOT RUN.\n" +
              (result.error ? `${result.error.message}\n` : "") +
              (stderr.trim() ? stderr.trim() : "(no stderr)");
          } else {
            const header = chapter ? `## ${chapter}\n` : "";
            results.push(`${header}${output}${stderr ? `\nStderr: ${stderr}` : ""}`);
            totalErrors += (output.match(/✗/g) || []).length;
            totalWarnings += (output.match(/⚠/g) || []).length;
          }
        }

        // A pipeline that did not run counts as an error in its own right, so
        // the headline number can never read 0 while a check was skipped.
        if (pipelineError) totalErrors += 1;

        // Profile conformance runs on every validate rather than as an
        // opt-in tool. It is the one check that knows what *kind* of folio
        // this is, and a document folio that has quietly acquired a theorem
        // fails at publication — long after the block was written, and in a
        // renderer whose error message says nothing about profiles.
        const profileResult = checkFolioProfile(REPO_ROOT, paperDir);
        totalErrors += profileResult.violations.length;

        const banner = pipelineError
          ? `\n\n## ⚠ Pipeline did not run\n\n${pipelineError}\n`
          : "";

        return {
          content: [{
            type: "text" as const,
            text: `Validation: ${totalErrors} error(s), ${totalWarnings} warning(s)` +
              (pipelineError ? " — INCOMPLETE, see below" : "") +
              banner +
              (results.length ? `\n\n${results.join("\n\n")}` : "") +
              `\n\n## Profile conformance\n\n${formatProfileCheck(profileResult)}`,
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Validation error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── content_profile_check ────────────────────────────────────

  server.tool(
    "content_profile_check",
    "Check every block against the content profile the folio declares in " +
    "<name>.config.json. A `document` folio must hold no block whose assertion " +
    "is a formal mathematical claim, and no `lean` field or `.lean` sibling " +
    "anywhere. Run standalone to check the whole folio; content_validate runs " +
    "it per document.",
    {
      document: z.string().optional()
        .describe("Restrict to one document under folio/ (default: the whole folio)"),
    },
    async ({ document }) => {
      try {
        if (document !== undefined && safeSegment(document) === undefined) {
          return refuseTool("content_profile_check", `invalid document segment '${document}'`);
        }
        const scope = document ? join(folioDirOf(), document) : folioDirOf();
        if (document && !existsSync(scope)) {
          return { content: [{ type: "text" as const, text: `Document not found: ${scope}` }] };
        }
        const result = checkFolioProfile(REPO_ROOT, scope);
        return { content: [{ type: "text" as const, text: formatProfileCheck(result) }] };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Profile check error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // ── content_list ─────────────────────────────────────────────

  server.tool(
    "content_list",
    "List all content objects across all papers with their kind, " +
    "label, lean status, and companion files.",
    {
      paper: z.string().optional()
        .describe("Paper name (default: all papers)"),
    },
    async ({ paper }) => {
      try {
        if (paper !== undefined && safeSegment(paper) === undefined) {
          return refuseTool("content_list", `invalid paper segment '${paper}'`);
        }
        const papers = paper ? [paper] : discoverPapers();
        const lines: string[] = [];

        for (const p of papers) {
          const paperDir = join(folioDirOf(), p);
          lines.push(`# ${p}`);

          for (const chDir of findChapterDirs(paperDir)) {
            const chPath = join(paperDir, chDir);
            const manifests = findManifests(chPath);
            // Header count comes from what is actually listed, not from how
            // many `.ts` files the directory holds — those differ by the
            // chapter manifest and any helper module, and a count that
            // disagrees with the rows beneath it is worse than no count.
            const rows: string[] = [];

            for (const name of manifests) {
              const tsPath = join(chPath, `${name}.ts`);

              // A block's kind comes from the BUILDER it calls, not from a
              // literal `kind:` field — `prose({...})` yields `kind: "prose"`
              // at runtime and the source never spells it out. This used to
              // match a `kind:` string literal, which no builder-authored
              // manifest contains, so every block in every folio listed as
              // `unknown`. `readBlockManifest` is the canonical reader — masked
              // against strings and comments, and mapping DAK's kebab-case
              // kinds back from their camelCase builders — and is what the QA
              // sweep, the content graph and the propagation sweeps all use.
              //
              // It also returns `undefined` for a `.ts` that is not a block, so
              // the chapter manifest sitting in the same directory stops being
              // listed as a content object of that chapter.
              const block =
                readBlockManifest(tsPath) ?? readUnlabelledBlockManifest(tsPath);
              if (!block) continue;

              const companions = [
                existsSync(join(chPath, `${name}.md`)) ? "md" : "",
                existsSync(join(chPath, `${name}.lean`)) ? "lean" : "",
              ].filter(Boolean).join(", ");

              rows.push(`  ${block.kind.padEnd(12)} ${block.label.padEnd(35)} [${companions}]`);
            }

            lines.push(`\n## ${chDir} (${rows.length} block${rows.length === 1 ? "" : "s"})`);
            lines.push(...rows);
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `List error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );
}

/**
 * The build step that emits LaTeX. Paper adapter only.
 *
 * A document folio's build is `document_render_md` — Markdown assembly, no
 * `.tex` anywhere. Registering `content_build` on one would offer a build that
 * produces chapter files nothing in that folio can compile.
 */
export function registerPaperBuildTools(server: McpServer): void {
  // ── content_build ────────────────────────────────────────────

  server.tool(
    "content_build",
    "Build content objects into LaTeX chapter files. Runs validation " +
    "first, then renders .ts + .md → .tex output.",
    {
      paper: z.string().optional()
        .describe("Paper name (auto-detected if only one)"),
      output_dir: z.string().optional()
        .describe("Output directory for .tex files (default: chapters/)"),
    },
    async ({ paper, output_dir }) => {
      try {
        if (paper !== undefined && safeSegment(paper) === undefined) {
          return refuseTool("content_build", `invalid paper segment '${paper}'`);
        }
        const root = get.REPO_ROOT();
        let resolvedOutDir = join(root, "chapters");
        if (output_dir !== undefined) {
          if (output_dir.includes("\0")) {
            return refuseTool("content_build", "output_dir contains NUL byte");
          }
          resolvedOutDir = resolve(root, output_dir);
          if (!writableWithin(root, resolvedOutDir)) {
            return refuseTool("content_build", `output_dir '${output_dir}' escapes repository root`);
          }
        }
        const papers = discoverPapers();
        const paperName = paper || papers[0];
        if (!paperName) {
          return {
            content: [{ type: "text" as const, text: "No papers found in folio/" }],
          };
        }

        const paperDir = join(folioDirOf(), paperName);
        const docTs = join(paperDir, `${paperName}.ts`);
        const outDir = resolvedOutDir;

        if (!existsSync(docTs)) {
          return {
            content: [{ type: "text" as const, text: `Paper manifest not found: ${docTs}` }],
          };
        }

        const result = spawnSync("bun", [
          "run", join(folioDirOf(), "pipeline/build.ts"),
          docTs,
          "--out-dir", outDir,
        ], {
          cwd: folioDirOf(),
          stdio: "pipe",
          timeout: 120_000,
        });

        const output = result.stdout?.toString() || "";
        const stderr = result.stderr?.toString() || "";

        return {
          content: [{
            type: "text" as const,
            text: `Build ${result.status === 0 ? "succeeded" : "failed"} (exit ${result.status})\n\n` +
              output + (stderr ? `\nStderr: ${stderr}` : ""),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Build error: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );
}
