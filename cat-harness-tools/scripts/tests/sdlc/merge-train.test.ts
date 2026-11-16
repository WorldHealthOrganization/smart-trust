/**
 * `merge:train` — the log parsers, the verdict, and the dry-run simulation on
 * a real history (bean `blgm`). The real run shells out to `merge-base.ts`
 * and `regen`, which have their own tests; what is tested here is what this
 * command decides from them.
 */
import { afterEach, describe, expect, test } from "bun:test";

import {
  classifyConflicts,
  parseAbortReason,
  parseConflicted,
  parseMergeTree,
  parseRefusedPaths,
  afterMergeRepairs,
  checkTestResultsDrops,
  keepTrackedIgnored,
  simulate,
  verdictOf,
  type TrainReport,
} from "../../merge-train.ts";
import { git as runGit } from "../../merge-pipeline-git.ts";
import { conflicts } from "../../milestone-status.ts";
import { makeRepo, type Repo } from "../merge-pipeline-fixture.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GEN = "cat-harness/docs/en/cat-harness/lsi/index.md"; // `glossary` (its literal lsi glob): take-base in every layout, unlike the core glossary route (bean w1gy F18)

/** The shape `merge-base.ts` prints, copied from its `describe` and abort lines. */
const REFUSED_LOG = `merge-base: 3 conflicted path(s) merging abc
  ✓ ${GEN}  [glossary: take-base]
  ✓ beans/README.md  [readme-generated-regions: generated-regions]
  ✗ cat-harness/scripts/x.ts  [no declared pattern]
  ✗ beans/defs/y.md  [beans: refuse] — bean definitions (44).

merge-base: ABORTED, tree restored — 2 conflict(s) need a person (✗ above)`;

describe("merge-base log parsing", () => {
  test("refused paths are the ✗ lines, with or without a pattern", () => {
    expect(parseRefusedPaths(REFUSED_LOG)).toEqual(["cat-harness/scripts/x.ts", "beans/defs/y.md"]);
  });

  test("every conflicted path is recovered with its pattern and strategy", () => {
    expect(parseConflicted(REFUSED_LOG)).toEqual([
      { path: GEN, pattern: "glossary", strategy: "take-base" },
      { path: "beans/README.md", pattern: "readme-generated-regions", strategy: "generated-regions" },
      { path: "cat-harness/scripts/x.ts", strategy: "refuse" },
      { path: "beans/defs/y.md", pattern: "beans", strategy: "refuse" },
    ]);
  });

  test("the abort reason is the ABORTED line's, else the last line", () => {
    expect(parseAbortReason(REFUSED_LOG)).toBe("2 conflict(s) need a person (✗ above)");
    expect(parseAbortReason("merge-base: no such base deadbeef\n")).toBe("merge-base: no such base deadbeef");
  });

  test("a train re-asks every declared afterMerge check, and only those with a writer (bean 0r7u)", () => {
    expect(
      afterMergeRepairs({
        "b:check": { outputs: [], writer: "b:all", afterMerge: true },
        "a:check": { outputs: [], writer: "a:write", afterMerge: true },
        "c:check": { outputs: [], writer: "c:all" },
        "d:check": { outputs: [] },
      }),
    ).toEqual([
      { check: "a:check", writer: "a:write" },
      { check: "b:check", writer: "b:all" },
    ]);
  });

  test("with no instance declaring one, a train re-asks nothing extra", () => {
    expect(afterMergeRepairs({})).toEqual([]);
  });

  test("merge-tree output: clean, conflicted, and a failure that is neither", () => {
    const t = "a".repeat(40);
    expect(parseMergeTree({ code: 0, out: t })).toEqual({ tree: t, conflicted: [] });
    expect(parseMergeTree({ code: 1, out: `${t}\nx\nx\ny` })).toEqual({ tree: t, conflicted: ["x", "y"] });
    expect(parseMergeTree({ code: 128, out: "" })).toBeUndefined();
  });

  test("conflicts are classified by the same patterns merge-base acts on", () => {
    const c = classifyConflicts([GEN, "src/a.ts"]);
    expect(c.refused).toEqual(["src/a.ts"]);
    expect(c.conflicted.find((x) => x.path === GEN)?.pattern).toBe("glossary");
  });
});

describe("verdictOf", () => {
  const ok: Pick<TrainReport, "members" | "checks" | "main"> = {
    members: [{ spec: "1", label: "#1", sha: "a", status: "merged" }],
    checks: [{ name: "regen", command: "bun run cat regen", status: "passed", exit: 0 }],
    main: { ref: "origin/main", sha: "b", status: "merged" },
  };
  test("built only when nothing needs a person", () => {
    expect(verdictOf(ok)).toBe("built");
    expect(verdictOf({ ...ok, members: [...ok.members, { spec: "2", label: "#2", sha: "c", status: "refused" }] })).toBe("needs-a-person");
    expect(verdictOf({ ...ok, checks: [{ name: "l1", command: "", status: "findings", exit: 1 }] })).toBe("needs-a-person");
    expect(verdictOf({ ...ok, main: { ...ok.main, status: "refused" } })).toBe("needs-a-person");
    expect(verdictOf({ ...ok, checks: [{ name: "kg", command: "", status: "repaired", exit: 0 }] })).toBe("built");
  });
});

describe("simulate — the dry run on a real history", () => {
  let repo: Repo | undefined;
  afterEach(() => { repo?.cleanup(); repo = undefined; });

  test("members merge onto the SIMULATED train; an authored conflict is refused; a generated one is not", () => {
    repo = makeRepo();
    const base = repo.commit({ "a.ts": "a\n", "b.ts": "b\n", [GEN]: "g\n" });
    const branch = (name: string, files: Record<string, string>): string => {
      repo!.git("checkout", "-q", "-b", name, base);
      return repo!.commit(files);
    };
    const one = branch("one", { "a.ts": "A1\n", [GEN]: "g1\n" });
    const two = branch("two", { "b.ts": "B2\n", [GEN]: "g2\n" }); // generated conflict with one only
    const three = branch("three", { "a.ts": "A3\n" }); // authored conflict with one
    repo.git("checkout", "-q", "main");
    const before = repo.git("for-each-ref");
    const r = simulate(repo.dir, base, [
      { label: "one", spec: "one", sha: one },
      { label: "two", spec: "two", sha: two },
      { label: "three", spec: "three", sha: three },
      { label: "one again", spec: "one", sha: one },
    ]);
    expect(r.members.map((m) => m.status)).toEqual(["would-merge", "would-merge", "would-refuse", "already-contained"]);
    expect(r.members[1]!.conflicted).toEqual([{ path: GEN, pattern: "glossary", strategy: "take-base" }]);
    expect(r.members[2]!.refused_paths).toEqual(["a.ts"]);
    // Nothing visible changed: no ref, no working-tree file.
    expect(repo.git("for-each-ref")).toBe(before);
    expect(repo.git("status", "--porcelain")).toBe("");
    expect(r.main.status).toBe("skipped");
  });

  test("main is merged last onto the simulated train", () => {
    repo = makeRepo();
    const base = repo.commit({ "a.ts": "a\n", [GEN]: "g\n" });
    repo.git("checkout", "-q", "-b", "one");
    const one = repo.commit({ [GEN]: "g1\n" });
    repo.git("checkout", "-q", "main");
    const main = repo.commit({ [GEN]: "gm\n" });
    const r = simulate(repo.dir, base, [{ label: "one", spec: "one", sha: one }], { ref: "main", sha: main });
    expect(r.main.status).toBe("would-merge");
    expect(r.main.conflicted?.[0]?.path).toBe(GEN);
  });
});

// Bean `0s6w`. The NEGATIVE CONTROL for mergeability: a pair KNOWN to conflict
// must read 1, a ref that does not exist must read as an error (>=2), never as
// clean. On 2026-10-03 a steward read `rc=0` for a conflicted PR for a whole
// session — the forge's HTTP 405 at merge time was the only thing that caught
// it — because `$?` was read after a command substitution on the same line.
// A future change to how rc is reported must not be able to make these read 0.
describe("merge-tree exit status — the negative control (bean 0s6w)", () => {
  let repo: Repo | undefined;
  afterEach(() => { repo?.cleanup(); repo = undefined; });

  const conflictedPair = () => {
    repo = makeRepo();
    const base = repo.commit({ "a.ts": "a\n" });
    const ours = repo.commit({ "a.ts": "ours\n" });
    repo.git("checkout", "-q", "-b", "theirs", base);
    const theirs = repo.commit({ "a.ts": "theirs\n" });
    return { ours, theirs };
  };

  test("a known-conflicted pair reads 1, with the conflicted path", () => {
    const { ours, theirs } = conflictedPair();
    const r = runGit(repo!.dir, ["merge-tree", "--write-tree", "--name-only", "--no-messages", ours, theirs]);
    expect(r.code).toBe(1);
    expect(parseMergeTree(r)?.conflicted).toEqual(["a.ts"]);
  });

  test("a ref it cannot merge is NOT clean and NOT a conflict list — and its exit code alone cannot say so", () => {
    // Measured with git 2.43: an unfetched or mistyped ref exits 1, the same
    // code as a real conflict, printing "not something we can merge" to stderr
    // and no tree on stdout. So the code is not the whole contract; the tree
    // line is. `parseMergeTree` requires it, and `milestone-status` now does too.
    const { ours } = conflictedPair();
    const r = runGit(repo!.dir, ["merge-tree", "--write-tree", "--name-only", "--no-messages", ours, "0".repeat(40)]);
    expect(r.code).not.toBe(0);
    expect(parseMergeTree(r)).toBeUndefined();
    expect(conflicts(ours, "0".repeat(40), repo!.dir)).toBeUndefined();
  });

  test("milestone-status still reads a real conflict, and a clean pair, from the same repo", () => {
    const { ours, theirs } = conflictedPair();
    expect(conflicts(ours, theirs, repo!.dir)).toEqual({ authored: ["a.ts"], generated: 0 });
    expect(conflicts(ours, ours, repo!.dir)).toEqual({ authored: [], generated: 0 });
  });

  test("the shell trap itself: $? read after a command substitution reports the SUBSTITUTION's status", () => {
    // Kept as a test so the reason for the rule cannot be argued away: the
    // wrong form prints rc=0 on the same conflicted pair the right form reads 1.
    const { ours, theirs } = conflictedPair();
    const sh = (line: string) =>
      Bun.spawnSync(["bash", "-c", `git merge-tree --write-tree ${ours} ${theirs} >/dev/null 2>&1\n${line}`], { cwd: repo!.dir }).stdout.toString().trim();
    expect(sh('echo "rc=$?"')).toBe("rc=1");
    expect(sh('echo "base($(git rev-parse --short HEAD)) rc=$?"')).toMatch(/ rc=0$/);
  });
});

describe("keepTrackedIgnored and checkTestResultsDrops (bean u4up)", () => {
  let repo: Repo | undefined;
  afterEach(() => { repo?.cleanup(); repo = undefined; });

  test("keepTrackedIgnored restages a dropped-from-index gitignored file that exists on disk", () => {
    repo = makeRepo();
    const filePath = "cat-harness/test/results/skills.lsi.json";
    repo.commit({
      ".gitignore": "*/test/results/*\ntest/results/*\n",
    });
    const fullPath = join(repo.dir, filePath);
    mkdirSync(join(repo.dir, "cat-harness/test/results"), { recursive: true });
    writeFileSync(fullPath, JSON.stringify({ tracked: true }));
    repo.git("add", "-f", filePath);
    const baseWithTracked = repo.commit({}, "commit tracked file");

    // Drop from index (simulating a drop or unstage where file remains on disk)
    repo.git("rm", "--cached", filePath);
    expect(repo.git("status", "--porcelain")).toContain(`D  ${filePath}`);

    // keepTrackedIgnored restores it to index
    const kept = keepTrackedIgnored(repo.dir, baseWithTracked);
    expect(kept).toEqual([filePath]);
    expect(repo.git("status", "--porcelain")).toBe("");
  });

  test("checkTestResultsDrops passes when no tracked test/results are dropped", () => {
    repo = makeRepo();
    const filePath = "cat-harness/test/results/skills.lsi.json";
    mkdirSync(join(repo.dir, "cat-harness/test/results"), { recursive: true });
    writeFileSync(join(repo.dir, filePath), "{}");
    repo.git("add", "-f", filePath);
    const base = repo.commit({}, "add tracked results");

    const check = checkTestResultsDrops(repo.dir, base);
    expect(check.status).toBe("passed");
    expect(check.exit).toBe(0);
  });

  test("checkTestResultsDrops fails and verdictOf returns needs-a-person when a tracked test/results file is dropped", () => {
    repo = makeRepo();
    const filePath = "cat-harness/test/results/skills.lsi.json";
    mkdirSync(join(repo.dir, "cat-harness/test/results"), { recursive: true });
    writeFileSync(join(repo.dir, filePath), "{}");
    repo.git("add", "-f", filePath);
    const base = repo.commit({}, "add tracked results");

    repo.git("rm", filePath);
    repo.git("commit", "-m", "drop tracked results");

    const check = checkTestResultsDrops(repo.dir, base);
    expect(check.status).toBe("failed");
    expect(check.exit).toBe(1);
    expect(check.detail).toContain(filePath);

    const verdict = verdictOf({
      members: [{ spec: "1", label: "#1", sha: "a", status: "merged" }],
      checks: [check],
      main: { ref: "origin/main", sha: "b", status: "merged" },
    });
    expect(verdict).toBe("needs-a-person");
  });
});

