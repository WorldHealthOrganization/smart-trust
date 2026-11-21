/**
 * `pipeline/instance-document-context.ts` — the emitters' write boundary
 * (bean folio-assistant-63q4). The same cases as cat-harness#257's
 * `content-context.test.ts`, so the two copies cannot drift apart unnoticed.
 */
import { describe, expect, test } from "bun:test";

import { CONTENT_CONTEXT_URL, FOLIO_BASE } from "../schemas/kg/jsonld.ts";

import { atInstanceContext, awaitingRebase, awaitingRebaseNote, INSTANCE_CONTEXT_PATH, instanceContextUrl, serialisedAtInstanceContext } from "./instance-document-context.ts";

const instances = [
  { root: "/c/top", name: "top", iriBase: "https://example.org/top/", version: "0.3.1" },
  { root: "/c/top/nested", name: "nested", iriBase: "https://example.org/nested", version: "2.0.0" },
  { root: "/c/bare", name: "bare" },
  { root: "/c/unversioned", name: "unversioned", iriBase: "https://example.org/u/" },
];
const doc = { "@context": [CONTENT_CONTEXT_URL, { "@base": FOLIO_BASE, x: "https://x/" }], "@id": "a", title: "T" };

describe("instance context URLs", () => {
  test("<iriBase>ns/context/v1.jsonld, with or without the trailing slash", () => {
    expect(instanceContextUrl("https://example.org/top/")).toBe(`https://example.org/top/${INSTANCE_CONTEXT_PATH}`);
    expect(instanceContextUrl("https://example.org/top")).toBe("https://example.org/top/ns/context/v1.jsonld");
  });
});

describe("atInstanceContext", () => {
  test("names the innermost containing instance's context and release base, keeping the other bindings and key order", () => {
    const out = atInstanceContext(doc, "/c/top/library/a/manifest.jsonld", instances);
    expect(out["@context"]).toEqual(["https://example.org/top/ns/context/v1.jsonld", { "@base": "https://example.org/top/v0/", x: "https://x/" }]);
    expect(Object.keys(out)).toEqual(["@context", "@id", "title"]);
    expect(atInstanceContext(doc, "/c/top/nested/b.jsonld", instances)["@context"][0]).toBe("https://example.org/nested/ns/context/v1.jsonld");
    expect(atInstanceContext(doc, "/c/top/nested/b.jsonld", instances)["@context"][1]).toEqual({ "@base": "https://example.org/nested/v2/", x: "https://x/" });
    expect(doc["@context"]).toEqual([CONTENT_CONTEXT_URL, { "@base": FOLIO_BASE, x: "https://x/" }]); // not mutated
  });

  test("a local @base other than the shared one (the docs site's) is kept", () => {
    const site = { "@context": [CONTENT_CONTEXT_URL, { "@base": "https://example.org/site/" }], "@id": "a" };
    expect(atInstanceContext(site, "/c/top/a.jsonld", instances)["@context"]).toEqual(["https://example.org/top/ns/context/v1.jsonld", { "@base": "https://example.org/site/" }]);
  });

  test("an instance with an iriBase but no MAJOR.MINOR.PATCH version THROWS, naming it", () => {
    expect(() => atInstanceContext(doc, "/c/unversioned/a.jsonld", instances)).toThrow(/unversioned has no release/);
  });

  test("outside every instance, or on another context, unchanged", () => {
    expect(atInstanceContext(doc, "/staging/a.jsonld", instances)).toBe(doc);
    const other = { "@context": { skos: "http://www.w3.org/2004/02/skos/core#" } };
    expect(atInstanceContext(other, "/c/top/a.jsonld", instances)).toBe(other);
  });

  test("inside an instance with no iriBase it THROWS", () => {
    expect(() => atInstanceContext(doc, "/c/bare/a.jsonld", instances)).toThrow(/declares no iriBase/);
  });

  test("the serialised form changes only the URL and the base", () => {
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    expect(serialisedAtInstanceContext(text, "/c/top/a.jsonld", instances)).toBe(
      text.replace(CONTENT_CONTEXT_URL, "https://example.org/top/ns/context/v1.jsonld").replace(FOLIO_BASE, "https://example.org/top/v0/"),
    );
    expect(serialisedAtInstanceContext(text, "/staging/a.jsonld", instances)).toBe(text);
  });
});

describe("awaitingRebase — the 1A transition under --check", () => {
  const next = `${JSON.stringify({ "@context": ["https://example.org/top/ns/context/v1.jsonld", { "@base": "https://example.org/top/v0/" }], "@id": "a" }, null, 2)}\n`;
  const committed = next.replace("https://example.org/top/v0/", FOLIO_BASE);

  test("a file differing only by the old shared @base awaits regeneration", () => {
    expect(awaitingRebase(committed, next)).toBe(true);
  });

  test("any other difference is still stale", () => {
    expect(awaitingRebase(committed.replace('"a"', '"b"'), next)).toBe(false);
    expect(awaitingRebase(undefined, next)).toBe(false);
    expect(awaitingRebase(next, next)).toBe(false);
    // The docs site's base is not the old shared one, so it is not let through.
    expect(awaitingRebase(next.replace("https://example.org/top/v0/", "https://example.org/site/"), next)).toBe(false);
  });

  test("the note names the count, and is silent at zero", () => {
    expect(awaitingRebaseNote("gen-x", 0)).toBeUndefined();
    expect(awaitingRebaseNote("gen-x", 3)).toContain("3 file(s)");
  });
});
