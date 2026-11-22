/**
 * `check:merged` must tell its two non-zero cases apart — bean `qook`, second
 * route.
 *
 * `bun run cat gates` exits 1 both when a gate FAILS and when every gate passes but
 * one of them WROTE to the tree (`ymsu`). `check-merged.ts` branched on
 * `gates.status !== 0` alone, so it printed "the MERGED tree fails the gates …
 * regenerate what the failing gates name" for both — naming gates that did not
 * exist and advice that could not be followed. Measured 2026-09-27 on
 * `claude/qook-verify-backwards`: every gate passed, 1 gate changed the tree,
 * and that was the message.
 *
 * ## Why the exit code is NOT the discriminator, and must not become one
 *
 * The obvious fix — make the mutation path exit 2, which `check:merged`
 * already treats as could-not-determine — is WRONG here, and #1363 says why in
 * its own scope: the guard makes `ymsu` clause 1 "visible and FATAL", on
 * purpose, so the writing gate gets fixed instead of tolerated. Softening it
 * would defeat the guard exactly where it works. So the discrimination is made
 * by OBSERVATION instead, which this script can afford because it owns the
 * merge worktree.
 *
 * @module scripts/tests/check-merged-mutation
 * @covers code
 */
import { describe, expect, test } from "bun:test";

import { mutatedDuring } from "../../check-merged.ts";
import type { TreeReading } from "../../gate-tree-guard.ts";

const read = (pairs: [string, string][]): TreeReading => ({
  ok: true,
  entries: new Map(pairs),
});
const unread = (why: string): TreeReading => ({ ok: false, why });

describe("mutatedDuring — the anti-vacuity pair", () => {
  test("an unchanged tree is NOT a mutation", () => {
    // Without this the implementation could return `true` always and the
    // interesting test below would still pass.
    const t = read([[" M a.json", " M"]]);
    expect(mutatedDuring(t, t)).toBe(false);
  });

  test("a tree that gained an entry IS a mutation", () => {
    expect(mutatedDuring(read([]), read([[" M a.json", " M"]]))).toBe(true);
  });

  test("a tree that LOST an entry is a mutation too — the direction #1363 nearly missed", () => {
    // A writer putting a correct value back makes the entry DISAPPEAR from
    // porcelain. A guard asking only "did anything get dirtier?" reports
    // nothing, and would miss its own test case.
    expect(mutatedDuring(read([[" M a.json", " M"]]), read([]))).toBe(true);
  });
});

describe("an unreadable tree is not a sighting", () => {
  test("unreadable BEFORE answers false, not true", () => {
    expect(mutatedDuring(unread("no .git"), read([[" M a.json", " M"]]))).toBe(false);
  });

  test("unreadable AFTER answers false, not true", () => {
    expect(mutatedDuring(read([]), unread("git binary missing"))).toBe(false);
  });

  test("both unreadable answers false", () => {
    expect(mutatedDuring(unread("a"), unread("b"))).toBe(false);
  });
});
