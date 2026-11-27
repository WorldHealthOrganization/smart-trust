// Language versions and summary of a library entry (who-iris#217): read from
// the catalogue — one item's derived PDFs, and items linked by
// who.relation.languageVersion — never guessed from slugs.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryLanguages, languageOfFile, listingTitles, slugOfLocal, summaryHtml, versionsHtml } from "../../lib/library-languages.ts";
import { upstreamPdfOf } from "../../lib/library-upstream-pdf.ts";

function layer() {
  const root = mkdtempSync(join(tmpdir(), "lib-lang-"));
  mkdirSync(join(root, "catalogue", "nodes"), { recursive: true });
  mkdirSync(join(root, "catalogue", "records"), { recursive: true });
  const rec = (id: string, fields: { schema?: string; element: string; qualifier?: string | null; values: string[] }[]) =>
    writeFileSync(join(root, "catalogue", "records", `${id}.dc.json`), JSON.stringify({
      fields: fields.map((f) => ({ schema: f.schema ?? "dc", element: f.element, qualifier: f.qualifier ?? null, values: f.values.map((value) => ({ value })) })),
    }));
  const node = (id: string, handle: string, libraryId: string, files: [string, string][]) =>
    writeFileSync(join(root, "catalogue", "nodes", `item-${id}.json`), JSON.stringify({
      handle, libraryId, metadataRef: `catalogue/records/${id}.dc.json`,
      bitstreams: files.map(([name, slug]) => ({ name, bundle: "ORIGINAL", materialization: { provenance: { local: `library/${slug}/structure.json#source` } } })),
    }));
  rec("10665-1", [
    { element: "description", qualifier: "abstract", values: ["The strategy."] },
    { schema: "who", element: "relation", qualifier: "languageVersion", values: ["10665/2"] },
    { element: "language", qualifier: "iso", values: ["en", "ar"] },
  ]);
  node("10665-1", "10665/1", "10665-1", [["s-eng.pdf", "10665-1"], ["s-ara.pdf", "10665-1-ara"]]);
  rec("10665-2", [{ element: "description", qualifier: "abstract", values: ["La stratégie."] }, { element: "language", qualifier: "iso", values: ["fr"] }]);
  node("10665-2", "10665/2", "10665-2", [["s-fre.pdf", "10665-2"]]);
  return join(root, "catalogue", "nodes");
}

describe("library entry language versions", () => {
  test("reads a file's language from its IRIS suffix, and a slug from provenance.local", () => {
    expect(languageOfFile("WHO_RHR_06.11_ara.pdf")).toBe("ar");
    expect(languageOfFile("A71_R7-ch.pdf")).toBe("zh");
    expect(languageOfFile("report.pdf")).toBeUndefined();
    expect(slugOfLocal("library/10665-1-ara/structure.json#source")).toBe("10665-1-ara");
    expect(slugOfLocal("../etc/passwd")).toBeUndefined();
  });

  test("joins one item's editions and linked items; English is the source", () => {
    const nodes = layer();
    const entries = [
      { id: "10665-1", node: join(nodes, "item-10665-1.json") },
      { id: "10665-1-ara", node: join(nodes, "item-10665-1.json") },
      { id: "10665-2", node: join(nodes, "item-10665-2.json") },
    ];
    const got = entryLanguages(entries, new Set(entries.map((e) => e.id)));
    const ara = got.get("10665-1-ara")!;
    expect(ara.lang).toBe("ar");
    expect(ara.versions.map((v) => `${v.lang}${v.source ? "*" : ""}`)).toEqual(["en*", "fr", "ar"]);
    expect(got.get("10665-2")!.abstract).toBe("La stratégie.");
    expect(got.get("10665-1")!.abstract).toBe("The strategy.");
  });

  test("a version that is not an entry of the library is not linked", () => {
    const nodes = layer();
    const got = entryLanguages([{ id: "10665-1", node: join(nodes, "item-10665-1.json") }], new Set(["10665-1"]));
    expect(got.get("10665-1")!.versions).toEqual([]);
  });

  test("the listing gets each entry's language and its held editions' titles, and none it does not hold", () => {
    const nodes = layer();
    const entries = [
      { id: "10665-1", title: "The strategy", node: join(nodes, "item-10665-1.json") },
      { id: "10665-2", title: "La stratégie", node: join(nodes, "item-10665-2.json") },
    ];
    const got = listingTitles(entries, entryLanguages(entries, new Set(entries.map((e) => e.id))));
    expect(got.get("10665-2")).toEqual({ lang: "fr", titles: { en: "The strategy" } });
    expect(got.get("10665-1")).toEqual({ lang: "en", titles: { fr: "La stratégie" } });
    const alone = listingTitles([entries[1]!], entryLanguages([entries[1]!], new Set(["10665-2"])));
    expect(alone.get("10665-2")).toEqual({ lang: "fr" });
  });

  test("the HTML escapes and names each version; no summary without an abstract", () => {
    const html = versionsHtml("10665-1", {
      lang: "en",
      versions: [{ id: "10665-1", lang: "en", source: true }, { id: "10665-2", lang: "fr", source: false }],
    }, (id) => `../${id}/`);
    expect(html).toContain('href="../10665-2/"');
    expect(html).toContain("WHO official translation");
    expect(html).toContain('aria-current="page"');
    expect(summaryHtml(undefined)).toBe("");
    expect(summaryHtml("<b>x</b>")).toContain("&lt;b&gt;");
  });

  test("a not-held entry links the file it was derived from, at its source", () => {
    const root = mkdtempSync(join(tmpdir(), "lib-up-"));
    const p = join(root, "item.json");
    writeFileSync(p, JSON.stringify({ bitstreams: [
      { name: "x-ara.pdf", bundle: "ORIGINAL", materialization: { provenance: { local: "library/x-ara/structure.json#source", upstream: "https://iris.example/bitstreams/1/download" }, fixity: { algorithm: "sha256", digest: "a".repeat(64) } } },
      { name: "x-eng.pdf", bundle: "ORIGINAL", materialization: { provenance: { local: "library/x/structure.json#source", upstream: "javascript:alert(1)" } } },
    ] }));
    expect(upstreamPdfOf(p, "x-ara")).toEqual({ file: "x-ara.pdf", href: "https://iris.example/bitstreams/1/download", sha256: "a".repeat(64) });
    expect(upstreamPdfOf(p, "x")).toBeUndefined();
    expect(upstreamPdfOf(undefined, "x")).toBeUndefined();
  });
});
