import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBeanQueryTool } from "./bean-query.ts";
import { buildBeanStore, NAMED_QUERIES, queryBeanStore } from "../../scripts/beans-query.ts";

describe("bean-query MCP tool", () => {
  test("registers bean_query tool on McpServer", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBeanQueryTool(server, resolve("."));

    // Server tools should contain bean_query
    const serverObj = server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }> };
    const tools = serverObj._registeredTools;
    expect(tools).toBeDefined();
    expect(tools["bean_query"]).toBeDefined();
  });

  test("executes default safe_drain_candidates query", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBeanQueryTool(server, resolve("."));

    const serverObj = server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }> };
    const tool = serverObj._registeredTools["bean_query"];
    const result = await tool.handler({ named: "safe_drain_candidates", format: "json" });
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    // The tool's contract is "run the named query over the real store and return
    // its rows", so compare with that query run directly. Asserting a NON-EMPTY
    // result asserted the work plan instead: closing the last open bean that
    // qualifies turned this red with the tool unchanged (cat-harness-tools#1461).
    // The query's own logic is tested on fixture beans in
    // scripts/tests/beans-query.test.ts.
    const { store, beans } = buildBeanStore(resolve("."));
    expect(beans.length).toBeGreaterThan(0); // vacuity: the store was read
    expect(parsed).toEqual(queryBeanStore(store, NAMED_QUERIES.safe_drain_candidates!.sparql));
  });

  test("returns the rows as structuredContent in every format", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBeanQueryTool(server, resolve("."));
    const serverObj = server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; structuredContent?: { rows: Array<Record<string, string>> } }> }> };
    const tool = serverObj._registeredTools["bean_query"];
    const json = await tool.handler({ named: "safe_drain_candidates", format: "json" });
    const table = await tool.handler({ named: "safe_drain_candidates", format: "table" });
    expect(json.structuredContent?.rows).toEqual(JSON.parse(json.content[0].text));
    expect(table.structuredContent?.rows).toEqual(json.structuredContent?.rows);
  });
});
