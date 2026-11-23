/**
 * Emptying the activity log — one entry, a session, everything older than a
 * date, or all of it.
 *
 * Owner, 2026-09-19: *"Log is a mechanical role, it can be emptied by an
 * actor all at once or individually. can be periodically emptied."*
 *
 * ## This is the ONE exception to the never-delete rule, and it is narrow
 *
 * [`fsh-guts`](../../skills/kg/kg-core/fsh-guts.md) exists so that nothing is
 * removed with `rm`: a deleted artefact cannot be told from one that never
 * existed, and a scrapped thing records a dead end so the next agent does not
 * re-enter it. A log entry records **no decision**. It is a trace, it is
 * expected to be voluminous, and keeping it forever would drown the directory
 * that exists to make discarded *decisions* findable.
 *
 * So logs may be emptied without confirmation — **and nothing else may.**
 *
 * That sentence is the whole design of this module, because the obvious
 * implementation breaks it. "Empty the log directory" as a directory-level
 * `rm` would delete whatever happens to be sitting there, and the exception
 * was granted to a KIND OF FILE, not to a path. So:
 *
 * **A file is removed only if it declares itself a log entry.** Same
 * `$schema` contract the bean and workflow stores use, and the same reason
 * `#263` gave for it: extension is a coincidence of the current layout, a
 * declaration inside the file is the contract. A stray proposal dropped in
 * `fsh-guts/logs/` keeps every protection it would have had one directory up.
 *
 * **Everything not removed says why.** A sweep that reports only what it
 * deleted leaves "there was nothing to delete" and "there were nine files I
 * refused to touch" looking identical — and the second is the one somebody
 * needs to know about. Third state, same as everywhere else here.
 *
 * @module src/logging/log-sweep
 */

import { existsSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { LOG_ENTRY_SCHEMA_ID, LogEntrySchema, logDirs } from "../../schemas/sdlc/log-entry.ts";

/**
 * Which entries to remove.
 *
 * Exactly one is honoured, and `all` is deliberately not the default: a
 * selector that empties everything when the caller passed nothing is the
 * wrong way round for an operation with no undo.
 */
export type LogSelector =
  /** One entry, by its stable id — the "individually" the owner named. */
  | { id: string }
  /** Every entry from one run, which is why `session` is on the entry. */
  | { session: string }
  /** The periodic sweep: everything strictly older than this instant. */
  | { before: Date }
  /** Everything. Must be asked for by name. */
  | { all: true };

export interface KeptFile {
  path: string;
  reason: string;
}

export interface SweepResult {
  /** Files removed. */
  removed: string[];
  /**
   * Files left alone, each with why.
   *
   * Carries the ones that did NOT match the selector as well as the ones
   * this module refused to touch, because a caller checking its own filter
   * needs to see both.
   */
  kept: KeptFile[];
  /** How many files were looked at — the vacuity guard for any count above. */
  scanned: number;
  /** Directories consulted. Empty means the layer declares no trashcan. */
  directories: string[];
}

/** Does this selector pick that entry? */
function selects(sel: LogSelector, entry: { id: string; session?: string; at: string }): boolean {
  if ("all" in sel) return true;
  if ("id" in sel) return entry.id === sel.id;
  if ("session" in sel) return entry.session === sel.session;
  return new Date(entry.at).getTime() < sel.before.getTime();
}

function describe(sel: LogSelector): string {
  if ("all" in sel) return "every entry";
  if ("id" in sel) return `id ${sel.id}`;
  if ("session" in sel) return `session ${sel.session}`;
  return `older than ${sel.before.toISOString()}`;
}

/**
 * Remove the selected entries from every declared log directory.
 *
 * Never throws on a file it cannot read or remove — the file is reported in
 * `kept` with the reason. A sweep that aborts halfway leaves the caller
 * unable to say what state the directory is in, which is worse than a
 * partial sweep that says exactly which files it could not touch.
 */
export function emptyLog(root: string, selector: LogSelector): SweepResult {
  const directories = logDirs(root).filter((d) => existsSync(d));
  const result: SweepResult = { removed: [], kept: [], scanned: 0, directories };

  for (const dir of directories) {
    // Containment against a symlinked entry pointing out of the tree.
    // `resolve` is string arithmetic and would not catch it; this module
    // DELETES, so the consequence of getting it wrong is not a leak but a
    // loss.
    let realDir: string;
    try {
      realDir = realpathSync(dir);
    } catch {
      continue;
    }

    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      result.scanned += 1;

      let real: string;
      try {
        if (statSync(path).isDirectory()) {
          result.kept.push({ path, reason: "a directory, and this sweep removes files only" });
          continue;
        }
        real = realpathSync(path);
      } catch (e) {
        result.kept.push({ path, reason: `could not stat: ${e instanceof Error ? e.message : String(e)}` });
        continue;
      }
      if (real !== resolve(realDir, name)) {
        result.kept.push({ path, reason: `resolves outside the log directory (to ${real})` });
        continue;
      }

      // THE GUARD. The exception to never-delete was granted to log entries,
      // not to this path, so a file that does not declare itself one is left
      // exactly where it is.
      let parsed;
      try {
        parsed = LogEntrySchema.safeParse(JSON.parse(readFileSync(path, "utf-8")));
      } catch (e) {
        result.kept.push({
          path,
          reason: `not readable as JSON, so it cannot declare itself a ${LOG_ENTRY_SCHEMA_ID} entry: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
        continue;
      }
      if (!parsed.success) {
        result.kept.push({
          path,
          reason: `does not declare itself a ${LOG_ENTRY_SCHEMA_ID} entry — never deleted, per fsh-guts`,
        });
        continue;
      }

      if (!selects(selector, parsed.data)) {
        result.kept.push({ path, reason: `does not match ${describe(selector)}` });
        continue;
      }

      try {
        rmSync(path);
        result.removed.push(path);
      } catch (e) {
        result.kept.push({ path, reason: `could not remove: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }

  return result;
}

/**
 * One line saying what a sweep did — including what it refused to touch.
 *
 * The refusals are the half a caller forgets to print, and they are the half
 * that matters: "nothing to delete" and "nine files I would not touch" must
 * not read the same.
 */
export function describeSweep(sel: LogSelector, r: SweepResult): string {
  if (r.directories.length === 0) {
    return "log sweep: no fsh-guts directory is declared, so there is nothing to sweep";
  }
  const protectedCount = r.kept.filter((k) => !k.reason.startsWith("does not match")).length;
  const tail = protectedCount
    ? `; ${protectedCount} file(s) left alone and NOT because of the selector — see \`kept\``
    : "";
  return `log sweep (${describe(sel)}): removed ${r.removed.length} of ${r.scanned} scanned${tail}`;
}
