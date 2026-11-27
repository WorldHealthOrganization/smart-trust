#!/usr/bin/env bun
/**
 * A script's usage string must name the script.
 *
 * Asks one question, with no cwd model and no judgement:
 *
 * > When a file's own header says `bun run <path>` and `<path>` is this file
 * > under a shorter root, is `<path>` where this file actually is?
 *
 * "Under a shorter root" is a **path-segment suffix** test, not a basename
 * test: `pipeline/build.ts` is a suffix of
 * `cat-harness/content/pipeline/build.ts` and so names it, while
 * `src/index.ts` is not a suffix of `cat-harness/tools/index.ts` and names
 * a different file. Basename collisions are excluded structurally.
 *
 * Only SELF-references are judged: the reader is looking at the file, so the
 * only true path is the file's own. General paths in prose are
 * `check:command-paths`' (which counts unresolvable ones as folio-relative
 * rather than judging them).
 *
 * Where a `package.json` script exists for the file, the script name is
 * reported as advice but never applied (it may bake in flags). `--fix` only
 * ever writes the file's own repo-relative path.
 *
 * Tests are excluded: a test may name a non-existent path as a fixture.
 *
 * A file this module cannot read is {@link Verdict.Undetermined} and the run
 * FAILS.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-usage-paths.ts          # report, exit 1 on a finding
 *   bun run cat-harness-tools/scripts/check-usage-paths.ts --list    # every self-reference and its verdict
 *   bun run cat-harness-tools/scripts/check-usage-paths.ts --fix     # rewrite each to the file's own path
 *
 * @covers none — it audits usage strings in SOURCE comments, which are not the
 *   content of any declared graph. A `.ts` file under `skills/` is scanned
 *   because it is source, not because the `kg` graph is being judged; the graph
 *   audits are `kg:audit`. Same decision and same reason as
 *   `check-workflow-paths.ts`.
 *
 * @module scripts/check-usage-paths
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { trackedPaths } from "./check-portable-paths.js";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";

const ROOT = repoRootFor(resolve(import.meta.dir, ".."));

/**
 * The subject set comes from **git**, not from a filesystem walk.
 *
 * Bean `xd1g` — *"11 root-rooted scans have no gitignore awareness"* — and its
 * parent `ramz`, where `check-context-emission` *"walked the filesystem behind a
 * hand-written denylist and swept 145 gitignored documents as repository
 * content."* That is the defect this module would have shipped: its first draft
 * carried a `SKIP_DIRS` denylist (`node_modules`, `build`, `dist`, `.venv`, …),
 * which is the same construction under a different name.
 *
 * A denylist is wrong in a way that hides itself. It passes on CI, where a
 * checkout holds nothing ignored, and misbehaves only in a working container
 * that has accumulated generated directories — so the failure arrives for
 * whoever is mid-work and never for the gate's author. Measured here: a
 * container carrying untracked `_kg/`, `schemas/` and `scripts/` made two
 * SIBLING gates disagree with CI, which is how this was noticed at all.
 *
 * `trackedPaths` is reused rather than re-implemented, and it carries the
 * reason for `-z` on itself: a filename may contain a newline, and a line split
 * would mangle the very paths a path check reads.
 *
 */
/** Extensions whose header comments carry usage strings. */
const SUBJECT = /\.(ts|tsx|sh|py)$/;

/** What became of one self-reference. */
export enum Verdict {
  /** The usage string names the file's own repo-relative path. */
  Names = "names-itself",
  /** It names something else. A defect. */
  Misnames = "misnames-itself",
  /** Declared in {@link SELF_REF_EXEMPTIONS}: wrong-looking on purpose. */
  Exempt = "exempt",
  /** The file could not be read. NOT a pass. */
  Undetermined = "undetermined",
}

/**
 * A self-reference that is deliberately not the file's own path.
 *
 * `file` is the referring file's repo-relative path and `match` a substring of
 * the spelling it uses. Every entry must match at least one occurrence, or the
 * run fails — an exemption for a line that no longer exists is a claim about
 * the present that stopped being true. Same shape and same reason as
 * `FOLIO_PATHS` in `check-workflow-paths.ts`.
 *
 * Empty at birth, and that is the finding rather than an oversight: all 107
 * files measured on 2026-09-20 were simply stale, none was deliberate.
 */
export interface SelfRefExemption {
  file: string;
  match: string;
  reason: string;
}

export const SELF_REF_EXEMPTIONS: SelfRefExemption[] = [];

/** One `bun run <path>` occurrence that names the file it sits in. */
export interface SelfReference {
  /** The referring file, relative to the repository root. */
  file: string;
  /** 1-indexed line. */
  line: number;
  /** The path exactly as the file spells it. */
  spelled: string;
  /** What it should say: the referring file's own repo-relative path. */
  expected: string;
  verdict: Verdict;
  /** A `package.json` script that runs this file, when one exists. */
  script?: string;
  /** Set on {@link Verdict.Exempt} and {@link Verdict.Undetermined}. */
  note?: string;
}

/** `bun run <path>` / `bunx run <path>`, path-shaped only. */
const INVOCATION = /bun(?:x)?\s+run\s+([A-Za-z0-9_@./-]+\.(?:ts|tsx|sh|py))/g;

/**
 * Does `spelled` name `rel` under a shorter root?
 *
 * A path-segment suffix test, NOT a basename test — see the module header on
 * `cat-harness/tools/index.ts` documenting `src/index.ts`, where the basename
 * rule would have produced a wrong fix that looks right. Segment-wise so
 * `x-build.ts` can never be read as a suffix of `prefix/x-build.ts`’s sibling.
 */
export function namesSelf(rel: string, spelled: string): boolean {
  const a = rel.split("/");
  const b = spelled.split("/");
  if (b.length === 0 || b.length > a.length) return false;
  for (let i = 0; i < b.length; i++) {
    if (a[a.length - b.length + i] !== b[i]) return false;
  }
  return true;
}

/**
 * Every file of the checkout at `root`, repo-relative: `trackedPaths`'s
 * answer, widened to the mounted layers.
 *
 * In a composed checkout every layer is a REMOTE MOUNT, laid down from
 * `index.lock.json` and ignored by the index repository's git, so a bare
 * `git ls-files` at the root lists none of their files. `gitCorpus` counts a
 * mount's files as it counted a submodule's, and is tracked-plus-untracked
 * exactly as before everywhere else.
 *
 * When git cannot answer, this falls back to `trackedPaths`, which reports
 * nothing outside a checkout -- the could-not-determine the caller handles.
 */
export function checkoutPaths(root: string): string[] {
  const all = gitCorpus(root);
  return all === undefined ? trackedPaths(root) : all.map((f) => relative(root, f).split(sep).join("/"));
}

/**
 * Every subject file under `root`, repo-relative.
 *
 * Tests are dropped here rather than filtered later so a caller cannot
 * reintroduce them by forgetting — see the module header on why a deliberate
 * fixture must not be reported.
 */
export function subjectFiles(root: string, list: (r: string) => string[] = checkoutPaths): string[] {
  return list(root)
    .filter((rel) => SUBJECT.test(rel))
    .filter((rel) => !/\.test\.(ts|tsx)$/.test(rel))
    .filter((rel) => !rel.split("/").includes("tests"))
    .sort();
}

/**
 * Which `package.json` script, if any, runs `rel`.
 *
 * Reported as advice, never applied — see the module header. Returns the first
 * matching name so the advice is stable across runs.
 */
export function scriptFor(rel: string, scripts: Record<string, string>): string | undefined {
  for (const [name, cmd] of Object.entries(scripts)) {
    if (String(cmd).includes(rel)) return name;
  }
  return undefined;
}

/** The `scripts` block of the repository root's `package.json`, or `{}`. */
export function rootScripts(root: string): Record<string, string> {
  try {
    return scriptsOf(root);
  } catch {
    return {};
  }
}

/** Every self-reference in one file, with its verdict. */
export function selfReferences(
  root: string,
  rel: string,
  scripts: Record<string, string>,
): SelfReference[] {
  let src: string;
  try {
    src = readFileSync(join(root, rel), "utf8");
  } catch (e) {
    return [
      {
        file: rel,
        line: 0,
        spelled: "",
        expected: rel,
        verdict: Verdict.Undetermined,
        note: `unreadable: ${e instanceof Error ? e.message : String(e)}`,
      },
    ];
  }
  const out: SelfReference[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(INVOCATION)) {
      const spelled = m[1];
      if (!namesSelf(rel, spelled)) continue; // names a different file
      const exempt = SELF_REF_EXEMPTIONS.find(
        (x) => x.file === rel && spelled.includes(x.match),
      );
      out.push({
        file: rel,
        line: i + 1,
        spelled,
        expected: rel,
        verdict: exempt
          ? Verdict.Exempt
          : spelled === rel
            ? Verdict.Names
            : Verdict.Misnames,
        script: scriptFor(rel, scripts),
        note: exempt?.reason,
      });
    }
  }
  return out;
}

/** Every self-reference in the repository. */
export function auditAll(root: string, list?: (r: string) => string[]): SelfReference[] {
  const scripts = rootScripts(root);
  return subjectFiles(root, list).flatMap((rel) => selfReferences(root, rel, scripts));
}

/**
 * Rewrite each misnamed self-reference to the referring file's own path.
 *
 * Only the exact spelling is replaced, and only on the line it was found on,
 * so a line mentioning two paths cannot have the other one rewritten. Returns
 * the files touched.
 */
export function applyFix(root: string, refs: SelfReference[]): string[] {
  const byFile = new Map<string, SelfReference[]>();
  for (const r of refs) {
    if (r.verdict !== Verdict.Misnames) continue;
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file)!.push(r);
  }
  const touched: string[] = [];
  for (const [rel, rs] of byFile) {
    const abs = join(root, rel);
    const lines = readFileSync(abs, "utf8").split("\n");
    for (const r of rs) {
      const i = r.line - 1;
      if (i < 0 || i >= lines.length) continue;
      lines[i] = lines[i].split(r.spelled).join(r.expected);
    }
    writeFileSync(abs, lines.join("\n"));
    touched.push(rel);
  }
  return touched.sort();
}

/** Exemptions matching nothing — each is a stale claim about the present. */
export function unmatchedExemptions(refs: SelfReference[]): SelfRefExemption[] {
  return SELF_REF_EXEMPTIONS.filter(
    (x) => !refs.some((r) => r.file === x.file && r.spelled.includes(x.match)),
  );
}

/** The report, as lines. Separated from printing so a test can read it. */
export function report(refs: SelfReference[], list: boolean): string[] {
  const out: string[] = [];
  const of = (v: Verdict): SelfReference[] => refs.filter((r) => r.verdict === v);
  const bad = of(Verdict.Misnames);
  const unknown = of(Verdict.Undetermined);

  if (list) {
    for (const r of refs) {
      const mark =
        r.verdict === Verdict.Names
          ? "✓"
          : r.verdict === Verdict.Misnames
            ? "✗"
            : r.verdict === Verdict.Undetermined
              ? "?"
              : "–";
      out.push(`${mark} ${r.file}:${r.line}  ${r.spelled}`);
      if (r.verdict === Verdict.Misnames) out.push(`    should be: ${r.expected}`);
      if (r.note) out.push(`    ${r.note}`);
    }
    out.push("");
  }

  for (const r of unknown) out.push(`? ${r.file}  ${r.note ?? "could not read"}`);

  if (bad.length > 0) {
    const files = new Set(bad.map((r) => r.file));
    out.push(
      `✗ ${bad.length} usage string(s) in ${files.size} file(s) name a path that is not the file's own.`,
      "",
      "  A reader copying one of these gets a module-not-found error. Fix with:",
      "    bun run cat check:usage-paths --fix",
      "",
    );
    if (!list) {
      for (const r of bad.slice(0, 20)) {
        out.push(`  ${r.file}:${r.line}`, `      says: ${r.spelled}`);
      }
      if (bad.length > 20) out.push(`  … and ${bad.length - 20} more (--list for all)`);
      out.push("");
    }
    const withScript = [...new Set(bad.filter((r) => r.script).map((r) => r.file))];
    if (withScript.length > 0) {
      out.push(
        `  ${withScript.length} of the ${files.size} file(s) already have a package.json`,
        "  script. Naming it instead of a path is the better spelling — it puts the",
        "  path in one place. NOT applied by --fix: a named script may bake in flags",
        "  the usage line varies, so substituting one is a judgement about",
        "  equivalence rather than a rename.",
        "",
      );
    }
  }

  const stale = unmatchedExemptions(refs);
  for (const x of stale) {
    out.push(`✗ exemption matches nothing: ${x.file} / ${x.match}`, `    ${x.reason}`);
  }

  if (unknown.length > 0) {
    out.push(
      `? ${unknown.length} file(s) could not be read. This is NOT a pass and NOT a`,
      "  failure of the check — no verdict is possible over them, so nothing here",
      "  may be read as a clean tree. Exit 2.",
    );
  } else if (bad.length === 0 && stale.length === 0) {
    out.push(
      `✓ every one of ${refs.length} self-referencing usage string(s) names its own file`,
    );
  }
  return out;
}

if (import.meta.main) {
  const list = process.argv.includes("--list");
  const fix = process.argv.includes("--fix");
  const refs = auditAll(ROOT);

  if (fix) {
    const touched = applyFix(ROOT, refs);
    for (const f of touched) console.log(`fixed ${f}`);
    console.log(`\n${touched.length} file(s) rewritten. Re-run without --fix to verify.`);
    process.exit(0);
  }

  // An empty subject set is could-not-determine, never a pass. `trackedPaths`
  // returns nothing outside a checkout, and "no file misnames itself" over zero
  // files is the vacuity this repository has paid for repeatedly.
  if (refs.length === 0) {
    console.error("? no self-referencing usage string was found in any tracked file.");
    console.error("  Either `git ls-files` returned nothing — not a checkout — or the");
    console.error("  subject filter matched none of it. This is NOT a pass. Exit 2.");
    process.exit(2);
  }

  for (const line of report(refs, list)) console.log(line);
  const unknown = refs.some((r) => r.verdict === Verdict.Undetermined);
  if (unknown) process.exit(2);
  const bad =
    refs.some((r) => r.verdict === Verdict.Misnames) || unmatchedExemptions(refs).length > 0;
  process.exit(bad ? 1 : 0);
}
