/**
 * Report whether each workflow is actually passing on the default branch, so
 * a workflow failing run after run is surfaced.
 *
 * ```sh
 * bun run cat check:ci-health            # human-readable, exit 1 if anything is red
 * bun run cat check:ci-health --markdown # the block the session-start sweep prints
 * bun run cat check:ci-health --warn     # report only, never fail
 * ```
 *
 * One API call. `GET /actions/runs?branch=<default>&per_page=100` returns the
 * recent history across every workflow at once, so this does not fan out to
 * one request per workflow — which would exhaust the unauthenticated rate
 * limit (60/hr) and make it unusable at session start.
 *
 * `GITHUB_TOKEN` or `GH_TOKEN` is used when present. Without one the call still
 * works for a public repo; for a private repo it fails, and this says so rather
 * than reporting green.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assess,
  BLAME_WALK_CAP,
  blameFailingRun,
  NOT_A_VERDICT,
  type BlameVerdict,
  type ConclusionOnCommit,
  type WorkflowHealth,
  describeWindow,
  pagesHealth,
  pushTriggerOf,
  render,
  renderPages,
  selfSupersedes,
  type CitedBean,
  type DeployCommit,
  type NoRunReason,
  type PagesReport,
  type RunSummary,
  type Window,
} from "../src/workflow/ci-health.js";

import { whyNoRun } from "../src/workflow/workflow-triggers.js";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { readBeanStore } from "./bean-store-read.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

const argv = process.argv.slice(2);
const markdown = argv.includes("--markdown");
const warn = argv.includes("--warn");

/**
 * `--out <file>` writes the markdown report to a file **and keeps the exit
 * code**. `--markdown` cannot do both: it always exits 0, deliberately, because
 * `session-start-coord-sweep.sh` runs it as `if ! bun run … --markdown; then`
 * and prints its "Not checked — treat as unknown" fallback on a non-zero exit.
 * Make `--markdown` exit 1 on a red and the sweep would print the report AND
 * declare it unchecked, every time CI is red.
 *
 * So the notifier gets its own flag rather than one API call being spent twice.
 */
const outIdx = argv.findIndex((a) => a === "--out" || a.startsWith("--out="));
const outFile =
  outIdx === -1
    ? undefined
    : argv[outIdx].startsWith("--out=")
      ? argv[outIdx].slice("--out=".length)
      : argv[outIdx + 1];
if (outIdx !== -1 && !outFile) {
  console.error("--out needs a file path");
  process.exit(2);
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** owner/repo from the origin remote — https or ssh. */
function originSlug(): string | undefined {
  let url: string;
  try {
    url = git(["remote", "get-url", "origin"]);
  } catch {
    return undefined;
  }
  const m = /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

function defaultBranch(): string {
  try {
    // stdio: origin/HEAD is often unset in a fresh clone, and git's complaint
    // about it is noise the reader should not have to triage.
    return execFileSync("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .replace(/^origin\//, "");
  } catch {
    return "main";
  }
}

const slug = originSlug();
const branch = defaultBranch();

async function fetchRuns(): Promise<{ runs?: RunSummary[]; unreachable?: string }> {
  if (!slug) return { unreachable: "no GitHub `origin` remote to ask about." };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const url =
    `https://api.github.com/repos/${slug}/actions/runs` +
    `?branch=${encodeURIComponent(branch)}&per_page=100`;
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return {
        unreachable:
          `GitHub API returned ${res.status} for ${slug}` +
          (res.status === 404 && !token
            ? " — a private repo needs GITHUB_TOKEN or GH_TOKEN."
            : res.status === 403
              ? " — rate limited; set GITHUB_TOKEN to raise the limit."
              : "."),
      };
    }
    const body = (await res.json()) as { workflow_runs?: RunSummary[] };
    return { runs: body.workflow_runs ?? [] };
  } catch (e) {
    return { unreachable: `could not reach the GitHub API: ${String(e).slice(0, 120)}` };
  }
}

/**
 * The branch tip, asked of the forge rather than of this checkout.
 *
 * `git rev-parse origin/main` would be cheaper and is the obvious reading, but
 * a local remote-tracking ref is only as fresh as the last fetch — and a stale
 * one gives a WRONG head, which this module would then report as "no run
 * judged it". A wrong answer is worse than no answer here, so a failure
 * returns `undefined` and `headUnjudged` is simply never set.
 */
async function fetchHeadSha(): Promise<string | undefined> {
  if (!slug) return undefined;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${slug}/commits/${encodeURIComponent(branch)}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { sha?: string };
    return body.sha;
  } catch {
    return undefined;
  }
}

/**
 * The paths the head commit changed, or `undefined` if that cannot be known
 * completely.
 *
 * **The cap matters more than the request.** GitHub's commit endpoint returns
 * at most 300 entries in `files`, and it does not say when it truncated. A
 * short list makes a matching path look absent, which flips "this workflow
 * ran" to "no run judged the head" — a false fire, from the one direction this
 * module refuses. So a list at or above the cap is treated as unknown, and a
 * large commit simply gets silence.
 */
const GITHUB_COMMIT_FILES_CAP = 300;

async function fetchChangedFiles(sha: string): Promise<string[] | undefined> {
  if (!slug) return undefined;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}/commits/${sha}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { files?: Array<{ filename?: string }> };
    const files = (body.files ?? []).map((f) => f.filename).filter((f): f is string => !!f);
    if (files.length >= GITHUB_COMMIT_FILES_CAP) return undefined;
    return files;
  } catch {
    return undefined;
  }
}

/**
 * Every workflow file in `.github/workflows/`, with the `name:` it declares.
 *
 * This is the second source of truth the report was missing. Everything else
 * here derives from RUNS, so a workflow that did not run was not a quiet row —
 * it was not a row. Measured 2026-09-20: 38 files, 3 rows, and a `✓`.
 *
 * The name is parsed rather than looked up because a file with no runs has no
 * run to carry one. An unnamed or unreadable file falls back to its basename,
 * which is what GitHub itself displays in that case.
 */
function knownWorkflows(): Array<{ path: string; name: string }> | undefined {
  const dir = resolve(repoRoot, ".github/workflows");
  if (!existsSync(dir)) return undefined;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Could not look. `undefined` — NOT `[]` — because an empty list would
    // assert there are no workflows, and this module's whole discipline is
    // that not knowing never renders as an answer.
    return undefined;
  }
  const out: Array<{ path: string; name: string }> = [];
  for (const f of entries.sort()) {
    if (!/\.ya?ml$/.test(f)) continue;
    const path = `.github/workflows/${f}`;
    let name = f;
    try {
      const m = /^name:\s*(.+?)\s*$/m.exec(readFileSync(resolve(dir, f), "utf8"));
      if (m) name = m[1].replace(/^['"]|['"]$/g, "");
    } catch {
      // Keep the basename.
    }
    out.push({ path, name });
  }
  return out;
}

/** {@link NoRunReason} for a workflow path. Unreadable is `undetermined`. */
function noRunReason(path: string): NoRunReason {
  try {
    return whyNoRun(readFileSync(resolve(repoRoot, path), "utf8"));
  } catch {
    return "undetermined";
  }
}

/** The workflow's first `cron:` value, or `undefined`. */
function cronOf(path: string): string | undefined {
  try {
    const m = /^\s*-\s*cron:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(
      readFileSync(resolve(repoRoot, path), "utf8"),
    );
    return m?.[1];
  } catch {
    return undefined;
  }
}

/**
 * When the workflow file first appeared on the default branch.
 *
 * `--diff-filter=A` and the LAST line of the log, because `git log` is newest
 * first and the addition is the oldest entry. Asked against `origin/<branch>`
 * for the same reason `workflowChangedAt` is: the runs being classified are
 * the default branch's.
 *
 * `undefined` on any failure — a shallow clone, an unknown ref — which leaves
 * a never-run workflow reported as a finding. Not knowing how old a file is
 * must never explain its silence away.
 */
const addedAtCache = new Map<string, string | undefined>();
function workflowAddedAt(path: string): string | undefined {
  if (addedAtCache.has(path)) return addedAtCache.get(path);
  let out: string | undefined;
  for (const ref of [`origin/${branch}`, "HEAD"]) {
    try {
      const log = execFileSync(
        "git",
        ["log", "--diff-filter=A", "--format=%cI", ref, "--", path],
        { encoding: "utf8", cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      const lines = log.split("\n").filter(Boolean);
      if (lines.length > 0) {
        out = lines[lines.length - 1];
        break;
      }
    } catch {
      // Next ref; an unknown ref is not an answer of "never added".
    }
  }
  addedAtCache.set(path, out);
  return out;
}

/** Does this workflow file carry a `schedule:` trigger? `undefined` if unreadable. */
function hasSchedule(path: string): boolean | undefined {
  try {
    return /^\s+schedule:/m.test(readFileSync(resolve(repoRoot, path), "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Runs of ONE workflow, asked for directly.
 *
 * The module header rejects fanning out to a request per workflow, and it is
 * right: 38 requests at session start would exhaust the unauthenticated limit
 * (60/hr). But the objection is to fanning out over ALL of them. This is used
 * only for a workflow that carries a `schedule:` and produced nothing in the
 * window — three files in this repository — and only when those two facts are
 * both established.
 *
 * Why it must exist at all: `?per_page=100` is a page of runs, not a period.
 * Measured 2026-09-20 on this repo, that page spanned **6.1 hours**. A weekly
 * watchdog cannot appear in six hours however healthy or broken it is, so the
 * report's silence about `ci-health.yml` — the workflow whose entire purpose
 * is catching failures nobody sees — carried no information at all. Labelling
 * that blindness is honest; this is the part that removes it.
 */
async function fetchWorkflowRuns(file: string): Promise<RunSummary[] | undefined> {
  if (!slug) return undefined;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${slug}/actions/workflows/${encodeURIComponent(file)}` +
        `/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
      {
        headers: {
          accept: "application/vnd.github+json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { workflow_runs?: RunSummary[] };
    return body.workflow_runs ?? [];
  } catch {
    return undefined;
  }
}

/**
 * The Pages deployments, and the publish-branch commits that triggered them.
 *
 * **Three properties hid `bm6d` for two months, and the query above trips on
 * every one.** The deployments run on the PUBLISH branch rather than the
 * default one; they are raised by `github-pages[bot]` on the `dynamic` event,
 * so there is no file in `.github/workflows/` for `knownWorkflows` to make a
 * row out of; and `?branch=<default>` excludes them outright. Measured
 * 2026-09-20: the default-branch page held **zero** of them while the publish
 * branch held **52 cancelled and 48 succeeded**.
 *
 * ## Why the workflow is discovered rather than named
 *
 * GitHub's Pages workflow has no file, so it is addressed by id — and the id
 * is per-repository. Two alternatives were tried and rejected by measurement:
 * `GET /repos/{slug}/pages` says the publish branch outright and answers
 * **403 without admin**, and the `dynamic/pages/pages-build-deployment` path
 * answers **404** through the by-path runs endpoint. So the workflow list is
 * read once and the entry is found by its `dynamic/pages/` path prefix.
 *
 * That also removes the last assumption: the publish branch is read off the
 * runs' own `head_branch`, so a repository publishing from `main` or from a
 * `docs/` folder reports its branch rather than a hardcoded `gh-pages`.
 *
 * Costs two requests, and a third for the commits. A repository with no Pages
 * spends one and stops.
 */
const PAGES_WORKFLOW_PATH_PREFIX = "dynamic/pages/";

/** How far back to look. A page, not a period — {@link Window} says which. */
const PAGES_RUNS_PER_PAGE = 100;
const PUBLISH_COMMITS_PER_PAGE = 100;

async function api(path: string): Promise<unknown | undefined> {
  if (!slug) return undefined;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${slug}/${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${path.split("?")[0]}`);
  return res.json();
}

async function fetchPages(): Promise<PagesReport> {
  if (!slug) return { unreachable: "no GitHub `origin` remote to ask about." };
  let id: number | undefined;
  try {
    const body = (await api("actions/workflows?per_page=100")) as {
      workflows?: Array<{ id: number; path: string }>;
    };
    id = body.workflows?.find((w) => w.path.startsWith(PAGES_WORKFLOW_PATH_PREFIX))?.id;
  } catch (e) {
    return { unreachable: `could not list workflows: ${String(e).slice(0, 100)}` };
  }
  if (id === undefined) {
    // A repository with Pages off, and one whose workflow list came back
    // without it, are not the same thing — but from here they are, so this
    // says the weaker of the two.
    return { unreachable: "no GitHub Pages workflow in this repository's workflow list." };
  }

  let runs: RunSummary[];
  let publishBranch: string | undefined;
  try {
    const body = (await api(`actions/workflows/${id}/runs?per_page=${PAGES_RUNS_PER_PAGE}`)) as {
      workflow_runs?: Array<RunSummary & { head_branch?: string }>;
    };
    runs = body.workflow_runs ?? [];
    publishBranch = runs.length > 0 ? (runs[0] as { head_branch?: string }).head_branch : undefined;
  } catch (e) {
    return { unreachable: `could not read the Pages deployments: ${String(e).slice(0, 100)}` };
  }

  const report: PagesReport = { health: pagesHealth(runs), publishBranch };
  if (runs.length > 0) {
    report.window = {
      runs: runs.length,
      from: runs.map((r) => r.created_at).reduce((a, b) => (a < b ? a : b)),
      to: runs.map((r) => r.created_at).reduce((a, b) => (a > b ? a : b)),
    };
  }
  if (!publishBranch) {
    // No runs, so no branch to ask about. Not a failure — `renderPages`
    // already says an empty window is unjudged rather than clean.
    return report;
  }
  try {
    const body = (await api(
      `commits?sha=${encodeURIComponent(publishBranch)}&per_page=${PUBLISH_COMMITS_PER_PAGE}`,
    )) as Array<{ sha: string; commit: { message: string; committer: { date: string } } }>;
    const commits: DeployCommit[] = body.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.committer.date,
    }));
    report.supersedes = selfSupersedes(commits);
  } catch (e) {
    // Kept apart from `unreachable`: the deployment counts above are real and
    // must still be shown. Only the WHOSE-contention split is missing.
    report.commitsUnreachable = String(e).slice(0, 100);
  }
  return report;
}

const { runs, unreachable } = await fetchRuns();
// Independent of the default-branch question above, and asked even when that
// one failed: a repository whose `main` history is unreadable may still be
// publishing fine, and the reverse. Two facts, never collapsed into one.
/**
 * The beans {@link renderPages} names in its output.
 *
 * Listed here rather than discovered, because a renderer's citations are a
 * property of its PROSE and nothing can derive them from the report object.
 * Adding one to the output without adding it here renders as "unknown", which
 * is the honest failure for this — never a confident wrong claim.
 */
const PAGES_CITES = ["yzsj"] as const;

/**
 * Resolve each cited bean's status ONCE, here, where a repository root exists.
 *
 * Bean `xfyk`. The renderer used to state these outright and the claim went
 * stale when the bean closed. It stays a pure function of its report; the
 * filesystem read belongs where the root is.
 */
function citedBeans(): Record<string, CitedBean> {
  // `repoRootFor`, NOT `process.cwd()`. Bean `a6kl` is precisely this mistake
  // one script over: a corpus resolved from the cwd found nothing and reported
  // `nothing to check` over 1,402 files. Here it would silently render every
  // citation "unknown" whenever the script ran from a subdirectory.
  const store = readBeanStore(repoRootFor(HARNESS_ROOT));
  if (store.state !== "read") {
    // Three states, three messages. The two-way form here said "no bean store
    // in this instance" for a store that is on its branch and merely not
    // mounted (bean `9ofm` row D) — true of neither the repository nor the
    // remedy, and it would send a reader looking for a declaration that is
    // correct.
    const why =
      store.state === "declared-but-absent"
        ? `the declared bean store at ${store.dir} is not there`
        : store.state === "unreachable"
          ? `the bean store is on its branch and not mounted here: ${store.reason}`
          : "no bean store in this instance";
    return Object.fromEntries(PAGES_CITES.map((id) => [id, { state: "unreadable", why }]));
  }
  return Object.fromEntries(
    PAGES_CITES.map((id) => {
      // The id is a SUFFIX of the bean's own id (`folio-assistant-yzsj`), and
      // matching on the full id would tie this to one layer's prefix.
      const bean = store.beans.find((b) => b.id === id || b.id.endsWith(`-${id}`));
      return [id, bean ? { state: "read", status: bean.status } : { state: "absent" }];
    }),
  );
}

const pages = { ...(await fetchPages()), citedBeans: citedBeans() };
const headSha = unreachable ? undefined : await fetchHeadSha();
const changedFiles = headSha ? await fetchChangedFiles(headSha) : undefined;
const repoRoot = (() => {
  try {
    return git(["rev-parse", "--show-toplevel"]);
  } catch {
    return process.cwd();
  }
})();

/**
 * When was this workflow file last changed on the default branch?
 *
 * A red verdict is about the file *as it ran*. If the file changed after that
 * run, the failing version is gone — see `workflowChangedAt` in `ci-health.ts`.
 * Asked against `origin/<branch>` rather than `HEAD`, because the runs being
 * classified are the default branch's; a feature branch's edits have not
 * reached them. Falls back to `HEAD` for a clone with no such remote ref.
 *
 * Returns `undefined` when git cannot answer — a shallow clone, a path git does
 * not know. That leaves the failure reported, which is the safe direction: not
 * knowing when a file changed must never explain a failure away.
 */
const changedAtCache = new Map<string, string | undefined>();
function workflowChangedAt(path: string): string | undefined {
  if (changedAtCache.has(path)) return changedAtCache.get(path);
  let out: string | undefined;
  for (const ref of [`origin/${branch}`, "HEAD"]) {
    try {
      const iso = execFileSync("git", ["log", "-1", "--format=%cI", ref, "--", path], {
        encoding: "utf8",
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (iso) {
        out = iso;
        break;
      }
    } catch {
      // Try the next ref; an unknown ref is not an answer of "never changed".
    }
  }
  changedAtCache.set(path, out);
  return out;
}

/**
 * Read the workflow file and ask {@link pushTriggerOf}. Unreadable is
 * `undefined`, which `assess` treats as "claim nothing" — a file this cannot
 * open must not manufacture a finding about it.
 */
function triggersOnPush(p: string): boolean | undefined {
  if (!p) return undefined;
  try {
    return pushTriggerOf(readFileSync(resolve(repoRoot, p), "utf8"), { branch, changedFiles });
  } catch {
    return undefined;
  }
}

const files = knownWorkflows();

/**
 * The window, described from the runs the page actually contained.
 *
 * `undefined` when there are none — a window with no runs has no span, and
 * inventing one (`0h`) would read as "checked, nothing happened" rather than
 * "nothing to check against".
 */
const window: Window | undefined =
  runs && runs.length > 0
    ? {
        runs: runs.length,
        from: runs.map((r) => r.created_at).reduce((a, b) => (a < b ? a : b)),
        to: runs.map((r) => r.created_at).reduce((a, b) => (a > b ? a : b)),
      }
    : undefined;

/**
 * Top up the window with the scheduled workflows it could not reach.
 *
 * Bounded by construction: only files that carry a `schedule:` AND produced
 * nothing in the page. On this repository that is three. The cap is a hard
 * stop rather than a comment, because the bound is an assumption about a
 * repository's workflows, and an assumption on the hot path of session start
 * should fail visibly rather than quietly issue forty requests.
 */
const SCHEDULED_FETCH_CAP = 8;
const topUp: RunSummary[] = [];
const probes = new Map<string, "never-ran" | "unknown">();
if (runs && files) {
  const seen = new Set(runs.map((r) => r.path).filter((p): p is string => !!p));
  const missing = files.filter((f) => !seen.has(f.path) && hasSchedule(f.path) === true);
  for (const f of missing.slice(0, SCHEDULED_FETCH_CAP)) {
    const rs = await fetchWorkflowRuns(f.path.replace(".github/workflows/", ""));
    // Three outcomes, kept apart. `undefined` is a failed request and claims
    // nothing; an empty array is a successful measurement of zero, which is a
    // real finding (`5rfy`); anything else tops up the window.
    if (rs === undefined) probes.set(f.path, "unknown");
    else if (rs.length === 0) probes.set(f.path, "never-ran");
    else topUp.push(...rs);
  }
  if (missing.length > SCHEDULED_FETCH_CAP) {
    console.error(
      `ci-health: ${missing.length} scheduled workflow(s) missing from the window, ` +
        `only the first ${SCHEDULED_FETCH_CAP} were fetched; the rest are reported unjudged.`,
    );
  }
}

const health = runs
  ? assess([...runs, ...topUp], {
      workflowExists: (p) => existsSync(resolve(repoRoot, p)),
      workflowChangedAt,
      headSha,
      triggersOnPush,
      knownWorkflows: files,
      noRunReason,
      hasSchedule,
      probed: (p) => probes.get(p),
      workflowAddedAt,
      cronOf,
    })
  : [];

/**
 * First parent of a commit, from the LOCAL clone.
 *
 * Local git rather than the API for two reasons: it is free where the API is
 * rate-limited on a trigger that fires per failure, and `ci-health.yml` already
 * guarantees `fetch-depth: 0` for the `superseded` rule — so the history is
 * present anyway. When it is NOT (a shallow clone elsewhere), `rev-parse` fails
 * and this returns `undefined`, which the walk reports as `no-parent` rather
 * than guessing. Bean `kgho`.
 */
function firstParentOf(sha: string): string | undefined {
  try {
    // `stdio` silences git's own complaint. Measured 2026-09-30: without it a
    // commit absent from the local clone printed
    // `fatal: ambiguous argument '<sha>^1'` ABOVE the report, where a reader
    // takes it for the checker crashing rather than for one lookup falling
    // back. `defaultBranch()` above silences git for the same reason.
    const out = execFileSync("git", ["rev-parse", `${sha}^1`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[0-9a-f]{40}$/.test(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

/**
 * First parent from the API, for a commit the local clone does not have.
 *
 * The local lookup is not always enough, and this was measured rather than
 * anticipated: run locally against a `main` whose failing commit had not been
 * fetched, every walk ended `no-parent` at step 0 — a truthful answer, and a
 * useless one. `ci-health.yml` checks out with `fetch-depth: 0`, but a
 * `workflow_run` checkout is of the default branch's head, so a failing commit
 * that is not its ancestor is absent there too.
 *
 * Still returns `undefined` on failure, so an unanswerable lookup stays
 * `no-parent` rather than becoming a guess.
 */
async function firstParentFromApi(sha: string): Promise<string | undefined> {
  if (!slug) return undefined;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}/commits/${sha}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { parents?: Array<{ sha?: string }> };
    const first = body.parents?.[0]?.sha;
    return first && /^[0-9a-f]{40}$/.test(first) ? first : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One workflow's conclusion on one commit.
 *
 * Returns `"none"` when the workflow has no run on that commit and `"unknown"`
 * when the request itself failed — and those are DIFFERENT answers, because
 * `blameFailingRun` may name a suspect on neither but must report them
 * distinctly. Collapsing them would make a rate-limited request look like a
 * commit nothing ran on.
 */
async function conclusionOnCommit(file: string, sha: string): Promise<ConclusionOnCommit> {
  if (!slug) return "unknown";
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${slug}/actions/workflows/${encodeURIComponent(file)}` +
        `/runs?head_sha=${encodeURIComponent(sha)}&per_page=20`,
      {
        headers: {
          accept: "application/vnd.github+json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return "unknown";
    const body = (await res.json()) as { workflow_runs?: Array<{ status?: string; conclusion?: string | null }> };
    // `NOT_A_VERDICT`, not a hand-written list. This read
    // `!== "cancelled" && !== "skipped"` and forgot `neutral`, so a
    // neutral-only parent came back `failure` here while `classifyRuns` called
    // it no verdict at all — and the walk then continued past it and could name
    // it as the suspect. Found by review on #1725.
    const settled = (body.workflow_runs ?? []).filter(
      (r) => r.status === "completed" && r.conclusion && !NOT_A_VERDICT.has(r.conclusion),
    );
    if (settled.length === 0) return "none";
    // ANY success on the commit counts as green — a re-run that passed is the
    // commit passing. Only all-settled-runs-failed is a red.
    return settled.some((r) => r.conclusion === "success") ? "success" : "failure";
  } catch {
    return "unknown";
  }
}

/**
 * Blame per red workflow — which merge, or explicitly that it cannot be told.
 *
 * Only for RED rows, and only when the row carries a `failingSha` and a `path`.
 * A row missing either is simply absent from the map, which `render` prints as
 * "no attribution was computed for this workflow" rather than as silence.
 */
async function computeBlame(rows: readonly WorkflowHealth[]): Promise<Map<string, BlameVerdict>> {
  const out = new Map<string, BlameVerdict>();
  for (const h of rows) {
    if (h.health !== "red" || !h.failingSha || !h.path) continue;
    const file = h.path.replace(/^\.github\/workflows\//, "");
    // Memoised per workflow: a walk revisits no commit, but two workflows red on
    // the same stretch would otherwise re-ask for the same shas.
    const seen = new Map<string, ConclusionOnCommit>();
    // Parents resolved so far. Local git first, API only for what it lacks, so
    // the common case costs no request.
    const parents = new Map<string, string | undefined>();
    const parentOf = (sha: string): string | undefined => {
      if (!parents.has(sha)) parents.set(sha, firstParentOf(sha));
      return parents.get(sha);
    };
    // The walk is synchronous and the lookup is async, so the shas are
    // collected first: walk with a lookup that records what it wants, then
    // fetch, then walk again for real. No async inside the pure function.
    //
    // The round budget is derived, not guessed: each round resolves the walk,
    // or fetches ONE missing parent, or fetches ONE conclusion. A walk of
    // `BLAME_WALK_CAP` steps can therefore need up to two fetches per step, so
    // `2 * cap` rounds, and the `+ 2` is slack for the final resolving round.
    //
    // This read `round <= BLAME_WALK_CAP + 1` with a `round === CAP + 1` case
    // to record the verdict — a second statement of the walk's own bound, which
    // went wrong the moment that bound changed. Review on #1725 pointed at it.
    // Now the verdict is recorded after the loop however it ended, so no
    // constant appears twice.
    const ROUND_BUDGET = 2 * BLAME_WALK_CAP + 2;
    let verdict: BlameVerdict | undefined;
    let pending: string | undefined;
    for (let round = 0; round < ROUND_BUDGET; round++) {
      pending = undefined;
      let needParent: string | undefined;
      const v = blameFailingRun({
        failingSha: h.failingSha,
        firstParent: (sha) => {
          const local = parentOf(sha);
          if (local === undefined) needParent ??= sha;
          return local;
        },
        conclusionOn: (sha) => {
          const known = seen.get(sha);
          if (known !== undefined) return known;
          pending ??= sha;
          // Anything not yet fetched reads as a failed lookup, which ENDS the
          // walk here rather than letting it invent a green.
          return "unknown";
        },
      });
      // A parent the clone lacks is asked for once, from the API, and the walk
      // is retried. Only then is `no-parent` the real answer.
      verdict = v;
      if (needParent !== undefined && v.kind === "cannot-determine" && v.why === "no-parent") {
        parents.set(needParent, await firstParentFromApi(needParent));
        if (parents.get(needParent) !== undefined) continue;
      }
      if (pending === undefined || v.kind === "suspect") break;
      const got = await conclusionOnCommit(file, pending);
      seen.set(pending, got);
    }
    // However the loop ended — resolved, or out of budget with the last
    // verdict being a cannot-determine. Recording it unconditionally is what
    // keeps "no attribution was computed" meaning the caller never asked,
    // rather than meaning the budget ran out silently.
    if (verdict !== undefined) out.set(h.workflow, verdict);
  }
  return out;
}

const blame = health.some((h) => h.health === "red") ? await computeBlame(health) : new Map();

const report = () =>
  `${render(health, { unreachable, branch, window, blame })}\n${renderPages(pages)}`;

if (outFile) writeFileSync(outFile, report());

if (markdown) {
  console.log(report());
} else if (unreachable) {
  console.error(`CI health: NOT CHECKED — ${unreachable}`);
  console.error("Treat this as unknown, not as green.");
} else {
  // The SPAN, not just the count. 100 runs is a page, not a period: measured
  // here 2026-09-20 it reached back 6.1 hours, which cannot contain a weekly
  // workflow. A reader given only "100 recent runs" reads the ticks below as a
  // verdict on the repository.
  console.log(
    `CI health on \`${branch}\` (${window ? describeWindow(window) : `${runs!.length} recent runs`})\n`,
  );
  for (const h of health) {
    // `no-runs` rows are reported below, by name if scheduled and as a count
    // otherwise. Leaving them in this loop printed a green ✓ beside the word
    // `no-runs` on 32 lines — the exact misread the rows were added to fix.
    if (h.noRunsInWindow) continue;
    const mark =
      h.health === "red" ? "✗" : h.health === "running" ? "…" : h.health === "superseded" ? "❔" : "✓";
    const detail =
      h.health === "red"
        ? `${h.consecutiveFailures} consecutive failure(s), ` +
          (h.daysSinceSuccess === undefined
            ? "no success in window"
            : `last green ${h.daysSinceSuccess}d ago`)
        : h.health === "superseded"
          ? `last failed ${h.daysSinceLastRun}d ago; file changed since — stale, not green`
          : h.health;
    // The mark, not just the detail: a reader scans the column of ticks. A ✓
    // beside a workflow whose newest run has not settled is the misread bean
    // `gpuu` records — it says the head passed, when the head has not reported.
    const pendingMark = h.newestUnsettled || h.headUnjudged ? "⏳" : mark;
    const pendingNote = h.headUnjudged
      ? " (no run has judged the current head — verdict predates HEAD)"
      : h.newestUnsettled
        ? " (newest run has not reported — verdict may predate HEAD)"
        : "";
    console.log(`  ${pendingMark} ${h.workflow.padEnd(40)} ${detail}${pendingNote}`);
  }
  // The denominator. Three ticks over a repository of 38 workflow files read
  // as a clean bill of health for 38 workflows, and that is the misread this
  // whole change exists for — `xom7` reproduced inside the module written for
  // `xom7`. A scheduled workflow that is still unjudged after the top-up is
  // named; the rest are a count, because most are folio-vendored and naming
  // them every run teaches the reader to skip the section.
  const unjudged = health.filter((h) => h.noRunsInWindow);
  for (const h of unjudged.filter((h) => h.scheduled && h.tooYoung)) {
    console.log(
      `  🌱 ${h.workflow.padEnd(40)} not yet run — file is ${h.fileAgeDays}d old and ` +
        `its schedule has not come round. Nothing to do.`,
    );
  }
  for (const h of unjudged.filter((h) => h.scheduled && !h.tooYoung)) {
    const why =
      h.probe === "never-ran"
        ? "scheduled, and has NEVER run on this branch (asked directly)"
        : h.probe === "unknown"
          ? "scheduled; the direct request failed — state unknown"
          : "scheduled, outside the window, and not asked directly";
    console.log(`  ⚠ ${h.workflow.padEnd(40)} UNJUDGED — ${why}. Not green.`);
  }
  const other = unjudged.filter((h) => !h.scheduled);
  if (other.length > 0) {
    /* THE CLASSES ARE MEASURED NOW. This read "(dispatch-only, or vendored for
     * a folio)" over a count of 31 — a cause asserted rather than computed,
     * which could not distinguish 31 files that cannot fire from 30 that
     * cannot and one that should have. The benign classes stay counts, because
     * naming 30 every run is how a reader learns to skip the section; the one
     * class that is a defect is named. See `whyNoRun`. */
    const by = (r: NoRunReason) => other.filter((h) => h.noRunReason === r).length;
    console.log(
      `\n  ${other.length} further workflow file(s) produced no run in the window — unjudged, not green:`,
    );
    console.log(
      `    ${by("dispatch-only")} cannot fire by themselves (\`workflow_dispatch\` / ` +
        `\`workflow_call\` only), ${by("path-filtered")} fire only when specific paths ` +
        `change, ${by("undetermined")} could not be read.`,
    );
    for (const h of other.filter((x) => x.noRunReason === "auto-triggered")) {
      console.log(
        `  ⚠ ${h.workflow.padEnd(40)} UNJUDGED — it CAN fire on this branch and produced no run. Not green.`,
      );
    }
  } else if (files === undefined) {
    console.log(
      "\n  (Could not read .github/workflows/ — this report covers the runs it " +
        "saw and cannot say what it missed.)",
    );
  }
}

// The Pages section reaches the human path too, and reaches it even when the
// default-branch check above could not look — `unreachable` there says nothing
// about whether the previews are building. Printed rather than graded: the
// counts have no calibrated threshold, so `renderPages` states them and the
// reader judges. See bean `3yi4`.
if (!markdown) console.log(`\n${renderPages(pages)}`);

const red = health.filter((h) => h.health === "red");
if (warn || markdown) process.exit(0);
// Unreachable is a failure of the check, not a pass. Exiting 0 here would make
// "could not look" indistinguishable from "looked and it was fine".
if (unreachable) process.exit(2);
if (red.length > 0) {
  console.error(`\n${red.length} workflow(s) failing on \`${branch}\`.`);
  process.exit(1);
}
