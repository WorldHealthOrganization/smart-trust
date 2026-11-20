/**
 * `parseQaReport` is `loadQaReport` over text in hand (bean `8wj1`): a sidecar
 * read from the qa-reports branch must give the same report as the same bytes
 * read off disk, or `qa-staleness --against` would judge a different document
 * than the working copy holds.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadQaReport, parseQaReport } from "../../pipeline/qa-utils.ts";

const SAMPLES: Record<string, string> = {
  marked: JSON.stringify({ $schema: "block-qa/v1", criteria: { a: [{ result: "pass" }] } }),
  // No marker, but the shape: accepted, and the marker supplied.
  unmarked: JSON.stringify({ criteria: { a: [{ result: "fail" }] } }),
  // A bare entry object where an array belongs: wrapped; a scalar: dropped.
  bareEntry: JSON.stringify({ $schema: "block-qa/v1", criteria: { a: { result: "pass" }, b: "junk" } }),
  // Not this schema at all.
  foreign: JSON.stringify({ criterion: "x", paper: "p", chapters: [] }),
  corrupt: "{ not json",
};

describe("parseQaReport agrees with loadQaReport on the same bytes", () => {
  test.each(Object.entries(SAMPLES))("%s", (name, text) => {
    const dir = mkdtempSync(join(tmpdir(), "qa-parse-"));
    try {
      const p = join(dir, `${name}.qa.json`);
      writeFileSync(p, text);
      expect(parseQaReport(text, "qa-reports:main/x")).toEqual(loadQaReport(p));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the shape rules are applied, not just the parse", () => {
    expect(parseQaReport(SAMPLES.unmarked!, "l")?.$schema).toBe("block-qa/v1");
    expect(parseQaReport(SAMPLES.bareEntry!, "l")?.criteria as unknown).toEqual({ a: [{ result: "pass" }] });
    expect(parseQaReport(SAMPLES.foreign!, "l")).toBeUndefined();
    expect(parseQaReport(SAMPLES.corrupt!, "l")).toBeUndefined();
  });
});
