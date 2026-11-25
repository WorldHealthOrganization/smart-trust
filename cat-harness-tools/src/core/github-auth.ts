/**
 * Folio Assistant — GitHub as the authenticator, and what it can and cannot
 * authorize.
 *
 * Owner, 2026-09-24 (issue #1207): *"need Tool fo user auth/auth"*, then *"do
 * github. do strength/weakness of github (all KG or none, no fine grain /
 * sub-graph / node-query-path control)"*. The knowledge graph's data store is a
 * git repository on GitHub, so GitHub is the one place that can say who a
 * caller is. This module asks it, and reports what it answers at the grain it
 * answers at: **one role on one whole repository**.
 *
 * ## What GitHub answers, and the grain it answers at
 *
 * - **Who**: the login behind a token (`GET /user`), or the runner-set
 *   `GITHUB_ACTOR` in a GitHub Actions job.
 * - **What they may do**: their role on the repository: `admin`,
 *   `maintain`, `write`, `triage`, `read`, or `none`. For a person's own token
 *   that is the `permissions` block of `GET /repos/{o}/{r}`; in an Actions job,
 *   where the token is the workflow's, `GET …/collaborators/{login}/permission`.
 *
 * That role covers the **entire** repository: every sub-graph, every node,
 * every path a query could take through it. GitHub has no notion of a graph, so
 * "may read the glossary but not the unpublished chapters" is not something it
 * can be asked. Anything finer is ODRL in `policies/`, decided in process for
 * callers that go through the engine — see `task-authorization.md` §"GitHub as
 * the auth layer", which is where that trade-off is argued.
 *
 * ## Mapping a GitHub role to an actor
 *
 * The role maps onto the three gateway actors that `policies/http-gateway.jsonld`
 * already grants (`owner`, `collaborator`, `viewer`), so a GitHub caller and an
 * HTTP-gateway caller get the same answer from the same policy. The mapping is
 * a property of GitHub's role names, not of any person: no login is written
 * into this repository, which is the rule `policies/` keeps.
 *
 * ## Three answers, never two
 *
 * `authenticated`, `unauthenticated` (GitHub said no, or there is no credential)
 * and `unknown` (GitHub could not be asked: network, rate limit, no repository).
 * `unknown` is never rendered as a pass.
 *
 * @module folio-assistant/core/github-auth
 */

import { execFileSync } from "node:child_process";
import type { Principal } from "./access.js";

/** GitHub's repository roles, highest first. */
export const GITHUB_ROLES = ["admin", "maintain", "write", "triage", "read", "none"] as const;
export type GithubRole = (typeof GITHUB_ROLES)[number];

/**
 * A GitHub repository role → the gateway actor holding the same rights in
 * `policies/http-gateway.jsonld`. `null` is nobody: the `cat-harness:anyone`
 * floor (visualize, render) and nothing else.
 */
export const GITHUB_ROLE_ACTOR: Readonly<Record<GithubRole, string | null>> = {
  admin: "owner",
  maintain: "collaborator",
  write: "collaborator",
  triage: "viewer",
  read: "viewer",
  none: null,
};

export interface GithubIdentity {
  status: "authenticated" | "unauthenticated" | "unknown";
  /** The GitHub login, when GitHub named one. */
  login?: string;
  /** `owner/name` of the repository the role was asked about. */
  repo?: string;
  /** The caller's role on that WHOLE repository. */
  role?: GithubRole;
  /** How the login was established. */
  via?: "token" | "actions";
  /** Why the answer is not `authenticated` with a role, in words. */
  reason?: string;
  /**
   * Who owns the repository: a personal account (`User`) or an
   * `Organization`. It decides which roles can occur at all (see
   * {@link PERSONAL_ACCOUNT_LEVELS}).
   */
  ownerType?: "User" | "Organization";
  /** `public` or `private`: whether read needs any GitHub role at all. */
  visibility?: string;
}

type Env = Readonly<Record<string, string | undefined>>;
type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Owner, 2026-09-24: *"just use github accounts and standard personal account
 * permission levels"*. So there is no login-to-actor table anywhere: GitHub's
 * own levels ARE the mapping. A repository owned by a personal account has
 * exactly these levels. `triage`, `maintain` and a read-only collaborator exist
 * only for organization repositories.
 */
export const PERSONAL_ACCOUNT_LEVELS: ReadonlyArray<{ level: string; role: GithubRole; actor: string | null }> = [
  { level: "owner", role: "admin", actor: "owner" },
  { level: "collaborator", role: "write", actor: "collaborator" },
  { level: "anyone else, on a public repository", role: "read", actor: "viewer" },
  { level: "anyone else, on a private repository", role: "none", actor: null },
];

/** `owner/name` from `GITHUB_REPOSITORY`, or from a GitHub remote URL. */
export function repoSlug(env: Env, remoteUrl?: string): string | undefined {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const m = remoteUrl?.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/**
 * Ask GitHub who the caller is and what role they hold on `repo`.
 *
 * `fetch` and `env` are parameters so tests state them; callers pass the
 * globals. Only read-only GETs are made (two at most), and nothing is cached: a role can
 * be revoked between calls, and a cached "admin" would outlive the revocation.
 */
export async function githubIdentity(opts: {
  env: Env;
  repo?: string;
  fetch?: FetchLike;
  apiBase?: string;
}): Promise<GithubIdentity> {
  const { env, repo } = opts;
  const doFetch = opts.fetch ?? (fetch as unknown as FetchLike);
  const api = opts.apiBase ?? env.GITHUB_API_URL ?? "https://api.github.com";
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  const actionsLogin = env.GITHUB_ACTIONS === "true" ? env.GITHUB_ACTOR : undefined;

  if (!token) {
    if (actionsLogin) {
      return {
        status: "authenticated",
        login: actionsLogin,
        repo,
        via: "actions",
        reason: "no token, so the runner's GITHUB_ACTOR is known but its repository role is not",
      };
    }
    return { status: "unauthenticated", repo, reason: "no GITHUB_TOKEN or GH_TOKEN, and not a GitHub Actions run" };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let login = actionsLogin;
  try {
    if (!login) {
      const res = await doFetch(`${api}/user`, { headers });
      if (res.status === 401) return { status: "unauthenticated", repo, reason: "GitHub rejected the token (401)" };
      if (!res.ok) return { status: "unknown", repo, reason: `GET /user answered ${res.status}` };
      login = ((await res.json()) as { login?: string }).login;
      if (!login) return { status: "unknown", repo, reason: "GET /user named no login (an app or installation token?)" };
    }
    if (!repo) {
      return { status: "authenticated", login, via: actionsLogin ? "actions" : "token", reason: "no repository named, so no role" };
    }
    const via = actionsLogin ? ("actions" as const) : ("token" as const);
    let raw: string | undefined;
    let repoFacts: Pick<GithubIdentity, "ownerType" | "visibility"> = {};
    if (via === "token") {
      // The token IS the caller's, so the repository's own `permissions` block
      // answers for them. It needs only read access to the repository, where
      // the collaborator endpoint below needs push access and answered 403 to
      // an ordinary token when this was first run (2026-09-24).
      const res = await doFetch(`${api}/repos/${repo}`, { headers });
      if (!res.ok) {
        return { status: "authenticated", login, repo, via, reason: `the role could not be read: GET /repos/${repo} answered ${res.status}` };
      }
      const body = (await res.json()) as {
        permissions?: Record<string, boolean>;
        owner?: { type?: string };
        visibility?: string;
      };
      repoFacts = {
        ownerType: body.owner?.type === "User" || body.owner?.type === "Organization" ? body.owner.type : undefined,
        visibility: body.visibility,
      };
      const perms = body.permissions ?? {};
      // `push` and `pull` are the REST names for `write` and `read`.
      const byName: Record<string, GithubRole> = { admin: "admin", maintain: "maintain", push: "write", triage: "triage", pull: "read" };
      raw = Object.keys(byName).find((k) => perms[k]);
      raw = raw ? byName[raw] : "none";
    } else {
      // In an Actions job the token belongs to the workflow, not to the person
      // who triggered it, so the repository's `permissions` would describe the
      // workflow. Ask about the actor by name instead.
      const res = await doFetch(`${api}/repos/${repo}/collaborators/${encodeURIComponent(login!)}/permission`, { headers });
      if (!res.ok) {
        return {
          status: "authenticated",
          login,
          repo,
          via,
          reason: `the role could not be read: GET …/collaborators/${login}/permission answered ${res.status}`,
        };
      }
      const body = (await res.json()) as { role_name?: string; permission?: string };
      raw = body.role_name ?? body.permission;
    }
    const role = (GITHUB_ROLES as readonly string[]).includes(raw ?? "") ? (raw as GithubRole) : undefined;
    return {
      status: "authenticated",
      login,
      repo,
      role,
      via,
      ...repoFacts,
      ...(role ? {} : { reason: `GitHub returned a role this module does not know: "${raw}"` }),
    };
  } catch (e) {
    return { status: "unknown", login, repo, reason: `GitHub could not be reached: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * The principal GitHub vouches for. The GitHub role decides the actor; an actor
 * the caller claims rides along only as `claimed`, because GitHub vouched for a
 * login, not for a BPMN actor. There is deliberately no finer login-to-actor
 * table: the owner ruled that GitHub's own personal-account levels are the
 * mapping ({@link PERSONAL_ACCOUNT_LEVELS}).
 */
export function principalFromGithub(id: GithubIdentity): Principal {
  if (id.status !== "authenticated") return { actor: null, authenticatedBy: "none" };
  return {
    actor: id.role ? GITHUB_ROLE_ACTOR[id.role] : null,
    authenticatedBy: "github",
    account: id.login,
  };
}

/**
 * The principal for a caller working in the checkout at `root`: the repository
 * is read from `GITHUB_REPOSITORY` or the `origin` remote, and GitHub is asked.
 * This is what the BPMN engine authorizes against in strict mode, so that the
 * actor on a step is the one GitHub vouched for, not one the caller typed.
 */
export async function githubPrincipalFor(
  root: string,
  env: Env,
  fetchFn?: FetchLike,
): Promise<{ principal: Principal; identity: GithubIdentity }> {
  let remote: string | undefined;
  try {
    remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf-8" }).trim();
  } catch {
    remote = undefined;
  }
  const identity = await githubIdentity({ env, repo: repoSlug(env, remote), fetch: fetchFn });
  return { principal: principalFromGithub(identity), identity };
}
