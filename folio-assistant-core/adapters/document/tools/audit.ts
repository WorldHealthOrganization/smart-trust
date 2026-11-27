/**
 * Read-only audit tools — the deterministic audit cores from content/pipeline
 * exposed as MCP tools returning structured findings. None mutate content.
 * Wraps the scripts via {@link runPipeline}.
 *
 * ## Split by content type
 *
 * Most of these are **paper** audits. They read `.tex` output, Lean witnesses,
 * or the theorem-like block kinds — none of which a document folio has, so on
 * one they answer nothing, forever. Offering a tool that can only ever return
 * an empty result is worse than not offering it: an agent that runs
 * `lean_compile_audit` on a policy document and gets a clean report has been
 * told its corpus is fine by a check that never looked.
 *
 * So each entry carries a `profile`, and the two registration functions are
 * separate. The rule for classifying a new one: if it reads a `.tex` file, a
 * `.lean` file, or a kind in `MATH_BLOCK_KINDS`, it is `paper`.
 *
 * Tools (all read-only):
 *   latex_overfull          — overfull \hbox reporter (rendering QA)
 *   qa_staleness            — stale QA-sidecar findings vs current content
 *   tex_source_audit        — audit rendered .tex source for issues
 *   dangling_remarks        — remarks not attached to a definition/result
 *   conditional_class_audit — conditional-class banner discipline
 *   section_title_audit     — section-title conventions
 *   wall_violations         — base-ring / domain-boundary ("wall") violations
 *   defterm_validate        — defined-term consistency
 *   value_validate          — computed-value consistency
 *   glossary_candidates     — propose glossary candidates
 *   lean_compile_audit      — Lean compile/witness status (list | stale)
 *
 * @module folio-assistant/adapters/document/tools/audit
 */

import { safeSegment } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runPipeline, asToolText, autoPaper, refuseTool } from "./_pipeline.js";

/**
 * Which content types an audit can say anything useful about.
 *
 * `document` means it applies to BOTH profiles — a document audit is equally
 * valid on a paper, since a paper is a document plus more. `paper` means it
 * reads something only a paper has.
 */
type AuditProfile = "document" | "paper";

/** Uniform read-only audits: no required args (optionally `--json`). */
const AUDITS: { tool: string; script: string; json?: boolean; args?: readonly string[]; profile: AuditProfile; desc: string }[] = [
  { tool: "latex_overfull", script: "latex-overfull-report", json: true,
    profile: "paper",
    desc: "Report overfull \\hbox (table/math/identifier spills) in the rendered LaTeX. Read-only." },
  // `--against main` (bean `8wj1`): the sidecars are read from the qa-reports
  // branch at main, so the answer does not depend on this working copy.
  { tool: "qa_staleness", script: "qa-staleness", json: true, args: ["--against", "main"],
    profile: "document",
    desc: "List QA-sidecar findings that are stale relative to current content. Read-only." },
  { tool: "tex_source_audit", script: "audit-tex-source",
    profile: "paper",
    desc: "Audit the rendered .tex source for known issues (seams, spacing, etc.). Read-only." },
  { tool: "dangling_remarks", script: "find-dangling-remarks",
    profile: "paper",
    desc: "Find remark blocks not attached to a definition/result (dangling). Read-only." },
  { tool: "conditional_class_audit", script: "conditional-class-banner-audit",
    profile: "paper",
    desc: "Check conditional-class banner discipline on theorem-like blocks. Read-only." },
  { tool: "section_title_audit", script: "qa-section-title-audit",
    profile: "document",
    desc: "Audit section titles against the project's title conventions. Read-only." },
  { tool: "wall_violations", script: "wall-violations-sweep",
    profile: "paper",
    desc: "Sweep for base-ring / domain-boundary ('wall') violations in Lean/content. Read-only." },
  { tool: "defterm_validate", script: "validate-defterm",
    profile: "document",
    desc: "Validate defined-term (glossary) consistency across the corpus. Read-only." },
  { tool: "value_validate", script: "validate-value",
    profile: "document",
    desc: "Validate computed/derived-value consistency across the corpus. Read-only." },
  { tool: "glossary_candidates", script: "glossary-candidates",
    profile: "document",
    desc: "Propose glossary candidate terms from the corpus. Read-only." },
  { tool: "wiring_audit", script: "audit-wiring",
    profile: "document",
    desc: "Audit script/hook wiring (no dangling references). Read-only." },
  { tool: "conjectural_propagation", script: "conjectural-propagation-audit",
    profile: "paper",
    desc: "Audit propagation of conjectural status through dependent results. Read-only." },
  { tool: "trivial_skeleton_audit", script: "trivial-skeleton-audit",
    profile: "paper",
    desc: "Flag trivial/placeholder proof skeletons. Read-only (prints to stdout)." },
  { tool: "tex_validate", script: "validate-tex", json: true,
    profile: "paper",
    desc: "Structural validation of rendered .tex (no compile). Read-only." },
];

function registerUniform(server: McpServer, profile: AuditProfile): void {
  for (const a of AUDITS) {
    if (a.profile !== profile) continue;
    server.tool(a.tool, a.desc, {}, async () =>
      asToolText(a.tool, runPipeline(a.script, [...(a.json ? ["--json"] : []), ...(a.args ?? [])])),
    );
  }
}

/** The audits that mean something on a prose folio. Registered by both adapters. */
export function registerDocumentAuditTools(server: McpServer): void {
  registerUniform(server, "document");

  // status-section audit (per document).
  server.tool(
    "status_sections_audit",
    "Audit the per-block status sections for the document (read-only).",
    {
      paper: z.string().optional().describe("Document name (auto-detected if only one)"),
    },
    async ({ paper }) => {
      if (paper !== undefined && safeSegment(paper) === undefined) {
        return refuseTool("status_sections_audit", `invalid paper segment '${paper}'`);
      }
      const p = autoPaper(paper);
      const args = p ? ["--paper", p] : [];
      return asToolText("status_sections_audit", runPipeline("audit-status-sections", args));
    },
  );
}

/** The audits that read `.tex`, `.lean`, or a math block kind. Paper adapter only. */
export function registerPaperAuditTools(server: McpServer): void {
  registerUniform(server, "paper");

  // lean_compile_audit has read-only modes.
  server.tool(
    "lean_compile_audit",
    "Lean compile / witness status audit. mode=list (current status, read-only) " +
      "or mode=stale (witnesses stale vs source hash, read-only).",
    {
      mode: z.enum(["list", "stale"]).default("list").describe("list | stale (both read-only)"),
    },
    async ({ mode }) => asToolText("lean_compile_audit", runPipeline("lean-compile-audit", [`--${mode}`])),
  );

  // proof ↔ narrative equivalence sweep (read-only via --dry-run --json).
  server.tool(
    "proof_narrative_equiv",
    "Audit that each block's narrative proof matches its Lean counterpart " +
      "(read-only: runs as a dry-run, JSON findings).",
    {},
    async () => asToolText("proof_narrative_equiv", runPipeline("proof-narrative-lean-equiv-sweep", ["--dry-run", "--json"])),
  );

}

/**
 * Both halves, for a caller that wants every audit regardless of profile.
 *
 * Kept because the module's own test asserts the complete set registers with a
 * handler and a description — a property of the audit table, not of either
 * adapter, and one that would go unchecked if the only entry points were the
 * two profile-scoped ones.
 */
export function registerAuditTools(server: McpServer): void {
  registerDocumentAuditTools(server);
  registerPaperAuditTools(server);
}
