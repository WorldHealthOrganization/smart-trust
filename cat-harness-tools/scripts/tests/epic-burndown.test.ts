import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { burndown, parseBeanState, pointFor, snapshotsFromGit, type Snapshot } from "../epic-burndown.ts";

const bean = (id: string, status: string, type = "task", parent = "") => ({ id, status, type, parent });

describe("pointFor", () => {
  test("counts the transitive closure, and an unknown status on its own", () => {
    const snap: Snapshot = {
      day: "2026-10-01",
      commit: "a".repeat(40),
      beans: [
        bean("E", "in-progress", "epic"),
        bean("F", "todo", "feature", "E"),
        bean("t1", "completed", "task", "F"),
        bean("t2", "scrapped", "task", "E"),
        bean("t3", "draft", "task", "F"),
        bean("t4", "weird", "task", "E"),
        bean("x", "todo"),
      ],
    };
    expect(pointFor(snap, "E")).toMatchObject({ present: true, open: 2, closed: 2, unclassified: 1, total: 5 });
  });

  test("an epic not yet in the store is no data, not zero", () => {
    const p = pointFor({ day: "2026-10-01", commit: "b".repeat(40), beans: [bean("x", "todo")] }, "E");
    expect(p).toMatchObject({ present: false, open: null, closed: null, total: null });
  });

  test("a parent cycle is counted once and does not hang", () => {
    const snap: Snapshot = {
      day: "2026-10-01",
      commit: "c".repeat(40),
      beans: [bean("E", "todo", "epic", "G"), bean("G", "todo", "epic", "E"), bean("t", "todo", "task", "G")],
    };
    expect(pointFor(snap, "E")).toMatchObject({ open: 2, total: 2 });
  });
});

describe("parseBeanState", () => {
  test("reads id, status, type and parent; refuses a file with no front matter", () => {
    expect(parseBeanState("---\n# fa-x\n$schema: bean/1.0.0\ntitle: T\nstatus: todo\ntype: task\nparent: fa-e\n---\n\nbody\n")).toEqual(
      bean("fa-x", "todo", "task", "fa-e"),
    );
    expect(parseBeanState("no front matter")).toBeUndefined();
  });
});

describe("snapshotsFromGit", () => {
  test("one point per day from the store's history, the archive included", () => {
    const dir = mkdtempSync(join(tmpdir(), "burndown-"));
    try {
      const git = (...a: string[]) => {
        // input-site: tree #58a92f79 — git in the test's own scratch repository, with the environment handed whole plus a fixed identity: git's answer, which the cone replays or records
        const r = spawnSync("git", a, { cwd: dir, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
        if (r.status !== 0) throw new Error(r.stderr);
      };
      const write = (p: string, id: string, status: string, type: string, parent = "") => {
        mkdirSync(join(dir, p, ".."), { recursive: true });
        writeFileSync(join(dir, p), `---\n# ${id}\nstatus: ${status}\ntype: ${type}\n${parent ? `parent: ${parent}\n` : ""}---\n`);
      };
      const commitOn = (date: string) => {
        git("add", "-A");
        spawnSync("git", ["commit", "-qm", date], {
          cwd: dir,
          env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
        });
      };
      git("init", "-q");
      write("beans/defs/other.md", "other", "todo", "task");
      commitOn("2026-10-01T10:00:00Z");
      write("beans/defs/E.md", "E", "in-progress", "epic");
      write("beans/defs/t1.md", "t1", "todo", "task", "E");
      write("beans/defs/t2.md", "t2", "todo", "task", "E");
      commitOn("2026-10-02T09:00:00Z");
      write("beans/defs/t1.md", "t1", "completed", "task", "E");
      commitOn("2026-10-02T18:00:00Z");
      rmSync(join(dir, "beans/defs/t2.md"));
      write("beans/defs/archive/t2.md", "t2", "completed", "task", "E");
      commitOn("2026-10-04T08:00:00Z");

      const points = burndown(snapshotsFromGit(dir, "HEAD", "beans/defs", 30), "E");
      expect(points.map((p) => [p.day, p.present, p.open, p.closed])).toEqual([
        ["2026-10-01", false, null, null],
        // the LAST commit of the day: t1 already closed
        ["2026-10-02", true, 1, 1],
        // 10-03 had no commit, so it has no point
        ["2026-10-04", true, 0, 2],
      ]);
      expect(burndown(snapshotsFromGit(dir, "HEAD", "beans/defs", 2), "E").map((p) => p.day)).toEqual(["2026-10-02", "2026-10-04"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
