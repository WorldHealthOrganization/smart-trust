/**
 * A falling-off retry rate — and what must NOT be retried.
 *
 * @module scripts/tests/retry
 *
 * Owner, 2026-09-20: *"as rule, use logarithmic fall-off on all errors. core
 * best practice."*
 *
 * The property worth pinning is not "it sleeps". It is that **a definitive
 * answer is not retried**: spending four waits to re-reach a 404 is not
 * caution, it delays the honest report by fifteen seconds and tells the
 * reader nothing new.
 */
import { describe, expect, test } from "bun:test";

import { classifyResponse, waitFor, withBackoff } from "../../src/core/retry.js";

const FAST = { attempts: 4, sleep: async () => {} };
const headers = (h: Record<string, string> = {}) => new Headers(h);

describe("what is transient, and what is an answer", () => {
  test("2xx is not retried — there is nothing wrong", () => {
    expect(classifyResponse(200, headers()).retry).toBe(false);
  });

  test("5xx IS retried — the far side is unwell, the question stands", () => {
    expect(classifyResponse(503, headers()).retry).toBe(true);
  });

  test("404 is NOT retried — it is the answer", () => {
    const c = classifyResponse(404, headers());
    expect([c.retry, c.retry === false && c.reason]).toEqual([false, "HTTP 404"]);
  });

  test("429 is retried, and `Retry-After` is honoured over the doubling", () => {
    const c = classifyResponse(429, headers({ "retry-after": "7" }));
    expect(c).toEqual({ retry: true, afterMs: 7000 });
  });

  test("429 with no `Retry-After` still retries, on the normal schedule", () => {
    expect(classifyResponse(429, headers())).toEqual({ retry: true });
  });

  describe("403 is the awkward one — it means two different things", () => {
    test("rate limiting is NOT hammered: the reset outlives any backoff", () => {
      const c = classifyResponse(403, headers({ "x-ratelimit-remaining": "0" }));
      expect([c.retry, c.retry === false && c.reason]).toEqual([false, "rate limited — the reset is far past any backoff"]);
    });

    test("permission is final — more tries will not grant it", () => {
      const c = classifyResponse(403, headers({ "x-ratelimit-remaining": "4999" }));
      expect([c.retry, c.retry === false && c.reason]).toEqual([false, "forbidden"]);
    });
  });
});

describe("the waits fall off, and are jittered", () => {
  test("each ideal wait doubles from the base", () => {
    const mid = () => 0.5; // jitter factor exactly 1.0
    expect([1, 2, 3, 4].map((n) => waitFor(n, 1000, 16_000, mid))).toEqual([1000, 2000, 4000, 8000]);
  });

  test("the cap holds — a long run does not wait forever", () => {
    expect(waitFor(10, 1000, 16_000, () => 0.5)).toBe(16_000);
  });

  test("jitter spreads the wait either side of the ideal", () => {
    // Several agent sessions run here at once (four inside 90 minutes on
    // 2026-09-20, bean `bm6d`). Failing together and retrying in lockstep is
    // the thundering herd that keeps the far side down.
    expect(waitFor(1, 1000, 16_000, () => 0)).toBe(500);
    expect(waitFor(1, 1000, 16_000, () => 0.999)).toBe(1499); // 0.5 + 0.999 = 1.499x
  });
});

describe("the loop", () => {
  test("a transient result is retried up to `attempts`, then RETURNED as-is", async () => {
    // Not thrown. The caller asked a question and gets the last answer, which
    // it then reports as could-not-determine — exhausting retries does not
    // convert the third state into an answer.
    let n = 0;
    const v = await withBackoff(async () => {
      n += 1;
      return { value: `try-${n}`, transient: { retry: true as const } };
    }, FAST);
    expect([n, v]).toEqual([4, "try-4"]);
  });

  test("a FINAL result returns on the first attempt", async () => {
    let n = 0;
    const v = await withBackoff(async () => {
      n += 1;
      return { value: "done", transient: { retry: false as const, reason: "ok" } };
    }, FAST);
    expect([n, v]).toEqual([1, "done"]);
  });

  test("a throw is retried, and the LAST error escapes", async () => {
    let n = 0;
    const p = withBackoff(async () => {
      n += 1;
      throw new Error(`boom ${n}`);
    }, FAST);
    await expect(p).rejects.toThrow("boom 4");
    expect(n).toBe(4);
  });

  test("a throw that then SUCCEEDS returns the success", async () => {
    let n = 0;
    const v = await withBackoff(async () => {
      n += 1;
      if (n < 3) throw new Error("not yet");
      return { value: "recovered" };
    }, FAST);
    expect([n, v]).toEqual([3, "recovered"]);
  });

  test("`onRetry` is told the attempt, the wait and why — so a caller can say what it waits on", async () => {
    const seen: string[] = [];
    await withBackoff(async () => ({ value: 1, transient: { retry: true as const } }), {
      ...FAST,
      attempts: 3,
      onRetry: (a, ms, why) => seen.push(`${a}:${ms > 0}:${why}`),
    });
    expect(seen).toEqual(["1:true:transient failure", "2:true:transient failure"]);
  });

  test("`Retry-After` overrides the doubling when the far side named a delay", async () => {
    const waits: number[] = [];
    await withBackoff(async () => ({ value: 0, transient: { retry: true as const, afterMs: 1234 } }), {
      attempts: 2,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(waits).toEqual([1234]);
  });
});
