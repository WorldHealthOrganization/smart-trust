/**
 * The exclusion list and the skill it was transcribed from must still agree.
 *
 * Bean `xfoh`. The transcription had already drifted when this was written —
 * seven bullets in the skill, five patterns in the runner — and the gap
 * produced a false alarm the runner's own output could not explain. These
 * tests are the thing that was missing, not a restatement of the fix.
 *
 * @module folio-assistant/scripts/tests/crdm-detect-signals
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  CATEGORIES,
  EXCLUSIONS,
  categoryDrift,
  detect,
  exclusionDrift,
  parseSkillCategories,
  parseSkillExclusions,
  type Category,
} from "../../src/crdm/detect-signals.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { harnessPath } from "../lib/harness-layout.ts";

const root = resolve(HARNESS_ROOT);
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
const skillPath = harnessPath("skills/process/crdm/crdm-detect.md", root);
const skillMarkdown = readFileSync(skillPath, "utf-8");
const skill = parseSkillExclusions(skillMarkdown);
const skillCategories = parseSkillCategories(skillMarkdown);

interface Item { number: number; title: string; isFeature: boolean; why: string; text: string }
const corpus: Item[] = JSON.parse(readFileSync(join(TOOLS_ROOT, "scripts", "eval", "crdm-detect-corpus.json"), "utf-8"));

describe("the exclusion patterns and the skill's prose agree", () => {
  test("every quoted exclusion in the skill is matched by some pattern", () => {
    // The drift that shipped: `"What does this block kind mean?"` was in the
    // skill and in no pattern, so the runner excluded less than the skill says.
    const unmatched = exclusionDrift(skill).filter((d) => d.direction === "unmatched-bullet");
    expect(unmatched.map((d) => d.subject)).toEqual([]);
  });

  test("every pattern comes from a bullet — no exclusion without prose", () => {
    // The more dangerous direction: a pattern suppressing a real detection with
    // nothing in the skill to justify it.
    const orphans = exclusionDrift(skill).filter((d) => d.direction === "orphan-pattern");
    expect(orphans.map((d) => d.subject)).toEqual([]);
  });

  test("a renamed section throws rather than reporting an empty list", () => {
    // `dh4f`: a consumer that scans nothing and calls the run clean.
    expect(() => parseSkillExclusions("# something else\n\n- a bullet\n")).toThrow(/no "## What is NOT/);
  });
});

describe("the bullets a phrase cannot decide are reported, not dropped", () => {
  test("the skill carries at least one judgement-only category", () => {
    // "Bug reports about existing features (unless they imply a redesign)" —
    // no phrase names it, which is exactly why the runner false-alarms on one.
    expect(skill.judgementOnly.length).toBeGreaterThan(0);
  });

  test("a judgement-only bullet is not silently counted as implemented", () => {
    for (const j of skill.judgementOnly) expect(j).not.toContain('"');
  });
});

describe("GUARD: an exclusion must not swallow a real feature request", () => {
  test("no issue labelled a feature is excluded by phrase", () => {
    // Measured over the whole 27-issue population, not a sample. An exclusion
    // that buys precision by silencing a true positive is a worse rule than the
    // one it replaced, and this is the direction that says so.
    const silenced = corpus.filter((i) => i.isFeature && detect(i.text).excluded);
    expect(silenced.map((i) => i.number)).toEqual([]);
  });

  test("the patterns are all case-insensitive — an issue title is not prose", () => {
    for (const p of EXCLUSIONS) expect(p.flags).toContain("i");
  });
});

// ── The DETECTION half. Bean `9gtc`. ────────────────────────────────────────

describe("the detection patterns and the skill's prose agree", () => {
  test("every quoted category example is matched by a pattern in ITS category", () => {
    // The same drift `exclusionDrift` had just closed, on the other half of the
    // same file: `"when any user …"` sat in the prose with nothing implementing
    // it. Found by this check rather than by reading.
    expect(categoryDrift(skillCategories).map((d) => d.subject)).toEqual([]);
  });

  test("a renamed detection heading throws rather than silently going unchecked", () => {
    expect(() => parseSkillCategories("## Detection signals\n\n### Renamed\n\n- \"x\"\n")).toThrow(
      /missing detection heading/,
    );
  });

  test("a pattern in the wrong category is a finding, not a pass", () => {
    // Otherwise the per-category check degrades to a global one, and a bullet
    // could be satisfied by a pattern that has nothing to do with it.
    const misfiled: Category[] = CATEGORIES.map((c) =>
      c.name === "cross-cutting" ? { ...c, patterns: [] } : c,
    );
    expect(categoryDrift(skillCategories, misfiled).length).toBeGreaterThan(0);
  });
});

/**
 * The false alarms on `main` at `5bca749`, after `xfoh` and before `9gtc`.
 *
 * **The gate is this SET, not a precision floor, and the floor is why.** The
 * first guard written here asserted precision stayed at or above 0.80. Its own
 * falsification — the unanchored `proposal` candidate — costs #187 and still
 * measures **82.6%**, because seven new true positives landed in the same
 * numerator. A guard that a rejected candidate passes is not a guard.
 *
 * That is the bean's own rule one level down: *never report F1 alone, it hides
 * the trade*. Precision is an aggregate too, and it hides the same trade the
 * moment recall moves. A set does not.
 */
//
// 2026-09-24 (bean `vjbl`): the owner adjudicated a blind second annotation and
// relabelled #222 and #223 as feature requests, so they are true positives now
// and no longer false alarms. #166 remains.
const FALSE_ALARMS_BEFORE = [166];

/** Kept as a second, weaker signal — never as the gate. */
const PRECISION_FLOOR = 0.8;

function measure(categories: Category[] = CATEGORIES) {
  let tp = 0;
  const falseAlarms: number[] = [];
  for (const item of corpus) {
    const cats = categories.filter((c) => c.patterns.some((p) => p.test(item.text)));
    const fires = cats.length > 0 && !EXCLUSIONS.some((p) => p.test(item.text));
    if (!fires) continue;
    if (item.isFeature) tp++;
    else falseAlarms.push(item.number);
  }
  const fp = falseAlarms.length;
  return { tp, fp, falseAlarms, precision: tp + fp === 0 ? 0 : tp / (tp + fp) };
}

describe("GUARD: widening detection must not cost a single true negative", () => {
  test("no issue starts false-alarming that was not already", () => {
    const now = measure().falseAlarms;
    expect(now.filter((n) => !FALSE_ALARMS_BEFORE.includes(n))).toEqual([]);
  });

  test("the anchor's old justification is GONE — recorded, not hidden", () => {
    // This test used to FALSIFY the unanchored `/\bproposal\b/i`: it cost #187,
    // then labelled not-a-feature. On 2026-09-24 the owner relabelled #187 a
    // feature request (bean `vjbl`), so the unanchored pattern now adds NO
    // false alarm and CATCHES #187, which the anchor misses. The anchor stays
    // for now, because switching a detector to fit a 27-item eval set is
    // tuning to the test, and the choice is the owner's. This pins the new
    // fact, so the argument cannot quietly revert to the old one.
    const unanchored: Category[] = CATEGORIES.map((c) =>
      c.name === "self-declared-genre" ? { ...c, patterns: [/\bproposal\b/i, /\bdesign document\b/i] } : c,
    );
    expect(measure(unanchored).falseAlarms.filter((n) => !FALSE_ALARMS_BEFORE.includes(n))).toEqual([]);
    expect(measure(unanchored).tp).toBe(measure().tp + 1);
  });

  test("the precision floor holds too — but it is not what rejected that candidate", () => {
    expect(measure().precision).toBeGreaterThanOrEqual(PRECISION_FLOOR);
    // Recorded, because it is the reason the gate above is a set: the rejected
    // candidate clears this floor comfortably.
    expect(measure(
      CATEGORIES.map((c) =>
        c.name === "self-declared-genre" ? { ...c, patterns: [/\bproposal\b/i] } : c,
      ),
    ).precision).toBeGreaterThan(PRECISION_FLOOR);
  });

  test("the corpus is the whole population, so a sample size is not a defence", () => {
    // 27 issues, every one of them. A rule that costs a true negative here
    // costs it in the only population there is.
    expect(corpus.length).toBe(27);
  });
});
