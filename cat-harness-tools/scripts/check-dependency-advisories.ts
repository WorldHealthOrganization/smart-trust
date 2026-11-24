/**
 * Is anything we depend on KNOWN-VULNERABLE?
 *
 * A committed `bun.lock` makes the tree reproducible; it does not say whether
 * anything in it is known-vulnerable. Currency is not validity: this step
 * asks the second question.
 *
 * ## WARN-ONLY
 *
 * A hard gate would let a **transitive** advisory you cannot patch turn
 * every PR red until somebody adds a suppression, and suppressions rot. So
 * this reports on every PR and blocks nothing. Dependabot
 * (`.github/dependabot.yml`) is the other half: it turns the same advisories
 * into reviewable PRs.
 *
 * ## Three states, which an exit code alone cannot carry
 *
 * | state | meaning | printed as |
 * |---|---|---|
 * | `clean` | the audit RAN and found nothing | `✓ …` |
 * | `advisories` | the audit ran and found something | `::warning::` per advisory |
 * | `undetermined` | the audit did not produce an answer | `::warning::` + **never** `✓` |
 *
 * **`undetermined` is never rendered as clean** — the rule `check:ci-health`
 * and `bun run cat health` follow, and the reason this is a script rather
 * than YAML with `|| true`.
 *
 * ## What this gate does NOT claim
 *
 * It does not claim the tree is safe. It claims an advisory database was
 * consulted on this commit and reports what it said. An advisory that is not
 * yet published is not an advisory this can see, and a clean run is evidence
 * about the database, not about the code.
 *
 * @module folio-assistant/scripts/check-dependency-advisories
 * @covers code
 */

/** One advisory, reduced to what a reader needs to act. */
export interface Advisory {
  package: string;
  severity: string;
  title: string;
  url?: string;
}

/** The three states. `undetermined` carries WHY, and may not be empty. */
export type AuditVerdict =
  | { state: "clean"; scanned: number }
  | { state: "advisories"; advisories: Advisory[] }
  | { state: "undetermined"; reason: string };

const SEVERITY_ORDER = ["critical", "high", "moderate", "low", "info"];

/** Sort worst-first, then by package, so the report is stable across runs. */
export function sortAdvisories(list: readonly Advisory[]): Advisory[] {
  return [...list].sort((a, b) => {
    const rank = (s: string) => {
      const i = SEVERITY_ORDER.indexOf(String(s).toLowerCase());
      return i === -1 ? SEVERITY_ORDER.length : i;
    };
    return rank(a.severity) - rank(b.severity) || a.package.localeCompare(b.package);
  });
}

/**
 * Turn `bun audit --json` output into a verdict.
 *
 * Kept pure and separate from running the command so the states can be tested
 * without a registry. The parser is deliberately strict about ONE thing: text
 * it cannot parse is `undetermined`, never `clean`. An empty object is bun's
 * "no vulnerabilities" shape and IS an answer; empty *text* is not.
 */
export function verdictFromAuditJson(stdout: string, scanned: number): AuditVerdict {
  const text = stdout.trim();
  if (text === "") return { state: "undetermined", reason: "`bun audit --json` produced no output" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { state: "undetermined", reason: `\`bun audit --json\` output did not parse: ${why}` };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { state: "undetermined", reason: "`bun audit --json` output was not a JSON object" };
  }

  // bun reports `{}` for a clean tree, and otherwise an object keyed by
  // package name whose values are arrays of advisory records.
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return { state: "clean", scanned };

  const advisories: Advisory[] = [];
  for (const [pkg, value] of entries) {
    for (const raw of Array.isArray(value) ? value : [value]) {
      const a = (raw ?? {}) as Record<string, unknown>;
      advisories.push({
        package: pkg,
        severity: typeof a.severity === "string" ? a.severity : "unknown",
        title: typeof a.title === "string" ? a.title : "(no title given)",
        url: typeof a.url === "string" ? a.url : undefined,
      });
    }
  }

  // An object with keys but no advisory we could read is NOT clean: bun said
  // something and we failed to understand it. Saying "✓" here would be the
  // `dh4f` shape — reporting a clean run over what was never examined.
  if (advisories.length === 0) {
    return { state: "undetermined", reason: "`bun audit --json` reported packages but no readable advisories" };
  }
  return { state: "advisories", advisories: sortAdvisories(advisories) };
}

/** Render a verdict. Returns the lines; the caller prints. Never returns `✓` for `undetermined`. */
export function renderVerdict(v: AuditVerdict): string[] {
  if (v.state === "clean") {
    return [`  ✓ advisory database consulted — no known vulnerability across ${v.scanned} resolved package(s)`];
  }
  if (v.state === "undetermined") {
    return [
      `::warning::dependency advisories UNDETERMINED — ${v.reason}`,
      `  ? UNDETERMINED — ${v.reason}`,
      "      This is not a clean run. Nothing was established about this tree.",
    ];
  }
  const out = [`  ! ${v.advisories.length} known advisory(ies) — reported, not blocking:`];
  for (const a of v.advisories) {
    out.push(`::warning::${a.severity} — ${a.package}: ${a.title}`);
    out.push(`      ${a.severity.padEnd(8)} ${a.package} — ${a.title}${a.url ? ` (${a.url})` : ""}`);
  }
  out.push("");
  out.push("  Advisory by design: a transitive advisory you cannot patch must not red every");
  out.push("  PR, because the suppression that follows is what rots. Dependabot opens the");
  out.push("  bumps; this step makes sure nobody has to go looking.");
  return out;
}

if (import.meta.main) {
  const { spawnSync } = await import("node:child_process");
  const { existsSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const parentRoot = join(import.meta.dir, "../..");
  const layerRoot = join(import.meta.dir, "..");
  const ROOT = existsSync(join(parentRoot, "bun.lock"))
    ? parentRoot
    : existsSync(join(layerRoot, "bun.lock"))
      ? layerRoot
      : parentRoot;

  let scanned = 0;
  try {
    // Package count is for the report only — a failure to read it must not
    // turn a real audit result into `undetermined`.
    const lock = readFileSync(join(ROOT, "bun.lock"), "utf-8");
    scanned = (lock.match(/^\s{4}"[^"]+":\s*\[/gm) ?? []).length;
  } catch {
    scanned = 0;
  }

  const run = spawnSync("bun", ["audit", "--json"], { cwd: ROOT, encoding: "utf-8", timeout: 180_000 });

  let verdict: AuditVerdict;
  if (run.error) {
    verdict = { state: "undetermined", reason: `could not run \`bun audit\`: ${run.error.message}` };
  } else if (run.status !== 0 && (run.stdout ?? "").trim() === "") {
    // bun exits non-zero WITH output when it finds advisories; non-zero with
    // NO output is the command itself failing, which is not a finding.
    verdict = {
      state: "undetermined",
      reason: `\`bun audit\` exited ${run.status} with no output: ${(run.stderr ?? "").trim().slice(0, 200)}`,
    };
  } else {
    verdict = verdictFromAuditJson(run.stdout ?? "", scanned);
  }

  console.log("Dependency advisories (warn-only — reports, never blocks)");
  for (const line of renderVerdict(verdict)) console.log(line);

  // Exit 0 in every state, including `undetermined`. The owner chose advisory,
  // and a step that blocks on a registry outage is the blocking gate they
  // declined. The three states are kept apart in the OUTPUT, which is where
  // the rule "could not determine is never rendered as clean" actually bites.
  process.exit(0);
}
