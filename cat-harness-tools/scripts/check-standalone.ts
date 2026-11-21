#!/usr/bin/env bun
/**
 * A layer's tests run standing alone, judged against a committed baseline.
 *
 * @module cat-harness-tools/scripts/check-standalone
 * @covers code — the layer's own tests, run where only its declared closure sits beside it
 *
 * `probeStandalone` (seed-ready.ts) does the work: the tracked files of the
 * layer and everything it `needs`, laid out as sibling git repositories with
 * no aggregate at the root, and `bun test` run in the layer. This file only
 * JUDGES what it measured.
 *
 * The gate demands that standalone failures never GROW: a failure not in the
 * baseline is red. A baseline entry that now passes is REPORTED, not red
 * (some tests are flaky between local and CI runs). `bun run cat
 * standalone:baseline` writes `standalone-baseline.json`; a PR that fixes a
 * test commits the shorter list, and the report names the command whenever
 * one could be shorter.
 *
 * - **held** (0): nothing fails that the baseline does not list. Listed tests
 *   that now pass are printed, with the command that lowers the list.
 * - **grew** (1): a new failure, or more unnamed failures.
 * - **could not determine** (2): the probe could not produce a summary, or no
 *   baseline is committed. Never rendered as held.
 *
 * ## In parts (`--part i/n`)
 *
 * `--part i/n` runs slice i of n of the layer's test files
 * (`bun test --shard=i/n`), so CI runs the n parts as n gates on n machines
 * (`run-gates.py` `SPLIT_GATES`). Together the parts run every test file
 * once, and each part is judged on what it ran:
 *
 * - a named failure the baseline does not list is red, exactly as in a whole
 *   run (a test runs in exactly one part, so no new failure is missed);
 * - a listed test reported as now passing is one whose file ran in this part,
 *   so the other parts' tests are not reported as fixed;
 * - errors that carry no test name cannot be split by file, so a part is red
 *   when it has any more of them than the whole baseline allows, never fewer
 *   (`max(0, baseline unnamed)`).
 *
 * `--update` and `--measured-out` measure the whole layer; they refuse `--part`.
 *
 * Usage: bun run cat-harness-tools/scripts/check-standalone.ts --layer <instance> [--part <i/n>] [--update | --measured-out <file>]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { probeStandalone, readLayers, type Probe } from "./seed-ready.js";

export const STANDALONE_EXIT = { held: 0, grew: 1, undetermined: 2 } as const;

/**
 * The committed baseline, one entry per layer. Beside `declared-path-baseline.json`
 * and for the same reason: it is an ACCEPTED judgement a reviewer reads in a
 * diff, not a QA working copy — `test/results/` is ignored once results live
 * on `qa-reports` (bean `5hox`), and a baseline that is not committed is no
 * ratchet at all.
 */
export const BASELINE_PATH = resolve(import.meta.dir, "standalone-baseline.json");

export interface Baseline {
  /** `<test file> > <test>`, as `parseBunTest` keys them. */
  failing: string[];
  /** `bun test`'s own fail count, which also counts errors no name carries. */
  failed: number;
}

export interface Judgement {
  exit: number;
  lines: string[];
  /** What was measured, when anything was; what `--update` writes. */
  measured?: Baseline;
}

/**
 * A failure's key with its test file relative to the layer. Bun names a file
 * by its absolute path when it sits outside the run's working directory, so the
 * same test keyed `/home/runner/…/<layer>/pipeline/x.test.ts` on CI and
 * `/home/user/…/<layer>/pipeline/x.test.ts` locally read as two tests: a new
 * failure on CI for a test the baseline lists. Cut at the layer's directory.
 */
export function layerRelativeKey(key: string, layer: string): string {
  if (!key.startsWith("/")) return key;
  const at = key.split(" > ")[0]!.lastIndexOf(`/${layer}/`);
  return at < 0 ? key : key.slice(at + layer.length + 2);
}

/** The command that rewrites one layer's entry, named so it can be pasted as printed. */
export const refreshCommand = (layer: string): string =>
  `bun run cat-harness-tools/scripts/check-standalone.ts --layer ${layer} --update`;

/** `i/n` with 1 <= i <= n, or undefined for anything else. */
export function parsePart(value: string | undefined): { i: number; n: number } | undefined {
  const m = /^(\d+)\/(\d+)$/.exec((value ?? "").trim());
  if (!m) return undefined;
  const i = Number(m[1]);
  const n = Number(m[2]);
  return i >= 1 && n >= 1 && i <= n ? { i, n } : undefined;
}

/**
 * Pure: the probe's result against the committed baseline. With `part` set,
 * the probe ran one slice of the test files and `probe.files` names them: see
 * "In parts" in the module header for what changes.
 */
export function judge(probe: Probe, baseline: Baseline | undefined, layer?: string, part?: string): Judgement {
  if (probe.state !== "measured") {
    return { exit: STANDALONE_EXIT.undetermined, lines: [`could not determine: ${probe.note}`] };
  }
  if (part && !probe.files) {
    return { exit: STANDALONE_EXIT.undetermined, lines: [`could not determine: part ${part} ran, but which test files it ran is unknown`] };
  }
  const key = (k: string): string => (layer ? layerRelativeKey(k, layer) : k);
  const ranHere = part ? new Set(probe.files!.map(key)) : undefined;
  const inPart = (k: string): boolean => !ranHere || ranHere.has(k.split(" > ")[0]!);
  if (baseline) baseline = { ...baseline, failing: baseline.failing.map(key) };
  const measured: Baseline = { failing: [...new Set(probe.findings.map(key))].sort(), failed: probe.count };
  if (!baseline) {
    return {
      exit: STANDALONE_EXIT.undetermined,
      lines: [`could not determine: no baseline is committed (${measured.failed} failing). Run with --update to write one.`],
      measured,
    };
  }
  const before = new Set(baseline.failing);
  const now = new Set(measured.failing);
  const grew = measured.failing.filter((n) => !before.has(n));
  const fixed = baseline.failing.filter((n) => !now.has(n) && inPart(n));
  const unnamedNow = measured.failed - measured.failing.length;
  const unnamedWhole = baseline.failed - baseline.failing.length;
  const unnamedBefore = part ? Math.max(0, unnamedWhole) : unnamedWhole;

  const lines: string[] = [];
  const shorter: string[] = [];
  if (fixed.length > 0) {
    shorter.push(`${fixed.length} listed test(s) now pass standalone — not a failure; \`${layer ? refreshCommand(layer) : "bun run cat standalone:baseline"}\` lowers the list:`);
    for (const n of fixed) shorter.push(`  - ${n}`);
  }
  if (grew.length > 0) {
    lines.push(`${grew.length} test(s) fail standalone that the baseline does not list — each reads something only the monorepo has:`);
    for (const n of grew) lines.push(`  + ${n}`);
  }
  if (unnamedNow > unnamedBefore) {
    lines.push(`${unnamedNow - unnamedBefore} more failure(s) that carry no test name (errors between tests): ${unnamedBefore} → ${unnamedNow}.`);
  }
  if (lines.length === 0) {
    const where = part ? ` in part ${part} (${ranHere!.size} test file(s))` : "";
    const head =
      fixed.length === 0 && !part
        ? `held: ${measured.failed} failing standalone, exactly the baseline.`
        : `held: ${measured.failed} failing standalone${where}, none outside the baseline.`;
    return { exit: STANDALONE_EXIT.held, lines: [head, ...shorter], measured };
  }
  return { exit: STANDALONE_EXIT.grew, lines: [...lines, ...shorter], measured };
}

const BASELINE_COMMENT =
  "Tests that fail when a layer runs alone beside its declared closure (bean `ho66`), keyed `<test file> > <test>`, with `bun test`'s own fail count, which also counts errors between tests. MEASURED LAYOUT (bean `w1gy`, F19): `probeStandalone` (scripts/seed-ready.ts) run from a COMPOSED INDEX checkout -- the git-tracked files of the layer and of its declared closure copied out as sibling git repositories, with the index's root `package.json`, `tsconfig.json` and `bunfig.toml` copied beside them and its `node_modules` symlinked in; in CI that is pr-tests.yml `standalone-run` (the index at its pin, its mounts, cat-harness main, bun 1.4.4). It is NOT a bare sibling layout of fresh clones with no aggregate root files, so a failure count from that layout is not comparable with this list. A RATCHET: a failure not listed here is red; a listed one that now passes is reported, with this command, so the list only goes down. WRITTEN by `bun run cat standalone:baseline`; a longer list is a diff somebody reviews. See the module header of cat-harness-tools/scripts/check-standalone.ts.";

/**
 * The file's own declaration that a tool wrote it — the top-level `_generated`
 * key `check-reference-direction.ts` reads (`declaresGenerated`). Its keys
 * name test files of every layer measured, higher ones included, which an
 * authored file in this layer may not do.
 */
const BASELINE_GENERATED = "scripts/check-standalone.ts (`bun run cat standalone:baseline`) — do not hand-edit";

interface BaselineFile {
  _generated?: string;
  _comment: string;
  layers: Record<string, Baseline>;
}

function readBaselineFile(path: string): BaselineFile | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BaselineFile;
  } catch {
    return undefined;
  }
}

/** A layer's committed baseline; `undefined` when absent or unreadable. */
export function readBaseline(layer: string, path: string = BASELINE_PATH): Baseline | undefined {
  const b = readBaselineFile(path)?.layers?.[layer];
  if (!b || !Array.isArray(b.failing) || typeof b.failed !== "number") return undefined;
  return { failing: b.failing.filter((x): x is string => typeof x === "string"), failed: b.failed };
}

/** Write one layer's entry, keeping every other layer's, sorted so a rerun is byte-stable. */
export function writeBaseline(layer: string, measured: Baseline, path: string = BASELINE_PATH): void {
  const layers = { ...(readBaselineFile(path)?.layers ?? {}), [layer]: { failed: measured.failed, failing: [...measured.failing].sort() } };
  const sorted = Object.fromEntries(Object.keys(layers).sort().map((k) => [k, layers[k]!]));
  writeFileSync(path, JSON.stringify({ _generated: BASELINE_GENERATED, _comment: BASELINE_COMMENT, layers: sorted }, null, 2) + "\n");
}

const arg = (name: string, argv: string[]): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function main(argv: string[]): number {
  const name = arg("--layer", argv);
  if (!name) {
    console.error("usage: check-standalone --layer <instance> [--update]");
    return STANDALONE_EXIT.undetermined;
  }
  const repoRoot = repoRootFor(resolve(import.meta.dir, ".."));
  const decls = readLayers(repoRoot);
  if (!decls.some((d) => d.name === name)) {
    console.error(`no instance declaration names \`${name}\``);
    return STANDALONE_EXIT.undetermined;
  }

  const partArg = arg("--part", argv);
  const part = partArg === undefined ? undefined : parsePart(partArg);
  if (partArg !== undefined && !part) {
    console.error(`--part takes i/n with 1 <= i <= n (got ${JSON.stringify(partArg)})`);
    return STANDALONE_EXIT.undetermined;
  }
  const out = arg("--measured-out", argv);
  if (part && (out || argv.includes("--update"))) {
    console.error("--update and --measured-out measure the whole layer; they do not take --part");
    return STANDALONE_EXIT.undetermined;
  }
  const slice = part ? `${part.i}/${part.n}` : undefined;
  const probe = probeStandalone(repoRoot, name, decls, slice ? { shard: slice } : {});
  if (out) {
    // CI measures base and head with this, and judges the pair against the
    // baseline in .github/scripts/compare-standalone.py: cat-harness main moves
    // under both, so only what head newly breaks is the PR's.
    const keyed = probe.state === "measured" ? { ...probe, findings: [...new Set(probe.findings.map((k) => layerRelativeKey(k, name)))].sort() } : probe;
    writeFileSync(out, JSON.stringify(keyed, null, 2) + "\n");
    console.log(`wrote ${out}: ${probe.state}${probe.state === "measured" ? `, ${probe.count} failing` : ` (${probe.note})`}`);
    return probe.state === "measured" ? STANDALONE_EXIT.held : STANDALONE_EXIT.undetermined;
  }
  const verdict = judge(probe, readBaseline(name), name, slice);
  if (argv.includes("--update") && verdict.measured) {
    writeBaseline(name, verdict.measured);
    console.log(`wrote ${relative(repoRoot, BASELINE_PATH)} for ${name}: ${verdict.measured.failed} failing standalone.`);
    return STANDALONE_EXIT.held;
  }
  for (const l of verdict.lines) console.log(l);
  return verdict.exit;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
