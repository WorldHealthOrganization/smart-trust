import { describe, expect, test } from "bun:test";

import { renderSectionMarkdown } from "@litlfred/cat-harness-tools/pipeline/render-markdown.js";
import type { Section } from "@litlfred/cat-harness-tools/schemas/types.js";
import { convert, type LineMap, splitNumber, type Structure } from "./docx-to-folio.js";

const structure: Structure = {
  source: { file: "d.docx", sha256: "x" },
  footnotes: { "3": "A cited source." },
  media: ["media/image1.png"],
  items: [
    { seq: 0, type: "heading", level: 0, style: "Title", text: "The Handbook", md: "The Handbook" },
    { seq: 1, type: "paragraph", style: "Subtitle", text: "A subtitle", md: "A subtitle" },
    { seq: 2, type: "heading", level: 0, style: "Title", text: "Executive Summary", md: "Executive Summary" },
    { seq: 3, type: "paragraph", text: "Lead text of the summary.", md: "Lead text of the summary." },
    { seq: 4, type: "heading", level: 0, style: "Title", text: "Introduction", md: "Introduction" },
    { seq: 5, type: "heading", level: 1, text: "About this guidance", md: "About" },
    { seq: 6, type: "paragraph", text: "Opening of one point one.", md: "Opening of one point one." },
    { seq: 7, type: "heading", level: 3, text: "1.1.1 What is it?", md: "1.1.1 What is it?" },
    { seq: 8, type: "paragraph", text: "It is a blueprint.", md: "It is a blueprint.[^3]" },
    { seq: 9, type: "caption", target: "table", number: "1.1", text: "Table 1.1: Things", md: "Table 1.1: Things" },
    { seq: 10, type: "table", rows: [["A", "B"], ["1", "2"]], text: "A B 1 2" },
    { seq: 11, type: "caption", target: "figure", number: "1", text: "Figure 1: A picture", md: "Figure 1: A picture" },
    { seq: 12, type: "image", media: "media/image1.png" },
    { seq: 13, type: "table", rows: [["A boxed definition."]], text: "A boxed definition." },
    { seq: 14, type: "heading", level: 1, text: "Why it matters", md: "Why it matters" },
    { seq: 15, type: "list", ordered: false, items: [{ level: 0, md: "one", text: "one" }, { level: 1, md: "two", text: "two" }], text: "one two" },
  ],
};

const map: LineMap = {
  source: { file: "d.pdf", sha256: "y", pages: 3 },
  pages: { "1": { printed: null }, "2": { printed: "1" }, "3": { printed: "2" } },
  alignment: structure.items.map((i) => ({ seq: i.seq, page: i.seq < 5 ? 2 : 3, lineStart: i.seq, lineEnd: i.seq, method: "numbered" })),
};
// Tables and images carry no line numbers in a real review PDF.
for (const a of map.alignment) if ([10, 12, 13].includes(a.seq)) Object.assign(a, { lineStart: undefined, lineEnd: undefined, method: "inherited-page" });

describe("splitNumber", () => {
  test("splitNumberReadsHeadingNumber", () => {
    expect(splitNumber("3.4.5 Semantic Governance")).toEqual({ number: "3.4.5", title: "Semantic Governance" });
    expect(splitNumber("5.1 Emerging technologies")).toEqual({ number: "5.1", title: "Emerging technologies" });
    expect(splitNumber("D.1  Illustrative tools")).toEqual({ number: "D.1", title: "Illustrative tools" });
    expect(splitNumber("Appendix C: Components")).toEqual({ number: "C", title: "Appendix C: Components" });
    expect(splitNumber("Client Registry")).toEqual({ title: "Client Registry" });
  });
});

describe("convert", () => {
  const r = convert(structure, map, { slug: "doc", library: "lib-entry" });
  const file = (p: string) => r.files.find((f) => f.path === p)?.content ?? "";

  test("coverIsDocument", () => {
    expect(r.anchors.chapters.map((c) => c.dir)).toEqual(["executive-summary", "ch1-introduction"]);
    expect(file("doc.ts")).toContain(`subtitle: "A subtitle"`);
  });

  test("heading1NumberedFromChapter", () => {
    const n = r.anchors.sections.filter((s) => s.number).map((s) => s.number);
    expect(n).toEqual(["1.1", "1.1.1", "1.2"]);
  });

  test("heading3NestsUnderHeading1", () => {
    expect(r.anchors.sections.find((s) => s.number === "1.1.1")?.parent).toBe("sec:1-1");
    expect(file("ch1-introduction/ch1-introduction.ts")).toMatch(/label: "sec:1-1",[\s\S]*subsections: \[[\s\S]*"sec:1-1-1"/);
  });

  test("leadSectionTitledAsChapter", () => {
    expect(file("executive-summary/executive-summary.ts")).toContain("lead: true");
    expect(file("executive-summary/executive-summary.ts")).toContain(`title: "Executive Summary"`);
  });

  test("captionNamesTableAndFigure", () => {
    const t = r.anchors.blocks.find((b) => b.kind === "table")!;
    expect(t.label).toBe("tbl:1-1");
    expect(t.caption).toBe("Table 1.1");
    expect(t.lineStart).toBe(9);
    expect(t.method).toBe("caption-numbered");
    const f = r.anchors.blocks.find((b) => b.kind === "figure")!;
    expect(f.label).toBe("fig:1");
    expect(file(`ch1-introduction/${f.root}.md`)).toContain("](media/image1.png)");
    expect(r.media).toEqual(["media/image1.png"]);
  });

  test("oneCellTableIsQuote", () => {
    const box = r.anchors.blocks.find((b) => b.excerpt.startsWith("A boxed"))!;
    expect(box.kind).toBe("prose");
    expect(file(`ch1-introduction/${box.root}.md`).startsWith("> A boxed definition.")).toBe(true);
  });

  test("footnoteInCitingBlock", () => {
    const b = r.anchors.blocks.find((x) => x.excerpt === "It is a blueprint.")!;
    expect(file(`ch1-introduction/${b.root}.md`)).toContain("[^3]: A cited source.");
  });

  test("blockCarriesPagesAndLines", () => {
    const b = r.anchors.blocks.find((x) => x.excerpt === "It is a blueprint.")!;
    expect(b).toMatchObject({ page: 3, printedPage: "2", lineStart: 8, lineEnd: 8, method: "numbered" });
    expect(file(`ch1-introduction/${b.root}.ts`)).toContain(`"library":"lib-entry"`);
  });

  test("labelsSurviveInsertion", () => {
    const again = convert(
      {
        ...structure,
        items: [
          ...structure.items.slice(0, 7),
          { seq: 100, type: "paragraph", text: "An inserted paragraph.", md: "An inserted paragraph." },
          ...structure.items.slice(7),
        ],
      },
      { ...map, alignment: [...map.alignment, { seq: 100, page: 3, method: "numbered" }] },
      { slug: "doc", library: "lib-entry", previous: r.anchors },
    );
    const before = new Set(r.anchors.blocks.map((b) => b.label));
    const after = again.anchors.blocks.map((b) => b.label);
    expect(after.filter((l) => !before.has(l))).toHaveLength(1);
    expect(again.stats.reused).toBe(r.anchors.blocks.length);
  });
});

describe("renderSectionMarkdown nests subsections", () => {
  const blocks = new Map([
    ["a", { block: { kind: "prose", label: "prose:a" } as never, mdContent: "Alpha." }],
    ["b", { block: { kind: "prose", label: "prose:b" } as never, mdContent: "Beta." }],
    ["c", { block: { kind: "prose", label: "prose:c" } as never, mdContent: "Gamma." }],
  ]);
  const sec: Section = {
    title: "1.1 Top",
    label: "sec:1-1",
    blocks: ["a"],
    subsections: [{ title: "1.1.1 Mid", label: "sec:1-1-1", blocks: ["b"], subsections: [{ title: "1.1.1.1 Deep", blocks: ["c"] }] }],
  };

  test("subsectionsNestDeeper", () => {
    const md = renderSectionMarkdown(sec, blocks, { baseHeadingLevel: 2 });
    expect(md).toContain("### 1.1 Top");
    expect(md).toContain("#### 1.1.1 Mid");
    expect(md).toContain("##### 1.1.1.1 Deep");
    expect(md.indexOf("Alpha.")).toBeLessThan(md.indexOf("#### 1.1.1 Mid"));
    expect(md.indexOf("Beta.")).toBeLessThan(md.indexOf("##### 1.1.1.1 Deep"));
    expect(md).toContain("Gamma.");
  });

  test("leadHasAnchorNoHeading", () => {
    const md = renderSectionMarkdown({ title: "Executive Summary", label: "sec:es-lead", lead: true, blocks: ["a"] }, blocks, {});
    expect(md).toContain(`<a id="sec:es-lead"></a>`);
    expect(md).not.toContain("Executive Summary");
  });
});
