/**
 * The AST sites a preview stages, under the staging cone (bean 4j86): the
 * measurements its Done-when names, on this checkout. Here rather than beside
 * the cone, because the cone lives in cat-harness and must not import upward;
 * and in smart-base rather than fhir-harness, because the layers it measures
 * (smart-trust, smart-base's chrome) are WHO's, and fhir-harness stays WHO-free
 * (`check:fhir-harness-exclusions`).
 */
import { describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";

import { siteFileFor } from "../../../cat-harness-tools/schemas/kg/cat-harness.js";

import { siteFilter } from "../../platform/index.js";
import { AST_SITE_WRITERS } from "../../platform/index.js";

const REPO = resolve(import.meta.dir, "..", "..", "..");
const ast = (changed: string[]) => siteFilter(REPO, changed, AST_SITE_WRITERS)("smart-trust").carry;

// Each case walks the whole checkout's cone, about 4-5 s on a CI runner,
// which is bun's 5 s default; one case timed out at 5.08 s on smart-base#132.
const CONE_MS = 30_000;

describe("the AST sites, on this checkout", () => {
  it("skillOnlyChangeStagesNoAstSite", () => expect(ast(["cat-harness/skills/kg/kg-core/directory-conventions.md"])).toBe(false), CONE_MS);
  it("genIgPagesChangeStagesAstSite", () => expect(ast(["fhir-harness/scripts/gen-ig-pages.ts"])).toBe(true), CONE_MS);
  it("chromeChangeStagesAstSite", () => expect(ast(["smart-base/themes/chrome.json"])).toBe(true), CONE_MS);
  // Asked, never spelled: the Jekyll build environment is the site CHROME's
  // since cat-harness slice 1 (`site-chrome/Gemfile.lock`), not `docs/`'s.
  it("buildEnvironmentStagesAstSite", () => expect(ast([join("cat-harness", siteFileFor(join(REPO, "cat-harness"), "Gemfile.lock"))])).toBe(true), CONE_MS);
});
