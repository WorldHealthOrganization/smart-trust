/**
 * `image-descriptions` is a QA finding, not a failed check (owner,
 * 2026-10-15: "make QA check"): unmet stays unmet in the verdict, and only
 * the other requirements set the exit code.
 */
import { describe, expect, test } from "bun:test";

import { blockingUnmet, QA_ONLY, type Requirement } from "../check-l1-complete.ts";

const req = (name: string, state: Requirement["state"]): Requirement => ({ name, state, detail: "" }) as Requirement;

describe("QA-only L1 requirements", () => {
  test("image-descriptions is QA-only, nothing else is", () => {
    expect([...QA_ONLY]).toEqual(["image-descriptions"]);
  });

  test("an unmet image-descriptions alone blocks nothing", () => {
    expect(blockingUnmet([req("structure", "met"), req("image-descriptions", "unmet")])).toEqual([]);
  });

  test("any other unmet requirement still blocks", () => {
    const b = blockingUnmet([req("image-descriptions", "unmet"), req("sections", "unmet"), req("blocks", "met")]);
    expect(b.map((q) => q.name)).toEqual(["sections"]);
  });
});
