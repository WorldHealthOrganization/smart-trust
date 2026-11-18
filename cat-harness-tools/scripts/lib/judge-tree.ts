/**
 * The pieces of the `judge-tree` Tool (cat-harness-tools#399), kept free of
 * process state so each is testable on its own: the tree digest, the runner,
 * the verdict record and its validation, the commit status it is published
 * as, the "has any runner judged this tree?" decision, and the seeded sample.
 *
 * Owner, 2026-10-16: "github should be one Tool of several". A verdict is
 * about a TREE, not about a GitHub run: an agent container, a local machine
 * and GitHub Actions each compute the same digest for the same bytes, and a
 * verdict any of them reached answers for that digest. GitHub is where the
 * verdict is published (a commit status), not where it has to be reached.
 *
 * The network is one interface, {@link GitHubStatuses}, constructed by
 * {@link gitHubStatuses} around an injected `fetch`, so the decision and the
 * payload are tested with no network at all.
 *
 * @module scripts/lib/judge-tree
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const VERDICT_SCHEMA_ID = "cat-harness-verdict-record/v1";
export const TREE_DIGEST_FORMAT = "judge-tree/v1";
/** The commit-status context a verdict is published under. */
export const STATUS_CONTEXT = "judge-tree";

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

// ── The tree digest ──────────────────────────────────────────────────────────

/** The part of an `index.lock.json` layer the digest reads (mount-from-lock.ts `LockInstance`). */
export interface LockEntry {
  instance: string;
  repository?: string;
  path?: string;
  declaration: { file: string; sha256: string };
  directories: { path: string; treeDigest: string }[];
  assets?: { src: string; sha256: string }[];
}

export interface IndexLock {
  instances: LockEntry[];
}

/** Who the caller is (its layer name, or its `owner/name` repository) and the git tree of its PR. */
export interface CallerTree {
  caller: string;
  tree: string;
}

const GIT_TREE = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/**
 * The canonical listing the digest hashes: one line per lock layer, sorted
 * by name, each the layer's locked fixity digests (the declaration's
 * sha256 as `scripts/mount-from-lock.ts` checks it, each directory's
 * `treeDigest`, each asset's sha256), except the caller's, whose line is its
 * git tree instead. A caller absent from the lock (index mode: the root is
 * the caller, and a lock does not pin its own root) is added. The judging
 * scripts' version is the second line, so a change to how trees are judged
 * is a different digest and no stale verdict answers for it.
 */
export function treeListing(lock: IndexLock, caller: CallerTree, judging: string): string {
  if (!GIT_TREE.test(caller.tree)) throw new Error(`caller tree '${caller.tree}' is not a git tree id`);
  if (!judging) throw new Error("no judging-scripts version");
  const isCaller = (e: LockEntry) => e.instance === caller.caller || e.repository === caller.caller;
  const lines = new Map<string, string>();
  for (const e of lock.instances ?? []) {
    if (isCaller(e)) continue;
    const dirs = [...e.directories].sort((a, b) => a.path.localeCompare(b.path)).map((d) => `${d.path}=${d.treeDigest}`);
    const assets = [...(e.assets ?? [])].sort((a, b) => a.src.localeCompare(b.src)).map((a) => `${a.src}=${a.sha256}`);
    lines.set(e.instance, [e.instance, "lock", `decl:${e.declaration.file}=${e.declaration.sha256}`, `dirs:${dirs.join(",")}`, `assets:${assets.join(",")}`].join("\t"));
  }
  const callerName = (lock.instances ?? []).find(isCaller)?.instance ?? caller.caller;
  lines.set(callerName, [callerName, "caller", `git-tree:${caller.tree}`].join("\t"));
  const body = [...lines.keys()].sort().map((k) => lines.get(k)!);
  return [TREE_DIGEST_FORMAT, `judging\t${judging}`, ...body].join("\n") + "\n";
}

export function treeDigest(lock: IndexLock, caller: CallerTree, judging: string): string {
  return sha256(treeListing(lock, caller, judging));
}

/** The files whose bytes are the judging-scripts version, relative to the cat-harness-tools root. */
export function judgingFiles(toolsRoot: string, scriptsDir: string): string[] {
  const py = existsSync(scriptsDir) ? readdirSync(scriptsDir).filter((f) => f.endsWith(".py")).sort().map((f) => join(scriptsDir, f)) : [];
  return [...py, join(toolsRoot, "scripts", "judge-tree.ts"), join(toolsRoot, "scripts", "lib", "judge-tree.ts")];
}

/** sha256 over `<sha256>  <basename>` of each judging file; throws when one is absent (could not determine). */
export function judgingVersion(files: readonly string[]): string {
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length || !files.some((f) => f.endsWith(".py"))) {
    throw new Error(`judging scripts not found (${missing.join(", ") || "no run-gates.py"}); pass --judging <version>`);
  }
  return "sha256:" + sha256(files.map((f) => `${sha256(readFileSync(f))}  ${f.split("/").pop()}\n`).join(""));
}

// ── The runner ───────────────────────────────────────────────────────────────

export type RunnerKind = "agent" | "github-actions" | "local";
export interface Runner {
  kind: RunnerKind;
  id: string;
}

/**
 * Which kind of runner this is, from the environment alone. `JUDGE_RUNNER_KIND`
 * / `JUDGE_RUNNER_ID` override; GitHub Actions sets `GITHUB_ACTIONS=true`; an
 * agent container sets `CLAUDE_CODE_SESSION_ID`, `CLAUDECODE` or `AI_AGENT`;
 * anything else is a local machine.
 */
export function detectRunner(env: Record<string, string | undefined>, host: string): Runner {
  const kinds: RunnerKind[] = ["agent", "github-actions", "local"];
  const forced = env.JUDGE_RUNNER_KIND as RunnerKind | undefined;
  let r: Runner;
  if (env.GITHUB_ACTIONS === "true") {
    const run = env.GITHUB_RUN_ID ? `${env.GITHUB_REPOSITORY ?? "?"}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT ?? "1"}` : host;
    r = { kind: "github-actions", id: run };
  } else if (env.CLAUDE_CODE_SESSION_ID || env.CLAUDECODE || env.AI_AGENT) {
    r = { kind: "agent", id: env.CLAUDE_CODE_SESSION_ID || env.AI_AGENT || host };
  } else {
    r = { kind: "local", id: `${env.USER ?? env.USERNAME ?? "user"}@${host}` };
  }
  if (forced) {
    if (!kinds.includes(forced)) throw new Error(`JUDGE_RUNNER_KIND='${forced}' is not one of ${kinds.join(", ")}`);
    r = { ...r, kind: forced };
  }
  if (env.JUDGE_RUNNER_ID) r = { ...r, id: env.JUDGE_RUNNER_ID };
  return r;
}

// ── run-gates.py reports and junit ───────────────────────────────────────────

/** One gate in run-gates.py's `<out.json>`: `{command, exit, tail, seconds}` or `{command, skipped}`. */
export interface GateResult {
  command?: string;
  exit?: number;
  tail?: string;
  seconds?: number;
  skipped?: string;
}
export type GatesReport = Record<string, GateResult>;

/** compare-gates.py's table rows it counted against head: verdict `NEW FAILURE` or `NEW: could not determine`. */
export function newGatesFromCompare(stdout: string): string[] {
  const out: string[] = [];
  for (const m of stdout.matchAll(/^\| `([^`]+)` \| [^|]* \| [^|]* \| NEW[^|]*\|$/gm)) out.push(m[1]);
  return out;
}

/** compare-test-failures.py's `**New failures: N**`, or undefined when it printed none. */
export function newTestsFromCompare(stdout: string): number | undefined {
  const m = /\*\*New failures: (\d+)\*\*/.exec(stdout);
  return m ? Number(m[1]) : undefined;
}

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&amp;/g, "&") : "";
};

/**
 * Total test cases and the failing ones of a junit report, each named as
 * compare-test-failures.py names it: the enclosing testsuite names and the
 * case's, joined by ` > `.
 */
export function junitSummary(xml: string): { total: number; failing: string[] } {
  const trail: string[] = [];
  const failing: string[] = [];
  let total = 0;
  let open: string | undefined;
  let failed = false;
  for (const m of xml.matchAll(/<(\/?)(testsuites|testsuite|testcase|failure|error)\b[^>]*?(\/?)>/g)) {
    const [tag, close, name, self] = m;
    if (name === "testsuite") {
      if (close) trail.pop();
      else if (!self) trail.push(attr(tag, "name"));
    } else if (name === "testcase") {
      if (close) {
        if (open !== undefined && failed) failing.push(open);
        open = undefined;
      } else {
        total++;
        const id = [...trail, attr(tag, "name")].join(" > ");
        if (self) continue;
        open = id;
        failed = false;
      }
    } else if ((name === "failure" || name === "error") && !close && open !== undefined) {
      failed = true;
    }
  }
  return { total, failing: [...new Set(failing)].sort() };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A junit report holding exactly the given failing tests, so a stored base verdict can stand in for a base run. */
export function junitOf(failing: readonly string[], total: number): string {
  const cases = failing.map((id) => {
    const parts = id.split(" > ");
    const name = parts.pop()!;
    return parts.map((p) => `<testsuite name="${esc(p)}">`).join("") + `<testcase name="${esc(name)}"><failure/></testcase>` + "</testsuite>".repeat(parts.length);
  });
  return `<?xml version="1.0"?><testsuites tests="${total}">${cases.join("")}</testsuites>\n`;
}

/** A stored verdict's gates as run-gates.py's report, so compare-gates.py can read it as the base side. */
export function gatesReportOf(record: VerdictRecord): GatesReport {
  const out: GatesReport = {};
  for (const g of record.gates) {
    out[g.name] = g.skipped !== undefined ? { command: g.command ?? "", skipped: g.skipped } : { command: g.command ?? "", exit: g.exit ?? 2, tail: "", seconds: g.seconds };
  }
  return out;
}

// ── The verdict record ───────────────────────────────────────────────────────

export type Verdict = "green" | "red" | "unknown";

export interface GateEntry {
  name: string;
  exit: number | null;
  seconds: number;
  skipped?: string;
  baseExit?: number | null;
  new?: boolean;
  command?: string;
}

export interface VerdictRecord {
  $schema: typeof VERDICT_SCHEMA_ID;
  treeDigest: string;
  judging: string;
  tree?: { caller: string; callerTree: string; instances: number };
  runner: Runner;
  startedAt: string;
  finishedAt: string;
  gates: GateEntry[];
  tests: { total: number; failed: number; new: number; failing?: string[] };
  base?: { source: "stored-verdict" | "run" | "none"; treeDigest?: string };
  reportUrl?: string;
  verdict: Verdict;
}

/** The gates of a head report, each with its base exit and whether compare-gates.py counted it. */
export function gateEntries(head: GatesReport, base: GatesReport | undefined, newly: readonly string[]): GateEntry[] {
  const isNew = new Set(newly);
  return Object.keys(head).sort().map((name) => {
    const h = head[name];
    const e: GateEntry = h.skipped !== undefined ? { name, exit: null, seconds: 0, skipped: h.skipped } : { name, exit: h.exit ?? 2, seconds: h.seconds ?? 0 };
    if (base) e.baseExit = base[name]?.exit ?? null;
    e.new = isNew.has(name);
    if (h.command) e.command = h.command;
    return e;
  });
}

/**
 * The verdict from the two compare scripts' exit codes: 0 and 0 is green, a 1
 * from either is red, anything else (2, a crash, a missing report) is
 * unknown, and so is a tree on which no gate ran — a verdict on nothing is
 * never green.
 */
export function verdictOf(gatesExit: number, testsExit: number, gatesRun: number): Verdict {
  if (gatesRun === 0) return "unknown";
  if (![0, 1].includes(gatesExit) || ![0, 1].includes(testsExit)) return "unknown";
  return gatesExit === 0 && testsExit === 0 ? "green" : "red";
}

const HEX64 = /^[0-9a-f]{64}$/;
const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const isTime = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && /T/.test(v);

/**
 * Every way `x` is not a verdict record, by `schemas/verdict-record.schema.json`;
 * empty when it is one. Hand-written so it runs with no dependency installed
 * (a runner judging a tree may have none); the schema test holds the two to
 * the same properties.
 */
export function validateVerdictRecord(x: unknown): string[] {
  const errs: string[] = [];
  if (typeof x !== "object" || x === null || Array.isArray(x)) return ["not an object"];
  const r = x as Record<string, unknown>;
  const allowed = new Set(["$schema", "treeDigest", "judging", "tree", "runner", "startedAt", "finishedAt", "gates", "tests", "base", "reportUrl", "verdict"]);
  for (const k of Object.keys(r)) if (!allowed.has(k)) errs.push(`unknown property ${k}`);
  for (const k of ["$schema", "treeDigest", "judging", "runner", "startedAt", "finishedAt", "gates", "tests", "verdict"]) if (!(k in r)) errs.push(`missing ${k}`);
  if ("$schema" in r && r.$schema !== VERDICT_SCHEMA_ID) errs.push(`$schema is not ${VERDICT_SCHEMA_ID}`);
  if ("treeDigest" in r && !(typeof r.treeDigest === "string" && HEX64.test(r.treeDigest))) errs.push("treeDigest is not 64 hex digits");
  if ("judging" in r && !(typeof r.judging === "string" && r.judging.length > 0)) errs.push("judging is empty");
  if (r.tree !== undefined) {
    const t = r.tree as Record<string, unknown>;
    if (typeof t !== "object" || t === null || typeof t.caller !== "string" || typeof t.callerTree !== "string" || !GIT_TREE.test(t.callerTree) || !isInt(t.instances) || (t.instances as number) < 1) errs.push("tree is malformed");
  }
  if ("runner" in r) {
    const u = r.runner as Record<string, unknown>;
    if (typeof u !== "object" || u === null || !["agent", "github-actions", "local"].includes(u.kind as string) || typeof u.id !== "string" || !u.id) errs.push("runner must be {kind: agent|github-actions|local, id}");
  }
  for (const k of ["startedAt", "finishedAt"]) if (k in r && !isTime(r[k])) errs.push(`${k} is not a date-time`);
  if ("gates" in r) {
    if (!Array.isArray(r.gates)) errs.push("gates is not an array");
    else
      r.gates.forEach((g: Record<string, unknown>, i: number) => {
        const at = `gates[${i}]`;
        if (typeof g !== "object" || g === null) return errs.push(`${at} is not an object`);
        for (const k of Object.keys(g)) if (!["name", "exit", "seconds", "skipped", "baseExit", "new", "command"].includes(k)) errs.push(`${at}: unknown property ${k}`);
        if (typeof g.name !== "string" || !g.name) errs.push(`${at}: name`);
        if (!(g.exit === null || isInt(g.exit))) errs.push(`${at}: exit must be an integer or null`);
        if (typeof g.seconds !== "number" || g.seconds < 0) errs.push(`${at}: seconds`);
        if (g.skipped !== undefined && (typeof g.skipped !== "string" || !g.skipped)) errs.push(`${at}: skipped must be a reason`);
        if ((g.exit === null) !== (g.skipped !== undefined)) errs.push(`${at}: exit is null exactly when skipped`);
        if (g.baseExit !== undefined && !(g.baseExit === null || isInt(g.baseExit))) errs.push(`${at}: baseExit`);
        if (g.new !== undefined && typeof g.new !== "boolean") errs.push(`${at}: new`);
        if (g.command !== undefined && typeof g.command !== "string") errs.push(`${at}: command`);
      });
  }
  if ("tests" in r) {
    const t = r.tests as Record<string, unknown>;
    if (typeof t !== "object" || t === null) errs.push("tests is not an object");
    else {
      for (const k of ["total", "failed", "new"]) if (!isInt(t[k]) || (t[k] as number) < 0) errs.push(`tests.${k} must be a whole number`);
      for (const k of Object.keys(t)) if (!["total", "failed", "new", "failing"].includes(k)) errs.push(`tests: unknown property ${k}`);
      if (t.failing !== undefined && !(Array.isArray(t.failing) && t.failing.every((s) => typeof s === "string"))) errs.push("tests.failing must be strings");
    }
  }
  if (r.base !== undefined) {
    const b = r.base as Record<string, unknown>;
    if (typeof b !== "object" || b === null || !["stored-verdict", "run", "none"].includes(b.source as string) || (b.treeDigest !== undefined && !HEX64.test(String(b.treeDigest)))) errs.push("base is malformed");
  }
  if (r.reportUrl !== undefined && !(typeof r.reportUrl === "string" && /^https?:\/\//.test(r.reportUrl))) errs.push("reportUrl is not a URL");
  if ("verdict" in r && !["green", "red", "unknown"].includes(r.verdict as string)) errs.push("verdict must be green, red or unknown");
  return errs;
}

// ── Publishing as a commit status ────────────────────────────────────────────

export interface StatusPayload {
  state: "success" | "failure" | "error";
  context: string;
  description: string;
  target_url?: string;
}

/**
 * The commit status a verdict is published as. The full digest travels in
 * `target_url`'s fragment (`#judge-tree=<digest>`) and its first 16 hex in the
 * description, so a reader of the status alone can tell which tree it judged.
 * `unknown` is `error`, never `success`.
 */
export function statusPayload(rec: VerdictRecord, fallbackUrl?: string): StatusPayload {
  const ran = rec.gates.filter((g) => g.skipped === undefined).length;
  const newGates = rec.gates.filter((g) => g.new).length;
  const state = rec.verdict === "green" ? "success" : rec.verdict === "red" ? "failure" : "error";
  const description = `${rec.verdict}: ${ran} gates, ${newGates} new; tests ${rec.tests.new} new; ${rec.runner.kind}; tree ${rec.treeDigest.slice(0, 16)}`.slice(0, 140);
  const url = rec.reportUrl ?? fallbackUrl;
  return { state, context: STATUS_CONTEXT, description, ...(url ? { target_url: `${url.split("#")[0]}#judge-tree=${rec.treeDigest}` } : {}) };
}

/** A status as the REST API lists it. */
export interface CommitStatus {
  context: string;
  state: string;
  description?: string | null;
  target_url?: string | null;
  updated_at?: string;
}

/** The tree a `judge-tree` status judged: the full digest from target_url, else the 16-hex prefix from the description. */
export function digestOfStatus(s: CommitStatus): { digest?: string; prefix?: string } {
  const full = /#judge-tree=([0-9a-f]{64})$/.exec(s.target_url ?? "");
  if (full) return { digest: full[1] };
  const pre = /\btree ([0-9a-f]{16})\b/.exec(s.description ?? "");
  return pre ? { prefix: pre[1] } : {};
}

/** A verdict that might answer for a tree: from a stored record, or a published status. */
export interface Candidate {
  source: string;
  digest?: string;
  prefix?: string;
  verdict: Verdict;
}

/**
 * The `judge-tree` statuses as candidates, the NEWEST per tree only: the API
 * lists a commit's statuses newest first, and a later verdict on the same
 * tree supersedes an earlier one rather than standing beside it.
 */
export function candidatesFromStatuses(statuses: readonly CommitStatus[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const s of statuses) {
    if (s.context !== STATUS_CONTEXT) continue;
    const d = digestOfStatus(s);
    const key = d.digest ?? d.prefix ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source: `status ${s.target_url ?? s.description ?? ""}`.trim(), ...d, verdict: s.state === "success" ? "green" : s.state === "failure" ? "red" : "unknown" });
  }
  return out;
}

/**
 * Does a green verdict exist for this digest? A candidate answers only when
 * its digest is this one (or its prefix is this one's): a green verdict for
 * another tree is no verdict for this one. A matching red or unknown with no
 * matching green fails with what it said; nothing matching fails with "no
 * runner has judged this tree".
 */
export function decide(digest: string, candidates: readonly Candidate[]): { pass: boolean; message: string } {
  const match = candidates.filter((c) => c.digest === digest || (c.digest === undefined && c.prefix !== undefined && digest.startsWith(c.prefix)));
  const green = match.find((c) => c.verdict === "green");
  if (green) return { pass: true, message: `tree ${digest} judged green (${green.source})` };
  if (match.length) return { pass: false, message: `tree ${digest} was judged ${match.map((c) => `${c.verdict} (${c.source})`).join(", ")}; no runner judged it green` };
  const others = candidates.length ? `; ${candidates.length} verdict(s) found are for other trees` : "";
  return { pass: false, message: `no runner has judged this tree (${digest})${others}` };
}

// ── The seeded sample ────────────────────────────────────────────────────────

/** `n` of the record's RUN gates (skipped ones judge nothing), chosen by sha256(seed + name): the same seed picks the same gates on every runner. */
export function sampleGates(gates: readonly GateEntry[], seed: string, n: number): GateEntry[] {
  return gates
    .filter((g) => g.skipped === undefined && g.exit !== null)
    .map((g) => ({ g, k: sha256(`${seed}\n${g.name}`) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .slice(0, Math.max(0, n))
    .map((x) => x.g);
}

// ── The network, isolated ────────────────────────────────────────────────────

export interface GitHubStatuses {
  post(repo: string, sha: string, payload: StatusPayload): Promise<void>;
  list(repo: string, sha: string): Promise<CommitStatus[]>;
}

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/** The two REST calls, against `api` (default api.github.com), with `fetch` injected so a test needs no network. */
export function gitHubStatuses(token: string | undefined, fetchImpl: Fetch, api = "https://api.github.com"): GitHubStatuses {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "cat-harness-tools/judge-tree" };
  if (token) headers.authorization = `Bearer ${token}`;
  const check = (repo: string, sha: string) => {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error(`repository '${repo}' is not owner/name`);
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error(`'${sha}' is not a commit sha`);
  };
  return {
    async post(repo, sha, payload) {
      check(repo, sha);
      const r = await fetchImpl(`${api}/repos/${repo}/statuses/${sha}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(`POST statuses/${sha}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    },
    async list(repo, sha) {
      check(repo, sha);
      const r = await fetchImpl(`${api}/repos/${repo}/commits/${sha}/statuses?per_page=100`, { headers });
      if (!r.ok) throw new Error(`GET commits/${sha}/statuses: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
      return (await r.json()) as CommitStatus[];
    },
  };
}
