#!/usr/bin/env bun
/**
 * pack-tarball — build an npm .tgz tarball of a layer using `bun pm pack`,
 * compute its size and SHA-256 digest, and emit a `folio-binary-release/v1` state node
 * conforming to `schemas/sdlc/binary-release.ts` (BinaryReleaseSchema).
 *
 * @module scripts/pack-tarball
 * @graphNode none — a tool script implementing the `pack-tarball` Tool
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  BINARY_RELEASE_SCHEMA_TAG,
  BinaryReleaseSchema,
  type BinaryRelease,
} from "../schemas/sdlc/binary-release.js";
import { readDeclaration } from "../schemas/kg/cat-harness.js";

// declared-path-literal: the pack-time exclusions for the binary assets a
// PACKAGED layer may hold, written into that package's ignore list. They
// name the conventional `library/` and `uploads/` trees of whatever layer
// is packed, not a directory of this checkout, so no declaration here
// answers them.
export const BINARY_ASSET_IGNORE_PATTERNS = [
  "library/**/*.png",
  "library/**/*.jpg",
  "library/**/*.jpeg",
  "library/**/*.webp",
  "library/**/*.pdf",
  "uploads/**/*.png",
  "uploads/**/*.jpg",
  "uploads/**/*.jpeg",
  "uploads/**/*.webp",
  "uploads/**/*.pdf",
];

export interface PackTarballOptions {
  /** Target directory containing package.json (default: process.cwd()). */
  root?: string;
  /** Directory to place the resulting tarball (default: root). */
  destination?: string;
  /** Output file for the folio-binary-release/v1 JSON record. */
  out?: string;
  /** Target repository full name (e.g. 'litlfred/cat-harness'). */
  repository?: string;
  /** Public release URL or base URL for fetchedFrom. */
  releaseUrl?: string;
  /**
   * The release's git tag. Default `v<version>`; a per-pin package
   * (`subgraph-index-package`, bean `mo75` G2b) is released under its own.
   */
  tag?: string;
  /**
   * Whether to build the hydrated package (including binary media assets).
   * When false (default), binary assets in library/ and uploads/ are excluded
   * to produce a lean unhydrated source Knowledge Graph package.
   */
  hydrated?: boolean;
  /** Print JSON output to stdout. */
  json?: boolean;
}

export interface PackResult {
  tarballPath: string;
  tarballName: string;
  bytes: number;
  sha256: string;
  releaseRecord: BinaryRelease;
  releasePath?: string;
}

export function packTarball(opts: PackTarballOptions = {}): PackResult {
  const root = resolve(opts.root ?? process.cwd());
  const pkgJsonPath = join(root, "package.json");
  if (!existsSync(pkgJsonPath)) {
    throw new Error(`No package.json found at ${pkgJsonPath}`);
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
    name?: string;
    version?: string;
    repository?: string | { url?: string };
  };

  const name = pkg.name;
  const version = pkg.version;
  if (!name || !version) {
    throw new Error(`package.json at ${pkgJsonPath} must declare 'name' and 'version'`);
  }

  const destination = resolve(opts.destination ?? root);
  mkdirSync(destination, { recursive: true });

  // Record existing .tgz files in destination before pack to detect the new tarball
  const beforeFiles = new Set(
    existsSync(destination) ? readdirSync(destination).filter((f) => f.endsWith(".tgz")) : []
  );

  // Manage .npmignore to exclude binary assets from unhydrated package
  const npmignorePath = join(root, ".npmignore");
  const npmignoreBackup = join(root, ".npmignore.unhydrated-tmp-bak");
  let modifiedNpmignore = false;
  let hadBackup = false;

  let tarballName: string;
  try {
    if (opts.hydrated) {
      // Hydrated package: ensure binary assets are NOT ignored
      if (existsSync(npmignorePath)) {
        copyFileSync(npmignorePath, npmignoreBackup);
        hadBackup = true;
        const current = readFileSync(npmignorePath, "utf-8");
        const filtered = current
          .split("\n")
          .filter((line) => !BINARY_ASSET_IGNORE_PATTERNS.some((pat) => line.trim() === pat))
          .join("\n");
        writeFileSync(npmignorePath, filtered);
        modifiedNpmignore = true;
      }
    } else {
      // Unhydrated package: ensure binary assets ARE ignored
      const current = existsSync(npmignorePath) ? readFileSync(npmignorePath, "utf-8") : "";
      const missing = BINARY_ASSET_IGNORE_PATTERNS.filter((pat) => !current.includes(pat));
      if (missing.length > 0) {
        if (existsSync(npmignorePath)) {
          copyFileSync(npmignorePath, npmignoreBackup);
          hadBackup = true;
        }
        const appended =
          current +
          (current.endsWith("\n") || current.length === 0 ? "" : "\n") +
          "# Binary media assets (belong only in hydrated package)\n" +
          missing.join("\n") +
          "\n";
        writeFileSync(npmignorePath, appended);
        modifiedNpmignore = true;
      }
    }

    // Run `bun pm pack --destination <dest>`
    const proc = spawnSync("bun", ["pm", "pack", "--destination", destination], {
      cwd: root,
      encoding: "utf-8",
    });

    if (proc.status !== 0) {
      throw new Error(`bun pm pack failed: ${proc.stderr || proc.stdout || proc.status}`);
    }

    // Find the created tarball in destination
    const afterFiles = readdirSync(destination).filter((f) => f.endsWith(".tgz"));
    const newFiles = afterFiles.filter((f) => !beforeFiles.has(f));

    if (newFiles.length === 1) {
      tarballName = newFiles[0]!;
    } else {
      // Expected tarball filename pattern in bun/npm:
      // e.g. "package-1.0.0.tgz" or "@scope/package" -> "scope-package-1.0.0.tgz"
      const normalizedName = name.replace(/^@/, "").replace("/", "-");
      const expected = `${normalizedName}-${version}.tgz`;
      if (afterFiles.includes(expected)) {
        tarballName = expected;
      } else {
        const candidate = afterFiles.find((f) => f.includes(version));
        if (!candidate) {
          throw new Error(`Could not identify created tarball in ${destination}. Files: ${afterFiles.join(", ")}`);
        }
        tarballName = candidate;
      }
    }

    // If hydrated package, rename tarball to <name>-<version>.hydrated.tgz
    if (opts.hydrated) {
      const hydratedName = tarballName.replace(/\.tgz$/, ".hydrated.tgz");
      const origTarballPath = join(destination, tarballName);
      const hydratedTarballPath = join(destination, hydratedName);
      renameSync(origTarballPath, hydratedTarballPath);
      tarballName = hydratedName;
    }
  } finally {
    if (modifiedNpmignore) {
      if (hadBackup && existsSync(npmignoreBackup)) {
        renameSync(npmignoreBackup, npmignorePath);
      } else {
        try {
          unlinkSync(npmignorePath);
        } catch {}
      }
    }
  }

  const tarballPath = join(destination, tarballName);
  const fileBytes = readFileSync(tarballPath);
  const bytes = statSync(tarballPath).size;
  const sha256Hex = createHash("sha256").update(fileBytes).digest("hex");

  // Determine repository
  let repository = opts.repository;
  if (!repository) {
    const decl = readDeclaration(root);
    if (decl?.repository) {
      repository = decl.repository;
    } else if (typeof pkg.repository === "string") {
      const m = /github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(pkg.repository);
      repository = m ? m[1] : pkg.repository;
    } else if (typeof pkg.repository?.url === "string") {
      const m = /github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(pkg.repository.url);
      repository = m ? m[1] : pkg.repository.url;
    } else {
      repository = "local/unspecified";
    }
  }

  // Determine fetchedFrom URL
  const tag = opts.tag ?? `v${version}`;
  const fetchedFrom = opts.releaseUrl
    ? (opts.releaseUrl.endsWith(".tgz") ? opts.releaseUrl : `${opts.releaseUrl.replace(/\/+$/, "")}/${tarballName}`)
    : repository.includes("/")
    ? `https://github.com/${repository}/releases/download/${tag}/${tarballName}`
    : `https://registry.npmjs.org/${name}/-/${tarballName}`;

  const releaseId = opts.hydrated
    ? `${name.replace(/^@/, "").replace("/", "-")}-v${version}-hydrated`
    : `${name.replace(/^@/, "").replace("/", "-")}-v${version}`;
  const now = new Date().toISOString();

  const releaseRecord: BinaryRelease = {
    $schema: BINARY_RELEASE_SCHEMA_TAG,
    release: {
      id: releaseId,
      version,
      tag,
      publishedAt: now,
      url: repository.includes("/") ? `https://github.com/${repository}/releases/tag/${tag}` : undefined,
    },
    origin: {
      kind: "github-release",
      repository,
    },
    assets: [
      {
        name: tarballName,
        bytes,
        digest: {
          algorithm: "sha256",
          digest: sha256Hex,
          verifiedAt: now,
        },
        fetchedFrom,
        contentType: "application/gzip",
        disposition: "published",
      },
    ],
  };

  // Validate against schema
  BinaryReleaseSchema.parse(releaseRecord);

  let releasePath: string | undefined;
  if (opts.out) {
    releasePath = resolve(opts.out);
  } else {
    releasePath = join(destination, `${tarballName}.release.json`);
  }
  mkdirSync(dirname(releasePath), { recursive: true });
  writeFileSync(releasePath, JSON.stringify(releaseRecord, null, 2) + "\n");

  return {
    tarballPath,
    tarballName,
    bytes,
    sha256: sha256Hex,
    releaseRecord,
    releasePath,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const rootIndex = argv.indexOf("--root");
  const destIndex = argv.indexOf("--destination");
  const outIndex = argv.indexOf("--out");
  const repoIndex = argv.indexOf("--repository");
  const urlIndex = argv.indexOf("--release-url");
  const hydrated = argv.includes("--hydrated");
  const json = argv.includes("--json");

  const root = rootIndex >= 0 && argv[rootIndex + 1] ? argv[rootIndex + 1] : process.cwd();
  const destination = destIndex >= 0 && argv[destIndex + 1] ? argv[destIndex + 1] : undefined;
  const out = outIndex >= 0 && argv[outIndex + 1] ? argv[outIndex + 1] : undefined;
  const repository = repoIndex >= 0 && argv[repoIndex + 1] ? argv[repoIndex + 1] : undefined;
  const releaseUrl = urlIndex >= 0 && argv[urlIndex + 1] ? argv[urlIndex + 1] : undefined;

  try {
    const res = packTarball({ root, destination, out, repository, releaseUrl, hydrated, json });
    if (json) {
      console.log(JSON.stringify(res.releaseRecord, null, 2));
    } else {
      console.log(`Packed:  ${res.tarballPath} (${res.bytes} bytes, sha256: ${res.sha256.slice(0, 16)}...)`);
      if (res.releasePath) {
        console.log(`Release: ${res.releasePath}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(`pack-tarball error: ${(e as Error).message}`);
    process.exit(1);
  }
}
