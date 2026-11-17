/**
 * `skill-contracts` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/skill-contracts.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each resolves a contract held by
 * folio-assistant-sci, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { contractFile, skillContracts } from "../../scripts/skill-contracts.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = resolve(ORIGIN_DIR, "../..");

describe("a skill names its own contracts (#1168, B3b)", () => {

  test("a local contract resolves against the instance HOLDING the skill (placement PR1)", () => {
    // `latex-authoring` moved up to sci with its `schemas/skills/` contract.
    // Resolved against the harness the ref names a file that is not there.
    const c = skillContracts(INSTANCE).get("latex-authoring");
    expect(c?.input).toBe("schemas/skills/latex-authoring/input.schema.json");
    expect(c?.instanceRoot).toBe(resolve(INSTANCE, "..", "folio-assistant-sci"));
    expect(existsSync(contractFile(c!.instanceRoot, c!.input!)!)).toBe(true);
    expect(existsSync(contractFile(INSTANCE, c!.input!)!)).toBe(false);
  });
});
