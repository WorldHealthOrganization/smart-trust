/**
 * The content validator had never validated anything, and the two defects
 * concealed each other.
 *
 * Its default target was `join(import.meta.dir, "../objects")` — an
 * import-relative path. A folio embeds folio-assistant as a symlinked
 * subdirectory, so `import.meta.dir` resolves into the PLATFORM tree and the
 * default pointed at `<folio-assistant>/content/objects`, which does not
 * exist. Finding no manifests there was recorded as a `warning` returning
 * `valid: true`, so the CLI printed "✓ Valid — 1 issue(s)" and exited 0.
 *
 * That early return was also the only reason the process survived: Phase 2
 * builds its `ConstraintContext` with `dir`, a name that does not exist in
 * that scope — the parameter is `objectsDir`. Any run reaching a single block
 * threw `ReferenceError: dir is not defined`. It could not be reached, because
 * the empty-corpus path returned first.
 *
 * Neither was visible to `tsc`: `folio/**` is outside the tsconfig program
 * (bean `folio-assistant-tsca`).
 *
 * These pin the invariant that survives both: validating nothing is a
 * FAILURE, and a real corpus reaches Phase 2 without throwing.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { validateObjects } from "../../pipeline/validate";

const DIR = mkdtempSync(join(tmpdir(), "validate-roots-"));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

describe("validateObjects", () => {
  test("an empty directory is INVALID, not valid", () => {
    // Was: `level: "warning"` + `valid: true` — the shape that let the CLI
    // report success over a corpus it never found.
    const empty = join(DIR, "empty");
    mkdirSync(empty, { recursive: true });
    return validateObjects(empty).then((r) => {
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.level === "error")).toBe(true);
      expect(r.issues[0].message).toContain("refusing to report success");
    });
  });

  test("a non-empty flat corpus reaches Phase 2 without throwing", async () => {
    // The regression guard for `ReferenceError: dir is not defined`. The block
    // is deliberately minimal — it will produce validation ISSUES, which is
    // fine and expected; what must not happen is a throw.
    const flat = join(DIR, "flat");
    mkdirSync(flat, { recursive: true });
    writeFileSync(
      join(flat, "a-block.ts"),
      `export default {\n` +
        `  kind: "remark",\n` +
        `  label: "rem:a-block",\n` +
        `  title: "A block",\n` +
        `};\n`,
    );

    const r = await validateObjects(flat);
    // Reached Phase 2 and returned a verdict rather than throwing.
    expect(typeof r.valid).toBe("boolean");
    // And it is NOT the empty-corpus verdict — a block was found.
    expect(r.issues.some((i) => i.message.includes("refusing to report success"))).toBe(false);
  });
});
