/**
 * The user authN/authZ Tool (issue #1207): GitHub says who the caller is and
 * what role they hold on the whole repository; ODRL says what that allows.
 *
 * GitHub is faked here: the live call is two read-only GETs, and a test that
 * needed the network would be the flaky kind this repo refuses to call a flake.
 */
import { describe, expect, test } from "bun:test";

import { GITHUB_ROLE_ACTOR, githubIdentity, principalFromGithub, repoSlug } from "../../src/core/github-auth.js";
import { loadAccessContext } from "../../src/core/access.js";
import { grainNote, whoami } from "../../src/tools/auth.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const CTX = loadAccessContext(HARNESS_ROOT);

/** A fake `fetch` answering by path suffix; anything else is a 404. */
function fakeGithub(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: string[] = [];
  const f = async (url: string) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.endsWith(k));
    const status = hit ? (hit[1].status ?? 200) : 404;
    return { ok: status >= 200 && status < 300, status, json: async () => (hit ? hit[1].body : {}) };
  };
  return { f, calls };
}

describe("githubIdentity: three answers, never two", () => {
  test("a person's token: login from /user, role from the repository's own permissions block", async () => {
    const { f, calls } = fakeGithub({
      "/user": { body: { login: "octo" } },
      "/repos/o/r": { body: { permissions: { admin: false, maintain: false, push: true, triage: true, pull: true } } },
    });
    const id = await githubIdentity({ env: { GH_TOKEN: "t" }, repo: "o/r", fetch: f });
    expect(id).toMatchObject({ status: "authenticated", login: "octo", role: "write", via: "token" });
    expect(calls.every((c) => !c.includes("/collaborators/"))).toBe(true);
  });

  test("an Actions job asks about the ACTOR by name, not about the workflow's token", async () => {
    const { f, calls } = fakeGithub({ "/collaborators/octo/permission": { body: { role_name: "maintain" } } });
    const id = await githubIdentity({ env: { GITHUB_TOKEN: "t", GITHUB_ACTIONS: "true", GITHUB_ACTOR: "octo" }, repo: "o/r", fetch: f });
    expect(id).toMatchObject({ status: "authenticated", login: "octo", role: "maintain", via: "actions" });
    expect(calls.some((c) => c.endsWith("/user"))).toBe(false);
  });

  test("no credential is unauthenticated; a rejected token is unauthenticated; a failure is unknown", async () => {
    expect((await githubIdentity({ env: {}, repo: "o/r" })).status).toBe("unauthenticated");
    const rejected = fakeGithub({ "/user": { status: 401, body: {} } });
    expect((await githubIdentity({ env: { GH_TOKEN: "t" }, repo: "o/r", fetch: rejected.f })).status).toBe("unauthenticated");
    const down = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect((await githubIdentity({ env: { GH_TOKEN: "t" }, repo: "o/r", fetch: down })).status).toBe("unknown");
  });

  test("a role that cannot be read leaves the role unknown rather than guessing one", async () => {
    const { f } = fakeGithub({ "/user": { body: { login: "octo" } }, "/repos/o/r": { status: 403, body: {} } });
    const id = await githubIdentity({ env: { GH_TOKEN: "t" }, repo: "o/r", fetch: f });
    expect(id.status).toBe("authenticated");
    expect(id.role).toBeUndefined();
    expect(principalFromGithub(id).actor).toBeNull();
  });
});

describe("a GitHub role maps onto the gateway actors the policies already grant", () => {
  test("every mapped actor is declared (vacuity guard: the map is not empty)", () => {
    const mapped = Object.values(GITHUB_ROLE_ACTOR).filter((a): a is string => a !== null);
    expect(mapped.length).toBeGreaterThan(0);
    for (const a of mapped) expect(CTX.actors.has(a)).toBe(true);
  });

  test("write may author content, read may not, none is nobody", () => {
    expect(principalFromGithub({ status: "authenticated", login: "x", role: "write" })).toMatchObject({ actor: "collaborator", authenticatedBy: "github", account: "x" });
    expect(principalFromGithub({ status: "authenticated", login: "x", role: "none" }).actor).toBeNull();
    const ask = (role: "write" | "read") =>
      whoami(CTX, { status: "authenticated", login: "x", repo: "o/r", role, via: "token" }, { action: "content-authoring" });
    expect(ask("write")).toContain("**`content-authoring`:** permit");
    expect(ask("read")).toContain("**`content-authoring`:** unknown");
  });
});

describe("the answer always says what GitHub cannot express", () => {
  test("whole repository, never a sub-graph, node or query path", () => {
    const text = whoami(CTX, { status: "unauthenticated", reason: "no token" }, {});
    expect(text).toContain("# What GitHub cannot express");
    expect(text).toContain(grainNote({ status: "unauthenticated" }));
    expect(grainNote({ status: "authenticated", repo: "o/r", role: "write" })).toMatch(/as a whole: every sub-graph, node and query path/);
  });

  test("a claimed actor is reported as claimed — GitHub vouched for the login, not the actor", () => {
    const text = whoami(CTX, { status: "authenticated", login: "x", repo: "o/r", role: "write", via: "token" }, { actor: "author" });
    expect(text).toContain("GitHub vouched for the login, not for this actor");
  });
});

test("repoSlug reads GITHUB_REPOSITORY first, then a GitHub remote", () => {
  expect(repoSlug({ GITHUB_REPOSITORY: "a/b" }, "https://github.com/c/d.git")).toBe("a/b");
  expect(repoSlug({}, "git@github.com:c/d.git")).toBe("c/d");
  expect(repoSlug({}, "https://example.org/c/d")).toBeUndefined();
});

describe("personal-account levels are the mapping (owner, 2026-09-24)", () => {
  test("the repository's owner type is read, and the answer names the personal-account levels", async () => {
    const { f } = fakeGithub({
      "/user": { body: { login: "octo" } },
      "/repos/o/r": { body: { owner: { type: "User" }, visibility: "public", permissions: { push: true, pull: true } } },
    });
    const id = await githubIdentity({ env: { GH_TOKEN: "t" }, repo: "o/r", fetch: f });
    expect(id).toMatchObject({ role: "write", ownerType: "User", visibility: "public" });
    expect(whoami(CTX, id, {})).toContain("**Personal-account repository** (public)");
  });

  test("every personal-account level maps to a declared actor or to nobody", async () => {
    const { PERSONAL_ACCOUNT_LEVELS } = await import("../../src/core/github-auth.js");
    expect(PERSONAL_ACCOUNT_LEVELS.length).toBe(4);
    for (const l of PERSONAL_ACCOUNT_LEVELS) {
      expect(GITHUB_ROLE_ACTOR[l.role]).toBe(l.actor);
      if (l.actor) expect(CTX.actors.has(l.actor)).toBe(true);
    }
  });
});

describe("whoami lists the other identities, and never authorizes on them (bean f1e1)", () => {
  const id = { status: "authenticated" as const, login: "octo", repo: "o/r", role: "read" as const, via: "token" as const };
  test("the GitHub login is not repeated; the others are labelled vouched or self-asserted", () => {
    const md = whoami(CTX, id, {}, [
      { provider: "github", handle: "octo", via: "token", vouched: true },
      { provider: "claude", handle: "a@b.c", via: "CLAUDE_CODE_USER_EMAIL", vouched: true },
      { provider: "git", handle: "a@b.c", via: "git config user.email", vouched: false },
    ]);
    expect(md).toContain("**Also seen** (for preferences only, never for permissions)");
    expect(md).toContain("`claude:a@b.c` (vouched, CLAUDE_CODE_USER_EMAIL)");
    expect(md).toContain("`git:a@b.c` (self-asserted, git config user.email)");
    expect(md).not.toContain("`github:octo`");
  });
  test("an unauthenticated caller with a self-asserted identity is still nobody for permissions", () => {
    const md = whoami(CTX, { status: "unauthenticated" }, {}, [{ provider: "git", handle: "owner@x", via: "git config user.email", vouched: false }]);
    expect(md).toContain("**Nobody:**");
    expect(md).toContain("`git:owner@x`");
  });
  test("no others, no line — the old answer is unchanged", () => {
    expect(whoami(CTX, id, {})).not.toContain("Also seen");
  });
});

