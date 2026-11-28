#!/usr/bin/env bun
/**
 * Generate cat-harness's JSON Schema, one document per graph typology (kind),
 * from the Zod in `cat-harness-tools/schemas/`.
 *
 * @module scripts/gen-kind-json-schemas
 * @covers schemas
 * @graphNode none — a generator over the harness's kind validators, not a schema itself
 *
 * The Zod lives here; `cat-harness/schemas/` keeps the GENERATED JSON Schema,
 * one per kind, `$id` under the harness's `iriBase`, as bootstrap-tools'
 * `gen-bootstrap-schemas.ts` does for bootstrap: a reader opens it with
 * nothing installed.
 *
 * ## Which kinds, and what each document holds
 *
 * The kinds are the harness's own: every kind of {@link BASE_GRAPH_TYPOLOGIES}
 * and every kind cat-harness declares in its `typologies/` graph. A kind a
 * higher layer declares is that layer's to publish. What a kind's nodes
 * are checked against is what `check:kind-validators` resolves, read through the
 * same functions, so the two cannot disagree about which Zod is the kind's:
 *
 * | the kind declares | the document is |
 * |---|---|
 * | a kind-level validator only | that schema |
 * | `$schema` families | `anyOf` over them: a Zod family is a `$defs` entry keyed by its tag; an external family whose tag is a URL is a `$ref` to it |
 *
 * A family typed only as a TypeScript shape is not runnable, so it constrains
 * nothing here and the document's `$comment` names it. A Zod schema in another
 * repository (bootstrap-tools' `models`) is published by that repository. A kind
 * with nothing runnable gets NO file, and this says why: a schema that accepts
 * everything would read as coverage.
 *
 * ## The same output whatever is mounted beside the harness
 *
 * - **Validator nodes.** A higher layer may answer a harness kind's family
 *   from its own `validators/` graph. The kinds are read from a PRIVATE
 *   registry ({@link harnessRegistry}) that loads the `typologies/` and
 *   `validators/` graphs of the harness and of what it `needs`, transitively,
 *   and of no other layer ({@link harnessInstances}).
 * - **Discovered enums.** `BLOCK_KINDS` is read at import from every mounted
 *   `block-kinds/` graph, an open vocabulary extended by the layers above, so
 *   a schema in a {@link DISCOVERED_VOCABULARIES} entry is written as the open
 *   type `{ "type": "string" }` ({@link body}).
 *
 * `scripts/tests/gen-kind-json-schemas.test.ts` mounts a synthetic higher
 * layer contributing both and asserts the output does not move.
 *
 * ## The `$id` is the file's path
 *
 * `<iriBase>v<major>/<path in cat-harness>`, minted by bootstrap-tools'
 * `releaseIri` from the declaration, never typed; bootstrap-tools'
 * `check:node-iris` enforces it over every Knowledge Graph with an `iriBase`.
 *
 * Usage:
 *   bun run cat kind:json-schemas          # write
 *   bun run cat kind:json-schemas:check    # fail if a kind lacks its file, a file is stale, or an `$id` is not its path
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { z } from "zod";

import { releaseIri, releaseIris } from "@litlfred/bootstrap-tools/schemas/release-iri.ts";

import { readDeclaration, siblingScopeFor } from "../schemas/kg/cat-harness.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { DISCOVERED_VOCABULARIES } from "../schemas/kg/discovered-vocabulary.js";
import {
  BASE_GRAPH_TYPOLOGIES,
  declaringInstanceOf,
  GraphTypologyRegistry,
  kindTitle,
} from "../schemas/kg/graph-typology-registry.js";
import {
  moduleRootOf,
  resolveKindValidator,
  resolveNodeSchemas,
  rootOf,
  type ValidatorRef,
} from "../schemas/kg/kind-validator.js";
import { HARNESS_NAME, HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

/** The declared directory entry the documents go under. */
export const SCHEMAS_ENTRY = "schemas";

/** The subdirectory of the harness's declared `schemas/` graph the documents live in. */
export const KINDS_SUBDIR = "kinds";

/** The JSON Schema dialect the converter emits, stated so a library change cannot move it. */
export const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const WRITER = "scripts/gen-kind-json-schemas.ts";

/** One kind's document, or why it has none. */
export type KindDocument =
  | { kind: string; file: string; id: string; text: string }
  | { kind: string; none: string };

/** JSON Pointer escaping (RFC 6901), then the URI-fragment characters a tag can hold. */
export function pointerToken(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1").replace(/%/g, "%25").replace(/#/g, "%23").replace(/ /g, "%20");
}

/**
 * The harness's own `schemas/` graph, by its declared entry id. By id rather
 * than by graph typology: four of the harness's directories hold the `schemas`
 * graph (`ns/`, and the openapi and archimate schemas), and this one is the
 * harness's schema directory.
 */
export function declaredSchemasDir(root: string = HARNESS_ROOT): string {
  const entry = readDeclaration(root)?.directories?.find((d) => d.id === SCHEMAS_ENTRY);
  if (!entry) throw new Error(`${root} declares no \`${SCHEMAS_ENTRY}\` directory — nowhere to put the generated schemas`);
  return join(root, entry.path);
}

function canonicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * The layer roots this generator may read: the harness and every layer
 * it `needs`, transitively — never a layer above it. A needed layer that is
 * not mounted THROWS: generating without it would write a different document,
 * which is the defect this list exists to end.
 */
export function harnessInstances(harnessRoot: string = HARNESS_ROOT): string[] {
  const out = new Map<string, string>(); // name → root
  const queue: [string, string][] = [[HARNESS_NAME, harnessRoot]];
  while (queue.length) {
    const [name, root] = queue.shift()!;
    if (out.has(name)) continue;
    out.set(name, root);
    for (const need of readDeclaration(root)?.needs ?? []) {
      if (out.has(need)) continue;
      const found = rootOf(need, harnessRoot);
      if (found === undefined) {
        throw new Error(`${name} needs ${need}, which is not mounted beside ${harnessRoot} — the harness's schemas cannot be generated without it`);
      }
      queue.push([need, found]);
    }
  }
  return [...out.values()];
}

/**
 * A registry of the harness's kinds as the harness and what it needs declare
 * them — the base layer's code list plus the `typologies/` and `validators/`
 * graphs of {@link harnessInstances} — whatever else is mounted beside it.
 * `scopes` are the checkouts scanned for them; a layer in a scope that is
 * not in `instances` is not read.
 */
export function harnessRegistry(
  instances: readonly string[] = harnessInstances(),
  scopes: readonly string[] = [...new Set(instances.map((r) => siblingScopeFor(r)))],
): GraphTypologyRegistry {
  const allowed = new Set(instances.map(canonicalPath));
  return new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, scopes, { include: (root) => allowed.has(canonicalPath(root)) });
}

let shared: GraphTypologyRegistry | undefined;
/** {@link harnessRegistry} over the harness this run serves, built once. */
function defaultHarnessRegistry(): GraphTypologyRegistry {
  return (shared ??= harnessRegistry());
}

/** The harness's own kinds: the code list and its `typologies/` nodes, sorted. */
export function harnessKinds(registry: GraphTypologyRegistry = defaultHarnessRegistry()): string[] {
  return registry
    .names()
    .filter((k) => k in BASE_GRAPH_TYPOLOGIES || declaringInstanceOf(registry.get(k))?.name === HARNESS_NAME)
    .sort();
}

/**
 * One Zod schema as JSON Schema. A {@link DISCOVERED_VOCABULARIES} enum is
 * written as the open type: its members are the mounted composition's, not
 * the schema's, so listing them would make the file depend on what was
 * mounted — and with the harness alone the enum is empty, which converts to
 * `{ "not": {} }` and rejects every value a higher layer declares.
 */
export function body(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema, {
    io: "input",
    reused: "inline",
    override: (ctx) => {
      const discovered = DISCOVERED_VOCABULARIES.get(ctx.zodSchema);
      if (!discovered) return;
      const js = ctx.jsonSchema as Record<string, unknown>;
      for (const k of Object.keys(js)) delete js[k];
      js.type = "string";
      js.description = `One of the values the \`${discovered.graph}\` graphs of the composition declare — an open vocabulary, extended by the layers above the harness, so not enumerated here.`;
    },
  }) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

/** Is this validator code this layer holds — not a sibling repository's, not a higher layer's? */
function heldHere(ref: ValidatorRef): boolean {
  return moduleRootOf(ref, HARNESS_ROOT) === TOOLS_ROOT;
}

/** Render one kind's document, or say why it has none. */
export async function renderKind(
  kind: string,
  schemasDir: string,
  registry: GraphTypologyRegistry = defaultHarnessRegistry(),
): Promise<KindDocument> {
  const def = registry.get(kind);
  if (def?.validatorNotApplicable) return { kind, none: `no runtime validator applies: ${def.validatorNotApplicable}` };

  const kv = await resolveKindValidator(kind, HARNESS_ROOT, registry);
  const families = await resolveNodeSchemas(kind, HARNESS_ROOT, registry);

  const defs: [string, Record<string, unknown>][] = [];
  const external: string[] = [];
  const shapes: string[] = [];
  const elsewhere: string[] = [];
  const unresolvable: string[] = [];

  if (kv.state === "resolved") {
    if (heldHere(kv.ref)) defs.push([kind, body(kv.schema)]);
    else elsewhere.push(`${kv.ref.instance ? `${kv.ref.instance}:` : ""}${kv.ref.module}#${kv.ref.exportName}`);
  } else if (kv.state === "unresolvable") {
    unresolvable.push(`${kind}: ${kv.reason}`);
  }
  for (const f of families) {
    if (f.state === "resolved") {
      if (heldHere(f.ref)) defs.push([f.tag, body(f.schema)]);
      else elsewhere.push(`${f.tag} (${f.ref.instance ? `${f.ref.instance}:` : ""}${f.ref.module}#${f.ref.exportName})`);
    } else if (f.state === "external") {
      if (/^https?:\/\//.test(f.tag)) external.push(f.tag);
      else shapes.push(`${f.tag} (external: ${f.spec})`);
    } else if (f.state === "shape") {
      shapes.push(`${f.tag} (${f.ref.module}#${f.ref.exportName})`);
    } else {
      unresolvable.push(`${f.tag}: ${f.reason}`);
    }
  }
  // A validator that does not load is `check:kind-validators`' finding; here it
  // would silently shrink the published document, so it stops the run.
  if (unresolvable.length) throw new Error(`kind "${kind}": a declared validator does not resolve — ${unresolvable.join("; ")}`);

  if (defs.length === 0 && external.length === 0) {
    const why = [
      elsewhere.length ? `its validator is in another repository, which publishes it: ${elsewhere.join(", ")}` : "",
      shapes.length ? `its families are typed only as TypeScript shapes, which cannot be run: ${shapes.join(", ")}` : "",
    ].filter(Boolean);
    return { kind, none: why.length ? why.join("; ") : "it declares no validator and no `$schema` family" };
  }

  const file = join(schemasDir, KINDS_SUBDIR, `${kind}.schema.json`);
  const path = relative(HARNESS_ROOT, file).split("\\").join("/");
  const release = releaseIris(readDeclaration(HARNESS_ROOT));
  if (!release) throw new Error(`${HARNESS_ROOT}'s declaration has no iriBase, so no \`$id\` can be minted`);
  const id = releaseIri(release, path, "agent");

  const notes = [
    shapes.length ? `Not constrained here — typed only as TypeScript shapes: ${shapes.join(", ")}.` : "",
    elsewhere.length ? `Published by the repository that holds it: ${elsewhere.join(", ")}.` : "",
  ].filter(Boolean);

  const doc: Record<string, unknown> = {
    $schema: DIALECT,
    $id: id,
    _generated: `${WRITER} of cat-harness-tools — do not hand-edit; change the Zod and run \`bun run cat kind:json-schemas\``,
    title: kindTitle(kind, registry),
    description: def?.summary ?? kind,
  };
  if (notes.length) doc.$comment = notes.join(" ");

  const single = families.length === 0 && defs.length === 1 && external.length === 0;
  if (single) {
    Object.assign(doc, defs[0]![1]);
  } else {
    doc.anyOf = [
      ...defs.map(([key]) => ({ $ref: `#/$defs/${pointerToken(key)}` })),
      ...external.map((url) => ({ $ref: url })),
    ];
    if (defs.length) doc.$defs = Object.fromEntries(defs.map(([key, b]) => [key, { title: key, ...b }]));
  }
  return { kind, file, id, text: `${JSON.stringify(doc, null, 2)}\n` };
}

/**
 * Judge rendered kind documents without a committed copy (the harness builds
 * them at publish): each parses, carries `$id` equal to its own id, every
 * local `$ref` (`#/...`) resolves inside it, and `again` (a second render)
 * matches byte for byte. Returns one line per problem, empty when all hold.
 */
export function judgeRendered(
  docs: readonly { kind: string; id: string; text: string }[],
  again: ReadonlyMap<string, string>,
): string[] {
  const out: string[] = [];
  for (const d of docs) {
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(d.text) as Record<string, unknown>;
    } catch (e) {
      out.push(`${d.kind}: does not parse (${(e as Error).message})`);
      continue;
    }
    if (doc.$id !== d.id) out.push(`${d.kind}: $id ${JSON.stringify(doc.$id)} is not its path (${d.id})`);
    const refs: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
          if (k === "$ref" && typeof x === "string" && x.startsWith("#")) refs.push(x);
          else walk(x);
        }
      }
    };
    walk(doc);
    for (const r of refs) {
      let at: unknown = doc;
      for (const tok of r.slice(1).split("/").filter(Boolean)) {
        const key = decodeURIComponent(tok).replace(/~1/g, "/").replace(/~0/g, "~");
        at = at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined;
      }
      if (at === undefined) out.push(`${d.kind}: $ref ${r} resolves to nothing`);
    }
    if (again.get(d.kind) !== d.text) out.push(`${d.kind}: a second render differs (not deterministic)`);
  }
  return out;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const schemasDir = declaredSchemasDir();
  const dir = join(schemasDir, KINDS_SUBDIR);

  const kinds = harnessKinds();
  const docs: KindDocument[] = [];
  for (const k of kinds) docs.push(await renderKind(k, schemasDir));
  const written = docs.filter((d): d is Extract<KindDocument, { file: string }> => "file" in d);

  // The vacuity guard: a run over no kinds, or one that renders nothing, has not passed.
  if (kinds.length === 0 || written.length === 0) {
    console.error(`✗ EXAMINED NOTHING — ${kinds.length} kind(s), ${written.length} document(s)`);
    process.exit(1);
  }

  // Built at publish, not committed (owner card, 2026-11-05, via the merge
  // steward: "build it at publish"). The documents are generated from this
  // layer's Zod but were committed in cat-harness, a layer BELOW, so each
  // layer's CI checked them against the other's main: a schema change could
  // go green in neither repository (cat-harness#1056 / cat-harness-tools#1509,
  // bean 69lr). A harness that declares the directory `builtAtPublish` has no
  // committed bytes to compare, so `--check` skips the comparison (the
  // `folio:viz` rule, as `gen-schema-viz.ts` applies it) and still fails on a
  // run that renders nothing (above). A harness that still commits them is
  // checked exactly as before.
  const builtAtPublish = (file: string): boolean =>
    isBuiltAtPublish(readDeclaration(HARNESS_ROOT)?.builtAtPublish ?? [], relative(HARNESS_ROOT, file).split("\\").join("/"));
  if (check && written.every((d) => builtAtPublish(d.file))) {
    // Nothing committed to compare, so the generator's OWN output is judged:
    // each document parses, its `$id` is its path, every local `$ref`
    // resolves, and a second render gives the same bytes (deterministic).
    const again = new Map<string, string>();
    for (const k of kinds) {
      const d = await renderKind(k, schemasDir);
      if ("file" in d) again.set(d.kind, d.text);
    }
    const problems = judgeRendered(written, again);
    for (const p of problems) console.error(`  ✗ ${p}`);
    if (problems.length) {
      console.error(`\n✗ ${problems.length} finding(s) in the generated kind JSON Schemas (built at publish).`);
      process.exit(1);
    }
    console.log(`kind JSON Schemas are built at publish: ${written.length} rendered, each parsed, its $id its path, every local $ref resolved, and rendered identically twice`);
    process.exit(0);
  }

  let findings = 0;
  let wrote = 0;
  const expected = new Set(written.map((d) => `${d.kind}.schema.json`));
  for (const d of written) {
    const rel = relative(HARNESS_ROOT, d.file);
    const prev = existsSync(d.file) ? readFileSync(d.file, "utf8") : null;
    if (prev === d.text) {
      console.log(`  = ${rel}`);
      continue;
    }
    if (check) {
      if (prev === null) console.error(`  ✗ ${rel} is missing — kind "${d.kind}" has no JSON Schema`);
      else {
        let at: unknown;
        try {
          at = (JSON.parse(prev) as { $id?: unknown }).$id;
        } catch {
          at = "(unparseable)";
        }
        if (at !== d.id) console.error(`  ✗ ${rel}: $id ${JSON.stringify(at)} is not its path (${d.id})`);
        else console.error(`  ✗ ${rel} is stale`);
      }
      findings++;
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(d.file, d.text);
    console.log(`  ✓ ${rel}`);
    wrote++;
  }
  // A file no kind accounts for: a renamed or removed kind left it behind.
  for (const f of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (expected.has(f)) continue;
    const rel = relative(HARNESS_ROOT, join(dir, f));
    if (check) {
      console.error(`  ✗ ${rel} belongs to no harness kind`);
      findings++;
    } else {
      rmSync(join(dir, f));
      console.log(`  - ${rel}`);
    }
  }

  const none = docs.filter((d): d is Extract<KindDocument, { none: string }> => "none" in d);
  console.log(`\n${kinds.length} harness kind(s): ${written.length} with a generated JSON Schema, ${none.length} with none`);
  for (const n of none) console.log(`  · ${n.kind} — ${n.none}`);

  if (check && findings) {
    console.error(`\n✗ ${findings} kind JSON Schema finding(s) — run \`bun run cat kind:json-schemas\`.`);
    process.exit(1);
  }
  console.log(check ? "\nkind JSON Schemas are up to date" : `\n${wrote} written, ${written.length - wrote} unchanged`);
}
