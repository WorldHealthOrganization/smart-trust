import { describe, expect, test } from "bun:test";
import { atInstanceContext, documentContext, instanceContext, instanceDocumentContext, serialisedAtInstanceContext } from "./content-context.ts";
import { CONTENT_CONTEXT_URL, ContentContextSchema, FOLIO_BASE, INSTANCE_CONTEXT_PATH, instanceContextUrl } from "../kg/jsonld.ts";

const prefixes = new Map([
  ["folio-assistant-core", "https://example.org/core/ns#"],
  ["folio-assistant-sci", "https://example.org/sci/ns#"],
]);

describe("documentContext (bean 0r7u)", () => {
  test("a document whose types the published context binds carries only @base", () => {
    expect(documentContext(["cat-harness:SourceDocument", "doco:Section"], { prefixes })).toEqual([
      CONTENT_CONTEXT_URL,
      { "@base": FOLIO_BASE },
    ]);
  });

  test("an instance's kind class binds that instance's prefix locally, once", () => {
    const [, local] = documentContext(["folio-assistant-sci:Theorem", "folio-assistant-sci:Lemma", "doco:Section"], { prefixes });
    expect(local).toEqual({ "@base": FOLIO_BASE, "folio-assistant-sci": "https://example.org/sci/ns#" });
  });

  test("a different base is honoured", () => {
    expect(documentContext([], { base: "https://example.org/site/", prefixes })[1]).toEqual({ "@base": "https://example.org/site/" });
  });

  test("a prefix nothing binds is refused, never emitted", () => {
    expect(() => documentContext(["nobody:Thing"], { prefixes })).toThrow(/no context binds/);
  });
});

describe("instance contexts (bean folio-assistant-63q4)", () => {
  const instances = [
    { root: "/c/top", name: "top", iriBase: "https://example.org/top/" },
    { root: "/c/top/nested", name: "nested", iriBase: "https://example.org/nested" },
    { root: "/c/bare", name: "bare" },
  ];

  test("the URL is <iriBase>ns/context/v1.jsonld, with or without the trailing slash", () => {
    expect(instanceContextUrl("https://example.org/top/")).toBe(`https://example.org/top/${INSTANCE_CONTEXT_PATH}`);
    expect(instanceContextUrl("https://example.org/top")).toBe("https://example.org/top/ns/context/v1.jsonld");
  });

  test("by name, or by a path inside it — the innermost instance wins", () => {
    expect(instanceContext("top", instances).url).toBe("https://example.org/top/ns/context/v1.jsonld");
    expect(instanceContext("/c/top/docs/a.jsonld", instances).name).toBe("top");
    expect(instanceContext("/c/top/nested/x/b.jsonld", instances).url).toBe("https://example.org/nested/ns/context/v1.jsonld");
  });

  test("an instance with no iriBase, or none at all, THROWS — never a URL nobody publishes", () => {
    expect(() => instanceContext("bare", instances)).toThrow(/declares no iriBase/);
    expect(() => instanceContext("/elsewhere/a.jsonld", instances)).toThrow(/no instance/);
  });

  test("instanceDocumentContext is the two-part form, and the record schema accepts it", () => {
    const ctx = instanceDocumentContext("top", instances);
    expect(ctx).toEqual(["https://example.org/top/ns/context/v1.jsonld", { "@base": FOLIO_BASE }]);
    expect(ContentContextSchema.safeParse(ctx).success).toBe(true);
    expect(ContentContextSchema.safeParse(["https://example.org/top/ns/content/v1.jsonld", { "@base": FOLIO_BASE }]).success).toBe(false);
  });

  test("documentContext with an instance keeps its local bindings and swaps only the URL", () => {
    const [url, local] = documentContext(["folio-assistant-sci:Theorem"], { prefixes, instance: "top", instances });
    expect(url).toBe("https://example.org/top/ns/context/v1.jsonld");
    expect(local).toEqual({ "@base": FOLIO_BASE, "folio-assistant-sci": "https://example.org/sci/ns#" });
  });
});

describe("atInstanceContext — the emitters' write boundary", () => {
  const instances = [
    { root: "/c/top", name: "top", iriBase: "https://example.org/top/" },
    { root: "/c/bare", name: "bare" },
  ];
  const doc = { "@context": [CONTENT_CONTEXT_URL, { "@base": FOLIO_BASE, x: "https://x/" }], "@id": "a", title: "T" };

  test("names the containing instance's context, keeping the local half and key order", () => {
    const out = atInstanceContext(doc, "/c/top/library/a/manifest.jsonld", instances);
    expect(out["@context"]).toEqual(["https://example.org/top/ns/context/v1.jsonld", { "@base": FOLIO_BASE, x: "https://x/" }]);
    expect(Object.keys(out)).toEqual(["@context", "@id", "title"]);
    expect(doc["@context"][0]).toBe(CONTENT_CONTEXT_URL); // not mutated
  });

  test("outside every instance it is unchanged; another context is unchanged", () => {
    expect(atInstanceContext(doc, "/staging/a.jsonld", instances)).toBe(doc);
    const other = { "@context": { skos: "http://www.w3.org/2004/02/skos/core#" } };
    expect(atInstanceContext(other, "/c/top/a.jsonld", instances)).toBe(other);
  });

  test("inside an instance with no iriBase it THROWS", () => {
    expect(() => atInstanceContext(doc, "/c/bare/a.jsonld", instances)).toThrow(/declares no iriBase/);
  });

  test("the serialised form changes only the URL", () => {
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    const out = serialisedAtInstanceContext(text, "/c/top/a.jsonld", instances);
    expect(out).toBe(text.replace(CONTENT_CONTEXT_URL, "https://example.org/top/ns/context/v1.jsonld"));
    expect(serialisedAtInstanceContext(text, "/staging/a.jsonld", instances)).toBe(text);
  });
});
