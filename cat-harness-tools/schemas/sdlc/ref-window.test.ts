/**
 * A ref window's reason to exist is that a HANDOVER must not double-push, so
 * the tests that matter are the ones about a window nobody is holding any more:
 * `expires` present, `handoff` present, and an absent `closedAt` never readable
 * as "still collecting".
 *
 * Bean `xp5j`.
 */
import { describe, expect, test } from "bun:test";
import {
  FORBIDDEN_REF_FACT_KEYS,
  REF_WINDOW_TAG,
  RefWindowSchema,
  SHARED_LEASE_FIELDS,
  WriteRequestSchema,
} from "./ref-window.ts";
import { HoldSchema } from "./merge-queue.ts";

const OPEN = {
  $schema: REF_WINDOW_TAG,
  ref: "gh-pages",
  heldBy: "https://claude.ai/code/session_01GgRQnL9LTo1Hf6QWSB7w9n",
  since: "2026-10-04T07:00:00Z",
  expires: "2026-10-04T07:05:00Z",
  handoff: "the next merge-steward session; re-derive the open requests from the ref",
  requests: [
    { route: "/", requestedBy: ".github/workflows/docs-site.yml", requestedAt: "2026-10-04T07:00:10Z" },
  ],
};

describe("a window is a lease, so it must expire", () => {
  test("a well-formed open window parses", () => {
    expect(RefWindowSchema.safeParse(OPEN).success).toBe(true);
  });

  test("`expires` is REQUIRED — without it, abandoned and open are the same", () => {
    const { expires: _expires, ...noExpiry } = OPEN;
    expect(RefWindowSchema.safeParse(noExpiry).success).toBe(false);
  });

  test("`handoff` is REQUIRED — it is the whole handover answer", () => {
    const { handoff: _handoff, ...noHandoff } = OPEN;
    expect(RefWindowSchema.safeParse(noHandoff).success).toBe(false);
  });

  test("a window cannot expire before it opens", () => {
    const r = RefWindowSchema.safeParse({ ...OPEN, expires: "2026-10-04T06:59:00Z" });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain("must expire after it opens");
  });

  test("a window cannot close before it opened", () => {
    const r = RefWindowSchema.safeParse({ ...OPEN, closedAt: "2026-10-04T06:00:00Z" });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain("cannot close before it opened");
  });

  test("there is NO extend: a window that extends on every arrival never closes", () => {
    // The object is strict, so the field a well-meaning writer would add is
    // refused rather than ignored. This is the test that makes "set once at
    // open" a property of the type instead of a docblock promise.
    for (const k of ["extend", "extendedAt", "extendTo", "deadline"]) {
      expect(RefWindowSchema.safeParse({ ...OPEN, [k]: "2026-10-04T07:10:00Z" }).success).toBe(false);
    }
  });
});

describe("decisions are stored; the host's facts are not", () => {
  test("every forbidden key is refused BY NAME, with the rule as the message", () => {
    expect(FORBIDDEN_REF_FACT_KEYS.length).toBeGreaterThan(0);
    for (const key of FORBIDDEN_REF_FACT_KEYS) {
      const r = RefWindowSchema.safeParse({ ...OPEN, [key]: "whatever" });
      expect(r.success).toBe(false);
      if (!r.success) {
        const msg = JSON.stringify(r.error.issues);
        expect(msg).toContain(key);
        expect(msg).toContain("stores DECISIONS only");
      }
    }
  });

  test("the published-ref specific ones are present, which is what xom7 is about", () => {
    // Whether a publish SUCCEEDED is a judgement read live. A workflow here
    // failed 30 times while reporting its own exit code (bean `xom7`), so a
    // carried-forward conclusion is the exact field that must not exist.
    for (const k of ["deploymentState", "conclusion", "live", "siteAsOf"]) {
      expect(FORBIDDEN_REF_FACT_KEYS as readonly string[]).toContain(k);
    }
  });
});

describe("a watched ref is a declared one", () => {
  test("a feature branch is refused — it has one writer and needs no steward", () => {
    expect(RefWindowSchema.safeParse({ ...OPEN, ref: "claude/xp5j-ref-steward" }).success).toBe(false);
  });

  test("a full refname is refused; the declaration spells an id or a name", () => {
    expect(RefWindowSchema.safeParse({ ...OPEN, ref: "refs/heads/gh-pages" }).success).toBe(false);
  });

  test("both spellings the declaration carries are accepted", () => {
    for (const ref of ["gh-pages", "cat/cat-harness/beans", "beans"]) {
      expect(RefWindowSchema.safeParse({ ...OPEN, ref }).success).toBe(true);
    }
  });
});

describe("a write request names a route and an author, never content", () => {
  test("`authored` defaults to false, because a route-keyed store is regenerable", () => {
    const r = WriteRequestSchema.parse({
      route: "STAGING/claude-foo/",
      requestedBy: ".github/workflows/feature-staging.yml",
      requestedAt: "2026-10-04T07:01:00Z",
    });
    expect(r.authored).toBe(false);
  });

  test("it carries no content field — the tree is the answer to what was written", () => {
    for (const k of ["content", "body", "tree", "files", "blob"]) {
      expect(
        WriteRequestSchema.safeParse({
          route: "/",
          requestedBy: "x",
          requestedAt: "2026-10-04T07:01:00Z",
          [k]: "...",
        }).success,
      ).toBe(false);
    }
  });

  test("two same-route AUTHORED requests are representable, so they can be REPORTED", () => {
    // The discrimination the composition rule exists for. "Newer wins" is
    // right for a regenerated page and wrong for authored content; if the type
    // could not express the second case the steward could not detect it.
    const w = RefWindowSchema.safeParse({
      ...OPEN,
      requests: [
        { route: "/", requestedBy: "a", requestedAt: "2026-10-04T07:01:00Z", authored: true },
        { route: "/", requestedBy: "b", requestedAt: "2026-10-04T07:02:00Z", authored: true },
      ],
    });
    expect(w.success).toBe(true);
    if (w.success) {
      const authoredSameRoute = w.data.requests.filter((r) => r.authored && r.route === "/");
      expect(authoredSameRoute.length).toBe(2);
    }
  });
});

describe("the lease fields stay spelled the same as the hold's", () => {
  // Read BOTH schemas through their own parse, never through zod's internals.
  // Removing a shared field must be refused by each of them; that is what
  // "the same three fields" means operationally, and it cannot go stale
  // against a zod upgrade the way a key-list comparison did.
  const HOLD_SAMPLE = {
    waitsOn: "gh-pages is mid-burst",
    since: "2026-10-04T07:00:00Z",
    expires: "2026-10-04T07:05:00Z",
    handoff: "the next merge-steward session",
  };

  test("both samples are valid to begin with, or every assertion below is vacuous", () => {
    expect(HoldSchema.safeParse(HOLD_SAMPLE).success).toBe(true);
    expect(RefWindowSchema.safeParse(OPEN).success).toBe(true);
  });

  test.each([...SHARED_LEASE_FIELDS])("both refuse a window/hold missing `%s`", (field) => {
    const hold: Record<string, unknown> = { ...HOLD_SAMPLE };
    delete hold[field];
    expect(HoldSchema.safeParse(hold).success).toBe(false);

    const win: Record<string, unknown> = { ...OPEN };
    delete win[field];
    expect(RefWindowSchema.safeParse(win).success).toBe(false);
  });

  test("`waitsOn` is deliberately NOT shared — it is narrowed to `ref`", () => {
    expect(SHARED_LEASE_FIELDS as readonly string[]).not.toContain("waitsOn");
    // The hold requires it...
    const { waitsOn: _waitsOn, ...noWaitsOn } = HOLD_SAMPLE;
    expect(HoldSchema.safeParse(noWaitsOn).success).toBe(false);
    // ...and the window refuses it, because `ref` is the typed answer.
    expect(RefWindowSchema.safeParse({ ...OPEN, waitsOn: "gh-pages" }).success).toBe(false);
  });
});
