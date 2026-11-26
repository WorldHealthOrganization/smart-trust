/**
 * A kg-audit rewrite keeps the adversarial reviews it did not compute (owner,
 * 2026-10-14). The 3c604106 regeneration dropped every lvlv review because the
 * writer serialised only what it had just computed.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { KgQaReport } from "../../../schemas/sdlc/kg-qa.js";
import { withPriorAdversarialReviews } from "../../lib/kg-qa-carry.ts";

const DIR = mkdtempSync(join(tmpdir(), "kg-qa-carry-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const review = { reviewer: { by: "agent", session: "s", model: "m" }, at: "2026-10-09T00:00:00Z", result: "pass" };
const fresh = (over: Partial<KgQaReport> = {}) =>
  ({ $schema: "kg-qa/v1", subject: { kind: "tool", id: "gates", path: null }, source_hash: "abc", criteria: {}, totals: { pass: 0, fail: 0, "n/a": 0, unknown: 0 }, ...over }) as unknown as KgQaReport;
const put = (name: string, body: unknown) => {
  const p = join(DIR, name);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
  return p;
};

describe("withPriorAdversarialReviews", () => {
  test("a rewrite keeps the reviews the prior sidecar holds", () => {
    const p = put("a.kg-qa.json", { ...fresh(), adversarial_reviews: [review] });
    expect(withPriorAdversarialReviews(fresh(), p).adversarial_reviews).toEqual([review] as never);
  });

  test("a report that brings its own reviews keeps them", () => {
    const p = put("b.kg-qa.json", { ...fresh(), adversarial_reviews: [review] });
    const own = [{ ...review, session: "t" }];
    expect(withPriorAdversarialReviews(fresh({ adversarial_reviews: own as never }), p).adversarial_reviews).toEqual(own as never);
  });

  test("no prior, an empty prior, or an unreadable one: the report is unchanged", () => {
    const r = fresh();
    expect(withPriorAdversarialReviews(r, join(DIR, "absent.kg-qa.json"))).toBe(r);
    expect(withPriorAdversarialReviews(r, put("c.kg-qa.json", { ...fresh(), adversarial_reviews: [] }))).toBe(r);
    expect(withPriorAdversarialReviews(r, put("d.kg-qa.json", "{ not json"))).toBe(r);
  });
});
