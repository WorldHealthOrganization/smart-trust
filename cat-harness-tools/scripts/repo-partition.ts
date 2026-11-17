#!/usr/bin/env bun
/**
 * Repo partition — an import-graph partition of this layer's modules into
 * the five proposed repositories. Answers two questions:
 *
 *   1. Which modules would land in each of the five proposed repositories?
 *   2. Which import edges cross a proposed boundary IN THE WRONG DIRECTION?
 *
 * Every entry in the answer to question 2 is a module that must move, a
 * dependency that must invert, or a documented exception.
 *
 * ## BOTH QUESTIONS ARE ASKED WITHIN ONE LAYER
 *
 * `ROOT` is this layer, and `SCAN_ROOTS` are relative to it, so question 2
 * is "which edges cross a proposed boundary **among this instance's own
 * modules**". It is silent about imports between layers that already exist
 * side by side in the checkout, and the report says so in its own output.
 *
 * The cross-instance axis belongs to `kg:detangle:direction` (blocking in
 * CI), where a node's layer is the layer it lives in: this one partitions
 * a future layout by path rule, that one checks a present layout against
 * declared `needs`.
 *
 * ## Three states, not two
 *
 * A module this tool cannot classify is reported as `unassigned`, never
 * silently bucketed into core: "could not determine" is a distinct answer
 * from "determined to be core".
 *
 * Every assignment carries its provenance:
 *
 *   - `rule`    — an explicit path rule. Trustworthy.
 *   - `triage`  — a per-file judgement someone made by hand: does this read
 *                 or write PLATFORM, or CONTENT? Recorded separately from
 *                 `rule` so a decision stays visible as a decision.
 *   - `keyword` — a domain keyword in the path. Probable, worth a human look.
 *   - `default` — fell through to core because nothing else claimed it.
 *                 This is the weakest signal in the report and is counted
 *                 separately so it cannot be mistaken for evidence.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/repo-partition.ts                 # summary to stdout
 *   bun run cat-harness-tools/scripts/repo-partition.ts --edges         # + every cross-edge
 *   bun run cat-harness-tools/scripts/repo-partition.ts --markdown      # report as Markdown
 *   bun run cat-harness-tools/scripts/repo-partition.ts --repo sci      # one repo's modules
 *   bun run cat-harness-tools/scripts/repo-partition.ts --strict        # exit 1 if cross-edges
 *
 * @module scripts/repo-partition
 * @covers code — every module and every edge between them; a module it cannot classify is
 *   `unassigned` and a finding
 */

import { existsSync } from "fs";
import { basename, join } from "path";
import { SPEC, REPOS, ROOT, SCAN_ROOTS } from "./partition/instance-rules.js";
import {
  analyse as analyseWith,
  classify as classifyWith,
  UNASSIGNED,
  type Assignment,
  type CrossEdge,
  type PartitionReport,
  type Provenance,
} from "./partition/engine.js";

// ── The CLI, and nothing else ───────────────────────────────────
//
// This file was 1,194 lines: the algorithm, this layer's 272 lines of
// exception data, and 532 lines of rationale for that data, in one module.
// The algorithm is now `partition/engine.ts` and takes a spec; the data is
// `partition/instance-rules.ts` and keeps every comment, positioned where it
// was. What is left here is argument handling and the report — the two parts
// that are genuinely about running the tool from a terminal.
//
// `classify` and `analyse` are re-exported at their old names and old arity,
// bound to this layer's spec. Nothing imports them today (the partition
// tool is standalone; every other mention of it in the tree is prose), but
// the gate is invoked by name from CI and by hand constantly, and a rename
// nobody needed is a rename that costs somebody a confused minute.

/** Classify one repo-relative path against THIS layer's rules. */
export function classify(relPath: string): Assignment {
  return classifyWith(SPEC, relPath);
}

/** Analyse THIS layer. */
export function analyse(): PartitionReport {
  return analyseWith(SPEC);
}

export type { Assignment, CrossEdge, PartitionReport, Provenance };
// ── Reporting ───────────────────────────────────────────────────

function repoName(id: string): string {
  return REPOS.find((r) => r.id === id)?.name ?? UNASSIGNED;
}

function main(): void {
  const args = process.argv.slice(2);
  const wantEdges = args.includes("--edges");
  const markdown = args.includes("--markdown");
  const strict = args.includes("--strict");
  const only = args[args.indexOf("--repo") + 1];

  const { modules, crossEdges, unresolvedEdges, totalEdges } = analyse();

  if (modules.size === 0) {
    console.error("repo-partition: scanned 0 modules — wrong root, or the tree moved.");
    process.exit(2);
  }

  if (only && args.includes("--repo")) {
    for (const [path, a] of [...modules].sort()) {
      if (a.repo === only) console.log(`${a.provenance.padEnd(8)} ${path}`);
    }
    return;
  }

  const H = markdown ? "## " : "";
  const counts = new Map<string, Record<Provenance, number>>();
  for (const [, a] of modules) {
    const key = a.repo;
    const c = counts.get(key) ?? { rule: 0, triage: 0, keyword: 0, default: 0 };
    c[a.provenance]++;
    counts.set(key, c);
  }

  console.log(`${H}Partition — ${modules.size} modules, ${totalEdges} internal import edges\n`);
  if (markdown) console.log("| repo | modules | by rule | hand-triaged | by keyword | fell through |\n|---|---:|---:|---:|---:|---:|");
  for (const id of [...REPOS.map((r) => r.id), "unassigned" as const]) {
    const c = counts.get(id) ?? { rule: 0, triage: 0, keyword: 0, default: 0 };
    const total = c.rule + c.triage + c.keyword + c.default;
    if (markdown) console.log(`| \`${repoName(id)}\` | ${total} | ${c.rule} | ${c.triage} | ${c.keyword} | ${c.default} |`);
    else console.log(`  ${repoName(id).padEnd(20)} ${String(total).padStart(4)}  (rule ${c.rule}, triage ${c.triage}, keyword ${c.keyword}, unclaimed ${c.default})`);
  }

  // ── SCOPE, printed WITH the number rather than assumed by the reader.
  //
  // Bean `p11x`. This tool's ROOT is ONE layer, so every wrong-direction
  // count it has ever printed is scoped to that layer's own modules and is
  // silent about edges between already-extracted siblings. A PR citing the
  // bare number therefore made an over-broad claim, which had to be corrected
  // by comment on #1465 — and the bean's own line is that the fix belongs
  // here rather than in per-PR prose.
  //
  // The owner ruled Option 2 (2026-09-30): this tool STAYS instance-scoped
  // and `kg:detangle` owns the cross-instance axis. Option 3 — print the
  // scope — was NOT the option chosen, and its substance comes along anyway
  // because the two are not alternatives any more. Option 3 was rejected as
  // a fix-substitute: it "stops the over-broad read without making anything
  // visible". Under Option 2 something IS visible, so the same print line
  // stops standing in for a fix and becomes the pointer TO one.
  //
  // It goes further than Option 3 asked, deliberately. A bare
  // `(scope: cat-harness/)` tells a reader the number is narrower than it
  // looks and leaves them to find the wide one; naming the check that owns
  // the other question ROUTES them instead. A reader who knows a number is
  // incomplete and cannot find its complement is not much better off than
  // one who never doubted it.
  //
  // DERIVED from `ROOT` and `SCAN_ROOTS`, never spelled out: this layer's
  // name is exactly the thing the bean recorded as wrong to assume, and a
  // literal here would go stale on the next relocation while still reading
  // as authoritative.
  const scopeLabel = `${basename(ROOT)}/{${SCAN_ROOTS.join(",")}}`;
  console.log(`\n${H}Wrong-direction edges within ${scopeLabel}: ${crossEdges.length}\n`);
  console.log(
    `${markdown ? "> " : "  "}SCOPE: one instance. This count is over modules under \`${basename(ROOT)}/\` only,\n` +
      `${markdown ? "> " : "  "}bucketed into the five PROPOSED repos by path rule. It says nothing about imports\n` +
      `${markdown ? "> " : "  "}between instances that already exist side by side in this checkout.\n` +
      `${markdown ? "> " : "  "}The CROSS-INSTANCE axis is \`bun run cat kg:detangle:direction\`, which is blocking in CI.\n` +
      `${markdown ? "> " : "  "}Do not cite this number as "0 wrong-direction edges" without the scope (bean p11x).\n`,
  );
  if (crossEdges.length > 0) {
    const byPair = new Map<string, CrossEdge[]>();
    for (const e of crossEdges) {
      const k = `${e.fromRepo}->${e.toRepo}`;
      byPair.set(k, [...(byPair.get(k) ?? []), e]);
    }
    if (markdown) console.log("| importer repo | imports from | edges |\n|---|---|---:|");
    for (const [pair, es] of [...byPair].sort((a, b) => b[1].length - a[1].length)) {
      const [f, t] = pair.split("->") as [string, string];
      if (markdown) console.log(`| \`${repoName(f)}\` | \`${repoName(t)}\` | ${es.length} |`);
      else console.log(`  ${repoName(f)} → ${repoName(t)}: ${es.length}`);
    }
    if (wantEdges) {
      const un = [...new Set(unresolvedEdges.flatMap((e) => [e.from, e.to]))]
        .filter((m) => modules.get(m)?.repo === "unassigned")
        .sort();
      if (un.length) console.log(`\n${markdown ? "### " : ""}Unassigned modules\n${un.map((m) => `  ${m}`).join("\n")}`);
      console.log(`\n${markdown ? "### " : ""}Every wrong-direction edge\n`);
      for (const e of crossEdges.sort((a, b) => a.from.localeCompare(b.from))) {
        console.log(`${markdown ? "- " : "  "}\`${e.from}\` (${repoName(e.fromRepo)}) → \`${e.to}\` (${repoName(e.toRepo)})`);
      }
    }
  }

  console.log(`\n${H}Edges touching an unassigned module: ${unresolvedEdges.length}`);
  console.log("These are not cross-edges — they are edges this tool declined to judge.");
  console.log("Classify the endpoints, then re-run; do not read them as clean.");

  // ── What this gate ENFORCES. Both axes, as of 2026-09-20.
  //
  // `check:partition` ran in CI WITHOUT `--strict`, so its only failing path
  // was one nothing invoked: it reported 8 wrong-direction edges and exited 0
  // while the board read 43/43, and three of those edges had been introduced
  // that morning. A gate that CANNOT fail is indistinguishable, from the
  // outside, from one that passed — bean `xom7`, one level up from the
  // workflow it was written about.
  //
  // The repository's precedent for switching a reporter into an enforcer is
  // the ruff comment in `code-quality-gates.yml`: **a check is an error only
  // once its count is zero.** Turning a red gate on just teaches the next
  // agent to append `|| true`.
  //
  // So it was applied per axis as each reached zero. Unassigned reached zero
  // first (bean `4j3h`) and was enforced then; the comment there said to
  // delete the distinction once the edges followed. They have — `jcmx`
  // retired the last one, `src/types.ts -> schemas/types.ts`, by declaring
  // the structural minimum a harness signature needs instead of importing
  // the content model. Both axes are now zero and both are enforced.
  //
  // `--strict` is kept as an accepted no-op so existing invocations do not
  // break; there is no longer a laxer mode for it to select.
  //
  // ── BOTH AXES ARE ZERO AND ENFORCED WITHIN ONE LAYER, and that is not
  // the same sentence as "the layering holds". Bean `p11x`, corrected
  // 2026-09-30 on the owner's Option 2 ruling.
  //
  // The paragraph above was read — here, in the migration plan, and on at
  // least one PR — as discharging Phase I.1, whose gate is "the cross-edge
  // list is empty or every survivor has a written reason". It does not,
  // because `ROOT` is this layer and the scan never leaves it. `bf5l`
  // measured the gap rather than arguing it: with a real wrong-direction
  // import in place (`cat-harness/schemas/library/intake.ts` importing
  // `folio-assistant-core`), `check:instance-graph` said no cycle, THIS TOOL
  // said 0, and `kg:detangle` said 1. Three green checks did not mean the
  // layering held.
  //
  // So I.1's gate is now BOTH this tool and `kg:detangle:direction`, which is
  // blocking in CI and whose node layer IS the layer. Neither discharges
  // I.1 alone; they answer different questions and are not each other's
  // second opinion. Option 1 — widening `ROOT`/`SCAN_ROOTS` to the checkout —
  // was considered and NOT taken: the path rules here are written against
  // instance-relative paths, so it would have meant a large reclassification
  // across ~17 layers to reach a fact another tool already reports.
  const unassigned = [...modules].filter(([, a]) => a.repo === "unassigned").map(([m]) => m);
  let failed = false;
  if (unassigned.length > 0) {
    failed = true;
    console.error(`\n\u2717 ${unassigned.length} module(s) fell through every rule:`);
    for (const m of unassigned.sort()) console.error(`    ${m}`);
    console.error("    Classify each in REPO_RULES. An unassigned module is not a clean result.");
  }
  // ── A RULE NAMING A FILE THAT IS NOT THERE is a dead rule (bean `70lx`).
  //
  // An `exact` entry classifies one path; when that file moves out of this
  // layer it matches nothing, forever, and nothing said so — 117 had piled
  // up by 2026-10-04, one per file each 70lx batch moved to
  // `cat-harness-tools`. A dead entry is not harmless: it reads as a ruling
  // about a file this tool no longer scans, and the next reader trusts it.
  // Prefix and keyword rules are not judged: they name a shape, not a file.
  const deadRules = SPEC.rules
    .flatMap((r) => r.exact ?? [])
    .filter((p) => !existsSync(join(ROOT, p)))
    .sort();
  if (deadRules.length > 0) {
    failed = true;
    console.error(`\n\u2717 ${deadRules.length} exact rule(s) name a file that is not in \`${basename(ROOT)}/\`:`);
    for (const p of deadRules) console.error(`    ${p}`);
    console.error("    Remove each from partition/instance-rules.ts — a moved file is classified where it now lives.");
  }
  if (crossEdges.length > 0) {
    failed = true;
    console.error(`\n\u2717 ${crossEdges.length} wrong-direction edge(s):`);
    for (const e of crossEdges) {
      console.error(`    ${e.from} [${repoName(e.fromRepo)}] -> ${e.to} [${repoName(e.toRepo)}]`);
    }
    console.error(
      "    A repo may not import one that depends on it. Either the CLASSIFICATION is wrong —" +
        "\n    check the target's layer before the importer's — or the import is." +
        `\n    Scope: modules under \`${basename(ROOT)}/\` bucketed into the five PROPOSED repos. The` +
        "\n    CROSS-INSTANCE axis is a different question — `bun run cat kg:detangle:direction`.",
    );
  }
  if (failed) process.exit(1);
  void strict;
}

if (import.meta.main) main();
