/**
 * Fields cat-harness-tools' generators write into two site indexes, which these
 * strict schemas did not know: the translation drawer's `files` and
 * `officiality` (bean `cat-tools-bbnd`), and the schema page's `sources`
 * (bean `folio-assistant-1nu0`). Each failed `check:kind-validators` once the
 * built-at-publish pages were validated (folio-assistant#2611).
 */
import { describe, expect, test } from "bun:test";
import { LibraryIndexEntrySchema, SchemaGraphIndexSchema, TranslationStatusSchema } from "./ui/site-indexes.ts";

const counts = { entries: 4, translated: 3, fuzzy: 0, untranslated: 1 };

const status = (locale: Record<string, unknown>) => ({
  $schema: "folio-translation-status/v1",
  changedAt: "2026-10-20",
  scope: "translations",
  locales: [{ locale: "fr", templates: 2, catalogues: 1, ...counts, unreadable: [], ...locale }],
});

describe("folio-translation-status/v1 carries the drawer's fields", () => {
  test("per-catalogue rows and officiality parse", () => {
    const r = TranslationStatusSchema.safeParse(
      status({
        files: [{ path: "site/x.po", official: "no", ...counts }],
        officiality: { state: "unofficial", officialCatalogues: 0, findings: 0 },
      }),
    );
    expect(r.error?.issues ?? []).toEqual([]);
  });

  test("the status page the drawer links parses", () => {
    const r = TranslationStatusSchema.safeParse({ ...status({}), page: "en/cat-harness/translation-status/index.md" });
    expect(r.error?.issues ?? []).toEqual([]);
  });

  test("an index written before the fields existed still parses", () => {
    expect(TranslationStatusSchema.safeParse(status({})).success).toBe(true);
  });

  test("an officiality state outside the four is refused", () => {
    const r = TranslationStatusSchema.safeParse(
      status({ officiality: { state: "signed", officialCatalogues: 0, findings: 0 } }),
    );
    expect(r.success).toBe(false);
  });
});

describe("folio-schema-graph/v1 carries the source-descriptor rows", () => {
  const index = (extra: Record<string, unknown>) => ({
    $schema: "folio-schema-graph/v1",
    roots: [],
    modules: [],
    decls: [],
    edges: [],
    ...extra,
  });

  test("a row with every optional field parses", () => {
    const r = SchemaGraphIndexSchema.safeParse(
      index({
        sources: [
          {
            id: "iris",
            file: "who-iris/sources/iris.json",
            instance: "who-iris",
            title: "WHO IRIS",
            identifiers: [{ name: "handle", authoritative: true, example: "10665/1" }],
            enumeration: { method: "oai-pmh", pageSize: 100 },
            character: { remote: true, large: true, volatility: "low", availability: "high", hasOwnSearch: true },
          },
        ],
      }),
    );
    expect(r.error?.issues ?? []).toEqual([]);
  });

  test("an unknown key on a row is still refused", () => {
    const r = SchemaGraphIndexSchema.safeParse(index({ sources: [{ id: "a", file: "f", instance: "i", extra: 1 }] }));
    expect(r.success).toBe(false);
  });
});

describe("folio-library-index/v1 entries carry catalogue and upstream links (#1752, #1765)", () => {
  const baseEntry = {
    id: "wpr-rdo-2020-003-eng",
    instance: "who-iris",
    dir: "who-iris/library/wpr-rdo-2020-003-eng",
    title: "WHO Western Pacific Region",
    provenance: "ingested",
    rung: "paged" as const,
    docId: "wpr-rdo-2020-003-eng",
    sourceFile: "wpr.pdf",
    sourceSha256: "a".repeat(64),
    arxiv: "",
    doi: "",
    documentClass: "report",
    sections: 3,
    blocks: 10,
    images: 1,
    ocrPages: 0,
    hasOcr: false,
    hasManifest: true,
    hasStructure: true,
    hasImagesJson: true,
    pageStart: 1,
    pageEnd: 10,
    words: 1000,
    chars: 6000,
    bytes: 50000,
    upload: "absent" as const,
    uploadInstance: "",
  };

  test("an entry with catalogue and upstream metadata parses", () => {
    const r = LibraryIndexEntrySchema.safeParse({
      ...baseEntry,
      catalogue: {
        record: "who-iris/catalogue/records/wpr-rdo-2020-003-eng.dc.json",
        handle: "10665/332098",
        xml: "who-iris/dublin-core/wpr-rdo-2020-003-eng.dc.xml",
        node: "who-iris/catalogue/nodes/wpr-rdo-2020-003-eng.json",
      },
      upstream: [{ label: "wpr.pdf", href: "https://iris.who.int/bitstream/10665/332098/1/wpr.pdf" }],
    });
    expect(r.error?.issues ?? []).toEqual([]);
  });

  test("a catalogued entry whose id has capitals has a view that parses", () => {
    const r = LibraryIndexEntrySchema.safeParse({ ...baseEntry, view: "/library/who-iris/WHO-2019-nCoV-eng/" });
    expect(r.error?.issues ?? []).toEqual([]);
  });

  test("a view without its leading or trailing slash is refused", () => {
    expect(LibraryIndexEntrySchema.safeParse({ ...baseEntry, view: "library/who-iris/x/" }).success).toBe(false);
    expect(LibraryIndexEntrySchema.safeParse({ ...baseEntry, view: "/library/who-iris/x" }).success).toBe(false);
  });

  test("an unknown key inside catalogue is refused", () => {
    const r = LibraryIndexEntrySchema.safeParse({
      ...baseEntry,
      catalogue: { record: "who-iris/catalogue/records/x.dc.json", extra: true },
    });
    expect(r.success).toBe(false);
  });
});

