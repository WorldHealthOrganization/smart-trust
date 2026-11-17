/**
 * The evidence gathering, against real git repositories built for the purpose.
 *
 * `checks.test.ts` proves each check fires when handed the right evidence.
 * This proves the evidence is gathered correctly — and, more importantly, that
 * each way of failing to gather it produces the RIGHT ONE of the three states.
 * Those are different tests: a probe that returned `{ state: "ok", value: [] }`
 * on an unreachable branch would pass every test in the other file.
 *
 * @module test/health/probes.test
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `beans/` store) live in
 * `test/health-probes-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "bun:test";

import { resolveBeanArchive } from "../../scripts/beans.ts";
import { countConsideredOptions, doneWhenState, frontMatter, frontMatterValue, probeBranches, probeBeans, probeRepoSize, probeSpecialBranches, probeStaging, probeTodos } from "./probes.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function run(cwd: string, cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
}

/** A throwaway repository with one commit. */
function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "health-probe-"));
  made.push(dir);
  run(dir, "git", ["init", "-q", "-b", "main"]);
  run(dir, "git", ["config", "user.email", "t@example.invalid"]);
  run(dir, "git", ["config", "user.name", "T"]);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  run(dir, "git", ["add", "-A"]);
  run(dir, "git", ["commit", "-qm", "fixture"]);
  return dir;
}

/**
 * The branch evidence, against a real remote with a real merge in it.
 *
 * The three answers this probe can give about one branch are different facts
 * and are tested separately: **merged**, **carries unmerged work**, and **I
 * could not tell**. Collapsing the third into either of the first two is what
 * bean `w2g5` is about, and a probe that returned `mergedIntoDefault: true`
 * whenever it failed would pass any test that only looked at the two decided
 * cases.
 */
describe("probeBranches", () => {
  /** `git`, at a fixed commit date — the dates are what the frontier test turns on. */
  function runAt(cwd: string, iso: string, args: string[]): void {
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  }

  /**
   * A remote carrying `main`, a branch merged into it, and one that is not.
   *
   * Dated deliberately and in order: `claude/merged`'s tip is BEFORE the merge
   * commit and `claude/still-going`'s is AFTER it, which is what lets the
   * shallow tests tell "the answer is unreliable" from "the answer is sound
   * even here".
   */
  function remoteWithBranches(): string {
    const dir = repo({ "a.txt": "a" });
    run(dir, "git", ["checkout", "-q", "-b", "claude/merged"]);
    writeFileSync(join(dir, "b.txt"), "b");
    run(dir, "git", ["add", "-A"]);
    runAt(dir, "2026-09-02T00:00:00Z", ["commit", "-qm", "work that landed"]);
    run(dir, "git", ["checkout", "-q", "main"]);
    // A merge COMMIT, which is how this repository merges — the tip of
    // `claude/merged` becomes an ancestor of `main`. Under squash-merge it
    // would not, and the probe would report every branch as unmerged; that is
    // stated in the check's own documentation as an assumption.
    runAt(dir, "2026-09-03T00:00:00Z", ["merge", "-q", "--no-ff", "-m", "Merge pull request #1", "claude/merged"]);
    run(dir, "git", ["checkout", "-q", "-b", "claude/still-going"]);
    writeFileSync(join(dir, "c.txt"), "c");
    run(dir, "git", ["add", "-A"]);
    runAt(dir, "2026-09-04T00:00:00Z", ["commit", "-qm", "work that has not landed"]);
    run(dir, "git", ["checkout", "-q", "main"]);
    run(dir, "git", ["config", "--bool", "core.bare", "true"]);
    return dir;
  }

  function local(remote: string): string {
    const dir = repo({ "unrelated.txt": "x" });
    run(dir, "git", ["remote", "add", "origin", remote]);
    return dir;
  }

  it("tells a merged branch from one that carries unmerged work, and dates both", () => {
    const dir = local(remoteWithBranches());
    const p = probeBranches({
      repoRoot: dir,
      remote: "origin",
      previewSlugs: ["claude-merged", "claude-still-going"],
    });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.defaultBranch).toBe("main");
    const by = new Map(p.value.candidates.map((c) => [c.ref, c]));
    expect([...by.keys()].sort()).toEqual(["claude/merged", "claude/still-going"]);
    expect(by.get("claude/merged")?.mergedIntoDefault).toBe(true);
    expect(by.get("claude/still-going")?.mergedIntoDefault).toBe(false);
    for (const c of p.value.candidates) {
      expect(c.unevaluated).toBeUndefined();
      expect(Number.isNaN(Date.parse(c.headCommittedAt ?? ""))).toBe(false);
    }
  });

  it("carries only the branches a preview slug asks about — 226 branches must not cost 226 fetches", () => {
    // Five more unmerged branches the preview does not ask about: each would
    // cost a fetch of its own if the probe walked every head on the remote.
    const remote = remoteWithBranches();
    run(remote, "git", ["config", "--bool", "core.bare", "false"]);
    for (let i = 0; i < 5; i++) {
      run(remote, "git", ["checkout", "-q", "-b", `claude/other-${i}`, "main"]);
      writeFileSync(join(remote, `other-${i}.txt`), String(i));
      run(remote, "git", ["add", "-A"]);
      run(remote, "git", ["commit", "-qm", `other ${i}`]);
    }
    run(remote, "git", ["checkout", "-q", "main"]);
    run(remote, "git", ["config", "--bool", "core.bare", "true"]);
    const dir = local(remote);

    // Count the fetches the probe makes, through a `git` on PATH that logs
    // each `fetch` and hands every call on to the real one.
    const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf-8" }).stdout.trim();
    const shim = mkdtempSync(join(tmpdir(), "health-git-shim-"));
    made.push(shim);
    const log = join(shim, "fetches.log");
    writeFileSync(log, "");
    writeFileSync(
      join(shim, "git"),
      `#!/bin/sh\nif [ "$1" = fetch ]; then echo "$*" >> '${log}'; fi\nexec '${realGit}' "$@"\n`,
      { mode: 0o755 },
    );
    const savedPath = process.env.PATH;
    process.env.PATH = `${shim}:${savedPath ?? ""}`;
    let p: ReturnType<typeof probeBranches>;
    try {
      p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-still-going"] });
    } finally {
      process.env.PATH = savedPath;
    }
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.candidates.map((c) => c.ref)).toEqual(["claude/still-going"]);
    // Seven heads on the remote, two fetches: the default branch and the one
    // branch asked about — never one per head.
    const fetches = readFileSync(log, "utf-8").trim().split("\n");
    expect(fetches).toEqual(["fetch --no-tags origin main", "fetch --no-tags origin refs/heads/claude/still-going"]);
  });

  it("an empty candidate set is a DETERMINED answer, not a failure to look", () => {
    const dir = local(remoteWithBranches());
    const p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-no-such-branch"] });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.candidates).toEqual([]);
    expect(p.value.defaultBranch).toBe("main");
  });

  it("a remote that cannot be reached is `unknown`, never an empty candidate set", () => {
    // An empty set means "no branch answers for this preview", which sends it
    // to the orphan list. A remote that could not be asked must not produce it.
    const dir = repo({ "a.txt": "a" });
    run(dir, "git", ["remote", "add", "origin", join(dir, "no-such-remote.git")]);
    const p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-anything"] });
    expect(p.state).toBe("unknown");
    if (p.state !== "unknown") return;
    expect(p.reason).toContain("ls-remote");
  });

  it("is NOT blinded by a shallow fetch of a DIFFERENT branch — the `gh-pages --depth=1` case", () => {
    // `probeStaging` runs first in `gatherContext` and fetches the publish
    // branch with `--depth=1`, which writes a graft into `.git/shallow` and
    // makes `--is-shallow-repository` say yes. The default branch's own
    // history is untouched, and a guard that used that flag would report
    // every sweep blind.
    const dir = local(remoteWithBranches());
    run(dir, "git", ["fetch", "-q", "--depth=1", "origin", "claude/still-going"]);
    const p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-merged"] });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.candidates.find((x) => x.ref === "claude/merged")?.mergedIntoDefault).toBe(true);
  });

  it("still trusts `not merged` for a branch whose tip POSTDATES the graft boundary", () => {
    // Truncation does not condemn every answer. `claude/still-going`'s tip is
    // dated after the merge commit the shallow fetch stopped at, so a merge of
    // it would have to be inside the fetched range — the negative is a fact,
    // and blinding here would cost the check its only remaining signal on a CI
    // runner that forgot `fetch-depth: 0`.
    const dir = local(remoteWithBranches());
    run(dir, "git", ["fetch", "-q", "--depth=1", "origin", "main"]);
    const p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-still-going"] });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    const c = p.value.candidates.find((x) => x.ref === "claude/still-going");
    expect(c?.mergedIntoDefault).toBe(false);
    expect(c?.unevaluated).toBeUndefined();
  });

  it("refuses to call a branch unmerged when the default branch's history is truncated past its tip", () => {
    // The trap: `merge-base --is-ancestor` says "no" for a merged branch whose
    // merge point was never fetched. "No" SPARES the preview, so nothing is
    // wrongly accused — but a check that silently spares everything has
    // stopped working, and that is what this guard reports instead.
    const remote = remoteWithBranches();
    const dir = local(remote);
    run(dir, "git", ["fetch", "-q", "--depth=1", "origin", "main"]);
    const p = probeBranches({ repoRoot: dir, remote: "origin", previewSlugs: ["claude-merged"] });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    const c = p.value.candidates.find((x) => x.ref === "claude/merged");
    expect(c).toBeDefined();
    expect(c?.mergedIntoDefault).toBeUndefined();
    expect(c?.unevaluated).toContain("fetch-depth: 0");
    expect(c?.unevaluated).toContain("graft boundary");
  });
});

describe("probeStaging", () => {
  it("reads the previews and sums their blob sizes", () => {
    const dir = repo({
      "STAGING/claude-one/index.html": "x".repeat(1000),
      "STAGING/claude-one/assets/a.css": "y".repeat(500),
      "STAGING/claude-two/index.html": "z".repeat(2000),
      "index.html": "not a preview",
    });
    const p = probeStaging({ repoRoot: dir, remote: "origin", branch: "gh-pages", prefix: "STAGING", localRev: "HEAD" });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.previews.map((x) => x.slug)).toEqual(["claude-one", "claude-two"]);
    expect(p.value.previews[0].bytes).toBe(1500);
    expect(p.value.previews[0].files).toBe(2);
    expect(p.value.previews[1].bytes).toBe(2000);
  });

  it("a branch with no STAGING directory is a DETERMINED empty, not an unknown", () => {
    const dir = repo({ "index.html": "the main site" });
    const p = probeStaging({ repoRoot: dir, remote: "origin", branch: "gh-pages", prefix: "STAGING", localRev: "HEAD" });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.branch).toBe("present");
    expect(p.value.previews).toEqual([]);
  });

  it("a publish branch that positively does not exist is `ok`/`absent` — the first-deploy case", () => {
    const remote = repo({ "index.html": "main" });
    run(remote, "git", ["config", "--bool", "core.bare", "true"]);
    const dir = repo({ "a.txt": "a" });
    run(dir, "git", ["remote", "add", "origin", remote]);
    const p = probeStaging({ repoRoot: dir, remote: "origin", branch: "gh-pages", prefix: "STAGING" });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.branch).toBe("absent");
    expect(p.value.previews).toEqual([]);
  });

  it("a remote that cannot be reached is `unknown`, and says which command failed", () => {
    const dir = repo({ "a.txt": "a" });
    run(dir, "git", ["remote", "add", "origin", join(dir, "no-such-remote-directory")]);
    const p = probeStaging({ repoRoot: dir, remote: "origin", branch: "gh-pages", prefix: "STAGING" });
    // THE test in this file. An unreachable remote must not look like a branch
    // with no previews: the first is "I could not ask", the second is an
    // answer, and `restore-staging.ts` exists because they were once the same.
    expect(p.state).toBe("unknown");
    if (p.state !== "unknown") return;
    expect(p.reason).toContain("git ls-remote");
  });
});

describe("probeRepoSize", () => {
  it("measures tracked blobs at HEAD, not the working tree", () => {
    const dir = repo({ "a.txt": "x".repeat(4096), "b/c.txt": "y".repeat(2048) });
    // An untracked file is not repository content and must not be counted.
    writeFileSync(join(dir, "untracked.bin"), "z".repeat(1_000_000));
    const p = probeRepoSize(dir);
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.trackedBytes).toBe(4096 + 2048);
    expect(p.value.gitDirBytes).toBeGreaterThan(0);
  });

  it("is `unknown` outside a repository rather than reporting a zero-byte one", () => {
    const dir = mkdtempSync(join(tmpdir(), "health-not-a-repo-"));
    made.push(dir);
    const p = probeRepoSize(dir);
    expect(p.state).toBe("unknown");
  });
});

describe("probeTodos", () => {
  it("reads the declared store, following todos.json rather than a hardcoded path", () => {
    const dir = repo({
      // The node is declared as `elsewhere`, NOT `items`. A probe that
      // hardcoded `todos/items` would read nothing here and report a clean,
      // empty store — the `dh4f` shape.
      "todos/todos.json": JSON.stringify({
        name: "fixture",
        directories: [{ id: "elsewhere", path: "elsewhere", graphTypologies: ["todo-items"] }],
      }),
      "todos/elsewhere/one.md": "---\n$schema: todo/1.0.0\nid: one\nstatus: open\ncreatedAt: 2026-01-01\n---\nbody\n",
      "todos/items/decoy.md": "---\nid: decoy\nstatus: open\n---\n",
    });
    const p = probeTodos(dir);
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    expect(p.value.map((t) => t.id)).toEqual(["one"]);
  });

  it("a PRESENT but unreadable declaration is `unknown`, never a fallback to the default path", () => {
    const dir = repo({
      "todos/todos.json": "{ this is not json",
      "todos/items/one.md": "---\nid: one\nstatus: open\n---\n",
    });
    const p = probeTodos(dir);
    expect(p.state).toBe("unknown");
    if (p.state !== "unknown") return;
    expect(p.reason).toContain("todos.json");
  });
});

describe("front matter", () => {
  it("reads a quoted title, which `beans` writes whenever the value holds a colon", () => {
    const fm = frontMatter("---\n# folio-assistant-3vge\ntitle: 'Workflow failure: invisible'\nstatus: todo\n---\nbody");
    expect(fm).toBeDefined();
    expect(frontMatterValue(fm!, "title")).toBe("Workflow failure: invisible");
    expect(frontMatterValue(fm!, "status")).toBe("todo");
    expect(frontMatterValue(fm!, "updated_at")).toBeUndefined();
  });

  it("returns undefined for a file with no front matter at all", () => {
    expect(frontMatter("# just a heading\n")).toBeUndefined();
  });
});

describe("countConsideredOptions — the parse the MADR criterion rests on", () => {
  it("returns `undefined` for a bean with no options section, never 0", () => {
    // The distinction the whole criterion depends on: a bean recording WORK has
    // no options to list, and `madr.md` says so. 0 would make every one of them
    // a malformed decision record — 172 findings on this store.
    expect(countConsideredOptions("# Work\n\nDid the thing.\n")).toBeUndefined();
  });

  it("matches the spellings this store ACTUALLY uses, not only MADR's canonical heading", () => {
    // Measured 2026-09-20: no bean here writes `## Considered options`. Both that
    // record options write `## Options, …`. A detector keyed on the canonical
    // heading alone would have had zero subjects and passed over nothing.
    for (const h of ["## Considered options", "## Options", "## Options, with what each costs", "## OPTIONS"]) {
      expect(countConsideredOptions(`${h}\n\n- a\n- b\n`)).toBe(2);
    }
  });

  it("does not read `## Optional` as an options section", () => {
    // `\b` rather than a bare prefix. Two real headings in this store start
    // "Optional" — "Provenance is not optional", "Accessibility is not optional
    // here" — and counting their bullets would invent decision records.
    expect(countConsideredOptions("## Optional extras\n\n- a\n- b\n")).toBeUndefined();
  });

  it("counts `-`, `*` and numbered items alike", () => {
    expect(countConsideredOptions("## Options\n\n1. one\n2. two\n3. three\n")).toBe(3);
    expect(countConsideredOptions("## Options\n\n* one\n* two\n")).toBe(2);
  });

  it("an option's own sub-points are not options", () => {
    // Indented items are the pros and cons OF an option — MADR's "pros and cons
    // of the options" collapsed inline, which is how the two real records here
    // are written. Counting them would report 6 options where there are 2.
    const text = "## Options\n\n- first\n  - costs a lot\n  - ships sooner\n- second\n  - free\n";
    expect(countConsideredOptions(text)).toBe(2);
  });

  it("stops at the next section, and a `###` inside an option does not end it", () => {
    const text = "## Options\n\n- one\n\n### one in detail\n\n- still under one\n\n## Decision\n\n- not an option\n";
    // TWO items counted, and each half of that matters:
    //   · `- still under one` sits after a `###`, so the sub-heading did not end
    //     the section — an option elaborated under its own heading stays inside.
    //   · `- not an option` sits after `## Decision` and is excluded, so the
    //     section really does end at the next level-2 heading.
    expect(countConsideredOptions(text)).toBe(2);
  });

  // ── Bean `vq8g`: three enumeration forms, and the most structured wins ──
  //
  // Counting top-level list items alone was wrong in BOTH directions on the
  // real store, measured 2026-09-23 over its 12 decision records. `j6t3` and
  // `xgd8` enumerate with bold paragraphs and counted ZERO — and they carry
  // FIVE options each against the store's typical three, so the two most
  // developed analyses in the corpus were the two reported empty, against an
  // action that says to "drop the section". `dhvf` enumerates with `###`
  // subheadings over Pro/Con/Cost bullets and counted TEN for four options.
  //
  // MADR is format-agnostic — "at least two, every one real", never a markdown
  // list — so the detector is what changes, not the beans.

  it("counts options written as BOLD ENUMERATED paragraphs — `j6t3`, `xgd8`", () => {
    const text = [
      "## Options — to develop, not yet chosen",
      "",
      "**A. Generate the slash commands.** Emit one per skill.",
      "*For:* smallest change. *Against:* Claude Code only.",
      "",
      "**B. Serve them as MCP tools.** The harness already runs a server.",
      "*For:* host-agnostic. *Against:* offered, not enforced.",
      "",
    ].join("\n");
    expect(countConsideredOptions(text)).toBe(2);
  });

  it("counts options written as SUBHEADINGS, not their pros and cons — `dhvf`", () => {
    // The over-count direction, and the reason the forms are not summed:
    // summing would give 6 here for a bean with 2 options.
    const text = [
      "## Considered options",
      "",
      "### A — adopt the rules wholesale",
      "- **Pro.** Proven at scale.",
      "- **Con.** Needs a registry.",
      "",
      "### B — pin the git ref (RECOMMENDED)",
      "- **Pro.** Exact and verifiable.",
      "- **Con.** No compatibility signal.",
      "",
    ].join("\n");
    expect(countConsideredOptions(text)).toBe(2);
  });

  it("an ordinary subheading inside the section is not an option", () => {
    // `j6t3` really carries `### Tier 1 — a person types these`. A looser rule
    // would count it and inflate every bean that explains its options under
    // headings of their own.
    const text = [
      "## Options",
      "",
      "**A. One.** first",
      "**B. Two.** second",
      "",
      "### Tier 1 — a person types these",
      "### The drift runs BOTH ways",
      "",
    ].join("\n");
    expect(countConsideredOptions(text)).toBe(2);
  });

  it("a subheading form OUTRANKS bare list items in the same section", () => {
    // Precedence, stated as a test rather than left to reading order: when both
    // appear the list items are sub-points of the headed options.
    const text = "## Options\n\n### A. one\n- pro\n- con\n### B. two\n- pro\n- con\n";
    expect(countConsideredOptions(text)).toBe(2);
  });

  it("plain list items still count when no other form appears — the 9 that already worked", () => {
    // The regression guard: ten of the twelve records on the store enumerate
    // this way and must not move.
    expect(countConsideredOptions("## Options\n\n- a\n- b\n- c\n")).toBe(3);
  });

  it("an options section with no items is 0 — a real, reportable count", () => {
    // Not `undefined`. The section exists, so the bean claims an analysis; that
    // it lists nothing is the finding, and it gets a different remedy from one
    // that lists a single option.
    expect(countConsideredOptions("## Options\n\n(to be decided)\n")).toBe(0);
  });

  it("takes the FIRST options section when a bean revisits the decision", () => {
    // A bean that comes back to a decision appends a second analysis. The first
    // is the record; the later one is the re-analysis, and its own later section
    // documents itself. Counting the last would let a thin original hide.
    const text = "## Options\n\n- a\n\n## Later\n\n## Options, revisited\n\n- a\n- b\n- c\n";
    expect(countConsideredOptions(text)).toBe(1);
  });
});

describe("doneWhenState — the four states `fkjo` needs kept apart", () => {
  it("reads every Done-when spelling the store actually uses", () => {
    // 25 distinct spellings across 457 beans, measured 2026-09-21. The
    // qualifier after the two words is deliberately NOT parsed — treating
    // "REPLACES the list above" as an instruction about which list counts
    // would make this adjudicate supersession.
    for (const h of [
      "## Done when",
      "### Done when",
      "## Done when — revised",
      "## Done when — REPLACES the list above",
      "## DONE WHEN",
    ]) {
      expect(doneWhenState(`${h}\n\n- [x] a\n`)).toEqual({ kind: "all-ticked", total: 1 });
    }
  });

  it("an unticked box is an open bean, and the partial count is kept", () => {
    expect(doneWhenState("## Done when\n\n- [x] a\n- [ ] b\n")).toEqual({
      kind: "open",
      ticked: 1,
      total: 2,
    });
  });

  it("no Done-when section is `absent` — not an empty pass", () => {
    expect(doneWhenState("# Work\n\nDid the thing.\n")).toEqual({ kind: "absent" });
  });

  it("a Done-when carrying no checkbox is `unreadable` — criteria this cannot judge", () => {
    expect(doneWhenState("## Done when\n\n- a thing happens\n- another\n")).toEqual({
      kind: "unreadable",
    });
  });

  it("`unreadable` OUTRANKS a fully ticked sibling section — the `z4mq` shape", () => {
    // Bean `z4mq` carries two matching headings: its real criteria are a bullet
    // list under the first, and under `## Done when — item 3` sits a three-box
    // SUB-CHECKLIST of one item, all ticked. A body-wide `[x]` count calls it
    // finished and so does a count scoped to its Done-when sections; what
    // separates it is that one section states criteria in a form this cannot
    // read. Measured: this is the single bean between the crude sweep's 6 and
    // this parse's 4, and it was the one that was not finished at all.
    const z4mq = "## Done when\n\n\u2022 a\n\u2022 b\n\n## Done when — item 3\n\n- [x] x\n- [x] y\n- [x] z\n";
    expect(doneWhenState(z4mq)).toEqual({ kind: "unreadable" });
  });

  it("a sibling h2 ends the section, so a `## Do not` list is not read as criteria", () => {
    // Load-bearing: many beans carry a `## Do not` section written as dashes,
    // and several of those items would never be ticked. Leaking them in would
    // make every such bean permanently `open`.
    expect(doneWhenState("## Done when\n\n- [x] a\n\n## Do not\n\n- [ ] never do this\n")).toEqual({
      kind: "all-ticked",
      total: 1,
    });
  });

  it("a DEEPER heading does not end it — criteria may carry a note", () => {
    expect(doneWhenState("## Done when\n\n- [x] a\n\n#### Note\n\n- [ ] b\n")).toEqual({
      kind: "open",
      ticked: 1,
      total: 2,
    });
  });

  it("a bare `[x]` with no list marker counts — the store writes both", () => {
    expect(doneWhenState("## Done when\n\n[x] a\n[x] b\n")).toEqual({ kind: "all-ticked", total: 2 });
  });

  it("the real store yields all four states — not a parse that matches nothing", () => {
    // Vacuity guard, and the reason it is here rather than in the check: a
    // regex narrowed by a later edit would make every bean `absent`, and every
    // assertion above is a literal that would keep passing.
    const p = probeBeans(process.cwd());
    // The store is declared here, so anything but `ok` is a failure to read it —
    // never a pass with nothing asserted.
    expect(p.state).toBe("ok");
    if (p.state !== "ok") throw new Error(`probeBeans was not ok: ${p.state}`);
    const kinds = new Set(p.value.map((b) => b.doneWhen?.kind));
    // The archive view too: a drain archives finished beans, and with them
    // most of the ticked lists (cat-harness-tools#1248).
    const archive = resolveBeanArchive(process.cwd()).dir;
    if (archive !== null) {
      for (const f of readdirSync(archive).filter((n) => n.endsWith(".md") && n !== "README.md")) {
        kinds.add(doneWhenState(readFileSync(join(archive, f), "utf-8"))?.kind);
      }
    }
    expect(kinds.has("all-ticked")).toBe(true);
    expect(kinds.has("open")).toBe(true);
    expect(kinds.has("absent")).toBe(true);
    expect(kinds.has("unreadable")).toBe(true);
  });
});

describe("probeSpecialBranches — unique bytes", () => {
  it("counts a blob once however many paths name it, which is what a clone costs", () => {
    // qa-reports holds the same verdict file under many `main/<sha>/` paths;
    // summing every path counted it once per sha (folio-assistant#860).
    const body = "x".repeat(1000);
    const remote = repo({ "main/a/v.json": body, "main/b/v.json": body, "main/c/other.json": "yz" });
    const dir = repo({ "README.md": "local" });
    run(dir, "git", ["remote", "add", "origin", remote]);
    run(remote, "git", ["branch", "cat/cat-harness/qa-reports"]);
    const p = probeSpecialBranches({
      repoRoot: dir,
      remote: "origin",
      rows: [{ id: "qa-reports", shape: "branch", name: "cat/cat-harness/qa-reports", legacy: [], budget: { bytes: 500 * 1024 ** 2, basis: "fixture" } } as never],
    });
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    const b = p.value.rows[0].branches[0];
    expect(b.files).toBe(3);
    expect(b.bytes).toBe(1002);
  });
});
