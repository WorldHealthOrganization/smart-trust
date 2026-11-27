/**
 * `merge:leftover` and the path classes it rests on (bean `blgm`).
 *
 * Every verdict is shown on a real git history built in a temp directory,
 * and each "landed" case has a sibling that must NOT read as landed. A
 * report proven only on its clean cases would be the false clean that the
 * third state exists to prevent.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { leftover, verdictOf, type LeftoverPath } from "../../merge-leftover.ts";
import { differsOnlyInRegions, isInstanceDeclaration, pathClass, sharedDeclarationsOf, stripGeneratedRegions } from "../../merge-pipeline-paths.ts";
import { parseMemberSpec } from "../../merge-pipeline-git.ts";
import { makeRepo, readme, type Repo } from "../merge-pipeline-fixture.ts";

const GEN = "cat-harness/docs/en/cat-harness/lsi/index.md"; // `glossary` (its literal lsi glob): take-base in every layout, unlike the core glossary route (bean w1gy F18)
let repo: Repo | undefined;
afterEach(() => { repo?.cleanup(); repo = undefined; });

describe("path classes come from the merge-conflict declaration", () => {
  test("take-base paths, kg-qa sidecars among them, are generated; READMEs are regions; the rest is authored", () => {
    expect(pathClass(GEN)).toEqual({ path: GEN, class: "generated", pattern: "glossary" });
    expect(pathClass("cat-harness/test/results/kg-qa/skills/x.kg-qa.json").class).toBe("generated");
    expect(pathClass("beans/README.md").class).toBe("generated-regions");
    expect(pathClass("cat-harness/scripts/merge-base.ts")).toEqual({ path: "cat-harness/scripts/merge-base.ts", class: "authored" });
    // A refused pattern is authored too: refusal is a declaration that a person decides.
    expect(pathClass("beans/defs/x.md").class).toBe("authored");
  });

  test("shared declarations: instance JSON, roles, package, lockfile, schemas, diagrams", () => {
    expect(isInstanceDeclaration("cat-harness/cat-harness.json")).toBe(true);
    expect(isInstanceDeclaration("smart-base/smart-base.json")).toBe(true);
    expect(isInstanceDeclaration("cat-harness/semantic-zoom.json")).toBe(false);
    expect(sharedDeclarationsOf("cat-harness/cat-harness.json")).toEqual(["instance-declaration"]);
    expect(sharedDeclarationsOf("cat-harness/scenarios/roles.json")).toEqual(["roles"]);
    expect(sharedDeclarationsOf("package.json")).toEqual(["package-json"]);
    expect(sharedDeclarationsOf("bun.lock")).toEqual(["lockfile"]);
    expect(sharedDeclarationsOf("cat-harness/schemas/tools/tool.ts")).toEqual(["schemas"]);
    expect(sharedDeclarationsOf("cat-harness/sdlc/processes/merge-base.bpmn")).toEqual(["processes"]);
    expect(sharedDeclarationsOf("cat-harness-tools/scripts/merge-train.ts")).toEqual([]);
  });

  test("region stripping: a changed region is region-only, changed prose is not, an unclosed region is not", () => {
    expect(differsOnlyInRegions(readme("prose", "a"), readme("prose", "b"))).toBe(true);
    expect(differsOnlyInRegions(readme("prose", "a"), readme("other", "a"))).toBe(false);
    const unclosed = "x\n<!-- kg:subgraph:begin -->\na\n";
    expect(stripGeneratedRegions(unclosed)).toBe(unclosed);
    expect(differsOnlyInRegions(unclosed, "x\n<!-- kg:subgraph:begin -->\nb\n")).toBe(false);
  });

  test("member specs: PR, pinned PR, ref", () => {
    expect(parseMemberSpec("1874")).toEqual({ kind: "pr", spec: "1874", number: 1874 });
    expect(parseMemberSpec("#1874:ABCDEF1")).toEqual({ kind: "pr", spec: "#1874:ABCDEF1", number: 1874, sha: "abcdef1" });
    expect(parseMemberSpec("origin/claude/x")).toEqual({ kind: "ref", spec: "origin/claude/x", ref: "origin/claude/x" });
  });
});

describe("verdictOf", () => {
  const p = (state: LeftoverPath["state"]): LeftoverPath => ({ path: state, state });
  test("different outranks unknown; unknown is never landed", () => {
    expect(verdictOf([p("different"), p("unknown")]).verdict).toBe("not-landed");
    expect(verdictOf([p("generated"), p("unknown")]).verdict).toBe("could-not-determine");
    expect(verdictOf([p("generated"), p("generated-region"), p("contained"), p("same")]).verdict).toBe("landed");
    expect(verdictOf([]).verdict).toBe("landed");
  });
});

describe("leftover on a real history", () => {
  /** main with one authored file, one generated file and a README. */
  const seed = (r: Repo): string => r.commit({
    "src/a.ts": "one\ntwo\nthree\nfour\nfive\nsix\nseven\n",
    [GEN]: "gen 0\n",
    "docs/README.md": readme("prose", "rows 0"),
  });

  test("a head the base contains is landed", () => {
    repo = makeRepo();
    seed(repo);
    repo.git("checkout", "-q", "-b", "pr");
    const head = repo.commit({ "src/a.ts": "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\n" });
    repo.git("checkout", "-q", "main");
    repo.git("merge", "-q", "--no-ff", "--no-edit", "pr");
    const r = leftover(repo.dir, head, repo.git("rev-parse", "main"));
    expect(r.verdict).toBe("landed");
    expect(r.reason).toContain("contained");
  });

  test("intent landed through a train: the head differs only in generated files, regions and changes the base already carries", () => {
    repo = makeRepo();
    seed(repo);
    repo.git("checkout", "-q", "-b", "pr");
    const prChange = { "src/a.ts": "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\n", [GEN]: "gen pr\n", "docs/README.md": readme("prose", "rows pr") };
    repo.commit(prChange);
    // The "train" lands the same change on main (not the same commit), then main moves on
    // in the same file, far from the PR's hunk, and regenerates.
    repo.git("checkout", "-q", "main");
    repo.commit({ ...prChange, [GEN]: "gen main\n", "docs/README.md": readme("prose", "rows main") });
    repo.commit({ "src/a.ts": "ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN\n" });
    const r = leftover(repo.dir, repo.git("rev-parse", "pr"), repo.git("rev-parse", "main"));
    expect(r.verdict).toBe("landed");
    const states = Object.fromEntries(r.paths.map((p) => [p.path, p.state]));
    expect(states).toEqual({ "src/a.ts": "contained", [GEN]: "generated", "docs/README.md": "generated-region" });
  });

  test("an authored change the base does not carry is not-landed, and named", () => {
    repo = makeRepo();
    seed(repo);
    repo.git("checkout", "-q", "-b", "pr");
    repo.commit({ "src/a.ts": "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\n", [GEN]: "gen pr\n", "src/new.ts": "x\n" });
    repo.git("checkout", "-q", "main");
    repo.commit({ [GEN]: "gen main\n" });
    const r = leftover(repo.dir, repo.git("rev-parse", "pr"), repo.git("rev-parse", "main"));
    expect(r.verdict).toBe("not-landed");
    expect(r.authored_different.sort()).toEqual(["src/a.ts", "src/new.ts"]);
  });

  test("a README whose PROSE the base lacks is authored, not a region", () => {
    repo = makeRepo();
    seed(repo);
    repo.git("checkout", "-q", "-b", "pr");
    repo.commit({ "docs/README.md": readme("new prose", "rows 0") });
    repo.git("checkout", "-q", "main");
    repo.commit({ "src/a.ts": "one\ntwo\nthree\nfour\nfive\nsix\nSEVEN\n" });
    const r = leftover(repo.dir, repo.git("rev-parse", "pr"), repo.git("rev-parse", "main"));
    expect(r.verdict).toBe("not-landed");
    expect(r.authored_different).toEqual(["docs/README.md"]);
  });

  test("the base rewrote the PR's own lines: not-landed, for a person to look at", () => {
    repo = makeRepo();
    seed(repo);
    repo.git("checkout", "-q", "-b", "pr");
    repo.commit({ "src/a.ts": "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\n" });
    repo.git("checkout", "-q", "main");
    repo.commit({ "src/a.ts": "uno\ntwo\nthree\nfour\nfive\nsix\nseven\n" });
    expect(leftover(repo.dir, repo.git("rev-parse", "pr"), repo.git("rev-parse", "main")).verdict).toBe("not-landed");
  });

  test("unrelated histories could not be determined, and are never shown as landed", () => {
    repo = makeRepo();
    const main = seed(repo);
    repo.git("checkout", "-q", "--orphan", "stray");
    repo.git("rm", "-q", "-rf", ".");
    const stray = repo.commit({ "x.ts": "x\n" });
    const r = leftover(repo.dir, stray, main);
    expect(r.verdict).toBe("could-not-determine");
  });
});
