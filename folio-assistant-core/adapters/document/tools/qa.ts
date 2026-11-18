/**
 * Mechanical QA / publication / transform tools.
 *
 * Each tool exposes the deterministic core of a content-pipeline script as an
 * MCP tool that returns structured findings. The judgment layer (what to fix)
 * stays in the skill bodies (`folio-core` / `folio-paper-adapter`); these tools
 * just run the check and report. All are read-only by default.
 *
 * Tools:
 *   qa_sweep        — run the QA criteria sweep → findings (sidecar) [dry-run by default]
 *   proof_status    — proof-formalization coverage dashboard (sorry counts, per-block status)
 *   latex_preflight — flag unknown macros / overfull boxes in the LaTeX source
 *   bib_qa          — bibliography metadata QA (+ optional URL resolution)
 *   glossary_check  — verify the generated glossary index is up to date
 *   content_export  — export content to viewer JSON (transform)
 *
 * Two of these are **paper only**, for the same reason the audit module is
 * split: `proof_status` counts `sorry`s across Lean files and `latex_preflight`
 * parses `.tex` source, and a document folio has neither. Registered on one,
 * they would report clean forever — a check that never looked, reporting no
 * findings, is indistinguishable from a check that passed.
 *
 * @module folio-assistant/adapters/document/tools/qa
 */

import { safeSegment, writableWithin } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../paths.js";
import { runPipeline, asToolText, autoPaper, refuseTool, tryParseJson } from "./_pipeline.js";

const paperArg = (p?: string) => (p ? `folio/${p}` : undefined);

/** The QA tools that mean something on a prose folio. Registered by both adapters. */
export function registerQaTools(server: McpServer): void {
  // ── qa_sweep ─────────────────────────────────────────────────
  server.tool(
    "qa_sweep",
    "Run the content QA criteria sweep and return structured findings. " +
      "Read-only by default (dry-run); set apply=true to write sidecar updates.",
    {
      paper: z.string().optional().describe("Paper name (auto-detected if only one)"),
      only: z.string().optional().describe("Comma-separated criteria ids to run (default: all)"),
      apply: z.boolean().default(false).describe("Write sidecar updates (default: dry-run, read-only)"),
    },
    async ({ paper, only, apply }) => {
      if (paper !== undefined && safeSegment(paper) === undefined) {
        return refuseTool("qa_sweep", `invalid paper segment '${paper}'`);
      }
      const args: string[] = [];
      const pp = paperArg(autoPaper(paper));
      if (pp) args.push(pp);
      args.push("--json");
      if (!apply) args.push("--dry-run");
      if (only) args.push("--only", only);
      return asToolText("qa_sweep", runPipeline("qa-sweep", args));
    },
  );

  // ── bib_qa ───────────────────────────────────────────────────
  server.tool(
    "bib_qa",
    "Bibliography QA: metadata completeness checks, and optionally verify that " +
      "citation URLs resolve (HTTP). Read-only.",
    {
      checkUrls: z.boolean().default(false).describe("Also verify URLs resolve (network)"),
    },
    async ({ checkUrls }) => {
      const out = join(get.REPO_ROOT(), "build", "bib-qa.json");
      const args = ["--out", out];
      if (checkUrls) args.push("--check-urls");
      const r = runPipeline("bib-qa", args);
      // bib-qa writes its report to --out; surface it if present.
      if (!r.error && existsSync(out)) {
        const parsed = tryParseJson(readFileSync(out, "utf-8"));
        if (parsed !== undefined) r.json = parsed;
      }
      return asToolText("bib_qa", r);
    },
  );

  // ── glossary_check ───────────────────────────────────────────
  server.tool(
    "glossary_check",
    "Check that the generated glossary index is up to date (read-only gate; " +
      "exits non-zero if regeneration is needed).",
    {
      paper: z.string().optional().describe("Paper name (auto-detected if only one)"),
    },
    async ({ paper }) => {
      if (paper !== undefined && safeSegment(paper) === undefined) {
        return refuseTool("glossary_check", `invalid paper segment '${paper}'`);
      }
      const pp = paperArg(autoPaper(paper));
      if (!pp) {
        return asToolText("glossary_check", {
          ok: false, script: "build-glossary", exitCode: null, stdout: "", stderr: "",
          error: "specify a paper (could not auto-detect a single paper under folio/)",
        });
      }
      return asToolText("glossary_check", runPipeline("build-glossary", [pp, "--check"]));
    },
  );

  // ── content_export ───────────────────────────────────────────
  server.tool(
    "content_export",
    "Export content objects to viewer JSON (transform step for publication).",
    {
      paper: z.string().optional().describe("Paper name (auto-detected if only one)"),
      out: z.string().optional().describe("Output directory (default: build/viewer)"),
    },
    async ({ paper, out }) => {
      if (paper !== undefined && safeSegment(paper) === undefined) {
        return refuseTool("content_export", `invalid paper segment '${paper}'`);
      }
      const root = get.REPO_ROOT();
      let resolvedOut: string | undefined;
      if (out !== undefined) {
        if (out.includes("\0")) {
          return refuseTool("content_export", "output path contains NUL byte");
        }
        resolvedOut = resolve(root, out);
        if (!writableWithin(root, resolvedOut)) {
          return refuseTool("content_export", `output directory '${out}' escapes repository root`);
        }
      }
      const p = autoPaper(paper);
      const args: string[] = [];
      if (p) args.push("--paper", p);
      if (resolvedOut) args.push("--out", resolvedOut);
      return asToolText("content_export", runPipeline("export-json", args));
    },
  );
}

/**
 * The QA tools that read Lean or LaTeX. Paper adapter only.
 */
export function registerPaperQaTools(server: McpServer): void {
  // ── proof_status ─────────────────────────────────────────────
  server.tool(
    "proof_status",
    "Proof-formalization coverage dashboard: per-block status, sorry counts, " +
      "and axis breakdown (read-only).",
    {
      paper: z.string().optional().describe("Paper name (auto-detected if only one)"),
    },
    async ({ paper }) => {
      if (paper !== undefined && safeSegment(paper) === undefined) {
        return refuseTool("proof_status", `invalid paper segment '${paper}'`);
      }
      const args: string[] = [];
      const pp = paperArg(autoPaper(paper));
      if (pp) args.push(pp);
      args.push("--json");
      return asToolText("proof_status", runPipeline("proof-axis-dashboard", args));
    },
  );

  // ── latex_preflight ──────────────────────────────────────────
  server.tool(
    "latex_preflight",
    "Preflight the rendered LaTeX source for unknown macros and overfull boxes " +
      "before a full build (read-only; never fails the call).",
    {},
    async () => asToolText("latex_preflight", runPipeline("latex-preflight", ["--json", "--warn"])),
  );
}
