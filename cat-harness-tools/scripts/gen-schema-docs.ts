#!/usr/bin/env bun
/**
 * gen-schema-docs.ts — Generate human-readable Markdown reference pages from the
 * JSON Schema files that define each skill's input/output contract (the
 * `skills/` directory under the layer's schemas root).
 *
 * Output:           docs/reference/skills/<skill>.md  (+ docs/reference/skills/index.md)
 *
 * The pages are committed and regenerated in CI before the docs site is
 * deployed; `--check` reports drift without writing. Run locally with:
 *
 *     bun run cat-harness-tools/scripts/gen-schema-docs.ts
 *
 * Dependency-free (no external JSON-Schema tooling): it needs only `bun`.
 *
 * @module scripts/gen-schema-docs
 * @covers schemas, docs
 */

import { markdownEditLink } from "../src/core/edit-links.js";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { orphanPages } from "./doc-orphans.ts";
import { join, relative, resolve } from "path";
import { readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { instanceDirectories, instanceDirectoryForGraph } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { layerContracts } from "./skill-contracts.ts";

/**
 * THIS LAYER'S OWN `schemas` directory, or the convention.
 *
 * declared-path-literal: the fallback is at the call site so the choice is
 * visible. `schemas/` declares TWO graphs — it is a knowledge-graph node AND
 * the schema definitions — which is why the `schemas` one is asked for by name
 * rather than being handed a single-home guess.
 *
 * `instanceDirectoryForGraph`, not `directoriesForGraph(...)[0]`, because every use
 * below composes a path INSIDE this directory. The question is "where is MY
 * schemas directory", not "who declares schemas" — and from the `cat-harness`
 * root those have different answers: measured 2026-09-20, `schemas` resolves
 * to FOUR homes (`cat-harness/`, the content core, `large-datasets/`,
 * `detangle/`), three of them arriving through the dependency overlay and
 * belonging to somebody else. `[0]` was right only because the resolver
 * happens to order the root's own declarations first; a reordering would have
 * sent this generator's output into another checkout, silently. Bean `a02m`.
 */
function schemasRoot(root: string): string {
  // The layer's OWN `schemas` directory, by id. The harness also declares
  // the `openapi` and `archimate` subgraphs' schema directories (both of graph
  // `schemas`), so asking for "the" schemas directory is ambiguous and throws;
  // the skill-instruction schemas this page documents live in the one whose id
  // is `schemas`.
  const own = instanceDirectories(root).find((d) => d.id === "schemas");
  if (own?.path) return join(root, own.path);
  return instanceDirectoryForGraph(root, "schemas") ?? join(root, "schemas");
}


const INSTANCE_ROOT = resolve(HARNESS_ROOT);

/**
 * The repository the links name: the one the layer's own declaration names
 * (`"repository"` in `cat-harness.json`), never the cwd's git remote.
 *
 * Bean `w1gy`, finding F12. This was `repoOf(detectRepoUrl(process.cwd()))`
 * with the prefix taken relative to `repoRootFor(INSTANCE_ROOT)`, so the
 * committed pages depended on where the generator ran: in the composed index
 * the links read `litlfred/folio-assistant/blob/main/cat-harness/schemas/…`
 * (a path that repository does not hold since the separation, so every one was
 * dead), and in a sibling clone `--check` failed and a write rewrote all of
 * them. The skills directory is inside the layer, and the layer's root
 * is its repository's root, so the declared repository plus an
 * instance-relative path names the same file from every layout.
 */
const SCHEMA_DOCS_REPO = declaredRepository(INSTANCE_ROOT);

function declaredRepository(root: string): string {
  const repo = readDeclaration(root)?.repository;
  if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`gen-schema-docs: ${root}'s declaration names no "repository" (owner/name); the edit links need it`);
  }
  return repo;
}
// Same pencil as gen-skill-docs.ts, and for the same reason: a text glyph
// rather than an inline SVG repeated once per generated page.
const EDIT_GLYPH = "\u270E";

const SKILLS_DIR = join(schemasRoot(INSTANCE_ROOT), "skills");

/* The repo-relative prefix for this directory — bean `oe98`, the half its close
 * did not cover.
 *
 * The four links below are `blob/main/<prefix>/…` and `edit/main/<prefix>/…`,
 * which are REPOSITORY-root paths. This file spelled them `schemas/skills/…`
 * while the directory is at `cat-harness/schemas/skills/…`, so all 88 links
 * across 22 pages were dead. Measured on `main` at `baee10593` AFTER `oe98`
 * was marked completed: 612 generated links, 88 non-resolving, every one of
 * them from this generator.
 *
 * `gen-skill-docs.ts` was repaired with a `repoRelative()` helper and is now
 * clean. That fix did not reach here, because `oe98`'s own measurement only
 * ever looked at the directory the OTHER generator writes — the same blind
 * spot, one generator over.
 *
 * DERIVED from `SKILLS_DIR` rather than written out, since a literal is
 * precisely what went stale: the two roots were the same directory until the
 * `wggr` stub inversion moved the layer into `cat-harness/`, so this read
 * correctly for as long as it did and broke with no edit to this file.
 *
 * Since the separation the links name the layer's DECLARED repository
 * (F12, above), whose root is the layer root — the index mounts
 * `litlfred/cat-harness` whole — so the repository-relative path is now the
 * instance-relative one, and reads the same from the index and a sibling clone. */
const SKILLS_REPO_PREFIX = relative(INSTANCE_ROOT, SKILLS_DIR).split("\\").join("/");
const OUT_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "reference", "skills");

/**
 * `--check`: verify the generated tree is current without writing to it.
 *
 * These pages are generated from skill sources and the repo forbids editing
 * them by hand, but nothing verified they had actually been regenerated after
 * a source change — so `document-intake.md` sat 35 lines behind its source
 * (the PDF-extraction ladder) and the published docs site served the stale
 * copy. A generated file with no drift guard is a file that silently rots.
 *
 * Collects every path whose content would change, so one run reports all of
 * them rather than the first.
 */
const CHECK_ONLY = process.argv.includes("--check");
const drifted: string[] = [];

function emit(path: string, content: string): void {
  if (CHECK_ONLY) {
    const current = existsSync(path) ? readFileSync(path, "utf-8") : null;
    if (current !== content) drifted.push(path);
    return;
  }
  writeFileSync(path, content);
}

/**
 * A committed schema page no contract produces: the contract moved to another
 * layer or was removed, and the page still says "generated from" it. Reported
 * and never deleted, for `gen-skill-docs.ts`' `reportOrphans` reason
 * (`deletion-requires-confirmation`).
 *
 * A hard failure, in writing mode too, since a re-run does not fix it. It
 * reported only while the 13 pages the placement moves left behind were still
 * committed; cat-harness#1349 removed them, so the count is zero and the
 * ratchet holds, as `gen-skill-docs.ts`'s does.
 */
function reportOrphans(produced: Iterable<string>): void {
  const orphans = orphanPages(readdirSync(OUT_DIR), produced);
  if (orphans.length === 0) return;
  console.error(
    `\n✗ ${orphans.length} schema page(s) in the output directory were produced by NO contract:\n`,
  );
  for (const f of orphans) console.error(`  ${join(OUT_DIR, f)}`);
  console.error(
    `\n  The contract moved to another layer or was removed. Check which; if it is gone\n` +
      `  from this instance, a person deletes the page (\`deletion-requires-confirmation\`).`,
  );
  process.exit(1);
}

function reportDrift(): void {
  if (!CHECK_ONLY) return;
  if (drifted.length === 0) {
    console.log("generated docs are up to date");
    process.exit(0);
  }
  console.error(
    `generated docs are STALE (${drifted.length} file(s)); re-run without --check:`,
  );
  for (const p of drifted) console.error(`  ${p}`);
  process.exit(1);
}


interface JsonSchema {
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
}

/** Render the human-readable type label for a schema node. */
function typeLabel(schema: JsonSchema): string {
  if (schema.enum) {
    return schema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(" \\| ");
  }
  if (schema.const !== undefined) return `\`${JSON.stringify(schema.const)}\` (const)`;
  if (schema.oneOf) return "one of (see below)";
  if (schema.anyOf) return "any of (see below)";
  if (schema.allOf) return "all of (see below)";

  const t = Array.isArray(schema.type) ? schema.type.join(" \\| ") : schema.type;
  if (t === "array") {
    const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (items) return `array<${typeLabel(items)}>`;
    return "array";
  }
  if (schema.format) return `${t ?? "string"} (${schema.format})`;
  return t ?? "any";
}

/** Render constraint annotations (min/max, pattern, default) as a compact note. */
function constraintNote(schema: JsonSchema): string {
  const parts: string[] = [];
  if (schema.default !== undefined) parts.push(`default: \`${JSON.stringify(schema.default)}\``);
  if (schema.minimum !== undefined) parts.push(`min: ${schema.minimum}`);
  if (schema.maximum !== undefined) parts.push(`max: ${schema.maximum}`);
  if (schema.minLength !== undefined) parts.push(`minLength: ${schema.minLength}`);
  if (schema.maxLength !== undefined) parts.push(`maxLength: ${schema.maxLength}`);
  if (schema.pattern) parts.push(`pattern: \`${schema.pattern}\``);
  return parts.join(", ");
}

/**
 * Render a schema's properties as a Markdown table. Recurses one level into
 * nested objects / array-of-object items, emitting sub-tables under headings.
 */
function renderProperties(schema: JsonSchema, headingLevel: number, pathPrefix = ""): string {
  const lines: string[] = [];
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};

  if (Object.keys(props).length === 0) {
    if (schema.type === "array") {
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      if (items && items.properties) {
        return renderProperties(items, headingLevel, pathPrefix);
      }
    }
    return "_No properties defined._\n";
  }

  lines.push("| Field | Type | Required | Description |");
  lines.push("|-------|------|----------|-------------|");

  const nested: Array<{ name: string; schema: JsonSchema }> = [];

  for (const [name, prop] of Object.entries(props)) {
    const req = required.has(name) ? "**yes**" : "no";
    let desc = prop.description ?? "";
    const note = constraintNote(prop);
    if (note) desc = desc ? `${desc} (${note})` : note;
    lines.push(`| \`${name}\` | ${typeLabel(prop)} | ${req} | ${desc} |`);

    // Queue nested object / array-of-object for a sub-table.
    if (prop.type === "object" && prop.properties) {
      nested.push({ name, schema: prop });
    } else if (prop.type === "array") {
      const items = Array.isArray(prop.items) ? prop.items[0] : prop.items;
      if (items && items.type === "object" && items.properties) {
        nested.push({ name: `${name}[]`, schema: items });
      }
    }
  }

  lines.push("");

  for (const { name, schema: ns } of nested) {
    const h = "#".repeat(Math.min(headingLevel, 6));
    const label = pathPrefix ? `${pathPrefix}.${name}` : name;
    lines.push(`${h} \`${label}\``);
    lines.push("");
    lines.push(renderProperties(ns, headingLevel + 1, label));
  }

  return lines.join("\n");
}

function readSchema(path: string): JsonSchema | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JsonSchema;
  } catch (e) {
    console.error(`  ! failed to parse ${path}: ${(e as Error).message}`);
    return null;
  }
}

function renderSkillPage(
  skill: string,
  input: JsonSchema | null,
  output: JsonSchema | null,
  src: { input?: string; output?: string } = {},
): string {
  const title = (input?.title || output?.title || skill).replace(/ (Input|Output)$/i, "");
  const lines: string[] = [];
  lines.push("---");
  lines.push("layout: default");
  // Says it is generated, for the same reason as `gen-skill-docs.ts`.
  lines.push("generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema");
  lines.push(`title: ${title}`);
  lines.push("parent: Skill schema reference");
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> Skill id: \`${skill}\``);
  lines.push("");
  // "do not edit by hand" only tells a reader where NOT to go. The schema
  // files are the real source and are editable; the per-section links below
  // now carry an editor target alongside the raw view.
  lines.push("_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._");
  lines.push("");

  if (input) {
    lines.push("## Input");
    lines.push("");
    if (input.description) lines.push(input.description + "\n");
    lines.push(renderProperties(input, 3));
    lines.push("");
    lines.push(
      markdownEditLink({ repo: SCHEMA_DOCS_REPO }, { source: src.input ?? `${SKILLS_REPO_PREFIX}/${skill}/input.schema.json`, kind: "source", text: "Raw schema" }) +
        ` · ${markdownEditLink({ repo: SCHEMA_DOCS_REPO }, { source: src.input ?? `${SKILLS_REPO_PREFIX}/${skill}/input.schema.json`, text: `${EDIT_GLYPH} Edit`, className: "fa-edit-source" })}`,
    );
    lines.push("");
  }

  if (output) {
    lines.push("## Output");
    lines.push("");
    if (output.description) lines.push(output.description + "\n");
    lines.push(renderProperties(output, 3));
    lines.push("");
    lines.push(
      markdownEditLink({ repo: SCHEMA_DOCS_REPO }, { source: src.output ?? `${SKILLS_REPO_PREFIX}/${skill}/output.schema.json`, kind: "source", text: "Raw schema" }) +
        ` · ${markdownEditLink({ repo: SCHEMA_DOCS_REPO }, { source: src.output ?? `${SKILLS_REPO_PREFIX}/${skill}/output.schema.json`, text: `${EDIT_GLYPH} Edit`, className: "fa-edit-source" })}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

function main(): void {
  // Every contract the layer publishes, wherever it sits — the root
  // `schemas/skills/` or a subgraph's (bean `cat-tools-st4q`) — keyed by the
  // skill it publishes under, plus any folder under the declared schemas
  // graph's `skills/` that holds none of those.
  const sources = new Map<string, { input?: string; output?: string }>();
  for (const c of layerContracts(INSTANCE_ROOT).contracts) {
    if (c.io !== "input" && c.io !== "output") continue;
    const e = sources.get(c.skill) ?? {};
    e[c.io] = c.source;
    sources.set(c.skill, e);
  }
  if (existsSync(SKILLS_DIR)) {
    for (const d of readdirSync(SKILLS_DIR)) {
      if (sources.has(d) || !statSync(join(SKILLS_DIR, d)).isDirectory()) continue;
      const rel = (io: string) => `${SKILLS_REPO_PREFIX}/${d}/${io}.schema.json`;
      sources.set(d, {
        ...(existsSync(join(SKILLS_DIR, d, "input.schema.json")) ? { input: rel("input") } : {}),
        ...(existsSync(join(SKILLS_DIR, d, "output.schema.json")) ? { output: rel("output") } : {}),
      });
    }
  }
  if (sources.size === 0) {
    console.error(`No skill contracts found under ${INSTANCE_ROOT}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const skills = [...sources.keys()].sort();

  const indexRows: string[] = [];
  const produced: string[] = [];

  for (const skill of skills) {
    const src = sources.get(skill)!;
    const input = src.input ? readSchema(join(INSTANCE_ROOT, src.input)) : null;
    const output = src.output ? readSchema(join(INSTANCE_ROOT, src.output)) : null;
    if (!input && !output) {
      console.warn(`  - ${skill}: no schemas, skipping`);
      continue;
    }
    const page = renderSkillPage(skill, input, output, src);
    emit(join(OUT_DIR, `${skill}.md`), page);
    produced.push(skill);
    const title = (input?.title || output?.title || skill).replace(/ (Input|Output)$/i, "");
    const desc = (input?.description || output?.description || "").replace(/[\\|]/g, "\\$&");
    indexRows.push(`| [${title}](${skill}.html) | \`${skill}\` | ${desc} |`);
    console.log(`  ✓ ${skill}.md`);
  }

  // Index page
  const index: string[] = [];
  index.push("---");
  index.push("layout: default");
  index.push("generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema");
  index.push("title: Skill schema reference");
  index.push("nav_order: 7");
  index.push("has_children: true");
  index.push("---");
  index.push("");
  index.push("# Skill schema reference");
  index.push("");
  index.push("Every folio-assistant skill declares a typed **input** and **output** contract as");
  index.push("JSON Schema (draft-07). These pages are generated from those schemas so the");
  index.push("published reference can never drift from what the framework actually validates.");
  index.push("");
  index.push("| Skill | Id | Description |");
  index.push("|-------|----|-------------|");
  index.push(...indexRows);
  index.push("");
  index.push("See also the [Skill instructions](../skill-instructions/) (the prose how-to");
  index.push("bodies the LLM loads) and the [TypeScript API reference](../../api/) for the");
  index.push("content-object model (`Block`, `Chapter`, `Paper`, builders, and Zod constraints).");
  index.push("");
  emit(join(OUT_DIR, "index.md"), index.join("\n"));
  console.log(`  ✓ index.md (${indexRows.length} skills)`);
  reportOrphans(produced);
  reportDrift();
  console.log(`\nWrote schema docs to ${OUT_DIR}`);
}

main();
