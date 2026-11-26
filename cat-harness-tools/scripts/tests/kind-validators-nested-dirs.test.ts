/**
 * A node in a directory declared FROM WITHIN is its kind's node.
 *
 * Bean `8lcl`, folio-assistant#2812. `beans/beans.json` declares `workflows`
 * as a `workflow-state` directory, and `directoryEntriesForGraph` resolves it.
 * `sweepFamilies` read `beans/workflows/`, then asked which declared directory
 * held each file most closely. It knew only instance-level entries, so the
 * answer was the enclosing `beans/`, which is not a `workflow-state` directory,
 * and every node was dropped. `require-all` then reported `workflow-state` as
 * EXAMINED NOTHING over a directory holding a node.
 *
 * The guard it misfired is still needed (folio-assistant#2529): a node in a
 * DEEPER directory of another kind belongs to that kind, not to an enclosing
 * one. Both halves are pinned here.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BASE_GRAPH_TYPOLOGIES, GraphTypologyRegistry } from "../../schemas/kg/graph-typology-registry.js";
import { sweepFamilies } from "../check-kind-validators.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

// One parent directory per case: the sweep reads every layer beside the
// one it is given, so two fixtures in one parent would each see the other.
const made: string[] = [];
function instanceDir(name: string): string {
  const parent = mkdtempSync(join(tmpdir(), "kv-nested-"));
  made.push(parent);
  return join(parent, name);
}
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

const INSTANCE_NODE = {
  $schema: "folio-workflow-instance/v1",
  id: "fixture-instance",
  processId: "Process_Fixture",
  tokens: [],
  arrivals: {},
  history: [],
};

function nodesOf(sweep: Awaited<ReturnType<typeof sweepFamilies>>, kind: string): number {
  const s = sweep.find((f) => f.kind === kind);
  return Object.values(s?.counts ?? {}).reduce((a, c) => a + c.nodes, 0);
}

describe("check:kind-validators reads a from-within directory as its own kind's", () => {
  const inst = instanceDir("fixture");
  mkdirSync(join(inst, "beans", "workflows"), { recursive: true });
  writeDeclaration(inst, {
    name: "fixture",
    directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
  });
  writeFileSync(
    join(inst, "beans", "beans.json"),
    JSON.stringify({
      name: "fixture",
      directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }],
    }),
  );
  writeFileSync(join(inst, "beans", "workflows", "fixture-instance.json"), JSON.stringify(INSTANCE_NODE));

  test("the workflow instance under beans/workflows/ is a workflow-state node", async () => {
    const sweep = await sweepFamilies(inst);
    // Before the fix: 0, and `require-all` printed EXAMINED NOTHING.
    expect(nodesOf(sweep, "workflow-state")).toBe(1);
    // `beans/` is still read as a whole; its family map names the child
    // families so that this same node routes there too.
    expect(nodesOf(sweep, "beans")).toBe(1);
  });
});

describe("a deeper directory of another kind still takes its nodes (folio-assistant#2529)", () => {
  const inst = instanceDir("deeper");
  // `sweep-marks` declared by the layer itself at `beans/marks`, inside its
  // `beans/`. `beans` maps `folio-sweep-mark/v1` too, so without the guard its
  // sweep of `beans/` would claim the mark.
  mkdirSync(join(inst, "beans", "marks"), { recursive: true });
  writeDeclaration(inst, {
    name: "deeper",
    directories: [
      { id: "beans", path: "beans/", graphTypologies: ["beans"] },
      { id: "marks", path: "beans/marks", graphTypologies: ["sweep-marks"] },
    ],
  });
  writeFileSync(join(inst, "beans", "marks", "m.json"), JSON.stringify({ $schema: "folio-sweep-mark/v1", check: "x" }));

  test("the enclosing directory's kind does not read it", async () => {
    const sweep = await sweepFamilies(inst);
    expect(nodesOf(sweep, "sweep-marks")).toBe(1);
    expect(nodesOf(sweep, "beans")).toBe(0);
  });
});

describe("a family declared with {} in nodeSchemas is routed as unvalidated, not unmapped", () => {
  const inst = instanceDir("figure-data");
  mkdirSync(join(inst, "library", "doc-1", "figure-data"), { recursive: true });
  writeDeclaration(inst, {
    name: "figure-data",
    directories: [{ id: "lib", path: "library/", graphTypologies: ["library"] }],
  });
  writeFileSync(
    join(inst, "library", "doc-1", "figure-data", "fig-1.json"),
    JSON.stringify({ $schema: "diig-phases-figure/v1" }),
  );
  writeFileSync(
    join(inst, "library", "doc-1", "figure-data", "fig-2.json"),
    JSON.stringify({ $schema: "smart-guidelines-approach-figure/v1" }),
  );

  // The two families are `{}` in this layer's code, but a composition that
  // mounts the layer holding their validators joins them, and the default
  // registry then resolves them instead. The claim is about `{}` families, so
  // the sweep reads a registry seeded from this layer's code alone, with no
  // checkout to join.
  const library = BASE_GRAPH_TYPOLOGIES.library!;
  const registry = new GraphTypologyRegistry({
    library: {
      ...library,
      nodeSchemas: { "diig-phases-figure/v1": {}, "smart-guidelines-approach-figure/v1": {} },
    },
  });

  test("both figure-data families route to library as unvalidated with zero unmapped", async () => {
    const sweep = await sweepFamilies(inst, registry);
    const lib = sweep.find((f) => f.kind === "library");
    expect(lib?.unmapped).toEqual([]);
    expect(lib?.counts["diig-phases-figure/v1"]).toEqual({
      nodes: 1,
      checked: 0,
      parsed: 0,
      state: "unvalidated",
    });
    expect(lib?.counts["smart-guidelines-approach-figure/v1"]).toEqual({
      nodes: 1,
      checked: 0,
      parsed: 0,
      state: "unvalidated",
    });
  });
});
