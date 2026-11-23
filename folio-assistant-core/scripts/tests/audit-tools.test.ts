/**
 * Hermetic test for the read-only audit MCP tool module: verifies every audit
 * tool registers with a handler (no real pipeline spawn).
 */
import { test, expect, describe } from "bun:test";
import {
  registerAuditTools,
  registerDocumentAuditTools,
  registerPaperAuditTools,
} from "../../adapters/document/tools/audit.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** An MCP tool handler, as the registration stubs below see it. */
type ToolHandler = (
  ...args: unknown[]
) => Promise<{ content: Array<{ type: string; text: string }> }>;


/**
 * A stand-in for `McpServer` that records what a `register*Tools` call
 * registers. Only `tool` is exercised, so the cast to `McpServer` at each use
 * is narrowed through `unknown` rather than `any` — the recorder itself stays
 * typed, and a change to the `tool` signature still breaks here.
 */
interface ToolRecorder {
  tool(name: string, desc: string, schema: unknown, handler: ToolHandler): void;
}

describe("registerAuditTools", () => {
  const reg: Record<string, { desc: string; handler: ToolHandler }> = {};
  const recorder: ToolRecorder = {
    tool(name, desc, _schema, handler) { reg[name] = { desc, handler }; },
  };
  registerAuditTools(recorder as unknown as McpServer);

  const expected = [
    "latex_overfull", "qa_staleness", "tex_source_audit", "dangling_remarks",
    "conditional_class_audit", "section_title_audit", "wall_violations",
    "defterm_validate", "value_validate", "glossary_candidates", "lean_compile_audit",
    "wiring_audit", "conjectural_propagation", "trivial_skeleton_audit",
    "tex_validate", "proof_narrative_equiv", "status_sections_audit",
  ];

  test("registersAllAuditTools", () => {
    for (const name of expected) {
      expect(reg[name]).toBeDefined();
      expect(typeof reg[name].handler).toBe("function");
      expect(reg[name].desc.toLowerCase()).toContain("read-only");
    }
    expect(Object.keys(reg).length).toBe(expected.length);
  });
});

describe("the audit split by content type", () => {
  function record(register: (s: McpServer) => void): Set<string> {
    const names = new Set<string>();
    const recorder: ToolRecorder = { tool(name) { names.add(name); } };
    register(recorder as unknown as McpServer);
    return names;
  }

  const doc = record(registerDocumentAuditTools);
  const paper = record(registerPaperAuditTools);
  const all = record(registerAuditTools);

  test("halvesPartition", () => {
    for (const n of doc) expect(paper.has(n)).toBe(false);
    expect(doc.size + paper.size).toBe(all.size);
    expect(new Set([...doc, ...paper])).toEqual(all);
  });

  test("texLeanMathPaperOnly", () => {
    // On a document folio each of these answers nothing, forever. Registering
    // one there means an agent can run it, get a clean report, and conclude
    // its corpus was checked.
    for (const n of [
      "lean_compile_audit", "proof_narrative_equiv", "latex_overfull",
      "tex_validate", "tex_source_audit", "wall_violations",
      "conjectural_propagation", "trivial_skeleton_audit",
      "dangling_remarks", "conditional_class_audit",
    ]) {
      expect(paper.has(n)).toBe(true);
      expect(doc.has(n)).toBe(false);
    }
  });

  test("agnosticForDocuments", () => {
    for (const n of [
      "qa_staleness", "section_title_audit", "defterm_validate",
      "value_validate", "glossary_candidates", "wiring_audit",
      "status_sections_audit",
    ]) {
      expect(doc.has(n)).toBe(true);
    }
  });
});
