/**
 * What a kg-audit rewrite of a sidecar must keep: the judgements it did not
 * compute.
 *
 * @module cat-harness-tools/scripts/lib/kg-qa-carry
 */
import { existsSync, readFileSync } from "node:fs";

import type { KgQaReport } from "../../schemas/sdlc/kg-qa.js";

/**
 * `r`, carrying forward the `adversarial_reviews` the sidecar at `path`
 * already holds (owner, 2026-10-14). They are AGENT judgements, recorded by
 * `adversarial-backfill` or a reviewer, never computed here, so a rewrite
 * that dropped them lost them: the 3c604106 regeneration did exactly that to
 * every lvlv review. A report that brings reviews of its own keeps those; an
 * unreadable prior is left to the caller's other guards, never guessed at.
 */
import { quietly } from "../../schemas/sdlc/input-trace.ts";
import { readQa } from "../qa-store.ts";

export function withPriorAdversarialReviews(r: KgQaReport, path: string): KgQaReport {
  if ((r.adversarial_reviews ?? []).length > 0) return r;
  let text: string | undefined;
  if (existsSync(path)) {
    try {
      text = readFileSync(path, "utf-8");
    } catch {
      return r;
    }
  } else {
    try {
      const hit = quietly(() => readQa("main", path, { log: () => {} }));
      if (hit.state === "hit") text = hit.text;
    } catch {
      return r;
    }
  }
  if (!text) return r;
  let prior: unknown;
  try {
    prior = (JSON.parse(text) as { adversarial_reviews?: unknown }).adversarial_reviews;
  } catch {
    return r;
  }
  return Array.isArray(prior) && prior.length > 0 ? { ...r, adversarial_reviews: prior as KgQaReport["adversarial_reviews"] } : r;
}
