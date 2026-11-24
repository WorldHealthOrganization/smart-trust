/**
 * `merge:overlap` — the T3 conflict test on authored paths plus shared
 * declarations (bean `blgm`). Fixtures only: no `gh`, no network.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { buildReport, classifyMember, measure, pairsOf, parseGhPrLines, type OverlapMember } from "../../merge-overlap.ts";
import { makeRepo, readme, type Repo } from "../merge-pipeline-fixture.ts";

const GEN = "cat-harness/docs/en/cat-harness/lsi/index.md"; // `glossary` (its literal lsi glob): take-base in every layout, unlike the core glossary route (bean w1gy F18)
const member = (id: string, files: string[], regionOnly?: (p: string) => boolean | undefined): OverlapMember =>
  classifyMember({ id, head_sha: "0".repeat(40) }, files, regionOnly);

describe("classifyMember", () => {
  test("generated paths are counted, not listed; shared declarations and harness flags are found", () => {
    const m = member("#1", [GEN, "cat-harness/scripts/a.ts", "package.json", "cat-harness-tools/x.ts", "beans/README.md"]);
    expect(m.generated_count).toBe(1);
    expect(m.authored_paths).toEqual(["cat-harness-tools/x.ts", "cat-harness/scripts/a.ts", "package.json"]);
    expect(m.region_paths).toEqual(["beans/README.md"]);
    expect(m.touches_shared).toEqual([{ path: "package.json", declaration: "package-json" }]);
    expect(m.touches_cat_harness).toBe(true);
    expect(m.touches_cat_harness_tools).toBe(true);
  });

  test("a README whose prose changed (or could not be read) is authored", () => {
    expect(member("#1", ["beans/README.md"], () => false).authored_paths).toEqual(["beans/README.md"]);
    expect(member("#1", ["beans/README.md"], () => undefined).authored_paths).toEqual(["beans/README.md"]);
  });
});

describe("pairsOf — the T3 rule", () => {
  test("two PRs sharing only generated files are independent (R7)", () => {
    const [p] = pairsOf([member("#1", [GEN, "a.ts"]), member("#2", [GEN, "b.ts"])]);
    expect(p!.independent).toBe(true);
  });

  test("an authored overlap is not independent, and is listed", () => {
    const [p] = pairsOf([member("#1", ["a.ts", "x.ts"]), member("#2", ["x.ts"])]);
    expect(p!.independent).toBe(false);
    expect(p!.authored_overlap).toEqual(["x.ts"]);
  });

  test("touching a shared declaration makes a pair dependent even with disjoint paths", () => {
    const [p] = pairsOf([member("#1", ["a.ts", "cat-harness/schemas/s.ts"]), member("#2", ["b.ts"])]);
    expect(p!.independent).toBe(false);
    expect(p!.shared_touchers).toEqual(["#1"]);
    expect(p!.shared_overlap).toEqual([]);
  });

  test("a region-only overlap is reported but does not by itself make a pair dependent", () => {
    const [p] = pairsOf([member("#1", ["beans/README.md", "a.ts"]), member("#2", ["beans/README.md"])]);
    expect(p!.region_overlap).toEqual(["beans/README.md"]);
    expect(p!.independent).toBe(true);
  });

  test("an undetermined member makes no pair independent", () => {
    const u = { ...member("#2", []), could_not_determine: "fetch failed" };
    const [p] = pairsOf([member("#1", ["a.ts"]), u]);
    expect(p!.independent).toBeNull();
  });

  test("the report lists only the pairs that are not independent, with counts", () => {
    const r = buildReport([member("#1", ["a.ts"]), member("#2", ["b.ts"]), member("#3", ["a.ts", "bun.lock"])], { base: "origin/main", base_sha: "x", source: "branches" });
    expect(r.pairs.map((p) => `${p.a}×${p.b}`)).toEqual(["#1×#3", "#2×#3"]);
    expect(r.summary).toMatchObject({ members: 3, touching_shared: 1, conflicting_pairs: 2, undetermined: 0 });
  });
});

describe("parseGhPrLines", () => {
  test("one object per line; a bad line fails the listing rather than dropping a PR", () => {
    const ok = parseGhPrLines('{"number":1,"headRefName":"a","headRefOid":"x","isDraft":false,"title":"t"}\n\n{"number":2,"headRefName":"b","headRefOid":"y","isDraft":true,"title":"u"}\n');
    expect(Array.isArray(ok) && ok.map((p) => p.number)).toEqual([1, 2]);
    expect(typeof parseGhPrLines('{"number":1}\nnot json')).toBe("string");
  });
});

describe("measure on a real history", () => {
  let repo: Repo | undefined;
  afterEach(() => { repo?.cleanup(); repo = undefined; });

  test("diffs against the fork point, and reads READMEs to tell regions from prose", () => {
    repo = makeRepo();
    const base = repo.commit({ "a.ts": "a\n", "docs/README.md": readme("prose", "0"), "notes/README.md": readme("prose", "0") });
    repo.git("checkout", "-q", "-b", "pr");
    const head = repo.commit({ "a.ts": "A\n", [GEN]: "g\n", "docs/README.md": readme("prose", "1"), "notes/README.md": readme("changed", "0") });
    repo.git("checkout", "-q", "main");
    const moved = repo.commit({ "other.ts": "o\n" }); // the base moved on; it must not count
    const m = measure(repo.dir, moved, head, { id: "pr", head_sha: head });
    expect(m.authored_paths).toEqual(["a.ts", "notes/README.md"]);
    expect(m.region_paths).toEqual(["docs/README.md"]);
    expect(m.generated_count).toBe(1);
    expect(base).not.toBe(moved);
  });

  test("an unknown head is undetermined, not empty", () => {
    repo = makeRepo();
    const base = repo.commit({ "a.ts": "a\n" });
    const m = measure(repo.dir, base, "f".repeat(40), { id: "pr", head_sha: null });
    expect(m.could_not_determine).toBeDefined();
  });
});
