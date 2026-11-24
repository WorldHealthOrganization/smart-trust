#!/usr/bin/env bun
/**
 * Every `<bootstrap.processes:skill ref="…"/>` in a BPMN names a skill that exists, and
 * every activity says which skill implements it.
 *
 * Two tiers:
 *   - A DANGLING REF IS AN ERROR: it breaks a consumer (`workflow_next` would
 *     hand an agent a skill it cannot open).
 *   - MISSING COVERAGE IS A REPORT: some activities (e.g. a human sign-off)
 *     genuinely have no skill. `--strict` makes it an error.
 *
 * Usage:  bun run cat check:workflow-refs  [--strict]
 * Exit:   0 clean · 1 dangling ref (or, with --strict, any uncovered activity)
 *
 * @covers processes, skills
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync } from "node:fs";
import { workflowFiles, corpusScopeFor } from "./known-skills.js";
import { join, relative, resolve, sep } from "node:path";
import { loadProcessModel, isActivity, processDiagrams } from "../src/workflow/process-model.js";
import { knownSkills } from "./known-skills.js";
import { layerRootsIn, repoRootFor, siblingScopeFor } from "../schemas/kg/cat-harness.js";
import { judgeSkillRef, switchedOffSkillHomes } from "./lib/switched-off-skills.ts";
import { beanCallFindings, noteTakers, type DiagramFacts } from "./check-bean-lifecycle-calls.ts";

interface Dangling { file: string; node: string; ref: string }
interface Coverage { file: string; covered: number; total: number; uncovered: string[] }

const INSTANCE_ROOT = HARNESS_ROOT;
const strict = process.argv.includes("--strict");

/**
 * Every layer whose diagrams this repository is responsible for.
 *
 * Root-only until 2026-09-19, and the comment below is the argument for the
 * change: *"a dangling `<bootstrap.processes:skill ref>` in a diagram this checker never
 * opens is a broken reference reported as clean."* `bootstrap/` is a separate
 * layer with its own declaration and its own two skills, so
 * `bootstrap/processes/bootstrap.bpmn` was in exactly that state from the day
 * it was written — unchecked, and reported clean by a checker scoped to
 * somebody else's graph.
 *
 * Each layer's refs resolve against ITS OWN skills, never the union: a
 * bootstrap diagram naming a harness skill is a real dangling ref, because
 * bootstrap runs before the harness exists.
 */
const INSTANCES = [INSTANCE_ROOT, join(repoRootFor(INSTANCE_ROOT), "bootstrap")];

/**
 * A layer in {@link INSTANCES} that contributed no diagrams.
 *
 * **This is the guard that would have caught the defect above on the day it was
 * introduced.** `bootstrap` was added to `INSTANCES` on 2026-09-19 as
 * `join(INSTANCE_ROOT, "bootstrap")` — and `INSTANCE_ROOT` is `cat-harness/`
 * while `bootstrap/` sits at the REPOSITORY root, so the path resolved to a
 * directory that has never existed. `workflowFiles` returned `[]`, the loop ran
 * over nothing, and the summary line said *"2 instances"* while reporting the
 * root's diagram count verbatim.
 *
 * So for a year of commits this checker believed it was auditing the FIRST
 * process a new instance runs, and was auditing a typo. The fix for the path is
 * one expression; the fix for not noticing is this function. A sweep that
 * examined nothing has cleared nothing — bean `dh4f`, arriving inside the gate
 * whose own docblock argues that *"a dangling ref in a diagram this checker
 * never opens is a broken reference reported as clean"*.
 *
 * Reported rather than thrown: a layer legitimately holding no diagram is
 * possible, and the reader needs to be able to tell that from a path that does
 * not resolve. So the two are DIFFERENT messages.
 */
function emptyInstances(): string[] {
  return INSTANCES.filter((r) => workflowFiles(r).filter((f) => f.endsWith(".bpmn")).length === 0);
}

const dangling: Dangling[] = [];
/** Refs no visible layer holds, before {@link judgeSkillRef} splits them into dangling and not judged here. */
const unresolved: Array<Dangling & { abs: string }> = [];
/** Refs to a skill in an opt-in sub-graph the mounting root switched off (card Q-SKILL-TOOL-LINK B): judged where it is on. */
const notJudged: Array<Dangling & { groups: string[]; reason: string }> = [];
const coverage: Coverage[] = [];

/**
 * Every exclusive gateway, split by who chooses the branch.
 *
 * **The question this exists to make answerable is bean `q0tc`'s** — how much
 * of a workflow must be deterministic, and which judgement points are safety
 * risks. That cannot be asked of a corpus that cannot enumerate its own
 * judgement points, and until `folio:judgement` landed it could not: a gateway
 * with no decision table was either somebody's call or an unwritten table, and
 * nothing told them apart.
 *
 * Issue #200 §6 classified all ten of this repository's decision points in
 * PROSE, in an issue. This is the same classification where something reads
 * it.
 *
 * REPORTED, not enforced. `undeclared` is a real backlog rather than a defect
 * to fail on: every gateway that predates the marker lands there, and a gate
 * that fails on a corpus nobody has annotated yet is a gate somebody turns
 * off. It is printed so the number is visible and shrinking.
 */
const branches = {
  computed: [] as Array<{ file: string; node: string }>,
  judgement: [] as Array<{ file: string; node: string }>,
  undeclared: [] as Array<{ file: string; node: string }>,
};

/**
 * Every call into a process that JUDGES, and whether the caller says which
 * answers it can act on. Bean `bvuk`.
 *
 * REPORTED, not enforced, and the reason is specific rather than the usual
 * adoption argument. Six diagrams called `Process_Adjudication` when it still
 * held the QA-criterion outcome half; **none of them branched on its outcome**
 * — each call activity has one outgoing flow and the called process had one
 * settled end event — so the mismatch was invisible in the diagram's shape.
 * The split (bean `bvuk`) moved that half into `criterion-adjudication.bpmn`
 * and left `A_Adjudicate` deferring its enum, which fixes the four callers
 * that were running QA branches for a question with no criterion in it. What
 * each of those four SHOULD ask is still an open decision, not a backfill.
 *
 * So an undeclared caller is "could not determine", printed rather than
 * failed. A DECLARED one that disagrees with its adjudicator is refused at
 * load, by `checkAcceptedCodes` in `process-model.ts` — this list is the third
 * state between that refusal and silence.
 */
const adjudicationCalls = {
  declared: [] as Array<{ file: string; node: string; codes: string[] }>,
  undeclared: [] as Array<{ file: string; node: string; called: string }>,
};

let knownCount = 0;
let fileCount = 0;

/**
 * Every loaded diagram, for the bean-lifecycle rule (bean `m8gz`, owner
 * 2026-10-24): claim, resolve and archive live only in Process_BeanOpen and
 * Process_BeanClose, and a process that calls one calls both. Judged here,
 * on the models this loop already loads, because this is the gate CI runs
 * over every diagram; `check:bean-calls` runs the same rule on its own.
 */
const beanFacts: DiagramFacts[] = [];

for (const root of INSTANCES) {
const skills = knownSkills(root, corpusScopeFor(root));
knownCount += skills.size;
// Absolute paths from every declared directory. A dangling `<bootstrap.processes:skill
// ref>` in a diagram this checker never opens is a broken reference reported
// as clean, which is the exact failure this script exists to prevent.
const files = processDiagrams(workflowFiles(root, corpusScopeFor(root)));
fileCount += files.length;


for (const file of files) {
  const model = await loadProcessModel(file);
  beanFacts.push({ file: relative(INSTANCE_ROOT, file), model });
  const activities = [...model.nodes.values()].filter(isActivity);
  const uncovered: string[] = [];

  for (const node of activities) {
    const refs = node.skills ?? [];
    if (refs.length === 0) uncovered.push(node.id);
    for (const ref of refs) {
      if (!skills.has(ref)) unresolved.push({ abs: file, file: relative(INSTANCE_ROOT, file), node: node.id, ref });
    }
  }
  coverage.push({
    file: relative(INSTANCE_ROOT, file),
    covered: activities.length - uncovered.length,
    total: activities.length,
    uncovered,
  });

  // Every exclusive gateway, by WHO decides it. Counted here rather than in a
  // checker of its own because this loop already has the model, and a second
  // loader is a second answer to which diagrams exist.
  for (const node of model.nodes.values()) {
    if (node.kind !== "exclusive") continue;
    const where = { file: relative(INSTANCE_ROOT, file), node: node.id };
    if (node.decisionRef) branches.computed.push(where);
    else if (node.judgementReason) branches.judgement.push(where);
    else branches.undeclared.push(where);
  }

  // Calls into an adjudicating process. `model.children` is what the loader already
  // resolved, so a call OUT of this corpus is absent here rather than counted
  // — a process no file defines is opaque by design and cannot be checked.
  for (const [nodeId, child] of model.children) {
    const fixed = [...child.nodes.values()].some((n) => n.adjudication !== undefined);
    const defers = [...child.nodes.values()].some((n) => n.adjudicationDefers);
    if (!fixed && !defers) continue;
    const node = model.nodes.get(nodeId)!;
    const where = { file: relative(INSTANCE_ROOT, file), node: nodeId };
    // Two ways to be declared, one per kind of callee. A fixed enum is
    // ACCEPTED (the caller has read it); a deferred one is DECLARED (the
    // caller writes it, and its own gateway acts on it).
    const codes = node.adjudicationAccepts ?? (defers ? node.adjudication?.codes : undefined);
    if (codes) adjudicationCalls.declared.push({ ...where, codes });
    else adjudicationCalls.undeclared.push({ ...where, called: child.id });
  }
}
}

// The same split `check:tools` makes for a `satisfies` target, from the same
// resolver, so the two cannot disagree about one skill name.
if (unresolved.length > 0) {
  const layers = [...new Set([resolve(INSTANCE_ROOT), ...layerRootsIn(siblingScopeFor(INSTANCE_ROOT)).map((r) => resolve(r))])];
  const layerOf = (abs: string): string | undefined =>
    layers.filter((l) => abs === l || abs.startsWith(l + sep)).sort((a, b) => b.length - a.length)[0];
  const off = switchedOffSkillHomes(layers);
  for (const { abs, ...d } of unresolved) {
    const why = judgeSkillRef(d.ref, layerOf(resolve(abs)), off);
    if (why === undefined) dangling.push(d);
    else notJudged.push({ ...d, ...why });
  }
}

console.log(`Workflow skill refs  (${knownCount} skills known across ${INSTANCES.length} instances, ${fileCount} diagrams)\n`);

// The vacuity report, ABOVE the findings rather than below them: a layer
// that contributed nothing makes every verdict here narrower than the summary
// line claims, so a reader must meet it before the clean tick.
const empty = emptyInstances();
/** The unambiguous half: a listed layer whose path is not there. */
const absentInstances = empty.filter((r) => !existsSync(r));
for (const r of empty) {
  const where = relative(repoRootFor(INSTANCE_ROOT), r) || ".";
  console.log(
    existsSync(r)
      ? `? ${where} is in the instance list and declares no diagram — nothing here was checked for it`
      : `✗ ${where} is in the instance list and DOES NOT EXIST — its diagrams are unchecked and were reported clean`,
  );
}
if (empty.length > 0) console.log("");

console.log("Coverage — activities naming the skill that implements them");
for (const c of coverage) {
  const pct = c.total === 0 ? 100 : Math.round((c.covered / c.total) * 100);
  const mark = c.covered === c.total ? "✓" : pct === 0 ? "✗" : "·";
  console.log(`  ${mark} ${c.file.padEnd(38)} ${String(c.covered).padStart(2)}/${String(c.total).padEnd(2)}  ${pct}%`);
}

if (notJudged.length) {
  console.log(`\n· ${notJudged.length} ref(s) not judged here — the skill is in an opt-in sub-graph the mounting root switched off (judged where it is switched on):`);
  for (const d of notJudged) console.log(`  · ${d.file} · ${d.node} → "${d.ref}" (${d.groups.join(", ")})`);
}

if (dangling.length) {
  console.log("\nDANGLING — the ref names no skill in this repository:");
  for (const d of dangling) {
    console.log(`  ✗ ${d.file} · ${d.node} → "${d.ref}"`);
  }
  console.log(
    `\n${dangling.length} dangling ref(s). workflow_next would hand an agent a\n` +
      `name it cannot open. Either add the skill or point the ref at a real one.`,
  );
}

const totalUncovered = coverage.reduce((n, c) => n + c.uncovered.length, 0);
if (totalUncovered) {
  console.log(`\n${totalUncovered} activit(ies) name no skill. Not an error by itself — a`);
  console.log("human sign-off step has no skill to name — but each one is a step whose");
  console.log("implementation a reader has to guess:");
  for (const c of coverage) {
    if (c.uncovered.length) console.log(`  · ${c.file}: ${c.uncovered.join(", ")}`);
  }
}

if (!dangling.length && !totalUncovered) console.log("\nAll refs resolve, every activity covered.");

const adjTotal = adjudicationCalls.declared.length + adjudicationCalls.undeclared.length;
if (adjTotal > 0) {
  console.log(
    `\nAdjudication callers — ${adjudicationCalls.declared.length} of ${adjTotal} say ` +
      `which answers they can act on`,
  );
  for (const d of adjudicationCalls.declared) {
    console.log(`  \u2713 ${d.file} \u00b7 ${d.node} accepts (${d.codes.join(", ")})`);
  }
  for (const u of adjudicationCalls.undeclared) {
    console.log(`  ? ${u.file} \u00b7 ${u.node} \u2192 ${u.called}: does not say`);
  }
  if (adjudicationCalls.undeclared.length) {
    console.log(
      `\n${adjudicationCalls.undeclared.length} caller(s) run an adjudication without naming the\n` +
        `answers it may give. Not an error — what each should ask is an open question,\n` +
        `and guessing would make an undecided thing look checked. Declare\n` +
        `<cat-harness.processes:adjudication codes="…"/> here, with this step's gateway coding the same\n` +
        `set, once the answer is decided — or \`accepts\` where the callee fixes its own.`,
    );
  }
}

/*
 * The same failure, one layer over: `schemas/library/translation-tools.ts` lists
 * `bpmnDiagrams` per content type — the diagrams whose labels need
 * re-rendering after translation. One entry named
 * `processes/publication-workflow.bpmn`, which has never existed, so the
 * re-render skipped it silently and a skipped diagram is indistinguishable
 * from a diagram that needed no work.
 */
const { CONTENT_TYPE_TRANSLATIONS, resolveTranslationPath } = await import("../schemas/library/translation-tools.js");
const missingDeclared: string[] = [];
for (const ct of CONTENT_TYPE_TRANSLATIONS) {
  for (const rel of ct.bpmnDiagrams ?? []) {
    // Resolved from the layer that DECLARES the profile, then down its
    // `needs` chain (bean `0r7u`): the profiles left cat-harness for their owners.
    if (resolveTranslationPath(ct, rel) === undefined) missingDeclared.push(`${ct.contentType} → ${rel}`);
  }
}
// Same class again: a format may declare the modules that implement its
// extract and inject. `bpmn` declared NEITHER while its note described a
// working re-render, so the capability read as built and was not.
for (const ct of CONTENT_TYPE_TRANSLATIONS) {
  for (const f of ct.formats) {
    for (const rel of [f.extractModule, f.injectModule]) {
      if (rel && resolveTranslationPath(ct, rel) === undefined) {
        missingDeclared.push(`${ct.contentType}/${f.id} → ${rel}`);
      }
    }
  }
}

if (missingDeclared.length) {
  console.log("\nDECLARED BUT ABSENT — translation-tools names a file that is not there:");
  for (const m of missingDeclared) console.log(`  \u2717 ${m}`);
}

/*
 * Every diagram is reachable from the index page — that half MOVED to
 * `check:process-index` (bean `ax6r`). It used to scan this page's markdown
 * for each diagram's basename, because the table was hand-written; the table
 * is now drawn at runtime from the published named-subgraph JSON-LD, so the
 * page names no diagram and the question is whether that graph covers every
 * declared `.bpmn`. One gate per question: a second scan here would be a
 * second answer to "which diagrams are listed".
 */

console.log(
  `\nDecision points — ${branches.computed.length} computed by a DMN table, ` +
    `${branches.judgement.length} declared judgement, ${branches.undeclared.length} undeclared.`,
);
if (branches.undeclared.length) {
  console.log(
    "  An undeclared gateway is not a defect — it predates `folio:judgement` —\n" +
      "  but it is a decision point nobody has said is a JUDGEMENT rather than a\n" +
      "  table nobody wrote.",
  );
  for (const g of branches.undeclared.slice(0, 8)) console.log(`  \u00b7 ${g.file}: ${g.node}`);
  if (branches.undeclared.length > 8) {
    console.log(`  \u00b7 …and ${branches.undeclared.length - 8} more`);
  }
}

// A listed layer whose path does not resolve is FATAL, and the empty-but-
// present case is not. There is no reading of a non-existent directory that
// makes the verdict above correct, so reporting it without failing would leave
// exactly the gate that cannot fire — bean `1xhc`, which is how this defect
// survived from 2026-09-19 in the first place. A layer that exists and
// holds no diagram is a different fact and stays a report.
const beanFindings = beanCallFindings(beanFacts);
const takers = noteTakers(beanFacts);
console.log(
  `\nBean lifecycle — ${beanFacts.filter((d) => [...d.model.nodes.values()].some((n) => n.calledElement === "Process_BeanOpen")).length} ` +
    `process(es) call Process_BeanOpen and Process_BeanClose; ${takers.length} note-taker(s) own no lifecycle (reported).`,
);
for (const f of beanFindings) console.log(`  \u2717 ${f.file} \u00b7 ${f.process} [${f.kind}]: ${f.detail}`);

if (absentInstances.length) process.exit(1);
if (dangling.length || missingDeclared.length || beanFindings.length) process.exit(1);
if (strict && totalUncovered) process.exit(1);
