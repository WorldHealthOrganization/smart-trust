/**
 * Re-recording a round trip must not rewrite when it happened.
 *
 * These exist because the first re-record — adding a model identifier to a
 * verdict that already existed — stamped the CURRENT repo HEAD onto a review
 * from two hours earlier, naming a merge commit that did not exist when the
 * agents ruled. The timestamp had been preserved and the SHA had not, which is
 * the worse half: a reader uses `reviewed_sha` to place a verdict in the
 * history, and a wrong one is a confident lie where a missing one is a gap.
 */
import { describe, expect, test } from "bun:test";

import { roundTripEntries, type RoundTripPayload } from "./translation-roundtrip.ts";

const base: RoundTripPayload = {
  block: "docs/source/x/b.md",
  locale: "fr",
  backTranslation: "A back-translation.",
  backTranslator: { id: "back-translator" },
  adjudicator: { id: "adjudicator" },
  verdict: "pass",
};

describe("roundTripEntries — provenance is recorded, never invented", () => {
  test("a re-record keeps the original time and HEAD on BOTH entries", () => {
    const e = roundTripEntries(
      { ...base, reviewedAt: "2026-09-18T20:32:46.150Z", reviewedSha: "c3998d16ecf1" },
      { md: "h" },
    );
    expect(e).toHaveLength(2);
    for (const entry of e) {
      expect(entry.reviewed_at).toBe("2026-09-18T20:32:46.150Z");
      expect(entry.reviewed_sha).toBe("c3998d16ecf1");
    }
  });

  test("without them it stamps no clock: a first recording is dated by its tree", () => {
    // Owner rulings 2026-11-06 (cards "QA dates" and "Date source", option 1):
    // the date is derived on read from reviewed_tree, never stamped as now.
    const e = roundTripEntries(base, { md: "h" });
    expect(e[0]!.reviewed_at).toBeUndefined();
    // The tree, not the commit (bean 69lr; owner card Q4, 2026-11-05).
    expect(e[0]!.reviewed_tree).toBeDefined();
    expect(e[0]!.reviewed_sha).toBeUndefined();
  });

  test("a re-record by tree keeps that tree on BOTH entries", () => {
    const tree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
    const e = roundTripEntries({ ...base, reviewedAt: "2026-09-18T20:32:46.150Z", reviewedTree: tree }, { md: "h" });
    for (const entry of e) {
      expect(entry.reviewed_tree).toBe(tree);
      expect(entry.reviewed_sha).toBeUndefined();
    }
  });

  test("a model identifier carries the basis for it, beside the model", () => {
    // A subagent's serving model is not observable from the dispatching
    // session. Recording the string alone would be an inference printed as a
    // fact — the move this repo deleted a whole feature for.
    const e = roundTripEntries(
      {
        ...base,
        adjudicator: { id: "adjudicator", model: "some-model", modelSource: "read from get_session" },
      },
      { md: "h" },
    );
    expect(e[0]!.reviewer!.agent_model).toBe("some-model");
    expect(e[0]!.metrics?.model_source).toBe("read from get_session");
  });

  test("no model, no model_source row — and the panel then prints 'not recorded'", () => {
    const e = roundTripEntries(base, { md: "h" });
    expect(e[0]!.reviewer!.agent_model).toBeUndefined();
    expect(e[0]!.metrics?.model_source).toBeUndefined();
  });

  test("the adjudicator rules and the back-translator does not", () => {
    const e = roundTripEntries({ ...base, verdict: "fail", severity: "major" }, { md: "h" });
    expect(e[0]!.result).toBe("fail");
    expect(e[0]!.severity).toBe("major");
    // It produced the intermediate text; it did not rule on anything, and must
    // not read as a second verdict.
    expect(e[1]!.result).toBe("n/a");
    expect(e[1]!.notes).toContain("A back-translation.");
  });
});
