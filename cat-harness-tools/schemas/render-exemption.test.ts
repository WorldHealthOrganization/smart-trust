/**
 * The rendering exemption, as the QA axis's checker reads it.
 *
 * @module cat-harness-tools/schemas/render-exemption.test
 *
 * Moved here from `cat-harness/schemas/render-exemption.test.ts` (bean `7zz1`
 * follow-up; owner, 2026-10-06: a test reading an upper layer's files moves to
 * that layer's declared test home). The test reads
 * `cat-harness-tools/scripts/check-instance-render.ts`, a file of THIS layer,
 * so standing alone cat-harness cannot hold it. The rest of that file's tests
 * — the declaration, the malformations, the closed set — stay with the schema
 * they test. Every path here is composed from ORIGIN_DIR, the directory the
 * test was written in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { repoRootFor } from "./kg/cat-harness.js";

/** The directory this test was written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing it reads changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../cat-harness/schemas");

const ROOT = resolve(ORIGIN_DIR, "..");
const REPO = repoRootFor(ROOT);

describe("isExemptFrom is what the QA axis calls", () => {
  test("the axis reads the DECLARATION, not an instance name", () => {
    // Guarded because the obvious shortcut is `if (name === "bootstrap")`,
    // which states a rule true only for the layer somebody remembered —
    // and a vendored or renamed bootstrap would silently reacquire the
    // obligation it was excused from.
    const checker = readFileSync(join(REPO, "cat-harness-tools", "scripts", "check-instance-render.ts"), "utf-8");
    expect(checker).toContain("renderExemptionProblems");
    expect(checker).not.toContain('=== "bootstrap"');
  });
});
