/**
 * The high-water mark for issue comments an agent has read.
 *
 * Written after a session missed FIVE owner comments on #203 (14:31 → 15:55),
 * each of which changed direction, because it checked the issue once at start
 * and never again. Two of these tests pin the cases that would silently
 * reproduce that: no stored mark, and a comment edited after being read.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { loadSeen, saveSeen, unseen, advance, seenPath } from "../../src/issue-watch/seen-comments.ts";

let root = "";
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "seen-")); });
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

const C = (id: number, updated?: string) => ({ id, updated_at: updated });

describe("seen-comments", () => {
  test("with NO stored mark, everything is unseen", () => {
    // The safe direction. A fresh container has read nothing; defaulting to
    // "seen" is exactly how the comments that change direction get skipped.
    const all = [C(1), C(2), C(3)];
    expect(unseen(all, undefined)).toHaveLength(3);
  });

  test("ids above the mark are unseen, at or below are not", () => {
    const state = advance("o/r#1", [C(10), C(20)], undefined);
    expect(state.lastCommentId).toBe(20);
    expect(unseen([C(10), C(20), C(21)], state).map((c) => c.id)).toEqual([21]);
  });

  test("a comment EDITED after the mark is unseen again, despite its id", () => {
    // The subtle one. An edited comment keeps its id, so an id-only mark calls
    // it handled — and the ask says "new/UPDATED comments".
    const state = advance("o/r#1", [C(10, "2026-09-18T10:00:00Z")], undefined);
    const editedLater = [C(10, "2026-09-18T12:00:00Z")];
    expect(unseen(editedLater, state).map((c) => c.id)).toEqual([10]);
    // ...and unchanged ones stay seen.
    expect(unseen([C(10, "2026-09-18T10:00:00Z")], state)).toEqual([]);
  });

  test("the mark never moves backwards", () => {
    const first = advance("o/r#1", [C(50)], undefined);
    // A later page that happens to contain only older comments must not
    // rewind the mark and resurface everything.
    const second = advance("o/r#1", [C(10), C(20)], first);
    expect(second.lastCommentId).toBe(50);
  });

  test("round-trips through disk", () => {
    const state = advance("o/r#203", [C(99, "2026-09-18T15:55:00Z")], undefined, "branch x");
    saveSeen(root, "o", "r", 203, state);
    const back = loadSeen(root, "o", "r", 203);
    expect(back?.lastCommentId).toBe(99);
    expect(back?.note).toBe("branch x");
    expect(seenPath(root, "o", "r", 203)).toContain("issue-marks/o-r-203.json");
  });

  test("a CORRUPT mark reads as absent, not as everything-seen", () => {
    // Failing open here would be silent and would look like a clean run.
    const p = seenPath(root, "o", "r", 7);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "{ not json");
    expect(loadSeen(root, "o", "r", 7)).toBeUndefined();
    expect(unseen([C(1)], loadSeen(root, "o", "r", 7))).toHaveLength(1);
  });
});
