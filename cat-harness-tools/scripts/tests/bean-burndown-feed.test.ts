import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBurndownFeed, burndownTargets, fetchBeanHistory, historyRef, mountedTipFor, type FeedBean } from "../bean-burndown-feed.ts";
import { snapshotsFromGit, type Snapshot } from "../epic-burndown.ts";

const fb = (id: string, type: string, status: string): FeedBean => ({ id, title: `T ${id}`, type, status });
const where = { web: "https://github.com/o/r", branch: "cat/x/beans", path: "beans/defs" };

describe("burndownTargets", () => {
  test("open milestones and epics only, in id order", () => {
    const got = burndownTargets([
      fb("e2", "epic", "todo"),
      fb("m1", "milestone", "in-progress"),
      fb("e1", "epic", "completed"),
      fb("t1", "task", "todo"),
      fb("e0", "epic", "scrapped"),
    ]);
    expect(got.map((b) => b.id)).toEqual(["e2", "m1"]);
  });
});

describe("buildBurndownFeed", () => {
  const snaps: Snapshot[] = [
    { day: "2026-10-01", commit: "a".repeat(40), beans: [{ id: "other", status: "todo", type: "task", parent: "" }] },
    {
      day: "2026-10-02",
      commit: "b".repeat(40),
      beans: [
        { id: "e", status: "todo", type: "epic", parent: "" },
        { id: "k1", status: "todo", type: "task", parent: "e" },
        { id: "k2", status: "weird", type: "task", parent: "e" },
      ],
    },
    {
      day: "2026-10-03",
      commit: "c".repeat(40),
      beans: [
        { id: "e", status: "todo", type: "epic", parent: "" },
        { id: "k1", status: "completed", type: "task", parent: "e" },
        { id: "k2", status: "weird", type: "task", parent: "e" },
      ],
    },
  ];

  test("columns align with the shared day axis; a day before the epic existed is null, not 0", () => {
    const feed = buildBurndownFeed(snaps, [fb("e", "epic", "todo")], where);
    expect(feed).toMatchObject({ available: true, ...where, days: ["2026-10-01", "2026-10-02", "2026-10-03"] });
    expect(feed.commits).toEqual(["a".repeat(12), "b".repeat(12), "c".repeat(12)]);
    expect(feed.series).toEqual([{ id: "e", title: "T e", type: "epic", open: [null, 1, 0], closed: [null, 0, 1], other: [null, 1, 1] }]);
  });

  test("no targets is an empty series list over a real day axis, not an unavailable feed", () => {
    const feed = buildBurndownFeed(snaps, [], where);
    expect(feed.series).toEqual([]);
    expect(feed.days.length).toBe(3);
  });
});

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

const bean = (id: string, status: string, type: string, parent = "") =>
  `---\n# ${id}\ntitle: ${id}\nstatus: ${status}\ntype: ${type}\n${parent ? `parent: ${parent}\n` : ""}---\n\nbody\n`;

describe("fetchBeanHistory", () => {
  test("fetches the store branch into a local ref the snapshots read from", () => {
    const tmp = mkdtempSync(join(tmpdir(), "burndown-feed-"));
    try {
      const up = join(tmp, "up");
      mkdirSync(join(up, "beans", "defs"), { recursive: true });
      git(up, "init", "-q", "-b", "cat/x/beans");
      const commitAt = (iso: string, msg: string) => {
        git(up, "add", "-A");
        const r = spawnSync("git", ["commit", "-q", "-m", msg], {
          cwd: up,
          env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
        });
        if (r.status !== 0) throw new Error(String(r.stderr));
      };
      writeFileSync(join(up, "beans", "defs", "e.md"), bean("e", "todo", "epic"));
      writeFileSync(join(up, "beans", "defs", "k.md"), bean("k", "todo", "task", "e"));
      commitAt("2026-10-20T10:00:00Z", "one");
      writeFileSync(join(up, "beans", "defs", "k.md"), bean("k", "completed", "task", "e"));
      commitAt("2026-10-21T10:00:00Z", "two");

      const here = join(tmp, "here");
      git(tmp, "clone", "-q", "--depth=1", "--no-checkout", `file://${up}`, "here");

      const got = fetchBeanHistory(here, { branch: "cat/x/beans", web: "https://x", repoWeb: "https://x", days: 30, now: new Date("2026-10-24T00:00:00Z") });
      expect(got).toEqual({ ref: historyRef("cat/x/beans") });
      const snaps = snapshotsFromGit(here, historyRef("cat/x/beans"), "beans/defs", 30);
      const feed = buildBurndownFeed(snaps, [fb("e", "epic", "todo")], where);
      expect(feed.days).toEqual(["2026-10-20", "2026-10-21"]);
      expect(feed.series[0]).toMatchObject({ open: [1, 0], closed: [0, 1] });

      // When state:mount recorded an earlier mounted tip and the remote branch
      // moved later during the build, fetchBeanHistory pins the ref to the
      // mounted tip so burndown.json matches the mounted store.
      const day1Tip = git(up, "rev-parse", "HEAD~1");
      mkdirSync(join(here, ".git", "branch-mounts"), { recursive: true });
      writeFileSync(
        join(here, ".git", "branch-mounts", "cat-harness.beans.json"),
        JSON.stringify({ id: "beans", key: "cat-harness.beans", branch: "cat/x/beans", tip: day1Tip }),
      );
      expect(mountedTipFor(here, "cat/x/beans")).toBe(day1Tip);
      const pinned = fetchBeanHistory(here, { branch: "cat/x/beans", web: "https://x", repoWeb: "https://x", days: 30, now: new Date("2026-10-24T00:00:00Z") });
      expect(pinned).toEqual({ ref: historyRef("cat/x/beans") });
      const pinnedSnaps = snapshotsFromGit(here, historyRef("cat/x/beans"), "beans/defs", 30);
      expect(pinnedSnaps.map((x) => x.day)).toEqual(["2026-10-20"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("an unreachable branch is a reason, never an empty history", () => {
    const tmp = mkdtempSync(join(tmpdir(), "burndown-feed-"));
    try {
      git(tmp, "init", "-q");
      const got = fetchBeanHistory(tmp, { branch: "nope", web: "file:///does/not/exist", repoWeb: "https://other", days: 30 });
      expect("reason" in got).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
