import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { walkBlocks, readBlockManifest } from "../../pipeline/qa-utils";
import { loadBlockModuleSync } from "../../pipeline/block-module";
import { TOOLS_ROOT } from "../lib/roots.ts";

/**
 * `walkBlocks` read every block's `kind` and `label` out of its source text
 * with a regex, because it is a synchronous generator and could not `await` an
 * import. `fsl7` filed that as "fine as is **unless a sync loader appears**".
 *
 * One appeared: Bun's `require` loads a TypeScript ES module synchronously, so
 * `loadBlockModuleSync` returns the block the builder actually validated.
 *
 * These tests are the evidence for the repoint, not a description of it. Three
 * fixtures show the textual read giving a different answer from the module —
 * and one of them is a *wrong* answer, not a miss — and two more pin the thing
 * that must not change: importing a module runs it, so verification must not
 * widen which files get executed.
 */

const BUILDERS = JSON.stringify(resolve(TOOLS_ROOT, "schemas", "builders.ts"));

let root: string;
let ch: string;
/** Written by a fixture at import time; its existence proves execution. */
let sideEffect: string;

const write = (name: string, src: string): string => {
  const p = join(ch, name);
  writeFileSync(p, src);
  return p;
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "block-walk-verify-"));
  ch = join(root, "chapter-one");
  mkdirSync(ch, { recursive: true });
  sideEffect = join(root, "EXECUTED");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("loadBlockModuleSync", () => {
  test("loads a block synchronously, with the fields the builder validated", () => {
    const p = write(
      "plain.ts",
      `import { remark } from ${BUILDERS};\n` +
        `export default remark({ label: "rem:plain", title: "T", ` +
        `uses: ["def:a", "def:b"] });\n`,
    );
    const loaded = loadBlockModuleSync(p);
    expect(loaded?.kind).toBe("remark");
    expect(loaded?.label).toBe("rem:plain");
    expect(loaded?.uses).toEqual(["def:a", "def:b"]);
  });

  test("a module whose default export is not a block returns undefined", () => {
    const p = write("not-a-block.ts", `export default { kind: "casserole", label: "x" };\n`);
    expect(loadBlockModuleSync(p)).toBeUndefined();
  });
});

describe("the textual read and the module disagree", () => {
  const labels = (): string[] =>
    [...walkBlocks(root, { verify: true, onLoadFailure: () => {} })]
      .map((b) => b.label)
      .sort();

  test("a computed label is invisible to the regex and found by the loader", () => {
    const p = write(
      "computed-label.ts",
      `import { remark } from ${BUILDERS};\n` +
        `const LBL = "rem:computed";\n` +
        `export default remark({ label: LBL, title: "T" });\n`,
    );
    // No string literal follows `label:`, so the regex finds nothing and the
    // block is yielded by no QA tool at all.
    expect(readBlockManifest(p)).toBeUndefined();
    expect(loadBlockModuleSync(p)?.label).toBe("rem:computed");
    expect(labels()).toContain("rem:computed");
  });

  test("an earlier `label:` makes the regex return the WRONG label", () => {
    const p = write(
      "label-not-first.ts",
      `import { remark } from ${BUILDERS};\n` +
        `const meta = { label: "not-the-block" };\n` +
        `export default remark({ label: "rem:real", title: "T", ` +
        `tags: [meta.label] });\n`,
    );
    // Not a miss — a confident wrong answer, which is what keys a sidecar and a
    // graph node to a label the block does not have.
    expect(readBlockManifest(p)?.label).toBe("not-the-block");
    expect(loadBlockModuleSync(p)?.label).toBe("rem:real");

    const seen = labels();
    expect(seen).toContain("rem:real");
    expect(seen).not.toContain("not-the-block");
  });

  test("a label the schema rejects is reported instead of being yielded as a node", () => {
    const p = write(
      "bad-prefix.ts",
      `import { remark } from ${BUILDERS};\n` +
        `export default remark({ label: "remark:x", title: "T" });\n`,
    );
    // The regex is happy; the builder is not. Today that label becomes a graph
    // node no edge can resolve.
    expect(readBlockManifest(p)?.label).toBe("remark:x");
    expect(() => loadBlockModuleSync(p)).toThrow();

    const failures: string[] = [];
    const seen = [...walkBlocks(root, { verify: true, onLoadFailure: (f) => failures.push(f.file) })];

    expect(failures).toContain(p);
    // Reported, but still walked — dropping it would trade a loud problem for a
    // silent coverage hole.
    expect(seen.map((b) => b.ts)).toContain(p);
    expect(seen.find((b) => b.ts === p)?.label).toBe("remark:x");
  });
});

describe("verification does not widen what gets executed", () => {
  test("a .ts that is not a block manifest is never imported", () => {
    write(
      "helper-with-side-effect.ts",
      `import { writeFileSync } from "fs";\n` +
        `writeFileSync(${JSON.stringify(sideEffect)}, "ran");\n` +
        `export const helper = () => 1;\n`,
    );

    expect(existsSync(sideEffect)).toBe(false);
    const seen = [...walkBlocks(root, { verify: true, onLoadFailure: () => {} })];
    expect(seen.map((b) => b.ts)).not.toContain(join(ch, "helper-with-side-effect.ts"));
    expect(existsSync(sideEffect)).toBe(false);
  });

  test("the #125 shape — a builder inside a template literal — is not imported", () => {
    const marker = join(root, "EXECUTED-125");
    writeFileSync(
      join(ch, "audit-script.ts"),
      `import { writeFileSync } from "fs";\n` +
        `writeFileSync(${JSON.stringify(marker)}, "ran");\n` +
        "const ok = parse(`export default remark({ label: \"rem:x\" });`);\n" +
        `export default ok;\n`,
    );

    const seen = [...walkBlocks(root, { verify: true, onLoadFailure: () => {} })];
    expect(existsSync(marker)).toBe(false);
    expect(seen.map((b) => b.label)).not.toContain("rem:x");
  });
});

describe("verification is the default, and `verify: false` is the escape hatch", () => {
  test("the default verifies", () => {
    const seen = [...walkBlocks(root, { onLoadFailure: () => {} })].map((b) => b.label);
    expect(seen).toContain("rem:real");
    expect(seen).toContain("rem:computed");
    expect(seen).not.toContain("not-the-block");
  });

  test("`verify: false` restores the source-text reading", () => {
    // The wrong label is back and the computed one is missing again. Pinned so
    // the escape hatch is known to actually bypass the loader — a folio without
    // its platform symlink, or a corpus that has not been diffed with
    // `verify-block-walk.ts`, needs a way back.
    const seen = [...walkBlocks(root, { verify: false })].map((b) => b.label);
    expect(seen).toContain("not-the-block");
    expect(seen).not.toContain("rem:computed");
  });
});
