import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readDeclaration } from "./cat-harness";
import { GraphTypologyRegistry } from "./graph-typology-registry";
import { requireHarnessRoot } from "../harness-root.ts";
import {
  kindAndSubclasses,
  newUnkinded,
  nodeKindIndex,
  ratchet,
  renderBaseline,
  ownedOutside,
  typologyOwner,
  UnkindedBaselineKind,
  unkindedKey,
  type Unkinded,
} from "./node-kind-index";

/**
 * Issue #2195: node kinds are found THROUGH the typologies. A module of kinds
 * is written beside this file (not in the OS temp directory) so its `zod`
 * import resolves to the checkout's.
 */
const dir = mkdtempSync(join(import.meta.dir, ".tmp-node-kind-index-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
writeFileSync(
  join(dir, "kinds.ts"),
  `import { z } from "zod";
import { nodeKind } from ${JSON.stringify(join(import.meta.dir, "node-kind.ts"))};
export const Base = nodeKind("base/v1", [], { a: z.string() });
export const Child = nodeKind("child/v1", [Base], { b: z.string() });
export const Grandchild = nodeKind("grandchild/v1", [Child], { c: z.string() });
export const Plain = z.object({ x: z.string() });
`,
);

const def = (extra: object) => ({ renderable: false, holds: "content" as const, summary: "x", ...extra });
const registry = new GraphTypologyRegistry({
  widgets: def({
    nodeSchemas: {
      "child/v1": { validator: "kinds.ts#Child" },
      "grandchild/v1": { validator: "kinds.ts#Grandchild" },
      "plain/v1": { validator: "kinds.ts#Plain" },
      "none/v1": {},
      "https://json-schema.org/draft/2020-12/schema": { external: "JSON Schema 2020-12" },
    },
  }),
  solo: def({ validator: "kinds.ts#Base" }),
  prose: def({}),
});

describe("nodeKindIndex", async () => {
  const index = await nodeKindIndex(registry, dir, dir);
  const byId = new Map(index.kinds.map((k) => [k.id, k]));

  test("a family whose validator is a nodeKind() is a node kind, holding that family", () => {
    expect(byId.get("child/v1")?.holdings).toEqual([{ typology: "widgets", family: "child/v1" }]);
    expect(byId.get("child/v1")?.module).toBe("kinds.ts");
  });

  test("a typology with no families is judged on its kind-level validator", () => {
    expect(byId.get("base/v1")?.holdings).toEqual([{ typology: "solo" }]);
  });

  test("parents and subclasses are both recorded, so the tree reads either way", () => {
    expect(byId.get("child/v1")?.parents).toEqual(["base/v1"]);
    expect(byId.get("base/v1")?.subclasses).toEqual(["child/v1"]);
    expect(kindAndSubclasses(index, "base/v1")).toEqual(["base/v1", "child/v1", "grandchild/v1"]);
  });

  test("a bare Zod schema and a missing validator are UNKINDED, each with its reason", () => {
    expect(index.unkinded).toEqual([
      { typology: "widgets", family: "none/v1", reason: "no-validator" },
      { typology: "widgets", family: "plain/v1", reason: "zod-schema", ref: "kinds.ts#Plain" },
    ]);
  });

  test("an external standard and a typology with nothing to type are not counted at all", () => {
    expect(index.unkinded.some((u) => u.typology === "prose" || u.family?.startsWith("https:"))).toBe(false);
  });

  test("no collisions when one kind is reached twice", async () => {
    // base/v1 is reached twice here: as solo's kind-level validator and as
    // child/v1's parent. It is one entry, and no collision.
    expect(index.kinds.filter((k) => k.id === "base/v1")).toHaveLength(1);
    expect(byId.get("base/v1")?.holdings).toEqual([{ typology: "solo" }]);
    expect(byId.get("child/v1")?.parents).toEqual(["base/v1"]);
    expect(index.collisions).toEqual([]);
    // And one kind held by two typologies is one entry holding both.
    const twice = new GraphTypologyRegistry({
      left: def({ validator: "kinds.ts#Child" }),
      right: def({ validator: "kinds.ts#Child" }),
    });
    const both = await nodeKindIndex(twice, dir, dir);
    expect(both.kinds.filter((k) => k.id === "child/v1")).toHaveLength(1);
    expect(both.kinds.find((k) => k.id === "child/v1")?.holdings).toEqual([{ typology: "left" }, { typology: "right" }]);
    expect(both.collisions).toEqual([]);
  });
});

describe("the ratchet", async () => {
  const index = await nodeKindIndex(registry, dir, dir);

  test("a family unkinded now and absent from the baseline is NEW", () => {
    expect(newUnkinded(index, { unkinded: [{ typology: "widgets", family: "plain/v1", reason: "zod-schema" }] })).toEqual(["widgets#none/v1"]);
  });

  test("a baselined family is not new, and one that became a kind simply leaves", () => {
    const baseline = { unkinded: [...index.unkinded, { typology: "widgets", family: "child/v1", reason: "zod-schema" as const }] };
    expect(newUnkinded(index, baseline)).toEqual([]);
  });
});

/**
 * Owner, 2026-10-15: one baseline per layer. A family is owned by the layer
 * that declares its typology, and each layer is judged against its own.
 */
describe("who owns a family", () => {
  const root = mkdtempSync(join(tmpdir(), "node-kind-owner-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "alpha", "typologies"), { recursive: true });
  writeFileSync(join(root, "alpha", "alpha.json"), JSON.stringify({ name: "alpha", directories: [{ id: "alpha-typologies", path: "typologies/", graphTypologies: ["typologies"] }] }));
  writeFileSync(
    join(root, "alpha", "typologies", "gadgets.json"),
    JSON.stringify({ $schema: "folio-graph-typology/v1", kind: "gadgets", renderable: false, holds: "derived", summary: "the gadgets kind", nodeSchemas: { "gadget/v1": {} } }),
  );
  const reg = new GraphTypologyRegistry({ widgets: def({}) }, root);

  test("a typology declared in an instance's typologies/ graph belongs to that instance", () => {
    expect(typologyOwner(reg, "gadgets")).toBe("alpha");
  });

  test("a typology this layer lists in code belongs to this module's own instance", () => {
    // `widgets` is a test seed, not a base typology: the rule is the base table, so it is unattributed.
    expect(typologyOwner(reg, "widgets")).toBeUndefined();
    expect(typologyOwner(new GraphTypologyRegistry(), "beans")).toBe(readDeclaration(requireHarnessRoot())!.name);
  });

  test("a typology a FIXTURE instance declares belongs to that instance, not to the one containing the fixture (bean w1gy)", () => {
    // The standalone fixture's shape: copies of other layers' layers under
    // this one's test/fixtures/, scanned beside it through FOLIO_FIXTURE_CHECKOUT.
    const checkout = join(root, "alpha", "test", "fixtures", "checkout");
    mkdirSync(join(checkout, "beta", "typologies"), { recursive: true });
    writeFileSync(join(checkout, "beta", "beta.json"), JSON.stringify({ name: "beta", directories: [{ id: "beta-typologies", path: "typologies/", graphTypologies: ["typologies"] }] }));
    writeFileSync(
      join(checkout, "beta", "typologies", "sprockets.json"),
      JSON.stringify({ $schema: "folio-graph-typology/v1", kind: "sprockets", renderable: false, holds: "derived", summary: "the sprockets kind", nodeSchemas: { "sprocket/v1": {} } }),
    );
    // input-site: inert #a5b6a02d — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prior = process.env.FOLIO_FIXTURE_CHECKOUT;
    process.env.FOLIO_FIXTURE_CHECKOUT = checkout;
    try {
      const r = new GraphTypologyRegistry({}, root);
      expect(r.declaredBy("sprockets")).toBe(join(checkout, "beta", "typologies", "sprockets.json"));
      expect(typologyOwner(r, "sprockets")).toBe("beta");
      expect(typologyOwner(r, "gadgets")).toBe("alpha");
      // beta is not a layer of the checkout at `root`: its kinds are left to it.
      expect(ownedOutside(r, "sprockets", root)).toBe(true);
      expect(ownedOutside(r, "gadgets", root)).toBe(false);
    } finally {
      if (prior === undefined) delete process.env.FOLIO_FIXTURE_CHECKOUT;
      else process.env.FOLIO_FIXTURE_CHECKOUT = prior;
      rmSync(join(root, "alpha", "test"), { recursive: true, force: true });
    }
  });

  test("one registered in code by a module nothing here knows is NOT attributed to a guess", () => {
    const r = new GraphTypologyRegistry({}, root);
    r.register("coded", def({}));
    expect(typologyOwner(r, "coded")).toBeUndefined();
  });
});

describe("the per-layer ratchet", () => {
  const u = (typology: string, family?: string): Unkinded => ({ typology, ...(family ? { family } : {}), reason: "zod-schema" });
  const owners: Record<string, string> = { a1: "alpha", a2: "alpha", b1: "beta" };
  const owner = (t: string) => owners[t];
  const index = { unkinded: [u("a1", "x/v1"), u("a2"), u("b1", "y/v1")] };
  const held = (m: Record<string, Unkinded[] | undefined>) => new Map(Object.entries(m));

  test("a layer whose baseline holds its own families passes", () => {
    const { layers, unattributed } = ratchet(index, owner, held({ alpha: [u("a1", "x/v1"), u("a2")], beta: [u("b1", "y/v1")] }));
    expect(unattributed).toEqual([]);
    for (const l of layers) expect([l.fresh, l.gone, l.foreign]).toEqual([[], [], []]);
  });

  test("a NEW family fails in its OWN layer, and another layer's baseline does not excuse it", () => {
    const now = { unkinded: [...index.unkinded, u("b1", "z/v1")] };
    const { layers } = ratchet(now, owner, held({ alpha: [u("a1", "x/v1"), u("a2"), u("b1", "z/v1")], beta: [u("b1", "y/v1")] }));
    const by = new Map(layers.map((l) => [l.instance, l]));
    expect(by.get("beta")!.fresh).toEqual(["b1#z/v1"]);
    expect(by.get("alpha")!.fresh).toEqual([]);
    expect(by.get("alpha")!.foreign).toEqual(["b1#z/v1"]);
  });

  test("an instance that declares no baseline owns an empty one", () => {
    const { layers } = ratchet(index, owner, held({ alpha: [u("a1", "x/v1"), u("a2")] }));
    expect(layers.find((l) => l.instance === "beta")!.fresh).toEqual(["b1#y/v1"]);
  });

  test("a baselined family that became a kind is GONE, and the writer drops it", () => {
    const { layers } = ratchet({ unkinded: [u("a2")] }, owner, held({ alpha: [u("a1", "x/v1"), u("a2")] }));
    expect(layers[0]).toMatchObject({ instance: "alpha", gone: ["a1#x/v1"], fresh: [] });
    expect(layers[0]!.keep.map(unkindedKey)).toEqual(["a2"]);
  });

  test("--accept-unkinded keeps a new family in its owner's baseline, and only there", () => {
    const { layers } = ratchet(index, owner, held({ alpha: [], beta: [] }), true);
    expect(Object.fromEntries(layers.map((l) => [l.instance, l.keep.map(unkindedKey)]))).toEqual({ alpha: ["a1#x/v1", "a2"], beta: ["b1#y/v1"] });
  });

  test("a family no instance can own is unattributed, not filed under a guess", () => {
    const { unattributed, layers } = ratchet({ unkinded: [u("orphan")] }, owner, held({}));
    expect(unattributed.map(unkindedKey)).toEqual(["orphan"]);
    expect(layers).toEqual([]);
  });

  test("MIGRATION: splitting one shared baseline by owner passes and fails exactly what it did", () => {
    // Every subset of the families as the old shared baseline, against the same index:
    // the old gate's NEW set equals the union of the layers' NEW sets.
    const all = [...index.unkinded, u("b1", "z/v1")];
    const now = { unkinded: all };
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const shared = all.filter((_, i) => mask & (1 << i));
      const split: Record<string, Unkinded[]> = {};
      for (const x of shared) (split[owner(x.typology)!] ??= []).push(x);
      const { layers } = ratchet(now, owner, held(split));
      expect(layers.flatMap((l) => l.fresh).sort()).toEqual(newUnkinded(now, { unkinded: shared }).sort());
      expect(layers.flatMap((l) => [...l.gone, ...l.foreign])).toEqual([]);
    }
  });
});

describe("the baseline file", () => {
  test("is keys only, sorted and de-duplicated, under its kind's tag", () => {
    const text = renderBaseline([
      { typology: "b", family: "y/v1" },
      { typology: "a" },
      { typology: "b", family: "y/v1" },
    ]);
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({ $schema: "unkinded-baseline/1.0.0", unkinded: [{ typology: "a" }, { typology: "b", family: "y/v1" }] });
    expect(UnkindedBaselineKind.schema.safeParse(parsed).success).toBe(true);
  });

  test("refuses a field that would drift with another layer (a validator ref)", () => {
    const withRef = { $schema: "unkinded-baseline/1.0.0", unkinded: [{ typology: "a", ref: "core:x.ts#X" }] };
    expect(UnkindedBaselineKind.schema.safeParse(withRef).success).toBe(false);
  });
});
