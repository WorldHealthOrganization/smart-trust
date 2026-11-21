/**
 * Which page documents a directory is read from the pages (#1168 B7c).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { docsPages, documentingPages, metaDocuments } from "../docs-declarations.js";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "docs-decl-"));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  return root;
}

const md = (documents: string[]): string =>
  `---\ntitle: t\ndocuments:\n${documents.map((d) => `  - ${d}\n`).join("")}---\n# t\n`;

const files = {
  "platform/docs/beans.md": md(["beans"]),
  "platform/docs/tool-graph.md": md(["platform/tools"]),
  "platform/docs/plain.md": "---\ntitle: plain\n---\n# plain\n",
  "domain/docs/index.html": '<html><head><title>x</title><meta name="documents" content="catalogue"></head></html>',
  "stranger/docs/beans.md": md(["beans"]),
};

describe("reading the declarations", () => {
  test("the meta element, split on whitespace or commas", () => {
    expect(metaDocuments('<meta name="documents" content="a, b c">')).toEqual(["a", "b", "c"]);
    expect(metaDocuments("<title>none</title>")).toEqual([]);
  });

  test("markdown front matter and HTML meta; a page declaring nothing is not a docs page", () => {
    const root = repo(files);
    const pages = docsPages(root, Object.keys(files));
    expect(pages.map((p) => p.page).sort()).toEqual([
      "domain/docs/index.html",
      "platform/docs/beans.md",
      "platform/docs/tool-graph.md",
      "stranger/docs/beans.md",
    ]);
    expect(pages.find((p) => p.page === "domain/docs/index.html")).toEqual({
      page: "domain/docs/index.html",
      instance: "domain",
      documents: ["catalogue"],
    });
  });
});

describe("which pages document a directory", () => {
  const root = repo(files);
  const pages = docsPages(root, Object.keys(files));
  const reach = [join(root, "domain"), join(root, "platform")];

  test("a kind claim reaches every directory of that kind within reach, and no further", () => {
    expect(
      documentingPages({ instance: "domain", id: "beans", graphTypologies: ["beans"] }, pages, root, reach),
    ).toEqual(["platform/docs/beans.md"]);
  });

  test("a directory claim names one directory, whatever its kind", () => {
    expect(
      documentingPages({ instance: "platform", id: "tools", graphTypologies: ["tools"] }, pages, root, reach),
    ).toEqual(["platform/docs/tool-graph.md"]);
    expect(
      documentingPages({ instance: "domain", id: "tools", graphTypologies: ["tools"] }, pages, root, reach),
    ).toEqual([]);
  });

  test("a directory nothing declares is undocumented", () => {
    expect(
      documentingPages({ instance: "domain", id: "voices", graphTypologies: ["voices"] }, pages, root, reach),
    ).toEqual([]);
  });
});
