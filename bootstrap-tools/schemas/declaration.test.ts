import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_OUTPUT_DIRS, knowledgeGraphsIn } from "./declaration.ts";

describe("knowledgeGraphsIn", () => {
  test("skipsBuildOutputDirectory", () => {
    const root = mkdtempSync(join(tmpdir(), "kg-scan-"));
    for (const d of BUILD_OUTPUT_DIRS) {
      mkdirSync(join(root, d));
      // Named like a declaration but invalid: reading it would throw.
      writeFileSync(join(root, d, `${d}.json`), `{"name": "${d}"}`);
    }
    expect(knowledgeGraphsIn(root)).toEqual([]);
  });
});
