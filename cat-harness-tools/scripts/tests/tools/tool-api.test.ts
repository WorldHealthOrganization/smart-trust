/**
 * The Tools as an API (`scripts/tool-api.ts`): the OpenAPI document and the
 * MCP tool list (owner, 2026-11-12: "go ahead with the OpenAPI generation and
 * MCP tool list").
 *
 * @module cat-harness-tools/scripts/tests/tools/tool-api.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { captureRegistrar, hoistSchema, mcpToolList, openApiFor } from "../../tool-api.ts";
import { defineTool } from "../../../schemas/tools/tool.js";
import { toolTypeIri } from "../../../schemas/tools/tool-types.js";

const t = (n: Parameters<typeof toolTypeIri>[1]) => toolTypeIri("https://x.test/fa/", n);
const tool = defineTool({
  id: "demo-tool",
  title: "Demo",
  description: "A demo Tool.",
  install: { none: true },
  invoke: { shell: "bun run cat demo", mcp: { tool: "demo_run" } },
  io: {
    inputs: [{ name: "process", schema: t("ProcessId"), required: true, description: "The process." }],
    outputs: [{ name: "enabled", schema: t("NodeId"), description: "What is next." }],
  },
  satisfies: ["process-state"],
});

/** Every `$ref` in a value. */
const refs = (v: unknown): string[] => [...JSON.stringify(v).matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1]!);

describe("openApiFor", () => {
  const doc = openApiFor([tool], {
    title: "Demo",
    version: "1.0.0",
    toolIri: (id) => `https://x.test/fa/tools/${id}.jsonld`,
    toolPage: (id) => `${id}/`,
    skillContracts: () => [
      { io: "input", schema: { $schema: "x", type: "object", properties: { a: { $ref: "#/definitions/A" } }, definitions: { A: { type: "string" } } } },
    ],
    mcpNames: () => ["demo_run"],
  });
  const op = (doc.paths as Record<string, { post: Record<string, unknown> }>)["/tools/demo-tool"]!.post;

  it("is OpenAPI 3.1 with no servers, and says its paths are contracts", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers).toEqual([]);
    expect(String((doc.info as { description: string }).description)).toContain("No HTTP server serves these paths");
  });

  it("has one operation per Tool, carrying its IRI, invocation, MCP names and skills", () => {
    expect(op.operationId).toBe("demo-tool");
    expect(op["x-tool-iri"]).toBe("https://x.test/fa/tools/demo-tool.jsonld");
    expect(op["x-invoke"]).toEqual(tool.invoke);
    expect(op["x-mcp-tools"]).toEqual(["demo_run"]);
    expect(op.tags).toEqual(["process-state"]);
  });

  it("resolves every $ref inside the document — a skill contract's own definitions are hoisted", () => {
    const names = Object.keys((doc.components as { schemas: object }).schemas);
    expect(names).toContain("ProcessId");
    expect(names).toContain("skill.process-state.input");
    expect(names).toContain("skill.process-state.input.A");
    for (const r of refs(doc)) {
      expect(r.startsWith("#/components/schemas/")).toBe(true);
      expect(names).toContain(r.split("/")[3]!);
    }
  });
});

describe("hoistSchema", () => {
  it("rewrites #, #/definitions and #/$defs refs to the hoisted names", () => {
    const into: Record<string, unknown> = {};
    hoistSchema({ $id: "x", properties: { s: { $ref: "#" }, d: { $ref: "#/$defs/D" } }, $defs: { D: { $ref: "#/definitions/E" } }, definitions: { E: {} } }, "N", into);
    expect(Object.keys(into).sort()).toEqual(["N", "N.D", "N.E"]);
    expect(refs(into).sort()).toEqual(["#/components/schemas/N", "#/components/schemas/N.D", "#/components/schemas/N.E"]);
    expect((into.N as Record<string, unknown>).$id).toBeUndefined();
  });
});

describe("the MCP tool list", () => {
  const dir = mkdtempSync(join(tmpdir(), "tool-api-"));
  const zod = require.resolve("zod");
  writeFileSync(
    join(dir, "reg.ts"),
    `import { z } from ${JSON.stringify(zod)};
export function registerDemo(server: any) {
  server.tool("demo_start", "Start one.", { process: z.string().describe("The process."), note: z.string().optional() }, async () => ({}));
  server.tool("demo_next", "What next.", { instance: z.string() }, async () => ({}));
  server.tool("other_tool", "Not matched.", {}, async () => ({}));
}\n`,
  );

  it("reads each served name and its input schema from the registrar", async () => {
    const got = await captureRegistrar(join(dir, "reg.ts"));
    expect(got.map((g) => g.name)).toEqual(["demo_start", "demo_next", "other_tool"]);
    const start = got[0]!.inputSchema as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(start.properties)).toEqual(["process", "note"]);
    expect(start.required).toEqual(["process"]);
  });

  it("expands a pattern to the served names, and falls back to the declared inputs only by name", async () => {
    const pattern = { ...tool, invoke: { inProcess: { module: "reg.ts" }, mcp: { tool: "demo_*" } } } as typeof tool;
    const { tools, problems } = await mcpToolList([{ def: pattern, root: dir }], []);
    expect(problems).toEqual([]);
    expect(tools.map((x) => x.name)).toEqual(["demo_next", "demo_start"]);
    expect(tools.every((x) => x._meta.source === "registrar" && x._meta.tool === "demo-tool")).toBe(true);

    const declared = await mcpToolList([{ def: tool, root: dir }], []);
    expect(declared.tools.map((x) => [x.name, x._meta.source])).toEqual([["demo_run", "declared"]]);
    expect((declared.tools[0]!.inputSchema as { required: string[] }).required).toEqual(["process"]);
  });
});
