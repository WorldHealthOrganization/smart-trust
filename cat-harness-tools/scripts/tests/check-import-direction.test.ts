/**
 * `check:import-direction` — tested with PLANTED violations, because a boundary
 * check never seen failing checks nothing (`4j3h`, `q2wn`, `p11x`).
 *
 * The fixture is a checkout of four layers: `low` needs nothing, `high`
 * needs `low`, `side` is a sibling of `low` (also needs nothing), and `odd`
 * declares no `needs` at all. Every edge kind the gate distinguishes is planted
 * once, alongside the look-alikes it must NOT count.
 *
 * The tests of this file that read the whole checkout (reads every layer's
 * declaration and code in the checkout) live in
 * `test/check-import-direction-checkout.test.ts` (bean `7zz1`): standing
 * alone, cat-harness has none of it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { analyse, readInstances, type ImportDirectionReport } from "../check-import-direction.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

let tmp: string;
let r: ImportDirectionReport;

function put(rel: string, body: string): void {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

function instance(name: string, needs?: string[]): void {
  put(`${name}/${name}.json`, JSON.stringify(needs === undefined ? { name } : { name, needs }));
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "import-direction-"));
  instance("low", []);
  instance("side", []);
  instance("high", ["low"]);
  instance("odd");

  put("low/x.ts", "export const x = 1;\n");
  put("side/s.ts", "export const s = 1;\n");
  put("high/y.ts", "export const y = 1;\n");

  // Allowed: down the arrow, and within one layer.
  put("high/ok.ts", 'import { x } from "../low/x.ts";\nimport { y } from "./y.ts";\nexport { x, y };\n');
  // Wrong-direction: up the arrow, by static import and by re-export.
  put("low/up.ts", 'import { y } from "../high/y.ts";\nexport * from "../high/y.ts";\nexport { y };\n');
  // Wrong-direction: a sibling this layer does not declare needing.
  put("low/sibling.ts", 'import { s } from "../side/s.ts";\nexport { s };\n');
  // Wrong-direction: the `builtin-adapters.ts` shape — a module path handed to a variable import.
  put("low/src/table.ts", 'export const T = [{ module: "../high/y.ts" }];\nexport const load = (p: string) => import(p);\n');
  // NOT counted: a docblock quoting an import, and a `../` literal naming no layer.
  put("low/quiet.ts", '/** import { y } from "../high/y.ts"; */\n// require("../high/y.ts")\nexport const p = "../fixtures/x.ts";\n');
  // By PACKAGE name: wrong-direction up to `high`, allowed down to `low`, and a
  // third-party package skipped (bean `7pvn`).
  put("high/package.json", JSON.stringify({ name: "@fx/high" }));
  put("low/package.json", JSON.stringify({ name: "@fx/low" }));
  put("low/pkg-up.ts", 'import { y } from "@fx/high/y.js";\nimport { z } from "zod";\nexport { y, z };\n');
  put("high/pkg-down.ts", 'import { x } from "@fx/low/x.js";\nexport { x };\n');
  // Undetermined: an importer whose layer declares no `needs`.
  put("odd/o.ts", 'import { x } from "../low/x.ts";\nexport { x };\n');

  r = analyse(tmp);
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("check:import-direction", () => {
  test("finds every planted wrong-direction edge, and only those", () => {
    const wrong = r.findings.filter((f) => f.verdict === "wrong-direction").map((f) => `${f.file} ${f.via} → ${f.toInstance}`);
    expect(wrong.sort()).toEqual(
      [
        "low/up.ts specifier → high",
        "low/sibling.ts specifier → side",
        "low/pkg-up.ts specifier → high",
        "low/src/table.ts module-path-literal → high",
      ].sort(),
    );
  });

  test("a re-export of the same specifier is one finding, not two", () => {
    expect(r.findings.filter((f) => f.file === "low/up.ts")).toHaveLength(1);
  });

  test("down the arrow and within an instance is allowed", () => {
    expect(r.findings.some((f) => f.file === "high/ok.ts")).toBe(false);
  });

  test("an undeclared `needs` is UNDETERMINED — never clean, never wrong", () => {
    expect(r.undeclaredNeeds).toEqual(["odd"]);
    const odd = r.findings.filter((f) => f.fromInstance === "odd");
    expect(odd.map((f) => f.verdict)).toEqual(["undetermined"]);
  });

  test("a variable `import(expr)` is reported as could-not-determine", () => {
    expect(r.variableSpecifiers).toEqual([{ file: "low/src/table.ts", count: 1 }]);
  });

  test("comments and instance-less `../` literals are not imports", () => {
    expect(r.findings.some((f) => f.file === "low/quiet.ts")).toBe(false);
  });

  test("the planted edges disappear when `low` declares what it reaches", () => {
    // The allowed set is read from `needs`, never from a list in the gate:
    // declaring the sibling makes that edge legal without an edit to the check.
    instance("low", ["side"]);
    try {
      const again = analyse(tmp);
      expect(again.findings.some((f) => f.file === "low/sibling.ts")).toBe(false);
      expect(again.findings.some((f) => f.file === "low/up.ts")).toBe(true);
    } finally {
      instance("low", []);
    }
  });
});

/**
 * The split's boundary (bean `pyds`, stage 0): `cat-harness` must not load
 * `cat-harness-tools`, which is built on it. The fixture copies the REAL `needs`
 * of the four layers involved, so the test goes red if either declaration
 * drifts — and plants the import in a scratch tree, never in this checkout.
 */
describe("check:import-direction — the cat-harness / cat-harness-tools boundary", () => {
  const REAL = ["bootstrap", "bootstrap-tools", "cat-harness", "cat-harness-tools"];
  let split: string;
  let report: ImportDirectionReport;

  beforeAll(() => {
    const repo = join(dirname(HARNESS_ROOT));
    const needs = new Map(readInstances(repo).map((i) => [i.name, i.needs]));
    split = mkdtempSync(join(tmpdir(), "import-direction-split-"));
    for (const name of REAL) {
      const p = join(split, name, `${name}.json`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ name, needs: needs.get(name) }));
    }
    const plant = (rel: string, body: string) => {
      mkdirSync(dirname(join(split, rel)), { recursive: true });
      writeFileSync(join(split, rel), body);
    };
    plant("cat-harness/src/core.ts", "export const core = 1;\n");
    plant("cat-harness-tools/src/server.ts", 'import { core } from "../../cat-harness/src/core.ts";\nexport { core };\n');
    plant("cat-harness/src/planted.ts", 'import { core } from "../../cat-harness-tools/src/server.ts";\nexport { core };\n');
    report = analyse(split);
  });

  afterAll(() => rmSync(split, { recursive: true, force: true }));

  test("a planted cat-harness → cat-harness-tools import is wrong-direction", () => {
    const wrong = report.findings.filter((f) => f.verdict === "wrong-direction");
    expect(wrong.map((f) => `${f.file} → ${f.toInstance}`)).toEqual(["cat-harness/src/planted.ts → cat-harness-tools"]);
  });
});
