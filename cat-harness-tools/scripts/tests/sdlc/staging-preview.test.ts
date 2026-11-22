/**
 * `staging-preview` — the node type's own behaviour.
 *
 * @module scripts/tests/staging-preview.test
 *
 * Two groups, and the second is the point. The first exercises creation,
 * enrichment and retirement. The second PINS the two measured facts about the
 * trashcan that forced this module's shape — a flat front-matter parser and a
 * key-stripping base schema — so that if either is ever fixed, a test says so
 * out loud rather than leaving a workaround in place that nobody can date.
 */

import { describe, expect, test } from "bun:test";

import { FshGutsNodeSchema, readFshGutsNode, FSH_GUTS_SCHEMA_ID } from "../../../schemas/kg/fsh-guts.ts";
import { parseFrontMatter } from "../../../schemas/kg/front-matter.ts";
import {
  STAGING_PREVIEW_KIND,
  createStagingPreview,
  enrichStagingPreview,
  isRetired,
  readStagingPreview,
  retireStagingPreview,
  serializeStagingPreview,
  type StagingDeployFacts,
} from "../../../schemas/sdlc/staging-preview.ts";

const DEPLOY: StagingDeployFacts = {
  slug: "claude-sleepy-babbage-ls90iz",
  branch: "claude/sleepy-babbage-ls90iz",
  commit: "20c45eb9cd2e92f7f59f2be4c6edec5e406d5fcb",
  pr: 435,
  issue: 223,
  builtAt: "2026-09-19T15:52:48Z",
  host: "https://litlfred.github.io/folio-assistant",
};

describe("createStagingPreview", () => {
  test("is a valid fsh-guts node, so generic trashcan readers keep working", () => {
    const node = createStagingPreview(DEPLOY);
    expect(FshGutsNodeSchema.safeParse(node).success).toBe(true);
    expect(node.$schema).toBe(FSH_GUTS_SCHEMA_ID);
    expect(node.kind).toBe(STAGING_PREVIEW_KIND);
  });

  test("carries the facts only the deploy knows", () => {
    const node = createStagingPreview(DEPLOY);
    expect(node.staging.pr).toBe(435);
    expect(node.staging.issue).toBe(223);
    expect(node.staging.branch).toBe("claude/sleepy-babbage-ls90iz");
  });

  test("movedFrom is the URL it was served from, when the host is known", () => {
    const node = createStagingPreview(DEPLOY);
    expect(node.movedFrom).toBe(
      "https://litlfred.github.io/folio-assistant/branches/claude-sleepy-babbage-ls90iz/",
    );
  });

  test("a deploy that cannot determine its host says nothing rather than guessing gh-pages", () => {
    const { host: _host, ...noHost } = DEPLOY;
    const node = createStagingPreview(noHost);
    expect(node.movedFrom).toBeUndefined();
  });

  test("no observation until a sweep has looked", () => {
    expect(createStagingPreview(DEPLOY).staging.observed).toBeUndefined();
  });
});

describe("enrichStagingPreview", () => {
  const observed = {
    bytes: 39_845_112,
    files: 612,
    liveness: "live" as const,
    signals: ["open-pr"],
    observedAt: "2026-09-19T16:00:00Z",
  };

  test("adds what only the sweep can measure, keeping the deploy facts", () => {
    const node = enrichStagingPreview(createStagingPreview(DEPLOY), observed);
    expect(node.staging.observed?.bytes).toBe(39_845_112);
    expect(node.staging.pr).toBe(435);
  });

  test("does not mutate its input", () => {
    const before = createStagingPreview(DEPLOY);
    enrichStagingPreview(before, observed);
    expect(before.staging.observed).toBeUndefined();
  });

  test("a later sweep replaces the earlier observation — a stale size is not evidence", () => {
    const first = enrichStagingPreview(createStagingPreview(DEPLOY), observed);
    const second = enrichStagingPreview(first, { ...observed, bytes: 1, observedAt: "2026-09-20T16:00:00Z" });
    expect(second.staging.observed?.bytes).toBe(1);
    expect(second.staging.observed?.observedAt).toBe("2026-09-20T16:00:00Z");
  });

  test("liveness keeps its third state — `unknown` is not collapsed into dead", () => {
    const node = enrichStagingPreview(createStagingPreview(DEPLOY), { ...observed, liveness: "unknown" });
    expect(node.staging.observed?.liveness).toBe("unknown");
  });
});

describe("retireStagingPreview", () => {
  test("retirement is a state, not a deletion — the record survives it", () => {
    const node = retireStagingPreview(createStagingPreview(DEPLOY), "PR #435 merged", "2026-09-20T09:00:00Z");
    expect(isRetired(node)).toBe(true);
    expect(node.staging.slug).toBe(DEPLOY.slug);
    expect(node.staging.pr).toBe(435);
  });

  test("a retired record still says what the preview was for", () => {
    const node = retireStagingPreview(createStagingPreview(DEPLOY), "PR #435 merged", "2026-09-20T09:00:00Z");
    expect(node.summary).toContain("claude/sleepy-babbage-ls90iz");
    expect(node.staging.retiredReason).toBe("PR #435 merged");
  });

  test("idempotent — a cleanup that runs twice cannot rewrite when the preview went", () => {
    const once = retireStagingPreview(createStagingPreview(DEPLOY), "PR merged", "2026-09-20T09:00:00Z");
    const twice = retireStagingPreview(once, "something else", "2026-09-21T09:00:00Z");
    expect(twice.staging.retiredOn).toBe("2026-09-20T09:00:00Z");
    expect(twice.staging.retiredReason).toBe("PR merged");
  });

  test("refuses a retirement with no reason, naming the slug", () => {
    expect(() => retireStagingPreview(createStagingPreview(DEPLOY), "   ", "2026-09-20T09:00:00Z")).toThrow(
      /claude-sleepy-babbage-ls90iz/,
    );
  });
});

describe("round trip", () => {
  test("serialize then read returns the same node", () => {
    const node = enrichStagingPreview(createStagingPreview(DEPLOY), {
      bytes: 10,
      files: 2,
      liveness: "dead",
      observedAt: "2026-09-19T16:00:00Z",
    });
    const back = readStagingPreview(serializeStagingPreview(node));
    expect(back.node).toEqual(node);
  });

  test("a node of another kind is refused with a reason naming that kind", () => {
    const other = JSON.stringify({ $schema: FSH_GUTS_SCHEMA_ID, title: "t", kind: "proposal" });
    const r = readStagingPreview(other);
    if (r.node !== undefined) throw new Error("expected a refusal, got a node");
    expect(r.reason).toContain("proposal");
  });

  test("a malformed staging block is a defect, not a clean skip", () => {
    const bad = JSON.stringify({
      $schema: FSH_GUTS_SCHEMA_ID,
      title: "t",
      kind: STAGING_PREVIEW_KIND,
      staging: { slug: "s" },
    });
    const r = readStagingPreview(bad);
    if (r.node !== undefined) throw new Error("expected a refusal, got a node");
    expect(r.reason).toContain("does not satisfy it");
  });

  test("non-JSON is refused rather than throwing", () => {
    expect(readStagingPreview("---\ntitle: hi\n---\n").node).toBeUndefined();
  });
});

describe("the trashcan constraints — one fixed, one still real", () => {
  // These were PINNED as failing-by-design constraints when this module
  // shipped, on the stated grounds that a silent fix leaves a detour nobody
  // can date. On 2026-09-20 the first one was fixed and these tests failed,
  // which is exactly what they were written to do. They are rewritten here
  // rather than deleted, so the next reader sees which limit went and which
  // did not.

  test("FIXED — the base schema no longer strips a kind's own fields", () => {
    // `FshGutsNodeSchema` gained `.passthrough()`: `kind` is open, so the
    // field set could not stay closed. Before this, `staging` came back
    // `undefined` and this module needed its own reader to see it at all.
    const parsed = FshGutsNodeSchema.parse({
      $schema: FSH_GUTS_SCHEMA_ID,
      title: "t",
      kind: STAGING_PREVIEW_KIND,
      staging: { slug: "s" },
    });
    expect((parsed as Record<string, unknown>)["staging"]).toEqual({ slug: "s" });
  });

  test("STILL TRUE — front matter is FLAT, so a nested block does not survive it", () => {
    // Unchanged, and it is why the record is JSON rather than markdown. A
    // nested `staging:` still parses to `[]`, before any schema sees it.
    const { fm } = parseFrontMatter(
      `---\n$schema: ${FSH_GUTS_SCHEMA_ID}\ntitle: "t"\nkind: ${STAGING_PREVIEW_KIND}\nstaging:\n  slug: s\n---\n\nbody\n`,
    );
    expect(fm["staging"]).toEqual([]);
    expect(fm["slug"]).toBeUndefined();
  });

  test("so the markdown carrier still cannot hold the staging facts", () => {
    // The block now survives the SCHEMA and is still destroyed by the
    // PARSER — it arrives as the empty array the flat parser produced, not
    // as the object anybody wrote. Passing the schema is not the same as
    // carrying the data, and a `staging` that reads `[]` is worse than one
    // that is absent, because it looks like an answer.
    const md = `---\n$schema: ${FSH_GUTS_SCHEMA_ID}\ntitle: "t"\nkind: ${STAGING_PREVIEW_KIND}\nstaging:\n  slug: s\n---\n\nbody\n`;
    const r = readFshGutsNode(md);
    expect(r.node).toBeDefined();
    expect((r.node as Record<string, unknown> | undefined)?.["staging"]).toEqual([]);
  });
});

describe("a staging-preview record now reaches the published document", () => {
  // This is what bean 6pfo was blocked on. The node type shipped first with
  // its own reader, because the trashcan stripped its fields; those two
  // limits are now fixed in schemas/kg/fsh-guts.ts, so the generic path works
  // and this module's reader is a convenience rather than a workaround.

  test("the trashcan's own reader keeps the staging block", () => {
    const node = createStagingPreview(DEPLOY);
    const r = readFshGutsNode(serializeStagingPreview(node));
    expect(r.node).toBeDefined();
    const staging = (r.node as Record<string, unknown> | undefined)?.["staging"] as
      | Record<string, unknown>
      | undefined;
    expect(staging?.["pr"]).toBe(435);
    expect(staging?.["slug"]).toBe(DEPLOY.slug);
  });

  test("an enriched record round-trips through it too, liveness and all", () => {
    const node = enrichStagingPreview(createStagingPreview(DEPLOY), {
      bytes: 39_845_112,
      files: 612,
      liveness: "unknown",
      observedAt: "2026-09-20T04:00:00Z",
    });
    const r = readFshGutsNode(serializeStagingPreview(node));
    const staging = (r.node as Record<string, unknown> | undefined)?.["staging"] as
      | Record<string, unknown>
      | undefined;
    const observed = staging?.["observed"] as Record<string, unknown> | undefined;
    expect(observed?.["liveness"]).toBe("unknown");
    expect(observed?.["bytes"]).toBe(39_845_112);
  });

  test("a retired record survives the round trip — retirement is a state, not a deletion", () => {
    const node = retireStagingPreview(
      createStagingPreview(DEPLOY),
      "PR #435 merged",
      "2026-09-20T03:10:00Z",
    );
    const r = readFshGutsNode(serializeStagingPreview(node));
    const staging = (r.node as Record<string, unknown> | undefined)?.["staging"] as
      | Record<string, unknown>
      | undefined;
    expect(staging?.["retiredReason"]).toBe("PR #435 merged");
    expect(staging?.["slug"]).toBe(DEPLOY.slug);
  });
});
