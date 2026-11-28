/**
 * Graph typologies declared as nodes (bean dmx1): loaded from each layer's
 * `typologies/` graph on first use, refused when two files claim one name.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GraphTypologyNodeSchema } from "./graph-typology-node";
import { readDeclaration } from "./cat-harness";
import { BASE_GRAPH_TYPOLOGIES, GraphTypologyRegistry, defaultTypologyRoots } from "./graph-typology-registry";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const node = (name: string, holds = "derived") => ({
  $schema: "folio-graph-typology/v1",
  kind: name,
  renderable: false,
  holds,
  summary: `the ${name} kind`,
});

/** The message `f` throws, or "" when it does not throw. */
function thrownMessage(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "";
}

/** A checkout whose layers each declare a typologies/ graph holding `typologies`. */
function checkout(instances: Record<string, Record<string, unknown>[]>): string {
  const root = mkdtempSync(join(tmpdir(), "kinds-"));
  made.push(root);
  for (const [name, kinds] of Object.entries(instances)) {
    const dir = join(root, name);
    mkdirSync(join(dir, "typologies"), { recursive: true });
    writeFileSync(join(dir, `${name}.json`), JSON.stringify({ name, directories: [{ id: `${name}-typologies`, path: "typologies/", graphTypologies: ["typologies"] }] }));
    kinds.forEach((k, i) => writeFileSync(join(dir, "typologies", `${(k as { kind?: string }).kind ?? i}.json`), JSON.stringify(k)));
  }
  return root;
}

describe("a declared kind", () => {
  test("is loaded on first use, with the file that declared it", () => {
    const root = checkout({ alpha: [node("widget")] });
    const r = new GraphTypologyRegistry({}, root);
    expect(r.get("widget")?.holds).toBe("derived");
    expect(r.declaredBy("widget")).toBe(join(root, "alpha", "typologies", "widget.json"));
    expect(r.names()).toContain("widget");
  });
  test("carries `shownOnPublishedPages`, and the schema takes only `true` for it", () => {
    const root = checkout({ alpha: [{ ...node("annex", "content"), shownOnPublishedPages: true }] });
    expect(new GraphTypologyRegistry({}, root).get("annex")?.shownOnPublishedPages).toBe(true);
    expect(GraphTypologyNodeSchema.safeParse({ ...node("annex"), shownOnPublishedPages: false }).success).toBe(false);
  });
  test("is unknown to a registry that declares no checkout", () => {
    expect(new GraphTypologyRegistry({}).has("widget")).toBe(false);
  });
  test("two files claiming one name are refused, naming both", () => {
    const root = checkout({ alpha: [node("widget")], beta: [node("widget", "content")] });
    expect(() => new GraphTypologyRegistry({}, root).get("widget")).toThrow(/declared by/);
    const message = thrownMessage(() => new GraphTypologyRegistry({}, root).get("widget"));
    expect(message).toContain(join(root, "alpha", "typologies", "widget.json"));
    expect(message).toContain(join(root, "beta", "typologies", "widget.json"));
  });
  test("a declared name that the code also lists is refused", () => {
    const root = checkout({ alpha: [node("widget")] });
    expect(() => new GraphTypologyRegistry({ widget: { renderable: false, holds: "content", summary: "x" } }, root).names()).toThrow(/base layer/);
  });
  test("a node that does not parse throws with its path", () => {
    const root = checkout({ alpha: [{ $schema: "folio-graph-typology/v1", kind: "widget" }] });
    expect(() => new GraphTypologyRegistry({}, root).has("widget")).toThrow(/widget\.json/);
  });
});

describe("the node schema", () => {
  test("a node is never mistaken for an instance declaration (it carries no `name`)", async () => {
    const root = checkout({ alpha: [node("widget")] });
    const { findDeclarationFile } = await import("./instance-roots");
    expect(findDeclarationFile(join(root, "alpha", "typologies"))).toBeUndefined();
  });
  test("refuses an unknown field and an upper-case name", () => {
    expect(GraphTypologyNodeSchema.safeParse({ ...node("widget"), extra: 1 }).success).toBe(false);
    expect(GraphTypologyNodeSchema.safeParse(node("Widget")).success).toBe(false);
  });
});

describe("this checkout", () => {
  test("fhir-harness declares ig-pages and ig-ast, with their avatars", async () => {
    const { defaultGraphTypologies } = await import("./graph-typology-registry");
    const { hasAvatar } = await import("../content/avatars");
    for (const k of ["ig-pages", "ig-ast"]) {
      expect(defaultGraphTypologies.declaredBy(k)).toMatch(/fhir-harness[/\\]typologies[/\\]/);
      expect(hasAvatar(k)).toBe(true);
    }
  });
});

describe("validators as nodes (bean riit): the validator names the family", () => {
  /** A checkout with one layer declaring kinds/ and validators/. */
  function withValidators(kinds: Record<string, unknown>[], validators: Record<string, unknown>[]): string {
    const root = mkdtempSync(join(tmpdir(), "validators-"));
    made.push(root);
    const dir = join(root, "alpha");
    mkdirSync(join(dir, "typologies"), { recursive: true });
    mkdirSync(join(dir, "validators"), { recursive: true });
    writeFileSync(
      join(dir, "alpha.json"),
      JSON.stringify({
        name: "alpha",
        directories: [
          { id: "k", path: "typologies/", graphTypologies: ["typologies"] },
          { id: "v", path: "validators/", graphTypologies: ["validators"] },
        ],
      }),
    );
    for (const k of kinds) writeFileSync(join(dir, "typologies", `${(k as { kind: string }).kind}.json`), JSON.stringify(k));
    validators.forEach((v, i) => writeFileSync(join(dir, "validators", `${(v as { id?: string }).id ?? i}.json`), JSON.stringify(v)));
    return root;
  }
  const famKind = { ...node("widget"), nodeSchemas: { "widget/v1": {} } };
  const v = (id: string, family?: string, schema = "alpha:schemas/w.ts#WidgetSchema") => ({
    $schema: "folio-validator/v1",
    id,
    validates: { kind: "widget", ...(family ? { family } : {}) },
    schema,
  });
  test("a listed family takes the validator a node names for it", () => {
    const r = new GraphTypologyRegistry({}, withValidators([famKind], [v("widget", "widget/v1")]));
    expect(r.get("widget")?.nodeSchemas?.["widget/v1"]?.validator).toBe("alpha:schemas/w.ts#WidgetSchema");
    expect(r.validatorNodeFor("widget", "widget/v1")?.node.id).toBe("widget");
  });
  test("a kind-level validator fills a kind with no families", () => {
    const r = new GraphTypologyRegistry({}, withValidators([node("widget")], [v("widget")]));
    expect(r.get("widget")?.validator).toBe("alpha:schemas/w.ts#WidgetSchema");
  });
  test("a validator for a family the kind does not list is refused", () => {
    expect(() => new GraphTypologyRegistry({}, withValidators([famKind], [v("widget", "other/v1")])).get("widget")).toThrow(/does not list/);
  });
  test("two validators for one family are refused, naming both", () => {
    const root = withValidators([famKind], [v("a", "widget/v1"), v("b", "widget/v1", "alpha:x.ts#Other")]);
    expect(() => new GraphTypologyRegistry({}, root).get("widget")).toThrow(/two validators/);
    const message = thrownMessage(() => new GraphTypologyRegistry({}, root).get("widget"));
    expect(message).toContain(join(root, "alpha", "validators", "a.json"));
    expect(message).toContain(join(root, "alpha", "validators", "b.json"));
  });
  test("a family that already names DIFFERENT code is two answers, and refused", () => {
    const coded = { ...node("widget"), nodeSchemas: { "widget/v1": { validator: "alpha:old.ts#OldSchema" } } };
    expect(() => new GraphTypologyRegistry({}, withValidators([coded], [v("widget", "widget/v1")])).get("widget")).toThrow(/two answers/);
  });
  test("a kind registered in code after load is joined too (core's folio)", () => {
    const r = new GraphTypologyRegistry({}, withValidators([], [v("widget")]));
    r.names();
    r.register("widget", { renderable: false, holds: "content", summary: "late" });
    expect(r.get("widget")?.validator).toBe("alpha:schemas/w.ts#WidgetSchema");
  });
});

describe("several checkouts, in precedence order (kg-separation lesson 6)", () => {
  test("a kind only the inspected checkout declares is known — the standalone-tools case", () => {
    const inspected = checkout({ "contributor": [node("l6-contributed")] });
    const own = checkout({ harness: [] });
    const r = new GraphTypologyRegistry({}, [inspected, own]);
    expect(r.has("l6-contributed")).toBe(true);
    // The module's own checkout alone — what the registry read before — does not know it.
    expect(new GraphTypologyRegistry({}, own).has("l6-contributed")).toBe(false);
  });
  test("a later checkout repeating a kind is SHADOWED and reported, not a conflict", () => {
    const inspected = checkout({ layer: [node("l6-shared", "content")] });
    const own = checkout({ layer: [node("l6-shared", "derived")] });
    const r = new GraphTypologyRegistry({}, [inspected, own]);
    expect(r.get("l6-shared")?.holds).toBe("content");
    expect(r.shadowed()).toEqual([
      { kind: "l6-shared", kept: join(inspected, "layer", "typologies", "l6-shared.json"), shadowed: join(own, "layer", "typologies", "l6-shared.json") },
    ]);
  });
  test("within ONE checkout two files claiming a name are still refused", () => {
    const one = checkout({ alpha: [node("l6-twice")], beta: [node("l6-twice")] });
    const other = checkout({ gamma: [] });
    expect(() => new GraphTypologyRegistry({}, [other, one]).get("l6-twice")).toThrow(/declared by/);
  });
  test("defaultTypologyRoots: $REPO_ROOT alone; else the inspected checkout first, then the module's", () => {
    const inspected = checkout({ downstream: [] });
    const own = checkout({ harness: [] });
    const moduleDir = join(own, "harness", "schemas", "kg");
    expect(defaultTypologyRoots({ REPO_ROOT: inspected }, own, moduleDir)).toEqual([inspected]);
    expect(defaultTypologyRoots({}, inspected, moduleDir)).toEqual([inspected, own]);
    expect(defaultTypologyRoots({}, own, moduleDir)).toEqual([own]);
    // A cwd that holds no layer is not a checkout under inspection.
    const empty = mkdtempSync(join(tmpdir(), "no-instance-"));
    made.push(empty);
    expect(defaultTypologyRoots({}, empty, moduleDir)).toEqual([own]);
  });
  test("readDeclaration registers typologies from the declaration's checkout before validating (bean cat-tools-g7ls)", () => {
    const closure = checkout({ "cat-harness": [] });
    const outside = checkout({ "folio-assistant-core": [node("g7ls-contributed", "content")] });
    const consumer = join(outside, "fhir-harness");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(
      join(consumer, "fhir-harness.json"),
      JSON.stringify({
        name: "fhir-harness",
        needs: ["folio-assistant-core"],
        directories: [{ id: "fhir-glossary", path: "glossary/", graphTypologies: ["g7ls-contributed"] }],
      }),
    );
    const r = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, [closure]);
    expect(r.has("g7ls-contributed")).toBe(false);
    const decl = readDeclaration(consumer, r);
    expect(decl?.name).toBe("fhir-harness");
    expect(r.has("g7ls-contributed")).toBe(true);
    // A bare registry (no declared checkout) stays isolated and still refuses unknown kinds.
    const bare = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES);
    expect(() => readDeclaration(consumer, bare)).toThrow(/unknown graph typology "g7ls-contributed"/);
  });
  test("a checkout read before a layer was mounted is read again once the layer is on disk (standing re-pin, ig-ast, 2026-11-13)", () => {
    const closure = checkout({ "cat-harness": [] });
    // The site, before its layers are mounted: its own declaration names a kind
    // only a layer it mounts declares.
    const site = checkout({ "smart-trust": [] });
    const own = join(site, "smart-trust");
    writeFileSync(
      join(own, "smart-trust.json"),
      JSON.stringify({ name: "smart-trust", needs: ["fhir-harness"], directories: [{ id: "smart-trust-ast", path: "ast/", graphTypologies: ["rescan-ig-ast"] }] }),
    );
    const r = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, [closure]);
    expect(() => readDeclaration(own, r)).toThrow(/unknown graph typology "rescan-ig-ast"/);
    // The mount lays the layer down in the same process.
    const mounted = join(site, "fhir-harness");
    mkdirSync(join(mounted, "typologies"), { recursive: true });
    writeFileSync(join(mounted, "fhir-harness.json"), JSON.stringify({ name: "fhir-harness", directories: [{ id: "fhir-typologies", path: "typologies/", graphTypologies: ["typologies"] }] }));
    writeFileSync(join(mounted, "typologies", "rescan-ig-ast.json"), JSON.stringify(node("rescan-ig-ast")));
    expect(readDeclaration(own, r)?.name).toBe("smart-trust");
    expect(r.has("rescan-ig-ast")).toBe(true);
    // Read again with nothing new mounted: the same kinds, no conflict from re-reading the same files.
    expect(readDeclaration(own, r)?.name).toBe("smart-trust");
  });
  test("a lazy roots thunk is not evaluated at construction time — importing the module touches no filesystem (cat-harness-tools#634)", () => {
    const inspected = checkout({ contributor: [node("l6-lazy")] });
    let calls = 0;
    const r = new GraphTypologyRegistry({}, () => {
      calls++;
      return [inspected];
    });
    expect(calls).toBe(0);
    expect(r.has("l6-lazy")).toBe(true);
    expect(calls).toBe(1);
    expect(r.roots()).toEqual([inspected]);
    expect(calls).toBe(1);
  });
});
