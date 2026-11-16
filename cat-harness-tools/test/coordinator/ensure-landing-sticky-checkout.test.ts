/**
 * `ensure-landing-sticky` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/ensure-landing-sticky.test.ts` (bean `7zz1`,
 * owner ruling 2026-10-06 "Top-level instance"): each reads every harness card
 * the checkout's live board carries, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";

import { join } from "node:path";

import {
  declaredContributions,
  readLandingStickies,
  readerTextProblems,
} from "../../scripts/ensure-landing-sticky.js";
import { instanceRootFor } from "../../schemas/kg/cat-harness.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("a harness sticky shows the landing's text, not the author's (ob3m 3)", () => {

  test("the live board: every harness card opens with its declaration's summary", () => {
    const root = instanceRootFor(join(ORIGIN_DIR, ".."));
    expect(readerTextProblems(root)).toEqual([]);
    const cards = new Map(readLandingStickies(root).map((s) => [s.id, s]));
    const judgedIds: string[] = [];
    let judged = 0;
    for (const d of declaredContributions(root)) {
      if (d.contribution.bodyFrom === undefined || d.summary === undefined) continue;
      const card = cards.get(d.contribution.id);
      expect(card).toBeDefined();
      expect(card!.comment.startsWith(d.summary)).toBe(true);
      for (const w of d.alsoWritten ?? []) expect(card!.comment).toContain(`\`${w}\``);
      if (d.description !== undefined && d.description !== d.summary) {
        expect(card!.comment).not.toContain(d.description);
      }
      judged += 1;
      judgedIds.push(d.contribution.id);
    }
    // folio-assistant and cat-harness both declared a summary, so this was
    // `>= 2`. The owner removed folio-assistant's declaration (3d4caf6,
    // 2026-10-08), and with it its card; cat-harness's is the one left. So
    // the vacuity guard names the card it must have judged rather than a count
    // that would now have to drop: a loop that judged nothing still fails, and
    // so does one that skipped cat-harness's.
    expect(judged).toBeGreaterThanOrEqual(1);
    expect(judgedIds.some((id) => id.includes("cat-harness"))).toBe(true);
  });
});
