/**
 * The library title authority order (issue #1794, owner's ruling 2026-10-01):
 * catalogue record → `referenced.json` → PDF Info `/Title` → slug, and never
 * the page-1 front-matter parse. Bean `w6fu` (ruling of 2026-10-02 on #1838)
 * adds an editor's correction at the top and a CORROBORATED extraction just
 * above the slug.
 *
 * Every junk string below is a `/Title` this corpus actually carries. The
 * fixtures for the order are the three who-iris entries whose page-1 parse was
 * wrong, with the values their records hold.
 */
import { describe, expect, test } from "bun:test";

import {
  LIBRARY_TITLE_SOURCES,
  pdfInfoTitleJunk,
  resolveLibraryTitle,
  structureTitleCandidates,
  TITLE_AUTHORITY,
} from "./library-title.ts";

describe("resolveLibraryTitle — the order", () => {
  const all = {
    slug: "who-pub-tps-931",
    "dc-record": "WHO editorial style manual",
    referenced: "A referenced title",
    "pdf-info": "A PDF Info title",
    "text-heading": "A text heading",
  };

  test("the order is exactly the rulings', with the slug as the floor", () => {
    expect(TITLE_AUTHORITY).toEqual(["editorial", "dc-record", "referenced", "pdf-info", "text-heading", "corroborated"]);
    expect(LIBRARY_TITLE_SOURCES.at(-1)).toBe("slug");
  });

  test("the Dublin Core record outranks everything", () => {
    expect(resolveLibraryTitle(all)).toEqual({ title: "WHO editorial style manual", source: "dc-record" });
  });

  test("referenced.json outranks the PDF", () => {
    const { "dc-record": _, ...rest } = all;
    expect(resolveLibraryTitle(rest)).toEqual({ title: "A referenced title", source: "referenced" });
  });

  test("the PDF Info /Title outranks the slug", () => {
    expect(resolveLibraryTitle({ slug: "s", "pdf-info": "Link Groups" })).toEqual({ title: "Link Groups", source: "pdf-info" });
  });

  test("nothing usable leaves the slug, said as such", () => {
    expect(resolveLibraryTitle({ slug: "9789240010567-eng" })).toEqual({ title: "9789240010567-eng", source: "slug" });
    expect(resolveLibraryTitle({ slug: "s", "dc-record": "  ", referenced: null })).toEqual({ title: "s", source: "slug" });
  });

  test("a junk /Title falls through to the slug rather than becoming the title", () => {
    expect(
      resolveLibraryTitle({ slug: "gurel-tat-2017-swot-analysis", "pdf-info": "Microsoft Word - gurel_emet.doc" }),
    ).toEqual({ title: "gurel-tat-2017-swot-analysis", source: "slug" });
  });

  test("a record is taken as written, even where the junk filter would refuse it", () => {
    // The filter is for what a program wrote, not for what a cataloguer did.
    expect(resolveLibraryTitle({ slug: "s", "dc-record": "Untitled" }).source).toBe("dc-record");
  });

  test("an editor's correction outranks even the catalogue record (w6fu)", () => {
    expect(resolveLibraryTitle({ ...all, editorial: "An editor's title" })).toEqual({ title: "An editor's title", source: "editorial" });
  });

  test("a corroborated extraction ranks below every other source and above the slug (w6fu)", () => {
    expect(resolveLibraryTitle({ slug: "s", "pdf-info": "Link Groups", corroborated: "Something else" }).source).toBe("pdf-info");
    expect(resolveLibraryTitle({ slug: "s", corroborated: "Agent Skill best practices" })).toEqual({
      title: "Agent Skill best practices",
      source: "corroborated",
    });
  });

  test("a corroborated extraction still passes the junk filter", () => {
    expect(resolveLibraryTitle({ slug: "s", corroborated: "Microsoft Word - dp1.doc" }).source).toBe("slug");
  });

  test("whitespace inside a title is collapsed", () => {
    expect(resolveLibraryTitle({ slug: "s", "pdf-info": "JSON-LD\n  1.1" }).title).toBe("JSON-LD 1.1");
  });
});

describe("structureTitleCandidates — the page-1 parse is never a title", () => {
  test("a pdf-structure offers its Info /Title and NOT metadata.title", () => {
    const st = structureTitleCandidates({
      _schema: "pdf-structure/v1",
      source: { file: "WHO_PUB_TPS_93.1.pdf" },
      metadata: { title: "Abies", docinfo: { Producer: "Pixel Translations" } },
    });
    expect(st.candidates["pdf-info"]).toBeUndefined();
    expect(st.candidates["text-heading"]).toBeUndefined();
    expect(resolveLibraryTitle({ slug: "who-pub-tps-931", ...st.candidates })).toEqual({
      title: "who-pub-tps-931",
      source: "slug",
    });
  });

  test("a pdf-structure with a /Title offers it, with where it was read", () => {
    const st = structureTitleCandidates({
      _schema: "pdf-structure/v1",
      source: { file: "w3c-2020-json-ld-1-1.pdf" },
      metadata: { title: "JSON-LD 1.1 This version: Latest published version:", docinfo: { Title: "JSON-LD 1.1" } },
    });
    expect(st.candidates["pdf-info"]).toBe("JSON-LD 1.1");
    expect(st.from["pdf-info"]).toBe("structure.json metadata.docinfo.Title");
  });

  test("an UNVERIFIED metadata.title is still the page-1 parse and is never offered", () => {
    const st = structureTitleCandidates({
      _schema: "pdf-structure/v1",
      source: { file: "x.pdf" },
      metadata: { title: "Algorithmic Approaches to", title_verified: false },
    });
    expect(st.candidates.corroborated).toBeUndefined();
  });

  test("a VERIFIED metadata.title is offered as corroborated (w6fu)", () => {
    const st = structureTitleCandidates({
      _schema: "pdf-structure/v1",
      source: { file: "x.pdf" },
      metadata: { title: "Agent Skills", title_source: "heading", title_verified: true },
    });
    expect(st.candidates.corroborated).toBe("Agent Skills");
    expect(st.from.corroborated).toBe("structure.json metadata.title");
  });

  test("an editor's title_correction is offered as editorial, on any variant (w6fu)", () => {
    const st = structureTitleCandidates({
      _schema: "pdf-structure/v1",
      source: { file: "x.pdf" },
      metadata: { title: "Digital implementation", title_correction: { title: "Digital implementation investment guide (DIIG)" } },
    });
    expect(st.candidates.editorial).toBe("Digital implementation investment guide (DIIG)");
    expect(resolveLibraryTitle({ slug: "x", ...st.candidates }).source).toBe("editorial");
  });

  test("a text or notebook structure offers its declared title as text-heading", () => {
    const st = structureTitleCandidates({ _schema: "text-structure/v1", source: { file: "reference.md" }, metadata: { title: "Gherkin Reference" } });
    expect(st.candidates["text-heading"]).toBe("Gherkin Reference");
    expect(st.candidates["pdf-info"]).toBeUndefined();
  });

  test("a text heading that is only the file name is refused", () => {
    const st = structureTitleCandidates({ _schema: "notebook-structure/v1", source: { file: "nb.ipynb" }, metadata: { title: "nb" } });
    expect(resolveLibraryTitle({ slug: "x", ...st.candidates }).source).toBe("slug");
  });
});

describe("pdfInfoTitleJunk — measured on this corpus", () => {
  const junk: Array<[string, string[], string | undefined]> = [
    ["Microsoft Word - gurel_emet.doc", [], undefined],
    ["(Microsoft Word - dp1.LSA_Intr\\311)", [], undefined],
    ["How AI-Mediated RACI Matrix.pdf", [], undefined],
    ["arXiv:0909.4061v2  [math.NA]  14 Dec 2010", [], undefined],
    ["untitled", [], undefined],
    ["Untitled document", [], undefined],
    ["", [], undefined],
    ["12", [], undefined],
    ["2026-07-28", [], undefined],
    ["WHO_PUB_TPS_93.1", ["WHO_PUB_TPS_93.1.pdf"], undefined],
    ["9789240010567-eng", [], "9789240010567-eng"],
  ];
  test.each(junk)("refuses %p", (t, files, slug) => expect(pdfInfoTitleJunk(t, files, slug)).not.toBeNull());

  const usable = [
    "Link Groups",
    "JSON-LD 1.1",
    "RFC 2119: Key words for use in RFCs to Indicate Requirement Levels | RFC Editor",
    '"SWOT analysis" in: Wiley Encyclopedia of Management Online',
    "WHO SMART guidelines: optimising country-level use of guideline recommendations in the digital age",
    "MerLean: An Agentic Framework for Autoformalization in Quantum Computation",
  ];
  test.each(usable)("accepts %p", (t) => expect(pdfInfoTitleJunk(t, ["x.pdf"], "x")).toBeNull());
});
