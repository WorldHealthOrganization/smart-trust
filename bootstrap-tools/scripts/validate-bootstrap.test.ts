/**
 * `bootstrap:validate` — bootstrap's documents, parsed against their Zod.
 *
 * One valid and one invalid fixture per document kind the run looks at, built
 * in a throwaway tree so the verdict is about the validator, not about today's
 * corpus. The invalid half is the one that matters: a validator that passed
 * everything would pass the valid half too.
 *
 * @module bootstrap-tools/scripts/validate-bootstrap.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bootstrapRoot, discussionDocuments, discussionIds, isFailure, run, validateFile } from "./validate-bootstrap.ts";
import { GraphExportSchema } from "../schemas/graph-export.ts";

const REAL = bootstrapRoot();
const trees: string[] = [];
afterAll(() => {
  for (const t of trees) rmSync(t, { recursive: true, force: true });
});

/** A minimal bootstrap-shaped tree: a declaration and a model registry. */
function tree(models: unknown, extra: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "validate-bootstrap-"));
  trees.push(root);
  // The real declaration, so the fixture differs from bootstrap only where a test says.
  writeFileSync(join(root, "bootstrap.json"), readFileSync(join(REAL, "bootstrap.json")));
  // ...and the published discussion schemas, whose `$id`s say what a
  // discussion document is.
  mkdirSync(join(root, "schemas"));
  for (const f of ["discussion.input.schema.json", "discussion.output.schema.json"]) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL, "schemas", f)));
  }
  mkdirSync(join(root, "models"));
  writeFileSync(join(root, "models", "models.json"), JSON.stringify(models));
  for (const [p, v] of Object.entries(extra)) writeFileSync(join(root, p), typeof v === "string" ? v : JSON.stringify(v));
  return root;
}

const validModels = JSON.parse(readFileSync(join(REAL, "models", "models.json"), "utf8"));
// Read, not typed: the `$id` is minted from bootstrap's release.
const INPUT_ID = (JSON.parse(readFileSync(join(REAL, "schemas", "discussion.input.schema.json"), "utf8")) as { $id: string }).$id;

describe("the committed corpus", () => {
  test("committedCorpusParses", () => {
    const results = run(REAL);
    expect(results.filter((r) => r.verdict === "valid").length).toBeGreaterThanOrEqual(2); // not vacuous
    expect(results.filter(isFailure)).toEqual([]);
  });
});

describe("a valid and an invalid fixture", () => {
  test("validRegistryPasses", () => {
    const good = {
      ...validModels,
      models: [{ id: "m", title: "M", preferredLanguages: ["en"], validation: "unverified" }],
    };
    expect(run(tree(good)).filter(isFailure)).toEqual([]);
  });

  test("invalidRegistryNamesWhere", () => {
    const bad = {
      ...validModels,
      models: [{ id: "m", title: "M", preferredLanguages: ["en"], validation: 42 }],
    };
    const failed = run(tree(bad)).filter(isFailure);
    expect(failed.map((r) => r.target.label)).toEqual(["model registry"]);
    expect(failed[0]!.issues.join("\n")).toContain("validation");
  });

  test("unreadableJsonFails", () => {
    const root = tree(validModels);
    writeFileSync(join(root, "models", "models.json"), "{ not json");
    expect(run(root).filter(isFailure).map((r) => r.verdict)).toEqual(["unreadable"]);
  });

  test("missingDocumentFails", () => {
    const root = tree(validModels);
    rmSync(join(root, "models", "models.json"));
    expect(run(root).filter(isFailure).map((r) => r.verdict)).toEqual(["absent"]);
  });

  test("discussionFoundBySchema", () => {
    const good = { $schema: INPUT_ID, open: ["harness"], askedOf: { kind: "person" } };
    const bad = { $schema: INPUT_ID, open: "not-a-list" };
    const root = tree(validModels, { "good.json": good, "bad.json": bad });
    expect(discussionDocuments(root).length).toBe(2);
    const failed = run(root).filter(isFailure);
    expect(failed.map((r) => r.target.path.split("/").pop())).toEqual(["bad.json"]);
  });

  test("missingSchemaIdUnrunnable", () => {
    const root = tree(validModels);
    writeFileSync(join(root, "schemas", "discussion.input.schema.json"), "{}");
    expect(() => discussionIds(root)).toThrow();
  });

  test("builtGraphJudged", () => {
    const real = run(bootstrapRoot()).find((r) => r.target.label === "Knowledge Graph (built)");
    expect(real?.verdict).toBe("valid");
    const broken = validateFile({
      label: "Knowledge Graph (built)",
      path: "/nowhere/bootstrap.jsonld",
      schema: GraphExportSchema,
      required: true,
      build: () => {
        throw new Error("no declaration");
      },
    });
    expect(isFailure(broken)).toBe(true);
    const wrongShape = validateFile({ label: "g", path: "/x", schema: GraphExportSchema, required: true, build: () => ({}) });
    expect(wrongShape.verdict).toBe("invalid");
  });
});
