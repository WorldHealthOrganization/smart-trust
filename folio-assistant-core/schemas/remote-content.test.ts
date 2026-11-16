/**
 * The invariants the three content-layer schemas exist to enforce.
 *
 * Every case here is drawn from the ONE measured record — the full item record
 * for `wpr-rdo-2020-003-eng`, extracted with `pdftotext` on 2026-09-20 — rather
 * than from a reading of the Dublin Core or DSpace specifications. A test
 * written against a spec asserts what the spec says; a test written against the
 * record asserts what actually arrived.
 */
import { describe, expect, it } from "bun:test";
import {
  DUBLIN_CORE_SCHEMA_TAG,
  DublinCoreRecordSchema,
  dcElement,
  dcFieldName,
  dcValues,
} from "./dublin-core.js";
import { MaterializationSchema, freshness, publicationBlockers, refusedGates, unansweredGates } from "./materialization.js";
import { CATALOGUE_NODE_SCHEMA_TAG, CatalogueNodeSchema, materializationCensus } from "./catalogue.js";

/** The measured record, trimmed to the fields that carry the three hard cases. */
const RECORD = {
  $schema: DUBLIN_CORE_SCHEMA_TAG,
  id: "18892cf3-5a4f-42a4-923c-a93f4a594dec",
  fields: [
    {
      schema: "dc",
      element: "identifier",
      qualifier: "uri",
      values: [
        { value: "https://iris.who.int/handle/10665/332098" },
        { value: "http://iris.wpro.who.int/handle/10665.1/14518" },
      ],
    },
    { schema: "dc", element: "identifier", qualifier: "govdoc", values: [{ value: "WPR/RDO/2020/003" }] },
    {
      schema: "dc",
      element: "subject",
      qualifier: "mesh",
      values: [
        { value: "Publishing", language: "en" },
        { value: "Guidelines as Topic", language: "en" },
      ],
    },
    { schema: "dc", element: "title", values: [{ value: "Publication and information products style guide", language: "en" }] },
    { schema: "dc", element: "date", qualifier: "issued", values: [{ value: "2020-05-12" }] },
  ],
  provenance: {
    source: "who-iris/uploads/wpr-rdo-2020-003-eng/iris-capture/…-info.pdf",
    retrievedAt: "2026-09-20",
    method: "pdftotext -layout",
  },
} as const;

const FIXITY = {
  algorithm: "sha256",
  // The real digest from library/wpr-rdo-2020-003-eng/structure.json — fixity
  // data this repository has carried since ingestion and has never read as fixity.
  digest: "5021518ccd91e26a9533edd8efc643bc24ab7bf2d4eb425c9644967e0bf72842",
} as const;

const GATES_OK = {
  size: { verdict: "permitted", basis: "2.68 MB of a 361.55 GB catalogue" },
  restrictions: { verdict: "unknown", basis: "no restrictions stated on the item page" },
  retention: { verdict: "permitted", basis: "kept until the next refresh" },
  // `unknown`, and the first draft of this fixture had it `permitted` with the
  // basis "bitstream held locally" — which is ARCHIVAL reasoning attached to a
  // working copy. The rule added the same day caught it. A working copy holds
  // derived sections, and the sections are not the publication.
  sourceLoss: { verdict: "unknown", basis: "no archival copy of the original bytes" },
  copyright: { verdict: "unknown", basis: "no licence field in the record" },
} as const;

describe("Dublin Core — the three things a naive model loses", () => {
  it("keepsBothIdentifierUris", () => {
    // The second is a handle on iris.wpro.who.int, a regional instance merged
    // into the global one. It is the only evidence this repository holds of a
    // source host disappearing, so dropping it as a duplicate would discard
    // the source-loss case the materialization gates exist for.
    const uris = dcValues(DublinCoreRecordSchema.parse(RECORD), "identifier", "uri");
    expect(uris.map((v) => v.value)).toEqual([
      "https://iris.who.int/handle/10665/332098",
      "http://iris.wpro.who.int/handle/10665.1/14518",
    ]);
  });

  it("keepsBothMeshWithLanguage", () => {
    const mesh = dcValues(DublinCoreRecordSchema.parse(RECORD), "subject", "mesh");
    expect(mesh).toHaveLength(2);
    expect(mesh.every((v) => v.language === "en")).toBe(true);
  });

  it("absentLanguageDistinct", () => {
    // The record tags the title `en` and leaves the date untagged. Absence is
    // data: an untagged value is not an English value, it is a value whose
    // language nobody asserted.
    const rec = DublinCoreRecordSchema.parse(RECORD);
    expect(dcValues(rec, "title")[0].language).toBe("en");
    expect(dcValues(rec, "date", "issued")[0].language).toBeUndefined();
  });

  it("elementSpansQualifiers", () => {
    // "What identifiers does this item have" must reach `govdoc` as well as
    // `uri` — a consumer enumerating the qualifiers it knew about would miss
    // the one it did not.
    const fields = dcElement(DublinCoreRecordSchema.parse(RECORD), "identifier");
    expect(fields.map(dcFieldName).sort()).toEqual(["dc.identifier.govdoc", "dc.identifier.uri"]);
  });
});

describe("materialization — the states and the gates", () => {
  it("materializedNeedsGates", () => {
    const r = MaterializationSchema.safeParse({ state: "materialized", provenance: { upstream: "https://x" }, localPath: "library/x" });
    expect(r.success).toBe(false);
  });

  it("materializedNeedsLocalPath", () => {
    const r = MaterializationSchema.safeParse({ state: "materialized", provenance: { upstream: "https://x" }, gates: GATES_OK });
    expect(r.success).toBe(false);
  });

  it("gatesOnlyWhenMaterialized", () => {
    // A gate verdict on a `referenced` node claims a decision nobody had to make.
    const r = MaterializationSchema.safeParse({ state: "referenced", provenance: { upstream: "https://x" }, gates: GATES_OK });
    expect(r.success).toBe(false);
  });

  it("unknownApartFromPermitted", () => {
    // The whole reason GateVerdict is three-valued: "no restrictions known in
    // context" is a state, not a green light.
    expect(unansweredGates(GATES_OK as never).sort()).toEqual(["copyright", "restrictions", "sourceLoss"]);
    expect(refusedGates(GATES_OK as never)).toEqual([]);
  });

  it("fourFreshnessVerdicts", () => {
    const base = { provenance: { upstream: "https://x" }, localPath: "library/x", gates: GATES_OK, purpose: "working" as const };
    expect(freshness(MaterializationSchema.parse({ state: "referenced", provenance: { upstream: "https://x" } }), new Date())).toBe("not-materialized");
    expect(freshness(MaterializationSchema.parse({ state: "materialized", ...base, purpose: "working" }), new Date())).toBe("no-expiry");
    expect(
      freshness(MaterializationSchema.parse({ state: "materialized", ...base, expiresAt: "2020-01-01" }), new Date()),
    ).toBe("expired");
    expect(
      freshness(MaterializationSchema.parse({ state: "materialized", ...base, expiresAt: "2999-01-01" }), new Date()),
    ).toBe("fresh");
  });

  it("noDefaultState", () => {
    expect(MaterializationSchema.safeParse({ provenance: { upstream: "https://x" } }).success).toBe(false);
  });

  it("materializedNeedsPurpose", () => {
    const r = MaterializationSchema.safeParse({
      state: "materialized", provenance: { upstream: "https://x" }, localPath: "library/x", gates: GATES_OK,
    });
    expect(r.success).toBe(false);
  });

  it("archivalNeedsFixity", () => {
    // An archive that cannot demonstrate it is unchanged is a copy, and it
    // cannot be re-fetched to check — the thing it would be re-fetched from is
    // what it exists to survive.
    const r = MaterializationSchema.safeParse({
      state: "materialized", provenance: { upstream: "https://x" }, localPath: "u/x.pdf",
      gates: GATES_OK, purpose: "archival",
    });
    expect(r.success).toBe(false);
  });

  it("workingCannotDischargeSourceLoss", () => {
    // The derived sections are not the publication.
    const r = MaterializationSchema.safeParse({
      state: "materialized", provenance: { upstream: "https://x" }, localPath: "library/x", purpose: "working",
      gates: { ...GATES_OK, sourceLoss: { verdict: "permitted", basis: "we have the sections" } },
    });
    expect(r.success).toBe(false);
  });

  it("archiveIsPermanent", () => {
    // no-expiry is a finding: a working copy nobody gave a lifetime cannot be
    // told from abandoned work. permanent is a specification: an archive is
    // SUPPOSED to outlive its source.
    expect(
      freshness(
        MaterializationSchema.parse({
          state: "materialized",
          provenance: { upstream: "https://x" },
          localPath: "u/x.pdf",
          purpose: "archival",
          fixity: FIXITY,
          gates: { ...GATES_OK, sourceLoss: { verdict: "permitted", basis: "original bytes held, sha256 recorded" } },
        }),
        new Date(),
      ),
    ).toBe("permanent");
    expect(
      freshness(
        MaterializationSchema.parse({
          state: "materialized", provenance: { upstream: "https://x" }, localPath: "library/x",
          purpose: "working", gates: GATES_OK,
        }),
        new Date(),
      ),
    ).toBe("no-expiry");
  });
});

describe("catalogue — the model must not disagree with the corpus", () => {
  const node = (over: Record<string, unknown>) => ({
    $schema: CATALOGUE_NODE_SCHEMA_TAG,
    id: "n",
    kind: "item",
    title: "t",
    ...over,
  });

  it("libraryIdNeedsMaterialized", () => {
    // A slug under library/ IS the bytes being here. Declaring otherwise makes
    // corpus-grep and the catalogue disagree about what exists.
    const r = CatalogueNodeSchema.safeParse(
      node({ libraryId: "wpr-rdo-2020-003-eng", materialization: { state: "referenced", provenance: { upstream: "https://x" } } }),
    );
    expect(r.success).toBe(false);
  });

  it("containerHasNoBitstreams", () => {
    const r = CatalogueNodeSchema.safeParse(
      node({
        kind: "container",
        materialization: { state: "referenced", provenance: { upstream: "https://x" } },
        bitstreams: [{ name: "a.pdf", materialization: { state: "referenced", provenance: { upstream: "https://y" } } }],
      }),
    );
    expect(r.success).toBe(false);
  });

  it("censusCountsStatesApart", () => {
    const nodes = [
      CatalogueNodeSchema.parse(node({ id: "a", materialization: { state: "referenced", provenance: { upstream: "https://a" } } })),
      CatalogueNodeSchema.parse(node({ id: "b", materialization: { state: "unknown", provenance: { upstream: "https://b" } } })),
    ];
    expect(materializationCensus(nodes)).toEqual({ unknown: 1, referenced: 1, materialized: 0 });
  });
});

describe("publicationBlockers — held is not published (bean cw35)", () => {
  const gate = (verdict: "unknown" | "refused" | "permitted") => ({ verdict, basis: "test" });
  const all = (v: "unknown" | "refused" | "permitted") => ({
    size: gate("permitted"), retention: gate("permitted"), sourceLoss: gate("permitted"),
    copyright: gate(v), restrictions: gate(v),
  });
  it("onlyCopyrightRestrictionsDecide", () => {
    expect(publicationBlockers(all("permitted"))).toEqual([]);
    expect(publicationBlockers(all("refused"))).toEqual(["copyright", "restrictions"]);
    // an unanswered licence is not a licence
    expect(publicationBlockers(all("unknown"))).toEqual(["copyright", "restrictions"]);
    expect(publicationBlockers({ ...all("permitted"), size: gate("refused") })).toEqual([]);
  });
  it("noGatesBlocksBoth", () => {
    expect(publicationBlockers(undefined)).toEqual(["copyright", "restrictions"]);
  });
});
