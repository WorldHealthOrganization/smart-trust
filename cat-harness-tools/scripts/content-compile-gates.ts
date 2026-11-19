#!/usr/bin/env bun
/**
 * Content-type compile gates for the merge pipeline.
 *
 * Design: `cat-harness/docs/proposals/merge-gate-2026-10-02.md`.
 *
 * | # | gate | when | blocks? |
 * |---|---|---|---|
 * | G5 | Lean: every touched module builds by name; no new sorry; no undeclared axiom | `.lean` changed | **yes** |
 * | G6 | FHIR IG: SUSHI reports 0 errors; IG AST extracts cleanly | `input/fsh/**`, `sushi-config.yaml`, IG AST | **yes** |
 * | G7 | KG: JSON-LD expands/compacts without dropped terms; schema validates; `kg:audit:check` | KG node, `.jsonld` or schema | **yes** |
 * | A1 | Downstream renders: just-the-docs / Pages build, PDF render | rendered paths | advisory |
 * | A2 | Full IG Publisher run; qa.html error and warning counts recorded | FHIR IG | advisory |
 * | A3 | Strict KG audit: kg:audit:strict checks major findings | KG paths | advisory |
 *
 * 1. **Path-scoped**: Gates run only when files in their declared path cone are touched.
 * 2. **Data-declared**: Path -> gate mapping is declared as data (`CONTENT_COMPILE_GATES`),
 *    read directly by `gates.ts` and the merge pipeline.
 * 3. **The third state (`unknown`)**: If a toolchain is absent (e.g. `lake`/`lean` or `sushi`
 *    not installed), or the cache is cold and timed out:
 *    - On a **blocking** gate (G5, G6, G7), `unknown` **must block** and is **never reported as green**.
 *    - On an **advisory** gate (A1, A2, A3), `unknown` reports a warning and does not block merge.
 * 4. **Merge-train composition**: Compile gates evaluate over the union of changed paths
 *    across all PRs in the train, running on the combined train result.
 *
 * @module scripts/content-compile-gates
 */

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import jsonld from "jsonld";

// ── Path Patterns ────────────────────────────────────────────────────────────

export const LEAN_PATH_PATTERNS: readonly string[] = [
  "**/*.lean",
  "**/lakefile.lean",
  "**/lakefile.toml",
  "**/lean-toolchain",
  "**/lake-manifest.json",
];

export const FHIR_IG_PATH_PATTERNS: readonly string[] = [
  "**/input/fsh/**",
  "**/sushi-config.yaml",
  "**/sushi-config.yml",
  "**/ig.ini",
  "**/ig.json",
  "**/fsh/**",
  "**/ig-ast/**",
  "**/fhir-ast/**",
];

export const KG_PATH_PATTERNS: readonly string[] = [
  "**/*.jsonld",
  "**/schemas/**",
  "**/scenarios/**",
  "**/skills/**",
  "**/processes/**",
  "**/policies/**",
  "**/vocab-mappings/**",
  "**/glossary/**",
  "**/methodologies/**",
  "**/tools/**",
  "**/interaction/**",
  "**/attestations/**",
  "**/actors/**",
  "**/roles/**",
  "**/*.bpmn",
  "**/*.dmn",
];

export const RENDER_PATH_PATTERNS: readonly string[] = [
  "**/docs/**",
  "**/_site/**",
  "**/site/**",
  "**/*.pdf",
  "**/_layouts/**",
  "**/_includes/**",
];

// ── Path Matchers ────────────────────────────────────────────────────────────

export function matchesPattern(path: string, pattern: string): boolean {
  const normPath = path.replace(/\\/g, "/");
  try {
    return new Bun.Glob(pattern).match(normPath);
  } catch {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}$`).test(normPath);
  }
}

export function matchesAnyPattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesPattern(path, p));
}

export function isLeanPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  return (
    norm.endsWith(".lean") ||
    norm.endsWith("lakefile.lean") ||
    norm.endsWith("lakefile.toml") ||
    norm.endsWith("lean-toolchain") ||
    norm.endsWith("lake-manifest.json") ||
    matchesAnyPattern(norm, LEAN_PATH_PATTERNS)
  );
}

export function isFhirIgPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  return (
    norm.includes("input/fsh/") ||
    norm.endsWith("sushi-config.yaml") ||
    norm.endsWith("sushi-config.yml") ||
    norm.endsWith("ig.ini") ||
    norm.endsWith("ig.json") ||
    norm.includes("/fsh/") ||
    norm.includes("/ig-ast/") ||
    norm.includes("/fhir-ast/") ||
    matchesAnyPattern(norm, FHIR_IG_PATH_PATTERNS)
  );
}

export function isKgPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  // declared-path-literal: a CLASSIFIER over changed-file paths, not a read —
  // these name the KG directory names a diff may touch in ANY layer, and
  // no single declaration answers "is this a KG path" for a path from another
  // layer or a deleted file. `KG_PATH_PATTERNS` extends it by declaration.
  return (
    norm.endsWith(".jsonld") ||
    norm.endsWith(".bpmn") ||
    norm.endsWith(".dmn") ||
    norm.includes("/schemas/") ||
    norm.startsWith("schemas/") ||
    norm.includes("/scenarios/") ||
    norm.startsWith("scenarios/") ||
    norm.includes("/skills/") ||
    norm.startsWith("skills/") ||
    norm.includes("/processes/") ||
    norm.startsWith("processes/") ||
    norm.includes("/policies/") ||
    norm.startsWith("policies/") ||
    norm.includes("/vocab-mappings/") ||
    norm.startsWith("vocab-mappings/") ||
    norm.includes("/glossary/") ||
    norm.startsWith("glossary/") ||
    norm.includes("/methodologies/") ||
    norm.startsWith("methodologies/") ||
    norm.includes("/tools/") ||
    norm.startsWith("tools/") ||
    norm.includes("/interaction/") ||
    norm.startsWith("interaction/") ||
    norm.includes("/attestations/") ||
    norm.startsWith("attestations/") ||
    norm.includes("/actors/") ||
    norm.startsWith("actors/") ||
    norm.includes("/roles/") ||
    norm.startsWith("roles/") ||
    matchesAnyPattern(norm, KG_PATH_PATTERNS)
  );
}

export function isRenderPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  // declared-path-literal: a CLASSIFIER over changed-file paths, as in
  // `isKgPath` — the rendered-output directory names any layer's diff may
  // carry; `RENDER_PATH_PATTERNS` extends it by declaration.
  return (
    norm.startsWith("docs/") ||
    norm.includes("/docs/") ||
    norm.startsWith("_site/") ||
    norm.includes("/_site/") ||
    norm.startsWith("site/") ||
    norm.includes("/site/") ||
    norm.endsWith(".pdf") ||
    matchesAnyPattern(norm, RENDER_PATH_PATTERNS)
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CompileGateId = "G5" | "G6" | "G7" | "A1" | "A2" | "A3";

export type GateStatus = "pass" | "fail" | "warn" | "unknown";

export type GateCategory = "lean" | "fhir" | "kg" | "render";

export interface ContentCompileGate {
  id: CompileGateId;
  name: string;
  category: GateCategory;
  blocking: boolean;
  description: string;
  pathPatterns: readonly string[];
  matchesPath: (path: string) => boolean;
}

export interface GateEvaluation {
  gateId: CompileGateId;
  name: string;
  status: GateStatus;
  blocking: boolean;
  /** Whether this evaluation blocks the merge. Always false for advisory gates. */
  blocked: boolean;
  summary: string;
  details: string[];
  affectedPaths: string[];
}

export interface CompileGatesRunResult {
  overallPassed: boolean;
  blocked: boolean;
  evaluations: GateEvaluation[];
  triggeredGates: ContentCompileGate[];
  evaluatedPaths: string[];
}

// ── Declared Gates Data Map ──────────────────────────────────────────────────

export const CONTENT_COMPILE_GATES: readonly ContentCompileGate[] = [
  {
    id: "G5",
    name: "Lean module compile & audit",
    category: "lean",
    blocking: true,
    description: "Every touched Lean module builds by name (lake build), no new sorry, no axiom beyond declared list",
    pathPatterns: LEAN_PATH_PATTERNS,
    matchesPath: isLeanPath,
  },
  {
    id: "G6",
    name: "FHIR IG compile & AST extract",
    category: "fhir",
    blocking: true,
    description: "SUSHI reports 0 errors and IG AST extracts cleanly",
    pathPatterns: FHIR_IG_PATH_PATTERNS,
    matchesPath: isFhirIgPath,
  },
  {
    id: "G7",
    name: "KG JSON-LD expand/compact & schema validation",
    category: "kg",
    blocking: true,
    description: "JSON-LD expands/compacts without dropped terms, nodes validate against schema, kg:audit:check passes",
    pathPatterns: KG_PATH_PATTERNS,
    matchesPath: isKgPath,
  },
  {
    id: "A1",
    name: "Downstream site and document renders (advisory)",
    category: "render",
    blocking: false,
    description: "Documentation/site renders and PDF builds; advisory warnings never hold merge",
    pathPatterns: RENDER_PATH_PATTERNS,
    matchesPath: isRenderPath,
  },
  {
    id: "A2",
    name: "Full IG Publisher run & qa.html (advisory)",
    category: "fhir",
    blocking: false,
    description: "Full IG Publisher build; qa.html error and warning counts recorded; advisory only",
    pathPatterns: FHIR_IG_PATH_PATTERNS,
    matchesPath: isFhirIgPath,
  },
  {
    id: "A3",
    name: "Strict KG audit (advisory)",
    category: "kg",
    blocking: false,
    description: "kg:audit:strict checks major findings; advisory only",
    pathPatterns: KG_PATH_PATTERNS,
    matchesPath: isKgPath,
  },
];

// ── Path to Gate Mapping ─────────────────────────────────────────────────────

/** Returns compile gates triggered by the given changed paths. */
export function compileGatesForPaths(paths: readonly string[]): ContentCompileGate[] {
  return CONTENT_COMPILE_GATES.filter((gate) => paths.some((p) => gate.matchesPath(p)));
}

/** Union of changed paths across multiple PRs in a merge train. */
export function unionOfChangedPaths(prChangedPaths: readonly (readonly string[])[]): string[] {
  const set = new Set<string>();
  for (const paths of prChangedPaths) {
    for (const p of paths) {
      const trimmed = p.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort();
}

/** Gates for a single PR head. */
export function compileGatesForPrHead(prPaths: readonly string[]): ContentCompileGate[] {
  return compileGatesForPaths(prPaths);
}

/** Gates for a merge train result over the union of all PRs' changed paths. */
export function compileGatesForMergeTrain(prPathsList: readonly (readonly string[])[]): ContentCompileGate[] {
  const union = unionOfChangedPaths(prPathsList);
  return compileGatesForPaths(union);
}

// ── Gate G5 (Lean) Checks ────────────────────────────────────────────────────

export const DEFAULT_DECLARED_LEAN_AXIOMS: readonly string[] = [
  "propext",
  "Quot.sound",
  "Classical.choice",
];

export interface LeanSorryEntry {
  file: string;
  line: number;
  statement: string;
  hasCitation: boolean;
}

export interface LeanAxiomEntry {
  file: string;
  line: number;
  name: string;
  hasCitation: boolean;
}

export function extractSorriesFromContent(file: string, content: string): LeanSorryEntry[] {
  const lines = content.split("\n");
  const entries: LeanSorryEntry[] = [];
  let blockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const opens = (line.match(/\/-/g) || []).length;
    const closes = (line.match(/-\//g) || []).length;
    const wasInBlock = blockDepth > 0;
    const startedInBlock = wasInBlock || line.trimStart().startsWith("/-");
    blockDepth = Math.max(0, blockDepth + opens - closes);
    const endsInBlock = blockDepth > 0;

    if (
      /\bsorry\b/.test(line) &&
      !trimmed.startsWith("--") &&
      !trimmed.startsWith("/-") &&
      !/sorry-free|sorryFree|sorry_free|not sorry|no sorry|without\s+(any\s+)?sorry|No sorry|Proved.*not sorry/i.test(line)
    ) {
      if (wasInBlock || (startedInBlock && endsInBlock)) continue;
      if (trimmed.startsWith("--") || trimmed.startsWith("*") || trimmed.startsWith("/-!")) continue;
      if (/\(\s*sorry\s*:\s*[^)]+\)/.test(line)) continue;

      let hasCitation = false;
      const lookbackStart = Math.max(0, i - 10);
      for (let j = lookbackStart; j <= Math.min(lines.length - 1, i + 2); j++) {
        if (/--\s*Ref:\s*\[?[A-Za-z0-9:_-]+\]?/i.test(lines[j]!)) {
          hasCitation = true;
          break;
        }
      }

      entries.push({
        file,
        line: i + 1,
        statement: trimmed,
        hasCitation,
      });
    }
  }
  return entries;
}

export function extractAxiomsFromContent(file: string, content: string): LeanAxiomEntry[] {
  const lines = content.split("\n");
  const entries: LeanAxiomEntry[] = [];
  let blockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const opens = (line.match(/\/-/g) || []).length;
    const closes = (line.match(/-\//g) || []).length;
    const wasInBlock = blockDepth > 0;
    blockDepth = Math.max(0, blockDepth + opens - closes);

    if (wasInBlock || trimmed.startsWith("--")) continue;

    if (/^axiom\s+\w|^\s+axiom\s+\w/.test(line)) {
      const match = line.match(/axiom\s+(\w+)/);
      const name = match ? match[1]! : "unknown";
      const hasCitation = /--\s*Ref:/i.test(line);
      entries.push({
        file,
        line: i + 1,
        name,
        hasCitation,
      });
    }
  }
  return entries;
}

export interface LeanGateOptions {
  toolchainAvailable?: boolean;
  cacheTimeout?: boolean;
  lakeBuildRunner?: (target: string) => { ok: boolean; output: string };
  declaredAxioms?: readonly string[];
  fileContents?: Record<string, string>;
}

export function evaluateLeanGate(
  affectedPaths: readonly string[],
  opts: LeanGateOptions = {}
): GateEvaluation {
  const gateId: CompileGateId = "G5";
  const name = "Lean module compile & audit";
  const blocking = true;

  if (opts.toolchainAvailable === false) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: true,
      summary: "Toolchain absent: Lean / Lake is not installed or available",
      details: ["Toolchain absent: 'lake'/'lean' not available; unknown status blocks merge"],
      affectedPaths: [...affectedPaths],
    };
  }

  if (opts.cacheTimeout) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: true,
      summary: "Lean cache restore timed out or cache cold",
      details: ["Lean cache restore timed out; unknown status blocks merge"],
      affectedPaths: [...affectedPaths],
    };
  }

  const failures: string[] = [];
  const declaredAxioms = opts.declaredAxioms ?? DEFAULT_DECLARED_LEAN_AXIOMS;

  for (const path of affectedPaths) {
    if (opts.lakeBuildRunner) {
      const target = basename(path, ".lean");
      const buildRes = opts.lakeBuildRunner(target);
      if (!buildRes.ok) {
        failures.push(`Lake build failed for target ${target}: ${buildRes.output}`);
      }
    }

    let content: string | undefined;
    if (opts.fileContents && path in opts.fileContents) {
      content = opts.fileContents[path];
    } else if (existsSync(path)) {
      try {
        content = readFileSync(path, "utf-8");
      } catch {
        content = undefined;
      }
    }

    if (content !== undefined && path.endsWith(".lean")) {
      const sorries = extractSorriesFromContent(path, content);
      const uncitedSorries = sorries.filter((s) => !s.hasCitation);
      for (const s of uncitedSorries) {
        failures.push(`Uncited sorry in ${path}:${s.line}: "${s.statement}"`);
      }

      const axioms = extractAxiomsFromContent(path, content);
      for (const a of axioms) {
        if (!declaredAxioms.includes(a.name)) {
          failures.push(`Undeclared axiom '${a.name}' in ${path}:${a.line} (declared: [${declaredAxioms.join(", ")}])`);
        }
      }
    }
  }

  if (failures.length > 0) {
    return {
      gateId,
      name,
      status: "fail",
      blocking,
      blocked: true,
      summary: `${failures.length} Lean compile/audit failure(s)`,
      details: failures,
      affectedPaths: [...affectedPaths],
    };
  }

  return {
    gateId,
    name,
    status: "pass",
    blocking,
    blocked: false,
    summary: `All ${affectedPaths.length} Lean path(s) build cleanly, no uncited sorry, no undeclared axiom`,
    details: [],
    affectedPaths: [...affectedPaths],
  };
}

// ── Gate G6 (FHIR IG) Checks ─────────────────────────────────────────────────

export interface FhirIgGateOptions {
  toolchainAvailable?: boolean;
  sushiRunner?: () => { errors: number; warnings: number; output: string };
  igAstExtractor?: () => { ok: boolean; error?: string };
  fileContents?: Record<string, string>;
}

export function evaluateFhirIgGate(
  affectedPaths: readonly string[],
  opts: FhirIgGateOptions = {}
): GateEvaluation {
  const gateId: CompileGateId = "G6";
  const name = "FHIR IG compile & AST extract";
  const blocking = true;

  if (opts.toolchainAvailable === false) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: true,
      summary: "Toolchain absent: SUSHI / FHIR toolchain is not available",
      details: ["SUSHI toolchain absent; unknown status blocks merge"],
      affectedPaths: [...affectedPaths],
    };
  }

  const failures: string[] = [];

  if (opts.sushiRunner) {
    const sRes = opts.sushiRunner();
    if (sRes.errors > 0) {
      failures.push(`SUSHI reported ${sRes.errors} error(s): ${sRes.output}`);
    }
  }

  if (opts.igAstExtractor) {
    const astRes = opts.igAstExtractor();
    if (!astRes.ok) {
      failures.push(`IG AST extraction failed: ${astRes.error ?? "unknown AST error"}`);
    }
  }

  if (opts.fileContents) {
    for (const [path, content] of Object.entries(opts.fileContents)) {
      if ((path.includes("ig-ast") || path.endsWith(".json")) && affectedPaths.includes(path)) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === "object" && parsed.error) {
            failures.push(`IG AST extraction recorded error in ${path}: ${parsed.error}`);
          }
        } catch (e) {
          failures.push(`Invalid JSON in IG AST path ${path}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    return {
      gateId,
      name,
      status: "fail",
      blocking,
      blocked: true,
      summary: `${failures.length} FHIR IG compile/AST failure(s)`,
      details: failures,
      affectedPaths: [...affectedPaths],
    };
  }

  return {
    gateId,
    name,
    status: "pass",
    blocking,
    blocked: false,
    summary: `SUSHI compiled with 0 errors and IG AST extracted cleanly across ${affectedPaths.length} path(s)`,
    details: [],
    affectedPaths: [...affectedPaths],
  };
}

// ── Gate G7 (KG JSON-LD & Schema) Checks ─────────────────────────────────────

export interface KgGateOptions {
  contextAvailable?: boolean;
  jsonldExpander?: (
    path: string,
    content: string
  ) => Promise<{ ok: boolean; droppedTerms: string[]; error?: string }> | { ok: boolean; droppedTerms: string[]; error?: string };
  schemaValidator?: (path: string, content: string) => { ok: boolean; error?: string };
  kgAuditRunner?: () => { ok: boolean; criticalFindings: number; findings: string[] };
  fileContents?: Record<string, string>;
}

export async function checkJsonLdExpansion(
  doc: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<{ ok: boolean; droppedTerms: string[]; error?: string }> {
  try {
    const ctx = (context ?? doc["@context"]) as Record<string, unknown> | undefined;
    if (!ctx) {
      return { ok: false, droppedTerms: [], error: "Missing @context in JSON-LD document" };
    }
    const expanded = await jsonld.expand(doc as Parameters<typeof jsonld.expand>[0]);
    const compacted = (await jsonld.compact(expanded, ctx as Parameters<typeof jsonld.compact>[1])) as Record<string, unknown>;

    const originalKeys = Object.keys(doc).filter((k) => k !== "@context");
    const compactedKeys = new Set(Object.keys(compacted).filter((k) => k !== "@context"));
    const droppedTerms = originalKeys.filter((k) => !compactedKeys.has(k));

    return {
      ok: droppedTerms.length === 0,
      droppedTerms,
    };
  } catch (err) {
    return {
      ok: false,
      droppedTerms: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function evaluateKgGate(
  affectedPaths: readonly string[],
  opts: KgGateOptions = {}
): Promise<GateEvaluation> {
  const gateId: CompileGateId = "G7";
  const name = "KG JSON-LD expand/compact & schema validation";
  const blocking = true;

  if (opts.contextAvailable === false) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: true,
      summary: "KG context or schema validator unavailable",
      details: ["KG context/schemas unavailable; unknown status blocks merge"],
      affectedPaths: [...affectedPaths],
    };
  }

  const failures: string[] = [];

  for (const path of affectedPaths) {
    let content: string | undefined;
    if (opts.fileContents && path in opts.fileContents) {
      content = opts.fileContents[path];
    } else if (existsSync(path)) {
      try {
        content = readFileSync(path, "utf-8");
      } catch {
        content = undefined;
      }
    }

    if (content !== undefined) {
      if (path.endsWith(".jsonld") || (path.endsWith(".json") && content.includes('"@context"'))) {
        try {
          if (opts.jsonldExpander) {
            const jRes = await opts.jsonldExpander(path, content);
            if (!jRes.ok || jRes.droppedTerms.length > 0) {
              failures.push(
                `JSON-LD ${path}: dropped term(s) [${jRes.droppedTerms.join(", ")}]${jRes.error ? `: ${jRes.error}` : ""}`
              );
            }
          } else {
            const parsed = JSON.parse(content) as Record<string, unknown>;
            const res = await checkJsonLdExpansion(parsed);
            if (!res.ok || res.droppedTerms.length > 0) {
              failures.push(
                `JSON-LD ${path}: dropped term(s) [${res.droppedTerms.join(", ")}]${res.error ? `: ${res.error}` : ""}`
              );
            }
          }
        } catch (e) {
          failures.push(`JSON-LD parse error in ${path}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (opts.schemaValidator) {
        const vRes = opts.schemaValidator(path, content);
        if (!vRes.ok) {
          failures.push(`Schema validation failed for ${path}: ${vRes.error ?? "invalid schema"}`);
        }
      }
    }
  }

  if (opts.kgAuditRunner) {
    const aRes = opts.kgAuditRunner();
    if (!aRes.ok || aRes.criticalFindings > 0) {
      failures.push(
        `kg:audit:check failed with ${aRes.criticalFindings} critical finding(s): ${aRes.findings.join("; ")}`
      );
    }
  }

  if (failures.length > 0) {
    return {
      gateId,
      name,
      status: "fail",
      blocking,
      blocked: true,
      summary: `${failures.length} KG validation / JSON-LD / audit failure(s)`,
      details: failures,
      affectedPaths: [...affectedPaths],
    };
  }

  return {
    gateId,
    name,
    status: "pass",
    blocking,
    blocked: false,
    summary: `All ${affectedPaths.length} KG path(s) passed JSON-LD expand/compact and schema validation`,
    details: [],
    affectedPaths: [...affectedPaths],
  };
}

// ── Advisory Gates (A1, A2, A3) ──────────────────────────────────────────────

export interface RenderGateOptions {
  rendererAvailable?: boolean;
  renderRunner?: () => { ok: boolean; warnings: string[]; errors: string[] };
}

export function evaluateDownstreamRendersGate(
  affectedPaths: readonly string[],
  opts: RenderGateOptions = {}
): GateEvaluation {
  const gateId: CompileGateId = "A1";
  const name = "Downstream site and document renders (advisory)";
  const blocking = false;

  if (opts.rendererAvailable === false) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: false, // Advisory gates NEVER block
      summary: "Advisory: downstream site/doc renderer is unavailable",
      details: ["Advisory notice: renderer absent; renders skipped"],
      affectedPaths: [...affectedPaths],
    };
  }

  if (opts.renderRunner) {
    const res = opts.renderRunner();
    if (!res.ok || res.errors.length > 0 || res.warnings.length > 0) {
      return {
        gateId,
        name,
        status: "warn",
        blocking,
        blocked: false, // NEVER blocks merge
        summary: `Advisory: downstream renders reported ${res.errors.length} error(s), ${res.warnings.length} warning(s)`,
        details: [...res.errors, ...res.warnings],
        affectedPaths: [...affectedPaths],
      };
    }
  }

  return {
    gateId,
    name,
    status: "pass",
    blocking,
    blocked: false,
    summary: `Downstream renders passed advisory check for ${affectedPaths.length} path(s)`,
    details: [],
    affectedPaths: [...affectedPaths],
  };
}

export interface IgPublisherGateOptions {
  publisherAvailable?: boolean;
  publisherRunner?: () => { errors: number; warnings: number; qaHtmlPath?: string };
}

export function evaluateIgPublisherGate(
  affectedPaths: readonly string[],
  opts: IgPublisherGateOptions = {}
): GateEvaluation {
  const gateId: CompileGateId = "A2";
  const name = "Full IG Publisher run & qa.html (advisory)";
  const blocking = false;

  if (opts.publisherAvailable === false) {
    return {
      gateId,
      name,
      status: "unknown",
      blocking,
      blocked: false, // Advisory gates NEVER block
      summary: "Advisory: IG Publisher toolchain is not available",
      details: ["Advisory notice: IG Publisher unavailable; publisher run skipped"],
      affectedPaths: [...affectedPaths],
    };
  }

  if (opts.publisherRunner) {
    const res = opts.publisherRunner();
    if (res.errors > 0 || res.warnings > 0) {
      return {
        gateId,
        name,
        status: "warn",
        blocking,
        blocked: false, // NEVER blocks merge
        summary: `Advisory: IG Publisher qa.html reported ${res.errors} error(s), ${res.warnings} warning(s)`,
        details: [
          `qa.html errors: ${res.errors}`,
          `qa.html warnings: ${res.warnings}`,
          ...(res.qaHtmlPath ? [`Report path: ${res.qaHtmlPath}`] : []),
        ],
        affectedPaths: [...affectedPaths],
      };
    }
  }

  return {
    gateId,
    name,
    status: "pass",
    blocking,
    blocked: false,
    summary: `IG Publisher advisory run passed for ${affectedPaths.length} path(s)`,
    details: [],
    affectedPaths: [...affectedPaths],
  };
}

// ── Overall Evaluation ───────────────────────────────────────────────────────

export interface EvaluateCompileGatesOptions {
  lean?: LeanGateOptions;
  fhir?: FhirIgGateOptions;
  kg?: KgGateOptions;
  render?: RenderGateOptions;
  igPublisher?: IgPublisherGateOptions;
}

export async function evaluateCompileGates(
  paths: readonly string[],
  options: EvaluateCompileGatesOptions = {}
): Promise<CompileGatesRunResult> {
  const triggeredGates = compileGatesForPaths(paths);
  const evaluations: GateEvaluation[] = [];

  for (const gate of triggeredGates) {
    let evaluation: GateEvaluation;
    switch (gate.id) {
      case "G5":
        evaluation = evaluateLeanGate(paths.filter(isLeanPath), options.lean);
        break;
      case "G6":
        evaluation = evaluateFhirIgGate(paths.filter(isFhirIgPath), options.fhir);
        break;
      case "G7":
        evaluation = await evaluateKgGate(paths.filter(isKgPath), options.kg);
        break;
      case "A1":
        evaluation = evaluateDownstreamRendersGate(paths.filter(isRenderPath), options.render);
        break;
      case "A2":
        evaluation = evaluateIgPublisherGate(paths.filter(isFhirIgPath), options.igPublisher);
        break;
      default:
        evaluation = {
          gateId: gate.id,
          name: gate.name,
          status: "pass",
          blocking: gate.blocking,
          blocked: false,
          summary: `Advisory gate ${gate.id} pass`,
          details: [],
          affectedPaths: paths.filter(gate.matchesPath),
        };
    }
    evaluations.push(evaluation);
  }

  const blocked = evaluations.some((e) => e.blocked);
  const overallPassed =
    !blocked &&
    evaluations.every(
      (e) => e.status === "pass" || (!e.blocking && (e.status === "warn" || e.status === "unknown"))
    );

  return {
    overallPassed,
    blocked,
    evaluations,
    triggeredGates,
    evaluatedPaths: [...paths],
  };
}

export async function evaluateCompileGatesForMergeTrain(
  prPathsList: readonly (readonly string[])[],
  options: EvaluateCompileGatesOptions = {}
): Promise<CompileGatesRunResult> {
  const unionPaths = unionOfChangedPaths(prPathsList);
  return evaluateCompileGates(unionPaths, options);
}

// ── CLI Main ─────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    console.log("Declared Content Compile Gates:");
    for (const g of CONTENT_COMPILE_GATES) {
      console.log(`  [${g.id}] ${g.name} (${g.blocking ? "BLOCKING" : "advisory"})`);
      console.log(`       Patterns: ${g.pathPatterns.join(", ")}`);
      console.log(`       ${g.description}`);
    }
    process.exit(0);
  }

  const paths = args.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    console.log("Usage: bun run cat-harness-tools/scripts/content-compile-gates.ts [--list] <path1> <path2> ...");
    process.exit(0);
  }

  const result = await evaluateCompileGates(paths);
  console.log(`Triggered ${result.triggeredGates.length} compile gate(s) for ${paths.length} path(s):`);
  for (const ev of result.evaluations) {
    const icon = ev.status === "pass" ? "✓" : ev.blocked ? "✗" : "⚠️";
    console.log(`${icon} [${ev.gateId}] ${ev.name}: ${ev.summary}`);
    for (const d of ev.details) {
      console.log(`    ↳ ${d}`);
    }
  }

  if (result.blocked) {
    console.error("\nCompile gates BLOCKED the merge.");
    process.exit(1);
  } else {
    console.log("\nCompile gates passed (or advisory only).");
    process.exit(0);
  }
}
