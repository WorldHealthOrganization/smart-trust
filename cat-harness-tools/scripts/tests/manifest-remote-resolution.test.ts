/**
 * A remote declaration is not resolution — the half that reads `skill_fetch`.
 *
 * @module cat-harness-tools/scripts/tests/manifest-remote-resolution.test
 *
 * Moved here from `cat-harness/scripts/tests/manifest-remote-resolution.test.ts`
 * (bean `7zz1` follow-up; owner, 2026-10-06: a test reading an upper layer's
 * files moves to that layer's declared test home). Bean `nup0` closed the
 * allowance that let `manifest-skill-exists` pass an entry only a file under
 * `skills/remote-packages/` named; one piece of the evidence it rests on is
 * that `skill_fetch` does not read that directory, and `skill-fetch.ts` moved
 * up into THIS layer with the server (bean `70lx`). Standing alone, cat-harness
 * cannot hold it. The rest of that file's tests — the synthetic package, the
 * other readers, kg-audit — stay with the code they test. The cat-harness
 * path is composed from ORIGIN_DIR, the directory the test was written in, and
 * `skill-fetch.ts` is read from this layer's own root; the two files it reads
 * are the two it read before the move.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { codeWithoutComments } from "../repo-files.js";
import { TOOLS_ROOT } from "../lib/roots.ts";

describe("the reason the allowance was closed is still true", () => {
  // The evidence `nup0` rests on. If it stops holding — somebody teaches
  // `skill_fetch` or the registry to read the directory — then
  // `manifest-skill-exists` should accept a remote declaration again, and this
  // test is where that argument is recorded rather than rediscovered.
  test("neither skill_fetch nor the registry reads skills/remote-packages/", () => {
    // CODE, not prose. This asserted on the raw file text until 2026-09-19,
    // when a documentation comment in `skill-fetch.ts` naming the directory —
    // as one of seven a naive scan would wrongly treat as a skill package —
    // turned it red while the behaviour it guards was untouched.
    //
    // That is the failure mode this file's sibling already recorded: grepping
    // "cannot tell an implementation from a comment". Narrowing to quoted
    // strings alone does not fix it either, because a markdown code span in a
    // comment is backticked and backticks quote strings in TypeScript.
    //
    // Each file read from the layer that HOLDS it: `skill-fetch.ts` moved up
    // with the server (bean `70lx`) into this layer, and the registry
    // generator stayed in cat-harness. Until this test moved here it asked
    // `implementingRootFor` from cat-harness, which finds this layer only in a
    // checkout that stacks the two; standing alone, this layer is the answer
    // without asking.
    const homes: Record<string, string> = {
      "src/tools/skill-fetch.ts": TOOLS_ROOT,
      "scripts/generate-registry.ts": TOOLS_ROOT,  // moved here too (70lx)
    };
    for (const [f, home] of Object.entries(homes)) {
      const code = codeWithoutComments(readFileSync(join(home, f), "utf8"));
      expect(code).not.toContain("remote-packages");
    }
  });
});
