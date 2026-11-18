/**
 * The tests of this file that read the whole checkout (resolves a contract
 * held by folio-assistant-sci) live in `test/skill-contracts-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { contractFile, contractRefProblem, isExternalContract, skillContracts } from "../skill-contracts.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);

describe("a skill names its own contracts (#1168, B3b)", () => {
  test("a local ref is a path inside the instance; an external one is https", () => {
    expect(contractRefProblem("schemas/skills/x/input.schema.json")).toBeUndefined();
    expect(contractRefProblem("https://example.org/x.schema.json")).toBeUndefined();
    expect(contractRefProblem("http://example.org/x.schema.json")).toMatch(/https/);
    expect(contractRefProblem("/abs/x.schema.json")).toMatch(/relative/);
    expect(contractRefProblem("../other/x.schema.json")).toMatch(/inside/);
    expect(contractRefProblem("schemas/skills/x/input.md")).toMatch(/JSON/);
    expect(isExternalContract("https://example.org/x.json")).toBe(true);
    expect(contractFile(INSTANCE, "https://example.org/x.json")).toBeUndefined();
  });

  test("the contracts are found through the skill, not a directory name", () => {
    const c = skillContracts(INSTANCE).get("content-validate");
    expect(c?.input).toBe("schemas/skills/content-validate/input.schema.json");
    expect(c?.from.endsWith("content-validate.md")).toBe(true);
    expect(existsSync(contractFile(INSTANCE, c!.input!)!)).toBe(true);
  });

  test("every declared local contract exists", () => {
    const missing: string[] = [];
    for (const c of skillContracts(INSTANCE).values()) {
      for (const ref of [c.input, c.output]) {
        const f = ref === undefined ? undefined : contractFile(c.instanceRoot, ref);
        if (f !== undefined && !existsSync(f)) missing.push(`${c.from}: ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
