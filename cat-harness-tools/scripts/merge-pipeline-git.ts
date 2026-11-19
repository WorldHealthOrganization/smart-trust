/**
 * Git plumbing shared by the merge-pipeline commands: run git without
 * throwing, and turn a member spec (a PR number, `N:sha`, a branch or a SHA)
 * into a commit.
 *
 * @module scripts/merge-pipeline-git
 * @graphNode none — helpers, read by `merge-train.ts`, `merge-overlap.ts` and `merge-leftover.ts`
 */
import { spawnSync } from "node:child_process";

/** The outcome of one git command. Never throws: a failure is data. */
export interface GitResult {
  ok: boolean;
  code: number;
  out: string;
  err: string;
}

/** Run git in `root`. `input` is fed on stdin; `env` is merged into the environment. */
export function git(root: string, args: readonly string[], opts: { input?: string; env?: Record<string, string> } = {}): GitResult {
  const r = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf-8",
    input: opts.input,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    maxBuffer: 256 * 1024 * 1024,
  });
  return { ok: r.status === 0, code: r.status ?? -1, out: (r.stdout ?? "").trimEnd(), err: (r.stderr ?? "").trim() };
}

/** What a member spec names, before anything is fetched. */
export type MemberSpec =
  | { kind: "pr"; spec: string; number: number; sha?: string }
  | { kind: "ref"; spec: string; ref: string };

/**
 * Parse a member spec.
 *
 * - `1234`, `#1234` — a pull request; its head is fetched as `pull/1234/head`.
 * - `1234:<sha>` — a pull request PINNED to a head: the steward's scratch
 *   scripts took this form, so a train is built from the heads CI saw rather
 *   than whatever was pushed since.
 * - anything else — a ref: `origin/<branch>`, a bare branch, or a SHA.
 */
export function parseMemberSpec(spec: string): MemberSpec {
  const s = spec.trim();
  const m = /^#?(\d+)(?::([0-9a-f]{7,40}))?$/i.exec(s);
  if (m) {
    const out: MemberSpec = { kind: "pr", spec: s, number: Number(m[1]) };
    if (m[2]) out.sha = m[2].toLowerCase();
    return out;
  }
  return { kind: "ref", spec: s, ref: s };
}

/** A member resolved to a commit, or the reason it could not be. */
export type ResolvedMember =
  | { spec: MemberSpec; sha: string; label: string }
  | { spec: MemberSpec; error: string; label: string };

/** The label a report uses for a member: `#N` for a PR, else the ref as given. */
export function memberLabel(spec: MemberSpec): string {
  return spec.kind === "pr" ? `#${spec.number}` : spec.ref;
}

/**
 * Resolve a member to a commit in `root`.
 *
 * A PR head is fetched from `remote` unless the pinned SHA is already present.
 * A ref is tried locally first, then as `<remote>/<ref>` after fetching the
 * branch. With `fetch: false` nothing touches the network, which is what the
 * tests and `--no-fetch` use.
 */
export function resolveMember(root: string, spec: MemberSpec, opts: { remote?: string; fetch?: boolean } = {}): ResolvedMember {
  const remote = opts.remote ?? "origin";
  const fetch = opts.fetch ?? true;
  const label = memberLabel(spec);
  const verify = (ref: string): string | undefined => {
    const r = git(root, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
    return r.ok && r.out ? r.out : undefined;
  };
  if (spec.kind === "pr") {
    if (spec.sha) {
      let sha = verify(spec.sha);
      if (!sha && fetch) {
        git(root, ["fetch", "-q", remote, spec.sha]);
        sha = verify(spec.sha);
      }
      if (!sha && fetch) {
        git(root, ["fetch", "-q", remote, `pull/${spec.number}/head`]);
        sha = verify(spec.sha);
      }
      return sha ? { spec, sha, label } : { spec, label, error: `pinned head ${spec.sha} could not be fetched` };
    }
    if (!fetch) return { spec, label, error: "a PR number needs a fetch (or pin it as N:sha)" };
    const f = git(root, ["fetch", "-q", remote, `pull/${spec.number}/head`]);
    if (!f.ok) return { spec, label, error: `fetch pull/${spec.number}/head failed: ${f.err || `exit ${f.code}`}` };
    const sha = verify("FETCH_HEAD");
    return sha ? { spec, sha, label } : { spec, label, error: "FETCH_HEAD did not resolve after the fetch" };
  }
  const local = verify(spec.ref);
  if (local) return { spec, sha: local, label };
  if (fetch) {
    const branch = spec.ref.startsWith(`${remote}/`) ? spec.ref.slice(remote.length + 1) : spec.ref;
    git(root, ["fetch", "-q", remote, branch]);
    const sha = verify(`${remote}/${branch}`) ?? verify("FETCH_HEAD");
    if (sha) return { spec, sha, label };
  }
  return { spec, label, error: `no such ref ${spec.ref}` };
}
