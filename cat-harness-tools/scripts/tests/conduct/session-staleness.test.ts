/**
 * Sessions waiting on a person, and the directions this must never fail in.
 *
 * Bean `rq8s`. The tests that matter are the three-state ones: an unreadable
 * listing is **unknown**, never "nothing waiting"; a row with no usable
 * timestamp is **skipped**, never treated as fresh; and a session that stopped
 * without declaring it needs somebody is **named**, never asserted as waiting
 * and never dropped.
 *
 * @module folio-assistant/scripts/tests/session-staleness
 */

import { describe, expect, test } from "bun:test";

import {
  FAILED_UNREAD_HOURS,
  readRows,
  render,
  REQUIRES_ACTION,
  REQUIRES_ACTION_HOURS,
  repoOf,
  stale,
  type SessionRow,
} from "../../../src/sessions/staleness.ts";

const NOW = new Date("2026-09-21T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: "session_x",
  title: "a session",
  updated_at: hoursAgo(1),
  session_context: { sources: [{ git_repository: { url: "https://github.com/litlfred/folio-assistant" } }] },
  ...over,
});

describe("a session waiting on a person is reported once it is stale", () => {
  test("REQUIRES_ACTION past the threshold is a finding, and the question comes with it", () => {
    const r = stale(
      [row({ session_status: REQUIRES_ACTION, updated_at: hoursAgo(113), task_summary: "Which PRs should I merge?" })],
      NOW,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.reason).toBe("requires-action");
    // The question is the whole point: a count cannot be acted on.
    expect(r[0]!.question).toBe("Which PRs should I merge?");
  });

  test("REQUIRES_ACTION inside the threshold is NOT a finding", () => {
    const r = stale([row({ session_status: REQUIRES_ACTION, updated_at: hoursAgo(REQUIRES_ACTION_HOURS - 1) })], NOW);
    expect(r).toHaveLength(0);
  });

  test("a FAILED session with unread output is a finding", () => {
    const r = stale(
      [row({ status_bucket: "SESSION_STATUS_BUCKET_FAILED", unread: true, updated_at: hoursAgo(385) })],
      NOW,
    );
    expect(r[0]!.reason).toBe("failed-unread");
  });

  test("a FAILED session somebody has READ is not this check's business", () => {
    // They know. Reporting it would make every historical failure permanent noise.
    const r = stale(
      [row({ status_bucket: "SESSION_STATUS_BUCKET_FAILED", unread: false, updated_at: hoursAgo(385) })],
      NOW,
    );
    expect(r).toHaveLength(0);
  });

  test("a fresh FAILED session is not reported before one working day", () => {
    const r = stale(
      [row({ status_bucket: "SESSION_STATUS_BUCKET_FAILED", unread: true, updated_at: hoursAgo(FAILED_UNREAD_HOURS - 1) })],
      NOW,
    );
    expect(r).toHaveLength(0);
  });

  test("findings are ordered by how long they have waited", () => {
    const r = stale(
      [
        row({ id: "b", session_status: REQUIRES_ACTION, updated_at: hoursAgo(100) }),
        row({ id: "a", session_status: REQUIRES_ACTION, updated_at: hoursAgo(300) }),
      ],
      NOW,
    );
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("the third state — stopped, but it never said it needs anyone", () => {
  test("BLOCKED bucket with a non-REQUIRES_ACTION status is NAMED, not asserted as waiting", () => {
    const r = stale(
      [row({ status_bucket: "SESSION_STATUS_BUCKET_BLOCKED", session_status: "SESSION_STATUS_IDLE", updated_at: hoursAgo(113) })],
      NOW,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.reason).toBe("blocked-undeclared");
    // Dropping it silently would be the `dh4f` shape: a clean-looking report
    // over a session stopped for days.
    expect(render({ state: "checked", read: 1, findings: r })).toContain("CANNOT be told");
  });
});

describe("could-not-determine is never rendered as clean", () => {
  test("input that is not JSON is unknown, with a reason", () => {
    const r = readRows("{ not json");
    expect(r).toHaveProperty("because");
  });

  test("JSON with no session array is unknown rather than an empty result", () => {
    // The dangerous case: `{}` parses fine and would otherwise read as
    // "nothing waiting" over a listing that was never obtained.
    const r = readRows("{}");
    expect(r).toHaveProperty("because");
  });

  test("the unknown report says plainly that it is NOT a pass", () => {
    expect(render({ state: "unknown", because: "403" })).toContain("NOT a pass");
  });

  test("an empty listing is examined-nothing, not a pass", () => {
    expect(render({ state: "checked", read: 0, findings: [] })).toContain("EXAMINED NOTHING");
  });

  test("the shapes a listing actually arrives in all parse", () => {
    for (const text of ['[{"id":"a"}]', '{"sessions":[{"id":"a"}]}', '{"data":[{"id":"a"}]}', '{"ccr":{"data":[{"id":"a"}]}}']) {
      const r = readRows(text);
      expect(r).toHaveProperty("rows");
    }
  });
});

describe("a row this cannot date is skipped, never treated as fresh", () => {
  test("a missing timestamp is skipped", () => {
    expect(stale([row({ session_status: REQUIRES_ACTION, updated_at: undefined })], NOW)).toHaveLength(0);
  });

  test("an unparseable timestamp is skipped rather than read as now", () => {
    // Rounding it to "just updated" would hide exactly the abandoned session
    // this exists to find.
    expect(stale([row({ session_status: REQUIRES_ACTION, updated_at: "not a date" })], NOW)).toHaveLength(0);
  });
});

describe("repo attribution and filtering", () => {
  test("the repo comes from the session's declared source", () => {
    expect(repoOf(row())).toBe("litlfred/folio-assistant");
  });

  test("a session declaring no source is `unknown`, not blank", () => {
    expect(repoOf({ id: "x" })).toBe("unknown");
  });

  test("--repo narrows to one repository", () => {
    const rows = [
      row({ id: "keep", session_status: REQUIRES_ACTION, updated_at: hoursAgo(113) }),
      row({
        id: "drop",
        session_status: REQUIRES_ACTION,
        updated_at: hoursAgo(113),
        session_context: { sources: [{ git_repository: { url: "https://github.com/litlfred/qou" } }] },
      }),
    ];
    expect(stale(rows, NOW, "litlfred/folio-assistant").map((f) => f.id)).toEqual(["keep"]);
  });
});
