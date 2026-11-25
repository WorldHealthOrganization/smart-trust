#!/usr/bin/env bun
/**
 * check-publishable.ts — a census of which layers are publishable, plus
 * the two cross-instance rules a per-instance schema cannot see.
 *
 * Absence is a third state: a layer that has not declared `publishable`
 * is *undecided*, never *false*. The report prints three buckets and names
 * every undecided layer; an all-undecided repository is reported as such,
 * not as a pass.
 *
 * `CatHarnessDeclarationSchema` already refuses an `id`/`version`/`canonicalUrl`
 * that does not match the layer's `publishable` state, and a range version.
 * This adds the CROSS-INSTANCE rules:
 *
 * 1. **Two layers must not share an `id`.**
 * 2. **An unreadable declaration is a finding, not a skip.** Its
 *    publishability is unknown (a fact about this run), which is not
 *    undecided (a fact about the repository).
 *
 * @module scripts/check-publishable
 * @covers cat-harness
 */

import { relative, resolve } from "node:path";

import {
  type CatHarnessDeclaration,
  instanceRootFor,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
} from "../schemas/kg/cat-harness.js";

/**
 * The publication state. `unknown` is about THIS RUN, not about the layer.
 *
 * `draft` is the only state a declaration can be in today — `"published"`
 * fails to PARSE, so it can never appear here. `unknown` means this run could
 * not read the declaration, which is a different fact and stays separate:
 * "everything is draft" and "we could not look" must not render alike.
 */
export type Publishability = "draft" | "unknown";

export interface InstanceRow {
  /** Repo-relative layer root, `.` for the repository root itself. */
  where: string;
  /** The declared `name`, or the directory when the declaration was unreadable. */
  name: string;
  state: Publishability;
  id?: string;
  version?: string;
  canonicalUrl?: string;
  /** Why the state is `unknown`, when it is. Never left to be inferred. */
  problem?: string;
}

export interface PublishableFinding {
  severity: "major" | "minor";
  where: string;
  detail: string;
}

export interface PublishableReport {
  rows: InstanceRow[];
  findings: PublishableFinding[];
}

/**
 * The publication state, which today is `draft` for everything.
 *
 * Absent means `draft` — the field exists to reserve the axis, not to be
 * typed out 17 times. `"published"` cannot reach here: it fails to PARSE, so
 * a declaration claiming it never becomes a `CatHarnessDeclaration` at all.
 * `skills/kg/kg-core/instance-publication.md`.
 */
function stateOf(d: CatHarnessDeclaration): Publishability {
  return d.publication?.state ?? "draft";
}

export function auditPublishable(repoRoot: string): PublishableReport {
  const rows: InstanceRow[] = [];
  const findings: PublishableFinding[] = [];

  for (const root of layerRootsIn(repoRoot)) {
    const where = relative(repoRoot, root) || ".";
    let decl: CatHarnessDeclaration | undefined;
    try {
      decl = readDeclaration(root);
    } catch (error) {
      rows.push({ where, name: where, state: "unknown", problem: String(error).slice(0, 200) });
      findings.push({
        severity: "major",
        where,
        detail: "declaration did not parse — its publishability is UNKNOWN, which is not the same as undecided",
      });
      continue;
    }
    // `undefined` is "this root declares no instance", which `layerRootsIn`
    // should not have returned — reported rather than dropped, for the same
    // reason as the parse failure above.
    if (decl === undefined) {
      rows.push({ where, name: where, state: "unknown", problem: "no declaration found at an instance root" });
      findings.push({
        severity: "major",
        where,
        detail: "listed as an instance root but carries no declaration — this run could not determine its publishability",
      });
      continue;
    }
    rows.push({
      where,
      name: decl.name,
      state: stateOf(decl),
      id: decl.id,
      version: decl.version,
      canonicalUrl: decl.canonicalUrl,
    });

    // THIS GATE IS WHAT MAKES "every asset carries a version" TRUE.
    //
    // The schema deliberately does not require it — doing so breaks 376
    // fixtures across 20+ files, and a sweep that size hides a real regression
    // among the noise. So the type permits absence and this refuses it, which
    // delivers the same property with a legible failure: the layer is
    // NAMED, rather than a parse error somewhere in a test fixture.
    //
    // `major` rather than `minor`: a layer with no version cannot be
    // scored by `check:version-bump`, which skips it — so an unversioned
    // layer is invisible to the machinery that exists to watch versions.
    if (decl.version === undefined) {
      findings.push({
        severity: "major",
        where,
        detail:
          `\`${decl.name}\` declares no \`version\`. Every asset carries one ` +
          "(owner, 2026-09-23), and `check:version-bump` SKIPS an instance without one — " +
          "so this is not a cosmetic gap: it is an instance the version machinery cannot see",
      });
    }
  }

  // Cross-instance rule: an id is an identity, so it belongs to one layer.
  const byId = new Map<string, InstanceRow[]>();
  for (const row of rows) {
    if (row.id === undefined) continue;
    const list = byId.get(row.id) ?? [];
    list.push(row);
    byId.set(row.id, list);
  }
  for (const [id, list] of byId) {
    if (list.length < 2) continue;
    findings.push({
      severity: "major",
      where: list.map((r) => r.where).join(", "),
      detail: `${list.length} instances declare the id \`${id}\` — an id is the identity a consumer resolves, and two of them is two packages answering to one name`,
    });
  }

  return { rows, findings };
}

export function formatReport(report: PublishableReport): string {
  const { rows, findings } = report;
  const count = (s: Publishability) => rows.filter((r) => r.state === s).length;
  const out: string[] = [
    "Publication state — every asset carries an id and a version, and sits in DRAFT",
    "(skills/kg/kg-core/instance-publication.md)",
    "",
  ];

  for (const row of rows) {
    const mark = { draft: "◐", unknown: "✗" }[row.state];
    // The identity is printed for EVERY row now, because every layer has
    // one. Under the old model it was printed only for the published, which
    // made an id look like a badge rather than a fact.
    const identity =
      row.problem !== undefined ? `  ${row.problem}` : `  ${row.id ?? "(no id)"} @ ${row.version ?? "(no version)"}`;
    out.push(`  ${mark} ${row.where.padEnd(24)} ${row.name.padEnd(22)} ${row.state}${identity}`);
  }

  out.push("");
  out.push(`${rows.length} instance(s): ${count("draft")} draft, ${count("unknown")} unknown.`);

  if (count("unknown") > 0) {
    out.push("");
    out.push(
      "UNKNOWN is not draft. Draft is a fact about the repository; unknown is a fact about THIS RUN — " +
        "those instances were not assessed at all, and a report that rendered them as draft would be claiming " +
        "something it never looked at.",
    );
  }

  if (count("draft") === rows.length && rows.length > 0) {
    out.push("");
    out.push("EVERY INSTANCE IS DRAFT, and that is now a DECIDED state rather than a worklist.");
    out.push(
      "§6 Q1 is ANSWERED (owner, 2026-09-23): all assets carry a version and sit in draft, and formal publication " +
        "is a process that needs defining, tooling, and a per-instance answer. Nothing here is awaiting a decision; " +
        "it is awaiting that process. IDS ARE HELD — every row prints `(no id)` on purpose, pending the " +
        "ONE-reference design (bean `iwtn`): a namespace written into 17 declarations is 17 places to change, " +
        "which is what the owner ruled against.",
    );
  }

  if (findings.length > 0) {
    out.push("");
    for (const f of findings) {
      out.push(`  ✗ ${f.where}`);
      out.push(`    ${f.detail}`);
    }
  }
  out.push("");
  out.push(
    `${findings.length} finding(s), ${findings.filter((f) => f.severity === "major").length} major. ` +
      "`publication.state` accepts only `draft` and no range version parses — enforced by the SCHEMA, because a " +
      "refusal that parses cannot be switched off the way a gate can. The VERSION requirement is the other way " +
      "round and lives here: requiring it in the type breaks 376 fixtures, so this gate is what fails an instance " +
      "without one.",
  );
  return out.join("\n");
}

if (import.meta.main) {
  const repoRoot = resolve(repoRootFor(instanceRootFor(import.meta.dir)));
  const report = auditPublishable(repoRoot);
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));

  // ADVISORY by default, matching `check:published-refs` and for the same
  // reason: the scheme is a proposal, so its findings are a worklist before
  // they are a contract. The census is never a failure — being undecided is
  // legal, and a gate that failed on it would force a guess, which is the one
  // thing §6 Q1 asks nobody to do.
  if (process.argv.includes("--strict") && report.findings.length > 0) process.exit(1);
  process.exit(0);
}
