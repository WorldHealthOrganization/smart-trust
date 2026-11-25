#!/usr/bin/env bun
/**
 * Traceability matrix and audit joining beans to content blocks and Lean declarations.
 *
 * Maps:
 *   Bean -> Target block labels / files -> lean.ref -> Lean declarations
 *
 * Distinguishes:
 *   - Explicit targets: declared via `targets: [...]` in front-matter
 *   - Inferred targets: extracted from bean title / body (`sec:...`, `def:...`, `thm:...`, etc.)
 *
 * Computes coverage:
 *   - blocks with no associated bean
 *   - beans with no declared/inferred target
 *   - coverage percentages
 *
 * Supports `--json` flag and formatted CLI output.
 *
 * @module scripts/trace-work
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { readBeans, resolveBeanDefs, type BeanNode } from "./beans.ts";
import { folioDir } from "../schemas/kg/cat-harness.ts";
import { walkBlocks } from "../pipeline/qa-utils.ts";
import { KNOWN_LABEL_PREFIXES } from "../schemas/constraints.ts";
import type { KgCriterionEntry, KgFinding } from "../schemas/sdlc/kg-qa.ts";

/**
 * A target reference from a bean (explicit or inferred).
 */
export interface TargetRef {
  /** The target string as written, e.g. "def:quantum-universe" or "qou:QOU.QuantumUniverse". */
  target: string;
  /** Whether declared in front-matter `targets` or inferred from title/body. */
  source: "explicit" | "inferred";
  /** Resolved block label, if this target matched a content block. */
  blockLabel?: string;
  /** Resolved block file path. */
  blockFile?: string;
  /** Resolved Lean declaration URI (lean.ref), if any. */
  leanRef?: string;
  /** Resolved Lean declaration name, if any. */
  leanDeclaration?: string;
  /** Resolved Lean file, if any. */
  leanFile?: string;
  /** Whether this target successfully resolved to a block or Lean declaration. */
  resolved: boolean;
}

/**
 * A bean in the traceability matrix.
 */
export interface TraceableBean {
  id: string;
  title: string;
  status: string;
  type: string;
  file: string;
  explicitTargets: string[];
  inferredTargets: string[];
  targets: TargetRef[];
}

/**
 * A content block in the traceability matrix.
 */
export interface TraceableBlock {
  label: string;
  kind: string;
  file: string;
  root: string;
  mdFile?: string;
  leanFile?: string;
  leanRef?: string;
  leanDeclaration?: string;
  associatedBeans: Array<{
    id: string;
    source: "explicit" | "inferred";
  }>;
}

/**
 * Coverage summary statistics.
 */
export interface TraceabilityCoverage {
  totalBeans: number;
  beansWithTargets: number;
  beansWithoutTargets: number;
  beansWithNoTargets: string[];
  beanTargetCoveragePercent: number;

  totalBlocks: number;
  coveredBlocks: number;
  uncoveredBlocks: number;
  blocksWithNoBean: string[];
  blockCoveragePercent: number;

  totalExplicitTargets: number;
  totalInferredTargets: number;
  resolvedTargets: number;
  unresolvedTargets: number;
}

/**
 * Complete traceability report.
 */
export interface TraceabilityReport {
  beans: TraceableBean[];
  blocks: TraceableBlock[];
  coverage: TraceabilityCoverage;
}

/** Options for building the traceability matrix. */
export interface TraceOptions {
  root?: string;
  contentDir?: string;
  beanDefsDir?: string;
  beans?: BeanNode[];
  blocks?: TraceableBlock[];
}

/**
 * Extract explicit targets from bean front-matter or bean node.
 */
export function extractExplicitTargets(frontMatterOrBean: unknown): string[] {
  if (!frontMatterOrBean || typeof frontMatterOrBean !== "object") return [];
  const obj = frontMatterOrBean as Record<string, unknown>;

  let rawTargets: unknown = obj.targets;
  if (!rawTargets && typeof obj.body === "string") {
    // Check if targets can be parsed from front matter in body or file
    const m = /^targets:\s*\[(.*)\]/m.exec(obj.body);
    if (m) {
      rawTargets = m[1]!.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
    }
  }

  if (Array.isArray(rawTargets)) {
    return [
      ...new Set(
        rawTargets
          .map((t) => (typeof t === "string" ? t.trim().replace(/^['"]|['"]$/g, "") : ""))
          .filter((t) => t.length > 0),
      ),
    ];
  }
  if (typeof rawTargets === "string" && rawTargets.trim().length > 0) {
    return [rawTargets.trim().replace(/^['"]|['"]$/g, "")];
  }
  return [];
}

/**
 * Extract inferred targets (block labels, Lean declarations) mentioned in prose/titles.
 */
export function extractInferredTargets(text: string, explicitTargets: string[] = []): string[] {
  if (!text) return [];

  const explicitSet = new Set(explicitTargets);
  const found: string[] = [];

  // 1. Block labels: prefix:slug e.g. sec:intro, def:foo, thm:bar-123
  // Match known block label prefixes (def, thm, sec, prop, lem, etc.)
  const knownPrefixes = KNOWN_LABEL_PREFIXES.map((p) => p.replace(/:$/, ""));
  const prefixAlt = knownPrefixes.join("|");
  const labelRe = new RegExp(`\\b((?:${prefixAlt}):[a-zA-Z0-9/._-]+)\\b`, "g");
  let match: RegExpExecArray | null;
  while ((match = labelRe.exec(text)) !== null) {
    let candidate = match[1]!;
    // Clean trailing punctuation
    candidate = candidate.replace(/[.,;:!?)\]'"-]+$/, "");
    if (!explicitSet.has(candidate) && !found.includes(candidate)) {
      found.push(candidate);
    }
  }

  // 2. Package-qualified Lean declaration URIs: pkg:Namespace.Decl
  const leanRefRe = /\b([a-zA-Z0-9_-]+:[A-Z][a-zA-Z0-9_]*(?:\.[A-Za-z0-9_]+)+)\b/g;
  while ((match = leanRefRe.exec(text)) !== null) {
    const candidate = match[1]!.replace(/[.,;:!?)\]'"-]+$/, "");
    if (!explicitSet.has(candidate) && !found.includes(candidate)) {
      found.push(candidate);
    }
  }

  // 3. Bare qualified Lean declarations: Namespace.Decl e.g. QOU.QuantumUniverse or QOU.TransferMatrix.lifting_exists
  const bareLeanRe = /\b([A-Z][a-zA-Z0-9_]*(?:\.[A-Za-z0-9_]+)+)\b/g;
  while ((match = bareLeanRe.exec(text)) !== null) {
    const candidate = match[1]!.replace(/[.,;:!?)\]'"-]+$/, "");
    // Avoid matching typical file extensions like Math.MD
    if (/\.(md|ts|js|json|jsonld|lean)$/i.test(candidate)) continue;
    // Don't add if already captured as part of a package-qualified ref e.g. pkg:candidate
    const alreadyAsPkgRef = found.some((f) => f.endsWith(`:${candidate}`));
    if (!alreadyAsPkgRef && !explicitSet.has(candidate) && !found.includes(candidate)) {
      found.push(candidate);
    }
  }

  return found;
}

/**
 * Scan content blocks from disk.
 */
export function collectBlocks(root: string, contentDir?: string): TraceableBlock[] {
  const dirsToTry: string[] = [];
  if (contentDir) {
    dirsToTry.push(resolve(contentDir));
  } else {
    const candidateContent = join(root, "content");
    const candidateFolio = folioDir(root);
    if (existsSync(candidateContent)) dirsToTry.push(candidateContent);
    if (existsSync(candidateFolio)) dirsToTry.push(candidateFolio);
    if (dirsToTry.length === 0 && existsSync(root)) {
      // Check if root itself directly has block manifests
      dirsToTry.push(resolve(root));
    }
  }

  const blocks: TraceableBlock[] = [];
  const seenLabels = new Set<string>();

  for (const dir of dirsToTry) {
    if (!existsSync(dir)) continue;
    try {
      for (const b of walkBlocks(dir, { verify: false, onLoadFailure: () => {} })) {
        if (seenLabels.has(b.label)) continue;
        seenLabels.add(b.label);

        let leanRef: string | undefined;
        let leanDeclaration: string | undefined;

        if (existsSync(b.ts)) {
          const tsSrc = readFileSync(b.ts, "utf-8");
          const refMatch = tsSrc.match(/ref:\s*["']([^"']+)["']/);
          if (refMatch) {
            leanRef = refMatch[1]!;
            const parts = leanRef.split(":");
            leanDeclaration = parts.length > 1 ? parts[1] : parts[0];
          }
        }

        blocks.push({
          label: b.label,
          kind: b.kind,
          file: b.ts,
          root: b.root,
          mdFile: b.md,
          leanFile: b.lean,
          leanRef,
          leanDeclaration,
          associatedBeans: [],
        });
      }
    } catch {
      // Walker failure or not a content directory
    }
  }

  return blocks.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Collect beans from bean store or files.
 */
export function collectBeans(root: string, beanDefsDir?: string): BeanNode[] {
  if (beanDefsDir && existsSync(beanDefsDir)) {
    const out: BeanNode[] = [];
    for (const name of readdirSync(beanDefsDir).sort()) {
      if (!name.endsWith(".md")) continue;
      const path = join(beanDefsDir, name);
      const text = readFileSync(path, "utf-8");
      const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
      if (!m) continue;
      const fm = m[1]!;
      const id = (/^#\s*(\S+)/m.exec(fm) ?? [, name.replace(/\.md$/, "")])[1]!;
      const field = (k: string) => {
        const v = new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim();
        return v?.replace(/^["']|["']$/g, "") ?? "";
      };
      const seq = (k: string): string[] => {
        const block = new RegExp(`^${k}:\\s*\\n((?:[ \\t]+-[ \\t]*\\S.*\\n?)+)`, "m").exec(fm);
        if (block) {
          return block[1]!
            .split("\n")
            .map((l) => l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, ""))
            .filter((s) => s.length > 0);
        }
        const flow = new RegExp(`^${k}:\\s*\\[(.*)\\]\\s*$`, "m").exec(fm);
        if (flow) {
          return flow[1]!.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter((s) => s.length > 0);
        }
        return [];
      };

      out.push({
        id,
        file: relative(root, path),
        title: field("title"),
        status: field("status") || "todo",
        type: field("type") || "task",
        priority: field("priority"),
        parent: field("parent"),
        blocking: seq("blocking"),
        createdAt: field("created_at"),
        updatedAt: field("updated_at"),
        body: m[2]!,
        targets: seq("targets"),
      });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  try {
    const list = readBeans(root);
    if (list && list.length > 0) return list;
  } catch {
    // continue to fallbacks
  }

  // Fallback checks
  // The store the graph declares first (`resolveBeanDefs`), then a bare
  // `defs/` beside the root.
  let declared: string | null = null;
  try {
    declared = resolveBeanDefs(root).dir;
  } catch {
    declared = null;
  }
  const candidates = [...(declared !== null ? [declared] : []), join(root, "defs")];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      const beans = collectBeans(root, dir);
      if (beans.length > 0) return beans;
    }
  }

  return [];
}

/**
 * Builds the complete traceability matrix joining beans to content blocks and declarations.
 */
export function buildTraceability(options: TraceOptions = {}): TraceabilityReport {
  const root = resolve(options.root ?? process.cwd());
  const beansRaw = options.beans ?? collectBeans(root, options.beanDefsDir);
  const blocks = options.blocks ? options.blocks.map((b) => ({ ...b, associatedBeans: [...b.associatedBeans] })) : collectBlocks(root, options.contentDir);

  const blockMap = new Map<string, TraceableBlock>();
  const declMap = new Map<string, TraceableBlock>();

  for (const block of blocks) {
    blockMap.set(block.label, block);
    if (block.leanRef) {
      declMap.set(block.leanRef, block);
    }
    if (block.leanDeclaration) {
      declMap.set(block.leanDeclaration, block);
    }
    const stem = basename(block.file).replace(/\.ts$/, "");
    if (!blockMap.has(stem)) {
      blockMap.set(stem, block);
    }
  }

  const traceableBeans: TraceableBean[] = [];
  let totalExplicitTargets = 0;
  let totalInferredTargets = 0;
  let resolvedTargets = 0;
  let unresolvedTargets = 0;

  for (const bean of beansRaw) {
    const explicitTargets = extractExplicitTargets(bean);
    const inferredTargets = extractInferredTargets(`${bean.title}\n${bean.body}`, explicitTargets);

    totalExplicitTargets += explicitTargets.length;
    totalInferredTargets += inferredTargets.length;

    const targetRefs: TargetRef[] = [];

    const processTarget = (targetStr: string, source: "explicit" | "inferred") => {
      // Attempt matching to block
      let matchedBlock = blockMap.get(targetStr);
      if (!matchedBlock && declMap.has(targetStr)) {
        matchedBlock = declMap.get(targetStr);
      }
      if (!matchedBlock) {
        // Try case-insensitive or partial lean declaration matching
        for (const [decl, blk] of declMap.entries()) {
          if (decl.toLowerCase() === targetStr.toLowerCase() || decl.endsWith(`.${targetStr}`)) {
            matchedBlock = blk;
            break;
          }
        }
      }

      if (matchedBlock) {
        resolvedTargets++;
        targetRefs.push({
          target: targetStr,
          source,
          blockLabel: matchedBlock.label,
          blockFile: matchedBlock.file,
          leanRef: matchedBlock.leanRef,
          leanDeclaration: matchedBlock.leanDeclaration,
          leanFile: matchedBlock.leanFile,
          resolved: true,
        });

        if (!matchedBlock.associatedBeans.some((ab) => ab.id === bean.id)) {
          matchedBlock.associatedBeans.push({ id: bean.id, source });
        }
      } else {
        unresolvedTargets++;
        targetRefs.push({
          target: targetStr,
          source,
          resolved: false,
        });
      }
    };

    for (const t of explicitTargets) processTarget(t, "explicit");
    for (const t of inferredTargets) processTarget(t, "inferred");

    traceableBeans.push({
      id: bean.id,
      title: bean.title,
      status: bean.status,
      type: bean.type,
      file: bean.file,
      explicitTargets,
      inferredTargets,
      targets: targetRefs,
    });
  }

  // Coverage statistics
  const totalBeans = traceableBeans.length;
  const beansWithTargetsList = traceableBeans.filter((b) => b.explicitTargets.length + b.inferredTargets.length > 0);
  const beansWithTargets = beansWithTargetsList.length;
  const beansWithoutTargets = totalBeans - beansWithTargets;
  const beansWithNoTargets = traceableBeans
    .filter((b) => b.explicitTargets.length + b.inferredTargets.length === 0)
    .map((b) => b.id);
  const beanTargetCoveragePercent =
    totalBeans > 0 ? Number(((beansWithTargets / totalBeans) * 100).toFixed(1)) : 0;

  const totalBlocks = blocks.length;
  const coveredBlocksList = blocks.filter((b) => b.associatedBeans.length > 0);
  const coveredBlocks = coveredBlocksList.length;
  const uncoveredBlocks = totalBlocks - coveredBlocks;
  const blocksWithNoBean = blocks.filter((b) => b.associatedBeans.length === 0).map((b) => b.label);
  const blockCoveragePercent =
    totalBlocks > 0 ? Number(((coveredBlocks / totalBlocks) * 100).toFixed(1)) : 0;

  const coverage: TraceabilityCoverage = {
    totalBeans,
    beansWithTargets,
    beansWithoutTargets,
    beansWithNoTargets,
    beanTargetCoveragePercent,

    totalBlocks,
    coveredBlocks,
    uncoveredBlocks,
    blocksWithNoBean,
    blockCoveragePercent,

    totalExplicitTargets,
    totalInferredTargets,
    resolvedTargets,
    unresolvedTargets,
  };

  return {
    beans: traceableBeans,
    blocks,
    coverage,
  };
}

/**
 * Evaluates the `work-traceability-audit` QA criterion.
 *
 * Vacuity-guarded: returns `unknown` when 0 beans or 0 blocks exist.
 */
export function evaluateTraceabilityAudit(options: TraceOptions = {}): KgCriterionEntry {
  const report = buildTraceability(options);
  const { coverage } = report;

  // Vacuity guard: returns unknown when 0 beans or blocks exist
  if (coverage.totalBeans === 0 || coverage.totalBlocks === 0) {
    return {
      result: "unknown",
      findings: [
        {
          where: "traceability",
          detail: `traceability vacuous: ${coverage.totalBeans} bean(s) and ${coverage.totalBlocks} block(s) found (requires both to audit traceability)`,
        },
      ],
    };
  }

  const findings: KgFinding[] = [];

  // Blocks with no associated bean
  for (const blockLabel of coverage.blocksWithNoBean) {
    findings.push({
      where: blockLabel,
      detail: `content block "${blockLabel}" has no associated bean in work plan`,
    });
  }

  // Beans with no declared or inferred targets
  for (const beanId of coverage.beansWithNoTargets) {
    findings.push({
      where: beanId,
      detail: `bean "${beanId}" has no declared or inferred target blocks or declarations`,
    });
  }

  // Unresolved explicit targets
  for (const bean of report.beans) {
    for (const target of bean.targets) {
      if (target.source === "explicit" && !target.resolved) {
        findings.push({
          where: `${bean.id} -> ${target.target}`,
          detail: `target "${target.target}" declared by bean "${bean.id}" does not resolve to any content block or Lean declaration`,
        });
      }
    }
  }

  if (findings.length > 0) {
    return {
      result: "fail",
      findings,
    };
  }

  return {
    result: "pass",
    findings: [],
  };
}

/** Format human-readable CLI summary. */
export function formatTraceabilityReport(report: TraceabilityReport): string {
  const { coverage, beans } = report;
  const lines: string[] = [];

  lines.push("=== Work Traceability Report ===");
  lines.push("");
  lines.push(`Beans:  ${coverage.totalBeans} total, ${coverage.beansWithTargets} with targets (${coverage.beanTargetCoveragePercent}%)`);
  lines.push(`Blocks: ${coverage.totalBlocks} total, ${coverage.coveredBlocks} covered (${coverage.blockCoveragePercent}%)`);
  lines.push(`Targets: ${coverage.totalExplicitTargets} explicit, ${coverage.totalInferredTargets} inferred; ${coverage.resolvedTargets} resolved, ${coverage.unresolvedTargets} unresolved`);
  lines.push("");

  if (coverage.blocksWithNoBean.length > 0) {
    lines.push(`[Blocks with no associated Bean] (${coverage.blocksWithNoBean.length})`);
    for (const b of coverage.blocksWithNoBean) {
      lines.push(`  · ${b}`);
    }
    lines.push("");
  }

  if (coverage.beansWithNoTargets.length > 0) {
    lines.push(`[Beans with no Target] (${coverage.beansWithNoTargets.length})`);
    for (const id of coverage.beansWithNoTargets) {
      lines.push(`  · ${id}`);
    }
    lines.push("");
  }

  lines.push("[Trace Matrix: Beans -> Targets -> Blocks -> Lean]");
  for (const bean of beans) {
    if (bean.targets.length === 0) continue;
    lines.push(`  ${bean.id} [${bean.status}] "${bean.title}"`);
    for (const t of bean.targets) {
      const resStr = t.resolved ? "✓" : "✗ (unresolved)";
      const leanStr = t.leanRef ? ` -> ${t.leanRef}` : "";
      lines.push(`    -> [${t.source}] ${t.target} ${resStr}${leanStr}`);
    }
  }

  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
  const contentIndex = args.indexOf("--content");
  const contentDir = contentIndex >= 0 ? args[contentIndex + 1] : undefined;
  const beansIndex = args.indexOf("--beans");
  const beanDefsDir = beansIndex >= 0 ? args[beansIndex + 1] : undefined;

  const report = buildTraceability({ root, contentDir, beanDefsDir });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatTraceabilityReport(report));
  }
}
