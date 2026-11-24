/**
 * This layer's skill contracts carry `stagingLinks`, copied inline from the
 * canonical shape in cat-harness `schemas/staging-comparison.schema.json`
 * (owner, 2026-10-14: every request for feedback carries its staging links).
 * The canonical file is read from the cat-harness this checkout mounts; where
 * none is mounted, the comparison is skipped and says so.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HERE = import.meta.dir;
const CANON = [resolve(HERE, "../../cat-harness/schemas/staging-comparison.schema.json")].find((p) => existsSync(p));

/** A skill contract, as much of it as these tests read. */
type Contract = {
  properties?: { stagingLinks?: { $ref?: string } };
  definitions?: { stagingLinks?: Record<string, unknown> };
};

function contracts(): { file: string; json: Contract }[] {
  const root = join(HERE, "skills");
  return readdirSync(root).flatMap((skill) =>
    ["input.schema.json", "output.schema.json"]
      .map((f) => join(root, skill, f))
      .filter((f) => existsSync(f))
      .map((file) => ({ file, json: JSON.parse(readFileSync(file, "utf-8")) })),
  );
}

describe("staging links in this layer's skill contracts", () => {
  test("outputContractsCarryStagingLinks", () => {
    const without = contracts()
      .filter((c) => c.file.endsWith("output.schema.json") && c.json?.properties?.stagingLinks === undefined)
      .map((c) => c.file);
    expect(without).toEqual([]);
  });

  // `definitions`, not `$defs`: the contracts declare draft-07, under which
  // `#/$defs/…` does not resolve (cat-harness 0886145). Without this guard a
  // copy left under `$defs` would drop out of the drift check below unseen.
  test("stagingLinksPointInline", () => {
    const dangling = contracts()
      .filter((c) => c.json?.properties?.stagingLinks !== undefined)
      .filter((c) => c.json.properties!.stagingLinks!.$ref !== "#/definitions/stagingLinks" || c.json.definitions?.stagingLinks === undefined)
      .map((c) => c.file);
    expect(dangling).toEqual([]);
  });

  test.skipIf(CANON === undefined)("inlineCopyIsCanonical", () => {
    const { $schema: _s, $id: _i, ...canon } = JSON.parse(readFileSync(CANON!, "utf-8"));
    const drifted = contracts()
      .filter((c) => c.json?.definitions?.stagingLinks !== undefined)
      .filter((c) => {
        const { $comment: _c, ...copy } = c.json.definitions!.stagingLinks!;
        return JSON.stringify(copy) !== JSON.stringify(canon);
      })
      .map((c) => c.file);
    expect(drifted).toEqual([]);
  });
});
