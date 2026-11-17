/**
 * The two ingest inputs (bean `folio-assistant-7jkp`): a repository document
 * and a rendered (published-URL) document, side by side in one config.
 *
 * @module openapi/schemas/openapi.test
 */
import { describe, expect, test } from "bun:test";

import { OPENAPI_CONFIG_SCHEMA_TAG, OPENAPI_SOURCE_SCHEMA_TAG, OpenApiConfigSchema, OpenApiRenderedProvenanceSchema } from "./openapi.ts";

const repoDoc = { id: "gateway", source: { repository: "WorldHealthOrganization/smart-trust-network-gateway", path: "openapi.json" } };
const renderedDoc = { id: "gateway-published", rendered: { url: "https://example.org/openapi.json" } };

describe("cat-openapi-config/v1: repository and rendered documents", () => {
  test("a config may hold only repository documents, as before", () => {
    const c = OpenApiConfigSchema.parse({ $schema: OPENAPI_CONFIG_SCHEMA_TAG, directory: "openapi", documents: [repoDoc] });
    expect(c.rendered).toEqual([]);
    expect(c.documents[0]!.source.ref).toBe("main");
  });

  test("…or only rendered ones", () => {
    const c = OpenApiConfigSchema.parse({ $schema: OPENAPI_CONFIG_SCHEMA_TAG, directory: "openapi", rendered: [renderedDoc] });
    expect(c.documents).toEqual([]);
    expect(c.rendered[0]!.rendered.url).toBe("https://example.org/openapi.json");
  });

  test("but not neither", () => {
    expect(OpenApiConfigSchema.safeParse({ $schema: OPENAPI_CONFIG_SCHEMA_TAG, directory: "openapi" }).success).toBe(false);
  });

  test("an id is unique across BOTH lists — one directory holds them all", () => {
    const r = OpenApiConfigSchema.safeParse({ $schema: OPENAPI_CONFIG_SCHEMA_TAG, directory: "openapi", documents: [repoDoc], rendered: [{ ...renderedDoc, id: "gateway" }] });
    expect(r.success).toBe(false);
  });

  test("a rendered spec is read over https only", () => {
    const r = OpenApiConfigSchema.safeParse({ $schema: OPENAPI_CONFIG_SCHEMA_TAG, directory: "openapi", rendered: [{ id: "x", rendered: { url: "http://example.org/openapi.json" } }] });
    expect(r.success).toBe(false);
  });
});

describe("folio-openapi-source/v1 for a rendered document", () => {
  const prov = {
    $schema: OPENAPI_SOURCE_SCHEMA_TAG,
    id: "gateway-published",
    file: "gateway-published.openapi.json",
    source: { url: "https://example.org/openapi.json", fetchedAt: "2026-10-11T06:00:00.000Z" },
    bytes: 10,
    openapi: "3.0.3",
    title: "T",
    version: "1",
    operations: 0,
    materialization: {
      $schema: "folio-materialization/v1",
      state: "materialized",
      localPath: "openapi/gateway-published.openapi.json",
      purpose: "working",
      fixity: { algorithm: "sha256", digest: "a".repeat(64) },
    },
  };

  test("records the URL and when it was fetched — no commit to pin", () => {
    expect(OpenApiRenderedProvenanceSchema.safeParse(prov).success).toBe(true);
  });

  test("a fetch time is required: undated cannot be told from stale", () => {
    expect(OpenApiRenderedProvenanceSchema.safeParse({ ...prov, source: { url: prov.source.url } }).success).toBe(false);
  });
});
