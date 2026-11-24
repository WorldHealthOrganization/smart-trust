/**
 * The voice-overlay criteria are derived from the voices, and the derivation
 * reproduces what four hand-written entries used to say.
 *
 * Bean `btuv`. `qa-criteria-registry.ts` carried one entry per voice, each
 * restating that voice's rules in prose — three of them describing files in
 * ANOTHER layer, and every one of them restating rules without the citation
 * the voice itself carries.
 *
 * **The expected values below are the ones the hand-written entries carried**,
 * captured before they were deleted. They are written here rather than read off
 * the corpus on purpose: a test whose expected value is whatever the code
 * currently produces cannot catch the code changing, which is the whole thing
 * this file is for.
 *
 * The tests of this file that read the whole checkout (derives criteria from
 * the voices folio-assistant-sci, smart-base and who-iris ship) live in
 * `test/voice-criteria-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  judgesBlocks,
  overlayCriterionId,
  overlaySeverityOf,
  shippedVoices,
  voiceOverlayCriteria,
} from "../../../pipeline/voice-criteria.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const INSTANCE = join(HARNESS_ROOT);

describe("overlaySeverityOf is declared, never derived from the rules", () => {
  test("it reads the voice's own field", () => {
    for (const { voice } of shippedVoices(INSTANCE)) {
      const declared = (voice as { overlaySeverity?: string }).overlaySeverity;
      if (declared) expect(overlaySeverityOf(voice)).toBe(declared as never);
    }
  });

  test("a voice declaring none gets the documented default, not the worst rule", () => {
    const worst = { id: "x", title: "X", description: "d", rules: [{ severity: "critical" }] };
    expect(overlaySeverityOf(worst as never)).toBe("major");
  });

  test("two of the four disagree with the worst-rule rule — which is why it is declared", () => {
    // The measurement that settled the design. If this ever stops holding, the
    // derivation becomes possible and the field could go.
    const worstOf = (v: { rules: { severity: string }[] }) =>
      v.rules.some((r) => r.severity === "critical")
        ? "critical"
        : v.rules.some((r) => r.severity === "major")
          ? "major"
          : "minor";
    const disagree = shippedVoices(INSTANCE).filter(
      ({ voice }) => worstOf(voice as never) !== overlaySeverityOf(voice),
    );
    expect(disagree.length).toBeGreaterThan(0);
  });
});

describe("the criterion id is composed in one place", () => {
  test("`overlayCriterionId` is what the derivation uses", () => {
    for (const { voice } of shippedVoices(INSTANCE).filter(({ voice }) => judgesBlocks(voice))) {
      const c = voiceOverlayCriteria(INSTANCE).find((x) => x.voices?.[0] === voice.id);
      expect(c!.id).toBe(overlayCriterionId(voice.id));
    }
  });
});

// Bean `rkqp`: a voice scoped only to artefact kinds (`appliesTo: ["skill"]`)
// is judged by `skill-voice-review-current`, never as a block overlay — or
// activating it would hold folio prose to rules written for a SKILL.md.
describe("a voice that judges only skills makes no block criterion", () => {
  test("the skill-authoring voices are shipped, and none is a block overlay", () => {
    const skillOnly = shippedVoices(INSTANCE).filter(({ voice }) => !judgesBlocks(voice)).map(({ voice }) => voice.id);
    expect(skillOnly).toContain("agent-skill-authoring");
    const ids = new Set(voiceOverlayCriteria(INSTANCE).map((c) => c.id));
    for (const id of skillOnly) expect(ids.has(overlayCriterionId(id))).toBe(false);
  });
});
