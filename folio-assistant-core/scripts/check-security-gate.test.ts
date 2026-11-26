import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  blocks,
  CORE_ROOT,
  coreSecurityGate,
} from "./check-security-gate.js";

describe("coreSecurityGate (bean folio-core-0dy3)", () => {
  test("passesOnOwnRoot", () => {
    const results = coreSecurityGate(CORE_ROOT);
    const blockingFailures = blocks(results);
    expect(blockingFailures).toEqual([]);
    for (const r of results) {
      expect(r.state).toBe("pass");
    }
  });

  test("unknownWhenAbsent", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "core-sec-empty-"));
    try {
      const results = coreSecurityGate(emptyRoot);
      const byCheck = new Map(results.map((r) => [r.check, r]));
      expect(byCheck.get("check:workflow-injection")?.state).toBe("unknown");
      expect(byCheck.get("check:secret-leaks")?.state).toBe("unknown");
      expect(byCheck.get("check:lockfile-pinning")?.state).toBe("unknown");
      expect(byCheck.get("action-sha-pinning")?.state).toBe("unknown");
      expect(blocks(results).length).toBeGreaterThan(0);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  test("detectsBadRoot", () => {
    const badRoot = mkdtempSync(join(tmpdir(), "core-sec-bad-"));
    try {
      mkdirSync(join(badRoot, ".github", "workflows"), { recursive: true });
      writeFileSync(join(badRoot, "package.json"), JSON.stringify({ name: "fixture" }));
      writeFileSync(join(badRoot, ".bun-version"), "1.3.11\n");
      const fakeToken = ["ghp", "_" + "A".repeat(36)].join("");
      writeFileSync(
        join(badRoot, ".github", "workflows", "ci.yml"),
        [
          "name: CI",
          "on: [push]",
          "jobs:",
          "  build:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: actions/checkout@v4",
          "      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.0.2",
          "      - run: |",
          "          echo ${{ github.event.issue.title }}",
          "          bun install",
          `          echo ${fakeToken}`,
          "",
        ].join("\n"),
      );

      const results = coreSecurityGate(badRoot);
      const byCheck = new Map(results.map((r) => [r.check, r]));
      expect(byCheck.get("check:workflow-injection")?.state).toBe("fail");
      expect(byCheck.get("check:secret-leaks")?.state).toBe("fail");
      expect(byCheck.get("check:lockfile-pinning")?.state).toBe("fail");
      expect(byCheck.get("check:bun-pin")?.state).toBe("fail");
      expect(byCheck.get("action-sha-pinning")?.state).toBe("fail");
      expect(blocks(results).length).toBeGreaterThanOrEqual(5);
    } finally {
      rmSync(badRoot, { recursive: true, force: true });
    }
  });
});
