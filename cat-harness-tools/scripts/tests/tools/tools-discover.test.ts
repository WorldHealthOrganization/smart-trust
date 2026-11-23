/**
 * Tool auto-discovery (bean p0za): every declared `tools` graph is loaded, and
 * every way loading can go wrong is REPORTED — never read as "no tools".
 *
 * The tests of this file that read the whole checkout (discovers the Tools
 * every layer in the checkout declares, smart-base's among them) live in
 * `test/tools-discover-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { discoverTools } from "../../../tools/discover.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { TOOLS_ROOT } from "../../lib/roots.ts";

const TOOL_TS = resolve(TOOLS_ROOT, "schemas", "tools", "tool.ts");

/** A minimal valid Tool, as source text for a fixture's index.ts. */
const toolSrc = (id: string) => `{
  id: "${id}",
  title: "${id}",
  description: "fixture tool ${id}",
  install: { none: true },
  invoke: { manual: true },
  io: { inputs: [], outputs: [] },
  satisfies: ["discussion"],
}`;

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

/** A repo holding one layer per entry; `index` is that layer's tools/index.ts, or null for none. */
function repo(instances: Record<string, string | null>): string {
  const root = mkdtempSync(join(tmpdir(), "tooldisc-"));
  roots.push(root);
  for (const [name, index] of Object.entries(instances)) {
    const inst = join(root, name);
    mkdirSync(join(inst, "tools"), { recursive: true });
    writeDeclaration(inst, {
      name,
      directories: [{ id: "tools", path: "tools/", graphTypologies: ["tools"] }],
    });
    if (index !== null) writeFileSync(join(inst, "tools", "index.ts"), index);
  }
  return root;
}

const good = (...ids: string[]) =>
  `import { defineTool } from ${JSON.stringify(TOOL_TS)};\n` +
  `export function tools() { return [${ids.map((i) => `defineTool(${toolSrc(i)})`).join(", ")}]; }\n`;

describe("discoverTools", () => {
  test("merges every declared tools graph, one source per instance", () => {
    const d = discoverTools(repo({ alpha: good("a-one", "a-two"), beta: good("b-one") }));
    expect(d.failures).toEqual([]);
    expect(d.tools.map((t) => t.id).sort()).toEqual(["a-one", "a-two", "b-one"]);
    expect(d.sources.map((s) => [s.instance, s.count])).toEqual([
      ["alpha", 2],
      ["beta", 1],
    ]);
  });

  test("a declared graph with no index.ts is a failure, not zero tools", () => {
    const d = discoverTools(repo({ alpha: good("a-one"), empty: null }));
    expect(d.tools.map((t) => t.id)).toEqual(["a-one"]);
    expect(d.failures).toHaveLength(1);
    expect(d.failures[0]!.reason).toContain("no index.ts");
  });

  test("a module that throws on load is a failure with its message", () => {
    const d = discoverTools(repo({ broken: `throw new Error("boom at load");\nexport function tools() { return []; }\n` }));
    expect(d.failures[0]!.reason).toContain("boom at load");
  });

  test("a module with no tools() export is a failure", () => {
    const d = discoverTools(repo({ odd: `export const notTools = 1;\n` }));
    expect(d.failures[0]!.reason).toContain("no `tools()`");
  });

  test("a Tool that fails its schema is a failure; its valid siblings still load", () => {
    const bad =
      `import { defineTool } from ${JSON.stringify(TOOL_TS)};\n` +
      `export function tools() { return [defineTool(${toolSrc("ok-tool")}), { id: "no-good" }]; }\n`;
    const d = discoverTools(repo({ mixed: bad }));
    expect(d.tools.map((t) => t.id)).toEqual(["ok-tool"]);
    expect(d.failures[0]!.reason).toContain("no-good");
  });

  test("onlyInstance scopes discovery to one instance's own graph", () => {
    const root = repo({ alpha: good("a-one"), beta: good("b-one") });
    const d = discoverTools(root, undefined, join(root, "beta"));
    expect(d.tools.map((t) => t.id)).toEqual(["b-one"]);
    expect(d.sources.map((s) => s.instance)).toEqual(["beta"]);
  });

  test("the same Tool id from two instances is a failure naming the first", () => {
    const d = discoverTools(repo({ alpha: good("shared"), beta: good("shared") }));
    expect(d.tools).toHaveLength(1);
    expect(d.failures[0]!.reason).toContain("also declared by alpha");
  });
});
