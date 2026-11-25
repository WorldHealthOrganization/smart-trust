/**
 * Guard against benchmark runs writing into declared knowledge-graph directories.
 *
 * Every other verdict lands inside a declared graph (`test/results/` for
 * `qa`, `test/attestations/` for `attestations`, `test/health/results/` for
 * `health`). Benchmark outputs describe the model and runner at one point in
 * time, not the subject folio, so they must land in `build/` (e.g.
 * `build/benchmarks/`) or `reports/`, and are forbidden from writing into any
 * declared graph directory.
 *
 * @module scripts/benchmark-guard
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve, relative, isAbsolute, normalize } from "path";

/**
 * Declared graph directories in cat-harness / folio-assistant.
 * If cat-harness.json is readable, this is augmented from its declared directories.
 *
 * declared-path-literal: the FALLBACK list for when no declaration can be read —
 * the guard must still refuse a benchmark that would write into a graph, and
 * an unreadable declaration is exactly when it cannot ask. The live list is
 * the declaration's, merged over this.
 */
export const DEFAULT_GRAPH_DIRECTORIES = [
  "validators",
  "tools",
  "external-schemas",
  "subscriptions",
  "code-lists",
  "vocab-mappings",
  "tool-releases",
  "schemas",
  "uml",
  "skills",
  "scenarios",
  "policies",
  "processes",
  "methodologies",
  "test/results",
  "test/attestations",
  "test/health/results",
  "uploads",
  "library",
  "translations",
  "folio",
  "docs",
  "site",
  "glossary",
  "scripts",
  "src",
  "adapters",
  "test",
  "templates",
  "deploy",
  "upstream",
  "openapi",
  "memory",
  "fsh-guts",
  "beans",
  "todos",
  "issue-marks",
];

/**
 * Read declared graph directory paths from cat-harness.json if available.
 */
export function getDeclaredGraphDirectories(rootDir: string = process.cwd()): string[] {
  const dirs = new Set<string>(DEFAULT_GRAPH_DIRECTORIES);

  const candidates = [
    join(rootDir, "cat-harness.json"),
    join(rootDir, "cat-harness", "cat-harness.json"),
    join(rootDir, "..", "cat-harness.json"),
  ];

  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        const decl = JSON.parse(readFileSync(c, "utf-8"));
        if (Array.isArray(decl.directories)) {
          for (const d of decl.directories) {
            if (typeof d?.path === "string") {
              const clean = d.path.replace(/^\/+|\/+$/g, "");
              if (clean) dirs.add(clean);
            }
          }
        }
      } catch {
        // Fall back to known default directories
      }
      break;
    }
  }

  // Sort longest path first so specific subpaths match before parent directories
  return Array.from(dirs).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * Check whether a target path resolves inside any declared graph directory.
 */
export function isDeclaredGraphPath(
  targetPath: string,
  rootDir: string = process.cwd(),
): {
  isGraph: boolean;
  matchedDirectory?: string;
  reason?: string;
} {
  const normTarget = normalize(targetPath).replace(/^[.][\\/]/, "").replace(/\\/g, "/");
  const graphDirs = getDeclaredGraphDirectories(rootDir);

  for (const gDir of graphDirs) {
    const normGDir = normalize(gDir).replace(/^[.][\\/]/, "").replace(/[\\/]$/, "").replace(/\\/g, "/");
    if (
      normTarget === normGDir ||
      normTarget.startsWith(`${normGDir}/`)
    ) {
      return {
        isGraph: true,
        matchedDirectory: normGDir,
        reason: `Target path "${targetPath}" is inside declared graph directory "${normGDir}"`,
      };
    }
  }

  const absRoot = resolve(rootDir);
  const absTarget = isAbsolute(targetPath) ? resolve(targetPath) : resolve(rootDir, targetPath);
  const rel = relative(absRoot, absTarget).replace(/\\/g, "/");

  if (!rel.startsWith("..")) {
    for (const gDir of graphDirs) {
      const normGDir = normalize(gDir).replace(/^[.][\\/]/, "").replace(/[\\/]$/, "").replace(/\\/g, "/");
      if (
        rel === normGDir ||
        rel.startsWith(`${normGDir}/`)
      ) {
        return {
          isGraph: true,
          matchedDirectory: normGDir,
          reason: `Target path "${targetPath}" resolves inside declared graph directory "${normGDir}" in ${rootDir}`,
        };
      }
    }
  }

  return { isGraph: false };
}

/**
 * Assert that a benchmark output path does NOT write into a declared graph directory.
 * Throws an Error if the path is in a declared graph directory.
 */
export function assertBenchmarkOutputPath(targetPath: string, rootDir: string = process.cwd()): void {
  const check = isDeclaredGraphPath(targetPath, rootDir);
  if (check.isGraph) {
    throw new Error(
      `Benchmark output path "${targetPath}" resolves inside declared graph directory "${check.matchedDirectory}". ` +
      `Benchmarking output is a report about model performance, not KG content, and is deliberately excluded from ` +
      `declared graphs (folio-assistant-wp49, #363). Default your output to build/benchmarks/ or reports/.`,
    );
  }
}
