/**
 * A gate that may be red BY DECISION must be the last step of its job.
 *
 * A GitHub job stops at its first failing step, and a `run: |` block under
 * `set -e` at its first failing command, so a gate that is red on purpose
 * silently skips every check after it (e.g. `translation:drift:check`).
 *
 * For each declared gate it asserts:
 *
 *   1. It is FOUND. A renamed or deleted gate fails here rather than passing
 *      by absence.
 *   2. It occupies a step ALONE, since bundling it with other `bun run` lines
 *      re-creates the masking inside the step.
 *   3. Its step is the LAST in its job. Reported with the steps that follow it.
 *
 * The list is hardcoded (two entries, `translation:drift:check` and `bun
 * test`, which runs the same drift assertion); this list IS the check. Make
 * sure the matcher can NAME a new gate before adding it.
 *
 * Usage:
 *   bun run cat check:red-gate-is-last
 *
 * @covers none — .github/workflows/ is not a declared graph typology
 * @graphNode tool
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import { GATES_WORKFLOW } from "./lib/gates-workflow.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { rootProfile } from "./lib/root-gate-set.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");
const WORKFLOW = join(REPO_ROOT, ".github", "workflows", "code-quality-gates.yml");

/** A gate the repository accepts as red by decision rather than by defect. */
export interface RedGate {
  /**
   * The gate's spelling, exactly as the workflow spells it — a `bun run`
   * target, or a bare runner like `bun test` that is not a `bun run` target at
   * all. `invocations` decides what a step is understood to run; this field has
   * to agree with it, and `absent` is what says so when it stops agreeing.
   */
  script: string;
  /** Why it is allowed to be red, so a reader does not have to guess. */
  why: string;
}

export const DELIBERATELY_RED: readonly RedGate[] = [
  {
    script: "translation:drift:check",
    why:
      "red by the owner's decision (bean `ngxj`, issue #206): the fix is real `.po` " +
      "catalogues, and recording the absences instead was merged in #1364 and reverted " +
      "in #1384 on their instruction. So it may be red for a long time, and it must not " +
      "take other gates with it.",
  },
  {
    script: "bun test",
    why:
      "carries the SAME assertion as `translation:drift:check` — " +
      "`pipeline/translation-drift.test.ts` has a `the real corpus — and the gate " +
      "can actually fail` block whose `no NEW drift, and nothing unreadable` case reads the " +
      "real translations. That is the single failure that made main's typescript job red " +
      "(run 36231943911), so it goes red for the same reason, on the same decision, and for " +
      "the same duration. Declared even though BOTH are green today (2026-09-27: the drift " +
      "gate exits 0, 70 compared / 0 newly drifted / 8 uncatalogued and recorded) because " +
      "its position is the thing being fixed, and position must not depend on whether the " +
      "gate happens to be red this week — bean `om30`'s own lesson, that the masked count " +
      "is a property of WHICH step is red and that moves.",
  },
];

export interface Finding {
  script: string;
  /** `absent` | `shares-a-step` | `not-last` */
  kind: "absent" | "shares-a-step" | "not-last";
  message: string;
}

export interface Report {
  /** Jobs seen, so a parse that found nothing cannot read as clean. */
  jobs: number;
  /** Steps seen across all jobs, for the same reason. */
  steps: number;
  /** Declared gates located, by `job` → step index (0-based) and step count. */
  located: Array<{ script: string; job: string; index: number; of: number }>;
  findings: Finding[];
}

interface Step {
  name?: string;
  run?: string;
}

/**
 * Every gate a step's script runs, in order.
 *
 * Two spellings, because a gate is not always a `bun run` target. `bun test` is
 * a **bare runner** — it takes no target, so the original `bun run\s+(\S+)`
 * could not name it, and a gate this function cannot name is a gate
 * `DELIBERATELY_RED` cannot declare. That was not a gap in the declaration; it
 * was a gap in the vocabulary, which is why it is fixed here rather than by
 * inventing a `bun run test` alias in the workflow.
 *
 * A bare runner is reported under its own spelling (`"bun test"`), so the
 * declaration reads the same as the workflow. Arguments after it are allowed
 * and ignored: `bun test <path>` is a NARROWER run, and narrowing what a step
 * executes must not silently stop the position rule applying to it. The cost of
 * over-matching here is an enforced ordering constraint on a step that may no
 * longer carry the red assertion — harmless. The cost of under-matching is the
 * masking this whole file exists to refuse.
 *
 * A commented-out line matches neither, since `^\s*` is followed by the runner
 * rather than by anything that may precede it — counting one would report a gate
 * the job does not run, which is `ot9a` mirrored.
 */
export function invocations(run: string | undefined): string[] {
  if (typeof run !== "string") return [];
  const found: string[] = [];
  for (const line of run.split("\n")) {
    const target = /^\s*bun run\s+(?:cat\s+)?([^\s#]+)/.exec(line);
    if (target) {
      found.push(target[1]!);
      continue;
    }
    if (/^\s*bun\s+test\b/.test(line)) found.push("bun test");
  }
  return found;
}

/**
 * Judge a parsed workflow.
 *
 * Takes the parsed document rather than a path so the tests can build the
 * defect rather than describe it — `falsified by breaking` is one of the two
 * boxes this file closes, and a check that can only be pointed at the real
 * corpus cannot be shown to fail.
 */
export function redGateIsLast(
  doc: unknown,
  declared: readonly RedGate[] = DELIBERATELY_RED,
): Report {
  const report: Report = { jobs: 0, steps: 0, located: [], findings: [] };
  const jobs = (doc as { jobs?: Record<string, { steps?: Step[] }> } | null)?.jobs ?? {};

  for (const [jobName, job] of Object.entries(jobs)) {
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    report.jobs++;
    report.steps += steps.length;

    steps.forEach((step, index) => {
      const calls = invocations(step?.run);
      for (const gate of declared) {
        if (!calls.includes(gate.script)) continue;
        report.located.push({ script: gate.script, job: jobName, index, of: steps.length });

        const others = calls.filter((c) => c !== gate.script);
        if (others.length > 0) {
          report.findings.push({
            script: gate.script,
            kind: "shares-a-step",
            message:
              `\`${gate.script}\` shares step "${step?.name ?? `#${index + 1}`}" of job ` +
              `\`${jobName}\` with ${others.length} other gate(s): ${others.join(", ")}. ` +
              `Under \`set -e\` it masks every one of them that follows it, and job-level ` +
              `ordering cannot see inside a step. It needs a step of its own.`,
          });
        }

        const after = steps.slice(index + 1);
        if (after.length > 0) {
          report.findings.push({
            script: gate.script,
            kind: "not-last",
            message:
              `\`${gate.script}\` is step ${index + 1} of ${steps.length} in job ` +
              `\`${jobName}\`, and ${after.length} step(s) follow it: ` +
              `${after.map((s) => `"${s?.name ?? "(unnamed)"}"`).join(", ")}. ` +
              `A job stops at its first failing step, so those do not run while it is red.`,
          });
        }
      }
    });
  }

  for (const gate of declared) {
    if (report.located.some((l) => l.script === gate.script)) continue;
    report.findings.push({
      script: gate.script,
      kind: "absent",
      message:
        `\`${gate.script}\` is declared as red-by-decision but appears in no step of any job. ` +
        `Either it was renamed — update DELIBERATELY_RED — or it is no longer run at all, ` +
        `which is bean \`ot9a\`'s defect and worse than the masking this file guards.`,
    });
  }

  return report;
}

/**
 * Why this gate has nothing to judge in `repoRoot`, or null when it does.
 *
 * Its whole subject is {@link WORKFLOW}, the HARNESS's gates workflow. A
 * CONTENT root (`rootProfile`, the generic rule: no such file at the root) runs
 * the shared `layer-pr-checks.yml` instead and declares no deliberately-red
 * placement, so the file's absence there is not a renamed workflow but one this
 * root never had (cat-harness-tools#1701; smart-ips-pilgrimage#13 read it as
 * ENOENT). A harness root carries the file by definition and is judged as before.
 */
export function notApplicableHere(repoRoot: string): string | null {
  return rootProfile(repoRoot) === "content"
    ? `${GATES_WORKFLOW} is absent at the root, so this is a content root ` +
        "(its CI is the shared layer-pr-checks.yml); the deliberately-red placement is the harness gates workflow's, not this root's"
    : null;
}

if (import.meta.main) {
  const na = notApplicableHere(REPO_ROOT);
  if (na !== null) exitNotApplicable("check:red-gate-is-last", na);
  const doc = parse(readFileSync(WORKFLOW, "utf-8"));
  const report = redGateIsLast(doc);

  if (report.jobs === 0 || report.steps === 0) {
    console.error(
      `Parsed ${WORKFLOW} and found ${report.jobs} job(s) and ${report.steps} step(s) — ` +
        "refusing to call that clean. A workflow with no steps means the parse or the path " +
        "is wrong, not that the ordering is right.",
    );
    process.exit(2);
  }

  console.log(
    `Deliberate-red placement — ${report.jobs} job(s), ${report.steps} step(s), ` +
      `${DELIBERATELY_RED.length} gate(s) declared red by decision`,
  );
  for (const l of report.located) {
    console.log(`  ${l.script}  → job \`${l.job}\`, step ${l.index + 1} of ${l.of}`);
  }

  if (report.findings.length === 0) {
    console.log("  ✓ each is the last step of its job, so the set it masks is empty");
    process.exit(0);
  }

  console.error(`\n✗ ${report.findings.length} placement finding(s):`);
  for (const f of report.findings) console.error(`  [${f.kind}] ${f.message}`);
  console.error(
    "\nA gate that may be red by decision belongs LAST in its job, in a step of its own.\n" +
      "Move the step, or move whatever was appended after it. Bean `cpss` records what the\n" +
      "masked region cost: 104 gates unreachable, 18 of them with nothing else watching.",
  );
  process.exit(1);
}
