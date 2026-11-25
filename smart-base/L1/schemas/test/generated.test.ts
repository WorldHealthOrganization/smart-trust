/**
 * The layers are consistent and every committed generated file is current.
 *
 * `src/l1.ts` is the source of truth for L1. It was migrated from WHO smart-kg,
 * and this file used to hold the generated `l1.json` equal to smart-kg's and
 * the IRI functions to `tools/kgid.mjs`; smart-kg is deprecated (owner,
 * 2026-10-16), so neither is checked against it any more.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { REPO, artefacts, orphans } from "../emit.ts";
import { L1, MIGRATED_FROM } from "../l1.ts";
import { L1_LIBRARY } from "../l1-library.ts";
import { OntologyLayerSchema, toOntologyJson } from "../ontology.ts";

test("migrationRecordsSourceCommit", () => {
  assert.match(MIGRATED_FROM.commit, /^[0-9a-f]{40}$/);
});

test("bothLayersInternallyConsistent", () => {
  OntologyLayerSchema.parse(toOntologyJson(L1));
  assert.equal(toOntologyJson(L1_LIBRARY).imports?.[0], "l1");
});

/**
 * The generated FSH is the IG's, at the repository root (`input/fsh/`). An
 * index mounts this package (declared `smart-base-kg`) but not the IG, so there
 * the FSH half is n/a; the package's own `generated/` is checked everywhere.
 */
const IG_FSH = existsSync(join(REPO, "input", "fsh"));
const stale = (paths: (p: string) => boolean) =>
  artefacts()
    .filter((a) => paths(a.path))
    .filter((a) => {
      const abs = join(REPO, a.path);
      return !existsSync(abs) || readFileSync(abs, "utf8") !== a.text;
    })
    .map((a) => a.path);

test("packageGeneratedFilesCurrent", () => {
  assert.deepEqual(stale((p) => !p.startsWith("input/")), [], "run `npm run build` in smart-base/L1/schemas/");
});

test(
  "generatedFshCurrentNoneOrphaned",
  { skip: IG_FSH ? false : "no input/fsh/ here (an index mounts the package, not the IG): NOT checked (n/a, not a pass)" },
  () => {
    assert.deepEqual(stale((p) => p.startsWith("input/")), [], "run `npm run build` in smart-base/L1/schemas/");
    assert.deepEqual(orphans(new Set(artefacts().map((a) => a.path))), []);
  },
);

test("publicationAndTerminologyCodeReuseParents", () => {
  // The emitted text, not the committed copy: the test above holds the two equal.
  const fsh = artefacts().find((a) => a.path === "input/fsh/models/KGL1.fsh")!.text;
  assert.match(fsh, /Logical: KGPublication\nParent: DublinCore\n/);
  assert.match(fsh, /Logical: KGTerminologyCode\nParent: Coding\n/);
  const pub = fsh.split(/\n(?=Logical: )/).find((b) => b.startsWith("Logical: KGPublication\n"))!;
  assert.doesNotMatch(pub, /^\* title /m, "an inherited element is not restated");
  assert.match(pub, /^\* identifiers 0\.\.\* BackboneElement /m);
});

test("specialisationEmittedAsLinkedData", () => {
  const ld = JSON.parse(readFileSync(join(REPO, "smart-base/L1/schemas/generated/l1-library.jsonld"), "utf8"));
  const sub = Object.fromEntries(ld["@graph"].map((n: { "@id": string; subClassOf: unknown }) => [n["@id"], n.subClassOf]));
  assert.equal(sub["http://smart.who.int/kg/publication"], "https://litlfred.github.io/cat-harness/v0/ns/SourceDocument");
  assert.equal(sub["http://smart.who.int/kg/publication-section"], "http://purl.org/spar/doco/Section");
});
