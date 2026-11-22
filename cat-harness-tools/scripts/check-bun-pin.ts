/**
 * Every workflow installs the SAME Bun, and `.bun-version` says which.
 *
 * `.bun-version` is the one answer to "what are we running"; the
 * `setup-bun` sites in the workflows are copies, and this gate forbids them
 * from disagreeing. Without it, `pinnedIn: ../.bun-version` would point at a
 * file no build consults.
 *
 * ## Why explicit literals, not `setup-bun` reading `.bun-version`
 *
 * Whether the action reads `.bun-version` cannot be verified from the
 * repository, and if it did not, every site would fall back to a default
 * while this gate stayed green over absent literals. Explicit literals are
 * checkable from the repository alone.
 *
 * ## What the pin is for
 *
 * `engine_version` in a QA script sidecar is `bun-${Bun.version}`, and
 * `saveQaScriptSidecar` treats it as a SUBSTANTIVE field, since a verdict
 * produced by a different engine is a different verdict. With an unpinned
 * runtime that field records whoever ran last, so sidecars churn and
 * `bun run cat gates`' tree-mutation detector is never clean.
 *
 * Usage:
 *   bun run cat check:bun-pin
 *
 * @covers none — .github/workflows/ is not a declared graph typology
 * @graphNode tool
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
/** The ONE answer to which Bun this repository runs. Exported so `check:bun-runtime`
 *  names the same file rather than repeating the literal. */
export const PIN_FILE = "cat-harness/.bun-version";
const WORKFLOW_DIR = join(REPO_ROOT, ".github", "workflows");

export interface Finding {
  workflow: string;
  job: string;
  step: string;
  /** `unpinned` — no `bun-version` at all · `disagrees` — a different version. */
  kind: "unpinned" | "disagrees";
  found?: string;
}

export interface Report {
  /** The literal `.bun-version` holds, when it could be read. */
  expected?: string;
  workflows: number;
  /** `setup-bun` steps seen, so a scan that matched nothing cannot read clean. */
  sites: number;
  findings: Finding[];
  /**
   * Reusable workflows called from another repository whose file is not in
   * this checkout. Their `setup-bun` steps are judged by this gate where they
   * live, so a site whose jobs only call them has delegated the pin rather
   * than dropped it. Named, so the hand-off is visible rather than silent.
   */
  delegated?: string[];
}

/** The version in `.bun-version`: one bare `X.Y.Z`, nothing else. */
export function readPinFile(text: string): string | undefined {
  const m = /^(\d+\.\d+\.\d+)\s*$/m.exec(text);
  return m?.[1];
}

interface Step {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

/**
 * Judge one parsed workflow.
 *
 * Takes the parsed document so the tests can build a disagreement rather than
 * describe one — this gate's whole value is that it fails, and a gate that can
 * only be pointed at a correct repository has never been shown to.
 */
export function auditWorkflow(name: string, doc: unknown, expected: string): Omit<Report, "expected" | "workflows"> {
  const findings: Finding[] = [];
  let sites = 0;
  const jobs = (doc as { jobs?: Record<string, { steps?: Step[] }> } | null)?.jobs ?? {};
  for (const [job, def] of Object.entries(jobs)) {
    const steps = Array.isArray(def?.steps) ? def.steps : [];
    steps.forEach((step, i) => {
      if (typeof step?.uses !== "string" || !step.uses.includes("oven-sh/setup-bun")) return;
      sites++;
      const label = step.name ?? `step ${i + 1}`;
      const found = step.with?.["bun-version"];
      if (found === undefined) {
        findings.push({ workflow: name, job, step: label, kind: "unpinned" });
        return;
      }
      // YAML may give a number for `1.3` or a string for `1.3.14`; compare as
      // written, because `bun-version: 1.3` is a DIFFERENT request to the action
      // than `1.3.14` and must not be normalised into agreement.
      const asText = String(found);
      if (asText !== expected) {
        findings.push({ workflow: name, job, step: label, kind: "disagrees", found: asText });
      }
    });
  }
  return { sites, findings };
}

export function bunPin(repoRoot: string = REPO_ROOT): Report {
  const pinPath = join(repoRoot, PIN_FILE);
  const expected = existsSync(pinPath) ? readPinFile(readFileSync(pinPath, "utf-8")) : undefined;
  const report: Report = { expected, workflows: 0, sites: 0, findings: [] };
  if (expected === undefined) return report;

  const dir = join(repoRoot, ".github", "workflows");
  if (!existsSync(dir)) return report;
  const delegated = new Set<string>();
  const audited = new Set<string>();
  const audit = (label: string, path: string): void => {
    if (audited.has(path)) return;
    audited.add(path);
    report.workflows++;
    const doc = parse(readFileSync(path, "utf-8"));
    const one = auditWorkflow(label, doc, expected);
    report.sites += one.sites;
    report.findings.push(...one.findings);
    // A job that calls a reusable workflow installs Bun THERE. Follow it when
    // its file is in this checkout (a mounted layer keeps its .github/), and
    // otherwise name it as delegated.
    for (const call of reusableCalls(doc)) {
      const target = resolveReusable(repoRoot, call);
      if (target === "local") continue;
      if (target) audit(`${target.label}`, target.path);
      else delegated.add(call);
    }
  };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort()) {
    audit(f, join(dir, f));
  }
  if (delegated.size > 0) report.delegated = [...delegated].sort();
  return report;
}

/** The job-level `uses:` of a workflow: the reusable workflows its jobs call. */
export function reusableCalls(doc: unknown): string[] {
  const jobs = (doc as { jobs?: Record<string, { uses?: unknown }> } | null)?.jobs ?? {};
  return Object.values(jobs)
    .map((j) => j?.uses)
    .filter((u): u is string => typeof u === "string");
}

/**
 * Where a reusable-workflow call's file is in this checkout.
 *
 * `./.github/workflows/x.yml` is one of this repository's own files, which the
 * scan reads anyway (`"local"`). `owner/repo/.github/workflows/x.yml@ref` is
 * found at `<repo>/.github/workflows/x.yml` when that repository is mounted
 * here as a layer; otherwise `undefined`, which the caller reports as
 * delegated. The mounted copy is the pinned one, which is the one CI calls
 * when the site's caller names the same pin.
 */
export function resolveReusable(repoRoot: string, call: string): "local" | { label: string; path: string } | undefined {
  if (call.startsWith("./")) return "local";
  const m = /^[^/]+\/([^/]+)\/(\.github\/workflows\/[^@]+)@/.exec(call);
  if (!m) return undefined;
  const path = join(repoRoot, m[1]!, m[2]!);
  return existsSync(path) ? { label: `${m[1]}/${m[2]}`, path } : undefined;
}

if (import.meta.main) {
  const report = bunPin();

  if (report.expected === undefined) {
    console.error(
      `${PIN_FILE} does not hold a bare X.Y.Z version. It is the ONE answer to which Bun this ` +
        `repository runs — \`upstream-pins.json\` reads it as the \`bun\` pin and every workflow ` +
        `literal is checked against it — so an unreadable one is a blocker, not a default.`,
    );
    process.exit(2);
  }
  if (report.sites === 0 && (report.delegated?.length ?? 0) > 0) {
    console.log(
      `Bun pin — ${PIN_FILE} says ${report.expected}; ${report.workflows} workflow(s) install no Bun ` +
        `themselves. Their jobs call ${report.delegated!.length} reusable workflow(s) that are not in ` +
        `this checkout, and this gate judges their \`setup-bun\` steps in the repository that holds them:`,
    );
    for (const d of report.delegated!) console.log(`  → ${d}`);
    console.log("  ✓ no Bun is installed here, so no pin can disagree here");
    process.exit(0);
  }
  if (report.sites === 0) {
    console.error(
      `Scanned ${report.workflows} workflow(s) under ${WORKFLOW_DIR} and found no ` +
        `\`oven-sh/setup-bun\` step — refusing to call that clean. Either the action was replaced, ` +
        `in which case this gate needs to follow it, or the scan is looking in the wrong place.`,
    );
    process.exit(2);
  }

  console.log(
    `Bun pin — ${PIN_FILE} says ${report.expected}; ${report.sites} setup-bun site(s) ` +
      `across ${report.workflows} workflow(s)`,
  );
  if (report.findings.length === 0) {
    console.log("  ✓ every site installs it, so `engine_version` is the same wherever CI runs");
    process.exit(0);
  }

  console.error(`\n✗ ${report.findings.length} site(s) do not install ${report.expected}:`);
  for (const f of report.findings) {
    const what = f.kind === "unpinned" ? "no `bun-version`" : `\`bun-version: ${f.found}\``;
    console.error(`  ${f.workflow}  job \`${f.job}\`  "${f.step}"  — ${what}`);
  }
  console.error(
    `\nSet \`bun-version: ${report.expected}\` on each, or change ${PIN_FILE} and every site together.\n` +
      `Adopting a NEWER Bun is not this gate's to wave through: it is the ` +
      `\`upstream-version-adoption\` process, whose accepting step is a person.`,
  );
  process.exit(1);
}
