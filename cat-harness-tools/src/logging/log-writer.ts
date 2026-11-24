/**
 * The activity-log producer — the thing that actually writes an entry.
 *
 * `schemas/sdlc/log-entry.ts` says what an entry IS and where logs live;
 * this says how one gets written. They are separate because the schema is a
 * contract a folio's own tooling may read, and the writer is platform
 * machinery with a filesystem in it.
 *
 * ## Writing and persisting are two different questions
 *
 * Every entry is WRITTEN. The default is that `fsh-guts/logs/` is git-ignored,
 * so an agent can read back what it wrote this session and nothing reaches the
 * data store. `capture: "on"` is what makes an entry ELIGIBLE for the store —
 * it does not itself commit anything, because committing is a decision with a
 * repository behind it and a log writer is not where that belongs.
 *
 * Collapsing the two would give the worse of both: either an audit trail
 * nobody asked for arrives in git, or an agent believes it is keeping one and
 * is not. {@link writeLogEntry} therefore REPORTS which of the three capture
 * states it resolved, on every call, rather than leaving it to be inferred.
 *
 * ## Why it never throws on a write failure
 *
 * A log is instrumentation. An agent whose task fails BECAUSE the logging of
 * that task failed has been made worse off by the thing meant to help it, and
 * the failure is maximally confusing — it points at the log directory rather
 * than at the work. So a write that cannot happen is REPORTED in the result
 * (`written: false` with the reason) and never raised.
 *
 * That is not the same as swallowing it. A silent failure would recreate the
 * exact defect `capture: "unknown"` exists to prevent, one layer down: the
 * agent believes it has a trail and does not. The caller gets the reason and
 * can say so.
 *
 * @module src/logging/log-writer
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type LogCapture,
  type LogEntry,
  type LogEvent,
  type LogExecution,
  type LogReference,
  LOG_ENTRY_SCHEMA_ID,
  LOG_REF_KINDS,
  LogEntrySchema,
  logDirs,
  resolveCapture,
  shouldPersist,
} from "../../schemas/sdlc/log-entry.ts";

/** What the caller supplies. The writer fills in `$schema`, `id` and `at`. */
export interface LogDraft {
  event: LogEvent;
  summary: string;
  detail?: string;
  actor?: string;
  role?: string;
  process?: string;
  task?: string;
  bean?: string;
  session?: string;
  branch?: string;
  /** Chats, issues, commits, commands — see `LOG_REF_KINDS`. Open by design. */
  references?: LogReference[];
  /** Command-execution detail, when this entry is one. */
  execution?: LogExecution;
}

export interface LogResult {
  /** Did an entry reach the disk? */
  written: boolean;
  /** Where it landed, when it did. */
  path?: string;
  /** The resolved capture state — always reported, never inferred. */
  capture: LogCapture;
  /** Whether this entry is eligible for the git data store. */
  eligibleForStore: boolean;
  /** Why nothing was written, when nothing was. Never silent. */
  reason?: string;
  /** The entry as validated, for a caller that wants to echo it. */
  entry?: LogEntry;
  /**
   * Reference kinds outside {@link LOG_REF_KINDS}.
   *
   * ADVISORY, never a rejection. The vocabulary is open on purpose, so an
   * unknown kind is a new one until somebody says otherwise — but a silent
   * open list is how `issue` and `issues` and `gh-issue` end up in one store
   * and nothing can query it. Surfacing them is what lets a typo be noticed
   * without letting the parser refuse a legitimate extension.
   */
  unknownRefKinds?: string[];
}

/**
 * A sortable, collision-resistant id.
 *
 * Timestamp-prefixed so a directory listing is chronological without reading
 * any file, and suffixed with randomness because two entries in the same
 * millisecond are ordinary for an agent that logs a task's start and its first
 * message together.
 */
function newId(at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  // input-site: inert #cedea465 — a unique suffix for a new entry's id; written, never compared
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Write one entry to every declared log directory.
 *
 * EVERY directory, not the first. `logDirs` returns a list for the reason
 * `kgRoots` does: a consumer that takes the first reports a clean run over the
 * ones it never visited. In practice a layer declares one trashcan, so the
 * loop runs once — but the failure of writing to one of two and reporting
 * success is silent, and the loop costs nothing.
 *
 * `declaredCapture` is whatever the caller managed to resolve — a process's
 * `<cat-harness.processes:log capture>`, a config field, or nothing. Absent becomes `unknown`,
 * never `off`: see {@link resolveCapture}.
 */
export function writeLogEntry(
  root: string,
  draft: LogDraft,
  declaredCapture?: unknown,
  // input-site: inert #929cabf1 — the moment an entry is written when the caller gives none; a write, never a check's input
  now: Date = new Date(),
): LogResult {
  const capture = resolveCapture(declaredCapture);
  const eligibleForStore = shouldPersist(capture);
  const known = new Set<string>(LOG_REF_KINDS);
  const unknownRefKinds = [
    ...new Set((draft.references ?? []).map((r) => r.kind).filter((k) => !known.has(k))),
  ];

  const parsed = LogEntrySchema.safeParse({
    $schema: LOG_ENTRY_SCHEMA_ID,
    id: newId(now),
    at: now.toISOString(),
    capture,
    ...draft,
  } satisfies Record<string, unknown>);

  if (!parsed.success) {
    // A malformed entry is the caller's defect and worth saying so, but it is
    // still not worth failing their task over.
    return {
      written: false,
      capture,
      eligibleForStore,
      unknownRefKinds,
      reason: `entry does not satisfy ${LOG_ENTRY_SCHEMA_ID}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
    };
  }
  const entry = parsed.data;

  const dirs = logDirs(root);
  if (dirs.length === 0) {
    // The third state, and the reason this is not an error: a layer that
    // declares no trashcan has nowhere to log, which is a fact about its
    // declaration rather than a fault in this call.
    return {
      written: false,
      capture,
      eligibleForStore,
      unknownRefKinds,
      reason: "no fsh-guts directory is declared in the instance's `<name>.json`, so there is nowhere to log",
      entry,
    };
  }

  let path: string | undefined;
  const failures: string[] = [];
  for (const dir of dirs) {
    const target = join(dir, `${entry.id}.json`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(target, `${JSON.stringify(entry, null, 2)}\n`, "utf-8");
      path ??= target;
    } catch (e) {
      failures.push(`${dir}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (path === undefined) {
    return { written: false, capture, eligibleForStore, unknownRefKinds, reason: failures.join("; "), entry };
  }
  return {
    written: true,
    path,
    capture,
    eligibleForStore,
    unknownRefKinds,
    entry,
    // A PARTIAL write is reported too. Succeeding at one of two directories is
    // not success, and returning only the happy path would hide it.
    reason: failures.length ? `wrote ${path}, but: ${failures.join("; ")}` : undefined,
  };
}

/**
 * One line a caller can print, saying which of the three states it is in.
 *
 * The skill requires the state to be REPORTED rather than inferred, and a
 * caller left to phrase that itself will phrase it three different ways or not
 * at all.
 */
export function describeCapture(r: LogResult): string {
  if (!r.written) return `log: nothing written (${r.reason ?? "no reason given"})`;
  const store =
    r.capture === "on"
      ? "kept in the data store"
      : r.capture === "off"
        ? "local only, not committed"
        : "capture undetermined, so local only";
  const odd = r.unknownRefKinds?.length
    ? ` (reference kind${r.unknownRefKinds.length > 1 ? "s" : ""} not in the known set: ` +
      `${r.unknownRefKinds.join(", ")} — new, or a typo)`
    : "";
  return `log: ${r.path} — ${store}${odd}`;
}
