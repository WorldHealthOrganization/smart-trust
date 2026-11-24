/**
 * staging-share: a preview keeps only what differs from the live site.
 * Owner, 2026-10-31: "if asset not changed in staging then link to main asset".
 */
import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FRAGMENT } from "../../staging-banner.ts";
import { normaliseLiveHtml, normalisePreviewHtml, NOT_FOUND_HTML, planShare, sameAsLive, workerSource } from "../../staging-share.ts";

const LIVE = `<html><head>
<link rel="canonical" href="https://x/a.html">
<meta name="fa-staging" content=""><meta name="fa-search-index" content=""><title>API</title></head><body class="c"><p>same</p></body></html>`;
const PREVIEW = `<html><head>
<meta name="fa-staging" content="preview"><meta name="fa-search-index" content="published"><title>API (staging: s1)</title></head><body class="c">${FRAGMENT}<p>same</p></body></html>`;

function tree(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "share-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

describe("what counts as the live site's copy", () => {
  test("a page that differs only by the per-preview edits is shared", () => {
    expect(normalisePreviewHtml(PREVIEW, "s1")).toBe(normaliseLiveHtml(LIVE));
    expect(sameAsLive("a.html", Buffer.from(PREVIEW), Buffer.from(LIVE), "s1")).toBe(true);
  });
  test("a page whose content differs is kept", () => {
    const changed = PREVIEW.replace("<p>same</p>", "<p>changed</p>");
    expect(sameAsLive("a.html", Buffer.from(changed), Buffer.from(LIVE), "s1")).toBe(false);
  });
  test("a non-HTML file is shared only byte for byte", () => {
    expect(sameAsLive("x.css", Buffer.from("a{}"), Buffer.from("a{}"), "s1")).toBe(true);
    expect(sameAsLive("x.css", Buffer.from("a{} "), Buffer.from("a{}"), "s1")).toBe(false);
  });
  test("the preview's own facts are never shared", () => {
    expect(sameAsLive("staging.json", Buffer.from("{}"), Buffer.from("{}"), "s1")).toBe(false);
    expect(sameAsLive("index.html", Buffer.from(PREVIEW), Buffer.from(LIVE), "s1")).toBe(false);
    expect(sameAsLive("en/index.html", Buffer.from(PREVIEW), Buffer.from(LIVE), "s1")).toBe(true);
  });
});

describe("the plan", () => {
  test("shares what matches, keeps what differs or is new", () => {
    const root = tree({ "a.html": LIVE, "x.css": "a{}", "y.css": "b{}" });
    const preview = tree({ "a.html": PREVIEW, "x.css": "a{}", "y.css": "b{ }", "new.html": "<p>n</p>" });
    const plan = planShare(root, preview, "s1");
    expect(plan.shared.sort()).toEqual(["a.html", "x.css"]);
    expect(plan.kept).toBe(2);
  });
});

describe("the fallback", () => {
  test("the worker marks a live page as the preview's", () => {
    const src = workerSource("published");
    expect(src).toContain(JSON.stringify(FRAGMENT));
    expect(src).toContain('var SEARCH="published"');
  });
  test("the root 404 names no preview", () => {
    expect(NOT_FOUND_HTML).not.toMatch(/STAGING\/[a-z0-9-]+\//i);
    expect(NOT_FOUND_HTML).toContain("staging-sw.js");
  });
});
