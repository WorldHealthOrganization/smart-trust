/**
 * `prefixesInScope` answers from the declarations, not from what else is
 * checked out beside the layer (bean `cat-tools-d5j0`).
 *
 * Two fixture checkouts hold the same `cat-harness` declaration, which needs
 * `bootstrap`. One also holds bootstrap; the other is cat-harness alone, the
 * sibling-clone layout where `checkoutRootFor` stops at cat-harness's own
 * `.git`. Both must give the same reach and the same subgraph context, with the
 * `bootstrap` prefix bound. A `needs` name that is no own prefix and no
 * layer here still binds nothing.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prefixesInScope, subgraphContext } from "../gen-subgraph-jsonld.ts";
import { ownPrefixTable } from "../../schemas/kg/graph-typology-registry.js";

const decl = (name: string, needs: string[]) =>
  JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name, version: "0.0.0", directories: [], needs });

let work: string;
let alone: string;
let composed: string;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "subgraph-prefix-scope-"));
  // cat-harness alone, its own git checkout: bootstrap is not here.
  alone = join(work, "alone");
  mkdirSync(alone, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: alone });
  writeFileSync(join(alone, "cat-harness.json"), decl("cat-harness", ["bootstrap", "nonesuch"]));
  // One checkout holding both layers.
  const index = join(work, "composed");
  composed = join(index, "cat-harness");
  mkdirSync(composed, { recursive: true });
  mkdirSync(join(index, "bootstrap"), { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: index });
  writeFileSync(join(composed, "cat-harness.json"), decl("cat-harness", ["bootstrap", "nonesuch"]));
  writeFileSync(join(index, "bootstrap", "bootstrap.json"), decl("bootstrap", []));
});

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("prefixesInScope with a needed instance absent from the checkout", () => {
  test("bootstrap is own-prefixed, so the fixture means something", () => {
    expect(Object.hasOwn(ownPrefixTable(), "bootstrap")).toBe(true);
  });

  test("the needed instance's prefix is still in scope", () => {
    const scope = prefixesInScope(alone);
    expect(scope).toBeDefined();
    expect([...scope!].sort()).toEqual(["bootstrap", "cat-harness"]);
  });

  test("the reach is the same as when the checkout holds it", () => {
    const withIt = prefixesInScope(composed);
    expect(withIt).toBeDefined();
    expect([...withIt!].sort()).toEqual(["bootstrap", "cat-harness"]);
    expect([...prefixesInScope(alone)!].sort()).toEqual([...withIt!].sort());
  });

  test("a needs name that is neither here nor an own prefix binds nothing", () => {
    expect(prefixesInScope(alone)!.has("nonesuch")).toBe(false);
  });

  test("the subgraph context is byte-identical either way, and binds bootstrap", () => {
    const a = subgraphContext(prefixesInScope(alone));
    const b = subgraphContext(prefixesInScope(composed));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.bootstrap).toBe((ownPrefixTable() as Record<string, string>).bootstrap);
  });
});
