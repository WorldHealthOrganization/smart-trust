/**
 * A published survey's window is checkable, and an uncheckable one is never
 * reported as covered. Bean `6ptx`.
 *
 * The tests run against scratch repositories with real commits, because the
 * whole mechanism is `git merge-base --is-ancestor` and `rev-list` — mocking
 * those would test the mock.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { SESSION_SURVEY_TAG, SessionSurveySchema } from "../../schemas/sdlc/session-survey.ts";
import { owed, readSurveys } from "../survey.js";

const scratches: string[] = [];
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

function sh(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return `${r.stdout ?? ""}`.trim();
}

/** A repo with `n` commits on `main`, plus a declared (empty) surveys node. */
function repo(n: number): { dir: string; shas: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "survey-"));
  scratches.push(dir);
  sh(["init", "-q", "-b", "main"], dir);
  sh(["config", "user.email", "t@t"], dir);
  sh(["config", "user.name", "t"], dir);
  mkdirSync(join(dir, "beans", "surveys"), { recursive: true });
  writeFileSync(
    join(dir, "beans", "beans.json"),
    JSON.stringify({ name: "s", directories: [{ id: "surveys", path: "surveys", graphTypologies: ["session-survey"] }] }),
  );
  const shas: string[] = [];
  for (let i = 0; i < n; i++) {
    writeFileSync(join(dir, `f${i}.txt`), `${i}`);
    sh(["add", "-A"], dir);
    sh(["commit", "-qm", `c${i}`], dir);
    shas.push(sh(["rev-parse", "HEAD"], dir));
  }
  return { dir, shas };
}

function plant(dir: string, to: string, from = "0".repeat(40)): void {
  const s = {
    $schema: SESSION_SURVEY_TAG,
    from,
    to,
    branch: "main",
    takenAt: "2026-09-26T17:00:00Z",
    by: "test",
    commits: 1,
    axes: [{ axis: "beans", covered: true, finding: "x" }],
  };
  SessionSurveySchema.parse(s);
  writeFileSync(join(dir, "beans", "surveys", `${to.slice(0, 12)}.json`), JSON.stringify(s));
}

test("no survey is a determined empty, not an error", () => {
  const { dir } = repo(3);
  const o = owed("main", dir);
  expect(o.kind).toBe("no-survey");
});

test("a survey at the tip is COVERED", () => {
  const { dir, shas } = repo(3);
  plant(dir, shas[2]!);
  expect(owed("main", dir).kind).toBe("covered");
});

test("a survey behind the tip yields the DELTA, counted by git", () => {
  const { dir, shas } = repo(5);
  plant(dir, shas[1]!);
  const o = owed("main", dir);
  expect(o.kind).toBe("delta");
  if (o.kind !== "delta") throw new Error("unreachable");
  expect(o.from).toBe(shas[1]!);
  // Three commits land after shas[1] in a linear history.
  expect(o.commits).toBe(3);
});

test("an UNREACHABLE upper edge is unusable — never covered", () => {
  // The failure that would do real damage: a sibling skips the sweep on the
  // strength of a survey of a history that no longer exists.
  const { dir } = repo(3);
  plant(dir, "d".repeat(40));
  const o = owed("main", dir);
  expect(
    o.kind,
    "a survey whose `to` this branch cannot reach was treated as usable. A " +
      "rewritten history or a survey from another branch would then suppress " +
      "the sweep it exists to make unnecessary.",
  ).toBe("unusable");
});

test("the FURTHEST-ALONG survey wins, not the most recently taken", () => {
  // Dates do not order commits. A survey taken later of an older window covers
  // less, and picking by `takenAt` would silently shrink the covered range.
  const { dir, shas } = repo(5);
  plant(dir, shas[1]!);
  plant(dir, shas[3]!);
  const o = owed("main", dir);
  expect(o.kind).toBe("delta");
  if (o.kind !== "delta") throw new Error("unreachable");
  expect(o.from, "the older window won, so the reader would re-derive commits already surveyed").toBe(shas[3]!);
  expect(o.commits).toBe(1);
});

test("a JSON file that does not declare itself is not a survey", () => {
  // Extension is a coincidence; the `$schema` tag is the contract — the rule
  // `beans/beans.json` states for its own nodes.
  const { dir, shas } = repo(2);
  writeFileSync(join(dir, "beans", "surveys", "notes.json"), JSON.stringify({ hello: "world" }));
  expect(readSurveys(dir)).toEqual([]);
  plant(dir, shas[1]!);
  expect(readSurveys(dir).length).toBe(1);
});

test("the schema refuses a ref where an object name belongs", () => {
  // The whole design rests on the edges being pinned. `origin/main` as an
  // upper edge names a different commit tomorrow.
  const base = {
    $schema: SESSION_SURVEY_TAG,
    from: "a".repeat(40),
    to: "origin/main",
    branch: "main",
    takenAt: "t",
    by: "t",
    commits: 1,
    axes: [{ axis: "a", covered: true, finding: "f" }],
  };
  expect(SessionSurveySchema.safeParse(base).success).toBe(false);
  expect(SessionSurveySchema.safeParse({ ...base, to: "b".repeat(40) }).success).toBe(true);
});

test("a survey with no axes is refused", () => {
  const base = {
    $schema: SESSION_SURVEY_TAG,
    from: "a".repeat(40),
    to: "b".repeat(40),
    branch: "main",
    takenAt: "t",
    by: "t",
    commits: 0,
    axes: [],
  };
  expect(SessionSurveySchema.safeParse(base).success, "a survey that covered nothing is not a survey").toBe(false);
});
