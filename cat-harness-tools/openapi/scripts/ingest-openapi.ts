#!/usr/bin/env bun
/**
 * Ingest the OpenAPI documents a layer's `cat-openapi.config.json` names
 * into its `openapi` directory — each document VERBATIM, with a
 * `<id>.source.json` recording where it came from.
 *
 * @module cat-harness/openapi/scripts/ingest-openapi
 * @covers openapi
 *
 * Usage (Tool `openapi-ingest-source`, bean `folio-assistant-7jkp`):
 *   bun run cat-harness-tools/openapi/scripts/ingest-openapi.ts --instance <instance-dir> --source <checkout> [--ref <ref>]
 *   bun run cat-harness-tools/openapi/scripts/ingest-openapi.ts --instance <instance-dir> --check
 *
 * `--ref` reads each document AT that branch, tag or commit (`git show`), so
 * the checkout's working tree need not be on it; without it the checkout's
 * `HEAD` is read, as before. The published-URL counterpart is
 * `ingest-openapi-rendered.ts` (Tool `openapi-ingest-rendered`).
 *
 * `--source` is a local checkout of the document's repository (one config may
 * name several documents from one repository; documents from different
 * repositories take one run each, with `--only <id>`). The commit recorded is
 * the checkout's `HEAD`, so the provenance names the bytes actually read.
 *
 * ## `--check` needs no source, and that is the point
 *
 * It verifies what is COMMITTED: every configured document is present, parses
 * as OpenAPI 3, and matches its provenance's hash, size, title, version and
 * operation count — and no document is held that the config does not name.
 * Whether upstream has moved since is a different question, answered by
 * re-running the ingest against a fresh checkout; a gate that needed the
 * network to pass would report "could not determine" on every CI run.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, posix, relative, resolve } from "node:path";
import {
  OPENAPI_SOURCE_SCHEMA_TAG,
  OpenApiConfigSchema,
  OpenApiDocumentSchema,
  OpenApiProvenanceSchema,
  OpenApiRenderedProvenanceSchema,
  operationsOf,
  type OpenApiConfig,
  type OpenApiProvenance,
  type OpenApiRenderedProvenance,
} from "../schemas/openapi.ts";
import { findDeclarationFile } from "../../schemas/kg/cat-harness.ts";

export const CONFIG_FILE = "cat-openapi.config.json";

/**
 * Where the layer's config is: at its root, or — where a fork keeps it with
 * the documents it names — inside a directory the layer declares with graph
 * typology `openapi`. The root wins; `undefined` when neither holds one. The
 * file keeps its `cat-openapi.config.json` name after the harness folded into
 * cat-harness as the `openapi` subgraph (owner, 2026-10-07).
 */
export function configPath(instanceRoot: string): string | undefined {
  const atRoot = join(instanceRoot, CONFIG_FILE);
  if (existsSync(atRoot)) return atRoot;
  const found = findDeclarationFile(instanceRoot);
  if (found === undefined) return undefined;
  let d: { directories?: Array<{ path?: string; graphTypologies?: string[] }> };
  try {
    d = JSON.parse(readFileSync(join(instanceRoot, found), "utf8"));
  } catch {
    return undefined;
  }
  for (const e of d.directories ?? []) {
    if (!e.path || !e.graphTypologies?.includes("openapi")) continue;
    const p = join(instanceRoot, e.path, CONFIG_FILE);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** The layer's config, parsed. Throws naming the file when it is absent or invalid. */
export function readConfig(instanceRoot: string): OpenApiConfig {
  const p = configPath(instanceRoot) ?? join(instanceRoot, CONFIG_FILE);
  if (!existsSync(p)) throw new Error(`${p}: no ${CONFIG_FILE} — this instance does not instantiate cat-harness's openapi subgraph`);
  const r = OpenApiConfigSchema.safeParse(JSON.parse(readFileSync(p, "utf8")));
  if (!r.success) throw new Error(`${p}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

/**
 * The directory the config names, resolved through the layer's own
 * declaration — never a path written in the config, so moving the directory
 * is one edit to `<instance>.json` and nothing else.
 */
export function openapiDir(instanceRoot: string, config: OpenApiConfig): string {
  // The declaration is FOUND, never composed from the directory name: in an IG
  // fork the layer lives under the base IG's checkout name and declares
  // itself by its own (n3ni stage E), so `<dirname>.json` names a file that is not there.
  const found = findDeclarationFile(instanceRoot);
  if (found === undefined) throw new Error(`no instance declaration in ${resolve(instanceRoot)}`);
  const decl = join(instanceRoot, found);
  const d = JSON.parse(readFileSync(decl, "utf8")) as { directories?: Array<{ id: string; path: string; graphTypologies?: string[] }> };
  const entry = d.directories?.find((x) => x.id === config.directory);
  if (!entry) throw new Error(`${decl}: no directory with id "${config.directory}" (named by ${CONFIG_FILE})`);
  if (!entry.graphTypologies?.includes("openapi")) throw new Error(`${decl}: directory "${config.directory}" is not of graph typology "openapi"`);
  return join(instanceRoot, entry.path);
}

const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** The openapi directory, instance-relative and in POSIX form — what a materialization's `localPath` is relative to. */
export const localDirOf = (instanceRoot: string, dir: string): string => relative(instanceRoot, dir).split("\\").join("/");

/**
 * The provenance a document's bytes yield. `source.commit` is the caller's;
 * `localDir` is the openapi directory, instance-relative (`openapi/`).
 *
 * The materialization gates are stated, never defaulted to `permitted`: a
 * `working` copy may not claim `sourceLoss` permitted (the schema refuses
 * it), and nobody has read the API's licence, so `copyright` is `unknown`
 * with that said — the same answers the IG ingest gives its sidecars.
 */
export function provenanceFor(id: string, bytes: Buffer, source: OpenApiProvenance["source"], localDir: string): OpenApiProvenance {
  const doc = OpenApiDocumentSchema.parse(JSON.parse(bytes.toString("utf8")));
  const file = `${id}.openapi.json`;
  const upstream = `https://github.com/${source.repository}/blob/${source.commit}/${source.path}`;
  return OpenApiProvenanceSchema.parse({
    $schema: OPENAPI_SOURCE_SCHEMA_TAG,
    id,
    file,
    source,
    bytes: bytes.length,
    openapi: doc.openapi,
    title: doc.info.title,
    version: doc.info.version,
    operations: operationsOf(doc).length,
    materialization: {
      $schema: "folio-materialization/v1",
      state: "materialized",
      provenance: { upstream },
      localPath: posix.join(localDir, file),
      bytes: bytes.length,
      purpose: "working",
      fixity: { algorithm: "sha256", digest: sha256(bytes) },
      upstreamVersion: source.commit,
      gates: {
        size: { verdict: "permitted", basis: `One OpenAPI document of ${bytes.length.toLocaleString("en")} bytes.` },
        restrictions: { verdict: "permitted", basis: `Read from the public repository ${source.repository}; no access control on the source.` },
        retention: { verdict: "permitted", basis: "Working copy, regenerable by re-running the ingest against the recorded commit." },
        sourceLoss: { verdict: "unknown", basis: "Not established. The source is a git commit, which persists while the repository does; nobody has stated how long that is." },
        copyright: { verdict: "unknown", basis: "Not established. The API description's licence has not been read for this ingest." },
      },
    },
  });
}

/**
 * The provenance of a document read from a published URL (Tool
 * `openapi-ingest-rendered`). Same gates as {@link provenanceFor}, said for a
 * URL: there is no commit, so what pins the bytes is the digest, and the
 * upstream may change or vanish without notice.
 */
export function provenanceForRendered(
  id: string,
  bytes: Buffer,
  source: OpenApiRenderedProvenance["source"],
  localDir: string,
): OpenApiRenderedProvenance {
  const doc = OpenApiDocumentSchema.parse(JSON.parse(bytes.toString("utf8")));
  const file = `${id}.openapi.json`;
  return OpenApiRenderedProvenanceSchema.parse({
    $schema: OPENAPI_SOURCE_SCHEMA_TAG,
    id,
    file,
    source,
    bytes: bytes.length,
    openapi: doc.openapi,
    title: doc.info.title,
    version: doc.info.version,
    operations: operationsOf(doc).length,
    materialization: {
      $schema: "folio-materialization/v1",
      state: "materialized",
      provenance: { upstream: source.url },
      localPath: posix.join(localDir, file),
      bytes: bytes.length,
      purpose: "working",
      fixity: { algorithm: "sha256", digest: sha256(bytes) },
      upstreamVersion: doc.info.version,
      gates: {
        size: { verdict: "permitted", basis: `One OpenAPI document of ${bytes.length.toLocaleString("en")} bytes.` },
        restrictions: { verdict: "permitted", basis: `Fetched from the public URL ${source.url}; no access control on the source.` },
        retention: { verdict: "permitted", basis: "Working copy; re-fetching the URL regenerates it only while the publisher serves the same bytes — the digest says whether it does." },
        sourceLoss: { verdict: "unknown", basis: "Not established. A published URL has no commit; the publisher may change or remove it without notice." },
        copyright: { verdict: "unknown", basis: "Not established. The API description's licence has not been read for this ingest." },
      },
    },
  });
}

/** Read each repository document at `ref` (or the checkout's HEAD) and write it with its provenance. */
export function ingestFromSource(
  root: string,
  sourceCheckout: string,
  opts: { ref?: string; only?: string } = {},
): OpenApiProvenance[] {
  const config = readConfig(root);
  const dir = openapiDir(root, config);
  mkdirSync(dir, { recursive: true });
  const commit = execFileSync("git", ["-C", sourceCheckout, "rev-parse", `${opts.ref ?? "HEAD"}^{commit}`], { encoding: "utf8" }).trim();
  const out: OpenApiProvenance[] = [];
  for (const d of config.documents) {
    if (opts.only && d.id !== opts.only) continue;
    const bytes =
      opts.ref === undefined
        ? readFileSync(join(sourceCheckout, d.source.path))
        : execFileSync("git", ["-C", sourceCheckout, "show", `${commit}:${d.source.path}`], { maxBuffer: 1 << 28 });
    const prov = provenanceFor(d.id, bytes, { ...d.source, commit }, localDirOf(root, dir));
    writeFileSync(join(dir, prov.file), bytes);
    writeFileSync(join(dir, `${d.id}.source.json`), `${JSON.stringify(prov, null, 2)}\n`);
    out.push(prov);
  }
  return out;
}

/** Problems with what is committed; empty means it is consistent. */
export function checkCommitted(instanceRoot: string): string[] {
  const config = readConfig(instanceRoot);
  const dir = openapiDir(instanceRoot, config);
  const problems: string[] = [];
  const wanted = new Set<string>();
  for (const d of config.documents) {
    const file = join(dir, `${d.id}.openapi.json`);
    const prov = join(dir, `${d.id}.source.json`);
    wanted.add(basename(file)).add(basename(prov));
    if (!existsSync(file) || !existsSync(prov)) {
      problems.push(`${d.id}: not ingested — run the ingest with --source`);
      continue;
    }
    const recorded = OpenApiProvenanceSchema.safeParse(JSON.parse(readFileSync(prov, "utf8")));
    if (!recorded.success) {
      problems.push(`${prov}: ${recorded.error.issues[0]?.message}`);
      continue;
    }
    let actual: OpenApiProvenance;
    try {
      actual = provenanceFor(d.id, readFileSync(file), recorded.data.source, localDirOf(instanceRoot, dir));
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(recorded.data)) problems.push(`${d.id}: the committed document does not match its provenance (${prov})`);
    const { repository, path } = recorded.data.source;
    if (repository !== d.source.repository || path !== d.source.path) problems.push(`${d.id}: provenance names ${repository}:${path}, the config ${d.source.repository}:${d.source.path}`);
  }
  for (const d of config.rendered) {
    const file = join(dir, `${d.id}.openapi.json`);
    const prov = join(dir, `${d.id}.source.json`);
    wanted.add(basename(file)).add(basename(prov));
    if (!existsSync(file) || !existsSync(prov)) {
      problems.push(`${d.id}: not ingested — run ingest-openapi-rendered.ts`);
      continue;
    }
    const recorded = OpenApiRenderedProvenanceSchema.safeParse(JSON.parse(readFileSync(prov, "utf8")));
    if (!recorded.success) {
      problems.push(`${prov}: ${recorded.error.issues[0]?.message}`);
      continue;
    }
    let actual: OpenApiRenderedProvenance;
    try {
      actual = provenanceForRendered(d.id, readFileSync(file), recorded.data.source, localDirOf(instanceRoot, dir));
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(recorded.data)) problems.push(`${d.id}: the committed document does not match its provenance (${prov})`);
    if (recorded.data.source.url !== d.rendered.url) problems.push(`${d.id}: provenance names ${recorded.data.source.url}, the config ${d.rendered.url}`);
  }
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (/\.(openapi|source)\.json$/.test(f) && !wanted.has(f)) problems.push(`${join(dir, f)}: held, but ${CONFIG_FILE} names no such document`);
  }
  return problems;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  if (!instance) {
    console.error("usage: ingest-openapi.ts --instance <dir> (--source <checkout> [--ref <ref>] [--only <id>] | --check)");
    process.exit(2);
  }
  const root = resolve(instance);
  if (process.argv.includes("--check")) {
    const problems = checkCommitted(root);
    for (const p of problems) console.error(`✗ ${p}`);
    if (problems.length) process.exit(1);
    console.log(`✓ ${instance}: every OpenAPI document the config names is held and matches its provenance`);
    process.exit(0);
  }
  const source = arg("source");
  if (!source) {
    console.error("--source <checkout> is required to ingest (or pass --check)");
    process.exit(2);
  }
  for (const prov of ingestFromSource(root, source, { ref: arg("ref"), only: arg("only") })) {
    console.log(`${prov.id}: ${prov.title} ${prov.version} — ${prov.operations} operations, ${prov.bytes} bytes from ${prov.source.repository}@${prov.source.commit.slice(0, 7)}`);
  }
}
