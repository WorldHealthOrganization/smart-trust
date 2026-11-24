/**
 * The formal-edge source rules: which sources count as elaborated, and how a
 * cache's per-entry sources are summarised.
 *
 * One rule serves both the writer (`lean-atlas-ingest.ts` `saveCache`) and
 * the reader (`content-graph.ts`), so these cases pin it for both. The case
 * that motivated the rule is `atlas` beside `elaborated`: the old writer
 * called ANY two sources `mixed`, which reads as "partly scanned" to every
 * consumer that gates on the type/value split (folio-assistant#1492).
 */

import { describe, expect, test } from "bun:test";
import { isElaborated, summarizeSources } from "./content-graph";

describe("isElaborated", () => {
  test("atlas and elaborated are elaborated; scan and mixed are not", () => {
    expect(isElaborated("atlas")).toBe(true);
    expect(isElaborated("elaborated")).toBe(true);
    expect(isElaborated("scan")).toBe(false);
    expect(isElaborated("mixed")).toBe(false);
    expect(isElaborated("editorial-only")).toBe(false);
    expect(isElaborated(undefined)).toBe(false);
  });
});

describe("summarizeSources", () => {
  test("an empty cache is scan: nothing elaborated has been recorded", () => {
    expect(summarizeSources([])).toBe("scan");
  });

  test("a single source is itself", () => {
    expect(summarizeSources(["atlas", "atlas"])).toBe("atlas");
    expect(summarizeSources(["elaborated"])).toBe("elaborated");
    expect(summarizeSources(["scan", "scan"])).toBe("scan");
  });

  test("an entry with no source counts as scan, as the reader always assumed", () => {
    expect(summarizeSources([undefined])).toBe("scan");
    expect(summarizeSources(["elaborated", undefined])).toBe("mixed");
  });

  test("atlas beside elaborated is still fully elaborated, never mixed", () => {
    const s = summarizeSources(["atlas", "elaborated"]);
    expect(s).toBe("elaborated");
    expect(isElaborated(s)).toBe(true);
  });

  test("any scan beside an elaborated entry is mixed", () => {
    expect(summarizeSources(["atlas", "scan"])).toBe("mixed");
    expect(summarizeSources(["elaborated", "scan", "atlas"])).toBe("mixed");
  });
});
