import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBook, danglingFragments, githubSlug, readmeOrder, sectionId } from "./readme-book.ts";

describe("the README page — every README on one page", () => {
  test("rootFirstThenByPath", () => {
    expect(readmeOrder(["b/README.md", "README.md", "a/x/README.md", "a/README.md", "a/notes.md"])).toEqual([
      "README.md",
      "a/README.md",
      "a/x/README.md",
      "b/README.md",
    ]);
  });

  test("sectionIdsFromDirectory", () => {
    expect(sectionId("README.md")).toBe("readme");
    expect(sectionId("schemas/README.md")).toBe("schemas");
    expect(sectionId("a/B c/README.md")).toBe("a-b-c");
  });

  test("githubSlug", () => {
    expect(githubSlug("Who takes part")).toBe("who-takes-part");
    expect(githubSlug("FR-1: `x`")).toBe("fr-1-x");
  });

  const root = mkdtempSync(join(tmpdir(), "readme-book-"));
  mkdirSync(join(root, "skills"), { recursive: true });
  writeFileSync(join(root, "skills", "a.md"), "a\n");
  const readmes = new Map([
    ["README.md", "# Top\n\nSee [the skills](skills/README.md#every-file) and [a](skills/a.md).\n\n## Every file\n\ntext\n"],
    ["skills/README.md", "# skills\n\nBack [up](../README.md#every-file).\n\n## Every file\n\n```md\n## not a heading\n```\n"],
  ]);
  const book = buildBook(root, readmes, { title: "T" });

  test("tocFragmentsLand", () => {
    expect(book.markdown).toContain("1. [Top](#readme) — `README.md`");
    expect(book.markdown).toContain("   - [Every file](#readme--every-file)");
    expect(book.markdown).toContain("2. [skills](#skills) — `skills/README.md`");
    expect(book.markdown).toContain("   - [Every file](#skills--every-file)");
    expect(danglingFragments(book.markdown)).toEqual([]);
    expect(book.problems).toEqual([]);
  });

  test("headingsDemotedNotInCode", () => {
    expect(book.markdown).toContain('### <a id="skills--every-file"></a>Every file');
    expect(book.markdown).toContain("## not a heading");
  });

  test("readmeLinksBecomeAnchors", () => {
    expect(book.markdown).toContain("[the skills](#skills--every-file)");
    expect(book.markdown).toContain("[up](#readme--every-file)");
    expect(book.markdown).toContain("[a](skills/a.md)");
  });

  test("deadLinkIsProblem", () => {
    const bad = buildBook(root, new Map([["README.md", "# x\n\n[gone](missing.md) and [nope](#nowhere)\n"]]), { title: "T" });
    expect(bad.problems.length).toBe(2);
  });
});
