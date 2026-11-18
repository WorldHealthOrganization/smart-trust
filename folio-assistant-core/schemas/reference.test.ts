/**
 * `folio-reference/v1` (bean folio-assistant-63q4): a reference node, its
 * Dublin Core / BIBO reading, the projection from a Dublin Core record, and
 * the exports.
 *
 * The DC fixture is who-iris's `9789241548960-eng.dc.json`, cut to the fields
 * the projection reads; the CSL fixtures are entries of qou's `references.ts`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FOLIO_BASE } from "@litlfred/cat-harness-tools/schemas/kg/jsonld.ts";
import { STRUCTURE_FILENAME } from "@litlfred/cat-harness-tools/schemas/content/document-structure.ts";
import { DublinCoreRecordSchema } from "./dublin-core.ts";
import {
  REFERENCE_CONTEXT,
  REFERENCE_SCHEMA_TAG,
  ReferenceNodeSchema,
  authorsRawToNames,
  buildStandaloneReference,
  dcCreatorToName,
  dcDateToCsl,
  dublinCoreToReference,
  genReferenceJsonLd,
  jsonLdToReferenceNode,
  referenceToDublinCoreRecord,
  libraryItemToReference,
  newReferenceUrl,
  parseBibtexOrCsl,
  referenceIri,
  referenceToJsonLd,
  toBibtex,
  toCslItem,
  toCslJson,
  toDublinCoreXml,
  toJsonLdGraph,
  toRis,
  yearOf,
  type ReferenceNode,
} from "./reference.ts";

const CORE = join(import.meta.dir, "..");

const garoufalidis2004: ReferenceNode = ReferenceNodeSchema.parse({
  $schema: REFERENCE_SCHEMA_TAG,
  id: "garoufalidis2004",
  type: "article-journal",
  title: "On the characteristic and deformation varieties of a knot",
  author: [{ family: "Garoufalidis", given: "Stavros" }],
  "container-title": "Geometry and Topology Monographs",
  issued: { "date-parts": [[2004]] },
  volume: "7",
  page: "291-309",
  DOI: "10.2140/gtm.2004.7.291",
  URL: "https://doi.org/10.2140/gtm.2004.7.291",
  note: "Proceedings of the Casson Fest; arXiv:math/0306230.",
  // qou's derived block: carried, not CSL.
  library: { docId: "characteristic", dir: "library/characteristic", stage: "candidates" },
});

const handbook = DublinCoreRecordSchema.parse({
  $schema: "folio-dublin-core/v1",
  id: "63e14c27-7448-41ec-be08-a96a25a47db6",
  fields: [
    { schema: "dc", element: "contributor", qualifier: "author", values: [{ value: "World Health Organization" }] },
    { schema: "dc", element: "date", qualifier: "accessioned", values: [{ value: "2014-12-18T14:37:04Z" }] },
    { schema: "dc", element: "date", qualifier: "issued", values: [{ value: "2014-12-18" }] },
    { schema: "dc", element: "description", qualifier: "abstract", values: [{ value: "This handbook provides comprehensive guidance on WHO guidelines.", language: "en" }] },
    { schema: "dc", element: "identifier", qualifier: "isbn", values: [{ value: "9789241548960" }] },
    { schema: "dc", element: "identifier", qualifier: "uri", values: [{ value: "https://iris.who.int/handle/10665/145714" }] },
    { schema: "dc", element: "language", qualifier: "iso", values: [{ value: "en" }] },
    { schema: "dc", element: "publisher", values: [{ value: "World Health Organization" }] },
    { schema: "dc", element: "title", values: [{ value: "WHO handbook for guideline development", language: "en" }] },
  ],
  provenance: { source: "https://iris.who.int/handle/10665/145714", retrievedAt: "2026-09-20", method: "transcribed" },
});

describe("a reference node", () => {
  test("nodeAtReferencesKey", () => {
    expect(referenceIri("garoufalidis2004")).toBe("references/garoufalidis2004");
    expect(referenceToJsonLd(garoufalidis2004)["@id"]).toBe("references/garoufalidis2004");
  });

  test("keepsFieldsCslOmits", () => {
    expect((garoufalidis2004 as Record<string, unknown>).note).toContain("Casson Fest");
    expect((garoufalidis2004 as Record<string, unknown>).library).toBeDefined();
  });

  test("refusesUncitableKey", () => {
    for (const id of ["has space", "a/b", "#x", ""]) {
      expect(ReferenceNodeSchema.safeParse({ ...garoufalidis2004, id }).success).toBe(false);
    }
  });

  test("cslItemDropsNodeFields", () => {
    const item = toCslItem(garoufalidis2004);
    expect(item.$schema).toBeUndefined();
    expect(item.library).toBeUndefined();
    expect(item.id).toBe("garoufalidis2004");
    expect(item.note).toBeDefined();
  });
});

describe("read as Dublin Core and BIBO", () => {
  const ld = referenceToJsonLd(garoufalidis2004);
  test("typedFabioWorkAndBibo", () => expect(ld["@type"]).toEqual(["fabio:Work", "bibo:AcademicArticle"]));
  test("propertiesAreDctermsAndBibo", () => {
    expect(ld["dcterms:title"]).toBe("On the characteristic and deformation varieties of a knot");
    expect(ld["dcterms:creator"]).toEqual(["Garoufalidis, Stavros"]);
    expect(ld["dcterms:issued"]).toBe("2004");
    expect(ld["dcterms:isPartOf"]).toBe("Geometry and Topology Monographs");
    expect(ld["bibo:volume"]).toBe("7");
    expect(ld["bibo:pages"]).toBe("291-309");
    expect(ld["bibo:doi"]).toBe("10.2140/gtm.2004.7.291");
  });
  test("everyKeyPrefixedOrKeyword", () => {
    for (const k of Object.keys(ld)) expect(k.startsWith("@") || /^(dcterms|bibo|fabio|schema):/.test(k)).toBe(true);
  });
});

describe("from a Dublin Core record (who-iris)", () => {
  const ref = dublinCoreToReference(handbook, {
    key: "who2014handbook",
    derivedFrom: "who-iris/catalogue/records/9789241548960-eng.dc.json",
    heldAt: "who-iris/library/9789241548960-eng",
  });

  test("carriesWhatRecordStates", () => {
    expect(ref.title).toBe("WHO handbook for guideline development");
    expect(ref.author).toEqual([{ literal: "World Health Organization" }]);
    expect(ref.issued).toEqual({ "date-parts": [[2014, 12, 18]] });
    expect(ref.publisher).toBe("World Health Organization");
    expect(ref.ISBN).toBe("9789241548960");
    expect(ref.URL).toBe("https://iris.who.int/handle/10665/145714");
    expect(ref.language).toBe("en");
    expect(ref.provenance).toBe("catalogue");
    expect(ref.type).toBe("book");
  });

  test("usesDateIssued", () => expect(yearOf(ref)).toBe("2014"));

  test("infersNothingLacking", () => {
    for (const k of ["DOI", "volume", "page", "container-title", "editor"]) expect(k in ref).toBe(false);
  });

  test("passesOwnSchema", () => expect(ReferenceNodeSchema.safeParse(ref).success).toBe(true));

  test("personSplitsOrganisationWhole", () => {
    expect(dcCreatorToName("Grimm, Jacob Ludwig Karl")).toEqual({ family: "Grimm", given: "Jacob Ludwig Karl" });
    expect(dcCreatorToName("World Health Organization")).toEqual({ literal: "World Health Organization" });
  });

  test("datesYearMonthFullElseRaw", () => {
    expect(dcDateToCsl("2014")).toEqual({ "date-parts": [[2014]] });
    expect(dcDateToCsl("2014-12")).toEqual({ "date-parts": [[2014, 12]] });
    expect(dcDateToCsl("c. 1990")).toEqual({ raw: "c. 1990" });
  });
});

describe("a journal article's container and locators (bean djj5)", () => {
  // Voo et al. 2021, smart-trust's one journal article: the record must carry
  // what its CSL entry carries, or retiring references/ loses it.
  const voo: ReferenceNode = {
    $schema: "folio-reference/v1",
    id: "voo2021",
    type: "article-journal",
    title: "Immunity certification for COVID-19: ethical considerations",
    author: [{ family: "Voo", given: "TC" }],
    "container-title": "Bulletin of the World Health Organization",
    issued: { "date-parts": [[2021]] },
    volume: "99",
    issue: "2",
    page: "155–61",
    DOI: "10.2471/BLT.20.280701",
  };

  test("cslToDcWritesContainerLocators", () => {
    const rec = referenceToDublinCoreRecord(voo);
    const f = (e: string, q: string) => rec.fields.find((x) => x.element === e && x.qualifier === q)?.values[0]?.value;
    expect(f("relation", "ispartof")).toBe("Bulletin of the World Health Organization");
    expect([f("citation", "volume"), f("citation", "issue"), f("citation", "spage"), f("citation", "epage")]).toEqual(["99", "2", "155", "61"]);
  });

  test("dcToCslRoundTripKeepsLocators", () => {
    const back = dublinCoreToReference(DublinCoreRecordSchema.parse(referenceToDublinCoreRecord(voo)), { key: "voo2021" });
    expect(back["container-title"]).toBe(voo["container-title"]);
    expect([back.volume, back.issue, back.page]).toEqual(["99", "2", "155–61"]);
    expect(back.type).toBe("article-journal");
    expect(back.author).toEqual(voo.author);
  });

  test("placeAccessedVersionStatusSurvive", () => {
    const etsi = { ...voo, type: "standard", "publisher-place": "Sophia Antipolis", accessed: { "date-parts": [[2021, 6, 27]] }, version: "1.1.1", status: "forthcoming" } as ReferenceNode;
    const back = dublinCoreToReference(DublinCoreRecordSchema.parse(referenceToDublinCoreRecord(etsi)), { key: "etsi" }) as Record<string, unknown>;
    expect([back["publisher-place"], back.accessed, back.version, back.status]).toEqual(["Sophia Antipolis", { "date-parts": [[2021, 6, 27]] }, "1.1.1", "forthcoming"]);
  });

  test("igCslTypesSurvive", () => {
    for (const type of ["webpage", "standard", "legislation", "report", "book"]) {
      const back = dublinCoreToReference(DublinCoreRecordSchema.parse(referenceToDublinCoreRecord({ ...voo, type })), { key: "k" });
      expect(back.type).toBe(type);
    }
  });
});

describe("exports", () => {
  const who = dublinCoreToReference(handbook, { key: "who2014handbook" });
  const refs = [garoufalidis2004, who];

  test("cslJsonDropsNodeFields", () => {
    const items = JSON.parse(toCslJson(refs)) as Record<string, unknown>[];
    expect(items.map((i) => i.id)).toEqual(["garoufalidis2004", "who2014handbook"]);
    expect(items.every((i) => !("$schema" in i) && !("provenance" in i))).toBe(true);
  });

  test("bibtexThroughFormatter", () => {
    const bib = toBibtex(refs);
    expect(bib).toContain("@article{garoufalidis2004,");
    expect(bib).toContain("pages   = {291--309},");
    expect(bib).toContain("@book{who2014handbook,");
    expect(bib).toContain("author    = {World Health Organization},");
  });

  test("risOneRecordCrlf", () => {
    const ris = toRis(refs);
    const recs = ris.replace(/\r\n$/, "").split("\r\n\r\n");
    expect(recs).toHaveLength(2);
    expect(recs[0]).toContain("TY  - JOUR\r\nID  - garoufalidis2004");
    expect(recs[0]).toContain("SP  - 291\r\nEP  - 309");
    expect(recs[1]).toContain("TY  - BOOK");
    expect(recs[1]).toContain("SN  - 9789241548960");
    for (const r of recs) expect(r.endsWith("ER  - ")).toBe(true);
  });

  test("jsonLdIdJoinsCitations", () => {
    const ctx = referenceToJsonLd(garoufalidis2004)["@context"] as Record<string, unknown>;
    expect(ctx["@base"]).toBe(FOLIO_BASE);
    expect(ctx).not.toHaveProperty("schema");
    expect(ctx["dcterms:source"]).toEqual({ "@type": "@id" });
    expect(ctx["dcterms:hasVersion"]).toEqual({ "@type": "@id" });
  });

  test("jsonLdOneGraph", () => {
    const g = JSON.parse(toJsonLdGraph(refs)) as { "@context": object; "@graph": Record<string, unknown>[] };
    expect(g["@graph"].map((n) => n["@id"])).toEqual(["references/garoufalidis2004", "references/who2014handbook"]);
    expect(g["@graph"].every((n) => !("@context" in n))).toBe(true);
  });

  test("dcXmlReusesRenderer", () => {
    const singleXml = toDublinCoreXml([garoufalidis2004]);
    expect(singleXml).toContain("<dcterms:title>On the characteristic and deformation varieties of a knot</dcterms:title>");
    expect(singleXml).toContain("<dcterms:creator>Garoufalidis, Stavros</dcterms:creator>");
    expect(singleXml).toContain("10.2140/gtm.2004.7.291");

    const multiXml = toDublinCoreXml(refs);
    expect(multiXml).toContain("<records ");
    expect(multiXml).toContain("WHO handbook for guideline development");
    expect(multiXml).toContain("On the characteristic and deformation varieties of a knot");
  });

  test("emptySetExportsEmpty", () => {
    expect(toBibtex([])).toBe("");
    expect(toRis([])).toBe("");
    expect(JSON.parse(toCslJson([]))).toEqual([]);
    expect(toDublinCoreXml([])).toContain("</records>");
  });
});

describe("library items and genReferenceJsonLd", () => {
  test("authorsRawToCslNames", () => {
    expect(authorsRawToNames("Stavros Garoufalidis and Thang T. Q. Lê")).toEqual([
      { family: "Garoufalidis", given: "Stavros" },
      { family: "Lê", given: "Thang T. Q." },
    ]);
    expect(authorsRawToNames("World Health Organization")).toEqual([{ literal: "World Health Organization" }]);
  });

  test("libraryItemProjectsToReference", () => {
    const tmp = mkdtempSync(join(tmpdir(), "lib-ref-"));
    try {
      const entryDir = join(tmp, "garoufalidis2004");
      mkdirSync(entryDir, { recursive: true });
      writeFileSync(
        join(entryDir, "manifest.jsonld"),
        JSON.stringify({
          docId: "garoufalidis2004",
          title: "Fallback title",
          sourceUrl: "https://arxiv.org/abs/math/0306230",
          ingestedAt: "2026-10-01T00:00:00Z",
        }),
      );
      writeFileSync(
        join(entryDir, STRUCTURE_FILENAME),
        JSON.stringify({
          _schema: "pdf-structure/v1",
          doc_id: "garoufalidis2004",
          source: {
            file: "paper.pdf",
            sha256: "a".repeat(64),
            bytes: 12345,
            mtime: "2026-10-01T00:00:00Z",
            mimetype_sniffed: "application/pdf",
            mimetype_source: "magic-bytes",
            pages: 19,
          },
          metadata: {
            title: "On the characteristic and deformation varieties of a knot",
            docinfo: {},
            authors_raw: "Stavros Garoufalidis",
            abstract: "We study the characteristic variety of a knot.",
            arxiv: { id: "math/0306230", category: "math.GT", date: "2004" },
            doi: "10.2140/gtm.2004.7.291",
          },
          toc_source: "outline",
          sections: [],
        }),
      );
      const ref = libraryItemToReference(entryDir, {
        derivedFrom: "library/garoufalidis2004/manifest.jsonld",
        heldAt: "library/garoufalidis2004",
      });
      expect(ref.id).toBe("garoufalidis2004");
      expect(ref.provenance).toBe("library");
      expect(ref.title).toBe("On the characteristic and deformation varieties of a knot");
      expect(ref.author).toEqual([{ family: "Garoufalidis", given: "Stavros" }]);
      expect(ref.DOI).toBe("10.2140/gtm.2004.7.291");
      expect(ref.URL).toBe("https://arxiv.org/abs/math/0306230");
      expect(yearOf(ref)).toBe("2004");
      expect(ref.derivedFrom).toBe("library/garoufalidis2004/manifest.jsonld");
      expect(ref.heldAt).toBe("library/garoufalidis2004");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("genReferenceJsonLdWritesAndChecks", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gen-jsonld-"));
    try {
      const refsDir = join(tmp, "folio", "references");
      mkdirSync(refsDir, { recursive: true });
      writeFileSync(join(refsDir, "garoufalidis2004.json"), JSON.stringify(garoufalidis2004, null, 2));
      expect(genReferenceJsonLd(tmp, { check: true }).stale).toHaveLength(1);
      const res = genReferenceJsonLd(tmp);
      expect(res.written).toEqual([join(refsDir, "garoufalidis2004.jsonld")]);
      expect(genReferenceJsonLd(tmp, { check: true }).stale).toEqual([]);
      const writtenLd = JSON.parse(readFileSync(join(refsDir, "garoufalidis2004.jsonld"), "utf-8")) as Record<string, unknown>;
      expect(writtenLd["@id"]).toBe("references/garoufalidis2004");
      expect(writtenLd["dcterms:title"]).toBe("On the characteristic and deformation varieties of a knot");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("buildStandaloneReference", () => {
    const built = buildStandaloneReference({
      id: "smith2024",
      type: "article-journal",
      title: "Standalone Reference Nodes in Knowledge Graphs",
      authors: "Smith, Jane; Doe, John",
      issued: "2024-05-12",
      containerTitle: "Journal of Graph Viewers",
      DOI: "10.1000/jgv.2024.1",
      arXiv: "2405.12345",
      abstract: "A standalone reference node.",
    });
    expect(ReferenceNodeSchema.parse(built.node).id).toBe("smith2024");
    const parsedJsonLd = JSON.parse(built.jsonld) as Record<string, unknown>;
    expect(ReferenceNodeSchema.parse(parsedJsonLd).id).toBe("smith2024");
    expect(parsedJsonLd["@id"]).toBe("references/smith2024");
    expect(parsedJsonLd["dcterms:title"]).toBe("Standalone Reference Nodes in Knowledge Graphs");
    expect(built.path).toBe("references/smith2024.jsonld");
    expect(built.csl.id).toBe("smith2024");
    expect("$schema" in built.csl).toBe(false);
    expect("@context" in built.csl).toBe(false);

    const fromBib = buildStandaloneReference({
      raw: `@article{euler1736,
        title = {Solutio problematis ad geometriam situs pertinentis},
        author = {Euler, Leonhard},
        journal = {Commentarii academiae scientiarum Petropolitanae},
        year = {1736},
        volume = {8},
        pages = {128--140}
      }`,
    });
    expect(ReferenceNodeSchema.parse(fromBib.node)).toMatchObject({
      $schema: "folio-reference/v1",
      id: "euler1736",
      type: "article-journal",
      title: "Solutio problematis ad geometriam situs pertinentis",
      "container-title": "Commentarii academiae scientiarum Petropolitanae",
      page: "128-140",
    });
    expect(jsonLdToReferenceNode(JSON.parse(fromBib.jsonld) as Record<string, unknown>).id).toBe("euler1736");
    expect(parseBibtexOrCsl(fromBib.cslJson).id).toBe("euler1736");
  });

  test("safeHrefEnforced", () => {
    const unsafe = buildStandaloneReference({
      id: "badurl2024",
      title: "Unsafe URL Test",
      URL: "javascript:alert(1)",
    });
    expect(unsafe.node.URL).toBeUndefined();

    const safe = newReferenceUrl({
      repoUrl: "https://github.com/litlfred/folio-assistant",
      branch: "main",
      dir: "folio/references",
      key: "smith2024",
    });
    expect(safe).toBe("https://github.com/litlfred/folio-assistant/new/main/folio/references?filename=smith2024.jsonld");
    expect(newReferenceUrl({ repoUrl: "javascript:alert(1)", key: "smith2024" })).toBeUndefined();
    expect(newReferenceUrl({ repoUrl: "//evil.example/repo", key: "smith2024" })).toBeUndefined();
  });
});

describe("declared", () => {
  test("typologyNamesValidatedFamily", () => {
    const kind = JSON.parse(readFileSync(join(CORE, "typologies", "references.json"), "utf-8"));
    const v = JSON.parse(readFileSync(join(CORE, "validators", "reference.json"), "utf-8"));
    expect(Object.keys(kind.nodeSchemas)).toEqual([REFERENCE_SCHEMA_TAG]);
    expect(v.validates).toEqual({ kind: "references", family: REFERENCE_SCHEMA_TAG });
    expect(v.schema).toBe("folio-assistant-core:schemas/reference.ts#ReferenceKind");
  });
});

describe("the declared vocabulary", () => {
  test("declaresExactlyReferencePrefixes", () => {
    const decl = JSON.parse(readFileSync(join(import.meta.dir, "..", "folio-assistant-core.json"), "utf-8")) as { jsonldPrefixes?: Record<string, string> };
    expect(decl.jsonldPrefixes).toEqual({ bibo: REFERENCE_CONTEXT.bibo, fabio: REFERENCE_CONTEXT.fabio });
  });
});
