/**
 * Each layer publishes its own schema directory — bean `4ak5` item 1, the
 * "and a schema" half (owner ruling 2026-10-05, option B).
 *
 * Three things are pinned here, each for a reason:
 *
 * - the generalised builder over a FIXTURE layer, so the `$id` rule is
 *   tested against inputs this file controls rather than whatever the corpus
 *   holds today;
 * - the host's outputs are what they were, because the generalisation's
 *   promise was "the host path byte-identical";
 * - a real foreign layer's contracts mint under ITS publication identity,
 *   not this site's — guarded by `inAggregate()`, since it reads other
 *   layers' files (standalone rule, bean `ho66`);
 * - the public Zod schemas rule (owner ruling 2026-10-05, option C, "every
 *   exported *Schema") over a fixture: only an exported Zod `*Schema` is
 *   rendered, a non-Zod `*Schema` is listed as `notZod` and NOT a failure, and
 *   an import or render failure is reported, never skipped.
 *
 * @module scripts/tests/instance-schema-export
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildDeclarationSchema,
  buildInstanceSchemas,
  buildSkillIoContracts,
  instanceSchemaBase,
  instanceSchemaIndexIri,
  scanInstanceZodSchemas,
  skillIoIri,
  zodSchemaScanDetermined,
  type InstanceIdentity,
} from "../../harness-schema-export.js";
import { instanceExportPlan } from "../../instance-exports.js";
import { publishedIdentity, publishedInstanceSchemas, scannedInstanceSchemas } from "../../kg-export.js";
import { readDeclaration } from "../../../schemas/kg/cat-harness.js";
import { hostSchemaBase } from "../../lib/host-schema.ts";
import { INSTANCE, checkoutHolding, inAggregate } from "../../../test/support/checkout.js";

const SITE = "https://site.example/pub";

/** A fixture layer holding two contracts, one carrying a hand-written (wrong) `$id`. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "instance-schema-"));
  const skill = join(root, "schemas", "skills", "widget");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "input.schema.json"), JSON.stringify({ $id: "https://wrong.example/x.json", type: "object" }));
  writeFileSync(join(skill, "output.schema.json"), JSON.stringify({ type: "string" }));
  return root;
}
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
function fx(): string {
  const r = fixture();
  roots.push(r);
  return r;
}

describe("the schema base sits beside the instance's document", () => {
  test("an instance published under this site: <site>/<stub>/schema", () => {
    const id: InstanceIdentity = { stub: "fx", base: SITE, docPath: "fx/fx.jsonld" };
    expect(instanceSchemaBase(id)).toBe(`${SITE}/fx/schema`);
    expect(instanceSchemaIndexIri(id)).toBe(`${SITE}/fx/schema/fx.schema.json`);
  });

  test("an instance with its own canonicalUrl: <canonicalUrl>/schema — its publication identity, not the staging path", () => {
    const id: InstanceIdentity = { stub: "fx", base: "https://own.example/fx", docPath: "fx.jsonld" };
    expect(instanceSchemaBase(id)).toBe("https://own.example/fx/schema");
  });

  test("no base: no $id at all, never a relative one", () => {
    expect(instanceSchemaBase({ stub: "fx", base: "", docPath: "fx/fx.jsonld" })).toBe("");
    expect(instanceSchemaIndexIri({ stub: "fx", base: "", docPath: "fx/fx.jsonld" })).toBeUndefined();
  });
});

describe("buildInstanceSchemas over a fixture instance", () => {
  test("contracts are read from that instance, and their $id is computed, never trusted from the file", () => {
    const root = fx();
    const id: InstanceIdentity = { stub: "fx", base: SITE, docPath: "fx/fx.jsonld", docIri: `${SITE}/fx/fx.jsonld` };
    const built = buildInstanceSchemas(root, id);
    expect(built.contracts.map((c) => [c.source, c.published])).toEqual([
      [join("schemas", "skills", "widget", "input.schema.json"), join("skills", "widget", "input.schema.json")],
      [join("schemas", "skills", "widget", "output.schema.json"), join("skills", "widget", "output.schema.json")],
    ]);
    for (const c of built.contracts) {
      expect(c.schema.$id).toBe(skillIoIri(`${SITE}/fx/schema`, c.skill, c.io));
    }
    // The file's own content survives; only the identity is replaced.
    expect(built.contracts[0]!.schema.type).toBe("object");
  });

  test("the index $refs the SHARED declaration schema and lists every contract by $id", () => {
    const root = fx();
    const id: InstanceIdentity = { stub: "fx", base: SITE, docPath: "fx/fx.jsonld", docIri: `${SITE}/fx/fx.jsonld` };
    const built = buildInstanceSchemas(root, id, { baseUrl: SITE });
    const [name, index] = built.files[0]!;
    expect(name).toBe("fx.schema.json");
    expect(index.$id).toBe(built.indexIri);
    expect(index.allOf).toEqual([{ $ref: buildDeclarationSchema({ baseUrl: SITE }).$id }]);
    expect(index.$defs).toEqual({
      "skills/widget/input": { $ref: `${SITE}/fx/schema/skills/widget/input.schema.json` },
      "skills/widget/output": { $ref: `${SITE}/fx/schema/skills/widget/output.schema.json` },
    });
    // Public Zod schemas are not looked for, and the index says so rather
    // than presenting an empty list as "there are none".
    expect(index.omitted).toEqual(["schemas"]);
    expect(index.$comment).toBe(`Instance graph: ${SITE}/fx/fx.jsonld`);
    expect(built.files.map(([f]) => f)).toEqual(["fx.schema.json", ...built.contracts.map((c) => c.published)]);
  });

  test("with no base the index still lists every contract, by the path both share", () => {
    const built = buildInstanceSchemas(fx(), { stub: "fx", base: "", docPath: "fx/fx.jsonld" });
    const [, index] = built.files[0]!;
    expect(index.$id).toBeUndefined();
    for (const c of built.contracts) expect(c.schema.$id).toBeUndefined();
    expect(Object.values(index.$defs as Record<string, { $ref: string }>).map((d) => d.$ref)).toEqual([
      "skills/widget/input.schema.json",
      "skills/widget/output.schema.json",
    ]);
  });

  test("an instance with no contracts still gets an index", () => {
    const empty = mkdtempSync(join(tmpdir(), "instance-schema-empty-"));
    roots.push(empty);
    const built = buildInstanceSchemas(empty, { stub: "e", base: SITE, docPath: "e/e.jsonld" });
    expect(built.contracts).toEqual([]);
    expect(built.files.map(([f]) => f)).toEqual(["e.schema.json"]);
  });
});

describe("the host's schema outputs are unchanged by the generalisation", () => {
  test("the default root IS the host: same contracts, same $ids, same paths", () => {
    const base = readDeclaration(INSTANCE)?.canonicalUrl ?? SITE;
    const byDefault = buildSkillIoContracts({ baseUrl: base });
    expect(byDefault.length).toBeGreaterThan(0);
    expect(buildSkillIoContracts({ baseUrl: base, root: INSTANCE })).toEqual(byDefault);
    for (const c of byDefault) {
      // Instance-relative source and the host's flat `skills/` publish path,
      // exactly as before the generalisation.
      expect(c.source.split("\\").join("/")).toBe(`schemas/skills/${c.skill}/${c.io}.schema.json`);
      expect(c.published.split("\\").join("/")).toBe(`skills/${c.skill}/${c.io}.schema.json`);
      // Under the host's own directory since #676, beside its document.
      expect(c.schema.$id).toBe(skillIoIri(hostSchemaBase(base), c.skill, c.io));
      // Byte-for-byte means key ORDER too: the computed `$id` replaces the
      // stored one in place. A first draft of the no-base fix moved it to the
      // end and changed every published host contract; this is what caught it.
      const source = JSON.parse(readFileSync(join(INSTANCE, c.source), "utf-8")) as Record<string, unknown>;
      expect(Object.keys(c.schema)).toEqual(Object.keys(source));
      expect({ ...c.schema, $id: source.$id } as Record<string, unknown>).toEqual(source);
    }
  });
});

describe.skipIf(!inAggregate())("a real foreign instance mints under its OWN base", () => {
  const repo = checkoutHolding(INSTANCE);

  test("smart-base declares its own canonicalUrl, so its contracts are under it — not under this site", () => {
    const root = resolve(repo, "smart-base");
    const own = readDeclaration(root)?.canonicalUrl;
    expect(own).toBeTruthy();
    const built = publishedInstanceSchemas(root, SITE);
    expect(built.contracts.length).toBeGreaterThan(0);
    for (const c of built.contracts) {
      expect(String(c.schema.$id)).toBe(skillIoIri(`${own!.replace(/\/+$/, "")}/schema`, c.skill, c.io));
      expect(String(c.schema.$id).startsWith(SITE)).toBe(false);
    }
  });

  test("folio-assistant-core has no base of its own, so it publishes under the given site, in its own segment", () => {
    const root = resolve(repo, "folio-assistant-core");
    const built = publishedInstanceSchemas(root, SITE);
    expect(built.contracts.length).toBeGreaterThan(0);
    for (const c of built.contracts) expect(c.schema.$id).toBe(skillIoIri(`${SITE}/folio-assistant-core/schema`, c.skill, c.io));
    // The same identity the document's `@id` is minted from.
    expect(built.indexIri).toBe(instanceSchemaIndexIri(publishedIdentity(root, SITE)));
  });

  test("folio-assistant-sci's contracts are found although its declared `schemas` graph is `sources/`", () => {
    const built = publishedInstanceSchemas(resolve(repo, "folio-assistant-sci"), SITE);
    expect(built.contracts.length).toBeGreaterThan(0);
  });
});

// ── PUBLIC ZOD SCHEMAS — owner ruling 2026-10-05, option C ("every exported *Schema") ──

/** The fixture's modules import zod by absolute path: they live in a temp dir with no node_modules. */
const ZOD = JSON.stringify(Bun.resolveSync("zod", import.meta.dir));

/** A fixture layer whose `schemas/` holds the given modules (name → source). */
function zodFixture(modules: Record<string, string>): string {
  const root = fx();
  for (const [name, text] of Object.entries(modules)) writeFileSync(join(root, "schemas", name), text);
  return root;
}

const WIDGETS = [
  `import { z } from ${ZOD};`,
  "export const FooSchema = z.object({ a: z.string() });",
  // Zod, but not NAMED `*Schema`: not public.
  "export const fooShape = z.string();",
  // `notASchema` DOES end in `Schema` — the rule is the suffix, literally — so
  // it is excluded only because its value is not Zod. Spelled out because the
  // name reads as if it should not match.
  'export const notASchema = "a string";',
  'export const BarSchema = { type: "object" };',
  "",
].join("\n");
const TEST_ONLY = `import { z } from ${ZOD};\nexport const TestOnlySchema = z.number();\n`;

describe("public Zod schemas over a fixture instance", () => {
  const id: InstanceIdentity = { stub: "fx", base: SITE, docPath: "fx/fx.jsonld" };

  test("only an exported Zod *Schema is public: FooSchema rendered; fooShape misnamed; BarSchema and notASchema not Zod", async () => {
    const root = zodFixture({ "widgets.ts": WIDGETS, "widgets.test.ts": TEST_ONLY });
    const scan = await scanInstanceZodSchemas(root);
    expect(scan.determined).toBe(true);
    expect(scan.dirs).toEqual(["schemas"]);
    expect(scan.found.map((f) => `${f.module}#${f.exportName}`)).toEqual(["schemas/widgets.ts#FooSchema"]);
    // Not public by the rule, so not a failure — but visible, not silent.
    expect(scan.notZod).toEqual([
      { module: "schemas/widgets.ts", exportName: "BarSchema", type: "object" },
      { module: "schemas/widgets.ts", exportName: "notASchema", type: "string" },
    ]);
    expect(scan.problems).toEqual([]);

    const built = buildInstanceSchemas(root, id, { zod: scan });
    expect(built.zodScanned).toBe(true);
    expect(built.zodProblems).toEqual([]);
    expect(built.zod.map((r) => r.published)).toEqual(["zod/widgets/FooSchema.schema.json"]);
    const doc = built.zod[0]!.schema;
    expect(doc.$id).toBe(`${SITE}/fx/schema/zod/widgets/FooSchema.schema.json`);
    expect(doc.$ref).toBe("#/definitions/Foo");
    expect((doc.definitions as Record<string, { properties: unknown }>).Foo.properties).toEqual({ a: { type: "string" } });

    const [, index] = built.files[0]!;
    expect(index.$defs).toMatchObject({ "zod/widgets/FooSchema": { $ref: doc.$id } });
    // A determined scan is a measured answer, so the `omitted` caveat goes.
    expect(index.omitted).toBeUndefined();
    expect(index.unrendered).toBeUndefined();
    expect(built.files.map(([f]) => f)).toContain("zod/widgets/FooSchema.schema.json");
  });

  test("an import failure, an unrepresentable schema and a safeParse-only fake are each reported, and the rest still renders", async () => {
    const root = zodFixture({
      "widgets.ts": WIDGETS,
      "broken.ts": 'throw new Error("boom at import");\n',
      "odd.ts": `import { z } from ${ZOD};\nexport const WhenSchema = z.date();\nexport const FakeSchema = { safeParse: () => ({ success: true }) };\n`,
    });
    const scan = await scanInstanceZodSchemas(root);
    expect(scan.problems).toHaveLength(1);
    expect(scan.problems[0]).toContain("schemas/broken.ts: could not be imported: boom at import");
    const built = buildInstanceSchemas(root, id, { zod: scan });
    expect(built.zodProblems).toHaveLength(3);
    expect(built.zodProblems.join("\n")).toContain("schemas/odd.ts#WhenSchema: could not be rendered: Date cannot be represented");
    expect(built.zodProblems.join("\n")).toContain("schemas/odd.ts#FakeSchema: has `safeParse` but is not a zod-4 schema");
    expect(built.zod.map((r) => r.exportName)).toEqual(["FooSchema"]);
    // The index says what it could not render, so "not rendered" is not "not there".
    expect(built.files[0]![1].unrendered).toEqual(built.zodProblems);
  });

  test("an undetermined scan keeps `omitted`, and its reason reaches the index", () => {
    const built = buildInstanceSchemas(fx(), id, {
      zod: { determined: false, dirs: [], found: [], notZod: [], problems: ["the schemas directory could not be resolved: x"] },
    });
    expect(built.zodScanned).toBe(false);
    expect(built.files[0]![1].omitted).toEqual(["schemas"]);
    expect(built.files[0]![1].unrendered).toEqual(["the schemas directory could not be resolved: x"]);
  });

  test("the JSON-LD's `omitted` asks the scan's own question, without importing: determined exactly when the scan is", async () => {
    // `kg-export.ts` keeps `schemas` in a document's `omitted` when this is
    // false, so the document and its index cannot disagree about it.
    const ok = fx();
    expect(zodSchemaScanDetermined(ok)).toBe(true);
    expect((await scanInstanceZodSchemas(ok)).determined).toBe(true);
    // A declaration that is present and unreadable: its directories cannot be resolved.
    const broken = join(fx(), "broken");
    mkdirSync(broken);
    writeFileSync(join(broken, "broken.json"), JSON.stringify({ name: "broken", directories: "not a list" }));
    expect(zodSchemaScanDetermined(broken)).toBe(false);
    expect((await scanInstanceZodSchemas(broken)).determined).toBe(false);
  });

  test("an instance with no schemas directory is a determined zero", async () => {
    const empty = mkdtempSync(join(tmpdir(), "instance-schema-nozod-"));
    roots.push(empty);
    const scan = await scanInstanceZodSchemas(empty);
    expect(scan).toMatchObject({ determined: true, found: [], problems: [] });
  });
});

describe.skipIf(!inAggregate())("every planned instance's public Zod schemas render (real corpus)", () => {
  const repo = checkoutHolding(INSTANCE);
  const plan = instanceExportPlan(repo);

  test("every planned instance is scanned, with no import or render failure", async () => {
    for (const p of plan) {
      const built = await scannedInstanceSchemas(resolve(repo, p.path), SITE);
      expect({ stub: p.stub, scanned: built.zodScanned, problems: built.zodProblems }).toEqual({ stub: p.stub, scanned: true, problems: [] });
    }
  });

  test("the instances measured on 2026-10-05 with Zod schema modules publish some; sources/-declared ones publish none", async () => {
    const counts = new Map<string, number>();
    for (const p of plan) counts.set(p.stub, (await scannedInstanceSchemas(resolve(repo, p.path), SITE)).zod.length);
    for (const s of ["bootstrap-tools", "fhir-harness", "folio-assistant-core", "smart-base"]) {
      expect(counts.get(s) ?? 0).toBeGreaterThan(0);
    }
    // Declared `schemas` graph is `sources/` (JSON descriptors): scanned there, so a determined zero.
    for (const s of ["folio-assistant-sci", "who-iris"]) expect(counts.get(s)).toBe(0);
  });
});
