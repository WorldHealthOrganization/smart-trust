/**
 * Retry with a falling-off rate — each wait doubles, with jitter.
 *
 * @module src/core/retry
 *
 * Owner, 2026-09-20: *"as rule, use logarithmic fall-off on all errors. core
 * best practice."* This is that rule as code, so every caller gets the same
 * shape instead of each one inventing a loop.
 *
 * ## What it does NOT retry, which is the part worth getting right
 *
 * A retry is for a **transient** failure. Retrying a definitive answer is not
 * caution — it spends four waits to reach the conclusion the first call
 * already gave, and it delays the honest report of it.
 *
 * | retried | not retried |
 * |---|---|
 * | the call threw (socket, DNS, timeout) | `400`, `401`, `404`, `422` — an answer |
 * | `5xx` — the far side is unwell | `403` **permission** — more tries will not grant it |
 * | `429`, and `Retry-After` is honoured | |
 *
 * `403` is the awkward one, because GitHub sends it for BOTH rate limiting and
 * permission. When the response carries `x-ratelimit-remaining: 0` it is a
 * rate limit and the reset can be an hour away — far past any backoff worth
 * running — so it is reported rather than hammered. Everything else is
 * permission and is final.
 *
 * ## Jitter is not decoration here
 *
 * This repository routinely has several agent sessions running at once — four
 * were pushing to `gh-pages` within ninety minutes on 2026-09-20 (bean
 * `bm6d`). Sessions that fail together and retry on the same doubling schedule
 * retry together, which is the thundering herd that keeps the far side down.
 * Each wait is multiplied by a random factor in `[0.5, 1.5)`.
 *
 * ## Exhausting the retries does not change the verdict
 *
 * When the last attempt still fails, the answer is **could not determine** —
 * the same third state it would have been without any retry at all. Backoff
 * makes that state rarer; it never converts it into a pass or a finding.
 */

/** Why a failure is worth another attempt, or is not. */
export type Transience = { retry: true; afterMs?: number } | { retry: false; reason: string };

/**
 * Should this HTTP response be retried?
 *
 * Exported because the classification IS the interesting logic — a test that
 * a permission `403` is final is worth more than one asserting a sleep.
 */
export function classifyResponse(status: number, headers?: { get(name: string): string | null }): Transience {
  if (status >= 200 && status < 300) return { retry: false, reason: "ok" };
  if (status === 429) {
    const after = Number(headers?.get("retry-after") ?? NaN);
    return { retry: true, ...(Number.isFinite(after) ? { afterMs: after * 1000 } : {}) };
  }
  if (status === 403) {
    // Rate limit and permission arrive with the same code. The remaining
    // counter tells them apart, and NEITHER is worth a short backoff: a reset
    // can be an hour out, and permission is not going to be granted.
    const remaining = headers?.get("x-ratelimit-remaining");
    return {
      retry: false,
      reason: remaining === "0" ? "rate limited — the reset is far past any backoff" : "forbidden",
    };
  }
  if (status >= 500) return { retry: true };
  return { retry: false, reason: `HTTP ${status}` };
}

/** The wait before attempt `n` (1-based), doubling from `baseMs`, jittered and capped. */
export function waitFor(attempt: number, baseMs = 1000, capMs = 16_000, rand = Math.random): number {
  const ideal = Math.min(baseMs * 2 ** (attempt - 1), capMs);
  return Math.round(ideal * (0.5 + rand()));
}

export interface BackoffOptions {
  /** Total attempts, including the first. Default 5 → waits of ~1s, 2s, 4s, 8s. */
  attempts?: number;
  baseMs?: number;
  capMs?: number;
  /** Called before each wait, so a caller can say what it is waiting on. */
  onRetry?: (attempt: number, waitMs: number, why: string) => void;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

const nap = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` with a falling-off retry rate.
 *
 * `fn` returns a value and says whether it is final. A thrown error is always
 * transient — a socket that dropped says nothing about whether the request
 * would succeed — while a *returned* result is final unless the caller marks
 * it otherwise. That asymmetry is deliberate: the caller knows what a 404
 * means for its own question, and this module does not.
 */
export async function withBackoff<T>(
  fn: (attempt: number) => Promise<{ value: T; transient?: Transience }>,
  opts: BackoffOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 5;
  const sleep = opts.sleep ?? nap;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let why = "";
    try {
      const { value, transient } = await fn(attempt);
      if (!transient || transient.retry === false) return value;
      if (attempt === attempts) return value;
      why = "transient failure";
      const wait = transient.afterMs ?? waitFor(attempt, opts.baseMs, opts.capMs, opts.rand);
      opts.onRetry?.(attempt, wait, why);
      await sleep(wait);
      continue;
    } catch (e) {
      lastError = e;
      if (attempt === attempts) break;
      why = e instanceof Error ? e.message : String(e);
      const wait = waitFor(attempt, opts.baseMs, opts.capMs, opts.rand);
      opts.onRetry?.(attempt, wait, why);
      await sleep(wait);
    }
  }
  throw lastError;
}
