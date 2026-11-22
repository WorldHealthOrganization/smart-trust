/**
 * What an agent has already read on an issue.
 *
 * #203 (2026-09-18): "make sure human/agentic coders know to check issue for
 * new/updated comments (**keep track of what they already viewed**) to see if
 * it changes current direction or is work to queue."
 *
 * The failure this exists to stop was demonstrated in the session that wrote
 * it: five owner comments landed between 14:31 and 15:55 while the agent
 * worked, each changing direction, and none was seen until the author typed
 * "new comments". Checking once at session start is not checking.
 *
 * ## Why a high-water mark and not a count
 *
 * GitHub comment ids are monotonic per repository, so "everything above N is
 * new" is a total answer that survives deletion, editing and pagination. A
 * count does not: delete one comment and a count says nothing changed.
 *
 * ## Why edits need their own field
 *
 * A comment EDITED after you read it keeps its id, so the id mark alone would
 * call it seen. `updatedAt` is tracked beside it, because the ask says
 * "new/**updated**" and an edited requirement is a changed requirement.
 *
 * ## What this does not do
 *
 * It does not fetch. An agent reads comments through its own GitHub tooling;
 * this records what was read so the NEXT session, in a fresh container, can
 * tell new from already-handled. State lives in the declared `issue-marks/`
 * graph, committed, for the same reason workflow state does: a sibling session
 * must see it.
 *
 * It was `.harness/issue-comments/` until 2026-09-20, and both halves of that
 * name were wrong. A dot-prefixed directory is the one thing this repository's
 * own guard rejects — `.beans/` and `.harness/workflow/` moved out on
 * 2026-09-18 for the same reason — and these files are MARKS, not comments:
 * they carry an id and two timestamps, never a body. A directory named for the
 * comments promises a reader something it does not hold.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// `src/` may import `scripts/` (so does `src/tools/beans-prime.ts`); the
// reverse is what the layering forbids.
import { graphReadPath } from "../../scripts/graph-read.ts";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";

import { z } from "zod";

export const SEEN_DIR = "issue-marks";

/** The `$schema` tag a mark carries. Bean `3oqj`. */
export const ISSUE_MARK_SCHEMA_TAG = "folio-issue-mark/v1";

/**
 * A mark, as a runnable schema.
 *
 * ## Why this is Zod and `SeenState` is derived from it
 *
 * `SeenState` was a TypeScript interface, so the `issue-marks` kind declared
 * `schema` (where the shape is written) and no `validator` (what can be run) —
 * the exact pair `GraphTypologyDef.validator` documents as diverging, with `qa` as
 * its worked example. `check:kind-validators` therefore reported this kind as
 * *could not determine* and `audit-coverage` as reached by nothing at all.
 *
 * One source, not two: the interface is `z.infer` of this, so a field added to
 * one cannot go missing from the other.
 *
 * ## `$schema` is REQUIRED, and `saveSeen` was not writing it
 *
 * The two marks committed here carry the tag; `saveSeen` did not write it. That
 * is worse than a cosmetic omission, because `check:kind-validators` routes a
 * node BY its tag and skips a file that has none — so every mark the mechanism
 * wrote would have been passed over silently by the very check this schema
 * exists to feed, and the two hand-written ones would have been the only files
 * ever validated. A validator over the nodes nobody produces is not coverage.
 *
 * Bean `dh4f`'s shape, and `AGENTS.md`'s rule in one line: *extension is a
 * coincidence; a declaration inside the file is the contract.*
 */
export const IssueMarkSchema = z.object({
  $schema: z.literal(ISSUE_MARK_SCHEMA_TAG),
  /** `owner/repo#number`, for readability when someone opens the file. */
  issue: z.string(),
  /** Highest comment id read. Everything above it is unseen. */
  lastCommentId: z.number(),
  /**
   * `updatedAt` of the newest EDIT the agent has accounted for, ISO-8601.
   * A comment edited after being read keeps its id; without this it would
   * read as already handled.
   */
  lastUpdatedAt: z.string().optional(),
  /** When the agent last looked, ISO-8601. Not the same as the mark. */
  checkedAt: z.string(),
  /** Free-text note — which session, which branch. */
  note: z.string().optional(),
});

/**
 * The mark as the code handles it — `$schema` optional, because a caller
 * assembling a mark should not have to restate a constant, and `saveSeen`
 * supplies it on the way to disk.
 */
export type SeenState = Omit<z.infer<typeof IssueMarkSchema>, "$schema"> & {
  $schema?: typeof ISSUE_MARK_SCHEMA_TAG;
};

export interface CommentLike {
  id: number;
  updated_at?: string;
  created_at?: string;
}

/**
 * `issue-marks/<owner>-<repo>-<number>.json`, under wherever the graph IS.
 *
 * Bean `9ofm` row D. `issue-marks` is one of the state graphs that moves, so
 * the directory is resolved by its declared ID rather than composed from
 * {@link SEEN_DIR} — which stays as the convention for the `undeclared` case
 * and as the name the declaration uses.
 *
 * **Throws** when the graph is on a branch this checkout cannot reach. Every
 * caller here either reads a mark or writes one; a path under the repository
 * root would make `loadSeen` report *"not seen"* for every comment and
 * `saveSeen` write a mark nothing will ever read — so the watcher would
 * re-handle every comment on every run, forever, silently. That is worse than
 * stopping.
 */
export function seenPath(root: string, owner: string, repo: string, issue: number): string {
  const where = graphReadPath(SEEN_DIR, root);
  if (where.state === "refused") throw new Error(`cannot resolve the issue-marks graph: ${where.reason}`);
  const dir = where.state === "ok" ? where.at : join(root, SEEN_DIR);
  return join(dir, `${owner}-${repo}-${issue}.json`);
}

export function loadSeen(
  root: string,
  owner: string,
  repo: string,
  issue: number,
): SeenState | undefined {
  const p = seenPath(root, owner, repo, issue);
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as SeenState;
  } catch {
    // A corrupt mark must not read as "everything is seen" — that is the
    // silent direction. Absent is the safe answer: it makes everything unseen.
    return undefined;
  }
}

export function saveSeen(root: string, owner: string, repo: string, issue: number, state: SeenState): void {
  const p = seenPath(root, owner, repo, issue);
  mkdirSync(dirname(p), { recursive: true });
  // `$schema` FIRST and always written — see `IssueMarkSchema`. A mark without
  // it is skipped by every consumer that routes on the tag, so omitting it made
  // the mechanism's own output invisible to the check that grades this graph.
  const node = { $schema: ISSUE_MARK_SCHEMA_TAG, ...state };
  writeFileSync(p, `${JSON.stringify(node, null, 2)}\n`);
}

/**
 * Comments the agent has not accounted for: id above the mark, OR edited
 * since the mark was written.
 *
 * With no stored mark EVERYTHING is unseen. That is deliberate: a fresh
 * container with no state has not read anything, and defaulting to "seen"
 * would reproduce the exact failure — an agent quietly skipping the comments
 * that changed its direction.
 */
export function unseen<T extends CommentLike>(comments: T[], state: SeenState | undefined): T[] {
  if (!state) return [...comments];
  const since = state.lastUpdatedAt ? Date.parse(state.lastUpdatedAt) : NaN;
  return comments.filter((c) => {
    if (c.id > state.lastCommentId) return true;
    if (!Number.isNaN(since) && c.updated_at) {
      const edited = Date.parse(c.updated_at);
      if (!Number.isNaN(edited) && edited > since) return true;
    }
    return false;
  });
}

const now = (): string => {
  // input-site: traced #6203122b — stamps the seen-comments mark being written
  inputSiteReached("seen-comments: clock");
  return new Date().toISOString();
};

/** The mark to store after reading `comments`. Never moves backwards. */
export function advance(
  issue: string,
  comments: CommentLike[],
  previous: SeenState | undefined,
  note?: string,
): SeenState {
  const maxId = comments.reduce((m, c) => Math.max(m, c.id), previous?.lastCommentId ?? 0);
  const stamps = comments.map((c) => c.updated_at).filter((u): u is string => !!u);
  if (previous?.lastUpdatedAt) stamps.push(previous.lastUpdatedAt);
  const newest = stamps.sort().at(-1);
  return {
    issue,
    lastCommentId: maxId,
    ...(newest ? { lastUpdatedAt: newest } : {}),
    checkedAt: now(),
    ...(note ? { note } : {}),
  };
}
