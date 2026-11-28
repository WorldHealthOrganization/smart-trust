#!/usr/bin/env bun
/**
 * One-shot migration: `lean: { decl: "QOU.Foo", file?, ... }`
 *                   → `lean: { ref: "qou:QOU.Foo", ... }`
 *
 * Mapping from paper directory to package prefix is derived from
 * `schemas/lean-packages.ts` (LEAN_PACKAGES).
 *
 * Transforms every `.ts` under `content/` that contains a `decl:` field
 * inside a `lean:` object.  The `file:` field is dropped (it was only
 * ever used to override sibling resolution; the new URI-based system
 * resolves via package + sibling fallback).
 *
 * Idempotent: files already using `ref:` are left untouched.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/migrate-lean-refs.ts           # dry run
 *   bun run cat-harness-tools/pipeline/migrate-lean-refs.ts --write   # apply
 *
 * @module pipeline/migrate-lean-refs
 */

import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { LEAN_PACKAGES } from "../schemas/lean-packages.ts";
import { findContentRepoRoot } from "./repo-root";

// Was rooted at this file's own location, which is the PLATFORM — but every
// path below is folio content. `findContentRepoRoot()` walks up from cwd;
// it must not use `import.meta.dir`, which resolves back through a folio's
// `folio-assistant/` symlink to the platform.
const REPO_ROOT = findContentRepoRoot();
const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);
const WRITE = process.argv.includes("--write");

/** Paper directory → Lake package short-name. */
const PAPER_TO_PACKAGE: Record<string, string> = Object.fromEntries(
  LEAN_PACKAGES.map(p => [p.paperDir, p.name]),
);

/**
 * Non-paper content directories whose `lean.ref` targets are known to
 * live in a specific Lake package (e.g. the visualizer dashboard
 * references QOU declarations).
 */
const EXTRA_DIR_TO_PACKAGE: Record<string, string> = {
  visualizer: "qou",
};

interface FileStats {
  path: string;
  matches: number;
  changed: boolean;
  skipped: string[];
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".lake") continue;
      out.push(...walk(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Resolve the package prefix for a content file based on its paper
 * directory.  Returns `undefined` when the file lives outside any known
 * paper (caller then logs + skips).
 */
function packageForFile(absPath: string): string | undefined {
  const rel = relative(folioDirOf(), absPath);
  // Cross-platform: `relative()` returns `\` on Windows, `/` on POSIX.
  // Split on either separator so the paper-directory lookup works on
  // both platforms.
  const paperDir = rel.split(/[\\/]/, 1)[0];
  return PAPER_TO_PACKAGE[paperDir] ?? EXTRA_DIR_TO_PACKAGE[paperDir];
}

/**
 * Transform the source of a single `.ts` file.  Walks every
 * `lean: { ... }` object literal, converts `decl: "Foo"` (and drops
 * `file: "..."`) into `ref: "<pkg>:Foo"`.
 *
 * We use a regex on the single-line form (most common) plus a
 * multi-line object-body rewrite.  This is intentionally a
 * text-level transform — not an AST pass — because:
 *   - `.ts` content files follow a tight author-facing template
 *   - TypeScript AST rewrite with comment preservation is heavier
 *   - Output is re-validated by the Zod schema on every build
 */
function transform(src: string, pkg: string): { src: string; matches: number } {
  let matches = 0;

  // Pass 1: single-line form on a single source line (no newlines).
  //   lean: { decl: "QOU.Foo", validation: "not_checked" },
  // The character class `[^}\n]` deliberately excludes newlines so
  // multi-line `lean: { ... }` objects are not matched here — they
  // are handled by the dedicated multi-line pass below, which
  // preserves indentation and ordering.
  const singleLine = /lean:\s*\{\s*decl:\s*"([^"]+)"([^}\n]*)\}/g;
  src = src.replace(singleLine, (_m, decl: string, rest: string) => {
    matches += 1;
    // Strip any file: "..." fragment from the rest of the object body.
    const cleaned = rest.replace(/,\s*file:\s*"[^"]*"/g, "").replace(/file:\s*"[^"]*"\s*,\s*/g, "");
    return `lean: { ref: "${pkg}:${decl}"${cleaned}}`;
  });

  // Pass 2: multi-line form
  //   lean: {
  //     decl: "QOU.Foo",
  //     file: "...",
  //     validation: "not_checked",
  //   }
  //
  // Strategy: locate `lean: {` then find the balanced closing brace.
  // Within the block, replace the `decl:` line with `ref:` (package-
  // prefixed) and delete any `file:` line.
  const multiLine: Array<{ start: number; end: number; replacement: string }> = [];
  const leanOpen = /lean:\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = leanOpen.exec(src)) !== null) {
    // Skip if this has already been handled by pass 1 (no newline
    // before first property → single-line).
    const after = src.slice(match.index + match[0].length);
    if (!/^\s*\n/.test(after)) continue;

    // Find matching close brace.
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
      if (depth === 0) break;
    }
    if (depth !== 0) continue; // unbalanced — bail
    const bodyStart = match.index + match[0].length;
    const bodyEnd = i - 1; // index of the closing `}`
    const body = src.slice(bodyStart, bodyEnd);

    // If already migrated (has `ref:`), skip.
    if (/\bref:\s*"/.test(body)) continue;

    const declMatch = /\bdecl:\s*"([^"]+)"\s*,?/.exec(body);
    if (!declMatch) continue;
    const decl = declMatch[1];

    const newBody = body
      .replace(/\bdecl:\s*"[^"]+"\s*,?/, `ref: "${pkg}:${decl}",`)
      .replace(/^\s*file:\s*"[^"]*"\s*,?\s*\n/gm, "");

    multiLine.push({ start: bodyStart, end: bodyEnd, replacement: newBody });
    matches += 1;
  }

  // Apply multi-line rewrites in reverse so indices stay valid.
  multiLine.sort((a, b) => b.start - a.start);
  for (const m of multiLine) {
    src = src.slice(0, m.start) + m.replacement + src.slice(m.end);
  }

  return { src, matches };
}

function main() {
  const files = walk(folioDirOf());
  const stats: FileStats[] = [];
  let totalMatches = 0;
  let totalFiles = 0;
  const skippedByReason = new Map<string, number>();

  for (const abs of files) {
    const src = readFileSync(abs, "utf8");
    if (!/\bdecl:\s*"/.test(src)) continue;
    if (!/lean:\s*\{/.test(src)) continue; // not a lean ref, skip

    const pkg = packageForFile(abs);
    if (!pkg) {
      const rel = relative(REPO_ROOT, abs);
      const reason = `no-package-for-paper-dir`;
      skippedByReason.set(reason, (skippedByReason.get(reason) ?? 0) + 1);
      stats.push({ path: rel, matches: 0, changed: false, skipped: [reason] });
      continue;
    }

    const { src: out, matches } = transform(src, pkg);
    if (matches === 0) continue;
    totalFiles += 1;
    totalMatches += matches;
    const rel = relative(REPO_ROOT, abs);
    stats.push({ path: rel, matches, changed: out !== src, skipped: [] });

    if (WRITE && out !== src) writeFileSync(abs, out, "utf8");
  }

  console.log(`Migrated ${totalMatches} lean refs across ${totalFiles} files.`);
  if (skippedByReason.size > 0) {
    console.log("Skipped files:");
    for (const [reason, count] of skippedByReason) {
      console.log(`  ${reason}: ${count}`);
    }
    console.log("Skipped file list:");
    for (const s of stats.filter(s => s.skipped.length > 0).slice(0, 20)) {
      console.log(`  ${s.path} (${s.skipped.join(", ")})`);
    }
  }
  if (!WRITE) console.log("(dry run — pass --write to apply)");
}

main();
