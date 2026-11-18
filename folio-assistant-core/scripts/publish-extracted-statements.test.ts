import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import type { BaseSection } from "@litlfred/cat-harness-tools/schemas/content/document-structure.ts";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cell, locatorLabel, publishPage, renderPage, resolveSource, sectionForPage } from "./publish-extracted-statements.ts";
import { EXTRACTED_STATEMENTS_SCHEMA_ID, ExtractedStatementsSchema } from "../schemas/extracted-statement.ts";

const REPO = resolve(import.meta.dir, "../..");
const WHO_IRIS = resolve(REPO, "who-iris");

function paged(id: string, title: string, start: number, end: number): BaseSection {
  return { id, number: null, title, level: 1, n_chars: 1, n_words: 1, locator: { kind: "pages", start, end } };
}

describe("the section a page falls in", () => {
  const sections = [paged("a", "Intro", 1, 3), paged("b", "Catch up schedule", 3, 7), paged("c", "Annex", 8, 9)];

  it("sectionStartingLatestAtOrBeforePage", () => {
    expect(sectionForPage(sections, 3)?.id).toBe("b");
    expect(sectionForPage(sections, 7)?.id).toBe("b");
    expect(sectionForPage(sections, 1)?.id).toBe("a");
  });

  it("noSectionWhenSeveralStartOnPage", () => {
    const poster = [paged("p1", "Heading", 1, 1), paged("p2", "Table", 1, 1)];
    expect(sectionForPage(poster, 1)).toBeUndefined();
  });

  it("skipsSynthesisedFrontMatter", () => {
    const withFront = [paged("sec-front-matter", "Front matter", 1, 2), paged("s1", "Schedule", 1, 3)];
    expect(sectionForPage(withFront, 1)?.id).toBe("s1");
    expect(sectionForPage([paged("sec-front-matter", "Front matter", 1, 2), paged("s1", "Schedule", 3, 4)], 2)?.id).toBe("sec-front-matter");
  });

  it("noSectionBeforeFirst", () => {
    expect(sectionForPage([paged("x", "X", 4, 5)], 2)).toBeUndefined();
  });
});

describe("a table cell", () => {
  it("cellEscapesBackslashBeforePipe", () => {
    expect(cell("a\\|b")).toBe("a\\\\\\|b");
    expect(cell("x | y")).toBe("x \\| y");
    expect(cell("one\n  two")).toBe("one two");
  });
});

describe("labels", () => {
  it("locatorLabelSingularAndPlural", () => {
    expect(locatorLabel({ one: "slide", many: "slides" }, 7, 7)).toBe("slide 7");
    expect(locatorLabel({ one: "page", many: "pages" }, 3, 5)).toBe("pages 3–5");
  });
});

describe("resolving a source against a real library entry", () => {
  const statement = (source: Record<string, unknown>) => ({ id: "s1", statement: "x", source: { libraryId: "wpr-rdo-2020-003-eng", ...source } });

  it("resolvesSectionAndPage", () => {
    const r = resolveSource(statement({ sectionId: "page-012" }), WHO_IRIS, REPO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source.sectionPath).toBe("who-iris/library/wpr-rdo-2020-003-eng/sections/page-012.md");
      expect(r.source.label.toLowerCase()).toBe("page 12");
    }
  });

  it("resolvesSectionFromPage", () => {
    const r = resolveSource(statement({ page: 12 }), WHO_IRIS, REPO);
    expect(r.ok && r.source.sectionPath).toBe("who-iris/library/wpr-rdo-2020-003-eng/sections/page-012.md");
  });

  it("refusesUnresolvedSource", () => {
    expect(resolveSource(statement({ sectionId: "no-such-section" }), WHO_IRIS, REPO).ok).toBe(false);
    expect(resolveSource(statement({}), WHO_IRIS, REPO).ok).toBe(false);
    expect(resolveSource({ id: "s", statement: "x", source: { libraryId: "never-ingested" } }, WHO_IRIS, REPO).ok).toBe(false);
  });
});

describe("the page", () => {
  const list = ExtractedStatementsSchema.parse({
    _schema: EXTRACTED_STATEMENTS_SCHEMA_ID,
    title: "Recommendations",
    statements: [{ id: "r1", statement: "Give dose 1 | at birth.", status: "candidate", source: { libraryId: "deck", page: 7 } }],
  });
  const page = renderPage([{ list, resolved: [{ libraryId: "deck", sectionPath: "lib/deck/sections/s3.md", label: "Catch up schedule, slide 7" }] }], {
    title: "Extracted statements",
    entryBase: "https://example.org/library/",
    sectionBase: "https://example.org/blob/main",
    tableAttr: "{:.grid}",
  });

  it("pageLinksEntryAndSection", () => {
    expect(page).toContain("[deck](https://example.org/library/deck/): [Catch up schedule, slide 7](https://example.org/blob/main/lib/deck/sections/s3.md)");
  });

  it("pageEscapesPipesAndCarriesLook", () => {
    expect(page).toContain("Give dose 1 \\| at birth.");
    expect(page).toContain("{:.grid}");
  });

  it("pageIsDeterministic", () => {
    const again = renderPage([{ list, resolved: [{ libraryId: "deck", sectionPath: "lib/deck/sections/s3.md", label: "Catch up schedule, slide 7" }] }], {
      title: "Extracted statements",
      entryBase: "https://example.org/library/",
      sectionBase: "https://example.org/blob/main",
      tableAttr: "{:.grid}",
    });
    expect(again).toBe(page);
  });
});

describe("a page built from its spec", () => {
  function fixture(source: Record<string, unknown>) {
    const dir = mkdtempSync(join(tmpdir(), "pes-"));
    writeFileSync(join(dir, "list.json"), JSON.stringify({
      _schema: EXTRACTED_STATEMENTS_SCHEMA_ID,
      statements: [{ id: "r1", statement: "A statement.", source: { instance: "who-iris", libraryId: "wpr-rdo-2020-003-eng", ...source } }],
    }));
    writeFileSync(join(dir, "page.json"), JSON.stringify({
      _schema: "folio-statement-page/v1",
      statements: ["list.json"],
      out: "out/page.md",
      title: "Extracted statements",
      entryBase: "https://example.org/library",
      sectionBase: "https://example.org/blob/main",
    }));
    return dir;
  }
  const opts = (check: boolean) => ({ check, repoRoot: REPO, instanceRoot: REPO });

  it("publishThenCheckCurrentThenStale", () => {
    const dir = fixture({ page: 12 });
    expect(publishPage(join(dir, "page.json"), opts(false))).toBe(0);
    expect(readFileSync(join(dir, "out/page.md"), "utf8")).toContain("sections/page-012.md");
    expect(publishPage(join(dir, "page.json"), opts(true))).toBe(0);
    writeFileSync(join(dir, "out/page.md"), "edited by hand\n");
    expect(publishPage(join(dir, "page.json"), opts(true))).toBe(1);
  });

  it("writesNothingWhenUnresolved", () => {
    const dir = fixture({ sectionId: "no-such-section" });
    expect(publishPage(join(dir, "page.json"), opts(false))).toBe(1);
    expect(existsSync(join(dir, "out/page.md"))).toBe(false);
  });
});

describe("derived statements", () => {
  const resolved = [{ libraryId: "deck", label: "slide 7" }];
  const base = { title: "T", entryBase: "https://example.org/l", sectionBase: "https://example.org/b" };
  const list = (derivedFrom?: string) =>
    ExtractedStatementsSchema.parse({
      _schema: EXTRACTED_STATEMENTS_SCHEMA_ID,
      statements: [{ id: "S1", statement: "s", ...(derivedFrom ? { derivedFrom } : {}), source: { libraryId: "deck", page: 7 } }],
    });

  it("derivedFromColumnOnlyWhenListHasOne", () => {
    expect(renderPage([{ list: list("R01"), resolved }], base)).toContain("| S1 | s |  |  | R01 | [deck]");
    expect(renderPage([{ list: list(), resolved }], base)).not.toContain("Derived from");
  });
});
