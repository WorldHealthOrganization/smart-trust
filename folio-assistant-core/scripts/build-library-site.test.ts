/**
 * A folio's library on its own site (bean zcak): the Document view, with
 * [source] and [feedback] on the library's own files and [edit] on the folio
 * block each section was materialised as (owner, 2026-10-07: "if viewing in
 * library, edit -> materialized version in folio/'s edit").
 */
import { describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildLibrarySite, entryContents, entryView, HANDLER, LIB_CLASS, materialisedEdits, siteReads } from "./build-library-site.js";

const ENTRY = "review-v1";
const FIXTURE = join(import.meta.dir, "test-fixtures", "library-structure.json");

/** A folio with a library entry (a trimmed DPI-H structure) and the document made from it. */
function scaffold(anchorsExtra: Record<string, unknown> = {}): string {
  const d = mkdtempSync(join(tmpdir(), "libsite-"));
  writeFileSync(
    join(d, "doc.json"),
    JSON.stringify({ name: "doc", directories: [{ id: "folio", path: "folio/", graphTypologies: ["folio"] }, { id: "library", path: "library/", graphTypologies: ["library"] }] }),
  );
  mkdirSync(join(d, "library", ENTRY), { recursive: true });
  copyFileSync(FIXTURE, join(d, "library", ENTRY, "structure.json"));
  const doc = join(d, "folio", "doc");
  mkdirSync(join(doc, "ch1"), { recursive: true });
  writeFileSync(join(doc, "doc.ts"), `export default { title: "The Handbook", chapters: [] };\n`);
  writeFileSync(join(doc, "ch1", "p-1-1.md"), "About.\n");
  writeFileSync(join(doc, "ch1", "p-1-1-1.md"), "What is.\n");
  writeFileSync(
    join(doc, "review-anchors.json"),
    JSON.stringify({
      $schema: "folio-review-anchors/v1",
      document: "doc",
      library: ENTRY,
      ...anchorsExtra,
      sections: [
        { label: "sec:1-1", number: "1.1", title: "About" },
        { label: "sec:1-1-1", number: "1.1.1", title: "What is a reference architecture" },
      ],
      blocks: [
        { label: "prose:1-1", chapter: "ch1", root: "p-1-1", sections: ["sec:1-1"] },
        { label: "prose:1-1-1", chapter: "ch1", root: "p-1-1-1", sections: ["sec:1-1-1"] },
      ],
    }),
  );
  return d;
}

describe("build-library-site (bean zcak)", () => {
  test("entryTitleSaysSource", () => {
    const plain = scaffold();
    expect(entryView(plain, join(plain, "library", ENTRY))!.title).toBe("The Handbook — the version published for public comment");
    const labelled = scaffold({ sourceLabel: "the TWG outline it was seeded from" });
    expect(entryView(labelled, join(labelled, "library", ENTRY))!.title).toBe("The Handbook — the TWG outline it was seeded from");
  });

  test("sectionMapsToFolioBlock", () => {
    const d = scaffold();
    const editFor = materialisedEdits(d, ENTRY)!;
    expect(editFor({ id: "x", number: "1.1.1", title: "anything" })).toEqual({ path: "folio/doc/ch1/p-1-1-1.md", label: "prose:1-1-1" });
    expect(editFor({ id: "x", number: null, title: "About" })?.path).toBe("folio/doc/ch1/p-1-1.md");
    expect(editFor({ id: "x", number: null, title: "Front matter" })).toBeUndefined();
    expect(materialisedEdits(d, "some-other-entry")).toBeUndefined();
  });

  test("entryPageUnderHandlerRoute", () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = buildLibrarySite(d, out, { repo: "o/r" });
    expect(r.entries).toEqual([expect.objectContaining({ id: ENTRY, sections: 3, editable: 2 })]);
    const at = join(out, HANDLER, "library", ENTRY);
    const view = JSON.parse(readFileSync(join(at, "entries", `${ENTRY}.doc.json`), "utf-8"));
    // The document's own title, never the page-1 guess.
    expect(view.title).toContain("The Handbook");
    expect(view.links).toEqual({ repo: "o/r", branch: "main", dir: `library/${ENTRY}` });
    const edits = view.sections.map((s: { edit?: { path: string } }) => s.edit?.path ?? null);
    expect(edits).toEqual(["folio/doc/ch1/p-1-1.md", "folio/doc/ch1/p-1-1-1.md", null]);
    // The page is under the locale and its data is not (#2527): the page
    // reads the data where it is, and nothing is left at the old address.
    const html = readFileSync(join(out, "en", HANDLER, "library", ENTRY, "index.html"), "utf-8");
    expect(html).toContain("function faBlockUrls");
    expect(html).toContain("loadDocument(");
    expect(html).toContain(`new URL("../../../../${HANDLER}/library/${ENTRY}/index.json", location.href)`);
    expect(html).toContain(`href="../../../../${HANDLER}/library/${ENTRY}/entries/${ENTRY}.doc.json"`);
    expect(existsSync(join(at, "index.html"))).toBe(false);
    expect(readFileSync(join(out, "en", HANDLER, "library", "index.html"), "utf-8")).toContain(`href="${ENTRY}/"`);
    expect(existsSync(join(out, HANDLER, "library", "index.html"))).toBe(false);
  });

  test("themedWithLayout", () => {
    const d = scaffold();
    const out = join(d, "_t");
    buildLibrarySite(d, out, { repo: "o/r", layout: "default" });
    const html = readFileSync(join(out, "en", HANDLER, "library", ENTRY, "index.html"), "utf-8");
    // A Jekyll page in the site's layout, so the theme wraps it (#805).
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toContain("<!doctype html>");
    expect(html).not.toContain("max-width: 72rem");
    expect(html).toContain("{% raw %}");
    expect(html).toContain(`<div class="${LIB_CLASS}"><div class="lib-page">`);
    expect(html).toContain("loadDocument(");
    expect(html).toContain("data-fa-visualiser-nav");
    const index = readFileSync(join(out, "en", HANDLER, "library", "index.html"), "utf-8");
    expect(index.startsWith("---\nlayout: default\n")).toBe(true);
    expect(index).toContain(`href="${ENTRY}/"`);
    // Without --layout the page is the standalone one, unchanged.
    buildLibrarySite(d, join(d, "_p"), { repo: "o/r" });
    expect(readFileSync(join(d, "_p", "en", HANDLER, "library", ENTRY, "index.html"), "utf-8").startsWith("<!doctype html>")).toBe(true);
    expect(() => buildLibrarySite(d, join(d, "_x"), { layout: "bad name" })).toThrow(/not a layout name/);
  });

  test("saysWhatItReads", () => {
    const d = scaffold();
    expect(siteReads(d)).toEqual(["library", "folio"]);
  });

  test("sectionsDeclaredToRail", () => {
    const d = scaffold();
    const view = entryView(d, join(d, "library", ENTRY), "o/r")!;
    const decl = entryContents(view);
    const json = JSON.parse(/<script[^>]*data-fa-visualiser-nav[^>]*>([\s\S]*?)<\/script>/.exec(decl)![1]!);
    expect(json.length).toBeGreaterThanOrEqual(1);
    expect(json[0].href).toMatch(/^#sec-/);
    buildLibrarySite(d, join(d, "_s"), { repo: "o/r" });
    expect(readFileSync(join(d, "_s", "en", HANDLER, "library", ENTRY, "index.html"), "utf-8")).toContain("data-fa-visualiser-nav");
  });
});
