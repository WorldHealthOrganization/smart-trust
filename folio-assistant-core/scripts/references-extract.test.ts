import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { irisHandle, joinLines, listsOf, splitEntries, toReference } from "./references-extract.ts";

const section = (title: string, body: string) => `---\nsection_title: "${title}"\n---\n${body}`;

describe("splitEntries", () => {
  test("a numbered list splits on its own numbers, with the number on its own line", () => {
    const e = splitEntries(["1.\t", "Chen L, Evans T. Human resources for health. Lancet. 2004;364:1984-90.", "2.\t", "The world health report 2006. Geneva: World Health", "Organization; 2006 (https://iris.who.int/handle/10665/43432)."]);
    expect(e.map((x) => x.n)).toEqual([1, 2]);
    expect(e[1]!.text).toBe("The world health report 2006. Geneva: World Health Organization; 2006 (https://iris.who.int/handle/10665/43432).");
  });
  test("an unnumbered list splits where an entry closes and the next opens", () => {
    const e = splitEntries(["Hurtubise, R. Managing information systems. West Hartford, CT,", "Kumarian Press, 1984.", "Lippeveld, T., et al, eds. Design and implementation of health information systems.", "Geneva. World Health Organization, 2000."]);
    expect(e).toHaveLength(2);
    expect(e[0]!.text).toBe("Hurtubise, R. Managing information systems. West Hartford, CT, Kumarian Press, 1984.");
  });
  test("a page number and a running head between entries are skipped", () => {
    const e = splitEntries(["1. A. Report one on health. Geneva: WHO; 2001.", "Global health report", "41", "2. B. Report two on health. Geneva: WHO; 2002.", "Global health report", "3. C. Report three on health. Geneva: WHO; 2003."]);
    expect(e.map((x) => x.text)).toEqual(["A. Report one on health. Geneva: WHO; 2001.", "B. Report two on health. Geneva: WHO; 2002.", "C. Report three on health. Geneva: WHO; 2003."]);
  });
});

test("joinLines keeps a wrapped web address whole", () => {
  expect(joinLines(["UNAIDS data. Geneva: UNAIDS; 2020 (https://www.unaids.org/en/resources/", "documents/2020/unaids-data, accessed 4 February 2021)."])).toBe(
    "UNAIDS data. Geneva: UNAIDS; 2020 (https://www.unaids.org/en/resources/documents/2020/unaids-data, accessed 4 February 2021).",
  );
});

describe("toReference", () => {
  test("reads only what is unambiguous: address, year of the work (not of access), access date", () => {
    const r = toReference("d.sec-1.1", "UNAIDS data. Geneva: UNAIDS; 2020 (https://www.unaids.org/en/data, accessed 4 February 2021).", "library/d/sections/s.md");
    expect(r).toMatchObject({ provenance: "extracted", derivedFrom: "library/d/sections/s.md", URL: "https://www.unaids.org/en/data", issued: { "date-parts": [[2020]] }, accessed: { raw: "4 February 2021" }, type: "document" });
    expect(r.title).toBeUndefined();
    expect(r.printed).toContain("UNAIDS data");
  });
  test("a journal citation is an article, with its DOI", () => {
    const r = toReference("k", "Chen L. Human resources. Lancet. 2004;364(9449):1984-90 (https://doi.org/10.1016/s0140-6736(04)17482-5).", "s");
    expect(r.type).toBe("article-journal");
    expect(r.issued).toEqual({ "date-parts": [[2004]] });
    expect(r.DOI).toBe("10.1016/s0140-6736(04)17482-5");
  });
  test("French access dates are access dates", () => {
    const r = toReference("k", "Stratégie mondiale. Genève : OMS ; 2019 (https://www.who.int/x.pdf, consulté le 18 février 2020).", "s");
    expect(r.issued).toEqual({ "date-parts": [[2019]] });
    expect(r.accessed).toEqual({ raw: "18 février 2020" });
  });
});

test("irisHandle reads handle and bitstream addresses", () => {
  expect(irisHandle("https://iris.who.int/handle/10665/43432")).toBe("10665-43432");
  expect(irisHandle("http://apps.who.int/iris/bitstream/10665/249572/1/x.pdf")).toBe("10665-249572");
  expect(irisHandle("https://www.who.int/x")).toBeUndefined();
});

describe("listsOf", () => {
  const entry = () => {
    const root = mkdtempSync(join(tmpdir(), "refx-"));
    const dir = join(root, "library", "doc");
    mkdirSync(join(dir, "sections"), { recursive: true });
    return { root, dir, w: (f: string, t: string) => writeFileSync(join(dir, "sections", f), t) };
  };
  test("a whole References section, and a chapter-end list under a heading inside a section", () => {
    const { root, dir, w } = entry();
    w("sec-001-intro.md", section("Introduction", "Some prose about 2020.\n\nReferences\n1. A. Report number one on health. Geneva: WHO; 2001.\n2. B. Report number two on health. Geneva: WHO; 2002.\nAnnex 1: Something else\nMore prose."));
    w("sec-009-references.md", section("References", "References\n1. C. Report number three on health. Geneva: WHO; 2003.\n2. D. Report number four on health. Geneva: WHO; 2004."));
    const lists = listsOf(root, dir);
    expect(lists.map((l) => [l.section, l.sectionId, l.entries.length])).toEqual([
      ["library/doc/sections/sec-001-intro.md", "sec-001", 2],
      ["library/doc/sections/sec-009-references.md", "sec-009", 2],
    ]);
  });
  test("a contents line naming References is not a list", () => {
    const { root, dir, w } = entry();
    w("page-003.md", section("Contents", "Contents\nReferences\n122\nAnnexes\n126"));
    expect(listsOf(root, dir)).toEqual([]);
  });
  test("a list at a page's foot reads on into the next page, which then holds no list of its own", () => {
    const { root, dir, w } = entry();
    w("page-010.md", section("", "Prose.\nReferences\n1. A. Report number one on health. Geneva: WHO; 2001."));
    w("page-011.md", section("", "2. B. Report number two on health. Geneva: WHO; 2002.\n3. C. Report number three on health. Geneva: WHO; 2003."));
    const lists = listsOf(root, dir);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.entries.map((e) => e.n)).toEqual([1, 2, 3]);
  });
  test("a whole References section that opens with the previous page's footnote reads the list after its heading", () => {
    // 9789240101197-eng, sec-031: the inferred split puts footnote 2 of the page before above the heading,
    // and the list was read as that one line.
    const { root, dir, w } = entry();
    w("sec-031-references.md", section("References", "2\t All linked references were accessed on 15 October 2024.\nReferences\n1.\t\nDigital implementation investment guide (DIIG). Geneva: World Health Organization; 2020 (https://iris.who.int/handle/10665/334306).\n2.\t\nDigital Health & Interoperability Working Group [website]. Digital Square; 2024 (https://wiki.digitalsquare.io/).\n3. \t\nDigitization [website]. Gartner; 2024 (https://www.gartner.com/en/glossary/digitization)."));
    const lists = listsOf(root, dir);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.entries.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(lists[0]!.entries[0]!.text).toStartWith("Digital implementation investment guide");
  });
  test("headings in the six UN languages", () => {
    const { root, dir, w } = entry();
    for (const [i, h] of ["Références", "Referencias", "Литература", "المراجع", "参考文献"].entries())
      w(`sec-00${i}.md`, section("x", `${h}\n1. A. Report number one on health. 2001.\n2. B. Report number two on health. 2002.`));
    expect(listsOf(root, dir)).toHaveLength(5);
  });
});

describe("control characters in the text layer", () => {
  test("a BEL before an entry is dropped, not kept in `printed`", () => {
    const n = toReference("x.1", "\u0007Vaccination coverage cluster surveys. Geneva: World Health Organization; 2018.", "library/x/sections/p.md");
    expect(n.printed).toBe("Vaccination coverage cluster surveys. Geneva: World Health Organization; 2018.");
  });
});
