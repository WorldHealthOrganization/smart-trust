/**
 * Node-kind multiple inheritance (bean a1lq). Each refusal is tested as a rule:
 * one case where it must throw and one where the same shape is legitimate.
 */
import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { acceptsSchemaTag, nodeKind } from "./node-kind";
import { TodoNodeKind, TodoNodeSchema, type TodoNode } from "../sdlc/todo";

const base = nodeKind("base", [], { id: z.string() });

describe("nodeKind", () => {
  it("a diamond composes the shared ancestor once, deepest first", () => {
    const left = nodeKind("left", [base], { l: z.string() });
    const right = nodeKind("right", [base], { r: z.string() });
    const child = nodeKind("child", [left, right], { c: z.string() });
    expect(child.order).toEqual(["base", "left", "right", "child"]);
    expect(Object.keys(child.schema.shape)).toEqual(["id", "l", "r", "c"]);
  });

  it("refuses a field two unrelated parents define", () => {
    const a = nodeKind("a", [], { k: z.string() });
    const b = nodeKind("b", [], { k: z.number() });
    expect(() => nodeKind("ab", [a, b], {})).toThrow(/`k` is defined by `a` and `b`/);
  });

  it("refuses it at different depths too — incomparable, not same-depth", () => {
    const a = nodeKind("a", [], { k: z.string() });
    const d = nodeKind("d", [], { k: z.number() });
    const b = nodeKind("b", [d], {});
    expect(() => nodeKind("ab", [a, b], {})).toThrow(/`k` is defined by/);
  });

  it("the child settles such a conflict by redefining the field, declared", () => {
    const a = nodeKind("a", [], { k: z.string() });
    const b = nodeKind("b", [], { k: z.number() });
    const ab = nodeKind("ab", [a, b], { k: z.boolean() }, { overrides: ["k"] });
    expect(ab.schema.parse({ k: true })).toEqual({ k: true });
  });

  it("refuses an override the child did not declare, and one that overrides nothing", () => {
    expect(() => nodeKind("x", [base], { id: z.number() })).toThrow(/without being listed in `overrides`/);
    expect(() => nodeKind("y", [base], { z: z.number() }, { overrides: ["z"] })).toThrow(/no ancestor defines it/);
  });

  it("refuses two different kinds under one id", () => {
    const twin = nodeKind("base", [], { other: z.string() });
    expect(() => nodeKind("both", [base, twin], {})).toThrow(/two different kinds are both named `base`/);
  });
});

describe("the todo declares its parents", () => {
  it("is composed carried-note, then themed, then its own fields", () => {
    expect(TodoNodeKind.order).toEqual(["carried-note", "themed", "todo"]);
    expect(TodoNodeKind.tag).toBe("todo/1.0.0");
    expect(Object.keys(TodoNodeSchema.shape)).toEqual([
      "id", "summary", "comment", "createdAt", "updatedAt", "targetLabel", "anchor", "alsoAbout", "tags",
      "theme", "layout", "status", "priority", "origin", "$schema",
    ]);
  });

  it("keeps its static type — a field from each parent is typed, not unknown", () => {
    const t = {} as TodoNode;
    const fromNote: string = t.summary;
    const fromThemed: string | undefined = t.theme;
    const own: string = t.$schema;
    expect([fromNote, fromThemed, own]).toBeDefined();
  });
});

describe("versioned kinds (SemVer, one live major — issue #2195)", () => {
  const Widget = nodeKind("widget/1.2.3", [], { size: z.number() });

  it("splits the id into a NAME and a version, and records the tag a writer stamps", () => {
    expect([Widget.id, Widget.version, Widget.tag]).toEqual(["widget", "1.2.3", "widget/1.2.3"]);
  });

  it("accepts its own tag and any earlier minor or patch of the same major", () => {
    for (const t of ["widget/1.2.3", "widget/1.2.0", "widget/1.0.9"]) expect(acceptsSchemaTag(Widget, t)).toBe(true);
    expect(Widget.schema.safeParse({ size: 1, $schema: "widget/1.1.0" }).success).toBe(true);
  });

  it("refuses a newer minor or patch, another major, and another name", () => {
    for (const t of ["widget/1.2.4", "widget/1.3.0", "widget/2.0.0", "widget/0.9.0", "gadget/1.2.3", "widget/v1"]) {
      expect(acceptsSchemaTag(Widget, t)).toBe(false);
    }
    expect(Widget.schema.safeParse({ size: 1, $schema: "widget/2.0.0" }).success).toBe(false);
  });

  it("a subclass's generated $schema replaces its parent's without an override", () => {
    const Sub = nodeKind("sub-widget/1.0.0", [Widget], { colour: z.string() });
    expect(Sub.schema.safeParse({ size: 1, colour: "red", $schema: "sub-widget/1.0.0" }).success).toBe(true);
    expect(Sub.schema.safeParse({ size: 1, colour: "red", $schema: "widget/1.2.3" }).success).toBe(false);
  });

  it("refuses a hand-written $schema on a versioned kind: one answer, not two", () => {
    expect(() => nodeKind("dup/1.0.0", [], { $schema: z.literal("dup/1.0.0") })).toThrow(/generates its `\$schema`/);
  });

  it("an unversioned id is a mixin: no version, no tag, no generated field", () => {
    const Mixin = nodeKind("tinted", [], { tint: z.string() });
    expect([Mixin.version, Mixin.tag, "$schema" in Mixin.schema.shape]).toEqual([undefined, undefined, false]);
  });
});

describe("strict kinds — a kind made from a strict schema's shape judges as that schema did", () => {
  const Strict = z.object({ $schema: z.literal("x/v1"), a: z.string() }).strict();
  const kind = nodeKind("x", [], Strict.shape, { strict: true });
  const loose = nodeKind("x-loose", [], Strict.shape);

  it("refuses an undeclared key only when strict", () => {
    const extra = { $schema: "x/v1", a: "y", b: 1 };
    expect(Strict.safeParse(extra).success).toBe(false);
    expect(kind.schema.safeParse(extra).success).toBe(false);
    expect(loose.schema.safeParse(extra).success).toBe(true);
  });

  it("accepts what the schema accepts, and keeps a refinement", () => {
    expect(kind.schema.safeParse({ $schema: "x/v1", a: "y" }).success).toBe(true);
    const refined = nodeKind("x-refined", [], Strict.shape, {
      strict: true,
      refine: (v, ctx) => {
        if (v.a === "bad") ctx.addIssue({ code: "custom", path: ["a"], message: "bad" });
      },
    });
    expect(refined.schema.safeParse({ $schema: "x/v1", a: "bad" }).success).toBe(false);
    expect(refined.schema.safeParse({ $schema: "x/v1", a: "ok", b: 1 }).success).toBe(false);
  });
});
