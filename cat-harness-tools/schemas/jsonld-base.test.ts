/**
 * Bean `bh4q`: a content document's `@id`s must resolve to FOLIO_BASE under a
 * STRICT JSON-LD 1.1 processor, which ignores `@base` in a remote context
 * (§4.1.3). jsonld.js does not ignore it, so the strict processor is simulated
 * by serving the published context with its `@base` removed and loading the
 * document from a foreign URL.
 */
import { describe, expect, test } from "bun:test";

import jsonld from "jsonld";

import { CONTENT_CONTEXT, CONTENT_CONTEXT_URL, CONTENT_DOCUMENT_CONTEXT, ContentContextSchema, FOLIO_BASE } from "./kg/jsonld.ts";

const FOREIGN = "https://example.org/somewhere/else/doc.jsonld";

/** The published context as a strict processor sees it: no `@base`. */
const strictLoader = async (url: string) => {
  if (url !== CONTENT_CONTEXT_URL) throw new Error(`unexpected fetch: ${url}`);
  const { "@base": _ignored, ...rest } = CONTENT_CONTEXT as Record<string, unknown>;
  return { contextUrl: null, documentUrl: url, document: { "@context": rest } };
};

async function idOf(context: unknown): Promise<string> {
  const doc = { "@context": context, "@id": "papers/x/blocks/def-foo", "@type": "doco:Section" };
  const out = (await jsonld.expand(doc as never, { documentLoader: strictLoader, base: FOREIGN } as never)) as unknown as {
    "@id": string;
  }[];
  return out[0]!["@id"];
}

describe("content @id under a strict JSON-LD 1.1 processor", () => {
  test("the two-part context resolves against FOLIO_BASE", async () => {
    expect(await idOf(CONTENT_DOCUMENT_CONTEXT)).toBe(`${FOLIO_BASE}papers/x/blocks/def-foo`);
  });

  test("control: the bare URL resolves against the document's own URL — the defect", async () => {
    expect(await idOf(CONTENT_CONTEXT_URL)).toBe("https://example.org/somewhere/else/papers/x/blocks/def-foo");
  });
});

describe("ContentContextSchema", () => {
  test("accepts the two-part form and the bare URL older records carry", () => {
    expect(ContentContextSchema.safeParse([...CONTENT_DOCUMENT_CONTEXT]).success).toBe(true);
    expect(ContentContextSchema.safeParse(CONTENT_CONTEXT_URL).success).toBe(true);
  });

  test("refuses any other context or base", () => {
    expect(ContentContextSchema.safeParse("https://example.org/ctx.jsonld").success).toBe(false);
    expect(ContentContextSchema.safeParse([CONTENT_CONTEXT_URL, { "@base": "https://example.org/" }]).success).toBe(false);
    expect(ContentContextSchema.safeParse([CONTENT_CONTEXT_URL, { "@base": FOLIO_BASE, x: 1 }]).success).toBe(false);
  });
});
