/**
 * `gen-skill-docs` writes a MOUNTED layer's skill-instruction pages to the
 * layer's output root, never into the pinned mount (bean `cat-tools-sm8r`,
 * item 4). A local layer's pages stay where they are.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { skillDocsTargets } from "../gen-skill-docs.ts";
import { clearMountedCache } from "../lib/layer-output.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A checkout that mounts `some-layer` at `some-layer/`, or mounts nothing. */
function checkout(mounted: boolean): { co: string; out: string } {
  const co = mkdtempSync(join(tmpdir(), "skill-docs-out-"));
  dirs.push(co);
  mkdirSync(join(co, ".git"));
  const out = join(co, "some-layer", "docs", "reference", "skill-instructions");
  mkdirSync(out, { recursive: true });
  if (mounted) writeFileSync(join(co, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-layer", path: "some-layer" }] }));
  clearMountedCache();
  return { co, out };
}

const REL = join("docs", "reference", "skill-instructions");

describe("skillDocsTargets", () => {
  test("a mounted layer's pages are written at its output root", () => {
    const { co, out } = checkout(true);
    const twin = join(co, "build", "layers", "some-layer", REL);
    const t = skillDocsTargets(out, false, co);
    expect(t.dir).toBe(twin);
    expect(t.writeAt(join(out, "index.md"))).toBe(join(twin, "index.md"));
  });

  test("--check reads the pinned page until a twin exists, then the twin", () => {
    const { co, out } = checkout(true);
    const page = join(out, "a-skill.md");
    writeFileSync(page, "pinned");
    let t = skillDocsTargets(out, true, co);
    expect(t.dir).toBe(out);
    expect(t.readAt(page)).toBe(page);
    const twin = join(co, "build", "layers", "some-layer", REL);
    mkdirSync(twin, { recursive: true });
    writeFileSync(join(twin, "a-skill.md"), "computed");
    t = skillDocsTargets(out, true, co);
    expect(t.dir).toBe(twin);
    expect(t.readAt(page)).toBe(join(twin, "a-skill.md"));
  });

  test("a local layer's pages are written in place", () => {
    const { co, out } = checkout(false);
    const t = skillDocsTargets(out, false, co);
    expect(t.dir).toBe(out);
    expect(t.writeAt(join(out, "index.md"))).toBe(join(out, "index.md"));
  });
});
