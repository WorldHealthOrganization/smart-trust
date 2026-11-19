/**
 * Model ids are typed, and the ones the registry does not declare are
 * reported, never auto-registered (#1168 B10c).
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { ModelEntrySchema, ModelIdSchema, NOT_DISCLOSED } from "@litlfred/bootstrap-tools/schemas/model-registry.js";
import { AttributionSchema } from "../../schemas/content/attribution.js";
import { checkModelLanguages, unregisteredModelIds } from "../check-model-languages.js";

const REPO = resolve(import.meta.dir, "..", "..", "..");

describe("ModelIdSchema", () => {
  test("accepts runtime ids and the declared not-disclosed", () => {
    for (const id of ["claude-opus-5", "claude-haiku-4-5-20251001", "us.anthropic.claude-sonnet-5", NOT_DISCLOSED]) {
      expect(ModelIdSchema.safeParse(id).success).toBe(true);
    }
  });

  test("refuses a display name or an empty id", () => {
    for (const id of ["Claude Opus 5", "", " claude-opus-5"]) expect(ModelIdSchema.safeParse(id).success).toBe(false);
  });

  test("an agent attribution's model is checked", () => {
    expect(AttributionSchema.safeParse({ kind: "agent", id: "a", model: "Claude Opus" }).success).toBe(false);
    expect(AttributionSchema.safeParse({ kind: "agent", id: "a", model: "claude-opus-5" }).success).toBe(true);
  });
});

describe("unregistered model ids are reported, advisory", () => {
  const all = unregisteredModelIds(REPO, new Set());

  test("the corpus records model ids, so the report is not vacuous", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  test("not-disclosed is never reported, and a registered id drops out", () => {
    expect(all.map((u) => u.id)).not.toContain(NOT_DISCLOSED);
    const first = all[0]!.id;
    expect(unregisteredModelIds(REPO, new Set([first])).map((u) => u.id)).not.toContain(first);
  });

  test("every recorded id has the model-id shape", () => {
    expect(all.filter((u) => !ModelIdSchema.safeParse(u.id).success)).toEqual([]);
  });
});

describe("an identity-only entry lets an id resolve without a language claim", () => {
  test("unverified may omit preferredLanguages; a language claim may not", () => {
    expect(ModelEntrySchema.safeParse({ id: "m", title: "m", validation: "unverified" }).success).toBe(true);
    expect(ModelEntrySchema.safeParse({ id: "m", title: "m", validation: "self-reported" }).success).toBe(false);
    expect(ModelEntrySchema.safeParse({ id: "m", title: "m", validation: "human-validated" }).success).toBe(false);
  });

  test("every model id the corpus records resolves to a registry entry", () => {
    const r = checkModelLanguages();
    const known = new Set([...r.usable, ...r.selfReported, ...r.unverified].map((m) => m.id));
    expect(unregisteredModelIds(REPO, known)).toEqual([]);
  });

  test("no identity-only entry is read as language evidence", () => {
    expect(checkModelLanguages().usable).toEqual([]);
  });
});
