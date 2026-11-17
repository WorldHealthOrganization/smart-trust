import { describe, expect, test } from "bun:test";

import { backMatterFindings, type OutlineChapter } from "./back-matter-order.ts";

const ch = (dir: string, title: string, sections: string[] = []): OutlineChapter => ({ dir, title, sections: sections.map((t) => ({ title: t })) });

describe("backMatterFindings", () => {
  test("agreedOrderPasses", () => {
    expect(backMatterFindings([
      ch("executive-summary", "Executive Summary"), ch("ch1", "Introduction"), ch("appendix", "Appendix"),
      ch("glossary", "Glossary", ["Glossary", "Acronyms"]), ch("references", "References"),
    ])).toEqual([]);
  });

  test("glossaryAcronymsFirstFlagged", () => {
    const f = backMatterFindings([ch("acronyms", "Acronyms"), ch("glossary", "Glossary"), ch("executive-summary", "Executive Summary"), ch("references", "References")]);
    expect(f.map((x) => x.code)).toEqual(["glossary-before-main", "acronyms-own-chapter"]);
  });

  test("frontMatterGlossaryFlagged", () => {
    const f = backMatterFindings([ch("front-matter", "Front matter", ["Acknowledgements", "Abbreviations and acronyms", "Glossary"]), ch("ch01", "Strategy"), ch("annexes", "Annexes")]);
    expect(f.map((x) => x.code)).toEqual(["glossary-before-main"]);
  });

  test("acronymsInAnnexFlagged", () => {
    const f = backMatterFindings([ch("ch01", "One"), ch("annexes", "Annexes", ["Annex 1. Acronyms"]), ch("glossary", "Glossary")]);
    expect(f.map((x) => x.code)).toEqual(["acronyms-outside-glossary"]);
  });

  test("noGlossaryPasses", () => {
    expect(backMatterFindings([ch("ch01", "One"), ch("references", "References")])).toEqual([]);
  });
});
