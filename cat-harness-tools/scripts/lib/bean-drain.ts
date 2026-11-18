/**
 * Shared pieces of the bean-drain Tools: `drain-queue`, `bean-claim-check`
 * and `open-work-lookup` (skill `bean-drain`, beans `n7x7` and `pomp`).
 *
 * Everything that touches git or GitHub goes through two small functions,
 * {@link git} and {@link ghApi}, so the decisions (which beans are drainable,
 * whether a bean is free) are pure and testable without a network.
 *
 * Contracts: `definitions.queue`, `definitions.claimCheck` and
 * `definitions.lookup` of cat-harness `schemas/skills/bean-drain/output.schema.json`.
 *
 * @module scripts/lib/bean-drain
 */
import { spawnSync } from "node:child_process";

/** The bean ref every copy keeps its store on today. */
export const BEAN_REF = "cat/cat-harness/beans";
// declared-path-literal: the drain reads bean copies as git objects on their
// bean branch, in checkouts that may hold no layer declaration at all (a
// clone of the bean branch alone), so there is nothing to resolve `beans/defs`
// through. It is the layout every copy's beans.json declares today; the
// skill's commands name the same path.
export const DEFS_DIR = "beans/defs";

// ── Agents ────────────────────────────────────────────────────────────

export interface Agent {
  name: string;
  /** Commit author strings, `Name <email>`. */
  authors: string[];
  /**
   * false for a writer that mirrors or syncs rather than works a bean (the
   * state bot's "beans from its mount"): its commits never mean "held".
   */
  blocks?: boolean;
}

/**
 * Who is asking. Every cloud thread commits as the same author, so the agent
 * name alone cannot tell this thread from a sibling thread: the session (the
 * `Claude-Session:` trailer) does. Without a session, any recent commit by our
 * own agent kind that reads as a claim counts as somebody else's.
 */
export interface Me {
  agent: string;
  session?: string;
}

/**
 * The table in the `bean-drain` skill. A caller with other agents passes its
 * own file; this is the default, not the definition.
 */
export const DEFAULT_AGENTS: Agent[] = [
  { name: "cloud", authors: ["Claude <noreply@anthropic.com>", "litlfred <litlfred@users.noreply.github.com>"] },
  { name: "agy", authors: ["Carl Leitner <litlfred@fenugreek.home>"] },
  { name: "state-bot", authors: ["folio-state-bot <folio-state-bot@users.noreply.github.com>"], blocks: false },
];

/** Which agent an author string belongs to, or `other`. Matches the email, or the name when no email is listed. */
export function agentOf(author: string, agents: readonly Agent[]): Agent | undefined {
  const email = /<([^>]+)>/.exec(author)?.[1]?.toLowerCase();
  const name = author.replace(/\s*<[^>]*>\s*$/, "").trim().toLowerCase();
  for (const a of agents) {
    for (const want of a.authors) {
      const wEmail = /<([^>]+)>/.exec(want)?.[1]?.toLowerCase();
      const wName = want.replace(/\s*<[^>]*>\s*$/, "").trim().toLowerCase();
      if (wEmail !== undefined ? wEmail === email : wName === name) return a;
    }
  }
  return undefined;
}

// ── Time windows ──────────────────────────────────────────────────────

/** `24h`, `2d`, `1w`, `90m` to milliseconds. Undefined for anything else. */
export function windowMs(w: string): number | undefined {
  const m = /^(\d+)([mhdw])$/.exec(w.trim());
  if (!m) return undefined;
  const unit = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[m[2] as "m" | "h" | "d" | "w"];
  return Number(m[1]) * unit;
}

// ── git and GitHub, the only side effects ──────────────────────────────

export interface Run {
  ok: boolean;
  out: string;
  err: string;
}

export function git(repo: string, args: string[]): Run {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: (r.stderr ?? "") + (r.error ? String(r.error) : "") };
}

/**
 * One GitHub REST call through `gh api`, paginated. REST, not GraphQL: cloud
 * sessions are refused GraphQL (`gh pr list` fails there with HTTP 403).
 */
export function ghApi<T>(path: string): { ok: true; value: T[] } | { ok: false; reason: string } {
  const r = spawnSync("gh", ["api", "--paginate", "--slurp", path], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return { ok: false, reason: (r.stderr || String(r.error ?? "gh failed")).trim().split("\n")[0]! };
  try {
    const pages = JSON.parse(r.stdout) as unknown[];
    return { ok: true, value: pages.flatMap((p) => (Array.isArray(p) ? (p as T[]) : [p as T])) };
  } catch (e) {
    return { ok: false, reason: `unreadable gh output: ${(e as Error).message}` };
  }
}

/** owner/name of a checkout's origin, or undefined. */
export function originRepo(repo: string): string | undefined {
  const url = git(repo, ["remote", "get-url", "origin"]).out.trim();
  return /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(url)?.[1];
}

// ── Bean files ────────────────────────────────────────────────────────

export interface BeanFile {
  id: string;
  /** Path inside the copy, e.g. beans/defs/folio-assistant-f1e1--title.md */
  path: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  updatedAt: string;
  blockedBy: string[];
  parent?: string;
  body: string;
}

/** Front matter fields of a bean, read as text. The beans CLI writes flat YAML; nothing nested is needed here. */
export function parseBean(path: string, text: string): BeanFile | undefined {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return undefined;
  const fm = m[1]!;
  const field = (k: string) => new RegExp(`^${k}:[ \\t]*(.*)$`, "m").exec(fm)?.[1]?.trim().replace(/^['"]|['"]$/g, "").replace(/''/g, "'") ?? "";
  const id = /^#\s*(\S+)/m.exec(fm)?.[1] ?? path.split("/").pop()!.split("--")[0]!;
  const blockedBy: string[] = [];
  const bb = /^blocked_by:[ \t]*\n((?:[ \t]+-[ \t]*\S+\n?)+)/m.exec(fm);
  if (bb) for (const line of bb[1]!.split("\n")) { const v = /-\s*(\S+)/.exec(line)?.[1]; if (v) blockedBy.push(v); }
  return {
    id,
    path,
    title: field("title"),
    status: field("status"),
    type: field("type"),
    priority: field("priority") || "normal",
    updatedAt: field("updated_at"),
    blockedBy,
    ...(field("parent") ? { parent: field("parent") } : {}),
    body: m[2] ?? "",
  };
}

/** Does `id` (full or short) name this bean? */
export function idMatches(beanId: string, id: string): boolean {
  return beanId === id || beanId.endsWith(`-${id}`);
}

/** Every bean at a ref of a copy, read from git objects (no checkout needed). */
export function readBeansAt(repo: string, ref: string): BeanFile[] | { error: string } {
  const ls = git(repo, ["ls-tree", "-r", "--name-only", ref, "--", `${DEFS_DIR}/`]);
  if (!ls.ok) return { error: `cannot list ${DEFS_DIR} at ${ref}: ${ls.err.trim()}` };
  const out: BeanFile[] = [];
  // `archive/` is a view, not the active store (bean-coordination §Archiving).
  const paths = ls.out.split("\n").filter((p) => p.endsWith(".md") && !p.slice(DEFS_DIR.length + 1).includes("/"));
  // One `cat-file --batch` instead of a process per bean.
  const r = spawnSync("git", ["cat-file", "--batch"], { cwd: repo, input: paths.map((p) => `${ref}:${p}`).join("\n") + "\n", maxBuffer: 256 * 1024 * 1024 });
  const buf: Buffer = r.stdout ?? Buffer.alloc(0);
  let at = 0;
  for (const p of paths) {
    const nl = buf.indexOf(10, at);
    if (nl < 0) break;
    const header = buf.subarray(at, nl).toString("utf8").split(" ");
    if (header[1] === "missing" || header.length < 3) { at = nl + 1; continue; }
    const size = Number(header[2]);
    const text = buf.subarray(nl + 1, nl + 1 + size).toString("utf8");
    at = nl + 1 + size + 1;
    const b = parseBean(p, text);
    if (b) out.push(b);
  }
  return out;
}

export interface Commit {
  author: string;
  at: string;
  subject: string;
  /** The `Claude-Session:` trailer, when the commit has one. */
  session?: string;
}

/** The last `n` commits on a bean's file at a ref. */
export function recentCommits(repo: string, ref: string, path: string, n = 3): Commit[] {
  const r = git(repo, ["log", `-${n}`, "--format=%an <%ae>%x1f%cI%x1f%s%x1f%(trailers:key=Claude-Session,valueonly,separator=)%x1e", ref, "--", path]);
  if (!r.ok) return [];
  return r.out.split("\x1e").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [author, at, subject, session] = l.split("\x1f");
    return { author: author!, at: new Date(at!).toISOString(), subject: subject ?? "", ...(session?.trim() ? { session: session.trim() } : {}) };
  });
}

// ── Decisions (pure) ──────────────────────────────────────────────────

export type Exclusion = "goal" | "epic" | "blocked" | "completed" | "scrapped" | "draft" | "owner-held";

const OWNER_HELD = /\b(waits? (on|for) the owner|owner[- ]held|parked|owner'?s (call|decision|choice)|until the owner)\b/i;

/** The last dated note of a bean body, or the whole tail when it has none. */
export function lastNote(body: string): string {
  const notes = body.split(/\n(?=_\d{4}-\d{2}-\d{2})/);
  return notes.length > 1 ? notes[notes.length - 1]! : body.slice(-600);
}

/** Why a bean is not drainable, or undefined when it is. `open` is the set of ids not completed or scrapped. */
export function exclusionOf(b: BeanFile, open: ReadonlySet<string>): { reason: Exclusion; detail?: string } | undefined {
  if (b.type === "milestone") return { reason: "goal" };
  if (b.type === "epic") return { reason: "epic" };
  if (b.status === "completed" || b.status === "scrapped" || b.status === "draft") return { reason: b.status };
  const blockers = b.blockedBy.filter((x) => open.has(x));
  if (blockers.length > 0) return { reason: "blocked", detail: blockers.join(", ") };
  const note = lastNote(b.body);
  if (OWNER_HELD.test(note)) return { reason: "owner-held", detail: note.trim().split("\n")[0]!.slice(0, 200) };
  return undefined;
}

/** bean-coordination's stale-claim threshold, and `bean-stale-in-progress` in `cat health`. */
export const STALE_CLAIM_MS = 14 * 86_400_000;

const CLAIM_NOTE = /\b(claimed|claiming|claim (in-progress|it|this|for)|holds? (it|this)|taking (it|this))\b/i;

export type SkipState = "skip-recent-commit" | "skip-claim-note" | "skip-closed";

/** Is this commit ours: same agent kind and, when both are known, the same session. */
export function isMine(c: Commit, agents: readonly Agent[], me: Me): boolean {
  if (agentOf(c.author, agents)?.name !== me.agent) return false;
  if (me.session !== undefined && c.session !== undefined) return c.session === me.session;
  // Same kind, sessions unknown: ours unless it reads as a claim, which a
  // sibling thread of the same kind may have made.
  return !/\bclaim/i.test(c.subject);
}

/**
 * Is the bean held by somebody else, from the bean branch alone? The open-PR
 * half is {@link pullsNamingBean}. Activity, not status: `in-progress` goes
 * stale, so it decides nothing on its own (bean-coordination §"A quiet claim").
 */
export function heldOnBranch(
  b: BeanFile,
  commits: readonly Commit[],
  agents: readonly Agent[],
  me: Me,
  now: number,
  window: number,
): { state: SkipState; reason: string } | undefined {
  if (b.status === "completed" || b.status === "scrapped") return { state: "skip-closed", reason: `${b.id} is ${b.status}` };
  // The newest commit that means anything decides: if it is ours, we hold the
  // bean (an older sibling commit was superseded by our claim); if it is
  // another agent's and inside the window, they do.
  const newest = commits.find((c) => agentOf(c.author, agents)?.blocks !== false);
  if (newest === undefined || isMine(newest, agents, me)) return undefined;
  if (now - Date.parse(newest.at) <= window) {
    const who = agentOf(newest.author, agents)?.name ?? "another agent";
    return { state: "skip-recent-commit", reason: `${who} (${newest.author}${newest.session ? `, ${newest.session}` : ""}) committed to it at ${newest.at}: ${newest.subject}` };
  }
  const note = lastNote(b.body);
  if (b.status === "in-progress" && CLAIM_NOTE.test(note) && !(me.session !== undefined && note.includes(me.session))) {
    // Older than the window but younger than the stale-claim threshold: still
    // somebody's claim. Past 14 days it is a quiet claim and may be taken
    // (bean-coordination §"A stale claim is reset to todo").
    if (now - Date.parse(newest.at) <= STALE_CLAIM_MS) {
      return { state: "skip-claim-note", reason: `its last note reads as a claim, last touched by ${newest.author} at ${newest.at}` };
    }
  }
  return undefined;
}

// ── Open work on GitHub ───────────────────────────────────────────────

export interface Pull {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  user: { login: string };
  head: { ref: string; sha: string };
}

export interface LookupHit {
  repo: string;
  where: "default-branch" | "open-pr";
  pr?: number;
  head?: string;
  author?: string;
  createdAt?: string;
  match: "file" | "title" | "body" | "branch";
  paths?: string[];
}

export interface Lookup {
  query: { kind: "path" | "prefix" | "bean"; value: string };
  checkedAt: string;
  hits: LookupHit[];
  unread: string[];
}

/** A bean id as a word in free text: `f1e1`, `folio-assistant-f1e1`, `(f1e1)`, `feat/f1e1-x`. */
export function mentionsBean(text: string, id: string): boolean {
  const short = id.replace(/^.*-(?=[a-z0-9]{4}$)/, "");
  return new RegExp(`(^|[^a-z0-9])${short}([^a-z0-9]|$)`, "i").test(text);
}

/** Which open PRs name a bean, by title, body or branch. Pure over a PR list. */
export function pullsNamingBean(repo: string, pulls: readonly Pull[], id: string): LookupHit[] {
  const hits: LookupHit[] = [];
  for (const p of pulls) {
    const match = mentionsBean(p.title, id) ? "title" : mentionsBean(p.head.ref, id) ? "branch" : mentionsBean(p.body ?? "", id) ? "body" : undefined;
    if (match) hits.push({ repo, where: "open-pr", pr: p.number, head: p.head.ref, author: p.user.login, createdAt: p.created_at, match });
  }
  return hits;
}

export interface GitHub {
  openPulls(repo: string): { ok: true; value: Pull[] } | { ok: false; reason: string };
  pullFiles(repo: string, pr: number): { ok: true; value: string[] } | { ok: false; reason: string };
  firstCommitAuthor(repo: string, pr: number): string | undefined;
  /** Does the path exist on the default branch? undefined when it could not be read. */
  onDefault(repo: string, path: string): boolean | undefined;
  /** Default-branch paths under a prefix. */
  defaultPathsUnder(repo: string, prefix: string): string[] | undefined;
}

/** The real GitHub, over REST. */
export const REST: GitHub = {
  openPulls: (repo) => ghApi<Pull>(`repos/${repo}/pulls?state=open&per_page=100`),
  pullFiles: (repo, pr) => {
    const r = ghApi<{ filename: string }>(`repos/${repo}/pulls/${pr}/files?per_page=100`);
    return r.ok ? { ok: true, value: r.value.map((f) => f.filename) } : r;
  },
  firstCommitAuthor: (repo, pr) => {
    const r = ghApi<{ commit: { author: { name: string; email: string } } }>(`repos/${repo}/pulls/${pr}/commits?per_page=1`);
    const a = r.ok ? r.value[0]?.commit.author : undefined;
    return a ? `${a.name} <${a.email}>` : undefined;
  },
  onDefault: (repo, path) => {
    const r = spawnSync("gh", ["api", `repos/${repo}/contents/${path}`, "--silent"], { encoding: "utf8" });
    if (r.status === 0) return true;
    return /HTTP 404/.test(r.stderr ?? "") ? false : undefined;
  },
  defaultPathsUnder: (repo, prefix) => {
    const r = spawnSync("gh", ["api", `repos/${repo}/git/trees/HEAD?recursive=1`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) return undefined;
    try {
      const tree = (JSON.parse(r.stdout) as { tree: Array<{ path: string; type: string }> }).tree;
      return tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix)).map((e) => e.path);
    } catch {
      return undefined;
    }
  },
};

/** The open-work lookup, for one query over many repos. */
export function lookupOpenWork(query: Lookup["query"], repos: readonly string[], gh: GitHub = REST, now = new Date()): Lookup {
  const out: Lookup = { query, checkedAt: now.toISOString(), hits: [], unread: [] };
  for (const repo of repos) {
    const pulls = gh.openPulls(repo);
    if (!pulls.ok) {
      out.unread.push(`${repo}: ${pulls.reason}`);
      continue;
    }
    if (query.kind === "bean") {
      for (const h of pullsNamingBean(repo, pulls.value, query.value)) {
        out.hits.push({ ...h, author: gh.firstCommitAuthor(repo, h.pr!) ?? h.author });
      }
      continue;
    }
    const matches = (p: string) => (query.kind === "path" ? p === query.value : p.startsWith(query.value));
    if (query.kind === "path") {
      const d = gh.onDefault(repo, query.value);
      if (d === undefined) out.unread.push(`${repo}: default branch`);
      else if (d) out.hits.push({ repo, where: "default-branch", match: "file", paths: [query.value] });
    } else {
      const d = gh.defaultPathsUnder(repo, query.value);
      if (d === undefined) out.unread.push(`${repo}: default branch`);
      else if (d.length > 0) out.hits.push({ repo, where: "default-branch", match: "file", paths: d.slice(0, 50) });
    }
    for (const p of pulls.value) {
      const files = gh.pullFiles(repo, p.number);
      if (!files.ok) {
        out.unread.push(`${repo}#${p.number}: ${files.reason}`);
        continue;
      }
      // The files API stops at 3000; a PR at the cap may hide a match.
      if (files.value.length >= 3000) out.unread.push(`${repo}#${p.number}: 3000 or more changed files, list truncated`);
      const hit = files.value.filter(matches);
      if (hit.length > 0) {
        out.hits.push({ repo, where: "open-pr", pr: p.number, head: p.head.ref, author: gh.firstCommitAuthor(repo, p.number) ?? p.user.login, createdAt: p.created_at, match: "file", paths: hit });
      }
    }
  }
  // Oldest first: the first PR opened is the one that holds the work.
  out.hits.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return out;
}

export function renderLookup(l: Lookup): string {
  const lines = [`Lookup ${l.query.kind} \`${l.query.value}\` at ${l.checkedAt}`];
  if (l.hits.length === 0) lines.push(l.unread.length === 0 ? "- no hits on the default branch or any open PR" : "- no hits in what could be read (see unread: this is NOT 'does not exist')");
  for (const h of l.hits) {
    const where = h.where === "open-pr" ? `${h.repo}#${h.pr} (${h.head}, ${h.author}, ${h.createdAt})` : `${h.repo} default branch`;
    lines.push(`- ${where}: ${h.match}${h.paths ? ` ${h.paths.slice(0, 5).join(", ")}${h.paths.length > 5 ? ` and ${h.paths.length - 5} more` : ""}` : ""}`);
  }
  for (const u of l.unread) lines.push(`- unread: ${u}`);
  return lines.join("\n");
}

/** Value of a repeated `--flag v` option. */
export function argList(argv: readonly string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === flag && argv[i + 1] !== undefined) out.push(argv[++i]!);
  return out;
}

export function argOne(argv: readonly string[], flag: string): string | undefined {
  return argList(argv, flag).pop();
}

// ── Copies ────────────────────────────────────────────────────────────

export interface Copy {
  /** Local checkout. */
  path: string;
  /** owner/name of its origin, when GitHub. */
  repo: string;
  /** The bean branch on origin, or the default branch for a store kept on main. */
  branch: string;
  /** Local ref the fetch wrote; read everything from here. */
  ref: string;
}

/**
 * Fetch a copy's bean ref, in its own command (bean pomp case 2: a fetch in
 * the same compound command as the read is not a barrier). The store is on
 * {@link BEAN_REF} when origin has it, else on the default branch.
 */
export function fetchCopy(path: string): Copy | { error: string } {
  const repo = originRepo(path) ?? path;
  const has = git(path, ["ls-remote", "--heads", "origin", BEAN_REF]);
  if (!has.ok) return { error: `${repo}: cannot reach origin: ${has.err.trim().split("\n")[0]}` };
  let branch = BEAN_REF;
  if (has.out.trim() === "") {
    const head = git(path, ["ls-remote", "--symref", "origin", "HEAD"]).out;
    branch = /ref: refs\/heads\/(\S+)\s+HEAD/.exec(head)?.[1] ?? "main";
  }
  const ref = `refs/remotes/origin/${branch}`;
  const f = git(path, ["fetch", "-q", "--depth", "200", "origin", `+refs/heads/${branch}:${ref}`]);
  if (!f.ok) return { error: `${repo}: fetch ${branch} failed: ${f.err.trim().split("\n")[0]}` };
  return { path, repo, branch, ref };
}

export function headSha(c: Copy): string {
  return git(c.path, ["rev-parse", c.ref]).out.trim();
}
