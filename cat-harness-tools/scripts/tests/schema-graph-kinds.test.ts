/**
 * The schema-graph projection's validator knows every kind the generator
 * emits.
 *
 * `schema-graph.ts` types a declaration's kind as `DeclKind`;
 * `schemas/ui/site-indexes.ts` validates the projection against `DECL_KINDS`.
 * They are two lists of one fact, and they drifted: `json-schema` (bootstrap's
 * `.schema.json` declarations) was emitted 28 times and accepted by nothing,
 * so `check:kind-validators` failed the committed `docs/assets/schemas/index.json`
 * (folio-assistant#2518, 2026-10-09). Not an import from `scripts/` into
 * `schemas/` — that would point the dependency the wrong way — but this test,
 * which fails to COMPILE when a kind is added to one list and not the other.
 */
import { describe, expect, test } from "bun:test";

import { DECL_KINDS } from "../../schemas/ui/site-indexes.ts";
import type { DeclKind } from "../schema-graph.ts";

/** Exhaustive over `DeclKind`: adding a kind there and not here fails `tsc`. */
const EVERY_EMITTED_KIND: Record<DeclKind, true> = {
  "zod-object": true,
  "zod-union": true,
  "zod-enum": true,
  "zod-array": true,
  "zod-record": true,
  "zod-scalar": true,
  interface: true,
  "type-alias": true,
  "json-schema": true,
  "fhir-logical": true,
  "fhir-profile": true,
  "owl-class": true,
  "rdfs-class": true,
  "rdf-property-set": true,
  "moddle-class": true,
  "moddle-enum": true,
  undetermined: true,
};

describe("schema-graph kinds", () => {
  test("the validator accepts every kind the generator emits, and nothing else", () => {
    expect([...DECL_KINDS].sort() as string[]).toEqual(Object.keys(EVERY_EMITTED_KIND).sort());
  });

  test("DECL_KINDS names only DeclKinds (a compile-time check, asserted at run time too)", () => {
    const asDeclKinds: readonly DeclKind[] = DECL_KINDS;
    expect(asDeclKinds.length).toBe(Object.keys(EVERY_EMITTED_KIND).length);
  });
});
