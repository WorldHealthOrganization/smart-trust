/**
 * Fixtures are REAL turns from the session that prompted the detector.
 *
 * A detector tested on invented strings is tested on the author's idea of the
 * defect. These are copied from the 2026-09-26 session in which the owner had
 * to name the failure twice — the bad ones are what I actually wrote, and the
 * good ones are from the same session so "it fires on everything" cannot hide.
 */
import { describe, expect, test } from "bun:test";

import { findNamedNotAsked, reminder } from "../decisions-named-not-asked.js";

/** Verbatim closing paragraphs that earned the owner's second correction. */
const BAD = {
  "the wrap-up list": `Still yours, unchanged: bean \`bf5l\`'s layering ruling, task #26, the orphan
branch, \`e8m3\`, \`6ptx\`, issues #951 and #1340.`,

  "the same shape with a different lead-in": `Outstanding, all theirs: v625's fix, bean \`bf5l\`'s layering ruling, task #26
(a general gate so no advice string names mergeable_state approvingly), the
orphan branch, \`e8m3\`, \`6ptx\`, issues #951 and #1340.`,

  "hedged as a report rather than a question": `Nothing else queued, and I hold after this. Still open for you: bean \`bf5l\`'s
layering ruling, \`v625\`'s open item, the orphan branch, \`e8m3\`, \`6ptx\`, and
issues #951 and #1340.`,
};

/** Turns from the same session that did the right thing, or said nothing to answer. */
const GOOD = {
  "a report of finished work naming many ids": `**\`v625\` is closed and \`bun run cat skill:register\` is live on \`main\`.** One
failure in CI — the drift test — verified by reading the failure list. Bean
\`cjvs\` recorded 190 dangling refs and \`yx9p\` the five names; #1387 merged.`,

  "one decision asked in full": `The orphan branch \`claude/cool-fermi-htir5p\` carries only my merge commit and
its PR is closed; \`git diff origin/main...branch\` is empty.

1. **Delete the branch** (Recommended) — nothing is lost, the content is on main.
2. **Leave it** — costs a stale ref and a gh-pages preview slot.

Default if you say nothing: leave it, and keep working the queue.`,

  "a count with no names, as the rule asks": `Three other decisions are waiting; I will put each properly when it is next.`,

  "an outstanding marker with only ONE id": `Still yours: bean \`bf5l\`'s layering ruling — four options, each costed, in the
bean body.`,
};

describe("it fires on the shape the owner had to name twice", () => {
  test.each(Object.entries(BAD))("%s", (_name, text) => {
    const f = findNamedNotAsked(text);
    expect(
      f.length,
      `This is a verbatim wrap-up that handed decisions over with no terms. ` +
        `If the detector does not fire on it, it does not detect the defect it ` +
        `was written for — which is the failure mode of the partition-names ` +
        `guard on the same day (bean \`yx9p\`).`,
    ).toBeGreaterThan(0);
    expect(f[0]!.ids.length).toBeGreaterThanOrEqual(2);
  });
});

describe("it stays quiet on turns that did the right thing", () => {
  test.each(Object.entries(GOOD))("%s", (_name, text) => {
    expect(
      findNamedNotAsked(text),
      `A reminder that fires on a correct turn gets ignored, and then it no ` +
        `longer guards the incorrect ones. Noise is the failure mode here, not ` +
        `a missed case.`,
    ).toEqual([]);
  });
});

test("the anti-vacuity pair — the same function must do both", () => {
  // Neither an always-fire nor an always-quiet implementation passes both of
  // these, which the two describe blocks above cannot assert on their own
  // because each only ever looks in one direction.
  expect(findNamedNotAsked(BAD["the wrap-up list"]).length).toBeGreaterThan(0);
  expect(findNamedNotAsked(GOOD["a count with no names, as the rule asks"])).toEqual([]);
});

test("a comparison ANYWHERE in the paragraph suppresses it", () => {
  // The escape hatch, and it is deliberate: if the terms are present the
  // paragraph is an ask, and reminding an author who complied is how a
  // reminder gets switched off.
  const asked = `Still yours: \`bf5l\` and \`e8m3\`.

| option | pro | con | downstream |
|---|---|---|---|
| A | … | … | … |

Default if you say nothing: A.`;
  // Split on blank lines means the first paragraph is still bare — so this
  // asserts the real behaviour rather than a hoped-for one.
  const f = findNamedNotAsked(asked);
  expect(f.length, "the bare lead-in paragraph is still bare, and that is correct").toBe(1);
});

test("the reminder names the count and the ids, not just the rule", () => {
  // A reminder that only restates the rule is the summary that failed on
  // 2026-09-20 — the agent reads it, agrees with it, and does not see which
  // paragraph earned it.
  const msg = reminder(findNamedNotAsked(BAD["the wrap-up list"]));
  expect(msg).toContain("bf5l");
  expect(msg).toContain("#951");
  // Case-insensitive: the reminder emphasises DOWNSTREAM, and the assertion is
  // that the word reaches the reader at all, not how it is cased.
  expect(msg.toLowerCase()).toContain("downstream");
  expect(msg).toContain("interaction-modality.md");
});
