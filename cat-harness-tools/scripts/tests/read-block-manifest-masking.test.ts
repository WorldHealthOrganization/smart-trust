import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readBlockManifest } from "../../pipeline/qa-utils";

/**
 * `readBlockManifest` decides what counts as a content block. Getting it wrong
 * in the permissive direction is worse than missing a block: an ordinary source
 * file becomes a "block", every per-block checker runs on it, and the results
 * are filed under a label that does not exist.
 *
 * That happened. `pipeline/witness-substitution-audit.ts` carries a
 * self-test containing the literal text of a manifest, and the raw scan yielded
 * that audit script as a block labelled `prop:x`.
 */
describe("readBlockManifest ignores builders and labels inside strings", () => {
  const dir = mkdtempSync(join(tmpdir(), "read-block-manifest-"));
  const write = (name: string, body: string): string => {
    const p = join(dir, name);
    writeFileSync(p, body);
    return p;
  };

  test("a builder call inside a template literal is not a manifest", () => {
    // The exact shape from the corpus: a self-test passing manifest source as
    // a string to the function under test.
    const p = write(
      "audit.ts",
      "import { parseWitnessList } from './x';\n" +
        "const ok = parseWitnessList(`export default proposition({ label: \"prop:x\" });`).length === 0;\n" +
        "console.log(ok);\n",
    );
    expect(readBlockManifest(p)).toBeUndefined();
  });

  test("a builder call inside a comment is not a manifest", () => {
    const p = write(
      "commented.ts",
      "// Usage: export default theorem({ label: \"thm:example\" })\n" +
        "export const helper = 1;\n",
    );
    expect(readBlockManifest(p)).toBeUndefined();
  });

  test("a real manifest still reads, with kind and label", () => {
    const p = write(
      "real.ts",
      'import { proposition } from "../../schema/builders";\n\n' +
        "export default proposition({\n" +
        '  label: "prop:real-one",\n' +
        '  title: "T",\n' +
        "});\n",
    );
    expect(readBlockManifest(p)).toEqual({ kind: "proposition", label: "prop:real-one" });
  });

  test("a decoy label in a comment does not win over the real field", () => {
    const p = write(
      "decoy.ts",
      'import { remark } from "../../schema/builders";\n\n' +
        "export default remark({\n" +
        '  // label: "rem:ghost" was the old id, retired in July\n' +
        '  label: "rem:actual",\n' +
        "});\n",
    );
    expect(readBlockManifest(p)?.label).toBe("rem:actual");
  });

  test("a manifest with no label is not a block", () => {
    const p = write(
      "nolabel.ts",
      'import { remark } from "../../schema/builders";\n' +
        "export default remark({ title: \"T\" });\n",
    );
    expect(readBlockManifest(p)).toBeUndefined();
  });

  test("a missing file is undefined, not a throw", () => {
    expect(readBlockManifest(join(dir, "nope.ts"))).toBeUndefined();
  });

  // Cleanup is best-effort; the temp dir is small and per-run.
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});
