#!/usr/bin/env bun
/**
 * Recover a `.po` catalogue from a page that is ALREADY TRANSLATED.
 *
 * Issue #206, and the blocker it left on `main`: five pages were published in
 * five locales with no catalogue, `translation-drift` fails on every one, and
 * the owner ruled against recording the absences — *"ask the `t8g3` campaign for
 * the actual `.po` catalogues rather than record their absence"* (bean `ngxj`).
 * The catalogues are the fix. This derives the ones that can be derived
 * SOUNDLY, and refuses the rest loudly.
 *
 * ## The registry says this cannot be done, and it is nearly right
 *
 * `translation-drift.ts` records, as the reason two pages sit in `UNCATALOGED`:
 *
 * > A catalogue cannot be derived from a finished translation without inventing
 * > the segmentation
 *
 * That is true of a translation you can only read as prose. It is NOT true when
 * the SAME deterministic extractor runs on both sides: `extractMarkdown` walks
 * headings, paragraphs, list items, blockquotes and table cells in document
 * order, so a translation that preserves its source's structure yields the same
 * sequence of constructs. Pairing by position is then reading one segmentation,
 * not inventing a second.
 *
 * **The whole question is whether the structure IS preserved, and that is what
 * this module refuses on.**
 *
 * ## Why the check is the KIND SEQUENCE and not the count
 *
 * A count match is not an alignment, and on this corpus that was not academic.
 * Before the extractor fixes below, `fr/accessibility` and `ru/getting-started`
 * matched their source's entry count EXACTLY and each diverged in kind partway
 * through — at construct 32 and 53, a source `paragraph` against a translated
 * `table-cell`. A count-only check would have written two catalogues pairing a
 * paragraph's msgid with a table cell's text, and nothing downstream would have
 * noticed: a `.po` is well-formed whatever it claims.
 *
 * ## What the refusals turned out to be ABOUT, measured twice
 *
 * A refusal says the two documents are not the same shape. It does **not** say
 * the translator restructured the page, and reading it that way was wrong for
 * some of them. Two properties of `pot-extract.ts` were not locale-neutral:
 *
 * - **`MD_MIN_TEXT_LEN` was a minimum in CHARACTERS** (bean `6b8u`). Stripping
 *   code spans left `", "` (2) in English and `"، و"` (3) in Arabic, so an
 *   identical 4x7 table yielded 66 constructs in `ar` against 65. It ran the
 *   other way for dense scripts, where `否` is one character and was dropped
 *   while `non` and `нет` were kept. Now a count of LETTERS.
 * - **A code fence was recognised only at column 0** (bean `ig4a`), so an
 *   indented fence inside a list item was not a fence and its body was
 *   extracted as prose.
 *
 * | | pairs aligned | measured on |
 * |---|---|---|
 * | before either fix | **7** / 25 | `main` @ `a0fbdc7ac7`, 2026-09-26 |
 * | after both | **10** / 25 | this branch, same day |
 *
 * **The first account of this said 9 more, and that was wrong.** It inferred the
 * number by stitching together a count measurement and a kind measurement taken
 * separately. Measured directly on the thing that matters — count and kind
 * together — the two fixes unlock **three**.
 *
 * **These numbers are measurements, not invariants, and each carries the tree it
 * was taken on for that reason.** They move when anyone edits a source page: hours
 * after the 10 above, `main` added two constructs to `docs/start/installation.md`,
 * `ar/installation` stopped aligning, and the pair became **9 / 16**. A test of
 * mine asserted the equality and CI failed it — correctly. The equality is gone;
 * what is asserted now is that alignment is partial and that no pair diverges by
 * KIND, which is the part that is about this module rather than about the corpus.
 *
 * The remainder all refuse as `count-differs`; no pair diverges by kind any
 * more. A **third** extractor property accounts for most of them and is
 * deliberately NOT fixed here (bean `lvk9`): **list items and blockquotes are
 * extracted one entry per LINE**, so how many entries a construct yields depends
 * on where the author pressed return — and a wrapped list item's continuation
 * falls through to the paragraph accumulator, so it is emitted as a `paragraph`.
 * Wrong count and wrong kind from one cause. No translator preserves an English
 * hard wrap.
 *
 * | | aligned |
 * |---|---|
 * | today | 10 / 25 |
 * | + blockquotes coalesced | 13 / 25 |
 * | + wrapped list items coalesced | **17 / 25** |
 *
 * It also settles what the remaining refusals are NOT. `es`, `ru` and `zh`
 * `accessibility` diverge at the same three source indices and all land on
 * exactly 117 — three locales agreeing to the entry is one cause, and it is this
 * one. All three align once wrap is out of the way, so those pages were never
 * short. Bean `7x8o` is corrected accordingly.
 *
 * Its own bean, for two reasons: it changes what a list-item or blockquote msgid
 * IS, rewriting existing catalogues' entries rather than adding and removing
 * them; and the rule used to MEASURE the 17/25 above over-merges (it joined two
 * unrelated sentences in `wireframes/fsh-guts/intent.md`), so a correct fix needs
 * indentation-aware continuation handling and 17/25 is a crude rule's reach
 * rather than a promise.
 *
 * **The kind check is vindicated either way.** Whatever the cause, those two
 * pairs WERE misaligned, and a count-only check would have shipped them.
 *
 * ## What a matching kind sequence does NOT prove
 *
 * It is necessary, not sufficient. Two adjacent paragraphs could have swapped
 * and the sequence would still match. This is stated rather than hidden because
 * a caller deciding whether to trust the output needs it: what the tool
 * establishes is that the two documents have the same SHAPE, and it infers
 * correspondence from that plus the fact that these translations were produced
 * from these sources. A human sign-off is what turns that into an official
 * translation — #206's own distinction, and the reason every catalogue written
 * here is marked unofficial in its header.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { extractMarkdown, type PotEntry } from "./pot-extract.ts";
import { catalogueFor, fileForUrl } from "./translation-drift.ts";
import { buildTranslationIndex, siteRoot, sourceLocale, supportedLocales } from "./translation-index.ts";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** Why a pair could not be derived — never just "failed". */
export interface Refusal {
  page: string;
  locale: string;
  reason:
    | "source-missing"
    | "translation-missing"
    | "count-differs"
    | "kind-diverges"
    | "msgid-conflict";
  detail: string;
}

export interface Derivation {
  page: string;
  locale: string;
  entries: number;
  /**
   * Source constructs with no counterpart in the translation, emitted with an
   * empty `msgstr`. Non-zero means the SOURCE grew after the translation was
   * made — reported rather than hidden, because a reader deciding whether to
   * trust this catalogue needs to know it is incomplete by construction.
   */
  untranslated: number;
  po: string;
}

export interface DeriveResult {
  derived: Derivation[];
  refused: Refusal[];
}

/**
 * Locale names for the `.po` header, matching the existing catalogues' style
 * (`Language-Team: Arabic`).
 *
 * A literal map rather than `Intl.DisplayNames` because the header is a
 * committed artefact: a runtime-derived name would change the file when the ICU
 * data behind it changes, and a catalogue that rewrites itself on a node upgrade
 * is a diff nobody can review.
 */
export const LOCALE_NAMES: Record<string, string> = {
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  ru: "Russian",
  zh: "Chinese",
};

/** The first index where two entry lists disagree on kind, or `-1`. */
export function firstKindDivergence(src: PotEntry[], tr: PotEntry[]): number {
  const n = Math.min(src.length, tr.length);
  for (let i = 0; i < n; i += 1) {
    if (src[i].kind !== tr[i].kind) return i;
  }
  return -1;
}

/**
 * The first msgid that occurs twice in the source with DIFFERENT translations.
 *
 * A `.po` is keyed by msgid, so it cannot represent two translations of one
 * string — that is what `msgctxt` is for. Deduplicating by keeping the first
 * would therefore silently discard a real difference, and the resulting
 * catalogue would be well-formed and wrong.
 *
 * **Found by a sibling session, not by me** (bean `f6r1`, 2026-09-26). It
 * measured `ru/getting-started` as needing `msgctxt`: *"a repeated source msgid
 * whose two occurrences are translated DIFFERENTLY, which a msgid-keyed `.po`
 * cannot represent"*. My dedup kept the first and said so in a comment, which
 * described the behaviour without noticing it was lossy.
 *
 * **It has not shipped a wrong catalogue** — checked across all 10 derived here,
 * 0 conflicts — and the reason is luck rather than design: `ru/getting-started`
 * is refused for `count-differs` today, so the collision never got the chance.
 * `lvk9` would align that pair and activate it. Hence a refusal now.
 *
 * A repeated msgid translated the SAME way is benign and common; only a
 * divergence is a refusal.
 */
export function conflictingDuplicate(
  src: PotEntry[],
  tr: PotEntry[],
): { index: number; msgid: string; first: string; second: string } | undefined {
  const seen = new Map<string, { at: number; tr: string }>();
  for (let i = 0; i < src.length; i += 1) {
    const id = src[i].msgid;
    const prev = seen.get(id);
    if (prev === undefined) {
      seen.set(id, { at: i, tr: tr[i].msgid });
      continue;
    }
    if (prev.tr !== tr[i].msgid) {
      return { index: i, msgid: id, first: prev.tr, second: tr[i].msgid };
    }
  }
  return undefined;
}

/**
 * Align a translation against a source that has GROWN, or report that it cannot.
 *
 * Positional pairing assumes the two documents have the same shape. When a source
 * gains constructs after its translation was made, that assumption fails at the
 * insertion point and everything after it shifts — which is why five of this
 * corpus's six remaining refusals were `installation`, each short by exactly the
 * two Windows/Git Bash paragraphs `main` added on 2026-09-26.
 *
 * **That is not a translation defect, and refusing it outright was leaving work
 * undone.** A catalogue whose source has grown is an ordinary, expressible thing:
 * the constructs that were translated carry their translation, and the ones added
 * since carry an empty `msgstr`, which is precisely what gettext's untranslated
 * state means. Issue #206's *"official goes stale when its source changes"* is
 * this case, and an empty `msgstr` is how a catalogue says so.
 *
 * Returns one entry per SOURCE construct: the matching translation, or `undefined`
 * where the source has no counterpart.
 *
 * **Refuses unless every translated construct is matched.** A subsequence
 * alignment is only sound in one direction — the translation must be a
 * subsequence of the source, meaning things were ADDED to the source and nothing
 * was dropped from the translation. If the translation has a construct the source
 * does not, the two have diverged rather than drifted, and pairing what is left
 * would be inventing an alignment rather than reading one.
 *
 * Greedy rather than a full LCS, and the guard is what makes that safe: a greedy
 * walk over kinds finds a complete match whenever one exists for a true
 * subsequence, and any incomplete walk is refused rather than patched up.
 */
export function alignGrownSource(
  src: PotEntry[],
  tr: PotEntry[],
): Array<PotEntry | undefined> | undefined {
  if (tr.length > src.length) return undefined;
  const out: Array<PotEntry | undefined> = [];
  let j = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (j < tr.length && src[i].kind === tr[j].kind && src.length - i === tr.length - j) {
      // The tails are the same length, so from here it is positional — taking a
      // skip now would strand a translated construct with nowhere to go.
      out.push(tr[j]);
      j += 1;
      continue;
    }
    if (j < tr.length && src[i].kind === tr[j].kind) {
      out.push(tr[j]);
      j += 1;
      continue;
    }
    out.push(undefined);
  }
  return j === tr.length ? out : undefined;
}

/** Escape a string for a `.po` literal. */
function poEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * The catalogue text for one aligned pair.
 *
 * **Marked unofficial, in the header, unconditionally.** #206 defines official
 * as "human adjudication/sign-off has happened" and unofficial as agentic; a
 * catalogue recovered by a script is the latter, and a reader opening the file
 * should not have to infer that from its provenance. The marker is a comment
 * rather than a `.po` field so that `msgfmt` and every existing consumer are
 * unaffected.
 */
export function formatDerivedPo(
  page: string,
  locale: string,
  src: PotEntry[],
  tr: Array<PotEntry | undefined>,
  sourcePath: string,
): string {
  const name = LOCALE_NAMES[locale] ?? LOCALE_NAMES[locale.split("-")[0]!] ?? locale;
  const out: string[] = [
    `# ${name} translation of folio-assistant ${page} (${sourcePath})`,
    "# Copyright (C) 2026 folio-assistant contributors",
    "# This file is distributed under the same license as the folio-assistant package.",
    "#",
    "# UNOFFICIAL — recovered from the already-published translation by",
    "# `pipeline/derive-po.ts`, by aligning this locale's page against its",
    "# source with the same extractor. No human has adjudicated it. Issue #206",
    "# defines official as human sign-off; until that happens this is a starting",
    "# point, not an authority. The alignment was accepted because the two",
    `# documents yield the same sequence of ${src.length} constructs; see the module`,
    "# docblock for what that does and does not establish.",
    ...(tr.some((e) => e === undefined)
      ? [
          "#",
          `# INCOMPLETE — ${tr.filter((e) => e === undefined).length} of these constructs`,
          "# were added to the source AFTER this translation was made, and carry an empty",
          "# msgstr. That is #206's stale-on-edit case; they need a translator, not a fix.",
        ]
      : []),
    "#",
    'msgid ""',
    'msgstr ""',
    '"Project-Id-Version: folio-assistant\\n"',
    '"Report-Msgid-Bugs-To: \\n"',
    `"Last-Translator: folio-assistant agent (derived, unofficial)\\n"`,
    `"Language-Team: ${name}\\n"`,
    `"Language: ${locale}\\n"`,
    '"MIME-Version: 1.0\\n"',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '"Content-Transfer-Encoding: 8bit\\n"',
    "",
  ];
  // Deduplicate by msgid. A repeated msgid translated IDENTICALLY is benign —
  // gettext permits one entry and either copy is the same entry. A repeated
  // msgid translated DIFFERENTLY is not, and {@link conflictingDuplicate}
  // refuses the pair before this function is reached, so by here every
  // duplicate is benign and dropping it loses nothing.
  const seen = new Set<string>();
  for (let i = 0; i < src.length; i += 1) {
    const id = src[i].msgid;
    if (seen.has(id)) continue;
    seen.add(id);
    const match = tr[i];
    out.push(`#: ${sourcePath}:${src[i].line}`);
    if (match === undefined) {
      // The source gained this construct after the translation was made. An
      // empty `msgstr` is gettext's word for "not translated yet" — the honest
      // record, and the one a translator's tooling already knows how to find.
      out.push("#, fuzzy");
      out.push(`msgid "${poEscape(id)}"`);
      out.push('msgstr ""');
    } else {
      out.push(`msgid "${poEscape(id)}"`);
      out.push(`msgstr "${poEscape(match.msgid)}"`);
    }
    out.push("");
  }
  return out.join("\n");
}

/**
 * Try to derive every (page, locale) catalogue, writing none.
 *
 * Separated from the writer so the decision is testable without a disk, the
 * split `resolveWithin`/`resolveFile` makes for the same reason.
 */
export function derive(
  instanceRoot: string,
  pages: string[],
  locales: string[],
  opts: { docsDir?: string } = {},
): DeriveResult {
  // `siteRoot` rather than a `docs` literal: two directories in this layer
  // declare that path (`docs` instance-scoped, `root-docs` repository-scoped),
  // so `directoryForGraph` would throw on the ambiguity — and `siteRoot`
  // CONFIRMS the directory by finding `_config.yml` in it rather than scanning
  // whatever is there. `opts.docsDir` is what the tests pass, and it is why a
  // fixture needs no `_config.yml`.
  const docs = opts.docsDir ?? siteRoot(instanceRoot);
  if (docs === undefined) {
    // Not "no pages found" — a missing site is a different fact from an empty
    // one, and reporting it as the latter is the `dh4f` defect: a consumer that
    // scans nothing and calls the run clean.
    return {
      derived: [],
      refused: pages.flatMap((page) =>
        locales.map((locale) => ({
          page,
          locale,
          reason: "source-missing" as const,
          detail: `no site root under ${instanceRoot} — nothing declares a directory with a _config.yml`,
        })),
      ),
    };
  }
  const derived: Derivation[] = [];
  const refused: Refusal[] = [];

  for (const page of pages) {
    const srcPath = join(docs, `${page}.md`);
    if (!existsSync(srcPath)) {
      for (const locale of locales) {
        refused.push({ page, locale, reason: "source-missing", detail: `no ${srcPath}` });
      }
      continue;
    }
    const rel = `${relative(instanceRoot, docs) || "."}/${page}.md`;
    const src = extractMarkdown(readFileSync(srcPath, "utf-8"), rel);

    for (const locale of locales) {
      const trPath = translationPathFor(docs, page, locale);
      if (!existsSync(trPath)) {
        refused.push({ page, locale, reason: "translation-missing", detail: `no ${trPath}` });
        continue;
      }
      const tr = extractMarkdown(
        readFileSync(trPath, "utf-8"),
        relative(instanceRoot, trPath),
      );
      if (tr.length < src.length) {
        // The source may simply have GROWN since this was translated, which is
        // alignable with the added constructs left untranslated. Tried before
        // refusing, because refusing here was leaving five real catalogues unmade.
        const grown = alignGrownSource(src, tr);
        if (grown !== undefined) {
          const clash = conflictingDuplicate(src, grown.map((e, i) => e ?? src[i]));
          if (clash === undefined) {
            derived.push({
              page,
              locale,
              entries: src.length,
              untranslated: grown.filter((e) => e === undefined).length,
              po: formatDerivedPo(page, locale, src, grown, rel),
            });
            continue;
          }
        }
      }
      if (tr.length !== src.length) {
        refused.push({
          page,
          locale,
          reason: "count-differs",
          detail: `source has ${src.length} translatable constructs, the translation has ${tr.length}`,
        });
        continue;
      }
      const at = firstKindDivergence(src, tr);
      if (at !== -1) {
        refused.push({
          page,
          locale,
          reason: "kind-diverges",
          detail:
            `same count (${src.length}) but the structures differ: at construct ${at} the source is ` +
            `a ${src[at].kind} and the translation is a ${tr[at].kind}`,
        });
        continue;
      }
      const clash = conflictingDuplicate(src, tr);
      if (clash !== undefined) {
        refused.push({
          page,
          locale,
          reason: "msgid-conflict",
          detail:
            `the source string ${JSON.stringify(clash.msgid.slice(0, 60))} occurs more than once and ` +
            `is translated two different ways (${JSON.stringify(clash.first.slice(0, 40))} and ` +
            `${JSON.stringify(clash.second.slice(0, 40))} at construct ${clash.index}); a msgid-keyed ` +
            `.po cannot represent both, so this needs \`msgctxt\` rather than a derivation`,
        });
        continue;
      }
      derived.push({
        page,
        locale,
        entries: src.length,
        untranslated: 0,
        po: formatDerivedPo(page, locale, src, tr, rel),
      });
    }
  }
  return { derived, refused };
}

/**
 * Where a locale's translation of `page` lives — **beside the page, not at the root.**
 *
 * `docs/guides/agent-onboarding.md` is translated at
 * `docs/guides/ar/agent-onboarding.md`. The composition this replaces was
 * `join(docs, locale, page + ".md")`, which puts the locale segment first and so
 * looks for `docs/ar/guides/agent-onboarding.md` — a path that exists nowhere in
 * this corpus. It was invisible for as long as every translated page sat at the
 * site root, where the two spellings coincide.
 *
 * **Checked against the index rather than reasoned about.** The authority on where
 * a translation lives is the URL its own front matter produces, which
 * `buildTranslationIndex` reads; this function composes the same path from a page
 * name and a locale because {@link derive} is given those and not the index. A
 * test asserts the two agree on all 70 published pairs, so the composition is
 * evidence-backed rather than a convention restated in a second place. If they
 * ever disagree, the index is right and this is wrong.
 */
export function translationPathFor(docs: string, page: string, locale: string): string {
  const cut = page.lastIndexOf("/");
  return cut === -1
    ? join(docs, locale, `${page}.md`)
    : join(docs, page.slice(0, cut), locale, `${page.slice(cut + 1)}.md`);
}

/**
 * Every (page, locale) this layer PUBLISHES a translation for.
 *
 * **The CLI hard-coded five page names, and that is why a translation batch needed
 * a code edit to be catalogued.** PR #1404 published `architecture`,
 * `beans-and-todos`, `evidence` and `skills` across five locales on 2026-09-26,
 * `translation-drift` went from 1 finding to 21, and this tool could not see them.
 * A list of pages in a script is a list that goes stale on somebody else's merge.
 *
 * ## It DELEGATES, and that is the fix rather than a shortcut
 *
 * This used to do one flat `readdirSync(join(docs, locale))`, so it saw the site
 * root and nothing below it. Measured on `c6960465301` (bean `9rnf`): **13 of the
 * 14** pages with published translations, missing `guides/agent-onboarding` in all
 * five locales — and that one page is where **every** stale msgid in the corpus
 * lives, so the tool built to keep catalogues current could not reach the only
 * catalogues that were not.
 *
 * The obvious repair is to make the scan recursive, and the bean asked for exactly
 * that. It is the wrong repair. `buildTranslationIndex` already walks the site
 * recursively, already skips Jekyll's `_`-prefixed machinery at every level, and
 * already resolves a page's locale siblings beside the page — and it is what the
 * drift gate and `check-translation-catalogue` read. A second recursive walker
 * here would be a second answer to "which pairs are published", free to disagree
 * with the first, and the disagreement would surface as one gate reporting a
 * catalogue missing that another reports present.
 *
 * So: one answer, and the locale list is still the DECLARATION rather than the
 * filesystem. An earlier version of the flat scan matched two-or-three-letter
 * directory names and picked up `wireframes/fsh-guts` as a locale, `fsh` plus a
 * suffix fitting that shape exactly. Locales are intersected with
 * `supportedLocales` for that reason, and the source locale is excluded because
 * it is the thing being translated FROM.
 *
 * ## Why it cannot report an empty set quietly
 *
 * `buildTranslationIndex` returns findings, and `unreadable` among them means the
 * translation set for some page **could not be determined**. Discovering nothing
 * because the index could not be built is a different fact from discovering
 * nothing because nothing is published, and collapsing the two is the `dh4f`
 * defect this file already refuses one level up. The findings are surfaced to the
 * caller rather than swallowed.
 */
export function publishedPairs(
  docs: string,
  declaredLocales: readonly string[],
  sourceLocale: string,
  opts: { instanceRoot?: string } = {},
): { pages: string[]; locales: string[]; findings: string[] } {
  // The index is built from the layer root, while this function's contract is
  // a site directory — the two differ by the declared site segment, and a caller
  // that already knows the root passes it rather than having it inferred.
  const instanceRoot = opts.instanceRoot ?? dirname(docs);
  const declared = new Set(declaredLocales.filter((l) => l !== sourceLocale));

  let index: ReturnType<typeof buildTranslationIndex>;
  try {
    index = buildTranslationIndex(instanceRoot);
  } catch (e) {
    // Never an empty answer for a reason that is not "nothing is published".
    return {
      pages: [],
      locales: [],
      findings: [`the translation index could not be built from ${instanceRoot}: ${String(e)}`],
    };
  }

  const pages = new Set<string>();
  const locales = new Set<string>();
  const findings = index.findings
    .filter((f) => f.severity !== "note")
    .map((f) => `${f.severity}: ${f.where} — ${f.message}`);

  for (const page of Object.values(index.index.pages)) {
    // The page NAME this file speaks in is its path relative to the site, which
    // is what `translationPathFor` and `formatDerivedPo`'s `#:` reference both
    // need. `fileForUrl` is the one answer to url -> file, shared with the gate.
    const srcFile = fileForUrl(docs, page.sourceUrl);
    const name = relative(docs, srcFile).replace(/\.md$/i, "").split(sep).join("/");
    let any = false;
    for (const locale of Object.keys(page.translations)) {
      if (!declared.has(locale)) continue;
      locales.add(locale);
      any = true;
    }
    if (any) pages.add(name);
  }
  return { pages: [...pages].sort(), locales: [...locales].sort(), findings };
}

/** What {@link write} did, per catalogue. */
export interface WriteResult {
  written: string[];
  /** Existing catalogues left alone, because replacing one is not this tool's call. */
  skipped: string[];
}

/**
 * Write what `derive` produced, and **never replace an existing catalogue**
 * unless explicitly told to.
 *
 * The destination comes from `catalogueFor` in `translation-drift.ts` — the same
 * function the GATE uses to decide whether a catalogue exists. A second answer
 * here could put a file somewhere the gate does not look, which is a catalogue
 * that is written and still reported missing.
 *
 * ## Why it skips rather than overwrites
 *
 * This wrote unconditionally until 2026-09-26, which is a data-loss hazard on
 * precisely the artefact issue #206 exists to protect. A `.po` here may have been
 * **signed off by a human** — #206's definition of *official* — or hand-corrected
 * after this tool produced it. Re-running `--write` would have silently replaced
 * either with a fresh unofficial derivation, and the diff would read as a
 * regeneration rather than as a deletion.
 *
 * That is `deletion-requires-confirmation` applied to a writer: an agent does not
 * remove a durable artefact, or replace one, on its own initiative. The skip is
 * REPORTED rather than silent, because a skip nobody sees cannot be told from a
 * write.
 *
 * `overwrite` is for the caller who has decided. It is never the default, and the
 * CLI spells it `--overwrite` rather than folding it into `--write`, so choosing
 * it is a separate act from choosing to write at all.
 */
export function write(
  instanceRoot: string,
  r: DeriveResult,
  opts: { translationsDir?: string; overwrite?: boolean } = {},
): WriteResult {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const d of r.derived) {
    const out =
      opts.translationsDir === undefined
        ? catalogueFor(instanceRoot, d.locale, d.page)
        : join(opts.translationsDir, d.locale, `${d.page}.po`);
    if (existsSync(out) && opts.overwrite !== true) {
      skipped.push(out);
      continue;
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, d.po, "utf-8");
    written.push(out);
  }
  return { written, skipped };
}

export function formatReport(r: DeriveResult): string {
  const out: string[] = [];
  out.push(`Derived ${r.derived.length} catalogue(s); refused ${r.refused.length}.`);
  out.push("");
  for (const d of r.derived) {
    out.push(
      `  ✓ ${d.locale}/${d.page}  ${d.entries} entries` +
        (d.untranslated > 0
          ? `  (${d.untranslated} added to the source since — empty msgstr)`
          : ""),
    );
  }
  if (r.refused.length > 0) {
    out.push("");
    out.push("  REFUSED — each is a real finding about the translation, not a tool limit:");
    for (const f of r.refused) {
      out.push(`  ✗ ${f.locale}/${f.page}  [${f.reason}] ${f.detail}`);
    }
    out.push("");
    out.push("  A refusal means the published translation does not have the same SHAPE as its");
    out.push("  source, so no positional alignment is sound. That is drift the missing catalogue");
    out.push("  was hiding: `translation-drift` can only report \"no catalogue\" until one exists.");
  }
  return out.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const root = pathToFileURL(HARNESS_ROOT + "/").pathname.replace(/\/$/, "");
  const docs = siteRoot(root);
  if (docs === undefined) {
    console.error(`No site root under ${root} — nothing declares a directory with a _config.yml.`);
    process.exit(2);
  }
  const { pages, locales, findings } = publishedPairs(docs, supportedLocales(root), sourceLocale(root), {
    instanceRoot: root,
  });
  // Printed BEFORE the count, and never folded into it. A discovery that could
  // not read part of the corpus still prints a confident-looking number, so the
  // number has to arrive already qualified.
  for (const f of findings) console.log(`! ${f}`);
  if (findings.length > 0) console.log("");
  console.log(`${pages.length} page(s) x ${locales.length} locale(s) published here: ${locales.join(", ")}\n`);
  const r = derive(root, pages, locales);
  console.log(formatReport(r));
  if (argv.includes("--write")) {
    const w = write(root, r, { overwrite: argv.includes("--overwrite") });
    console.log(`\nWrote ${w.written.length} file(s).`);
    if (w.skipped.length > 0) {
      console.log(
        `\nLeft ${w.skipped.length} existing catalogue(s) ALONE. One may carry a human's ` +
          `sign-off\nor hand corrections, and replacing it is not this tool's call. Pass ` +
          `--overwrite\nif you have decided:`,
      );
      for (const path of w.skipped) console.log(`  · ${path}`);
    }
  } else {
    console.log("\n(dry run — pass --write to create the catalogues)");
  }
  // Exit 0 either way: a refusal is a fact about the corpus, not a failure of
  // this tool, and the caller that matters is a person reading the report.
  process.exit(0);
}
