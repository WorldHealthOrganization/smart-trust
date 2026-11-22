#!/usr/bin/env bun
/**
 * Merge relevance-triage findings into the source ledger, and queue the
 * accepted actions as beans.
 *
 * Triage parallelises over documents but the ledger is one file, so agents
 * write their findings to their own JSON and this merges them in a single
 * pass.  See `.claude/skills/local/paper-relevance-triage.md`.
 *
 * ## What a findings file looks like
 *
 * A JSON array whose elements carry the assessment plus the two facts the
 * triage establishes about identity:
 *
 * ```jsonc
 * [{
 *   "file": "uploads/0409565v2.pdf",
 *   "id": "leitnerpawloski2004",        // or null when still unidentified
 *   "citation_status": "entry-uncited",  // advisory; not stored
 *   "relevance": { … RelevanceAssessment, minus assessed_by/assessed_at … }
 * }]
 * ```
 *
 * `identified` (title/authors/year), if present, is **read and discarded**.
 * Bibliographic metadata belongs in `content/schema/references.ts`; the
 * ledger stores judgements and joins only.  The merge reports which
 * documents need a `ref()` entry so that metadata can be added there.
 *
 * ## Beans
 *
 * With `--create-beans`, every proposed action other than `no-action` that
 * does not already carry a bean id becomes one, and the id is written back
 * into the action.  Re-running is safe: an action with a `bean` is skipped.
 *
 * ## Usage
 *
 *   bun run cat-harness-tools/pipeline/source-ledger-merge.ts findings/*.json
 *   bun run cat-harness-tools/pipeline/source-ledger-merge.ts findings/*.json --write
 *   bun run cat-harness-tools/pipeline/source-ledger-merge.ts findings/*.json --write --create-beans
 *
 * @module pipeline/source-ledger-merge
 */

import { readSourceLedger, writeSourceLedger } from "../schemas/library/bib-attestations.ts";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type {
  LedgerEntry,
  ProposedAction,
  RelevanceAssessment,
  SourceLedger,
  Verifier,
} from "../schemas/library/bib-verification.ts";

const REPO_ROOT = process.env.FOLIO_REPO_ROOT ?? process.cwd();

/** Model identifier recorded as the assessing agent. */
const AGENT_MODEL = process.env.FOLIO_AGENT_MODEL ?? "unknown-agent";

interface Finding {
  file: string;
  id?: string | null;
  citation_status?: string;
  relevance: Partial<RelevanceAssessment> & { verdict: RelevanceAssessment["verdict"] };
  /** Read and discarded — see the module header. */
  identified?: unknown;
}

/** Create a bean and return its id, or null if the tracker is unavailable. */
function createBean(title: string, body: string): string | null {
  try {
    const out = execFileSync("beans", ["create", title, "--type", "task", "--body", body], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    });
    // `beans create` prints e.g. "Created qou-ab12 qou-ab12--slug.md"
    const m = out.match(/Created\s+(\S+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * A work item's title: the action and its target, never "read paper X".
 *
 * Kept short on purpose — the title is what `beans list` shows, and a queue
 * whose every row wraps to four lines is a queue nobody scans.  The reasoning
 * goes in the body.
 */
function beanTitle(a: ProposedAction, refId: string | null, file: string): string {
  const subject = refId ? `[${refId}]` : file.replace(/^uploads\//, "");
  const target = a.target ? ` at ${a.target}` : "";
  const verb: Record<string, string> = {
    "add-reference": "Add reference for",
    "cite-in-block": "Cite",
    "aid-proof": "Apply",
    "new-remark": "Remark interpreting",
    "new-block": "Import block from",
    "compute-check": "Cross-check",
  };
  const title = `${verb[a.action] ?? a.action} ${subject}${target}`;
  return title.length > 100 ? `${title.slice(0, 97)}…` : title;
}

/** The bean body: why, what the source says, and where the source is. */
function beanBody(
  a: ProposedAction,
  entry: LedgerEntry,
  relevance: Finding["relevance"],
  file: string,
): string {
  const lines = [a.rationale, ""];

  // Only the results relevant to this action's target, when it names one.
  const results = (relevance.keyResults ?? []).filter(
    (k) => !a.target || !k.targets?.length || k.targets.includes(a.target),
  );
  if (results.length) {
    lines.push("**From the source**");
    for (const k of results) {
      lines.push(`- ${k.locator} — ${k.statement}`);
      lines.push(`  Use here: ${k.useForFolio}`);
    }
    lines.push("");
  }

  lines.push(
    `Source: \`${file}\`${entry.id ? ` (\`${entry.id}\`)` : " — no `references.ts` entry yet"}`,
    `Relevance: **${relevance.verdict}** — agent assessment, not yet adjudicated.`,
    "",
    "Raised by `local/paper-relevance-triage`; the ledger row is in the " +
      "source ledger (`test/attestations/bib-verification/`).",
  );
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const doBeans = args.includes("--create-beans");
  const files = args.filter((a) => !a.startsWith("--"));

  if (files.length === 0) {
    console.error("usage: source-ledger-merge.ts <findings.json…> [--write] [--create-beans]");
    process.exit(2);
  }

  // The ONE reader of the source ledger (store, or legacy before migration); it says which.
  const read = readSourceLedger(REPO_ROOT);
  console.log(read.note);
  const ledger: SourceLedger = read.ledger;
  const byFile = new Map<string, LedgerEntry>();
  for (const e of ledger.entries) {
    if (e.source?.kind === "upload") byFile.set(e.source.file, e);
  }

  const assessedBy: Verifier = { kind: "agent", model: AGENT_MODEL };
  const now = new Date().toISOString();

  let merged = 0;
  let created = 0;
  let beansMade = 0;
  let idsResolved = 0;
  const needRef: string[] = [];
  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const path of files) {
    if (!existsSync(path)) {
      missing.push(path);
      continue;
    }
    const findings: Finding[] = JSON.parse(readFileSync(path, "utf-8"));
    for (const f of findings) {
      let entry = byFile.get(f.file);
      if (!entry) {
        // A document triaged before the indexer saw it.
        entry = { source: { kind: "upload", file: f.file }, id: null, status: "unreviewed" };
        ledger.entries.push(entry);
        byFile.set(f.file, entry);
        created++;
      }

      // The triage confirms or corrects the machine-seeded join.
      if (f.id !== undefined && f.id !== entry.id) {
        entry.id = f.id;
        if (f.id) idsResolved++;
      }
      if (!entry.id) needRef.push(f.file);

      const actions = (f.relevance.proposedActions ?? []).map((a) => ({ ...a }));
      if (doBeans) {
        for (const a of actions) {
          if (a.action === "no-action" || a.bean) continue;
          const id = createBean(
            beanTitle(a, entry.id ?? null, f.file),
            beanBody(a, entry, f.relevance, f.file),
          );
          if (id) {
            a.bean = id;
            beansMade++;
          }
        }
      }

      entry.relevance = {
        verdict: f.relevance.verdict,
        rationale: f.relevance.rationale ?? "",
        keyResults: f.relevance.keyResults ?? [],
        proposedActions: actions,
        assessed_by: f.relevance.assessed_by ?? assessedBy,
        assessed_at: f.relevance.assessed_at ?? now,
        ...(f.relevance.source_sha ? { source_sha: f.relevance.source_sha } : {}),
      };
      counts[f.relevance.verdict] = (counts[f.relevance.verdict] ?? 0) + 1;
      merged++;
    }
  }

  const triaged = ledger.entries.filter((e) => e.relevance).length;
  console.log(`findings merged        : ${merged}`);
  if (created) console.log(`  rows created         : ${created}`);
  if (idsResolved) console.log(`  reference ids set    : ${idsResolved}`);
  console.log("verdicts:");
  for (const [v, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(14)} ${n}`);
  }
  if (doBeans) console.log(`beans created          : ${beansMade}`);
  console.log(`ledger triaged / total : ${triaged} / ${ledger.entries.length}`);

  if (needRef.length) {
    console.log(
      `\n${needRef.length} triaged document(s) still have no references.ts entry. ` +
        `Add the ref() there — the ledger stores no metadata:`,
    );
    for (const f of needRef.slice(0, 10)) console.log(`  ${f}`);
    if (needRef.length > 10) console.log(`  … and ${needRef.length - 10} more`);
  }
  if (missing.length) {
    console.log(`\nfindings file(s) not found: ${missing.join(", ")}`);
  }

  if (write) {
    console.log(`\n${writeSourceLedger(REPO_ROOT, ledger).note}`);
  } else {
    console.log("\n(dry run — pass --write to persist)");
  }
}

main();
