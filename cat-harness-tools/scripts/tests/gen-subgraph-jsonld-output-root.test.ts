/**
 * `gen-subgraph-jsonld` writes a MOUNTED layer's subgraph tree and payloads to
 * the layer's output root, never into the pinned mount (bean
 * `cat-tools-sm8r`, item 4). A local layer's tree stays where it is.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { subgraphTargets } from "../gen-subgraph-jsonld.ts";
import { clearMountedCache } from "../lib/layer-output.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A checkout that mounts `some-layer` at `some-layer/`, or mounts nothing. */
function checkout(mounted: boolean): { co: string; layer: string } {
  const co = mkdtempSync(join(tmpdir(), "subgraph-out-"));
  dirs.push(co);
  mkdirSync(join(co, ".git"));
  const layer = join(co, "some-layer");
  mkdirSync(join(layer, "docs", "subgraph"), { recursive: true });
  if (mounted) writeFileSync(join(co, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-layer", path: "some-layer" }] }));
  clearMountedCache();
  return { co, layer };
}

const OUT = join("docs", "subgraph");
const PAY = join("docs", "payload", "sha256");
const FILE = join(OUT, "some-layer", "index.jsonld");

describe("subgraphTargets", () => {
  test("a mounted layer is written at its output root", () => {
    const { co, layer } = checkout(true);
    const t = subgraphTargets(layer, OUT, PAY, false, co);
    const twin = join(co, "build", "layers", "some-layer");
    expect(t.treeAbs).toBe(join(twin, OUT));
    expect(t.payloadAbs).toBe(join(twin, PAY));
    expect(t.at(FILE)).toBe(join(twin, FILE));
  });

  test("--check judges the pinned tree until a twin exists, then the twin", () => {
    const { co, layer } = checkout(true);
    expect(subgraphTargets(layer, OUT, PAY, true, co).at(FILE)).toBe(join(layer, FILE));
    const twin = join(co, "build", "layers", "some-layer");
    mkdirSync(join(twin, OUT), { recursive: true });
    const t = subgraphTargets(layer, OUT, PAY, true, co);
    expect(t.treeAbs).toBe(join(twin, OUT));
    expect(t.at(FILE)).toBe(join(twin, FILE));
  });

  test("a local layer is written in place", () => {
    const { co, layer } = checkout(false);
    const t = subgraphTargets(layer, OUT, PAY, false, co);
    expect(t.treeAbs).toBe(join(layer, OUT));
    expect(t.at(FILE)).toBe(join(layer, FILE));
  });
});
