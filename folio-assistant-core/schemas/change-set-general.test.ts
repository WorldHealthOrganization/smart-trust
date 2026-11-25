/**
 * The Change Set made general (issue #971, bean `bnjs`): a change to any
 * folio, answering public comments or not, carrying what it does to each
 * rendered site.
 */
import { describe, expect, test } from "bun:test";

import { RENDERED_IMPACT_TAG } from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.js";
import { CHANGE_SET_SCHEMA, ChangeSetSchema } from "./public-comment.js";

const base = {
  $schema: CHANGE_SET_SCHEMA,
  id: "CS-001",
  title: "Extend the BCG catch-up window",
  requirements: "The schedule's trigger allows a catch-up dose up to 12 months of age.",
  proposedBy: "litlfred",
  proposedAt: "2026-10-06",
};

describe("ChangeSet, general", () => {
  test("noCommentValidRefsDefaultEmpty", () => {
    const r = ChangeSetSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.refs).toEqual([]);
  });

  test("publicCommentChangeSetUnchanged", () => {
    expect(ChangeSetSchema.safeParse({ ...base, refs: ["PC-0042"] }).success).toBe(true);
    expect(ChangeSetSchema.safeParse({ ...base, refs: ["not-a-ref"] }).success).toBe(false);
  });

  test("carriesRenderedImpact", () => {
    const rendered = [{
      $schema: RENDERED_IMPACT_TAG,
      renderer: "fhir-ig-pages",
      method: "cone",
      inputs: ["input/fsh/plan.fsh"],
      files: [{ path: "ast/artifact/PlanDefinition-Sched.html", change: "changed", role: "content", via: ["input/fsh/plan.fsh"] }],
      undetermined: [],
    }];
    expect(ChangeSetSchema.safeParse({ ...base, pr: { number: 7, branch: "cs-001" }, status: "editing", rendered }).success).toBe(true);
    expect(ChangeSetSchema.safeParse({ ...base, rendered: [{ ...rendered[0], files: [{ path: "x", change: "edited", role: "content" }] }] }).success).toBe(false);
  });
});
