#!/usr/bin/env bun
/**
 * Measure the `crdm-detect` phrase signals against real issues.
 *
 * ## What this measures, and what it does not
 *
 * `skills/process/crdm/crdm-detect.md` is prose for a model to read. It lists
 * five categories of phrasing plus an explicit "what is NOT a feature request"
 * list. This script implements the PHRASE SIGNALS mechanically, so it is a
 * LOWER BOUND on an agent that also applies judgement: low recall here means
 * the phrase list is thin; low precision is more damning, since a phrase that
 * fires on a bug report pushes a model the wrong way too.
 *
 * ## The ground truth
 *
 * `scripts/eval/crdm-detect-corpus.json` carries all 27 issues in this
 * repository — the whole population, not a sample — each labelled with a
 * one-line reason, owner-adjudicated where two annotators differed (the
 * second, blinded, via `eval-crdm-detect-blind.ts`; its labels are in
 * `crdm-detect-second-annotator.json`).
 *
 * The signals are in `src/crdm/detect-signals.ts`, with the check that they
 * still say what the skill says.
 *
 * Usage: bun run cat eval:crdm-detect [--verbose]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { detect, parseSkillExclusions } from "../src/crdm/detect-signals.ts";
import { buildTestRun, hashesReproduce, TestRunSchema } from "../schemas/sdlc/test-run.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { TEST_RUN_OUT_ENV } from "./test-run-compute.ts";
import { writePathOf } from "./lib/layer-output.ts";
import { harnessPath, harnessRel } from "./lib/harness-layout.ts";

const root = resolve(HARNESS_ROOT);
const verbose = process.argv.includes("--verbose");

interface Item { number: number; title: string; isFeature: boolean; why: string; text: string }

// declared-path-literal: written in the new layout and answered in whichever the harness has — transitional, cat-harness#991 step 23 (scripts/lib/harness-layout.ts); remove after cat-harness#1014 merges.
const SKILL = harnessPath("skills/process/crdm/crdm-detect.md", root);
const skillExclusions = parseSkillExclusions(readFileSync(SKILL, "utf-8"));

const corpus: Item[] = JSON.parse(
  readFileSync(join(TOOLS_ROOT, "scripts", "eval", "crdm-detect-corpus.json"), "utf-8"),
);

let tp = 0, fp = 0, tn = 0, fn = 0;
// Every case, as the skill's contract names its input and output, so the run
// can be checked against that contract (#1168, B4) rather than only counted.
const cases: Array<{ input: { text: string }; output: ReturnType<typeof detect> }> = [];
const misses: Item[] = [];
const falseAlarms: Item[] = [];

for (const item of corpus) {
  const v = detect(item.text);
  cases.push({ input: { text: item.text }, output: v });
  if (item.isFeature && v.fires) tp++;
  else if (item.isFeature && !v.fires) { fn++; misses.push(item); }
  else if (!item.isFeature && v.fires) { fp++; falseAlarms.push(item); }
  else tn++;

  if (verbose) {
    const mark = item.isFeature === v.fires ? "✓" : "✗";
    console.log(
      `  ${mark} #${String(item.number).padEnd(4)} truth=${item.isFeature ? "feature " : "not     "}` +
        `fired=${v.fires ? "yes" : "no "}  ${v.categories.join("+") || "(none)"}`,
    );
  }
}

const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

console.log(`\ncrdm-detect phrase signals · ${corpus.length} issues (whole population)\n`);
console.log(`                 fired    did not`);
console.log(`  is feature      ${String(tp).padStart(3)}       ${String(fn).padStart(3)}`);
console.log(`  is not          ${String(fp).padStart(3)}       ${String(tn).padStart(3)}`);
console.log(`\n  precision ${pct(precision)}   recall ${pct(recall)}   F1 ${pct(f1)}`);

if (misses.length) {
  console.log(`\nMISSED — a feature request no phrase caught (${misses.length}):`);
  for (const m of misses) console.log(`  · #${m.number} ${m.title.slice(0, 68)}\n      ${m.why}`);
}
if (falseAlarms.length) {
  console.log(`\nFALSE ALARM — fired on something that is not a feature request (${falseAlarms.length}):`);
  for (const f of falseAlarms) console.log(`  · #${f.number} ${f.title.slice(0, 68)}\n      ${f.why}`);
}

// The third state. A phrase matcher structurally cannot decide "bug reports
// about existing features"; printing the count is the difference between a
// declared limit and an unexplained false alarm. `dh4f` in miniature — the
// silent version of this reported a clean implementation of a list it had only
// partly implemented.
if (skillExclusions.judgementOnly.length) {
  console.log(
    `\nNOT IMPLEMENTABLE BY PHRASE — exclusions the skill states as a judgement` +
      ` (${skillExclusions.judgementOnly.length} of ` +
      `${skillExclusions.quoted.length + skillExclusions.judgementOnly.length}):`,
  );
  for (const j of skillExclusions.judgementOnly) console.log(`  · ${j}`);
  console.log(`  A false alarm matching one of these is a limit of the LOWER BOUND, not a defect in it.`);
}

console.log(
  `\nLOWER BOUND. This runs the phrase list only; the skill also asks for\n` +
    `judgement, which catches wording the list never anticipated. Ground truth\n` +
    `is two annotators (kappa 0.62), with the owner adjudicating their\n` +
    `disagreements (bean vjbl). It is still 27 issues, one repository.`,
);

// ─── The run is RECORDED, not only printed ──────────────────────────────────
//
// Bean `folio-assistant-zz0a`. Everything above this line went to stdout and
// nowhere else, so nobody could tell "recall was always 65%" from "this commit
// dropped it" — the same argument that put QA verdicts in committed sidecars
// rather than a console report.
//
// Two hashes, because "what was tested" and "what tested it" are different
// questions. `buildTestRun` refuses if the two bases overlap, so the
// independence is a property of this call rather than a claim in a comment:
// the corpus is the DATA, the runner and the skill it implements are the
// PROCESS. The skill is in the process basis deliberately — it is what the
// phrase list is derived FROM, so editing it can change the result without
// touching a line of this script, which is exactly the `cv10` failure.
// declared-path-literal: the harness's own QA results, joined under HARNESS_ROOT; it names no other layer's test/results/, though any layer declaring that path spells it the same.
// A gate computing this run without writing the tree points it at a
// temporary directory (test-run-compute.ts, #1191).
const OUT_DIR = process.env[TEST_RUN_OUT_ENV];
// A mounted harness's run goes to its layer output root, never into the mount (bean `cat-tools-sm8r`, item 4).
const OUT = OUT_DIR ? join(OUT_DIR, "crdm-detect-eval.test-run.json") : writePathOf(join(root, "test/results/crdm-detect-eval.test-run.json"));
const run = buildTestRun({
  // bean 70lx: the corpus and the code are this layer's, the skill is the harness's
  root: dirname(root),
  // The run names the skill it tests; the skill names no test (#1168, B4).
  skill: "crdm-detect",
  subject: "crdm-detect phrase signals against the issue corpus",
  dataInputs: ["cat-harness-tools/scripts/eval/crdm-detect-corpus.json"],
  processInputs: [
    "cat-harness-tools/scripts/eval-crdm-detect.ts",
    "cat-harness-tools/src/crdm/detect-signals.ts",
    // declared-path-literal: a provenance record (`processInputs`), written into the evaluation report as repo-relative names; it is not read from disk here.
    `cat-harness/${harnessRel("skills/process/crdm/crdm-detect.md", root)}`,
  ],
  outcome: {
    population: corpus.length,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
  },
  cases,
});

// Same churn guard as `writeQaResult`: an unchanged run keeps its file and its
// timestamp, so `updated_at` says when these numbers were ESTABLISHED rather
// than when somebody last ran the script.
let priorSaysSame = false;
try {
  const prior = TestRunSchema.parse(JSON.parse(readFileSync(OUT, "utf-8")));
  const { updated_at: _a, ...restPrior } = prior;
  const { updated_at: _b, ...restNow } = run;
  priorSaysSame = JSON.stringify(restPrior) === JSON.stringify(restNow);
  const repro = hashesReproduce(prior, run);
  if (!repro.both) {
    console.log(
      `\nCHANGED since the recorded run:` +
        `${repro.data ? "" : "\n  · the DATA — the corpus is not the one that produced it"}` +
        `${repro.process ? "" : "\n  · the PROCESS — the runner or the skill it implements"}`,
    );
  }
} catch {
  // No prior run, or an unreadable one. Either way: write.
}
if (!priorSaysSame) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(run, null, 2) + "\n");
}
console.log(`\nTest run → ${OUT_DIR ? OUT : "test/results/crdm-detect-eval.test-run.json"}`);
console.log(`  data    ${run.data.hash}  over ${run.data.inputs.length} input(s)`);
console.log(`  process ${run.process.hash}  over ${run.process.inputs.length} input(s)`);
