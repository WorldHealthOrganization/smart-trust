/**
 * `mount-from-lock.ts` runs ALONE: the reusable `layer-pr-checks.yml` checks
 * out `scripts/mount-from-lock.ts` and nothing else from the pinned
 * cat-harness-tools commit, then runs it to lay the layers down. A relative
 * import therefore fails before anything is mounted (measured 2026-11-07:
 * smart-ips-pilgrimage#15's "Prepare the PR side" failed with `Cannot find
 * module '../schemas/sdlc/input-trace.ts'` once its pin passed 37673d4a).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "mount-from-lock.ts");

describe("mount-from-lock.ts is self-contained", () => {
  test("it imports only node: modules", () => {
    const src = readFileSync(SCRIPT, "utf-8");
    const specifiers = [...src.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => !s.startsWith("node:"))).toEqual([]);
  });

  test("a copy of the file alone loads and prints its usage", () => {
    const dir = mkdtempSync(join(tmpdir(), "mfl-alone-"));
    try {
      copyFileSync(SCRIPT, join(dir, "mount-from-lock.ts"));
      const r = spawnSync(process.execPath, [join(dir, "mount-from-lock.ts"), "--help"], { cwd: dir, encoding: "utf-8" });
      expect(r.stderr).not.toContain("Cannot find module");
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
