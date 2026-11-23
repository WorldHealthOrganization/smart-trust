/**
 * Reference resolution checker for content blocks.
 *
 * Verifies that:
 * 1. `computation.script` paths resolve against declared computation directories or layer paths.
 * 2. Relative links and references in block manifests resolve against declared directories.
 * 3. `{{...}}` macro templates in prose resolve against declared templates/macros or known symbols.
 * 4. Third-state rule: if a directory is undeclared or absent from disk, return undetermined/unknown rather than false pass or false clean.
 * 5. Vacuity guard: an audit over zero blocks returns unknown, never a pass.
 *
 * @module scripts/block-reference-resolver
 * @covers folio
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { folioDir as folioDirOf, readDeclaration } from "../schemas/kg/cat-harness.js";
import {
  KG_QA_SCHEMA,
  tally,
  type KgCriterionEntry,
  type KgFinding,
  type KgQaReport,
  type KgResult,
} from "../schemas/sdlc/kg-qa.js";

export const BLOCK_REFERENCE_RESOLVES_CRITERION = "block-reference-resolves";

export interface BlockInput {
  label: string;
  kind?: string;
  file?: string;
  computation?: {
    engine?: string;
    script?: string;
    witness?: string | string[];
    status?: string;
    [key: string]: unknown;
  };
  simulator?: {
    html?: string;
    [key: string]: unknown;
  };
  figure?: {
    src?: string;
    [key: string]: unknown;
  };
  html?: string;
  src?: string;
  md?: string;
  prose?: string;
  links?: string[];
  [key: string]: unknown;
}

export interface BlockReferenceFinding extends KgFinding {
  where: string;
  detail: string;
  kind?: "computation.script" | "relative-link" | "macro-template" | "undetermined" | "vacuity";
}

export interface BlockReferenceResult {
  result: KgResult;
  findings: BlockReferenceFinding[];
  blocksAudited: number;
}

export interface BlockResolverOptions {
  instanceRoot?: string;
  /** Explicit map of declared directory id/graph -> path */
  declaredDirectories?: Map<string, string> | Record<string, string>;
  /** Explicit set/list of known macro names */
  knownMacros?: Set<string> | string[];
  /** Explicit paper config (carrying `macros?: Record<string, unknown>`) */
  paperConfig?: { macros?: Record<string, unknown> };
  /** Known liquid prefixes */
  knownLiquidPrefixes?: Set<string> | string[];
}

/**
 * Resolves declared directories for a layer, merging declaration with explicit options.
 */
export function getDeclaredDirectories(
  instanceRoot?: string,
  overrides?: Map<string, string> | Record<string, string>,
): Map<string, string> {
  const dirs = new Map<string, string>();
  if (overrides) {
    if (overrides instanceof Map) {
      for (const [k, v] of overrides.entries()) dirs.set(k, v);
    } else {
      for (const [k, v] of Object.entries(overrides)) dirs.set(k, v);
    }
  }
  if (instanceRoot) {
    try {
      const decl = readDeclaration(instanceRoot);
      if (decl?.directories) {
        for (const d of decl.directories) {
          const abs = resolve(instanceRoot, d.path);
          dirs.set(d.id, abs);
          if (d.graphTypologies) {
            for (const gt of d.graphTypologies) {
              if (!dirs.has(gt)) dirs.set(gt, abs);
            }
          }
        }
      }
    } catch {
      // Ignored: falls back to overrides
    }
  }
  return dirs;
}

/**
 * Parse a block manifest from a file path (.ts or .md).
 */
export function parseBlockManifest(filePath: string): BlockInput | undefined {
  if (!existsSync(filePath)) return undefined;
  const src = readFileSync(filePath, "utf-8");

  if (filePath.endsWith(".ts")) {
    const labelMatch = src.match(/\blabel:\s*["']([^"']+)["']/);
    const kindMatch =
      src.match(/export\s+default\s+([a-zA-Z0-9_]+)\s*\(/) ??
      src.match(/\bkind:\s*["']([^"']+)["']/);
    const scriptMatch = src.match(/\bscript:\s*["']([^"']+)["']/);
    const witnessMatch = src.match(/\bwitness:\s*["']([^"']+)["']/);
    const htmlMatch = src.match(/\bhtml:\s*["']([^"']+)["']/);
    const srcMatch = src.match(/\bsrc:\s*["']([^"']+)["']/);

    const siblingMd = filePath.replace(/\.ts$/, ".md");
    let md: string | undefined;
    if (existsSync(siblingMd)) {
      md = readFileSync(siblingMd, "utf-8");
    }

    const label = labelMatch ? labelMatch[1] : basename(filePath, ".ts");
    const kind = kindMatch ? kindMatch[1] : undefined;
    const script = scriptMatch ? scriptMatch[1] : undefined;
    const witness = witnessMatch ? witnessMatch[1] : undefined;
    const html = htmlMatch ? htmlMatch[1] : undefined;
    const figureSrc = srcMatch ? srcMatch[1] : undefined;

    return {
      label,
      kind,
      file: filePath,
      computation: script ? { script, witness } : undefined,
      simulator: html ? { html } : undefined,
      figure: figureSrc ? { src: figureSrc } : undefined,
      html,
      src: figureSrc,
      md,
      prose: md,
    };
  }

  if (filePath.endsWith(".md")) {
    const label = basename(filePath, ".md");
    return {
      label,
      file: filePath,
      md: src,
      prose: src,
    };
  }

  return undefined;
}

/**
 * Check resolution of computation.script for a block.
 */
export function checkComputationScript(
  scriptPath: string,
  options: BlockResolverOptions,
  blockLabel: string,
  blockFile?: string,
): BlockReferenceFinding | undefined {
  const instanceRoot = options.instanceRoot ?? process.cwd();
  const dirs = getDeclaredDirectories(options.instanceRoot, options.declaredDirectories);

  // Look for declared computation directory
  const compDir = dirs.get("computations") ?? dirs.get("code") ?? dirs.get("scripts");

  if (!compDir) {
    return {
      where: blockLabel,
      detail: `computation.script "${scriptPath}": computation directory is undeclared in instance`,
      kind: "undetermined",
    };
  }

  if (!existsSync(compDir)) {
    return {
      where: blockLabel,
      detail: `computation.script "${scriptPath}": declared computation directory "${compDir}" is absent from disk`,
      kind: "undetermined",
    };
  }

  // Check candidates for script file
  const candidates: string[] = [];
  if (isAbsolute(scriptPath)) {
    candidates.push(scriptPath);
  } else {
    candidates.push(join(compDir, scriptPath));
    candidates.push(join(compDir, basename(scriptPath)));
    candidates.push(join(instanceRoot, scriptPath));
    if (blockFile) {
      candidates.push(join(dirname(blockFile), scriptPath));
    }
  }

  const resolved = candidates.some((c) => existsSync(c) && !statSync(c).isDirectory());
  if (!resolved) {
    return {
      where: blockLabel,
      detail: `computation.script "${scriptPath}" does not exist in declared computation directory "${compDir}"`,
      kind: "computation.script",
    };
  }

  return undefined;
}

/**
 * Check resolution of a relative link / asset path.
 */
export function checkRelativeLink(
  linkPath: string,
  options: BlockResolverOptions,
  blockLabel: string,
  blockFile?: string,
): BlockReferenceFinding | undefined {
  // Ignore external or anchor links
  if (/^(?:https?:|mailto:|ftp:|#|data:)/.test(linkPath)) {
    return undefined;
  }

  const instanceRoot = options.instanceRoot ?? process.cwd();
  const dirs = getDeclaredDirectories(options.instanceRoot, options.declaredDirectories);

  // Determine target directory segment
  const normalized = linkPath.replace(/^\.\//, "");
  const firstSeg = normalized.split(/[/\\]/)[0];

  // If the path targets a named directory (e.g. uploads, simulators, library, assets)
  if (firstSeg && (firstSeg === "uploads" || firstSeg === "simulators" || firstSeg === "library" || firstSeg === "assets" || dirs.has(firstSeg))) {
    const targetDir = dirs.get(firstSeg) ?? join(instanceRoot, firstSeg);
    if (!dirs.has(firstSeg) && !existsSync(targetDir)) {
      return {
        where: blockLabel,
        detail: `target directory for relative link "${linkPath}" is undeclared in instance`,
        kind: "undetermined",
      };
    }
    if (!existsSync(targetDir)) {
      return {
        where: blockLabel,
        detail: `target directory "${targetDir}" for relative link "${linkPath}" is absent from disk`,
        kind: "undetermined",
      };
    }

    const candidates = [
      join(instanceRoot, linkPath),
      join(targetDir, basename(linkPath)),
      blockFile ? join(dirname(blockFile), linkPath) : undefined,
    ].filter((c): c is string => c !== undefined);

    if (!candidates.some((c) => existsSync(c))) {
      return {
        where: blockLabel,
        detail: `relative link "${linkPath}" does not resolve to an existing file in directory "${targetDir}"`,
        kind: "relative-link",
      };
    }
    return undefined;
  }

  // Path relative to block file or layer
  if (blockFile) {
    const resolvedInBlock = join(dirname(blockFile), linkPath);
    if (existsSync(resolvedInBlock)) return undefined;
  }

  const resolvedInRoot = join(instanceRoot, linkPath);
  if (existsSync(resolvedInRoot)) return undefined;

  return {
    where: blockLabel,
    detail: `relative link "${linkPath}" does not resolve to an existing file`,
    kind: "relative-link",
  };
}

/**
 * Check resolution of {{...}} macro templates in prose.
 */
export function checkMacroTemplates(
  prose: string,
  options: BlockResolverOptions,
  blockLabel: string,
): BlockReferenceFinding[] {
  const findings: BlockReferenceFinding[] = [];
  const instanceRoot = options.instanceRoot ?? process.cwd();
  const dirs = getDeclaredDirectories(options.instanceRoot, options.declaredDirectories);

  const knownMacros = new Set<string>();
  if (options.knownMacros) {
    for (const m of options.knownMacros) knownMacros.add(m);
  }
  if (options.paperConfig?.macros) {
    for (const m of Object.keys(options.paperConfig.macros)) knownMacros.add(m);
  }

  const matches = prose.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g);
  for (const m of matches) {
    const raw = m[1].trim();
    const expr = raw.split("|")[0].trim();

    // Case A: Liquid expression e.g. prefix.dir.entry.path or site.data...
    if (expr.includes(".")) {
      const parts = expr.split(".");
      const prefix = parts[0];
      const dirId = parts[1];

      if (prefix === "site" && dirId === "data") {
        // Jekyll site.data
        const dataDir = dirs.get("data") ?? join(instanceRoot, "_data");
        if (!existsSync(dataDir)) {
          findings.push({
            where: blockLabel,
            detail: `Liquid template "{{${raw}}}": _data directory is absent from disk`,
            kind: "undetermined",
          });
        }
        continue;
      }

      const prefixes = options.knownLiquidPrefixes instanceof Set
        ? options.knownLiquidPrefixes
        : new Set(options.knownLiquidPrefixes ?? []);
      const isKnownPrefix =
        prefixes.has(prefix) ||
        (options.instanceRoot && basename(options.instanceRoot) === prefix) ||
        dirs.has(dirId);

      if (isKnownPrefix) {
        if (!dirs.has(dirId)) {
          findings.push({
            where: blockLabel,
            detail: `Liquid template "{{${raw}}}": directory "${dirId}" is undeclared in instance`,
            kind: "undetermined",
          });
          continue;
        }

        const dirPath = dirs.get(dirId)!;
        if (!existsSync(dirPath)) {
          findings.push({
            where: blockLabel,
            detail: `Liquid template "{{${raw}}}": declared directory "${dirPath}" is absent from disk`,
            kind: "undetermined",
          });
          continue;
        }

        if (parts.length >= 3) {
          const entry = parts[2];
          const witnessFile = join(dirPath, `${entry}.witness.json`);
          const jsonFile = join(dirPath, `${entry}.json`);
          if (!existsSync(witnessFile) && !existsSync(jsonFile)) {
            findings.push({
              where: blockLabel,
              detail: `Liquid template "{{${raw}}}": entry "${entry}" not found in directory "${dirId}"`,
              kind: "macro-template",
            });
          }
        }
        continue;
      }
    }

    // Case B: Macro template or known symbol
    if (knownMacros.has(expr) || knownMacros.has(raw)) {
      continue;
    }

    findings.push({
      where: blockLabel,
      detail: `macro template "{{${raw}}}" does not resolve against declared macros or known symbols`,
      kind: "macro-template",
    });
  }

  return findings;
}

/**
 * Check a single block input for reference resolutions.
 */
export function checkSingleBlock(
  block: BlockInput,
  options: BlockResolverOptions = {},
): BlockReferenceFinding[] {
  const findings: BlockReferenceFinding[] = [];

  // 1. Check computation.script
  if (block.computation?.script) {
    const f = checkComputationScript(block.computation.script, options, block.label, block.file);
    if (f) findings.push(f);
  }

  // 2. Check simulator.html
  if (block.simulator?.html) {
    const f = checkRelativeLink(block.simulator.html, options, block.label, block.file);
    if (f) findings.push(f);
  } else if (block.html) {
    const f = checkRelativeLink(block.html, options, block.label, block.file);
    if (f) findings.push(f);
  }

  // 3. Check figure.src
  if (block.figure?.src) {
    const f = checkRelativeLink(block.figure.src, options, block.label, block.file);
    if (f) findings.push(f);
  } else if (block.src) {
    const f = checkRelativeLink(block.src, options, block.label, block.file);
    if (f) findings.push(f);
  }

  // 4. Check explicit links array
  if (Array.isArray(block.links)) {
    for (const l of block.links) {
      const f = checkRelativeLink(l, options, block.label, block.file);
      if (f) findings.push(f);
    }
  }

  // 5. Check prose / md content
  const prose = block.prose ?? block.md;
  if (prose) {
    // Check markdown links: [text](path)
    const linkMatches = prose.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
    for (const lm of linkMatches) {
      const l = lm[2].trim();
      const f = checkRelativeLink(l, options, block.label, block.file);
      if (f) findings.push(f);
    }

    // Check {{...}} macro templates
    const macroFindings = checkMacroTemplates(prose, options, block.label);
    findings.push(...macroFindings);
  }

  return findings;
}

/**
 * Evaluate block reference resolution across a set of blocks.
 * Enforces third-state rule and vacuity guard.
 */
export function resolveBlockReferences(
  blockOrBlocks: BlockInput | BlockInput[],
  options: BlockResolverOptions = {},
): BlockReferenceResult {
  const blocks = Array.isArray(blockOrBlocks) ? blockOrBlocks : [blockOrBlocks];

  // Vacuity guard
  if (blocks.length === 0) {
    return {
      result: "unknown",
      findings: [
        {
          where: "—",
          detail: "vacuity guard: zero blocks were examined",
          kind: "vacuity",
        },
      ],
      blocksAudited: 0,
    };
  }

  const findings: BlockReferenceFinding[] = [];
  for (const b of blocks) {
    findings.push(...checkSingleBlock(b, options));
  }

  const hasUndetermined = findings.some((f) => f.kind === "undetermined" || f.kind === "vacuity");
  const hasFailures = findings.some(
    (f) => f.kind === "computation.script" || f.kind === "relative-link" || f.kind === "macro-template",
  );

  let result: KgResult = "pass";
  if (hasUndetermined) {
    result = "unknown";
  } else if (hasFailures) {
    result = "fail";
  }

  return {
    result,
    findings,
    blocksAudited: blocks.length,
  };
}

/**
 * Audit all blocks in a layer's declared folio directory.
 */
export function auditBlockReferences(
  instanceRoot: string,
  options: BlockResolverOptions = {},
): BlockReferenceResult {
  const dirs = getDeclaredDirectories(instanceRoot, options.declaredDirectories);
  const folioDir = dirs.get("folio") ?? folioDirOf(instanceRoot);

  if (!existsSync(folioDir)) {
    return {
      result: "unknown",
      findings: [
        {
          where: "—",
          detail: `folio directory "${folioDir}" is absent from disk`,
          kind: "undetermined",
        },
      ],
      blocksAudited: 0,
    };
  }

  const blocks: BlockInput[] = [];
  function walk(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!ent.name.startsWith(".")) walk(full);
      } else if (ent.isFile() && ent.name.endsWith(".ts")) {
        const b = parseBlockManifest(full);
        if (b) blocks.push(b);
      }
    }
  }

  walk(folioDir);

  return resolveBlockReferences(blocks, { ...options, instanceRoot });
}

/**
 * Generate KgQaReport for folio blocks in a layer (for kg:audit integration).
 */
export function auditFolioBlocks(
  instanceRoot: string,
  options: BlockResolverOptions = {},
): KgQaReport[] {
  const dirs = getDeclaredDirectories(instanceRoot, options.declaredDirectories);
  const folioDir = dirs.get("folio");

  if (!folioDir || !existsSync(folioDir)) {
    return [];
  }

  const result = auditBlockReferences(instanceRoot, options);
  const criteria: Record<string, KgCriterionEntry> = {
    [BLOCK_REFERENCE_RESOLVES_CRITERION]: {
      result: result.result,
      findings: result.findings.map((f) => ({ where: f.where, detail: f.detail })),
    },
  };

  const hash = createHash("sha256");
  hash.update(JSON.stringify(result.findings));
  const sourceHash = hash.digest("hex").slice(0, 16);

  return [
    {
      $schema: KG_QA_SCHEMA,
      subject: {
        kind: "folio",
        id: "folio",
        path: relative(instanceRoot, folioDir) || "folio",
      },
      source_hash: sourceHash,
      criteria,
      totals: tally(criteria),
    },
  ];
}
