#!/usr/bin/env bun
/**
 * Resolve each lean.ref against the declarations and modules of Lake targets
 * that CI builds, classifying references into built / sibling_only / dangling.
 *
 * Outcomes:
 *   - "built": lands in a Lake build target (compiled library / lean_lib / lean_exe)
 *   - "sibling_only": absent from any Lake target, but resolves in an uncompiled chapter-dir .lean sibling
 *   - "dangling": resolves neither in Lake targets nor in chapter-dir siblings
 *   - "unknown": Lake configuration missing or unreadable (third-state rule: never a false built or dangling)
 *
 * @module scripts/check-lake-targets
 * @covers cat-harness
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { KgCriterionEntry, KgFinding } from "../schemas/sdlc/kg-qa.js";
import { folioDir } from "../schemas/kg/cat-harness.js";
import { fileDeclaresName } from "../pipeline/lean-lexer.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

export type LeanRefClassification = "built" | "sibling_only" | "dangling" | "unknown";

export interface ClassifyLeanRefOptions {
  lakeRoot?: string;
  targetModules?: Set<string>;
  chapterDirFiles?: Set<string>;
}

export interface LakeTarget {
  name: string;
  type: "lib" | "exe";
  roots: string[];
  srcDir: string;
}

export interface BlockRefInfo {
  ref: string;
  label?: string;
  file?: string;
}

export interface LakeTargetLeanAuditOptions {
  lakeRoot?: string;
  targetModules?: Set<string>;
  chapterDirFiles?: Set<string>;
  blocks?: BlockRefInfo[];
}

/**
 * Does `file` textually declare a top-level `name`? The one implementation
 * lives in `pipeline/lean-lexer.ts`; this
 * module carried a copy of it, and so a sixth declaration pattern.
 */
export { fileDeclaresName };

/**
 * Parse Lake target libraries and executables from lakefile.toml or lakefile.lean.
 */
export function parseLakefileTargets(content: string, isToml: boolean): LakeTarget[] {
  const targets: LakeTarget[] = [];
  if (isToml) {
    const libSections = content.split(/\[{1,2}lean_lib\]{1,2}/g).slice(1);
    for (const sec of libSections) {
      const chunk = sec.split(/\[{1,2}/)[0];
      const nameM = chunk.match(/name\s*=\s*["']([^"']+)["']/);
      if (!nameM) continue;
      const name = nameM[1];
      const srcDirM = chunk.match(/srcDir\s*=\s*["']([^"']+)["']/);
      const srcDir = srcDirM ? srcDirM[1] : ".";
      const rootsM = chunk.match(/roots\s*=\s*\[(.*?)\]/s);
      let roots: string[] = [name];
      if (rootsM) {
        roots = [...rootsM[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
      }
      targets.push({ name, type: "lib", roots, srcDir });
    }

    const exeSections = content.split(/\[{1,2}lean_exe\]{1,2}/g).slice(1);
    for (const sec of exeSections) {
      const chunk = sec.split(/\[{1,2}/)[0];
      const nameM = chunk.match(/name\s*=\s*["']([^"']+)["']/);
      if (!nameM) continue;
      const name = nameM[1];
      const srcDirM = chunk.match(/srcDir\s*=\s*["']([^"']+)["']/);
      const srcDir = srcDirM ? srcDirM[1] : ".";
      const rootM = chunk.match(/root\s*=\s*["']([^"']+)["']/);
      const roots = rootM ? [rootM[1]] : [name];
      targets.push({ name, type: "exe", roots, srcDir });
    }
  } else {
    const libRegex = /lean_lib\s+[«"]?([A-Za-z0-9_.']+)[»"]?/g;
    let match: RegExpExecArray | null;
    while ((match = libRegex.exec(content)) !== null) {
      const name = match[1];
      targets.push({ name, type: "lib", roots: [name], srcDir: "." });
    }

    const exeRegex = /lean_exe\s+[«"]?([A-Za-z0-9_.']+)[»"]?/g;
    while ((match = exeRegex.exec(content)) !== null) {
      const name = match[1];
      targets.push({ name, type: "exe", roots: [name], srcDir: "." });
    }
  }
  return targets;
}

/** Recursively scan for .olean compiled files under a directory. */
function scanOleanModules(dir: string, baseDir: string, out: Set<string>): void {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanOleanModules(full, baseDir, out);
      } else if (entry.isFile() && entry.name.endsWith(".olean")) {
        const rel = relative(baseDir, full);
        const mod = rel.replace(/\.olean$/, "").replace(/[\\/]/g, ".");
        out.add(mod);
      }
    }
  } catch {
    // Directory unreadable
  }
}

/** Recursively scan for .lean source files under a directory. */
function scanLeanSourceFiles(
  dir: string,
  lakeRoot: string,
  srcDir: string,
  modulesOut: Set<string>,
  filesOut: string[],
): void {
  const base = resolve(lakeRoot, srcDir);
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // input-site: inert #644fe977 — a directory the walk skips; its contents are never read
      if (entry.name === ".lake" || entry.name === "build" || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanLeanSourceFiles(full, lakeRoot, srcDir, modulesOut, filesOut);
      } else if (entry.isFile() && entry.name.endsWith(".lean")) {
        filesOut.push(full);
        const rel = relative(base, full);
        const mod = rel.replace(/\.lean$/, "").replace(/[\\/]/g, ".");
        modulesOut.add(mod);
      }
    }
  } catch {
    // Directory unreadable
  }
}

function checkTargetMatch(
  ref: string,
  decl: string,
  module: string,
  name: string,
  targetModules: Set<string>,
  targetSourceFiles: string[],
): boolean {
  if (targetModules.has(ref) || targetModules.has(decl) || targetModules.has(module) || targetModules.has(name)) {
    return true;
  }

  for (const t of targetModules) {
    if (decl === t || ref === t) return true;
    if (decl.startsWith(t + ".")) return true;
    if (t.startsWith(decl + ".")) return true;
    if (ref.startsWith(t + ".")) return true;
    if (t.endsWith(".lean")) {
      const tMod = t.slice(0, -5).replace(/[\\/]/g, ".");
      if (decl === tMod || decl.startsWith(tMod + ".")) return true;
    }
  }

  for (const f of targetSourceFiles) {
    const base = basename(f, ".lean");
    if (base === name || base === decl) return true;
    if (fileDeclaresName(f, name)) return true;
  }

  return false;
}

function checkChapterDirMatch(
  ref: string,
  decl: string,
  module: string,
  name: string,
  chapterFiles: Set<string>,
): boolean {
  if (chapterFiles.size === 0) return false;
  if (chapterFiles.has(ref) || chapterFiles.has(decl) || chapterFiles.has(module) || chapterFiles.has(name)) {
    return true;
  }
  if (chapterFiles.has(`${name}.lean`) || chapterFiles.has(`${decl}.lean`) || chapterFiles.has(`${module}.lean`)) {
    return true;
  }

  for (const f of chapterFiles) {
    const base = basename(f, ".lean");
    if (base === name || base === decl || base === module) return true;
    if (f.endsWith(`/${name}.lean`) || f.endsWith(`/${decl.replace(/\./g, "/")}.lean`)) return true;
    if (existsSync(f) && fileDeclaresName(f, name)) return true;
  }

  return false;
}

function discoverNearbyChapterLeanFiles(lakeRoot: string): Set<string> {
  const out = new Set<string>();
  const parent = resolve(lakeRoot, "..");
  const lakeBase = basename(lakeRoot);
  function walk(dir: string, depth: number): void {
    if (depth > 5) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (
          entry.name === lakeBase ||
          entry.name === ".lake" ||
          // input-site: inert #c05beb24 — a directory the walk skips; its contents are never read
          entry.name === "build" ||
          entry.name === "node_modules" ||
          entry.name === ".git"
        ) {
          continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith(".lean")) {
          out.add(full);
        }
      }
    } catch {
      // ignore
    }
  }
  walk(parent, 0);
  return out;
}

/**
 * Classify a lean.ref against Lake build targets and chapter-dir siblings.
 *
 * Third-state rule: if lake configuration is missing or unreadable, returns
 * "unknown", never a false "built" or "dangling".
 */
export function classifyLeanRefTarget(
  ref: string,
  opts: ClassifyLeanRefOptions = {},
): LeanRefClassification {
  // Third-state rule: check if lake configuration is missing or unreadable
  if (!opts.targetModules) {
    if (!opts.lakeRoot || typeof opts.lakeRoot !== "string") {
      return "unknown";
    }
    if (!existsSync(opts.lakeRoot)) {
      return "unknown";
    }
    const tomlPath = join(opts.lakeRoot, "lakefile.toml");
    const leanPath = join(opts.lakeRoot, "lakefile.lean");
    if (!existsSync(tomlPath) && !existsSync(leanPath)) {
      return "unknown";
    }
  }

  let decl = ref;
  const colonIdx = ref.indexOf(":");
  if (colonIdx >= 0) {
    decl = ref.slice(colonIdx + 1);
  }
  decl = decl.trim();
  if (!decl) {
    return "dangling";
  }

  const segments = decl.split(".").filter(Boolean);
  const name = segments.length > 0 ? segments[segments.length - 1] : decl;
  const module = segments.length > 1 ? segments.slice(0, -1).join(".") : decl;

  const targetModules = new Set<string>();
  if (opts.targetModules) {
    for (const m of opts.targetModules) targetModules.add(m);
  }

  const targetSourceFiles: string[] = [];
  if (opts.lakeRoot && existsSync(opts.lakeRoot)) {
    const tomlPath = join(opts.lakeRoot, "lakefile.toml");
    const leanPath = join(opts.lakeRoot, "lakefile.lean");
    let content = "";
    let isToml = false;
    try {
      if (existsSync(tomlPath)) {
        content = readFileSync(tomlPath, "utf-8");
        isToml = true;
      } else if (existsSync(leanPath)) {
        content = readFileSync(leanPath, "utf-8");
        isToml = false;
      }
    } catch {
      return "unknown";
    }

    if (content) {
      const targets = parseLakefileTargets(content, isToml);
      // Discover compiled module targets (.lake/build/lib/**/*.olean)
      // input-site: traced #ca846819 — Lean build output (`.lake/build/lib`), which the tree digest leaves out; only where a lakefile exists
      inputSiteReached("check-lake-targets: lean build output");
      const lakeBuildDir = join(opts.lakeRoot, ".lake", "build", "lib");
      if (existsSync(lakeBuildDir)) {
        scanOleanModules(lakeBuildDir, lakeBuildDir, targetModules);
      }
      // input-site: traced #9826fc4d — Lean build output (`build/lib`), which the tree digest leaves out; only where a lakefile exists
      inputSiteReached("check-lake-targets: lean build output");
      const altBuildDir = join(opts.lakeRoot, "build", "lib");
      if (existsSync(altBuildDir)) {
        scanOleanModules(altBuildDir, altBuildDir, targetModules);
      }

      // Discover source files under lakeRoot
      for (const target of targets) {
        for (const root of target.roots) {
          const rootFile = join(opts.lakeRoot, target.srcDir, `${root}.lean`);
          if (existsSync(rootFile)) {
            targetModules.add(root);
            targetSourceFiles.push(rootFile);
          }
          const targetDir = join(opts.lakeRoot, target.srcDir, root);
          if (existsSync(targetDir)) {
            scanLeanSourceFiles(targetDir, opts.lakeRoot, target.srcDir, targetModules, targetSourceFiles);
          }
        }
      }
    }
  }

  // 1. Check if lands in Lake build targets (built)
  if (checkTargetMatch(ref, decl, module, name, targetModules, targetSourceFiles)) {
    return "built";
  }

  // 2. Check chapter directory files (sibling_only)
  const chapterFiles = opts.chapterDirFiles ?? new Set<string>();
  if (checkChapterDirMatch(ref, decl, module, name, chapterFiles)) {
    return "sibling_only";
  }

  // If chapterDirFiles was not explicitly provided but lakeRoot was, check for nearby sibling .lean files
  if (!opts.chapterDirFiles && opts.lakeRoot) {
    const nearbyFiles = discoverNearbyChapterLeanFiles(opts.lakeRoot);
    if (checkChapterDirMatch(ref, decl, module, name, nearbyFiles)) {
      return "sibling_only";
    }
  }

  // 3. Neither Lake target nor chapter-dir sibling -> dangling
  return "dangling";
}

export function scanBlockRefs(dir: string): BlockRefInfo[] {
  const blocks: BlockRefInfo[] = [];
  try {
    const stack = [dir];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        if (
          entry.name === ".git" ||
          entry.name === "node_modules" ||
          entry.name === ".lake" ||
          // input-site: inert #c05beb24 — a directory the walk skips; its contents are never read
          entry.name === "build" ||
          entry.name === "cat-harness-tools" ||
          // input-site: inert #0c3ce601 — a directory the walk skips; its contents are never read
          entry.name === "dist"
        ) {
          continue;
        }
        const full = join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".json"))) {
          try {
            const content = readFileSync(full, "utf-8");
            const refM = content.match(/lean:\s*\{[^}]*ref:\s*["']([^"']+)["']/s) ??
                         content.match(/["']ref["']\s*:\s*["']([^"']+)["']/);
            if (refM) {
              const labelM = content.match(/label:\s*["']([^"']+)["']/) ??
                             content.match(/["']label["']\s*:\s*["']([^"']+)["']/);
              blocks.push({
                ref: refM[1],
                label: labelM ? labelM[1] : undefined,
                file: relative(dir, full),
              });
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }
  } catch {
    // Directory unreadable
  }
  return blocks;
}

export function auditLakeTargetLeanResolution(
  root: string,
  opts?: LakeTargetLeanAuditOptions,
): KgCriterionEntry {
  // 1. Gather blocks
  let blocks: BlockRefInfo[] = [];
  if (opts?.blocks) {
    blocks = opts.blocks;
  } else {
    const contentDir = join(root, "content");
    const folioDirPath = folioDir(root);
    if (existsSync(contentDir)) {
      blocks.push(...scanBlockRefs(contentDir));
    }
    if (existsSync(folioDirPath)) {
      blocks.push(...scanBlockRefs(folioDirPath));
    }
    if (blocks.length === 0 && existsSync(root)) {
      blocks.push(...scanBlockRefs(root));
    }
  }

  // Vacuity guard: if 0 blocks/refs checked -> unknown
  if (blocks.length === 0) {
    return {
      result: "unknown",
      findings: [{
        where: "—",
        detail: "no blocks or lean.refs found to resolve against Lake targets (vacuity guard).",
      }],
    };
  }

  // 2. Discover Lake root if not provided
  let lakeRoot = opts?.lakeRoot;
  if (!lakeRoot && !opts?.targetModules) {
    const candidates = [
      join(root, "lean"),
      join(root, "lakefile.toml"),
      join(root, "lakefile.lean"),
    ];
    if (existsSync(candidates[0]) && (existsSync(join(candidates[0], "lakefile.toml")) || existsSync(join(candidates[0], "lakefile.lean")))) {
      lakeRoot = candidates[0];
    } else if (existsSync(join(root, "lakefile.toml")) || existsSync(join(root, "lakefile.lean"))) {
      lakeRoot = root;
    } else {
      for (const d of [join(root, "content"), folioDir(root)]) {
        if (existsSync(d)) {
          for (const ent of readdirSync(d, { withFileTypes: true })) {
            if (ent.isDirectory()) {
              const subLean = join(d, ent.name, "lean");
              if (existsSync(subLean) && (existsSync(join(subLean, "lakefile.toml")) || existsSync(join(subLean, "lakefile.lean")))) {
                lakeRoot = subLean;
                break;
              }
            }
          }
        }
        if (lakeRoot) break;
      }
    }
  }

  // If Lake configuration is missing/unreachable
  if (!opts?.targetModules && (!lakeRoot || !existsSync(lakeRoot))) {
    return {
      result: "unknown",
      findings: [{
        where: "—",
        detail: "Lake configuration (lakefile.toml or lakefile.lean) is missing or unreadable.",
      }],
    };
  }

  // 3. Classify each block's lean.ref
  const findings: KgFinding[] = [];
  for (const block of blocks) {
    const res = classifyLeanRefTarget(block.ref, {
      lakeRoot,
      targetModules: opts?.targetModules,
      chapterDirFiles: opts?.chapterDirFiles,
    });

    const where = block.label || block.file || block.ref;
    if (res === "unknown") {
      return {
        result: "unknown",
        findings: [{
          where,
          detail: `Lake configuration could not be evaluated for lean.ref "${block.ref}".`,
        }],
      };
    } else if (res === "sibling_only") {
      findings.push({
        where,
        detail: `lean.ref "${block.ref}" resolves only to an uncompiled chapter directory sibling (.lean), absent from Lake targets.`,
      });
    } else if (res === "dangling") {
      findings.push({
        where,
        detail: `lean.ref "${block.ref}" dangles (resolves neither in Lake targets nor in chapter directory siblings).`,
      });
    }
  }

  return {
    result: findings.length > 0 ? "fail" : "pass",
    findings,
  };
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  const entry = auditLakeTargetLeanResolution(root);
  console.log(`lake-target-lean-resolution: ${entry.result}`);
  for (const f of entry.findings) {
    console.log(`  ${f.where}: ${f.detail}`);
  }
  process.exit(entry.result === "fail" ? 1 : 0);
}
