/**
 * PO injection — produces translated Markdown from a PO file.
 *
 * ## Origin: the upstream `inject_translations.py`
 *
 * This module is a TypeScript port of the markdown injection logic in
 * <https://github.com/WorldHealthOrganization/smart-base/blob/main/input/scripts/inject_translations.py>
 * ("upstream" below; lines 608–818, function `inject_markdown` and helpers). The Python
 * original injects translations into `input/pagecontent/*.md` files;
 * this injects into folio content blocks.
 *
 * ## How injection works
 *
 * The injector takes its spans from `segmentMarkdown` in `pot-extract.ts`
 * (which mirrors `extract_translations.extract_markdown`) — the same call
 * `extractMarkdown` writes the catalogue from, not a copy of its rules. For each span,
 * it looks up the `msgid` (after cleaning) in the PO translations
 * dictionary and substitutes the `msgstr`.
 *
 * Key design choices (from upstream):
 *
 * - **Re-wrapping:** When a multi-line paragraph, list item or blockquote
 *   is translated, the first line keeps its marker and indentation and
 *   takes the full translated text; continuation lines are removed. Markdown renderers treat consecutive
 *   non-blank lines as one paragraph, so this is functionally equivalent.
 *
 * - **Liquid variable restoration:** `{lqd_expr}` in the translated text
 *   is restored to `{{ expr }}` Liquid syntax (upstream compat).
 *
 * - **Fuzzy entries skipped:** Entries flagged `#, fuzzy` in the PO file
 *   are not injected, matching the upstream script's conservative approach.
 *
 * @module pipeline/po-inject
 */

import {
  cleanMarkdownText,
  cleanMarkdownWithTokens,
  type CleanedMarkdown,
  isTranslatable,
  segmentMarkdown,
  splitTableCells,
} from "./pot-extract";

// ── Liquid & placeholder restoration ────────────────────────────

/** Prefix used by pot-extract for Liquid output variables. */
const LQD_PREFIX = "lqd_";
// Built from LQD_PREFIX so the prefix is written once. It was previously
// repeated as a literal here, leaving the constant read by nothing and free
// to drift from the pattern that actually matches.
const LQD_VAR_RE = new RegExp("\\{" + LQD_PREFIX + "([^{}\n]+)\\}", "g");

/**
 * Restore `{lqd_expr}` gettext variables back to `{{ expr }}` Liquid
 * syntax. Mirrors upstream `_gettext_to_liquid()`.
 */
function gettextToLiquid(text: string): string {
  return text.replace(LQD_VAR_RE, (_match, expr: string) => `{{ ${expr} }}`);
}

/**
 * Restore `{lqd_…}`, `<aN>…</aN>`, and `{codeN}` placeholders in a
 * translated string using the tokens captured by `cleanMarkdownWithTokens` (G3).
 */
export function restorePlaceholders(
  translated: string,
  tokens: CleanedMarkdown,
): string {
  let s = gettextToLiquid(translated);
  s = s.replace(
    /<a(\d+)>([\s\S]*?)<\/a\1>/g,
    (_m, idxStr: string, inner: string) => {
      const target = tokens.linkTargets[Number(idxStr)];
      return target !== undefined ? `[${inner}](${target})` : inner;
    },
  );
  s = s.replace(/\{code(\d+)\}/g, (_m, idxStr: string) => {
    const code = tokens.codeSpans[Number(idxStr)];
    return code !== undefined ? code : _m;
  });
  return s;
}

/** Build the composite lookup key for a `msgctxt`-qualified PO entry. */
export function poContextKey(msgctxt: string, msgid: string): string {
  return `${msgctxt}\x04${msgid}`;
}

// ── PO parsing ──────────────────────────────────────────────────

/** A single PO entry (msgid → msgstr pair). */
export interface PoEntry {
  /** Source references (#: comments). */
  references: string[];
  /** Translator comments (#. comments). */
  comments: string[];
  /** Flags (#, comments, e.g., "fuzzy"). */
  flags: string[];
  /** Context (msgctxt). */
  context?: string;
  /** Source string. */
  msgid: string;
  /** Translated string (empty = untranslated). */
  msgstr: string;
}

/**
 * Parse a PO file into a msgid → msgstr dictionary.
 *
 * Mirrors upstream `parse_po_file()`: only entries with a non-empty
 * msgstr are included. **Fuzzy entries are skipped** to avoid injecting
 * uncertain translations.
 */
export function parsePo(poContent: string): Map<string, string> {
  const translations = new Map<string, string>();

  // Split into blocks separated by blank lines
  const blocks = poContent.trim().split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n");

    // Skip header block (first msgid is empty)
    if (lines.some((l) => l.trim() === 'msgid ""') &&
        !lines.some((l) => l.trim() === 'msgstr ""' && lines.indexOf(l) === lines.length - 1)) {
      // More nuanced: skip if msgid is empty but msgstr is not
      const msgid = extractPoValue(lines, "msgid");
      if (msgid === "") continue;
    }

    // Skip fuzzy entries
    if (lines.some((l) => l.trim().startsWith("#,") && l.includes("fuzzy"))) {
      continue;
    }

    const msgctxtLine = lines.find((l) => l.trim().startsWith("msgctxt "));
    const context = msgctxtLine
      ? unescapePo(extractPoValue(lines, "msgctxt"))
      : undefined;
    const msgid = extractPoValue(lines, "msgid");
    const msgstr = extractPoValue(lines, "msgstr");

    if (msgid && msgstr) {
      const unescapedId = unescapePo(msgid);
      const unescapedStr = unescapePo(msgstr);
      if (context) {
        translations.set(poContextKey(context, unescapedId), unescapedStr);
        if (!translations.has(unescapedId)) {
          translations.set(unescapedId, unescapedStr);
        }
      } else {
        translations.set(unescapedId, unescapedStr);
      }
    }
  }

  return translations;
}

/**
 * Parse a PO file into structured entries (for detailed analysis).
 */
export function parsePoEntries(poContent: string): PoEntry[] {
  const entries: PoEntry[] = [];
  const blocks = poContent.trim().split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n");

    const references: string[] = [];
    const comments: string[] = [];
    const flags: string[] = [];
    let context: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#: ")) references.push(trimmed.slice(3));
      else if (trimmed.startsWith("#. ")) comments.push(trimmed.slice(3));
      else if (trimmed.startsWith("#, ")) {
        flags.push(...trimmed.slice(3).split(",").map((f) => f.trim()));
      }
    }

    const msgctxtLine = lines.find((l) => l.trim().startsWith("msgctxt "));
    if (msgctxtLine) {
      context = unescapePo(extractPoValue(lines, "msgctxt"));
    }

    const msgid = extractPoValue(lines, "msgid");
    const msgstr = extractPoValue(lines, "msgstr");

    if (msgid !== undefined) {
      entries.push({
        references,
        comments,
        flags,
        context,
        msgid: unescapePo(msgid),
        msgstr: unescapePo(msgstr),
      });
    }
  }

  // Filter out header entry
  return entries.filter((e) => e.msgid !== "");
}

/** Extract the value of a PO field (msgid, msgstr, msgctxt) from a block. */
function extractPoValue(lines: string[], field: string): string {
  let value = "";
  let inField = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith(`${field} `)) {
      inField = true;
      value = trimmed.slice(field.length + 1);
      continue;
    }

    // Another field starts
    if (trimmed.startsWith("msg") && !trimmed.startsWith('"')) {
      if (inField) break;
      continue;
    }

    // Continuation line
    if (inField && trimmed.startsWith('"')) {
      value += trimmed;
    }
  }

  // Strip surrounding quotes and concatenate
  return value
    .replace(/^"/, "")
    .replace(/"$/, "")
    .replace(/"\s*"/g, "");
}

/** Unescape a PO string value. */
function unescapePo(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// ── Injection-only constants ────────────────────────────────────
//
// The markdown-construct patterns are IMPORTED from `pot-extract.ts` — see the
// docblock there. They used to be declared again here, and "mirror" was doing
// real work in that sentence: nine were byte-identical, and `MD_CODE_FENCE_RE`
// was too until `ig4a` changed one side. Bean `wlyg`.
//
// What is left below is genuinely injection-only: it governs what this module
// SUBSTITUTES, which is a different question from what the extractor OFFERS.


// `MD_INJ_MIN_LEN = 3` stood here — a minimum in CHARACTERS, deciding what this
// module will SUBSTITUTE, while `isTranslatable` in `pot-extract.ts` decides what
// gets OFFERED. Those are the same question asked from two ends, and after `6b8u`
// moved the extractor to a count of LETTERS the two ends disagreed.
//
// Measured over `cat-harness/docs`: **468 occurrences of 46 distinct msgids** were
// extracted, handed to translators, and then structurally un-injectable because
// they are shorter than three characters. 23 are in `zh`, and they are ordinary
// two-character words — 原因, 标准, 选项, 代价 — which is exactly the population
// `6b8u` existed to stop dropping. It rescued them on the extract side and
// stranded them on the inject side.
//
// So the predicate is imported rather than restated. Bean `wlyg`: what the
// extractor treats as translatable and what the injector treats as translatable
// must be ONE answer.

// ── Injection ───────────────────────────────────────────────────

/** Result of injecting translations into markdown. */
export interface InjectionResult {
  /** The translated markdown content. */
  translated: string;
  /** Whether any substitutions were made. */
  changed: boolean;
  /** Statistics. */
  stats: {
    totalSpans: number;
    translatedSpans: number;
    untranslatedSpans: number;
  };
}

/**
 * Inject translations into a Markdown file.
 *
 * Takes its units from `segmentMarkdown()`, the segmentation `extractMarkdown()`
 * writes the catalogue from, so a wrapped paragraph, list item or blockquote is
 * looked up as the one joined `msgid` it was extracted as. For each, it looks
 * up the translation via the cleaned msgid, restores Liquid `{{ }}` syntax in the translated
 * string, and writes it back into the source lines.
 *
 * Mirrors upstream `inject_markdown()` in `inject_translations.py`
 * lines 608–818.
 */
export function injectMarkdown(
  sourceMd: string,
  translations: Map<string, string>,
): InjectionResult {
  const lines = sourceMd.split("\n");
  const outLines = [...lines];
  /**
   * Indices a multi-line span's substitution collapsed away — **not** lines that are empty.
   *
   * This used to be expressed by setting the line to `""` and ending the function
   * with `outLines.filter((line) => line !== "")`, under a comment reading
   * "Remove blank lines introduced by paragraph collapse". It removed every empty
   * line in the document, the author's included. Measured on the bean's own
   * five-line fixture (bean `rmor`): 3 blank lines in, 0 out — the heading ran
   * into the paragraph, the paragraph into the list, and the trailing paragraph
   * was absorbed by the list. In markdown that is a different document, and
   * `src/tools/translation.ts` writes it to disk.
   *
   * A value of `""` cannot distinguish "a line this function emptied" from "a
   * line the author left empty", so no filter over values can either. An index
   * can. The bean also offered a sentinel string; that is declined deliberately,
   * because it would owe a proof that no markdown line can equal the sentinel,
   * and a set of indices owes nothing.
   *
   * It fixes a second defect with the same change. A blank line inside a list
   * item makes the list LOOSE, so emptying a wrapped item's continuation altered
   * rendering before the global filter ever ran. Removing the line rather than
   * emptying it introduces no blank at all.
   */
  const collapsed = new Set<number>();
  let changed = false;
  let totalSpans = 0;
  let translatedSpans = 0;
  let untranslatedSpans = 0;

  /** Look up translation for raw text, return placeholder-restored result or null. */
  const translate = (rawText: string): string | null => {
    const tokens = cleanMarkdownWithTokens(rawText);
    const msgid = tokens.text;
    if (!isTranslatable(msgid)) return null;
    totalSpans++;
    let msgstr = translations.get(msgid);
    let matchedId = msgid;
    if (msgstr === undefined) {
      // Fallback for pre-G3 catalogues where code spans were stripped and
      // links were reduced to link text.
      const legacyId = msgid
        .replace(/\{code\d+\}/g, "")
        .replace(/<\/?a\d+>/g, "")
        .trim();
      if (legacyId && legacyId !== msgid) {
        msgstr = translations.get(legacyId);
        matchedId = legacyId;
      }
    }
    if (msgstr && msgstr !== matchedId) {
      translatedSpans++;
      const restored = restorePlaceholders(msgstr, tokens);
      // Preserve standalone image wrapper `![alt](src)` when translating alt text
      const imgMatch = rawText.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return `![${restored}](${imgMatch[2]})`;
      }
      return restored;
    }
    untranslatedSpans++;
    return null;
  };

  // The units are the extractor's own (`segmentMarkdown`), so what is looked up
  // here is by construction what `extractMarkdown` wrote into the catalogue. A
  // second state machine here is how a wrapped list item came to be looked up
  // one line at a time — see `MarkdownSpan`.
  /** Translated cells of each table row, by line index and cell position. */
  const rowCells = new Map<number, Map<number, string>>();
  for (const span of segmentMarkdown(sourceMd)) {
    const translated = translate(span.raw);
    if (!translated) continue;
    const [first, ...rest] = span.lines;
    if (span.kind === "table-cell") {
      const cells = rowCells.get(first.idx) ?? new Map<number, string>();
      cells.set(span.cell!, translated);
      rowCells.set(first.idx, cells);
      continue;
    }
    // The whole translation goes on the first line, after the original's marker
    // and indentation; the lines it wrapped over are removed, which markdown
    // reads as the same paragraph, item or quote.
    outLines[first.idx] = span.prefix + translated;
    for (const line of rest) collapsed.add(line.idx);
    changed = true;
  }
  for (const [idx, translatedCells] of rowCells) {
    const cells = splitTableCells(lines[idx].trim().slice(1, -1));
    const newCells = cells.map((cell, i) => {
      const translated = translatedCells.get(i);
      if (translated === undefined) return cell;
      // Preserve original cell whitespace for alignment
      const leading = cell.slice(0, cell.length - cell.trimStart().length) || " ";
      const trailing = cell.slice(cell.trimEnd().length) || " ";
      return leading + translated + trailing;
    });
    outLines[idx] = "|" + newCells.join("|") + "|";
    changed = true;
  }

  // Drop exactly the continuation lines a collapsed paragraph left behind. Every
  // other line survives, blank ones included — see `collapsed` above for the
  // defect this spelling replaces.
  const result = outLines.filter((_, idx) => !collapsed.has(idx)).join("\n");

  return {
    translated: result || sourceMd,
    changed,
    stats: {
      totalSpans,
      translatedSpans,
      untranslatedSpans,
    },
  };
}

/**
 * Translate a single manifest string field (e.g. `title`, `caption`,
 * `narrative.text`), consulting the `msgctxt`-qualified key first and
 * falling back to the uncontextualized `msgid`.
 */
export function translateManifestText(
  rawText: string,
  translations: Map<string, string>,
  msgctxt?: string,
): string {
  if (!rawText) return rawText;
  const tokens = cleanMarkdownWithTokens(rawText);
  const msgid = tokens.text || cleanMarkdownText(rawText);
  if (!msgid) return rawText;
  let msgstr =
    (msgctxt ? translations.get(poContextKey(msgctxt, msgid)) : undefined) ??
    translations.get(msgid);
  if (msgstr === undefined) {
    const legacyId = msgid
      .replace(/\{code\d+\}/g, "")
      .replace(/<\/?a\d+>/g, "")
      .trim();
    if (legacyId && legacyId !== msgid) {
      msgstr =
        (msgctxt ? translations.get(poContextKey(msgctxt, legacyId)) : undefined) ??
        translations.get(legacyId);
    }
  }
  if (!msgstr) return rawText;
  return restorePlaceholders(msgstr, tokens);
}

/**
 * Return a shallow copy of a block manifest with its translatable fields
 * (`title`, `caption`, `narrative`, `defaultView.title`, `views[].title`)
 * translated from `translations` (G4 + G5).
 */
export function translateBlockFields<T>(
  block: T,
  translations: Map<string, string>,
  locale?: string,
): T {
  if (!block || typeof block !== "object" || translations.size === 0) {
    return block;
  }
  const copy = { ...(block as Record<string, unknown>) };

  if (typeof copy.title === "string" && copy.title) {
    copy.title = translateManifestText(copy.title, translations, "title");
  }

  if (typeof copy.caption === "string" && copy.caption) {
    copy.caption = translateManifestText(copy.caption, translations, "caption");
  }

  if (
    copy.defaultView &&
    typeof copy.defaultView === "object" &&
    typeof (copy.defaultView as { title?: unknown }).title === "string"
  ) {
    const dv = { ...(copy.defaultView as Record<string, unknown>) };
    dv.title = translateManifestText(
      dv.title as string,
      translations,
      "defaultView.title",
    );
    copy.defaultView = dv;
  }

  if (Array.isArray(copy.views)) {
    copy.views = copy.views.map((v, idx) => {
      if (v && typeof v === "object" && typeof (v as { title?: unknown }).title === "string") {
        return {
          ...(v as Record<string, unknown>),
          title: translateManifestText(
            (v as { title: string }).title,
            translations,
            `views[${idx}].title`,
          ),
        };
      }
      return v;
    });
  }

  if (typeof copy.narrative === "string" && copy.narrative) {
    copy.narrative = translateManifestText(
      copy.narrative,
      translations,
      "narrative.text",
    );
  } else if (Array.isArray(copy.narrative)) {
    const enEntry = copy.narrative.find(
      (n: unknown) =>
        n &&
        typeof n === "object" &&
        (n as { state?: string }).state !== "not-authored" &&
        typeof (n as { text?: unknown }).text === "string",
    ) as { text: string; lang?: string; state?: string } | undefined;
    if (enEntry?.text) {
      const translatedText = translateManifestText(
        enEntry.text,
        translations,
        "narrative.text",
      );
      if (translatedText !== enEntry.text) {
        if (locale) {
          const existingIdx = copy.narrative.findIndex(
            (n: unknown) =>
              n &&
              typeof n === "object" &&
              (n as { lang?: string }).lang?.toLowerCase() === locale.toLowerCase(),
          );
          if (existingIdx >= 0) {
            copy.narrative = copy.narrative.map((n: unknown, i: number) =>
              i === existingIdx
                ? { ...(n as Record<string, unknown>), text: translatedText }
                : n,
            );
          } else {
            copy.narrative = [
              ...copy.narrative,
              { ...(enEntry as Record<string, unknown>), lang: locale, text: translatedText },
            ];
          }
        } else {
          copy.narrative = copy.narrative.map((n: unknown) =>
            n === enEntry
              ? { ...(enEntry as Record<string, unknown>), text: translatedText }
              : n,
          );
        }
      }
    }
  } else if (
    copy.narrative &&
    typeof copy.narrative === "object" &&
    typeof (copy.narrative as { text?: unknown }).text === "string"
  ) {
    const rawText = (copy.narrative as { text: string }).text;
    const translatedText = translateManifestText(
      rawText,
      translations,
      "narrative.text",
    );
    if (translatedText !== rawText) {
      copy.narrative = {
        ...(copy.narrative as Record<string, unknown>),
        text: translatedText,
      };
    }
  }

  return copy as T;
}
