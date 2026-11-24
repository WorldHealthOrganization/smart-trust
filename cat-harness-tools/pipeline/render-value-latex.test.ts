/**
 * `:val[name]` — a witnessed value — renders as the witness's number in the
 * PDF, in prose AND inside math. Nothing tested this until 2026-09-30, and
 * prose was broken for every name containing `_`: the directive's name was
 * taken from its LaTeX-ESCAPED children, so `inv_alpha` was looked up as
 * `inv\_alpha`, missed, and the directive was printed literally. Every name
 * qou's registry uses contains an underscore; 14 of its 62 uses are in prose.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { configureValueRegistry, type WitnessedValueEntry } from "./value-registry-di";
import { markdownToLatex } from "./render-latex";

const dir = mkdtempSync(join(tmpdir(), "val-latex-"));
const witness = join(dir, "demo.witness.json");

const entry = (name: string): WitnessedValueEntry => ({
  name,
  description: "test value",
  symbol: "x",
  witnessFile: witness,
  witnessPath: "data.value",
  defaultPrecision: 6,
  units: null,
});

beforeAll(() => {
  writeFileSync(witness, JSON.stringify({ data: { value: 137.035999084 } }));
  const reg: Record<string, WitnessedValueEntry> = { inv_alpha: entry("inv_alpha"), invalpha: entry("invalpha") };
  configureValueRegistry({
    WITNESSED_VALUES: reg,
    lookupValue: (n) => reg[n],
    verifiedNames: () => Object.keys(reg),
  });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe(":val in the LaTeX render", () => {
  test("inside math, a name with an underscore resolves", () => {
    expect(markdownToLatex("A $x = :val[inv_alpha]$ B.")).toContain("137.036");
  });

  test("in prose, a name with an underscore resolves (was printed literally)", () => {
    const out = markdownToLatex("A :val[inv_alpha] B.");
    expect(out).toContain("137.036");
    expect(out).not.toContain(":val[");
  });

  test("in prose, a name without an underscore resolves", () => {
    expect(markdownToLatex("A :val[invalpha] B.")).toContain("137.036");
  });

  test("attributes still apply in prose (precision = significant digits)", () => {
    expect(markdownToLatex("A :val[inv_alpha]{precision=4} B.")).toContain("$137.0$");
    expect(markdownToLatex("A :val[inv_alpha]{precision=3} B.")).toContain("$137$");
  });
});
