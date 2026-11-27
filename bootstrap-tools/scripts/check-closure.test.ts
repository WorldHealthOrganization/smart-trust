/**
 * The closure gate, tested with PLANTED violations: a boundary check that has
 * never been seen failing is not known to check anything (`4j3h`, `q2wn`).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkClosure, importClosure, specifiersOf } from "./check-closure.ts";

function pkg(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "bt-closure-"));
  const root = join(dir, "bootstrap-tools");
  mkdirSync(join(root, "schemas"), { recursive: true });
  mkdirSync(join(dir, "above"), { recursive: true });
  writeFileSync(join(dir, "above", "x.ts"), "export const x = 1;\n");
  for (const [p, src] of Object.entries(files)) writeFileSync(join(root, p), src);
  return root;
}

describe("check-closure", () => {
  test("ownFilesZodBuiltinsPass", () => {
    const root = pkg({
      "schemas/a.ts": 'import { z } from "zod";\nimport { join } from "node:path";\nexport const a = z.string();\n',
      "schemas/b.ts": 'import { a } from "./a.ts";\nexport { a };\n',
    });
    expect(checkClosure(root)).toEqual([]);
  });

  test("relativeImportOutsideFails", () => {
    const root = pkg({ "schemas/a.ts": 'import { x } from "../../above/x.ts";\n' });
    expect(checkClosure(root).map((f) => f.why)).toEqual(["leaves bootstrap-tools (../above/x.ts)"]);
  });

  test("onlyAllowedPackagesPass", () => {
    const root = pkg({
      "schemas/a.ts": 'import { Liquid } from "liquidjs";\nimport _ from "lodash";\nimport { chromium } from "@playwright/test";\n',
      "schemas/a.test.ts": 'import { test } from "bun:test";\nimport Ajv from "ajv";\nimport x from "playwright";\n',
    });
    expect(checkClosure(root).map((f) => `${f.file} ${f.specifier}`).sort()).toEqual([
      "schemas/a.test.ts playwright",
      "schemas/a.ts lodash",
    ]);
  });

  test("commentImportIgnored", () => {
    expect(specifiersOf('/** import { x } from "../../above/x.ts"; */\n// import "y";\nexport const q = 1;\n')).toEqual([]);
    expect(specifiersOf('export { a } from "./a.ts";\nconst m = await import("./b.ts");\n').sort()).toEqual(["./a.ts", "./b.ts"]);
  });
});

describe("strings are data, not imports", () => {
  test("stringImportIgnored", () => {
    expect(specifiersOf('const src = \'import { x } from "../../above/x.ts";\';\nconst t = `await import("./b.ts")`;\n')).toEqual([]);
  });
});

/**
 * THE closure walker (owner, 2026-10-24: one walker, the gate and a mount
 * share it). Each case is one thing a caller relies on and that a shallower
 * walk would get wrong.
 */
describe("importClosure: the transitive walk", () => {
  function tree(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "bt-walk-"));
    for (const [p, src] of Object.entries(files)) {
      mkdirSync(join(dir, p, ".."), { recursive: true });
      writeFileSync(join(dir, p), src);
    }
    return dir;
  }

  test("followsRelativeImports", () => {
    const d = tree({
      "a/entry.ts": 'import { b } from "../b/b.js";\nexport const e = b;\n',
      "b/b.ts": 'import data from "./data.json";\nexport { c } from "../c/index.ts";\nexport const b = data;\n',
      "b/data.json": "{}\n",
      "c/index.ts": "export const c = 1;\n",
      "c/unreached.ts": "export const u = 1;\n",
    });
    const r = importClosure([join(d, "a/entry.ts")]);
    expect(r.files.map((f) => f.slice(d.length + 1))).toEqual(["a/entry.ts", "b/b.ts", "b/data.json", "c/index.ts"]);
    expect(r.unresolved).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  test("bareImportExternalUnlessMapped", () => {
    const d = tree({
      "app/main.ts": 'import { z } from "zod";\nimport { s } from "@fx/lib/s.js";\nimport { g } from "@fx/lib/gone.js";\n',
      "lib/s.ts": 'import { t } from "./t.ts";\nexport const s = t;\n',
      "lib/t.ts": "export const t = 1;\n",
    });
    const r = importClosure([join(d, "app/main.ts")], {
      resolveBare: (spec) => (spec.startsWith("@fx/lib/") ? join(d, "lib", spec.slice("@fx/lib/".length).replace(/\.js$/, ".ts")) : undefined),
    });
    expect(r.files.map((f) => f.slice(d.length + 1))).toEqual(["app/main.ts", "lib/s.ts", "lib/t.ts"]);
    expect(r.external.map((e) => e.specifier)).toEqual(["zod"]);
    expect(r.unresolved.map((e) => e.specifier)).toEqual(["@fx/lib/gone.js"]);
  });

  test("reportsUnresolvedImports", () => {
    const d = tree({ "m.ts": 'import "./nope.ts";\nconst p = "./x.ts";\nawait import(p);\n' });
    const r = importClosure([join(d, "m.ts"), join(d, "absent.ts")]);
    expect(r.unresolved.map((e) => e.specifier)).toEqual(["./nope.ts"]);
    expect(r.missing).toEqual([join(d, "absent.ts")]);
    expect(r.computed).toEqual([join(d, "m.ts")]);
  });

  test("followAndDeclaredEdges", () => {
    const d = tree({
      "in/a.ts": 'import { o } from "../out/o.ts";\n',
      "out/o.ts": 'import "./deeper.ts";\n',
      "out/deeper.ts": "",
      "in/loader.ts": "export const load = (p: string) => import(p);\n",
      "in/plugin.ts": "export const plugin = 1;\n",
    });
    const inside = (p: string) => p.startsWith(join(d, "in"));
    const r = importClosure([join(d, "in/a.ts")], { follow: inside });
    expect(r.files.map((f) => f.slice(d.length + 1))).toEqual(["in/a.ts", "out/o.ts"]);
    const l = importClosure([join(d, "in/loader.ts")], { declaredEdges: (f) => (f.endsWith("loader.ts") ? [join(d, "in/plugin.ts")] : []) });
    expect(l.files.map((f) => f.slice(d.length + 1))).toEqual(["in/loader.ts", "in/plugin.ts"]);
  });

  test("readsThroughHost", () => {
    const files: Record<string, string> = { "/v/a.ts": 'import "./b.js";\n', "/v/b.ts": "" };
    const r = importClosure(["/v/a.ts"], { host: { isFile: (p) => p in files, read: (p) => files[p]! } });
    expect(r.files).toEqual(["/v/a.ts", "/v/b.ts"]);
    expect(r.edges).toEqual([{ from: "/v/a.ts", specifier: "./b.js", kind: "relative", to: "/v/b.ts" }]);
  });
});
