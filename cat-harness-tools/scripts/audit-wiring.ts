#!/usr/bin/env bun
/**
 * Witness-wiring audit — sorts every Python `.witness.json` into one of three
 * buckets and reports the actionable orphan set.
 *
 *   1. **wired**       — referenced by `computation.witness` (string or
 *                        array) in some content block under `content/`.
 *   2. **audit-only**  — declares a top-level `"auditOnly"` field
 *                        pointing at `docs/audits/<file>.md`; never
 *                        expected to wire to a content block.
 *   3. **orphan**      — neither wired nor audit-only.  This is the
 *                        actionable set.
 *
 * Outputs (written to ``--out-dir`` if given, else stdout summary only):
 *
 *   - ``summary.json``   — counts per bucket, plus per-directory breakdown.
 *   - ``orphans.tsv``    — one row per orphan with columns
 *                          ``witness, scriptFile, contentBlock-claim,
 *                          age-days, lastTouchedSha, falsifiability``.
 *   - ``stale-claims.tsv`` — orphans whose self-claimed ``contentBlock``
 *                          exists as a real content block but does **not**
 *                          reference the witness back via
 *                          ``computation.witness``.  Easiest wires.
 *
 * Exit code:
 *   0  — under all gates (or ``--warn-only`` set).
 *   2  — per-directory budget gate exceeded (see ``--max-per-dir``).
 *   3  — global 20%-above-baseline gate exceeded
 *        (only checked when ``--baseline <N>`` is given).
 *
 * Usage
 * -----
 *   bun run cat-harness-tools/scripts/audit-wiring.ts                       # summary to stdout
 *   bun run cat-harness-tools/scripts/audit-wiring.ts --out-dir audit-out   # write all 3 files
 *   bun run cat-harness-tools/scripts/audit-wiring.ts --warn-only           # never exit non-zero
 *   bun run cat-harness-tools/scripts/audit-wiring.ts --max-per-dir 5
 *   bun run cat-harness-tools/scripts/audit-wiring.ts --baseline 480 --max-growth 0.20
 *   bun run cat-harness-tools/scripts/audit-wiring.ts --triage-by-age 90    # quarterly sweep
 *
 * Scope
 * -----
 *   Scans `folio-assistant/computations/` recursively for
 *   `*.witness.json` (witnesses live next to their producer scripts in
 *   cluster subdirs). Lean witnesses
 *   (``content/**\/*.lean.*.witness``) have a different lifecycle and are
 *   covered by ``scripts/lean-witness.ts`` / ``scripts/witness-audit.ts``.
 *
 * @module scripts/audit-wiring
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname, relative } from "path";
import { globSync } from "glob";
import { execFileSync, execSync } from "child_process";
import type { ComputationWitness } from "../schemas/types.ts";
import { findContentRepoRoot } from "../pipeline/repo-root";

/**
 * A `.witness.json` as it appears on disk.
 *
 * Every field is optional and read defensively: these files are produced by
 * the folio's Python `WitnessBuilder` and can be malformed (this script
 * counts that case), so nothing here is guaranteed. `scriptFile`,
 * `scriptHash`, `scriptCommitSha` and `git_sha` are written by the builder
 * but are NOT on `ComputationWitness` in `schemas/types.ts` — the two have
 * drifted, and the drift is only visible once this stops being `any`.
 */
interface WitnessFile extends Partial<ComputationWitness> {
  scriptFile?: string;
  scriptHash?: string;
  scriptCommitSha?: string;
  git_sha?: string;
}

// Was `import.meta.dir`-relative, i.e. the PLATFORM — but every path below is
// folio content (`content/**`, `computations/**`), and this is used as the cwd
// for those globs. `findContentRepoRoot()` walks up from the real cwd;
// `import.meta.dir` resolves back through a folio's `folio-assistant/` symlink.
const REPO_ROOT = findContentRepoRoot();

// ── CLI ──────────────────────────────────────────────────────────

interface Args {
  outDir?: string;
  warnOnly: boolean;
  maxPerDir?: number;
  baseline?: number;
  maxGrowth: number;
  triageByAge?: number;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { warnOnly: false, maxGrowth: 0.20, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--out-dir") a.outDir = argv[++i];
    else if (v === "--warn-only") a.warnOnly = true;
    else if (v === "--max-per-dir") a.maxPerDir = Number(argv[++i]);
    else if (v === "--baseline") a.baseline = Number(argv[++i]);
    else if (v === "--max-growth") a.maxGrowth = Number(argv[++i]);
    else if (v === "--triage-by-age") a.triageByAge = Number(argv[++i]);
    else if (v === "--json") a.json = true;
    else if (v === "--help" || v === "-h") {
      console.log(readFileSync(import.meta.path, "utf-8").split("*/")[0]);
      process.exit(0);
    }
  }
  return a;
}

// ── Helpers ──────────────────────────────────────────────────────

function gitFileFirstShas(filePaths: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (filePaths.length === 0) return out;
  for (const fp of filePaths) out.set(fp, "unknown");
  try {
    const batch = execFileSync(
      "git",
      ["log", "--format=COMMIT %H", "--name-only", "--", ...filePaths],
      { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 }
    ).toString();
    let cur = "unknown";
    let unresolved = filePaths.length;
    for (const line of batch.split("\n")) {
      if (line.startsWith("COMMIT ")) cur = line.slice(7).trim();
      else if (line.trim()) {
        const rel = line.trim();
        if (out.has(rel) && out.get(rel) === "unknown") {
          out.set(rel, cur);
          if (--unresolved <= 0) break;
        }
      }
    }
  } catch {
    /* fall through with "unknown" */
  }
  return out;
}

function ageDays(filePath: string): number {
  try {
    const ts = execFileSync("git", ["log", "-n", "1", "--format=%ct", "--", filePath], {
      cwd: REPO_ROOT,
    })
      .toString()
      .trim();
    if (!ts) return -1;
    const seconds = Number(ts);
    if (!Number.isFinite(seconds)) return -1;
    return Math.floor((Date.now() / 1000 - seconds) / 86400);
  } catch {
    return -1;
  }
}

// ── Bucketing ────────────────────────────────────────────────────

interface OrphanRow {
  witness: string;            // repo-relative
  scriptFile: string;         // file basename or "unknown"
  contentBlockClaim: string;  // self-claim from witness JSON, or ""
  ageDays: number;
  lastTouchedSha: string;
  falsifiability: string;     // "passing" | "FAILING" | "no-assertions" | "malformed"
}

interface AuditReport {
  generatedAt: string;
  commitSha: string;
  totals: {
    total: number;
    wired: number;
    auditOnly: number;
    orphan: number;
  };
  perDirectory: Record<
    string,
    { total: number; wired: number; auditOnly: number; orphan: number }
  >;
  staleClaims: number; // count of orphans whose contentBlock exists but doesn't ref back
}

/**
 * Scan every content block .ts file once and build a set of witness
 * paths declared via ``computation.witness`` (string | string[]).  Paths
 * are normalised to repo-root-relative POSIX form.
 */
function collectWiredWitnesses(): {
  wired: Set<string>;
  blockHasWitnessFor: Map<string, Set<string>>; // label → set of witness paths
  blockLabels: Set<string>;
} {
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const tsFiles = globSync("folio/**/*.ts", {
    cwd: REPO_ROOT,
    absolute: true,
    ignore: ["**/node_modules/**"],
  });

  const wired = new Set<string>();
  const blockHasWitnessFor = new Map<string, Set<string>>();
  const blockLabels = new Set<string>();

  // Pull `label: "..."` and `witness: "..."` / `witness: [ ... ]` from each
  // file.  Content block manifests are small and well-formed; a regex pass
  // is cheaper than parsing TypeScript.  Both fields are quoted string
  // literals in the existing schema.
  const labelRe = /\blabel\s*:\s*["']([^"']+)["']/g;
  // Match: witness: "x" | witness: 'x' | witness: ["a", "b"]
  const witnessSingleRe = /\bwitness\s*:\s*["']([^"']+\.witness\.json)["']/g;
  const witnessArrayRe =
    /\bwitness\s*:\s*\[([\s\S]*?)\]/g;
  const witnessInArrayRe = /["']([^"']+\.witness\.json)["']/g;
  // Witnessed-value registry uses `witnessFile: "..."` (see
  // content/values/registry.ts).  Each entry is the canonical source for
  // a `:val[name]` substitution in paper prose, so it counts as a real
  // wiring path even though no content block carries it directly.
  const witnessFileRe = /\bwitnessFile\s*:\s*["']([^"']+\.witness\.json)["']/g;

  for (const tsf of tsFiles) {
    let src: string;
    try {
      src = readFileSync(tsf, "utf-8");
    } catch {
      continue;
    }

    // Labels (used to detect stale claims)
    for (const m of src.matchAll(labelRe)) {
      blockLabels.add(m[1]);
    }

    // Single-string witness paths
    const witnessesInThisFile: string[] = [];
    for (const m of src.matchAll(witnessSingleRe)) {
      witnessesInThisFile.push(m[1]);
    }
    // Array witness paths
    for (const m of src.matchAll(witnessArrayRe)) {
      for (const inner of m[1].matchAll(witnessInArrayRe)) {
        witnessesInThisFile.push(inner[1]);
      }
    }
    // Witnessed-value registry entries (`witnessFile: "..."`).  Treated
    // as wired: each registry entry feeds a `:val[name]` substitution
    // that is rendered into paper prose at build time.
    for (const m of src.matchAll(witnessFileRe)) {
      witnessesInThisFile.push(m[1]);
    }

    for (const w of witnessesInThisFile) {
      // Normalise: paths are documented as repo-root-relative (api design
      // memory: types.ts:290-307); trim any leading "./".
      const norm = w.replace(/^\.\//, "");
      wired.add(norm);

      // Index by every label that appears in the same file.  This is a
      // *file-level* approximation: a single .ts file may declare several
      // sibling blocks, but in practice each manifest is one block.  The
      // index is only used for the stale-claims check, which over-reports
      // wires (false-positive direction) — safe for an advisory column.
      for (const m of src.matchAll(labelRe)) {
        if (!blockHasWitnessFor.has(m[1])) {
          blockHasWitnessFor.set(m[1], new Set());
        }
        blockHasWitnessFor.get(m[1])!.add(norm);
      }
    }
  }
  return { wired, blockHasWitnessFor, blockLabels };
}

interface BucketResult {
  report: AuditReport;
  orphans: OrphanRow[];
  staleClaims: OrphanRow[];
}

function audit(args: Args): BucketResult {
  const witnessFiles = globSync(
    // Recursive glob: post the 2026-06-02 subdirectory refactor,
    // witnesses sit next to their producer scripts inside cluster
    // subdirs (probes/, habiro/, …). The bare-name `*.witness.json`
    // form is preserved by `_path_bridge.py` for imports, but
    // file-system scans need the `**/` recursion.
    //
    // `_deprecated/` is explicitly excluded — its witnesses are
    // dead exploratory probes by definition (see the README in
    // that directory). Including them would pollute the audit's
    // orphan-count baseline.
    "folio-assistant/computations/**/*.witness.json",
    {
      cwd: REPO_ROOT,
      absolute: true,
      ignore: ["folio-assistant/computations/_deprecated/**"],
    }
  );

  const { wired, blockHasWitnessFor, blockLabels } = collectWiredWitnesses();

  // Batch git query for ages / SHAs of all witness files
  const relWitnessPaths = witnessFiles.map((f) =>
    relative(REPO_ROOT, f).split("\\").join("/")
  );
  const shaMap = gitFileFirstShas(relWitnessPaths);

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    commitSha: (() => {
      try {
        return execSync("git rev-parse HEAD", { cwd: REPO_ROOT })
          .toString()
          .trim();
      } catch {
        return "unknown";
      }
    })(),
    totals: { total: 0, wired: 0, auditOnly: 0, orphan: 0 },
    perDirectory: {},
    staleClaims: 0,
  };
  const orphans: OrphanRow[] = [];
  const staleClaims: OrphanRow[] = [];

  for (const wf of witnessFiles) {
    const rel = relative(REPO_ROOT, wf).split("\\").join("/");
    const dir = dirname(rel);
    if (!report.perDirectory[dir]) {
      report.perDirectory[dir] = {
        total: 0,
        wired: 0,
        auditOnly: 0,
        orphan: 0,
      };
    }
    const dirBucket = report.perDirectory[dir];
    report.totals.total++;
    dirBucket.total++;

    let witness: WitnessFile | null = null;
    let malformed = false;
    const rawText = (() => {
      try { return readFileSync(wf, "utf-8"); } catch { return ""; }
    })();
    try {
      witness = JSON.parse(rawText) as WitnessFile;
    } catch {
      malformed = true;
    }

    // Bucket 1: wired
    if (wired.has(rel)) {
      report.totals.wired++;
      dirBucket.wired++;
      continue;
    }

    // Bucket 2: audit-only (must declare auditOnly explicitly).  We honor
    // the field even when the body fails strict JSON.parse (some scripts
    // emit `-Infinity` literals that are valid Python but invalid JSON);
    // the auditOnly flag is the author's intentional opt-out from the
    // orphan tally and should not be defeated by an unrelated body issue.
    const auditOnlyFromJson =
      !malformed && witness && typeof witness.auditOnly === "string" &&
      witness.auditOnly.length > 0
        ? witness.auditOnly
        : null;
    const auditOnlyFromRegex = auditOnlyFromJson
      ? null
      : (rawText.match(
          /"auditOnly"\s*:\s*"([^"\\]+)"/
        )?.[1] ?? null);
    if (auditOnlyFromJson || auditOnlyFromRegex) {
      report.totals.auditOnly++;
      dirBucket.auditOnly++;
      continue;
    }

    // Bucket 3: orphan
    report.totals.orphan++;
    dirBucket.orphan++;

    const days = ageDays(rel);
    if (
      args.triageByAge !== undefined &&
      (days < 0 || days < args.triageByAge)
    ) {
      // --triage-by-age filters the orphans output to the long tail
      continue;
    }

    const scriptFile =
      (!malformed && witness && typeof witness.scriptFile === "string"
        ? witness.scriptFile
        : "") || "unknown";
    const contentBlockClaim =
      (!malformed && witness && typeof witness.contentBlock === "string"
        ? witness.contentBlock
        : "") || "";
    let falsifiability = "no-assertions";
    if (malformed) {
      falsifiability = "malformed";
    } else if (
      Array.isArray(witness?.assertions) &&
      witness.assertions.length > 0
    ) {
      falsifiability = witness.allPassed === false ? "FAILING" : "passing";
    }

    const row: OrphanRow = {
      witness: rel,
      scriptFile,
      contentBlockClaim,
      ageDays: days,
      lastTouchedSha: (shaMap.get(rel) || "unknown").slice(0, 12),
      falsifiability,
    };
    orphans.push(row);

    // Stale claim: self-claimed contentBlock exists, but no .ts in that
    // block's manifest references the witness back.
    if (
      contentBlockClaim &&
      blockLabels.has(contentBlockClaim) &&
      !(blockHasWitnessFor.get(contentBlockClaim)?.has(rel) ?? false)
    ) {
      staleClaims.push(row);
    }
  }
  report.staleClaims = staleClaims.length;

  return { report, orphans, staleClaims };
}

// ── Output ───────────────────────────────────────────────────────

const TSV_HEADER = [
  "witness",
  "scriptFile",
  "contentBlockClaim",
  "ageDays",
  "lastTouchedSha",
  "falsifiability",
].join("\t");

function rowToTsv(r: OrphanRow): string {
  return [
    r.witness,
    r.scriptFile,
    r.contentBlockClaim,
    r.ageDays >= 0 ? String(r.ageDays) : "?",
    r.lastTouchedSha,
    r.falsifiability,
  ].join("\t");
}

function writeOutputs(result: BucketResult, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "summary.json"),
    JSON.stringify(result.report, null, 2) + "\n"
  );
  writeFileSync(
    resolve(outDir, "orphans.tsv"),
    [TSV_HEADER, ...result.orphans.map(rowToTsv)].join("\n") + "\n"
  );
  writeFileSync(
    resolve(outDir, "stale-claims.tsv"),
    [TSV_HEADER, ...result.staleClaims.map(rowToTsv)].join("\n") + "\n"
  );
}

function printSummary(report: AuditReport): void {
  console.log("Witness-wiring audit");
  console.log(`  generated: ${report.generatedAt}`);
  console.log(`  commit:    ${report.commitSha.slice(0, 12)}`);
  console.log("");
  console.log(`  total:      ${report.totals.total}`);
  console.log(`    wired:    ${report.totals.wired}`);
  console.log(`    audit-only: ${report.totals.auditOnly}`);
  console.log(`    orphan:   ${report.totals.orphan}`);
  console.log(`    (of which stale-claims: ${report.staleClaims})`);
  console.log("");
  console.log("Per-directory:");
  for (const [dir, b] of Object.entries(report.perDirectory)) {
    console.log(
      `  ${dir.padEnd(40)}  total=${String(b.total).padStart(4)}  ` +
        `wired=${String(b.wired).padStart(4)}  ` +
        `audit-only=${String(b.auditOnly).padStart(4)}  ` +
        `orphan=${String(b.orphan).padStart(4)}`
    );
  }
}

// ── Gates ────────────────────────────────────────────────────────

function evaluateGates(
  report: AuditReport,
  args: Args
): { code: number; messages: string[] } {
  const messages: string[] = [];
  let code = 0;

  if (args.maxPerDir !== undefined) {
    for (const [dir, b] of Object.entries(report.perDirectory)) {
      if (b.orphan > args.maxPerDir) {
        messages.push(
          `[gate:max-per-dir] ${dir}: ${b.orphan} orphans (limit ${args.maxPerDir})`
        );
        code = Math.max(code, 2);
      }
    }
  }

  if (args.baseline !== undefined) {
    const ceiling = Math.ceil(args.baseline * (1 + args.maxGrowth));
    if (report.totals.orphan > ceiling) {
      messages.push(
        `[gate:growth] total orphans ${report.totals.orphan} exceeds ` +
          `${ceiling} (baseline ${args.baseline} +${(args.maxGrowth * 100).toFixed(0)}%)`
      );
      code = Math.max(code, 3);
    }
  }

  return { code, messages };
}

// ── Main ─────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const result = audit(args);

  if (args.outDir) {
    writeOutputs(result, args.outDir);
  }

  if (args.json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    printSummary(result.report);
  }

  const { code, messages } = evaluateGates(result.report, args);
  for (const m of messages) console.error(m);

  if (args.warnOnly) {
    if (code !== 0) console.error("(warn-only: not exiting non-zero)");
    process.exit(0);
  }
  process.exit(code);
}

main();
