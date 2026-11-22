/**
 * `affected-tests.ts`: which test files a change reaches through relative
 * imports, and when the answer is all of them.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { affectedTests, testFilesUnder, testPreloads } from "../affected-tests.ts";

let root: string;
const put = (files: Record<string, string>) => {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "affected-"));
  put({
    "src/a.ts": "export const a = 1;\n",
    "src/b.ts": 'import { a } from "./a.ts";\nexport const b = a + 1;\n',
    "src/c.ts": "export const c = 3;\n",
    "src/data.json": "{}\n",
    "test/b.test.ts": 'import { b } from "../src/b.ts";\n',
    "test/c.test.ts": 'import { c } from "../src/c";\nimport d from "../src/data.json";\n',
    "test/pkg.spec.ts": 'import { z } from "zod";\n',
    "node_modules/x/x.test.ts": "",
    "bunfig.toml": '[test]\npreload = ["./test/setup.ts"]\n',
    "test/setup.ts": "",
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("affectedTests", () => {
  test("finds every test file bun would run, not node_modules", () => {
    expect(testFilesUnder(root)).toEqual(["test/b.test.ts", "test/c.test.ts", "test/pkg.spec.ts"]);
    expect(testPreloads(root)).toEqual(["test/setup.ts"]);
  });
  test("a change reaches the tests whose closure holds it, transitively", () => {
    const s = affectedTests(root, ["src/a.ts"]);
    expect(s).toEqual({ kind: "some", files: ["test/b.test.ts"], why: { "test/b.test.ts": "imports src/a.ts" } });
  });
  test("an imported JSON file is in the closure; a bare package import is not", () => {
    expect(affectedTests(root, ["src/data.json"])).toMatchObject({ files: ["test/c.test.ts"] });
    expect(affectedTests(root, ["README.md"])).toMatchObject({ files: [] });
  });
  test("a changed test file selects itself", () => {
    expect(affectedTests(root, ["test/pkg.spec.ts"])).toMatchObject({ files: ["test/pkg.spec.ts"] });
  });
  test("a change to what every test runs under selects them all", () => {
    expect(affectedTests(root, ["bun.lock"]).kind).toBe("all");
    expect(affectedTests(root, ["package.json"]).kind).toBe("all");
    expect(affectedTests(root, ["test/setup.ts"]).kind).toBe("all");
  });
  test("a computed or unresolvable import is walked past: literal edges still count, the hidden one does not select", () => {
    put({
      "src/hub.ts": 'import { c } from "./c.ts";\nexport const load = (m: string) => import(m);\nimport { q } from "./missing.ts";\n',
      "test/hub.test.ts": 'import { load } from "../src/hub.ts";\n',
    });
    expect(affectedTests(root, ["src/c.ts"])).toMatchObject({ files: ["test/c.test.ts", "test/hub.test.ts"] });
    expect(affectedTests(root, ["src/a.ts"])).toMatchObject({ files: ["test/b.test.ts"] });
  });
});
