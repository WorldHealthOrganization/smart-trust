/**
 * The document-kinds viewer draws what a kind declares, and refuses an invalid one.
 *
 * Calibrated: rendering only `k.sections.slice(1)` in `kindCard` fails the
 * "every section" test.
 *
 * The tests of this file that read the whole checkout (reads the DAK document
 * kind smart-base declares) live in `test/document-kinds-viz-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { pageHtml, readDocumentKinds, subjectEntries } from "../gen-document-kinds-viz.ts";
import { unscopedSelectors } from "../lib/themed-page.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

describe("an invalid kind is refused, not drawn", () => {
  it("throws naming the file", () => {
    const repo = mkdtempSync(join(REPO, "doc-kinds-scratch-"));
    try {
      writeFileSync(join(repo, "scratch.json"), JSON.stringify({ name: "scratch", directories: [{ id: "k", path: "kinds/", graphTypologies: ["document-kinds"] }] }));
      mkdirSync(join(repo, "kinds"));
      writeFileSync(join(repo, "kinds", "bad.json"), JSON.stringify({ $schema: "document-kind/1.0.0", id: "bad", title: "Bad", description: "x", structure: "fixed", sections: [], sources: [] }));
      expect(() => readDocumentKinds(REPO)).toThrow(/bad\.json/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("the page is THEMED, so it carries the site's top band (2026-10-07)", () => {
  const html = pageHtml([], "scratch");

  it("is on the default layout, not a standalone document", () => {
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).toContain('title: "Document kinds — scratch"');
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(html).toContain('<h1 id="dk-title">');
  });

  it("styles nothing outside its own wrapper", () => {
    expect(unscopedSelectors(html, ".dk-page")).toEqual([]);
  });
});

describe("every instance declaring a document-kinds directory gets a page (fa#2739)", () => {
  const kind = { id: "dak", title: "DAK", description: "x", structure: "fixed", sections: [], sources: [] } as never;
  const kinds = [
    { instance: "base", file: "base/k/dak.json", kind, coverage: [{ subject: "ig" }] as never },
  ];
  const dirs = [{ instance: "base" }, { instance: "ig" }, { instance: "empty" }];
  const pages = subjectEntries(kinds, dirs);

  it("draws a subject with no kind of its own", () => {
    expect([...pages.keys()]).toEqual(["base", "empty", "ig"]);
  });

  it("shows a subject the kinds it reports coverage of", () => {
    expect(pages.get("ig")!.map((k) => k.kind.id)).toEqual(["dak"]);
    expect(pages.get("empty")).toEqual([]);
  });

  it("says why an empty subject's page is empty", () => {
    expect(pageHtml([], "empty")).toContain("empty declares a document-kinds directory, and it holds no kind or coverage report yet.");
  });
});
