/**
 * The "This change (preview)" section (`preview-qa.ts`) and the two places a
 * preview page is compared: the build record sets it aside, so two builds of
 * one tree agree whatever stage the cone run was at; staging-share does NOT,
 * so a QA page that differs from the live one only by it is still served
 * from the preview.
 */
import { describe, expect, test } from "bun:test";

import { injectSection, renderSection, SITE_REPORT, stripSection } from "../preview-qa.ts";
import { BUILD_FACTS, fileHash } from "../preview-record.ts";
import { NEVER_SHARED, sameAsLive } from "../staging-share.ts";

const page = '<!doctype html><html><body><main><h1>Main QA</h1></main></body></html>';
const withSection = injectSection(page, renderSection(undefined, { sha: "abcdef1" }));

describe("preview-qa and the preview's comparisons", () => {
  test("the build record hashes a QA page the same with or without the section", () => {
    expect(fileHash("qa.html", Buffer.from(withSection), "s")).toBe(fileHash("qa.html", Buffer.from(stripSection(withSection)), "s"));
    expect(BUILD_FACTS).toContain(SITE_REPORT);
  });

  test("staging-share keeps a QA page carrying the section in the preview", () => {
    expect(sameAsLive("qa.html", Buffer.from(withSection), Buffer.from(page), "s")).toBe(false);
    expect(NEVER_SHARED.has(SITE_REPORT)).toBe(true);
  });
});
