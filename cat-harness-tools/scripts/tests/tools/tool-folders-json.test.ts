/**
 * A Tool declared as data (`<id>/<id>.json`, bean `y9r6`) is discovered the
 * same way as a `.ts` one: type references resolve to the same IRIs, the
 * whole is validated by `defineTool`, and `$comment` is ignored.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolsFromFolders } from "../../../schemas/tools/tool-folders.js";
import { toolTypeIri } from "../../../schemas/tools/tool-types.js";

const BASE = "https://example.org/h";
let dir: string;
const tool = (id: string, extra: Record<string, unknown> = {}) => ({
  $schema: "tool-definition/v1",
  tool: {
    id,
    title: id,
    description: `The ${id} Tool.`,
    install: { none: true },
    invoke: { shell: `bun run ${id}` },
    io: { inputs: [{ name: "check", schema: { $type: "Flag" }, required: false, arg: { flag: "--check" }, description: "Check only." }], outputs: [] },
    satisfies: ["security"],
    requires: { runtime: ["bun"], network: false },
  },
  $comment: [{ at: "/io/inputs/0", comment: "Kept for readers; ignored by the loader." }],
  ...extra,
});
const put = (root: string, id: string, file: string, body: string) => {
  mkdirSync(join(root, id), { recursive: true });
  writeFileSync(join(root, id, file), body);
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tool-json-"));
  put(dir, "alpha", "alpha.json", JSON.stringify(tool("alpha")));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("toolsFromFolders reads <id>/<id>.json", () => {
  test("type references resolve against the base; $comment is dropped", () => {
    const [t] = toolsFromFolders(dir, BASE);
    expect(t!.id).toBe("alpha");
    expect(t!.io.inputs[0]!.schema).toBe(toolTypeIri(BASE, "Flag"));
    expect(JSON.stringify(t)).not.toContain("$comment");
  });

  test("a folder holding both forms is refused", () => {
    const d = mkdtempSync(join(tmpdir(), "tool-json-both-"));
    put(d, "beta", "beta.json", JSON.stringify(tool("beta")));
    put(d, "beta", "beta.ts", "export default () => ({});\n");
    expect(() => toolsFromFolders(d, BASE)).toThrow(/twice/);
    rmSync(d, { recursive: true, force: true });
  });

  test("an unknown type, or a missing $schema, is refused", () => {
    const d = mkdtempSync(join(tmpdir(), "tool-json-bad-"));
    const bad = tool("gamma");
    (bad.tool.io.inputs[0] as { schema: unknown }).schema = { $type: "NoSuchType" };
    put(d, "gamma", "gamma.json", JSON.stringify(bad));
    expect(() => toolsFromFolders(d, BASE)).toThrow(/unknown Tool type/);
    put(d, "gamma", "gamma.json", JSON.stringify({ tool: tool("gamma").tool }));
    expect(() => toolsFromFolders(d, BASE)).toThrow(/tool-definition\/v1/);
    rmSync(d, { recursive: true, force: true });
  });
});
