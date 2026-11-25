/**
 * Dependency injection point for a folio's chapter profiles.
 *
 * Which q-regimes a chapter may use, which chapters are categorical, and which
 * are archimedean, are **editorial judgements about one folio's chapters** —
 * qou's, specifically. They were hardcoded in `qa-checkers-q-usage.ts`: a
 * 31-entry `CHAPTER_EXPECTED_REGIMES` map keyed by qou chapter directory names
 * (`"braids-and-knots"`, `"models-of-qous"`, `"appendix-surreals"`), plus two
 * chapter sets. AGENTS.md rules that out flatly — "if you are about to write
 * subject matter here (a chapter, a constant, a vocabulary), you are either in
 * the wrong repo or writing something that belongs in the folio as data."
 *
 * Third registry in this family, and deliberately the same shape as
 * `value-registry-di.ts` and `references-registry-di.ts`: an interface the
 * platform declares, a `configure*` the folio calls before invoking pipeline
 * functions, and Proxy-backed value exports so the existing consumers keep
 * reading `CHAPTER_EXPECTED_REGIMES[chapter]` unchanged.
 *
 * ## Unconfigured means "no opinion", not "no chapters"
 *
 * `value-registry-di` and `references-registry-di` THROW when unconfigured,
 * because a values or bibliography lookup that returns nothing is a bug. This
 * one does not, and the difference is deliberate: a chapter profile is an
 * optional editorial policy, and a folio that declares none is a legitimate
 * folio, not a broken one. So the default is an empty registry, and every
 * accessor is written so that "unconfigured" reads as **`n/a` — no expectation
 * recorded**, never as "expectation met".
 *
 * The q-usage checkers that read these profiles are the science layer's
 * (https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/qa-checkers-q-usage.ts, bean `saqd`); this
 * registry stays here because it is the generic DI point, and sci's
 * `lean-audit.ts` reads `leanModuleChapter` from it too.
 *
 * That distinction is the whole point. `qa-checkers-q-usage` already treats a
 * chapter absent from the map as unscored, so an empty registry makes the
 * chapter-profile criteria uniformly `n/a` rather than silently passing —
 * `chapterHasProfile()` is what a caller checks to tell the two apart.
 *
 * @module pipeline/chapter-profile-registry-di
 */

/**
 * A q-regime label as used by the q-usage checkers.
 *
 * Kept as a bare `string` rather than importing the checker's `QRegime` union:
 * this module must not depend on the checker it feeds, and a folio may
 * legitimately name a regime the platform has never heard of. The checker
 * still validates against its own union at the point of use.
 */
export type ChapterRegime = string;

/**
 * A rule mapping a Lean module path fragment to the chapter that owns it.
 * Ordered: the first whose `pathFragment` occurs in the relative path wins.
 */
export interface LeanModuleChapterRule {
  pathFragment: string;
  chapter: string;
}

export interface ChapterProfileAPI {
  /** Chapter directory name → the q-regimes that chapter may use. */
  chapterExpectedRegimes: Readonly<Record<string, ReadonlySet<ChapterRegime>>>;
  /** Chapters whose narrative-expected profile is categorical / algebraic. */
  categoricalChapters: ReadonlySet<string>;
  /** Chapters whose narrative-expected profile is archimedean / fixed q_0. */
  archimedeanChapters: ReadonlySet<string>;
  /**
   * Prose terms that must be backed by a formal definition, mapped to the
   * definition (or description) expected to back them. Editorial: which words
   * a folio considers load-bearing is a judgement about its own subject.
   */
  termsNeedingDefinitions?: Readonly<Record<string, string>>;
  /** Lean module path fragment → owning chapter, first match wins. */
  leanModuleChapters?: readonly LeanModuleChapterRule[];
}

const EMPTY: ChapterProfileAPI = {
  chapterExpectedRegimes: {},
  categoricalChapters: new Set(),
  archimedeanChapters: new Set(),
  termsNeedingDefinitions: {},
  leanModuleChapters: [],
};

let currentApi: ChapterProfileAPI | null = null;

export function configureChapterProfiles(api: ChapterProfileAPI): void {
  currentApi = api;
}

/** Reset to unconfigured. For tests; a folio calls `configure` once at startup. */
export function resetChapterProfiles(): void {
  currentApi = null;
}

/**
 * The configured profiles, or an empty registry.
 *
 * Does NOT throw when unconfigured — see the module note. Callers that need to
 * distinguish "no profile for this chapter" from "no profiles at all" use
 * `chapterProfilesConfigured()`.
 */
export function getChapterProfiles(): ChapterProfileAPI {
  return currentApi ?? EMPTY;
}

/** Has a folio supplied chapter profiles at all? */
export function chapterProfilesConfigured(): boolean {
  return currentApi !== null;
}

/** Does this specific chapter have a recorded regime expectation? */
export function chapterHasProfile(chapter: string | undefined): boolean {
  if (!chapter) return false;
  return Object.hasOwn(getChapterProfiles().chapterExpectedRegimes, chapter);
}

// ── Value-shaped exports, so consumers read them as they always have ──

export const CHAPTER_EXPECTED_REGIMES: Readonly<
  Record<string, ReadonlySet<ChapterRegime>>
> = new Proxy(
  {},
  {
    get: (_, prop: string) => getChapterProfiles().chapterExpectedRegimes[prop],
    ownKeys: () => Reflect.ownKeys(getChapterProfiles().chapterExpectedRegimes),
    has: (_, prop) => prop in getChapterProfiles().chapterExpectedRegimes,
    getOwnPropertyDescriptor: (_, prop) => {
      const d = Reflect.getOwnPropertyDescriptor(
        getChapterProfiles().chapterExpectedRegimes,
        prop,
      );
      // `ownKeys` must agree with this or `Object.entries` throws on a Proxy.
      return d && { ...d, configurable: true };
    },
  },
);

export const CATEGORICAL_CHAPTERS: ReadonlySet<string> = new Proxy(new Set<string>(), {
  get: (_, prop: string | symbol) => {
    const s = getChapterProfiles().categoricalChapters;
    const v = Reflect.get(s, prop, s);
    return typeof v === "function" ? v.bind(s) : v;
  },
});

export const ARCHIMEDEAN_CHAPTERS: ReadonlySet<string> = new Proxy(new Set<string>(), {
  get: (_, prop: string | symbol) => {
    const s = getChapterProfiles().archimedeanChapters;
    const v = Reflect.get(s, prop, s);
    return typeof v === "function" ? v.bind(s) : v;
  },
});

/** Prose terms a folio requires a formal definition for. Empty when unconfigured. */
export function termsNeedingDefinitions(): Readonly<Record<string, string>> {
  return getChapterProfiles().termsNeedingDefinitions ?? {};
}

/**
 * The chapter owning a Lean module, by path fragment; `undefined` when no rule
 * matches OR when no folio has supplied any — the caller must not read those
 * as the same thing, so `chapterProfilesConfigured()` distinguishes them.
 */
export function leanModuleChapter(relPath: string): string | undefined {
  for (const r of getChapterProfiles().leanModuleChapters ?? []) {
    if (relPath.includes(r.pathFragment)) return r.chapter;
  }
  return undefined;
}
