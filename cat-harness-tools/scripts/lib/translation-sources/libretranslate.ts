/**
 * LibreTranslate (AGPL, Argos Translate models), at a SELF-HOSTED URL.
 *
 * @module scripts/lib/translation-sources/libretranslate
 * @covers translation-sources
 *
 * A LibreTranslate you run yourself is open MT run locally, so its candidates
 * are `kind: "open-mt"`. The hosted libretranslate.com / .de services are
 * refused: they are the freemium API this step exists to avoid.
 */
import type { CandidateSourceAdapter } from "./types.ts";

/** Hosts that are a freemium translation API, never a self-hosted instance. */
const HOSTED = /(^|\.)libretranslate\.(com|de)$/i;

/** Why `url` may not be used as a LibreTranslate endpoint, or `undefined`. */
export function libreTranslateUrlProblem(url: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return `not an http(s) URL: ${url}`;
  if (HOSTED.test(u.hostname)) return `${u.hostname} is the hosted freemium service; run LibreTranslate yourself and give its URL`;
  return undefined;
}

export function libreTranslateSource(url: string, fetchImpl: typeof fetch = fetch, modelOverride?: string): CandidateSourceAdapter {
  const problem = libreTranslateUrlProblem(url);
  if (problem) throw new Error(`libretranslate: ${problem}`);
  const base = url.replace(/\/+$/, "");
  const lang = (t: string) => t.split("-")[0]!.toLowerCase();
  return {
    id: "libretranslate",
    kind: "open-mt",
    source: (target) => ({ kind: "open-mt", id: modelOverride ?? `argos-translate-en_${lang(target)}`, version: "libretranslate" }),
    async translate(texts, from, to) {
      if (texts.length === 0) return [];
      const res = await fetchImpl(`${base}/translate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: texts, source: from, target: lang(to), format: "text" }),
      });
      if (!res.ok) throw new Error(`libretranslate: HTTP ${res.status} from ${base}/translate`);
      const body = (await res.json()) as { translatedText?: unknown };
      const t = body.translatedText;
      if (!Array.isArray(t) || !t.every((x) => typeof x === "string")) {
        throw new Error("libretranslate: response has no `translatedText` array of strings");
      }
      return t as string[];
    },
  };
}
