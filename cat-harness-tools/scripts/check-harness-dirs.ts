#!/usr/bin/env bun
/**
 * The harness's two stores are declared in two files. This is what keeps them
 * from disagreeing.
 *
 * The bean graph declaration is where a folio STATES where its work plan
 * (`bean-defs`) and workflow state (`workflow-state`) live. `.beans.yml` is
 * what the `beans` binary actually READS — it is a third-party tool and does
 * not know the bean graph exists. So the same path is written twice by
 * necessity, and this makes a disagreement a build failure on the day it is
 * introduced.
 *
 * ## What it checks
 *
 * 1. The declared `bean-defs` path equals `beans.path` in `.beans.yml`.
 * 2. The declared `workflow-state` path is what `workflow/store.ts` compiled in.
 * 3. Neither path is dot-prefixed at its first segment, so a person can see
 *    them.
 * 4. The declared work-plan directory exists and holds beans.
 *
 * ## Third state
 *
 * A folio with no bean graph declaration is **not** a failure: the documented
 * default layout is the answer, and it is reported rather than judged wrong.
 * A declaration that will not parse is a failure. Exit 2 is "could not
 * check" and is never rendered as a pass — same rule as `check-ci-health.ts`.
 *
 * Usage:
 *   bun run cat check:harness-dirs
 *   bun run cat check:harness-dirs -- --json
 *
 * Exit: 0 consistent (or not configured), 1 a real disagreement, 2 could not check.
 *
 * @module scripts/check-harness-dirs
 * @covers cat-harness, beans
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  BEAN_GRAPH_FILE,
  DEFAULT_BEAN_GRAPH_ROOT,
  nodeOfKind,
  parseBeanGraph,
} from "../schemas/sdlc/bean-graph.ts";
import { WORKFLOW_DIR } from "../src/workflow/store.js";
import { graphReadPath } from "./graph-read.ts";
import { BeanStoreAbsentError, exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

export interface HarnessDirsReport {
  /** A parseable `beans/beans.json` was found. */
  configured: boolean;
  /** The `bean-defs` node, or the documented default when no graph is present. */
  declaredWorkPlan: string;
  declaredWorkflowState: string;
  /** From `.beans.yml`, which is what the CLI reads. `undefined` if absent. */
  beansYmlPath?: string;
  /** What `workflow/store.ts` compiled in. */
  compiledWorkflowState: string;
  /** Beans found in the declared work-plan directory; -1 if it is absent. */
  beanCount: number;
  problems: string[];
  notes: string[];
}

/**
 * Read `beans.path` out of `.beans.yml`.
 *
 * Deliberately a two-line regex rather than a YAML dependency: the file is
 * written by `beans init` and has exactly this shape, and adding a parser for
 * one scalar would be a dependency to keep current forever. If the key cannot
 * be found the caller reports "could not check" — it does not assume a default,
 * because assuming one here would defeat the whole check.
 */
export function beansYmlPath(root: string): string | undefined {
  const p = join(root, ".beans.yml");
  if (!existsSync(p)) return undefined;
  const m = /^\s*path:\s*(\S+)\s*$/m.exec(readFileSync(p, "utf-8"));
  return m?.[1]?.replace(/^["']|["']$/g, "");
}

export function checkHarnessDirs(root: string): HarnessDirsReport {
  const problems: string[] = [];
  const notes: string[] = [];

  let configured = false;
  let declaredWorkPlan = join(DEFAULT_BEAN_GRAPH_ROOT, "defs");
  let declaredWorkflowState = join(DEFAULT_BEAN_GRAPH_ROOT, "workflows");

  const where = graphReadPath("beans", root);
  // An instance with no bean store has no harness directories to agree
  // (smart-ips-pilgrimage#13): the gate says not applicable, the reader stops.
  if (where.state === "refused" && where.absent) throw new BeanStoreAbsentError(where.reason);
  const graphRoot = where.state === "ok" ? where.at : join(root, DEFAULT_BEAN_GRAPH_ROOT);

  // The bean graph is the DECLARATION. It used to be `harness.config.json`'s
  // `harness` block; moving it here removed one of the three places the same
  // path was written, rather than adding a fourth. See schemas/sdlc/bean-graph.ts.
  const graphPath = join(graphRoot, BEAN_GRAPH_FILE);
  if (existsSync(graphPath)) {
    try {
      const graph = parseBeanGraph(JSON.parse(readFileSync(graphPath, "utf-8")));
      configured = true;
      const defs = nodeOfKind(graph, "bean-defs");
      const state = nodeOfKind(graph, "workflow-state");
      if (defs) declaredWorkPlan = join(DEFAULT_BEAN_GRAPH_ROOT, defs.path);
      else problems.push("bean graph declares no `bean-defs` node — nothing says where beans live.");
      if (state) declaredWorkflowState = join(DEFAULT_BEAN_GRAPH_ROOT, state.path);
      else notes.push("bean graph declares no `workflow-state` node — no process state is kept.");
    } catch (e) {
      // Present-but-unreadable is a failure, never a silent fall back to the
      // defaults: a graph nobody can parse leaves every consumer guessing.
      problems.push(`beans/${BEAN_GRAPH_FILE} will not parse: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    notes.push(`No beans/${BEAN_GRAPH_FILE} — using the documented default layout.`);
  }

  const ymlPath = beansYmlPath(root);
  if (ymlPath === undefined) {
    notes.push("No `.beans.yml`, or no `path:` in it — the CLI's view could not be read.");
  } else if (ymlPath !== declaredWorkPlan) {
    problems.push(
      `Work-plan path disagrees: the bean graph says "${declaredWorkPlan}", ` +
        `.beans.yml says "${ymlPath}". The CLI follows .beans.yml, so beans would ` +
        `be written to a store nothing else reads.`,
    );
  }

  if (WORKFLOW_DIR !== declaredWorkflowState) {
    problems.push(
      `Workflow-state path disagrees: the bean graph says "${declaredWorkflowState}", ` +
        `workflow/store.ts compiled in "${WORKFLOW_DIR}".`,
    );
  }

  for (const [label, p] of [
    ["bean-defs", declaredWorkPlan],
    ["workflow-state", declaredWorkflowState],
  ] as const) {
    // ANY segment, not just the first. The graph root is `beans/` and a node
    // path cannot escape it, so the first segment is always visible — but a
    // node declared as `.defs` would resolve to `beans/.defs` and be just as
    // invisible in an `ls` as the dot-prefixed stores this move existed to
    // fix. Checking only the head would have made this guard unfireable.
    if (p.split(/[\\/]/).some((seg) => seg.startsWith("."))) {
      problems.push(
        `The ${label} node resolves to "${p}", which is hidden behind a dot. These two stores ` +
          `are what a person looks for first; keep them visible.`,
      );
    }
  }

  let beanCount = -1;
  if (where.state === "refused") {
    problems.push(where.reason);
  } else {
    const relToGraph = relative(DEFAULT_BEAN_GRAPH_ROOT, declaredWorkPlan);
    const wpDir = resolve(graphRoot, relToGraph);
    if (existsSync(wpDir)) {
      beanCount = readdirSync(wpDir).filter((f) => f.endsWith(".md")).length;
      if (beanCount === 0) {
        notes.push(`${declaredWorkPlan}/ exists but holds no beans — an empty plan, not a broken one.`);
      }
    } else {
      problems.push(`harness.workPlan names "${declaredWorkPlan}", which does not exist.`);
    }
  }

  return {
    configured,
    declaredWorkPlan,
    declaredWorkflowState,
    beansYmlPath: ymlPath,
    compiledWorkflowState: WORKFLOW_DIR,
    beanCount,
    problems,
    notes,
  };
}

export function formatReport(r: HarnessDirsReport): string {
  const out: string[] = ["Harness directories"];
  out.push("");
  out.push(`  work plan        ${r.declaredWorkPlan}${r.configured ? "" : "   (schema default)"}`);
  out.push(`  workflow state   ${r.declaredWorkflowState}${r.configured ? "" : "   (schema default)"}`);
  out.push(`  .beans.yml says  ${r.beansYmlPath ?? "— not readable"}`);
  out.push(`  store.ts says    ${r.compiledWorkflowState}`);
  out.push(`  beans present    ${r.beanCount < 0 ? "— directory absent" : r.beanCount}`);
  out.push("");
  for (const n of r.notes) out.push(`  · ${n}`);
  if (r.problems.length) {
    out.push("");
    for (const p of r.problems) out.push(`  ✗ ${p}`);
  } else {
    out.push("  ✓ consistent");
  }
  return out.join("\n");
}

if (import.meta.main) {
  const root = resolve(".");
  let report: HarnessDirsReport;
  try {
    report = checkHarnessDirs(root);
  } catch (e) {
    exitIfBeanStoreAbsent("check:harness-dirs", e);
    console.error(`Could not check harness directories: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.problems.length ? 1 : 0);
}
