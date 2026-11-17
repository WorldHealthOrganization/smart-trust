/**
 * `pipeline/instance-document-context.ts` — the emitters' write boundary
 * (bean folio-assistant-63q4). The same cases as cat-harness#257's
 * `content-context.test.ts`, so the two copies cannot drift apart unnoticed.
 */
import { describe, expect, test } from "bun:test";

import { CONTENT_CONTEXT_URL, FOLIO_BASE } from "../schemas/kg/jsonld.ts";

import { atInstanceContext, INSTANCE_CONTEXT_PATH, instanceContextUrl, serialisedAtInstanceContext } from "./instance-document-context.ts";

const instances = [
  { root: "/c/top", name: "top", iriBase: "https://example.org/top/" },
  { root: "/c/top/nested", name: "nested", iriBase: "https://example.org/nested" },
  { root: "/c/bare", name: "bare" },
];
const doc = { "@context": [CONTENT_CONTEXT_URL, { "@base": FOLIO_BASE, x: "https://x/" }], "@id": "a", title: "T" };

describe("instance context URLs", () => {
  test("<iriBase>ns/context/v1.jsonld, with or without the trailing slash", () => {
    expect(instanceContextUrl("https://example.org/top/")).toBe(`https://example.org/top/${INSTANCE_CONTEXT_PATH}`);
    expect(instanceContextUrl("https://example.org/top")).toBe("https://example.org/top/ns/context/v1.jsonld");
  });
});

describe("atInstanceContext", () => {
  test("names the innermost containing instance's context, keeping the local half and key order", () => {
    const out = atInstanceContext(doc, "/c/top/library/a/manifest.jsonld", instances);
    expect(out["@context"]).toEqual(["https://example.org/top/ns/context/v1.jsonld", { "@base": FOLIO_BASE, x: "https://x/" }]);
    expect(Object.keys(out)).toEqual(["@context", "@id", "title"]);
    expect(atInstanceContext(doc, "/c/top/nested/b.jsonld", instances)["@context"][0]).toBe("https://example.org/nested/ns/context/v1.jsonld");
    expect(doc["@context"][0]).toBe(CONTENT_CONTEXT_URL); // not mutated
  });

  test("outside every instance, or on another context, unchanged", () => {
    expect(atInstanceContext(doc, "/staging/a.jsonld", instances)).toBe(doc);
    const other = { "@context": { skos: "http://www.w3.org/2004/02/skos/core#" } };
    expect(atInstanceContext(other, "/c/top/a.jsonld", instances)).toBe(other);
  });

  test("inside an instance with no iriBase it THROWS", () => {
    expect(() => atInstanceContext(doc, "/c/bare/a.jsonld", instances)).toThrow(/declares no iriBase/);
  });

  test("the serialised form changes only the URL", () => {
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    expect(serialisedAtInstanceContext(text, "/c/top/a.jsonld", instances)).toBe(text.replace(CONTENT_CONTEXT_URL, "https://example.org/top/ns/context/v1.jsonld"));
    expect(serialisedAtInstanceContext(text, "/staging/a.jsonld", instances)).toBe(text);
  });
});
