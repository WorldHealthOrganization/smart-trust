/**
 * Tests for the Dublin Core renderings (bean `7eak`).
 *
 * The test that settles the JSON-LD is a real processor. The documents are
 * expanded with jsonld.js and the expanded graph is checked: a resource-ranged
 * DCMI term must expand to a NODE, never a bare literal (linked-data voice,
 * `ld-object-property-is-a-link`). The loader refuses every URL, so a
 * rendering that needs a remote context to be read fails here
 * (`ld-no-context-fetched-at-run-time`).
 *
 * Every assertion runs against the three records the catalogue actually
 * holds, never against a fixture invented to pass.
 *
 * @module schemas/dublin-core-render.test
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join, resolve } from "path";

import { XMLParser, XMLValidator } from "fast-xml-parser";
import jsonld from "jsonld";

import { HANDLE_RESOLVER } from "./catalogue.js";
import { DCTERMS_NS, DC_ELEMENTS_NS, DublinCoreRecordSchema, dcFieldName, dcPredicate, type DublinCoreRecord } from "./dublin-core.js";
import {
  DCAM_NS,
  DCTERMS_MAP,
  RDF_NS,
  dctermsFor,
  dublinCoreToDcterms,
  renderDcJsonLd,
  renderDcXml,
} from "./dublin-core-render.js";
import { itemsWithRecords, plannedRenderings } from "../scripts/dc-render.ts";

const REPO = resolve(import.meta.dir, "..", "..");
const INSTANCE = join(REPO, "who-iris");

const ITEMS = itemsWithRecords(INSTANCE);

function recordOf(metadataRef: string): DublinCoreRecord {
  const raw = JSON.parse(readFileSync(join(INSTANCE, metadataRef), "utf-8")) as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
  return DublinCoreRecordSchema.parse(raw);
}

const CASES = ITEMS.map((n) => ({ node: n, rec: recordOf(n.metadataRef!) }));

const refuseAll = (url: string): never => {
  throw new Error(`no remote context may be fetched; asked for ${url}`);
};

async function expand(doc: object): Promise<Record<string, unknown>> {
  const out = (await jsonld.expand(doc, { documentLoader: refuseAll } as never)) as unknown as Record<string, unknown>[];
  expect(out).toHaveLength(1);
  return out[0]!;
}

describe("the corpus this runs over", () => {
  it("corpusHoldsWorkedExamples", () => {
    // Not an exact list. Since 2026-10-30 who-iris is the one home for every
    // IRIS item the harness layers had ingested (the owner's "pre-CDN
    // preview"), so the corpus grows as items move in. The three worked
    // examples carry the hand-transcribed records these tests were written
    // against, and they must stay in it.
    expect(CASES.map((c) => c.node.handle)).toEqual(
      expect.arrayContaining(["10665/145714", "10665/332098", "10665/36842"]),
    );
  });
});

describe("JSON-LD bound to DCMI Terms — expanded by a real processor", () => {
  for (const { node, rec } of CASES) {
    describe(node.id, () => {
      it(`namesItemAtHandle[${node.id.replace(/\s+/g, "_")}]`, async () => {
        const e = await expand(dublinCoreToDcterms(rec, { handle: node.handle }));
        expect(e["@id"]).toBe(`${HANDLE_RESOLVER}${node.handle}`);
      });

      it(`resourceTermsExpandToNodes[${node.id.replace(/\s+/g, "_")}]`, async () => {
        const e = await expand(dublinCoreToDcterms(rec, { handle: node.handle }));
        const resourceTerms = new Set(
          Object.values(DCTERMS_MAP).filter((m) => m.range === "resource").map((m) => `${DCTERMS_NS}${m.term}`),
        );
        let seen = 0;
        for (const [k, vs] of Object.entries(e)) {
          if (!resourceTerms.has(k)) continue;
          for (const v of vs as Record<string, unknown>[]) {
            seen++;
            expect(v["@value"]).toBeUndefined();
            expect((v[`${RDF_NS}value`] as unknown[])?.length).toBe(1);
          }
        }
        expect(seen).toBeGreaterThan(0);
      });

      it(`everySourceValueOnce[${node.id.replace(/\s+/g, "_")}]`, async () => {
        const e = await expand(dublinCoreToDcterms(rec, { handle: node.handle }));
        const strings = (k: string): string[] =>
          ((e[k] as Record<string, unknown>[] | undefined) ?? []).map((v) =>
            String(((v[`${RDF_NS}value`] as Record<string, unknown>[] | undefined)?.[0] ?? v)["@value"]),
          );
        for (const f of rec.fields) {
          const m = dctermsFor(f);
          const k = m ? `${DCTERMS_NS}${m.term}` : dcPredicate(f);
          for (const v of f.values) expect(strings(k)).toContain(v.value);
        }
        const total = Object.entries(e).filter(([k]) => k !== "@id").reduce((n, [, vs]) => n + (vs as unknown[]).length, 0);
        expect(total).toBe(rec.fields.reduce((n, f) => n + f.values.length, 0));
      });
    });
  }

  it("meshSubjectsAreLinks", async () => {
    const c = CASES.find((x) => x.node.handle === "10665/332098")!;
    const e = await expand(dublinCoreToDcterms(c.rec, { handle: c.node.handle }));
    const subjects = e[`${DCTERMS_NS}subject`] as Record<string, unknown>[];
    expect(subjects.length).toBeGreaterThan(0);
    for (const s of subjects) {
      expect(s[`${DCAM_NS}memberOf`]).toEqual([{ "@id": `${DCTERMS_NS}MESH` }]);
      expect((s[Object.keys(s).find((k) => k.endsWith("/authority"))!] as unknown[])[0]).toEqual({
        "@id": "https://id.nlm.nih.gov/mesh/",
      });
    }
  });

  it("identifierUriTypedGovdocApart", async () => {
    const c = CASES.find((x) => x.node.handle === "10665/332098")!;
    const e = await expand(dublinCoreToDcterms(c.rec, { handle: c.node.handle }));
    const ids = e[`${DCTERMS_NS}identifier`] as Record<string, unknown>[];
    expect(ids.map((v) => v["@value"])).toEqual([
      "http://iris.wpro.who.int/handle/10665.1/14518",
      "https://iris.who.int/handle/10665/332098",
    ]);
    for (const v of ids) expect(v["@type"]).toBe(`${DCTERMS_NS}URI`);
    expect(e[dcPredicate({ schema: "dc", element: "identifier", qualifier: "govdoc" })]).toEqual([{ "@value": "WPR/RDO/2020/003" }]);
  });

  it("w3cdtfOnlyOnMatchingValue", () => {
    const doc = dublinCoreToDcterms({
      $schema: "folio-dublin-core/v1",
      id: "x",
      fields: [{ schema: "dc", element: "date", qualifier: "issued", values: [{ value: "1993" }, { value: "circa 1993" }] }],
      provenance: { source: "s", retrievedAt: "r", method: "m" },
    });
    expect(doc["dcterms:issued"]).toEqual([
      { "@value": "1993", "@type": `${DCTERMS_NS}W3CDTF` },
      { "@value": "circa 1993" },
    ]);
  });

  it("noHandleNoBase", async () => {
    const { rec } = CASES[0]!;
    const doc = dublinCoreToDcterms(rec);
    expect((doc["@context"] as Record<string, unknown>)["@base"]).toBeUndefined();
    const e = await expand(doc);
    expect(String(e["@id"])).toMatch(/^https:\/\/.*item\//);
  });
});

describe("DC XML per DCMI's XML guidelines", () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", isArray: (_name: string, _path: unknown, _leaf: unknown, isAttribute: boolean) => !isAttribute, commentPropName: "#comment" });

  for (const { node, rec } of CASES) {
    describe(node.id, () => {
      const xml = renderDcXml(rec);
      it(`xmlWellFormed[${node.id.replace(/\s+/g, "_")}]`, () => {
        expect(XMLValidator.validate(xml)).toBe(true);
      });

      it(`xmlNamespacesOnContainer[${node.id.replace(/\s+/g, "_")}]`, () => {
        const doc = parser.parse(xml) as Record<string, Record<string, unknown>[]>;
        const root = doc["metadata"]![0]!;
        expect(root["@_xmlns:dc"]).toBe(DC_ELEMENTS_NS);
        expect(root["@_xmlns:dcterms"]).toBe(DCTERMS_NS);
        expect(root["@_xmlns:xsi"]).toBe("http://www.w3.org/2001/XMLSchema-instance");
        expect(typeof root["@_xmlns"]).toBe("string");
        for (const k of Object.keys(root)) {
          if (k.startsWith("@_") || k === "#comment") continue;
          expect(k).toMatch(/^(dc|dcterms):[A-Za-z]+$/);
        }
      });

      it(`xmlOnlyDcmiSchemes[${node.id.replace(/\s+/g, "_")}]`, () => {
        for (const m of xml.matchAll(/xsi:type="([^"]+)"/g)) {
          expect(["dcterms:W3CDTF", "dcterms:URI", "dcterms:RFC4646", "dcterms:MESH", "dcterms:IMT"]).toContain(m[1]!);
        }
      });

      it(`xmlListsInexpressible[${node.id.replace(/\s+/g, "_")}]`, () => {
        const elements = [...xml.matchAll(/^ {2}<(dc|dcterms):/gm)].length;
        const expressible = rec.fields.filter((f) => dctermsFor(f) || f.schema === "dc");
        expect(elements).toBe(expressible.reduce((n, f) => n + f.values.length, 0));
        for (const f of rec.fields.filter((x) => !expressible.includes(x))) {
          expect(xml).toMatch(new RegExp(`not expressible as DC XML[^>]*${dcFieldName(f).replace(/\./g, "\\.")}`));
        }
      });
    });
  }

  it("xmlEscapesMarkup", () => {
    const xml = renderDcXml({
      $schema: "folio-dublin-core/v1",
      id: "x",
      fields: [{ schema: "dc", element: "title", values: [{ value: "A <b> & \"c\"" }] }],
      provenance: { source: "s", retrievedAt: "r", method: "m" },
    });
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain("<dcterms:title>A &lt;b&gt; &amp; &quot;c&quot;</dcterms:title>");
  });
});

describe("the committed renderings", () => {
  it("committedRenderingsMatchFresh", () => {
    const planned = plannedRenderings(INSTANCE);
    expect(planned.size).toBe(CASES.length * 2);
    for (const [p, body] of planned) expect(readFileSync(p, "utf-8")).toBe(body);
  });

  it("renderingsDeterministic", () => {
    for (const { node, rec } of CASES) {
      expect(renderDcJsonLd(rec, { handle: node.handle })).toBe(renderDcJsonLd(rec, { handle: node.handle }));
      expect(renderDcXml(rec)).toBe(renderDcXml(rec));
    }
  });
});
