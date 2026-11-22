/**
 * A typed vocabulary's module supplies its kinds' schemas and rules; with none,
 * every kind is parsed by `BlockSchema` as before.
 */
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { BlockBaseSchema, BlockSchema, CONSTRAINT_RULES, typedBlockKinds } from "../constraints.ts";
import {
  allConstraintContextContributors,
  allConstraintRules,
  allTypedBlockKinds,
  blockSchemaFor,
  readVocabulary,
  vocabularies,
} from "./vocabulary-modules.ts";

const Widget = BlockBaseSchema.extend({ kind: z.literal("widget"), size: z.number() });
const rule = { id: "widget-size", description: "a widget is small", appliesTo: ["widget"], check: () => null };

describe("readVocabulary holds a module to the contract", () => {
  test("a module typing a declared kind loads, with its rules and builders", () => {
    const v = readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget], constraintRules: [rule], builders: { widget: () => ({}) } }, ["widget"]);
    expect([...v.schemas.keys()]).toEqual(["widget"]);
    expect(v.constraintRules.map((r) => r.id)).toEqual(["widget-size"]);
    expect(Object.keys(v.builders)).toEqual(["widget"]);
  });

  test("it names the module and what is wrong, never types nothing silently", () => {
    expect(() => readVocabulary("gadgets", "g.ts", {}, ["widget"])).toThrow(/g\.ts\) exports no `blockSchemas`/);
    expect(() => readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget] }, [])).toThrow(/types kind "widget", which no block-kind node of "gadgets" declares/);
    expect(() => readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget, Widget] }, ["widget"])).toThrow(/twice/);
    expect(() => readVocabulary("gadgets", "g.ts", { blockSchemas: [z.object({ kind: z.string() })] }, ["widget"])).toThrow(/literal `kind`/);
    expect(() => readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget], constraintContext: {} }, ["widget"])).toThrow(/`constraintContext` that is not a function/);
  });

  test("a module's constraint context contributor is carried, and is absent when it has none (bean saqd)", () => {
    const constraintContext = () => () => ({ widgetSize: 1 });
    expect(readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget], constraintContext }, ["widget"]).constraintContext).toBe(constraintContext);
    expect(readVocabulary("gadgets", "g.ts", { blockSchemas: [Widget] }, ["widget"]).constraintContext).toBeUndefined();
  });
});

describe("composition, in whatever checkout this runs", () => {
  // Which modules are discovered depends on the layers beside cat-harness
  // (the science layer's is, in the index), so these hold for any answer.
  test("every built-in kind stays typed, and a module's kinds are added", () => {
    const all = new Set(allTypedBlockKinds());
    for (const k of typedBlockKinds()) expect(all.has(k)).toBe(true);
    for (const v of vocabularies()) for (const k of v.schemas.keys()) expect(all.has(k)).toBe(true);
  });

  test("a block is parsed by its module's schema when one types its kind, else by BlockSchema", () => {
    for (const v of vocabularies()) for (const [k, s] of v.schemas) expect(blockSchemaFor(k)).toBe(s);
    expect(blockSchemaFor("no-such-kind")).toBe(BlockSchema);
  });

  test("a module's rule replaces a built-in rule with the same id, so no rule runs twice", () => {
    const all = allConstraintRules();
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of CONSTRAINT_RULES) expect(ids).toContain(r.id);
    // Which one wins: for an id a module contributes, the rule that runs is the
    // module's own object; for any other id, the built-in's.
    const contributed = new Map(vocabularies().flatMap((v) => v.constraintRules.map((r) => [r.id, r] as const)));
    const builtIn = new Map(CONSTRAINT_RULES.map((r) => [r.id, r] as const));
    for (const r of all) {
      expect(r).toBe(contributed.get(r.id) ?? builtIn.get(r.id)!);
    }
    for (const r of contributed.values()) expect(all).toContain(r);
  });

  test("every module's constraint context contributor is composed, and only those", () => {
    const expected = vocabularies().flatMap((v) => (v.constraintContext ? [v.constraintContext] : []));
    expect(allConstraintContextContributors()).toEqual(expected);
  });
});
