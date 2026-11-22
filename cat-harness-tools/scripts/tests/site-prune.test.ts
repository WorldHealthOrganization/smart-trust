/**
 * What a scoped site leaves out (owner, 2026-11-09, Q-SZ-6 "A"): the PDF
 * viewer when no page embeds it, and images no page shows.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { pagesEmbedPdf, pruneUnreferencedImages } from "../lib/site-prune.ts";
import { MARKER, VIEWER_DIR } from "../pdf-viewer.ts";

const site = (files: Record<string, string>): string => {
  const d = mkdtempSync(join(tmpdir(), "site-prune-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), body);
  }
  return d;
};

describe("pagesEmbedPdf", () => {
  test("a page carrying the embed marker embeds the viewer", () => {
    const d = site({ "a/index.html": `<div ${MARKER}></div>` });
    expect(pagesEmbedPdf(d)).toBe(true);
    rmSync(d, { recursive: true });
  });

  test("the viewer's own files do not count, and plain pages do not embed it", () => {
    const d = site({ "a/index.html": "<p>x</p>", [`${VIEWER_DIR}/web/viewer.html`]: `<div ${MARKER}></div>` });
    expect(pagesEmbedPdf(d)).toBe(false);
    rmSync(d, { recursive: true });
  });
});

describe("pruneUnreferencedImages", () => {
  test("an image a page, a stylesheet or a script names is kept; the others go", () => {
    const d = site({
      "index.html": `<img src="assets/img/harness/landing-card.webp">`,
      "assets/css/x.css": `.a{background:url(../img/icons/My%20Icon.svg)}`,
      "assets/js/x.js": `const p = "deck/slide-1.png";`,
      "assets/img/harness/landing-card.webp": "1",
      "assets/img/icons/My Icon.svg": "2",
      "assets/img/deck/slide-1.png": "3",
      "assets/img/kg-deck/slide-2.png": "4444",
      "assets/img/proposals/p.svg": "55",
    });
    const r = pruneUnreferencedImages(d);
    expect(r.files.sort()).toEqual(["assets/img/kg-deck/slide-2.png", "assets/img/proposals/p.svg"]);
    expect(r.bytes).toBe(6);
    expect(existsSync(join(d, "assets/img/harness/landing-card.webp"))).toBe(true);
    expect(existsSync(join(d, "assets/img/icons/My Icon.svg"))).toBe(true);
    expect(existsSync(join(d, "assets/img/kg-deck/slide-2.png"))).toBe(false);
    rmSync(d, { recursive: true });
  });

  test("a name with spaces, a comma or brackets is kept when a page names it, raw or encoded", () => {
    const d = site({
      "en/processes/a.html": `<img src="../../assets/img/workflows/Health Check and Counseling, Verbal Consent (brief).svg">`,
      "en/processes/b.html": `<img src="../../assets/img/workflows/Clinical%20Encounter%20(brief).svg">`,
      "assets/img/workflows/Health Check and Counseling, Verbal Consent (brief).svg": "1",
      "assets/img/workflows/Clinical Encounter (brief).svg": "2",
      "assets/img/workflows/Nobody Shows This (brief).svg": "333",
    });
    const r = pruneUnreferencedImages(d);
    expect(r.files).toEqual(["assets/img/workflows/Nobody Shows This (brief).svg"]);
    expect(r.bytes).toBe(3);
    rmSync(d, { recursive: true });
  });

  test("a site with no image folder prunes nothing", () => {
    const d = site({ "index.html": "x" });
    expect(pruneUnreferencedImages(d)).toEqual({ files: [], bytes: 0 });
    rmSync(d, { recursive: true });
  });
});
