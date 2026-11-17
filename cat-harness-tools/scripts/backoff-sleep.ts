/**
 * Wait before a retry, using the ONE backoff the repository has.
 *
 * `src/core/retry.ts` implements the retry rule in
 * `cat-harness/skills/conduct/conduct-core/retry-backoff.md` (logarithmic
 * fall-off on all errors, never a loop written per call site). A workflow's
 * `run:` body cannot import TypeScript, so retry loops in `.github/workflows/`
 * call this script instead of writing their own `sleep`.
 *
 * ## Why a script rather than a shell function
 *
 * A shell function copied into several `run:` bodies is several
 * implementations, free to drift, as copies of `stripLeanComments` once did.
 * This calls {@link waitFor} directly, so the
 * workflows and `withBackoff` compute the same number from the same code.
 * The cost is a `bun` start per wait, in jobs that already run `bun`.
 *
 * ## Why it sleeps rather than printing a number
 *
 * `sleep $(bun run cat-harness-tools/scripts/backoff-sleep.ts …)` would pass an EMPTY argument on any
 * failure of this script, and `sleep` with no operand is an error the loop
 * would then take as its own. Sleeping here means a fault is this script's
 * exit code, which the calling loop can see.
 *
 * ## The defaults
 *
 * `waitFor`'s own defaults (1 s base) are tuned for an HTTP call. A rejected
 * push to `gh-pages` is a lost race against another session's whole job, so
 * the base here is 5 s. The cap stays `retry.ts`'s 16 s.
 */
import { waitFor } from "../src/core/retry.js";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 5 s rather than `waitFor`'s 1 s — see the note above. */
export const PUSH_BASE_MS = 5_000;
/** `retry.ts`'s own cap, unchanged. */
export const PUSH_CAP_MS = 16_000;

if (import.meta.main) {
  const raw = flag("attempt");
  const attempt = Number(raw);
  // A bad attempt number must not silently become attempt 1 and a short wait:
  // that is the herd this exists to break, reintroduced by a typo.
  if (!raw || !Number.isInteger(attempt) || attempt < 1) {
    console.error(`backoff-sleep: --attempt must be an integer >= 1 (got ${raw ?? "nothing"})`);
    process.exit(2);
  }
  const baseMs = Number(flag("base-ms") ?? PUSH_BASE_MS);
  const capMs = Number(flag("cap-ms") ?? PUSH_CAP_MS);
  const ms = waitFor(attempt, baseMs, capMs);
  // To stderr, so a caller that ever does want the number on stdout is free to
  // add it without this line becoming part of the contract.
  //
  // The cap is stated as the cap on the IDEAL, because that is what it is:
  // `waitFor` caps `baseMs * 2 ** (attempt - 1)` and THEN multiplies by
  // `[0.5, 1.5)`, so an actual wait runs to 1.5x the cap. Measured here at
  // attempt 5: 22.9 s against a 16 s cap. Writing "capped at 16s" — which
  // this line did first — reads as a promise the number then breaks, and
  // whoever next times a job would take the 22.9 s for a bug in the cap.
  console.error(
    `backoff: attempt ${attempt} — waiting ${(ms / 1000).toFixed(1)}s ` +
      `(doubling from ${baseMs / 1000}s, capped at ${capMs / 1000}s before jitter of [0.5, 1.5))`,
  );
  // A pending timer keeps the process alive until it fires, which is the whole
  // wait. Not `await`: a top-level await makes this an ASYNC module, and
  // `qa-store.ts` imports the constants above, so every graph that reaches it
  // (the qa-checkers, through `qa-utils` -> `qa-results`) could no longer be
  // `require()`d — `harness-config`'s plugin-table load failed on exactly that.
  setTimeout(() => {}, ms);
}
