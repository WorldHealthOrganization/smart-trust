/**
 * folio-l1-coverage — the one L1 coverage runner every DTH calls (bean cysv).
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { folioCaptured, folioCoverage, plain, readL1Sections } from "./folio-l1-coverage";

/** An L1 entry with two sections and a folio holding most of it. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "folio-l1-"));
  const l1 = join(root, "l1");
  mkdirSync(join(l1, "sections"), { recursive: true });
  writeFileSync(
    join(l1, "sections", "sec-b.md"),
    "---\ntitle: B\n---\nCountries should keep one product register. In no event shall WHO be liable for damages.\n",
  );
  writeFileSync(
    join(l1, "sections", "sec-a.md"),
    "Plan the work 2 Step The plan should name the resources needed to run the system. Data are reported yearly.\n",
  );
  const folio = join(root, "folio");
  mkdirSync(join(folio, "ch01"), { recursive: true });
  writeFileSync(join(folio, "ch01", "p-register.md"), "- **Countries** should keep one\n  product register.\n");
  writeFileSync(join(folio, "ch01", "p-plan.md"), "Plan the work Step The plan should name the resources needed to run the system.\n");
  return { l1, folio };
}

describe("reading the L1 entry", () => {
  it("sortedSectionsNoFrontMatter", () => {
    const { l1 } = fixture();
    const s = readL1Sections(l1);
    expect(s.map((x) => [x.page, x.sectionId])).toEqual([[1, "sec-a"], [2, "sec-b"]]);
    expect(s[1].text.startsWith("Countries")).toBe(true);
  });
  it("refusesUnreadableStructure", () => {
    const { l1 } = fixture();
    writeFileSync(join(l1, "structure.json"), JSON.stringify({ sections: [] }));
    expect(() => readL1Sections(l1)).toThrow();
  });
});

describe("the folio's text as captured statements", () => {
  it("removesMarkdownMarkup", () => {
    expect(plain("- **Countries** should | keep")).toBe("Countries should keep");
  });
  it("noShortFragments", () => {
    const { folio } = fixture();
    expect(folioCaptured(folio).every((c) => c.text.length >= 25)).toBe(true);
  });
});

describe("coverage of a folio", () => {
  it("capturesHeldLeavesRest", () => {
    const { l1, folio } = fixture();
    const r = folioCoverage({ l1Dir: l1, folioDir: folio });
    const state = Object.fromEntries(r.sentences.map((s) => [s.location, s.state]));
    expect(state).toEqual({ "p1:s1": "unaccounted", "p2:s1": "captured", "p2:s2": "unaccounted" });
    expect(r.sentences[1].sectionId).toBe("sec-b");
    expect("generatedAt" in r).toBe(false);
  });

  it("signedExclusionAccounts", () => {
    const { l1, folio } = fixture();
    const text = "In no event shall WHO be liable for damages.";
    const unsigned = folioCoverage({ l1Dir: l1, folioDir: folio, exclusions: [{ text, reason: "editorial" }] });
    expect(unsigned.sentences.find((s) => s.location === "p2:s2")!.state).toBe("unaccounted");
    const signed = folioCoverage({
      l1Dir: l1,
      folioDir: folio,
      exclusions: [{ text, reason: "editorial", signedOffBy: "a reviewer", signedOffAt: "2026-11-01" }],
    });
    expect(signed.sentences.find((s) => s.location === "p2:s2")!.state).toBe("excluded");
  });

  it("quoteNeedsBlockToHoldIt", () => {
    const { l1, folio } = fixture();
    const quote = "The plan should name the resources needed to run the system.";
    const ok = folioCoverage({ l1Dir: l1, folioDir: folio, quotes: [{ block: "ch01/p-plan", quote }] });
    expect(ok.sentences.find((s) => s.location === "p1:s1")!.state).toBe("captured");
    expect(ok.problems).toEqual([]);
    const bad = folioCoverage({ l1Dir: l1, folioDir: folio, quotes: [{ block: "ch01/p-register", quote }] });
    expect(bad.problems.length).toBe(1);
  });
});

describe("the glossary as captured text", () => {
  it("glossaryTextCaptured", () => {
    const { l1, folio } = fixture();
    const glossary = join(folio, "..", "glossary");
    mkdirSync(glossary, { recursive: true });
    writeFileSync(
      join(glossary, "terms.glossary.json"),
      JSON.stringify({ concepts: [{ definition: "In no event shall WHO be liable for damages." }] }),
    );
    writeFileSync(join(l1, "sections", "sec-c.md"), "An opensource software must have a license approved by the initiative.\n");
    writeFileSync(
      join(glossary, "more.glossary.json"),
      JSON.stringify([{ definition: "Words. An open-source software must have a license approved by the initiative." }]),
    );
    const without = folioCoverage({ l1Dir: l1, folioDir: folio });
    expect(without.sentences.filter((s) => s.state === "captured").length).toBe(1);
    const r = folioCoverage({ l1Dir: l1, folioDir: folio, glossaryDir: glossary });
    const state = Object.fromEntries(r.sentences.map((s) => [s.location, s.state]));
    expect(state["p2:s2"]).toBe("captured");
    expect(state["p3:s1"]).toBe("captured");
  });
});

describe("a quote that stands for an L1 sentence", () => {
  it("quoteStandsForL1Sentence", () => {
    const { l1, folio } = fixture();
    writeFileSync(join(l1, "sections", "sec-c.md"), "Each row should be noted in a in separate row of the sheet.\n");
    writeFileSync(join(folio, "ch01", "p-rows.md"), "Each row should be noted in a separate row of the sheet.\n");
    const quote = "Each row should be noted in a separate row of the sheet.";
    const plainQuote = folioCoverage({ l1Dir: l1, folioDir: folio, quotes: [{ block: "ch01/p-rows", quote }] });
    expect(plainQuote.sentences.find((s) => s.location === "p3:s1")!.state).toBe("unaccounted");
    const mapped = folioCoverage({
      l1Dir: l1,
      folioDir: folio,
      quotes: [{ block: "ch01/p-rows", quote, l1: "Each row should be noted in a in separate row of the sheet." }],
    });
    expect(mapped.sentences.find((s) => s.location === "p3:s1")!.state).toBe("captured");
    expect(mapped.problems).toEqual([]);
  });
});
