/**
 * `staging-record` — what the deploy writes, and what the cleanup retires.
 *
 * @module scripts/tests/staging-record.test
 *
 * The decision logic is pure (`createOrUpdate`), so the interesting cases are
 * testable without a workflow: what a re-deploy does to an existing record,
 * and what it refuses to do to a retired one.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createStagingPreview,
  retireStagingPreview,
  serializeStagingPreview,
  type StagingDeployFacts,
} from "../../../schemas/sdlc/staging-preview.ts";
import { createOrUpdate, loadExisting } from "../../staging-record.ts";

const FACTS: StagingDeployFacts = {
  slug: "claude-sleepy-babbage-ls90iz",
  branch: "claude/sleepy-babbage-ls90iz",
  commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  pr: 459,
  issue: 223,
  builtAt: "2026-09-20T05:00:00Z",
  host: "https://litlfred.github.io/folio-assistant",
};

describe("createOrUpdate — the first deploy", () => {
  test("creates a record carrying what only the deploy knows", () => {
    const o = createOrUpdate(undefined, FACTS);
    expect(o.action).toBe("created");
    if (o.action === "refused-retired") throw new Error("unexpected refusal");
    expect(o.node.staging.pr).toBe(459);
    expect(o.node.staging.issue).toBe(223);
  });
});

describe("createOrUpdate — `synchronize` fires on every push", () => {
  test("the head commit is updated, because that legitimately changes", () => {
    const first = createStagingPreview(FACTS);
    const o = createOrUpdate(first, { ...FACTS, commit: "b".repeat(40), builtAt: "2026-09-20T06:00:00Z" });
    if (o.action === "refused-retired") throw new Error("unexpected refusal");
    expect(o.action).toBe("updated");
    expect(o.node.staging.commit).toBe("b".repeat(40));
  });

  test("builtAt does NOT walk forward — it answers when the preview first appeared", () => {
    const first = createStagingPreview(FACTS);
    const o = createOrUpdate(first, { ...FACTS, commit: "b".repeat(40), builtAt: "2026-09-20T06:00:00Z" });
    if (o.action === "refused-retired") throw new Error("unexpected refusal");
    expect(o.node.staging.builtAt).toBe("2026-09-20T05:00:00Z");
  });

  test("running it many times is stable after the first update", () => {
    let node = createStagingPreview(FACTS);
    for (let i = 0; i < 5; i++) {
      const o = createOrUpdate(node, { ...FACTS, commit: "c".repeat(40), builtAt: "2026-09-20T09:00:00Z" });
      if (o.action === "refused-retired") throw new Error("unexpected refusal");
      node = o.node;
    }
    expect(node.staging.commit).toBe("c".repeat(40));
    expect(node.staging.builtAt).toBe("2026-09-20T05:00:00Z");
  });
});

describe("createOrUpdate — a retired record is not resurrected", () => {
  // Bean `w2g5`: a session reusing one branch across five successive pull
  // requests spends much of its life in the gap between closed and reopened.
  // A deploy that overwrote the retired record as live would erase `retiredOn`
  // — the one field somebody consults it for once the preview is gone.

  test("refuses, rather than overwriting it as live", () => {
    const retired = retireStagingPreview(createStagingPreview(FACTS), "PR #459 merged", "2026-09-20T07:00:00Z");
    const o = createOrUpdate(retired, FACTS);
    expect(o.action).toBe("refused-retired");
  });

  test("the refusal names when it was retired and why", () => {
    const retired = retireStagingPreview(createStagingPreview(FACTS), "PR #459 merged", "2026-09-20T07:00:00Z");
    const o = createOrUpdate(retired, FACTS);
    if (o.action !== "refused-retired") throw new Error("expected a refusal");
    expect(o.why).toContain("2026-09-20T07:00:00Z");
    expect(o.why).toContain("PR #459 merged");
  });
});

describe("loadExisting", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "staging-record-"));

  test("absent is undefined, not an error — a first deploy has no record", () => {
    expect(loadExisting(join(dir(), "none.json"))).toBeUndefined();
  });

  test("a well-formed record round-trips", () => {
    const p = join(dir(), "r.json");
    writeFileSync(p, serializeStagingPreview(createStagingPreview(FACTS)));
    expect(loadExisting(p)?.staging.pr).toBe(459);
  });

  test("a corrupt record THROWS rather than being treated as absent", () => {
    // Treating it as absent would silently replace whatever it was trying to
    // say. Same reason readFshGutsNode returns a reason rather than nothing:
    // "not a record" and "a record that will not parse" want different
    // responses, and the second must never be reported as a clean skip.
    const p = join(dir(), "bad.json");
    writeFileSync(p, '{"$schema":"folio-fsh-guts/v1","title":"t","kind":"staging-preview"}');
    expect(() => loadExisting(p)).toThrow(/not a staging-preview record/);
  });

  test("a file of another kind also throws, naming that kind", () => {
    const p = join(dir(), "other.json");
    writeFileSync(p, '{"$schema":"folio-fsh-guts/v1","title":"t","kind":"proposal"}');
    expect(() => loadExisting(p)).toThrow(/proposal/);
  });
});
