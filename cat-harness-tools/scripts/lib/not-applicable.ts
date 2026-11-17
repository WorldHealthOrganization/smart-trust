/**
 * A writer that cannot build anything in THIS root, saying so: neither a pass
 * nor a failure, and distinguishable from both.
 *
 * @module scripts/lib/not-applicable
 * @graphNode none — an exit-code convention and its two halves
 *
 * ## Why an exit code, and not a list of writers
 *
 * `derive:publish` runs every declared `builtAtPublish` writer. Some of them
 * read something only a root of a given shape can build: `uml:overview` reads
 * the QA working copy, which `qa:refresh` builds from the gates workflow, so in
 * a root without one (smart-ra, a document folio) it exited 2 after three
 * minutes and failed the whole step (smart-ra#66, run 38714163952).
 *
 * The prerequisite is a fact about the WRITER's implementation, so the writer
 * is the one that knows it. It exits {@link NOT_APPLICABLE_EXIT} with a reason;
 * `derive:publish` reports it skipped, excuses the artefacts only it builds,
 * and fails nothing. No list of writers lives in the step, and a root that
 * has the prerequisite (the folio-assistant index) runs the writer exactly as
 * before, where any other non-zero exit still fails.
 *
 * 78 is `EX_CONFIG` in `sysexits.h`: "something was found in an unconfigured
 * or misconfigured state". It is none of 0, 1 or 2, the judgement exits
 * (`qa-results.ts` JUDGEMENT_EXIT), so a gate run reads it as not-a-pass.
 */
import { writeFileSync } from "node:fs";

export const NOT_APPLICABLE_EXIT = 78;

/**
 * Set by a runner that wants the reason as data: the writer writes its reason
 * to this path before exiting. Unset, the reason is only printed.
 */
export const NOT_APPLICABLE_REASON_ENV = "CAT_NOT_APPLICABLE_REASON_FILE";

/** The line a writer prints, and the reason it hands its runner. */
export function notApplicableLine(who: string, why: string): string {
  return `${who}: NOT APPLICABLE in this root — ${why}. Nothing was written; this is neither a pass nor a failure.`;
}

/** Say why, hand the reason to a runner that asked for it, and exit {@link NOT_APPLICABLE_EXIT}. */
// input-site: inert #abcd77bf — only where the reason is written; the exit is 78 whatever it holds
export function exitNotApplicable(who: string, why: string, env: NodeJS.ProcessEnv = process.env): never {
  console.log(notApplicableLine(who, why));
  const file = env[NOT_APPLICABLE_REASON_ENV];
  if (file) {
    try {
      writeFileSync(file, why);
    } catch {
      // The printed line still says it; the runner falls back to "no reason given".
    }
  }
  process.exit(NOT_APPLICABLE_EXIT);
}
