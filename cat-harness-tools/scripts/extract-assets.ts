#!/usr/bin/env bun
/**
 * Read a container's INDEX and write a `folio-extraction/v1` record.
 *
 * Metadata by default; contents only when explicitly asked for (`--extract`
 * with a `--because`).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/extract-assets.ts <container> [--out <file>]
 *   bun run cat-harness-tools/scripts/extract-assets.ts <container> --extract <path> --because "<why>"
 *
 * @module scripts/extract-assets
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import {
  EXTRACTION_SCHEMA_TAG,
  ExtractionSchema,
  isSingleCapture,
  totalBytes,
  type ExtractedAsset,
  type Extraction,
} from "../schemas/content/extraction.js";
import { REPO_ROOT } from "./lib/roots.ts";

// What recorded paths are relative to. Before bean `tlat` moved this file down
// from the content core's `scripts/` it was `import.meta.dir/../..`, which
// happens to be the same directory from here — but only inside this checkout.
// Standalone, this layer has no repository root, and the container being read
// is the caller's, so the working directory is the honest base.
const REPO = REPO_ROOT ?? process.cwd();

/**
 * Media type from the extension, or ABSENT.
 *
 * Deliberately a short map and no fallback to `application/octet-stream`:
 * that value reads as a determination and is really a shrug. `mediaType` is
 * optional in the schema precisely so "could not tell" has a spelling.
 */
const MEDIA: Record<string, string> = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".ico": "image/vnd.microsoft.icon",
};

/** `__MACOSX/` shadows and the resource forks beside them. */
const MACOS_SHADOW = /(^|\/)__MACOSX\//;

/** Read a zip's central directory via `unzip -l`, without decompressing. */
export function readZipIndex(container: string): { assets: ExtractedAsset[]; omitted: number } {
  const r = Bun.spawnSync(["unzip", "-l", container]);
  if (r.exitCode !== 0) throw new Error(`unzip -l failed for ${container}`);
  const out: ExtractedAsset[] = [];
  let omitted = 0;
  for (const line of new TextDecoder().decode(r.stdout).split("\n")) {
    // `  <bytes>  YYYY-MM-DD HH:MM   <path>` — path may contain spaces, so the
    // split is positional on the first three fields and the rest is the name.
    const m = line.match(/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s{3}(.+)$/);
    if (!m) continue;
    const [, bytes, date, time, path] = m;
    if (MACOS_SHADOW.test(path!)) {
      omitted++;
      continue;
    }
    if (path!.endsWith("/")) continue; // a directory entry is not an asset
    const ext = extname(path!).toLowerCase();
    out.push({
      path: path!,
      bytes: Number(bytes),
      ...(MEDIA[ext] ? { mediaType: MEDIA[ext] } : {}),
      modifiedAt: `${date}T${time}`,
    });
  }
  return { assets: out, omitted };
}

/** A PDF's own `CreationDate` and `Producer`, read from the bytes. */
export function readPdfProvenance(container: string): { capturedAt?: string; producer?: string } {
  const b = readFileSync(container);
  const find = (key: string): string | undefined => {
    const m = b.toString("latin1").match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`));
    return m ? m[1] : undefined;
  };
  const raw = find("CreationDate");
  // `D:YYYYMMDDHHmmSS+ZZ'zz'` -> ISO-ish, keeping the offset the file states.
  const iso = raw?.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(.*)$/);
  return {
    ...(iso
      ? { capturedAt: `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6]}` }
      : raw
        ? { capturedAt: raw }
        : {}),
    ...(find("Producer") ? { producer: find("Producer")! } : {}),
  };
}

function run(argv: string[]): number {
  const container = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--out" &&
    argv[argv.indexOf(a) - 1] !== "--extract" && argv[argv.indexOf(a) - 1] !== "--because");
  if (!container || !existsSync(container)) {
    console.error("usage: extract-assets <container> [--out <file>] [--extract <path> --because <why>]");
    console.error("  Reads the container's INDEX. Contents are written only with --extract.");
    return 2;
  }
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const ext = extname(container).toLowerCase();
  let record: Extraction;
  const readAt = new Date().toISOString();

  if (ext === ".zip") {
    const { assets, omitted } = readZipIndex(container);
    record = {
      $schema: EXTRACTION_SCHEMA_TAG,
      container: relative(REPO, resolve(container)),
      method: "zip",
      readAt,
      assets,
      ...(omitted > 0
        ? {
            omitted: [
              {
                pattern: "__MACOSX/**",
                reason:
                  "macOS resource-fork shadows, one per real entry. Listed here rather than " +
                  "dropped silently so the asset count can be reconciled with the container's own.",
                count: omitted,
              },
            ],
          }
        : {}),
    };
    // A saved-webpage bundle is a zip whose entries all carry one timestamp.
    // Said by the data rather than by the filename.
    const single = isSingleCapture(record);
    if (single === true) {
      record.method = "saved-webpage";
      record.capturedAt = assets.find((a) => a.modifiedAt)?.modifiedAt;
    }
  } else if (ext === ".pdf") {
    const prov = readPdfProvenance(container);
    record = {
      $schema: EXTRACTION_SCHEMA_TAG,
      container: relative(REPO, resolve(container)),
      method: "pdf",
      readAt,
      ...prov,
      assets: [
        {
          path: basename(container),
          bytes: statSync(container).size,
          mediaType: "application/pdf",
        },
      ],
    };
  } else {
    console.error(`${container}: no reader for \`${ext || "(no extension)"}\`. This is NOT a pass.`);
    return 2;
  }

  // The one explicit ask, if there is one.
  const wanted = at("--extract");
  if (wanted) {
    const why = at("--because");
    if (!why) {
      console.error("--extract requires --because: an unexplained local copy cannot be told");
      console.error("from one nobody authorised. See `asset-extraction`.");
      return 2;
    }
    const target = record.assets.find((a) => a.path === wanted || a.path.endsWith(`/${wanted}`));
    if (!target) {
      console.error(`--extract ${wanted}: no such entry. This is NOT a pass.`);
      return 2;
    }
    const outDir = join(dirname(container), "extracted");
    mkdirSync(outDir, { recursive: true });
    const r = Bun.spawnSync(["unzip", "-o", "-j", container, target.path, "-d", outDir]);
    if (r.exitCode !== 0) {
      console.error(`unzip failed for ${target.path}`);
      return 1;
    }
    const written = join(outDir, basename(target.path));
    target.localPath = relative(REPO, written);
    target.extractedBecause = why;
    // CHECKED, because the failure is silent and lands downstream. An
    // unchecked `sha256sum` gives `""`, which fails `ExtractionSchema.parse`
    // below — AFTER the file has been extracted — so the run ends with a local
    // copy on disk and no record saying where it came from or why. That is the
    // one state this whole module exists to prevent: an extracted asset with
    // no provenance.
    const sum = Bun.spawnSync(["sha256sum", written]);
    const digest = new TextDecoder().decode(sum.stdout).split(" ")[0] ?? "";
    if (sum.exitCode !== 0 || !/^[0-9a-f]{64}$/.test(digest)) {
      console.error(
        `sha256sum failed for ${written} (exit ${sum.exitCode}) — the file is extracted ` +
          `and NOT recorded. Remove it or re-run once sha256sum works; an asset on disk ` +
          `with no extraction record is exactly what this tool exists to prevent.`,
      );
      return 1;
    }
    target.sha256 = digest;
  }

  const parsed = ExtractionSchema.parse(record);
  const outFile = at("--out") ?? `${container}.extraction.json`;
  writeFileSync(outFile, JSON.stringify(parsed, null, 2) + "\n");

  const single = isSingleCapture(parsed);
  console.log(`${parsed.assets.length} asset(s), ${totalBytes(parsed).toLocaleString()} bytes indexed`);
  console.log(`method: ${parsed.method}${parsed.producer ? `  producer: ${parsed.producer}` : ""}`);
  if (parsed.capturedAt) {
    console.log(`captured: ${parsed.capturedAt}  — a CAPTURE time, never a publication date`);
  }
  if (single === true) {
    console.log("every entry shares one timestamp: this container is one capture, not a preserved archive");
  }
  for (const a of extracted(parsed)) console.log(`  extracted ${a.path} -> ${a.localPath}  (${a.extractedBecause})`);
  console.log(`-> ${outFile}`);
  return 0;
}

const extracted = (x: Extraction): ExtractedAsset[] => x.assets.filter((a) => a.localPath !== undefined);

if (import.meta.main) process.exit(run(process.argv.slice(2)));
