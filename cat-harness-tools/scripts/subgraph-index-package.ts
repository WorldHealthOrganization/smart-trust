#!/usr/bin/env bun
/**
 * The subgraph index PACKAGE: one pin's `index.jsonld` and
 * `index.hydrated.jsonld` files, packed (publish half) and fetched and
 * verified (fetch half).
 *
 * @module scripts/subgraph-index-package
 * @graphNode none — a tool script implementing the `subgraph-index-package` Tool (pack) and the package half of `remote-mount` (fetch)
 *
 * ## Why a package
 *
 * The subgraph index files are `builtAtPublish` — computed over the
 * checkout's other layers — so no commit carries them, and a hydrated
 * mount reading the git tree at a pin finds nothing. So they are published
 * per pin in a package, and a hydrated mount fetches them through the Tool
 * its source names. The contract, every name included, is
 * `subgraphIndexPackage` in
 * `@litlfred/cat-harness/schemas/kg/subgraph-manifest.ts`.
 *
 * ## Reuse
 *
 * - Packing is `pack-tarball` (`bun pm pack`, the `folio-binary-release/v1`
 *   record) over a staged directory holding only the files and the manifest.
 * - Verifying and unpacking a fetched tarball is `kg-retrieve-npm`
 *   (`retrieveNpmKg` with `release`: size and sha256 against the record).
 * - Downloading is `mount-from-lock`'s `download`, so the lock replay and the
 *   planner fetch the same way, through the same `CAT_MOUNT_URL_PREFIX`.
 *
 * ## What a fetched package must prove
 *
 * 1. Its record is a `folio-binary-release/v1` naming the tarball with a
 *    digest, and the tarball matches it (size and sha256).
 * 2. Its manifest is `folio-subgraph-index/v1` for exactly the repository, pin
 *    and harness asked for.
 * 3. Every file it lists is there and hashes to its entry.
 *
 * Then the caller holds each `index.hydrated.jsonld` to the same checks a file
 * from the git tree gets (`hydratedProblem` in `remote-mount.ts`: the schema,
 * and that its `@id` is the subgraph asked for). The record travels with the
 * tarball, so (1) proves the transfer, not the publisher: who may publish is
 * the repository's write access, as for the tree a mount already trusts.
 *
 * Usage:
 *   bun run cat subgraph-index:pack -- --root <instance> --repository <owner/name> --ref <sha> --out-dir <dir> [--built-in <owner/name>@<ref>]
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { BinaryReleaseSchema } from "../schemas/sdlc/binary-release.js";
import { readDeclaration } from "../schemas/kg/cat-harness.js";
import {
  SUBGRAPH_HYDRATED_FILE,
  SUBGRAPH_INDEX_FILE,
  SUBGRAPH_INDEX_MANIFEST_FILE,
  SUBGRAPH_INDEX_PACKAGE_SCHEMA_TAG,
  SubgraphIndexManifestSchema,
  subgraphIndexPackage,
  type SubgraphIndexFile,
  type SubgraphIndexManifest,
  type SubgraphIndexPackageRef,
} from "../schemas/kg/subgraph-manifest.js";
import { retrieveNpmKg } from "./kg-retrieve-npm.ts";
import { download, packageFetchUrl } from "./mount-from-lock.ts";
import { packTarball } from "./pack-tarball.ts";

const sha256 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const strip = (p: string): string => p.replace(/^\.\//, "").replace(/\/+$/, "");

// ── pack ─────────────────────────────────────────────────────────────────────

export interface PackSubgraphIndexOptions {
  /** The layer root whose `<docs>/subgraph/<name>/` is packed. */
  root: string;
  repository: string;
  /** The pin the files were built from. */
  ref: string;
  /** Where the tarball and its release record go. */
  outDir: string;
  /** The checkout the files were built in, as provenance. */
  builtIn?: { repository: string; ref: string };
}

export interface PackSubgraphIndexResult {
  pkg: SubgraphIndexPackageRef;
  manifest: SubgraphIndexManifest;
  tarball: string;
  release: string;
  sha256: string;
  bytes: number;
}

/** Every index file under `<docs>/subgraph/<harness>/`, as manifest entries. */
export function collectIndexFiles(root: string, docs: string, harness: string): SubgraphIndexFile[] {
  const base = join(docs, "subgraph", harness);
  const abs = join(root, base);
  const out: SubgraphIndexFile[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && (e.name === SUBGRAPH_INDEX_FILE || e.name === SUBGRAPH_HYDRATED_FILE)) {
        const bytes = readFileSync(p);
        out.push({
          path: relative(root, p).split("\\").join("/"),
          subgraph: relative(abs, dir).split("\\").join("/"),
          file: e.name,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  };
  if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Pack one pin's subgraph index files. Throws — never packs an empty
 * package — when the layer declares no `docs` directory or has built no
 * subgraph files there.
 */
export function packSubgraphIndex(opts: PackSubgraphIndexOptions): PackSubgraphIndexResult {
  const root = resolve(opts.root);
  const decl = readDeclaration(root);
  if (!decl) throw new Error(`no instance declaration under ${root}`);
  const docsDir = decl.directories.find((d) => d.id === "docs");
  if (!docsDir) throw new Error(`\`${decl.name}\` declares no \`docs\` directory, so it publishes no subgraph files`);
  const docs = strip(docsDir.path);
  const pkg = subgraphIndexPackage(opts.repository, opts.ref, decl.name);
  const files = collectIndexFiles(root, docs, decl.name);
  if (files.length === 0) {
    throw new Error(`no ${SUBGRAPH_INDEX_FILE} or ${SUBGRAPH_HYDRATED_FILE} under \`${docs}/subgraph/${decl.name}/\` — build them first (\`bun run cat subgraph:jsonld\`); an empty package would pass for a pin with no subgraphs`);
  }
  const manifest = SubgraphIndexManifestSchema.parse({
    $schema: SUBGRAPH_INDEX_PACKAGE_SCHEMA_TAG,
    repository: opts.repository,
    ref: opts.ref,
    harness: decl.name,
    docs,
    ...(opts.builtIn ? { builtIn: opts.builtIn } : {}),
    files,
  });

  const stage = mkdtempSync(join(tmpdir(), "subgraph-index-pack-"));
  try {
    for (const f of files) {
      mkdirSync(join(stage, f.path, ".."), { recursive: true });
      cpSync(join(root, f.path), join(stage, f.path));
    }
    writeFileSync(join(stage, SUBGRAPH_INDEX_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(
      join(stage, "package.json"),
      `${JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          description: `The subgraph index files (${SUBGRAPH_INDEX_FILE}, ${SUBGRAPH_HYDRATED_FILE}) of ${decl.name} at ${opts.repository}@${opts.ref} — metadata for a hydrated mount (bean mo75).`,
          repository: `https://github.com/${opts.repository}`,
          files: [`${docs}/`, SUBGRAPH_INDEX_MANIFEST_FILE],
        },
        null,
        2,
      )}\n`,
    );
    mkdirSync(resolve(opts.outDir), { recursive: true });
    const packed = packTarball({ root: stage, destination: resolve(opts.outDir), repository: opts.repository, releaseUrl: pkg.tarballUrl, tag: pkg.tag });
    if (packed.tarballName !== pkg.tarball) {
      throw new Error(`bun pm pack wrote \`${packed.tarballName}\`, not \`${pkg.tarball}\`: a consumer computes the name and would not find it`);
    }
    return { pkg, manifest, tarball: packed.tarballPath, release: packed.releasePath!, sha256: packed.sha256, bytes: packed.bytes };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

// ── fetch ────────────────────────────────────────────────────────────────────

/** A verified, unpacked package. The caller calls `close()`. */
export interface FetchedSubgraphIndex {
  state: "ok";
  pkg: SubgraphIndexPackageRef;
  manifest: SubgraphIndexManifest;
  /** The tarball's sha256, for the lock. */
  sha256: string;
  /** The unpacked package root; every manifest path is relative to it. */
  root: string;
  /** Subgraph path → the manifest entry of its `index.hydrated.jsonld`. */
  hydrated: Map<string, SubgraphIndexFile>;
  close(): void;
}

/**
 * - `absent`: nothing is published for this pin (a 404) — read as "not
 *   published", like a tree that holds no file;
 * - `refused`: something is published and it is not what was asked for, or
 *   does not verify;
 * - `could-not-determine`: the fetch itself failed. Never an absence.
 */
export type SubgraphIndexFetch = FetchedSubgraphIndex | { state: "absent" | "refused" | "could-not-determine"; pkg: SubgraphIndexPackageRef; detail: string };

/** How a canonical release-asset URL is fetched. Tests map it to `file://`. */
export type PackageUrlFor = (url: string) => string;

/** Fetch and verify the subgraph index package `harness` publishes at `ref` (see the module header). */
export function fetchSubgraphIndex(a: { repository: string; ref: string; harness: string; urlFor?: PackageUrlFor }): SubgraphIndexFetch {
  const pkg = subgraphIndexPackage(a.repository, a.ref, a.harness);
  const urlFor = a.urlFor ?? packageFetchUrl;
  const dir = mkdtempSync(join(tmpdir(), "subgraph-index-fetch-"));
  const fail = (state: "absent" | "refused" | "could-not-determine", detail: string): SubgraphIndexFetch => {
    rmSync(dir, { recursive: true, force: true });
    return { state, pkg, detail };
  };
  const recordPath = join(dir, pkg.record);
  const r = download(urlFor(pkg.recordUrl), recordPath);
  if (!r.ok) return fail(r.absent ? "absent" : "could-not-determine", `${pkg.recordUrl}: ${r.error}`);
  let record;
  try {
    record = BinaryReleaseSchema.parse(JSON.parse(readFileSync(recordPath, "utf-8")));
  } catch (e) {
    return fail("refused", `${pkg.record} is not a folio-binary-release/v1 record: ${(e as Error).message.split("\n")[0]}`);
  }
  const asset = record.assets.find((x) => x.name === pkg.tarball);
  if (!asset?.digest) return fail("refused", `${pkg.record} records no digest for \`${pkg.tarball}\`, so the tarball could not be verified`);
  const tgz = join(dir, pkg.tarball);
  const t = download(urlFor(pkg.tarballUrl), tgz);
  if (!t.ok) return fail("could-not-determine", `${pkg.tarballUrl}: ${t.error} (its record is published)`);

  const unpacked = join(dir, "package");
  try {
    retrieveNpmKg({ pkg: tgz, release: recordPath, destination: unpacked, view: "hydrated" });
  } catch (e) {
    return fail("refused", (e as Error).message);
  }
  const manifestPath = join(unpacked, SUBGRAPH_INDEX_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return fail("refused", `${pkg.tarball} holds no ${SUBGRAPH_INDEX_MANIFEST_FILE}`);
  const parsed = (() => {
    try {
      return SubgraphIndexManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf-8")));
    } catch (e) {
      return { success: false as const, error: { issues: [{ path: [], message: (e as Error).message }] } };
    }
  })();
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail("refused", `${SUBGRAPH_INDEX_MANIFEST_FILE} is not a ${SUBGRAPH_INDEX_PACKAGE_SCHEMA_TAG} manifest: ${i?.path.join(".") || "(root)"}: ${i?.message}`);
  }
  const manifest = parsed.data;
  const want = { repository: a.repository, ref: a.ref, harness: a.harness };
  for (const k of ["repository", "ref", "harness"] as const) {
    if (manifest[k] !== want[k]) return fail("refused", `${SUBGRAPH_INDEX_MANIFEST_FILE} is for ${k} \`${manifest[k]}\`, not \`${want[k]}\` — the package is not this pin's`);
  }
  const hydrated = new Map<string, SubgraphIndexFile>();
  for (const f of manifest.files) {
    const abs = join(unpacked, ...f.path.split("/"));
    if (!existsSync(abs)) return fail("refused", `\`${f.path}\` is listed in ${SUBGRAPH_INDEX_MANIFEST_FILE} and is not in the package`);
    const bytes = readFileSync(abs);
    if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256) return fail("refused", `\`${f.path}\` does not hash to its ${SUBGRAPH_INDEX_MANIFEST_FILE} entry`);
    if (f.file === SUBGRAPH_HYDRATED_FILE) hydrated.set(f.subgraph, f);
  }
  return {
    state: "ok",
    pkg,
    manifest,
    sha256: asset.digest.digest,
    root: unpacked,
    hydrated,
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = arg("--root");
  const repository = arg("--repository");
  const ref = arg("--ref");
  const outDir = arg("--out-dir");
  const builtInArg = arg("--built-in");
  if (!root || !repository || !ref || !outDir) {
    console.error("usage: subgraph-index-package --root <instance> --repository <owner/name> --ref <40-char sha> --out-dir <dir> [--built-in <owner/name>@<ref>]");
    process.exit(2);
  }
  let builtIn: { repository: string; ref: string } | undefined;
  if (builtInArg) {
    const m = /^([^@]+)@(.+)$/.exec(builtInArg);
    if (!m) {
      console.error(`--built-in \`${builtInArg}\` is not <owner/name>@<ref>`);
      process.exit(2);
    }
    builtIn = { repository: m[1]!, ref: m[2]! };
  }
  try {
    const r = packSubgraphIndex({ root, repository, ref, outDir, builtIn });
    console.log(
      JSON.stringify(
        { tag: r.pkg.tag, tarball: r.tarball, release: r.release, sha256: r.sha256, bytes: r.bytes, files: r.manifest.files.length, hydrated: r.manifest.files.filter((f) => f.file === SUBGRAPH_HYDRATED_FILE).map((f) => f.subgraph) },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(`subgraph-index-package: ${(e as Error).message}`);
    process.exit(1);
  }
}
