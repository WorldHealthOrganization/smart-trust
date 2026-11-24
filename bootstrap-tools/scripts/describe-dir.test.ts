/**
 * `describe-dir` — what a file or a directory is, read from itself.
 *
 * @module bootstrap-tools/scripts/describe-dir.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cellSafe, describeSubdirectory, stripHtmlComments, jsonTitle, kindNoun, kindsPhrase, leadingDoc, oneLine, readmeSummary, summaryLine, textTitle } from "./describe-dir.ts";
import { describe as describeFile } from "./readme-graph-sections.ts";

describe("leading documentation, by language", () => {
  test("tsDocCommentAfterImports", () => {
    const doc = leadingDoc('import x from "y";\n\n/**\n * Title line\n *\n * @module m\n * Prose.\n */\n', ".ts");
    expect(summaryLine(doc!)).toBe("Title line");
  });
  test("licenceHeaderSkipped", () => {
    const doc = leadingDoc("/**\n * Copyright 2026 Somebody\n */\n/**\n * What it does.\n */\n", ".ts");
    expect(summaryLine(doc!)).toBe("What it does.");
  });
  test("pythonDocstring", () => {
    expect(summaryLine(leadingDoc('#!/usr/bin/env python3\n"""Compute the thing. More."""\n', ".py")!)).toBe("Compute the thing.");
  });
  test("shellCommentBlock", () => {
    expect(summaryLine(leadingDoc("#!/bin/sh\n# ======\n# Builds the PDF.\n# ======\nset -e\n", ".sh")!)).toBe("Builds the PDF.");
  });
  test("leanModuleDoc", () => {
    expect(summaryLine(leadingDoc("import Mathlib\n/-!\n# Hecke algebras\n\nBody.\n-/\n", ".lean")!)).toBe("Hecke algebras");
  });
  test("gherkinFeatureLine", () => {
    expect(summaryLine(leadingDoc("# comment\nFeature: kg:toc — a README's own headings\n\n  Scenario: x\n", ".feature")!)).toBe("kg:toc — a README's own headings");
  });
  test("noDocIsUndefined", () => {
    expect(leadingDoc("export const x = 1;\n", ".ts")).toBeUndefined();
  });
});

describe("a file nothing inside describes", () => {
  test("kindNounsAreNeutral", () => {
    expect(kindNoun("A_census.tgz")).toBe("a compressed archive");
    expect(kindNoun("x.tar.gz")).toBe("a compressed archive");
    expect(kindNoun("bun.lock")).toBe("a dependency lockfile");
    expect(kindNoun("paper.pdf")).toBe("a PDF document");
    expect(kindNoun("x.ts")).toBeUndefined();
  });
  test("textTitleNeedsWords", () => {
    expect(textTitle("\n   Fundamental Physical Constants --- Complete Listing\n")).toBe("Fundamental Physical Constants --- Complete Listing");
    expect(textTitle("1    a0dsskgw   A T O M I C   M A S S\n")).toBeUndefined();
  });
  test("describeFileReadsCodeAndKinds", () => {
    const r = mkdtempSync(join(tmpdir(), "describe-dir-"));
    writeFileSync(join(r, "a.ts"), "/**\n * Repository folio — the collection of all papers.\n */\n");
    writeFileSync(join(r, "b.tgz"), "\u0000\u0001");
    writeFileSync(join(r, "c.bin"), "ab\u0000cd");
    writeFileSync(join(r, "d.txt"), "1 2 3\n");
    const at = new Map<string, string>();
    expect(describeFile(r, "a.ts", at)).toBe("Repository folio — the collection of all papers.");
    expect(describeFile(r, "b.tgz", at)).toBe("a compressed archive");
    expect(describeFile(r, "c.bin", at)).toBe("a file");
    expect(describeFile(r, "d.txt", at)).toBe("plain text");
    rmSync(r, { recursive: true, force: true });
  });
});

describe("a subdirectory, from what it holds", () => {
  test("jsonTitleBeforeParagraph", () => {
    expect(jsonTitle({ brief: "B.", metadata: { title: "T" } })).toBe("T");
    expect(jsonTitle({ description: "First. Second." })).toBe("First.");
    expect(jsonTitle([1])).toBeUndefined();
  });
  test("readmeSkipsWritersOwnParagraphs", () => {
    expect(readmeSummary("# x\n\n_No description is declared for `x`._\n\nPart of [L](../README.md), declared as `x`.\n", "x")).toBeUndefined();
    expect(readmeSummary("# Real title\n\nPart of [L](../README.md).\n", "x")).toBe("Real title");
  });
  test("cutNeverLeavesCodeSpanOpen", () => {
    const s = oneLine("word ".repeat(30) + "`a long code span that runs past the cut`", 160);
    expect((s.match(/`/g) ?? []).length % 2).toBe(0);
    expect(s.endsWith("…")).toBe(true);
  });
  test("kindsPhraseHasNoNumber", () => {
    expect(kindsPhrase(["a.md", "b/c.md", "d.ts", "e.tar.gz", "Makefile"])).toBe("(no extension), `.md`, `.tar.gz` and `.ts` files");
    expect(kindsPhrase(["a.a", "b.b", "c.c", "d.d", "e.e", "f.f"])).toBe("`.a`, `.b`, `.c`, `.d` and `.e` and other files");
  });
  test("onlyCommittedFilesAreRead", () => {
    // A README on disk but not in the committed list cannot move the row.
    const r = mkdtempSync(join(tmpdir(), "describe-dir-"));
    mkdirSync(join(r, "s"));
    writeFileSync(join(r, "s", "README.md"), "# s\n\nUntracked words.\n");
    writeFileSync(join(r, "s", "x.md"), "x\n");
    expect(describeSubdirectory(join(r, "s"), ["x.md"])).toEqual({ text: "`.md` files", from: "" });
    expect(describeSubdirectory(join(r, "s"), [])).toBeUndefined();
    rmSync(r, { recursive: true, force: true });
  });
});

describe("text read from a file is safe in a table cell", () => {
  test("a comment rebuilt by one removal pass is still removed (CodeQL js/incomplete-multi-character-sanitization)", () => {
    expect(cellSafe("a <!<!---->-- b")).not.toContain("<!--");
    expect(readmeSummary("Text <!<!---->-- hidden --> more.\n") ?? "").not.toContain("<!--");
  });
  test("both comment endings, and an unterminated comment, are removed", () => {
    expect(stripHtmlComments("a<!-- x -->b<!-- y --!>c<!-- z")).toBe("abc");
    expect(stripHtmlComments("<!<!---->--x")).not.toContain("<!--");
  });
  test("raw HTML outside code spans is escaped, inside them it is kept", () => {
    expect(cellSafe("a <script>x</script> `<b>`")).toBe("a &lt;script>x&lt;/script> `<b>`");
  });
  test("a title carrying HTML comes out escaped", () => {
    expect(oneLine("Title <img src=x onerror=y>")).toBe("Title &lt;img src=x onerror=y>");
  });
});
