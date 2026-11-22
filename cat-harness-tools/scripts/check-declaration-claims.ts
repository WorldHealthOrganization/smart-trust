#!/usr/bin/env bun
/**
 * Every prose claim about which file declares a graph agrees with the files.
 *
 * The rule, and what it refuses to be keyed on, are in
 * `src/docs/declaration-claims.ts`.
 *
 * Usage: bun run cat check:declaration-claims [--json]
 *
 * @module folio-assistant/scripts/check-declaration-claims
 * @covers cat-harness
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { claimsIn, declaredGraphs, historicalPrefixes, type Claim } from "../src/docs/declaration-claims.js";

const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Not ours, or not text. Nothing to derive here. */
// input-site: inert #2542d3fb — names a build-output directory only to leave it out of a walk
const SKIP = new Set(["node_modules", ".git", "dist", "build"]);

function markdownFiles(root: string, skip: string[], dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const rel = `${relative(root, p).split("\\").join("/")}/`;
      if (skip.includes(rel)) continue;
      markdownFiles(root, skip, p, out);
    } else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

export interface ClaimReport {
  filesRead: number;
  graphsKnown: number;
  claims: Claim[];
  /** Entries in the baseline that no longer match — this file should shrink. */
  staleBaseline: string[];
}

/**
 * The known backlog, and the rule it runs under.
 *
 * Same contract as `bean-bodies-baseline.json` and `stale-paths-baseline.json`:
 * a NEW contradiction fails, the backlog is listed every run, and an entry that
 * stops matching is reported STALE so the file shrinks rather than fossilises.
 */
interface Baseline {
  known: string[];
}

const BASELINE = join(REPO_ROOT, "cat-harness-tools/scripts/declaration-claims-baseline.json");
const key = (c: Claim) => `${c.file}:${c.graph}`;

function readBaseline(): Set<string> {
  try {
    return new Set((JSON.parse(readFileSync(BASELINE, "utf-8")) as Baseline).known);
  } catch {
    return new Set();
  }
}

export function checkDeclarationClaims(root = REPO_ROOT): ClaimReport {
  const graphs = declaredGraphs(root);
  const files = statSync(root).isDirectory() ? markdownFiles(root, historicalPrefixes(root)) : [];
  const claims: Claim[] = [];
  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    claims.push(...claimsIn(readFileSync(abs, "utf-8"), rel, graphs));
  }
  const baseline = readBaseline();
  const bad = new Set(claims.filter((c) => !c.agrees).map(key));
  return {
    filesRead: files.length,
    graphsKnown: graphs.size,
    claims,
    staleBaseline: [...baseline].filter((k) => !bad.has(k)),
  };
}

/** Contradictions that are NOT in the baseline. These fail. */
export function contradictions(r: ClaimReport): Claim[] {
  const baseline = readBaseline();
  return r.claims.filter((c) => !c.agrees && !baseline.has(key(c)));
}

/** Contradictions the baseline already knows about. Listed, never failed. */
export function backlog(r: ClaimReport): Claim[] {
  const baseline = readBaseline();
  return r.claims.filter((c) => !c.agrees && baseline.has(key(c)));
}

function formatReport(r: ClaimReport): string {
  // Three states, and the third is the one that gets lost. A gate that finds
  // no claims has not verified the prose — it has failed to look at it, and
  // the difference is invisible from a tick.
  if (r.graphsKnown === 0) {
    return "Declaration claims\n  ? EXAMINED NOTHING — no declared graph ids. Not a pass.";
  }
  if (r.filesRead === 0) {
    return "Declaration claims\n  ? EXAMINED NOTHING — no markdown found. Not a pass.";
  }

  const bad = contradictions(r);
  const known = backlog(r);
  const out = [
    `Declaration claims (${r.filesRead} markdown file(s), ${r.graphsKnown} declared graph id(s))`,
  ];
  if (r.claims.length === 0) {
    out.push("  ? NO CLAIM EXAMINED — the corpus names no graph beside a declaration file.");
    out.push("    Not a pass: the vocabulary is derived from the declarations, so an empty");
    out.push("    result means the prose stopped pairing them, not that it agrees.");
    return out.join("\n");
  }
  const generic = r.claims.filter((c) => c.placeholder).length;
  if (bad.length === 0) {
    out.push(`  ✓ ${r.claims.length} claim(s), no NEW contradiction`);
  }
  if (generic > 0) {
    // Reported, never graded. A pattern cannot disagree with a declaration,
    // but it must stay VISIBLE: these were invisible until 2026-09-21, so
    // generalising a sentence silently removed it from the corpus and the
    // tick above did not move.
    out.push(`    ${generic} of them name a pattern (\`<name>.json\`) — correct by construction.`);
    out.push(`    ${r.claims.length - generic} name a concrete file and were checked against the declarations.`);
  }
  for (const c of bad) {
    out.push(`  ✗ ${c.file}`);
    out.push(`      says the \`${c.graph}\` graph is declared in \`${c.claimed}\``);
    out.push(`      it is declared in ${c.actual.map((a) => `\`${a}\``).join(", ") || "(nothing)"}`);
  }
  if (bad.length > 0) {
    out.push("");
    out.push("  A declaration is `<instance>/<instance>.json` — directories and graph typologies.");
    out.push("  `<name>.config.json` is the FOLIO config — content type, dependencies, skills.");
    out.push("  Naming the second while describing the first is the `hrv2` defect.");
  }

  if (known.length > 0) {
    out.push("");
    out.push(`  ~ ${known.length} known, not failed — the markdown backlog, bean \`hrv2\`:`);
    for (const c of known) out.push(`      ${c.file} — \`${c.graph}\` ← \`${c.claimed}\``);
  }
  if (r.staleBaseline.length > 0) {
    out.push("");
    out.push(`  ! ${r.staleBaseline.length} baseline entr(y/ies) no longer match — REMOVE them:`);
    for (const k of r.staleBaseline) out.push(`      ${k}`);
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: ClaimReport;
  try {
    report = checkDeclarationClaims();
  } catch (e) {
    console.error(`Could not check declaration claims: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  const examinedNothing = report.graphsKnown === 0 || report.filesRead === 0 || report.claims.length === 0;
  // A stale baseline entry fails too: the file must shrink as the backlog is
  // worked, or it fossilises into a permanent exemption nobody re-reads.
  const bad = contradictions(report).length > 0 || report.staleBaseline.length > 0;
  process.exit(examinedNothing || bad ? 1 : 0);
}
