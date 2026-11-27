/**
 * `check:tools` reports a Tool declared INLINE rather than in its folder —
 * bean `tdir`.
 *
 * @module scripts/tests/check-tools-inline.test
 *
 * A scratch tools directory holding one Tool the convention's way
 * (`folder-tool/folder-tool.ts`) and one barrel that declares a Tool itself.
 * Only the barrel is a finding: a folder Tool's `defineTool(` is where it
 * belongs, and a barrel that only re-exports is not one.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { declaredToolsDirs, inlineToolFindings } from "../../check-tools.js";

describe("inline Tool declarations are a finding", () => {
  test("the barrel is reported, the folder Tool is not", () => {
    const root = mkdtempSync(join(tmpdir(), "inline-tools-"));
    try {
      const dir = join(root, "tools");
      mkdirSync(join(dir, "folder-tool"), { recursive: true });
      writeFileSync(
        join(dir, "folder-tool", "folder-tool.ts"),
        'export default toolFactory((t) => defineTool({ id: "folder-tool" }));\n',
      );
      writeFileSync(join(dir, "index.ts"), 'export const inline = defineTool({ id: "inline-tool" });\n');
      writeFileSync(join(dir, "lib.ts"), "export const helper = 1;\n");
      writeFileSync(join(dir, "index.test.ts"), "defineTool({});\n");
      const found = inlineToolFindings([{ instance: "scratch", dir }], root);
      expect(found).toEqual([{ instance: "scratch", file: join("tools", "index.ts") }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an absent tools directory is no finding and no crash", () => {
    expect(inlineToolFindings([{ instance: "none", dir: join(tmpdir(), "inline-tools-absent-dir") }])).toEqual([]);
  });

  test("every declared tools directory in this checkout is asked", () => {
    // The vacuity guard: a finder over no directories reports none.
    expect(declaredToolsDirs().length).toBeGreaterThan(0);
  });
});
