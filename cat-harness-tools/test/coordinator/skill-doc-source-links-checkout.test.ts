/**
 * `skill-doc-source-links` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/skill-doc-source-links.test.ts` (bean `7zz1`,
 * owner ruling 2026-10-06 "Top-level instance"): each resolves skill sources
 * across every layer in the checkout, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readdirSync, readFileSync } from "../support/site-fs.ts";
import { join, resolve } from "node:path";

import { repoRootFor, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { siteNotBuilt } from "../support/checkout.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE_ROOT = resolve(ORIGIN_DIR, "../..");
const REPO_ROOT = repoRootFor(INSTANCE_ROOT);
const OUT_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "reference", "skill-instructions");
/** The generated pages are written at publish and gitignored (bean w1gy F18). */
const NOT_BUILT = siteNotBuilt("the skill reference pages `skills:docs` writes at publish (gitignored)", join(OUT_DIR, "index.md"));
const LINK = /https:\/\/github\.com\/litlfred\/folio-assistant\/(?:blob|edit)\/main\/([^)\s]+)/g;

/** The pages the generator PUBLISHES — the ones its index links. */
function publishedPages(): Set<string> {
  const index = readFileSync(join(OUT_DIR, "index.md"), "utf8");
  return new Set([...index.matchAll(/\]\(([^)/]+)\.html\)/g)].map((m) => `${m[1]}.md`));
}

describe.skipIf(NOT_BUILT)("generated skill pages link a source that exists", () => {
  // `describe.skipIf` still runs this body, so nothing is read when it skips.
  const published = NOT_BUILT ? new Set<string>() : publishedPages();
  const pages = NOT_BUILT ? [] : readdirSync(OUT_DIR).filter((f) => f.endsWith(".md") && f !== "index.md");

  test("the corpus is not empty — the guard every assertion below needs", () => {
    expect(published.size).toBeGreaterThan(100);
  });

  test("every source and edit link on a published page resolves", () => {
    const dead: string[] = [];
    let checked = 0;
    for (const page of pages) {
      if (!published.has(page)) continue;
      const body = readFileSync(join(OUT_DIR, page), "utf8");
      for (const m of body.matchAll(LINK)) {
        checked++;
        // The file is what must exist; a `#fragment` names a place in it, not a path.
        const path = decodeURIComponent(m[1].split("#")[0]!);
        if (path.split("/").includes("..") || !existsSync(join(REPO_ROOT, path))) dead.push(`${page} -> ${path}`);
      }
    }
    // Named, not counted: a count says the class exists, a name says where.
    expect(dead).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });

  // Pages in the directory that the index does NOT link are orphans — output
  // the generator no longer writes. They are outside this test on purpose:
  // removing one is a deletion, and a deletion is asked for
  // (`deletion-requires-confirmation`), not made green by a test.
});
