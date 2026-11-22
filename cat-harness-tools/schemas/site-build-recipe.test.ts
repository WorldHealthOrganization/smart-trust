/**
 * `site.build` in `<name>.config.json`: the steps that build a layer's
 * site, as package script names (owner, 2026-10-10: "i want one consolidated
 * worfklow"). `build-instance-site.ts` and `stage-local.ts` both read it.
 */
import { describe, expect, test } from "bun:test";

import { HarnessSiteSchema } from "./kg/harness-config.ts";

describe("site.build", () => {
  test("holds the three step lists and an optional home page", () => {
    const s = HarnessSiteSchema.parse({
      build: { home: "README.md", pre: ["check:archimate"], sourceSteps: ["site:document"], siteSteps: ["site:node-kinds"] },
    });
    expect(s.build).toEqual({ home: "README.md", pre: ["check:archimate"], sourceSteps: ["site:document"], siteSteps: ["site:node-kinds"] });
  });

  test("an omitted list is empty, not absent", () => {
    expect(HarnessSiteSchema.parse({ build: { sourceSteps: ["site:document"] } }).build).toEqual({ pre: [], sourceSteps: ["site:document"], siteSteps: [] });
  });

  test("a step is a package script NAME: a command is refused", () => {
    expect(HarnessSiteSchema.safeParse({ build: { pre: ["rm -rf /"] } }).success).toBe(false);
    expect(HarnessSiteSchema.safeParse({ build: { siteSteps: ["a; b"] } }).success).toBe(false);
  });

  test("a site with no build is unchanged", () => {
    expect(HarnessSiteSchema.parse({ landing: true })).toEqual({ landing: true });
  });
});
