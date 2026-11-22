/**
 * Does a recorded test run test the skill it names, as that skill specifies?
 *
 * A test run points at the skill it tests (`TestRun.skill`); the skill points
 * at its contracts (`input:`/`output:` in its front matter). Following the
 * two pointers gives the question this module answers for every recorded
 * case: does what went in fit the skill's input contract, and does what came
 * out fit its output contract?
 *
 * Three answers, kept apart, so "could not check" is never folded into
 * "passed":
 *
 * - `unresolved` — the run does not parse, or names no skill that exists;
 * - `nonconforming` — a case violates the contract;
 * - `unchecked` — the skill declares no contract, the contract is external
 *   (not fetched here), or the run records no cases.
 *
 * The contract is read as JSON Schema by Zod's own `fromJSONSchema`: the JSON
 * files are the contract, and no second schema is authored beside them.
 *
 * @module scripts/test-run-conformance
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fromJSONSchema, type ZodType } from "zod";
import { TestRunSchema } from "../schemas/sdlc/test-run.js";
import { contractFile, skillContracts } from "./skill-contracts.js";
import { overlayDirs, overlayPath } from "./lib/layer-output.ts";

export interface RunFinding {
  where: string;
  detail: string;
}

export interface TestRunConformance {
  unresolved: RunFinding[];
  nonconforming: RunFinding[];
  unchecked: RunFinding[];
  /** Runs whose every case was checked against both contracts. */
  checked: number;
  /** Every `*.test-run.json` found. */
  runs: number;
  /**
   * Whether the runs were determined. Absent is NOT "no runs": since 5hox the
   * directory is derived and may simply not have been computed or fetched, so
   * a caller must report `unknown`, never `n/a` (audit C5, bean `2gst`).
   *
   * An existing but EMPTY directory is not enough either: another writer
   * (kg-audit's own sidecars) creates it as a side effect, which made the
   * check pass or fail by run order (cat-harness-tools#759). So it is looked
   * at when it holds a run, when the store has the tree, or when the caller
   * says the directory is `determined` (qa:refresh is computing it, or it is
   * committed rather than branch-stored) — owner's choice A, 2026-10-30.
   */
  looked: boolean;
}

/**
 * The `*.test-run.json` files directly under `dir`, named by their path in
 * `dir` wherever the bytes are: the union of the layer output root and `dir`
 * itself (bean `cat-tools-sm8r`, item 4). Read each through `overlayPath`.
 * The names stay logical, since they are what a finding's `where` records.
 */
export function testRunFiles(dir: string): string[] {
  const names = new Set<string>();
  for (const d of overlayDirs(dir)) for (const f of readdirSync(d)) if (f.endsWith(".test-run.json")) names.add(f);
  return [...names].sort().map((f) => join(dir, f));
}

/** At most this many violations are listed per run; the count is always given. */
const SHOWN = 3;

export interface TestRunStoreFallback {
  looked: boolean;
  files: { where: string; text: string }[];
}

export function checkTestRuns(
  root: string,
  resultsDir: string,
  knownSkills: Set<string>,
  storeFallback?: () => TestRunStoreFallback,
  opts: { determined?: boolean } = {},
): TestRunConformance {
  const local = testRunFiles(resultsDir);
  const looked = local.length > 0 || (opts.determined === true && overlayDirs(resultsDir).length > 0);
  const out: TestRunConformance = { unresolved: [], nonconforming: [], unchecked: [], checked: 0, runs: 0, looked };
  let entries: { where: string; text: string }[] = [];
  if (out.looked) {
    entries = local.map((file) => ({ where: relative(root, file), text: readFileSync(overlayPath(file), "utf-8") }));
  } else if (storeFallback) {
    const fb = storeFallback();
    if (fb.looked) {
      out.looked = true;
      entries = fb.files;
    }
  }
  if (!out.looked) return out;
  const contracts = skillContracts(root);
  const schemaCache = new Map<string, ZodType | Error>();
  // Against the layer HOLDING the skill: its local contract path is
  // relative to that root, not to the one this check was asked of.
  const load = (base: string, ref: string): ZodType | Error | undefined => {
    const f = contractFile(base, ref);
    if (f === undefined) return undefined;
    if (!schemaCache.has(f)) {
      try {
        schemaCache.set(f, fromJSONSchema(JSON.parse(readFileSync(f, "utf-8"))));
      } catch (e) {
        schemaCache.set(f, e instanceof Error ? e : new Error(String(e)));
      }
    }
    return schemaCache.get(f);
  };

  for (const { where, text } of entries) {
    out.runs++;
    const parsed = TestRunSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      out.unresolved.push({ where, detail: `does not parse as a test run: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` });
      continue;
    }
    const run = parsed.data;
    if (!knownSkills.has(run.skill)) {
      out.unresolved.push({ where, detail: `names skill "${run.skill}", which does not exist.` });
      continue;
    }
    const c = contracts.get(run.skill);
    if (c?.input === undefined || c.output === undefined) {
      out.unchecked.push({ where, detail: `skill "${run.skill}" declares no ${c?.input === undefined ? "input" : "output"} contract, so its cases cannot be checked.` });
      continue;
    }
    if (run.cases === undefined || run.cases.length === 0) {
      out.unchecked.push({ where, detail: "records no cases — only aggregates, which no contract can check." });
      continue;
    }
    const input = load(c.instanceRoot, c.input);
    const output = load(c.instanceRoot, c.output);
    if (input === undefined || output === undefined) {
      out.unchecked.push({ where, detail: `skill "${run.skill}" has an external contract, which this offline check does not fetch.` });
      continue;
    }
    if (input instanceof Error || output instanceof Error) {
      const e = input instanceof Error ? input : (output as Error);
      out.unresolved.push({ where, detail: `the contract of "${run.skill}" cannot be read as JSON Schema: ${e.message}` });
      continue;
    }
    const bad: string[] = [];
    run.cases.forEach((k, i) => {
      if (!input.safeParse(k.input).success) bad.push(`case ${i}: input`);
      if (!output.safeParse(k.output).success) bad.push(`case ${i}: output`);
    });
    if (bad.length > 0) {
      out.nonconforming.push({
        where,
        detail:
          `${bad.length} of ${run.cases.length * 2} case halves violate the contract of "${run.skill}": ` +
          `${bad.slice(0, SHOWN).join(", ")}${bad.length > SHOWN ? ", …" : ""}.`,
      });
    } else {
      out.checked++;
    }
  }
  return out;
}
