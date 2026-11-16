/**
 * A model's own word is not evidence, and a broken registry is not an empty one.
 *
 * @module scripts/tests/model-languages.test
 *
 * Bean `46uh`. The registry ships EMPTY on purpose — an agent is not a valid
 * source for the evidence `validation` asks for — so a suite that only ran
 * against the real file would assert nothing (`6tkl`). The mechanism is
 * proven on fixtures; the real registry is used for the two properties it can
 * still answer.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  MODEL_REGISTRY_DIR,
  MODEL_REGISTRY_FILENAME,
  parseModelRegistry,
  validatedLanguages,
  type ModelEntry,
} from "@litlfred/bootstrap-tools/schemas/model-registry.ts";
import { checkModelLanguages, registryPath } from "../check-model-languages.ts";

const BOOTSTRAP = resolve(import.meta.dir, "..", "..", "..", "bootstrap");

const entry = (over: Partial<ModelEntry> = {}): ModelEntry => ({
  id: "test-model",
  title: "Test Model",
  preferredLanguages: ["fr"],
  validation: "human-validated",
  validatedBy: "someone",
  validatedOn: "2026-09-22",
  ...over,
});

/** A throwaway layer carrying one registry. */
function fixture(body: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "models-"));
  mkdirSync(join(dir, MODEL_REGISTRY_DIR), { recursive: true });
  writeFileSync(join(dir, MODEL_REGISTRY_DIR, MODEL_REGISTRY_FILENAME), JSON.stringify(body));
  return dir;
}

describe("validatedLanguages — only a human's check is acted on", () => {
  test("a human-validated list comes back", () => {
    expect(validatedLanguages(entry())).toEqual(["fr"]);
  });

  test("SELF-REPORTED comes back undefined, not as a weaker yes", () => {
    // The whole reason the owner asked for a validation state: a model's own
    // claim about which languages it handles well is a generated assertion
    // about a generated system. A helper that quietly accepted it would put
    // the distinction back where it was.
    expect(validatedLanguages(entry({ validation: "self-reported" }))).toBeUndefined();
  });

  test("unverified likewise", () => {
    expect(validatedLanguages(entry({ validation: "unverified" }))).toBeUndefined();
  });

  test("an EMPTY human-validated list is a determined empty, not an absence", () => {
    // Somebody looked and found no language this model is notably strong in.
    // Different from nobody having looked, which is `unverified`.
    expect(validatedLanguages(entry({ preferredLanguages: [] }))).toEqual([]);
  });
});

describe("parseModelRegistry — refuses rather than defaults", () => {
  test("a valid registry parses", () => {
    const r = parseModelRegistry({ $schema: "model-registry/1.0.0", models: [entry()] }, "x");
    expect(r.models).toHaveLength(1);
  });

  test("the tag is semver: a newer minor or patch of major 1 is read, major 2 is not", () => {
    // The old platform-named tag is read too, until the schema's next major.
    for (const tag of ["model-registry/1.4.2", "folio-model-registry/v1"]) {
      expect(parseModelRegistry({ $schema: tag, models: [entry()] }, "x").models).toHaveLength(1);
    }
    expect(() => parseModelRegistry({ $schema: "model-registry/2.0.0", models: [entry()] }, "x")).toThrow();
  });

  test("a human validation with no name and no date is REFUSED", () => {
    // One with nobody's name on it cannot be questioned; one with no date
    // cannot go stale. Both are required precisely because this is the only
    // state an agent may act on.
    expect(() =>
      parseModelRegistry(
        { $schema: "model-registry/1.0.0", models: [entry({ validatedBy: undefined, validatedOn: undefined })] },
        "x",
      ),
    ).toThrow(/validatedBy, validatedOn/);
  });

  test("a duplicate model id is refused", () => {
    expect(() =>
      parseModelRegistry({ $schema: "model-registry/1.0.0", models: [entry(), entry()] }, "x"),
    ).toThrow(/declared twice/);
  });

  test("a missing validation state is refused — there is no default", () => {
    const bad = { ...entry() } as Record<string, unknown>;
    delete bad.validation;
    expect(() => parseModelRegistry({ $schema: "model-registry/1.0.0", models: [bad] }, "x")).toThrow();
  });

  test("the wrong $schema is refused", () => {
    expect(() => parseModelRegistry({ $schema: "something-else", models: [] }, "x")).toThrow();
  });
});

describe("checkModelLanguages", () => {
  test("it sorts the three states apart", () => {
    const dir = fixture({
      $schema: "model-registry/1.0.0",
      models: [
        entry({ id: "a" }),
        entry({ id: "b", validation: "self-reported", validatedBy: undefined, validatedOn: undefined }),
        entry({ id: "c", validation: "unverified", validatedBy: undefined, validatedOn: undefined }),
      ],
    });
    try {
      const r = checkModelLanguages(dir);
      expect(r.models).toBe(3);
      expect(r.usable.map((m) => m.id)).toEqual(["a"]);
      expect(r.selfReported.map((m) => m.id)).toEqual(["b"]);
      expect(r.unverified.map((m) => m.id)).toEqual(["c"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a human-validated EMPTY list is reported, so it is not read as a gap", () => {
    const dir = fixture({ $schema: "model-registry/1.0.0", models: [entry({ preferredLanguages: [] })] });
    try {
      expect(checkModelLanguages(dir).problems).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a MALFORMED registry throws — it is not 'no models'", () => {
    // The distinction this check exists for. Reporting a broken file as empty
    // lets an agent fall through to `defaultLocale` believing a determination
    // was made, which is the default-masquerading-as-a-decision the bean ends.
    const dir = fixture({ models: [{ nope: true }] });
    try {
      expect(() => checkModelLanguages(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing registry throws rather than returning zero", () => {
    const dir = mkdtempSync(join(tmpdir(), "models-none-"));
    try {
      expect(() => checkModelLanguages(dir)).toThrow(/no model registry/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the real registry", () => {
  test("it exists, parses, and lives in BOOTSTRAP", () => {
    // Bootstrap because an agent reaching for its communication language has
    // not yet loaded the harness that would otherwise answer.
    expect(registryPath(BOOTSTRAP)).toContain("bootstrap");
    const r = checkModelLanguages(BOOTSTRAP);
    expect(r.models).toBeGreaterThanOrEqual(0);
  });

  test("every entry that IS declared carries a validation state", () => {
    // Vacuous today by design — the registry ships empty — so the assertion
    // that keeps it honest is the parse above, which refuses a missing state.
    for (const m of checkModelLanguages(BOOTSTRAP).usable) {
      expect(m.validatedBy).toBeTruthy();
      expect(m.validatedOn).toBeTruthy();
    }
  });
});
