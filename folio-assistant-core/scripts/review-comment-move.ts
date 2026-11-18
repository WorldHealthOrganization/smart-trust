#!/usr/bin/env bun
/**
 * review-comment-move — a review-process task moves one review comment's
 * status, and the move is COMMITTED to the folio's todos graph on the
 * edit-set's FEATURE BRANCH. Bean `423d`.
 *
 * ## The owner's ruling, 2026-09-23
 *
 * Asked where a status change is saved, the owner chose option 1 of three:
 * the task that moves a status commits the comment into the folio's `todos/`.
 * Then, sharpened: *"more accurate.. commit to feature branch"*. The commit
 * goes to the FEATURE BRANCH that carries the edit-set, the branch the edits
 * themselves are committed to, never to `main`. So the change is:
 * - on the same branch as the edit it is about, and reviewed with it;
 * - landed on `main` only when that branch is merged, as the review record;
 * - part of the dynamic KG.
 *
 * `--commit` enforces the branch. It refuses a detached HEAD and the base
 * branch (default `main`), because a status committed straight to `main`
 * would record a review outcome that no merge ever accepted.
 *
 * Rejected: the published file only (not reviewed, not in the KG, lost with
 * the preview), and `main` after merge (nothing durable during the review).
 *
 * ## Where the file goes: the graph says, not this script
 *
 * The directory is the todos graph's node of kind `todo-feedback`, which
 * `todos.json` declares as "todos raised against a specific block, carrying
 * the submitter's identity". That is exactly a review comment. It is read
 * from the declaration, never assumed. A folio whose todos graph declares no
 * such node gets an error naming the remedy, not a file written somewhere
 * nobody scans.
 *
 * ## The file is the node, as JSON
 *
 * `<feedback dir>/<id>.json`: one `review-comment/1.0.0` node, the same
 * object `review-comments.json` carries. It is not Markdown, because the
 * todo reader's front-matter parser is flat and a review comment carries a
 * nested `review` field. One format for the kind, wherever it is stored.
 *
 * ## Only the process moves it
 *
 * Every move goes through `transition()`, which refuses anything not in
 * `REVIEW_TRANSITIONS` for the named process task. So this command is not a
 * back door: `--process` and `--task` must be a task allowed to make that
 * move, and closing a comment still needs `--decision`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { directoryForGraph, repoRootFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { TODO_GRAPH_FILE, nodeOfKind, parseTodoGraph } from "@litlfred/cat-harness-tools/schemas/sdlc/todo-graph.js";
import {
  REVIEW_COMMENT_STATUSES,
  ReviewCommentSchema,
  ReviewCommentsFileSchema,
  transition,
  type ReviewComment,
  type ReviewCommentStatus,
} from "../schemas/review-comment.js";

/**
 * The branch a status may be committed to: a named feature branch, never the
 * base. Returns the branch, or throws with the reason.
 */
export function featureBranch(base: string, cwd: string = process.cwd()): string {
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf-8" }).trim();
  if (branch === "HEAD") {
    throw new Error("HEAD is detached, so there is no feature branch to commit the status to. Check out the edit-set's branch.");
  }
  if (branch === base) {
    throw new Error(
      `the current branch is \`${base}\`, the base. A review status is committed to the edit-set's FEATURE branch, ` +
        `and reaches \`${base}\` only when that branch is merged. Check out the feature branch.`,
    );
  }
  return branch;
}

/** The folio's declared feedback directory, from `<todosRoot>/todos.json`. */
export function feedbackDir(todosRoot: string): string {
  const decl = join(todosRoot, TODO_GRAPH_FILE);
  if (!existsSync(decl)) {
    throw new Error(
      `${decl} does not exist, so this folio declares no todos graph to commit a review comment to. ` +
        `Declare one with a directory of graph typology "todo-feedback".`,
    );
  }
  const node = nodeOfKind(parseTodoGraph(JSON.parse(readFileSync(decl, "utf-8"))), "todo-feedback");
  if (!node) {
    throw new Error(`${decl} declares no directory of graph typology "todo-feedback", which is where review comments are committed.`);
  }
  return join(todosRoot, node.path);
}

/** Every review comment committed under `dir`, by id. Other files are left alone. */
export function readCommitted(dir: string): Map<string, ReviewComment> {
  const out = new Map<string, ReviewComment>();
  if (!existsSync(dir)) return out;
  for (const f of new Bun.Glob("*.json").scanSync(dir)) {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { $schema?: unknown };
    // Declaration over location: the directory may hold other feedback.
    if (raw.$schema !== "review-comment/1.0.0") continue;
    const c = ReviewCommentSchema.parse(raw);
    out.set(c.id, c);
  }
  return out;
}

export interface MoveOptions {
  id: string;
  to: ReviewCommentStatus;
  process: string;
  task: string;
  decision?: string;
  /** The declared feedback directory. */
  dir: string;
  /** The published `review-comments.json`, for a comment not committed yet. */
  published?: string;
}

/**
 * Apply the move and write the file. Returns the path and both statuses.
 *
 * The comment is read from its committed file when there is one: that is the
 * reviewed record. Otherwise it is read from the published file, which is
 * where a comment first exists after ingestion.
 */
export function moveComment(o: MoveOptions): { path: string; from: ReviewCommentStatus; to: ReviewCommentStatus } {
  const path = join(o.dir, `${o.id}.json`);
  let current: ReviewComment | undefined = readCommitted(o.dir).get(o.id);
  if (!current && o.published && existsSync(o.published)) {
    current = ReviewCommentsFileSchema.parse(JSON.parse(readFileSync(o.published, "utf-8"))).comments.find((c) => c.id === o.id);
  }
  if (!current) {
    throw new Error(`no review comment \`${o.id}\`: not committed under ${o.dir}${o.published ? ` and not in ${o.published}` : ""}`);
  }
  const moved = transition(current, o.to, { process: o.process, task: o.task }, { decision: o.decision });
  mkdirSync(o.dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ ...moved, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  return { path, from: current.status, to: moved.status };
}

const USAGE = `usage: bun run folio-assistant-core/scripts/review-comment-move.ts
  --id <review-prN-cM> --to <${REVIEW_COMMENT_STATUSES.join("|")}>
  --process <bpmn process id> --task <bpmn task id> [--decision <id>]
  [--todos <todos graph root, default: todos>] [--published <review-comments.json>]
  [--commit [--base main]]   commit the file to the current FEATURE branch;
                             refused on the base branch and on a detached HEAD`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const [id, to, proc, task] = [opt("id"), opt("to"), opt("process"), opt("task")];
  if (args.includes("--help") || !id || !to || !proc || !task) {
    console.error(USAGE);
    process.exit(args.includes("--help") ? 0 : 2);
  }
  if (!(REVIEW_COMMENT_STATUSES as readonly string[]).includes(to)) {
    console.error(`✗ --to ${to} is not one of ${REVIEW_COMMENT_STATUSES.join(", ")}`);
    process.exit(2);
  }
  try {
    // Checked BEFORE the file is written, so a refused commit leaves nothing behind.
    const branch = args.includes("--commit") ? featureBranch(opt("base") ?? "main") : undefined;
    // The DECLARED todos graph when --todos is not given, never a spelled
    // `todos` relative to the cwd (bean `gz47`): run from any directory but the
    // checkout root, the spelling named a directory that does not exist.
    const todosRoot = opt("todos") ?? directoryForGraph(repoRootFor(process.cwd()), "todos");
    if (todosRoot === undefined) throw new Error("no `todos` graph is declared in this checkout; pass --todos <dir>");
    const dir = feedbackDir(resolve(todosRoot));
    const r = moveComment({ id, to: to as ReviewCommentStatus, process: proc, task, decision: opt("decision"), dir, published: opt("published") });
    const rel = relative(process.cwd(), r.path);
    console.error(`✓ ${id}: ${r.from} → ${r.to} by ${proc}#${task} → ${rel}`);
    if (branch) {
      execFileSync("git", ["add", "--", rel], { stdio: "inherit" });
      execFileSync("git", ["commit", "-m", `review(${id}): ${r.from} → ${r.to}`, "-m", `by ${proc}#${task}${opt("decision") ? `, decision ${opt("decision")}` : ""}, on feature branch ${branch}`, "--", rel], { stdio: "inherit" });
    }
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
