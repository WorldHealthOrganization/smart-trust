/**
 * The pre-push time budget: reading a gate run's times, keeping this
 * machine's, and choosing the gates to hold out (owner, 2026-11-05).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { budgetSeconds, DEFAULT_BUDGET_SECONDS, durationsFromLog, mergeDurations, overBudget, readSeed } from "../gate-durations.ts";

const TOOLS = { bun: "1.4.4", git: "2.56.0", platform: "linux-x64" };

test("durationsFromLog reads only the pool's lines, the longest when a gate ran twice", () => {
  const log = [
    "▸ bun run cat state:mount",
    "  ↳ 46.5s, exit 0: bun run cat state:mount",
    "▸ bun run cat check:a   (75.0s, parallel)",
    "  some output (12.0s, parallel)",
    "▸ bun run cat check:b   SKIPPED — inputs unchanged",
    "▸ bun run cat check:a   (80.5s, parallel)",
    "▸ bun run cat check:c --all   (3s, parallel)",
  ].join("\n");
  // A serial step (state:mount) is never timed: it may produce what a later gate reads.
  // A SKIPPED gate has no time, so it cannot read as fast.
  expect(durationsFromLog(log)).toEqual({ "bun run cat check:a": 80.5, "bun run cat check:c --all": 3 });
});

test("mergeDurations keeps the longest seen, and starts over under another bun", () => {
  const a = mergeDurations(undefined, { x: 10, y: 70 }, TOOLS, "t1");
  const b = mergeDurations(a, { x: 5, y: 90, z: 1 }, TOOLS, "t2");
  expect(b.seconds).toEqual({ x: 10, y: 90, z: 1 });
  expect(mergeDurations(b, { x: 2 }, { ...TOOLS, bun: "1.5.0" }, "t3").seconds).toEqual({ x: 2 });
});

describe("overBudget", () => {
  test("a time here wins over the seed, both ways", () => {
    const here = { fast: 10, slow: 61 };
    const seed = { fast: 500, other: 120, small: 30 };
    expect(overBudget(here, seed, 60)).toEqual([
      { command: "other", seconds: 120, source: "seed" },
      { command: "slow", seconds: 61, source: "here" },
    ]);
  });
  test("no budget holds nothing out", () => {
    expect(overBudget({ slow: 1000 }, { other: 1000 }, undefined)).toEqual([]);
  });
});

test("the committed seed parses, and every entry is over the default budget", () => {
  const seed = readSeed();
  expect(Object.keys(seed).length).toBeGreaterThan(0);
  for (const s of Object.values(seed)) expect(s).toBeGreaterThan(DEFAULT_BUDGET_SECONDS);
});

test("budgetSeconds: env first, then git config, else 60; 0 is none; garbage is refused", () => {
  const root = mkdtempSync(join(tmpdir(), "budget-"));
  try {
    spawnSync("git", ["init", "-q"], { cwd: root });
    expect(budgetSeconds(root, {})).toBe(DEFAULT_BUDGET_SECONDS);
    spawnSync("git", ["config", "cat.gates.budgetSeconds", "120"], { cwd: root });
    expect(budgetSeconds(root, {})).toBe(120);
    expect(budgetSeconds(root, { CAT_PREPUSH_BUDGET: "30" })).toBe(30);
    expect(budgetSeconds(root, { CAT_PREPUSH_BUDGET: "0" })).toBeUndefined();
    expect(() => budgetSeconds(root, { CAT_PREPUSH_BUDGET: "soon" })).toThrow(/number of seconds/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
