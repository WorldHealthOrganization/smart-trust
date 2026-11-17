/**
 * `builtAtPublish` (owner, 2026-10-14, "B1"): the shape, and the two facts that
 * must stay equal to it — `.gitignore` keeps every declared path out of a
 * commit, and no declared path is tracked.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BuiltAtPublishListSchema, BuiltAtPublishSchema, ignoreLineFor, isBuiltAtPublish } from "./built-at-publish.ts";
import { CatHarnessDeclarationSchema } from "./cat-harness.ts";

import { requireHarnessRoot } from "../harness-root.ts";
const ROOT = requireHarnessRoot();
const entry = (extra: Record<string, unknown>) => ({ path: "docs/x/", writer: ["x:gen"], because: "checkout", reason: "r", ...extra });

describe("the shape", () => {
  test("a checkout entry is valid", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({})).success).toBe(true);
  });
  test("a state entry must name its branch-kept graph", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ because: "state" })).success).toBe(false);
    expect(BuiltAtPublishSchema.safeParse(entry({ because: "state", from: ["beans"] })).success).toBe(true);
  });
  test("a checkout entry names no branch", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ from: ["beans"] })).success).toBe(false);
  });
  test("a lower entry (computed from a layer below, or from the tools) is valid and names no branch (owner, 2026-11-13)", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ because: "lower" })).success).toBe(true);
    expect(BuiltAtPublishSchema.safeParse(entry({ because: "lower", from: ["beans"] })).success).toBe(false);
  });
  test("an unknown cause is refused", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ because: "pinned" })).success).toBe(false);
  });
  test("a glob, an absolute path and a .. are refused", () => {
    for (const path of ["docs/*.json", "/docs/x/", "docs/../x"]) expect(BuiltAtPublishSchema.safeParse(entry({ path })).success).toBe(false);
  });
  test("a writer is a script name, not a path", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ writer: ["scripts/gen.ts"] })).success).toBe(false);
  });
  test("one route, one declared writer: a path twice, or one inside another, is refused", () => {
    expect(BuiltAtPublishListSchema.safeParse([entry({}), entry({})]).success).toBe(false);
    expect(BuiltAtPublishListSchema.safeParse([entry({}), entry({ path: "docs/x/y.json" })]).success).toBe(false);
    expect(BuiltAtPublishListSchema.safeParse([entry({}), entry({ path: "docs/y/" })]).success).toBe(true);
  });
  test("`reads` names graph typologies, each once — never an instance path (A1)", () => {
    expect(BuiltAtPublishSchema.safeParse(entry({ reads: ["docs"] })).success).toBe(true);
    expect(BuiltAtPublishSchema.safeParse(entry({ reads: [] })).success).toBe(false);
    expect(BuiltAtPublishSchema.safeParse(entry({ reads: ["docs", "docs"] })).success).toBe(false);
    expect(BuiltAtPublishSchema.safeParse(entry({ reads: ["smart-trust/docs/"] })).success).toBe(false);
  });
  test("isBuiltAtPublish matches a declared file, and anything under a declared directory", () => {
    const list = [{ path: "docs/x/" }, { path: "docs/a.json" }];
    expect(isBuiltAtPublish(list, "docs/x/deep/p.html")).toBe(true);
    expect(isBuiltAtPublish(list, "docs/a.json")).toBe(true);
    expect(isBuiltAtPublish(list, "docs/a.json.bak")).toBe(false);
    expect(isBuiltAtPublish(list, "docs/xy/p.html")).toBe(false);
  });
});

describe("this instance's declaration", () => {
  const decl = CatHarnessDeclarationSchema.parse(JSON.parse(readFileSync(join(ROOT, "cat-harness.json"), "utf-8")));
  const declared = decl.builtAtPublish ?? [];

  test(".gitignore's built-at-publish block is exactly the declared paths", () => {
    const text = readFileSync(join(ROOT, ".gitignore"), "utf-8");
    const block = /# BEGIN built at publish[^\n]*\n([\s\S]*?)# END built at publish/.exec(text);
    // Declaring nothing and ignoring nothing agree; either one without the other does not.
    if (declared.length === 0) return expect(block).toBeNull();
    expect(block).not.toBeNull();
    const lines = block![1]!.split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    expect(lines.sort()).toEqual(declared.map(ignoreLineFor).sort());
  });

  test("nothing declared is tracked (asked of git only where this instance IS the repository)", () => {
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ROOT, encoding: "utf-8" });
    // A mount inside an index, or an extract with no git: nothing here is this
    // layer's commit, so there is nothing to ask. Not a pass dressed as one —
    // the `.gitignore` test above is what binds there.
    if (top.status !== 0 || resolve(top.stdout.trim()) !== ROOT) return;
    // `git ls-files --` with NO paths lists every tracked file, so an empty
    // declaration must not reach it: there is nothing declared, hence nothing
    // declared that could be tracked. (It reached it in the standalone
    // rehearsal, where this layer IS the repository, and failed there.)
    if (declared.length === 0) return;
    const r = spawnSync("git", ["ls-files", "-z", "--", ...declared.map((e) => e.path)], { cwd: ROOT, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout.split("\0").filter(Boolean)).toEqual([]);
  });
});
