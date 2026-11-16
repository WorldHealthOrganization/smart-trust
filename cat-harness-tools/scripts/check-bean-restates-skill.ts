#!/usr/bin/env bun
/**
 * A bean that carries a SKILL'S CONTRACT instead of pointing at it.
 *
 * Where a skill and a copy disagree, the skill wins and the copy is wrong
 * (`AGENTS.md`'s banner). This finds the copies.
 *
 * ## Structure, not similarity
 *
 * Text similarity cannot find this defect: semantic drift is a rewrite,
 * which shares few words with the original and is indistinguishable from
 * unrelated prose, and words like "invariant" or "exit criterion" also occur
 * in beans that merely discuss a contract. {@link contractTables} reads the
 * SHAPE instead.
 *
 * ## What a contract table is
 *
 * A markdown table with at least two data rows, a column header matching
 * {@link CRITERION_COL}, and both of:
 *
 * **1. It is not an EXIT-CODE table.** Checks document their 0/1/2 exit
 * status in a table, so `| exit |` usually means *exit status*. Excluded by
 * {@link EXIT_CODE_CELL}: every cell in the column is a bare digit.
 *
 * **2. Its rows enumerate PHASES** — named units of a plan, each row carrying
 * that unit's own exit condition (`| phase | does | exit criterion |` over
 * rows `P0`…`P4`), not, say, QA criteria named as identifiers in code.
 *
 * `check-bean-restates-skill.test.ts` pins both directions.
 *
 * ## A skill pointer is context, not a condition
 *
 * A bean may restate a contract without naming the skill by path, so the
 * pointer changes the remedy, not the verdict:
 *
 * - names the skill → the contract has a home; delete the copy and keep the link.
 * - names none → the contract has no home yet; it belongs in a skill, and the
 *   bean keeps a pointer to it. This is the worse case: nothing in the bean
 *   admits a second copy exists.
 *
 * ## What this does NOT do
 *
 * **It does not read `## Done when`**, the house shape for a work plan that
 * [`opening-brief.md`](../skills/conduct/conduct-core/opening-brief.md) asks for;
 * whether one restates a skill is a judgement about meaning, left to the
 * reader.
 *
 * **It cannot reach restatements in other shapes** (prose, bullet lists,
 * status tables). So the clean line says "no open bean carries a
 * phase-contract table", deliberately not "no bean restates a skill".
 *
 * **It does not assume the direction.** The skill is the right default, but
 * the skill is sometimes the stale side, so {@link formatReport} reports a
 * DISAGREEMENT and names both sides.
 *
 * **It does not repair anything.** Same rule as `check:bean-bodies` and
 * `bun run cat health`: the finding names something a *person* does, and the
 * person is the bean's owner. See
 * [`deletion-requires-confirmation.md`](../skills/conduct/conduct-core/deletion-requires-confirmation.md).
 *
 * **It ignores closed beans**, like `check:bean-parents` and
 * `check:bean-bodies`: a finished bean is history.
 *
 * Exit: 0 clean, 1 a real defect, 2 could not check.
 *
 * @module folio-assistant/scripts/check-bean-restates-skill
 * @covers bean-defs, beans, skills — it reads a bean against the skill it cites, so a finding
 *   is about the pair
 */

import { repoRootFor } from "../schemas/kg/cat-harness.js";

import { OPEN_STATUSES, readBeanStore, type BeanFile } from "./bean-store-read.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";
import { BeanStoreAbsentError, exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/**
 * A column header naming an exit condition or a criterion.
 *
 * `\bexits?\b` rather than a substring, so `exits` matches and `exited` does
 * not — and note this is only ONE of three conditions. On its own it flags 8
 * beans, none of them a restatement; the module docs list all 8 by id.
 */
export const CRITERION_COL = /\bexits?\b|criteri/i;

/**
 * A first-column header that says the rows are phases.
 *
 * Anchored, and emphasis-tolerant because a header is often bolded. `steps?`
 * is included and `task` deliberately is not: a task list is what a work plan
 * legitimately IS, while a numbered phase carrying its own exit condition is a
 * contract.
 */
export const PHASE_HEADER = /^\**\s*(?:phase|stage|step|round|tier|milestone)s?\s*\**$/i;

/** A first-column CELL naming a numbered phase — `P0`, `Phase 2`, `**Step 3**`. */
export const PHASE_CELL = /^\**\s*(?:p|phase|stage|step)\s*-?\d+\b/i;

/**
 * A cell holding an exit STATUS rather than an exit condition.
 *
 * A bare digit, optionally bolded or in a code span: `0`, `**1**`, `` `2` ``.
 * The column must be ENTIRELY such cells to disqualify the table — one
 * numeric row among prose rows is a phase whose criterion is a number, which
 * is still a criterion.
 */
export const EXIT_CODE_CELL = /^\**\s*`?\d+`?\s*\**$/;

/** A path into any layer's `skills/` directory, as a bean writes one. */
export const SKILL_PATH = /(?:[\w.-]+\/)*skills\/[\w./-]+\.md/g;

/** One markdown table, as it sits in a bean body. */
export interface ParsedTable {
  header: string[];
  rows: string[][];
  /** 1-based line of the header row within the body. */
  line: number;
  /** The header row verbatim, for the finding message. */
  raw: string;
}

/**
 * Every pipe table in a body.
 *
 * Hand-parsed rather than through a markdown library, for
 * {@link readBeanStore}'s reason one level down: the question is about the
 * SOURCE shape an author typed, and a renderer normalises exactly the details
 * that carry the signal.
 */
export function parseTables(body: string): ParsedTable[] {
  const lines = body.split("\n");
  const out: ParsedTable[] = [];
  const cells = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  for (let i = 0; i < lines.length - 1; i++) {
    const head = lines[i]!.trim();
    const sep = lines[i + 1]!.trim();
    if (!head.startsWith("|")) continue;
    if (!/^\|[\s:|-]+\|$/.test(sep)) continue;
    const rows: string[][] = [];
    let j = i + 2;
    for (; j < lines.length && lines[j]!.trim().startsWith("|"); j++) rows.push(cells(lines[j]!));
    out.push({ header: cells(head), rows, line: i + 1, raw: head });
    i = j - 1;
  }
  return out;
}

/**
 * The contract tables in a body — see the module docs for the three conditions
 * and for the eight beans each one was measured against.
 */
export function contractTables(body: string): ParsedTable[] {
  return parseTables(body).filter((t) => {
    if (t.rows.length < 2) return false;
    const idx = t.header.findIndex((h) => CRITERION_COL.test(h));
    if (idx < 0) return false;
    const column = t.rows.map((r) => r[idx] ?? "");
    // An exit-CODE table. Guarded on length so an empty column cannot pass
    // `every` vacuously and disqualify a table nothing was read from.
    if (column.length > 0 && column.every((c) => EXIT_CODE_CELL.test(c))) return false;
    if (PHASE_HEADER.test(t.header[0] ?? "")) return true;
    return t.rows.filter((r) => PHASE_CELL.test(r[0] ?? "")).length >= 2;
  });
}

/** Distinct skill paths a body names. Context for the remedy, never a condition. */
export function skillPathsNamed(body: string): string[] {
  return [...new Set(body.match(SKILL_PATH) ?? [])].sort();
}

export interface Restatement {
  id: string;
  /** The header row of the contract table, verbatim. */
  table: string;
  line: number;
  /** Skill paths the bean names, or `[]` — which is the worse case. */
  skills: string[];
}

export interface RestatesSkillReport {
  /** False when this layer has no bean store at all. Legitimate. */
  store: boolean;
  /** Open beans read. Zero is `could not check`, never a pass. */
  examined: number;
  findings: Restatement[];
}

export function checkBeanRestatesSkill(root: string): RestatesSkillReport {
  const store = readBeanStore(root);
  if (store.state === "absent") return { store: false, examined: 0, findings: [] };
  if (store.state === "declared-but-absent") {
    // `dh4f`: a declaration naming a directory that is not there is a defect,
    // not an empty corpus. Reporting it clean is the very shape this file's
    // vacuity guard exists for.
    throw new Error(`the bean graph declares ${store.dir} and it is not there`);
  }
  if (store.state === "unreachable") {
    // Same reason one state over (bean `9ofm` row D): a store this checkout
    // could not reach is not an empty corpus, and the vacuity guard below
    // would read it as one. Different remedy, so a different message.
    if (store.absent) throw new BeanStoreAbsentError(store.reason);
    throw new Error(`the bean store could not be reached: ${store.reason}`);
  }
  const open: BeanFile[] = store.beans.filter((b) => !b.archived && OPEN_STATUSES.has(b.status));
  const findings: Restatement[] = [];
  for (const b of open) {
    for (const t of contractTables(b.body)) {
      findings.push({ id: b.id, table: t.raw, line: t.line, skills: skillPathsNamed(b.body) });
    }
  }
  return { store: true, examined: open.length, findings };
}

export function formatReport(r: RestatesSkillReport): string {
  if (!r.store) return "Bean restates skill\n  · no bean store — nothing to check";
  const out = [`Bean restates skill (${r.examined} open bean(s) examined)`];
  if (r.findings.length === 0) {
    out.push("  ✓ no open bean carries a phase-contract table");
    return out.join("\n");
  }
  for (const f of r.findings) {
    out.push(`  ✗ ${f.id} line ${f.line}: ${f.table}`);
    out.push(
      f.skills.length
        ? `      also stated in ${f.skills.join(", ")}. RECONCILE the two — read both before editing either.`
        : "      the bean names NO skill. The contract belongs in one; the bean keeps a pointer to it.",
    );
  }
  out.push("");
  out.push("  A bean is a WORK PLAN: what is outstanding, and what constrains it. A skill carries the");
  out.push("  CONTRACT. `kn0t` is the worked example, before and after PR #1185.");
  out.push("  THE DIRECTION IS NOT ASSUMED. AGENTS.md says the skill wins, and that is the right default,");
  out.push("  but the hand-check in bean `ekp9` measured 5 drifts and found the SKILL wrong in 3 of them.");
  out.push("  So this reports a DISAGREEMENT, never an instruction to edit the bean.");
  out.push("  Repaired by the bean's OWNER, not by this check and not by whoever ran it.");
  return out.join("\n");
}

if (import.meta.main) {
  let report: RestatesSkillReport;
  try {
    // The REPOSITORY root, not the cwd: `beans/` is repository-scoped, and a
    // run from anywhere else reads "no store" — a clean-looking answer to a
    // question asked in the wrong place. Same note as `check-bean-bodies`.
    report = checkBeanRestatesSkill(repoRootFor(HARNESS_ROOT));
    // THE VACUITY GUARD. A store that exists and holds no open bean is not a
    // clean sweep, it is a sweep of nothing — the `xom7` shape, and the one
    // `gates.ts` fails its own extraction over. A filter over nothing passes.
    if (report.store && report.examined === 0) {
      console.error("Bean store read, but it holds no OPEN bean. Nothing was examined.");
      console.error("This is NOT a pass. Treat it as unknown.");
      process.exit(2);
    }
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-restates-skill", e);
    console.error(`Could not check whether a bean restates a skill: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.findings.length ? 1 : 0);
}
