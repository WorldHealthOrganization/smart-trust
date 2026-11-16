/**
 * A reviewer's comment on one block of a folio: a todo with more structure
 * and a closed lifecycle. Bean `423d`, epic `q4jm`.
 *
 * @module folio-assistant-core/schemas/review-comment
 * @graphNode schema
 *
 * ## Why a todo, and why core declares it
 *
 * The owner, 2026-09-23: *"reviewers comment in dynamic KG content.
 * folio-asst-core should declare as special type of todo. more structured."*
 * and *"more restruicted process use"*.
 *
 * So a review comment is a node in the folio's `todos` graph (layer `state`),
 * not a parallel comment store. It is a KIND whose parent is the harness's
 * todo, composed by `nodeKind` (bean `a1lq`). A board, a heat map or a
 * reader that understands todos can therefore read a review comment without
 * knowing this module. Core extends the harness, which is the allowed
 * direction.
 *
 * ## What "more structured" means
 *
 * A general todo may float free of any block; a review comment may not.
 *
 * - `targetLabel` is REQUIRED. The block label is the comment's anchor, and
 *   `id-unique` / `id-stable` (bean `5xzc`) guard it.
 * - `status` is a closed enum, and it moves only through {@link transition}.
 * - Everything specific to review sits under ONE field, `review`, so no
 *   field here can collide with one a parent adds later. That is the
 *   collision `nodeKind` refuses, and one field keeps the surface small.
 *
 * ## The write channel and the canonical record
 *
 * The owner ruled that a reviewer writes a comment as a CONVERSATION COMMENT
 * on the edit-set's pull request, starting with a tag that names the block.
 * That needs nothing installed and sits beside the approve. The review
 * process INGESTS each tagged comment ({@link ingestPrComments}) into one of
 * these, and this is the record the review page and heat map read.
 *
 * Reconciling those two rulings is the agent's reading, and it is recorded
 * as such on bean 423d.
 */
import { z } from "zod";

import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.js";
import { TodoNodeKind } from "@litlfred/cat-harness-tools/schemas/sdlc/todo.js";
import { ReviewVerdictSchema } from "./review-verdict.js";

export const REVIEW_COMMENT_SCHEMA = "review-comment/1.0.0" as const;

// ── Lifecycle ────────────────────────────────────────────────────

/**
 * Closed. `addressed` is the editor saying "changed, please look".
 * `resolved` and `adjudicated` are terminal, and each names the Decision
 * that closed it. `withdrawn` is the reviewer taking it back.
 */
export const REVIEW_COMMENT_STATUSES = ["open", "addressed", "resolved", "adjudicated", "withdrawn"] as const;
export type ReviewCommentStatus = (typeof REVIEW_COMMENT_STATUSES)[number];

export const REVIEW_COMMENT_KINDS = ["question", "defect", "suggestion", "editorial"] as const;
export type ReviewCommentKindName = (typeof REVIEW_COMMENT_KINDS)[number];

/** A task in a BPMN process: the only thing allowed to move a comment. */
export interface ProcessTask {
  /** The `<bpmn:process id>`. */
  process: string;
  /** The task's id in that process. */
  task: string;
}

export interface ReviewTransition {
  name: string;
  /** `null` for creation. */
  from: readonly (ReviewCommentStatus | null)[];
  to: ReviewCommentStatus;
  by: ProcessTask & {
    /** The `.bpmn` under `cat-harness/processes/` that declares it. */
    /**
     * A test holds every entry to a task that EXISTS in this file, so a
     * renamed task cannot leave this table pointing at nothing.
     */
    file: string;
  };
  /** A transition that closes a comment must name the Decision that closed it. */
  needsDecision?: boolean;
}

/**
 * Every transition there is. Anything not in this table is refused.
 *
 * Existing diagrams are used where they already hold the step: the editor's
 * "Accept, or send back" in `review-task.bpmn`, and the adjudicator's
 * recorded entry in `criterion-adjudication.bpmn`. Ingestion and withdrawal are
 * the reviewer and coordinator steps bean `en2d` added to
 * `content-change-review.bpmn` (its committee phase,
 * `content-change-review-committee.bpmn`, since 2026-10-31), the process a
 * change is reviewed in. A
 * separate large-document diagram was the plan until the owner ruled
 * (2026-09-23) to extend the existing one rather than fork it.
 *
 * The adjudicator's entry is in `criterion-adjudication.bpmn` rather than
 * `adjudication.bpmn` since bean `bvuk` split the outcome half out the same
 * day — see the `adjudicate` transition below for why it went with the
 * outcome. Two independent moves, one docstring: `en2d` changed where
 * ingestion comes FROM, `bvuk` changed where adjudication lands.
 */
export const REVIEW_TRANSITIONS: readonly ReviewTransition[] = [
  {
    name: "ingest",
    from: [null],
    to: "open",
    by: { file: "content-change-review-committee.bpmn", process: "Process_ContentChangeReviewCommittee", task: "Task_IngestComments" },
  },
  {
    name: "address",
    from: ["open"],
    to: "addressed",
    by: { file: "review-task.bpmn", process: "Process_Review", task: "Task_EditorDecides" },
  },
  {
    name: "send-back",
    from: ["addressed"],
    to: "open",
    by: { file: "review-task.bpmn", process: "Process_Review", task: "Task_EditorDecides" },
  },
  {
    name: "resolve",
    from: ["addressed"],
    to: "resolved",
    by: { file: "review-task.bpmn", process: "Process_Review", task: "Task_EditorDecides" },
    needsDecision: true,
  },
  {
    name: "adjudicate",
    from: ["open", "addressed"],
    to: "adjudicated",
    // `criterion-adjudication.bpmn`, not `adjudication.bpmn`: bean `bvuk` split
    // the outcome half out on 2026-09-23, because six diagrams called the
    // shared process and only two asked a question its three outcomes answer.
    // A_RecordEntry went with the outcome, which is where it belongs — the
    // entry written depends on what was adjudicated. It is still
    // `relaxable="false"` there.
    by: {
      file: "criterion-adjudication.bpmn",
      process: "Process_CriterionAdjudication",
      task: "A_RecordEntry",
    },
    needsDecision: true,
  },
  {
    name: "withdraw",
    from: ["open", "addressed"],
    to: "withdrawn",
    by: { file: "content-change-review-committee.bpmn", process: "Process_ContentChangeReviewCommittee", task: "Task_WithdrawComment" },
  },
];

// ── Schema ───────────────────────────────────────────────────────

export const ReviewFieldsSchema = z.object({
  /** `owner/name` of the repository the pull request is in. */
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  /** The edit-set's pull request. */
  pr: z.number().int().positive(),
  /** GitHub's id of the conversation comment this was ingested from. */
  commentId: z.number().int().positive(),
  commentUrl: z.string().url(),
  /** GitHub login of the reviewer. */
  reviewer: z.string().min(1),
  /** The lane they reviewed in: a role id from `roles.json`. */
  role: z.string().min(1),
  kind: z.enum(REVIEW_COMMENT_KINDS),
  /**
   * The block's content hash when the comment was ingested. `null` when the
   * block was not in the head at all, so the comment was orphaned from the
   * start. Recorded rather than refused, because a reviewer's words are kept.
   */
  blockHash: z.string().nullable(),
  /** The head commit the comment was ingested against. */
  commit: z.string().min(1),
  /**
   * The block the label names is gone. Kept and shown, never dropped. An
   * anchor fact, not a status: the review process still decides what happens
   * to the comment.
   */
  orphaned: z.boolean().default(false),
  /** The labels this comment was anchored to before a rename re-anchored it. */
  anchoredFrom: z.array(z.string()).default([]),
  /** The 9gyz Decision that closed it. Required once resolved or adjudicated. */
  decision: z.string().min(1).optional(),
  /**
   * The PR conversation comments whose `resolve:` tag has moved this comment
   * ({@link applyDecisions}), in the order applied. A rebuild applies each
   * one once: the record, not the build count, says what has been decided.
   */
  decisions: z.array(z.number().int().positive()).default([]),
});
export type ReviewFields = z.infer<typeof ReviewFieldsSchema>;

export const ReviewCommentKind = nodeKind(
  REVIEW_COMMENT_SCHEMA,
  [TodoNodeKind],
  {
    /** Required: a review comment is always about one block. */
    targetLabel: z.string().min(1),
    status: z.enum(REVIEW_COMMENT_STATUSES),
    review: ReviewFieldsSchema,
  },
  { overrides: ["targetLabel", "status"] },
);

export const ReviewCommentSchema = ReviewCommentKind.schema.superRefine((c, ctx) => {
  if ((c.status === "resolved" || c.status === "adjudicated") && !c.review.decision) {
    ctx.addIssue({
      code: "custom",
      path: ["review", "decision"],
      message: `a ${c.status} review comment names the Decision that closed it`,
    });
  }
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

// ── Transitions ──────────────────────────────────────────────────

/**
 * Move a comment to `to`, as `by`. Throws unless the table holds that exact
 * move for that exact task.
 *
 * Refusing is the point. A review comment's status is what the coverage gate
 * counts. A comment closed by hand, outside the process, would count as
 * reviewed when nobody in a review lane decided anything.
 */
export function transition(
  comment: ReviewComment,
  to: ReviewCommentStatus,
  by: ProcessTask,
  opts: { decision?: string } = {},
): ReviewComment {
  const t = REVIEW_TRANSITIONS.find(
    (x) => x.to === to && x.from.includes(comment.status) && x.by.process === by.process && x.by.task === by.task,
  );
  if (!t) {
    const allowed = REVIEW_TRANSITIONS.filter((x) => x.from.includes(comment.status))
      .map((x) => `${x.to} (by ${x.by.process}#${x.by.task})`)
      .join(", ");
    throw new Error(
      `review comment \`${comment.id}\`: ${comment.status} → ${to} is not a move ${by.process}#${by.task} may make. ` +
        `From ${comment.status}: ${allowed || "nothing — it is closed"}.`,
    );
  }
  if (t.needsDecision && !opts.decision) {
    throw new Error(`review comment \`${comment.id}\`: ${t.name} names the Decision that closes it`);
  }
  return ReviewCommentSchema.parse({
    ...comment,
    status: to,
    review: { ...comment.review, ...(opts.decision ? { decision: opts.decision } : {}) },
  });
}

// ── The tag, and ingestion ───────────────────────────────────────

/**
 * The tag a reviewer starts a PR comment with.
 *
 *     block: prose:overview
 *     kind: defect
 *     role: clinical-sme
 *
 *     The dose in the second sentence contradicts table 3.
 *
 * Header lines are `key: value`, at the very top, one per line; the first
 * line that is not one ends the header. `block` is required and its value is
 * the rest of the line, because labels contain colons. `kind` defaults to
 * `question`, the one that asserts least; `role` defaults to `reviewer`.
 * A comment without a `block:` line is not a review comment and is left
 * alone: a PR conversation is also where people talk. A tag with `verdict:`
 * or `waive:` is a VERDICT (`review-verdict.ts`), and is left alone here too.
 */
export interface ReviewTag {
  block: string;
  kind: ReviewCommentKindName;
  role: string;
  /** Everything after the header, trimmed. */
  text: string;
}

export function parseReviewTag(body: string): ReviewTag | { error: string } | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const header: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  for (; i < lines.length; i++) {
    const m = /^\s*(block|kind|role|verdict|waive):\s*(.*?)\s*$/i.exec(lines[i]);
    if (!m) break;
    header[m[1].toLowerCase()] = m[2];
  }
  // A verdict (`verdict:` or `waive:`) is not a review comment. It is read by
  // `parseVerdictTag`, which also refuses one that carries `kind:` too, so a
  // comment is never counted under both meanings.
  if ("verdict" in header || "waive" in header) return null;
  if (!("block" in header)) return null;
  if (!/^\S+$/.test(header.block)) return { error: `\`block:\` needs one label, got "${header.block}"` };
  const kind = (header.kind ?? "question").toLowerCase();
  if (!(REVIEW_COMMENT_KINDS as readonly string[]).includes(kind)) {
    return { error: `\`kind: ${header.kind}\` is not one of ${REVIEW_COMMENT_KINDS.join(", ")}` };
  }
  const role = header.role ?? "reviewer";
  if (!/^[a-z][a-z0-9-]*$/.test(role)) return { error: `\`role: ${role}\` is not a role id` };
  return { block: header.block, kind: kind as ReviewCommentKindName, role, text: lines.slice(i).join("\n").trim() };
}

/** A PR conversation comment, in the fields GitHub's API returns. */
export interface PrComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
  url: string;
  /** GitHub's `author_association`: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE… Absent when not known. */
  association?: string;
}

export interface IngestResult {
  created: ReviewComment[];
  /** Already ingested. Same id, so nothing new. */
  unchanged: string[];
  /** Tagged but malformed: said, not dropped, so the reviewer can fix it. */
  malformed: Array<{ commentId: number; url: string; error: string }>;
  /** No tag: ordinary conversation. Counted so "nothing ingested" is explained. */
  untagged: number;
}

/** The id is derived from the comment, so a re-run finds it rather than adding one. */
export const reviewCommentId = (pr: number, commentId: number) => `review-pr${pr}-c${commentId}`;

/**
 * Ingest a PR's tagged comments. The `ingest` transition, performed.
 *
 * Idempotent: an id already in `existing` is left exactly as it is, including
 * its status. A reviewer who EDITS their comment after ingest does not
 * silently rewrite a record that an editor has already acted on; the edit is
 * a new question for the process, and it is not answered here.
 *
 * `blocks` maps each label in the head to its content hash, from the
 * ChangeSet's `snapshot`.
 */
export function ingestPrComments(input: {
  repo: string;
  pr: number;
  commit: string;
  comments: readonly PrComment[];
  existing: readonly Pick<ReviewComment, "id">[];
  blocks: ReadonlyMap<string, string>;
}): IngestResult {
  const have = new Set(input.existing.map((c) => c.id));
  const out: IngestResult = { created: [], unchanged: [], malformed: [], untagged: 0 };
  for (const c of input.comments) {
    const tag = parseReviewTag(c.body);
    if (tag === null) {
      out.untagged++;
      continue;
    }
    if ("error" in tag) {
      out.malformed.push({ commentId: c.id, url: c.url, error: tag.error });
      continue;
    }
    const id = reviewCommentId(input.pr, c.id);
    if (have.has(id)) {
      out.unchanged.push(id);
      continue;
    }
    have.add(id);
    const firstLine = tag.text.split("\n")[0]?.trim() || `(${tag.kind} on ${tag.block})`;
    const hash = input.blocks.get(tag.block) ?? null;
    const ingest = REVIEW_TRANSITIONS.find((t) => t.name === "ingest")!.by;
    out.created.push(
      ReviewCommentSchema.parse({
        $schema: REVIEW_COMMENT_SCHEMA,
        id,
        summary: firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine,
        comment: tag.text,
        createdAt: c.createdAt,
        targetLabel: tag.block,
        status: "open",
        priority: tag.kind === "defect" ? "high" : "medium",
        origin: "human",
        tags: {
          roles: [tag.role],
          processes: [ingest.process],
          tasks: [{ process: ingest.process, task: ingest.task }],
          identities: [{ provider: "github", id: c.user }],
          artefacts: [{ kind: "pull-request", id: String(input.pr), provider: "github", repo: input.repo }],
        },
        review: {
          repo: input.repo,
          pr: input.pr,
          commentId: c.id,
          commentUrl: c.url,
          reviewer: c.user,
          role: tag.role,
          kind: tag.kind,
          blockHash: hash,
          commit: input.commit,
          orphaned: hash === null,
        },
      }),
    );
  }
  return out;
}

// ── Re-anchoring across a ChangeSet ──────────────────────────────

/** The two ChangeSet entries that move an anchor. Structural, so no import cycle. */
type AnchorChange =
  | { change: "removed"; label: string }
  | { change: "changed"; label: string; from?: string; aspects: readonly string[] }
  | { change: "added"; label: string };

/**
 * Follow a ChangeSet's renames and removals. Status is never touched: an
 * anchor is a fact about the block, and only the process moves a comment.
 *
 * - **Renamed** (`from` → `label`): the comment follows, and the old label is
 *   kept in `anchoredFrom`. This is the `renamedFrom` chain `5xzc` guards,
 *   seen from the comment's side.
 * - **Removed**: `orphaned: true`. Kept, and shown as orphaned, never dropped.
 *
 * Returns new objects, and only for comments that changed.
 */
export function reanchor(comments: readonly ReviewComment[], changes: readonly AnchorChange[]): ReviewComment[] {
  const renamed = new Map<string, string>();
  const removed = new Set<string>();
  for (const ch of changes) {
    if (ch.change === "changed" && ch.aspects.includes("renamed") && ch.from) renamed.set(ch.from, ch.label);
    if (ch.change === "removed") removed.add(ch.label);
  }
  const out: ReviewComment[] = [];
  for (const c of comments) {
    const to = renamed.get(c.targetLabel);
    if (to) {
      out.push({
        ...c,
        targetLabel: to,
        review: { ...c.review, anchoredFrom: [...c.review.anchoredFrom, c.targetLabel], orphaned: false },
      });
    } else if (removed.has(c.targetLabel) && !c.review.orphaned) {
      out.push({ ...c, review: { ...c.review, orphaned: true } });
    }
  }
  return out;
}

/** One block as the head has it: its content hash and the labels it used to have. */
export interface BlockAnchor {
  hash: string;
  renamedFrom: readonly string[];
  /** The section listing the block (the ChangeSet's form). The heat map's row for its comments (bean `qbfi`). */
  section?: string;
}

/**
 * Re-anchor every comment against the blocks the head has NOW.
 *
 * This is what the ingestion Tool uses, rather than {@link reanchor} over a
 * ChangeSet. A ChangeSet compares against `main`. A block ADDED in the pull
 * request and then renamed inside it is "added" both times, and a comment on
 * its first label would be orphaned. The block's own `renamedFrom` (bean
 * `5xzc`) says where it came from whatever the base.
 *
 * - The label is present: anchored, and `orphaned` is cleared if a block came
 *   back.
 * - A block lists the label in `renamedFrom`: the comment follows it.
 * - Neither: `orphaned: true`. Kept, never dropped.
 *
 * Returns EVERY comment, changed or not, in input order. Status is never
 * touched.
 */
export function reanchorToBlocks(
  comments: readonly ReviewComment[],
  blocks: ReadonlyMap<string, BlockAnchor>,
): ReviewComment[] {
  const renamedTo = new Map<string, string>();
  for (const [label, b] of blocks) for (const old of b.renamedFrom) renamedTo.set(old, label);
  return comments.map((c) => {
    if (blocks.has(c.targetLabel)) {
      return c.review.orphaned ? { ...c, review: { ...c.review, orphaned: false } } : c;
    }
    const to = renamedTo.get(c.targetLabel);
    if (to) {
      return {
        ...c,
        targetLabel: to,
        review: { ...c.review, anchoredFrom: [...c.review.anchoredFrom, c.targetLabel], orphaned: false },
      };
    }
    return c.review.orphaned ? c : { ...c, review: { ...c.review, orphaned: true } };
  });
}

// ── The published file ──────────────────────────────────────────

export const REVIEW_COMMENTS_FILE_SCHEMA = "folio-review-comments/v1" as const;

/**
 * `review-comments.json`, published beside `changeset.json` in a preview.
 *
 * **`comments` IS the todo kind**: each entry is a `review-comment/1.0.0`
 * node and is validated as one, so there is no second format to drift from
 * it. The envelope carries only what a single node cannot: where the
 * comments came from, and what was NOT ingested and why. A reader must be
 * able to tell "no comments" from "comments nobody could parse".
 */
export const ReviewCommentsFileSchema = z.object({
  $schema: z.literal(REVIEW_COMMENTS_FILE_SCHEMA),
  repo: z.string(),
  pr: z.number().int().positive(),
  /** The head commit whose blocks the comments were anchored against. */
  commit: z.string(),
  generatedAt: z.string(),
  comments: z.array(ReviewCommentSchema),
  malformed: z.array(z.object({ commentId: z.number().int(), url: z.string(), error: z.string() })),
  untagged: z.number().int().nonnegative(),
  /**
   * Reviewers' per-block verdicts (`folio-review-verdict/v1`, bean `px0t`),
   * ingested from the same PR comments. Default `[]`, so a file written
   * before verdicts existed still reads.
   */
  verdicts: z.array(ReviewVerdictSchema).default([]),
});
export type ReviewCommentsFile = z.infer<typeof ReviewCommentsFileSchema>;

// ── Deciding from the page: a tagged comment that moves one ──────

/**
 * The tag that decides a review comment, written as a PR conversation comment
 * like the one that opened it (owner, 2026-10-15: resolving from the static
 * review page goes through the same channel as commenting).
 *
 *     resolve: review-pr7-c123
 *     decision: resolved
 *
 *     The dose now matches table 3.
 *
 * `resolve:` names the review comment by id. `decision:` names where it goes,
 * and each word is one transition of {@link REVIEW_TRANSITIONS}, so the
 * table still refuses any move it does not hold:
 */
export const DECISION_WORDS = {
  addressed: "address",
  reopened: "send-back",
  resolved: "resolve",
  adjudicated: "adjudicate",
  withdrawn: "withdraw",
} as const;
export type DecisionWord = keyof typeof DECISION_WORDS;

export interface DecisionTag {
  /** The review comment's id. */
  target: string;
  decision: DecisionWord;
  /** Everything after the header, trimmed: the reason. */
  text: string;
}

export function parseDecisionTag(body: string): DecisionTag | { error: string } | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const header: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  for (; i < lines.length; i++) {
    const m = /^\s*(resolve|decision):\s*(.*?)\s*$/i.exec(lines[i]);
    if (!m) break;
    header[m[1].toLowerCase()] = m[2];
  }
  if (!("resolve" in header)) return null;
  if (!/^review-pr\d+-c\d+$/.test(header.resolve)) return { error: `\`resolve:\` names a review comment id (review-pr<N>-c<M>), got "${header.resolve}"` };
  const word = (header.decision ?? "").toLowerCase();
  if (!(word in DECISION_WORDS)) return { error: `\`decision:\` is one of ${Object.keys(DECISION_WORDS).join(", ")}, got "${header.decision ?? ""}"` };
  return { target: header.resolve, decision: word as DecisionWord, text: lines.slice(i).join("\n").trim() };
}

/** The associations that may decide: the repository's own people, the editor's lane. */
export const DECIDING_ASSOCIATIONS: readonly string[] = ["OWNER", "MEMBER", "COLLABORATOR"];

export interface DecisionResult {
  comments: ReviewComment[];
  /** Decisions applied by this run, as `<decision comment id> → <review comment id>: <status>`. */
  applied: string[];
  /** A decision tag that could not be applied, and why: said, never silently dropped. */
  refused: Array<{ commentId: number; url: string; error: string }>;
  /** How many PR comments carried a decision tag, so they are not counted as conversation. */
  tagged: number;
}

/**
 * Apply every decision tag in `prComments`, oldest first, through
 * {@link transition}.
 *
 * - **Who.** A repository owner, member or collaborator decides any move. The
 *   review comment's own author may withdraw it. Anyone else is refused: a
 *   PR conversation is open to every GitHub user, and a status is what the
 *   coverage gate counts.
 * - **Once.** A decision already in the comment's `review.decisions` is
 *   skipped, so a rebuild, or a committed copy that already carries it, is a
 *   no-op.
 * - **The Decision.** A move that closes a comment names the decision
 *   comment's URL as the Decision that closed it.
 * - **Never dropped.** A decision on an unknown id, an unauthorised one, or a
 *   move the table refuses is listed in `refused` with its reason.
 */
export function applyDecisions(comments: readonly ReviewComment[], prComments: readonly PrComment[]): DecisionResult {
  const byId = new Map(comments.map((c) => [c.id, c] as const));
  const out: DecisionResult = { comments: [], applied: [], refused: [], tagged: 0 };
  const ordered = [...prComments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  for (const pc of ordered) {
    const tag = parseDecisionTag(pc.body);
    if (tag === null) continue;
    out.tagged++;
    const refuse = (error: string) => out.refused.push({ commentId: pc.id, url: pc.url, error });
    if ("error" in tag) {
      refuse(tag.error);
      continue;
    }
    const c = byId.get(tag.target);
    if (!c) {
      refuse(`no review comment \`${tag.target}\` on this pull request`);
      continue;
    }
    if (c.review.decisions.includes(pc.id)) continue;
    const name = DECISION_WORDS[tag.decision];
    const may = DECIDING_ASSOCIATIONS.includes(pc.association ?? "") || (name === "withdraw" && pc.user === c.review.reviewer);
    if (!may) {
      refuse(`${pc.user} (${pc.association ?? "association unknown"}) may not decide \`${tag.target}\`: a repository owner, member or collaborator decides${name === "withdraw" ? ", or the comment's own author withdraws" : ""}`);
      continue;
    }
    const t = REVIEW_TRANSITIONS.find((x) => x.name === name)!;
    try {
      const moved = transition(c, t.to, t.by, t.needsDecision ? { decision: pc.url } : {});
      byId.set(c.id, ReviewCommentSchema.parse({ ...moved, review: { ...moved.review, decisions: [...c.review.decisions, pc.id] } }));
      out.applied.push(`${pc.id} → ${c.id}: ${t.to}`);
    } catch (e) {
      refuse((e as Error).message);
    }
  }
  out.comments = comments.map((c) => byId.get(c.id)!);
  return out;
}
