/**
 * The one interface every candidate-translation source implements.
 *
 * @module scripts/lib/translation-sources/types
 * @covers translation-sources
 *
 * A source turns English strings into candidate translations for one locale.
 * Each adapter is a module in this directory exporting a
 * {@link CandidateSourceAdapter}; `index.ts` lists them. What every adapter
 * returns goes through the same writer (`../translation-candidates.ts`
 * `addCandidates`), which checks placeholders, appends to the
 * `translation-candidates/v1` sidecar and fills an empty `msgstr` with the
 * first good candidate, `#, fuzzy`. A candidate is never a verdict.
 *
 * A source that does not translate on demand (a platform such as Weblate,
 * whose strings were translated by people there) does not need this
 * interface: it calls `addCandidates` directly with `source.kind:
 * "web-service"`.
 */
import type { CandidateSource, CandidateSourceKind } from "../translation-adjudication.ts";

export interface CandidateSourceAdapter {
  /** The adapter's name on the command line: `opus-mt`, `libretranslate`. */
  id: string;
  /** What kind of source its candidates record. */
  kind: CandidateSourceKind;
  /** The `source` recorded on each candidate for `target` (without `at`, which the writer stamps). */
  source(target: string): Omit<CandidateSource, "at">;
  /** One translation per string, in order. */
  translate(texts: string[], from: string, to: string): Promise<string[]>;
}

/** Runs a command: request on stdin, response on stdout. */
export type CommandRunner = (argv: string[], stdin: string) => Promise<string>;
