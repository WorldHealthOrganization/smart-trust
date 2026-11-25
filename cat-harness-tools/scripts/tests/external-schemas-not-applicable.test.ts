/**
 * `external-schemas:check` in a CONTENT root (cat-harness-tools#1701): a
 * mounted layer's record whose terms are derived from the whole checkout
 * (COMPOSED_DERIVERS) is excused there, with a reason; the root's own
 * registry and every harness root are judged as before.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COMPOSED_DERIVERS, composedTermsNotOursReason } from "../external-schemas.ts";

const roots: string[] = [];
function tree(gatesWorkflow: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "ext-schemas-na-"));
  roots.push(root);
  if (gatesWorkflow) {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "code-quality-gates.yml"), "jobs: {}\n");
  }
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("composed operative terms of a mounted layer's record", () => {
  test("only the whole-checkout derivers are composed; the harness's own BPMN deriver is not", () => {
    expect([...COMPOSED_DERIVERS].sort()).toEqual(["dcmi-terms", "w3c-skos"]);
  });

  test("content root + a mounted layer's registry: not applicable, with a reason", () => {
    const root = tree(false);
    expect(composedTermsNotOursReason(join(root, "cat-harness", "external-schemas"), root)).toContain("content root");
  });

  test("a registry at the content root itself is still judged", () => {
    const root = tree(false);
    expect(composedTermsNotOursReason(join(root, "external-schemas"), root)).toBeNull();
  });

  test("a harness root judges the mounted registry as before", () => {
    const root = tree(true);
    expect(composedTermsNotOursReason(join(root, "cat-harness", "external-schemas"), root)).toBeNull();
  });
});

// A FHIR IG judged with no base (2026-11-19): in layer mode the checks compose
// the platform index (a HARNESS root) and name the caller's own layer paths.
describe("a gate run that names its own layers (CAT_GATE_OWN_PATHS)", () => {
  const env = { CAT_GATE_OWN_PATHS: "the-caller", CAT_GATE_FOREIGN_PATHS: "cat-harness,cat-harness-tools" };

  test("a harness root, the registry in a layer that is not the caller's: not applicable", () => {
    const root = tree(true);
    expect(composedTermsNotOursReason(join(root, "cat-harness", "external-schemas"), root, env)).toContain("CAT_GATE_OWN_PATHS");
  });

  test("the registry in the caller's own layer: judged", () => {
    const root = tree(true);
    expect(composedTermsNotOursReason(join(root, "the-caller", "external-schemas"), root, env)).toBeNull();
  });

  test("no own paths named (a local run, the index's own gates): judged as before", () => {
    const root = tree(true);
    expect(composedTermsNotOursReason(join(root, "cat-harness", "external-schemas"), root, {})).toBeNull();
  });
});
