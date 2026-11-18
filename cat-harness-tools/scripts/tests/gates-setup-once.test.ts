/**
 * A local `gates` run performs each setup step once (owner, 2026-11-06, bean
 * `cat-tools-sm8r` item 2). CI repeats setup per job, each from a fresh
 * checkout; here one checkout runs every job, so a repeat sets up nothing new
 * and reads what the steps between wrote into the mounts.
 */
import { expect, test } from "bun:test";

import { RUN_ONCE_SETUP_STEPS, SetupOnce } from "../gates.ts";

test("a listed setup step runs the first time and is skipped after, with the first run's exit", () => {
  const s = new SetupOnce();
  expect(s.ranAlready("bun run cat state:mount")).toBeUndefined();
  s.record("bun run cat state:mount", 1);
  expect(s.ranAlready("bun run cat state:mount")).toBe(1);
  // A later run does not overwrite the first's exit.
  s.record("bun run cat state:mount", 0);
  expect(s.ranAlready("bun run cat state:mount")).toBe(1);
});

test("a check that repeats is never skipped: it may judge what a step in between wrote", () => {
  const s = new SetupOnce();
  s.record("bun run cat check:extracted-references", 0);
  expect(s.ranAlready("bun run cat check:extracted-references")).toBeUndefined();
});

test("the list names the setup steps the workflow repeats per job, and no check", () => {
  for (const c of ["bun install --frozen-lockfile", "bun run cat state:mount", "bun run cat ig-index:build"]) {
    expect(RUN_ONCE_SETUP_STEPS).toContain(c);
  }
  expect(RUN_ONCE_SETUP_STEPS.some((c) => /check/.test(c))).toBe(false);
});
