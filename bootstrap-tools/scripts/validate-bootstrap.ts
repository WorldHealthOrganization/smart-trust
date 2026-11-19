#!/usr/bin/env bun
/**
 * Parse bootstrap's JSON documents against the Zod they are described by.
 *
 * @module bootstrap-tools/scripts/validate-bootstrap
 * @covers schemas, models — bootstrap's declared documents, read through the Zod their published JSON Schemas are generated from
 *
 * ## Why this is not the same gate as `schemas:check`
 *
 * That gate asks whether the published JSON Schemas still match the Zod they
 * are generated from — it judges the SCHEMAS. Nothing judged the DOCUMENTS
 * those schemas describe: `bootstrap/models/models.json` could drift out of
 * `ModelRegistrySchema` and every gate would stay green, because the one reader
 * that parses it (`parseModelRegistry`) runs only when a model is chosen. So
 * this parses each document bootstrap actually carries, after the generator.
 *
 * ## Which documents, and the three states
 *
 * - `models/models.json` — `ModelRegistrySchema`. REQUIRED: bootstrap
 *   declares a `models` graph, so an absent registry is a finding.
 * - `bootstrap.json` — the layer's own declaration, against
 *   `KnowledgeGraphDeclarationSchema`, the shape `graph.schema.json` publishes.
 *   REQUIRED: a layer without a declaration is not a layer.
 * - every `.json` under bootstrap whose top-level `$schema` names one of the
 *   two discussion `$id`s — `DiscussionInputSchema` / `DiscussionOutputSchema`.
 *   Discovered by what the file SAYS it is, never by filename. Zero is a
 *   determined answer (no producer exists yet), and is reported as a count
 *   rather than as a pass over nothing. The `$schema` key is removed before
 *   parsing, because both forms of the schema are strict and would reject the
 *   very key the file was found by — a tension to settle once something
 *   produces these documents.
 *
 * ## What it does NOT validate, and why
 *
 * Nothing it can reach. The GRAPH document, `bootstrap.jsonld`, is never
 * committed (the site build writes it), so it is BUILT in memory
 * (`export-graph.ts`, shape `GraphExportSchema`) and parsed like the rest.
 *
 * A document that cannot be read or parsed as JSON is a FAILURE, not a skip,
 * and a run that found no document at all exits non-zero — a validator over
 * nothing reports clean over exactly what it exists to guard.
 *
 * Usage:
 *   bun run validate                    # validate the bootstrap beside these tools
 *   bun run validate -- --root <dir>    # ...or the bootstrap checkout at <dir>
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import type { z } from "zod";

import { readKnowledgeGraphDeclaration, supportsContent } from "../schemas/declaration.ts";
import { DiscussionInputSchema, DiscussionOutputSchema } from "../schemas/discussion.ts";
import { KnowledgeGraphDeclarationSchema } from "../schemas/graph.ts";
import { GraphExportSchema } from "../schemas/graph-export.ts";
import { MODEL_REGISTRY_DIR, MODEL_REGISTRY_FILENAME, ModelRegistrySchema } from "../schemas/model-registry.ts";
import { exportGraph } from "./export-graph.ts";

const REPO = join(import.meta.dir, "..", "..");

/** The published file each discussion schema is written to, and the Zod it is generated from. */
const DISCUSSION_FILES: ReadonlyArray<readonly [string, z.ZodType]> = [
  ["discussion.input.schema.json", DiscussionInputSchema],
  ["discussion.output.schema.json", DiscussionOutputSchema],
];

/**
 * The two discussion `$id`s, READ from the published schemas rather than typed
 * here. They are minted from bootstrap's declared iriBase and version (the
 * generator's `releaseIri`), so a literal would go stale on the next release
 * and this run would then find no discussion document at all — reporting a
 * clean zero over exactly the files it exists to judge. A published schema
 * that is missing or carries no `$id` throws: not runnable is a failure.
 */
export function discussionIds(root: string): Readonly<Record<string, z.ZodType>> {
  const out: Record<string, z.ZodType> = {};
  for (const [file, schema] of DISCUSSION_FILES) {
    // declared-path-literal: the published schemas' directory, the same tail the generator writes into.
    const path = join(root, "schemas", file);
    const id = (JSON.parse(readFileSync(path, "utf8")) as { $id?: unknown }).$id;
    if (typeof id !== "string") throw new Error(`${relative(REPO, path)} carries no \`$id\``);
    out[id] = schema;
  }
  return out;
}

export interface Target {
  /** What the document is, for the report. */
  label: string;
  /**
   * Parse the document WITHOUT its top-level `$schema`. Set for discussion
   * documents only: `$schema` is how such a file says what it is, and both the
   * Zod and the published JSON Schema are strict (bean `z634`), so each would
   * reject the self-declaration it was found by. No producer exists yet, so
   * this is recorded rather than settled — see the module doc.
   */
  stripSelfDeclaration?: boolean;
  /** Absolute path. */
  path: string;
  /** A document that is built rather than committed: its content, instead of reading `path`. */
  build?: () => unknown;
  schema: z.ZodType;
  /** An absent required document is a failure; an absent optional one is not looked at. */
  required: boolean;
}

export interface Result {
  target: Target;
  verdict: "valid" | "invalid" | "absent" | "unreadable";
  issues: string[];
}

/** Parse one document. Never throws: an unreadable file is a verdict, not a crash. */
export function validateFile(target: Target): Result {
  if (target.build) {
    let built: unknown;
    try {
      built = target.build();
    } catch (err) {
      return { target, verdict: "unreadable", issues: [err instanceof Error ? err.message : String(err)] };
    }
    const parsed = target.schema.safeParse(built);
    return parsed.success
      ? { target, verdict: "valid", issues: [] }
      : { target, verdict: "invalid", issues: parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`) };
  }
  if (!existsSync(target.path)) {
    return {
      target,
      verdict: "absent",
      issues: target.required ? ["required document is missing"] : [],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(target.path, "utf8"));
  } catch (err) {
    return { target, verdict: "unreadable", issues: [err instanceof Error ? err.message : String(err)] };
  }
  if (target.stripSelfDeclaration && raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const { $schema: _declared, ...rest } = raw as Record<string, unknown>;
    raw = rest;
  }
  const parsed = target.schema.safeParse(raw);
  if (parsed.success) return { target, verdict: "valid", issues: [] };
  return {
    target,
    verdict: "invalid",
    issues: parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`),
  };
}

/** A result that fails the run. */
export function isFailure(r: Result): boolean {
  return r.verdict === "invalid" || r.verdict === "unreadable" || (r.verdict === "absent" && r.target.required);
}

function jsonFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    // Checkout machinery and committed audit output are not bootstrap's documents.
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonFilesUnder(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** The files under `root` that declare themselves a discussion document by `$schema`. */
export function discussionDocuments(root: string, ids = discussionIds(root)): Target[] {
  const out: Target[] = [];
  for (const p of jsonFilesUnder(root)) {
    let top: unknown;
    try {
      top = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      // Not ours to judge here: a file that does not parse has declared
      // nothing, so it cannot have declared itself a discussion document.
      continue;
    }
    const id = (top as { $schema?: unknown } | null)?.$schema;
    if (typeof id === "string" && id in ids) {
      out.push({
        label: "discussion document",
        path: p,
        schema: ids[id]!,
        required: true,
        stripSelfDeclaration: true,
      });
    }
  }
  return out;
}

/** Everything this run looks at, for the bootstrap layer rooted at `root`. */
export function planTargets(root: string): Target[] {
  const name = readKnowledgeGraphDeclaration(root)?.name ?? "bootstrap";
  return [
    {
      label: "instance declaration",
      path: join(root, `${name}.json`),
      schema: KnowledgeGraphDeclarationSchema,
      required: true,
    },
    {
      label: "model registry",
      path: join(root, MODEL_REGISTRY_DIR, MODEL_REGISTRY_FILENAME),
      schema: ModelRegistrySchema,
      required: true,
    },
    {
      // Built, not read: the site build writes it and nothing commits it. The
      // `@id` is a stand-in; the shape does not depend on the address.
      label: "Knowledge Graph (built)",
      path: join(root, `${name}.jsonld`),
      schema: GraphExportSchema,
      required: true,
      build: () => exportGraph(root, { docIri: `https://example.invalid/${name}/${name}.jsonld` }),
    },
    ...discussionDocuments(root),
  ];
}

/**
 * Where `bootstrap` is — the generator's rule (`gen-bootstrap-schemas.ts`), so
 * the two cannot disagree: `--root <dir>` names the checkout, beside
 * bootstrap-tools by default, and it must declare itself `bootstrap` at a
 * major these tools list under `supports`. No sibling scan.
 */
export function bootstrapRoot(dir: string = join(REPO, "bootstrap")): string {
  const decl = readKnowledgeGraphDeclaration(dir);
  if (decl?.name !== "bootstrap") {
    throw new Error(`${dir} holds no declaration naming itself \`bootstrap\` — there is nothing to validate, and that is not a pass`);
  }
  const tools = readKnowledgeGraphDeclaration(join(import.meta.dir, ".."));
  if (!tools || !supportsContent(tools, "bootstrap", decl.version)) {
    throw new Error(
      `bootstrap ${decl.version ?? "(no version)"} is not a major these tools support (bootstrap-tools.json \`supports.bootstrap\`)`,
    );
  }
  return dir;
}

export function run(root: string): Result[] {
  return planTargets(root).map(validateFile);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const ri = args.indexOf("--root");
  const rootArg = ri !== -1 ? args[ri + 1] : undefined;
  if (ri !== -1 && !rootArg) {
    console.error("--root needs a path");
    process.exit(2);
  }

  let results: Result[];
  try {
    results = run(bootstrapRoot(rootArg));
  } catch (err) {
    // A check that cannot run is a failure.
    console.error(`  ✗ could not run: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const looked = results.filter((r) => r.verdict !== "absent" || r.target.required);
  console.log(`Bootstrap documents, parsed against their Zod — ${looked.length} document(s)`);
  for (const r of results) {
    const where = relative(REPO, r.target.path);
    if (r.verdict === "valid") console.log(`  ✓ ${where} — ${r.target.label}`);
    else if (r.verdict === "absent" && !r.target.required) console.log(`  · ${where} — ${r.target.label}: not built, not looked at`);
    else {
      console.error(`  ✗ ${where} — ${r.target.label}: ${r.verdict}`);
      for (const i of r.issues.slice(0, 20)) console.error(`      ${i}`);
    }
  }
  const discussions = results.filter((r) => r.target.label === "discussion document").length;
  console.log(`  ${discussions} discussion document(s) found by \`$schema\``);

  const failed = results.filter(isFailure);
  if (looked.length === 0) {
    console.error("\n✗ no document was validated — that is not the same as every document being valid");
    process.exit(1);
  }
  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} bootstrap document(s) do not parse against their schema`);
    process.exit(1);
  }
  console.log("\nbootstrap documents are valid");
}
