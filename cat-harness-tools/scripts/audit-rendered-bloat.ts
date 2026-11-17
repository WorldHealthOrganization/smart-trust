/**
 * Audit tool for large redundant rendered HTML content that can be dynamically
 * loaded from the Knowledge Graph.
 *
 * ## Purpose
 * Analyzes built HTML pages (e.g. in `_site/` or `docs/`) to detect:
 * 1. Per-page byte sizes and HTML bloat.
 * 2. Duplicate repeated markup blocks across multiple pages (>= threshold, default 500 bytes).
 * 3. Rendered blocks that match committed KG JSON/JSON-LD files.
 *
 * ## Classification
 * Classifies candidates against the visualizer loading skill (`skills/ui/ui-core/visualizer-loading.md`):
 * - `keep_serverside`: Navigation, header/footer chrome, headings/identity, SEO, no-JS fallbacks.
 * - `move`: Heavy data tables, duplicate card lists, embedded raw KG JSON, repeated visualizer data.
 * - `unsure`: Ambiguous blocks requiring author review.
 *
 * Emits a `kg-qa` compliant sidecar (`test/results/kg-qa/rendered-content-bloat.kg-qa.json`)
 * under criterion `redundant-rendered-content-audit`.
 * Vacuity guard: returns `unknown` if 0 HTML pages are found.
 *
 * @module scripts/audit-rendered-bloat
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { kgQaHomeFor } from "../schemas/kg/cat-harness.js";
import { siteOwnerDir } from "./viewer-declarations.ts";

import {
  KG_QA_SCHEMA,
  KgQaReportSchema,
  tally,
  type KgFinding,
  type KgQaReport,
} from "../schemas/sdlc/kg-qa.js";

export const CRITERION_ID = "redundant-rendered-content-audit";
export const DEFAULT_THRESHOLD_BYTES = 500;
export const DEFAULT_MIN_OCCURRENCES = 2;
/**
 * The sidecar's NAME. Its directory is the layer's declared `qa` tree
 * (`kgQaHomeFor`) under `kg-qa/`, asked at run time rather than spelled here.
 */
export const DEFAULT_SIDECAR_NAME = "rendered-content-bloat.kg-qa.json";

export type BloatAction = "move" | "keep_serverside" | "unsure";

export interface ExtractedBlock {
  tag: string;
  selector: string;
  byteLength: number;
  hash: string;
  rawHtml: string;
  page: string;
  kgSourceAttr?: string;
}

export interface BloatCandidate {
  id: string;
  selector: string;
  tag: string;
  byteLength: number;
  occurrences: number;
  pages: string[];
  kgFile?: string;
  action: BloatAction;
  reason: string;
  preview: string;
}

export interface PageBloatMetric {
  path: string;
  byteLength: number;
  blockCount: number;
}

export interface RenderedBloatAuditStats {
  totalPages: number;
  totalBytes: number;
  averageBytesPerPage: number;
  largestPage?: PageBloatMetric;
  candidateCount: number;
  moveCount: number;
  keepServerSideCount: number;
  unsureCount: number;
  candidates: BloatCandidate[];
}

export interface RenderedBloatAuditResult {
  report: KgQaReport;
  stats: RenderedBloatAuditStats;
}

export interface AuditRenderedBloatOptions {
  /** Directory containing HTML files to audit. */
  siteDir?: string;
  /** Root directories to scan for committed KG files. */
  kgRoots?: string[];
  /** Minimum byte length to consider as bloat candidate (default: 500). */
  threshold?: number;
  /** Minimum page occurrences to consider as duplicate (default: 2). */
  minOccurrences?: number;
  /** Output sidecar path relative to repo root (default: test/results/kg-qa/rendered-content-bloat.kg-qa.json). */
  sidecarPath?: string;
  /** Whether to write the sidecar JSON to disk (default: true). */
  writeSidecar?: boolean;
  /** Layer / repository root. */
  repoRoot?: string;
}

export interface KgFileRecord {
  path: string;
  relPath: string;
  content: string;
  canonicalJson?: string;
  id?: string;
}

const BLOCK_TAGS = new Set([
  "table",
  "div",
  "section",
  "article",
  "ul",
  "ol",
  "dl",
  "nav",
  "header",
  "footer",
  "aside",
  "pre",
  "form",
]);

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Deterministic hash for string content.
 */
export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Recursively find all files matching an extension in a directory.
 */
export function findFilesRecursive(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];

  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }

    for (const name of entries) {
      if (name.startsWith(".") && name !== ".") continue;
      const full = join(current, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (st.isFile() && extname(name).toLowerCase() === ext) {
          results.push(full);
        }
      } catch {
        // ignore unreadable
      }
    }
  };

  walk(dir);
  return results.sort();
}

/**
 * Extract CSS selector hint from raw opening tag.
 */
export function extractSelector(tag: string, rawOpenTag: string): string {
  const idMatch = /\bid=["']([^"']+)["']/i.exec(rawOpenTag);
  const classMatch = /\bclass=["']([^"']+)["']/i.exec(rawOpenTag);
  const roleMatch = /\brole=["']([^"']+)["']/i.exec(rawOpenTag);
  const kgMatch = /\bdata-kg-source=["']([^"']+)["']/i.exec(rawOpenTag);

  let sel = tag;
  if (idMatch?.[1]) {
    sel += `#${idMatch[1].trim()}`;
  }
  if (classMatch?.[1]) {
    const classes = classMatch[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".");
    if (classes) sel += `.${classes}`;
  }
  if (roleMatch?.[1]) {
    sel += `[role="${roleMatch[1].trim()}"]`;
  }

  if (kgMatch?.[1]) {
    sel += `[data-kg-source="${kgMatch[1].trim()}"]`;
  }

  return sel;
}

/**
 * Extract block elements from an HTML document.
 */
export function extractHtmlBlocks(
  html: string,
  pagePath: string = "",
  options: { threshold?: number } = {},
): ExtractedBlock[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD_BYTES;
  const blocks: ExtractedBlock[] = [];

  // Match tags
  const tagRegex = /<(\/)?([a-zA-Z0-9:-]+)([^>]*)>/g;
  interface TagEntry {
    tag: string;
    start: number;
    rawOpenTag: string;
    kgSource?: string;
  }

  const stack: TagEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const attrs = match[3] || "";
    const index = match.index;
    const fullTag = match[0];

    if (VOID_TAGS.has(tagName) || fullTag.endsWith("/>")) {
      continue;
    }

    if (!isClosing) {
      if (BLOCK_TAGS.has(tagName) || tagName === "script") {
        const kgSourceMatch = /\bdata-kg-source=["']([^"']+)["']/i.exec(attrs);
        stack.push({
          tag: tagName,
          start: index,
          rawOpenTag: fullTag,
          kgSource: kgSourceMatch?.[1],
        });
      }
    } else {
      // Closing tag: match from top of stack
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) {
          const openEntry = stack[i];
          stack.splice(i, 1);

          const endIndex = index + fullTag.length;
          const rawBlock = html.slice(openEntry.start, endIndex);
          const byteLength = Buffer.byteLength(rawBlock, "utf-8");

          // Special check for script with JSON or block matching threshold
          const isLdJson =
            tagName === "script" &&
            /type=["']application\/(ld\+)?json["']/i.test(openEntry.rawOpenTag);

          if (byteLength >= threshold || isLdJson) {
            const normalized = rawBlock.replace(/\s+/g, " ").trim();
            const selector = extractSelector(tagName, openEntry.rawOpenTag);

            blocks.push({
              tag: tagName,
              selector,
              byteLength,
              hash: sha256(normalized),
              rawHtml: rawBlock,
              page: pagePath,
              kgSourceAttr: openEntry.kgSource,
            });
          }
          break;
        }
      }
    }
  }

  return blocks;
}

/**
 * Load and index committed KG JSON / JSON-LD files.
 */
export function loadCommittedKgFiles(roots: string[], baseDir: string = ""): KgFileRecord[] {
  const records: KgFileRecord[] = [];

  for (const root of roots) {
    const absRoot = resolve(baseDir, root);
    if (!existsSync(absRoot)) continue;

    const jsonFiles = [
      ...findFilesRecursive(absRoot, ".json"),
      ...findFilesRecursive(absRoot, ".jsonld"),
    ];

    for (const f of jsonFiles) {
      try {
        const content = readFileSync(f, "utf-8").trim();
        if (!content) continue;

        let canonicalJson: string | undefined;
        let id: string | undefined;

        try {
          const parsed = JSON.parse(content);
          canonicalJson = JSON.stringify(parsed);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.id === "string") id = parsed.id;
            else if (typeof parsed["@id"] === "string") id = parsed["@id"];
            else if (typeof parsed.name === "string") id = parsed.name;
          }
        } catch {
          // not valid JSON, ignore canonicalJson
        }

        records.push({
          path: f,
          relPath: baseDir ? relative(baseDir, f) : f,
          content,
          canonicalJson,
          id,
        });
      } catch {
        // ignore unreadable
      }
    }
  }

  return records;
}

/**
 * Check if a block's content matches any committed KG file.
 */
export function matchKgFile(block: ExtractedBlock, kgFiles: readonly KgFileRecord[]): string | undefined {
  if (block.kgSourceAttr) {
    const direct = kgFiles.find(
      (k) =>
        k.relPath === block.kgSourceAttr ||
        k.path.endsWith(block.kgSourceAttr!) ||
        k.id === block.kgSourceAttr,
    );
    if (direct) return direct.relPath;
  }

  // Check if rawHtml or text includes JSON from a KG file
  for (const kg of kgFiles) {
    if (kg.canonicalJson && kg.canonicalJson.length >= 100) {
      if (block.rawHtml.includes(kg.canonicalJson)) {
        return kg.relPath;
      }
    }

    if (kg.content.length >= 120 && block.rawHtml.includes(kg.content)) {
      return kg.relPath;
    }
  }

  return undefined;
}

/**
 * Heuristic/agentic classifier that decides whether a candidate block should
 * move client-side, stay server-side, or is unsure, following visualizer-loading.md.
 */
export function classifyCandidate(candidate: {
  selector: string;
  tag: string;
  byteLength: number;
  occurrences: number;
  kgFile?: string;
  rawHtml?: string;
}): { action: BloatAction; reason: string } {
  const sel = candidate.selector.toLowerCase();
  const tag = candidate.tag.toLowerCase();

  // 1. MUST KEEP SERVER-SIDE: Navigation, headers, footers, breadcrumbs, search, no-JS
  if (
    tag === "nav" ||
    tag === "header" ||
    tag === "footer" ||
    /(^|[\. #_-])(nav|navbar|site-nav|menu|breadcrumb|pagination|site-header|site-footer)($|[\. #_-])/i.test(
      sel,
    )
  ) {
    return {
      action: "keep_serverside",
      reason:
        "Navigation, header chrome, and pagination must remain server-side for initial paint, screen readers, and no-JS accessibility (visualizer-loading skill).",
    };
  }

  if (
    tag === "form" ||
    /(^|[\. #_-])(search|search-form|input-group)($|[\. #_-])/i.test(sel)
  ) {
    return {
      action: "keep_serverside",
      reason:
        "Search forms and input controls must remain server-side for baseline accessibility and interaction without scripting.",
    };
  }

  if (tag === "noscript" || /(^|[\. #_-])(noscript|no-js|fallback)($|[\. #_-])/i.test(sel)) {
    return {
      action: "keep_serverside",
      reason:
        "No-JS fallback and raw data links must remain server-side so viewers without JavaScript can access content.",
    };
  }

  if (/(^|[\. #_-])(title|doc-title|page-title|page-heading|identity)($|[\. #_-])/i.test(sel)) {
    return {
      action: "keep_serverside",
      reason:
        "Document identity, main headings, and outline markers must remain server-side for SEO and outline navigation.",
    };
  }

  // 2. CANDIDATES TO MOVE CLIENT-SIDE:
  // Direct match to committed KG file
  if (candidate.kgFile) {
    return {
      action: "move",
      reason: `Block content duplicates committed KG file '${candidate.kgFile}'; candidate for dynamic client-side loading via visualizer loader (visualizer-loading skill).`,
    };
  }

  // Heavy data tables
  if (
    tag === "table" ||
    /(^|[\. #_-])(data-table|grid|data-grid|tabular|matrix|artifact-table)($|[\. #_-])/i.test(
      sel,
    )
  ) {
    return {
      action: "move",
      reason: `Heavy tabular data (${candidate.byteLength} bytes) should be loaded dynamically from the KG client-side to reduce HTML bloat while preserving a lightweight skeleton.`,
    };
  }

  // Repeated card lists / visualizer catalogs / item grids
  if (
    /(^|[\. #_-])(card-list|tile-grid|visualizer|catalog|node-list|item-list|artifact-list)($|[\. #_-])/i.test(
      sel,
    ) &&
    candidate.occurrences >= 2
  ) {
    return {
      action: "move",
      reason: `Repeated component list (${candidate.byteLength} bytes across ${candidate.occurrences} pages) can be rendered client-side from KG data.`,
    };
  }

  // Embedded raw JSON / JSON-LD / code block
  if (
    (tag === "pre" || tag === "code" || tag === "script") &&
    /(^|[\. #_-])(json|jsonld|code-block|data-dump)($|[\. #_-])/i.test(sel)
  ) {
    return {
      action: "move",
      reason:
        "Raw data dump embedded in HTML; can be fetched directly from published KG endpoint.",
    };
  }

  // Large repeated block (> 1500 bytes across 2+ pages)
  if (candidate.byteLength >= 1500 && candidate.occurrences >= 2) {
    return {
      action: "move",
      reason: `Large redundant markup block (${candidate.byteLength} bytes repeated across ${candidate.occurrences} pages) produces significant HTML bloat; can be dynamically loaded.`,
    };
  }

  // 3. UNSURE: Generic containers with mixed content
  return {
    action: "unsure",
    reason:
      "Candidate block requires agentic/author review: evaluate whether dynamic loading harms initial paint or SEO against the visualizer skill.",
  };
}

/**
 * Execute the rendered content bloat audit.
 */
export function auditRenderedBloat(options: AuditRenderedBloatOptions = {}): RenderedBloatAuditResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  // A built `_site/` first, else the site the declaration names (`siteOwnerDir`).
  const siteDir = options.siteDir ?? (existsSync(join(repoRoot, "_site")) ? join(repoRoot, "_site") : siteOwnerDir(repoRoot));
  const threshold = options.threshold ?? DEFAULT_THRESHOLD_BYTES;
  const minOccurrences = options.minOccurrences ?? DEFAULT_MIN_OCCURRENCES;
  const sidecarRel = options.sidecarPath ?? join(kgQaHomeFor(repoRoot).root, "kg-qa", DEFAULT_SIDECAR_NAME);
  const sidecarPath = isAbsolute(sidecarRel) ? sidecarRel : join(repoRoot, sidecarRel);
  const writeSidecar = options.writeSidecar ?? true;

  // 1. Discover HTML files
  const htmlFiles = findFilesRecursive(siteDir, ".html");

  // Vacuity guard: 0 pages examined -> unknown
  if (htmlFiles.length === 0) {
    const report: KgQaReport = {
      $schema: KG_QA_SCHEMA,
      subject: {
        kind: "graph",
        id: "rendered-content-bloat",
        path: null,
      },
      source_hash: null,
      criteria: {
        [CRITERION_ID]: {
          result: "unknown",
          findings: [
            {
              where: "—",
              detail: `vacuity guard: 0 HTML pages examined under '${siteDir}'; audit could not be evaluated.`,
            },
          ],
        },
      },
      totals: { pass: 0, fail: 0, "n/a": 0, unknown: 1 },
    };

    if (writeSidecar) {
      mkdirSync(dirname(sidecarPath), { recursive: true });
      writeFileSync(sidecarPath, JSON.stringify(report, null, 2) + "\n");
    }

    return {
      report,
      stats: {
        totalPages: 0,
        totalBytes: 0,
        averageBytesPerPage: 0,
        candidateCount: 0,
        moveCount: 0,
        keepServerSideCount: 0,
        unsureCount: 0,
        candidates: [],
      },
    };
  }

  // 2. Load committed KG files
  const kgRoots = options.kgRoots ?? [
    "schemas",
    "library",
    "code-lists",
    "scenarios",
    "processes",
    "definitions",
  ];
  const kgFiles = loadCommittedKgFiles(kgRoots, repoRoot);

  // 3. Analyze pages & extract blocks
  let totalBytes = 0;
  let largestPage: PageBloatMetric | undefined;
  const blockMap = new Map<
    string,
    {
      hash: string;
      selector: string;
      tag: string;
      byteLength: number;
      pages: Set<string>;
      rawHtml: string;
      kgFile?: string;
    }
  >();

  for (const file of htmlFiles) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const relPage = relative(siteDir, file);
    const bytes = Buffer.byteLength(content, "utf-8");
    totalBytes += bytes;

    const pageBlocks = extractHtmlBlocks(content, relPage, { threshold });

    if (!largestPage || bytes > largestPage.byteLength) {
      largestPage = {
        path: relPage,
        byteLength: bytes,
        blockCount: pageBlocks.length,
      };
    }

    for (const b of pageBlocks) {
      const matchedKg = matchKgFile(b, kgFiles);
      const existing = blockMap.get(b.hash);
      if (existing) {
        existing.pages.add(relPage);
        if (!existing.kgFile && matchedKg) existing.kgFile = matchedKg;
      } else {
        blockMap.set(b.hash, {
          hash: b.hash,
          selector: b.selector,
          tag: b.tag,
          byteLength: b.byteLength,
          pages: new Set([relPage]),
          rawHtml: b.rawHtml,
          kgFile: matchedKg,
        });
      }
    }
  }

  // 4. Select candidates
  // Candidate if:
  // - Repeated across >= minOccurrences pages and >= threshold bytes, OR
  // - Matches a committed KG file
  const candidates: BloatCandidate[] = [];

  for (const item of blockMap.values()) {
    const occurrences = item.pages.size;
    const isRepeated = occurrences >= minOccurrences && item.byteLength >= threshold;
    const hasKgMatch = Boolean(item.kgFile);

    if (isRepeated || hasKgMatch) {
      const preview = item.rawHtml.slice(0, 150).replace(/\s+/g, " ").trim();
      const pagesList = Array.from(item.pages).sort();

      const classified = classifyCandidate({
        selector: item.selector,
        tag: item.tag,
        byteLength: item.byteLength,
        occurrences,
        kgFile: item.kgFile,
        rawHtml: item.rawHtml,
      });

      candidates.push({
        id: item.hash.slice(0, 12),
        selector: item.selector,
        tag: item.tag,
        byteLength: item.byteLength,
        occurrences,
        pages: pagesList,
        kgFile: item.kgFile,
        action: classified.action,
        reason: classified.reason,
        preview,
      });
    }
  }

  // Sort candidates: worst bloat first (action === "move", then highest byteLength * occurrences)
  candidates.sort((a, b) => {
    if (a.action === "move" && b.action !== "move") return -1;
    if (b.action === "move" && a.action !== "move") return 1;
    return b.byteLength * b.occurrences - a.byteLength * a.occurrences;
  });

  const moveCandidates = candidates.filter((c) => c.action === "move");
  const keepServerSideCandidates = candidates.filter((c) => c.action === "keep_serverside");
  const unsureCandidates = candidates.filter((c) => c.action === "unsure");

  // 5. Build KG-QA report
  const findings: KgFinding[] = [];
  for (const c of moveCandidates) {
    const pageListStr =
      c.pages.length <= 3
        ? c.pages.join(", ")
        : `${c.pages.slice(0, 3).join(", ")} (+${c.pages.length - 3} more)`;

    findings.push({
      where: `${c.selector} in ${pageListStr}`,
      detail: `Large redundant content (${c.byteLength} bytes, ${c.occurrences} page(s)) classified as \`move\`: ${c.reason}`,
    });
  }

  const result: "pass" | "fail" = findings.length > 0 ? "fail" : "pass";

  const report: KgQaReport = {
    $schema: KG_QA_SCHEMA,
    subject: {
      kind: "graph",
      id: "rendered-content-bloat",
      path: null,
    },
    source_hash: null,
    criteria: {
      [CRITERION_ID]: {
        result,
        findings,
      },
    },
    totals: tally({
      [CRITERION_ID]: {
        result,
        findings,
      },
    }),
  };

  // Validate output against schema
  KgQaReportSchema.parse(report);

  if (writeSidecar) {
    mkdirSync(dirname(sidecarPath), { recursive: true });
    writeFileSync(sidecarPath, JSON.stringify(report, null, 2) + "\n");
  }

  return {
    report,
    stats: {
      totalPages: htmlFiles.length,
      totalBytes,
      averageBytesPerPage: Math.round(totalBytes / htmlFiles.length),
      largestPage,
      candidateCount: candidates.length,
      moveCount: moveCandidates.length,
      keepServerSideCount: keepServerSideCandidates.length,
      unsureCount: unsureCandidates.length,
      candidates,
    },
  };
}

// CLI runner
if (import.meta.main) {
  const args = process.argv.slice(2);
  let siteDir: string | undefined;
  let threshold: number | undefined;
  let outPath: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--site" && args[i + 1]) {
      siteDir = args[++i];
    } else if (args[i] === "--threshold" && args[i + 1]) {
      threshold = Number(args[++i]);
    } else if (args[i] === "--out" && args[i + 1]) {
      outPath = args[++i];
    } else if (args[i] === "--json") {
      jsonOutput = true;
    }
  }

  const result = auditRenderedBloat({
    siteDir,
    threshold,
    sidecarPath: outPath,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { stats, report } = result;
    const criterion = report.criteria[CRITERION_ID];
    console.log(`[audit-rendered-bloat] Audited ${stats.totalPages} HTML page(s), ${stats.totalBytes} bytes total`);
    console.log(`[audit-rendered-bloat] Average page size: ${stats.averageBytesPerPage} bytes`);
    if (stats.largestPage) {
      console.log(`[audit-rendered-bloat] Largest page: ${stats.largestPage.path} (${stats.largestPage.byteLength} bytes)`);
    }
    console.log(`[audit-rendered-bloat] Candidates: ${stats.candidateCount} (${stats.moveCount} move, ${stats.keepServerSideCount} keep, ${stats.unsureCount} unsure)`);
    console.log(`[audit-rendered-bloat] Criterion result: ${criterion?.result ?? "unknown"} (${criterion?.findings.length ?? 0} finding(s))`);
  }
}
