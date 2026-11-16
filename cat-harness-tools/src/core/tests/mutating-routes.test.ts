/**
 * `/api/git/checkout` and `/api/chat` refuse what they used to accept.
 *
 * Security review 2026-10-31 (H3, H5). Before the fix a `text/plain` POST with
 * no identity reached `discard` and removed untracked files, and chat ran for
 * anyone. Each refusal here has an acceptance beside it, so a handler that
 * refused everything would fail too.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { GitHelper } from "../git";
import { handleBranchPost } from "../../routes/branches";
import { handleChatPost } from "../../routes/chat";
import type { ContentAdapter } from "../../types";

const CHECKOUT = new URL("http://localhost/api/git/checkout");
const CHAT = new URL("http://localhost/api/chat");

function post(url: URL, body: unknown, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

const JSON_TYPE = { "content-type": "application/json" };
const COLLABORATOR = { ...JSON_TYPE, "x-user-role": "collaborator" };
const VIEWER = { ...JSON_TYPE, "x-user-role": "viewer" };

function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd, stdio: "pipe" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

describe("/api/git/checkout", () => {
  let repo: string;
  let helper: GitHelper;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "checkout-guard-"));
    git(repo, "init", "-q", "-b", "main");
    git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
    git(repo, "branch", "other");
    writeFileSync(join(repo, "precious.txt"), "keep me");
    helper = new GitHelper(repo);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("refuses a text/plain body and leaves untracked files alone", async () => {
    const res = await handleBranchPost(CHECKOUT, post(CHECKOUT, { branch: "other", action: "discard" }, {
      "content-type": "text/plain", "x-user-role": "collaborator",
    }), helper);
    expect(res!.status).toBe(415);
    expect(existsSync(join(repo, "precious.txt"))).toBe(true);
  });

  it("refuses a caller with no permission", async () => {
    for (const headers of [JSON_TYPE, VIEWER]) {
      const res = await handleBranchPost(CHECKOUT, post(CHECKOUT, { branch: "other", action: "discard" }, headers), helper);
      expect(res!.status).toBe(403);
    }
    expect(existsSync(join(repo, "precious.txt"))).toBe(true);
  });

  it("refuses a branch that git would read as an option", async () => {
    const res = await handleBranchPost(CHECKOUT, post(CHECKOUT, { branch: "--orphan=x" }, COLLABORATOR), helper);
    expect(res!.status).toBe(400);
    expect(helper.currentBranch()).toBe("main");
  });

  it("switches for a collaborator, with no wildcard CORS", async () => {
    const res = await handleBranchPost(CHECKOUT, post(CHECKOUT, { branch: "other", action: "stash" }, COLLABORATOR), helper);
    expect(res!.status).toBe(200);
    expect(res!.headers.get("access-control-allow-origin")).toBeNull();
    expect(helper.currentBranch()).toBe("other");
  });
});

describe("/api/chat", () => {
  // No API key in tests: an allowed request gets as far as the 503, which
  // proves it passed every check before the key is used.
  const adapter = {
    getChatTools: () => [],
    getChatSystemPrompt: () => "",
    executeChatTool: async () => "",
  } as unknown as ContentAdapter;
  let savedKey: string | undefined;
  beforeEach(() => { savedKey = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey; });

  const body = (mode: string) => ({ messages: [{ role: "user", content: "hi" }], mode });

  it("refuses an anonymous caller and a viewer", async () => {
    for (const headers of [JSON_TYPE, VIEWER]) {
      const res = await handleChatPost(CHAT, post(CHAT, body("read"), headers), adapter);
      expect(res!.status).toBe(403);
      expect(res!.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("refuses a text/plain body", async () => {
    const res = await handleChatPost(CHAT, post(CHAT, body("read"), { "content-type": "text/plain", "x-user-role": "collaborator" }), adapter);
    expect(res!.status).toBe(415);
  });

  it("gates edit mode on content-authoring and refuses an unknown mode", async () => {
    // `reviewer` holds review-comments but not content-authoring.
    const reviewer = { ...JSON_TYPE, "x-user-actor": "reviewer" };
    expect((await handleChatPost(CHAT, post(CHAT, body("read"), reviewer), adapter))!.status).toBe(503);
    expect((await handleChatPost(CHAT, post(CHAT, body("edit"), reviewer), adapter))!.status).toBe(403);
    expect((await handleChatPost(CHAT, post(CHAT, body("nonsense"), COLLABORATOR), adapter))!.status).toBe(400);
  });

  it("lets a collaborator through in read and edit mode", async () => {
    for (const mode of ["read", "edit"]) {
      const res = await handleChatPost(CHAT, post(CHAT, body(mode), COLLABORATOR), adapter);
      expect(res!.status).toBe(503);
      expect(res!.headers.get("access-control-allow-origin")).toBeNull();
    }
  });
});
