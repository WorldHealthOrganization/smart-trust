/**
 * Every block schema must carry every field of `BlockBaseSchema`.
 *
 * Four kinds — `prose`, `equation`, `diagram`, `table` — used to RESTATE the
 * base fields instead of extending the base, and restating is how they kept
 * losing fields. A Zod object is non-strict, so a block declaring a field its
 * schema had forgotten was accepted at authoring time and the key was
 * SILENTLY STRIPPED: no error, no warning, nothing downstream ever saw it.
 *
 * The history is a sequence of one-field repairs, each of which fixed its
 * field and left the mechanism:
 *
 *   - `EquationBlock` was the only member of the union with neither `uses`
 *     nor a base supplying it; `tags` was in the Zod schema and not the type.
 *   - 2026-08-24 (bean `folio-assistant-5nle`): `authorNotes` granted to all
 *     four by hand, after qou #5115 found five real author notes discarded.
 *   - Measured after that grant: `defines` was still absent from all four,
 *     and `cites`, `simulator` and `computation` from three. One live qou
 *     block was affected — `prose:knot-periodic-table` declared a
 *     `computation` and had it dropped.
 *
 * `defines` was the sharp one: qou's AGENTS.md §4c REQUIRES every glossary
 * term to be declared in `defines[]`, and the `defterm-declared` rule reads
 * that array — so on those four kinds a term could not be declared at all,
 * and the omission was indistinguishable from an authoring choice.
 *
 * This is the same defect `block-kinds.test.ts` exists for, one level down:
 * there, five hand-maintained copies of the kind list each missed the same
 * two kinds and 461 qou blocks went unswept. Restating a set that already
 * exists is the shared cause. That one is guarded by `BLOCK_KINDS` plus a
 * compile-time exhaustiveness assertion; this is the runtime guard for the
 * field set, and it is a runtime one because Zod shapes are values.
 */
import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { BlockBaseSchema, BlockSchema } from "../../schemas/constraints.ts";
import { BLOCK_KINDS } from "../../schemas/types.ts";
import { vocabularies } from "../../schemas/content/vocabulary-modules.ts";

/**
 * `BlockSchema` is `z.discriminatedUnion(...).superRefine(...)`, and its
 * `options` are read directly rather than by importing the sixteen schemas by
 * name, so a kind added later is covered without editing this file.
 *
 * NO UNWRAPPING, and that changed under zod 4. In zod 3 `.superRefine()`
 * returned a `ZodEffects` WRAPPING the union, so this read
 * `.innerType().options` through a structural cast. zod 4 attaches the check
 * to the union itself and returns the same `ZodDiscriminatedUnion`, so
 * `innerType` does not exist and the cast threw at module load —
 * `TypeError: BlockSchema.innerType is not a function`.
 *
 * The cast was the problem, not the upgrade. It asserted a zod INTERNAL, the
 * same class of defect as reading `_def.unknownKeys` to prove strictness two
 * files over. `options` is zod's public accessor on a discriminated union and
 * survives both versions.
 *
 * The runtime checks below are what establish the shape — including the first
 * test, which fails unless every `BLOCK_KINDS` member turns up here.
 */
const builtIn = BlockSchema.options as unknown as z.ZodObject<z.ZodRawShape>[];

/**
 * The schemas a block is actually parsed with: `BlockSchema`'s members and
 * every discovered vocabulary module's (`vocabulary-modules.ts`), a module's
 * taking precedence for a kind both type — exactly `blockSchemaFor`'s rule.
 * Since cat-harness#419 the science layer's kinds are typed by its module, not
 * by `BlockSchema`, so reading the union alone would leave them untested.
 */
const fromModules = vocabularies().flatMap((v) => [...v.schemas.values()]) as unknown as z.ZodObject<z.ZodRawShape>[];

const shapeOf = (schema: z.ZodObject<z.ZodRawShape>) => Object.keys(schema.shape);

const kindOf = (schema: z.ZodObject<z.ZodRawShape>): string => {
  const lit = schema.shape.kind as z.ZodLiteral<string>;
  return lit.value;
};

const moduleKinds = new Set(fromModules.map(kindOf));
const options = [...builtIn.filter((s) => !moduleKinds.has(kindOf(s))), ...fromModules];

describe("block schemas vs BlockBaseSchema", () => {
  test("the union reaches every kind, so nothing escapes the check below", () => {
    // Without this, a kind added to BLOCK_KINDS but typed by neither the union
    // nor a vocabulary module would simply not be tested — the exact way the
    // previous defects survived.
    expect(options.map(kindOf).sort()).toEqual([...BLOCK_KINDS].sort());
  });

  const baseKeys = shapeOf(BlockBaseSchema);

  test("BlockBaseSchema still carries the fields this guard is about", () => {
    // Pins the guard to something falsifiable: if `defines` or `authorNotes`
    // is ever renamed, this fails here rather than passing vacuously.
    for (const key of ["authorNotes", "defines", "cites", "simulator", "computation", "uses"]) {
      expect(baseKeys).toContain(key);
    }
  });

  test.each(options.map((schema) => [kindOf(schema), schema] as const))("%s declares every base field", (_kind, schema) => {
    const keys = new Set(shapeOf(schema));
    const missing = baseKeys.filter((k) => !keys.has(k));
    expect(missing).toEqual([]);
  });
});

describe("the four optional-label kinds accept what they used to drop", () => {
  // Parses rather than inspecting shapes: a field present in the shape but
  // typed wrongly would still drop the value, and the shape check above
  // cannot see that.
  const cases: Array<[string, Record<string, unknown>]> = [
    ["prose", { kind: "prose", label: "prose:x" }],
    ["equation", { kind: "equation", label: "eq:x" }],
    ["diagram", { kind: "diagram", label: "fig:x" }],
    ["table", { kind: "table", label: "tbl:x" }],
  ];

  test.each(cases)("%s", (kind, stub) => {
    const authored = {
      ...stub,
      cites: ["someref2020"],
      defines: ["some-term"],
      authorNotes: [{ kind: "note" as const, body: "kept" }],
      computation: {
        engine: "python" as const,
        script: "computations/x.py",
        status: "not_run" as const,
      },
    };
    const parsed = BlockSchema.parse(authored) as Record<string, unknown>;
    for (const key of ["cites", "defines", "authorNotes", "computation"]) {
      expect(parsed[key]).toBeDefined();
    }
  });
});
