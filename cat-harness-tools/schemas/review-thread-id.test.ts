import { describe, expect, test } from "bun:test";
import { ReviewThreadIdSchema, isInjectionSafe } from "./tools/tool-types.js";

describe("ReviewThreadId: a forge's review-thread id, safe on the command line (4dbr)", () => {
  test("both forges' shapes parse", () => {
    for (const id of [
      "PRRT_kwDOAbCdEf4A1b2C3d", // GitHub review-thread node id
      "abc12345deadbeef1234567890abcdef12345678", // GitLab discussion id, 40 hex
      "abc12345", // GitLab discussion id prefix, 8 chars
      "3107030349", // GitLab note id
    ]) expect(ReviewThreadIdSchema.safeParse(id).success).toBe(true);
  });

  test("a flag, a shell payload, whitespace or a too-short prefix does not parse", () => {
    for (const bad of ["-rf", "--help-me-now", "abc1234;rm", "$(touch x)", "abc 12345", "a`b`cdefg", "abc123", "", "x".repeat(129)]) {
      expect(ReviewThreadIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  test("it is admissible as a command-line argument", () => {
    expect(isInjectionSafe("ReviewThreadId")).toBe(true);
  });
});
