#!/usr/bin/env bun
/**
 * After a move between two layers lands, rewrite the paths that still name the
 * old home — and ONLY those, and never in a record.
 *
 * @module scripts/rewrite-moved-paths
 * @graphNode none — a command-line tool; the method is skill `kg-separation` §"After a move lands"
 *
 * ## The rule
 *
 * A mention `<from-name>/<prefix>/<rest>` is rewritten to
 * `<to-name>/<prefix>/<rest>` when, and only when,
 *
 * 1. the file EXISTS under the destination root (`<to-root>/<prefix>/<rest>`), and
 * 2. it does NOT exist under the source root (`<from-root>/<prefix>/<rest>`).
 *
 * Half 1 alone would turn a placeholder or a typo into a different wrong
 * path; half 2 alone would retarget a mention of a file re-created in the
 * source, which is a different file.
 *
 * ## Records are never rewritten
 *
 * A record says what was true when it was written: a proposal, a todo, an
 * agent memory, a bean, a provenance record, an upstream pin, a test fixture,
 * a QA result. {@link DEFAULT_RECORD_GLOBS} names those shapes;
 * `--keep <glob>` adds more, and nothing here can remove one.
 *
 * ## Generated files are their generator's
 *
 * A generated page that names a moved path is fixed by re-running its
 * generator (`bun run cat regen`) after the sources are fixed, not by this
 * tool. Pass the generated trees (e.g. `docs/assets/**`) as `--keep`.
 *
 * ## It reports by default
 *
 * Without `--write` it writes nothing and prints every rewrite it would make,
 * with file and line, so a person can read the list before anything moves.
 * `--check` exits 1 when any rewrite is still owed — the gate form, for a
 * sweep that should already be finished.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/rewrite-moved-paths.ts \
 *     --scan <dir> --from-name <name> --from-root <dir> --to-name <name> --to-root <dir> \
 *     --prefix <dir> [--prefix <dir> …] [--keep <glob> …] [--write | --check]
 *
 * `--scan` is the tree whose files are read (default `--from-root`). Only files
 * git tracks there are read, so build output and mounts are never touched.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Paths, relative to the scanned tree, that hold records. Matched as globs (`**` any depth, `*` one segment). */
// declared-path-literal: globs RELATIVE TO WHICHEVER TREE IS SCANNED (`--root`), naming record directories by their conventional names; they are not paths into this checkout's layers.
export const DEFAULT_RECORD_GLOBS: readonly string[] = [
  "beans/**",
  "todos/**",
  "memory/**",
  "docs/proposals/**",
  "docs/todos/**",
  "docs/wireframes/**",
  "test/results/**",
  "test/attestations/**",
  "upstream/**",
  "vocab-mappings/**",
  "library/**/vector-figures.json",
  "external-schemas/*.terminology.json",
  "**/*.test.ts",
  "**/fixtures/**",
  "**/__fixtures__/**",
];

export interface RewriteOptions {
  scan: string;
  fromName: string;
  fromRoot: string;
  toName: string;
  toRoot: string;
  prefixes: readonly string[];
  keep?: readonly string[];
  /** Files to read, relative to `scan`. Default: what git tracks there. */
  files?: readonly string[];
}

export interface Rewrite {
  file: string;
  line: number;
  from: string;
  to: string;
}

export interface RewriteReport {
  rewrites: Rewrite[];
  /** Mentions left alone because their target is in neither root, or still in the source. */
  leftAlone: Rewrite[];
  /** Files skipped because they are records. */
  records: string[];
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function isRecord(file: string, globs: readonly string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(file));
}

function trackedFiles(dir: string): string[] {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: dir, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ls-files failed in ${dir}: ${r.stderr}`);
  return r.stdout.split("\0").filter(Boolean);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plan (and, given `write`, apply) every rewrite the rule allows. */
export function rewriteMovedPaths(o: RewriteOptions, write = false): RewriteReport {
  const keep = [...DEFAULT_RECORD_GLOBS, ...(o.keep ?? [])];
  const prefixes = [...o.prefixes].map((p) => p.replace(/\/+$/, "")).sort((a, b) => b.length - a.length);
  const mention = new RegExp(
    `(?<![A-Za-z0-9_-])${escapeRe(o.fromName)}/((?:${prefixes.map(escapeRe).join("|")})/[A-Za-z0-9_./-]*[A-Za-z0-9_])`,
    "g",
  );
  const report: RewriteReport = { rewrites: [], leftAlone: [], records: [] };
  for (const file of o.files ?? trackedFiles(o.scan)) {
    if (isRecord(file, keep)) {
      report.records.push(file);
      continue;
    }
    const abs = join(o.scan, file);
    let text: string;
    try {
      text = readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    if (!text.includes(`${o.fromName}/`)) continue;
    let changed = false;
    const out = text.split("\n").map((ln, i) =>
      ln.replace(mention, (whole, rel: string) => {
        const to = `${o.toName}/${rel}`;
        const entry = { file, line: i + 1, from: whole, to };
        if (existsSync(join(o.toRoot, rel)) && !existsSync(join(o.fromRoot, rel))) {
          report.rewrites.push(entry);
          changed = true;
          return to;
        }
        report.leftAlone.push(entry);
        return whole;
      }),
    );
    if (write && changed) writeFileSync(abs, out.join("\n"));
  }
  return report;
}

function args(argv: string[]): { opts: RewriteOptions; write: boolean; check: boolean } {
  const many = (flag: string) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]!] : []));
  const one = (flag: string) => many(flag)[0];
  const fromRoot = one("--from-root");
  const toRoot = one("--to-root");
  const fromName = one("--from-name");
  const toName = one("--to-name");
  const prefixes = many("--prefix");
  if (!fromRoot || !toRoot || !fromName || !toName || prefixes.length === 0) {
    console.error("usage: --from-name <n> --from-root <dir> --to-name <n> --to-root <dir> --prefix <dir> [...] [--scan <dir>] [--keep <glob>] [--write|--check]");
    process.exit(2);
  }
  return {
    opts: {
      scan: resolve(one("--scan") ?? fromRoot),
      fromName,
      fromRoot: resolve(fromRoot),
      toName,
      toRoot: resolve(toRoot),
      prefixes,
      keep: many("--keep"),
    },
    write: argv.includes("--write"),
    check: argv.includes("--check"),
  };
}

if (import.meta.main) {
  const { opts, write, check } = args(process.argv.slice(2));
  const r = rewriteMovedPaths(opts, write && !check);
  for (const w of r.rewrites) console.log(`${write && !check ? "rewrote" : "would rewrite"} ${w.file}:${w.line}  ${w.from}  →  ${w.to}`);
  for (const w of r.leftAlone) console.log(`left alone    ${w.file}:${w.line}  ${w.from}  (target not moved)`);
  const files = new Set(r.rewrites.map((w) => w.file)).size;
  console.log(
    `\n${r.rewrites.length} rewrite(s) in ${files} file(s)${write && !check ? "" : " — nothing written (pass --write)"}; ` +
      `${r.leftAlone.length} mention(s) left alone; ${r.records.length} record file(s) not read.`,
  );
  if (check && r.rewrites.length > 0) process.exit(1);
}
