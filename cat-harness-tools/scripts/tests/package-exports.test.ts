/**
 * `package-exports` — a package's `exports` follow the `code` subgraphs it
 * declares and ships, and the check names each way they can disagree.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { TOOLS_ROOT } from "../lib/roots.ts";
import { packageExports, writePackageExports } from "../package-exports.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A layer declaring `src/` and `test/` as code and `beans/` as beans, shipping `src/` only. */
function fixture(exports: Record<string, string>, files = ["src/"]): string {
  const root = mkdtempSync(join(tmpdir(), "pkg-exports-"));
  dirs.push(root);
  for (const d of ["src", "test", "beans"]) mkdirSync(join(root, d));
  writeDeclaration(root, {
    name: "fixture",
    directories: [
      { id: "fixture-src", path: "src/", graphTypologies: ["code"] },
      { id: "fixture-test", path: "test/", graphTypologies: ["code"] },
      { id: "beans", path: "beans/", graphTypologies: ["beans"] },
    ],
  });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", exports, files }));
  return root;
}

const SRC = { "./src/*.js": "./src/*.ts", "./src/*": "./src/*" };

describe("package-exports", () => {
  test("a declared, shipped code directory is exported; an unshipped one is not", () => {
    const r = packageExports(fixture({ ".": "./src/index.ts", ...SRC }));
    if ("cannotTell" in r) throw new Error(r.cannotTell);
    expect(r.exported).toEqual(["src/"]);
    expect(r.unshipped).toEqual(["test/"]);
    expect(r.drift).toEqual([]);
  });

  test("a missing pattern, a stray pattern and a named entry outside code are each named", () => {
    const r = packageExports(fixture({ "./x": "./beans/x.ts", "./test/*": "./test/*" }));
    if ("cannotTell" in r) throw new Error(r.cannotTell);
    expect(r.drift).toContain("missing ./src/*.js → ./src/*.ts");
    expect(r.drift).toContain("./test/* exports a directory that is not declared code and shipped");
    expect(r.drift.some((d) => d.startsWith("named entry ./x"))).toBe(true);
  });

  test("--write keeps named entries and makes the check pass", () => {
    const root = fixture({ ".": "./src/index.ts" });
    const r = packageExports(root);
    if ("cannotTell" in r) throw new Error(r.cannotTell);
    writePackageExports(root, r.expected);
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).exports).toEqual({ ".": "./src/index.ts", ...SRC });
    const again = packageExports(root);
    expect("cannotTell" in again ? again.cannotTell : again.drift).toEqual([]);
  });

  test("nothing shipped is cannot-tell, never a pass", () => {
    expect(packageExports(fixture({}, []))).toHaveProperty("cannotTell");
  });

  test("this layer's own package.json agrees with its declaration", () => {
    const r = packageExports(TOOLS_ROOT);
    if ("cannotTell" in r) throw new Error(r.cannotTell);
    expect(r.drift).toEqual([]);
    expect(r.exported).toContain("tools/");
  });
});
