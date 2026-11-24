#!/usr/bin/env bun
/**
 * Publish the translation review projections into a built site, wherever the
 * checkout has translations.
 *
 * @module scripts/publish-translation-review
 * @covers translation-sources
 *
 *   bun run cat-harness-tools/scripts/publish-translation-review.ts --site <built site> [--root <checkout>]
 *
 * A block's 🌐 pane (cat-harness `site-chrome/assets/js/translation-review.js`)
 * reads `assets/translation-status/review.json` and, per catalogue, its
 * strings projection. Until 2026-11-18 only the platform's own site wrote them
 * (`gen-translation-status.ts`, at `derive:publish`), so a folio's site — dth-phc
 * — published none, and its pane could only say so. The owner's ruling: "make
 * the site build publish review.json wherever translations exist".
 * `build-instance-site.ts` runs this for every site it builds.
 *
 * Every layer in the checkout that declares a `translation-sources` directory
 * is projected, the same set the platform's review page lists. A checkout with
 * none writes nothing and says so: the pane then reports, plainly, that the
 * site publishes no review. The review PAGE is linked only when the site
 * holds one.
 *
 * Exit 0 written, or nothing to write · 2 could not determine (no site).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { collectReview, reviewProjection } from "./gen-translation-status.ts";
import { STRINGS_BASE } from "./lib/translation-review-page.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The review page's path in `site`, when the site holds one. */
export function reviewPageIn(site: string): string | undefined {
  for (const rel of ["en/cat-harness/translation-status/index.html", "cat-harness/translation-status/index.html", "translation-status/index.html"]) {
    if (existsSync(join(site, rel.replace(/index\.html$/, "review.html")))) return rel;
  }
  return undefined;
}

/** Write the projections; returns what was written, relative to `site`. */
export function publishTranslationReview(root: string, site: string): string[] {
  const { layers, strings } = collectReview(root, root);
  if (layers.length === 0) return [];
  const files: Array<[string, string]> = [
    ["assets/translation-status/review.json", reviewProjection(layers, reviewPageIn(site))],
    ...[...strings].map(([rel, text]) => [`${STRINGS_BASE}${rel}`, text] as [string, string]),
  ];
  for (const [rel, text] of files) {
    const abs = join(site, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return files.map(([rel]) => rel);
}

function main(): number {
  const site = arg("--site");
  if (!site || !existsSync(site)) {
    console.error("publish-translation-review: --site <built site directory> is required and must exist. This is NOT a pass.");
    return 2;
  }
  const written = publishTranslationReview(resolve(arg("--root") ?? "."), resolve(site));
  if (written.length === 0) {
    console.log("publish-translation-review: no layer in this checkout declares translations; nothing to publish");
    return 0;
  }
  console.log(`publish-translation-review: ${written.length} file(s) — review.json and ${written.length - 1} strings projection(s)`);
  return 0;
}

if (import.meta.main) process.exit(main());
