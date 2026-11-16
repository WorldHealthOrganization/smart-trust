/**
 * Tests for the Dublin Core record type and its JSON-LD projection.
 *
 * Every assertion below is made against the ONE authoritative record this
 * repository holds — `wpr-rdo-2020-003-eng`, transcribed by hand from the
 * DSpace full item record the owner captured — and not against a fixture
 * invented to make the code pass. A fixture would agree with whatever the
 * projection happens to do; the measured record is the thing that can disagree.
 *
 * @module schemas/dublin-core.test
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join, resolve } from "path";

import {
  DCTERMS_NS,
  DC_ELEMENTS_NS,
  DSPACE_NS,
  DUBLIN_CORE_CONTEXT,
  DublinCoreRecordSchema,
  dcPredicate,
  dublinCoreToJsonLd,
  bcp47,
  type DublinCoreRecord,
} from "./dublin-core.js";

const REPO = resolve(import.meta.dir, "..", "..");
const RECORDS = join(REPO, "who-iris", "catalogue", "records");

function load(slug: string): DublinCoreRecord {
  const raw = JSON.parse(readFileSync(join(RECORDS, `${slug}.dc.json`), "utf-8"));
  // `_`-prefixed keys are this repository's spelling for "documentation, not
  // data", which is what makes the schema's `.strict()` affordable. Stripped
  // here exactly as `folio-assistant-core/scripts/check-catalogue.ts` strips them, so this
  // test reads the records the way the gate does rather than a way of its own.
  for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
  // Parsed through the schema, not cast: a test that casts is testing the
  // fixture rather than the type.
  return DublinCoreRecordSchema.parse(raw);
}

const STYLE_GUIDE = load("wpr-rdo-2020-003-eng");

/** The `@list` behind one predicate, or undefined when the predicate is absent. */
function listOf(doc: Record<string, unknown>, predicate: string): unknown[] | undefined {
  const node = doc[predicate] as { "@list"?: unknown[] } | undefined;
  return node?.["@list"];
}

describe("the duplicated DCTERMS namespace stays in step with the platform's", () => {
  it("dctermsNsMatchesPlatform", () => {
    // An unavoidable duplicate is fine; an unchecked one is not. If the
    // platform ever respells its DCTERMS_NS, this fails here rather than
    // producing two namespaces that look the same in a diff and join with
    // nothing. Read as TEXT rather than imported, because importing the
    // platform's block context from a content-layer test would create the
    // cross-layer dependency this duplicate exists to avoid.
    const src = readFileSync(join(REPO, "cat-harness-tools", "schemas", "kg", "jsonld.ts"), "utf-8");
    const m = src.match(/export const DCTERMS_NS = "([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(DCTERMS_NS);
  });
});

describe("dcPredicate keeps the three identifier systems apart", () => {
  it("identifierUriGovdocApart", () => {
    // This is the whole reason dcPredicate exists. Collapsed onto
    // `dcterms:identifier` the Handle, the legacy regional URI and the WHO
    // govdoc number become an unordered bag of three strings and R1 ("resolve
    // by Handle, treat govdoc as secondary") stops being expressible.
    const uri = dcPredicate({ schema: "dc", element: "identifier", qualifier: "uri" });
    const gov = dcPredicate({ schema: "dc", element: "identifier", qualifier: "govdoc" });
    expect(uri).not.toBe(gov);
    expect(uri).toBe(`${DSPACE_NS}dc.identifier.uri`);
    expect(gov).toBe(`${DSPACE_NS}dc.identifier.govdoc`);
  });

  it("bareElementToDcElements", () => {
    expect(dcPredicate({ schema: "dc", element: "title" })).toBe(`${DC_ELEMENTS_NS}title`);
    expect(dcPredicate({ schema: "dc", element: "description" })).toBe(`${DC_ELEMENTS_NS}description`);
  });

  it("qualifierIsMintedRefinement", () => {
    // The measured record carries BOTH `dc.description` and
    // `dc.description.abstract`. Flattening the qualifier would merge "30 p."
    // with the abstract into one bag of two strings.
    expect(dcPredicate({ schema: "dc", element: "description", qualifier: "abstract" }))
      .toBe(`${DSPACE_NS}dc.description.abstract`);
  });

  it("mintsForNonDcSchema", () => {
    expect(dcPredicate({ schema: "local", element: "title" })).toBe(`${DSPACE_NS}local.title`);
  });

  it("mintsForElementOutsideFifteen", () => {
    expect(dcPredicate({ schema: "dc", element: "provenance" })).toBe(`${DSPACE_NS}dc.provenance`);
  });
});

describe("the projection round-trips the record's repetition", () => {
  const doc = dublinCoreToJsonLd(STYLE_GUIDE);

  it("keepsBothIdentifierUris", () => {
    const values = listOf(doc, `${DSPACE_NS}dc.identifier.uri`);
    expect(values).toHaveLength(2);
    expect(values).toEqual([
      { "@value": "http://iris.wpro.who.int/handle/10665.1/14518" },
      { "@value": "https://iris.who.int/handle/10665/332098" },
    ]);
  });

  it("preservesSourceOrder", () => {
    // A JSON-LD array is an unordered set. DSpace stores a `place` on every
    // repeated field, so `@list` is what makes "which did the source give
    // first" answerable at all — and the legacy host is first here.
    const values = listOf(doc, `${DSPACE_NS}dc.identifier.uri`) as { "@value": string }[];
    expect(values[0]["@value"]).toContain("iris.wpro.who.int");
    expect(values[1]["@value"]).toContain("iris.who.int");
  });

  it("keepsBothMeshSubjects", () => {
    const values = listOf(doc, `${DSPACE_NS}dc.subject.mesh`);
    expect(values).toHaveLength(2);
    // A controlled value is a NODE, not a literal: that is what makes it
    // resolvable and a free-text keyword not (R5).
    expect(values).toEqual([
      {
        "@type": `${DSPACE_NS}ControlledValue`,
        "rdf:value": { "@value": "Publishing", "@language": "en" },
        [`${DSPACE_NS}authority`]: "https://id.nlm.nih.gov/mesh/",
      },
      {
        "@type": `${DSPACE_NS}ControlledValue`,
        "rdf:value": { "@value": "Guidelines as Topic", "@language": "en" },
        [`${DSPACE_NS}authority`]: "https://id.nlm.nih.gov/mesh/",
      },
    ]);
  });

  it("keepsRepeatedDates", () => {
    expect(listOf(doc, `${DSPACE_NS}dc.date.accessioned`)).toHaveLength(2);
    expect(listOf(doc, `${DSPACE_NS}dc.date.available`)).toHaveLength(2);
  });
});

describe("an absent language tag stays absent", () => {
  const doc = dublinCoreToJsonLd(STYLE_GUIDE);

  it("emitsLanguageWhereAsserted", () => {
    const title = listOf(doc, `${DC_ELEMENTS_NS}title`);
    expect(title).toEqual([
      { "@value": "Publication and information products style guide", "@language": "en" },
    ]);
  });

  it("noDefaultLanguage", () => {
    const author = listOf(doc, `${DSPACE_NS}dc.contributor.author`) as Record<string, unknown>[];
    expect(author).toHaveLength(1);
    expect(author[0]).not.toHaveProperty("@language");
    expect(Object.keys(author[0])).toEqual(["@value"]);
  });

  it("bothLanguageStatesInOneRecord", () => {
    const tagged = listOf(doc, `${DC_ELEMENTS_NS}title`) as Record<string, unknown>[];
    const untagged = listOf(doc, `${DSPACE_NS}dc.date.issued`) as Record<string, unknown>[];
    expect("@language" in tagged[0]).toBe(true);
    expect("@language" in untagged[0]).toBe(false);
  });
});

describe("two `DcField` entries with one qualified name merge rather than colliding", () => {
  it("sameNameFieldsMerge", () => {
    const split: DublinCoreRecord = {
      ...STYLE_GUIDE,
      fields: [
        { schema: "dc", element: "identifier", qualifier: "uri", values: [{ value: "first" }] },
        { schema: "dc", element: "identifier", qualifier: "uri", values: [{ value: "second" }] },
      ],
    };
    expect(listOf(dublinCoreToJsonLd(split), `${DSPACE_NS}dc.identifier.uri`)).toEqual([
      { "@value": "first" },
      { "@value": "second" },
    ]);
  });
});

describe("`@id` is the repository's own key, and the Handle judgement stays in the skill", () => {
  it("idMintedFromRecordId", () => {
    expect(dublinCoreToJsonLd(STYLE_GUIDE)["@id"])
      .toBe(`${DSPACE_NS}item/18892cf3-5a4f-42a4-923c-a93f4a594dec`);
  });

  it("callerMaySetHandleId", () => {
    const doc = dublinCoreToJsonLd(STYLE_GUIDE, { id: "https://iris.who.int/handle/10665/332098" });
    expect(doc["@id"]).toBe("https://iris.who.int/handle/10665/332098");
  });

  it("carriesTypeAndProvenance", () => {
    const doc = dublinCoreToJsonLd(STYLE_GUIDE);
    expect(doc["@type"]).toBe(`${DSPACE_NS}Item`);
    expect(doc[`${DSPACE_NS}provenance`]).toEqual({
      [`${DSPACE_NS}source`]: STYLE_GUIDE.provenance.source,
      [`${DSPACE_NS}retrievedAt`]: STYLE_GUIDE.provenance.retrievedAt,
      [`${DSPACE_NS}method`]: STYLE_GUIDE.provenance.method,
    });
  });
});

describe("the context defines every prefix the projection actually emits", () => {
  it("contextBindsPrefixes", () => {
    expect(DUBLIN_CORE_CONTEXT.dc).toBe(DC_ELEMENTS_NS);
    expect(DUBLIN_CORE_CONTEXT.dcterms).toBe(DCTERMS_NS);
    expect(DUBLIN_CORE_CONTEXT.dspace).toBe(DSPACE_NS);
    expect(DUBLIN_CORE_CONTEXT.rdf).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  });

  it("everyPredicateUnderBoundPrefix", () => {
    // The falsifier for the projection as a whole: a minted IRI under a stem
    // the context does not bind compacts to nothing and joins with nothing.
    const bound: string[] = Object.values(DUBLIN_CORE_CONTEXT).flatMap((v) =>
      typeof v === "string" ? [v] : [],
    );
    for (const slug of ["wpr-rdo-2020-003-eng", "9789241548960-eng", "who-pub-tps-931"]) {
      for (const f of load(slug).fields) {
        const p = dcPredicate(f);
        expect(bound.some((ns) => p.startsWith(ns))).toBe(true);
      }
    }
  });
});

describe("a DSpace locale becomes a BCP 47 tag", () => {
  it("dspaceLocaleToBcp47", () => {
    expect(bcp47("en_US")).toBe("en-US");
    expect(bcp47("en")).toBe("en");
  });
});
