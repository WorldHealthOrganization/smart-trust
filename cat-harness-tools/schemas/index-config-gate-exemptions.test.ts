/**
 * An index declares the gate exemptions of its OWN workflows
 * (`gateExemptions` in `index.config.json`), in the shape a layer
 * declaration uses, and every rewrite of the index keeps them.
 */
import { describe, expect, test } from "bun:test";

import { GateExemptionsSchema } from "./kg/cat-harness";
import { INDEX_CONFIG_SCHEMA, IndexConfigSchema, formatIndexConfig } from "./kg/index-config";

const base = { $schema: INDEX_CONFIG_SCHEMA, instances: [{ name: "a" }] };
const exemptions = { steps: [{ match: "bun run cat state:push -- --id health", kind: "ci-only", reason: "a write, not a check" }] };

describe("an index's own gate exemptions", () => {
  test("parse in the shape an instance declaration uses", () => {
    expect(IndexConfigSchema.safeParse({ ...base, gateExemptions: exemptions }).success).toBe(true);
    expect(GateExemptionsSchema.safeParse(exemptions).success).toBe(true);
  });

  test("are refused when malformed — no reason, an unknown kind, an unknown key", () => {
    for (const bad of [
      { steps: [{ match: "x", kind: "ci-only", reason: " " }] },
      { steps: [{ match: "x", kind: "slow", reason: "r" }] },
      { steps: [], extra: true },
    ]) expect(IndexConfigSchema.safeParse({ ...base, gateExemptions: bad }).success).toBe(false);
  });

  test("survive formatIndexConfig, last, and are absent when not declared", () => {
    const parsed = IndexConfigSchema.parse({ ...base, site: { landing: "a" }, gateExemptions: exemptions });
    const text = formatIndexConfig(parsed);
    const back = JSON.parse(text) as Record<string, unknown>;
    expect(back.gateExemptions).toEqual(exemptions);
    expect(Object.keys(back).at(-1)).toBe("gateExemptions");
    expect("gateExemptions" in (JSON.parse(formatIndexConfig(IndexConfigSchema.parse(base))) as object)).toBe(false);
  });
});

describe("a file a gate's allowlist admits (owner, 2026-10-16, item 6b)", () => {
  // declared-path-literal: test input — a fixed path the test passes in, not one read from a declaration
  const files = { files: [{ gate: "check:structure-accessor", file: "schemas/library-ref.ts", reason: "existence only" }] };

  test("parses, beside steps and scripts", () => {
    expect(GateExemptionsSchema.safeParse(files).success).toBe(true);
    expect(GateExemptionsSchema.safeParse({ ...exemptions, ...files }).success).toBe(true);
  });

  test("is refused with no reason, no gate, an unknown key, or a path outside the instance", () => {
    for (const bad of [
      { files: [{ gate: "check:x", file: "a.ts", reason: " " }] },
      { files: [{ gate: "", file: "a.ts", reason: "r" }] },
      { files: [{ gate: "check:x", file: "a.ts", reason: "r", extra: 1 }] },
      { files: [{ gate: "check:x", file: "/abs/a.ts", reason: "r" }] },
      { files: [{ gate: "check:x", file: "../up/a.ts", reason: "r" }] },
    ]) expect(GateExemptionsSchema.safeParse(bad).success).toBe(false);
  });
});
