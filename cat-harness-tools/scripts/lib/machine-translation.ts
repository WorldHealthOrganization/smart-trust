/**
 * The checks every candidate translation passes, whatever produced it.
 *
 * @module scripts/lib/machine-translation
 * @covers translation-sources
 *
 * The owner, 2026-11-14: an open machine-translation step with no freemium
 * API quota, whose output is a set of CANDIDATES per string that a reviewer
 * chooses among (`translation-candidates/v1`, defined in
 * `translation-adjudication.ts`). The engines are adapters in
 * `translation-sources/`, and the shared writer is `translation-candidates.ts`.
 * This module holds what is common to all of them:
 *
 *   - **Placeholders and markup must round-trip** ({@link placeholderProblem}).
 *     `{name}`, `{{x}}`, `%s`, `%(x)s`, `%1$s`, tags (`<a0>…</a0>`, `<slug>`),
 *     code spans, link targets, URLs and entities are compared as multisets,
 *     along with the number of line breaks. A candidate that fails is not
 *     recorded, and the failure is reported.
 *   - **Masking** ({@link maskPlaceholders}): before translation each
 *     placeholder becomes `[0]`, `[1]`, …, so an engine has no reason to
 *     translate it. The check still runs on the restored text.
 *   - **Surrounding whitespace** is cut off before translation and put back
 *     after ({@link splitWhitespace}).
 *   - **Line by line** ({@link translateStrings}): each line of a string is
 *     masked and sent on its own, its surrounding whitespace kept, so an
 *     engine cannot merge or drop a line; a string with no letters outside
 *     its placeholders is not sent at all; identical lines are sent once.
 *   - **Which entries are translated** ({@link entriesToTranslate}): an empty
 *     or fuzzy `msgstr`. A plural entry's forms follow the target's plural
 *     count ({@link nplurals}, {@link pluralSources}) (owner, 2026-11-14:
 *     plurals are machine-filled, fuzzy).
 *   - **Starting a catalogue** from its template ({@link poFromPot}), and the
 *     author's `DO NOT MACHINE-FILL` opt-out ({@link forbidsMachineFill}).
 */
import { poEntries } from "./translation-adjudication.ts";

// ── Placeholders and markup ──────────────────────────────────────────────

/**
 * Every token that must come back from the engine unchanged. Alternation order
 * matters only when two alternatives start at the same position: a code span
 * is taken whole before anything inside it, `{{x}}` before `{x}`.
 */
const TOKEN = new RegExp(
  [
    "`[^`\\n]+`", // inline code span
    String.raw`\$\$[\s\S]+?\$\$`, // $$ display math $$
    String.raw`(?<![\\\w])\$(?!\s)[^$\n]+?(?<!\s)\$`, // $inline math$
    String.raw`\\\([\s\S]+?\\\)`, // \( math \)
    String.raw`\\\[[\s\S]+?\\\]`, // \[ math \]
    "\\{\\{[^{}]*\\}\\}", // {{ jinja / liquid }}
    "\\{%[\\s\\S]*?%\\}", // {% liquid tag %}
    "\\{[^{}\\s]*\\}", // {name}, {0}, {}
    "%%", // a literal percent sign in a printf string
    "%\\d+\\$[-+#0]*\\d*(?:\\.\\d+)?[diouxXeEfFgGcsa]", // %1$s
    "%\\([^)\\s]+\\)[-+#0]*\\d*(?:\\.\\d+)?[diouxXeEfFgGcrsa]", // %(name)s
    "%[-+#0]*\\d*(?:\\.\\d+)?[hlLqjzt]*[diouxXeEfFgGcsa@]", // %s, %d, %.2f, %@
    "</?[A-Za-z][\\w.:-]*(?:\\s[^<>]*)?/?>", // <a0>, </a0>, <br/>, <slug>
    "\\]\\([^)\\s]+\\)", // a Markdown link target](url)
    "https?://[^\\s<>()\\]]+", // a bare URL
    "&(?:[a-zA-Z]+|#\\d+|#x[0-9a-fA-F]+);", // HTML entities
    "\\*\\*|~~", // Markdown strong and strike-through markers
  ].join("|"),
  "g",
);

/** The placeholders and markup tokens of a string, sorted (a multiset). */
export function placeholders(s: string): string[] {
  return (s.match(TOKEN) ?? []).sort();
}

/**
 * Why `translation` does not keep what `source` must keep, or `undefined` when
 * it does: the same placeholder multiset and the same number of line breaks.
 */
export function placeholderProblem(source: string, translation: string): string | undefined {
  if (translation.trim() === "") return "the engine returned nothing";
  const a = placeholders(source);
  const b = placeholders(translation);
  if (a.length !== b.length || a.some((t, i) => t !== b[i])) {
    const missing = a.filter((t) => !b.includes(t));
    const extra = b.filter((t) => !a.includes(t));
    const parts = [
      missing.length ? `lost ${missing.map((t) => JSON.stringify(t)).join(", ")}` : "",
      extra.length ? `added ${extra.map((t) => JSON.stringify(t)).join(", ")}` : "",
    ].filter(Boolean);
    return `placeholders do not round-trip${parts.length ? ` (${parts.join("; ")})` : " (counts differ)"}`;
  }
  const nl = (x: string) => (x.match(/\n/g) ?? []).length;
  if (nl(source) !== nl(translation)) return `line breaks do not round-trip (${nl(source)} → ${nl(translation)})`;
  return undefined;
}

/** A string cut into its leading whitespace, its core, and its trailing whitespace. */
export function splitWhitespace(s: string): { lead: string; core: string; trail: string } {
  const lead = /^\s*/.exec(s)![0];
  const rest = s.slice(lead.length);
  const trail = /\s*$/.exec(rest)![0];
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

// ── Masking ──────────────────────────────────────────────────────────────

/**
 * Replace every placeholder with a numbered stand-in, `[0]`, `[1]`, …, so the
 * engine sees plain text it has no reason to translate. A number whose
 * stand-in already occurs in the text is skipped, so restoring never touches
 * the source's own brackets.
 *
 * Masking only raises how many strings get through; it proves nothing. The
 * restored text still goes through {@link placeholderProblem}, so an engine
 * that drops, duplicates or rewrites a stand-in leaves the string empty.
 */
export function maskPlaceholders(s: string): { masked: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let n = 0;
  const masked = s.replace(TOKEN, (t) => {
    while (s.includes(`[${n}]`)) n++;
    const key = `[${n++}]`;
    tokens.set(key, t);
    return key;
  });
  return { masked, tokens };
}

/** Put the placeholders back. Tolerates the spaces an engine may add inside a stand-in (`[ 0 ]`). */
export function unmaskPlaceholders(s: string, tokens: Map<string, string>): string {
  if (tokens.size === 0) return s;
  return s.replace(/\[\s*(\d+)\s*\]/g, (m, d: string) => tokens.get(`[${d}]`) ?? m);
}

// ── Starting a catalogue ─────────────────────────────────────────────────

/**
 * A new `.po` for `locale`, from its template: the POT's text with the header
 * naming the locale and declaring itself unofficial (`X-Folio-Official: no`,
 * read by `check-translation-officiality.ts`). Every `msgstr` stays as the
 * template has it, which is empty.
 */
export function poFromPot(pot: string, locale: string): string {
  const lines = pot.split("\n");
  const header = poHeaderRange(lines);
  if (!header) throw new Error("the template has no header entry (msgid \"\")");
  const [from, to] = header;
  const body = lines.slice(from, to).filter((l) => !/^"(Language|X-Folio-Official):/.test(l));
  const extra = [`"Language: ${locale}\\n"`, `"X-Folio-Official: no\\n"`];
  return [...lines.slice(0, from), ...body, ...extra, ...lines.slice(to)].join("\n");
}

/** Lines `[start, end)` of the header's `msgstr` continuation strings. */
function poHeaderRange(lines: string[]): [number, number] | undefined {
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === 'msgid ""' && /^msgstr ""\s*$/.test(lines[i + 1]!)) {
      let k = i + 2;
      while (k < lines.length && lines[k]!.startsWith('"')) k++;
      return [i + 2, k];
    }
    if (lines[i]!.startsWith("msgid ") && lines[i] !== 'msgid ""') return undefined;
  }
  return undefined;
}

// ── What to translate ────────────────────────────────────────────────────

/** One entry a candidate source is asked to translate. */
export interface Wanted {
  msgctxt?: string;
  msgid: string;
  /** The entry's `msgid_plural`, for a plural entry. */
  msgidPlural?: string;
  /** The entry's `msgstr` is empty, so its first good candidate may fill it. */
  empty: boolean;
}

/** An entry or candidate left out, with the reason. */
export interface Skipped {
  msgctxt?: string;
  msgid: string;
  reason: string;
}

/**
 * The entries of a catalogue worth candidates: an EMPTY `msgstr` (which the
 * first good candidate fills) or a FUZZY one (which a reviewer may replace
 * with a candidate). A reviewed translation is not re-translated. A plural
 * entry counts as empty only when every one of its forms is, so a plural a
 * person has started is left to them.
 */
export function entriesToTranslate(po: string): { wanted: Wanted[]; skipped: Skipped[] } {
  const wanted: Wanted[] = [];
  const skipped: Skipped[] = [];
  const seen = new Set<string>();
  for (const e of poEntries(po)) {
    const plural = e.msgidPlural !== undefined;
    const empty = plural ? e.forms.every((f) => f === "") : e.msgstr === "";
    if (!empty && !e.fuzzy) continue;
    const ctx = e.msgctxt !== undefined ? { msgctxt: e.msgctxt } : {};
    if (plural && !empty && e.forms.some((f) => f === "")) {
      skipped.push({ ...ctx, msgid: e.msgid, reason: "plural entry with some forms filled: left for a person" });
      continue;
    }
    if (e.msgid.trim() === "") continue;
    const key = entryKey(e.msgctxt, e.msgid);
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push({ ...ctx, msgid: e.msgid, ...(plural ? { msgidPlural: e.msgidPlural } : {}), empty });
  }
  return { wanted, skipped };
}

// ── Plural forms ─────────────────────────────────────────────────────────

/** gettext's conventional plural counts, used only when the header has no `Plural-Forms`. */
const DEFAULT_NPLURALS: Record<string, number> = { ar: 6, ru: 3, zh: 1, ja: 1, ko: 1, fr: 2, es: 2, en: 2, pt: 2, de: 2 };

/** How many forms a plural entry has in this catalogue: its `Plural-Forms` header, else gettext's convention for the language. */
export function nplurals(po: string, locale: string): number {
  const m = /^"Plural-Forms:[^"]*\bnplurals\s*=\s*(\d+)/m.exec(po);
  return m ? Number(m[1]) : (DEFAULT_NPLURALS[locale.split(/[-_]/)[0]!.toLowerCase()] ?? 2);
}

/**
 * The English source of each of a plural entry's `n` forms: the singular for
 * form 0 when the language has more than one form, the plural for the rest
 * (and for the only form of a language without plurals, such as `zh`).
 */
export function pluralSources(msgid: string, msgidPlural: string, n: number): string[] {
  return Array.from({ length: n }, (_, k) => (k === 0 && n > 1 ? msgid : msgidPlural));
}

// ── Translating strings, line by line ────────────────────────────────────

const HAS_LETTER = /\p{L}/u;

/**
 * Translate source strings with one engine, line by line. Each line is cut
 * from its surrounding whitespace, masked ({@link maskPlaceholders}) unless
 * `mask` is false, and sent; a line with no letters outside its placeholders
 * is kept as it is; identical lines are sent once, in batches of `batch`.
 *
 * Returns, per source string, the reassembled translation (still to be
 * checked by {@link checkedCandidate}), or why it was not sent.
 */
export async function translateStrings(
  sources: string[],
  translate: (texts: string[]) => Promise<string[]>,
  o: { mask?: boolean; batch?: number } = {},
): Promise<Map<string, { text: string } | { refused: string }>> {
  const plans = new Map(
    [...new Set(sources)].map((src) => [
      src,
      src.split("\n").map((line) => {
        const { lead, core, trail } = splitWhitespace(line);
        const m = o.mask === false ? { masked: core, tokens: new Map<string, string>() } : maskPlaceholders(core);
        const send = HAS_LETTER.test(m.masked.replace(/\[\d+\]/g, ""));
        return { lead, core, trail, ...m, send };
      }),
    ]),
  );
  const unique = [...new Set([...plans.values()].flatMap((lines) => lines.filter((l) => l.send).map((l) => l.masked)))];
  const back = new Map<string, string>();
  const size = Math.max(1, o.batch ?? 16);
  for (let i = 0; i < unique.length; i += size) {
    const chunk = unique.slice(i, i + size);
    const out = await translate(chunk);
    if (out.length !== chunk.length) throw new Error(`${out.length} strings back for ${chunk.length} sent`);
    chunk.forEach((u, k) => back.set(u, out[k]!));
  }
  const result = new Map<string, { text: string } | { refused: string }>();
  for (const [src, lines] of plans) {
    if (!lines.some((l) => l.send)) {
      result.set(src, { refused: "nothing translatable (no letters outside placeholders)" });
      continue;
    }
    const text = lines
      .map((l) => (l.send ? l.lead + unmaskPlaceholders((back.get(l.masked) ?? "").trim(), l.tokens) + l.trail : l.lead + l.core + l.trail))
      .join("\n");
    result.set(src, { text });
  }
  return result;
}

/** The key gettext itself uses for an entry: context, EOT, msgid. */
export function entryKey(msgctxt: string | undefined, msgid: string): string {
  return `${msgctxt ?? ""}\u0004${msgid}`;
}

/** Whether the catalogue's own comments forbid machine filling. */
export function forbidsMachineFill(po: string): boolean {
  return /^#.*\bDO NOT MACHINE-FILL\b/im.test(po);
}

/**
 * Check one candidate for a source string: the engine's text is trimmed, the
 * placeholders must round-trip, and the source's surrounding whitespace is
 * put back. Returns the text to record, or why it is refused.
 */
export function checkedCandidate(msgid: string, text: string): { text: string } | { refused: string } {
  const { lead, core, trail } = splitWhitespace(msgid);
  const t = text.trim();
  const problem = placeholderProblem(core, t);
  if (problem) return { refused: problem };
  return { text: lead + t + trail };
}
