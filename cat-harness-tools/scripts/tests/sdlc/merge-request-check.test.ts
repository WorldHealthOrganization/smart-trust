/**
 * `merge:request:check`: a six-line merge request against the PR as it is
 * now, over a GitHub API stub.
 */
import { describe, expect, test } from "bun:test";

import { checkMergeRequest, formatCheck, stagingPreview, type GitHubReader, type IssueComment } from "../../merge-request-check.ts";

const HEAD = "3441735d5b7bdf29e2aeefaa926266237c100514";
const OLD = "89668b7a00000000000000000000000000000000";
const FOLIO = "litlfred/folio-assistant";
const PREVIEW = "https://litlfred.github.io/folio-assistant/branches/claude-fix-nav/";

const request = (over: { repo?: string; sha?: string; preview?: string; lookFor?: string } = {}) =>
  [
    `ready: https://github.com/${over.repo ?? FOLIO}/pull/7 ${over.sha ?? HEAD}`,
    "session: https://claude.ai/code/session_01ABC",
    "changes: Fixes the nav bar. One sentence more.",
    over.preview ?? `preview: ${PREVIEW}`,
    `look for: ${over.lookFor ?? "the nav bar on a phone"}`,
    "full tier green as judged",
  ].join("\n");

const staging = (commit: string, at = "2026-11-07T08:00:00Z"): IssueComment => ({
  body: `### Staging preview\n\n| | |\n|---|---|\n| **Commit** | \`${commit}\` |\n| **Preview** | ${PREVIEW} |`,
  created_at: at,
  user: { login: "github-actions[bot]", type: "Bot" },
});

function stub(routes: Record<string, unknown>): GitHubReader {
  const get = (path: string) => {
    if (!(path in routes)) throw new Error(`HTTP 404: Not Found (${path})`);
    return routes[path];
  };
  return { json: <T>(p: string) => get(p) as T, pages: <T>(p: string) => [get(p)] as T[] };
}

const folio = (head: string, comments: IssueComment[], state = "open") =>
  stub({
    [`repos/${FOLIO}/pulls/7`]: { state, head: { sha: head } },
    [`repos/${FOLIO}/issues/7/comments?per_page=100`]: comments,
  });

describe("the Staging preview comment", () => {
  test("the latest one wins; its Commit and slug are read", () => {
    const old = staging("89668b7", "2026-11-07T07:00:00Z");
    expect(stagingPreview([staging("3441735"), old])).toEqual({ commit: "3441735", slug: "claude-fix-nav", live: true });
    expect(stagingPreview([{ body: "Commit: 3441735d", created_at: "x" }])).toBeNull();
    expect(stagingPreview([{ body: "Staging preview\n**Commit:** 3441735d", created_at: "2026-11-07T00:00:00Z" }])?.commit).toBe("3441735d");
  });
});

/**
 * A real comment, pinned: folio-assistant#2985, comment 6675908708 (one per
 * PR, edited in place on each build), as of 2026-11-07T06:42:54Z.
 */
const REAL = [
  "<!-- staging-preview-comment -->",
  "## 🔍 Staging preview",
  "",
  "**URL:** https://litlfred.github.io/folio-assistant/branches/ccr-cce3e36b-lgh7fe/",
  "**Commit:** `c1fbb65`",
  "**Branch:** `ccr-cce3e36b-lgh7fe`",
  "",
  "**Status:** pushed to `gh-pages` at 06:42 UTC; live by about **06:47 UTC**, once the Pages build finishes (...)",
].join("\n");
const REAL_HEAD = "c1fbb65" + "0".repeat(33);

describe("the real folio-assistant comment (#2985)", () => {
  const comment = (body: string): IssueComment => ({ body, created_at: "2026-11-07T06:30:00Z", updated_at: "2026-11-07T06:42:54Z" });
  test("its short Commit, slug and live status are read", () => {
    expect(stagingPreview([comment(REAL)])).toEqual({ commit: "c1fbb65", slug: "ccr-cce3e36b-lgh7fe", live: true });
  });
  test("a request for its head and URL (or a page under it) is ok", () => {
    const api = stub({
      [`repos/${FOLIO}/pulls/7`]: { state: "open", head: { sha: REAL_HEAD } },
      [`repos/${FOLIO}/issues/7/comments?per_page=100`]: [comment(REAL)],
    });
    for (const url of ["https://litlfred.github.io/folio-assistant/branches/ccr-cce3e36b-lgh7fe/", "https://litlfred.github.io/folio-assistant/branches/ccr-cce3e36b-lgh7fe/changes/"]) {
      expect(checkMergeRequest(api, request({ sha: REAL_HEAD, preview: `preview: ${url}` }))).toEqual({ kind: "ok", notes: [] });
    }
  });
  test("staged and queued is not rendered yet", () => {
    const staged = REAL.replace(/\*\*Status:\*\*.*/, "**Status:** staged — Pages build queued");
    expect(stagingPreview([comment(staged)])?.live).toBe(false);
    const api = stub({
      [`repos/${FOLIO}/pulls/7`]: { state: "open", head: { sha: REAL_HEAD } },
      [`repos/${FOLIO}/issues/7/comments?per_page=100`]: [comment(staged)],
    });
    const v = checkMergeRequest(api, request({ sha: REAL_HEAD, preview: "preview: https://litlfred.github.io/folio-assistant/branches/ccr-cce3e36b-lgh7fe/" }));
    expect(formatCheck(v)).toContain("staged, not live yet");
  });
});

describe("merge:request:check", () => {
  test("ok: current head, preview built for it", () => {
    expect(checkMergeRequest(folio(HEAD, [staging("3441735")]), request())).toEqual({ kind: "ok", notes: [] });
  });

  test("refused: a malformed request names what is wrong", () => {
    const v = checkMergeRequest(folio(HEAD, []), request({ sha: "3441735" }));
    expect(v.kind).toBe("refused");
    expect(formatCheck(v)).toContain("headSha");
  });

  test("refused: the head moved since the request", () => {
    const v = checkMergeRequest(folio(HEAD, [staging(HEAD)]), request({ sha: OLD }));
    expect(v).toMatchObject({ kind: "refused" });
    expect(formatCheck(v)).toContain("head moved");
  });

  test("refused: the preview was built for an older commit", () => {
    const v = checkMergeRequest(folio(HEAD, [staging("89668b7")]), request());
    expect(formatCheck(v)).toContain("preview built for 89668b7");
  });

  test("refused: no Staging preview comment, or a URL of the wrong form or slug", () => {
    expect(formatCheck(checkMergeRequest(folio(HEAD, []), request()))).toContain("no \"Staging preview\" comment");
    const wrong = checkMergeRequest(folio(HEAD, [staging(HEAD)]), request({ preview: "preview: https://example.org/x" }));
    expect(formatCheck(wrong)).toContain("is not https://litlfred.github.io/folio-assistant/branches/<slug>/");
    const other = checkMergeRequest(
      folio(HEAD, [staging(HEAD)]),
      request({ preview: "preview: https://litlfred.github.io/folio-assistant/branches/other/" }),
    );
    expect(formatCheck(other)).toContain("slug other is not the built one, claude-fix-nav");
  });

  test("refused: the PR is closed", () => {
    expect(formatCheck(checkMergeRequest(folio(HEAD, [staging(HEAD)], "closed"), request()))).toContain("the PR is closed");
  });

  test("no preview needs no build; another repo's preview is noted, not refused", () => {
    const none = checkMergeRequest(folio(HEAD, []), request({ preview: "no preview: a script change", lookFor: "-" }));
    expect(none).toEqual({ kind: "ok", notes: [] });
    const tools = stub({ "repos/litlfred/cat-harness-tools/pulls/7": { state: "open", head: { sha: HEAD } }, "repos/litlfred/cat-harness-tools/issues/7/comments?per_page=100": [] });
    expect(checkMergeRequest(tools, request({ repo: "litlfred/cat-harness-tools", preview: "preview: https://example.org/p" }))).toEqual({
      kind: "ok",
      notes: ["preview not verified: litlfred/cat-harness-tools has no build record to check"],
    });
  });

  test("unknown, never refused, when the PR cannot be read", () => {
    expect(checkMergeRequest(stub({}), request()).kind).toBe("unknown");
  });
});
