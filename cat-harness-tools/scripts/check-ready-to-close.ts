#!/usr/bin/env bun
/**
 * Beans a session judged finished but could not re-derive — the owner's batch.
 *
 * A bean closes on evidence, re-derived (`bean-coordination` §"Closing a bean
 * whose work has already landed"). Where a session cannot re-derive it, it
 * tags the bean `ready-to-close`; this lists every bean carrying the tag,
 * with the evidence its session did find, for the owner to confirm.
 *
 * It is a tag, not a status: the status vocabulary belongs to the `beans` CLI,
 * and `BeanStatusSchema` in `schemas/tools/tool-types.ts` mirrors exactly
 * what `beans update --status` accepts.
 *
 * It reports and never acts: closing is the owner's
 * (`deletion-requires-confirmation`) unless a `bean-close` waiver is in force
 * (`confirmation-waiver`). This script does not read waivers.
 *
 * Exit: 0 always for the listing itself; **1** when a tagged bean carries no
 * `## Evidence` section.
 *
 * @module folio-assistant/scripts/check-ready-to-close
 * @covers bean-defs, beans
 */

import { resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";

import { CLOSED_STATUSES, readBeanFiles } from "./bean-store-read.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/** The tag. One spelling, named once. */
export const READY_TAG = "ready-to-close";

export interface ReadyToCloseReport {
  store: boolean;
  ready: { id: string; title: string; status: string; evidence: string }[];
  /** Tagged, but with no `## Evidence` section — the parking-space case. */
  unevidenced: { id: string; title: string }[];
  /** Tagged and already closed; the tag is spent and should come off. */
  spent: string[];
}

/**
 * The body of the `## Evidence` section, or `""` when there is none.
 *
 * Scanned line by line rather than with one regex, because the obvious
 * expression is wrong in JavaScript in a way that reads as correct: `\\Z` is
 * not an anchor here — it matches a literal `Z` — so a section that runs to the
 * end of the file never terminates and the whole match fails. The first draft
 * of this function reported all four `bbbl` beans as unevidenced seconds after
 * their evidence was written.
 */
export function evidenceSection(body: string): string {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => /^#{2,6}[ \t]+Evidence[ \t]*$/.test(l));
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,6}[ \t]/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

export function checkReadyToClose(root: string): ReadyToCloseReport {
  const all = readBeanFiles(root);
  if (all === null) return { store: false, ready: [], unevidenced: [], spent: [] };
  const out: ReadyToCloseReport = { store: true, ready: [], unevidenced: [], spent: [] };
  for (const b of all.filter((x) => x.tags.includes(READY_TAG))) {
    if (CLOSED_STATUSES.has(b.status)) {
      out.spent.push(b.id);
      continue;
    }
    const evidence = evidenceSection(b.body);
    if (evidence === "") out.unevidenced.push({ id: b.id, title: b.title });
    else out.ready.push({ id: b.id, title: b.title, status: b.status, evidence });
  }
  return out;
}

function formatReport(r: ReadyToCloseReport): string {
  if (!r.store) return "Ready to close\n  · no bean store — nothing to check";
  if (r.ready.length === 0 && r.unevidenced.length === 0 && r.spent.length === 0) {
    return "Ready to close\n  · nothing awaiting confirmation. (A determined empty, not an unknown.)";
  }
  const out = [`Ready to close (${r.ready.length} awaiting the owner's confirmation)`];
  for (const b of r.ready) {
    out.push("");
    out.push(`  ${b.id} — ${b.title}`);
    for (const line of b.evidence.split("\n")) out.push(`      ${line}`);
  }
  for (const b of r.unevidenced) out.push(`  ✗ ${b.id}: tagged \`${READY_TAG}\` with no \`## Evidence\` section — the tag says "re-derivation is beyond this session", never "I would rather not"`);
  for (const id of r.spent) out.push(`  · ${id} is closed; remove the \`${READY_TAG}\` tag`);
  if (r.ready.length) {
    out.push("");
    out.push("  Closing these is the owner's — or a session acting under a `bean-close` waiver,");
    out.push("  which it names in its turn report. See skills/conduct/conduct-core/confirmation-waiver.md.");
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: ReadyToCloseReport;
  try {
    // The REPOSITORY root, not the cwd: `beans/` is repository-scoped, and a
    // run from anywhere else reads "no store" — a clean-looking answer to a
    // question asked in the wrong place.
    report = checkReadyToClose(repoRootFor(resolve(import.meta.dir, "..")));
  } catch (e) {
    exitIfBeanStoreAbsent("check:ready-to-close", e);
    console.error(`Could not read the ready-to-close queue: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT an empty queue. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.unevidenced.length ? 1 : 0);
}
