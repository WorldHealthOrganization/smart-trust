/**
 * A review-process task moves a comment's status, and the move is committed to
 * the edit-set's FEATURE branch (bean 423d; owner, 2026-09-23: "commit to
 * feature branch"). Each rule is tested where it must refuse.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ReviewCommentSchema, type PrComment } from "../schemas/review-comment";
import { featureBranch, feedbackDir, moveComment, readCommitted } from "./review-comment-move";
import { buildReviewComments } from "./review-comments";

const EDITOR = { process: "Process_Review", task: "Task_EditorDecides" };
const pc = (id: number, body: string): PrComment => ({
  id, body, user: "sme1", createdAt: "2026-09-23T07:00:00Z", url: `https://github.com/o/r/pull/7#issuecomment-${id}`,
});
const published = () =>
  buildReviewComments({
    repo: "o/r", pr: 7, commit: "c1", now: "2026-09-23T08:00:00Z",
    comments: [pc(1, "block: prose:overview\nkind: defect\n\nWrong dose.")],
    blocks: { "prose:overview": { hash: "h1", renamedFrom: [] } },
  });

let dir: string | undefined;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

/** A folio with a todos graph that declares a feedback directory, and its published file. */
function folio(): { root: string; fb: string; pub: string } {
  dir = mkdtempSync(join(tmpdir(), "rc-move-"));
  mkdirSync(join(dir, "todos"));
  writeFileSync(join(dir, "todos", "todos.json"), JSON.stringify({
    name: "f", directories: [{ id: "feedback", path: "feedback", graphTypologies: ["todo-feedback"] }],
  }));
  const pub = join(dir, "review-comments.json");
  writeFileSync(pub, JSON.stringify(published()));
  return { root: dir, fb: feedbackDir(join(dir, "todos")), pub };
}

describe("where a status goes: the declared todo-feedback directory", () => {
  it("feedbackDirFromTodosGraph", () => {
    const f = folio();
    expect(f.fb).toBe(join(f.root, "todos", "feedback"));
    writeFileSync(join(f.root, "todos", "todos.json"), JSON.stringify({ name: "f", directories: [{ id: "items", path: "items", graphTypologies: ["todo-items"] }] }));
    expect(() => feedbackDir(join(f.root, "todos"))).toThrow(/todo-feedback/);
    expect(() => feedbackDir(join(f.root, "nowhere"))).toThrow(/declares no todos graph/);
  });
});

describe("a move", () => {
  it("moveFromPublishedThenCommitted", () => {
    const f = folio();
    const r = moveComment({ id: "review-pr7-c1", to: "addressed", ...EDITOR, dir: f.fb, published: f.pub });
    expect(r).toMatchObject({ from: "open", to: "addressed" });
    const onDisk = ReviewCommentSchema.parse(JSON.parse(readFileSync(r.path, "utf-8")));
    expect(onDisk.status).toBe("addressed");
    // No --published this time: the committed record is the source.
    const r2 = moveComment({ id: "review-pr7-c1", to: "resolved", ...EDITOR, decision: "d-7", dir: f.fb });
    expect(r2.from).toBe("addressed");
    expect(readCommitted(f.fb).get("review-pr7-c1")!.review.decision).toBe("d-7");
  });

  it("refusesIllegalMove", () => {
    const f = folio();
    expect(() => moveComment({ id: "review-pr7-c1", to: "resolved", ...EDITOR, decision: "d", dir: f.fb, published: f.pub })).toThrow(/not a move/);
    expect(existsSync(join(f.fb, "review-pr7-c1.json"))).toBe(false);
  });

  it("unknownIdError", () => {
    const f = folio();
    expect(() => moveComment({ id: "review-pr7-c99", to: "addressed", ...EDITOR, dir: f.fb, published: f.pub })).toThrow(/no review comment/);
  });
});

describe("committed on the FEATURE branch — never the base", () => {
  const git = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf-8" });
  function repo(): string {
    const f = folio();
    git(f.root, "init", "-q", "-b", "main");
    git(f.root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "base");
    return f.root;
  }

  it("featureBranchOnly", () => {
    const r = repo();
    expect(() => featureBranch("main", r)).toThrow(/FEATURE branch/);
    git(r, "checkout", "-q", "--detach");
    expect(() => featureBranch("main", r)).toThrow(/detached/);
    git(r, "checkout", "-q", "-b", "edit/dosing");
    expect(featureBranch("main", r)).toBe("edit/dosing");
  });

  it("commandCommitsOnFeature", () => {
    const r = repo();
    const cmd = (...extra: string[]) =>
      Bun.spawnSync(
        ["bun", "run", resolve(import.meta.dir, "review-comment-move.ts"),
          "--id", "review-pr7-c1", "--to", "addressed", "--process", EDITOR.process, "--task", EDITOR.task,
          "--todos", "todos", "--published", "review-comments.json", "--commit", ...extra],
        { cwd: r, stderr: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } },
      );
    const refused = cmd();
    expect(refused.exitCode).toBe(1);
    expect(existsSync(join(r, "todos", "feedback", "review-pr7-c1.json"))).toBe(false);

    git(r, "checkout", "-q", "-b", "edit/dosing");
    expect(cmd().exitCode).toBe(0);
    expect(git(r, "log", "-1", "--format=%s")).toContain("review(review-pr7-c1): open → addressed");
    expect(git(r, "log", "-1", "--format=%b")).toContain("on feature branch edit/dosing");
    expect(git(r, "ls-files", "todos/feedback")).toContain("review-pr7-c1.json");
  });
});

describe("the published file takes its statuses from the feature branch", () => {
  it("committedWinsOverPublished", () => {
    const f = folio();
    moveComment({ id: "review-pr7-c1", to: "addressed", ...EDITOR, dir: f.fb, published: f.pub });
    const next = buildReviewComments({
      repo: "o/r", pr: 7, commit: "c2", comments: [pc(1, "block: prose:overview\nkind: defect\n\nWrong dose.")],
      blocks: { "prose:overview": { hash: "h1", renamedFrom: [] } },
      existing: published(), committed: readCommitted(f.fb),
    });
    expect(next.comments).toHaveLength(1);
    expect(next.comments[0]!.status).toBe("addressed");
  });
});
