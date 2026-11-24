/**
 * The candidate sources this layer ships, by command-line name.
 *
 * @module scripts/lib/translation-sources
 * @covers translation-sources
 *
 * Only open sources run here: OPUS-MT on this machine, and a LibreTranslate
 * you host. Paid services (DeepL, Google Cloud Translation, Azure Translator,
 * Amazon Translate) are deliberately NOT adapters (owner, 2026-11-14:
 * mentioned, not added). Each would need a key and would send the text out
 * of the repository. One would be a module here implementing
 * {@link CandidateSourceAdapter} with `kind: "web-service"`, off until its key
 * is configured.
 */
import type { CandidateSourceAdapter, CommandRunner } from "./types.ts";
import { opusMtSource } from "./opus-mt.ts";
import { libreTranslateSource } from "./libretranslate.ts";

export type { CandidateSourceAdapter, CommandRunner } from "./types.ts";
export { opusMtModel, opusMtSource } from "./opus-mt.ts";
export { libreTranslateSource, libreTranslateUrlProblem } from "./libretranslate.ts";

/** The command-line names, in the order candidates are tried for an empty `msgstr`. */
export const SOURCE_IDS = ["opus-mt", "libretranslate"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export interface SourceOptions {
  /** OPUS-MT runner command; default `python3 -I <scripts>/translation/opus_mt_runner.py`. */
  runner: string[];
  run: CommandRunner;
  /** LibreTranslate base URL. */
  url: string;
  /** The model to ask for instead of the adapter's default. */
  model?: string;
  fetchImpl?: typeof fetch;
}

/** The adapter for a command-line name, or why there is none. */
export function sourceFor(id: string, o: SourceOptions): CandidateSourceAdapter {
  if (id === "opus-mt") return opusMtSource(o.runner, o.run, o.model);
  if (id === "libretranslate") return libreTranslateSource(o.url, o.fetchImpl ?? fetch, o.model);
  throw new Error(`no candidate source "${id}"; known: ${SOURCE_IDS.join(", ")}`);
}
