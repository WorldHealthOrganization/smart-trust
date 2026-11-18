/**
 * publish-id-lookup — the identifier lookup copied into a built site as a page
 * of its own (bean `1br0`, issue #1972 step 3).
 *
 * What must hold for the search box's link to work: the client page and every
 * declared index land where `search-split.ts` looks for them, each index is
 * the generated one byte for byte, and the repository README beside an index
 * is not published as part of it.
 *
 * @module cat-harness-tools/test/publish-id-lookup.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { indexedSources, outDirFor } from "../scripts/gen-id-lookup.ts";
import { SITE_DIR, publish } from "../scripts/publish-id-lookup.ts";
import { ID_LOOKUP_DIR, publishedLookups } from "../scripts/search-split.ts";

describe("publish-id-lookup", () => {
  test("the client and every declared index land where the splitter looks", () => {
    const site = mkdtempSync(join(tmpdir(), "publish-id-lookup-"));
    try {
      const done = publish(site);
      const sources = indexedSources();
      expect(sources.length).toBeGreaterThan(0); // not vacuous: this checkout hosts at least one
      expect(done.map((d) => d.source)).toEqual(sources);
      expect(existsSync(join(site, SITE_DIR, "index.html"))).toBe(true);
      expect(existsSync(join(site, SITE_DIR, "lookup.js"))).toBe(true);
      const indexHtml = readFileSync(join(site, SITE_DIR, "index.html"), "utf-8");
      expect(indexHtml).toContain('<meta name="folio-navbar" content="linked">');
      expect(indexHtml).toContain("data-fa-visualiser-nav");
      for (const s of sources) {
        const from = outDirFor(s);
        const to = join(site, SITE_DIR, s);
        expect(readFileSync(join(to, "manifest.json"), "utf-8")).toBe(readFileSync(join(from, "manifest.json"), "utf-8"));
        expect(readdirSync(to)).not.toContain("README.md");
      }
      // The two halves agree on the path: what is published is what is linked.
      expect(SITE_DIR).toBe(ID_LOOKUP_DIR);
      expect(publishedLookups(site).map((r) => r.id)).toEqual(sources);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });

  test("a declared index with no generated manifest is refused, not linked", () => {
    const site = mkdtempSync(join(tmpdir(), "publish-id-lookup-none-"));
    try {
      expect(() => publish(site, ["an-instance-that-hosts-no-lookup"])).toThrow();
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});
