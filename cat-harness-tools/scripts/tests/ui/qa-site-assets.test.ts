/**
 * The site's QA evidence: where it came from, and whether all of it landed.
 *
 * Bean `tfqf`, defect C10: the publishing workflows copied whatever the
 * results tree held, so an absent corpus published a smaller set and the step
 * stayed green. Each branch of the decision is pinned here over constructed
 * trees — the real corpus is never moved inside `bun test` (bean `ymsu`).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AVAILABILITY_SCHEMA,
  STATE_SCHEMA,
  TREE_COMMITS_FILE,
  TREE_COMMITS_SCHEMA,
  countPublished,
  countResults,
  decideSource,
  holdsCorpus,
  judgePublished,
  readTreeCommitIndex,
  treeCommitIndex,
  type QaFetchState,
} from "../../qa-site-assets.ts";

function tree(files: string[]): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "qa-site-assets-"));
  for (const f of files) {
    mkdirSync(join(dir, f, ".."), { recursive: true });
    writeFileSync(join(dir, f), "{}\n");
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const NONE = { witnesses: 0, results: 0, files: 0 };
const NO_CORPUS = { ...NONE, corpus: false };

function state(over: Partial<QaFetchState>): QaFetchState {
  return {
    $schema: STATE_SCHEMA,
    source: "checkout",
    requested: ["main/abc"],
    reason: "r",
    expected: { witnesses: 3, results: 2, files: 10 },
    attempts: [],
    ...over,
  };
}

describe("countResults / countPublished", () => {
  test("counts the two published shapes, and an absent tree is zeros", () => {
    const { dir, cleanup } = tree([
      "witnesses/page-a/n1.block.json",
      "witnesses/page-a/qa-index.json",
      "witnesses/page-b/n2.kg.json",
      "a.qa-results.json",
      "b.qa-results.json",
      "kg-qa/x.kg-qa.json",
    ]);
    expect(countResults(dir)).toEqual({ witnesses: 3, results: 2, files: 6 });
    expect(countResults(join(dir, "nope"))).toEqual(NONE);
    cleanup();
  });

  test("a site's top-level index.json and availability.json are not evidence", () => {
    const { dir, cleanup } = tree([
      "assets/qa/index.json",
      "assets/qa/availability.json",
      "assets/qa/a.qa-results.json",
      "assets/qa/page-a/n1.block.json",
    ]);
    expect(countPublished(dir)).toEqual({ witnesses: 1, results: 1 });
    expect(countPublished(join(dir, "nope"))).toEqual({ witnesses: 0, results: 0 });
    cleanup();
  });

  test("a top-level file the witness tree carries is counted on both sides (4l4d's translation-qa-pages.json)", () => {
    // Measured on PR #1801 staging: the tree held 170, the site 169, because
    // `gen-docs-pages` writes `witnesses/translation-qa-pages.json` at the top.
    const { dir, cleanup } = tree([
      "witnesses/translation-qa-pages.json",
      "witnesses/page-a/n1.block.json",
      "assets/qa/translation-qa-pages.json",
      "assets/qa/index.json",
      "assets/qa/availability.json",
      "assets/qa/page-a/n1.block.json",
    ]);
    expect(countResults(dir).witnesses).toBe(2);
    expect(countPublished(dir)).toEqual({ witnesses: 2, results: 0 });
    cleanup();
  });
});

describe("decideSource", () => {
  const counts = { witnesses: 5, results: 4, files: 30 };

  test("on a PR preview, a checkout holding the corpus publishes it as checked out, even when the store has a PR entry", () => {
    const d = decideSource({ ...counts, corpus: true }, { index: 0, key: "pr/1/abc", counts: { witnesses: 9, results: 9, files: 99 } });
    expect(d.source).toBe("checkout");
    expect(d.expected).toEqual(counts);
  });

  test("on a main build, an exact main/<sha> hit wins over a committed checkout corpus (tfqf precedence rule)", () => {
    const fetchedCounts = { witnesses: 9, results: 9, files: 99 };
    const d = decideSource({ ...counts, corpus: true }, { index: 0, key: "main/abc", counts: fetchedCounts });
    expect(d.source).toBe("fetched");
    expect(d.expected).toEqual(fetchedCounts);
    expect(d.reason).toContain("exact main/<sha> entry for this commit wins over the checkout");
  });

  test("on a main build, a fallback or floating/non-corpus hit does NOT override a committed checkout corpus", () => {
    const fetchedCounts = { witnesses: 9, results: 9, files: 99 };
    expect(decideSource({ ...counts, corpus: true }, { index: 1, key: "main/older", counts: fetchedCounts }).source).toBe("checkout");
    expect(decideSource({ ...counts, corpus: true }, { index: 0, key: "main/abc", counts: fetchedCounts, exact: false }).source).toBe("checkout");
    expect(decideSource({ ...counts, corpus: true }, { index: 0, key: "main/abc", counts: fetchedCounts, corpus: false }).source).toBe("checkout");
  });

  test("an absent corpus with an exact hit is `fetched`, judged against the ENTRY's counts", () => {
    const d = decideSource(NO_CORPUS, { index: 0, key: "main/abc", counts });
    expect(d).toMatchObject({ source: "fetched", expected: counts });
  });

  test("a hit on a fallback ref is labelled as another commit's evidence", () => {
    const d = decideSource(NO_CORPUS, { index: 1, key: "main/older", counts });
    expect(d.source).toBe("fetched-fallback");
    expect(d.reason).toContain("ANOTHER commit");
  });

  test("no corpus and no hit is `unavailable`, never an empty success", () => {
    const d = decideSource(NO_CORPUS, undefined);
    expect(d.source).toBe("unavailable");
    expect(d.reason).toContain("QA not available for this ref");
  });
});

describe("holdsCorpus — a build's own leftovers are not a corpus", () => {
  test("one build-written result is NOT a corpus; a verdict family is", () => {
    // Measured: a preview run left `kg-export.qa-results.json` behind in an
    // otherwise absent tree, and the next fetch called the checkout present.
    const { dir, cleanup } = tree(["kg-export.qa-results.json"]);
    expect(holdsCorpus(dir)).toBe(false);
    const decided = decideSource({ ...countResults(dir), corpus: holdsCorpus(dir) }, undefined);
    expect(decided.source).toBe("unavailable");
    mkdirSync(join(dir, "kg-qa"));
    expect(holdsCorpus(dir)).toBe(true);
    cleanup();
  });
});

describe("judgePublished — the C10 shrink fails the step", () => {
  test("everything landed: no error, and the availability document says where it came from", () => {
    const j = judgePublished(state({ key: "main/abc" }), { witnesses: 3, results: 2, files: 10 }, { witnesses: 3, results: 2 });
    expect(j.errors).toEqual([]);
    expect(j.availability).toMatchObject({ $schema: AVAILABILITY_SCHEMA, source: "checkout", key: "main/abc" });
  });

  test("results that existed at the start and did not publish are a SHRINK", () => {
    // The measured case: 20 results committed, one written by the build, one published.
    const j = judgePublished(state({ expected: { witnesses: 0, results: 20, files: 20 } }), { witnesses: 0, results: 1, files: 1 }, { witnesses: 0, results: 1 });
    expect(j.errors.join("\n")).toContain("SHRINK");
  });

  test("a copy that dropped files present NOW is an error whatever the source", () => {
    const j = judgePublished(state({ source: "unavailable", expected: NONE }), { witnesses: 2, results: 1, files: 3 }, { witnesses: 0, results: 0 });
    expect(j.errors.length).toBe(2);
  });

  test("`unavailable` is a warning and a published state, not an error", () => {
    const j = judgePublished(state({ source: "unavailable", expected: NONE, reason: "QA not available for this ref" }), NONE, { witnesses: 0, results: 0 });
    expect(j.errors).toEqual([]);
    expect(j.warnings).toEqual(["QA not available for this ref"]);
    expect(j.availability.source).toBe("unavailable");
  });

  test("a fallback entry's witness shortfall warns rather than fails; its results shortfall still fails", () => {
    const s = state({ source: "fetched-fallback", expected: { witnesses: 10, results: 2, files: 12 } });
    const w = judgePublished(s, { witnesses: 8, results: 2, files: 10 }, { witnesses: 8, results: 2 });
    expect(w.errors).toEqual([]);
    expect(w.warnings.length).toBe(1);
    const r = judgePublished(s, { witnesses: 10, results: 1, files: 11 }, { witnesses: 10, results: 1 });
    expect(r.errors.join("\n")).toContain("SHRINK");
  });
});

// The tree-to-commit index the QA panel links a verdict's tree through
// (folio-assistant bean 69lr; owner card Q5, 2026-11-05, option 1).
describe("tree-commits: the tree-to-commit index", () => {
  const T = (c: string) => c.repeat(40);
  test("each tree keeps the OLDEST first-parent commit carrying it", () => {
    // git prints newest first; trees `a` is on two commits, `1` (newer) and `3` (older).
    const log = [`${T("a")} ${T("1")}`, `${T("b")} ${T("2")}`, `${T("a")} ${T("3")}`].join("\n");
    const i = treeCommitIndex(log, "https://github.com/o/r");
    expect(i.$schema).toBe(TREE_COMMITS_SCHEMA);
    expect(i.commits).toEqual({ [T("a")]: T("3"), [T("b")]: T("2") });
    expect(i.depth).toBe(3);
    expect(i.repo).toBe("https://github.com/o/r");
  });
  test("each tree carries its kept commit's date, so a verdict's date is derived from its tree", () => {
    const log = [`${T("a")} ${T("1")} 2026-11-06T04:00:00Z`, `${T("b")} ${T("2")} 2026-11-05T10:00:00+01:00`, `${T("a")} ${T("3")} 2026-11-04T09:00:00Z`].join("\n");
    const i = treeCommitIndex(log, undefined);
    expect(i.commits[T("a")]).toBe(T("3"));
    expect(i.dates).toEqual({ [T("a")]: "2026-11-04T09:00:00Z", [T("b")]: "2026-11-05T10:00:00+01:00" });
  });
  test("a log without dates still reads, and carries no dates", () => {
    const i = treeCommitIndex(`${T("a")} ${T("1")}`, undefined);
    expect(i.commits).toEqual({ [T("a")]: T("1") });
    expect(i.dates).toBeUndefined();
  });
  test("readTreeCommitIndex reads this repository's own history, with dates", () => {
    const i = readTreeCommitIndex(process.cwd(), 3);
    expect(i.depth).toBeGreaterThan(0);
    const [tree] = Object.keys(i.commits);
    expect(i.dates?.[tree!]).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
  test("no GitHub origin: no repo, so the panel builds no link", () => {
    expect(treeCommitIndex("", undefined).repo).toBeNull();
    expect(treeCommitIndex("", "https://gitlab.com/o/r").repo).toBeNull();
    expect(treeCommitIndex("", "https://github.com/o/r/extra").repo).toBeNull();
  });
  test("lines that are not two full ids are skipped, never guessed", () => {
    const i = treeCommitIndex(`garbage\n${T("a")}\n${T("a")} ${T("1")} extra\n`, undefined);
    expect(i.commits).toEqual({});
    expect(i.depth).toBe(0);
  });
  test("the index is not counted as QA evidence", () => {
    const { dir, cleanup } = tree([`assets/qa/${TREE_COMMITS_FILE}`, "assets/qa/x/a.json"]);
    try {
      expect(countPublished(dir).witnesses).toBe(1);
    } finally {
      cleanup();
    }
  });
});
