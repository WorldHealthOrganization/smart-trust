/**
 * `iri:sync:check` judges only the caller's own files in a layer's PR checks
 * (owner ruling 2026-11-05, "Move the checks"; `gate-own.ts`). Tested with a
 * PLANTED stale IRI in a file of each side, so the gate is seen failing on
 * the caller's own and passing past another layer's.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GATE_FOREIGN_PATHS_ENV, GATE_OWN_PATHS_ENV, gateOwnsFile } from "./gate-own.ts";

describe("gateOwnsFile: a file is the caller's when its deepest instance directory is", () => {
  // The same cases the runner's own reader is tested on.
  const env = (own: string, foreign: string) => ({ [GATE_OWN_PATHS_ENV]: own, [GATE_FOREIGN_PATHS_ENV]: foreign });

  test("unsetJudgesEverything", () => {
    expect(gateOwnsFile("harness-layer/AGENTS.md", {})).toBeUndefined();
  });

  test("layerRootOwnsOnlyItsDirectory", () => {
    const e = env("site-layer", "harness-layer,tools-layer");
    expect(gateOwnsFile("site-layer/AGENTS.md", e)).toBe(true);
    expect(gateOwnsFile("./site-layer/scripts/x.ts", e)).toBe(true);
    expect(gateOwnsFile("harness-layer/docs/guides/agent-onboarding.md", e)).toBe(false);
    expect(gateOwnsFile("README.md", e)).toBe(false);
    // A prefix of a name is not containment.
    expect(gateOwnsFile("site-layer-extra/AGENTS.md", e)).toBe(false);
  });

  test("rootInstanceOwnsRootFilesOnly", () => {
    const e = env(".", "harness-layer");
    expect(gateOwnsFile("README.md", e)).toBe(true);
    expect(gateOwnsFile("harness-layer/AGENTS.md", e)).toBe(false);
  });
});

describe("iri:sync:check judges only the caller's own files", () => {
  // Two layers in one git root, each with one file one major behind.
  const root = mkdtempSync(join(tmpdir(), "bt-iri-own-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  mkdirSync(join(root, "own"));
  mkdirSync(join(root, "other"));
  writeFileSync(join(root, "own", "own.json"), JSON.stringify({ name: "own", iriBase: "https://x.test/own/", version: "2.0.0" }));
  writeFileSync(join(root, "own", "a.md"), "see https://x.test/own/v1/thing\n");
  writeFileSync(join(root, "other", "b.md"), "see https://x.test/own/v1/thing\n");
  const run = (extra: Record<string, string>) => {
    const env: Record<string, string | undefined> = { ...process.env, ...extra };
    if (!(GATE_OWN_PATHS_ENV in extra)) delete env[GATE_OWN_PATHS_ENV];
    return spawnSync("bun", [join(import.meta.dir, "iri-sync.ts"), "--check", "--repo", root], { encoding: "utf-8", env });
  };

  test("unscopedFailsBothStaleFiles", () => {
    const r = run({});
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("own/a.md");
    expect(r.stdout).toContain("other/b.md");
  });

  test("scopedChargesOnlyOwnStaleFile", () => {
    const r = run({ [GATE_OWN_PATHS_ENV]: "own", [GATE_FOREIGN_PATHS_ENV]: "other" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("own/a.md");
    expect(r.stdout).not.toContain("other/b.md");
    expect(r.stdout).toContain("1 file(s) of other layers");
  });

  test("scopedPassesWhenOwnFilesCurrent", () => {
    const r = run({ [GATE_OWN_PATHS_ENV]: "elsewhere", [GATE_FOREIGN_PATHS_ENV]: "own,other" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("2 file(s) of other layers");
  });
});
