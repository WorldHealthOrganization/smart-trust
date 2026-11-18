#!/usr/bin/env bun
/**
 * Publish the declaration's JSON Schema at a dereferenceable `$id`.
 *
 * `<stub>.jsonld` says what this layer contains; this says what a
 * declaration *is*, and lives at the URL its own `$id` names — so a consumer
 * holding a declaration it does not understand has somewhere to go.
 *
 * As in the WHO DAK base IG (`generate_logical_model_schemas.py`), `$id` is
 * the URL the file is served from, so the schema is its own documentation
 * endpoint. Ours derive from Zod (`directory-conventions` §"What lives in the
 * `schemas` graph": the `.ts` is authoritative), so this is a rendering of
 * `CatHarnessDeclarationSchema` beside the JSON-LD, not a second authority.
 *
 * ## `$id` is absolute or absent
 *
 * A relative `$id` makes `$ref` resolution depend on where the fetcher got the
 * file. When no `canonicalUrl` is declared this writes **no** `$id` — the same
 * rule `kg-export` follows for `@id`.
 *
 * @module scripts/harness-schema-export
 * @covers schemas, cat-harness
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, dirname, join, posix, relative, sep } from "node:path";
import type { z } from "zod";
import { namedJsonSchema, toJsonSchema } from "../schemas/kg/to-json-schema.ts";

import {
  CatHarnessDeclarationSchema,
  artefactStub,
  instanceDirectoriesForGraph,
  readDeclaration,
  renderingPath,
  repoRootFor,
} from "../schemas/kg/cat-harness.js";
import { isZodSchema } from "../schemas/kg/kind-validator.js";
import { tools } from "../tools/discover.js";
import { ToolDefinitionSchema } from "../schemas/tools/tool.js";
import { TOOL_TYPES, toolTypeDocumentIri, toolTypePath, type ToolTypeName } from "../schemas/tools/tool-types.js";
import { stagingFields } from "./staging-stamp.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { withConcernGroupDirs } from "./concern-groups.ts";
import { layerContracts } from "./skill-contracts.ts";
import { hostSchemaBase, hostSchemaPath, legacyHostSchemaPath, movedSchema } from "./lib/host-schema.ts";

/*
 * Where a layer keeps its skills' I/O contracts: wherever its skills' refs
 * point (`input:`/`output:` front matter, #1168 B3b), relative to its layer
 * root — the root `schemas/skills/` or a subgraph's own, such as a
 * `L2/schemas/skills/` (bean `cat-tools-st4q`). `layerContracts` in
 * `skill-contracts.ts` is the one reader.
 *
 * It read one fixed `<root>/schemas/skills/` until then, and before that the
 * declared `schemas` directory (`instanceDirectoryForGraph`), until bean
 * `4ak5` item 1 generalised it to every layer: the formal-math layer declares
 * `sources/` as its `schemas` graph and keeps its contracts under
 * `schemas/skills/`, and the FHIR IG harness and a DAK base layer declare no
 * `schemas` graph at all. The refs answer for all of them.
 *
 * Bean `a02m`'s concern is not reopened: that was `directoriesForGraph(...)[0]`
 * picking up a DEPENDENCY's directory through the overlay. `layerContracts`
 * keeps only skills whose holding layer IS the root it is handed, so it
 * cannot reach another layer.
 */

const ROOT = join(HARNESS_ROOT);

export interface SchemaExportOptions {
  baseUrl?: string;
  /**
   * The layer whose contracts are read. The host when absent, so every
   * existing caller — and the host's published bytes — are unchanged.
   */
  root?: string;
  /**
   * The base a contract's `$id` is minted under, when it is not the host's.
   *
   * Passed IN rather than derived here, because for a foreign layer it is
   * {@link instanceSchemaBase} of that layer's published identity, and the
   * identity is `kg-export`'s answer (`publishedIdentity`). Deriving it a second
   * time in this module would be a second answer to "where does this instance
   * publish", free to disagree with the document's own `@id`.
   */
  schemaBase?: string;
}

export function buildDeclarationSchema(opts: SchemaExportOptions = {}): Record<string, unknown> {
  const decl = readDeclaration(ROOT);
  const pkgFile = [join(ROOT, "package.json"), join(repoRootFor(ROOT), "package.json")].find(existsSync);
  const pkg = pkgFile ? (JSON.parse(readFileSync(pkgFile, "utf-8")) as { name?: string }) : {};
  const stub = decl ? artefactStub(decl) : (pkg.name ?? "instance");
  const base = (opts.baseUrl ?? decl?.canonicalUrl ?? "").replace(/\/+$/, "");

  const schema = namedJsonSchema(CatHarnessDeclarationSchema, "CatHarnessDeclaration");

  return {
    ...schema,
    // Absolute or absent — never relative. See the module note. Under the
    // host's own directory since #676 (#603 decision 1b), beside its document.
    ...(base ? { $id: renderingPath(hostSchemaBase(base), `${stub}.schema.json`) } : {}),
    title: "CatHarness declaration",
    description:
      "The root declaration every instance carries as `<name>.json`: what it is called, " +
      "where it publishes, and which directories it scans for which kind of graph. " +
      "Generated from `CatHarnessDeclarationSchema` in schemas/kg/cat-harness.ts, which is authoritative.",
    // Under the layer's own directory, the host's included, since #603
    // decision 1b (owner, 2026-10-23) — `kg-export`'s `exportIdentity`.
    ...(base ? { $comment: `Instance graph: ${renderingPath(base, decl?.name ?? stub, `${stub}.jsonld`)}` } : {}),
  };
}

/**
 * The shared I/O type vocabulary Tool ports reference, as one `$defs` document.
 *
 * Named for what it DEFINES (`tool-types.schema.json`), not for the layer —
 * unlike `<stub>.schema.json`. The rule: a layer artefact takes the
 * layer's name; a vocabulary document takes the vocabulary's, because the
 * same vocabulary means the same thing in every layer and renaming it per
 * repo would make two copies of one type look like two types.
 */
export function buildToolTypes(opts: SchemaExportOptions = {}): Record<string, unknown> {
  const decl = readDeclaration(ROOT);
  const base = (opts.baseUrl ?? decl?.canonicalUrl ?? "").replace(/\/+$/, "");
  const defs: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(TOOL_TYPES)) {
    defs[name] = toJsonSchema(schema);
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...(base ? { $id: renderingPath(hostSchemaBase(base), "tool-types.schema.json") } : {}),
    title: "Tool I/O types",
    description:
      "The shared types a Tool's io.inputs/io.outputs reference by absolute IRI. " +
      "Each is also published as its own document, tool-types/<Name>.schema.json (its own IRI). " +
      "Generated from schemas/tools/tool-types.ts, which is authoritative.",
    $defs: defs,
  };
}

/**
 * One JSON Schema document per shared type, `tool-types/<Name>.schema.json`,
 * each with the `$id` a port's `schema` names — bean `tdir`.
 *
 * The owner, 2026-10-15: *"input ouput schemas should be their own files/json
 * schema when published w/ IRIs so can be referernced easy."* `toolTypeDocumentIri`
 * mints the IRI and `toolTypePath` the published path, from one definition in
 * `schemas/tools/tool-types.ts`, so a port and the file it names cannot drift.
 *
 * ## The combined document stays, inline
 *
 * {@link buildToolTypes} keeps its `$defs` as they were rather than turning
 * each into a `$ref` to these. Its readers (`tools.test.ts`, `mcp-contract`,
 * anything holding a pre-`tdir` IRI into it) dereference locally, and a
 * `$ref` would make each of them fetch 49 more documents to read what they
 * read today. Both are generated from the same Zod in the same run, so they
 * are one answer printed twice, not two answers.
 *
 * ## Written on publish, never committed
 *
 * Like `tool-types.schema.json` itself and the per-skill contracts' published
 * copies: the deploy's `--out-dir ./_site` writes them, and nothing under
 * source control carries one. They are NOT in {@link schemaFiles}, which is
 * the list the `maintains` drift check reads; the type vocabulary is declared
 * there once, by `tool-types.schema.json`, as the skill contracts are
 * declared by their directory rather than per file.
 */
export function buildToolTypeFiles(opts: SchemaExportOptions = {}): Array<[string, Record<string, unknown>]> {
  const decl = readDeclaration(ROOT);
  const base = (opts.baseUrl ?? decl?.canonicalUrl ?? "").replace(/\/+$/, "");
  return (Object.entries(TOOL_TYPES) as Array<[ToolTypeName, z.ZodType]>).map(([name, schema]) => {
    const { $schema: _drop, ...body } = toJsonSchema(schema);
    return [
      toolTypePath(name),
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        // Absolute or absent, as everywhere in this module.
        // Under the host's directory (#676); a port mints its IRI against the
        // same base (`tools/discover.ts`), so the two cannot drift.
        ...(base ? { $id: toolTypeDocumentIri(hostSchemaBase(base), name) } : {}),
        title: name,
        ...body,
      },
    ];
  });
}

/** What a Tool node is. Generated from `ToolDefinitionSchema`. */
export function buildToolSchema(opts: SchemaExportOptions = {}): Record<string, unknown> {
  const decl = readDeclaration(ROOT);
  const base = (opts.baseUrl ?? decl?.canonicalUrl ?? "").replace(/\/+$/, "");
  const schema = namedJsonSchema(ToolDefinitionSchema, "ToolDefinition");
  return {
    ...schema,
    ...(base ? { $id: renderingPath(hostSchemaBase(base), "tool.schema.json") } : {}),
    title: "Tool definition",
    description:
      "One concrete way to exercise a skill. A skill states a capability generically; " +
      "a Tool names the skills it satisfies and how to install and invoke it. " +
      "Generated from schemas/tools/tool.ts, which is authoritative.",
  };
}

/**
 * Where a skill's I/O contract is published, and therefore what its `$id` is.
 *
 * **One function, so an `$id` is never hand-written.** Measured on `main` at
 * 2026-09-18: all 44 files under `schemas/skills/` carried
 * `https://github.com/litlfred/folio-assistant/schemas/skills/<skill>/<io>.schema.json`,
 * which **does not resolve** — a fetch returns 403, because GitHub's browse
 * route needs `/blob/<ref>/` and that segment was never there. Nor were the
 * files served from anywhere else: `_kg/` held only the three documents this
 * script already emitted.
 *
 * That is the same defect `AGENTS.md` records for the README's chapter table —
 * a link COMPOSED by convention and checked against nothing — repeated one
 * layer down, and it matters more here. `schemas/tools/tool.ts` requires a Tool's
 * `io.*.schema` to be an absolute IRI precisely so "the types it names have to
 * exist somewhere fetchable"; a Tool node pointing at a 403 would satisfy the
 * schema and mean nothing. So the contracts had to become fetchable before a
 * single Tool could be written against one.
 *
 * `gen-schema-docs.ts` was already emitting a CORRECT `/blob/main/` link for
 * the same file, which is why nobody noticed: the documentation link worked
 * while the identity did not, and nothing had ever dereferenced an `$id`.
 */
export function skillIoIri(base: string, skill: string, io: string): string {
  return renderingPath(base, "skills", skill, `${io}.schema.json`);
}

/** One skill I/O contract, as found on disk. */
export interface SkillIoContract {
  skill: string;
  /** `input` or `output` — the file stem before `.schema.json`. */
  io: string;
  /** Source path relative to the LAYER root it was read from (`SchemaExportOptions.root`). */
  source: string;
  /** Published path under the output directory. */
  published: string;
  schema: Record<string, unknown>;
}

/**
 * Every `schemas/skills/<skill>/<io>.schema.json`, with `$id` minted.
 *
 * The source files are authoritative for their *content*; the `$id` is
 * **computed** from the declared `canonicalUrl` and overwritten here rather
 * than trusted from the file. A hand-written identity is a string nothing
 * checks, which is exactly how 44 of them came to be dead at once.
 */
export function buildSkillIoContracts(opts: SchemaExportOptions = {}): SkillIoContract[] {
  const root = opts.root ?? ROOT;
  // A foreign layer's base is passed in (`schemaBase`); the host's is its
  // own directory under the site, `hostSchemaBase` (#676).
  const base =
    opts.schemaBase !== undefined
      ? opts.schemaBase.replace(/\/+$/, "")
      : hostSchemaBase(opts.baseUrl ?? readDeclaration(ROOT)?.canonicalUrl ?? "");
  const out: SkillIoContract[] = [];
  // Found through the skills' own refs, wherever they point — the root
  // `schemas/skills/` or a subgraph's — plus whatever still sits at the root
  // unnamed (`layerContracts`, bean `cat-tools-st4q`). The published path and
  // `$id` are keyed by skill, so a contract that moves beside its skill keeps
  // its address.
  for (const { skill, io, source } of layerContracts(root).contracts) {
    const f = `${io}.schema.json`;
    const stored = JSON.parse(readFileSync(join(root, source), "utf-8")) as Record<string, unknown>;
    // With no base the stored `$id` is DROPPED, so the contract publishes
    // with no identity rather than the hand-written one this function exists
    // not to trust. Measured on a fixture (bean `4ak5` item 1): spreading the
    // file let a stale `$id` through whenever no base was known. With a base
    // the computed one replaces it IN PLACE, keeping the key order — so the
    // host's published bytes are unchanged.
    const { $id: _dropped, ...unidentified } = stored;
    out.push({
      skill,
      io,
      source: source.split("/").join(sep),
      // declared-path-literal: an OUTPUT path inside the published schema/ tree (`<stub>/schema/skills/...`), not a source directory a declaration answers.
      published: join("skills", skill, f),
      // Absolute or absent, never relative and never composed by hand.
      // Same rule the three documents above follow.
      schema: base ? { ...stored, $id: skillIoIri(base, skill, io) } : unidentified,
    });
  }
  return out.sort((a, b) => a.source.localeCompare(b.source));
}

/**
 * Source files whose stored `$id` disagrees with where they are published.
 *
 * Reported rather than silently corrected on export, because a mismatch means
 * somebody hand-edited an identity — and a generator that quietly papers over
 * that is how the next 44 go bad without anyone seeing it.
 */
export function staleSkillIoIds(
  opts: SchemaExportOptions = {},
  { acceptLegacy = true }: { acceptLegacy?: boolean } = {},
): Array<{ source: string; stored: string; expected: string }> {
  const bad: Array<{ source: string; stored: string; expected: string }> = [];
  // The host's contracts' address before #676 moved them under its own
  // directory. A stored `$id` still naming it is accepted for the one release
  // the root tombstones cover, so the committed contracts (cat-harness) and
  // this layer can be re-pinned in either order. `--write-ids` does not
  // accept it, so it rewrites them. Drop with the tombstones.
  const legacyBase =
    acceptLegacy && opts.schemaBase === undefined ? (opts.baseUrl ?? readDeclaration(ROOT)?.canonicalUrl ?? "").replace(/\/+$/, "") : "";
  for (const c of buildSkillIoContracts(opts)) {
    const expected = c.schema.$id as string | undefined;
    if (expected === undefined) continue; // No canonicalUrl declared — nothing to check against.
    const stored = JSON.parse(readFileSync(join(opts.root ?? ROOT, c.source), "utf-8")).$id as string | undefined;
    if (stored === expected) continue;
    if (legacyBase && stored === skillIoIri(legacyBase, c.skill, c.io)) continue;
    bad.push({ source: c.source, stored: stored ?? "(none)", expected });
  }
  return bad;
}

/**
 * Rewrite each source file's stored `$id` to where it actually publishes.
 *
 * **This existed only as a sentence until 2026-09-19.** `--check` printed
 * "Run `bun run cat kg:schema` to rewrite them", and `kg:schema` writes `_kg/` —
 * build output — leaving the committed sources untouched. So the one remedy
 * the gate named did not perform it, and the only way past a legitimate
 * relocation was to hand-edit 44 identities: precisely the act the gate exists
 * to catch. Found by moving the renderings off `kg/`, which made all 44 stale
 * at once.
 *
 * **It writes the `$id` and nothing else.** The source is authoritative for its
 * content; only the identity is computed. Keys keep their order because the
 * object is rebuilt from the parsed file with `$id` replaced in place, so the
 * diff is one line per file and reviewable as such.
 *
 * Separate from `--check` on the repo's own rule: a check that writes can pass
 * by fixing what it was asked to report.
 */
/**
 * How a Tool node spells "produced by this command".
 *
 * A literal, in the file that IS the command — the one place where naming it is
 * not a second declaration of somebody else's fact. A node claiming an artefact
 * this script writes carries exactly this string in `invoke.shell`, which is the
 * link `artefactDeclarationDrift` follows.
 */
const SELF_INVOCATION = "bun run cat kg:schema";

/**
 * Artefacts a Tool node declares itself authoritative for, by published path.
 *
 * Reads `maintains` off the `tools` graph — see {@link ToolMaintainsSchema} in
 * `schemas/tools/tool.ts`. The base is irrelevant here: the comparison is on the
 * path relative to the layer base, which is what the declaration carries.
 */
export function declaredArtefacts(): Map<string, { tool: string; source: string; producedBy?: string }> {
  const out = new Map<string, { tool: string; source: string; producedBy?: string }>();
  // `tools()` with no argument, so the I/O type IRIs are minted against the
  // DECLARED base. Passing `""` makes them relative and `defineTool` refuses
  // the node — correctly: a Tool whose schema refs do not dereference is not a
  // Tool anyone can use. The base is irrelevant to the comparison below, which
  // is on the artefact path relative to it, but the node still has to be valid
  // to be read at all.
  for (const t of tools()) {
    for (const m of t.maintains ?? []) {
      // `producedBy` is the declaring Tool's own invocation, carried through so
      // the reconciliation below can tell which artefacts THIS command is
      // answerable for. See `artefactDeclarationDrift`.
      out.set(m.artefact, { tool: t.id, source: m.source, producedBy: t.invoke.shell });
    }
  }
  return out;
}

/**
 * Where the declared relation and the produced files disagree.
 *
 * **Both directions, because one is half a guarantee.** `undeclared` catches a
 * new artefact nobody added a Tool node for — which is how the relation drifts
 * back into this script's local array, where it lived until 2026-09-19.
 * `unproduced` catches a declaration that rotted: a Tool still claiming an
 * artefact this layer no longer writes, which a consumer of the published
 * graph would follow to a 404.
 *
 * `missingSource` is the third finding and a different failure again: the
 * declaration names a module that is not in the tree. That is not "the artefact
 * is wrong" — the artefact may be perfectly correct — it is the PROVENANCE
 * being unfollowable, and the remedy is the opposite (fix the path, not the
 * build).
 *
 * ## `unproduced` is scoped to what THIS command writes, and that is a narrowing
 *
 * It was not, until 2026-09-20. `maintains` says a Tool is authoritative for a
 * published artefact; it never said the artefact is produced by the schema
 * exporter. The three original carriers all happened to be, so the check was
 * written against that coincidence and reported the first counterexample as
 * drift: `ns-vocabulary` and `content-context` maintain `ns/vocabulary.jsonld`
 * and `ns/content/v1.jsonld`, which `.github/workflows/docs-site.yml` publishes
 * — both declarations true, both flagged. (The union was retired on 2026-09-30;
 * `ns-vocabulary` now maintains each layer's `<stub>/ns.jsonld`.)
 *
 * So the comparison now runs only over artefacts whose declaring Tool invokes
 * this command. That keeps the rot guarantee exactly where this script can
 * honour it and stops it claiming one it cannot: this script has no way to know
 * whether the site build wrote a file into `_site/`, and a check that answers a
 * question it cannot see is worse than one that declines to.
 *
 * **Coverage of the others is therefore now absent HERE, not merely narrower** —
 * an artefact maintained by some other producer can rot to a 404 and nothing in
 * this script notices. That was the honest cost of the narrowing, and it is now
 * paid: `scripts/check-maintained-artefacts.ts` asks the same question where the
 * answer exists, against the assembled `_site/` rather than against this script's
 * output, and treats an unbuilt tree as could-not-determine rather than as a pass.
 * Bean `6f1x`.
 *
 * `undeclared` is unchanged and still runs over everything produced: a file this
 * command writes with no Tool declaring it is the drift that put this relation
 * in a local array until 2026-09-19, and that direction needs no scoping.
 */
export function artefactDeclarationDrift(produced: readonly string[]): {
  undeclared: string[];
  unproduced: Array<{ artefact: string; tool: string }>;
  missingSource: Array<{ artefact: string; tool: string; source: string }>;
} {
  const declared = declaredArtefacts();
  const producedSet = new Set(produced);
  // For one release (#676), a Tool may still declare a host schema at its old
  // site-root path: cat-harness's `maintains` and this layer are re-pinned in
  // either order. The old path names the moved file. Drop with the tombstones.
  const movedFrom = new Map<string, string>();
  for (const a of produced) {
    const old = legacyHostSchemaPath(a);
    if (old !== undefined) movedFrom.set(old, a);
  }
  const isDeclared = (a: string): boolean => {
    const old = legacyHostSchemaPath(a);
    return declared.has(a) || (old !== undefined && declared.has(old));
  };
  const undeclared = produced.filter((a) => !isDeclared(a)).sort();
  const unproduced: Array<{ artefact: string; tool: string }> = [];
  const missingSource: Array<{ artefact: string; tool: string; source: string }> = [];
  for (const [artefact, d] of declared) {
    // Only this command's own artefacts: see the note above on the narrowing.
    if (d.producedBy === SELF_INVOCATION && !producedSet.has(artefact) && !movedFrom.has(artefact)) {
      unproduced.push({ artefact, tool: d.tool });
    }
    // The harness declares, the tools layer implements: a source is looked for
    // in the declaring layer, then in the one that implements it — the
    // same rule `check:tools` applies to `invoke.*.module` (bean `8lcl` moved
    // the harness's schema modules to the tools layer).
    if (!existsSync(join(ROOT, d.source)) && !existsSync(join(TOOLS_ROOT, d.source))) {
      missingSource.push({ artefact, tool: d.tool, source: d.source });
    }
  }
  return {
    undeclared,
    unproduced: unproduced.sort((a, b) => a.artefact.localeCompare(b.artefact)),
    missingSource: missingSource.sort((a, b) => a.artefact.localeCompare(b.artefact)),
  };
}

export function writeSkillIoIds(opts: SchemaExportOptions = {}): string[] {
  const written: string[] = [];
  for (const { source, stored, expected } of staleSkillIoIds(opts, { acceptLegacy: false })) {
    const abs = join(opts.root ?? ROOT, source);
    const doc = JSON.parse(readFileSync(abs, "utf-8")) as Record<string, unknown>;
    if (stored === "(none)" && !("$id" in doc)) {
      // A file with no `$id` at all: put it FIRST, which is where every other
      // one carries it and where a reader looks for a document's identity.
      writeFileSync(abs, JSON.stringify({ $id: expected, ...doc }, null, 2) + "\n");
    } else {
      doc.$id = expected;
      writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n");
    }
    written.push(source);
  }
  return written;
}

/**
 * The schema documents this layer publishes, and their published names.
 *
 * Extracted so `--check` and the write path read the SAME list. It was a local
 * array inside the write branch, which meant the drift check below could only
 * have compared the declaration against a second copy of it — two answers to
 * "what does this instance produce", which is the defect the declaration
 * exists to remove.
 *
 * Layer artefact takes the layer's name; vocabulary documents take the
 * vocabulary's. See `buildToolTypes`.
 *
 * Each name is SITE-relative, `<name>/<file>`: the host's schemas sit under its
 * own directory, beside its document, since #676 (#603 decision 1b), and a
 * Tool's `maintains.artefact` is site-relative too (`cat-harness/ns.jsonld`).
 */
export function schemaFiles(stub: string, baseUrl?: string): Array<[string, Record<string, unknown>]> {
  return [
    [hostSchemaPath(`${stub}.schema.json`), buildDeclarationSchema({ baseUrl })],
    [hostSchemaPath("tool.schema.json"), buildToolSchema({ baseUrl })],
    [hostSchemaPath("tool-types.schema.json"), buildToolTypes({ baseUrl })],
  ];
}

/**
 * The one-release tombstone at each host schema's old site-root address
 * (#676; #603 decision 1b, decision 5a: one per old address).
 *
 * `[old site-relative path, tombstone]` for each document `published` lists,
 * as `[site-relative path now, document]`. The old `$id` is the new one with
 * the host's segment taken out, so a preview's tombstones name the preview's
 * documents. A document with no `$id` (no base) gets none: there is no address
 * to forward from. The combined type vocabulary forwards each `$defs` entry to
 * its per-type document, which a port named as `…#/$defs/<Name>` before the move.
 */
export function schemaTombstones(
  published: ReadonlyArray<readonly [string, Record<string, unknown>]>,
  stamp: Record<string, unknown> = {},
): Array<[string, Record<string, unknown>]> {
  const out: Array<[string, Record<string, unknown>]> = [];
  const typeDocs = new Map<string, string>();
  for (const [path, doc] of published) {
    const m = /(?:^|\/)tool-types\/([A-Za-z][A-Za-z0-9]*)\.schema\.json$/.exec(path);
    if (m && typeof doc.$id === "string") typeDocs.set(m[1]!, doc.$id);
  }
  for (const [path, doc] of published) {
    const old = legacyHostSchemaPath(path);
    const newIri = doc.$id;
    if (old === undefined || typeof newIri !== "string" || !newIri.endsWith(`/${path}`)) continue;
    const site = newIri.slice(0, newIri.length - path.length);
    const defs =
      old === "tool-types.schema.json"
        ? Object.fromEntries(Object.keys((doc.$defs ?? {}) as Record<string, unknown>).flatMap((n) => (typeDocs.has(n) ? [[n, typeDocs.get(n)!]] : [])))
        : {};
    out.push([old, movedSchema(`${site}${old}`, newIri, doc.title, defs, stamp)]);
  }
  return out;
}

// ── EVERY OTHER LAYER'S SCHEMA — `<site>/<stub>/schema/` (bean `4ak5` item 1) ──
//
// Owner ruling 2026-10-05, option B: every layer `instance-exports.ts`
// publishes ALSO publishes a schema directory beside its document. The
// builders above stay the host's, byte for byte; what follows reuses them over
// another layer's root. Policy: `instance-publication` §"The schema".

/**
 * The part of a layer's PUBLISHED identity this module needs.
 *
 * Structurally a subset of what `publishedIdentity` in `kg-export.ts` returns,
 * and it is always that function's answer — passed in, never re-derived here.
 * This module cannot import `kg-export` (which imports it for `skillIoIri`), and
 * a second derivation of "where does this instance publish" is the thing
 * `instance-publication` §"Three questions that must not be merged" forbids: it
 * would be free to disagree with the document's own `@id`.
 */
export interface InstanceIdentity {
  stub: string;
  /** The publication base the layer's `@id`s are minted under. Empty when none is known. */
  base: string;
  /** The document's path under `base`: `<stub>/<stub>.jsonld`, or `<stub>.jsonld` for a layer with its own `canonicalUrl`. */
  docPath: string;
  /** The document's `@id`, for the index's back-pointer. */
  docIri?: string;
}

/** The directory, beside a layer's document, that holds its schemas. */
export const INSTANCE_SCHEMA_DIR = "schema";

/**
 * The base a layer's schema `$id`s are minted under — `schema/` BESIDE ITS
 * DOCUMENT, at its publication identity.
 *
 * Beside the document, not at a second composed address: a layer with no
 * `canonicalUrl` of its own sits at `<site>/<stub>/<stub>.jsonld`, so its schemas
 * are `<site>/<stub>/schema/…`; one that declares its own sits at
 * `<canonicalUrl>/<stub>.jsonld`, so its schemas are `<canonicalUrl>/schema/…`.
 * The second is its PUBLICATION identity; this site only stages the bytes at
 * `<site>/<stub>/schema/` (`instance-publication` §"Three questions that must
 * not be merged"), exactly as it stages the document.
 *
 * Empty when the identity has no base: an `$id` is absolute or absent (module
 * note), and a document-relative one would resolve differently per fetcher.
 */
export function instanceSchemaBase(id: InstanceIdentity): string {
  if (!id.base) return "";
  const docDir = posix.dirname(id.docPath);
  return renderingPath(id.base, docDir === "." ? "" : docDir, INSTANCE_SCHEMA_DIR);
}

/** The schema index's `$id` — `<schema base>/<stub>.schema.json`, or `undefined` with no base. */
export function instanceSchemaIndexIri(id: InstanceIdentity): string | undefined {
  const b = instanceSchemaBase(id);
  return b ? renderingPath(b, `${id.stub}.schema.json`) : undefined;
}

// ── PUBLIC ZOD SCHEMAS — `<stub>/schema/zod/` (bean `4ak5` item 1, part 2) ──
//
// OWNER RULING 2026-10-05, option C, in the owner's words: "every exported
// *Schema" — "Render all exported Zod *Schema consts per instance now; may
// expose internal schemas." So the rule is mechanical and deliberately broad:
//
//   A layer's PUBLIC schemas are every EXPORTED const whose name ends in
//   `Schema` and whose value is a Zod schema, in the `.ts` modules (not
//   `*.test.ts`) directly inside that layer's schemas directory.
//
// "Publishing" one is therefore NOT a stability promise; the owner accepted
// that internal schemas are exposed. What the rule buys is that "which of this
// instance's types can I fetch" has an answer nobody has to curate.

/** The subdirectory of a layer's `schema/` that holds its rendered Zod schemas. */
export const ZOD_SCHEMA_DIR = "zod";

/** The name half of the rule. One pattern, so the scan and the gate cannot spell it twice. */
export const PUBLIC_SCHEMA_EXPORT = /Schema$/;

/**
 * The directories a layer's public Zod schemas are read from.
 *
 * Its DECLARED `schemas` graph when it declares one, else `<root>/schemas/` by
 * convention — the fallback `schemasRoot` in `gen-schema-docs.ts` already uses.
 * Unlike the skill contracts (which skills name by ref), nothing NAMES these modules by path, so the
 * declaration is the authority here. Measured 2026-10-05: the formal-math layer
 * and the IRIS replica declare `sources/` (source descriptors, JSON only), so they
 * are scanned there and hold none; the FHIR IG harness, a DAK base layer and the other
 * undeclared layers fall back to `schemas/`.
 *
 * The PLURAL accessor, because the singular throws when a layer declares
 * two `schemas` directories (`large-datasets` does), and taking either one
 * alone is the `dh4f` shape — a declared directory nobody scans.
 */
export function instanceZodSchemaDirs(root: string): string[] {
  const declared = instanceDirectoriesForGraph(root, "schemas");
  // declared-path-literal: the convention fallback for a layer that declares no `schemas` graph, the same fallback `schemasRoot` uses for the host.
  // With each one's concern groups (`schemas/<group>/`, bean `f8wp`).
  return withConcernGroupDirs(declared.length > 0 ? declared : [join(root, "schemas")], "schemas");
}

/**
 * A module that only re-exports a module moved into a concern group — the
 * one-release shim a regroup leaves at the old path (bean `f8wp`). Its exports
 * are the moved module's own objects, so scanning it would publish each
 * schema twice under one basename.
 */
export function isReexportShim(text: string): boolean {
  const body = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
  return body.length > 0 && body.split(/;\s*/).filter((s) => s.trim() !== "").every((s) => /^export\s+(\*|\{\s*default\s*\})\s+from\s+["'][^"']+["']$/.test(s.trim()));
}

/**
 * Whether {@link scanInstanceZodSchemas} would be DETERMINED for this layer
 * — whether its schemas directories resolve — without importing anything.
 *
 * For the JSON-LD document's `omitted` (`kg-export.ts`), which must not stop
 * saying "schemas were not looked for" when the index the document links
 * would say the same. Through {@link instanceZodSchemaDirs}, the scan's own
 * first step, so the two cannot answer differently.
 */
export function zodSchemaScanDetermined(root: string): boolean {
  try {
    instanceZodSchemaDirs(root);
    return true;
  } catch {
    return false;
  }
}

/** One exported Zod `*Schema`, as found by {@link scanInstanceZodSchemas}. */
export interface ZodSchemaExport {
  /** Module path relative to the layer root, `/`-separated. */
  module: string;
  /** The module's basename without `.ts` — the published directory name. */
  name: string;
  exportName: string;
  schema: unknown;
}

/** What {@link scanInstanceZodSchemas} saw in one layer. */
export interface ZodSchemaScan {
  /**
   * False when the directories could not even be resolved (an unreadable
   * declaration). The index then keeps `omitted: ["schemas"]`: "could not
   * look" must never read as "there are none".
   */
  determined: boolean;
  /** The directories scanned, relative to the layer root. */
  dirs: string[];
  found: ZodSchemaExport[];
  /**
   * Exports named `*Schema` whose value is NOT a Zod schema. Not public by the
   * rule, so not rendered and not a failure — listed so the exclusion is
   * visible rather than silent.
   */
  notZod: Array<{ module: string; exportName: string; type: string }>;
  /** Modules that failed to import, or directories that could not be resolved. Each is a failure. */
  problems: string[];
}

/**
 * Import every module in the layer's schemas directories and collect its
 * public Zod schemas ({@link PUBLIC_SCHEMA_EXPORT} + {@link isZodSchema}).
 *
 * A dynamic import of another layer's file is a RUNTIME read: it adds no
 * static import edge, so `check:import-direction` does not see it, and it
 * should not — this module does not depend on what it renders.
 *
 * Top-level `.ts` of each directory and of its declared concern groups,
 * matching `schemaModules` in `schema-nodes.ts`, which is
 * this graph's other reader. A module that fails to import is a PROBLEM, never
 * a skip: a silently missing module is "there are none" said falsely.
 */
export async function scanInstanceZodSchemas(root: string): Promise<ZodSchemaScan> {
  let dirs: string[];
  try {
    dirs = instanceZodSchemaDirs(root);
  } catch (e) {
    return {
      determined: false,
      dirs: [],
      found: [],
      notZod: [],
      problems: [`the schemas directory could not be resolved: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  const rel = (p: string): string => relative(root, p).split("\\").join("/");
  const scan: ZodSchemaScan = { determined: true, dirs: dirs.map(rel), found: [], notZod: [], problems: [] };
  for (const dir of dirs) {
    // Absent is a determined empty, not a failure: most layers keep no
    // schema modules, and the declaration-or-convention rule was still applied.
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts") || f.endsWith(".d.ts")) continue;
      if (isReexportShim(readFileSync(join(dir, f), "utf-8"))) continue;
      const module = rel(join(dir, f));
      let mod: Record<string, unknown>;
      try {
        // input-site: imports */schemas/*.ts,schemas/*.ts,*/schemas/*/*.ts,schemas/*/*.ts #de77ba20 — each layer's Zod schema modules, top level and declared concern groups, as schemaModules reads them
        mod = (await import(join(dir, f))) as Record<string, unknown>;
      } catch (e) {
        scan.problems.push(`${module}: could not be imported: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      for (const exportName of Object.keys(mod).sort()) {
        if (!PUBLIC_SCHEMA_EXPORT.test(exportName)) continue;
        const value = mod[exportName];
        if (isZodSchema(value)) scan.found.push({ module, name: basename(f, ".ts"), exportName, schema: value });
        else scan.notZod.push({ module, exportName, type: value === null ? "null" : typeof value });
      }
    }
  }
  return scan;
}

/** Where one rendered Zod schema is published, relative to the layer's `schema/`. */
export function zodSchemaPath(moduleName: string, exportName: string): string {
  return posix.join(ZOD_SCHEMA_DIR, moduleName, `${exportName}.schema.json`);
}

/** One public Zod schema rendered as a JSON Schema document. */
export interface RenderedZodSchema {
  module: string;
  exportName: string;
  /** Published path under `<stub>/schema/`. */
  published: string;
  schema: Record<string, unknown>;
}

/**
 * Render each scanned schema with `namedJsonSchema`, the wrapper every host
 * schema document already uses, and mint its `$id` under the layer's
 * schema base — the same publication-identity rule as its contracts.
 *
 * Every failure is returned, none swallowed: a value that is not a zod-4
 * schema (it has no `_zod`; `to-json-schema.ts` records that the converter
 * would publish a zod-3 one EMPTY while reporting success), a converter throw
 * (`z.custom`, `z.date` and the like are not representable), and two modules of
 * one basename in different declared directories colliding on a path.
 */
export function renderZodSchemas(
  found: readonly ZodSchemaExport[],
  schemaBase: string,
): { rendered: RenderedZodSchema[]; problems: string[] } {
  const rendered: RenderedZodSchema[] = [];
  const problems: string[] = [];
  const claimed = new Map<string, string>();
  for (const f of found) {
    const at = `${f.module}#${f.exportName}`;
    const published = zodSchemaPath(f.name, f.exportName);
    const prior = claimed.get(published);
    if (prior !== undefined) {
      problems.push(`${at}: publishes to ${published}, which ${prior} already does — two modules share the basename \`${f.name}\``);
      continue;
    }
    if (typeof f.schema !== "object" || f.schema === null || !("_zod" in f.schema)) {
      problems.push(`${at}: has \`safeParse\` but is not a zod-4 schema, so the converter would publish it empty`);
      continue;
    }
    let body: Record<string, unknown>;
    try {
      // `Foo` for `FooSchema`, as the host names `ToolDefinitionSchema`'s.
      body = namedJsonSchema(f.schema as z.ZodType, f.exportName.replace(PUBLIC_SCHEMA_EXPORT, "") || f.exportName);
    } catch (e) {
      problems.push(`${at}: could not be rendered: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    claimed.set(published, at);
    rendered.push({
      module: f.module,
      exportName: f.exportName,
      published,
      schema: {
        ...body,
        // Absolute or absent — the module note's rule, as for every contract.
        ...(schemaBase ? { $id: renderingPath(schemaBase, published) } : {}),
        title: f.exportName,
        description:
          `Generated from \`${f.exportName}\` in ${f.module}, which is authoritative. Published because it is an ` +
          "exported Zod `*Schema` (owner ruling 2026-10-05) — which says it is reachable, not that it is stable.",
      },
    });
  }
  return { rendered, problems };
}

/** What one layer's `schema/` directory holds, by path relative to it. */
export interface InstanceSchemaExport {
  /** `[path under <stub>/schema/, document]`, index first. */
  files: Array<[string, Record<string, unknown>]>;
  /** The layer's own skill I/O contracts, `$id` minted under its schema base. */
  contracts: SkillIoContract[];
  /** The index's `$id`, when the layer has a base. */
  indexIri?: string;
  /**
   * The layer's public Zod schemas, rendered (part 2, owner ruling
   * 2026-10-05, option C). Empty when no scan was passed in — see
   * {@link buildInstanceSchemas}.
   */
  zod: RenderedZodSchema[];
  /** Whether a determined scan was passed in. False keeps `omitted: ["schemas"]` in the index. */
  zodScanned: boolean;
  /**
   * Every module that failed to import and every export that failed to
   * render. Non-empty fails the deploy and the gate; the index lists them too,
   * as `unrendered`, so a consumer can tell "not rendered" from "not there".
   */
  zodProblems: string[];
}

/**
 * One layer's schema directory: its own skill I/O contracts and an index.
 *
 * ## The index
 *
 * `<stub>.schema.json` is the schema of the layer's DECLARATION — it
 * `$ref`s the shared declaration schema the host publishes
 * ({@link buildDeclarationSchema}, by its published `$id`, so a preview's
 * index names the preview's copy) — and it lists every contract in `$defs`
 * by `$id`. A consumer holding a layer's `<stub>.json` reaches both from
 * one fetch.
 *
 * ## Public Zod schemas — listed when a scan is passed in
 *
 * Until 2026-10-05 none were, because no rule said which exports are public:
 * the JSON-LD's schema-node collector yields MODULES, not Zod values (it was
 * instance-bound then; since 2026-11-10 it reads every exported layer, and
 * `kg-export.ts` links each module's node to these renderings). The owner then made the
 * rule (option C, "every exported *Schema" — see the section above): every
 * exported `*Schema` const that is a Zod schema, rendered under `zod/` and
 * listed in `$defs` by `$id` beside the contracts.
 *
 * The scan is ASYNC (it imports modules) and this builder is not, so the scan
 * is an argument: {@link scanInstanceZodSchemas} first, then this. Without one
 * the index keeps `omitted: ["schemas"]`, exactly as before, so "not looked
 * for" still cannot read as "there are none"; with an undetermined one it
 * keeps it too. A determined scan drops it — the absence of `zod/` entries is
 * then a measured zero. Failures go to `zodProblems` and to the index's
 * `unrendered`, never nowhere.
 */
export function buildInstanceSchemas(
  root: string,
  id: InstanceIdentity,
  opts: { baseUrl?: string; zod?: ZodSchemaScan } = {},
): InstanceSchemaExport {
  const schemaBase = instanceSchemaBase(id);
  const contracts = buildSkillIoContracts({ root, schemaBase });
  const scanned = opts.zod?.determined === true;
  const renders = scanned ? renderZodSchemas(opts.zod!.found, schemaBase) : { rendered: [], problems: [] };
  const zodProblems = [...(opts.zod?.problems ?? []), ...renders.problems];
  const indexIri = instanceSchemaIndexIri(id);
  // The SHARED declaration schema, at the `$id` the host's own export gives
  // it in this same build — `schemaFiles` publishes that document.
  const declarationIri = buildDeclarationSchema({ baseUrl: opts.baseUrl }).$id as string | undefined;
  const defs: Record<string, unknown> = {};
  for (const c of contracts) {
    // By `$id` when there is one. With no base both files sit in this one
    // directory, so the published path resolves the same for every fetcher.
    defs[`skills/${c.skill}/${c.io}`] = { $ref: (c.schema.$id as string | undefined) ?? c.published.split("\\").join("/") };
  }
  for (const r of renders.rendered) {
    defs[r.published.replace(/\.schema\.json$/, "")] = { $ref: (r.schema.$id as string | undefined) ?? r.published };
  }
  const index: Record<string, unknown> = {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...(indexIri ? { $id: indexIri } : {}),
    title: `${id.stub} schemas`,
    description:
      `The schemas instance \`${id.stub}\` publishes: its declaration, which is a ` +
      "CatHarness declaration and is validated by the shared schema this `$ref`s, and its skills' I/O " +
      (scanned
        ? "contracts and its public Zod schemas — every exported Zod `*Schema` const (owner ruling 2026-10-05) — " +
          "listed in `$defs` by `$id`."
        : "contracts, listed in `$defs` by `$id`. Public Zod schemas are not listed — see `omitted`."),
    ...(declarationIri ? { allOf: [{ $ref: declarationIri }] } : {}),
    $defs: defs,
    // The JSON-LD export's own word for a collector it did not run. See above.
    ...(scanned ? {} : { omitted: ["schemas"] }),
    ...(zodProblems.length > 0 ? { unrendered: zodProblems } : {}),
    ...(id.docIri ? { $comment: `Instance graph: ${id.docIri}` } : {}),
  };
  return {
    files: [
      [`${id.stub}.schema.json`, index],
      ...contracts.map((c): [string, Record<string, unknown>] => [c.published, c.schema]),
      ...renders.rendered.map((r): [string, Record<string, unknown>] => [r.published, r.schema]),
    ],
    contracts,
    zod: renders.rendered,
    zodScanned: scanned,
    zodProblems,
    ...(indexIri ? { indexIri } : {}),
  };
}

if (import.meta.main) {
  const arg = (f: string): string | undefined => {
    const i = process.argv.indexOf(f);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  // input-site: env KG_BASE_URL #fa804f2f — the base URL the exported ids are minted under
  const baseUrl = arg("--base-url") ?? process.env.KG_BASE_URL;
  const decl = readDeclaration(ROOT);
  const pkgFile = [join(ROOT, "package.json"), join(repoRootFor(ROOT), "package.json")].find(existsSync);
  const pkg = pkgFile ? (JSON.parse(readFileSync(pkgFile, "utf-8")) as { name?: string }) : {};
  const stub = decl ? artefactStub(decl) : (pkg.name ?? "instance");

  // `--check` VERIFIES AND WRITES NOTHING.
  //
  // A check that writes is a check that can pass by fixing the thing it was
  // asked to report. It would also mean CI's verification step mutating the
  // tree it is verifying, which makes a later "the tree is clean" assertion
  // meaningless. So the two modes are exclusive and the check runs first.
  if (process.argv.includes("--write-ids")) {
    const written = writeSkillIoIds();
    if (written.length === 0) console.log("✓ every skill I/O $id already matches its published location");
    else {
      console.log(`Rewrote ${written.length} skill I/O $id(s):`);
      for (const w of written) console.log(`  ${w}`);
    }
    process.exit(0);
  }

  if (process.argv.includes("--check")) {
    // Deliberately against the DECLARED base, not `--base-url`: a source `$id`
    // is always canonical. A preview overrides the base at export time only —
    // `feature-staging.yml` passes its own — and checking a staging build's
    // base against the committed files would report all 44 as stale on every
    // branch build.
    // The DECLARED relation, checked both ways. See `artefactDeclarationDrift`.
    const drift = artefactDeclarationDrift(schemaFiles(stub).map(([n]) => n));
    if (drift.undeclared.length + drift.unproduced.length + drift.missingSource.length > 0) {
      console.error("the `maintains` declaration and the produced schemas disagree:");
      for (const a of drift.undeclared) {
        console.error(`  ✗ ${a}\n      produced, but no Tool node declares it. Add a \`maintains\` entry in tools/index.ts.`);
      }
      for (const u of drift.unproduced) {
        console.error(`  ✗ ${u.artefact}\n      declared by Tool "${u.tool}", but this instance does not produce it.`);
      }
      for (const m of drift.missingSource) {
        console.error(`  ✗ ${m.artefact}\n      Tool "${m.tool}" names source ${m.source}, which is not in the tree.`);
      }
      process.exit(1);
    }

    const stale = staleSkillIoIds();
    if (stale.length > 0) {
      console.error(`${stale.length} skill I/O schema(s) carry an $id that is not where they publish:`);
      for (const b of stale) console.error(`  ✗ ${b.source}\n      stored   ${b.stored}\n      expected ${b.expected}`);
      console.error("\nRun `bun run cat kg:schema:ids` to rewrite them.");
      process.exit(1);
    }
    const n = buildSkillIoContracts().length;
    console.log(`✓ every skill I/O $id matches its published location (${n} contract(s))`);
    console.log(`✓ every published schema is declared by a Tool node (${declaredArtefacts().size} maintained)`);
    process.exit(0);
  }

  // `_kg/` is a REPOSITORY build output — gitignored at the repository root,
  // beside `node_modules/`, `_site/` and `test-results/`, and read from there
  // by the e2e specs and `test-server.mjs`, both of which run at that root.
  // `ROOT` became the LAYER root with the move (bean `wggr`), so this
  // default started writing `cat-harness/_kg/` while every reader still looked
  // one level up — and the stale pre-move copy at the old path made it look
  // fine locally.
// input-site: inert #cffed427 — the default output directory, written and never read
const outDir = arg("--out-dir") ?? join(repoRootFor(ROOT), "_kg");
  mkdirSync(outDir, { recursive: true });

  // Which build wrote these. Stamped at WRITE time, not in the builders: the
  // `build*` functions describe what a declaration IS, which is the same answer
  // in every run, and folding a run id into them would make two calls in one
  // process return documents that differ. See `scripts/staging-stamp.ts` for
  // why it is absent rather than fabricated outside CI.
  //
  // JSON Schema draft-07 ignores keywords it does not know, so this is inert
  // for validation and readable for a human — the same trade the JSON-LD export
  // makes, and it is why both use the one key.
  const staging = stagingFields();

  // Every document under the host's own directory, `<out>/<name>/…` (#676),
  // by site-relative path. `--out-dir` is the SITE root, as before: the deploy
  // passes `./_site`, so its step needs no change.
  const write = (path: string, doc: Record<string, unknown>): string => {
    const out = join(outDir, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ ...doc, ...staging }, null, 2) + "\n");
    return out;
  };

  const files = schemaFiles(stub, baseUrl);
  for (const [name, schema] of files) {
    const out = write(name, schema);
    console.log(`${relative(ROOT, out)}`);
    console.log(`  $id  ${schema.$id ?? "(none — no canonicalUrl declared)"}`);
  }

  // One document per shared type, at the IRI each port names (bean `tdir`).
  const typeFiles = buildToolTypeFiles({ baseUrl }).map(([name, schema]): [string, Record<string, unknown>] => [
    hostSchemaPath(name),
    schema,
  ]);
  for (const [name, schema] of typeFiles) write(name, schema);
  console.log(`${relative(ROOT, join(outDir, hostSchemaPath("tool-types")))}/  (${typeFiles.length} type(s))`);
  console.log(`  $id  ${typeFiles[0]?.[1].$id ?? "(none — no canonicalUrl declared)"}  …`);

  // The per-skill I/O contracts, published at the `$id` each one claims.
  // The contracts are stamped too. They are the artefacts a Tool node's
  // `io.*.schema` dereferences to, so "which build is this contract from" is
  // the question with the most riding on it, not the least.
  const contracts = buildSkillIoContracts({ baseUrl });
  const contractFiles = contracts.map((c): [string, Record<string, unknown>] => [
    hostSchemaPath(c.published.split("\\").join("/")),
    c.schema,
  ]);
  for (const [name, schema] of contractFiles) write(name, schema);
  if (contracts.length > 0) {
    console.log(
      `${relative(ROOT, join(outDir, hostSchemaPath("skills")))}/  ` +
        `(${contracts.length} contract(s) across ${new Set(contracts.map((c) => c.skill)).size} skill(s))`,
    );
    console.log(`  $id  ${contracts[0].schema.$id ?? "(none — no canonicalUrl declared)"}  …`);
  }

  // The old site-root addresses, each a one-release tombstone forwarding to
  // the moved document (#676). Written with the stamp folded in, not by
  // `write`, which would stamp them a second time.
  const tombs = schemaTombstones([...files, ...typeFiles, ...contractFiles], staging);
  for (const [old, doc] of tombs) {
    const out = join(outDir, old);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  }
  if (tombs.length > 0) console.log(`${tombs.length} tombstone(s) at the old site-root addresses (one release, #676)`);
}
