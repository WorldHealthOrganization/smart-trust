/**
 * Provider-neutral identity (bean f1e1, owner ruling 2026-10-10): every
 * identity a session can see is a (provider, handle) pair, GitHub resolved by
 * the auth Tool's own resolver, and a user-level store that is never committed.
 *
 * GitHub is faked as in user-auth.test.ts; git is injected; the user store is a
 * temp directory — nothing here reads the machine it runs on.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  matchKeys,
  normalizeDeclaredIdentities,
  qualified,
  readUserConfig,
  resolveIdentities,
  userConfigPath,
} from "../../src/core/identity.js";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
function home(): string {
  const d = mkdtempSync(join(tmpdir(), "identity-t-"));
  made.push(d);
  return d;
}
function userConfig(h: string, body: string): void {
  mkdirSync(join(h, ".config", "cat-harness"), { recursive: true });
  writeFileSync(join(h, ".config", "cat-harness", "identity.json"), body);
}
const noGit = () => undefined;
const githubSays = (login: string) => async (url: string) => ({
  ok: url.endsWith("/user"),
  status: url.endsWith("/user") ? 200 : 404,
  json: async () => ({ login }),
});

describe("the user-level store", () => {
  test("lives under XDG_CONFIG_HOME, else ~/.config; CAT_HARNESS_USER_CONFIG overrides", () => {
    expect(userConfigPath({}, "/h")).toBe("/h/.config/cat-harness/identity.json");
    expect(userConfigPath({ XDG_CONFIG_HOME: "/x" }, "/h")).toBe("/x/cat-harness/identity.json");
    expect(userConfigPath({ CAT_HARNESS_USER_CONFIG: "/p.json", XDG_CONFIG_HOME: "/x" }, "/h")).toBe("/p.json");
  });

  test("absent, ok and unreadable are three answers — unreadable is never read as empty", () => {
    const h = home();
    expect(readUserConfig({}, h).state).toBe("absent");
    userConfig(h, "{ not json");
    expect(readUserConfig({}, h).state).toBe("unreadable");
    userConfig(h, JSON.stringify({ identities: [{ provider: "gitlab" }] }));
    expect(readUserConfig({}, h)).toMatchObject({ state: "unreadable" });
    userConfig(h, JSON.stringify({ identities: [{ provider: "gitlab", handle: "ann" }], interaction: { profiles: "low-dexterity" } }));
    expect(readUserConfig({}, h)).toMatchObject({ state: "ok", config: { interaction: { profiles: "low-dexterity" } } });
  });
});

describe("resolveIdentities", () => {
  test("no token, no forge: the git author and a declared identity still answer — not 'could not determine'", async () => {
    const h = home();
    userConfig(h, JSON.stringify({ identities: [{ provider: "gitlab", handle: "ann" }] }));
    const git = (k: string) => (k === "user.email" ? "ann@example.org" : undefined);
    const r = await resolveIdentities({ env: {}, home: h, git });
    expect(r.identities.map(qualified)).toEqual(["gitlab:ann", "git:ann@example.org"]);
    expect(r.identities.every((i) => !i.vouched)).toBe(true);
    expect(r.notes.some((n) => n.startsWith("github:"))).toBe(true);
  });

  test("GitHub first and vouched, through the auth Tool's own resolver", async () => {
    const r = await resolveIdentities({ env: { GH_TOKEN: "t" }, home: home(), git: noGit, fetch: githubSays("octo") });
    expect(r.identities[0]).toEqual({ provider: "github", handle: "octo", via: "token", vouched: true });
    expect(r.github.login).toBe("octo");
  });

  test("GitLab CI's pipeline user and the agent host's account are providers too", async () => {
    const r = await resolveIdentities({
      env: { GITLAB_CI: "true", GITLAB_USER_LOGIN: "ann", CLAUDE_CODE_USER_EMAIL: "ann@example.org" },
      home: home(),
      git: noGit,
    });
    expect(r.identities.map(qualified)).toEqual(["gitlab:ann", "claude:ann@example.org"]);
    // GITLAB_USER_LOGIN outside GitLab CI is just a variable someone set.
    const r2 = await resolveIdentities({ env: { GITLAB_USER_LOGIN: "ann" }, home: home(), git: noGit });
    expect(r2.identities).toEqual([]);
  });

  test("the same pair from two sources is one identity, the stronger kept", async () => {
    const h = home();
    userConfig(h, JSON.stringify({ identities: [{ provider: "github", handle: "octo" }] }));
    const r = await resolveIdentities({ env: { GH_TOKEN: "t" }, home: h, git: noGit, fetch: githubSays("octo") });
    expect(r.identities).toHaveLength(1);
    expect(r.identities[0]!.vouched).toBe(true);
  });

  test("an unreadable user store is a note, not a silent nothing", async () => {
    const h = home();
    userConfig(h, "[]");
    const r = await resolveIdentities({ env: {}, home: h, git: noGit });
    expect(r.userConfig.state).toBe("unreadable");
    expect(r.notes.some((n) => n.includes("not a JSON object"))).toBe(true);
  });

  test("several accounts per provider for one person: map form (string | string[]) and array form with active flag", async () => {
    const h = home();
    userConfig(
      h,
      JSON.stringify({
        identities: {
          github: ["litlfred", "litlfred-bot"],
          claude: ["fred-personal@example.org", "fred-work@example.org"],
          gitlab: "fred-gl",
        },
      }),
    );
    const r = await resolveIdentities({ env: {}, home: h, git: noGit });
    expect(r.identities.map(qualified)).toEqual([
      "github:litlfred",
      "github:litlfred-bot",
      "claude:fred-personal@example.org",
      "claude:fred-work@example.org",
      "gitlab:fred-gl",
    ]);
    const keys = matchKeys(r.identities);
    expect(keys).toContain("litlfred");
    expect(keys).toContain("litlfred-bot");
    expect(keys).toContain("github:litlfred");
    expect(keys).toContain("github:litlfred-bot");
    expect(keys).toContain("claude:fred-personal@example.org");
    expect(keys).toContain("claude:fred-work@example.org");

    // Array form with active: true puts active handles first while keeping all accounts.
    const norm = normalizeDeclaredIdentities([
      { provider: "github", handle: "secondary-gh", active: false },
      { provider: "github", handle: ["primary-gh", "team-gh"], active: true },
    ]);
    expect(norm.map((x) => `${x.provider}:${x.handle}`)).toEqual([
      "github:primary-gh",
      "github:team-gh",
      "github:secondary-gh",
    ]);
  });

  test("several people on one machine: explicit CAT_HARNESS_PROFILE / CAT_HARNESS_PERSON selects that person's profile, while ambiguous multi-user falls back to strictest profile", async () => {
    const h = home();
    userConfig(
      h,
      JSON.stringify({
        profiles: {
          // Listed first with looser profile [] to prove we never silently pick the first/looser profile!
          bob: {
            identities: { github: "bob-gh", cursor: "bob@example.org" },
            interaction: { profiles: [], note: "Ordinary chat" },
          },
          alice: {
            identities: { github: ["alice-gh", "alice-alt"], gemini: "alice@example.org" },
            interaction: { profiles: ["low-dexterity"], note: "Selectable options only" },
          },
        },
      }),
    );

    // 1. No disambiguator -> ambiguous-multi-user, falls back to Alice's strictest profile ("low-dexterity").
    const ambig = await resolveIdentities({ env: {}, home: h, git: noGit });
    expect(ambig.multiUserStatus).toBe("ambiguous-multi-user");
    expect(ambig.interaction.status).toBe("ambiguous-multi-user");
    expect(ambig.interaction.profiles).toEqual(["low-dexterity"]);
    expect(ambig.notes.some((n) => n.includes("ambiguous-multi-user"))).toBe(true);

    // 2. Explicit CAT_HARNESS_PROFILE=bob -> resolves Bob's identities and Bob's profile.
    const asBob = await resolveIdentities({ env: { CAT_HARNESS_PROFILE: "bob" }, home: h, git: noGit });
    expect(asBob.multiUserStatus).toBe("selected");
    expect(asBob.activeProfile).toBe("bob");
    expect(asBob.identities.map(qualified)).toEqual(["github:bob-gh", "cursor:bob@example.org"]);
    expect(asBob.interaction.profiles).toEqual([]);

    // 3. CAT_HARNESS_PERSON=github:alice-alt -> selects Alice and resolves all of Alice's accounts.
    const asAlice = await resolveIdentities({ env: { CAT_HARNESS_PERSON: "github:alice-alt" }, home: h, git: noGit });
    expect(asAlice.multiUserStatus).toBe("selected");
    expect(asAlice.activeProfile).toBe("alice");
    expect(asAlice.identities.map(qualified)).toEqual([
      "github:alice-alt",
      "github:alice-gh",
      "gemini:alice@example.org",
    ]);
    expect(asAlice.interaction.profiles).toEqual(["low-dexterity"]);
  });

  test("several people in one session matching repo interaction.json users: detects ambiguity and falls back to strictest profile unless disambiguated", async () => {
    const repoUsers = {
      bob: {
        aliases: ["cursor:bob@example.org"],
        profiles: [],
        note: "Ordinary chat",
      },
      alice: {
        aliases: ["gemini:alice@example.org"],
        profiles: ["low-dexterity"],
        note: "Selectable options only",
      },
    };

    // The session names both Bob and Alice, with no disambiguator.
    const ambig = await resolveIdentities({
      env: { CAT_HARNESS_PERSON: "cursor:bob@example.org,gemini:alice@example.org" },
      home: home(),
      git: noGit,
      users: repoUsers,
    });
    expect(ambig.multiUserStatus).toBe("ambiguous-multi-user");
    expect(ambig.interaction.status).toBe("ambiguous-multi-user");
    expect(ambig.interaction.matchedUsers).toEqual(["bob", "alice"]);
    expect(ambig.interaction.profiles).toEqual(["low-dexterity"]);

    // Disambiguated by CAT_HARNESS_PROFILE="bob"
    const disambig = await resolveIdentities({
      env: {
        CAT_HARNESS_PERSON: "cursor:bob@example.org,gemini:alice@example.org",
        CAT_HARNESS_PROFILE: "bob",
      },
      home: home(),
      git: noGit,
      users: repoUsers,
    });
    expect(disambig.multiUserStatus).toBe("selected");
    expect(disambig.activeProfile).toBe("bob");
    expect(disambig.interaction.status).toBe("selected");
    expect(disambig.interaction.profiles).toEqual([]);
  });
});

test("match keys: each handle bare (interaction.json's key form) and as provider:handle", () => {
  expect(matchKeys([{ provider: "gitlab", handle: "ann", via: "x", vouched: true }]).sort()).toEqual(["ann", "gitlab:ann"]);
});

describe("several people, several accounts, several hosts", () => {
  test("CAT_HARNESS_PERSON names who is typing this session, self-asserted, before the store", async () => {
    const h = home();
    userConfig(h, JSON.stringify({ identities: [{ provider: "gitlab", handle: "ann" }] }));
    const r = await resolveIdentities({ env: { CAT_HARNESS_PERSON: "gitlab:bob, nope" }, home: h, git: noGit });
    expect(r.identities.map(qualified)).toEqual(["gitlab:bob", "gitlab:ann"]);
    expect(r.identities[0]).toMatchObject({ via: "CAT_HARNESS_PERSON", vouched: false });
    expect(r.notes.some((n) => n.includes("`nope` is not provider:handle"))).toBe(true);
  });

  test("several accounts on one provider are each a match key", async () => {
    const h = home();
    userConfig(h, JSON.stringify({ identities: [{ provider: "gitlab", handle: "ann" }, { provider: "gitlab", handle: "ann-work" }] }));
    const r = await resolveIdentities({ env: {}, home: h, git: noGit });
    expect(matchKeys(r.identities)).toEqual(expect.arrayContaining(["gitlab:ann", "gitlab:ann-work", "ann", "ann-work"]));
  });

  test("a host that passes no account is reported, with a note saying where the person comes from instead", async () => {
    const r = await resolveIdentities({ env: { GEMINI_CLI: "1" }, home: home(), git: noGit });
    expect(r.hosts).toEqual([{ id: "gemini-cli", name: "Gemini CLI", marker: "GEMINI_CLI", exposesIdentity: false }]);
    expect(r.notes.some((n) => n.startsWith("gemini-cli: the host passes no account"))).toBe(true);
  });

  test("Claude Code's account is read and its host gets no 'no account' note", async () => {
    const r = await resolveIdentities({ env: { CLAUDECODE: "1", CLAUDE_CODE_USER_EMAIL: "ann@example.org" }, home: home(), git: noGit });
    expect(r.hosts.map((h) => h.id)).toEqual(["claude-code"]);
    expect(r.identities.map(qualified)).toContain("claude:ann@example.org");
    expect(r.notes.some((n) => n.startsWith("claude-code:"))).toBe(false);
  });
});
