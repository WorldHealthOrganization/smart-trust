/**
 * A Liquid value reference is validated by the same rules as a `:val` one
 * (bean `kott`). Without this, moving a folio from `:val` to Liquid removed
 * its validation: a broken reference surfaced only as `⟦unresolved⟧` in the
 * rendered output, never as an issue.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeDeclaration } from "../test/support/instance-fixture";
import { buildValueScope, type ValueScope } from "./liquid-values";
import { extractLiquidOccurrences, validateValueDirectives } from "./validate-value";
import type { Block } from "../schemas/types.ts";

let repo: string;
let scope: ValueScope;
const WITNESS = "demo/computations/masses.witness.json";

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "validate-liquid-"));
  const demo = join(repo, "demo");
  mkdirSync(join(demo, "computations"), { recursive: true });
  writeFileSync(join(demo, "computations", "masses.witness.json"), JSON.stringify({ data: { m: "0.51099895069" } }));
  mkdirSync(join(demo, "library", "codata"), { recursive: true });
  writeFileSync(join(demo, "library", "codata", "values.json"), JSON.stringify({ c: { value: "299792458", uncertainty: null } }));
  writeDeclaration(demo, {
    name: "demo",
    directories: [
      { id: "computations", path: "computations/", graphTypologies: ["code"] },
      { id: "library", path: "library/", graphTypologies: ["library"] },
    ],
  });
  scope = buildValueScope(repo);
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

const run = (md: string, block: Partial<Block> = {}) =>
  validateValueDirectives(new Map([["b", { block: { kind: "definition", ...block } as Block, md }]]), { scope });
const rules = (md: string, block?: Partial<Block>) => run(md, block).map((i) => i.message.match(/^\[([a-z-]+)\]/)![1]);

describe("Liquid references are validated like :val ones", () => {
  test("occurrences are found with their filters", () => {
    expect(extractLiquidOccurrences("x {{ demo.computations.masses.data.m | precision: 3 }} y")).toEqual([
      { key: "demo.computations.masses.data.m", filters: "| precision: 3 " },
    ]);
  });

  test("an unresolved reference is an ERROR, with the resolver's reason", () => {
    const issues = run("{{ demo.computations.masses.data.nope }}");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe("error");
    expect(issues[0]!.message).toContain("[val-resolves]");
    expect(issues[0]!.message).toContain('no scalar at "data.nope"');
  });

  test("precision beyond the source's digits is an error, as for :val", () => {
    expect(rules("{{ demo.computations.masses.data.m | precision: 12 }}", { computation: { witness: WITNESS } } as never)).toEqual(["val-precision-bounded"]);
    expect(rules("{{ demo.computations.masses.data.m | precision: 11 }}", { computation: { witness: WITNESS } } as never)).toEqual([]);
  });

  test("an unknown filter is an error", () => {
    expect(rules("{{ demo.computations.masses.data.m | rounded }}", { computation: { witness: WITNESS } } as never)).toEqual(["val-filter"]);
  });

  test("a witness it reads counts toward the computation auto-link", () => {
    const issues = run("{{ demo.computations.masses.data.m | precision: 6 }}");
    expect(issues.map((i) => i.message)).toEqual([
      `[val-block-computation] block cites a witnessed value but has no \`computation:\` field; implicit witness dep on ${WITNESS}`,
    ]);
  });

  test("a dataset value is not a computation, so it asks for no link", () => {
    expect(run("c = {{ demo.library.codata.c }}")).toEqual([]);
  });

  test("site.* and page.* are Jekyll's, and are left alone", () => {
    expect(run("{{ site.data.fhir.ig.version }} {{ page.title }}")).toEqual([]);
  });
});
