/**
 * The runtime half of the input-site audit.
 *
 * @module scripts/input-trace
 * @graphNode none — a one-function hook called at `traced` input sites
 *
 * `input-sites.ts` audits a check's import closure STATICALLY, which
 * over-approximates: a `git ls-remote` inside a function that no check ever
 * calls still sits in the closure of every check whose imports reach its
 * module. Such a site is not `inert`, yet leaving it unannotated makes every
 * one of those checks unskippable.
 *
 * So a site may instead be `traced`: the line directly above it calls
 * {@link inputSiteReached}. When `regen` or `gates` runs a check it may record,
 * it names a fresh trace file in {@link TRACE_ENV}; a run that REACHED a traced
 * site writes to it, and that run records nothing. A run that did not reach it
 * records as usual; the same inputs take the same path. Child processes
 * inherit the variable with the rest of the environment.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { PROJECTED_LINE, TRACE_ENV } from "./read-projections.ts";

/** The environment variable naming the trace file of the run being recorded (declared in `read-projections.ts`). */
export { TRACE_ENV };

let quiet = 0;

/**
 * Run `fn` with {@link inputSiteReached} silenced — for a reader that has
 * ALREADY reported, more precisely than its parts could, what it reads:
 * `qa-store`'s snapshot reports `qa-ref <ref>`, then reads through
 * `branch-store`, whose every git call would otherwise report the store.
 */
export function quietly<T>(fn: () => T): T {
  quiet++;
  try {
    return fn();
  } finally {
    quiet--;
  }
}

/** The trace line for a read of the `qa-reports` store by `ref` — tolerated when `ref` is a hashed `--against` baseline. */
export function qaRefLine(ref: string): string {
  return `qa-ref ${ref}`;
}

/** Say that a `traced` input site is about to read something the input hash cannot see. */
export function inputSiteReached(what: string): void {
  if (quiet > 0) return;
  // input-site: inert #aff7f52b — names the trace file of the recording run; what is written there is never part of an answer
  const path = process.env[TRACE_ENV];
  if (path) appendFileSync(path, `${what}\n`);
}

let traceSeq = 0;

/**
 * A fresh trace file for one recorded run, under the input-hash cache's own
 * directory — which the tree digest leaves out, so writing it moves no
 * fingerprint. Returns the environment to run with and a probe to ask after.
 */
export function openTrace(root: string): {
  env: Record<string, string | undefined>;
  /**
   * What the run reached that its fingerprint does not cover, or `undefined`.
   * `hashedRefs`: the `--against` refs whose baseline identity the fingerprint
   * hashed. `seen`: site lines whose reads the caller observed another way
   * (a writer run under strace sees a git child or a file load itself).
   */
  reached: (hashedRefs?: readonly string[], seen?: readonly string[]) => string | undefined;
  /** The run's projected-read lines (`read-projections.ts`), kept when {@link reached} reads the trace. */
  projected: () => readonly string[];
} {
  // input-site: inert #394ac31a — names a build-output directory only to leave it out of a walk
  const dir = join(root, "build", "regen-cache", "traces");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${process.pid}-${++traceSeq}.log`);
  rmSync(path, { force: true });
  const projected: string[] = [];
  return {
    // input-site: inert #f435314a — hands the whole environment on to a child; the child's own reads are its own sites
    env: { ...process.env, [TRACE_ENV]: path },
    reached: (hashedRefs = [], seen = []) => {
      if (!existsSync(path)) return undefined;
      const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
      rmSync(path, { force: true });
      // A loop, not `push(...lines)`: a spread passes every line as an
      // argument, and a whole-suite gate's trace (`bun test`, measured
      // 2026-11-05 in a composed folio-assistant checkout) is long enough to
      // overflow the call stack, which crashed `gates` after every verdict
      // and left its input-hash cache unsaved.
      for (const l of lines) if (l.startsWith(PROJECTED_LINE)) projected.push(l);
      const allowed = new Set([...hashedRefs.map(qaRefLine), ...seen]);
      return lines.find((l) => !allowed.has(l) && !l.startsWith(PROJECTED_LINE));
    },
    projected: () => projected,
  };
}
