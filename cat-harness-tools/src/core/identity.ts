/**
 * Folio Assistant — who is typing, as a (provider, handle) pair, from every
 * source a session can see. Bean `folio-assistant-f1e1`.
 *
 * Owner ruling 2026-10-10: *"provider-neutral: identity is (provider, handle),
 * GitHub implemented first; preferences that are not repo content live in a
 * user-level config store."* Until this module, the only key was a GitHub
 * login (`github-auth.ts`), so a local CLI with no token, another forge, or no
 * forge at all fell straight to "could not determine".
 *
 * ## What each provider vouches for
 *
 * Not every source is equally strong, and the pair says which one spoke:
 *
 * | provider | from | vouched by |
 * |---|---|---|
 * | `github` | {@link githubIdentity}: a token's `GET /user`, or `GITHUB_ACTOR` in Actions | GitHub |
 * | `gitlab` | `GITLAB_USER_LOGIN`, set by GitLab CI for the user who started the pipeline | GitLab, in CI only |
 * | `claude` | `CLAUDE_CODE_USER_EMAIL`, the agent host's signed-in account | the agent host |
 * | any | `CAT_HARNESS_PERSON`: `provider:handle`, comma-separated | nobody: self-asserted, per session |
 * | `git` | `git config user.email`, then `user.name` | nobody: self-asserted |
 * | any | the user-level config's `identities`, and the selected entry of its `profiles` | nobody: self-asserted, per machine |
 *
 * A self-asserted identity is good enough to choose how to TALK to someone,
 * which is what the interaction preferences are for. It is never good enough
 * to AUTHORIZE them: permissions stay with {@link principalFromGithub}, which
 * accepts only what GitHub vouched for. `vouched` carries that difference, so
 * one resolver can feed both preferences and permissions without confusing them.
 *
 * ## The user-level store
 *
 * `$XDG_CONFIG_HOME/cat-harness/identity.json` (default `~/.config/…`; the
 * `CAT_HARNESS_USER_CONFIG` variable overrides the path). It is per-machine and
 * never committed: it holds identities a person declares for themselves and
 * preferences that are not repository content (owner ruling, above). A missing
 * file is the normal case and reads as empty; an unreadable one is reported,
 * never silently treated as empty.
 *
 * ## Several people, several accounts, several hosts
 *
 * One machine shared by several people: each has their own home directory,
 * so each has their own user-level store. One session shared, or a shared
 * login: `CAT_HARNESS_PERSON` names who is typing for this session only, and
 * is put first among the self-asserted answers. One person with several
 * accounts on a provider: list each in the store, either as entries or in the
 * object form `identities: { github: ["acct1", "acct2"] }`; every one is a
 * match key, and an entry marked `active: true` comes first.
 *
 * Several people in one store: `profiles: { "<name>": { identities,
 * interaction } }`. The profile in use is the one `CAT_HARNESS_PROFILE` names,
 * else the store's `activeProfile`, else the one whose identities match
 * `CAT_HARNESS_PERSON`, else the only one. With several and nothing to choose
 * between them, the state is `ambiguous-multi-user` and the strictest
 * interaction profile on record applies until someone says who is typing. The
 * same holds when the keys match more than one person in the repository's
 * `interaction.json` (`users`): the strictest of their profiles, never the
 * first one found.
 *
 * Which agent host runs the session is reported too ({@link detectAgentHosts}).
 * A host that passes no account to a command gets a note saying so, so "nobody
 * vouched" reads as a property of the host and not as a fault.
 *
 * @module folio-assistant/core/identity
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { detectAgentHosts, type AgentHost } from "./agent-host.js";
import { githubIdentity, type GithubIdentity } from "./github-auth.js";

type Env = Readonly<Record<string, string | undefined>>;

/** One identity a session can see. */
export interface Identity {
  /** `github`, `gitlab`, `claude`, `git`, or a provider a user config names. */
  provider: string;
  handle: string;
  /** Where it was read. */
  via: string;
  /** Whether the provider itself vouched for it, rather than the person asserting it. */
  vouched: boolean;
}

/** One entry in the array form of `identities`. */
export interface DeclaredIdentityEntry {
  provider: string;
  handle: string | string[];
  active?: boolean;
}

/**
 * Declared identities in `identity.json`: either an array of
 * `{ provider, handle: string | string[], active? }` or a record mapping
 * provider name to `string | string[]`.
 */
export type DeclaredIdentities =
  | DeclaredIdentityEntry[]
  | Record<string, string | string[]>;

/** Per-person profile entry when a machine is shared by several people. */
export interface PersonProfileConfig {
  identities?: DeclaredIdentities;
  interaction?: Record<string, unknown>;
  [k: string]: unknown;
}

/** The user-level store's shape. Unknown keys are kept for the caller. */
export interface UserIdentityConfig {
  identities?: DeclaredIdentities;
  /** Interaction preferences that are not repository content. */
  interaction?: Record<string, unknown>;
  /** Default active profile name on a multi-user machine. */
  activeProfile?: string;
  /** Named per-person profiles on a shared machine. */
  profiles?: Record<string, PersonProfileConfig>;
  [k: string]: unknown;
}

export type UserConfigRead =
  | { state: "absent"; path: string }
  | { state: "ok"; path: string; config: UserIdentityConfig }
  | { state: "unreadable"; path: string; reason: string };

/** Where the user-level store lives for this environment. */
export function userConfigPath(env: Env, home: string = homedir()): string {
  if (env.CAT_HARNESS_USER_CONFIG) return env.CAT_HARNESS_USER_CONFIG;
  const base = env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "cat-harness", "identity.json");
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidHandleValue(v: unknown): v is string | string[] {
  if (isNonEmptyString(v)) return true;
  if (Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString)) return true;
  return false;
}

function isValidDeclaredIdentities(raw: unknown): raw is DeclaredIdentities {
  if (Array.isArray(raw)) {
    return raw.every(
      (i) =>
        typeof i === "object" &&
        i !== null &&
        !Array.isArray(i) &&
        isNonEmptyString((i as DeclaredIdentityEntry).provider) &&
        isValidHandleValue((i as DeclaredIdentityEntry).handle) &&
        ((i as DeclaredIdentityEntry).active === undefined || typeof (i as DeclaredIdentityEntry).active === "boolean"),
    );
  }
  if (typeof raw === "object" && raw !== null) {
    const entries = Object.entries(raw as Record<string, unknown>);
    return entries.every(([k, v]) => isNonEmptyString(k) && isValidHandleValue(v));
  }
  return false;
}

/**
 * Normalize any supported `identities` representation (`{ provider, handle }[]`,
 * `{ provider, handle: string[], active? }[]`, or `{ [provider]: string | string[] }`)
 * into flat `{ provider, handle, active? }` pairs, placing `active: true` entries
 * first while keeping all handles so every account of the person matches.
 */
export function normalizeDeclaredIdentities(
  declared: DeclaredIdentities | undefined,
): { provider: string; handle: string; active?: boolean }[] {
  if (!declared) return [];
  const flat: { provider: string; handle: string; active?: boolean }[] = [];
  if (Array.isArray(declared)) {
    for (const item of declared) {
      const handles = Array.isArray(item.handle) ? item.handle : [item.handle];
      for (const h of handles) {
        flat.push({
          provider: item.provider.trim(),
          handle: h.trim(),
          ...(item.active !== undefined ? { active: item.active } : {}),
        });
      }
    }
  } else {
    for (const [provider, val] of Object.entries(declared)) {
      const handles = Array.isArray(val) ? val : [val];
      for (const h of handles) {
        flat.push({ provider: provider.trim(), handle: h.trim() });
      }
    }
  }
  const active = flat.filter((x) => x.active === true);
  const rest = flat.filter((x) => x.active !== true);
  return [...active, ...rest];
}

/** Read the user-level store: absent, ok, or unreadable — never a silent empty. */
export function readUserConfig(env: Env, home?: string): UserConfigRead {
  const path = userConfigPath(env, home);
  if (!existsSync(path)) return { state: "absent", path };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { state: "unreadable", path, reason: "not a JSON object" };
    }
    const config = parsed as UserIdentityConfig;
    if (config.identities !== undefined && !isValidDeclaredIdentities(config.identities)) {
      return {
        state: "unreadable",
        path,
        reason: "`identities` must be a list of {provider, handle} entries or a {provider: handle | handle[]} map",
      };
    }
    if (config.activeProfile !== undefined && !isNonEmptyString(config.activeProfile)) {
      return { state: "unreadable", path, reason: "`activeProfile` must be a non-empty string" };
    }
    if (config.profiles !== undefined) {
      if (typeof config.profiles !== "object" || config.profiles === null || Array.isArray(config.profiles)) {
        return { state: "unreadable", path, reason: "`profiles` must be a JSON object mapping profile names to configs" };
      }
      for (const [name, prof] of Object.entries(config.profiles)) {
        if (!isNonEmptyString(name) || typeof prof !== "object" || prof === null || Array.isArray(prof)) {
          return { state: "unreadable", path, reason: `profile '${name}' must be a JSON object` };
        }
        if (prof.identities !== undefined && !isValidDeclaredIdentities(prof.identities)) {
          return { state: "unreadable", path, reason: `profile '${name}'.identities is invalid` };
        }
      }
    }
    return { state: "ok", path, config };
  } catch (e) {
    return { state: "unreadable", path, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** `provider:handle`, the form an interaction entry's alias may take. */
export function qualified(id: Pick<Identity, "provider" | "handle">): string {
  return `${id.provider}:${id.handle}`;
}

export type MultiUserStatus = "single" | "selected" | "ambiguous-multi-user";

export interface ResolvedInteraction {
  status: "matched" | "selected" | "ambiguous-multi-user" | "unknown-user" | "none";
  /** Which profile or user key(s) matched or were considered. */
  matchedUsers: string[];
  /** Effective interaction profile names to apply (strictest when ambiguous-multi-user or unknown-user). */
  profiles: string[];
  /** Full interaction record chosen. */
  interaction?: Record<string, unknown>;
}

export interface IdentityResolution {
  identities: Identity[];
  /** The GitHub resolver's own answer, kept whole: permissions read it. */
  github: GithubIdentity;
  userConfig: UserConfigRead;
  /** The agent hosts whose markers are set: usually one, none outside an agent. */
  hosts: AgentHost[];
  /** Sources that were asked and could not answer, or ambiguity notes, in words. */
  notes: string[];
  /** The profile chosen on a store or `interaction.json` that names several people. */
  activeProfile?: string;
  /** One person, a profile chosen among several, or several and none chosen. */
  multiUserStatus: MultiUserStatus;
  /** The interaction profile to apply: the strictest on record when ambiguous. */
  interaction: ResolvedInteraction;
}

function gitConfig(key: string, cwd?: string): string | undefined {
  try {
    const v = execFileSync("git", ["config", key], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

function extractProfilesList(interaction: Record<string, unknown> | undefined): string[] {
  if (!interaction) return [];
  const p = interaction.profiles;
  if (Array.isArray(p)) return p.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (typeof p === "string" && p.length > 0) return [p];
  return [];
}

const PROFILE_AXIS_WEIGHT: Readonly<Record<string, number>> = {
  "low-dexterity": 4,
  audio: 3,
  "low-vision": 2,
  "plain-language": 1,
};

function profileStrictnessScore(profiles: readonly string[]): number {
  const base = profiles.length * 100;
  const weight = profiles.reduce((acc, p) => acc + (PROFILE_AXIS_WEIGHT[p] ?? 1), 0);
  return base + weight;
}

function sameProfileSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

/**
 * Pick the strictest interaction profile from a non-empty list of candidates.
 * Ranked by number of active accommodation profiles first, then by axis weight
 * (`low-dexterity` highest), so an ambiguity never drops an accommodation.
 */
export function pickStrictestInteraction(
  candidates: readonly { key: string; interaction?: Record<string, unknown> }[],
): { key: string; profiles: string[]; interaction?: Record<string, unknown> } | undefined {
  if (candidates.length === 0) return undefined;
  const scored = candidates.map((c) => {
    const profiles = extractProfilesList(c.interaction);
    return { key: c.key, profiles, interaction: c.interaction, score: profileStrictnessScore(profiles) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

export interface InteractionUserEntry {
  aliases?: string[];
  profiles: string[];
  note?: string;
  source?: string;
  [k: string]: unknown;
}

/**
 * Every identity this session can see, strongest first, de-duplicated by
 * (provider, handle). `github` is resolved by {@link githubIdentity} — the
 * same answer `auth_whoami` gives — and the rest are read from the
 * environment, git, and the user-level store.
 */
export async function resolveIdentities(opts: {
  env: Env;
  repo?: string;
  cwd?: string;
  home?: string;
  fetch?: Parameters<typeof githubIdentity>[0]["fetch"];
  /** Injected for tests; default reads `git config`. */
  git?: (key: string) => string | undefined;
  /** The repository's `interaction.json` users, to check who is typing against. */
  users?: Readonly<Record<string, InteractionUserEntry>>;
}): Promise<IdentityResolution> {
  const { env } = opts;
  const git = opts.git ?? ((k: string) => gitConfig(k, opts.cwd));
  const out: Identity[] = [];
  const notes: string[] = [];
  const add = (i: Identity) => {
    if (!out.some((o) => o.provider === i.provider && o.handle === i.handle)) out.push(i);
  };

  const github = await githubIdentity({ env, repo: opts.repo, fetch: opts.fetch });
  if (github.login) add({ provider: "github", handle: github.login, via: github.via === "actions" ? "GITHUB_ACTOR" : "token", vouched: true });
  else notes.push(`github: ${github.reason ?? github.status}`);

  if (env.GITLAB_CI === "true" && env.GITLAB_USER_LOGIN) {
    add({ provider: "gitlab", handle: env.GITLAB_USER_LOGIN, via: "GITLAB_USER_LOGIN", vouched: true });
  }
  if (env.CLAUDE_CODE_USER_EMAIL) add({ provider: "claude", handle: env.CLAUDE_CODE_USER_EMAIL, via: "CLAUDE_CODE_USER_EMAIL", vouched: true });

  const person = parsePersons(env.CAT_HARNESS_PERSON);
  const sessionOverrides: Identity[] = person.ok.map((i) => ({ ...i, via: "CAT_HARNESS_PERSON", vouched: false }));
  for (const i of sessionOverrides) add(i);
  for (const bad of person.bad) notes.push(`CAT_HARNESS_PERSON: \`${bad}\` is not provider:handle`);

  const userConfig = readUserConfig(env, opts.home);
  let activeProfile: string | undefined;
  let multiUserStatus: MultiUserStatus = "single";
  let resolvedInteraction: ResolvedInteraction = { status: "none", matchedUsers: [], profiles: [] };

  if (userConfig.state === "ok") {
    const cfg = userConfig.config;
    // Top-level declared identities (single-user or shared base)
    for (const i of normalizeDeclaredIdentities(cfg.identities)) {
      add({ provider: i.provider, handle: i.handle, via: userConfig.path, vouched: false });
    }
    if (cfg.interaction) {
      resolvedInteraction = {
        status: "matched",
        matchedUsers: ["default"],
        profiles: extractProfilesList(cfg.interaction),
        interaction: cfg.interaction,
      };
    }

    const profileMap = cfg.profiles ? Object.entries(cfg.profiles) : [];
    if (profileMap.length > 0) {
      const explicitSelector = env.CAT_HARNESS_PROFILE || cfg.activeProfile;
      let selectedEntry: [string, PersonProfileConfig] | undefined;

      if (explicitSelector) {
        if (cfg.profiles![explicitSelector]) {
          selectedEntry = [explicitSelector, cfg.profiles![explicitSelector]!];
        } else {
          // Also check if explicitSelector matches a handle/qualified identity inside one profile
          const byHandle = profileMap.filter(([, p]) => {
            const norm = normalizeDeclaredIdentities(p.identities);
            return norm.some((i) => i.handle === explicitSelector || qualified(i) === explicitSelector);
          });
          if (byHandle.length === 1) {
            selectedEntry = byHandle[0];
          } else {
            notes.push(`user config ${userConfig.path}: profile '${explicitSelector}' not found`);
          }
        }
      } else if (sessionOverrides.length > 0) {
        const overrideKeys = new Set(matchKeys(sessionOverrides));
        const byOverride = profileMap.filter(([name, p]) => {
          if (overrideKeys.has(name)) return true;
          const norm = normalizeDeclaredIdentities(p.identities);
          return norm.some((i) => overrideKeys.has(i.handle) || overrideKeys.has(qualified(i)));
        });
        if (byOverride.length === 1) {
          selectedEntry = byOverride[0];
        }
      } else if (profileMap.length === 1) {
        selectedEntry = profileMap[0];
      }

      if (selectedEntry) {
        const [profName, profCfg] = selectedEntry;
        activeProfile = profName;
        multiUserStatus = explicitSelector || sessionOverrides.length > 0 || profileMap.length > 1 ? "selected" : "single";
        for (const i of normalizeDeclaredIdentities(profCfg.identities)) {
          add({ provider: i.provider, handle: i.handle, via: `${userConfig.path}#${profName}`, vouched: false });
        }
        if (profCfg.interaction) {
          resolvedInteraction = {
            status: "selected",
            matchedUsers: [profName],
            profiles: extractProfilesList(profCfg.interaction),
            interaction: profCfg.interaction,
          };
        }
      } else if (profileMap.length > 1) {
        // Multiple profiles on one machine with no disambiguator (or unknown selector).
        const candidates = profileMap.map(([key, p]) => ({ key, interaction: p.interaction }));
        const strictest = pickStrictestInteraction(candidates);
        const firstProfiles = extractProfilesList(profileMap[0]![1].interaction);
        const hasConflict = profileMap.slice(1).some(([, p]) => !sameProfileSet(firstProfiles, extractProfilesList(p.interaction)));
        multiUserStatus = "ambiguous-multi-user";
        resolvedInteraction = {
          status: "ambiguous-multi-user",
          matchedUsers: profileMap.map(([k]) => k),
          profiles: strictest?.profiles ?? [],
          interaction: strictest?.interaction,
        };
        notes.push(
          `ambiguous-multi-user: ${profileMap.length} profiles (${profileMap.map(([k]) => k).join(", ")}) in ${userConfig.path} without disambiguator` +
            (hasConflict ? ` and conflicting interaction profiles; falling back to strictest profile (${strictest?.key ?? "none"})` : "; falling back to strictest profile"),
        );
      }
    }
  } else if (userConfig.state === "unreadable") {
    notes.push(`user config ${userConfig.path}: ${userConfig.reason}`);
  }

  const email = git("user.email");
  const name = git("user.name");
  if (email) add({ provider: "git", handle: email, via: "git config user.email", vouched: false });
  if (name) add({ provider: "git", handle: name, via: "git config user.name", vouched: false });

  const hosts = detectAgentHosts(env);
  for (const h of hosts.filter((h) => !h.exposesIdentity)) {
    notes.push(`${h.id}: the host passes no account to a command; who is typing comes from a forge token, CAT_HARNESS_PERSON, ${userConfigPath(env, opts.home)} or the git author`);
  }

  // The repository's `interaction.json` users, when the caller passes them.
  if (opts.users && Object.keys(opts.users).length > 0 && multiUserStatus !== "ambiguous-multi-user") {
    const explicitUser = env.CAT_HARNESS_PROFILE;
    const overrideKeys = new Set(matchKeys(sessionOverrides));
    const allKeys = new Set(matchKeys(out));
    const entries = Object.entries(opts.users);

    let matched = entries.filter(([userKey, u]) => {
      const names = [userKey, ...(u.aliases ?? [])];
      return names.some((n) => allKeys.has(n));
    });

    // If an explicit disambiguator (`CAT_HARNESS_PROFILE`, or `CAT_HARNESS_PERSON`)
    // singles out one of the users, honour that selection.
    if (explicitUser) {
      const explicitHit = entries.filter(([userKey, u]) => {
        const names = [userKey, ...(u.aliases ?? [])];
        return names.includes(explicitUser);
      });
      if (explicitHit.length === 1) {
        matched = explicitHit;
        activeProfile = explicitHit[0]![0];
        multiUserStatus = "selected";
      }
    } else if (overrideKeys.size > 0 && matched.length > 1) {
      const overrideHit = matched.filter(([userKey, u]) => {
        const names = [userKey, ...(u.aliases ?? [])];
        return names.some((n) => overrideKeys.has(n));
      });
      if (overrideHit.length === 1) {
        matched = overrideHit;
        activeProfile = overrideHit[0]![0];
        multiUserStatus = "selected";
      }
    }

    if (matched.length === 1) {
      const [uKey, uVal] = matched[0]!;
      resolvedInteraction = {
        status: multiUserStatus === "selected" ? "selected" : "matched",
        matchedUsers: [uKey],
        profiles: [...uVal.profiles],
        interaction: uVal as Record<string, unknown>,
      };
    } else if (matched.length > 1) {
      const firstP = matched[0]![1].profiles;
      const conflict = matched.slice(1).some(([, u]) => !sameProfileSet(firstP, u.profiles));
      const strictest = pickStrictestInteraction(
        matched.map(([key, u]) => ({ key, interaction: u as Record<string, unknown> })),
      );
      if (conflict) {
        multiUserStatus = "ambiguous-multi-user";
        resolvedInteraction = {
          status: "ambiguous-multi-user",
          matchedUsers: matched.map(([k]) => k),
          profiles: strictest?.profiles ?? [],
          interaction: strictest?.interaction,
        };
        notes.push(
          `ambiguous-multi-user: session identities matched multiple users (${matched.map(([k]) => k).join(", ")}) with conflicting profiles; falling back to strictest profile (${strictest?.key ?? "none"})`,
        );
      } else {
        resolvedInteraction = {
          status: "matched",
          matchedUsers: matched.map(([k]) => k),
          profiles: strictest?.profiles ?? [],
          interaction: strictest?.interaction,
        };
      }
    } else {
      const strictest = pickStrictestInteraction(
        entries.map(([key, u]) => ({ key, interaction: u as Record<string, unknown> })),
      );
      resolvedInteraction = {
        status: "unknown-user",
        matchedUsers: [],
        profiles: strictest?.profiles ?? [],
        interaction: strictest?.interaction,
      };
    }
  }

  return {
    identities: out,
    github,
    userConfig,
    hosts,
    notes,
    ...(activeProfile !== undefined ? { activeProfile } : {}),
    multiUserStatus,
    interaction: resolvedInteraction,
  };
}

/** `CAT_HARNESS_PERSON`: `provider:handle[,provider:handle…]`, blanks ignored. */
export function parsePersons(value: string | undefined): { ok: { provider: string; handle: string }[]; bad: string[] } {
  const ok: { provider: string; handle: string }[] = [];
  const bad: string[] = [];
  for (const part of (value ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const at = part.indexOf(":");
    if (at > 0 && at < part.length - 1) ok.push({ provider: part.slice(0, at), handle: part.slice(at + 1) });
    else bad.push(part);
  }
  return { ok, bad };
}

/**
 * The strings an interaction entry is matched against: each handle bare (the
 * key form `interaction.json` has always used) and qualified as
 * `provider:handle` (the provider-neutral alias form).
 */
export function matchKeys(identities: readonly Identity[]): string[] {
  const keys = new Set<string>();
  for (const i of identities) {
    keys.add(i.handle);
    keys.add(qualified(i));
  }
  return [...keys];
}
