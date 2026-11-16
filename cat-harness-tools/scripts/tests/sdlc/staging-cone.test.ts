/**
 * The staging cone (bean 4j86), on planted trees and on this checkout — the
 * two measurements its Done-when names: a skill-only change carries no IG, and
 * a gen-ig-pages.ts change carries every IG.
 */
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { judge, readTree, renderingOrder } from "../../check-derived-from.ts";
import { type Closure, cone, type ConeDir, importClosure, siteInCone } from "../../staging-cone.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/**
 * The "on this checkout" measurements are about the IGs, so they need the
 * layers that hold them. Standing alone (check:cat-harness-standalone)
 * those are absent: skipped and named as skipped, never passed over nothing.
 */
// smart-immunizations declares no directories since the owner's B1 ruling
// (2026-10-15, `directories: []`): it has no IG pages in this index.
const HAS_IGS = ["fhir-harness", "smart-base", "smart-trust"].every((i) => existsSync(join(REPO, i)));

const dirs: ConeDir[] = [
  { node: "a/index", path: "a/index/" },
  { node: "a/pages", path: "a/docs/", writer: ["gen/pages.ts", "gen/templates/"] },
];
const edges = [{ from: "a/pages", to: "a/index" }];
const order = ["a/index", "a/pages"];
const closures: Record<string, Closure> = { "gen/pages.ts": { files: new Set(["gen/pages.ts", "lib/util.ts"]) } };
const closureOf = (w: string) => closures[w] ?? { files: new Set<string>() };
const carried = (changed?: string[]) =>
  cone(changed, dirs, order, edges, closureOf).filter((d) => d.carry).map((d) => d.node);

describe("the cone, on a planted tree", () => {
  it("no file list carries everything", () => expect(carried(undefined)).toEqual(["a/index", "a/pages"]));
  it("an empty list carries nothing — a determined answer, not a doubt", () => expect(carried([])).toEqual([]));
  it("a change to the source reaches what is derived from it", () => expect(carried(["a/index/x.json"])).toEqual(["a/index", "a/pages"]));
  it("a change in the writer's import closure reaches the pages only", () => expect(carried(["lib/util.ts"])).toEqual(["a/pages"]));
  it("a change under a writer directory reaches the pages", () => expect(carried(["gen/templates/t.liquid"])).toEqual(["a/pages"]));
  it("an unrelated change reaches nothing", () => expect(carried(["skills/x.md"])).toEqual([]));
  it("a computed import carries on a changed module, never on a page", () => {
    const c = () => ({ files: new Set<string>(), computed: "x imports a computed path" });
    expect(cone(["other/mod.ts"], dirs, order, edges, c).find((x) => x.node === "a/pages")?.carry).toBe(true);
    expect(cone(["skills/x.md"], dirs, order, edges, c).find((x) => x.node === "a/pages")?.carry).toBe(false);
  });
  it("an unreadable closure carries, and says why", () => {
    const d = cone(["z"], dirs, order, edges, () => ({ files: new Set(), doubt: "x imports a computed path" }));
    expect(d.find((x) => x.node === "a/pages")).toMatchObject({ carry: true });
    expect(d.find((x) => x.node === "a/pages")?.why).toContain("cannot be read");
  });
});

describe.skipIf(!HAS_IGS)("importClosure, on this checkout", () => {
  const c = importClosure("fhir-harness/scripts/gen-ig-pages.ts", REPO);
  it("reaches gen-ig-pages' own imports", () => {
    expect(c.files.has("fhir-harness/scripts/gen-ig-pages.ts")).toBe(true);
    expect(c.files.has("fhir-harness/schemas/ig-chrome.ts")).toBe(true);
  });
  it("a missing entry is a doubt, never an empty closure read as clean", () => {
    expect(importClosure("no/such.ts", REPO).doubt).toContain("does not exist");
  });
});

describe.skipIf(!HAS_IGS)("the Done-when measurements, on this checkout", () => {
  const tree = readTree(REPO);
  const { edges: realEdges } = judge(tree);
  const realOrder = renderingOrder(tree, realEdges);
  const realDirs: ConeDir[] = tree.flatMap((i) =>
    i.dirs.map((d) => ({ node: `${i.name}/${d.id}`, path: d.path ?? "", ...(d.writer ? { writer: d.writer } : {}) })),
  );
  const memo = new Map<string, Closure>();
  const closureOf = (w: string) => memo.get(w) ?? (memo.set(w, importClosure(w, REPO)), memo.get(w)!);
  const igPages = (changed: string[]) =>
    cone(changed, realDirs, realOrder, realEdges, closureOf)
      .filter((d) => d.carry && /-docs$/.test(d.node) && /^smart-(base|trust|immunizations)\//.test(d.node))
      .map((d) => d.node);
  it("a skill-only change carries no IG", () => {
    expect(igPages(["cat-harness/skills/kg/kg-core/directory-conventions.md"])).toEqual([]);
  });
  it("an unrelated script change carries no IG", () => {
    expect(igPages(["cat-harness/scripts/check-ci-health.ts"])).toEqual([]);
  });
  it("a gen-ig-pages.ts change carries every IG", () => {
    expect(igPages(["fhir-harness/scripts/gen-ig-pages.ts"]).sort()).toEqual(
      ["smart-base/smart-base-docs", "smart-trust/smart-trust-docs"],
    );
  });
  it("a chrome change carries every IG, through derivedFrom", () => {
    expect(igPages(["smart-base/themes/chrome.json"])).toHaveLength(2);
  });
});

describe("a BUILT site (IG Jekyll, AST): siteInCone", () => {
  const base = {
    root: "a",
    cone: [{ node: "a/pages", path: "a/docs/", carry: false, why: "x" }],
    writers: ["gen/site.ts"],
    closureOf: (w: string) => (w === "gen/site.ts" ? { files: new Set(["gen/site.ts", "lib/s.ts"]) } : { files: new Set<string>() }),
  };
  const carry = (changed: string[] | undefined, over: Partial<typeof base> = {}) => siteInCone({ ...base, ...over, changed }).carry;
  it("no file list carries", () => expect(carry(undefined)).toBe(true));
  it("the build environment carries every site", () => expect(carry(["cat-harness/site-chrome/Gemfile.lock"])).toBe(true));
  it("a change under the instance carries it", () => expect(carry(["a/fhir-artifact-index/menu.json"])).toBe(true));
  it("the cone reaching one of its directories carries it", () => {
    expect(carry(["themes/x.json"], { cone: [{ ...base.cone[0]!, carry: true }] })).toBe(true);
  });
  it("a change in a writer's closure carries it", () => expect(carry(["lib/s.ts"])).toBe(true));
  it("an unrelated change does not", () => expect(carry(["skills/x.md"])).toBe(false));
});

