/**
 * OPUS-MT (Helsinki-NLP Marian models, CC-BY 4.0), run on this machine.
 *
 * @module scripts/lib/translation-sources/opus-mt
 * @covers translation-sources
 *
 * The runner is a local command, by default `python3 -I
 * scripts/translation/opus_mt_runner.py` (the runner `translate-pot.ts`, its older name, uses
 * too). It reads ONE JSON request on stdin and writes ONE JSON response:
 *
 * ```
 * → {"model":"Helsinki-NLP/opus-mt-en-es","texts":["…"]}
 * ← {"translations":["…"]}
 * ```
 *
 * The multi-target `en-ar` / `en-zh` models need a sentence-initial `>>id<<`
 * token; this adapter puts it in front of each text, so the runner needs to
 * know nothing about it.
 *
 * Nothing leaves the machine except the model download on first use.
 */
import type { CandidateSourceAdapter, CommandRunner } from "./types.ts";

/**
 * The OPUS-MT model for English to `target`. The `en-ar` and `en-zh` models
 * are multi-target and need a sentence-initial `>>id<<` token, given here.
 */
export function opusMtModel(target: string): { model: string; targetToken?: string } {
  const t = target.split("-")[0]!.toLowerCase();
  if (t === "ar") return { model: "Helsinki-NLP/opus-mt-en-ar", targetToken: ">>ara<<" };
  if (t === "zh") return { model: "Helsinki-NLP/opus-mt-en-zh", targetToken: ">>cmn_Hans<<" };
  return { model: `Helsinki-NLP/opus-mt-en-${t}` };
}

export function opusMtSource(runner: string[], run: CommandRunner, modelOverride?: string): CandidateSourceAdapter {
  return {
    id: "opus-mt",
    kind: "open-mt",
    source: (target) => ({ kind: "open-mt", id: modelOverride ?? opusMtModel(target).model }),
    async translate(texts, _from, to) {
      if (texts.length === 0) return [];
      const { model, targetToken } = opusMtModel(to);
      const req = { model: modelOverride ?? model, texts: targetToken ? texts.map((t) => `${targetToken} ${t}`) : texts };
      const out = JSON.parse(await run(runner, JSON.stringify(req))) as { translations?: unknown };
      if (!Array.isArray(out.translations) || !out.translations.every((x) => typeof x === "string")) {
        throw new Error("opus-mt runner: response has no `translations` array of strings");
      }
      return out.translations as string[];
    },
  };
}
