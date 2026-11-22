/**
 * A glossary label or definition that may be translated.
 *
 * `folio-glossary/v1` lets a term's `prefLabel` and `definition` be either a
 * plain string (source-language text) or a language map, `{ en, fr, … }`
 * (owner, option C, 2026-11-18: glossary translations as language-tagged
 * labels and definitions, marked unofficial). `altLabel` may be a string, an
 * array of strings, an array of language maps, or a language map whose values
 * are a string or an array of strings. A JSON-LD export may also carry the
 * same text as `{ "@value", "@language" }` objects, alone or in an array.
 *
 * Every reader in this layer that matches, indexes or shows a label must take
 * its SOURCE text, never assume a string: a translated term is still the same
 * term, and code that treated it as absent (or crashed on it) dropped it.
 *
 * Read as DATA: the schema itself belongs to a layer above this one.
 *
 * @module schemas/content/lang-text
 * @graphNode none — a function library over label text; the glossary schema it reads belongs to a layer above
 */

/** The source language when the scheme declares none. */
export const DEFAULT_SOURCE_LANGUAGE = "en";

/** A label or definition as `folio-glossary/v1` allows it. */
export type LangText = string | Readonly<Record<string, string>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The source-language text of one label or definition, or `undefined` when
 * there is none.
 *
 * A string is source text. A language map gives its `lang` entry, else its
 * first string entry (a scheme authored in another language still has a
 * source). A JSON-LD value object gives its `@value`; an array of them, the
 * one in `lang`, else the first.
 */
export function sourceText(v: unknown, lang: string = DEFAULT_SOURCE_LANGUAGE): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const texts = v.map((x) => ({ lang: isRecord(x) && typeof x["@language"] === "string" ? x["@language"] : undefined, text: sourceText(x, lang) }));
    return (texts.find((t) => t.lang === lang && t.text !== undefined) ?? texts.find((t) => t.text !== undefined))?.text;
  }
  if (!isRecord(v)) return undefined;
  if ("@value" in v) return typeof v["@value"] === "string" ? v["@value"] : undefined;
  const own = v[lang];
  if (typeof own === "string") return own;
  for (const x of Object.values(v)) if (typeof x === "string") return x;
  return undefined;
}

/**
 * The source-language texts of an `altLabel`, in order, whatever shape it has.
 *
 * A language map of arrays gives its `lang` array, else its first array; an
 * array gives each member's {@link sourceText}.
 */
export function sourceTexts(v: unknown, lang: string = DEFAULT_SOURCE_LANGUAGE): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map((x) => sourceText(x, lang)).filter((x): x is string => x !== undefined);
  if (isRecord(v) && !("@value" in v)) {
    const own = v[lang];
    const pick = own !== undefined ? own : Object.values(v)[0];
    if (Array.isArray(pick)) return pick.filter((x): x is string => typeof x === "string");
  }
  const one = sourceText(v, lang);
  return one === undefined ? [] : [one];
}

/** The scheme's declared source language, or {@link DEFAULT_SOURCE_LANGUAGE}. */
export function schemeSourceLanguage(scheme: unknown): string {
  if (!isRecord(scheme)) return DEFAULT_SOURCE_LANGUAGE;
  const l = scheme["sourceLanguage"] ?? scheme["language"];
  return typeof l === "string" && l.trim() !== "" ? l : DEFAULT_SOURCE_LANGUAGE;
}
