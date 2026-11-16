#!/usr/bin/env bun
/**
 * optimize-library-pngs — losslessly optimize library PNG images using ImageMagick
 * and verify pixel-perfect fidelity with compare -metric AE.
 *
 * A rewritten PNG that a catalogue records as held (a node's
 * `materialization.localPath`) has its recorded `bytes` and sha256 `fixity`
 * updated in the same run, so it does not become a fixity failure. The
 * catalogue is read as raw JSON (this layer may not import the content core
 * that defines its schema), and only fields that described the old bytes
 * change.
 *
 * @module scripts/optimize-library-pngs
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { instanceDirectoriesForGraph } from "../schemas/kg/cat-harness.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";

export interface OptimizeOptions {
  dirs?: string[];
  dryRun?: boolean;
  concurrency?: number;
  verbose?: boolean;
  /** ISO date stamped as `fixity.verifiedAt` on updated records (default: today). */
  today?: string;
}

/** One catalogue record brought up to date after its file was rewritten. */
export interface CatalogueFixityUpdate {
  node: string;
  file: string;
  bytes: number;
  sha256: string;
}

export interface OptimizeFileResult {
  file: string;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  status: "optimized" | "already-optimal" | "error" | "mismatch";
  reason?: string;
  /** sha256 of the file before it was rewritten (set when optimized). */
  originalSha256?: string;
}

export interface OptimizeSummary {
  totalFiles: number;
  optimizedFiles: number;
  alreadyOptimalFiles: number;
  errorFiles: number;
  originalTotalBytes: number;
  optimizedTotalBytes: number;
  savedTotalBytes: number;
  savedPercentage: number;
  results: OptimizeFileResult[];
  catalogueUpdates: CatalogueFixityUpdate[];
}

function runCommand(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const p = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => res({ code: code ?? 0, stdout, stderr }));
    p.on("error", (err) => res({ code: -1, stdout, stderr: err.message }));
  });
}

function findPngFiles(dir: string): string[] {
  const pngs: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".png")) {
        pngs.push(full);
      }
    }
  };
  walk(dir);
  return pngs.sort();
}

/** The nearest ancestor of `file` holding `catalogue/nodes`, if any. */
function catalogueRootFor(file: string): string | undefined {
  let d = dirname(file);
  for (;;) {
    if (existsSync(join(d, "catalogue", "nodes"))) return d;
    const up = dirname(d);
    if (up === d) return undefined;
    d = up;
  }
}

/**
 * Bring every catalogue record of a rewritten file up to date. A record is any
 * object carrying `materialization.localPath` that resolves to the file; its
 * `materialization.bytes`, its own `bytes` and a sha256 `fixity.digest` are
 * changed only where they still describe the original bytes, so a record that
 * was already wrong stays visibly wrong rather than being blessed.
 */
export function updateCatalogueFixity(
  rewritten: { file: string; originalBytes: number; originalSha256: string }[],
  today: string
): CatalogueFixityUpdate[] {
  const updates: CatalogueFixityUpdate[] = [];
  const byRoot = new Map<string, typeof rewritten>();
  for (const r of rewritten) {
    const root = catalogueRootFor(resolve(r.file));
    if (!root) continue;
    byRoot.set(root, [...(byRoot.get(root) ?? []), r]);
  }
  for (const [root, files] of byRoot) {
    const want = new Map(files.map((f) => [resolve(f.file), f]));
    const nodesDir = join(root, "catalogue", "nodes");
    for (const name of readdirSync(nodesDir).filter((n) => n.endsWith(".json")).sort()) {
      const path = join(nodesDir, name);
      const text = readFileSync(path, "utf-8");
      const doc = JSON.parse(text);
      let changed = false;
      const visit = (o: unknown): void => {
        if (Array.isArray(o)) return o.forEach(visit);
        if (!o || typeof o !== "object") return;
        type Fixity = { algorithm?: unknown; digest?: unknown; verifiedAt?: unknown };
        type Materialization = { localPath?: unknown; bytes?: unknown; fixity?: Fixity };
        const rec = o as Record<string, unknown> & { bytes?: unknown; materialization?: Materialization };
        const m = rec.materialization;
        const hit = m && typeof m.localPath === "string" ? want.get(resolve(root, m.localPath)) : undefined;
        if (m && hit) {
          const buf = readFileSync(hit.file);
          const bytes = buf.length;
          const sha256 = createHash("sha256").update(buf).digest("hex");
          if (m.bytes === hit.originalBytes) m.bytes = bytes;
          if (rec.bytes === hit.originalBytes) rec.bytes = bytes;
          const fx = m.fixity;
          if (fx && fx.algorithm === "sha256" && fx.digest === hit.originalSha256) {
            fx.digest = sha256;
            fx.verifiedAt = today;
          }
          changed = true;
          updates.push({ node: path, file: hit.file, bytes, sha256 });
        }
        for (const v of Object.values(rec)) visit(v);
      };
      visit(doc);
      if (changed) writeFileSync(path, JSON.stringify(doc, null, 2) + (text.endsWith("\n") ? "\n" : ""));
    }
  }
  return updates;
}

function sha256Of(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

async function optimizeSingleFile(
  filePath: string,
  dryRun: boolean,
  convertBin: string,
  compareBin: string
): Promise<OptimizeFileResult> {
  const origSize = statSync(filePath).size;
  const tmpFile = join(tmpdir(), `opt-${Math.random().toString(36).slice(2)}.png`);

  try {
    const conv = await runCommand(convertBin, [
      filePath,
      "-strip",
      "-define",
      "png:compression-filter=5",
      "-define",
      "png:compression-level=9",
      "-define",
      "png:compression-strategy=1",
      tmpFile,
    ]);

    if (conv.code !== 0 || !existsSync(tmpFile)) {
      return {
        file: filePath,
        originalBytes: origSize,
        optimizedBytes: origSize,
        savedBytes: 0,
        status: "error",
        reason: conv.stderr.trim() || "convert failed",
      };
    }

    const nextSize = statSync(tmpFile).size;
    if (nextSize >= origSize) {
      return {
        file: filePath,
        originalBytes: origSize,
        optimizedBytes: origSize,
        savedBytes: 0,
        status: "already-optimal",
      };
    }

    const comp = await runCommand(compareBin, ["-metric", "AE", filePath, tmpFile, "null:"]);
    const compErr = comp.stderr.trim();
    const isExactMatch = comp.code === 0 && (compErr === "0" || compErr.startsWith("0 "));

    if (!isExactMatch) {
      return {
        file: filePath,
        originalBytes: origSize,
        optimizedBytes: origSize,
        savedBytes: 0,
        status: "mismatch",
        reason: `compare AE was not 0: ${compErr}`,
      };
    }

    const saved = origSize - nextSize;
    const originalSha256 = sha256Of(filePath);
    if (!dryRun) {
      copyFileSync(tmpFile, filePath);
    }

    return {
      file: filePath,
      originalBytes: origSize,
      optimizedBytes: nextSize,
      savedBytes: saved,
      status: "optimized",
      originalSha256,
    };
  } finally {
    try {
      if (existsSync(tmpFile)) unlinkSync(tmpFile);
    } catch {}
  }
}

export async function optimizeLibraryPngs(opts: OptimizeOptions = {}): Promise<OptimizeSummary> {
  const convertBin = existsSync("/opt/local/bin/convert") ? "/opt/local/bin/convert" : "convert";
  const compareBin = existsSync("/opt/local/bin/compare") ? "/opt/local/bin/compare" : "compare";

  const targetDirs =
    opts.dirs && opts.dirs.length > 0
      ? opts.dirs
      : // Every layer's own `library` directory, read from its declaration
        // rather than spelled: the four this listed were a monorepo's, and a
        // literal here names another layer's directory (check:foreign-paths).
        layerRootsIn(process.cwd())
          .flatMap((root) => instanceDirectoriesForGraph(root, "library"))
          .filter((d) => existsSync(d));

  const allFiles: string[] = [];
  for (const d of targetDirs) {
    allFiles.push(...findPngFiles(resolve(d)));
  }

  const concurrency = opts.concurrency ?? 8;
  const dryRun = opts.dryRun ?? false;
  const verbose = opts.verbose ?? false;
  const results: OptimizeFileResult[] = [];

  let idx = 0;
  async function worker() {
    while (idx < allFiles.length) {
      const file = allFiles[idx++];
      if (!file) break;
      const res = await optimizeSingleFile(file, dryRun, convertBin, compareBin);
      results.push(res);
      if (verbose) {
        if (res.status === "optimized") {
          console.log(`[OPT] ${res.file}: ${res.originalBytes} -> ${res.optimizedBytes} (-${res.savedBytes} B)`);
        } else if (res.status === "already-optimal") {
          console.log(`[OK ] ${res.file}: already optimal (${res.originalBytes} B)`);
        } else {
          console.log(`[ERR] ${res.file}: ${res.status} (${res.reason})`);
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  let origTotal = 0;
  let optTotal = 0;
  let savedTotal = 0;
  let optCount = 0;
  let alreadyCount = 0;
  let errCount = 0;

  for (const r of results) {
    origTotal += r.originalBytes;
    optTotal += r.optimizedBytes;
    savedTotal += r.savedBytes;
    if (r.status === "optimized") optCount++;
    else if (r.status === "already-optimal") alreadyCount++;
    else errCount++;
  }

  const catalogueUpdates = dryRun
    ? []
    : updateCatalogueFixity(
        results
          .filter((r) => r.status === "optimized" && r.originalSha256)
          .map((r) => ({ file: r.file, originalBytes: r.originalBytes, originalSha256: r.originalSha256! })),
        opts.today ?? new Date().toISOString().slice(0, 10)
      );

  const savedPercentage = origTotal > 0 ? (savedTotal / origTotal) * 100 : 0;

  return {
    totalFiles: results.length,
    optimizedFiles: optCount,
    alreadyOptimalFiles: alreadyCount,
    errorFiles: errCount,
    originalTotalBytes: origTotal,
    optimizedTotalBytes: optTotal,
    savedTotalBytes: savedTotal,
    savedPercentage,
    results,
    catalogueUpdates,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const verbose = argv.includes("--verbose");
  const dirs = argv.filter((a) => !a.startsWith("--"));

  console.log(`Scanning and optimizing library PNGs (dryRun=${dryRun})...`);
  const summary = await optimizeLibraryPngs({ dirs: dirs.length > 0 ? dirs : undefined, dryRun, verbose });

  console.log("\n--- Optimization Summary ---");
  console.log(`Total PNGs inspected:    ${summary.totalFiles}`);
  console.log(`Optimized (reduced):     ${summary.optimizedFiles}`);
  console.log(`Already optimal:         ${summary.alreadyOptimalFiles}`);
  console.log(`Errors / Mismatches:     ${summary.errorFiles}`);
  console.log(`Original total size:     ${(summary.originalTotalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Optimized total size:    ${(summary.optimizedTotalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Catalogue records updated: ${summary.catalogueUpdates.length}`);
  console.log(`Total saved:             ${(summary.savedTotalBytes / (1024 * 1024)).toFixed(2)} MB (${summary.savedPercentage.toFixed(1)}% reduction)`);
}
