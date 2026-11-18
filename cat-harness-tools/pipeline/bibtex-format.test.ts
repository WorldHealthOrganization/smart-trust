/**
 * The pure CSL → BibTeX formatter (bean folio-assistant-63q4). It is
 * `export-bibtex.ts`'s formatting, moved so a caller can format without the
 * script's ledger, registry and write. Output byte-identical to before over
 * all 914 qou references, measured when it moved.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Data as CSLData } from "csl-json";
import { cslToBibtex, formatPerson, ordinal, texEscape } from "./bibtex-format";
import { buildBibtex, folioBibtexTitle } from "./export-bibtex";

const garoufalidis2004 = {
  id: "garoufalidis2004",
  type: "article-journal",
  title: "On the characteristic and deformation varieties of a knot",
  author: [{ family: "Garoufalidis", given: "Stavros" }],
  "container-title": "Geometry and Topology Monographs",
  issued: { "date-parts": [[2004]] },
  volume: "7",
  page: "291-309",
  DOI: "10.2140/gtm.2004.7.291",
} as CSLData;

describe("cslToBibtex", () => {
  test("a journal article, fields aligned, pages with an en dash", () => {
    expect(cslToBibtex(garoufalidis2004)).toBe(
      [
        "@article{garoufalidis2004,",
        "  author  = {Garoufalidis, Stavros},",
        "  title   = {{On the characteristic and deformation varieties of a knot}},",
        "  journal = {Geometry and Topology Monographs},",
        "  year    = {2004},",
        "  volume  = {7},",
        "  pages   = {291--309},",
        "  doi     = {10.2140/gtm.2004.7.291},",
        "}",
      ].join("\n"),
    );
  });

  test("an annotation, when given, is a field; absent, it is not", () => {
    expect(cslToBibtex(garoufalidis2004, "[Verified] 50% sure")).toContain("annotation = {[Verified] 50\\% sure},");
    expect(cslToBibtex(garoufalidis2004, null)).not.toContain("annotation");
  });

  test("an organisation author stays whole, and a thesis's publisher is its school", () => {
    const t = cslToBibtex({ id: "who2014", type: "thesis", author: [{ literal: "World Health Organization" }], publisher: "Université" } as CSLData);
    expect(t).toContain("author = {World Health Organization}");
    expect(t).toContain("school = {Universit{\\'{e}}}");
    expect(t.startsWith("@phdthesis{who2014,")).toBe(true);
  });
});

describe("helpers", () => {
  test("texEscape escapes & and % and accents", () => expect(texEscape("A & B 5% é")).toBe("A \\& B 5\\% {\\'{e}}"));
  test("formatPerson: family, given; particle; suffix", () => {
    expect(formatPerson({ family: "Neumann", given: "Walter" })).toBe("Neumann, Walter");
    expect(formatPerson({ family: "Bruijn", given: "N. G.", "non-dropping-particle": "de" })).toBe("de Bruijn, N. G.");
    expect(formatPerson({ family: "King", given: "Martin", suffix: "Jr." })).toBe("King, Jr., Martin");
  });
  test("ordinal", () => expect([1, 2, 3, 4, 11, 21, 112].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "21st", "112th"]));
});

describe("export-bibtex header (de-hardcoded title)", () => {
  test("uses the folio config title when declared, never a hardcoded folio name", () => {
    const dir = mkdtempSync(join(tmpdir(), "bib-title-"));
    try {
      expect(folioBibtexTitle(dir)).toBe("% Bibliography");
      expect(folioBibtexTitle(dir)).not.toContain("Quantum Observable Universe");
      writeFileSync(join(dir, "sample.config.json"), JSON.stringify({ name: "sample", title: "Sample Folio" }));
      expect(folioBibtexTitle(dir)).toBe("% Bibliography for Sample Folio");
      const bib = buildBibtex([garoufalidis2004], dir);
      expect(bib).toContain("% Bibliography for Sample Folio");
      expect(bib).toContain("@article{garoufalidis2004,");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
