/**
 * Resolving a graph typology's validator — and above all, the three states.
 *
 * Bean `folio-assistant-i31r`. The assertion that matters is that
 * **undeclared is not success**: 14 of 16 kinds are in that state, so a
 * resolver that collapsed it into a pass would report a clean sweep over
 * most of the corpus.
 */
import { describe, expect, test } from "bun:test";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  ValidatorRefError,
  isZodSchema,
  parseValidatorRef,
  resolveKindValidator,
} from "./kg/kind-validator.ts";
import { GraphTypologyRegistry, type GraphTypologyDef } from "./kg/cat-harness.ts";

const INSTANCE = HARNESS_ROOT;

function registryWith(def: Partial<GraphTypologyDef> & { validator?: string }): GraphTypologyRegistry {
  const r = new GraphTypologyRegistry({});
  r.register("test-kind", {
    type: "urn:x:TestGraph",
    renderable: false,
    summary: "a kind for tests",
    ...def,
  } as GraphTypologyDef);
  return r;
}

describe("parseValidatorRef", () => {
  test("`module#Export` splits", () => {
    expect(parseValidatorRef("schemas/x.ts#XSchema")).toEqual({
      module: "schemas/x.ts",
      exportName: "XSchema",
    });
  });

  test("a bare module is REFUSED — the export is not optional", () => {
    // `schemas/sdlc/health-report.ts` exports five schemas. A default would pick
    // one silently, which is how a validator checks the wrong shape and passes.
    expect(() => parseValidatorRef("schemas/x.ts")).toThrow(ValidatorRefError);
    expect(() => parseValidatorRef("schemas/x.ts")).toThrow(/#Export/);
  });

  test("an absolute or escaping module is refused", () => {
    // It would resolve into whatever checkout is next door.
    // input-site: inert #e2265d8e — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(() => parseValidatorRef("/etc/x.ts#S")).toThrow(/instance-relative/);
    expect(() => parseValidatorRef("../other/x.ts#S")).toThrow(/instance-relative/);
  });

  test("an empty half is refused", () => {
    expect(() => parseValidatorRef("#S")).toThrow(ValidatorRefError);
    expect(() => parseValidatorRef("schemas/x.ts#")).toThrow(ValidatorRefError);
  });
});

describe("isZodSchema", () => {
  test("an interface-shaped object is not one", () => {
    // The `qa` case: its declared module exports TypeScript interfaces, which
    // document a shape and cannot check one.
    expect(isZodSchema({})).toBe(false);
    expect(isZodSchema(undefined)).toBe(false);
    expect(isZodSchema({ safeParse: () => ({}) })).toBe(true);
  });
});

describe("resolveKindValidator — three states", () => {
  test("undeclared is its OWN state, not a pass and not a failure", async () => {
    const r = await resolveKindValidator("test-kind", INSTANCE, registryWith({}));
    expect(r.state).toBe("undeclared");
    if (r.state === "undeclared") expect(r.reason).toMatch(/declares no validator/);
  });

  test("a declared validator that loads resolves to something runnable", async () => {
    const r = await resolveKindValidator(
      "test-kind",
      INSTANCE,
      registryWith({ validator: "schemas/sdlc/health-report.ts#HealthReportSchema" }),
    );
    expect(r.state).toBe("resolved");
    if (r.state === "resolved") expect(typeof r.schema.safeParse).toBe("function");
  });

  test("a missing module is unresolvable, and says which path", async () => {
    const r = await resolveKindValidator(
      "test-kind",
      INSTANCE,
      registryWith({ validator: "schemas/nope.ts#S" }),
    );
    expect(r.state).toBe("unresolvable");
    if (r.state === "unresolvable") expect(r.reason).toMatch(/nope\.ts/);
  });

  test("a missing export is unresolvable", async () => {
    const r = await resolveKindValidator(
      "test-kind",
      INSTANCE,
      registryWith({ validator: "schemas/sdlc/health-report.ts#NotAThing" }),
    );
    expect(r.state).toBe("unresolvable");
    if (r.state === "unresolvable") expect(r.reason).toMatch(/exports no NotAThing/);
  });

  test("an export that is not a Zod schema is unresolvable, not silently accepted", async () => {
    // The distinction the two fields exist to keep apart: a module can name
    // where a shape is DEFINED without offering anything to run.
    const r = await resolveKindValidator(
      "test-kind",
      INSTANCE,
      registryWith({ validator: "schemas/sdlc/health-report.ts#HEALTH_CHECKS" }),
    );
    expect(r.state).toBe("unresolvable");
    if (r.state === "unresolvable") expect(r.reason).toMatch(/not a Zod schema|exports no/);
  });

  test("an unknown kind is unresolvable rather than undeclared", async () => {
    // The two would otherwise be indistinguishable, and they are different
    // mistakes: a typo in the kind, versus a kind with nothing to run.
    const r = await resolveKindValidator("ghost", INSTANCE, registryWith({}));
    expect(r.state).toBe("unresolvable");
  });
});

describe("this instance's own kinds", () => {
  test("every declared validator resolves, and the count is not asserted", async () => {
    // Named states rather than a count: a number here reports a new graph
    // kind as a failure. What must hold is that nothing DECLARED is broken.
    const { sweep } = await import("../scripts/check-kind-validators");
    const r = await sweep(INSTANCE);
    expect(r.unresolvable).toEqual([]);
    expect(r.resolved.length + r.undeclared.length).toBeGreaterThan(0);
    // `qa` has no kind-level validator — its families differ — so it is
    // checked per `$schema` family instead (bean `rdkm`), never "undeclared".
    expect(r.undeclared).not.toContain("qa");
    expect(r.resolved).toContain("qa (per $schema family)");
  });
});

describe("kindForPath", () => {
  test("the LONGEST matching directory wins, because declarations nest", async () => {
    const { kindForPath } = await import("../scripts/kg-validate.ts");
    const root = mkdtempSync(join(tmpdir(), "kfp-"));
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(join(root, "beans", "defs", "a.md"), "");
    const dirs = [
      { path: "beans/", graphTypologies: ["beans"] },
      { path: "beans/defs/", graphTypologies: ["bean-defs"] },
    ];
    expect(kindForPath(join(root, "beans", "defs", "a.md"), root, dirs)).toBe("bean-defs");
    rmSync(root, { recursive: true, force: true });
  });

  test("a directory declaring SEVERAL graphs yields nothing, rather than guessing", async () => {
    // `schemas/` declares two. Picking one would be the lie of precision the
    // `cat-harness` kind's own doc comment warns about.
    const { kindForPath } = await import("../scripts/kg-validate.ts");
    const root = mkdtempSync(join(tmpdir(), "kfp2-"));
    mkdirSync(join(root, "schemas"), { recursive: true });
    const dirs = [{ path: "schemas/", graphTypologies: ["schemas", "cat-harness"] }];
    expect(kindForPath(join(root, "schemas", "x.ts"), root, dirs)).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  test("a path outside the root belongs to no kind", async () => {
    const { kindForPath } = await import("../scripts/kg-validate.ts");
    // input-site: inert #6813ae8c — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(kindForPath("/etc/passwd", "/tmp/x", [{ path: "a/", graphTypologies: ["beans"] }]))
      .toBeUndefined();
  });
});

describe("per-family node schemas (bean rdkm)", () => {
  const HARNESS = HARNESS_ROOT;

  test("qa names every family, and each resolves to a schema, a shape, or a recorded absence", async () => {
    const { resolveNodeSchemas } = await import("./kg/kind-validator.ts");
    const fams = await resolveNodeSchemas("qa", HARNESS);
    expect(fams.map((f) => f.tag).sort()).toEqual([
      "block-qa/v1", "folio-detangle-sidecar/v1", "folio-lsi-index/v1", "folio-qa-index/v1",
      // The authored-page translation list, an asset since bean `4l4d`
      // (it was the Jekyll data file `_data/translation-qa-pages.json`).
      "folio-qa-translation-pages/v1",
      "folio-test-run/v1",
      // A downstream Tool's run record, bean `fq5u`.
      "folio-tool-run/v1",
      // `kg-qa-manifest/v1` joined the `qa` kind on 2026-09-27, from `skills`.
      // The manifest records the auditor's identity for the `kg-qa/v1` files
      // beside it, and it used to live in `skills/` — harmless while ONE
      // layer was audited, a defect once every layer was: `kg-audit.ts`
      // writes it unconditionally, so that home CREATED a `skills/` directory
      // holding no skills in each of the six layers that have none. The
      // registration had to move with the file: a kind claiming a `$schema`
      // whose files live in another kind's directory is a validator aimed at
      // nothing. The list grew because the KIND did.
      "kg-qa-manifest/v1", "kg-qa/v1",
      "qa-results/v1",
      "qa-script/v1", "qa-witness/v1", "translation-qa/v1", "viewer-nav-qa/v1",
    ]);
    expect(fams.filter((f) => f.state === "unresolvable")).toEqual([]);
    expect(fams.find((f) => f.tag === "kg-qa/v1")?.state).toBe("resolved");
    expect(fams.find((f) => f.tag === "kg-qa-manifest/v1")?.state).toBe("resolved");
    expect(fams.find((f) => f.tag === "qa-witness/v1")?.state).toBe("shape");
    // Typed since bean `dv8v` (#1168 B6b); it was the untyped example until then.
    expect(fams.find((f) => f.tag === "folio-qa-index/v1")?.state).toBe("resolved");
  });

  test("a shape is read from source, fields and optionality included", async () => {
    const { readShape } = await import("./kg/kind-validator.ts");
    const dir = mkdtempSync(join(tmpdir(), "shape-"));
    writeFileSync(join(dir, "m.ts"), "export interface Thing { id: string; note?: number }\n");
    const r = readShape(dir, "m.ts#Thing");
    expect(r).toEqual({
      ref: { module: "m.ts", exportName: "Thing" },
      fields: [
        { name: "id", optional: false, type: "string" },
        { name: "note", optional: true, type: "number" },
      ],
    });
    expect(typeof readShape(dir, "m.ts#Missing")).toBe("string");
    rmSync(dir, { recursive: true, force: true });
  });

  test("kg-validate routes a qa node by its $schema tag", async () => {
    // Over FIXTURES planted in the declared `qa` directory, never over the
    // committed corpus (bean `cxcn`, reader audit F7 R67): the routing is a
    // fact about the declaration and the node's tag, and the corpus is leaving
    // `main`. The directory may be absent (it is a `qa` kind, which may leave
    // `main`), so it is created for the fixture and removed after if so.
    const { validatePath } = await import("../scripts/kg-validate.ts");
    const { existsSync } = await import("node:fs");
    const { KG_QA_SCHEMA, tally } = await import("./sdlc/kg-qa.ts");
    const results = join(HARNESS, "test", "results");
    const hadResults = existsSync(results);
    const dir = join(results, `.kind-validator-fixture-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    try {
      const criteria = { "skill-ref-resolves": { result: "pass" as const, findings: [] } };
      const kg = join(dir, "p.kg-qa.json");
      writeFileSync(kg, JSON.stringify({
        $schema: KG_QA_SCHEMA,
        subject: { kind: "process", id: "P", path: "p.bpmn" },
        source_hash: "sha256:x",
        criteria,
        totals: tally(criteria),
      }));
      expect((await validatePath(kg, HARNESS)).state).toBe("valid");
      const witness = join(dir, "p.block.json");
      writeFileSync(witness, JSON.stringify({ $schema: "qa-witness/v1" }));
      // `qa-witness/v1` is a TypeScript shape, so it is UNDETERMINED — not valid.
      expect((await validatePath(witness, HARNESS)).state).toBe("undetermined");
    } finally {
      rmSync(hadResults ? dir : results, { recursive: true, force: true });
    }
  });
});

describe("instance-qualified references (bean quda)", () => {
  test("`name:module#Export` resolves through the instance that declares the name", async () => {
    const { parseValidatorRef, rootOf } = await import("./kg/kind-validator.ts");
    expect(parseValidatorRef("folio-assistant-core:schemas/catalogue.ts#CatalogueSchema")).toEqual({
      instance: "folio-assistant-core",
      // declared-path-literal: test input — a fixed path the test passes in, not one read from a declaration
      module: "schemas/catalogue.ts",
      exportName: "CatalogueSchema",
    });
    const here = HARNESS_ROOT;
    expect(rootOf("folio-assistant-core", here)).toBe(resolve(here, "..", "folio-assistant-core"));
    expect(rootOf("no-such-instance", here)).toBeUndefined();
    expect(rootOf(undefined, here)).toBe(here);
  });

  test("the running layer's own name resolves where no sibling search reaches it (bean w1gy)", async () => {
    const { rootOf } = await import("./kg/kind-validator.ts");
    const toolsRoot = resolve(import.meta.dir, "..");
    // A layer that is its own checkout: `siblingScopeFor` searches no
    // siblings for it (ruling 68k7), which is the harness standing alone.
    const alone = mkdtempSync(join(tmpdir(), "alone-"));
    try {
      mkdirSync(join(alone, ".git"));
      writeFileSync(
        join(alone, "alone.json"),
        JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "alone", directories: [] }),
      );
      expect(rootOf("cat-harness-tools", alone)).toBe(toolsRoot);
      expect(rootOf("litlfred/cat-harness-tools", alone)).toBe(toolsRoot);
      expect(rootOf("alone", alone)).toBe(alone);
      expect(rootOf("folio-assistant-core", alone)).toBeUndefined();
    } finally {
      rmSync(alone, { recursive: true, force: true });
    }
  });

  test("the harness's slice validators, which name this layer, resolve (bean w1gy)", async () => {
    for (const validator of [
      "cat-harness-tools:scripts/gen-slice-sqlite.ts#SliceIndexKind",
      "cat-harness-tools:scripts/gen-slice-sqlite.ts#SliceManifestKind",
    ]) {
      const r = await resolveKindValidator("test-kind", INSTANCE, registryWith({ validator }));
      expect(r.state).toBe("resolved");
    }
  });

  test("an escaping path is still refused — the name is the only way out", async () => {
    const { parseValidatorRef } = await import("./kg/kind-validator.ts");
    expect(() => parseValidatorRef("../folio-assistant-core/schemas/catalogue.ts#CatalogueSchema")).toThrow();
  });

  test("top-level `_` annotations are dropped before a node is checked", async () => {
    const { stripAnnotations } = await import("./kg/kind-validator.ts");
    expect(stripAnnotations({ _comment: "x", a: 1, b: { _keep: 2 } })).toEqual({ a: 1, b: { _keep: 2 } });
    expect(stripAnnotations([1])).toEqual([1]);
  });
});
