/**
 * `dc:render:check` judges only the caller's own layer in a layer's PR
 * checks (owner ruling 2026-11-05, "Move the checks"; cat-harness-tools
 * `lib/gate-own.ts`). Every root mounting a catalogue layer judged that
 * layer's renderings; that is the layer's own CI's to do.
 *
 * @module scripts/tests/dc-render-own-files.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "..", "dc-render.ts");
// The root dc-render.ts decides ownership against: two levels above scripts/.
const REPO = resolve(import.meta.dir, "..", "..", "..");
const ELSEWHERE = resolve(REPO, "some-other-layer");

const run = (env: Record<string, string>) => {
  const e: Record<string, string | undefined> = { ...process.env, ...env };
  if (!("CAT_GATE_OWN_PATHS" in env)) delete e["CAT_GATE_OWN_PATHS"];
  return spawnSync("bun", [SCRIPT, ELSEWHERE, "--check"], { encoding: "utf-8", env: e });
};

describe("dc-render --check on an instance the caller does not commit", () => {
  test("foreignScopePasses", () => {
    const r = run({ CAT_GATE_OWN_PATHS: "my-layer", CAT_GATE_FOREIGN_PATHS: "some-other-layer" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("not this caller's");
  });

  test("unscopedJudged", () => {
    const r = run({});
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("not a catalogue instance");
  });

  test("ownScopeJudged", () => {
    const r = run({ CAT_GATE_OWN_PATHS: "some-other-layer", CAT_GATE_FOREIGN_PATHS: "my-layer" });
    expect(r.status).toBe(2);
  });
});
