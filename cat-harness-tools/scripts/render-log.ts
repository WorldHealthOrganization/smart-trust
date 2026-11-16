#!/usr/bin/env bun
/**
 * Append an entry to the render log on the publish branch: every staging
 * render, when added and when removed. The discipline is in
 * `skills/ui/ui-core/render-logging.md` and the process is
 * `processes/ui/staging-render-log.bpmn`.
 *
 * @module scripts/render-log
 *
 * ## APPEND, and nothing else
 *
 * There is no `--remove`, no `--edit`, no `--id` to overwrite. A takedown is
 * a `removed` ENTRY, not the erasure of the `rendered` one before it: the
 * tool offers no verb that could lose history.
 *
 * Emptying a log is a person's decision, with the confirmation every durable
 * artefact here requires (`deletion-requires-confirmation`); this tool never
 * does it.
 *
 * ## It writes into a directory, never pushes
 *
 * `--dir` is a checkout of the publish branch, or a publish directory about
 * to become one. The tool never fetches, commits or pushes: the calling
 * workflows hold the `gh-pages` checkout and own retry and concurrency.
 *
 * Usage:
 *   render-log.ts --dir DIR --event rendered --kind staging-preview \
 *     --path branches/slug [--slug S] --summary "..." [--reason "..."] \
 *     [--branch B] [--commit C] [--run URL] [--detail "..."]
 */

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  RENDER_EVENTS,
  RENDER_LOG_SCHEMA_ID,
  EVENTS_REQUIRING_REASON,
  isSafeRenderPath,
  readRenderLog,
  renderLogPath,
  serializeRenderLogEntry,
  type RenderEvent,
  type RenderLogEntry,
} from "../schemas/ui/render-log.ts";

/** Build an entry, or throw with what is wrong. Pure, so it is testable. */
export function buildEntry(o: {
  event: RenderEvent;
  kind: string;
  path: string;
  slug?: string;
  summary: string;
  detail?: string;
  reason?: string;
  /** The declared format of the three prose fields; absent means plain text. */
  format?: string;
  branch?: string;
  commit?: string;
  run?: string;
  at: string;
  id: string;
}): RenderLogEntry {
  if (!isSafeRenderPath(o.path)) {
    // Refused on the VALUE, never on its provenance — bean `fuzm`. A slug from
    // a dispatch input is not a git ref, so the `..` rule that protects the
    // ref case does not hold for it.
    throw new Error(
      `--path \`${o.path}\` is not a safe path: it must be \`/\` or a sequence of ` +
        `plain segments, with no \`..\`, no leading \`/\` and no backslash`,
    );
  }
  if (EVENTS_REQUIRING_REASON.includes(o.event) && (o.reason ?? "").trim() === "") {
    throw new Error(
      `--reason is required for a \`${o.event}\` entry. An entry saying an artefact ` +
        `went and not why is the ambiguity this log exists to prevent`,
    );
  }
  return {
    $schema: RENDER_LOG_SCHEMA_ID,
    id: o.id,
    at: o.at,
    event: o.event,
    subject: { kind: o.kind, path: o.path, ...(o.slug ? { slug: o.slug } : {}) },
    summary: o.summary,
    ...(o.detail ? { detail: o.detail } : {}),
    // Written ONLY when declared. An explicit `format: "text"` on every entry
    // would be noise that also makes absence look like a bug rather than the
    // default it is.
    ...(o.format ? { format: o.format } : {}),
    ...(o.reason ? { reason: o.reason } : {}),
    ...(o.branch ? { branch: o.branch } : {}),
    ...(o.commit ? { commit: o.commit } : {}),
    ...(o.run ? { run: o.run } : {}),
    // The BPMN element id `staging-render-log.bpmn` declares, not the file stem
    // (#1168 B8, owner 2026-09-30: a process is referred to by its element id).
    process: "Process_RenderLog",
    // The log IS the capture. An entry written here is kept by definition —
    // unlike the activity log, where `capture` decides whether an entry
    // reaches git at all and `unknown` must never be read as `on`.
    capture: "on",
  };
}

/** Append one entry to the right day's file, creating the directory. */
export function appendEntry(dir: string, entry: RenderLogEntry): string {
  const rel = renderLogPath(entry.at);
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  // `appendFileSync`, never read-modify-write: six workflows publish to this
  // branch, and a rewrite loses whatever landed between the read and the
  // write. An append of one line is what the JSONL format is for.
  appendFileSync(abs, serializeRenderLogEntry(entry), "utf8");
  return rel;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  const v = argv[i].startsWith(`--${name}=`) ? argv[i].slice(name.length + 3) : argv[i + 1];
  return v === undefined || v === "" ? undefined : v;
}

const USAGE =
  `usage: render-log.ts --dir DIR --event <${RENDER_EVENTS.join("|")}> --kind K --path P \\\n` +
  `         [--slug S] [--branch B] [--commit C] [--run URL]  < prose.json\n` +
  `\n` +
  `       The PROSE ARRIVES ON STDIN as one JSON object, never as argv:\n` +
  `         {"summary": "...", "reason": "...", "detail": "...", "format": "markdown"}\n` +
  `       \`summary\` is required; the rest are optional. Build it with jq, never\n` +
  `       by string concatenation:\n` +
  `         jq -n --arg s "$SUMMARY" --arg r "$REASON" '{summary:$s, reason:$r}' \\\n` +
  `           | bun run cat-harness-tools/scripts/render-log.ts --dir DIR --event removed ...\n` +
  `\n` +
  `       render-log.ts --dir DIR --read [--day YYYY-MM-DD]`;

/**
 * Prose does not travel in argv — bean `ru6i`.
 *
 * `--summary` and `--reason` used to be command-line words. The reason for moving
 * them is the CONTRACT, and it is worth being exact about that, because the first
 * version of this comment claimed a live bug that does not exist.
 *
 * WHAT IS NOT THE REASON. I claimed the four callers in `feature-staging.yml`
 * were broken by a quote in `$CLEANUP_REASON`, since they built the argument as
 * `--reason "PR #... confirmed by: $CLEANUP_REASON"`. **Measured: they were
 * safe.** Shell parameter expansion inside double quotes does not re-tokenize or
 * re-quote, so `he said "no"`, a backtick and a `$(id)` all arrived as one
 * literal argument with nothing executed. The value comes through `env:`, which
 * is a shell variable — not a `${{ }}` template substitution, which would be a
 * different story.
 *
 * THE ACTUAL REASON. `tool-types.ts` refuses prose as an argv word by design: "no
 * pattern admits real markdown and excludes a payload … a tool whose prose
 * argument is a command-line word was always going to need quoting nobody
 * checks." So `render-logging` could not have a Tool node at all while its
 * summary was a flag — `check:tools` said exactly that:
 *
 *     ✗ 1 command-line input(s) of a type that can express a shell payload:
 *         render-log.summary : Text — put free text on stdin
 *
 * That rule is about what a TYPE can express, not about today's callers: its own
 * argument is that "a caller is one refactor away from a template literal", and
 * the property that survives a careless caller is the value never being
 * dangerous. So this is a defensive change and a contract change, not a bug fix,
 * and calling it a bug fix would have been a claim nobody could check.
 *
 * The flags are REFUSED rather than quietly ignored, and that part stands on its
 * own. A caller left behind by the migration fails at exit 2 naming the flag,
 * instead of writing a log entry with an empty summary — which would be a record
 * that something was published and not what.
 */
function refuseProseFlags(argv: string[]): void {
  const prose = ["summary", "reason", "detail"].filter((n) =>
    argv.some((a) => a === `--${n}` || a.startsWith(`--${n}=`)),
  );
  if (prose.length === 0) return;
  console.error(`render-log: ${prose.map((n) => `--${n}`).join(", ")} no longer travel in argv.`);
  console.error("  Prose goes on stdin as JSON, because a command-line word cannot hold it safely");
  console.error("  (bean `ru6i`). This is refused rather than ignored so the caller is fixed");
  console.error("  rather than silently writing an entry with no summary.\n");
  console.error(USAGE);
  process.exit(2);
}

/**
 * The prose, read from stdin.
 *
 * Returns a reason rather than throwing, matching `readRenderLogEntry` and
 * `readFshGutsNode`: "nothing arrived" and "something arrived that will not
 * parse" want different messages, and neither may be reported as a clean write.
 */
async function readProse(
  stdin: ReadableStream<Uint8Array> | null,
): Promise<{ prose: { summary: string; detail?: string; reason?: string; format?: string } } | { reason: string }> {
  if (stdin === null) return { reason: "no stdin — the prose has nowhere to arrive from" };
  const raw = await new Response(stdin).text();
  if (raw.trim() === "") return { reason: "stdin was empty; expected one JSON object with a `summary`" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { reason: `stdin is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { reason: "stdin must be a single JSON OBJECT, not an array or a bare value" };
  }
  const o = parsed as Record<string, unknown>;
  for (const k of ["summary", "detail", "reason", "format"]) {
    if (k in o && typeof o[k] !== "string") return { reason: `\`${k}\` must be a string` };
  }
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  if (summary === "") return { reason: "`summary` is required and must be a non-empty string" };
  return {
    prose: {
      summary,
      detail: typeof o.detail === "string" && o.detail !== "" ? o.detail : undefined,
      reason: typeof o.reason === "string" && o.reason !== "" ? o.reason : undefined,
      format: typeof o.format === "string" && o.format !== "" ? o.format : undefined,
    },
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dir = flag(argv, "dir");
  if (dir === undefined) {
    console.error(USAGE);
    process.exit(2);
  }

  // A read mode, because a log nobody can read back is a write-only file and
  // the skipped-line report is the half that matters: a short count must be
  // visible as short rather than passing for complete.
  if (argv.includes("--read")) {
    const day = flag(argv, "day") ?? new Date().toISOString().slice(0, 10);
    const abs = join(dir, renderLogPath(`${day}T00:00:00.000Z`));
    if (!existsSync(abs)) {
      console.log(`render-log: no log for ${day} at ${abs}`);
      process.exit(0);
    }
    const { entries, skipped } = readRenderLog(readFileSync(abs, "utf8"));
    for (const e of entries) console.log(`${e.at}  ${e.event.padEnd(9)} ${e.subject.path}  ${e.summary}`);
    console.log(`\n${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
    if (skipped.length > 0) {
      console.error(`${skipped.length} line(s) could not be read — the count above is SHORT:`);
      for (const s of skipped) console.error(`  line ${s.line}: ${s.reason}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // Before anything else, so a caller still passing `--summary` is TOLD rather
  // than having its prose dropped on the floor.
  refuseProseFlags(argv);

  const event = flag(argv, "event");
  const kind = flag(argv, "kind");
  const path = flag(argv, "path");
  if (
    event === undefined ||
    kind === undefined ||
    path === undefined ||
    !(RENDER_EVENTS as readonly string[]).includes(event)
  ) {
    console.error(USAGE);
    process.exit(2);
  }

  const read = await readProse(Bun.stdin.stream());
  if (!("prose" in read)) {
    console.error(`render-log: ${read.reason}`);
    console.error("  Nothing was written. That is a refusal, not a log entry.\n");
    console.error(USAGE);
    process.exit(2);
  }
  const { summary, detail, reason, format } = read.prose;

  try {
    const at = new Date().toISOString();
    const entry = buildEntry({
      event: event as RenderEvent,
      kind,
      path,
      slug: flag(argv, "slug"),
      summary,
      detail,
      reason,
      format,
      branch: flag(argv, "branch"),
      commit: flag(argv, "commit"),
      run: flag(argv, "run"),
      at,
      id: `${at.replace(/[:.]/g, "-")}-${event}-${(flag(argv, "slug") ?? kind).replace(/[^\w.-]/g, "-")}`,
    });
    const rel = appendEntry(dir, entry);
    console.log(`render-log: ${event} ${path} -> ${rel}`);
    process.exit(0);
  } catch (e) {
    console.error(`render-log: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
