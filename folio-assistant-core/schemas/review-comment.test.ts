/**
 * The review-comment todo kind (bean 423d): a todo with more structure, a
 * closed lifecycle only process tasks may move, idempotent ingestion from a
 * PR's tagged comments, and anchors that follow a rename and survive a removal.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TodoNodeSchema } from "@litlfred/cat-harness-tools/schemas/sdlc/todo.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.js";
import {
  REVIEW_TRANSITIONS,
  ReviewCommentKind,
  ReviewCommentSchema,
  ingestPrComments,
  parseReviewTag,
  reanchor,
  reanchorToBlocks,
  transition,
  applyDecisions,
  parseDecisionTag,
  type PrComment,
} from "./review-comment";

/** The diagrams are found by NAME through the declared `processes` graphs, from the harness whose corpus scope is the checkout (placement PR3, bean `63wl`). */
const HARNESS = resolve(import.meta.dir, "../../cat-harness");
const EDITOR = { process: "Process_Review", task: "Task_EditorDecides" };
// `Process_CriterionAdjudication` since bean `bvuk` split the outcome half
// out of the shared judgement — A_RecordEntry went with the outcome.
const ADJUDICATOR = { process: "Process_CriterionAdjudication", task: "A_RecordEntry" };

const pc = (id: number, body: string): PrComment => ({
  id,
  body,
  user: "sme1",
  createdAt: "2026-09-23T07:00:00Z",
  url: `https://github.com/o/r/pull/7#issuecomment-${id}`,
});

const ingestOne = (body = "block: prose:overview\nkind: defect\nrole: clinical-sme\n\nDose contradicts table 3.") =>
  ingestPrComments({
    repo: "o/r",
    pr: 7,
    commit: "abc123",
    comments: [pc(101, body)],
    existing: [],
    blocks: new Map([["prose:overview", "h1"]]),
  }).created[0];

describe("the kind", () => {
  it("kindIsTodo", () => {
    expect(ReviewCommentKind.order).toEqual(["carried-note", "themed", "todo", "review-comment"]);
    const c = ingestOne();
    // A reader that knows only todos still parses it — bar the tag itself.
    expect(TodoNodeSchema.safeParse({ ...c, $schema: "todo/1.0.0" }).success).toBe(true);
  });

  it("targetLabelRequiredStatusClosed", () => {
    const c = ingestOne();
    const { targetLabel: _drop, ...noLabel } = c;
    expect(ReviewCommentSchema.safeParse(noLabel).success).toBe(false);
    expect(ReviewCommentSchema.safeParse({ ...c, status: "in_progress" }).success).toBe(false);
  });
});

describe("the lifecycle is closed, and only process tasks move it", () => {
  it("editorAddressesThenResolves", () => {
    const c = transition(ingestOne(), "addressed", EDITOR);
    expect(c.status).toBe("addressed");
    const done = transition(c, "resolved", EDITOR, { decision: "decision:7" });
    expect(done.review.decision).toBe("decision:7");
  });

  it("refusesIllegalMoves", () => {
    const c = ingestOne();
    expect(() => transition(c, "resolved", EDITOR, { decision: "d" })).toThrow(/open → resolved is not a move/);
    expect(() => transition(c, "addressed", { process: "Process_Review", task: "Task_Consolidate" })).toThrow(/not a move/);
    expect(() => transition(c, "addressed", { process: "by-hand", task: "edit-the-file" })).toThrow(/not a move/);
    const closed = transition(c, "adjudicated", ADJUDICATOR, { decision: "d" });
    expect(() => transition(closed, "open", EDITOR)).toThrow(/nothing — it is closed/);
  });

  it("closingNeedsDecision", () => {
    const c = transition(ingestOne(), "addressed", EDITOR);
    expect(() => transition(c, "resolved", EDITOR)).toThrow(/names the Decision/);
    expect(ReviewCommentSchema.safeParse({ ...c, status: "resolved" }).success).toBe(false);
  });

  it("transitionsNameRealBpmnTasks", () => {
    for (const t of REVIEW_TRANSITIONS) {
      const xml = readFileSync(workflowFile(HARNESS, t.by.file), "utf-8");
      expect(xml).toContain(`<bpmn:process id="${t.by.process}"`);
      expect(xml).toMatch(new RegExp(`<bpmn:\\w+ id="${t.by.task}"`));
    }
  });
});

describe("the tag", () => {
  it("tagReadsBlockKindRole", () => {
    expect(parseReviewTag("block: prose:overview\nkind: defect\nrole: clinical-sme\n\nText.")).toEqual({
      block: "prose:overview",
      kind: "defect",
      role: "clinical-sme",
      text: "Text.",
    });
  });

  it("tagDefaultsKindRole", () => {
    expect(parseReviewTag("block: tbl:doses\nWhy 5 mg?")).toMatchObject({ kind: "question", role: "reviewer", text: "Why 5 mg?" });
  });

  it("untaggedIsConversation", () => {
    expect(parseReviewTag("LGTM, thanks!")).toBeNull();
    expect(parseReviewTag("See below.\nblock: prose:x")).toBeNull();
    expect(parseReviewTag("block: two labels")).toEqual({ error: expect.stringContaining("one label") });
    expect(parseReviewTag("block: a\nkind: rant")).toEqual({ error: expect.stringContaining("not one of") });
  });
});

describe("ingestion", () => {
  const comments = [pc(1, "block: prose:overview\nFirst."), pc(2, "Thanks all"), pc(3, "block: a\nkind: rant\nx"), pc(4, "block: gone:block\nOn a block not in the head.")];
  const run = (existing: { id: string }[] = []) =>
    ingestPrComments({ repo: "o/r", pr: 7, commit: "abc", comments, existing, blocks: new Map([["prose:overview", "h1"]]) });

  it("ingestOnePerTaggedComment", () => {
    const r = run();
    expect(r.created.map((c) => c.id)).toEqual(["review-pr7-c1", "review-pr7-c4"]);
    expect(r.untagged).toBe(1);
    expect(r.malformed).toEqual([{ commentId: 3, url: comments[2].url, error: expect.stringContaining("rant") }]);
    expect(r.created[0]).toMatchObject({ status: "open", origin: "human", review: { blockHash: "h1", orphaned: false } });
  });

  it("offHeadCommentOrphaned", () => {
    expect(run().created[1].review).toMatchObject({ blockHash: null, orphaned: true });
  });

  it("ingestionIdempotent", () => {
    const first = run();
    const again = run(first.created);
    expect(again.created).toEqual([]);
    expect(again.unchanged).toEqual(["review-pr7-c1", "review-pr7-c4"]);
  });
});

describe("re-anchoring across a ChangeSet", () => {
  it("reanchorFollowsRename", () => {
    const c = transition(ingestOne(), "addressed", EDITOR);
    const [moved] = reanchor([c], [{ change: "changed", label: "prose:summary", from: "prose:overview", aspects: ["renamed"] }]);
    expect(moved.targetLabel).toBe("prose:summary");
    expect(moved.review.anchoredFrom).toEqual(["prose:overview"]);
    expect(moved.status).toBe("addressed");
  });

  it("removedBlockOrphans", () => {
    const c = ingestOne();
    const [orphan] = reanchor([c], [{ change: "removed", label: "prose:overview" }]);
    expect(orphan).toMatchObject({ id: c.id, targetLabel: "prose:overview", status: "open", review: { orphaned: true } });
  });

  it("unrelatedChangeLeavesAlone", () => {
    expect(reanchor([ingestOne()], [{ change: "added", label: "prose:new" }])).toEqual([]);
  });
});

describe("re-anchoring against the head's blocks (renamedFrom)", () => {
  const blocks = (entries: [string, string[]][]) =>
    new Map(entries.map(([label, renamedFrom]) => [label, { hash: `h-${label}`, renamedFrom }]));

  it("followsRenamedFrom", () => {
    const [c] = reanchorToBlocks([ingestOne()], blocks([["prose:summary", ["prose:overview"]]]));
    expect(c.targetLabel).toBe("prose:summary");
    expect(c.review.anchoredFrom).toEqual(["prose:overview"]);
  });

  it("orphansAndUnorphans", () => {
    const [gone] = reanchorToBlocks([ingestOne()], blocks([["prose:other", []]]));
    expect(gone.review.orphaned).toBe(true);
    const [back] = reanchorToBlocks([gone], blocks([["prose:overview", []]]));
    expect(back.review.orphaned).toBe(false);
  });

  it("returnsAnchoredUnchanged", () => {
    const c = ingestOne();
    expect(reanchorToBlocks([c], blocks([["prose:overview", []]]))).toEqual([c]);
  });
});

describe("deciding from the page: a `resolve:` tag (owner, 2026-10-15)", () => {
  const decide = (id: number, body: string, user = "editor1", association = "COLLABORATOR", createdAt = "2026-09-24T08:00:00Z"): PrComment => ({
    id, body, user, association, createdAt, url: `https://github.com/o/r/pull/7#issuecomment-${id}`,
  });
  const target = "review-pr7-c101";

  it("parsesResolveTag", () => {
    expect(parseDecisionTag(`resolve: ${target}\ndecision: Resolved\n\nFixed in table 3.`)).toEqual({ target, decision: "resolved", text: "Fixed in table 3." });
    expect(parseDecisionTag("block: prose:overview\n\nhi")).toBeNull();
    expect(parseDecisionTag("just talk")).toBeNull();
    expect(parseDecisionTag(`resolve: ${target}\ndecision: done`)).toEqual({ error: expect.stringContaining("`decision:` is one of") });
    expect(parseDecisionTag("resolve: prose:overview\ndecision: resolved")).toEqual({ error: expect.stringContaining("review comment id") });
  });

  it("editorMovesThroughTable", () => {
    const c = ingestOne();
    const r = applyDecisions([c], [
      decide(201, `resolve: ${target}\ndecision: addressed`),
      decide(202, `resolve: ${target}\ndecision: resolved\n\nAgreed.`, "editor1", "OWNER", "2026-09-24T09:00:00Z"),
    ]);
    expect(r.refused).toEqual([]);
    expect(r.tagged).toBe(2);
    const d = r.comments[0]!;
    expect(d.status).toBe("resolved");
    expect(d.review.decision).toBe("https://github.com/o/r/pull/7#issuecomment-202");
    expect(d.review.decisions).toEqual([201, 202]);
  });

  it("decisionsAppliedOnce", () => {
    const once = applyDecisions([ingestOne()], [decide(201, `resolve: ${target}\ndecision: addressed`)]);
    const twice = applyDecisions(once.comments, [decide(201, `resolve: ${target}\ndecision: addressed`)]);
    expect(twice.refused).toEqual([]);
    expect(twice.applied).toEqual([]);
    expect(twice.comments).toEqual(once.comments);
  });

  it("refusesMoveNotInTable", () => {
    const r = applyDecisions([ingestOne()], [decide(201, `resolve: ${target}\ndecision: resolved`)]);
    expect(r.comments[0]!.status).toBe("open");
    expect(r.refused[0]!.error).toMatch(/open → resolved is not a move/);
  });

  it("onlyRepoPeopleDecide", () => {
    const stranger = applyDecisions([ingestOne()], [decide(201, `resolve: ${target}\ndecision: addressed`, "drive-by", "NONE")]);
    expect(stranger.comments[0]!.status).toBe("open");
    expect(stranger.refused[0]!.error).toMatch(/may not decide/);
    const own = applyDecisions([ingestOne()], [decide(201, `resolve: ${target}\ndecision: withdrawn`, "sme1", "CONTRIBUTOR")]);
    expect(own.refused).toEqual([]);
    expect(own.comments[0]!.status).toBe("withdrawn");
  });

  it("unknownCommentDecisionRefused", () => {
    const r = applyDecisions([ingestOne()], [decide(201, "resolve: review-pr7-c999\ndecision: addressed")]);
    expect(r.refused[0]!.error).toMatch(/no review comment `review-pr7-c999`/);
  });

  it("survivesMoveRecordsDecision", () => {
    const c = ingestOne();
    const [moved] = reanchorToBlocks([c], new Map([["prose:summary", { hash: "h2", renamedFrom: ["prose:overview"] }]]));
    expect(moved!.targetLabel).toBe("prose:summary");
    expect(moved!.review.anchoredFrom).toEqual(["prose:overview"]);
    const r = applyDecisions([moved!], [
      decide(201, `resolve: ${target}\ndecision: addressed`),
      decide(202, `resolve: ${target}\ndecision: resolved\n\nConfirmed after move.`, "editor1", "OWNER", "2026-09-24T09:00:00Z"),
    ]);
    expect(r.refused).toEqual([]);
    expect(r.comments[0]).toMatchObject({
      targetLabel: "prose:summary",
      status: "resolved",
      review: {
        anchoredFrom: ["prose:overview"],
        decision: "https://github.com/o/r/pull/7#issuecomment-202",
        decisions: [201, 202],
      },
    });
  });
});
