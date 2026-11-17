/**
 * Bean `ujiv` (issue #88): beans and layer declarations are node kinds,
 * by TAGGING the files — `bean/1.0.0` in a bean's front matter,
 * `cat-harness-declaration/1.0.0` in an `<instance>.json`.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { BEAN_SCHEMA_TAG, BeanKind } from "./sdlc/bean-graph";
import {
  CAT_HARNESS_DECLARATION_SCHEMA_TAG,
  CatHarnessDeclarationKind,
  CatHarnessDeclarationSchema,
  defaultGraphTypologies,
} from "./kg/cat-harness";
import { nodeKindIndex } from "./kg/node-kind-index";

import { requireHarnessRoot } from "./harness-root.ts";
describe("the bean kind", () => {
  test("is `bean/1.0.0`, and the tag constant says the same", () => {
    expect(BeanKind.tag).toBe("bean/1.0.0");
    expect(BEAN_SCHEMA_TAG).toBe(BeanKind.tag!);
  });

  test("accepts a tagged bean's front matter and refuses an untagged one", () => {
    expect(BeanKind.schema.safeParse({ $schema: "bean/1.0.0", id: "x-1", title: "t", status: "todo" }).success).toBe(true);
    expect(BeanKind.schema.safeParse({ id: "x-1", title: "t", status: "todo" }).success).toBe(false);
    expect(BeanKind.schema.safeParse({ $schema: "bean/2.0.0", id: "x-1" }).success).toBe(false);
  });
});

describe("the instance-declaration kind", () => {
  const decl = { name: "alpha", version: "0.1.0" };

  test("is `cat-harness-declaration/1.0.0`", () => {
    expect(CatHarnessDeclarationKind.tag).toBe(CAT_HARNESS_DECLARATION_SCHEMA_TAG);
  });

  test("a parse KEEPS the tag, so a parse-and-write does not lose it", () => {
    const out = CatHarnessDeclarationSchema.parse({ $schema: CAT_HARNESS_DECLARATION_SCHEMA_TAG, ...decl });
    expect(out.$schema).toBe(CAT_HARNESS_DECLARATION_SCHEMA_TAG);
  });

  test("an untagged declaration still parses (the retag gate is what fails it); another major does not", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl).success).toBe(true);
    expect(CatHarnessDeclarationSchema.safeParse({ $schema: "cat-harness-declaration/2.0.0", ...decl }).success).toBe(false);
  });

  test("the kind requires the tag and runs the same cross-field checks as the schema", () => {
    expect(CatHarnessDeclarationKind.schema.safeParse(decl).success).toBe(false);
    expect(CatHarnessDeclarationKind.schema.safeParse({ $schema: CAT_HARNESS_DECLARATION_SCHEMA_TAG, ...decl }).success).toBe(true);
  });
});

describe("the node-kind index", async () => {
  const root = requireHarnessRoot();
  const index = await nodeKindIndex(defaultGraphTypologies, root, join(root, ".."));
  const byId = new Map(index.kinds.map((k) => [k.id, k]));

  test("finds the bean kind through the bean-defs typology", () => {
    expect(byId.get("bean")?.holdings).toEqual([{ typology: "bean-defs" }]);
  });

  test("finds the declaration kind by its name rule, declared by cat-harness", () => {
    expect(byId.get("cat-harness-declaration")).toMatchObject({ foundBy: "instance-declaration", declaredBy: "cat-harness", holdings: [] });
  });

  test("bean-defs is no longer an unkinded typology", () => {
    expect(index.unkinded.some((u) => u.typology === "bean-defs")).toBe(false);
  });
});
