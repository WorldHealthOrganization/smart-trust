#!/usr/bin/env bun
/**
 * stage-workflow-local — build a repository's PR preview in the agent's own
 * container by REPLAYING the steps of its staging workflow, then publish it
 * with the workflow's own deploy step and a build record CI checks later.
 *
 * @module scripts/stage-workflow-local
 * @covers none — a PUBLISHER: it replays one workflow job and deploys one preview; it judges nothing
 *
 * ```sh
 * bun run cat-harness-tools/scripts/stage-workflow-local.ts --repo . [--branch B] [--base main] [--pr N] [--plan] [--no-push]
 * ```
 *
 * `stage-local.ts` builds a folio from the inputs of `folio-staging.yml`, and
 * an IG or a `site.build` repository from its recipe. A preview whose build is
 * written inline in a workflow job (folio-assistant's `stage` job of
 * `feature-staging.yml`) is replayed instead, so the workflow stays the one
 * definition of the build: an agent build and CI's full recheck run the same
 * steps on the same tree, and a difference between them is a real difference.
 *
 * ## What is replayed, and what is not
 *
 * - The tree: the branch's head merged with its base, in a detached worktree,
 *   exactly the tree of the PR's test merge commit when the base has not
 *   moved. A conflict refuses: GitHub stages a conflicted PR from its head,
 *   and so must you, with `--no-merge`.
 * - Every `run:` step, in order, with `if:`, `env:`, `working-directory`,
 *   `continue-on-error`, `shell:`, `$GITHUB_OUTPUT`, `$GITHUB_ENV`,
 *   `$GITHUB_PATH` and `steps.<id>.outputs/outcome` as Actions gives them
 *   ({@link evaluate}). The event is `pull_request`.
 * - Local composite actions (`uses: ./…`): their own `run:` steps, with
 *   `inputs.*` and `$GITHUB_ACTION_PATH`.
 * - Marketplace actions, by what they do here ({@link USES}): `checkout` of
 *   the tree is the worktree itself, and a checkout with a `path` clones that
 *   ref there (the publish branch); `setup-bun` and `setup-ruby` check the
 *   container has the version and install the bundle; the caches and the
 *   artifact upload are skipped (a cache only saves time; the hand-off goes to
 *   CI's own Liquid check); `github-script` steps (PR comments) are skipped,
 *   since the PR's own run comments when it defers.
 * - The build record says `builder: agent` (`CAT_PREVIEW_BUILDER`), which is
 *   what makes the PR's run defer to the CI recheck.
 *
 * ## Order matters: preview first, then the branch
 *
 * Run this BEFORE pushing the commit. The PR's own run looks for an agent
 * record of its tree when the push arrives; a record that lands later is
 * found by nothing until the next push, and that run builds in full as usual.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { readIndexConfig } from "../schemas/kg/index-config.js";
import { checkoutOwner } from "../schemas/kg/repo-owner.ts";

// ── Expressions ───────────────────────────────────────────────────

export type Value = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface ExprContext {
  /** Dotted lookups: `github.sha`, `inputs.x`, `steps.id.outputs.k`, `env.X`, `vars.X`, `secrets.X`. */
  lookup(path: string[]): Value;
  /** Whether a step before this one failed (and was not continue-on-error). */
  failed: boolean;
  hashFiles?(patterns: string[]): string;
}

type Tok = { k: "str"; v: string } | { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let s = "";
      i++;
      for (;;) {
        if (i >= src.length) throw new Error(`unterminated string in: ${src}`);
        if (src[i] === "'" && src[i + 1] === "'") { s += "'"; i += 2; continue; }
        if (src[i] === "'") { i++; break; }
        s += src[i++];
      }
      out.push({ k: "str", v: s });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "&&", "||", "<=", ">="].includes(two)) { out.push({ k: "op", v: two }); i += 2; continue; }
    if ("!()<>,[]".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_.\-*]*/.exec(src.slice(i));
    if (id) { out.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    throw new Error(`cannot read '${c}' in: ${src}`);
  }
  return out;
}

/** Actions' truthiness: false, 0, '', null are false. */
export function truthy(v: Value): boolean {
  return !(v === false || v === 0 || v === "" || v === null || v === undefined);
}

function str(v: Value): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Loose equality as Actions does it: strings compare case-insensitively; mixed types compare as numbers. */
function looseEq(a: Value, b: Value): boolean {
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  if (typeof a === typeof b) return a === b;
  const n = (v: Value) => (v === null || v === undefined ? 0 : v === true ? 1 : v === false ? 0 : typeof v === "string" ? (v.trim() === "" ? 0 : Number(v)) : NaN);
  return n(a) === n(b);
}

/** Evaluate a GitHub Actions expression (the subset the staging workflows use). */
export function evaluate(src: string, ctx: ExprContext): Value {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const eat = (v?: string) => {
    const x = t[p++];
    if (!x || (v !== undefined && !(x.k === "op" && x.v === v))) throw new Error(`expected ${v ?? "a token"} in: ${src}`);
    return x;
  };
  const isOp = (v: string) => peek()?.k === "op" && (peek() as { v: string }).v === v;
  const or = (): Value => { let l = and(); while (isOp("||")) { eat(); const r = and(); l = truthy(l) ? l : r; } return l; };
  const and = (): Value => { let l = cmp(); while (isOp("&&")) { eat(); const r = cmp(); l = truthy(l) ? r : l; } return l; };
  const cmp = (): Value => {
    const l = unary();
    if (isOp("==")) { eat(); return looseEq(l, unary()); }
    if (isOp("!=")) { eat(); return !looseEq(l, unary()); }
    return l;
  };
  const unary = (): Value => (isOp("!") ? (eat(), !truthy(unary())) : primary());
  const call = (name: string): Value => {
    eat("(");
    const args: Value[] = [];
    while (!isOp(")")) { args.push(or()); if (isOp(",")) eat(","); }
    eat(")");
    switch (name.toLowerCase()) {
      case "success": return !ctx.failed;
      case "failure": return ctx.failed;
      case "always": return true;
      case "cancelled": return false;
      case "format": return str(args[0] ?? "").replace(/\{(\d+)\}/g, (_, n) => str(args[Number(n) + 1] ?? ""));
      case "contains": return Array.isArray(args[0]) ? args[0].some((x) => looseEq(x as Value, args[1] ?? "")) : str(args[0] ?? "").toLowerCase().includes(str(args[1] ?? "").toLowerCase());
      case "startswith": return str(args[0] ?? "").toLowerCase().startsWith(str(args[1] ?? "").toLowerCase());
      case "endswith": return str(args[0] ?? "").toLowerCase().endsWith(str(args[1] ?? "").toLowerCase());
      case "hashfiles": return ctx.hashFiles ? ctx.hashFiles(args.map(str)) : "";
      case "tojson": return JSON.stringify(args[0] ?? null);
      default: throw new Error(`function ${name}() is not replayed: ${src}`);
    }
  };
  const primary = (): Value => {
    const x = eat();
    if (x.k === "str" || x.k === "num") return x.v;
    if (x.k === "op" && x.v === "(") { const v = or(); eat(")"); return v; }
    if (x.k === "id") {
      if (x.v === "true") return true;
      if (x.v === "false") return false;
      if (x.v === "null") return null;
      if (isOp("(")) return call(x.v);
      return ctx.lookup(x.v.split("."));
    }
    throw new Error(`unexpected '${x.v}' in: ${src}`);
  };
  const v = or();
  if (p !== t.length) throw new Error(`unexpected trailing input in: ${src}`);
  return v;
}

/** Substitute every `${{ … }}` in a string. */
export function interpolate(s: string, ctx: ExprContext): string {
  return s.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e: string) => str(evaluate(e.trim(), ctx)));
}

/** A step's `if:`, as Actions reads it: `${{ }}` optional; no status function means `success() && (…)`. */
export function stepRuns(cond: unknown, ctx: ExprContext): boolean {
  if (cond === undefined || cond === null || cond === "") return !ctx.failed;
  if (typeof cond === "boolean") return cond && !ctx.failed;
  let e = String(cond).trim();
  const m = /^\$\{\{([\s\S]*)\}\}$/.exec(e);
  if (m) e = m[1]!.trim();
  if (!/\b(success|failure|always|cancelled)\s*\(/.test(e)) e = `success() && (${e})`;
  return truthy(evaluate(e, ctx));
}

// ── $GITHUB_OUTPUT / $GITHUB_ENV ──────────────────────────────────

/** Parse a `$GITHUB_OUTPUT`/`$GITHUB_ENV` file: `k=v` lines and `k<<DELIM … DELIM` blocks. */
export function parseCommandFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "") continue;
    const heredoc = /^([^=<]+)<<(.+)$/.exec(line);
    if (heredoc) {
      const [, k, delim] = heredoc;
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== delim) body.push(lines[i++]!);
      out[k!] = body.join("\n");
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

// ── The replay ────────────────────────────────────────────────────

export interface Step {
  id?: string;
  name?: string;
  if?: unknown;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
  "working-directory"?: string;
  "continue-on-error"?: boolean | string;
}

export type UsesKind = "checkout" | "setup-bun" | "setup-ruby" | "skip" | "local";

/** What a `uses:` does in the agent's container. Anything not named here refuses: a replay never guesses. */
export const USES: ReadonlyArray<{ match: RegExp; kind: UsesKind; why: string }> = [
  { match: /^actions\/checkout@/, kind: "checkout", why: "the tree is the worktree; a checkout with a path clones that ref there" },
  { match: /^oven-sh\/setup-bun@/, kind: "setup-bun", why: "bun is the one running this; its version is checked" },
  { match: /^ruby\/setup-ruby@/, kind: "setup-ruby", why: "ruby must be on PATH; the bundle is installed when bundler-cache asks" },
  { match: /^actions\/cache(\/restore|\/save)?@/, kind: "skip", why: "a cache only saves time" },
  { match: /^actions\/upload-artifact@/, kind: "skip", why: "the artifact feeds CI's own jobs, not the preview" },
  { match: /^actions\/github-script@/, kind: "skip", why: "PR comments: the PR's own run comments when it defers" },
  { match: /^\.\//, kind: "local", why: "a local composite action: its run steps are replayed" },
];

export function usesKind(uses: string): UsesKind {
  const u = USES.find((x) => x.match.test(uses));
  if (!u) throw new Error(`uses: ${uses} has no local replay; name it in USES with what it does, or the replay cannot be faithful`);
  return u.kind;
}

export interface ReplayOptions {
  repo: string;
  workflow: string;
  job: string;
  branch: string;
  base: string;
  pr?: number;
  merge: boolean;
  plan: boolean;
  push: boolean;
  log: (s: string) => void;
}

const git = (cwd: string, args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();

function ownerRepo(repo: string): string {
  const url = git(repo, ["config", "--get", "remote.origin.url"]);
  const m = /github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/.exec(url);
  if (!m) throw new Error(`origin (${url}) is not a GitHub remote`);
  return m[1]!;
}

function ghJson(path: string): unknown {
  const r = spawnSync("gh", ["api", path], { encoding: "utf-8" });
  return r.status === 0 ? JSON.parse(r.stdout) : undefined;
}

/** The GitHub repositories the checkout's index config mounts layers from. */
export function instanceRepos(repo: string): string[] {
  const r = readIndexConfig(repo);
  if (!("config" in r)) return [];
  const out = new Set<string>();
  for (const i of (r.config as { instances?: Array<{ source?: { remote?: { repository?: string } } }> }).instances ?? []) {
    const name = i.source?.remote?.repository;
    // A bare name is same-owner (cat-harness-tools#2337).
    if (name && /^[\w.-]+$/.test(name)) {
      const owner = checkoutOwner(repo);
      if (owner) out.add(`${owner}/${name}`);
    } else if (name && /^[\w.-]+\/[\w.-]+$/.test(name)) out.add(name);
  }
  return [...out].sort();
}

/** JAVA_HOME_<n>_X64, as GitHub's images set them, from the JVMs this container has. */
export function javaHomes(dir = "/usr/lib/jvm"): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const m = /(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/.exec(e);
    if (m && existsSync(join(dir, e, "bin", "java")) && !out[`JAVA_HOME_${m[1]}_X64`]) out[`JAVA_HOME_${m[1]}_X64`] = join(dir, e);
  }
  return out;
}

export async function replay(o: ReplayOptions): Promise<{ steps: number; ran: number; failed: string[]; site?: string }> {
  const repo = resolve(o.repo);
  const wf = parseYaml(readFileSync(join(repo, ".github", "workflows", o.workflow), "utf-8")) as { jobs?: Record<string, { steps?: Step[] }> };
  const steps = wf.jobs?.[o.job]?.steps;
  if (!steps?.length) throw new Error(`${o.workflow} has no job '${o.job}' with steps`);
  const slugRepo = ownerRepo(repo);
  const [owner, name] = slugRepo.split("/") as [string, string];
  for (const s of steps) if (s.uses) usesKind(s.uses);

  git(repo, ["fetch", "-q", "origin", o.base]);
  const head = git(repo, ["rev-parse", "HEAD"]);
  const baseSha = git(repo, ["rev-parse", "FETCH_HEAD"]);
  const pr = o.pr ?? (ghJson(`repos/${slugRepo}/pulls?state=open&head=${owner}:${encodeURIComponent(o.branch)}`) as Array<{ number: number }> | undefined)?.[0]?.number;
  const prData = pr ? (ghJson(`repos/${slugRepo}/pulls/${pr}`) as Record<string, unknown> | undefined) : undefined;

  o.log(`plan: replay ${o.workflow} › ${o.job} (${steps.length} steps) for ${slugRepo}@${o.branch} (${head.slice(0, 7)})${o.merge ? ` merged with origin/${o.base} (${baseSha.slice(0, 7)})` : ""}, as a pull_request${pr ? ` of #${pr}` : ""}; builder: agent${o.push ? "" : "; the deploy step is NOT run (--no-push)"}`);
  for (const s of steps) {
    const what = s.uses ? `uses ${s.uses.split("@")[0]} (${usesKind(s.uses)})` : "run";
    o.log(`  · ${s.name ?? s.id ?? what}${s.if !== undefined ? ` [if ${String(s.if).replace(/\s+/g, " ").slice(0, 80)}]` : ""} — ${what}`);
  }
  if (o.plan) return { steps: steps.length, ran: 0, failed: [] };

  // The build reads every mounted layer's repository through the GitHub
  // API (its releases, for the IG indexes). A runner's token reads any public
  // repository; an agent session's often reads only the repositories attached
  // to it. Found on the first trial replay (2026-11-01): derive:publish failed
  // after 14 min on a 403 for the IG repositories' releases. Said up front,
  // not refused: not every layer's API is read, and which are is the
  // build's business, not this file's.
  const unreachable = instanceRepos(repo).filter((r) => spawnSync("gh", ["api", `repos/${r}`, "--silent"], { encoding: "utf-8" }).status !== 0);
  if (unreachable.length) o.log(`⚠ the GitHub API does not answer for ${unreachable.join(", ")} from this session. If a step fails on a 403, attach those repositories and run again (the IG repositories' releases are read by derive:publish).`);

  const wt = mkdtempSync(join(tmpdir(), "stage-replay-"));
  git(repo, ["worktree", "add", "-q", "--detach", wt, head]);
  if (o.merge) {
    const m = spawnSync("git", ["-C", wt, "-c", "user.name=stage-replay", "-c", "user.email=stage-replay@localhost", "merge", "-q", "--no-edit", baseSha], { encoding: "utf-8" });
    if (m.status !== 0) {
      git(repo, ["worktree", "remove", "--force", wt]);
      throw new Error(`the branch does not merge cleanly with origin/${o.base}: GitHub stages a conflicted PR from its head, so pass --no-merge`);
    }
  }
  const sha = git(wt, ["rev-parse", "HEAD"]);
  const temp = mkdtempSync(join(tmpdir(), "stage-runner-temp-"));
  const runId = `agent-${sha.slice(0, 12)}`;
  const event = {
    pull_request: { number: pr ?? 0, head: { ref: o.branch, sha: head }, base: { ref: o.base, sha: baseSha }, title: prData?.title ?? "", body: prData?.body ?? "" },
    repository: { name, full_name: slugRepo, owner: { login: owner } },
  };
  writeFileSync(join(temp, "event.json"), JSON.stringify(event));
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? spawnSync("gh", ["auth", "token"], { encoding: "utf-8" }).stdout.trim();
  const github: Record<string, Value> = {
    event_name: "pull_request", sha, ref: `refs/pull/${pr ?? 0}/merge`, ref_name: `${pr ?? 0}/merge`, head_ref: o.branch, base_ref: o.base,
    repository: slugRepo, repository_owner: owner, run_id: runId, server_url: "https://github.com", workspace: wt, token, event,
  };
  const varsCache = new Map<string, string>();
  const stepState: Record<string, { outputs: Record<string, string>; outcome: string; conclusion: string }> = {};
  let env: Record<string, string> = {
    ...javaHomes(),
    ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)),
    CI: "true", GITHUB_ACTIONS: "true", GITHUB_WORKSPACE: wt, GITHUB_SHA: sha, GITHUB_REF: String(github.ref), GITHUB_REF_NAME: String(github.ref_name),
    GITHUB_HEAD_REF: o.branch, GITHUB_BASE_REF: o.base, GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: join(temp, "event.json"),
    GITHUB_REPOSITORY: slugRepo, GITHUB_REPOSITORY_OWNER: owner, GITHUB_RUN_ID: runId, GITHUB_SERVER_URL: "https://github.com",
    RUNNER_TEMP: temp, RUNNER_OS: "Linux", CAT_PREVIEW_BUILDER: "agent", GH_TOKEN: token,
  };
  const ctxFor = (failed: boolean, extra: Record<string, Value> = {}): ExprContext => ({
    failed,
    lookup: (path) => {
      const [root, ...rest] = path;
      const dig = (v: unknown, ks: string[]): Value => ks.reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), v) as Value ?? "";
      switch (root) {
        case "github": return dig(github, rest);
        case "inputs": return extra.inputs !== undefined ? dig(extra.inputs, rest) : "";
        case "steps": return dig(stepState, rest);
        case "env": return env[rest.join(".")] ?? "";
        case "secrets": return rest[0] === "GITHUB_TOKEN" ? token : "";
        case "vars": {
          const k = rest.join(".");
          if (!varsCache.has(k)) varsCache.set(k, String((ghJson(`repos/${slugRepo}/actions/variables/${k}`) as { value?: string } | undefined)?.value ?? ""));
          return varsCache.get(k)!;
        }
        case "runner": return rest[0] === "temp" ? temp : rest[0] === "os" ? "Linux" : "";
        default: throw new Error(`context '${root}' is not replayed`);
      }
    },
    hashFiles: (ps) => ps.map((p) => (existsSync(join(wt, p)) ? git(wt, ["hash-object", p]) : "")).join(""),
  });

  let failed = false;
  const failures: string[] = [];
  let ran = 0;
  const runScript = (script: string, shell: string | undefined, cwd: string, stepEnv: Record<string, string>, label: string): boolean => {
    const file = join(temp, `step-${ran}.sh`);
    writeFileSync(file, script);
    const outputs = join(temp, `out-${ran}`), envFile = join(temp, `env-${ran}`), pathFile = join(temp, `path-${ran}`);
    for (const f of [outputs, envFile, pathFile]) writeFileSync(f, "");
    const argv = shell === "bash" ? ["--noprofile", "--norc", "-eo", "pipefail", file] : ["-e", file];
    if (shell && shell !== "bash") throw new Error(`${label}: shell '${shell}' is not replayed`);
    const r = spawnSync("bash", argv, { cwd, stdio: "inherit", env: { ...env, ...stepEnv, GITHUB_OUTPUT: outputs, GITHUB_ENV: envFile, GITHUB_PATH: pathFile, GITHUB_STEP_SUMMARY: join(temp, "summary.md") } });
    lastOutputs = parseCommandFile(readFileSync(outputs, "utf-8"));
    env = { ...env, ...parseCommandFile(readFileSync(envFile, "utf-8")) };
    for (const pth of readFileSync(pathFile, "utf-8").split("\n").filter(Boolean)) env.PATH = `${pth}:${env.PATH}`;
    return r.status === 0;
  };
  let lastOutputs: Record<string, string> = {};

  try {
    for (const s of steps) {
      const label = s.name ?? s.id ?? s.uses ?? "step";
      const ctx = ctxFor(failed);
      if (!stepRuns(s.if, ctx)) {
        if (s.id) stepState[s.id] = { outputs: {}, outcome: "skipped", conclusion: "skipped" };
        o.log(`○ ${label} (skipped by its if)`);
        continue;
      }
      if (!o.push && /^Deploy the preview/.test(label)) {
        o.log(`○ ${label} (--no-push)`);
        if (s.id) stepState[s.id] = { outputs: {}, outcome: "skipped", conclusion: "skipped" };
        continue;
      }
      const stepEnv = Object.fromEntries(Object.entries(s.env ?? {}).map(([k, v]) => [k, interpolate(String(v), ctx)]));
      const withs = Object.fromEntries(Object.entries(s.with ?? {}).map(([k, v]) => [k, interpolate(String(v), ctx)]));
      const cwd = s["working-directory"] ? resolve(wt, interpolate(s["working-directory"], ctx)) : wt;
      o.log(`▶ ${label}`);
      ran++;
      lastOutputs = {};
      let ok = true;
      if (s.run !== undefined) {
        ok = runScript(interpolate(s.run, ctx), s.shell, cwd, stepEnv, label);
      } else if (s.uses) {
        const kind = usesKind(s.uses);
        if (kind === "checkout") {
          if (withs.path) {
            const dest = resolve(wt, withs.path);
            rmSync(dest, { recursive: true, force: true });
            const url = git(repo, ["config", "--get", "remote.origin.url"]);
            ok = spawnSync("git", ["clone", "-q", "--depth", "1", ...(withs.ref ? ["--branch", withs.ref] : []), url, dest], { stdio: "inherit" }).status === 0;
          }
        } else if (kind === "setup-bun") {
          const v = spawnSync("bun", ["--version"], { encoding: "utf-8" }).stdout.trim();
          if (withs["bun-version"] && withs["bun-version"] !== v) o.log(`  ⚠ bun ${v} here; the workflow pins ${withs["bun-version"]}. An output that depends on it will differ, and CI's recheck will say so.`);
        } else if (kind === "setup-ruby") {
          const rv = spawnSync("ruby", ["-e", "print RUBY_VERSION"], { encoding: "utf-8" });
          if (rv.status !== 0) throw new Error(`${label}: no ruby on PATH; install Ruby ${withs["ruby-version"] ?? ""} to replay the Jekyll build`);
          if (withs["ruby-version"] && !rv.stdout.startsWith(String(withs["ruby-version"]))) o.log(`  ⚠ ruby ${rv.stdout} here; the workflow asks for ${withs["ruby-version"]}`);
          if (withs["bundler-cache"] === "true") {
            // As setup-ruby does it: the bundle in vendor/bundle beside the
            // Gemfile, so `bundle exec` finds its executables there and not
            // in whatever the container's gem home happens to hold.
            const dir = resolve(wt, withs["working-directory"] ?? ".");
            ok = spawnSync("bundle", ["config", "set", "--local", "path", "vendor/bundle"], { cwd: dir, stdio: "inherit", env }).status === 0
              && spawnSync("bundle", ["install"], { cwd: dir, stdio: "inherit", env }).status === 0;
          }
        } else if (kind === "local") {
          const dir = resolve(wt, s.uses);
          const action = parseYaml(readFileSync(existsSync(join(dir, "action.yml")) ? join(dir, "action.yml") : join(dir, "action.yaml"), "utf-8")) as { inputs?: Record<string, { default?: string }>; runs?: { using?: string; steps?: Step[] } };
          if (action.runs?.using !== "composite") throw new Error(`${s.uses}: only composite actions are replayed`);
          const inputs = Object.fromEntries(Object.entries(action.inputs ?? {}).map(([k, d]) => [k, withs[k] ?? d.default ?? ""]));
          for (const sub of action.runs.steps ?? []) {
            const sctx = ctxFor(failed, { inputs });
            if (sub.uses) throw new Error(`${s.uses}: a nested uses (${sub.uses}) is not replayed`);
            if (!stepRuns(sub.if, sctx) || sub.run === undefined) continue;
            const subEnv = Object.fromEntries(Object.entries(sub.env ?? {}).map(([k, v]) => [k, interpolate(String(v), sctx)]));
            const subCwd = sub["working-directory"] ? resolve(wt, interpolate(sub["working-directory"], sctx)) : wt;
            if (!runScript(interpolate(sub.run, sctx), sub.shell, subCwd, { ...subEnv, GITHUB_ACTION_PATH: dir }, `${label} › ${sub.name ?? "step"}`)) { ok = false; break; }
          }
        } else {
          // Reported as skipped, as it was: a later `if` that asks whether this
          // step succeeded (the hand-off to the batched publisher asks it of
          // the artifact upload) must not be told it did.
          o.log(`  (skipped: ${USES.find((x) => x.match.test(s.uses!))?.why})`);
          if (s.id) stepState[s.id] = { outputs: {}, outcome: "skipped", conclusion: "skipped" };
          continue;
        }
      }
      const coe = s["continue-on-error"] === true || s["continue-on-error"] === "true";
      if (s.id) stepState[s.id] = { outputs: lastOutputs, outcome: ok ? "success" : "failure", conclusion: ok || coe ? "success" : "failure" };
      if (!ok) {
        o.log(`✗ ${label}${coe ? " (continue-on-error)" : ""}`);
        if (!coe) { failed = true; failures.push(label); }
      }
    }
  } finally {
    o.log(`· worktree kept for inspection: ${wt} (remove with: git worktree remove --force ${wt})`);
  }
  return { steps: steps.length, ran, failed: failures, site: join(wt, "_site") };
}

function flag(argv: string[], k: string): string | undefined {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  try {
    const repo = resolve(flag(argv, "repo") ?? ".");
    const cfg = readIndexConfig(repo);
    const workflow = flag(argv, "workflow") ?? ("config" in cfg ? cfg.config.site?.workflows?.stage : undefined);
    if (!workflow) throw new Error("no --workflow, and index.config.json declares no site.workflows.stage");
    const branch = flag(argv, "branch") ?? git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch === "main" || branch === "master") throw new Error("the main site is CI-built only (owner, Q-SPD-9 B); this replays previews");
    const r = await replay({
      repo, workflow, job: flag(argv, "job") ?? "stage", branch, base: flag(argv, "base") ?? "main",
      ...(flag(argv, "pr") ? { pr: Number(flag(argv, "pr")) } : {}),
      merge: !argv.includes("--no-merge"), plan: argv.includes("--plan"), push: !argv.includes("--no-push"),
      log: (s) => console.error(s),
    });
    console.log(JSON.stringify(r));
    process.exit(r.failed.length ? 1 : 0);
  } catch (e) {
    console.error(`✗ stage-workflow-local: ${(e as Error).message}`);
    process.exit(2);
  }
}
