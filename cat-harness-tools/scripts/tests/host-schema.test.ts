/**
 * The host's schema documents sit under its own directory, `<site>/<name>/`,
 * with a one-release tombstone at each old site-root address (#676; #603
 * decision 1b(i), "move all").
 *
 * @module scripts/tests/host-schema
 */
import { describe, expect, test } from "bun:test";

import { artefactStub, readDeclaration } from "../../schemas/kg/cat-harness.js";
import {
  artefactDeclarationDrift,
  buildSkillIoContracts,
  buildToolTypeFiles,
  schemaFiles,
  schemaTombstones,
  skillIoIri,
  staleSkillIoIds,
} from "../harness-schema-export.js";
import { hostName, hostSchemaBase, hostSchemaPath, legacyHostSchemaPath, movedSchema } from "../lib/host-schema.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const BASE = "https://example.invalid/fa";
const NAME = hostName();
const STUB = artefactStub(readDeclaration(HARNESS_ROOT)!);

/** Everything the deploy writes, by site-relative path — the CLI's own list. */
function published(baseUrl: string): Array<[string, Record<string, unknown>]> {
  return [
    ...schemaFiles(STUB, baseUrl),
    ...buildToolTypeFiles({ baseUrl }).map(([p, d]): [string, Record<string, unknown>] => [hostSchemaPath(p), d]),
    ...buildSkillIoContracts({ baseUrl }).map((c): [string, Record<string, unknown>] => [
      hostSchemaPath(c.published.split("\\").join("/")),
      c.schema,
    ]),
  ];
}

describe("the host's schema base", () => {
  test("is its own directory under the site, by its declared name", () => {
    expect(NAME).toBe(readDeclaration(HARNESS_ROOT)!.name);
    expect(hostSchemaBase(`${BASE}/`)).toBe(`${BASE}/${NAME}`);
    expect(hostSchemaPath("tool.schema.json")).toBe(`${NAME}/tool.schema.json`);
    expect(legacyHostSchemaPath(`${NAME}/tool-types/Url.schema.json`)).toBe("tool-types/Url.schema.json");
    expect(legacyHostSchemaPath("tool.schema.json")).toBeUndefined();
  });

  test("is empty with no base: an $id is absolute or absent", () => {
    expect(hostSchemaBase("")).toBe("");
  });

  test("every document the export writes sits under it, at the address its $id names", () => {
    const docs = published(BASE);
    expect(docs.length).toBeGreaterThan(3);
    for (const [path, doc] of docs) {
      expect(path.startsWith(`${NAME}/`)).toBe(true);
      expect(doc.$id).toBe(`${BASE}/${path}`);
    }
  });
});

describe("the tombstones at the old site-root addresses", () => {
  const docs = published(BASE);
  const tombs = new Map(schemaTombstones(docs));

  test("one per moved document, at its old path, naming its old $id", () => {
    expect(tombs.size).toBe(docs.length);
    for (const [path, doc] of docs) {
      const old = legacyHostSchemaPath(path)!;
      const t = tombs.get(old)!;
      expect(t, old).toBeDefined();
      expect(t.$id).toBe(`${BASE}/${old}`);
      expect(t.deprecated).toBe(true);
      expect(t.isReplacedBy).toBe(doc.$id);
      // Validates as the new document does: `allOf`, since draft-07 ignores
      // every keyword beside a bare `$ref`.
      expect(t.allOf).toEqual([{ $ref: doc.$id }]);
    }
  });

  test("the type vocabulary forwards every `#/$defs/<Name>` a port named before the move", () => {
    const t = tombs.get("tool-types.schema.json")!;
    const defs = t.$defs as Record<string, { $ref: string }>;
    const types = buildToolTypeFiles({ baseUrl: BASE });
    expect(Object.keys(defs).sort()).toEqual(types.map(([p]) => p.replace(/^tool-types\/|\.schema\.json$/g, "")).sort());
    for (const [, d] of types) {
      const name = String(d.title);
      expect(defs[name]!.$ref).toBe(d.$id as string);
    }
  });

  test("a preview's tombstones forward to the preview's documents", () => {
    const STAGING = `${BASE}/STAGING/slug`;
    for (const [old, t] of schemaTombstones(published(STAGING))) {
      expect(t.$id).toBe(`${STAGING}/${old}`);
      expect(String(t.isReplacedBy)).toBe(`${STAGING}/${NAME}/${old}`);
    }
  });

  test("a document with no $id gets none: there is no address to forward from", () => {
    expect(schemaTombstones([[`${NAME}/tool.schema.json`, { title: "x" }]])).toEqual([]);
  });

  test("the stamp is carried", () => {
    expect(movedSchema("a", "b", "T", {}, { staging: { run: 1 } }).staging).toEqual({ run: 1 });
  });
});

describe("one release of tolerance for the old addresses", () => {
  test("a contract still carrying its old root $id is accepted by the check, and rewritten by --write-ids", () => {
    // The only difference `--write-ids` may find is the move itself.
    for (const s of staleSkillIoIds({}, { acceptLegacy: false })) {
      expect(s.expected.replace(`/${NAME}/skills/`, "/skills/")).toBe(s.stored);
    }
    expect(staleSkillIoIds()).toEqual([]);
    const base = readDeclaration(HARNESS_ROOT)!.canonicalUrl!;
    for (const c of buildSkillIoContracts()) expect(c.schema.$id).toBe(skillIoIri(hostSchemaBase(base), c.skill, c.io));
  });

  test("a Tool declaring a host schema at its old root path still matches the moved file", () => {
    const drift = artefactDeclarationDrift(schemaFiles(STUB).map(([n]) => n));
    expect(drift.undeclared).toEqual([]);
    expect(drift.unproduced).toEqual([]);
  });
});
