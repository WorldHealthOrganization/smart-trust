import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFile, norm } from "./l1-transcription-verbatim.ts";

function fixture(l1: string): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), "l1tv-"));
  const entry = join(root, "library/poster");
  mkdirSync(join(entry, "sections"), { recursive: true });
  writeFileSync(join(entry, "sections/p1.md"), "Birth Polio Tuberculosis Hepatitis \u{E001} B Weeks");
  writeFileSync(join(entry, "images.json"), JSON.stringify({ images: [{ id: "img-1", narrative: { text: "BCG 1 at birth" } }] }));
  const file = join(root, "poster.l1.yaml");
  writeFileSync(file, l1);
  return { root, file };
}

describe("l1-transcription-verbatim", () => {
  test("normDropsPrivateUseGlyphs", () => {
    expect(norm("Hepatitis\u{E001} B")).toBe("Hepatitis B");
  });

  test("passesVerbatimAndCorroborated", () => {
    const { root, file } = fixture(`graph: {source: {entry: library/poster}}
transcription: [{key: T1, text: "Birth: Polio, Tuberculosis, Hepatitis B"}]
recommendations:
  - {key: P01, statement: "Birth: Polio", from: T1}
  - {key: S01, statement: "BCG 1 at birth", image: img-1}
`);
    expect(checkFile(file, root).findings).toEqual([]);
  });

  test("reportsNonVerbatimUncorroboratedDuplicate", () => {
    const { root, file } = fixture(`graph: {source: {entry: library/poster}}
transcription: [{key: T1, text: "Birth: Polio, Measles"}]
recommendations:
  - {key: P01, statement: "Birth: Polio and BCG", from: T1}
  - {key: P01, statement: "BCG 1 at birth", image: img-1}
`);
    const f = checkFile(file, root).findings;
    expect(f.some((x) => x.includes("T1: words not in the text layer: measles"))).toBe(true);
    expect(f.some((x) => x.includes("P01: recommendation is not verbatim"))).toBe(true);
    expect(f.some((x) => x.includes("P01: duplicate key"))).toBe(true);
  });

  test("allowsInspectionOnlyWord", () => {
    const { root, file } = fixture(`graph: {source: {entry: library/poster}}
transcription: [{key: T1, text: "Birth Measles", inspectionOnly: {words: [measles]}}]
recommendations: []
`);
    expect(checkFile(file, root).findings).toEqual([]);
  });
});
