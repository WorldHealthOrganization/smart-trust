#!/usr/bin/env bun
/**
 * A name that claims an anchor must land on it.
 *
 * The rule is definitional, so it has no false positives:
 *
 * > **`REPO_ROOT`, `REPO`, `repoRoot` must land on the repository root.
 * > `INSTANCE_ROOT`, `instanceRoot` must land on a directory carrying its own
 * > `harness.json`. `PLATFORM`, `platformRoot` and `platformDir` name neither
 * > and are refused** — rename to whichever is meant.
 *
 * The repository root is found by walking up to `.git`, and a layer by its
 * `harness.json`, so neither anchor is a literal this check could get wrong.
 *
 * It does NOT judge whether a hand-rolled ascent (`"../.."`) has the right
 * depth or is used correctly downstream; no signal for that was free of false
 * positives. Trustworthy names are the precondition for such a check.
 *
 * Exit: 0 clean, 1 a mismatched or ambiguous name (or no file read), 2 could
 * not check.
 *
 * @module folio-assistant/scripts/check-anchor-names
 * @covers docs
 */

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { findDeclarationFile, repoRootFor } from "../schemas/kg/cat-harness.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
export const INSTANCE_ROOT = HARNESS_ROOT;

/** Names that claim the repository root. */
export const REPO_NAMES = /^(REPO_ROOT|REPO|repoRoot)$/;
/** Names that claim a layer root — a directory with its own `harness.json`. */
export const INSTANCE_NAMES = /^(INSTANCE_ROOT|instanceRoot)$/;
/**
 * Names that claim neither, and are refused for it.
 *
 * "Platform" means the repository to a folio linking it as a submodule, and
 * the `cat-harness/` code root to everything inside it. Both readings are in
 * use HERE, in one directory of tests, which is the whole argument: a name
 * that needs the reader to know which is meant carries no information.
 */
export const AMBIGUOUS_NAMES = /^(PLATFORM|platformRoot|platformDir)$/;

/**
 * Every spelling of the BASE that means "the directory holding this file".
 *
 * **It was two spellings until 2026-09-27, and that made the ✓ false.**
 * `import.meta.dir` and `__dirname` are the Bun and CJS forms; the portable-ESM
 * `dirname(fileURLToPath(import.meta.url))` and its CJS twin `dirname(__filename)`
 * are just as common here, and an ascent written either way was not an ascent as
 * far as this check could tell. Measured on `main` at `e6404bc80de`, where the
 * check reported **429** ascents and *"✓ every name that claims an anchor lands
 * on it"*: extending the base takes it to **504**, so **75** ascents were invisible,
 * and **9** of those were FINDINGS — `REPO_ROOT`/`REPO` landing on `cat-harness/`,
 * which is a LAYER root. (A first pass here said 25 rather than 75. That count
 * came from a probe over only the files declaring an anchor-NAMED const, while the
 * check reads all 1465 and matches every name — the narrower population was the
 * measurement's, not the defect's.)
 *
 * All nine were name-wrong rather than depth-wrong, so all nine are pure renames;
 * `gen-docs-pages.ts` proved it by calling `repoRootFor(REPO_ROOT)` on its own
 * anchor, which only makes sense if its author knew the value was a layer root.
 *
 * **This is the check's own defect class turned on itself.** An ENUMERATION that
 * has to be edited when a new spelling appears is one that will be wrong — the
 * `6tkl` argument, applied to the matcher instead of to the corpus. Unlike a
 * corpus there is no filesystem to ask: a base is a syntactic form, so the list
 * stays a list. What replaces the missing guarantee is a test PER SPELLING in
 * `anchor-names.test.ts`, so adding a form to this alternation without adding its
 * case is what fails, rather than a silent ✓ two months later.
 */
const ASCENT_BASE = String.raw`(?:import\.meta\.dir|__dirname|dirname\(\s*(?:fileURLToPath\(\s*import\.meta\.url\s*\)|__filename)\s*\))`;

/** `const NAME = resolve(<base>, "..", "..")`, in its `resolve` and `join` spellings. */
const ASCENT = new RegExp(
  String.raw`(?:const|let)\s+(\w+)\s*=\s*(?:resolve|join)\(\s*${ASCENT_BASE}\s*,\s*([^)]*)\)`,
  "g",
);

/**
 * Is this match inside a string literal rather than being code?
 *
 * **This check's own test file is why.** Its fixtures embed sample ascents as
 * strings — `'const REPO_ROOT = resolve(import.meta.dir, "..", "..");'` — and
 * the first run reported three findings against them. A check that cannot
 * tell code from a quoted example of code will be reported to by every test
 * that exercises it, which is the fastest route to somebody deleting it.
 *
 * Counted rather than parsed: an odd number of unescaped quotes of one kind
 * before the match, on that line, means the match sits inside one. That is
 * enough here because an ascent declaration fits on a line; a real parser
 * would be a heavier dependency for no gain this check can use.
 */
function insideStringLiteral(line: string, at: number): boolean {
  for (const q of ["'", '"', "`"]) {
    let n = 0;
    for (let i = 0; i < at && i < line.length; i++) {
      if (line[i] === q && line[i - 1] !== "\\") n++;
    }
    if (n % 2 === 1) return true;
  }
  return false;
}

export interface AnchorFinding {
  file: string;
  name: string;
  lands: string;
  /** What the name claims, and what it actually got. */
  detail: string;
}

export interface AnchorReport {
  filesRead: number;
  ascents: number;
  findings: AnchorFinding[];
}

/** Directories carrying their own `harness.json` — a layer, by definition. */
export function instanceDirs(repo: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(repo)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    try {
      if (statSync(join(repo, name)).isDirectory() && findDeclarationFile(join(repo, name)) !== undefined) out.push(name);
    } catch {
      /* unreadable entry: not a layer as far as this can tell */
    }
  }
  return out;
}

/**
 * Every `.ts` under `dir`, NOT following symbolic links. An ascent is resolved
 * against the path the file was reached by, so a file read through a link
 * (as cat-harness-tools' transitional `content/pipeline -> ../pipeline` was,
 * bean `rnfl`) has its `..` counted from the link and lands one level off: a
 * finding about a path no code runs from. The link's target is walked at its
 * real path anyway.
 */
function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (lstatSync(p).isSymbolicLink()) continue;
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

export function checkAnchorNames(repo: string = repoRootFor(INSTANCE_ROOT)): AnchorReport {
  const report: AnchorReport = { filesRead: 0, ascents: 0, findings: [] };
  for (const inst of instanceDirs(repo)) {
    for (const file of walkTs(join(repo, inst))) {
      let src: string;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      report.filesRead++;
      for (const m of src.matchAll(ASCENT)) {
        // A quoted example of an ascent is not an ascent — see above.
        const lineStart = src.lastIndexOf("\n", m.index ?? 0) + 1;
        const lineEnd = src.indexOf("\n", m.index ?? 0);
        const line = src.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
        if (insideStringLiteral(line, (m.index ?? 0) - lineStart)) continue;
        const name = m[1]!;
        const parts = [...m[2]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
        if (parts.length === 0) continue;
        report.ascents++;
        const lands = resolve(join(file, ".."), ...parts);
        const isRepo = lands === repo;
        const isInstance = findDeclarationFile(lands) !== undefined;
        const where = relative(repo, file);
        const to = relative(repo, lands) || ".";
        if (AMBIGUOUS_NAMES.test(name)) {
          report.findings.push({
            file: where,
            name,
            lands: to,
            detail:
              `\`${name}\` names neither anchor — "platform" is the REPOSITORY to a folio linking it ` +
              `and the code root to everything inside it, and both readings are in use here. ` +
              `It lands on \`${to}\`; rename it to ${isRepo ? "`REPO_ROOT`" : "`INSTANCE_ROOT`"}.`,
          });
        } else if (REPO_NAMES.test(name) && !isRepo) {
          report.findings.push({
            file: where,
            name,
            lands: to,
            detail:
              `\`${name}\` claims the repository root and lands on \`${to}\`` +
              `${isInstance ? ", which is an INSTANCE root — rename it to `INSTANCE_ROOT`" : ", which is neither anchor"}.`,
          });
        } else if (INSTANCE_NAMES.test(name) && !isInstance) {
          report.findings.push({
            file: where,
            name,
            lands: to,
            detail:
              `\`${name}\` claims an instance root and lands on \`${to}\`` +
              `${isRepo ? ", which is the REPOSITORY root — rename it to `REPO_ROOT`" : ", which carries no declaration"}.`,
          });
        }
      }
    }
  }
  return report;
}

function formatReport(r: AnchorReport): string {
  if (r.filesRead === 0) {
    return "Anchor names\n  ? EXAMINED NOTHING — no instance carried any TypeScript. Not a pass.";
  }
  const out = [`Anchor names (${r.filesRead} file(s), ${r.ascents} declared ascent(s))`];
  if (r.findings.length === 0) {
    out.push("  ✓ every name that claims an anchor lands on it");
    return out.join("\n");
  }
  for (const f of r.findings) out.push(`  ✗ ${f.file}\n      ${f.detail}`);
  out.push("");
  out.push("  This check does NOT catch a re-rooted ascent — see the module header for the three");
  out.push("  designs that were measured and failed. It removes the ambiguity that defect hid behind.");
  return out.join("\n");
}

if (import.meta.main) {
  let report: AnchorReport;
  try {
    report = checkAnchorNames();
  } catch (e) {
    console.error(`Could not check anchor names: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.findings.length || report.filesRead === 0 ? 1 : 0);
}
