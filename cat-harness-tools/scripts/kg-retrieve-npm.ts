#!/usr/bin/env bun
/**
 * kg-retrieve-npm — retrieve and inspect a remote Knowledge Graph packaged as an npm package or tarball.
 *
 * @module scripts/kg-retrieve-npm
 * @graphNode none — a tool script implementing the `kg-retrieve-npm` Tool
 *
 * Supports both:
 * - Unhydrated source graph view: authored declarations (<name>.json), package.json,
 *   skills/, schemas/, processes/, and source documents.
 * - Hydrated materialized graph view: published subgraph JSON-LD (index.jsonld,
 *   index.hydrated.jsonld), metadata indexes, and materialized graph projections.
 *
 * Optionally verifies package integrity against a `folio-binary-release/v1` document.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import { BinaryReleaseSchema } from "../schemas/sdlc/binary-release.js";

export type GraphViewMode = "unhydrated" | "hydrated" | "both";

export interface RetrieveNpmOptions {
  /** Package name, tarball (.tgz) file path, or package specifier. */
  pkg: string;
  /** Directory to unpack or extract into (defaults to a managed temporary directory or cwd). */
  destination?: string;
  /** Which graph view to inspect/retrieve: unhydrated, hydrated, or both (default: 'both'). */
  view?: GraphViewMode;
  /** Path to a folio-binary-release/v1 JSON document to verify against. */
  release?: string;
  /** Whether to invoke `bun add` / `npm install` if a package name is given. */
  install?: boolean;
  /** Print JSON output. */
  json?: boolean;
}

export interface GraphViewSummary {
  view: GraphViewMode;
  instanceDeclarations: string[];
  manifest?: { name?: string; version?: string; packageManifest?: boolean };
  sourceDirectories: string[];
  hydratedFiles: string[];
  skillsCount: number;
  schemasCount: number;
  processesCount: number;
}

export interface RetrievalResult {
  source: string;
  destination: string;
  verifiedAgainstRelease: boolean;
  viewSummary: GraphViewSummary;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(dir);
  return files.sort();
}

export function retrieveNpmKg(opts: RetrieveNpmOptions): RetrievalResult {
  const input = opts.pkg;
  const viewMode: GraphViewMode = opts.view ?? "both";
  const destination = resolve(opts.destination ?? mkdtempSync(join(tmpdir(), "kg-retrieve-npm-")));
  mkdirSync(destination, { recursive: true });

  let tarballPath: string | undefined;
  let isLocalTarball = false;

  if (existsSync(input) && (input.endsWith(".tgz") || input.endsWith(".tar.gz"))) {
    tarballPath = resolve(input);
    isLocalTarball = true;
  }

  // 1. Verify against release document if provided
  let verifiedAgainstRelease = false;
  if (opts.release) {
    const relFile = resolve(opts.release);
    if (!existsSync(relFile)) {
      throw new Error(`Release document not found at ${relFile}`);
    }
    const raw = JSON.parse(readFileSync(relFile, "utf-8"));
    const releaseDoc = BinaryReleaseSchema.parse(raw);

    if (tarballPath) {
      const tgzSize = statSync(tarballPath).size;
      const tgzDigest = sha256File(tarballPath);
      const tarName = basename(tarballPath);

      const matchingAsset = releaseDoc.assets.find(
        (a) => a.name === tarName || a.digest?.digest === tgzDigest
      );

      if (!matchingAsset) {
        throw new Error(
          `Tarball ${tarName} (${tgzDigest.slice(0, 16)}) does not match any asset in release ${releaseDoc.release.id}`
        );
      }

      if (matchingAsset.digest && matchingAsset.digest.digest !== tgzDigest) {
        throw new Error(
          `Digest mismatch for ${tarName}: expected ${matchingAsset.digest.digest}, got ${tgzDigest}`
        );
      }

      if (matchingAsset.bytes !== tgzSize) {
        throw new Error(
          `Size mismatch for ${tarName}: expected ${matchingAsset.bytes} bytes, got ${tgzSize} bytes`
        );
      }

      verifiedAgainstRelease = true;
    }
  }

  // 2. Unpack or install
  if (isLocalTarball && tarballPath) {
    // Unpack tarball using tar
    const proc = spawnSync("tar", ["-xzf", tarballPath, "-C", destination, "--strip-components=1"], {
      encoding: "utf-8",
    });
    if (proc.status !== 0) {
      // Try without --strip-components if package directory wasn't standard
      const proc2 = spawnSync("tar", ["-xzf", tarballPath, "-C", destination], { encoding: "utf-8" });
      if (proc2.status !== 0) {
        throw new Error(`Failed to extract tarball ${tarballPath}: ${proc.stderr || proc2.stderr}`);
      }
    }
  } else if (opts.install) {
    // Run bun add / npm install
    const proc = spawnSync("bun", ["add", input], { cwd: destination, encoding: "utf-8" });
    if (proc.status !== 0) {
      throw new Error(`Failed to install package ${input}: ${proc.stderr || proc.stdout}`);
    }
  }

  // 3. Inspect extracted content
  // If files were extracted under 'package/' subdirectory (npm standard), adjust base
  const inspectDir = existsSync(join(destination, "package", "package.json"))
    ? join(destination, "package")
    : destination;

  const allFiles = walkFiles(inspectDir);

  // Analyze Unhydrated Source Graph components
  const instanceDeclarations: string[] = [];
  for (const f of allFiles) {
    if (f.endsWith(".json") && !f.includes("/")) {
      try {
        const parsed = JSON.parse(readFileSync(join(inspectDir, f), "utf-8"));
        if (parsed.name && Array.isArray(parsed.directories)) {
          instanceDeclarations.push(f);
        }
      } catch {}
    }
  }

  let manifest: GraphViewSummary["manifest"];
  const pkgJsonPath = join(inspectDir, "package.json");
  if (existsSync(pkgJsonPath)) {
    try {
      const p = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      manifest = {
        name: p.name,
        version: p.version,
        packageManifest: true,
      };
    } catch {}
  }

  const sourceDirs = new Set<string>();
  for (const f of allFiles) {
    const parts = f.split("/");
    if (parts.length > 1) {
      const top = parts[0]!;
      if (["skills", "schemas", "processes", "scenarios", "uploads", "library", "code-lists"].includes(top)) {
        sourceDirs.add(top);
      }
    }
  }

  // Analyze Hydrated Materialized Graph components
  const hydratedFiles = allFiles.filter(
    (f) =>
      f.endsWith(".jsonld") ||
      f.endsWith("index.hydrated.jsonld") ||
      f.endsWith("nodes.json") ||
      f.includes("subgraph/")
  );

  // declared-path-literal: counts by top-level directory inside a FETCHED
  // package, whose declaration may be absent (a hydrated view carries none),
  // so these name the package's conventional layout, not this checkout's.
  const skillsCount = allFiles.filter((f) => f.startsWith("skills/") && f.endsWith(".md")).length;
  const schemasCount = allFiles.filter((f) => f.startsWith("schemas/") && (f.endsWith(".ts") || f.endsWith(".json"))).length;
  const processesCount = allFiles.filter((f) => f.startsWith("processes/") && f.endsWith(".bpmn")).length;

  const viewSummary: GraphViewSummary = {
    view: viewMode,
    instanceDeclarations,
    manifest,
    sourceDirectories: [...sourceDirs].sort(),
    hydratedFiles,
    skillsCount,
    schemasCount,
    processesCount,
  };

  return {
    source: input,
    destination: inspectDir,
    verifiedAgainstRelease,
    viewSummary,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const destIndex = argv.indexOf("--destination");
  const viewIndex = argv.indexOf("--view");
  const relIndex = argv.indexOf("--release");
  const install = argv.includes("--install");
  const json = argv.includes("--json");

  const nonFlag = argv.filter((a) => !a.startsWith("-"));
  const pkg = nonFlag[0];
  if (!pkg) {
    console.error("Usage: bun run cat-harness-tools/scripts/kg-retrieve-npm.ts <package-or-tarball> [--destination <dir>] [--view <unhydrated|hydrated|both>] [--release <file>]");
    process.exit(1);
  }

  const destination = destIndex >= 0 && argv[destIndex + 1] ? argv[destIndex + 1] : undefined;
  const view = (viewIndex >= 0 && argv[viewIndex + 1] ? argv[viewIndex + 1] : "both") as GraphViewMode;
  const release = relIndex >= 0 && argv[relIndex + 1] ? argv[relIndex + 1] : undefined;

  try {
    const res = retrieveNpmKg({ pkg, destination, view, release, install, json });
    if (json) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`Retrieved KG: ${res.source}`);
      console.log(`Destination:  ${res.destination}`);
      console.log(`Verified:     ${res.verifiedAgainstRelease ? "YES (against release document)" : "no release doc provided"}`);
      console.log(`\nView Mode:    ${res.viewSummary.view}`);
      console.log(`Declarations: ${res.viewSummary.instanceDeclarations.join(", ") || "(none)"}`);
      console.log(`Source Dirs:  ${res.viewSummary.sourceDirectories.join(", ") || "(none)"}`);
      console.log(`Skills:       ${res.viewSummary.skillsCount} skill(s)`);
      console.log(`Schemas:      ${res.viewSummary.schemasCount} schema(s)`);
      console.log(`Processes:    ${res.viewSummary.processesCount} process(es)`);
      console.log(`Hydrated:     ${res.viewSummary.hydratedFiles.length} materialized file(s)`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`kg-retrieve-npm error: ${(e as Error).message}`);
    process.exit(1);
  }
}
