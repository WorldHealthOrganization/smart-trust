import { describe, expect, test } from "bun:test";
import { GitLabUsernameSchema, LoginSchema, isInjectionSafe } from "./tools/tool-types.js";

describe("GitLabUsername: a GitLab account name, safe on the command line (4dbr)", () => {
  test("GitLab's shapes parse, including ones Login refuses", () => {
    for (const u of ["litlfred", "jane.doe", "_bot", "ci_runner-2", "a", "x".repeat(255)]) {
      expect(GitLabUsernameSchema.safeParse(u).success).toBe(true);
    }
    expect(LoginSchema.safeParse("jane.doe").success).toBe(false);
  });

  test("a flag, a shell payload, whitespace or GitLab's forbidden endings do not parse", () => {
    for (const bad of ["-rf", "--reviewer", ".hidden", "trailing.", "repo.git", "feed.atom", "a b", "a;rm", "$(x)", "+jane", "", "x".repeat(256)]) {
      expect(GitLabUsernameSchema.safeParse(bad).success).toBe(false);
    }
  });

  test("it is admissible as a command-line argument", () => {
    expect(isInjectionSafe("GitLabUsername")).toBe(true);
  });
});
