#!/usr/bin/env bun
/**
 * Append an agent (or human) reviewer entry to a block's QA sidecar.
 *
 * The adjudication counterpart of the script scanners: a sub-agent that
 * has read a block in full records its verdict per criterion without
 * hand-editing JSON. Entries are APPENDED to the criterion's array
 * (script candidates are preserved; the freshest entry whose field_hash
 * matches the current sources wins, per the block-qa/v1 convention).
 *
 *   bun run cat-harness-tools/pipeline/qa-agent-entry.ts \
 *     --block   <path to block .md>            (required)
 *     --criterion <criterion-id>               (required)
 *     --result  pass|fail|warn|n/a             (required)
 *     [--severity critical|major|minor]
 *     [--evidence "<what was found / why the verdict>"]
 *     [--notes    "<fix applied / fix proposed / scope note>"]
 *     [--id       <reviewer id>]               (default: agent:session)
 *
 * The field_hash is computed from the block's CURRENT .md/.ts/.lean content,
 * so run this AFTER any prose fix, and the entry certifies the fixed
 * state.
 *
 * @module pipeline/qa-agent-entry
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { blockQaPath, existingBlockQaPath, findContentRepoRoot } from "./qa-paths";
import { blockAttestationKey, composeCriteria, finalizeCriteria, refusalLine, resolvePrior } from "../schemas/sdlc/qa-attestations.ts";
import { gitHeadTree, hashBlockFiles, loadPriorBlockReport, priorRefusalLine, resolveCanonicalLean } from "./qa-utils";
import { priorFromOrExit } from "../scripts/qa-results.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** The platform checkout: the fallback anchor when no content repo encloses the block. */
const PLATFORM_ROOT = resolve(HARNESS_ROOT);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const blockMd = arg("block");
const criterion = arg("criterion");
const result = arg("result");
const severity = arg("severity");
const evidence = arg("evidence");
const notes = arg("notes");
const reviewerId = arg("id") ?? "agent:session";

if (!blockMd || !criterion || !result) {
  console.error(
    "usage: qa-agent-entry.ts --block <block.md> --criterion <id> " +
      "--result pass|fail|warn|n/a [--severity ...] [--evidence ...] " +
      "[--notes ...] [--id ...] [--prior-from <ref>]",
  );
  process.exit(2);
}
if (!["pass", "fail", "warn", "n/a"].includes(result)) {
  console.error(`invalid --result: ${result}`);
  process.exit(2);
}
if (!existsSync(blockMd)) {
  console.error(`no such block .md: ${blockMd}`);
  process.exit(2);
}
// A `fail` or `warn` asserts a violation, and the block-qa schema says the
// evidence must cite it. Without this guard such a verdict was written with an
// empty reason: a failure recorded nowhere but in its result field, which no
// reader can check. Upstreamed from litlfred/qou's fork (2026-10-04, the T11
// fork audit, owner-approved). `pass` and `n/a` need no evidence.
if ((result === "fail" || result === "warn") && !evidence?.trim()) {
  console.error(
    `--result ${result} requires --evidence: a verdict that asserts a violation ` +
      "must say what was found, or a reader cannot check it",
  );
  process.exit(2);
}

const dir = dirname(blockMd);
const root = basename(blockMd, ".md");
const tsPath = join(dir, `${root}.ts`);
// LOAD-THEN-WRITE, so the two halves use different helpers deliberately.
//
// The read falls back to the legacy sibling: this entry point appends one
// agent adjudication to an existing verdict, and a folio whose verdicts have
// not migrated would otherwise have its history silently discarded — the tool
// would read nothing, start an empty document, and overwrite.
//
// The write never falls back. It lands in the results tree, which is what
// makes running this once a MIGRATION rather than a fork: after it, the block
// has exactly one verdict and it is in the new place.
// Anchored on the BLOCK, not the cwd, exactly as `src/qa-agent-write.ts` and
// `qa-sweep` anchor it (`qa-paths.findContentRepoRoot`): the block's own
// content repository, with the platform checkout only as the last resort.
// This used the cwd-only `repo-root.findContentRepoRoot()`, which fell back to
// the PLATFORM checkout whenever the cwd held no folio declaration, so one
// verdict landed in different trees depending on where the command was run,
// including the platform's own working tree.
const blockRoot = join(dir, root);
const repoRoot = findContentRepoRoot(resolve(blockRoot), PLATFORM_ROOT);
const qaReadPath = existingBlockQaPath(repoRoot, blockRoot);
const qaPath = blockQaPath(repoRoot, blockRoot);

// The tree, not the commit: a PR run's HEAD is a synthetic merge commit that
// can vanish, while its tree survives onto main (bean 69lr; owner card Q4,
// 2026-11-05). Read from the cwd, as the commit id was before it.
const reviewedTree = gitHeadTree();

interface QaEntry {
  field_hash: { md?: string; ts?: string; lean?: string; lean_statement?: string };
  result: string;
  severity?: string;
  evidence?: string;
  notes?: string;
  reviewer: { kind: string; id: string; version?: string };
  reviewed_at?: string;
  reviewed_tree: string;
}
interface QaSidecarDoc {
  $schema?: string;
  criteria?: Record<string, QaEntry[]>;
  updated_at?: string;
  [k: string]: unknown;
}

// `--prior-from <ref>` reads the earlier report from the results store at that
// ref instead of the working copy (bean `8wj1`, owner option B). A read that
// cannot be completed refuses with exit 2: falling back to the working copy
// would let a missing store look like a block with no history.
const priorFrom = priorFromOrExit("qa-agent-entry");
let prior: QaSidecarDoc | undefined;
if (priorFrom !== undefined) {
  const loaded = loadPriorBlockReport(repoRoot, blockRoot, priorFrom);
  if (!loaded.ok) {
    console.error(priorRefusalLine("qa-agent-entry", relative(repoRoot, blockRoot), loaded));
    process.exit(2);
  }
  prior = loaded.report as QaSidecarDoc | undefined;
} else if (qaReadPath) {
  try {
    prior = JSON.parse(readFileSync(qaReadPath, "utf8")) as QaSidecarDoc;
  } catch {
    console.error(`unparseable sidecar (fix by hand first): ${qaReadPath}`);
    process.exit(1);
  }
}
// An agent verdict is an ATTESTATION (bean `8wj1`, D2): it is written to the
// attestation store first, and the block's other attestations come from that
// store — never from the prior report, whose absence used to mean they were
// dropped (C11). A store that cannot be read means nothing is written.
const attested = resolvePrior(repoRoot, blockAttestationKey(repoRoot, blockRoot), prior);
if (!attested.ok) {
  console.error(refusalLine("qa-agent-entry", relative(repoRoot, blockRoot), attested));
  process.exit(4);
}
const doc: QaSidecarDoc = attested.prior ?? { criteria: composeCriteria({}, attested.attestations) as QaSidecarDoc["criteria"] };
doc.$schema ??= "block-qa/v1";
doc.criteria ??= {};
doc.criteria[criterion] ??= [];

// Hash the block's Lean too, found the way `src/qa-agent-write.ts` and the
// staleness reader find it: the sibling `<root>.lean`, else the declaration
// its `lean.ref` names. This entry point used to hash only md and ts, so a
// verdict on a Lean-reading criterion carried no `lean`/`lean_statement` key
// and the reader, which DOES hash the Lean, could never call it fresh: the
// block re-queued forever. Upstreamed from litlfred/qou's fork (2026-10-04).
let leanPath: string | undefined = existsSync(join(dir, `${root}.lean`)) ? join(dir, `${root}.lean`) : undefined;
if (!leanPath && existsSync(tsPath)) {
  const refMatch = readFileSync(tsPath, "utf8").match(/ref:\s*["']([^"']+)["']/);
  leanPath = resolveCanonicalLean(refMatch?.[1], repoRoot);
}
const entry: QaEntry = {
  field_hash: hashBlockFiles({
    md: blockMd,
    ...(existsSync(tsPath) ? { ts: tsPath } : {}),
    ...(leanPath ? { lean: leanPath } : {}),
  }) as QaEntry["field_hash"],
  result,
  reviewer: { kind: "agent", id: reviewerId, version: "v1" },
  // No reviewed_at (owner rulings 2026-11-06, "QA dates" / "Date source"):
  // the date is derived on read from reviewed_tree.
  reviewed_tree: reviewedTree,
};
if (severity) entry.severity = severity;
if (evidence) entry.evidence = evidence;
if (notes) entry.notes = notes;

doc.criteria![criterion].push(entry);
delete doc.updated_at;
try {
  doc.criteria = finalizeCriteria(attested, doc.criteria!, "attesting");
} catch (err) {
  console.error(refusalLine("qa-agent-entry", relative(repoRoot, blockRoot), {
    state: "unknown",
    path: attested.path,
    reason: err instanceof Error ? err.message : String(err),
  }));
  process.exit(4);
}
// The mirrored results directory is not guaranteed to exist for a block
// that has never had a verdict written under the new convention; the
// legacy sibling location always did, because it was the block's own.
mkdirSync(dirname(qaPath), { recursive: true });
writeFileSync(qaPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`${qaPath}: ${criterion} <- agent ${result}`);
