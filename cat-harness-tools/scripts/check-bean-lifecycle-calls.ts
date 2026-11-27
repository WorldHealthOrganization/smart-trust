#!/usr/bin/env bun
/**
 * A process that claims, resolves or archives a bean does it by calling `Process_BeanOpen`
 * and `Process_BeanClose`, always both. No other diagram carries those ops.
 *
 * The ops live in two called processes in `cat-harness`
 * (`sdlc/processes/bean-open.bpmn`, `bean-close.bpmn`), so no copy can
 * drift. This check fails on three things:
 *
 * 1. **`claim`, `resolve` or `archive` outside OPEN and CLOSE**, on an activity
 *    or on a global task an activity calls. `note` stays where the work happens.
 * 2. **An entry process that names a bean and does not call both.** Naming is a
 *    `<cat-harness.processes:bean ref="…"/>` (or `id`, `bean`) on one of its
 *    activities. "Entry" means no diagram in the corpus calls it: a process
 *    that is only ever called runs on its caller's bean (`enterSubprocesses`
 *    hands `state.bean` down).
 * 3. **A process that calls one of the two and not the other.** An OPEN with
 *    no CLOSE leaves a bean open; the reverse closes a bean the process never
 *    checked was its own.
 *
 * **Note-takers are reported, not failed.** An entry process whose only marks
 * are `op="note"` or a bare `<cat-harness.processes:bean/>` writes on whatever
 * bean its instance was started with — `merge-train` notes on each PR's, the
 * FHIR build logs its findings on the build's — and never decides that
 * bean's fate. Rules 1 and 3 already ensure no process can claim without
 * OPEN, nor OPEN without CLOSE. The list is printed so the judgement stays
 * visible.
 *
 * Reads every diagram in the checkout scope, so a higher layer's diagrams are
 * judged whenever they are mounted. An empty corpus is refused rather than
 * reported clean.
 *
 * Usage:  bun run cat check:bean-calls
 * Exit:   0 clean · 1 a finding, or no diagram read
 *
 * @covers processes
 */
import { relative } from "node:path";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { corpusScopeFor, workflowFiles } from "./known-skills.js";
import { isActivity, loadProcessModel, processDiagrams, type ProcessModel } from "../src/workflow/process-model.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";

/** The reusable OPEN: check exists, create, whose bean, claim or leave alone. */
export const BEAN_OPEN = "Process_BeanOpen";
/** The reusable CLOSE: outcome, then complete + archive, scrap, or record the blocker. */
export const BEAN_CLOSE = "Process_BeanClose";
/** The ops only OPEN and CLOSE may carry. */
export const LIFECYCLE_OPS: ReadonlySet<string> = new Set(["claim", "resolve", "archive"]);

export type BeanCallKind = "op-outside-lifecycle" | "names-bean-without-open-close" | "unpaired-call";

export interface BeanCallFinding {
  readonly file: string;
  readonly process: string;
  readonly kind: BeanCallKind;
  readonly detail: string;
}

/** What the check needs from one loaded diagram. */
export interface DiagramFacts {
  readonly file: string;
  readonly model: Pick<ProcessModel, "id" | "nodes">;
}

/** Process ids called by any activity in the corpus. */
function calledIds(diagrams: readonly DiagramFacts[]): Set<string> {
  const out = new Set<string>();
  for (const d of diagrams) for (const n of d.model.nodes.values()) if (n.calledElement) out.add(n.calledElement);
  return out;
}

/**
 * Entry processes that write notes on their instance's bean and call neither
 * OPEN nor CLOSE: reported, not failed (see the module docblock).
 */
export function noteTakers(diagrams: readonly DiagramFacts[]): DiagramFacts[] {
  const called = calledIds(diagrams);
  return diagrams.filter(({ model }) => {
    if (model.id === BEAN_OPEN || model.id === BEAN_CLOSE || called.has(model.id)) return false;
    const nodes = [...model.nodes.values()];
    if (nodes.some((n) => n.calledElement === BEAN_OPEN || n.calledElement === BEAN_CLOSE)) return false;
    return nodes.filter(isActivity).some((n) => n.touchesWorkPlan);
  });
}

/** The three rules, over already-loaded diagrams. Pure, so a test can hand it fixtures. */
export function beanCallFindings(diagrams: readonly DiagramFacts[]): BeanCallFinding[] {
  const called = calledIds(diagrams);
  const out: BeanCallFinding[] = [];
  for (const { file, model } of diagrams) {
    const isLifecycle = model.id === BEAN_OPEN || model.id === BEAN_CLOSE;
    const nodes = [...model.nodes.values()];
    if (!isLifecycle) {
      for (const n of nodes) {
        if (n.workPlanOp && LIFECYCLE_OPS.has(n.workPlanOp)) {
          out.push({
            file,
            process: model.id,
            kind: "op-outside-lifecycle",
            detail:
              `${n.id} carries op="${n.workPlanOp}"${n.globalTask ? ` (through ${n.globalTask.id})` : ""}. ` +
              `Claim lives in ${BEAN_OPEN} and resolve/archive in ${BEAN_CLOSE}: call them instead.`,
          });
        }
      }
    }
    const opens = nodes.some((n) => n.calledElement === BEAN_OPEN);
    const closes = nodes.some((n) => n.calledElement === BEAN_CLOSE);
    if (opens !== closes) {
      out.push({
        file,
        process: model.id,
        kind: "unpaired-call",
        detail: opens
          ? `calls ${BEAN_OPEN} and never ${BEAN_CLOSE}: the bean it opens is never completed, scrapped or handed back.`
          : `calls ${BEAN_CLOSE} and never ${BEAN_OPEN}: it closes a bean it never checked was its own.`,
      });
    }
    if (isLifecycle || called.has(model.id)) continue;
    const naming = nodes.filter(isActivity).filter((n) => (n.beans?.length ?? 0) > 0);
    if (naming.length > 0 && !(opens && closes)) {
      out.push({
        file,
        process: model.id,
        kind: "names-bean-without-open-close",
        detail:
          `${naming.map((n) => `${n.id} → ${n.beans!.join(", ")}`).join("; ")}: names a bean, nothing calls this process, ` +
          `and it does not call both ${BEAN_OPEN} and ${BEAN_CLOSE}. Call ${BEAN_OPEN} where the bean ` +
          `becomes this process's, and ${BEAN_CLOSE} before each end it reaches from there.`,
      });
    }
  }
  return out;
}

async function main(): Promise<number> {
  const root = HARNESS_ROOT;
  const files = processDiagrams(workflowFiles(root, corpusScopeFor(root)));
  if (files.length === 0) {
    console.error("::error::check:bean-calls: no diagram in scope — COULD NOT DETERMINE, not clean (bean `dh4f`).");
    return 1;
  }
  const base = repoRootFor(root);
  const diagrams: DiagramFacts[] = [];
  for (const f of files) diagrams.push({ file: relative(base, f), model: await loadProcessModel(f) });
  const findings = beanCallFindings(diagrams);
  const openers = diagrams.filter((d) => [...d.model.nodes.values()].some((n) => n.calledElement === BEAN_OPEN));
  console.log(
    `check:bean-calls: ${diagrams.length} diagram(s); ${openers.length} call ${BEAN_OPEN} and ${BEAN_CLOSE}.`,
  );
  const takers = noteTakers(diagrams);
  if (takers.length > 0) {
    console.log(
      `  · ${takers.length} entry process(es) write notes on their instance's bean and own no lifecycle ` +
        `(reported, not failed): ${takers.map((d) => d.model.id).join(", ")}`,
    );
  }
  if (findings.length === 0) {
    console.log("  ✓ every claim, resolve and archive is inside OPEN or CLOSE, and every process that calls one calls both.");
    return 0;
  }
  console.error(`\n✗ ${findings.length} finding(s):\n`);
  for (const f of findings) console.error(`  ${f.kind.padEnd(34)} ${f.file} · ${f.process}\n      ${f.detail}`);
  console.error(
    "\nBean `m8gz` (owner, 2026-10-24): the bean ops live in two called processes, so a copy cannot drift.\n" +
      "`todo-manager` § Archiving says where each op now is.",
  );
  return 1;
}

if (import.meta.main) process.exit(await main());
