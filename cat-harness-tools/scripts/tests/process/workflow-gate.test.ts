/**
 * The tests of this file that read the whole checkout (reads the content-type
 * processes folio-assistant-core and -sci ship) live in
 * `test/workflow-gate-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  loadRelaxations,
  PolicyError,
} from "../../../src/workflow/gate";

describe("reading the package policy files", () => {
  test("a relaxation with no reason does not load", () => {
    const repo = mkdtempSync(join(tmpdir(), "policy-"));
    mkdirSync(join(repo, "skills", "pkg"), { recursive: true });
    // A PACKAGE HOLDS A SKILL. The policy files are read from the packages
    // discovery finds, and a directory holding no skill is not one (bean 9umr).
    writeFileSync(join(repo, "skills", "pkg", "a-skill.md"), "# A skill\n");
    writeFileSync(
      join(repo, "skills", "pkg", "workflow-policy.json"),
      JSON.stringify({ relaxations: [{ process: "Process_Editing", activity: "Task_SmeReview" }] }),
    );
    // An unexplained relaxation is a loophole, not a policy.
    expect(() => loadRelaxations(repo)).toThrow(PolicyError);
    expect(() => loadRelaxations(repo)).toThrow(/reason/);
    rmSync(repo, { recursive: true, force: true });
  });

  test("a policy file claiming to be a different package does not load", () => {
    const repo = mkdtempSync(join(tmpdir(), "policy-"));
    mkdirSync(join(repo, "skills", "pkg"), { recursive: true });
    // A PACKAGE HOLDS A SKILL. The policy files are read from the packages
    // discovery finds, and a directory holding no skill is not one (bean 9umr).
    writeFileSync(join(repo, "skills", "pkg", "a-skill.md"), "# A skill\n");
    writeFileSync(
      join(repo, "skills", "pkg", "workflow-policy.json"),
      JSON.stringify({ package: "somewhere-else", relaxations: [] }),
    );
    expect(() => loadRelaxations(repo)).toThrow(/declares package/);
    rmSync(repo, { recursive: true, force: true });
  });

  test("a package with no policy file relaxes nothing", () => {
    const repo = mkdtempSync(join(tmpdir(), "policy-"));
    mkdirSync(join(repo, "skills", "quiet"), { recursive: true });
    expect(loadRelaxations(repo)).toEqual([]);
    rmSync(repo, { recursive: true, force: true });
  });
});
