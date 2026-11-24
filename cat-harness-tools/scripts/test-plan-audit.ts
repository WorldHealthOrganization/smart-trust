/**
 * The four kg-audit criteria over TEST PLANS, the runs that execute them and
 * the reports those runs produce:
 *
 * | criterion | asks |
 * |---|---|
 * | `test-plan-resolves` | does every plan parse with an exit DMN that exists, and does every plan-run and report name a plan, version and system under test that resolve? |
 * | `test-case-executed-or-skipped` | does every terminal report give each plan case a verdict, and name no case the plan lacks? |
 * | `test-data-hash-present` | is every plan-run's data hash known, and does every report carry its run's data hash? |
 * | `test-sut-not-self-judged` | is any verdict's reviewer the system under test? |
 *
 * ## One implementation of each rule, and it is not here
 *
 * The rules already exist in the schemas — `TestPlanSchema`, `TestRunSchema`
 * (`plan` without `sut` is refused), `TestReportSchema` (a self-judged verdict
 * is refused) and `checkAgainstPlan`. This module FOLLOWS the files to each
 * other and calls those. The one place it reads raw JSON before the schema is
 * `test-sut-not-self-judged`, so that a report the schema refuses for exactly
 * that reason is reported under that criterion rather than as an anonymous
 * parse failure.
 *
 * ## Third states
 *
 * - Nothing to judge (no plan, no plan-run, no report) is `n/a`, never a pass
 *   over nothing.
 * - A report whose plan cannot be followed has not been checked for its
 *   cases: `test-case-executed-or-skipped` is `unknown` for it, not `pass`.
 *
 * @module scripts/test-plan-audit
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { overlayPath } from "./lib/layer-output.ts";
import { join, relative, resolve, sep } from "node:path";
import { switchedOffGroups } from "../schemas/kg/opt-in-roots.js";
import type { KgCriterionEntry, KgFinding } from "../schemas/sdlc/kg-qa.js";
import { TestPlanSchema, TEST_PLAN_SCHEMA_ID, isTestPlanSchemaId, type TestPlan } from "../schemas/sdlc/test-plan.js";
import { TestRunSchema, UNKNOWN_HASH, type SutRef } from "../schemas/sdlc/test-run.js";
import { TestReportSchema, TEST_REPORT_SCHEMA_ID, checkAgainstPlan } from "../schemas/sdlc/test-report.js";
import { CertificationAttestationsSchema } from "../schemas/sdlc/qa-attestations.js";
import type { SutKind } from "../schemas/sdlc/test-plan.js";
import { parseFeature, scanTree, type GherkinFinding } from "./lib/test-gherkin.ts";

/** The four criterion ids, in registry order. */
export const TEST_PLAN_CRITERIA = [
  "test-plan-resolves",
  "test-case-executed-or-skipped",
  "test-data-hash-present",
  "test-sut-not-self-judged",
] as const;
export type TestPlanCriterion = (typeof TEST_PLAN_CRITERIA)[number];

/** The part of an actor these criteria read. */
export interface SutActor {
  id: string;
  systemUnderTest?: { kind: SutKind; version: string };
}

export interface TestPlanAuditInput {
  /** Layer root: findings are relative to it, and DMN refs resolve from it. */
  root: string;
  /** Extra bases a DMN ref may be relative to — the process directories. */
  dmnBases?: string[];
  /** Plan files (`test-plan/v1` JSON). */
  plans: string[];
  /** Test-run files (`folio-test-run/v1`). Runs with no `plan` are not plan-runs and are skipped. */
  runs: string[];
  /** Test-report files (`test-report/v1`). */
  reports: string[];
  actors: readonly SutActor[];
}

/** Every `*.json` under the given directories (recursive), sorted. */
export function jsonFilesUnder(dirs: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d).sort()) {
      if (e.startsWith(".")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".json")) out.push(p);
    }
  };
  for (const d of dirs) walk(d);
  return out.sort();
}

/** Does `file.dmn#Decision_Id` name a decision in a file that exists? */
export function dmnRefResolves(ref: string, bases: readonly string[]): boolean {
  const [file, id] = ref.split("#");
  if (!file || !id) return false;
  for (const b of bases) {
    const p = resolve(b, file);
    if (!existsSync(p)) continue;
    const xml = readFileSync(p, "utf-8");
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`<(?:[A-Za-z]+:)?decision\\b[^>]*\\bid="${esc}"`).test(xml)) return true;
  }
  return false;
}

/**
 * Whether `ref`'s file lies in an opt-in sub-graph that the root which mounted
 * a base switched off and the mount left out: absent by consent, so the ref is
 * not judged here (card Q-SKILL-TOOL-LINK B), only where the group is on. A
 * file in a group the root switched ON that is missing is still a finding.
 */
export function dmnRefSwitchedOff(ref: string, bases: readonly string[]): boolean {
  const [file] = ref.split("#");
  if (!file) return false;
  for (const b of bases) {
    const p = resolve(b, file);
    let leftOut;
    try {
      leftOut = switchedOffGroups(b).leftOut;
    } catch {
      continue; // an unreadable declaration is `check:harness-dirs`' finding
    }
    if (leftOut.some((g) => p === g.abs || p.startsWith(g.abs + sep))) return true;
  }
  return false;
}

function readJson(path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf-8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const issues = (e: { issues: { path: PropertyKey[]; message: string }[] }): string =>
  e.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");

/** Build the four entries. Pure apart from reading the files it is handed. */
export function auditTestPlans(input: TestPlanAuditInput): Record<TestPlanCriterion, KgCriterionEntry> {
  const rel = (p: string) => relative(input.root, p);
  const bases = [input.root, ...(input.dmnBases ?? [])];
  const actors = new Map(input.actors.map((a) => [a.id, a]));

  const resolves: KgFinding[] = [];
  const executed: KgFinding[] = [];
  const hashes: KgFinding[] = [];
  const selfJudged: KgFinding[] = [];
  let executedUnknown = 0;

  // ── Plans ──────────────────────────────────────────────────────────────
  const plans = new Map<string, TestPlan>();
  for (const f of input.plans) {
    const raw = readJson(f);
    if (!raw.ok) {
      resolves.push({ where: rel(f), detail: `is not JSON: ${raw.error}` });
      continue;
    }
    // A JSON file in a plan directory that does not declare itself a plan is
    // not judged as one — the declaration is the contract, not the directory.
    if (!isTestPlanSchemaId((raw.value as { $schema?: unknown })?.$schema)) continue;
    const parsed = TestPlanSchema.safeParse(raw.value);
    if (!parsed.success) {
      resolves.push({ where: rel(f), detail: `does not parse as ${String((raw.value as { $schema?: unknown }).$schema)}: ${issues(parsed.error)}` });
      continue;
    }
    const plan = parsed.data;
    if (plans.has(plan.id)) {
      resolves.push({ where: rel(f), detail: `plan id \`${plan.id}\` is declared twice — a run naming it cannot be followed to one plan.` });
      continue;
    }
    plans.set(plan.id, plan);
    if (!dmnRefResolves(plan.exitCriteria.decision, bases) && !dmnRefSwitchedOff(plan.exitCriteria.decision, bases)) {
      resolves.push({
        where: rel(f),
        detail: `exitCriteria \`${plan.exitCriteria.decision}\` does not resolve to a decision — the certifier would have no rule to apply.`,
      });
    }
  }

  /** The plan a run or report names, and whether its system under test fits it. */
  const follow = (where: string, ref: { id: string; version: string }, sut: SutRef): TestPlan | undefined => {
    const plan = plans.get(ref.id);
    if (!plan) {
      resolves.push({ where, detail: `names plan \`${ref.id}\`, which no test-plan/v1 declares.` });
      return undefined;
    }
    if (plan.version !== ref.version) {
      resolves.push({ where, detail: `executed plan \`${ref.id}\` v${ref.version}; the plan in the tree is v${plan.version}, so what was run cannot be opened.` });
    }
    const actor = actors.get(sut.actor);
    if (!actor) {
      resolves.push({ where, detail: `names system under test \`${sut.actor}\`, which is not a declared actor.` });
    } else if (!actor.systemUnderTest) {
      resolves.push({ where, detail: `system under test \`${sut.actor}\` carries no \`systemUnderTest\` facet — it has not been declared testable.` });
    } else if (actor.systemUnderTest.kind !== plan.scope.kind) {
      resolves.push({
        where,
        detail: `plan \`${plan.id}\` scopes a \`${plan.scope.kind}\`; system under test \`${sut.actor}\` is a \`${actor.systemUnderTest.kind}\`.`,
      });
    }
    return plan;
  };

  // ── Plan-runs ──────────────────────────────────────────────────────────
  let planRuns = 0;
  for (const f of input.runs) {
    // A run's name is logical; its bytes may be under the layer output root (bean `cat-tools-sm8r`, item 4).
    const raw = readJson(overlayPath(f));
    if (!raw.ok) continue; // `test-run-skill-resolves` owns an unreadable run.
    if ((raw.value as { plan?: unknown })?.plan === undefined) continue;
    planRuns++;
    const parsed = TestRunSchema.safeParse(raw.value);
    if (!parsed.success) {
      resolves.push({ where: rel(f), detail: `does not parse as a test run: ${issues(parsed.error)}` });
      continue;
    }
    const run = parsed.data;
    if (run.plan && run.sut) follow(rel(f), run.plan, run.sut);
    if (run.data.hash === UNKNOWN_HASH) {
      hashes.push({ where: rel(f), detail: `data hash is \`${UNKNOWN_HASH}\` — what was tested cannot be established.` });
    }
  }

  // ── Reports ────────────────────────────────────────────────────────────
  let reports = 0;
  for (const f of input.reports) {
    const raw = readJson(f);
    if (!raw.ok) {
      resolves.push({ where: rel(f), detail: `is not JSON: ${raw.error}` });
      continue;
    }
    const v = raw.value as {
      $schema?: unknown;
      sut?: { actor?: unknown };
      cases?: Record<string, { reviewer?: { id?: unknown; actor?: unknown } }[]>;
      run?: { data?: unknown };
    };
    if (v?.$schema !== TEST_REPORT_SCHEMA_ID) continue;
    reports++;

    // Read raw FIRST: the schema refuses a self-judged report, and that refusal
    // belongs to this criterion by name.
    const sutActor = typeof v.sut?.actor === "string" ? v.sut.actor : undefined;
    let self = false;
    if (sutActor !== undefined && v.cases && typeof v.cases === "object") {
      for (const [id, entries] of Object.entries(v.cases)) {
        (Array.isArray(entries) ? entries : []).forEach((e, i) => {
          if (e?.reviewer?.id === sutActor || e?.reviewer?.actor === sutActor) {
            self = true;
            selfJudged.push({ where: `${rel(f)}#cases.${id}[${i}]`, detail: `case \`${id}\` was judged by the system under test (\`${sutActor}\`).` });
          }
        });
      }
    }
    if (typeof v.run?.data !== "string" || v.run.data === "" || v.run.data === UNKNOWN_HASH) {
      hashes.push({ where: rel(f), detail: `the report's run carries no known data hash (\`${String(v.run?.data)}\`).` });
    }

    const parsed = TestReportSchema.safeParse(raw.value);
    if (!parsed.success) {
      // Self-judgement alone already has its own finding above.
      const other = parsed.error.issues.filter((i) => !(self && i.path.at(-1) === "reviewer"));
      if (other.length > 0) resolves.push({ where: rel(f), detail: `does not parse as ${TEST_REPORT_SCHEMA_ID}: ${issues({ issues: other })}` });
      executedUnknown++;
      continue;
    }
    const report = parsed.data;
    const plan = follow(rel(f), report.plan, report.sut);
    if (!plan) {
      executedUnknown++;
      continue;
    }
    for (const m of checkAgainstPlan(report, plan)) {
      if (m.kind === "unexecuted-case" || m.kind === "unknown-case") executed.push({ where: rel(f), detail: m.message });
    }
  }

  const anyPlan = plans.size > 0 || input.plans.length > 0;
  const out = {} as Record<TestPlanCriterion, KgCriterionEntry>;
  out["test-plan-resolves"] = entryOf(resolves, anyPlan || planRuns > 0 || reports > 0);
  out["test-case-executed-or-skipped"] =
    reports === 0
      ? { result: "n/a", findings: [] }
      : executed.length > 0
        ? { result: "fail", findings: executed }
        : executedUnknown > 0
          ? {
              result: "unknown",
              findings: [{ where: "—", detail: `${executedUnknown} report(s) could not be followed to their plan, so their cases were not checked.` }],
            }
          : { result: "pass", findings: [] };
  out["test-data-hash-present"] = entryOf(hashes, planRuns > 0 || reports > 0);
  out["test-sut-not-self-judged"] = entryOf(selfJudged, reports > 0);
  return out;
}

function entryOf(findings: KgFinding[], applicable: boolean): KgCriterionEntry {
  if (!applicable) return { result: "n/a", findings: [] };
  return { result: findings.length > 0 ? "fail" : "pass", findings };
}

export interface TestPlanExitCriteriaAuditInput {
  root: string;
  plans: string[];
  dmnBases?: string[];
}

/**
 * Audit criterion `test-plan-exit-criteria-resolves` (bean `4iey`).
 *
 * Ensures a plan whose `exitCriteria` names a decision table points to an
 * existing `.dmn` file and decision.
 * - If 0 plans checked: `unknown` (vacuity-guarded).
 * - If any unresolvable: `fail` (major severity).
 * - If all checked plans resolve: `pass`.
 */
export function auditTestPlanExitCriteria(input: TestPlanExitCriteriaAuditInput): KgCriterionEntry {
  const rel = (p: string) => relative(input.root, p);
  const bases = [input.root, ...(input.dmnBases ?? [])];
  const findings: KgFinding[] = [];
  let plansChecked = 0;

  for (const f of input.plans) {
    const raw = readJson(f);
    if (!raw.ok) {
      plansChecked++;
      findings.push({ where: rel(f), detail: `is not JSON: ${raw.error}` });
      continue;
    }
    if (!isTestPlanSchemaId((raw.value as { $schema?: unknown })?.$schema)) continue;
    plansChecked++;
    const parsed = TestPlanSchema.safeParse(raw.value);
    if (!parsed.success) {
      findings.push({ where: rel(f), detail: `does not parse as ${String((raw.value as { $schema?: unknown }).$schema)}: ${issues(parsed.error)}` });
      continue;
    }
    const plan = parsed.data;
    if (!dmnRefResolves(plan.exitCriteria.decision, bases) && !dmnRefSwitchedOff(plan.exitCriteria.decision, bases)) {
      findings.push({
        where: rel(f),
        detail: `exitCriteria \`${plan.exitCriteria.decision}\` does not resolve to an existing .dmn file and decision.`,
      });
    }
  }

  if (plansChecked === 0) {
    return {
      result: "unknown",
      findings: [{ where: "—", detail: "0 plans checked (vacuity guard)." }],
    };
  }

  return {
    result: findings.length > 0 ? "fail" : "pass",
    findings,
  };
}

// ── `certification-resolves` (bean `zaui`, Done-when 2) ─────────────────────

export interface CertificationAuditInput {
  /** Layer root: evidence paths and findings are relative to it. */
  root: string;
  /** Plan files (`test-plan/v1`), from the declared `test-plan` directories. */
  plans: readonly string[];
  /** Every file under `<attestations>/certification/`. */
  files: readonly string[];
}

/**
 * Judge every filed certification: it parses as the `certification` family,
 * each entry records `certified`, names a plan a declared `test-plan`
 * directory holds, and points at evidence. Evidence that is not in this
 * checkout (a report kept on `qa-reports`) is `unknown`, never a pass. No
 * certification filed is `n/a`.
 */
export function auditCertifications(input: CertificationAuditInput): KgCriterionEntry {
  if (input.files.length === 0) return { result: "n/a", findings: [] };
  const planIds = new Set<string>();
  for (const p of input.plans) {
    const raw = readJson(p);
    const parsed = raw.ok ? TestPlanSchema.safeParse(raw.value) : undefined;
    if (parsed?.success) planIds.add(parsed.data.id);
  }
  const findings: KgFinding[] = [];
  const unseen: KgFinding[] = [];
  for (const f of input.files) {
    const where = relative(input.root, f);
    const raw = readJson(f);
    if (!raw.ok) {
      findings.push({ where, detail: `not JSON: ${raw.error}` });
      continue;
    }
    const parsed = CertificationAttestationsSchema.safeParse(raw.value);
    if (!parsed.success) {
      findings.push({ where, detail: `not a qa-attestations/v1 certification file: ${issues(parsed.error)}` });
      continue;
    }
    parsed.data.certifications.forEach((c, i) => {
      const at = `${where}#certifications[${i}]`;
      const decision = c.decision ?? c.verdict;
      if (decision !== "certified") {
        findings.push({ where: at, detail: `records "${decision}", not "certified" — a refusal filed as a certification reads as a green it is not` });
      }
      if (!planIds.has(c.testPlanId)) {
        findings.push({ where: at, detail: `names test plan \`${c.testPlanId}\`, which no declared test-plan directory holds` });
      }
      if (!c.evidence) {
        findings.push({ where: at, detail: "points at no evidence — a certification must name the report it certifies" });
      } else if (!existsSync(resolve(input.root, c.evidence))) {
        unseen.push({ where: at, detail: `evidence \`${c.evidence}\` is not in this checkout — fetch the qa-reports entry (\`bun run cat qa:fetch\`) to judge it` });
      }
    });
  }
  if (findings.length > 0) return { result: "fail", findings: [...findings, ...unseen] };
  if (unseen.length > 0) return { result: "unknown", findings: unseen };
  return { result: "pass", findings: [] };
}

// ── `test-has-gherkin` (owner, 2026-11-06: "A test should always have a Gherkin") ──

export interface TestGherkinAuditInput {
  /** The layer root: tests and `.feature` files are scanned, and named, relative to it. */
  root: string;
  plans: string[];
}

/** At most this many test names quoted per finding: a finding per file, not per test. */
const NAMES_PER_FINDING = 5;

/**
 * Audit criterion `test-has-gherkin`.
 *
 * Joins every test the language adapters find to the `@test:` tags of the
 * layer's `.feature` files (`scripts/lib/test-gherkin.ts`), and every plan
 * case to the `.feature` it names. Fails on an orphan either way: a test no
 * Scenario names, a tag naming no test, a test named twice, a Scenario naming
 * no test, and a plan case with no `.feature` (a `test-plan/v1` plan parses,
 * and is reported here until it names one) or one that does not resolve.
 *
 * Findings are grouped per file and kind, so a repository that has not
 * backfilled yet records one finding per test file rather than one per test.
 * `n/a` when there is no test, no Scenario and no plan case.
 */
export function auditTestGherkin(input: TestGherkinAuditInput): KgCriterionEntry {
  const rel = (p: string) => relative(input.root, p);
  const scan = scanTree(input.root);
  const findings: KgFinding[] = [];

  const groups = new Map<string, GherkinFinding[]>();
  for (const f of scan.findings) {
    const key = `${f.kind}\u0000${f.file}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  for (const fs of groups.values()) {
    if (fs.length === 1) {
      findings.push({ where: `${fs[0].file}:${fs[0].line}`, detail: `${fs[0].kind}: ${fs[0].detail}` });
      continue;
    }
    const quoted = fs.slice(0, NAMES_PER_FINDING).map((f) => `\`${f.test ?? `line ${f.line}`}\``);
    const more = fs.length > NAMES_PER_FINDING ? `, and ${fs.length - NAMES_PER_FINDING} more` : "";
    findings.push({ where: fs[0].file, detail: `${fs[0].kind}: ${fs.length} — ${quoted.join(", ")}${more}` });
  }

  let cases = 0;
  for (const f of input.plans) {
    const raw = readJson(f);
    if (!raw.ok || !isTestPlanSchemaId((raw.value as { $schema?: unknown })?.$schema)) continue;
    const parsed = TestPlanSchema.safeParse(raw.value);
    // A plan that does not parse is `test-plan-resolves`'s finding, not this one's.
    if (!parsed.success) continue;
    for (const c of parsed.data.testCases) {
      cases++;
      if (c.feature === undefined) {
        findings.push({ where: `${rel(f)}#${c.id}`, detail: `plan case names no \`.feature\` (${parsed.data.$schema}; required from ${TEST_PLAN_SCHEMA_ID}).` });
        continue;
      }
      const at = [join(input.root, c.feature), join(resolve(f, ".."), c.feature)].find((p) => existsSync(p));
      if (!at) {
        findings.push({ where: `${rel(f)}#${c.id}`, detail: `plan case names \`${c.feature}\`, which does not exist (looked beside the plan and at the root).` });
        continue;
      }
      if (parseFeature(rel(at), readFileSync(at, "utf-8")).scenarios.length === 0) {
        findings.push({ where: `${rel(f)}#${c.id}`, detail: `plan case names \`${c.feature}\`, which holds no Scenario.` });
      }
    }
  }

  return entryOf(findings, scan.tests.length > 0 || scan.scenarios.length > 0 || cases > 0);
}
