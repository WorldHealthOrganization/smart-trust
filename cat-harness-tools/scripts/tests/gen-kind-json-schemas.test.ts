/**
 * `kind:json-schemas` — one generated JSON Schema per harness kind, `$id` its
 * path (bean `8lcl`, box 1).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { z } from "zod";

import { readDeclaration, siblingScopeFor } from "../../schemas/kg/cat-harness.js";
import { discoveredEnum } from "../../schemas/kg/discovered-vocabulary.js";
import { BASE_GRAPH_TYPOLOGIES, defaultGraphTypologies, GraphTypologyRegistry } from "../../schemas/kg/graph-typology-registry.js";
import {
  body,
  declaredSchemasDir,
  harnessInstances,
  harnessKinds,
  harnessRegistry,
  KINDS_SUBDIR,
  judgeRendered,
  pointerToken,
  renderKind,
} from "../gen-kind-json-schemas.ts";
import { HARNESS_NAME, HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone } from "../../test/support/checkout.ts";

/**
 * Whether the harness's `needs` cannot be found here. `rootOf` finds a needed
 * layer in the composed checkout, and standing alone it does not search the
 * clone's siblings (bean `68k7`; the sibling root is w1gy F11). Only that
 * throw, and only standing alone, is "not applicable": any other error, or the
 * same one in a composed checkout, fails the tests below by name.
 */
const NEEDS_NOT_FOUND = ((): boolean => {
  try {
    harnessInstances();
    return false;
  } catch (e) {
    const msg = (e as Error).message;
    if (!msg.includes("is not mounted beside")) return false;
    return notApplicableAlone(`the harness's \`needs\`, found where the composed checkout mounts them (${msg})`);
  }
})();

describe("pointerToken", () => {
  test("escapes what a JSON Pointer and a URI fragment cannot carry", () => {
    expect(pointerToken("folio-voice/v1")).toBe("folio-voice~1v1");
    expect(pointerToken("a~b")).toBe("a~0b");
    expect(pointerToken("x#y z%")).toBe("x%23y%20z%25");
  });
});

describe("renderKind", () => {
  const dir = declaredSchemasDir();

  test.skipIf(NEEDS_NOT_FOUND)("the harness has kinds to render", () => {
    expect(harnessKinds().length).toBeGreaterThan(0);
  });

  test.skipIf(NEEDS_NOT_FOUND)("a kind with a validator gets a file whose $id ends in its path", async () => {
    const d = await renderKind("tools", dir);
    if (!("file" in d)) throw new Error(`tools rendered no file: ${d.none}`);
    const path = relative(HARNESS_ROOT, d.file).split("\\").join("/");
    expect(path).toBe(`${relative(HARNESS_ROOT, dir).split("\\").join("/")}/${KINDS_SUBDIR}/tools.schema.json`);
    expect(d.id.endsWith(`/${path}`)).toBe(true);
    expect(JSON.parse(d.text).$id).toBe(d.id);
  });

  test.skipIf(NEEDS_NOT_FOUND)("a kind with families is anyOf over them, each $ref resolving to a $defs entry", async () => {
    const d = await renderKind("skills", dir);
    if (!("file" in d)) throw new Error(`skills rendered no file: ${d.none}`);
    const doc = JSON.parse(d.text) as { anyOf: { $ref: string }[]; $defs: Record<string, unknown> };
    const keys = Object.keys(doc.$defs).map(pointerToken);
    for (const { $ref } of doc.anyOf) if ($ref.startsWith("#/$defs/")) expect(keys).toContain($ref.slice("#/$defs/".length));
    expect(doc.anyOf.length).toBeGreaterThan(0);
  });

  test.skipIf(NEEDS_NOT_FOUND)("a kind where no validator applies gets no file, and says why", async () => {
    const na = harnessKinds().find((k) => defaultGraphTypologies.get(k)?.validatorNotApplicable);
    if (!na) throw new Error("no kind declares validatorNotApplicable");
    const d = await renderKind(na, dir);
    expect("none" in d).toBe(true);
  });
});

// Bean `8lcl`, folio-assistant#2812: the output must not depend on what is
// mounted beside the harness. A synthetic higher layer contributes what the
// real ones did — a validator node answering a harness kind's family (core's,
// for `uploads`) and a block kind — and nothing it contributes may reach the
// documents.
describe("the output does not depend on the layers mounted above the harness", () => {
  const dir = declaredSchemasDir();
  // `describe` still runs this body; the tests that read it skip together.
  const instances = NEEDS_NOT_FOUND ? [] : harnessInstances();
  const scopes = [...new Set(instances.map((r) => siblingScopeFor(r)))];

  const above = realpathSync(mkdtempSync(join(tmpdir(), "kind-json-schemas-above-")));
  afterAll(() => rmSync(above, { recursive: true, force: true }));
  const higher = join(above, "higher-layer");
  mkdirSync(join(higher, "validators"), { recursive: true });
  mkdirSync(join(higher, "block-kinds"), { recursive: true });
  writeFileSync(
    join(higher, "higher-layer.json"),
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "higher-layer",
      needs: [HARNESS_NAME],
      directories: [
        { id: "higher-layer-validators", path: "validators/", graphTypologies: ["validators"] },
        { id: "higher-layer-block-kinds", path: "block-kinds/", graphTypologies: ["block-kinds"] },
      ],
    }),
  );
  // What core contributes for `uploads`, at a path that is the tools layer's.
  writeFileSync(
    join(higher, "validators", "extraction.json"),
    JSON.stringify({
      $schema: "folio-validator/v1",
      id: "extraction",
      validates: { kind: "uploads", family: "folio-extraction/v1" },
      schema: "cat-harness-tools:schemas/content/extraction.ts#ExtractionSchema",
    }),
  );

  test.skipIf(NEEDS_NOT_FOUND)("the instances read are the harness and what it needs, never a layer above", () => {
    const names = instances.map((r) => readDeclaration(r)?.name);
    expect(names[0]).toBe(HARNESS_NAME);
    for (const n of readDeclaration(HARNESS_ROOT)?.needs ?? []) expect(names).toContain(n);
    // The tools layer needs the harness, so it is above it.
    expect(names).not.toContain("cat-harness-tools");
    expect(instances.map((r) => basename(r))).not.toContain("higher-layer");
  });

  test.skipIf(NEEDS_NOT_FOUND)("the fixture bites: a registry that reads every instance takes its validator", () => {
    const allowed = new Set([...instances.map((r) => realpathSync(r)), higher]);
    const reading = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, [...scopes, above], {
      include: (root) => allowed.has(realpathSync(root)),
    });
    expect(reading.validatorNodeFor("uploads", "folio-extraction/v1")?.file).toBe(join(higher, "validators", "extraction.json"));
  });

  test.skipIf(NEEDS_NOT_FOUND)("with it mounted, every harness kind renders byte-for-byte as without it", async () => {
    const alone = harnessRegistry(instances, scopes);
    const beside = harnessRegistry(instances, [...scopes, above]);
    expect(beside.validatorNodeFor("uploads", "folio-extraction/v1")).toBeUndefined();
    const kinds = harnessKinds(alone);
    expect(harnessKinds(beside)).toEqual(kinds);
    expect(kinds).toContain("uploads");
    for (const k of kinds) expect(await renderKind(k, dir, beside)).toEqual(await renderKind(k, dir, alone));
  });

  test("a discovered enum is the open type, whatever its members", () => {
    const shape = (members: string[]) =>
      z.object({
        appliesTo: z.array(z.union([discoveredEnum(members as [string, ...string[]], "block-kinds"), z.enum(["docs"])])),
      });
    const none = JSON.stringify(body(shape([])));
    expect(JSON.stringify(body(shape(["theorem", "proof"])))).toBe(none);
    expect(JSON.stringify(body(shape(["table"])))).toBe(none);
    expect(none).not.toContain('"not"');
    expect(none).toContain('"type":"string"');
    // An enum that is not discovered keeps its members.
    expect(none).toContain('"docs"');
  });

  // `{ "not": {} }` is right for a field that must be absent (`z.never()`, as
  // `kg-qa/v1` writes for the judgements it moved out); it was wrong for
  // `appliesTo`, whose block kinds the harness alone declares none of.
  test.skipIf(NEEDS_NOT_FOUND)("a voice's `appliesTo` accepts a block kind the harness does not declare", async () => {
    for (const k of ["voices", "voice-vendors", "skills"]) {
      const d = await renderKind(k, dir);
      if (!("text" in d)) throw new Error(`${k} rendered no file: ${d.none}`);
      expect(d.text).toContain('"appliesTo"');
      expect(d.text).not.toContain('"not": {}');
    }
  });
});

// The judgement `--check` makes when the harness builds the kind schemas at
// publish and nothing committed is left to compare (owner card, 2026-11-05).
describe("judgeRendered: the generator's own output, with no committed copy", () => {
  const id = "https://example.org/schemas/kinds/x.schema.json";
  const good = JSON.stringify({ $id: id, anyOf: [{ $ref: "#/$defs/a~1b" }], $defs: { "a/b": { type: "string" } } });
  const again = (t: string) => new Map([["x", t]]);
  test("a document that parses, names its path, resolves its refs and renders the same twice passes", () => {
    expect(judgeRendered([{ kind: "x", id, text: good }], again(good))).toEqual([]);
  });
  test("each failure is named", () => {
    const badId = JSON.stringify({ $id: "elsewhere" });
    expect(judgeRendered([{ kind: "x", id, text: badId }], again(badId))[0]).toContain("is not its path");
    const dangling = JSON.stringify({ $id: id, $ref: "#/$defs/missing" });
    expect(judgeRendered([{ kind: "x", id, text: dangling }], again(dangling))[0]).toContain("resolves to nothing");
    expect(judgeRendered([{ kind: "x", id, text: good }], again(good + " "))[0]).toContain("not deterministic");
    expect(judgeRendered([{ kind: "x", id, text: "{" }], again("{"))[0]).toContain("does not parse");
  });
});
