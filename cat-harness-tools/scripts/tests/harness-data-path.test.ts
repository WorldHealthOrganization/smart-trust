/**
 * The rail pass reads a built layer's `_data/harness.json` where
 * `sync-docs-harness.ts` wrote it. Since bean `cat-tools-sm8r` item 4 step 4,
 * in a checkout that MOUNTS the layer, that is the layer's output root, not
 * the pinned mount. Reading only the mount found nothing, so the rail pass
 * wrote no `#fa-navbar-row`, and a folio's generated home page lost its icon
 * row (2026-11-14).
 *
 * @module scripts/tests/harness-data-path
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writePathAt } from "../lib/layer-output.ts";
import { harnessDataPath } from "../mount-instance-docs.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A checkout; with `mounted`, its lock mounts the layer at `layer/`. */
function checkout(mounted: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "harness-data-"));
  dirs.push(root);
  if (mounted) writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "layer", path: "layer", sha: "a".repeat(40) }] }));
  mkdirSync(join(root, "layer/docs/_data"), { recursive: true });
  return root;
}

describe("harnessDataPath — where a built layer's harness data is read", () => {
  test("a mounted layer's data written at its output root is read there, not from the mount", () => {
    const root = checkout(true);
    const inMount = join(root, "layer/docs/_data/harness.json");
    const twin = writePathAt(root, inMount);
    expect(twin).not.toBe(inMount);
    mkdirSync(dirname(twin), { recursive: true });
    writeFileSync(twin, JSON.stringify({ navbar: { icons: [] } }));
    expect(harnessDataPath("layer/docs", root)).toBe(twin);
  });

  test("with nothing at the output root, the pinned copy in the mount is read", () => {
    const root = checkout(true);
    expect(harnessDataPath("layer/docs", root)).toBe(join(root, "layer/docs/_data/harness.json"));
  });

  test("a layer the checkout does not mount is read in place", () => {
    const root = checkout(false);
    expect(harnessDataPath("layer/docs", root)).toBe(join(root, "layer/docs/_data/harness.json"));
  });
});
