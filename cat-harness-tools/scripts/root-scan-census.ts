#!/usr/bin/env bun
/**
 * root-scan-census.ts — how many scanners walk the filesystem, and how many
 * ask GIT what the corpus is.
 *
 * It reports two numbers, because the two shapes are not syntactically
 * distinguishable: scanners that bind a root constant and enumerate anything
 * (mostly correct code — a `readdirSync` over one declared directory reads no
 * gitignored content unless it is there), and enumerations seeded at a root
 * constant (precise, but misses scans that seed a recursion helper or take the
 * root as a PARAMETER).
 *
 * ## Advisory on the FINDINGS, hard on the STALENESS
 *
 * The counts are reported and never fail: the backlog is a shape, not a
 * defect. `--check` fails only when a scan that is SEEDED AT A ROOT and NOT
 * GIT-AWARE is new against a baseline (the same arrangement as
 * `audit-coverage`). A new git-aware scanner does not fail. The baseline is the
 * committed working copy, or `--against <ref>`; a baseline that is not there
 * is UNKNOWN, reported and not gated.
 *
 * ## A FLOOR, stated in the output, never a count
 *
 * The filters are syntactic, so a scanner spelled differently is missed. The
 * sidecar says so in its own summary.
 *
 * Usage:
 *   bun run cat root-scan-census            # report, write the sidecar
 *   bun run cat root-scan-census -- --check # judge, write nothing; fail on a NEW exposed scan
 *   bun run cat root-scan-census -- --check --against main   # ...new against qa-reports
 *
 * @module scripts/root-scan-census
 * @covers cat-harness
 * @graphNode tool
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import * as gitCorpusModule from "../schemas/sdlc/git-corpus.ts";
import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import { layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { againstOrUsage, buildQaResult, judgeQaResult, judgeUsage, writeQaResult, type QaResult } from "./qa-results.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(INSTANCE_ROOT);

/** Binding a root constant — the scan could start at the top of a checkout. */
const ROOT_BOUND = /\b(?:REPO_ROOT|INSTANCE_ROOT|ROOT)\s*[:=]/;

/**
 * Enumerating the filesystem by ANY means, git-aware spellings included.
 *
 * ## Both halves are DERIVED from `git-corpus.ts`, and that is the repair
 *
 * The git spellings were a hardcoded roster — `gitFiles|gitScan|gitCorpus|
 * corpusPredicate` — and it went stale the first time a helper was added.
 * Bean `qrlc`, measured the same hour: `gitTopLevelDirs` landed, three
 * scanners were converted to call it, and this census read **66 enumerating,
 * 10 ask git** before and **65 enumerating, 10 ask git** after. The three had
 * dropped out of the population instead of joining its good side, and the
 * git-aware count had not moved.
 *
 * That is the SECOND time this file has had that defect — the first was the
 * bare-walk-only pattern it shipped with — and it is the class this whole bean
 * family is about: a list of names kept by hand beside the thing it is meant
 * to track. A roster is a dead key waiting to happen.
 *
 * So the names are read from `git-corpus.ts`'s own exports. Adding a helper
 * there is now enough; nothing here has to be remembered.
 */
function gitCorpusExports(): string[] {
  // THE MODULE'S OWN EXPORTS, not its source text. The first version read
  // `schemas/sdlc/git-corpus.ts` and matched `^export function` — which worked, and
  // was a composed path literal that `check:declared-paths` flagged the moment
  // it landed. It was right to: a scanner that reads a file by a path it
  // built is one more thing to keep in step by hand, which is the exact class
  // this census exists to report on.
  //
  // Importing it is strictly better anyway. It cannot drift from the real
  // export list, it needs no regex, and a rename is a compile error here
  // rather than a silent miss.
  const names = Object.keys(gitCorpusModule).filter(
    (k) => typeof (gitCorpusModule as Record<string, unknown>)[k] === "function",
  );
  // NOT a silent empty. If this ever returns nothing, every scanner reads as
  // not-git-aware and the census reports a corpus-wide regression that did not
  // happen — the `dh4f` shape, in the file whose subject is exactly that.
  if (names.length === 0) {
    throw new Error(
      "schemas/sdlc/git-corpus.ts exports no function — the census cannot tell git-aware from not " +
        "without them, and an empty answer here reads as a repository-wide regression",
    );
  }
  return names.sort();
}

const GIT_HELPERS = gitCorpusExports();
const HELPER_CALL = GIT_HELPERS.map((n) => `\\b${n}\\(`).join("|");

const ENUMERATES = new RegExp(`\\bnew Glob\\(|\\breaddirSync\\(|\\.scanSync\\(|${HELPER_CALL}`);

/**
 * The enumeration's start argument IS a root constant — the dangerous shape.
 *
 * A recursion helper or a root passed as a parameter defeats this, which is
 * measured: it catches 4 of the 62, and one of `xd1g`'s twelve. Kept anyway
 * because the two numbers TOGETHER are the finding — the gap between them is
 * what says a syntactic filter cannot answer this question.
 */
const SEEDED_AT_ROOT = [
  /\breaddirSync\(\s*(?:REPO_ROOT|INSTANCE_ROOT|ROOT)\b/,
  /\bscanSync\(\s*\{[^}]*\bcwd:\s*(?:REPO_ROOT|INSTANCE_ROOT|ROOT|root)\b/,
  /\bscan\(\s*\{[^}]*\bcwd:\s*(?:REPO_ROOT|INSTANCE_ROOT|ROOT|root)\b/,
  /\bwalk\(\s*(?:REPO_ROOT|INSTANCE_ROOT|ROOT)\b/,
];

/**
 * Asking git what the corpus is — the same DERIVED list, plus the two raw
 * spellings a caller may use without going through a helper.
 */
const GIT_AWARE = new RegExp(`${HELPER_CALL}|\\bgitListed\\b|ls-files`);

export interface ScanRow {
  file: string;
  /** Does the enumeration start at a root constant? The dangerous shape. */
  seededAtRoot: boolean;
  /** Does it ask git what the corpus is? */
  gitAware: boolean;
}

/** Every filesystem-enumerating script under `dir`, classified. */
export function census(dir: string, repo: string = REPO): ScanRow[] {
  // ASKED OF GIT, which is the rule this file reports on — a version that
  // walked would exempt itself from its own census and would sweep a stray
  // `.ts` in build residue as a scanner to judge.
  const corpus = gitCorpus(dir, ["*.ts"]);
  if (corpus === undefined) return [];
  const out: ScanRow[] = [];
  for (const abs of corpus.sort()) {
    if (abs.endsWith(".test.ts") || abs.endsWith(".d.ts")) continue;
    let src: string;
    try {
      src = readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    if (!ROOT_BOUND.test(src) || !ENUMERATES.test(src)) continue;
    out.push({
      file: relative(repo, abs).split(/[\\/]/).join("/"),
      seededAtRoot: SEEDED_AT_ROOT.some((r) => r.test(src)),
      gitAware: GIT_AWARE.test(src),
    });
  }
  return out;
}

/**
 * ## Repository-wide, with its scope carried in the sidecar — bean `tqv4`
 *
 * This census used to scan `cat-harness/scripts/` only, because that is where
 * it lives. Every script the instance-boundary work moved UP into
 * the content core then left the measurement and was counted nowhere:
 * 68 → 67 → 65 enumerating scripts, each drop reading as an improvement. And
 * the headline family read **0 of 0** while the one script with its shape,
 * `check-artifact-index.ts`, sat in the layer it did not scan — the `dh4f`
 * failure through a different door: the scan worked, its SUBJECT narrowed.
 *
 * Decided: ONE census over every declared layer's `scripts/`, rather than a
 * census per layer. The question is about the repository's scanners, and a
 * per-instance census would need every layer to remember to run one — the
 * same "counted nowhere" gap, one step later.
 *
 * And the denominator cannot shrink silently: every declared layer is
 * listed in the `scope` family as `scanned` (with its count) or
 * `no-scripts-dir` — which is neither a finding nor a pass, only a statement
 * that there was nothing there to census. A script moving between layers
 * now changes WHICH row it is counted under, never whether it is counted.
 */
export interface InstanceScope {
  /** The layer's declared `name`, or its directory name if it declares none. */
  instance: string;
  /** Its `scripts/` directory, repository-relative. */
  path: string;
  state: "scanned" | "no-scripts-dir";
  /** Enumerating scripts found there; 0 when not scanned. */
  enumerating: number;
}

/** Census every declared layer under `repo`, and say which were scanned. */
export function censusRepository(repo: string): { rows: ScanRow[]; scope: InstanceScope[] } {
  const rows: ScanRow[] = [];
  const scope: InstanceScope[] = [];
  const seen = new Set<string>();
  for (const root of layerRootsIn(repo).sort()) {
    const dir = join(root, "scripts");
    if (seen.has(dir)) continue;
    seen.add(dir);
    let name = basename(root);
    try {
      name = readDeclaration(root)?.name ?? name;
    } catch {
      // An unreadable declaration still has a directory to census; its name
      // is the one thing this row can do without.
    }
    const path = relative(repo, dir).split(/[\\/]/).join("/");
    if (!existsSync(dir)) {
      scope.push({ instance: name, path, state: "no-scripts-dir", enumerating: 0 });
      continue;
    }
    const found = census(dir, repo);
    rows.push(...found);
    scope.push({ instance: name, path, state: "scanned", enumerating: found.length });
  }
  return { rows, scope };
}

export function build(rows: readonly ScanRow[], scope: readonly InstanceScope[] = []): QaResult {
  const scanned = scope.filter((s) => s.state === "scanned");
  const where = `across ${scanned.length} instance(s)' scripts/ (${scanned.map((s) => s.instance).join(", ")})`;
  const exposed = rows.filter((r) => r.seededAtRoot && !r.gitAware);
  const seeded = rows.filter((r) => r.seededAtRoot);
  return buildQaResult({
    script: relative(REPO, join(TOOLS_ROOT, "scripts", "root-scan-census.ts")),
    scriptAbsPath: join(TOOLS_ROOT, "scripts", "root-scan-census.ts"),
    subject: { kind: "root-scan-census", id: "scripts" },
    families: {
      "seeded-at-root-not-git-aware": {
        summary:
          `The shape that actually costs something: a scan whose start argument IS a root ` +
          `constant, that does not ask git. ${exposed.length} of ${seeded.length} such scans, ` +
          `${rows.length} enumerating scripts in all, ${where}. Reported and NEVER failed — the owner's ` +
          `ruling of 2026-09-27, over the objection that a check which cannot fail is the ` +
          `1xhc pattern; what CAN fail here is a NEW one against a baseline (bean \`0dav\`).`,
        entries: exposed.map((r) => ({ file: r.file })),
      },
      "enumerating-scripts": {
        summary:
          `Every script that binds a root constant and enumerates the filesystem, with whether ` +
          `its scan is SEEDED at that root and whether it asks git. A FLOOR, not a count: both ` +
          `filters are syntactic, so a scanner spelled differently is missed — which is not ` +
          `hypothetical, since \`xd1g\`'s own list of eleven was one short (\`kg-audit\`, found by ` +
          `a sibling session). The two filters disagree by design: ${seeded.length} seeded at a ` +
          `root against ${rows.length} enumerating at all, and that GAP is the finding — it is ` +
          `why a syntactic check cannot answer this question and the guard lives in ` +
          `\`scripts/tests/git-corpus-conversions.test.ts\` instead.`,
        entries: rows.map((r) => ({ file: r.file, seededAtRoot: r.seededAtRoot, gitAware: r.gitAware })),
      },
      scope: {
        summary:
          `Which instances this census covered — the denominator, so a drop in enumerating ` +
          `scripts can be told from a drop in scope (bean \`tqv4\`). Every declared instance is ` +
          `a row: \`scanned\` with its count, or \`no-scripts-dir\`, which is neither a finding nor ` +
          `a pass. ${scanned.length} of ${scope.length} declared instance(s) have a scripts/ directory.`,
        entries: scope.map((s) => ({ instance: s.instance, path: s.path, state: s.state, enumerating: s.enumerating })),
      },
    },
  });
}

const GATE = "root-scan-census";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  if (check) {
    const usage = judgeUsage(GATE, argv, ["--against"]);
    if (usage !== undefined) process.exit(usage);
  }
  const { against, exit: badRef } = againstOrUsage(GATE, argv);
  if (badRef !== undefined) process.exit(badRef);
  const { rows, scope } = censusRepository(REPO);

  // A sweep prints its own denominator. A census over zero scripts passes
  // every assertion below and has measured nothing — `could not determine` is
  // never rendered as clean.
  if (rows.length === 0) {
    console.error("No enumerating script was found at all. That is not a clean run — nothing was censused.");
    process.exit(2);
  }

  const gitAware = rows.filter((r) => r.gitAware).length;
  const seeded = rows.filter((r) => r.seededAtRoot);
  const exposed = seeded.filter((r) => !r.gitAware);
  console.log(
    `root-scan census — ${rows.length} enumerating script(s), ${gitAware} ask git.\n` +
      `  scope: ${scope.map((s) => (s.state === "scanned" ? `${s.instance} ${s.enumerating}` : `${s.instance} (no scripts/)`)).join(", ")}\n` +
      `  seeded AT a root constant: ${seeded.length}; of those, not git-aware: ${exposed.length}`,
  );
  for (const r of exposed) console.log(`    · ${r.file}`);
  console.log(
    "  Both filters are syntactic, so this is a FLOOR. The loose one over-counts\n" +
      "  (a walk over one declared directory is fine) and the tight one under-counts\n" +
      "  (a recursion helper or a root passed as a parameter defeats it). The gap\n" +
      "  between them is the finding, not either number.",
  );

  const result = build(rows, scope);
  if (!check) {
    const out = writeQaResult(INSTANCE_ROOT, GATE, result);
    console.log(`\n· ${relative(REPO, out)} — written.`);
    process.exit(0);
  }
  // COMPUTE AND JUDGE, write nothing (bean `0dav`). The findings above stay
  // advisory (the owner's ruling of 2026-09-27); what fails is the one thing
  // that always did — the exposed set moving without anybody looking — now
  // measured as NEW entries against a baseline rather than as a stale file.
  console.log("");
  process.exit(
    judgeQaResult({
      gate: `${GATE}:check`,
      fresh: result,
      failOnNew: ["seeded-at-root-not-git-aware"],
      baseline: { root: INSTANCE_ROOT, stem: GATE, writer: GATE, against },
    }).exit,
  );
}
