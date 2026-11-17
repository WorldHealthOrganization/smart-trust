/**
 * A graph's own declaration file is not one of its nodes.
 *
 * dth-sfp#13: `todos/todos.json`, seeded from `cat/dth-sc/todos`, carries
 * `"$schema": ".../bootstrap/schemas/graph.schema.json"`. `sweepFamilies` read
 * it as a `todos` node, found no family for the tag, and
 * `check:kind-validators` (and `:require-all`) failed on an "unmapped family"
 * in every layer whose todos store was seeded that way. The file is the kind's
 * `declarationFile`: it declares the graph's directories and is judged by the
 * declaration checks. A real node with an unmapped tag beside it still fails.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sweepFamilies } from "../check-kind-validators.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const GRAPH_SCHEMA = "https://example.org/bootstrap/schemas/graph.schema.json";

// One parent directory per case: the sweep reads every layer beside the one it is given.
const made: string[] = [];
function todosInstance(extra?: { file: string; node: unknown }): string {
  const parent = mkdtempSync(join(tmpdir(), "kv-decl-"));
  made.push(parent);
  const inst = join(parent, "fixture");
  mkdirSync(join(inst, "todos", "items"), { recursive: true });
  writeDeclaration(inst, {
    name: "fixture",
    directories: [{ id: "todos", path: "todos/", graphTypologies: ["todos"] }],
  });
  writeFileSync(
    join(inst, "todos", "todos.json"),
    JSON.stringify({ $schema: GRAPH_SCHEMA, name: "fixture", directories: [{ id: "items", path: "items", graphTypologies: ["todo-items"] }] }),
  );
  if (extra) writeFileSync(join(inst, "todos", extra.file), JSON.stringify(extra.node));
  return inst;
}
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

describe("check:kind-validators and a graph's own declaration file", () => {
  test("todos/todos.json with the bootstrap graph $schema is not an unmapped todos family", async () => {
    const sweep = await sweepFamilies(todosInstance());
    const todos = sweep.find((f) => f.kind === "todos");
    expect(todos).toBeDefined();
    expect(todos!.unmapped).toEqual([]);
  });

  test("a node beside it with an unmapped $schema is still reported", async () => {
    const sweep = await sweepFamilies(todosInstance({ file: "stray.json", node: { $schema: "no-such-family/v1" } }));
    const todos = sweep.find((f) => f.kind === "todos");
    expect(todos!.unmapped.map((u) => u.tag)).toEqual(["no-such-family/v1"]);
  });
});
