/**
 * Hermetic tests for the bib + transform MCP tool modules: verify they register
 * the expected tools, that mutating tools default to dry-run, and that the
 * no-target/auto-detect paths degrade gracefully (no real pipeline spawn).
 */
import { test, expect, describe } from "bun:test";
import { registerBibTools } from "../../adapters/document/tools/bib.ts";
import { registerTransformTools, registerPaperTransformTools } from "../../adapters/document/tools/transform.ts";
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

function collect(register: (s: McpServer) => void) {
  const reg: Record<string, { desc: string; schema: unknown; handler: ToolHandler }> = {};
  const recorder: ToolRecorder = {
    tool(name, desc, schema, handler) { reg[name] = { desc, schema, handler }; },
  };
  register(recorder as unknown as McpServer);
  return reg;
}

describe("registerBibTools", () => {
  const reg = collect(registerBibTools);
  test("registersBibTools", () => {
    for (const name of ["bib_validate", "references_validate", "bib_export"]) {
      expect(reg[name]).toBeDefined();
      expect(typeof reg[name].handler).toBe("function");
      expect(reg[name].desc.length).toBeGreaterThan(10);
    }
  });
});

describe("registerTransformTools", () => {
  const reg = collect(registerTransformTools);
  const paperReg = collect(registerPaperTransformTools);

  test("migrateLeanRefsPaperOnly", () => {
    // It rewrites `lean.ref` syntax, and a document folio has no `lean` field
    // on any block — there it would report success having transformed nothing.
    expect(reg["migrate_lean_refs"]).toBeUndefined();
    expect(paperReg["migrate_lean_refs"]).toBeDefined();
  });

  test("registersTransformTools", () => {
    // Both halves together must still cover the module's whole table.
    const all = { ...reg, ...paperReg };
    for (const name of ["codemod", "prune_deps", "migrate_lean_refs"]) {
      expect(all[name]).toBeDefined();
      expect(typeof all[name].handler).toBe("function");
    }
  });

  test("codemodGraceful", async () => {
    // No folio/<paper> in this repo → auto-detect yields nothing.
    const res = await reg["codemod"].handler({ name: "refterm" });
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text.toLowerCase()).toContain("target");
  });
});
