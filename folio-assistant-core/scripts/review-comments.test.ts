/**
 * The `folio-review-comments` Tool (bean 423d): the ingestion as a pure
 * function, then the command itself, offline, exactly as the workflow calls it.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ReviewCommentsFileSchema, type PrComment } from "../schemas/review-comment";
import { buildReviewComments, writeDecided, type BlocksFile } from "./review-comments";

const pc = (id: number, body: string): PrComment => ({
  id,
  body,
  user: "sme1",
  createdAt: "2026-09-23T07:00:00Z",
  url: `https://github.com/o/r/pull/7#issuecomment-${id}`,
});
const blocks: BlocksFile = { "prose:overview": { hash: "h1", renamedFrom: [] } };
const base = { repo: "o/r", pr: 7, commit: "c1", blocks, now: "2026-09-23T08:00:00Z" };

describe("buildReviewComments", () => {
  it("writesTodoKindAndRest", () => {
    const f = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nWhy?"), pc(2, "thanks"), pc(3, "block: x\nkind: rant")] });
    expect(f.comments.map((c) => c.$schema)).toEqual(["review-comment/1.0.0"]);
    expect(f.untagged).toBe(1);
    expect(f.malformed).toHaveLength(1);
  });

  it("appliesResolveOnce", () => {
    const ed = (id: number, body: string, at: string): PrComment => ({ ...pc(id, body), user: "editor1", association: "COLLABORATOR", createdAt: at });
    const comments = [
      pc(1, "block: prose:overview\nkind: defect\n\nDose contradicts table 3."),
      ed(2, "resolve: review-pr7-c1\ndecision: addressed", "2026-09-23T07:10:00Z"),
      ed(3, "resolve: review-pr7-c1\ndecision: resolved\n\nNow matches.", "2026-09-23T07:20:00Z"),
      pc(4, "resolve: review-pr7-c1\ndecision: reopened"),
    ];
    const f = buildReviewComments({ ...base, comments });
    expect(f.comments.map((c) => [c.id, c.status, c.review.decision])).toEqual([["review-pr7-c1", "resolved", "https://github.com/o/r/pull/7#issuecomment-3"]]);
    expect(f.untagged).toBe(0);
    // The stranger's reopen (sme1, no association) is refused and said.
    expect(f.malformed.map((m) => m.commentId)).toEqual([4]);
    // A rebuild over its own output applies nothing twice.
    expect(buildReviewComments({ ...base, comments, existing: f }).comments).toEqual(f.comments);
  });

  it("writesNewlyDecided", () => {
    const ed = (id: number, body: string): PrComment => ({ ...pc(id, body), user: "editor1", association: "OWNER", createdAt: "2026-09-23T07:10:00Z" });
    const f = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nWhy?"), pc(5, "block: prose:overview\nAnd?"), ed(2, "resolve: review-pr7-c1\ndecision: addressed")] });
    const dir = mkdtempSync(join(tmpdir(), "decided-"));
    expect(writeDecided(f.comments, new Map(), dir)).toEqual(["review-pr7-c1"]);
    const written = JSON.parse(readFileSync(join(dir, "review-pr7-c1.json"), "utf-8"));
    expect([written.status, written.review.decisions]).toEqual(["addressed", [2]]);
    const committed = new Map(f.comments.map((c) => [c.id, c] as const));
    expect(writeDecided(f.comments, committed, dir)).toEqual([]);
  });

  it("ingestsVerdicts", () => {
    const f = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nverdict: ok"), pc(2, "thanks")] });
    expect(f.comments).toEqual([]);
    expect(f.verdicts.map((v) => [v.targetLabel, v.verdict, v.blockHash])).toEqual([["prose:overview", "ok", "h1"]]);
    expect(f.untagged).toBe(1);
    // ...and keeps them on the next build.
    expect(buildReviewComments({ ...base, comments: [], existing: f }).verdicts).toHaveLength(1);
  });

  it("pageVerdictAtPin", () => {
    const rendered = { files: [{ path: "doc/index.html", role: "content", hash: "pin-doc" }], undetermined: [] };
    const f = buildReviewComments({ ...base, rendered, comments: [pc(1, "page: doc/index.html\nverdict: ok"), pc(2, "page: nope.html\nverdict: ok")] });
    expect(f.comments).toEqual([]);
    expect(f.verdicts.map((v) => [v.target, v.targetLabel, v.blockHash])).toEqual([["page", "doc/index.html", "pin-doc"]]);
    expect(f.malformed.map((m) => m.error)).toEqual([expect.stringContaining("no page `nope.html`")]);
    expect(f.untagged).toBe(0);
  });

  it("idempotentKeepsStatus", () => {
    const first = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nWhy?")] });
    const moved = { ...first, comments: [{ ...first.comments[0]!, status: "addressed" as const }] };
    const again = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nWhy?")], existing: moved });
    expect(again.comments).toHaveLength(1);
    expect(again.comments[0]!.status).toBe("addressed");
  });

  it("followsRenameOrphans", () => {
    const first = buildReviewComments({ ...base, comments: [pc(1, "block: prose:overview\nWhy?")] });
    const renamed = buildReviewComments({
      ...base,
      comments: [],
      existing: first,
      blocks: { "prose:summary": { hash: "h2", renamedFrom: ["prose:overview"] } },
    });
    expect(renamed.comments[0]!.targetLabel).toBe("prose:summary");
    const removed = buildReviewComments({ ...base, comments: [], existing: renamed, blocks: {} });
    expect(removed.comments).toHaveLength(1);
    expect(removed.comments[0]!.review.orphaned).toBe(true);
  });
});

describe("the command, offline, as the refresh job calls it", () => {
  let dir: string | undefined;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("commandWritesValidFile", () => {
    dir = mkdtempSync(join(tmpdir(), "review-comments-"));
    writeFileSync(join(dir, "blocks.json"), JSON.stringify(blocks));
    writeFileSync(join(dir, "comments.json"), JSON.stringify([pc(5, "block: prose:overview\nkind: defect\n\nWrong dose.")]));
    const out = join(dir, "review-comments.json");
    const run = () =>
      Bun.spawnSync(
        ["bun", "run", resolve(import.meta.dir, "review-comments.ts"),
          "--repo", "o/r", "--pr", "7", "--commit", "c1",
          "--blocks", join(dir!, "blocks.json"), "--comments", join(dir!, "comments.json"),
          "--existing", out, "--out", out],
        { stderr: "pipe" },
      );
    expect(run().exitCode).toBe(0);
    expect(run().exitCode).toBe(0);
    const f = ReviewCommentsFileSchema.parse(JSON.parse(readFileSync(out, "utf-8")));
    expect(f.comments.map((c) => [c.id, c.review.kind, c.priority])).toEqual([["review-pr7-c5", "defect", "high"]]);
  });

  it("refusesWithoutBlocks", () => {
    const r = Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "review-comments.ts"), "--repo", "o/r", "--pr", "7", "--out", "/dev/null"], { stderr: "pipe" });
    expect(r.exitCode).toBe(2);
  });
});
