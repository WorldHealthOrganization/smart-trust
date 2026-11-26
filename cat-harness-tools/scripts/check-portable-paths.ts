#!/usr/bin/env bun
/**
 * Can this repository actually be checked out?
 *
 * Checks that every tracked path (from `git ls-files`, not the working tree)
 * is creatable on the filesystems people clone onto. Git aborts the whole
 * checkout on the FIRST invalid path, and CI runs on Linux, so the only
 * other signal is somebody else's failed clone.
 *
 * Usage:
 *   bun run cat check:portable-paths
 *   bun run cat check:portable-paths -- --json
 *
 * Exit: 0 every tracked path is creatable, 1 at least one is not, 2 could not
 * check (no `git`, or not a repository; never a pass).
 *
 * @module scripts/check-portable-paths
 * @covers code
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { unportablePath, type UnportableReason } from "../schemas/kg/portable-path.ts";

/** One tracked path a checkout would refuse, and why. */
export interface UnportableFinding {
  path: string;
  /** The offending component — the whole path is rarely what needs changing. */
  segment: string;
  reason: UnportableReason;
}

export interface PortablePathsReport {
  /** How many tracked paths were examined. Zero is "could not check", not clean. */
  examined: number;
  findings: UnportableFinding[];
}

/** What each reason means and what to do about it, for the failure output. */
const REMEDY: Record<UnportableReason, string> = {
  "reserved-character": "Windows forbids < > : \" / \\ | ? * in a path component. Rename, or encode it (schemas/kg/portable-path.ts).",
  "reserved-device-name": "A Windows device name (CON, PRN, AUX, NUL, COM1-9, LPT1-9) is reserved even with an extension. It must be renamed — no encoding rescues it.",
  "trailing-dot-or-space": "Windows strips a trailing dot or space, silently aliasing this onto another name. Rename it.",
  empty: "An empty path component.",
};

/** Tracked paths, `/`-separated, as git records them. */
export function trackedPaths(root: string): string[] {
  // `-z` and not a line split: a filename may contain a newline, and git would
  // otherwise quote it into something that is no longer the path. A gate about
  // filenames cannot afford to mangle the filenames it reads.
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter((p) => p !== "");
}

export function checkPortablePaths(root: string): PortablePathsReport {
  const paths = trackedPaths(root);
  const findings: UnportableFinding[] = [];
  for (const path of paths) {
    const bad = unportablePath(path);
    if (bad) findings.push({ path, segment: bad.segment, reason: bad.reason });
  }
  return { examined: paths.length, findings };
}

export function formatReport(r: PortablePathsReport): string {
  const out: string[] = ["Portable paths", ""];
  out.push(`  tracked paths examined   ${r.examined}`);
  out.push("");
  if (r.findings.length === 0) {
    out.push("  ✓ every tracked path can be created on Windows, macOS and Linux");
    return out.join("\n");
  }
  out.push(`  ✗ ${r.findings.length} tracked path(s) would abort a checkout:`);
  out.push("");
  // Grouped by reason: the remedy differs per reason, and repeating it per row
  // buries the one line the committer has to act on.
  const byReason = new Map<UnportableReason, UnportableFinding[]>();
  for (const f of r.findings) {
    const rows = byReason.get(f.reason) ?? [];
    rows.push(f);
    byReason.set(f.reason, rows);
  }
  for (const [reason, rows] of byReason) {
    out.push(`  ${reason} — ${REMEDY[reason]}`);
    for (const f of rows.sort((a, b) => (a.path < b.path ? -1 : 1))) {
      out.push(`      ${f.path}   (segment: ${f.segment})`);
    }
    out.push("");
  }
  out.push("  Git aborts the ENTIRE checkout on the first such path, so this is not");
  out.push("  a per-file problem: the repository is unclonable on that platform.");
  return out.join("\n");
}

if (import.meta.main) {
  const root = resolve(".");
  let report: PortablePathsReport;
  try {
    report = checkPortablePaths(root);
  } catch (e) {
    console.error(`Could not list tracked paths: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Nothing was checked for portability.");
    process.exit(2);
  }
  if (report.examined === 0) {
    console.error("`git ls-files` returned nothing — this is not a checkout, or it is empty.");
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.findings.length ? 1 : 0);
}
