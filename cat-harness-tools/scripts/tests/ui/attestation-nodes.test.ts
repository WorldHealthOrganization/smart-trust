/**
 * Attestations are a node kind (owner, 2026-11-13, node-kind audit): each
 * `qa-attestations/v1` file has an IRI and a `.jsonld` (kg-export), a row on
 * its layer's attestations page, and a page of its own (gen-node-kind-pages).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attestationId, describeAttestation } from "../../lib/attestation-nodes.ts";
import { SUBJECT_KINDS } from "../../lib/subject-iri.ts";
import { LISTED_KINDS, registryRowsOf, registryTable, withSubjectIris } from "../../state-visualizer.ts";
import { QaAttestationsKind } from "../../../schemas/sdlc/qa-attestations.ts";
import { hasNodes, kindAccepts } from "../../../schemas/kg/node-kind-nodes.ts";
import { defaultGraphTypologies } from "../../../schemas/kg/cat-harness.ts";

const store = mkdtempSync(join(tmpdir(), "attest-"));
mkdirSync(join(store, "kg-qa", "skills"), { recursive: true });
writeFileSync(
  join(store, "kg-qa", "skills", "foo.attestations.json"),
  JSON.stringify({ $schema: "qa-attestations/v1", family: "kg-qa", subject: { kind: "skill", id: "foo", path: "skills/foo.md" }, pair_attestations: [] }),
);
writeFileSync(join(store, "kg-qa", "README.md"), "not a node");

describe("the attestation node kind", () => {
  test("the kind validates the envelope and keeps a family's own arrays out of its fields", () => {
    expect(QaAttestationsKind.id).toBe("qa-attestations");
    const ok = QaAttestationsKind.schema.safeParse({ family: "kg-qa", subject: { kind: "skill", id: "foo", path: null }, pair_attestations: [] });
    expect(ok.success).toBe(true);
    expect(QaAttestationsKind.schema.safeParse({ family: "nope", subject: { kind: "skill", id: "foo", path: null } }).success).toBe(false);
  });

  test("the attestations typology names the family, so the kind leaves the unkinded baseline", () => {
    expect(Object.keys(defaultGraphTypologies.get("attestations")?.nodeSchemas ?? {})).toEqual(["qa-attestations/v1"]);
  });

  test("an unversioned kind finds its nodes by the family it holds; a versioned one by its tag", () => {
    const k = { id: "qa-attestations", holdings: [{ typology: "attestations", family: "qa-attestations/v1" }] };
    expect(hasNodes(k)).toBe(true);
    expect(kindAccepts(k, "qa-attestations/v1")).toBe(true);
    expect(kindAccepts(k, "qa-attestations/v2")).toBe(false);
    expect(hasNodes({ holdings: [{ typology: "beans" }] })).toBe(false);
    expect(kindAccepts({ id: "todo", version: "1.2.0", holdings: [] }, "todo/1.1.0")).toBe(true);
  });

  test("its IRI kind is a subject kind kg-export may mint", () => {
    expect(SUBJECT_KINDS).toContain("attestation");
  });
});

describe("an attestation's id and words", () => {
  test("the id is its path in the store without the suffix", () => {
    expect(attestationId(store, join(store, "kg-qa", "skills", "foo.attestations.json"))).toBe("kg-qa/skills/foo");
    expect(attestationId(store, join(store, "kg-qa", "README.md"))).toBeUndefined();
    expect(attestationId(store, join(tmpdir(), "x.attestations.json"))).toBeUndefined();
  });
  test("its title names the family and the subject", () => {
    expect(describeAttestation("kg-qa", { kind: "skill", id: "foo", path: null }).title).toBe("kg-qa attestation: skill foo");
  });
});

describe("the attestations page lists each attestation", () => {
  test("attestations is a listed kind", () => {
    expect(LISTED_KINDS).toContain("attestations");
  });

  test("each file is a row: its id, its words, a link to its page, its IRI and its .jsonld", () => {
    const rows = registryRowsOf(store);
    expect(rows.map((r) => [r.id, r.text, r.schema])).toEqual([["kg-qa/skills/foo", "kg-qa attestation: skill foo", "qa-attestations/v1"]]);
    const linked = withSubjectIris(rows, store, ["attestations"], (_f, kind, id) => `https://e.org/fa/cat-harness/${kind}/${id}`, {
      instance: "cat-harness",
      layerPath: "test/attestations",
    });
    expect(linked[0]!.iri).toBe("https://e.org/fa/cat-harness/attestation/kg-qa/skills/foo");
    expect(linked[0]!.page).toBe("../../../cat-harness-tools/qa-attestations/cat-harness/test/attestations/kg-qa/skills/foo.attestations/");
    const html = registryTable(linked);
    expect(html).toContain('<a href="../../../cat-harness-tools/qa-attestations/cat-harness/test/attestations/kg-qa/skills/foo.attestations/"><code>kg-qa/skills/foo</code></a>');
    expect(html).toContain('<a href="https://e.org/fa/cat-harness/attestation/kg-qa/skills/foo">IRI</a>');
    expect(html).toContain('href="https://e.org/fa/cat-harness/attestation/kg-qa/skills/foo.jsonld"');
  });
});
