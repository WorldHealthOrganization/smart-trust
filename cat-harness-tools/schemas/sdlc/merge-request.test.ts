/**
 * The six-line merge request a sibling sends the merge manager (owner,
 * 2026-11-07). One test per line it must carry, plus the round trip.
 */
import { describe, expect, test } from "bun:test";
import { formatMergeRequest, MergeRequestSchema, parseMergeRequest, type MergeRequest } from "./merge-queue";

const sha = "4fcd153bb4c870366d340da07738f358bde031a3";
const good: MergeRequest = {
  prUrl: "https://github.com/litlfred/cat-harness/pull/1113",
  headSha: sha,
  sessionUrl: "https://claude.ai/code/session_01VQDpPc2tT1vUufdyDbQTBz",
  changes: "Writes the merge manager rulings into the skills. Adds a gateway to the watch loop.",
  preview: { kind: "url", url: "https://litlfred.github.io/folio-assistant/branches/x/" },
  lookFor: "the new gateway on the merge-manager-watch diagram",
  fullTierGreen: true,
};

describe("merge request", () => {
  test("a complete request round-trips through its six lines", () => {
    const text = formatMergeRequest(good);
    expect(text.split("\n")).toHaveLength(6);
    const parsed = parseMergeRequest(text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(good);
  });

  test("no preview is accepted only with a reason", () => {
    const none = { ...good, preview: { kind: "none" as const, reason: "docs-only change in a layer with no site" }, lookFor: undefined };
    expect(parseMergeRequest(formatMergeRequest(none)).success).toBe(true);
    expect(parseMergeRequest(formatMergeRequest(none).replace(/no preview: .*/, "no preview: ")).success).toBe(false);
  });

  test("a request with neither a preview nor a reason goes back", () => {
    const text = formatMergeRequest(good).split("\n").filter((l) => !l.startsWith("preview:")).join("\n");
    const r = parseMergeRequest(text);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("preview");
  });

  test("a preview with nothing to look for is refused", () => {
    expect(MergeRequestSchema.safeParse({ ...good, lookFor: undefined }).success).toBe(false);
  });

  test("a short SHA, a non-PR URL or a non-session URL is refused", () => {
    expect(MergeRequestSchema.safeParse({ ...good, headSha: sha.slice(0, 7) }).success).toBe(false);
    expect(MergeRequestSchema.safeParse({ ...good, prUrl: "https://github.com/litlfred/cat-harness" }).success).toBe(false);
    expect(MergeRequestSchema.safeParse({ ...good, sessionUrl: "https://claude.ai/chat/abc" }).success).toBe(false);
  });

  test("more than three sentences of changes is refused", () => {
    expect(MergeRequestSchema.safeParse({ ...good, changes: "One. Two. Three. Four." }).success).toBe(false);
  });

  test("without the green line the request is not ready", () => {
    const text = formatMergeRequest(good).replace("full tier green as judged", "");
    expect(parseMergeRequest(text).success).toBe(false);
  });
});
