/**
 * The state-branch wipe guard, against throwaway repositories that reproduce
 * the two wipes of folio-assistant's `cat/cat-harness/beans` on 2026-11-15:
 * 631aace4 (fa#3142, a `--no-checkout` clone with a one-file index) and
 * e7d7e42 (fa#3144, the same from a sparse tree). Each test first shows that
 * plain git deletes the files, then that the guard refuses.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { claudeHook, commitNamesPaths, deletions, gitCalls, judgeCommit, judgePush, pushSources, wipeReasons } from "../state-write-guard.ts";

const SCRIPT = join(import.meta.dir, "..", "state-write-guard.ts");
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", CAT_ALLOW_MASS_DELETE: "" };
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete (ENV as Record<string, string | undefined>)[k];

function git(dir: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf-8", env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
const files = (dir: string, rev = "HEAD") => git(dir, "ls-tree", "-r", "--name-only", rev).split("\n").filter(Boolean);
const deleted = (dir: string, rev = "HEAD") => git(dir, "diff", "--name-only", "--diff-filter=D", `${rev}^`, rev).split("\n").filter(Boolean);

let root: string;
let origin: string;
const BEANS = 40;

/** A state branch shaped like `cat/cat-harness/beans`: manifest, README, beans.json and the bean files. */
function seedStateBranch(dir: string): void {
  git(dir, "init", "-q", "-b", "cat/cat-harness/beans");
  mkdirSync(join(dir, "beans", "defs"), { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ $schema: "state-manifest/v1", authoritative: true }) + "\n");
  writeFileSync(join(dir, "README.md"), "# beans\n");
  writeFileSync(join(dir, "beans", "beans.json"), "{}\n");
  for (let i = 0; i < BEANS; i++) writeFileSync(join(dir, "beans", "defs", `folio-assistant-b${i}--bean.md`), `bean ${i}\n`);
  writeFileSync(join(dir, "beans", "defs", "folio-assistant-php1--owner-standing-rules.md"), "rules\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
}

function hook(command: string, cwd: string, env: Record<string, string> = {}): { code: number; err: string } {
  const r = spawnSync("bun", ["run", SCRIPT, "--claude-hook"], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }),
    encoding: "utf-8",
    env: { ...ENV, ...env },
  });
  return { code: r.status ?? -1, err: r.stderr };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "state-write-guard-"));
  origin = join(root, "origin");
  mkdirSync(origin);
  seedStateBranch(origin);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Incident 1 (631aace4): `git clone --no-checkout`, write the one bean, `git add` it, commit. */
function noCheckoutClone(): string {
  const c = join(root, "c1");
  git(root, "clone", "-q", "--no-checkout", "--depth", "1", "-b", "cat/cat-harness/beans", `file://${origin}`, c);
  mkdirSync(join(c, "beans", "defs"), { recursive: true });
  writeFileSync(join(c, "beans", "defs", "folio-assistant-php1--owner-standing-rules.md"), "rules\nstacked fast-green merges\n");
  git(c, "add", "beans/defs/folio-assistant-php1--owner-standing-rules.md");
  return c;
}

/** Incident 2 (e7d7e42): the same from a sparse tree, `--no-checkout --sparse` and a cone of one file. */
function sparseClone(): string {
  const c = join(root, "c2");
  git(root, "clone", "-q", "--no-checkout", "--sparse", "-b", "cat/cat-harness/beans", `file://${origin}`, c);
  git(c, "sparse-checkout", "set", "--no-cone", "/beans/defs/folio-assistant-php1--owner-standing-rules.md");
  mkdirSync(join(c, "beans", "defs"), { recursive: true });
  writeFileSync(join(c, "beans", "defs", "folio-assistant-php1--owner-standing-rules.md"), "rules\nlayer-dependency order\n");
  git(c, "add", "--sparse", "beans/defs/folio-assistant-php1--owner-standing-rules.md");
  return c;
}

describe("incident 631aace4: a --no-checkout clone with a one-file index", () => {
  test("plain git commit deletes every other file, manifest.json included (the old path)", () => {
    const c = noCheckoutClone();
    git(c, "commit", "-qm", "beans php1: stacked fast-green merges");
    expect(files(c)).toEqual(["beans/defs/folio-assistant-php1--owner-standing-rules.md"]);
    expect(deleted(c)).toContain("manifest.json");
    expect(deleted(c).length).toBe(BEANS + 3);
  });

  test("the guard refuses the commit, naming manifest.json and the checkout", () => {
    const why = judgeCommit(noCheckoutClone(), { env: ENV });
    expect(why).toBeDefined();
    expect(why!.join("\n")).toContain("manifest.json");
    expect(why!.join("\n")).toContain(`deletes ${BEANS + 3} of the ${BEANS + 4} files`);
    expect(why!.join("\n")).toContain("--no-checkout");
  });

  test("the Claude hook blocks `cd <clone> && git commit && git push` from elsewhere", () => {
    const c = noCheckoutClone();
    const r = hook(`cd ${c} && git commit -m "beans php1" && git push origin HEAD:claude/rule-fast-green-batches`, root);
    expect(r.code).toBe(2);
    expect(r.err).toContain("manifest.json");
    // Blocked before it ran: nothing was committed.
    expect(git(c, "rev-list", "--count", "HEAD")).toBe("1");
  });

  test("a push of the wipe commit is refused, by the Claude hook and by git's pre-push hook", () => {
    const c = noCheckoutClone();
    git(c, "commit", "-qm", "beans php1: stacked fast-green merges");
    expect(judgePush(c, [{ source: "HEAD" }])).toBeDefined();
    const r = hook(`git -C ${c} push origin HEAD:refs/heads/claude/rule-fast-green-batches`, root);
    expect(r.code).toBe(2);
    expect(r.err).toContain("beans php1: stacked fast-green merges");
    const head = git(c, "rev-parse", "HEAD");
    const g = spawnSync("bun", ["run", SCRIPT, "--git-hook", "pre-push", "origin"], {
      cwd: c,
      input: `HEAD ${head} refs/heads/claude/x ${"0".repeat(40)}\n`,
      encoding: "utf-8",
      env: ENV,
    });
    expect(g.status).toBe(1);
  });

  test("git's pre-commit hook refuses it too", () => {
    const c = noCheckoutClone();
    const g = spawnSync("bun", ["run", SCRIPT, "--git-hook", "pre-commit"], { cwd: c, encoding: "utf-8", env: ENV });
    expect(g.status).toBe(1);
    expect(g.stderr).toContain("manifest.json");
  });

  test("a stated reason lets it through, logged", () => {
    const c = noCheckoutClone();
    const r = hook(`cd ${c} && CAT_ALLOW_MASS_DELETE='retiring the store' git commit -m x`, root);
    expect(r.code).toBe(0);
    expect(r.err).toContain("retiring the store");
  });

  test("committing the path by name builds on HEAD's tree, and is let through", () => {
    const c = noCheckoutClone();
    expect(hook(`cd ${c} && git commit -m x -- beans/defs/folio-assistant-php1--owner-standing-rules.md`, root).code).toBe(0);
    git(c, "commit", "-qm", "x", "--", "beans/defs/folio-assistant-php1--owner-standing-rules.md");
    expect(files(c).length).toBe(BEANS + 4);
  });
});

describe("incident e7d7e42: a commit from a sparse tree", () => {
  test("plain git commit deletes every file outside the cone (the old path)", () => {
    const c = sparseClone();
    git(c, "commit", "-qm", "beans php1: layer-dependency order");
    expect(files(c)).toEqual(["beans/defs/folio-assistant-php1--owner-standing-rules.md"]);
    expect(deleted(c)).toContain("manifest.json");
  });

  test("the guard refuses it and says the checkout is sparse", () => {
    const why = judgeCommit(sparseClone(), { env: ENV });
    expect(why).toBeDefined();
    expect(why!.join("\n")).toContain("sparse checkout");
    const r = hook(`cd ${join(root, "c2")} && git add -A && git commit -m "beans php1: layer-dependency order"`, root);
    expect(r.code).toBe(2);
  });

  test("a sparse checkout with a full index (a normal sparse clone) commits safely and is let through", () => {
    const c = join(root, "c3");
    git(root, "clone", "-q", "--sparse", "-b", "cat/cat-harness/beans", `file://${origin}`, c);
    git(c, "sparse-checkout", "set", "beans");
    writeFileSync(join(c, "beans", "defs", "folio-assistant-php1--owner-standing-rules.md"), "rules\nmore\n");
    git(c, "add", "-A");
    expect(judgeCommit(c, { env: ENV })).toBeUndefined();
    git(c, "commit", "-qm", "edit");
    expect(files(c).length).toBe(BEANS + 4);
    expect(judgePush(c, [{ source: "HEAD" }])).toBeUndefined();
  });
});

describe("what is not a wipe", () => {
  test("an ordinary edit, a few deletions, and an archive move", () => {
    const c = join(root, "full");
    git(root, "clone", "-q", `file://${origin}`, c);
    writeFileSync(join(c, "beans", "defs", "folio-assistant-b0--bean.md"), "changed\n");
    git(c, "rm", "-q", "beans/defs/folio-assistant-b1--bean.md", "beans/defs/folio-assistant-b2--bean.md");
    git(c, "add", "-A");
    expect(judgeCommit(c, { env: ENV })).toBeUndefined();
    git(c, "commit", "-qm", "small");
    // Thirty beans archived, each rewritten on the way: moved, not deleted.
    mkdirSync(join(c, "beans", "defs", "archive"));
    for (let i = 3; i < 33; i++) {
      const n = `folio-assistant-b${i}--bean.md`;
      git(c, "mv", `beans/defs/${n}`, `beans/defs/archive/${n}`);
      writeFileSync(join(c, "beans", "defs", "archive", n), `bean ${i}\nstatus: completed\n`);
    }
    git(c, "add", "-A");
    expect(judgeCommit(c, { env: ENV })).toBeUndefined();
  });

  test("deleting thirty beans on a state branch is refused; on another tree only when it is half the tree", () => {
    const before = new Map<string, string>([["manifest.json", "m"]]);
    for (let i = 0; i < 100; i++) before.set(`d/f${i}.md`, `id${i}`);
    const after = new Map(before);
    for (let i = 0; i < 30; i++) after.delete(`d/f${i}.md`);
    expect(wipeReasons(before, after)).toHaveLength(1);
    before.delete("manifest.json");
    after.delete("manifest.json");
    expect(wipeReasons(before, after)).toEqual([]);
    for (let i = 30; i < 60; i++) after.delete(`d/f${i}.md`);
    expect(wipeReasons(before, after)).toHaveLength(1);
  });

  test("a moved file keeps its object or its name", () => {
    const before = new Map([["a/x.md", "1"], ["a/y.md", "2"], ["a/z.md", "3"]]);
    const after = new Map([["b/x.md", "9"], ["b/renamed.md", "2"]]);
    expect(deletions(before, after)).toEqual(["a/z.md"]);
  });
});

describe("reading the command line", () => {
  test("follows cd and -C, and reads the bypass", () => {
    const calls = gitCalls("cd /tmp/a && git status; git -C b commit -m 'x y' && CAT_ALLOW_MASS_DELETE='why' git push origin HEAD:claude/z", "/home");
    expect(calls.map((c) => [c.sub, c.dir])).toEqual([
      ["commit", "/tmp/a/b"],
      ["push", "/tmp/a"],
    ]);
    expect(calls[1]!.bypass).toBe("why");
    expect(gitCalls("echo git commit && gh pr create --title commit", "/")).toEqual([]);
  });

  test("tells a pathspec commit from an index commit", () => {
    expect(commitNamesPaths(["-m", "msg"])).toBe(false);
    expect(commitNamesPaths(["-am", "msg"])).toBe(false);
    expect(commitNamesPaths(["-m", "msg", "--", "a.md"])).toBe(true);
    expect(commitNamesPaths(["-m", "msg", "a.md"])).toBe(true);
    expect(commitNamesPaths(["-i", "-m", "msg", "a.md"])).toBe(false);
  });

  test("reads push sources, and leaves dry runs and deletes alone", () => {
    expect(pushSources(["origin", "HEAD:refs/heads/claude/x"])).toEqual(["HEAD"]);
    expect(pushSources(["-u", "origin", "claude/x"])).toEqual(["claude/x"]);
    expect(pushSources(["origin"])).toEqual(["HEAD"]);
    expect(pushSources(["--dry-run", "origin", "x"])).toBeUndefined();
    expect(pushSources(["origin", ":old"])).toEqual([]);
  });

  test("anything but a Bash call, or unreadable input, passes", () => {
    expect(claudeHook("not json")).toBe(0);
    expect(claudeHook(JSON.stringify({ tool_name: "Read", tool_input: {} }))).toBe(0);
  });
});
