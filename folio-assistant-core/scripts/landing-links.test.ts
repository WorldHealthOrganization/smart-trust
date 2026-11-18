/**
 * `landingLinks` — what a folio's landing page lists besides its documents:
 * the visualisations its layer declares, when they resolve.
 */
import { describe, expect, test } from "bun:test";
import type { CatHarnessDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { landingLinks, landingPage } from "./build-document-site.js";
import { unescapeRaw } from "@litlfred/cat-harness-tools/scripts/lib/liquid-raw.ts";

const decl = (directories: unknown[]) => ({ name: "f", directories }) as unknown as CatHarnessDeclaration;
const dir = (id: string, visualiser: unknown) => ({ id, path: `${id}/`, graphTypologies: ["archimate"], coverage: { visualiser } });

describe("landingLinks", () => {
  test("writerPageLinked", () => {
    const d = decl([dir("archimate", [{ ref: "archimate/index.html", title: "ArchiMate models", writer: ["p/gen.ts"] }])]);
    expect(landingLinks(d, (p) => p === "p/gen.ts")).toEqual([{ title: "ArchiMate models", href: "archimate/" }]);
  });

  test("noPageNoWriterNotLinked", () => {
    const d = decl([dir("archimate", [{ ref: "archimate/index.html", writer: ["p/gen.ts"] }])]);
    expect(landingLinks(d, () => false)).toEqual([]);
  });

  test("stagingAbsoluteClimbingNotLinked", () => {
    const d = decl([
      dir("a", [{ ref: "a/index.html", publish: "staging-only" }]),
      dir("b", "/b/index.html"),
      dir("c", "../c/index.html"),
    ]);
    expect(landingLinks(d, () => true)).toEqual([]);
  });

  test("bareStringTitleAndMarkdown", () => {
    expect(landingLinks(decl([dir("notes", "notes/overview.md")]), () => true)).toEqual([{ title: "notes", href: "notes/overview.html" }]);
  });

  test("noDeclarationNoLinks", () => {
    expect(landingLinks(undefined, () => true)).toEqual([]);
  });
});

describe("landingPage", () => {
  test("landingPageRawBody", () => {
    const p = landingPage("default", "Documents", "<p>{{ not liquid }}</p>");
    expect(p.startsWith("---\nlayout: default\ntitle: \"Documents\"\nnav_order: 1\n---\n")).toBe(true);
    expect(p).toContain("{% raw %}\n<p>{{ not liquid }}</p>\n{% endraw %}");
  });

  test("endrawCannotClose", () => {
    const body = "a {% endraw %} b";
    const p = landingPage("default", "D", body);
    const inner = p.slice(p.indexOf("{% raw %}\n") + "{% raw %}\n".length, p.lastIndexOf("\n{% endraw %}"));
    expect(unescapeRaw(inner)).toBe(body);
  });

  test("badLayoutRefused", () => {
    expect(() => landingPage("default\ntitle: x", "D", "")).toThrow();
  });
});
