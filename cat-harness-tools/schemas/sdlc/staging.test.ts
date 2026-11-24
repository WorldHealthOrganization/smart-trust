/**
 * Staging links travel with every request for feedback (owner, 2026-10-14;
 * beans u1os, 28k2, g4dv). The shape is defined once, in
 * `staging-comparison.schema.json`, mirrored by `StagingComparisonSchema`, and
 * copied inline as `definitions.stagingLinks` into each skill contract, since a
 * skill contract is read standalone. These tests keep the copies honest.
 *
 * `definitions`, not `$defs`: the contracts declare draft-07, and a reader
 * that follows the declared draft resolves `#/$defs/…` only under 2019-09 and
 * later. Zod's `fromJSONSchema`, which cat-harness-tools' test-run conformance
 * check reads every contract with (bean `319n`), refused all of them while the
 * copies sat under `$defs`.
 */
import { describe, expect, test } from "bun:test";
import { fromJSONSchema } from "zod";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { StagingComparisonSchema } from "./staging";

import { requireHarnessRoot } from "../harness-root.ts";
// The schemas root: the canonical contract and `skills/` stay there.
const HERE = join(requireHarnessRoot(), "schemas");
const canon = JSON.parse(readFileSync(join(HERE, "staging-comparison.schema.json"), "utf-8"));
const { $schema: _s, $id: _i, ...canonDef } = canon;

/** A skill contract, as much of it as these tests read; the rest is JSON Schema handed to zod. */
type Contract = {
  properties?: { stagingLinks?: { $ref?: string } };
  definitions?: { stagingLinks?: Record<string, unknown> };
} & Parameters<typeof fromJSONSchema>[0];

function contracts(): { file: string; json: Contract }[] {
  const root = join(HERE, "skills");
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((skill) =>
    ["input.schema.json", "output.schema.json"]
      .map((f) => join(root, skill, f))
      .filter((f) => existsSync(f))
      .map((file) => ({ file, json: JSON.parse(readFileSync(file, "utf-8")) })),
  );
}

describe("staging links", () => {
  test("the JSON definition and the zod schema name the same fields", () => {
    expect(Object.keys(canon.properties).sort()).toEqual(Object.keys(StagingComparisonSchema.shape).sort());
  });

  test("every skill output contract carries stagingLinks", () => {
    const without = contracts()
      .filter((c) => c.file.endsWith("output.schema.json") && c.json?.properties?.stagingLinks === undefined)
      .map((c) => c.file);
    expect(without).toEqual([]);
  });

  test("every inline copy is the canonical definition", () => {
    const drifted = contracts()
      .filter((c) => c.json?.definitions?.stagingLinks !== undefined)
      .filter((c) => {
        const { $comment: _c, ...copy } = c.json.definitions!.stagingLinks!;
        return JSON.stringify(copy) !== JSON.stringify(canonDef);
      })
      .map((c) => c.file);
    expect(drifted).toEqual([]);
  });

  test("every contract carrying stagingLinks points at its own inline copy", () => {
    const dangling = contracts()
      .filter((c) => c.json?.properties?.stagingLinks !== undefined)
      .filter((c) => c.json.properties!.stagingLinks!.$ref !== "#/definitions/stagingLinks" || c.json.definitions?.stagingLinks === undefined)
      .map((c) => c.file);
    expect(dangling).toEqual([]);
  });

  test("every skill contract reads as JSON Schema under the draft it declares", () => {
    const unreadable = contracts().flatMap((c) => {
      try {
        fromJSONSchema(c.json);
        return [];
      } catch (e) {
        return [`${c.file}: ${(e as Error).message}`];
      }
    });
    expect(unreadable).toEqual([]);
  });
});
