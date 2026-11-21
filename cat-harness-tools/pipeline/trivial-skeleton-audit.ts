#!/usr/bin/env bun
/**
 * Trivial-skeleton audit (CLAUDE.md §3b-cond honesty check).
 *
 * Flags Lean declarations whose body is a tautological constant —
 * the instance/def is Lean-verified but encodes none of the
 * conjectural content.  These are spec-compliant under the §3b-cond
 * pattern (prove the class is inhabited) but should be **upgraded
 * to faithful layers** as the genuine mathematics is formalised.
 *
 * Patterns flagged:
 *   const_zero        : `def f ... := 0` / `:= constant 0`
 *   one_def           : `def f ... := 1`
 *   punit_type        : `def T ... : Type := PUnit`
 *   punit_unit        : `def x ... := PUnit.unit`
 *   prop_true         : `def P ... : Prop := True`
 *   id_def            : `def f ... := id`
 *   first_arg         : `def f x ... := x` (ignores everything else)
 *   skel_inst         : `instance ...skeleton`/`...trivial`
 *   holds_trivial     : `_holds := trivial` / `:= rfl` / `by simp`
 *
 * Output: JSON manifest at
 *   `docs/audits/2026-05-08-trivial-skeleton-audit.json`
 *
 * Usage (from repo root):
 *   bun run cat-harness-tools/pipeline/trivial-skeleton-audit.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { glob } from "glob";
import { findContentRepoRoot, findPapers } from "./repo-root";
import { siteDirFor } from "../schemas/kg/cat-harness.ts";

// Was `resolve(SCRIPT_DIR, "..", "..")` plus a hardcoded
// `content/quantum-observable-universe` — a specific FOLIO paper named in
// PLATFORM code, under a root computed from this file's own location. So the
// scan target was `<platform>/content/quantum-observable-universe`, a path
// that exists in NO checkout: not here (the platform has no papers) and not
// in a folio either, since `import.meta.url` resolves back through the
// `folio-assistant/` symlink to the platform. This audit has never read a
// single Lean file, in either repo — and reported "✓ All strict-gate budgets
// respected" every time.
const REPO_ROOT = findContentRepoRoot();
const PAPERS = findPapers(REPO_ROOT);
// Scan every paper the folio has, not one named in advance.
const PAPER_GLOBS = PAPERS.flatMap((p) => [
  `folio/${p}/*/*.lean`,
  `folio/${p}/lean/**/*.lean`,
]);

// CLI parsing: `--out <path>` overrides witness output;
// `--max-per-pattern name=N,name2=M` enforces per-pattern strict
// gates (process exits non-zero if any pattern's count exceeds the
// stated budget).  Without `--max-per-pattern`, the script is
// warn-only.  Positional arg #1 (compat with the original API) is
// also treated as `--out`.
const argv = process.argv.slice(2);
// Resolved LAZILY, after argument parsing. `siteDirFor` throws when the root
// carries no declaration -- correct, since a guessed site root writes the
// witness where nothing serves it -- but at module scope that throw fires on
// IMPORT, taking down a run that passed `--out` and never needed the default.
// A folio under audit is not always a declared layer.
let WITNESS_OUT: string | undefined;
const strictGates: Record<string, number> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--out") WITNESS_OUT = argv[++i];
  else if (a === "--max-per-pattern") {
    const spec = argv[++i] ?? "";
    for (const kv of spec.split(",")) {
      const [k, v] = kv.split("=");
      if (k && v) strictGates[k.trim()] = Number(v);
    }
  } else if (i === 0 && !a.startsWith("--")) {
    WITNESS_OUT = a;
  }
}

interface PatternHit {
  line: number;
  pattern: string;
  snippet: string;
}

const PATTERNS: Array<[string, RegExp]> = [
  ["const_zero",       /^\s*def\s+\w[\w.]*[^=]*:=\s*(?:fun\s[^=]*=>\s*)?(?:0|0\.0)\s*$/],
  ["const_zero_typed", /^\s*def\s+\w[\w.]*[^=]*:.*=\s*(?:fun\s[^=]*=>\s*)?0\s*$/],
  ["punit_type",       /^\s*def\s+\w[\w.]*[^=]*:\s*Type[^=]*:=\s*PUnit\s*$/],
  ["punit_unit",       /^\s*def\s+\w[\w.]*[^=]*:=\s*PUnit\.unit\s*$/],
  ["prop_true",        /^\s*def\s+\w[\w.]*[^=]*:\s*Prop[^=]*:=\s*True\s*$/],
  ["id_def",           /^\s*def\s+\w[\w.]*[^=]*:=\s*id\s*$/],
  ["one_def",          /^\s*def\s+\w[\w.]*[^=]*:.*=\s*(?:fun\s[^=]*=>\s*)?1\s*$/],
  ["first_arg",        /^\s*def\s+\w[\w.]*\([^)]*\)\s*[^=]*:=\s*\w\s*$/],
  ["trivial_model",    /^\s*def\s+trivialModel\b/],
];
const SKEL_INSTANCE = /^\s*instance\s+\w*[Ss]keleton\b/;
const TRIV_INSTANCE = /^\s*instance\s+\w*[Tt]rivial\b/;
const HOLDS_TRIVIAL = /_holds\s*:=\s*(?:trivial|rfl|by\s+(?:trivial|rfl|simp|norm_num))/;

async function main() {
  // Was `["*/*.lean", "lean/QOU/**/*.lean"]` relative to a single paper —
  // `QOU` being that paper's Lean library name, also hardcoded here.
  const files = await glob(PAPER_GLOBS, { cwd: REPO_ROOT, absolute: true });

  // A scan of nothing is a broken run, not a clean one — the same rule
  // `validateObjects` settled (bean `vald`). It matters most HERE, because
  // the strict gate below tests `observed > budget`: with zero files every
  // `observed` is 0, no budget is ever exceeded, and the audit prints
  // "✓ All strict-gate budgets respected" having read no Lean at all.
  // `witness-pipeline.yml` ran this as "baseline-strict" with the `|| true`
  // mask deliberately dropped, so that pass was load-bearing (that workflow is
  // retired to the `fsh-guts` state branch, bean `1l13`).
  if (files.length === 0) {
    console.error(
      `No .lean files found under ${REPO_ROOT} ` +
      `(papers: ${PAPERS.length ? PAPERS.join(", ") : "none"}) — refusing to report success.\n` +
      "This audit reads a FOLIO's Lean tree; folio-assistant is the platform.\n" +
      "Run it from the content repo.",
    );
    process.exit(1);
  }
  console.log(`Scanning ${files.length} Lean file(s) across ${PAPERS.length} paper(s)\n`);

  const flagged: Record<string, PatternHit[]> = {};
  for (const f of files.sort()) {
    const text = await readFile(f, "utf8");
    const lines = text.split("\n");
    const hits: PatternHit[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Inline-exemption marker: `-- noqa: <pattern>` on the same line skips the audit flag.
      // Use for content-bearing definitions where the matched value
      // (e.g. `:= 1` for a row partition's q-Wenzl dimension) is the
      // CORRECT mathematical value, not a placeholder skeleton.
      const noqaMatch = line.match(/--\s*noqa:\s*([\w_,\s]+)/);
      const exempted = (pat: string) =>
        noqaMatch !== null && noqaMatch[1].split(",").map(s => s.trim()).includes(pat);

      let matched = false;
      for (const [name, pat] of PATTERNS) {
        if (pat.test(line)) {
          if (!exempted(name)) {
            hits.push({ line: i + 1, pattern: name, snippet: line.trim().slice(0, 90) });
          }
          matched = true;
          break;
        }
      }

      if (!matched && (SKEL_INSTANCE.test(line) || TRIV_INSTANCE.test(line))
          && !exempted("skel_inst")) {
        hits.push({ line: i + 1, pattern: "skel_inst", snippet: line.trim().slice(0, 90) });
      } else if (!matched && HOLDS_TRIVIAL.test(line) && !exempted("holds_trivial")) {
        hits.push({ line: i + 1, pattern: "holds_trivial", snippet: line.trim().slice(0, 90) });
      }
    }
    if (hits.length) {
      const rel = f.replace(REPO_ROOT + "/", "");
      flagged[rel] = hits;
    }
  }

  const total = Object.values(flagged).reduce((s, h) => s + h.length, 0);
  console.log(`Files with tautological-skeleton patterns: ${Object.keys(flagged).length}`);
  console.log(`Total flagged lines: ${total}\n`);

  const byCount = Object.entries(flagged).sort((a, b) => b[1].length - a[1].length);
  console.log("Top 10 files by trivial-pattern count:");
  for (const [f, hits] of byCount.slice(0, 10)) {
    console.log(`  ${String(hits.length).padStart(3)} ${f}`);
  }

  const patCounts: Record<string, number> = {};
  for (const hits of Object.values(flagged)) {
    for (const h of hits) {
      patCounts[h.pattern] = (patCounts[h.pattern] ?? 0) + 1;
    }
  }
  console.log("\nPer-pattern counts:");
  const sortedPats = Object.entries(patCounts).sort((a, b) => b[1] - a[1]);
  for (const [name, c] of sortedPats) {
    console.log(`  ${String(c).padStart(4)} ${name}`);
  }

  // This script audits a FOLIO, which is not necessarily a declared layer
  // -- `makeFolio` in the tests builds one with no `harness.json` at all. A
  // declared layer publishes under its stub; an undeclared folio has no
  // stub to publish under, and `docs/` is the pre-instance convention it has
  // always used. That is a documented fallback for a known case, not a
  // guessed stub, which `siteDirFor` still refuses.
  let siteRel: string;
  try {
    siteRel = siteDirFor(REPO_ROOT);
  } catch {
    siteRel = "docs";
  }
  WITNESS_OUT ??= join(REPO_ROOT, siteRel, "audits/2026-05-08-trivial-skeleton-audit.json");
  await mkdir(dirname(WITNESS_OUT), { recursive: true });
  const witness = {
    audit: "trivial-skeleton-audit",
    generated: new Date().toISOString(),
    total_flagged: total,
    files_flagged: Object.keys(flagged).length,
    patterns: Object.fromEntries(sortedPats),
    flagged,
  };
  await writeFile(WITNESS_OUT, JSON.stringify(witness, null, 2));
  console.log(`\nWitness: ${WITNESS_OUT}`);

  // Strict-gate enforcement: if --max-per-pattern was passed, fail
  // the process with a non-zero exit when any pattern exceeds its
  // budget.  Allows progressive tightening as Buckets 1–4 land.
  if (Object.keys(strictGates).length > 0) {
    const violations: string[] = [];
    for (const [name, budget] of Object.entries(strictGates)) {
      const observed = patCounts[name] ?? 0;
      if (observed > budget) {
        violations.push(`  ${name}: ${observed} (budget ${budget})`);
      }
    }
    if (violations.length > 0) {
      console.error("\n❌ Strict-gate violations:");
      for (const v of violations) console.error(v);
      process.exit(1);
    }
    console.log(`\n✓ All strict-gate budgets respected (${files.length} file(s) scanned).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
