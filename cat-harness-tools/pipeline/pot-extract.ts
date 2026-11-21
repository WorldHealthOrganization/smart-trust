/**
 * Markdown translation string extractor — POT generation.
 *
 * Extracts translatable strings from folio content `.md` files into
 * GNU gettext `.pot` (Portable Object Template) format.
 *
 * ## Origin: the upstream `extract_translations.py`
 *
 * This module is a TypeScript port of the markdown extraction logic in
 * <https://github.com/WorldHealthOrganization/smart-base/blob/main/input/scripts/extract_translations.py>
 * ("upstream" below; lines 530–920, function `extract_markdown` and helpers). The Python
 * original handles FHIR IG narrative pages under `input/pagecontent/`;
 * this handles folio content blocks. The extraction logic is generic
 * markdown processing, not WHO-specific, so it lives in folio-assistant
 * rather than being loaded from upstream. The upstream copy remains.
 *
 * ## What it extracts
 *
 * - Prose paragraphs (accumulated across continuation lines → one `msgid`)
 * - Headings (each heading → one `msgid`)
 * - List items (each item, with the lines it wraps over → one `msgid`,
 *   bullet/number stripped)
 * - Blockquotes (consecutive `>` lines at one depth → one `msgid`, prefix
 *   stripped)
 * - Table cells (each cell → one `msgid`)
 * - Image alt text
 *
 * ## What it skips (non-translatable)
 *
 * - YAML front matter (`---` delimited)
 * - Fenced code blocks (``` or ~~~, any fence length)
 * - HTML `<style>`, `<script>`, `<pre>` blocks
 * - Kramdown/Jekyll attribute lists (`{: .class}`, `{:toc}`)
 * - Horizontal rules (`---`, `***`, `___`)
 * - Table separator rows (`|---|---|`)
 * - Strings shorter than 3 characters after cleaning
 *
 * ## Text cleaning (mirrors upstream `_clean_markdown_text`)
 *
 * Before emitting a `msgid`, inline formatting is stripped:
 * - HTML comments removed
 * - Images → alt text only
 * - Links → link text only
 * - Angle-bracket autolinks removed
 * - Inline code spans removed
 * - Bold/italic markers stripped (content preserved)
 * - HTML tags removed
 * - Liquid `{% %}` control tags removed (upstream compat)
 * - Liquid `{{ expr }}` → `{lqd_expr}` gettext brace vars (upstream compat)
 *
 * @module pipeline/pot-extract
 */

// ── Text cleaning patterns (mirrors upstream _clean_markdown_text) ──────

const MD_HTML_COMMENT_RE = /<!--.*?-->/gs;
const MD_IMAGE_RE = /!\[([^\]]*)\]\([^)]*\)/g;
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]*)\)/g;
const MD_ANGLE_LINK_RE = /<https?:\/\/[^>]+>/g;
const MD_INLINE_CODE_RE = /`[^`]+`/g;
const MD_BOLD_RE = /\*{2,3}([^*]+)\*{2,3}/g;
const MD_ITALIC_STAR_RE = /(?<!\*)\*([^*]+)\*(?!\*)/g;
/**
 * `_emphasis_`, with CommonMark's INTRAWORD rule — bean `o29r`.
 *
 * A `_` cannot OPEN emphasis when preceded by a word character, and cannot CLOSE
 * when followed by one. That is what makes `$a_1$ and $b_2$` literal text in
 * every conforming renderer, and `snake_case_name` an identifier rather than a
 * word with emphasis inside it.
 *
 * `\w` rather than `[_\w]`, because JavaScript's `\w` is `[A-Za-z0-9_]` and
 * already contains the underscore — the class was redundant. Checked rather than
 * reasoned: the two spellings agree on all 20 cases in the tests below and on
 * 200 000 random strings over `_ab1 .-*$\{}`, the alphabet where the boundary
 * could differ.
 *
 * Without the guard, ANY TWO underscores in one extracted string paired up and
 * both were deleted. One subscript alone was safe because the regex needs a
 * second `_` to close on, so **two is the threshold** — and two is the ordinary
 * case in mathematical prose. Measured, current extractor against this one with
 * only this line changed: 229 corrupted msgids of 46306 here, and 13251 of
 * 211139 in `litlfred/qou`.
 *
 * The severity is set by what it does to mathematics rather than to spelling:
 * `$w_\lambda$` became `$w\lambda$`, and `\sum_{\lambda_i}` became
 * `\sum{\lambdai}` — a DIFFERENT expression, and `\sum{...}` is not valid LaTeX
 * at all, so a translator handed the msgid could not reconstruct the source.
 * Here it mangled ids instead: `Process_CodeChangeReview/Task_ClaimBean`
 * extracted as `ProcessCodeChangeReview/TaskClaimBean`.
 *
 * The site was right and the gate was wrong — kramdown renders the subscript
 * this regex stripped, so the corrupted msgid never matched the page.
 */
const MD_ITALIC_UNDER_RE = /(?<!\w)_([^_]+)_(?!\w)/g;
const MD_HTML_TAG_RE = /<[^>]+>/g;
const MD_LIQUID_TAG_RE = /\{%.*?%\}/gs;
const MD_LIQUID_OUTPUT_RE = /\{\{\s*(.*?)\s*\}\}/gs;

// ── Structural patterns ─────────────────────────────────────────

/**
 * The markdown constructs this pipeline recognises, shared with `po-inject.ts`.
 *
 * **Exported because the injecting half declared its own copies.** What the
 * extractor treats as a construct and what the injector treats as a construct
 * are the same question, so two answers can disagree — and one already had:
 * `MD_CODE_FENCE_RE` was byte-identical in both modules until `ig4a` changed one
 * side, and a grep was the only thing between that and a round trip whose halves
 * parsed differently. Bean `wlyg`.
 *
 * Nine of the ten were identical when they moved, so this is **hygiene, not a bug
 * fix**, and it is worth doing now for a specific reason: `lvk9` changes
 * {@link MD_LIST_ITEM_RE} and {@link MD_BLOCKQUOTE_RE}, and doing that against two
 * copies means doing it twice, in the copy nobody is watching.
 *
 * Proven a pure move rather than asserted to be one: extraction over all 618
 * files of `cat-harness/docs`, and `injectMarkdown` over every real (catalogue,
 * source) pair, are byte-identical before and after.
 */
export const MD_FRONT_MATTER_DELIM = /^---\s*$/;
export const MD_HEADING_RE = /^(#{1,6}\s+)(.+)$/;
/**
 * A fenced code block's delimiter.
 *
 * **Exported because `po-inject.ts` had its own copy of it.** One fact in two
 * places is free to drift, and this one had: `ig4a` fixed the anchor here, and
 * the injector's copy would have kept the old one.
 *
 * **What that divergence was NOT.** The first version of this comment said the
 * injector would substitute into an indented code block and corrupt the command.
 * That was asserted, then measured, and it is false: with the old anchor the
 * injector substitutes nothing inside an indented fence, for prose or for code
 * (`derive-po.test.ts` §"the two halves ... agree"). Something else already
 * protects it. So this consolidation is hygiene rather than a bug fix, and saying
 * otherwise would have made a stronger claim than the evidence carries.
 *
 * The `^` is matched against the STRIPPED line at both call sites, not the raw
 * one — see the comment at the fence branch in {@link extractMarkdown}.
 */
export const MD_CODE_FENCE_RE = /^(`{3,}|~{3,})/;
export const MD_HTML_SKIP_OPEN_RE = /<(style|script|pre)\b/i;
export const MD_HTML_CLOSE_TAG_RE = /<\/(\w+)\s*>/i;
export const MD_HLINE_RE = /^[-*_]{3,}\s*$/;
export const MD_TABLE_SEP_RE = /^\|[-| :]+\|?\s*$/;
export const MD_LIST_ITEM_RE = /^(\s*(?:[-*+]|\d+\.)\s+)(.*)/;
export const MD_BLOCKQUOTE_RE = /^(>+\s?)(.*)/;
export const MD_KRAMDOWN_ATTR_RE = /^\{[:%][^}]*\}\s*$/;
/**
 * The kramdown directive that CONSUMES the block it attaches to.
 *
 * `{:toc}` replaces the preceding list with a generated table of contents, so
 * that list's text **never reaches a reader in any language**. Every other
 * directive here attaches attributes and leaves the block rendering — a
 * measured distinction rather than a guessed one: across this layer's docs
 * the directive vocabulary is `{: .note }` (232), `{: .fa-edit-source }` (276),
 * `{: .no_toc }` (38), `{: .fa-hx-dim }` (22) and others, and **only `{:toc}`
 * consumes.** Widening this regex to all of them would delete real prose from
 * the catalogue, which is strictly worse than the bug it fixes.
 *
 * `{: .no_toc }` is the near miss worth naming: it is about the table of
 * contents, it sits beside a heading a reader DOES see, and matching on "toc"
 * rather than on the exact directive would drop that heading.
 */
const MD_KRAMDOWN_CONSUMING_RE = /^\{:\s*toc\s*\}$/;

/**
 * Opening line of a standalone LaTeX math/diagram environment in Markdown.
 * Shared with `po-inject.ts` so both halves skip multi-line display math blocks.
 */
export const MD_MATH_ENV_OPEN_RE =
  /^\\begin\{(equation\*?|align\*?|aligned|gather\*?|gathered|multline\*?|flalign\*?|[pbBvV]?matrix|cases|split|array|tikzcd|tikzpicture)\}/;

/**
 * Strip non-translatable tokens (math spans, inline-code placeholders, Liquid
 * placeholders, and link tags) before counting letters in {@link isTranslatable}.
 */
export function stripNonTranslatableTokens(text: string): string {
  return text
    .replace(/\$\$[\s\S]+?\$\$/g, "")
    .replace(/\\\[[\s\S]+?\\\]/g, "")
    .replace(/\\begin\{([a-zA-Z]+\*?)\}[\s\S]*?\\end\{\1\}/g, "")
    .replace(/\\\([\s\S]+?\\\)/g, "")
    .replace(/(?<!\\|\$)\$(?!\$|\s)(?:\\.|[^$\\\n])*?(?<!\\|\s)\$(?!\$)/g, "")
    .replace(/\{code\d+\}/g, "")
    .replace(/\{lqd_[^{}\n]+\}/g, "")
    .replace(/<\/?a\d+>/g, "");
}

/**
 * Split the interior of a Markdown pipe-table row (`stripped.slice(1, -1)`)
 * into cells without splitting on `|` inside inline code (`` `a | b` ``),
 * inline math (`$|\psi|^2$`), or escaped pipes (`\|`).
 */
export function splitTableCells(rowInner: string): string[] {
  const masked = rowInner
    .replace(/\\./g, "  ")
    .replace(MD_INLINE_CODE_RE, (m) => " ".repeat(m.length))
    .replace(/\$\$[\s\S]+?\$\$/g, (m) => " ".repeat(m.length))
    .replace(/(?<!\\|\$)\$(?!\$|\s)(?:\\.|[^$\\\n])*?(?<!\\|\s)\$(?!\$)/g, (m) =>
      " ".repeat(m.length),
    );
  const cells: string[] = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "|") {
      cells.push(rowInner.slice(start, i));
      start = i + 1;
    }
  }
  cells.push(rowInner.slice(start));
  return cells;
}

/**
 * Is there anything here a translator can act on?
 *
 * **A count of LETTERS, not of characters, and the difference is not cosmetic.**
 * This was `text.length >= 3` until 2026-09-26, which made translatability a
 * property of the locale's script rather than of the content. Bean `6b8u`.
 *
 * The mechanism, on a real cell of `docs/start/installation.md` — after
 * {@link cleanMarkdownText} strips the code spans:
 *
 * | | cell | residue | extracted at `length >= 3`? |
 * |---|---|---|---|
 * | source | `` `pandoc`, `ripgrep` `` | `", "` (2 chars) | no |
 * | `ar` | `` `pandoc`، و`ripgrep` `` | `"، و"` (3 chars) | **yes** |
 *
 * The Arabic comma and the conjunction are a correct localisation, and they
 * pushed a code-only cell over a threshold English sat under — so an identical
 * 4x7 table yielded 66 constructs in `ar` against 65 in English. It ran the
 * other way for dense scripts: `否` is one character and was dropped where
 * `non` and `нет` were kept, which is why `zh` measured short on all five of
 * the pages `derive-po.ts` tried to align.
 *
 * ## Why two letters, measured rather than chosen
 *
 * Four candidates, scored over `cat-harness/docs/` (618 files) on two things:
 * how many of the 25 (page, locale) pairs align by count AND kind, and how many
 * msgids contain **no letter at all** — a string offered to a translator with
 * nothing in it to translate.
 *
 * | predicate | aligned | msgids | letterless |
 * |---|---|---|---|
 * | `length >= 3` (what this replaces) | 7/25 | 45320 | **432** |
 * | `>= 1` letter | 9/25 | 45458 | 0 |
 * | **`>= 2` letters** | **10/25** | 45288 | **0** |
 * | `>= 1` letter and `>= 2` non-space | 9/25 | 45419 | 0 |
 *
 * Two letters wins on both measures at once, and the letterless column is the
 * one that settles it: the old rule put **432** msgids with no letter in them
 * into this corpus's catalogues, and every candidate here removes all of them.
 *
 * **It is not primarily an alignment fix, and the first account of it said
 * otherwise.** That account inferred "9 of the 18 refusals are extractor
 * artefacts" by stitching together a count measurement and a kind measurement
 * taken separately. Measured directly on the thing that matters — count and
 * kind together — this predicate plus the fence fix takes alignment from 7/25
 * to **10/25**. Three more, not nine. The remaining 15 are `7x8o`.
 *
 * `\p{L}` rather than `[A-Za-z]` for the obvious reason, and `u` because
 * without it the property escape is a syntax error rather than a silent
 * mismatch.
 */
export function isTranslatable(text: string): boolean {
  // A single ideograph IS a word, where a single Latin letter is not. The owner's
  // decision of 2026-09-27 on bean `6b8u`, **on the merits and explicitly not on
  // alignment** — which the measurement below says it does not improve.
  //
  // `MD_MIN_TEXT_LETTERS` is a count, and a count is not script-neutral. Two
  // letters is a reasonable proxy for "a word" in an alphabetic script and a wrong
  // one in a logographic script: `是` and `否` are the complete words "yes" and
  // "no", while `y` and `n` are abbreviations of words.
  //
  // Measured over 660 files / 46 800 msgids before the change: this admits
  // **exactly two strings, four times each** — `是` and `否`, in yes/no cells of
  // comparison tables in `docs/guides/zh/agent-onboarding.md`,
  // `docs/guides/zh/document-ingestion.md` and `docs/start/zh/getting-started.md`. Eight cells.
  //
  // **It does not improve alignment, and must never be cited as if it did.**
  // `derive-po` reports 57 derived / 13 refused either way, with an identical
  // breakdown (`count-differs` 10, `msgid-conflict` 3). On the one pair it was
  // once hoped to fix it swaps one misalignment for another: `zh/getting-started`
  // goes from source 149 / translation 145 to 149 / **150**, short by four
  // becoming long by one. That was measured twice, on 2026-09-26 and again on
  // 2026-09-27 after `o29r` and `3mo4` moved 438 msgids between them.
  const prose = stripNonTranslatableTokens(text);
  if (MD_IDEOGRAPH_RE.test(prose)) return true;
  let letters = 0;
  for (const ch of prose) {
    if (/\p{L}/u.test(ch) && ++letters >= MD_MIN_TEXT_LETTERS) return true;
  }
  return false;
}

/**
 * Scripts in which ONE character can be a whole word.
 *
 * Han, Hiragana, Katakana and Hangul. Named and separate for the same reason
 * `MD_MIN_TEXT_LETTERS` is: a later change has to argue with the measurement in
 * {@link isTranslatable} rather than edit an inline pattern.
 *
 * Not a list of the two characters this currently admits. The owner's decision
 * was about the property — a single ideograph is a word — and a vocabulary of
 * `是`/`否` would need maintaining every time a page gains a third, which is a
 * rule expressed as a backlog.
 */
const MD_IDEOGRAPH_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * How many letters make a string worth a translator's attention.
 *
 * Named and separate so the measurement above has something to refer to, and so
 * a later change has to argue with the table rather than edit a bare `2`.
 */
const MD_MIN_TEXT_LETTERS = 2;

/** Prefix for Liquid output variables in gettext brace format. */
const LQD_PREFIX = "lqd_";

// ── Text cleaning ───────────────────────────────────────────────

/**
 * Strip markdown formatting from a text fragment to obtain plain text
 * suitable for a `msgid` value.
 *
 * Mirrors upstream `_clean_markdown_text()` in
 * `extract_translations.py` lines 633–697. The Liquid expression
 * handling preserves the upstream `{lqd_expr}` convention for IG
 * Publisher compatibility.
 */
export interface CleanedMarkdown {
  text: string;
  codeSpans: string[];
  linkTargets: string[];
}

/**
 * Clean markdown formatting while returning the extracted inline code spans
 * and link targets so `po-inject.ts` can restore `{code0}`, `<a0>…</a0>`,
 * etc. after translation lookup (G1 + G3).
 */
export function cleanMarkdownWithTokens(text: string): CleanedMarkdown {
  // A Liquid control tag inside a link target is part of the target, so it
  // is set aside here and put back in the recorded target below; every other
  // Liquid control tag is removed first, as before.
  const lqtTokens: string[] = [];
  let result = text.replace(MD_LINK_RE, (m, label: string, target: string) =>
    target.includes("{%")
      ? `[${label}](${target.replace(MD_LIQUID_TAG_RE, (tag) => {
        lqtTokens.push(tag);
        return `\x00LQT${lqtTokens.length - 1}\x00`;
      })})`
      : m);
  result = result.replace(MD_LIQUID_TAG_RE, "");

  // Tokenise Liquid output expressions to protect underscores from italic regex
  const lqdTokens: string[] = [];
  const lqdRaw: string[] = [];
  result = result.replace(MD_LIQUID_OUTPUT_RE, (match, expr: string) => {
    lqdTokens.push(expr.trim());
    lqdRaw.push(match);
    return `\x00LQD${lqdTokens.length - 1}\x00`;
  });

  // Remove HTML comments
  result = result.replace(MD_HTML_COMMENT_RE, "");

  // Tokenise inline code spans FIRST so backticks protect `$`, `[...]`, `*`,
  // `_`, and `<...>` inside code spans, and survive as `{code0}`, `{code1}`, ...
  // in the extracted msgid (G3) while still giving surrounding emphasis a
  // non-empty token between its markers (bean `3mo4`).
  const codeSpans: string[] = [];
  result = result.replace(MD_INLINE_CODE_RE, (m) => {
    const idx = codeSpans.length;
    codeSpans.push(m);
    return `\x00CODE${idx}\x00`;
  });

  // Tokenise math spans BEFORE links, emphasis, and HTML tag stripping so
  // `$a*b*c$`, subscripts `\sum_{\lambda_i}`, and `<`/`>` inside math
  // survive untouched in the extracted msgid (G1).
  const mathTokens: string[] = [];
  const pushMath = (m: string): string => {
    const idx = mathTokens.length;
    mathTokens.push(m);
    return `\x00MATH${idx}\x00`;
  };
  result = result.replace(/\$\$[\s\S]+?\$\$/g, pushMath);
  result = result.replace(/\\\[[\s\S]+?\\\]/g, pushMath);
  result = result.replace(/\\begin\{([a-zA-Z]+\*?)\}[\s\S]*?\\end\{\1\}/g, pushMath);
  result = result.replace(/\\\([\s\S]+?\\\)/g, pushMath);
  result = result.replace(
    /(?<!\\|\$)\$(?!\$|\s)(?:\\.|[^$\\\n])*?(?<!\\|\s)\$(?!\$)/g,
    pushMath,
  );

  // Replace images with alt text
  result = result.replace(MD_IMAGE_RE, "$1");

  // Tokenise links as `<a0>text</a0>` while preserving target URLs for
  // restoration on injection (G3) and allowing emphasis inside link text to
  // be cleaned below.
  const linkTargets: string[] = [];
  // A target is recorded as the author wrote it: the Liquid, code and math
  // set aside above are put back, since `po-inject` writes the target out
  // verbatim (a downstream page's `{{game_lang}}` link came out as `<NUL>LQD0<NUL>`).
  const asWritten = (target: string): string =>
    target.replace(/\x00(LQD|LQT|CODE|MATH)(\d+)\x00/g, (m, kind: string, i: string) => {
      const n = Number(i);
      const v = kind === "LQD" ? lqdRaw[n] : kind === "LQT" ? lqtTokens[n] : kind === "CODE" ? codeSpans[n] : mathTokens[n];
      return v ?? m;
    });
  result = result.replace(MD_LINK_RE, (_m, label: string, target: string) => {
    const idx = linkTargets.length;
    linkTargets.push(asWritten(target));
    return `\x00AOPEN${idx}\x00${label}\x00ACLOSE${idx}\x00`;
  });

  // Remove angle-bracket autolinks
  result = result.replace(MD_ANGLE_LINK_RE, "");

  // Strip bold/italic markers (keep content)
  result = result.replace(MD_BOLD_RE, "$1");
  result = result.replace(MD_ITALIC_STAR_RE, "$1");
  result = result.replace(MD_ITALIC_UNDER_RE, "$1");

  // Remove remaining HTML tags (before restoring `<a0>...</a0>` so link
  // placeholders are not stripped as HTML tags)
  result = result.replace(MD_HTML_TAG_RE, "");

  // Restore link placeholders, code placeholders, math spans, and Liquid tokens
  result = result.replace(/\x00AOPEN(\d+)\x00/g, "<a$1>");
  result = result.replace(/\x00ACLOSE(\d+)\x00/g, "</a$1>");
  for (let i = 0; i < codeSpans.length; i++) {
    result = result.replace(`\x00CODE${i}\x00`, `{code${i}}`);
  }
  for (let i = 0; i < mathTokens.length; i++) {
    result = result.replace(`\x00MATH${i}\x00`, () => mathTokens[i]);
  }
  for (let i = 0; i < lqdTokens.length; i++) {
    result = result.replace(`\x00LQD${i}\x00`, () => `{${LQD_PREFIX}${lqdTokens[i]}}`);
  }
  // A tag set aside in an image's source, whose target is not kept, goes as any other tag does.
  result = result.replace(/\x00LQT\d+\x00/g, "");

  return { text: result.trim(), codeSpans, linkTargets };
}

export function cleanMarkdownText(text: string): string {
  return cleanMarkdownWithTokens(text).text;
}

// ── POT entry ───────────────────────────────────────────────────

/**
 * What KIND of markdown construct an entry came from.
 *
 * Added for `derive-po.ts` (issue #206), which aligns an already-translated
 * page against its source to recover a `.po` catalogue. Alignment is positional,
 * so it needs a way to be REFUSED when the two sides are not the same shape —
 * and a count match is not that. Measured 2026-09-26: of the 25 uncatalogued
 * (page, locale) pairs, 9 matched by count, and a count match does not rule out
 * two adjacent constructs having swapped. The kind sequence does.
 *
 * Not emitted into the `.pot` — `formatPot` ignores it, so the on-disk format is
 * unchanged and every existing catalogue still parses.
 */
export type PotEntryKind =
  // From markdown prose — the five constructs `extractMarkdown` recognises.
  | "heading"
  | "paragraph"
  | "list-item"
  | "blockquote"
  | "table-cell"
  // Not markdown at all. Named rather than made optional, so a new producer has
  // to DECIDE — the rule this repository applies to graph typologies, where "a kind
  // that has not decided does not compile". An optional field would let a
  // producer stay silent, and `derive-po.ts` would then align against entries
  // whose shape it cannot check.
  | "bpmn-label"
  | "manifest-title"
  | "manifest-caption"
  | "manifest-narrative"
  | "ui-string"
  // A text field of a JSON node, named by its path in `msgctxt`
  // (`pot-for-user-scenarios.ts`: a user scenario's titles and narrative).
  | "json-field"
  // A glossary term's label, alternative label or definition
  // (the content core's glossary producer). Declared 2026-09-30: that
  // producer predates `kind` and never decided, which compiled only because its
  // directory is outside tsconfig's include list.
  | "glossary-term"
  // A segment of a rendered page (`html-po.ts`): a visualiser's words, taken
  // from the page a reader reads (`scripts/journeys/locales.ts`).
  | "html-text";

/** A single translatable entry extracted from a source file. */
export interface PotEntry {
  /** Source file path (relative to content root). */
  source: string;
  /** Line number in source file (1-based). */
  line: number;
  /** The msgid — the cleaned source string to translate. */
  msgid: string;
  /** Which construct it came from — see {@link PotEntryKind}. */
  kind: PotEntryKind;
  /** Optional gettext context (e.g. manifest field name: "title", "caption"). */
  msgctxt?: string;
  /** Published/context URL for Weblate (optional). */
  contextUrl?: string;
  /** Optional translator comment. */
  comment?: string;
}

// ── Markdown segmentation (mirrors upstream extract_markdown) ───

/** The markdown constructs {@link segmentMarkdown} cuts a page into. */
export type MarkdownSpanKind = Extract<
  PotEntryKind,
  "heading" | "paragraph" | "list-item" | "blockquote" | "table-cell"
>;

/**
 * One unit of translation in a markdown page: what becomes ONE `msgid` on the
 * extract side and is replaced by ONE `msgstr` on the inject side.
 *
 * Both halves read this, rather than each walking the lines with its own state
 * machine. They used to, and the injector's copy did not learn that a wrapped
 * list item or blockquote is one unit when the extractor did (bean `lvk9`): the
 * catalogue held the joined sentence, the injector looked up the first line on
 * its own, found nothing, and left the page in English after its first line.
 */
export interface MarkdownSpan {
  kind: MarkdownSpanKind;
  /**
   * The source lines the span covers, in order, by 0-based index into
   * `md.split("\n")`, each with the text it contributes — marker, `>` prefix
   * and surrounding whitespace removed. A table cell has exactly one.
   */
  lines: Array<{ idx: number; text: string }>;
  /** The lines' text joined with single spaces: what the `msgid` is cleaned from. */
  raw: string;
  /**
   * What stands before the text on the first line and must survive a
   * substitution: `## ` for a heading, the indentation and marker of a list
   * item, the `>` run of a blockquote. Empty for a paragraph and a table cell.
   */
  prefix: string;
  /** For a table cell, its position in `splitTableCells` of its row. */
  cell?: number;
}

/**
 * Cut a markdown page into its translation units.
 *
 * Uses the same state machine as upstream `extract_markdown()`:
 * YAML front matter → fenced code blocks → HTML skip blocks →
 * blank lines → headings → horizontal rules → list items →
 * blockquotes → table rows → kramdown attributes → paragraph
 * continuation. A paragraph, a list item and a blockquote are each
 * accumulated across the lines they wrap over, so each is ONE span.
 *
 * Every span is returned, translatable or not; the caller decides with
 * {@link isTranslatable} on the cleaned {@link MarkdownSpan.raw}. A list that a
 * consuming kramdown directive (`{:toc}`) replaces is not returned at all.
 */
export function segmentMarkdown(md: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  const lines = md.split("\n");

  let inFrontMatter = false;
  let inCodeBlock = false;
  let codeFence: string | null = null;
  let inHtmlBlock = false;
  let htmlCloseTag = "";
  let inMathBlock: string | null = null;
  /**
   * The multi-line construct currently being accumulated.
   *
   * **Paragraphs were accumulated and list items and blockquotes were not**, so a
   * msgid's identity depended on where the author pressed return — and a wrapped
   * list item's continuation line fell through to the paragraph accumulator, so it
   * came out as a `paragraph`. Wrong count and wrong KIND from one cause. Bean
   * `lvk9`.
   *
   * The cost was not the count. A translator was handed one sentence as two
   * msgids, with a `**` span opening in the first and closing in the second:
   * neither half can be rendered, and no word order differing from English is
   * expressible at all.
   *
   * One accumulator for all three kinds, because the alternative is three copies
   * of the same flush logic and `wlyg` is this file's evidence for what duplicated
   * parsing rules do.
   */
  type PendingKind = "paragraph" | "list-item" | "blockquote";
  let pending:
    | {
        kind: PendingKind;
        lines: Array<{ idx: number; text: string }>;
        /** See {@link MarkdownSpan.prefix}. */
        prefix: string;
        /** For a list item, the column its content starts at — see {@link continuesItem}. */
        contentCol: number;
        /** For a blockquote, how many `>` deep it is. A change in depth is a new quote. */
        depth: number;
      }
    | null = null;

  /**
   * Emit the accumulated construct as ONE span, at the line it started on.
   *
   * The caller cleans the JOINED text rather than each line, which is the half
   * that fixes the split `**` span: an emphasis run opened on one line and
   * closed on the next is a single span once the lines are joined, and nothing
   * else can make it one.
   */
  const flushPending = (): void => {
    if (pending === null) return;
    const raw = pending.lines.map((p) => p.text).join(" ");
    spans.push({ kind: pending.kind, lines: pending.lines, raw, prefix: pending.prefix });
    pending = null;
  };

  /**
   * Where the current run of consecutive list items began in `spans`.
   *
   * `null` when the last significant line was not a list item. A kramdown
   * directive that CONSUMES its block arrives AFTER the list it replaces, so
   * the items are already in `spans` by then — this is what lets them be
   * taken back out. Bean `lrbx`.
   *
   * A run, not a single item, because `{:toc}` attaches to the whole list. The
   * placeholder is conventionally one item (`1. TOC`), but a two-item
   * placeholder would otherwise leak its second line, and the directive's
   * semantics do not care how many there are.
   */
  /**
   * Does this line continue the list item being accumulated?
   *
   * **Indentation, not line adjacency.** The rule that measured this defect's
   * reach merged any entry sitting on the immediately next line, and it
   * over-merged — in `wireframes/fsh-guts/intent.md` it joined two unrelated
   * sentences. What markdown actually says is that a continuation is INDENTED
   * under the marker and ends at a blank line or the next block, so that is what
   * this tests.
   *
   * Indented-at-all rather than `>= contentCol`: a continuation one space shy of
   * the content column is still unambiguously a continuation, while an
   * UNINDENTED line is exactly the case that must not be swallowed — it is the
   * following paragraph. (`contentCol` is kept on `pending` because a stricter
   * rule may want it, and because it documents what the marker was.)
   *
   * Every other block construct is excluded explicitly. A list of exclusions is
   * the wrong shape in general, but here each one is a branch that appears ABOVE
   * this point in the loop, so omitting one would mean a construct silently
   * absorbed into a list item's msgid.
   */
  const continuesItem = (line: string, stripped: string): boolean =>
    pending?.kind === "list-item" &&
    stripped !== "" &&
    /^\s/.test(line) &&
    !MD_LIST_ITEM_RE.test(line) &&
    !MD_HEADING_RE.test(line) &&
    !MD_BLOCKQUOTE_RE.test(line) &&
    !MD_HLINE_RE.test(stripped) &&
    !MD_TABLE_SEP_RE.test(stripped) &&
    !MD_KRAMDOWN_ATTR_RE.test(stripped) &&
    !MD_CODE_FENCE_RE.test(stripped) &&
    !stripped.startsWith("$$") &&
    !stripped.startsWith("\\[") &&
    !MD_MATH_ENV_OPEN_RE.test(stripped) &&
    !(stripped.startsWith("|") && stripped.endsWith("|"));

  let listRunStart: number | null = null;
  /** Blank lines do not end a list run — a loose list has them between items. */
  const endListRun = (): void => {
    listRunStart = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineno = idx + 1;
    const stripped = line.trim();

    // A run of list items ends at the first line that is neither another item,
    // a blank (loose lists have blanks between items), nor the attribute list
    // that may terminate it. Ending the run CONSERVATIVELY is the safe
    // direction: it means the items stay in the catalogue, which is today's
    // behaviour, whereas failing to end one would let a `{:toc}` further down
    // the page delete a list nobody asked it to touch.
    // A CONTINUATION of the item above is part of that item, so it does not end
    // the run either — missing this would let a `{:toc}` stop consuming a list
    // whose last item happened to be wrapped.
    if (
      stripped !== "" &&
      !MD_LIST_ITEM_RE.test(line) &&
      !MD_KRAMDOWN_ATTR_RE.test(stripped) &&
      !continuesItem(line, stripped)
    ) {
      endListRun();
    }

    // --- YAML front matter ---
    if (lineno === 1 && MD_FRONT_MATTER_DELIM.test(line)) {
      inFrontMatter = true;
      continue;
    }
    if (inFrontMatter) {
      if (MD_FRONT_MATTER_DELIM.test(line) && lineno > 1) {
        inFrontMatter = false;
      }
      continue;
    }

    // --- Fenced code blocks ---
    // `stripped`, not `line`: an INDENTED fence is the ordinary way to put a code
    // block inside a list item, and anchoring at column 0 meant those were never
    // recognised — their bodies were extracted as prose. Bean `ig4a`. Measured
    // over 618 files: 74 msgids removed (code offered as prose, 48 of them a bare
    // fence run) and 16 ADDED — real sentences that had been swallowed, because
    // a column-0 opening fence whose closing fence was indented kept the parser
    // `inCodeBlock` until the next column-0 fence.
    const fenceMatch = stripped.match(MD_CODE_FENCE_RE);
    if (fenceMatch) {
      if (!inCodeBlock) {
        flushPending();
        inCodeBlock = true;
        codeFence = fenceMatch[1];
      } else if (codeFence && stripped.startsWith(codeFence[0].repeat(codeFence.length))) {
        inCodeBlock = false;
        codeFence = null;
      }
      continue;
    }
    if (inCodeBlock) continue;

    // --- HTML blocks (style/script/pre — skip content) ---
    if (inHtmlBlock) {
      const closeMatch = stripped.match(MD_HTML_CLOSE_TAG_RE);
      if (closeMatch && closeMatch[1].toLowerCase() === htmlCloseTag) {
        inHtmlBlock = false;
        htmlCloseTag = "";
      }
      continue;
    }
    const openMatch = stripped.match(MD_HTML_SKIP_OPEN_RE);
    if (openMatch) {
      const tagName = openMatch[1].toLowerCase();
      flushPending();
      const closeMatch = stripped.match(MD_HTML_CLOSE_TAG_RE);
      if (closeMatch && closeMatch[1].toLowerCase() === tagName) {
        continue;
      }
      inHtmlBlock = true;
      htmlCloseTag = tagName;
      continue;
    }

    // --- Display math blocks ($$...$$, \[...\], \begin{env}...\end{env}) ---
    if (inMathBlock !== null) {
      if (stripped.includes(inMathBlock)) {
        inMathBlock = null;
      }
      continue;
    }
    if (stripped.startsWith("$$")) {
      const rest = stripped.slice(2);
      const closeIdx = rest.indexOf("$$");
      if (closeIdx === -1) {
        flushPending();
        inMathBlock = "$$";
        continue;
      }
      if (rest.slice(closeIdx + 2).trim() === "") {
        flushPending();
        continue;
      }
    } else if (stripped.startsWith("\\[")) {
      const rest = stripped.slice(2);
      const closeIdx = rest.indexOf("\\]");
      if (closeIdx === -1) {
        flushPending();
        inMathBlock = "\\]";
        continue;
      }
      if (rest.slice(closeIdx + 2).trim() === "") {
        flushPending();
        continue;
      }
    } else {
      const mathEnvMatch = stripped.match(MD_MATH_ENV_OPEN_RE);
      if (mathEnvMatch) {
        const closeToken = `\\end{${mathEnvMatch[1]}}`;
        flushPending();
        if (!stripped.includes(closeToken)) {
          inMathBlock = closeToken;
        }
        continue;
      }
    }

    // --- Blank line: end of paragraph ---
    if (!stripped) {
      flushPending();
      continue;
    }

    // --- Headings ---
    const headingMatch = line.match(MD_HEADING_RE);
    if (headingMatch) {
      flushPending();
      spans.push({
        kind: "heading",
        lines: [{ idx, text: headingMatch[2] }],
        raw: headingMatch[2],
        prefix: headingMatch[1],
      });
      continue;
    }

    // --- Horizontal rules / table separators (skip) ---
    if (MD_HLINE_RE.test(stripped) || MD_TABLE_SEP_RE.test(stripped)) {
      flushPending();
      continue;
    }

    // --- List items ---
    const listMatch = line.match(MD_LIST_ITEM_RE);
    if (listMatch) {
      // Flush BEFORE capturing `listRunStart`, so the index is where this run
      // begins rather than where the preceding paragraph still sat unflushed.
      flushPending();
      if (listRunStart === null) listRunStart = spans.length;
      pending = {
        kind: "list-item",
        lines: [{ idx, text: listMatch[2].trim() }],
        prefix: listMatch[1],
        contentCol: listMatch[1].length,
        depth: 0,
      };
      continue;
    }

    // --- Blockquote lines ---
    const bqMatch = line.match(MD_BLOCKQUOTE_RE);
    if (bqMatch) {
      const depth = (bqMatch[1].match(/>/g) ?? []).length;
      const content = bqMatch[2];
      if (content.trim() === "") {
        // A bare `>` is a paragraph break INSIDE the quote, not decoration —
        // joining across it would merge two quoted paragraphs into one msgid.
        flushPending();
        continue;
      }
      if (pending?.kind === "blockquote" && pending.depth === depth) {
        pending.lines.push({ idx, text: content });
        continue;
      }
      // A change of depth is a different quote, so it does not continue this one.
      flushPending();
      pending = {
        kind: "blockquote",
        lines: [{ idx, text: content }],
        prefix: bqMatch[1],
        contentCol: 0,
        depth,
      };
      continue;
    }

    // --- Table rows: extract cell content ---
    if (stripped.startsWith("|") && stripped.endsWith("|")) {
      flushPending();
      const cells = splitTableCells(stripped.slice(1, -1));
      cells.forEach((cell, i) => {
        const text = cell.trim();
        spans.push({ kind: "table-cell", lines: [{ idx, text }], raw: text, prefix: "", cell: i });
      });
      continue;
    }

    // --- Kramdown / Jekyll attribute lists (skip) ---
    if (MD_KRAMDOWN_ATTR_RE.test(stripped)) {
      flushPending();
      // A CONSUMING directive takes its block with it. `{:toc}` replaces the
      // list above with a generated table of contents, so that list's text is
      // a placeholder no reader ever sees — and offering it to a translator
      // costs real attention: the Arabic and Russian translators rendered
      // `1. TOC` as a heading, which is the correct reading of a string that
      // should never have been shown to them. Bean `lrbx`.
      if (MD_KRAMDOWN_CONSUMING_RE.test(stripped) && listRunStart !== null) {
        spans.length = listRunStart;
      }
      endListRun();
      continue;
    }

    // --- Continuation of a list item, else paragraph ---
    if (continuesItem(line, stripped)) {
      pending!.lines.push({ idx, text: stripped });
      continue;
    }
    if (pending !== null && pending.kind !== "paragraph") flushPending();
    pending ??= { kind: "paragraph", lines: [], prefix: "", contentCol: 0, depth: 0 };
    pending.lines.push({ idx, text: stripped });
  }

  // Flush whatever construct was still being accumulated at EOF.
  flushPending();

  return spans;
}

// ── Markdown extraction ─────────────────────────────────────────

/**
 * Extract translatable strings from a Markdown file: each translatable
 * {@link segmentMarkdown} span becomes one `PotEntry`, at the line it starts on.
 *
 * @param md       The markdown content.
 * @param source   Source file path (for POT `#:` references).
 * @returns        Array of extracted POT entries.
 */
export function extractMarkdown(md: string, source: string): PotEntry[] {
  const entries: PotEntry[] = [];
  for (const span of segmentMarkdown(md)) {
    const msgid = cleanMarkdownText(span.raw);
    if (isTranslatable(msgid)) {
      entries.push({ source, line: span.lines[0].idx + 1, msgid, kind: span.kind });
    }
  }
  return entries;
}

// ── Block manifest extraction ───────────────────────────────────

export interface ManifestNarrativeItem {
  text?: string | null;
  lang?: string;
  state?: string;
}

export interface ManifestSectionInput {
  title?: string;
  label?: string;
  subsections?: ManifestSectionInput[];
}

export interface ManifestInput {
  title?: string;
  label?: string;
  kind?: string;
  caption?: string;
  abstract?: string;
  narrative?: string | ManifestNarrativeItem | ManifestNarrativeItem[];
  defaultView?: { title?: string };
  views?: Array<{ title?: string }>;
  sections?: ManifestSectionInput[];
  chapters?: Array<{ dir?: string; partTitle?: string }>;
  _lines?: Record<string, number>;
}

/**
 * Unescape a JavaScript/TypeScript string literal body.
 */
function unescapeTsString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\(['"`\\])/g, "$1");
}

/**
 * Parse translatable fields from a `.ts` manifest source string without
 * executing it. Used when `extractFromManifest` is handed raw `.ts` source
 * text by `translation_extract`, `translation_validate`, or `simulate-translation`.
 */
export function parseManifestSource(tsSource: string): ManifestInput {
  const out: ManifestInput = { _lines: {} };
  const lineAt = (offset: number): number => {
    let n = 1;
    for (let i = 0; i < offset && i < tsSource.length; i++) {
      if (tsSource[i] === "\n") n++;
    }
    return n;
  };

  // Detect builder function name: `export default definition({ ... })`
  const builderMatch = tsSource.match(/export\s+default\s+([A-Za-z_]\w*)\s*\(/);
  if (builderMatch) {
    out.kind = builderMatch[1];
  }

  // Helper to match a string property `propName: "..."` | `'...'` | `` `...` ``
  const readTopString = (prop: string): { value: string; line: number } | undefined => {
    const re = new RegExp(
      `(?:^|[,{\\s])\\b${prop}\\s*:\\s*(?:"((?:\\\\.|[^"\\\\])*)"|'((?:\\\\.|[^'\\\\])*)'|\`((?:\\\\.|[^\`\\\\])*)\`)`,
      "m",
    );
    const m = re.exec(tsSource);
    if (!m) return undefined;
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    return { value: unescapeTsString(raw), line: lineAt(m.index) };
  };

  const labelProp = readTopString("label");
  if (labelProp) out.label = labelProp.value;

  const kindProp = readTopString("kind");
  if (kindProp) out.kind = kindProp.value;

  // For `title`, avoid matching `defaultView: { title: ... }` as the top-level title
  // by checking top-level `title:` before `defaultView` / `views` / `sections` or at indent <= 4.
  const titleRe = /^[ \t]{0,4}title\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/m;
  const titleMatch = titleRe.exec(tsSource) ?? readTopString("title");
  if (titleMatch) {
    if ("value" in titleMatch) {
      out.title = titleMatch.value;
      out._lines!["title"] = titleMatch.line;
    } else {
      out.title = unescapeTsString(titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? "");
      out._lines!["title"] = lineAt(titleMatch.index);
    }
  }

  const captionProp = readTopString("caption");
  if (captionProp) {
    out.caption = captionProp.value;
    out._lines!["caption"] = captionProp.line;
  }

  const abstractProp = readTopString("abstract");
  if (abstractProp) {
    out.abstract = abstractProp.value;
    out._lines!["abstract"] = abstractProp.line;
  }

  // defaultView: { ... title: "..." ... }
  const dvMatch = /defaultView\s*:\s*\{([\s\S]*?)\}/m.exec(tsSource);
  if (dvMatch) {
    const dvTitle = /\btitle\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/m.exec(
      dvMatch[1],
    );
    if (dvTitle) {
      out.defaultView = {
        title: unescapeTsString(dvTitle[1] ?? dvTitle[2] ?? dvTitle[3] ?? ""),
      };
      out._lines!["defaultView.title"] = lineAt(dvMatch.index + (dvTitle.index ?? 0));
    }
  }

  // views: [ { ... title: "..." ... }, ... ]
  const viewsMatch = /\bviews\s*:\s*\[([\s\S]*?)\]/m.exec(tsSource);
  if (viewsMatch) {
    const viewsBody = viewsMatch[1];
    const viewTitleRe =
      /\btitle\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/gm;
    const views: Array<{ title?: string }> = [];
    let vm: RegExpExecArray | null;
    let idx = 0;
    while ((vm = viewTitleRe.exec(viewsBody)) !== null) {
      views.push({
        title: unescapeTsString(vm[1] ?? vm[2] ?? vm[3] ?? ""),
      });
      out._lines![`views[${idx}].title`] = lineAt(viewsMatch.index + vm.index);
      idx++;
    }
    if (views.length > 0) out.views = views;
  }

  // narrative: "..." or { ... text: "..." } or [ { ... text: "..." } ]
  const narrStrProp = readTopString("narrative");
  if (narrStrProp) {
    out.narrative = narrStrProp.value;
    out._lines!["narrative.text"] = narrStrProp.line;
  } else {
    const narrMatch = /\bnarrative\s*:\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/m.exec(tsSource);
    if (narrMatch) {
      const narrBody = narrMatch[1];
      const textMatch =
        /\btext\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/m.exec(
          narrBody,
        );
      if (textMatch) {
        out.narrative = {
          text: unescapeTsString(textMatch[1] ?? textMatch[2] ?? textMatch[3] ?? ""),
        };
        out._lines!["narrative.text"] = lineAt(narrMatch.index + textMatch.index);
      }
    }
  }

  return out;
}

/**
 * Extract translatable strings from a block, chapter, section, or paper
 * manifest (either a parsed manifest object or raw `.ts` source text).
 *
 * Extracts:
 * - `title` (`msgctxt: "title"`)
 * - `caption` on `diagram`, `table`, `figure` (`msgctxt: "caption"`)
 * - `narrative.text` on `figure` (`msgctxt: "narrative.text"`)
 * - `defaultView.title` and `views[i].title` on `simulator`
 * - `abstract` and `chapters[i].partTitle` on `Paper`
 * - `sections[i].title` (and nested `subsections`) on `Chapter` / `Section`
 */
export function extractFromManifest(
  manifestOrSource: ManifestInput | string,
  sourcePath: string,
  line: number = 1,
): PotEntry[] {
  const manifest: ManifestInput =
    typeof manifestOrSource === "string"
      ? parseManifestSource(manifestOrSource)
      : manifestOrSource;
  const entries: PotEntry[] = [];
  const lineFor = (ctx: string): number => manifest._lines?.[ctx] ?? line;

  const pushEntry = (
    raw: string | undefined | null,
    msgctxt: string,
    kind: PotEntryKind,
    comment: string,
  ): void => {
    if (!raw || typeof raw !== "string") return;
    const cleaned = cleanMarkdownText(raw);
    if (!cleaned) return;
    entries.push({
      source: sourcePath,
      line: lineFor(msgctxt),
      msgid: cleaned,
      msgctxt,
      kind,
      comment,
    });
  };

  if (manifest.title) {
    const comment = manifest.kind
      ? `Title of ${manifest.kind} block "${manifest.label ?? ""}"`
      : `Title of block "${manifest.label ?? ""}"`;
    pushEntry(manifest.title, "title", "manifest-title", comment);
  }

  if (manifest.caption) {
    const comment = manifest.kind
      ? `Caption of ${manifest.kind} block "${manifest.label ?? ""}"`
      : `Caption of block "${manifest.label ?? ""}"`;
    pushEntry(manifest.caption, "caption", "manifest-caption", comment);
  }

  if (manifest.narrative) {
    let narrativeText: string | undefined;
    if (typeof manifest.narrative === "string") {
      narrativeText = manifest.narrative;
    } else if (Array.isArray(manifest.narrative)) {
      const enEntry =
        manifest.narrative.find(
          (n) =>
            n &&
            n.state !== "not-authored" &&
            typeof n.text === "string" &&
            (!n.lang || n.lang === "en" || n.lang.toLowerCase().startsWith("en-")),
        ) ??
        manifest.narrative.find(
          (n) => n && n.state !== "not-authored" && typeof n.text === "string" && n.text.length > 0,
        );
      if (enEntry?.text) narrativeText = enEntry.text;
    } else if (
      typeof manifest.narrative === "object" &&
      manifest.narrative.state !== "not-authored" &&
      typeof manifest.narrative.text === "string"
    ) {
      narrativeText = manifest.narrative.text;
    }
    if (narrativeText) {
      const comment = manifest.kind
        ? `Narrative of ${manifest.kind} block "${manifest.label ?? ""}"`
        : `Narrative of block "${manifest.label ?? ""}"`;
      pushEntry(narrativeText, "narrative.text", "manifest-narrative", comment);
    }
  }

  if (manifest.defaultView?.title) {
    pushEntry(
      manifest.defaultView.title,
      "defaultView.title",
      "manifest-title",
      `Default view title of simulator "${manifest.label ?? ""}"`,
    );
  }

  if (Array.isArray(manifest.views)) {
    for (let i = 0; i < manifest.views.length; i++) {
      const v = manifest.views[i];
      if (v?.title) {
        pushEntry(
          v.title,
          `views[${i}].title`,
          "manifest-title",
          `View ${i} title of simulator "${manifest.label ?? ""}"`,
        );
      }
    }
  }

  if (manifest.abstract) {
    pushEntry(
      manifest.abstract,
      "abstract",
      "manifest-narrative",
      `Abstract of "${manifest.title ?? sourcePath}"`,
    );
  }

  const walkSections = (sections: ManifestSectionInput[] | undefined, prefix: string): void => {
    if (!Array.isArray(sections)) return;
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      if (!sec || typeof sec !== "object") continue;
      const ctx = sec.label ? `section:${sec.label}:title` : `${prefix}[${i}].title`;
      if (sec.title) {
        pushEntry(
          sec.title,
          ctx,
          "manifest-title",
          `Title of section "${sec.label ?? sec.title}"`,
        );
      }
      if (Array.isArray(sec.subsections)) {
        walkSections(sec.subsections, `${prefix}[${i}].subsections`);
      }
    }
  };
  walkSections(manifest.sections, "sections");

  if (Array.isArray(manifest.chapters)) {
    for (let i = 0; i < manifest.chapters.length; i++) {
      const ch = manifest.chapters[i];
      if (ch?.partTitle) {
        pushEntry(
          ch.partTitle,
          `chapters[${i}].partTitle`,
          "manifest-title",
          `Part title before chapter "${ch.dir ?? i}"`,
        );
      }
    }
  }

  return entries;
}

// ── POT file formatting ─────────────────────────────────────────

/**
 * Format POT entries into a GNU gettext POT file string.
 *
 * Deduplicates entries with the same (msgctxt, msgid) pair (merging source
 * references), matching upstream `write_pot()` behaviour.
 */
export function formatPot(entries: PotEntry[], metadata?: {
  projectName?: string;
  locale?: string;
}): string {
  // Deduplicate by (msgctxt, msgid) so distinct manifest fields that happen
  // to share an English string remain distinct entries when msgctxt differs.
  const deduped = new Map<string, PotEntry[]>();
  for (const entry of entries) {
    const key = entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;
    const existing = deduped.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      deduped.set(key, [entry]);
    }
  }

  // input-site: inert #a456dd98 — POT-Creation-Date only; every comparison goes through potWithoutTimestamp()
  const now = new Date().toISOString();
  const header = [
    `# Translation template for ${metadata?.projectName ?? "folio content"}`,
    `# Generated by folio-assistant pot-extract`,
    `# https://github.com/litlfred/folio-assistant/issues/206`,
    `#`,
    `msgid ""`,
    `msgstr ""`,
    `"Project-Id-Version: ${metadata?.projectName ?? "folio"}\\n"`,
    `"POT-Creation-Date: ${now}\\n"`,
    `"PO-Revision-Date: \\n"`,
    `"Last-Translator: \\n"`,
    `"Language: ${metadata?.locale ?? ""}\\n"`,
    `"Language-Team: \\n"`,
    `"MIME-Version: 1.0\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    ``,
  ].join("\n");

  // Sort entries case-insensitively (matches upstream)
  const sortedKeys = [...deduped.keys()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const body = sortedKeys
    .map((key) => {
      const locations = deduped.get(key)!;
      const first = locations[0];
      const msgid = first.msgid;
      const parts: string[] = [];

      // Source references
      for (const loc of locations) {
        parts.push(`#: ${loc.source}:${loc.line}`);
      }

      // Translator comments
      for (const loc of locations) {
        if (loc.comment) parts.push(`#. ${loc.comment}`);
        if (loc.contextUrl) parts.push(`#. URL: ${loc.contextUrl}`);
      }

      // Check for python-brace-format flag (Liquid variables or inline-code placeholders)
      const hasBraceVars =
        /\{lqd_[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\}/.test(msgid) ||
        /\{code\d+\}/.test(msgid);
      if (hasBraceVars) {
        parts.push("#, python-brace-format");
      }

      if (first.msgctxt) {
        parts.push(`msgctxt ${potQuote(first.msgctxt)}`);
      }
      parts.push(`msgid ${potQuote(msgid)}`);
      parts.push(`msgstr ""`);

      return parts.join("\n");
    })
    .join("\n\n");

  return header + "\n" + body + "\n";
}

/**
 * A `.pot` with its creation timestamp blanked, for comparison only.
 *
 * Never written back: the header is real metadata a translator's tooling
 * reads. It is excluded from the COMPARISON because it is the one line that
 * changes on every run regardless of content. Shared by every template
 * checker (`translate-bpmn`, core's `glossary-pot`), so the two cannot
 * disagree about what "unchanged" means.
 */
export function potWithoutTimestamp(text: string): string {
  return text.replace(/^"POT-Creation-Date:.*$/m, '"POT-Creation-Date: <ignored>\\n"');
}

/**
 * Quote a string for POT format — handles multiline and escaping.
 */
export function potQuote(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

  if (s.includes("\n") && s.length > 72) {
    const lines = escaped.split("\\n");
    return '""' + "\n" + lines.map((l) => `"${l}\\n"`).join("\n");
  }

  return `"${escaped}"`;
}
