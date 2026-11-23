/**
 * A scoped site (owner, 2026-11-08, Q-SZ-2 "B"): the glossary and the
 * bibliography of an IG's site carry the IG's and its landing layer's
 * entries only, and every other layer's stay on that layer's own site.
 */
import { describe, expect, test } from "bun:test";

import { scopeLabel, siteScopeArg } from "./site-scope.ts";

describe("siteScopeArg", () => {
  test("noFlagNoScope", () => {
    expect(siteScopeArg(["bun", "w.ts", "--site", "x"])).toBeUndefined();
  });

  test("namesCommaSeparated", () => {
    const s = siteScopeArg(["--scope", "smart-immunizations, smart-base"]);
    expect(scopeLabel(s!)).toBe("smart-base,smart-immunizations");
  });

  test("emptyRefused", () => {
    expect(() => siteScopeArg(["--scope"])).toThrow();
    expect(() => siteScopeArg(["--scope", ","])).toThrow();
  });
});
