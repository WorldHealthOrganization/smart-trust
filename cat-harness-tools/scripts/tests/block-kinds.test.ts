/**
 * `schemas/types.ts` defines the block discriminated union `Block` with 15
 * members. Five independent, hand-maintained lists enumerated those kinds, and
 * every one of them carried the same 13: `algorithm` and `table` were added to
 * the union and never propagated.
 *
 * The consequence was silent and large. `readBlockManifest` returns
 * `undefined` for an unrecognised builder, and `walkBlocks` skips whatever it
 * returns `undefined` for — so on the qou corpus 461 blocks (445 `table`, 16
 * `algorithm`) were never yielded to any QA tool. Never swept, never audited,
 * mostly without a sidecar at all. Roughly 13% of the corpus, excluded by a
 * stale regex rather than by a decision, and nothing reported a problem
 * because "not a block" and "a block with nothing wrong" are indistinguishable
 * downstream.
 *
 * `BLOCK_KINDS` is now the single runtime list, with a compile-time
 * exhaustiveness assertion against `Block["kind"]` in `schemas/types.ts` (that
 * one fails `tsc`, verified by deleting a member). These cover the consumers,
 * where the check has to be a runtime one: the viewer registry carries
 * per-kind metadata and types `kind` as `string`, so there are no literals for
 * the compiler to compare.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { BLOCK_KINDS, BLOCK_KIND_ALT } from "../../schemas/types.ts";
import { readBlockManifest } from "../../pipeline/qa-utils";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { registry } from "../../src/blocks/registry";

const DIR = mkdtempSync(join(tmpdir(), "block-kinds-"));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

describe("BLOCK_KINDS", () => {
  test("carries the two kinds whose omission caused this", () => {
    expect(BLOCK_KINDS).toContain("algorithm");
    expect(BLOCK_KINDS).toContain("table");
  });

  test("has no duplicates", () => {
    expect(new Set(BLOCK_KINDS).size).toBe(BLOCK_KINDS.length);
  });

  test("excludes container kinds", () => {
    // `chapter`, `paper` and `folio` are not blocks. `readBlockManifest` is
    // documented to return undefined for them, and would start accepting them
    // if they leaked into the union.
    for (const container of ["chapter", "paper", "folio"]) {
      expect(BLOCK_KINDS as readonly string[]).not.toContain(container);
    }
  });

  test("the alternation matches the list", () => {
    expect(BLOCK_KIND_ALT.split("|")).toEqual([...BLOCK_KINDS]);
  });
});

describe("readBlockManifest recognises every kind", () => {
  test.each([...BLOCK_KINDS])("%s", (kind) => {
    const p = join(DIR, `${kind}.ts`);
    writeFileSync(
      p,
      `import { ${kind} } from "../../schema/builders";\n` +
        `export default ${kind}({\n  label: "${kind}:x",\n  title: "T",\n});\n`,
    );
    expect(readBlockManifest(p)).toEqual({ kind, label: `${kind}:x` });
  });

  test("still rejects a chapter manifest", () => {
    const p = join(DIR, `ch.ts`);
    writeFileSync(p, `export default chapter({\n  label: "ch:x",\n});\n`);
    expect(readBlockManifest(p)).toBeUndefined();
  });
});

describe("viewer registry", () => {
  test("registers a renderer for every schema block kind", () => {
    // Was missing `algorithm` and `table`, so neither could render.
    const missing = BLOCK_KINDS.filter((k) => !registry.has(k));
    expect(missing).toEqual([]);
  });
});
