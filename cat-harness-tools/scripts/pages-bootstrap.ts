#!/usr/bin/env bun
/**
 * Where will this folio be published, and is it there yet?
 *
 * The content core's `processes/conduct/getting-started.bpmn` ends by handing
 * the author a link. This derives the address, reports whether anything is
 * set up to publish to it, and — with `--wait` — probes until the site
 * answers.
 *
 * ## Four states — the branch first, then the address
 *
 * `unprovisioned` is checked **before anything else**: `git ls-remote --heads
 * <remote> gh-pages` found no `gh-pages` branch, and the publish route deploys
 * from that branch. GitHub Pages cannot be switched on to serve a branch that
 * does not exist, so every later step is moot until it does. The report
 * prints the exact command, and `--provision` runs it. This is `A_Provision` in
 * bootstrap-tools' `render-kg-to-github-pages.bpmn`, and `A_ProvisionGhPages`
 * in `getting-started.bpmn`.
 *
 * The remaining three are about the address:
 *
 * `live` is a success response. `not-yet` is a **measured** 404: the server
 * answered and said there is nothing there, which is the ordinary state for the
 * first minutes after a scaffold. `unknown` is the absence of a measurement —
 * no URL could be derived, nothing was probed, or the request failed. It is
 * never reported as `not-yet` ("still building" when nothing was checked).
 *
 * `decisions/pages-live-gate.dmn` holds the same three states as a decision
 * table, and `--json` emits exactly the facts that table reads.
 *
 * ## It does not deploy — and it creates a remote branch only when told to
 *
 * Publishing is a GitHub Actions workflow's job. This reports whether such a
 * workflow exists and what it is called; it never dispatches a workflow or
 * configures Pages. An author who has no publish workflow is told so.
 *
 * The ONE write it can make is `--provision`: an orphan `gh-pages` holding a
 * placeholder `index.html` and `.nojekyll`, built with git plumbing (the
 * working tree and index are never touched) and pushed without force. It is
 * idempotent — a branch that already exists is reported and left alone. Without
 * the flag nothing is pushed, whatever the state.
 *
 * It also says which Pages **source** it expects. A publish workflow that
 * pushes `gh-pages` needs "Deploy from a branch: gh-pages, / (root)", not
 * "GitHub Actions", or Pages never serves the branch.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts               # derive + report, no probe
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts --wait        # probe until live, bounded
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts --wait --timeout 300
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts --json        # facts for the DMN gate
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts --provision   # create gh-pages if absent, then report
 *   bun run cat-harness-tools/scripts/pages-bootstrap.ts --remote upstream   # a remote other than origin
 *
 * Exit codes: 0 live, 0 not-yet (it is not an error to be early), 2 unknown,
 * 3 unprovisioned (no gh-pages branch — run with --provision), 4 --provision
 * was asked for and failed.
 *
 * @module scripts/pages-bootstrap
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkoutRootFor } from "../schemas/kg/cat-harness.js";
import { readEffectiveConfig } from "../schemas/kg/harness-config.js";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

export type Probe = "ok" | "not-found" | "error" | "unchecked";
export type PagesOutcome = "live" | "not-yet" | "unknown" | "unprovisioned";

/**
 * Whether the `gh-pages` branch exists on the remote. `not-required` when the
 * repository's publish workflows all deploy a Pages artifact through Actions
 * and none pushes a branch — then there is no branch for Pages to serve.
 * `unknown` when `git ls-remote` could not answer: never read as `absent`.
 */
export type BranchState = "present" | "absent" | "unknown" | "not-required";

/** The Pages source the publish route needs. */
export type PagesSource = "branch" | "actions";

/** The exact wording of the source setting, as GitHub's Settings → Pages shows it. */
export const BRANCH_SOURCE = "Deploy from a branch: gh-pages, / (root)";
export const ACTIONS_SOURCE = "GitHub Actions";

export interface PagesFacts {
  /** The facts `decisions/pages-live-gate.dmn` reads. */
  pagesUrlKnown: boolean;
  probe: Probe;
  /** Checked before anything else (#2417). */
  ghPagesBranch: BranchState;
}

export interface ProvisionResult {
  state: "created" | "already-present" | "failed";
  /** The placeholder commit pushed, when one was. */
  sha?: string;
  detail: string;
}

export interface PagesReport extends PagesFacts {
  url?: string;
  /** How the URL was arrived at, so a wrong one can be traced. */
  urlSource?: string;
  owner?: string;
  repo?: string;
  /** Workflow files that look like they publish a site. */
  publishWorkflows: string[];
  /** The remote `gh-pages` was looked for on. */
  remote: string;
  /** Why `ghPagesBranch` is `unknown`, when it is. */
  branchError?: string;
  /** The Pages source the publish route needs, and its wording. */
  pagesSource: PagesSource;
  expectedSource: string;
  /** The command that provisions the branch, when it is absent. */
  provisionCommand?: string;
  /** What `--provision` did, when it was asked for. */
  provision?: ProvisionResult;
  /** HTTP status, when a probe actually completed. */
  status?: number;
  /** Why the probe could not be made, when it could not. */
  probeError?: string;
  /** Seconds spent waiting, when `--wait` was used. */
  waitedSeconds?: number;
  outcome: PagesOutcome;
}

/**
 * The decision in `pages-live-gate.dmn`, in code, so the script and the table
 * cannot drift apart. The table is the version an editor can change; this is
 * the version that runs when no workflow instance is open.
 */
export function outcomeFor(f: PagesFacts): PagesOutcome {
  // First: a publish route that deploys from gh-pages cannot be switched on
  // until gh-pages exists (owner, 2026-10-01 and 2026-10-07; #2417).
  if (f.ghPagesBranch === "absent") return "unprovisioned";
  if (!f.pagesUrlKnown) return "unknown";
  if (f.probe === "ok") return "live";
  if (f.probe === "not-found") return "not-yet";
  return "unknown";
}

/** Parse `owner/repo` out of any of the shapes a GitHub remote comes in. */
export function parseRemote(remote: string): { owner: string; repo: string } | undefined {
  const m =
    /^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/.exec(remote) ??
    /^(?:https?|ssh|git):\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/.exec(remote);
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]! };
}

function gitRemote(root: string): string | undefined {
  // input-site: traced #ae81c49b — origin's URL, from this clone's git config: no fingerprint names it, so a run that reaches it records no hash
  inputSiteReached("pages-bootstrap: origin's URL");
  const r = spawnSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf-8" });
  if (r.status !== 0) return undefined;
  const url = r.stdout.trim();
  return url || undefined;
}

/**
 * Where the site lives. The layer's config (`<name>.config.json`) wins
 * when it says, because an
 * author with a custom domain has said something the remote cannot tell us.
 */
export function derivePagesUrl(root: string): Pick<PagesReport, "url" | "urlSource" | "owner" | "repo"> {
  const found = readEffectiveConfig(root);
  if (found.state === "ok") {
    try {
      const cfg = found.config as {
        readme?: { pagesBaseUrl?: string };
        pagesBaseUrl?: string;
      };
      const base = cfg.readme?.pagesBaseUrl ?? cfg.pagesBaseUrl;
      if (typeof base === "string" && base.startsWith("http")) {
        return { url: base.replace(/\/+$/, "") + "/", urlSource: found.from };
      }
    } catch {
      // Unparseable config is not a reason to guess. Fall through to the remote,
      // and if that fails too the outcome is `unknown` — which is correct.
    }
  }

  const remote = gitRemote(root);
  if (!remote) return {};
  const parsed = parseRemote(remote);
  if (!parsed) return {};
  const { owner, repo } = parsed;
  return {
    url: `https://${owner.toLowerCase()}.github.io/${repo}/`,
    urlSource: "git remote",
    owner,
    repo,
  };
}

/**
 * Workflows that look like they publish a site. Matched on what the file
 * *does* — a `deploy-pages` or `upload-pages-artifact` step, or a push to a
 * publish branch — rather than on its name, because "docs.yml" and
 * "gh-pages.yml" are both common and neither is required.
 */
export function findPublishWorkflows(root: string): string[] {
  // The checkout's `.github/`: `dirname` of a root layer is outside it (g43f).
  const dir = join(checkoutRootFor(root), ".github", "workflows");
  if (!existsSync(dir)) return [];
  const hits: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    let text: string;
    try {
      text = readFileSync(join(dir, f), "utf-8");
    } catch {
      continue;
    }
    if (
      /actions\/deploy-pages|actions\/upload-pages-artifact|peaceiris\/actions-gh-pages|JamesIves\/github-pages-deploy-action|gh-pages/i.test(
        text,
      )
    ) {
      hits.push(f);
    }
  }
  return hits.sort();
}

/**
 * Which Pages source the publish workflows need. A workflow that pushes the
 * `gh-pages` branch (by `git push`, `peaceiris/actions-gh-pages`,
 * `JamesIves/github-pages-deploy-action`, or any mention of the branch) needs
 * the branch source, and wins over an artifact deploy in the same repository —
 * recommending "GitHub Actions" there leaves the pushed branch unserved. Only a
 * repository whose every publish workflow deploys a Pages artifact needs the
 * Actions source. No workflow at all defaults to the branch, because that is
 * what `A_Provision` provisions and what the platform's templates push.
 */
export function pagesSourceFor(root: string, workflows: string[] = findPublishWorkflows(root)): PagesSource {
  const dir = join(checkoutRootFor(root), ".github", "workflows");
  let actions = false;
  for (const f of workflows) {
    let text: string;
    try {
      text = readFileSync(join(dir, f), "utf-8");
    } catch {
      continue;
    }
    if (/peaceiris\/actions-gh-pages|JamesIves\/github-pages-deploy-action|\bgh-pages\b/i.test(text)) return "branch";
    if (/actions\/deploy-pages|actions\/upload-pages-artifact/i.test(text)) actions = true;
  }
  return actions ? "actions" : "branch";
}

function git(root: string, args: string[], input?: string, env?: Record<string, string>) {
  // input-site: traced #4e989e0a — git against the clone and its remote (ls-remote, push): no fingerprint names a remote, so a run that reaches it records no hash
  inputSiteReached("pages-bootstrap: git");
  return spawnSync("git", ["-C", root, ...args], {
    encoding: "utf-8",
    input,
    timeout: 60_000,
    // Never sit at a credential prompt: an unanswerable question is `unknown`.
    // input-site: inert #ab16c6f0 — the environment handed whole to the git child of the traced call above; no value is read here
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
  });
}

/** `git ls-remote --heads <remote> gh-pages`, as a three-valued answer. */
export function ghPagesBranchState(root: string, remote = "origin"): { state: "present" | "absent" | "unknown"; error?: string } {
  const r = git(root, ["ls-remote", "--heads", remote, "gh-pages"]);
  if (r.error || r.status !== 0) {
    return { state: "unknown", error: (r.stderr || r.error?.message || `git exited ${r.status}`).trim() };
  }
  return /\brefs\/heads\/gh-pages$/m.test(r.stdout) ? { state: "present" } : { state: "absent" };
}

/** The command `--provision` runs, for an author who would rather run it by hand. */
export function provisionCommand(remote = "origin"): string {
  return (
    `bun run cat-harness-tools/scripts/pages-bootstrap.ts --provision${remote === "origin" ? "" : ` --remote ${remote}`}` +
    `   # or by hand: git checkout --orphan gh-pages && git rm -rfq . && echo placeholder > index.html && touch .nojekyll && git add index.html .nojekyll && git commit -m "Create gh-pages" && git push ${remote} gh-pages`
  );
}

export const PLACEHOLDER_HTML =
  "<!doctype html>\n<meta charset=\"utf-8\">\n<title>Placeholder</title>\n" +
  "<p>This site has not been published yet. The publish workflow replaces this page.</p>\n";

/**
 * Create an orphan `gh-pages` holding exactly `index.html` and `.nojekyll`,
 * and push it — `A_Provision`'s first half. Built with plumbing
 * (`hash-object`, `mktree`, `commit-tree`) so the author's working tree,
 * index and current branch are never touched, and pushed WITHOUT force so a
 * branch created meanwhile by somebody else is not overwritten. Idempotent:
 * an existing branch is reported and left alone.
 */
export function provisionGhPages(root: string, remote = "origin"): ProvisionResult {
  const before = ghPagesBranchState(root, remote);
  if (before.state === "present") return { state: "already-present", detail: `gh-pages already exists on ${remote}; left alone` };
  if (before.state === "unknown") {
    return { state: "failed", detail: `could not tell whether gh-pages exists on ${remote} (${before.error}); not pushing on a guess` };
  }

  const blob = (content: string) => {
    const r = git(root, ["hash-object", "-w", "--stdin"], content);
    if (r.status !== 0) throw new Error(`hash-object: ${r.stderr.trim()}`);
    return r.stdout.trim();
  };
  try {
    const html = blob(PLACEHOLDER_HTML);
    const empty = blob("");
    const tree = git(root, ["mktree"], `100644 blob ${empty}\t.nojekyll\n100644 blob ${html}\tindex.html\n`);
    if (tree.status !== 0) throw new Error(`mktree: ${tree.stderr.trim()}`);
    // An unconfigured identity must not stop a placeholder commit; a
    // configured one is used as it is.
    const named = git(root, ["config", "user.name"]).stdout.trim();
    const mailed = git(root, ["config", "user.email"]).stdout.trim();
    const env: Record<string, string> = {};
    if (!named) env.GIT_AUTHOR_NAME = env.GIT_COMMITTER_NAME = "folio-assistant";
    if (!mailed) env.GIT_AUTHOR_EMAIL = env.GIT_COMMITTER_EMAIL = "folio-assistant@users.noreply.github.com";
    const commit = git(root, ["commit-tree", tree.stdout.trim(), "-m", "Create gh-pages (placeholder; the publish workflow replaces it)"], undefined, env);
    if (commit.status !== 0) throw new Error(`commit-tree: ${commit.stderr.trim()}`);
    const sha = commit.stdout.trim();
    const push = git(root, ["push", remote, `${sha}:refs/heads/gh-pages`]);
    if (push.status !== 0) throw new Error(`push to ${remote}: ${push.stderr.trim()}`);
    return { state: "created", sha, detail: `pushed an orphan gh-pages (${sha.slice(0, 7)}) to ${remote}: index.html + .nojekyll` };
  } catch (e) {
    return { state: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

async function probeOnce(url: string, timeoutMs: number): Promise<{ probe: Probe; status?: number; error?: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // GET rather than HEAD: GitHub Pages answers HEAD inconsistently while a
    // first deployment is in flight, and a wrong answer here is worse than the
    // few extra kilobytes.
    // input-site: traced #3aa7bc06 — the published site, probed over the network: a run that reaches it records no hash
    inputSiteReached("pages-bootstrap: probe the site");
    const res = await fetch(url, { signal: ctl.signal, redirect: "follow" });
    if (res.ok) return { probe: "ok", status: res.status };
    if (res.status === 404) return { probe: "not-found", status: res.status };
    // Anything else — 403, 500, a proxy's 407 — is not evidence that the site
    // is absent, so it is not `not-found`.
    return { probe: "error", status: res.status, error: `HTTP ${res.status}` };
  } catch (e) {
    return { probe: "error", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

export interface BootstrapOptions {
  root?: string;
  /** The remote gh-pages is looked for on, and provisioned to. Default `origin`. */
  remote?: string;
  /** Create gh-pages on the remote if it is absent. Off by default: never implied. */
  provision?: boolean;
  /** Probe at all. Without it the outcome is `unknown`, reported as such. */
  probe?: boolean;
  /** Keep probing until live or this many seconds have passed. */
  waitSeconds?: number;
  /** Per-request timeout. */
  requestTimeoutMs?: number;
  onTick?: (elapsed: number, probe: Probe) => void;
}

export async function pagesBootstrap(opts: BootstrapOptions = {}): Promise<PagesReport> {
  const root = resolve(opts.root ?? ".");
  const remote = opts.remote ?? "origin";
  const publishWorkflows = findPublishWorkflows(root);
  const pagesSource = pagesSourceFor(root, publishWorkflows);

  // The branch BEFORE anything else (#2417 FR-1).
  let provision: ProvisionResult | undefined;
  if (opts.provision && pagesSource === "branch") provision = provisionGhPages(root, remote);
  const branch: { state: BranchState; error?: string } =
    pagesSource === "branch" ? ghPagesBranchState(root, remote) : { state: "not-required" };

  const derived = derivePagesUrl(root);
  const base: PagesReport = {
    ...derived,
    pagesUrlKnown: Boolean(derived.url),
    probe: "unchecked",
    ghPagesBranch: branch.state,
    branchError: branch.error,
    remote,
    publishWorkflows,
    pagesSource,
    expectedSource: pagesSource === "branch" ? BRANCH_SOURCE : ACTIONS_SOURCE,
    provisionCommand: branch.state === "absent" ? provisionCommand(remote) : undefined,
    provision,
    outcome: "unknown",
  };

  if (branch.state === "absent" || !derived.url || !opts.probe) {
    base.outcome = outcomeFor(base);
    return base;
  }

  // input-site: inert #a531bcd2 — a polling deadline; the loop it bounds probes the site through probeOnce, which is traced
  const deadline = Date.now() + (opts.waitSeconds ?? 0) * 1000;
  // input-site: inert #23cfbd9b — when polling began, reported as seconds waited; the loop probes through probeOnce, which is traced
  const started = Date.now();
  const requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;

  for (;;) {
    const r = await probeOnce(derived.url, requestTimeoutMs);
    base.probe = r.probe;
    base.status = r.status;
    base.probeError = r.error;
    // input-site: inert #96b7aa5c — seconds waited, reported; reached only after probeOnce, which is traced
    base.waitedSeconds = Math.round((Date.now() - started) / 1000);
    opts.onTick?.(base.waitedSeconds, r.probe);

    if (r.probe === "ok") break;
    // input-site: inert #6877128f — the polling deadline; reached only after probeOnce, which is traced
    if (Date.now() >= deadline) break;
    // input-site: inert #bc7192ae — the pause between probes; reached only after probeOnce, which is traced
    await new Promise((res) => setTimeout(res, Math.min(10_000, Math.max(2_000, deadline - Date.now()))));
  }

  base.outcome = outcomeFor(base);
  return base;
}

export function formatReport(r: PagesReport): string {
  const out: string[] = [];

  if (r.provision) {
    out.push(`Provision gh-pages: ${r.provision.state.toUpperCase()} — ${r.provision.detail}`);
    out.push("");
  }

  switch (r.ghPagesBranch) {
    case "present":
      out.push(`gh-pages branch: present on ${r.remote}`);
      break;
    case "absent":
      out.push(`gh-pages branch: ABSENT on ${r.remote}`);
      break;
    case "not-required":
      out.push("gh-pages branch: not required — every publish workflow deploys a Pages artifact");
      break;
    default:
      out.push(`gh-pages branch: COULD NOT DETERMINE on ${r.remote}${r.branchError ? ` — ${r.branchError}` : ""}`);
  }
  out.push(`Pages source expected: ${r.expectedSource}`);
  if (r.pagesSource === "branch") {
    out.push('  Not "GitHub Actions": the publish route pushes gh-pages, and Pages must serve that branch.');
  }
  out.push("");

  if (r.url) {
    out.push(`Site address: ${r.url}`);
    out.push(`  derived from: ${r.urlSource}`);
  } else {
    out.push("Site address: COULD NOT DETERMINE");
    out.push(
      "  No `readme.pagesBaseUrl` in this instance's config (`<name>.config.json`) and no\n" +
        "  parseable `origin` remote.\n" +
        "  Not guessed from the directory name — a wrong URL is worse than none, because\n" +
        "  it is what the author will paste to somebody else.",
    );
  }
  out.push("");

  if (r.publishWorkflows.length) {
    out.push(`Publish workflow: ${r.publishWorkflows.join(", ")}`);
  } else {
    out.push("Publish workflow: none found in .github/workflows/");
    out.push("  Nothing here will publish the site. Add one before promising a link.");
  }
  out.push("");

  switch (r.outcome) {
    case "unprovisioned":
      out.push("UNPROVISIONED — there is no gh-pages branch, so Pages cannot be switched on to serve it.");
      out.push("  Provision it first (A_Provision; owner, 2026-10-01 and 2026-10-07):");
      out.push(`    ${r.provisionCommand ?? provisionCommand(r.remote)}`);
      out.push(`  Then: Settings → Pages → ${r.expectedSource}.`);
      out.push("  Nothing was pushed: this script creates the branch only with --provision.");
      break;
    case "live":
      out.push(`LIVE — the site answered${r.status ? ` (HTTP ${r.status})` : ""}.`);
      out.push(`  ${r.url}`);
      break;
    case "not-yet":
      out.push("NOT YET — the server answered 404. That is a measurement, not a failure:");
      out.push("  a first Pages build usually lands within a few minutes of the push.");
      out.push(`  It will be at: ${r.url}`);
      break;
    case "unknown":
      out.push("COULD NOT CHECK — this is NOT the same as 'not yet'.");
      if (!r.pagesUrlKnown) out.push("  Reason: no URL to check.");
      else if (r.probe === "unchecked") out.push("  Reason: no probe was attempted (pass --wait).");
      else out.push(`  Reason: the request failed — ${r.probeError ?? "unknown error"}.`);
      out.push("  Do not report the site as live or as pending on this result.");
      break;
  }

  if (r.waitedSeconds !== undefined && r.waitedSeconds > 0) {
    out.push("");
    out.push(`Waited ${r.waitedSeconds}s.`);
  }
  return out.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const wait = args.includes("--wait");
  const provision = args.includes("--provision");
  const tIdx = args.indexOf("--timeout");
  const rIdx = args.indexOf("--remote");
  const remote = rIdx >= 0 ? args[rIdx + 1] : undefined;
  const waitSeconds = wait ? Number(tIdx >= 0 ? args[tIdx + 1] : 240) : 0;
  const valueIdx = new Set([tIdx + 1, rIdx + 1].filter((i) => i > 0));
  const root = args.find((a, i) => !a.startsWith("--") && !valueIdx.has(i)) ?? ".";

  const report = await pagesBootstrap({
    root,
    remote,
    provision,
    probe: wait,
    waitSeconds: Number.isFinite(waitSeconds) ? waitSeconds : 240,
    onTick: (elapsed, probe) => {
      if (!json && probe !== "ok") console.error(`  … ${probe} at ${elapsed}s`);
    },
  });

  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
  if (report.provision?.state === "failed") process.exit(4);
  process.exit(report.outcome === "unprovisioned" ? 3 : report.outcome === "unknown" ? 2 : 0);
}
