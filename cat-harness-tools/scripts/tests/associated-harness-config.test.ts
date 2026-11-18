/**
 * `associatedHarnesses` (issue #1146): referenced, never loaded. The schema
 * refuses the shapes that would blur that, and the real tree declares none
 * that is local.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { CatHarnessDeclarationSchema, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { harnessPanel, summarise } from "../harness-panel.ts";
import { instanceDirs } from "../harness-tiles.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const IHRIS = {
  name: "ihris",
  title: "iHRIS Knowledge Base",
  url: "https://litlfred.github.io/ihris/",
  repository: "https://github.com/litlfred/ihris",
  relation: "folio-of",
};

function decl(over: Record<string, unknown> = {}): unknown {
  return { name: "example", directories: [], remoteGraphs: [], ...over };
}
function failedPaths(value: unknown): string[] {
  const r = CatHarnessDeclarationSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.path.join(".")).sort();
}

describe("associatedHarnesses: the schema", () => {
  test("absent is legal, and stays absent (not defaulted to [])", () => {
    const r = CatHarnessDeclarationSchema.safeParse(decl());
    expect(r.success).toBe(true);
    expect(r.success && r.data.associatedHarnesses).toBeUndefined();
  });

  test("a well-formed entry parses", () => {
    expect(failedPaths(decl({ associatedHarnesses: [IHRIS] }))).toEqual([]);
  });

  test("an unknown key is refused (strict): a misspelt `repo` must not vanish", () => {
    expect(failedPaths(decl({ associatedHarnesses: [{ ...IHRIS, repo: IHRIS.repository }] }))).toEqual(["associatedHarnesses.0"]);
  });

  test("`url` is required", () => {
    const { url: _drop, ...noUrl } = IHRIS;
    expect(failedPaths(decl({ associatedHarnesses: [noUrl] }))).toEqual(["associatedHarnesses.0.url"]);
  });

  test("a name that is not an instance name is refused", () => {
    expect(failedPaths(decl({ associatedHarnesses: [{ ...IHRIS, name: "iHRIS KB" }] }))).toEqual(["associatedHarnesses.0.name"]);
  });

  test("the same name twice is refused", () => {
    expect(failedPaths(decl({ associatedHarnesses: [IHRIS, IHRIS] }))).toEqual(["associatedHarnesses"]);
  });

  test("a name also in `needs` is refused: associated is not loaded", () => {
    expect(failedPaths(decl({ needs: ["ihris"], associatedHarnesses: [IHRIS] }))).toEqual(["associatedHarnesses.0.name"]);
  });
});

describe("associatedHarnesses: the panel", () => {
  const parse = (v: unknown) => CatHarnessDeclarationSchema.parse(v);

  test("a local name is a finding and is not listed as associated", () => {
    const a = parse(decl({ name: "a", associatedHarnesses: [{ ...IHRIS, name: "b" }] }));
    const b = parse(decl({ name: "b" }));
    const p = harnessPanel(
      [{ dir: "/nowhere/a", decl: a, instantiated: true }, { dir: "/nowhere/b", decl: b, instantiated: false }],
      "/nowhere", undefined, "main", () => undefined,
    );
    expect(p.associated).toEqual([]);
    expect(p.findings.some((f) => f.includes("`b`, which is a harness in this checkout"))).toBe(true);
  });

  test("✎ on an associated harness is ITS repository, never this checkout's", () => {
    const a = parse(decl({ name: "a", associatedHarnesses: [IHRIS] }));
    const p = harnessPanel([{ dir: "/nowhere/a", decl: a, instantiated: true }], "/nowhere", "https://github.com/x/here", "main", () => undefined);
    expect(p.associated[0].editHref).toBe("https://github.com/litlfred/ihris");
    expect(p.harnesses[0].editHref).toBe("https://github.com/x/here/edit/main/a");
  });

  test("an association with no repository has no ✎ at all", () => {
    const { repository: _r, ...noRepo } = IHRIS;
    const a = parse(decl({ name: "a", associatedHarnesses: [noRepo] }));
    const p = harnessPanel([{ dir: "/nowhere/a", decl: a, instantiated: true }], "/nowhere", "https://github.com/x/here", "main", () => undefined);
    expect(p.associated[0].editHref).toBeUndefined();
  });

  test("every property row is there, gaps included", () => {
    const p = harnessPanel([], "/nowhere", undefined, "main", () => undefined);
    expect(p.properties.map((r) => r.key)).toContain("associatedHarnesses");
    expect(p.properties.filter((r) => r.skills.length === 0).every((r) => !!r.gap)).toBe(true);
  });

  test("summaries stay one line", () => {
    expect(summarise(["a", "b"])).toBe("a, b");
    expect(summarise([{ id: "x" }, { id: "y" }])).toBe("2: x, y");
    expect(summarise("z".repeat(200)).length).toBeLessThanOrEqual(90);
  });
});

describe("associatedHarnesses: this tree", () => {
  const names = readdirSync(REPO, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
    .map((d) => d.name);
  const entries = instanceDirs(REPO, names).flatMap((dir) => {
    const d = readDeclaration(dir);
    return d ? [{ dir, decl: d, instantiated: false }] : [];
  });

  test("no declaration associates a harness that is in this checkout", () => {
    const p = harnessPanel(entries, REPO, undefined, "main", () => undefined);
    expect(p.findings.filter((f) => f.includes("is a harness in this checkout"))).toEqual([]);
  });

  // The first association (issue #1146) became the first subscription (issue
  // #1719, bean `tmo5`). The schema allows one relation per remote thing, so
  // cat-harness relates ihris exactly ONCE, by either relation. That holds on
  // both sides of the cat-harness change, which this layer's CI reads at main.
  test("cat-harness relates ihris exactly once: associated (#1146) or subscribed (#1719)", () => {
    const cat = entries.find((e) => e.decl.name === "cat-harness");
    const associated = (cat?.decl.associatedHarnesses ?? []).filter((a) => a.name === "ihris").length;
    const subscribed = (cat?.decl.subscriptions ?? []).filter((s) => s.id === "ihris").length;
    expect(associated + subscribed).toBe(1);
  });
});
