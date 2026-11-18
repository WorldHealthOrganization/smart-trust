/**
 * Chapter profiles — which q-regimes a chapter may use, which chapters are
 * categorical, which archimedean — are editorial judgements about ONE folio's
 * chapters. A 31-entry map keyed by qou chapter directory names lived inline in
 * `qa-checkers-q-usage.ts`; it is behind a DI registry now, the third after
 * `value-registry-di` and `references-registry-di`.
 *
 * The two existing registries THROW when unconfigured, because a values or
 * bibliography lookup returning nothing is a bug. This one deliberately does
 * not: a folio that declares no chapter policy is a legitimate folio. Which
 * puts the whole weight on one distinction —
 *
 *   **unconfigured must read as `n/a`, never as "expectation met".**
 *
 * That is the failure mode this whole session has been about: a check that
 * passes because it found nothing. These pin it, along with the Proxy
 * plumbing that lets the checker keep reading the values as it always has.
 */
import { describe, test, expect, afterEach } from "bun:test";
import {
  configureChapterProfiles,
  resetChapterProfiles,
  getChapterProfiles,
  chapterProfilesConfigured,
  chapterHasProfile,
  CHAPTER_EXPECTED_REGIMES,
  CATEGORICAL_CHAPTERS,
  ARCHIMEDEAN_CHAPTERS,
} from "../../pipeline/chapter-profile-registry-di.ts";
// Leave the registry empty between tests: nothing in this layer ships a
// default any more, so empty is the state every other test file starts in.
afterEach(resetChapterProfiles);

const FIXTURE = {
  chapterExpectedRegimes: {
    "opening-chapter": new Set(["na", "symbolic"]),
    "measured-chapter": new Set(["na", "real-positive", "fixed-q0"]),
  },
  categoricalChapters: new Set(["opening-chapter"]),
  archimedeanChapters: new Set(["measured-chapter"]),
};

describe("unconfigured is 'no opinion', not 'no findings'", () => {
  test("reports itself unconfigured", () => {
    resetChapterProfiles();
    expect(chapterProfilesConfigured()).toBe(false);
  });

  test("no chapter has a profile — so nothing can be scored as passing", () => {
    resetChapterProfiles();
    expect(chapterHasProfile("opening-chapter")).toBe(false);
    expect(chapterHasProfile(undefined)).toBe(false);
  });

  test("the empty registry is empty, not a stub that answers yes", () => {
    // The trap would be a default that makes every membership test true, or a
    // lookup that returns a permissive set — either reads as "allowed".
    resetChapterProfiles();
    expect(CHAPTER_EXPECTED_REGIMES["anything"]).toBeUndefined();
    expect(CATEGORICAL_CHAPTERS.has("anything")).toBe(false);
    expect(ARCHIMEDEAN_CHAPTERS.has("anything")).toBe(false);
    expect(CATEGORICAL_CHAPTERS.size).toBe(0);
    expect(Object.keys(CHAPTER_EXPECTED_REGIMES)).toEqual([]);
  });
});

describe("configured", () => {
  test("the value exports read through to the injected data", () => {
    configureChapterProfiles(FIXTURE);
    expect([...CHAPTER_EXPECTED_REGIMES["opening-chapter"]]).toEqual(["na", "symbolic"]);
    expect(CATEGORICAL_CHAPTERS.has("opening-chapter")).toBe(true);
    expect(ARCHIMEDEAN_CHAPTERS.has("measured-chapter")).toBe(true);
    expect(CATEGORICAL_CHAPTERS.size).toBe(1);
  });

  test("`in`, Object.keys and Object.entries work through the Proxy", () => {
    // `ownKeys` and `getOwnPropertyDescriptor` have to agree or `Object.entries`
    // throws on a Proxy — the failure is a TypeError at the first consumer,
    // not a wrong answer, but it would only appear at runtime.
    configureChapterProfiles(FIXTURE);
    expect("opening-chapter" in CHAPTER_EXPECTED_REGIMES).toBe(true);
    expect(Object.keys(CHAPTER_EXPECTED_REGIMES).sort())
      .toEqual(["measured-chapter", "opening-chapter"]);
    expect(() => Object.entries(CHAPTER_EXPECTED_REGIMES)).not.toThrow();
    expect(Object.entries(CHAPTER_EXPECTED_REGIMES)).toHaveLength(2);
  });

  test("iteration over the chapter sets works", () => {
    configureChapterProfiles(FIXTURE);
    expect([...CATEGORICAL_CHAPTERS]).toEqual(["opening-chapter"]);
    expect([...ARCHIMEDEAN_CHAPTERS]).toEqual(["measured-chapter"]);
  });

  test("chapterHasProfile distinguishes a known chapter from an unknown one", () => {
    configureChapterProfiles(FIXTURE);
    expect(chapterHasProfile("opening-chapter")).toBe(true);
    expect(chapterHasProfile("never-heard-of-it")).toBe(false);
  });

  test("a later configure wins", () => {
    configureChapterProfiles(FIXTURE);
    configureChapterProfiles({
      chapterExpectedRegimes: { "only-mine": new Set(["na"]) },
      categoricalChapters: new Set(),
      archimedeanChapters: new Set(),
    });
    expect(Object.keys(CHAPTER_EXPECTED_REGIMES)).toEqual(["only-mine"]);
    expect(chapterHasProfile("opening-chapter")).toBe(false);
  });
});

describe("no shipped default", () => {
  // The checker that reads these profiles moved to folio-assistant-sci (bean
  // saqd); its "loading the checker configures nothing" twin is there. Here
  // the registry module itself must ship no default.
  test("loading the registry configures nothing", async () => {
    resetChapterProfiles();
    await import("../../pipeline/chapter-profile-registry-di.ts");
    expect(chapterProfilesConfigured()).toBe(false);
    expect(getChapterProfiles().archimedeanChapters.size).toBe(0);
  });
});
