/**
 * A person's merge decision on the queue entry (bean `ixmq`): what the record
 * refuses, when it covers a head, and how the PR's agent builds it.
 */
import { describe, expect, test } from "bun:test";
import { MERGE_QUEUE_ENTRY_TAG, MergeQueueEntrySchema, releaseCovers, type MergeQueueEntry } from "../../../schemas/sdlc/merge-queue.ts";
import { decisionFrom } from "../../merge-queue-cli.ts";
import { releaseState } from "../../merge-steward.ts";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const SESSION = "https://claude.ai/code/session_01Example";

const release = (over: Record<string, unknown> = {}) => ({
  verdict: "merge",
  decidedBy: "litlfred",
  decidedAt: "2026-10-04T13:00:00Z",
  authority: { kind: "explicit", quote: "merge #2077", source: SESSION },
  releasedSha: SHA,
  capturedBy: SESSION,
  ...over,
});

const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  $schema: MERGE_QUEUE_ENTRY_TAG,
  repository: "litlfred/folio-assistant",
  pr: 2077,
  placement: { kind: "computed", decision: "d.dmn#D", rule: "Rule_X", class: "standard", rank: 1 },
  reason: "clean and green",
  decidedBy: SESSION,
  decidedAt: "2026-10-04T12:00:00Z",
  beans: ["folio-assistant-zmdo"],
  ...over,
});

describe("the release record refuses what would make it unreliable", () => {
  test("a valid release parses on an entry", () => {
    expect(MergeQueueEntrySchema.safeParse(entry({ release: release() })).success).toBe(true);
  });

  test("the person who decided cannot be the session that wrote it down", () => {
    const r = MergeQueueEntrySchema.safeParse(entry({ release: release({ decidedBy: SESSION }) }));
    expect(r.success).toBe(false);
  });

  test("a standing ruling needs the date it was ruled", () => {
    const bad = release({ authority: { kind: "standing-ruling", quote: "you may merge green PRs", source: SESSION } });
    expect(MergeQueueEntrySchema.safeParse(entry({ release: bad })).success).toBe(false);
    const good = release({ authority: { kind: "standing-ruling", quote: "you may merge green PRs", ruledAt: "2026-10-01", source: SESSION } });
    expect(MergeQueueEntrySchema.safeParse(entry({ release: good })).success).toBe(true);
  });

  test("releasedSha is a full object name, and the live-fact rule still refuses headSha", () => {
    expect(MergeQueueEntrySchema.safeParse(entry({ release: release({ releasedSha: "abc123" }) })).success).toBe(false);
    expect(MergeQueueEntrySchema.safeParse(entry({ release: release(), headSha: SHA })).success).toBe(false);
  });

  test("there is no `hold` verdict — a hold is the structured `hold` field", () => {
    expect(MergeQueueEntrySchema.safeParse(entry({ release: release({ verdict: "hold" }) })).success).toBe(false);
  });
});

describe("releaseCovers — what merge:guard asks before landing", () => {
  const parsed = (r?: Record<string, unknown>) =>
    MergeQueueEntrySchema.parse(entry(r ? { release: r } : {})) as MergeQueueEntry;

  test("no release is not a yes", () => {
    expect(releaseCovers(parsed(), SHA)).toMatchObject({ ok: false, why: "none" });
  });
  test("a release at this head covers it", () => {
    expect(releaseCovers(parsed(release()), SHA)).toEqual({ ok: true });
  });
  test("a push after the decision voids it, and both commits are named", () => {
    const c = releaseCovers(parsed(release()), OTHER);
    expect(c).toMatchObject({ ok: false, why: "void" });
    expect(!c.ok && c.detail).toContain("aaaaaaaaaaaa");
    expect(!c.ok && c.detail).toContain("bbbbbbbbbbbb");
  });
  test("do-not-merge never covers, even at the released head", () => {
    expect(releaseCovers(parsed(release({ verdict: "do-not-merge" })), SHA)).toMatchObject({ ok: false, why: "do-not-merge" });
  });
  test("the steward prints each state apart", () => {
    expect(releaseState(parsed(), SHA)).toBe("none");
    expect(releaseState(parsed(release()), SHA)).toStartWith("merge@aaaaaaaaaaaa");
    expect(releaseState(parsed(release()), OTHER)).toStartWith("VOID");
  });
});

describe("decisionFrom — the PR's agent captures the person's words", () => {
  const argv = (...extra: string[]) => [
    "--pr", "2077", "--verdict", "merge", "--by", "litlfred", "--quote", "merge #2077, start zmdo proof",
    "--source", SESSION, "--sha", SHA, "--captured-by", SESSION, "--at", "2026-10-04T13:05:00Z", ...extra,
  ];
  const existing = MergeQueueEntrySchema.parse(entry()) as MergeQueueEntry;

  test("on an existing entry: placement untouched, release set, beans merged without duplicates", () => {
    const r = decisionFrom(argv("--beans", "folio-assistant-zmdo,folio-assistant-3p7c"), ".", existing);
    expect("entry" in r).toBe(true);
    const e = MergeQueueEntrySchema.parse((r as { entry: unknown }).entry) as MergeQueueEntry;
    expect(e.placement).toEqual(existing.placement);
    expect(e.decidedBy).toBe(existing.decidedBy);
    expect(e.release?.decidedBy).toBe("litlfred");
    expect(e.release?.authority).toEqual({ kind: "explicit", quote: "merge #2077, start zmdo proof", source: SESSION });
    expect(e.beans).toEqual(["folio-assistant-zmdo", "folio-assistant-3p7c"]);
  });

  test("a session as the decider is refused, with the field that belongs to it named", () => {
    const r = decisionFrom(["--verdict", "merge", "--by", SESSION, "--captured-by", SESSION], ".", existing);
    expect("usage" in r && r.usage).toContain("--captured-by");
  });

  test("a new entry without a placement is refused rather than placed by guess", () => {
    const r = decisionFrom(argv(), ".", undefined);
    expect("usage" in r && r.usage).toContain("merge:queue:record");
  });

  test("a new entry with placement flags: the placement is the capturer's, the release the person's", () => {
    const r = decisionFrom(argv("--class", "standard", "--rank", "2", "--rule", "Rule_X", "--reason", "clean", "--repository", "litlfred/folio-assistant"), ".", undefined);
    const e = MergeQueueEntrySchema.parse((r as { entry: unknown }).entry) as MergeQueueEntry;
    expect(e.decidedBy).toBe(SESSION);
    expect(e.release?.decidedBy).toBe("litlfred");
  });

  test("a standing ruling without its date is refused before it reaches the schema", () => {
    const r = decisionFrom(argv("--standing-ruling"), ".", existing);
    expect("usage" in r && r.usage).toContain("--ruled-at");
  });
});
