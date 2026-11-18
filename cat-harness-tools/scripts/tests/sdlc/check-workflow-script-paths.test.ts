/**
 * Tests for `check:workflow-script-paths`: a workflow that runs a script must
 * rebuild when that script changes.
 *
 * @module scripts/tests/sdlc/check-workflow-script-paths.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assess, invokedScripts } from "../../check-workflow-script-paths.ts";

describe("a script named with a leading ./", () => {
  // feature-staging.yml imports two scripts as `./cat-harness-tools/...`; the
  // `./` kept them from matching `cat-harness-tools/scripts/**`, so the check
  // reported a covered workflow as uncovered (fhir-harness#269).
  const withRoot = (fn: (root: string) => void) => {
    const root = mkdtempSync(join(tmpdir(), "wsp-"));
    try {
      mkdirSync(join(root, "tools", "scripts"), { recursive: true });
      writeFileSync(join(root, "tools", "scripts", "a.ts"), "");
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  test("is the same file as without it", () => {
    withRoot((root) => {
      expect(invokedScripts(`run: bun -e 'import x from "./tools/scripts/a.ts"'`, root)).toEqual(["tools/scripts/a.ts"]);
    });
  });

  test("is covered by the directory pattern that covers it without the ./", () => {
    withRoot((root) => {
      const yaml = [
        "on:",
        "  pull_request:",
        "    paths:",
        "      - 'tools/scripts/**'",
        "jobs:",
        "  j:",
        "    steps:",
        `      - run: bun -e 'import x from "./tools/scripts/a.ts"'`,
      ].join("\n");
      const r = assess("w.yml", yaml, root);
      expect(r.verdict).toBe("covered");
      expect(r.uncovered).toEqual([]);
    });
  });

  test("an uncovered script is still reported", () => {
    withRoot((root) => {
      const yaml = ["on:", "  pull_request:", "    paths:", "      - 'docs/**'", "jobs:", "  j:", "    steps:", "      - run: bun ./tools/scripts/a.ts"].join("\n");
      expect(assess("w.yml", yaml, root).uncovered).toEqual(["tools/scripts/a.ts"]);
    });
  });
});
