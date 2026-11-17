#!/usr/bin/env bun
/**
 * Report sessions that have been waiting on a person for too long.
 *
 * ```sh
 * bun run cat check:session-staleness <listing.json>   # a saved list_sessions payload
 * cat listing.json | bun run cat check:session-staleness
 * bun run cat check:session-staleness --repo litlfred/folio-assistant listing.json
 * bun run cat check:session-staleness --warn listing.json   # report, never fail
 * ```
 *
 * It takes the listing as INPUT and does not fetch it: `list_sessions` is an
 * MCP tool an agent holds, not an endpoint a script can call. So it is not a
 * CI gate (CI cannot obtain the input); it belongs in the session-start
 * sweep, run by an agent.
 *
 * The rules, their thresholds and every threshold's basis are in
 * `src/sessions/staleness.ts`.
 *
 * @module folio-assistant/scripts/check-session-staleness
 */

import { readFileSync } from "node:fs";

import { readRows, render, stale, type Report } from "../src/sessions/staleness.js";
import { REPO_ROOT } from "./lib/roots.ts";
import { sessionId, writeSweepMark } from "./sweep-mark.ts";

const argv = process.argv.slice(2);
const warn = argv.includes("--warn");
const repoAt = argv.indexOf("--repo");
const onlyRepo = repoAt >= 0 ? argv[repoAt + 1] : undefined;
// `repoAt` is -1 when `--repo` is absent, so `repoAt + 1` is 0 -- which would
// exclude the FIRST positional argument and silently fall through to reading
// stdin, where it blocks forever. Caught by this script's own first run.
const repoValueAt = repoAt >= 0 ? repoAt + 1 : -1;
const file = argv.find((a, i) => !a.startsWith("--") && i !== repoValueAt);

function readInput(): { text: string } | { because: string } {
  try {
    return { text: file ? readFileSync(file, "utf8") : readFileSync(0, "utf8") };
  } catch (e) {
    return {
      because: file
        ? `could not read ${file} — ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`
        : "no input: pass a saved `list_sessions` payload as a file, or pipe it on stdin",
    };
  }
}

const input = readInput();
const report: Report = ((): Report => {
  if ("because" in input) return { state: "unknown", because: input.because };
  const rows = readRows(input.text);
  if ("because" in rows) return { state: "unknown", because: rows.because };
  return { state: "checked", read: rows.rows.length, findings: stale(rows.rows, new Date(), onlyRepo) };
})();

console.log(argv.includes("--json") ? JSON.stringify(report, null, 2) : render(report));

// Bean `rq8s`, owner ruling 2026-10-10 ("timestamp"): a run that READ a
// listing leaves a last-checked mark on the state branch, so the next sweep
// can tell "checked" from "skipped". Only such a run: an unread or empty
// listing checked nothing, and a mark for it would make "could not determine"
// look like "checked". A filtered run (`--repo`) checked one repository, not
// the owner's sessions, so it does not mark either.
if (report.state === "checked" && report.read > 0 && !onlyRepo && !argv.includes("--no-mark")) {
  const w = writeSweepMark(REPO_ROOT ?? process.cwd(), {
    check: "session-staleness",
    read: report.read,
    findings: report.findings.length,
    by: sessionId(),
  });
  console.error(
    w.state === "written"
      ? `mark: ${w.path} — commit it to the state branch so the next sweep reads it`
      : `mark NOT written: ${w.reason}`,
  );
}

// `unknown` exits non-zero too: it is not a pass, and a caller that treats a
// zero exit as "nothing waiting" must never get one from a listing this could
// not read.
if (warn) process.exit(0);
process.exit(report.state === "unknown" || report.findings.length > 0 || report.read === 0 ? 1 : 0);
