/**
 * A library names a directory of ANOTHER kind from within — cat-harness-tools#281.
 *
 * `library/library.json` (`concern-groups/v1`) may declare `directories`, the
 * #980 shape `check:layout-norms` sanctions. `nonEntryDirs` read only the root
 * declaration, so such a directory was graded as an L1 entry missing its
 * manifest, sections and blocks.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { nonEntryDirs } from "../../lib/library-entry-graphs.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("nonEntryDirs", () => {
  test("a directory the library declares from within, of another kind, is not an entry", () => {
    const root = mkdtempSync(join(tmpdir(), "nonentry-"));
    roots.push(root);
    writeDeclaration(root, {
      name: "fixture",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    const lib = join(root, "library");
    mkdirSync(join(lib, "a-model"), { recursive: true });
    mkdirSync(join(lib, "a-document"), { recursive: true });
    writeFileSync(
      join(lib, "library.json"),
      JSON.stringify({
        $schema: "concern-groups/v1",
        groups: [],
        directories: [{ id: "a-model", path: "a-model/", subgraph: true, graphTypologies: ["archimate"] }],
      }),
    );
    const others = nonEntryDirs(lib);
    expect(others.has(join(lib, "a-model"))).toBe(true);
    expect(others.has(join(lib, "a-document"))).toBe(false);
  });
});
