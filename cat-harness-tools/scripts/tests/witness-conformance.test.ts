/**
 * The `computation-witness` kind's two schemas and the conformance report.
 *
 * Fixtures are the shapes measured over litlfred/qou's 3,839 witnesses on
 * 2026-10-04 (bean `qou-qb6t`): each divergence the envelope admits is here
 * once, so a narrowing that would reject real witnesses fails a test rather
 * than a downstream folio.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ComputationWitnessConformanceSchema as Contract,
  ComputationWitnessSchema as Envelope,
} from "../../schemas/computation-witness.ts";
import { BASE_GRAPH_TYPOLOGIES, contentLayerInstance, defaultGraphTypologies } from "../../schemas/kg/cat-harness.js";
import { checkWitnesses } from "../witness-conformance.ts";

const CONFORMING = {
  engine: "mpmath",
  engineVersion: "1.3.0",
  computedAt: "2026-10-04T00:00:00Z",
  scriptFile: "computations/x.py",
  scriptHash: "abc123",
  assertions: [{ name: "a", computed: "1.0", expected: 1, passed: true, tolerance: "1e-40" }],
  allPassed: true,
};

/** Divergences the corpus holds, each of which the envelope must accept. */
const CORPUS_SHAPES: Record<string, unknown> = {
  "no engine": { computedAt: "t", assertions: [] },
  "an engine outside the contract's list": { ...CONFORMING, engine: "sympy+mpmath" },
  "a structured engine": { ...CONFORMING, engine: { name: "rust", version: "1" } },
  "no assertions": { engine: "python", data: { x: 1 } },
  "assertions keyed by name": { ...CONFORMING, assertions: { a: { computed: 1, expected: 1 } } },
  "a bare string among assertions": { ...CONFORMING, assertions: ["held"] },
  "a boolean computed value": { ...CONFORMING, assertions: [{ name: "a", computed: true, expected: true }] },
  "a list computed value": { ...CONFORMING, assertions: [{ name: "a", computed: [1, 2], expected: [1, 2] }] },
  "auditOnly as a boolean": { ...CONFORMING, auditOnly: true },
  "a null optional field": { ...CONFORMING, scriptCommitSha: null },
  "a foreign $schema spelling": { ...CONFORMING, $schema: "https://litlfred.github.io/qou/schemas/witness/v1" },
};

describe("the envelope (the kind's validator)", () => {
  it("accepts a conforming witness", () => {
    expect(Envelope.safeParse(CONFORMING).success).toBe(true);
  });
  it.each(Object.entries(CORPUS_SHAPES))("accepts a witness with %s", (_what, w) => {
    expect(Envelope.safeParse(w).success).toBe(true);
  });
  // A present field of the wrong type is malformed: optional is not untyped.
  it("rejects a present field of the wrong type", () => {
    expect(Envelope.safeParse({ ...CONFORMING, scriptHash: 42 }).success).toBe(false);
    expect(Envelope.safeParse({ ...CONFORMING, allPassed: "yes" }).success).toBe(false);
    expect(Envelope.safeParse([CONFORMING]).success).toBe(false);
  });
});

describe("the producer contract", () => {
  it("accepts a conforming witness", () => {
    expect(Contract.safeParse(CONFORMING).success).toBe(true);
  });
  // The corpus shapes are exactly what the contract does NOT allow, except the
  // two that differ only in fields the contract leaves open.
  it.each(["no engine", "an engine outside the contract's list", "no assertions", "auditOnly as a boolean", "a boolean computed value"])("rejects a witness with %s", (what) => {
    expect(Contract.safeParse(CORPUS_SHAPES[what]).success).toBe(false);
  });
});

describe("the graph typology", () => {
  it("is registered as derived, with the envelope as its validator", () => {
    // Through the REGISTRY: since bean riit (step 1c) the validator is a
    // `validators/computation-witness.json` node the registry joins on, and
    // since folio-assistant#2598 the kind itself is a node in the content
    // layer's `typologies/` graph, not a code entry here. Without a content
    // layer composed the kind is absent, and that is the only way it may be.
    const k = defaultGraphTypologies.get("computation-witness");
    if (k === undefined) {
      expect(contentLayerInstance()).toBeUndefined();
      return;
    }
    expect(BASE_GRAPH_TYPOLOGIES["computation-witness"]).toBeUndefined();
    expect(k.layer).toBe("core");
    expect(k.holds).toBe("derived");
    expect(k.validator).toBe("schemas/computation-witness.ts#ComputationWitnessSchema");
    expect(k.nodeSchemas).toBeUndefined();
  });
});

describe("checkWitnesses", () => {
  it("counts each class, and only reads *.witness.json", () => {
    const root = mkdtempSync(join(tmpdir(), "witness-conformance-"));
    try {
      const dir = join(root, "computations");
      mkdirSync(join(dir, "sub"), { recursive: true });
      writeFileSync(join(dir, "ok.witness.json"), JSON.stringify(CONFORMING));
      writeFileSync(join(dir, "sub", "noengine.witness.json"), JSON.stringify(CORPUS_SHAPES["no engine"]));
      writeFileSync(join(dir, "bad.witness.json"), JSON.stringify({ ...CONFORMING, scriptHash: 42 }));
      writeFileSync(join(dir, "nan.witness.json"), '{"engine": "python", "x": NaN}');
      writeFileSync(join(dir, "other.json"), "not a witness, not even JSON");
      const r = checkWitnesses([dir], root);
      expect(r.witnesses).toBe(4);
      expect(r.notStrictJson).toEqual(["computations/nan.witness.json"]);
      expect(r.malformed.map((m) => m.file)).toEqual(["computations/bad.witness.json"]);
      expect(r.conforming).toBe(1);
      expect(r.findings).toEqual([
        { fields: "engine, engineVersion", count: 1, example: "computations/sub/noengine.witness.json" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
