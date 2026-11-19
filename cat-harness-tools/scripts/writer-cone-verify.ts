#!/usr/bin/env bun
/**
 * The writers' half of the rerun-and-measure dry run: after a FULL
 * `derive:publish`, which writers could the previous deploy's records have
 * skipped, and would skipping them have been right?
 *
 * @module cat-harness-tools/scripts/writer-cone-verify
 * @covers none — its logic is covered by `scripts/tests/writer-cone.test.ts`
 *
 * With `--gate <record.json>` it is also the GATE on published writer records
 * (cat-harness-tools#1702): main's full build judges the records PRs skip
 * with, and the gate `publish:writer-records` is red when any writer would
 * have been served stale. It is merged into the record file the layer PR
 * checks already hand to `run-gates.py --record` (`derive-publish.json`).
 *
 * It skips nothing and changes nothing: the full build already ran. It reads
 * the previous deploy's records (published at `writer-cone/records.json`
 * beside `build.json`) and judges each writer with `verifyWriters`. A
 * `skip-unsafe` writer is the number that must stay at zero before any writer
 * is actually skipped.
 *
 * Usage (from the index root, after derive:publish):
 *   bun run cat-harness-tools/scripts/writer-cone-verify.ts --prev <records.json> [--out verdicts.json] [--summary "$GITHUB_STEP_SUMMARY"] [--gate derive-publish.json]
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { declaredPlan, writersOf } from "./derive-at-publish.ts";
import { outputsByWriter } from "./derive-cache.ts";
import { FileDigests } from "./input-hash.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { loadWriterRecords, verifySummary, verifyWriters, writerBase, type WriterVerdict } from "./writer-cone.ts";

/** The gate's name in the layer PR checks' record. */
export const WRITER_RECORDS_GATE = "publish:writer-records";

/** The gate entry for a verify: red (exit 1) on any `skip-unsafe` writer, its tail naming them. */
export function gateEntry(verdicts: readonly WriterVerdict[] | undefined, prevSha: string | undefined, why?: string): Record<string, unknown> {
  const command = "bun run cat-harness-tools/scripts/writer-cone-verify.ts --gate";
  if (verdicts === undefined) return { command, skipped: why ?? "no published writer records to judge" };
  const unsafe = verdicts.filter((v) => v.verdict === "skip-unsafe");
  const tail = unsafe.length
    ? `${unsafe.length} writer(s) would have been served stale by the records of ${prevSha?.slice(0, 12)}: ${unsafe.map((v) => (v.verdict === "skip-unsafe" ? `${v.writer} (${v.differs.slice(0, 3).join(", ")})` : v.writer)).join("; ")}`
    : `${verdicts.filter((v) => v.verdict === "skip-safe").length} of ${verdicts.length} writer(s) could skip with the records of ${prevSha?.slice(0, 12)}, none stale`;
  return { command, exit: unsafe.length ? 1 : 0, tail };
}

/** Merge `entry` under {@link WRITER_RECORDS_GATE} into the record file at `path`. */
export function mergeGate(path: string, entry: Record<string, unknown>): void {
  let rec: Record<string, unknown> = {};
  try {
    rec = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    /* absent: a record of this gate alone */
  }
  rec[WRITER_RECORDS_GATE] = entry;
  writeFileSync(path, JSON.stringify(rec, null, 1));
}

/** Every file under `paths` (files or directories), repo-relative. */
export function filesUnder(root: string, paths: readonly string[]): string[] {
  const out: string[] = [];
  const stack = paths.map((p) => join(root, p.replace(/\/$/, "")));
  while (stack.length) {
    const abs = stack.pop()!;
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) for (const n of readdirSync(abs)) stack.push(join(abs, n));
    else if (st.isFile()) out.push(relative(root, abs).split("\\").join("/"));
  }
  return out.sort();
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(arg("--root") ?? ".");
  const prevPath = arg("--prev");
  const prev = prevPath ? loadWriterRecords(root, resolve(prevPath)) : undefined;
  if (!prev) {
    const msg = `writer-cone-verify: no previous writer records${prevPath ? ` at ${prevPath}` : ""}: nothing to judge (a deploy before records, or another record version)\n`;
    process.stderr.write(msg);
    const s = arg("--summary");
    if (s) appendFileSync(s, `### Writers, rerun and measure — dry run (bean \`fwtz\`)\n\n${msg}`);
    const g = arg("--gate");
    if (g) mergeGate(g, gateEntry(undefined, undefined, msg.trim()));
    process.exit(0);
  }
  const plan = declaredPlan(root);
  const writers = writersOf(plan);
  const byWriter = outputsByWriter(plan, root);
  const scripts = scriptsOf(root);
  const digests = new FileDigests(root);
  const verdicts = verifyWriters({
    prev,
    writers,
    base: (w) => writerBase(root, scripts, w, digests),
    root,
    digests,
    filesNow: (w) => filesUnder(root, byWriter.get(w) ?? []),
  });
  const out = arg("--out");
  if (out) writeFileSync(out, JSON.stringify({ prev: prev.sha, verdicts }, null, 2) + "\n");
  const text = verifySummary(verdicts, prev.sha);
  process.stderr.write(text);
  const s = arg("--summary");
  if (s) appendFileSync(s, text);
  const g = arg("--gate");
  if (g) mergeGate(g, gateEntry(verdicts, prev.sha));
}
