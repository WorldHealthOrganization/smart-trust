import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { viewerHtml } from "../gen-uploads-viz.ts";

describe("uploads visualiser wireframe findings (folio-assistant-s0ki)", () => {
  const html = viewerHtml("../../assets/library/index.json");
  const src = readFileSync(join(import.meta.dir, "..", "gen-uploads-viz.ts"), "utf8");

  describe("Finding 1: Default sort prioritizes waiting rows first", () => {
    test("default sortKey is state and sortAsc is true", () => {
      expect(src).toMatch(/sortKey\s*=\s*"state"/);
      expect(src).toMatch(/sortAsc\s*=\s*true/);
    });

    test("sorting by state prioritizes waiting before ingested", () => {
      // In gen-uploads-viz.ts, stateRank / sa sb ranks waiting before ingested
      expect(src).toMatch(/state\(a\)\s*===\s*"waiting"\s*\?\s*0\s*:\s*1/);
      expect(src).toMatch(/state\(b\)\s*===\s*"waiting"\s*\?\s*0\s*:\s*1/);
    });
  });

  describe("Finding 3: Keyboard and accessible sorting", () => {
    test("table headers contain button elements with data-k attributes", () => {
      expect(src).toContain('<button type="button" data-k="');
      expect(src).toMatch(/th\s+button/);
    });

    test("table headers include aria-sort attributes", () => {
      expect(src).toContain('aria-sort="ascending"');
      expect(src).toContain('aria-sort="descending"');
      expect(src).toContain('aria-sort="none"');
    });

    test("CSS provides focus indicator for sort buttons", () => {
      expect(html).toContain("th button:focus-visible");
      expect(html).toContain("outline:");
    });
  });

  describe("Finding 4: State badge emphasis not by colour alone", () => {
    test("lead badge has distinct border and background styling", () => {
      expect(html).toMatch(/\.badge\.lead\s*\{[^}]*border:\s*2px solid/);
      expect(html).toMatch(/\.badge\.lead\s*\{[^}]*background:\s*var\(--waitbg\)/);
    });

    test("lead badge includes semantic icon and text tag", () => {
      expect(src).toContain("lead-icon");
      expect(src).toContain("lead-tag");
      expect(src).toContain("action needed");
      expect(src).toContain("&#x23f3;");
    });
  });

  describe("Finding 5: Size column wrapping prevention", () => {
    test("CSS ensures size column does not wrap mid-token", () => {
      expect(html).toMatch(/\.size\s*\{[^}]*white-space:\s*nowrap/);
      expect(html).toMatch(/min-width:\s*6rem/);
    });

    test("size formatting uses non-breaking space", () => {
      expect(src).toContain('\\u00a0MB');
      expect(src).toContain('\\u00a0KB');
    });
  });

  describe("Finding 6: Grouping and distinguishing unhelpful filenames", () => {
    test("raw screenshot and UUID captures are identified", () => {
      expect(src).toContain("isRawCapture");
      expect(src).toContain("ChatGPT");
      expect(src).toContain("capture-tag");
      expect(src).toContain("raw capture");
    });

    test("raw captures receive distinct CSS styling", () => {
      expect(html).toContain(".capture-tag");
      expect(html).toContain(".capture-name");
    });

    test("table organizes rows into grouped tbody elements with group headers", () => {
      expect(src).toContain('<tr class="group-row">');
      expect(src).toContain('scope="colgroup"');
      expect(src).toContain('Waiting to be ingested');
      expect(src).toContain('Ingested into library/');
    });
  });
});
