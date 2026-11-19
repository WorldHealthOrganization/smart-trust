/**
 * Regression test for bean `folio-assistant-89wq`:
 * Generic detangler QA checkers in `pipeline/qa-checkers-extended.ts` that are
 * unconditional `n/a` stubs must return an explicit, distinguishable sentinel
 * note (`"not implemented: stub checker"`) rather than a bare
 * `{ result: "n/a", hits: [] }` indistinguishable from a legitimate
 * applicability check.
 *
 * (The `proof-*` stub checkers moved to `folio-assistant-sci/pipeline/qa-checkers-extended.ts`
 * in bean `saqd` Group 8 and are tested there.)
 */
import { describe, expect, test } from "bun:test";
import type { CheckerResult } from "../../schemas/sdlc/block-qa.ts";
import {
  checkDetanglerNoXChapterFwd,
  checkDetanglerArchimedeanWall,
} from "../../pipeline/qa-checkers-extended";

const EXPECTED_SENTINEL: CheckerResult = {
  result: "n/a",
  hits: [],
  notes: "not implemented: stub checker",
};

describe("QA stub checkers return distinguishable sentinel notes (folio-assistant-89wq)", () => {
  test("checkDetanglerNoXChapterFwd returns distinguishable stub sentinel", () => {
    expect(checkDetanglerNoXChapterFwd(undefined)).toEqual(EXPECTED_SENTINEL);
    expect(checkDetanglerNoXChapterFwd("some/path/to/block.ts")).toEqual(EXPECTED_SENTINEL);
  });

  test("checkDetanglerArchimedeanWall returns distinguishable stub sentinel", () => {
    expect(checkDetanglerArchimedeanWall(undefined, undefined)).toEqual(EXPECTED_SENTINEL);
    expect(
      checkDetanglerArchimedeanWall("some/path/to/block.ts", "some/path/to/block.lean")
    ).toEqual(EXPECTED_SENTINEL);
  });
});
