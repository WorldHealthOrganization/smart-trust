/**
 * The `compiled` purpose: valid against its INPUTS, checked before use — bean `gpdo`.
 *
 * @module folio-assistant-core/schemas/materialization-compiled.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";

import { compiledValidity, freshness, MaterializationSchema } from "./materialization.ts";

const gate = (verdict: "permitted" | "refused" | "unknown") => ({ verdict, basis: "fixture" });
const gates = {
  size: gate("permitted"),
  restrictions: gate("permitted"),
  copyright: gate("permitted"),
  retention: gate("permitted"),
  sourceLoss: gate("unknown"),
};
const INPUTS = {
  toolchain: "leanprover/lean4:v4.24.0",
  sourceRevision: "a1b2c3d",
  inputDigest: "0".repeat(64),
};
const compiled = (over: Record<string, unknown> = {}) =>
  MaterializationSchema.safeParse({
    state: "materialized",
    provenance: { upstream: "https://github.com/leanprover-community/mathlib4" },
    localPath: ".lake/build",
    purpose: "compiled",
    gates,
    inputs: INPUTS,
    ...over,
  });

describe("the schema", () => {
  test("compiledWithInputsParses", () => {
    expect(compiled().success).toBe(true);
  });
  test("compiledWithoutInputsRefused", () => {
    const r = compiled({ inputs: undefined });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("requires `inputs`");
  });
  test("toolchainAndRevisionRequired", () => {
    expect(compiled({ inputs: { toolchain: "x" } }).success).toBe(false);
    expect(compiled({ inputs: { sourceRevision: "x" } }).success).toBe(false);
  });
  test("compiledCannotDischargeSourceLoss", () => {
    const r = compiled({ gates: { ...gates, sourceLoss: gate("permitted") } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("cannot discharge");
  });
  test("inputsOnNonCompiledRefused", () => {
    expect(compiled({ purpose: "working" }).success).toBe(false);
  });
});

describe("freshness", () => {
  test("compiledNoExpiryInputBound", () => {
    const r = compiled();
    expect(r.success).toBe(true);
    if (r.success) expect(freshness(r.data, new Date())).toBe("input-bound");
  });
  test("statedExpiryWins", () => {
    const r = compiled({ expiresAt: "2000-01-01T00:00:00Z" });
    if (r.success) expect(freshness(r.data, new Date())).toBe("expired");
  });
});

describe("compiledValidity: three answers, checked before use", () => {
  const m = compiled();
  if (!m.success) throw new Error("fixture must parse");
  const rec = m.data;

  test("validWhenInputsMatch", () => {
    expect(compiledValidity(rec, INPUTS)).toEqual({ verdict: "valid" });
  });
  test("staleNamesChangedInputs", () => {
    expect(compiledValidity(rec, { ...INPUTS, toolchain: "leanprover/lean4:v4.25.0", sourceRevision: "ffff" })).toEqual({
      verdict: "stale-inputs",
      differs: ["toolchain", "sourceRevision"],
    });
  });
  test("changedDigestAloneStale", () => {
    expect(compiledValidity(rec, { ...INPUTS, inputDigest: "1".repeat(64) })).toEqual({
      verdict: "stale-inputs",
      differs: ["inputDigest"],
    });
  });
  test("cannotTellWithoutNeededInput", () => {
    const v = compiledValidity(rec, { toolchain: INPUTS.toolchain, sourceRevision: INPUTS.sourceRevision });
    expect(v.verdict).toBe("cannot-tell");
  });
  test("noDigestJudgedOnToolchain", () => {
    const r = compiled({ inputs: { toolchain: INPUTS.toolchain, sourceRevision: INPUTS.sourceRevision } });
    if (!r.success) throw new Error("fixture must parse");
    expect(compiledValidity(r.data, { toolchain: INPUTS.toolchain, sourceRevision: INPUTS.sourceRevision })).toEqual({ verdict: "valid" });
  });
  test("cannotTellForNonCompiled", () => {
    const w = MaterializationSchema.parse({ state: "referenced", provenance: { upstream: "https://x" } });
    expect(compiledValidity(w, INPUTS).verdict).toBe("cannot-tell");
  });
});
