/**
 * The FHIR-IG site publisher: build a FHIR IG the way its reusable workflow
 * does, and lay the output on the publish branch the way that workflow does —
 * or, for an IG repository that mounts a harness, publish the folio site with
 * the IG composed at its root.
 *
 * @module fhir-harness/scripts/stage-local-ig
 * @covers none — a PUBLISHER, not an audit: it plans and runs one IG build and judges nothing
 *
 * ## Here, and reached through a slot (owner, 2026-10-14, Q4)
 *
 * This was `cat-harness-tools/scripts/stage-local-ig.ts`, with the IG half of
 * `stage-local.ts` beside it. It names this layer's own reusable workflows and
 * the IG Publisher, so the owner ruled (Q4 of the folio-assistant#2529
 * reference-direction review) that it moves to the layer that owns IG
 * builds, and that `stage-local.ts` reaches it through a declared publisher
 * slot. This layer declares the slot: `pipeline-plugins/site-publisher-ig.json`
 * names {@link IG_PUBLISHER} through `pipeline/plugin-slots.ts`, and
 * `stage-local.ts` finds it through the dependencies of the repository it is
 * publishing. It never names this file. The workflows it publishes for
 * ({@link IG_WORKFLOWS}) are declared here, by the layer whose workflows they are.
 *
 * `stage-local.ts` keeps the parts that every publish shares: which publisher
 * a repository uses (`site-publisher.ts`), the target, the plan's format, the
 * push loop and the Artifact bundle. It lends the ones that are its own
 * ({@link PublisherHost}), so the IG path pushes and prints exactly as the
 * folio path does.
 *
 * ## Read from the workflow, never restated
 *
 * An IG repository names its reusable workflow in its own
 * `.github/workflows/*.yml` (`uses: <owner>/<repo>/.github/workflows/<file>@<ref>`).
 * That file is fetched at that ref and its `build` job is PLANNED step by
 * step: each `run:` block is run as written, with the environment GitHub
 * would give it; each `docker://` step is run in its image with the
 * workspace mounted; the `JamesIves/github-pages-deploy-action` steps are
 * READ for the layout (folder, target folder, commit message, clean and
 * clean-exclude) and performed here, because the agent pushes, not the
 * action. A change to the workflow's build is therefore a change here
 * without an edit.
 *
 * ## What is not run, and why
 *
 * {@link planIgSteps} skips, and the plan names, every step that:
 * - is an Actions action other than a `docker://` one (the checkout IS the
 *   agent's checkout; `setup-python` is a fresh venv; an artifact upload has
 *   nowhere to go);
 * - reads a secret (a PR lookup, a PR comment, the branch index): the agent
 *   path hands no token to a downloaded script;
 * - commits or pushes to the SOURCE branch (the README write-back), since a
 *   publish never writes to the branch it publishes;
 * - has an `if:` that is false here.
 *
 * ## `fhirbuild.yml` builds nothing on Pages
 *
 * `fhirbuild.yml` posts the commit to build.fhir.org's auto-build trigger and
 * nothing else. The Pages build its callers' headers describe ("publish
 * default branches to /, other branches branches/<branch>") is its sibling
 * `ghbuild.yml`, which upstream callers call beside it. So a called workflow
 * with no deploy step is resolved to the `ghbuild.yml` beside it at the same
 * ref ({@link PAGES_SIBLING}), and the plan says so. The build.fhir.org
 * trigger is not sent: it is an external build, and starting one is not
 * publishing this repository's Pages.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { siteFileFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { resolveLandingInstance } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.ts";
import { findDeclarationFile } from "@litlfred/cat-harness-tools/schemas/kg/instance-roots.ts";
import { scriptTable } from "@litlfred/cat-harness-tools/schemas/sdlc/script-table.ts";
import { buildInstanceSite, keepPinned, lockedMountPaths, recipeRead, siteFields, siteScopeOf, stagingDir } from "../../cat-harness-tools/scripts/build-instance-site.ts";
import { igOpenapiGraph } from "../../cat-harness-tools/openapi/scripts/ig-site-openapi.ts";
import { igPreviewData, openPrFor, proseRenderer } from "./ig-review-data.ts";
import { NAVBAR_ROW_ID } from "../../cat-harness-tools/scripts/lib/harness-rail.ts";
import { callerInputs, type UsesRef } from "../../cat-harness-tools/scripts/site-publisher.ts";
import { type DroppedByRuling, parityShortfall, siteFeatures } from "../../cat-harness-tools/scripts/site-parity.ts";
import type { Composed, PublisherHost, PublisherRun, StagePlan, StageResult } from "../../cat-harness-tools/scripts/stage-local.ts";

// The preview directories (cat-harness-tools `schemas/sdlc/preview-prefix.ts`):
// `branches/` since 2026-11-05, and the legacy `STAGING/` still read. Named
// here, not imported, so this layer does not wait on that module's release.
const PREVIEW_PREFIXES: readonly string[] = ["branches", "STAGING"];

// The publisher's registration data lives in `ig-publisher.ts`, which loads
// no network or spawn, so the plugin table stays out of the gates' closures.
import { IG_PUBLISHER, IG_WORKFLOWS, PAGES_SIBLING } from "./ig-publisher.ts";
export { IG_PUBLISHER, IG_WORKFLOWS, PAGES_SIBLING };

/**
 * What marks a publish root as a folio's: `publish-main`'s manifest, the
 * previews, the render log, and `folio-build.json`, the stamp every folio site
 * build writes (`site-build-stamp.ts`). The stamp is the one a root deployed by
 * an IG repository's `folio-site.yml` carries (an IG repository whose site `folio-site.yml` built);
 * without it a root IG deploy would replace that site with bare Publisher output.
 */
export const FOLIO_ROOT_MARKERS = ["_main-site.json", "STAGING", "_render-log", "folio-build.json"] as const;
/**
 * The one marker a CHROMED IG output may replace: the stamp of the chromed IG
 * site `folio-site.yml` deployed (owner, 2026-10-14, decision "1": the one
 * publish path gives an IG the chrome `folio-site.yml` gave it). The other
 * markers are a folio's own publish (`publish-main`'s manifest, its previews,
 * its render log), which no IG deploy replaces, chromed or not.
 */
export const CHROMED_IG_REPLACES = ["folio-build.json"] as const;

/**
 * Does this page wear the harness chrome — the icon row `#fa-navbar-row` that
 * both chromes write: the Jekyll head include on a page `folio-site.yml` laid
 * out, and `rail-standalone-pages` on a page it railed? The one test both
 * agree on, so a root is recognised as chromed whichever route chromed it.
 */
export function wearsChrome(html: string): boolean {
  return html.includes(`id="${NAVBAR_ROW_ID}"`);
}

/** What the chrome step left on a built IG: its pages, those carrying the rail (or a theme nav), and those carrying the icon row. */
export interface ChromeCoverage {
  pages: number;
  railed: number;
  navbarRow: number;
  /** The root page, `index.html`, wears the chrome; undefined when the output has none. */
  index?: boolean;
}

/** Count the chrome on every `.html` page under `site`. Pure over the files. */
export function chromeCoverage(site: string): ChromeCoverage {
  const c: ChromeCoverage = { pages: 0, railed: 0, navbarRow: 0 };
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const abs = join(d, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      if (!e.name.endsWith(".html")) continue;
      const html = readFileSync(abs, "utf-8");
      c.pages++;
      if (/<nav class="fa-nav"|id="site-nav"/.test(html)) c.railed++;
      const row = wearsChrome(html);
      if (row) c.navbarRow++;
      if (abs === join(site, "index.html")) c.index = row;
    }
  };
  if (existsSync(site)) walk(site);
  return c;
}

/**
 * Why a chrome step did NOT chrome the site, or undefined when it did: the
 * root page wears the icon row, and so does at least one page railed. Said in
 * words, because the caller refuses a root publish on it.
 */
export function chromeShortfall(c: ChromeCoverage): string | undefined {
  if (c.pages === 0) return "the IG output holds no .html page to chrome";
  if (c.railed === 0) return `none of its ${c.pages} page(s) carries the rail`;
  if (c.navbarRow === 0) return `none of its ${c.pages} page(s) carries the icon row (#${NAVBAR_ROW_ID}); the harness data it is drawn from was not there`;
  if (c.index === false) return `its root page, index.html, carries no icon row (#${NAVBAR_ROW_ID})`;
  return undefined;
}
/**
 * Paths `JamesIves/github-pages-deploy-action@v4` never deletes under
 * `clean`, whatever `clean-exclude` says: the action's own built-in excludes.
 */
export const DEPLOY_ACTION_ALWAYS_KEPT = [".git", ".ssh", ".github"] as const;

/**
 * The text of a reusable workflow, at the ref its caller names. From `source`
 * (a local checkout of that repository) when given, otherwise fetched with
 * git into a bare cache, so nothing is installed and no API is called.
 */
export function fetchWorkflow(u: UsesRef, path: string, source?: string): string {
  if (source) {
    const f = join(resolve(source), path);
    if (!existsSync(f)) throw new Error(`${f}: not in the given workflow source`);
    return readFileSync(f, "utf-8");
  }
  const cache = join(tmpdir(), "stage-local-workflows", `${u.owner}__${u.repo}.git`);
  if (!existsSync(cache)) {
    mkdirSync(cache, { recursive: true });
    execFileSync("git", ["init", "-q", "--bare", cache]);
  }
  execFileSync("git", ["-C", cache, "fetch", "-q", "--depth=1", "--filter=blob:none", `https://github.com/${u.owner}/${u.repo}`, u.ref], { stdio: ["ignore", "ignore", "inherit"] });
  return execFileSync("git", ["-C", cache, "show", `FETCH_HEAD:${path}`], { encoding: "utf-8" });
}

// ── The workflow, as data ──────────────────────────────────────────────────

export interface WfStep {
  name?: string;
  id?: string;
  if?: string | boolean;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
  "continue-on-error"?: boolean | string;
}

export interface Workflow {
  inputs: Record<string, unknown>;
  jobEnv: Record<string, unknown>;
  steps: WfStep[];
}

/** The single job of an IG's reusable workflow, with its `workflow_call` input defaults. */
export function readWorkflow(text: string): Workflow {
  const y = parseYaml(text) as { on?: Record<string, { inputs?: Record<string, { default?: unknown }> }>; jobs?: Record<string, { steps?: WfStep[]; env?: Record<string, unknown> }> };
  const call = y.on?.workflow_call?.inputs ?? {};
  const inputs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(call)) if (v && "default" in v) inputs[k] = v.default;
  const jobs = Object.values(y.jobs ?? {});
  const job = jobs.find((j) => j.steps?.some((s) => /github-pages-deploy-action/.test(s.uses ?? ""))) ?? jobs[0];
  return { inputs, jobEnv: job?.env ?? {}, steps: job?.steps ?? [] };
}

export interface IgDeploy {
  branch: string;
  folder: string;
  /** Relative to the publish root; "" for the root itself. May hold `${{ env.BRANCH_DIR }}`. */
  targetFolder: string;
  message: string;
  clean: boolean;
  cleanExclude: string[];
  singleCommit: boolean;
}

/**
 * The deploy steps of the workflow: the first `github-pages-deploy-action`
 * step whose condition is the default branch (`main`) and the first that is
 * not (`candidate`). Retries (conditioned on an earlier step's outcome) are
 * the same deploy again and are not read.
 */
export function readIgDeploys(wf: Workflow): { main?: IgDeploy; candidate?: IgDeploy } {
  const out: { main?: IgDeploy; candidate?: IgDeploy } = {};
  for (const s of wf.steps) {
    if (!/github-pages-deploy-action/.test(s.uses ?? "")) continue;
    const cond = String(s.if ?? "");
    if (/\.outcome\s*==/.test(cond)) continue;
    const which = /IS_DEFAULT_BRANCH\s*==\s*'true'/.test(cond) ? "main" : /IS_DEFAULT_BRANCH\s*==\s*'false'/.test(cond) ? "candidate" : undefined;
    if (!which || out[which]) continue;
    const w = s.with ?? {};
    const str = (k: string, d: string) => (w[k] === undefined ? d : String(w[k]).trim());
    out[which] = {
      branch: str("branch", "gh-pages"),
      folder: str("folder", ".").replace(/^\.\//, "").replace(/\/+$/, "") || ".",
      targetFolder: str("target-folder", "").replace(/^\.?\/+/, "").replace(/\/+$/, ""),
      message: str("commit-message", ""),
      clean: str("clean", "true") !== "false",
      cleanExclude: str("clean-exclude", "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      singleCommit: str("single-commit", "false") === "true",
    };
  }
  return out;
}

// ── Expressions ────────────────────────────────────────────────────────────

export interface ExprContext {
  github: Record<string, string>;
  inputs: Record<string, unknown>;
  env: Record<string, string>;
  steps: Record<string, { outputs: Record<string, string>; outcome?: string }>;
}

type Tok = { t: "id" | "str" | "op" | "(" | ")" | "num"; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let v = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") break;
        v += s[i++];
      }
      i++;
      out.push({ t: "str", v });
      continue;
    }
    const two = s.slice(i, i + 2);
    if (["==", "!=", "&&", "||", "<=", ">="].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if (c === "!" || c === "<" || c === ">") { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(" || c === ")") { out.push({ t: c, v: c }); i++; continue; }
    const m = /^[A-Za-z_][\w.-]*|^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error(`cannot read expression '${s}' at '${s.slice(i)}'`);
    out.push({ t: /^\d/.test(m[0]) ? "num" : "id", v: m[0] });
    i += m[0].length;
  }
  return out;
}

type Val = string | boolean | number | undefined;
const truthy = (v: Val) => v !== undefined && v !== "" && v !== false && v !== 0;
const asStr = (v: Val) => (v === undefined ? "" : String(v));

/**
 * Evaluate a GitHub Actions expression over the context. Enough of the
 * language for a workflow's `if:` and `${{ }}`: property paths, string and
 * number literals, `== != ! && || ( )`, and the status functions — which are
 * all "nothing has failed", since a failed step stops the run here.
 * Comparison is on strings (`true` and `'true'` are equal), the reading every
 * condition in an IG workflow means.
 */
export function evalExpr(expr: string, ctx: ExprContext): Val {
  const src = expr.trim().replace(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/, "$1");
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const lookup = (path: string): Val => {
    const [head, ...rest] = path.split(".");
    if (head === "true") return true;
    if (head === "false") return false;
    if (head === "null") return undefined;
    let v: unknown = head === "github" ? ctx.github : head === "inputs" ? ctx.inputs : head === "env" ? ctx.env : head === "steps" ? ctx.steps : head === "secrets" ? {} : undefined;
    for (const k of rest) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
    return v as Val;
  };
  const primary = (): Val => {
    const t = toks[p++];
    if (!t) throw new Error(`unexpected end of expression '${src}'`);
    if (t.t === "str") return t.v;
    if (t.t === "num") return Number(t.v);
    if (t.t === "(") { const v = or(); p++; return v; }
    if (t.t === "op" && t.v === "!") return !truthy(primary());
    if (t.t === "id") {
      if (peek()?.t === "(") {
        p++;
        while (peek() && peek()!.t !== ")") p++;
        p++;
        if (["success", "always", "cancelled", "failure"].includes(t.v)) return t.v === "success" || t.v === "always";
        throw new Error(`function ${t.v}() is not supported here`);
      }
      return lookup(t.v);
    }
    throw new Error(`unexpected '${t.v}' in '${src}'`);
  };
  const cmp = (): Val => {
    let l = primary();
    while (peek()?.t === "op" && ["==", "!="].includes(peek()!.v)) {
      const op = toks[p++]!.v;
      const r = primary();
      const eq = asStr(l).toLowerCase() === asStr(r).toLowerCase();
      l = op === "==" ? eq : !eq;
    }
    return l;
  };
  const and = (): Val => {
    let l = cmp();
    while (peek()?.v === "&&") { p++; const r = cmp(); l = truthy(l) ? r : l; }
    return l;
  };
  const or = (): Val => {
    let l = and();
    while (peek()?.v === "||") { p++; const r = and(); l = truthy(l) ? l : r; }
    return l;
  };
  const v = or();
  if (p !== toks.length) throw new Error(`trailing tokens in '${src}'`);
  return v;
}

/** Replace every `${{ … }}` in a string with its value. */
export function interpolate(s: string, ctx: ExprContext): string {
  return s.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e: string) => asStr(evalExpr(e, ctx)));
}

/** An `if:` as GitHub reads it: absent is true, and a bare expression needs no `${{ }}`. */
export function stepRuns(cond: WfStep["if"], ctx: ExprContext): boolean {
  if (cond === undefined) return true;
  if (typeof cond === "boolean") return cond;
  return truthy(evalExpr(cond, ctx));
}

// ── The plan ───────────────────────────────────────────────────────────────

export type StepAction = "run" | "docker" | "venv" | "deploy" | "skip";

export interface PlannedStep {
  name: string;
  action: StepAction;
  reason?: string;
  /** The step itself, for `run` and `docker`. */
  step: WfStep;
}

/** Why a step is not run on this path, or undefined when it is. Pure over the step. */
export function skipReason(s: WfStep): { action: StepAction; reason?: string } {
  const env = JSON.stringify(s.env ?? {});
  const uses = s.uses ?? "";
  if (/github-pages-deploy-action/.test(uses)) return { action: "deploy", reason: "performed by stage-local: the agent pushes, not the action" };
  if (uses.startsWith("docker://")) return { action: "docker" };
  if (/^actions\/setup-python@/.test(uses)) return { action: "venv", reason: "a fresh venv stands in for the runner's Python" };
  if (/^actions\/checkout@/.test(uses)) return { action: "skip", reason: "the agent's checkout is the content" };
  if (uses) return { action: "skip", reason: `an Actions action (${uses.split("@")[0]}) with no runner here` };
  if (/secrets\./.test(env)) return { action: "skip", reason: "reads a secret; the agent path hands no token to a downloaded script" };
  if (/\bgit\s+(-C\s+\S+\s+)?(push|commit)\b/.test(s.run ?? "")) return { action: "skip", reason: "commits or pushes to the source branch; a publish never writes the branch it publishes" };
  return { action: "run" };
}

/**
 * Every step of the workflow, in order, with what this path does with it.
 * Conditions are evaluated against `ctx` as it stands; the run re-evaluates
 * each as it reaches it, because earlier steps set `env`.
 */
export function planIgSteps(wf: Workflow, ctx: ExprContext): PlannedStep[] {
  const setEarlier = new Set<string>();
  return wf.steps.map((s, i) => {
    const name = s.name ?? s.uses ?? `step ${i + 1}`;
    const k = skipReason(s);
    const written = envWrittenBy(s);
    try {
      if (k.action === "skip" || k.action === "deploy") return { name, ...k, step: s };
      const pending = [...String(s.if ?? "").matchAll(/env\.([A-Za-z_]\w*)/g)].map((m) => m[1]!).filter((v) => setEarlier.has(v) && !(v in ctx.env));
      if (pending.length) return { name, ...k, reason: `runs if ${String(s.if)} — ${pending.join(", ")} is set by an earlier step, so decided when the run reaches it`, step: s };
      let runs: boolean;
      try {
        runs = stepRuns(s.if, ctx);
      } catch (e) {
        return { name, action: "skip" as const, reason: `condition not readable here: ${(e as Error).message}`, step: s };
      }
      if (!runs) return { name, action: "skip" as const, reason: `if: ${String(s.if)} is false here`, step: s };
      return { name, ...k, step: s };
    } finally {
      for (const v of written) setEarlier.add(v);
    }
  });
}

/** The variables a step exports to later steps through `$GITHUB_ENV`. */
export function envWrittenBy(s: WfStep): string[] {
  return [...(s.run ?? "").matchAll(/\b([A-Za-z_]\w*)=[^\n]*>>\s*"?\$\{?GITHUB_ENV/g)].map((m) => m[1]!);
}

/** The workflow's branch directory rule (resolve_branch.py `_branch_dir`): the last path component. Used for the PLAN; a run takes `BRANCH_DIR` from the workflow's own step. */
export function branchDirOf(branch: string): string {
  return branch.replace(/^refs\/heads\//, "").split("/").pop()!;
}

export interface IgTarget {
  deploy: IgDeploy;
  /** Relative to the publish root; "" is the root. */
  dest: string;
  /** With `clean` at the root: what is kept; everything else at the root is replaced. */
  keep?: string[];
  commit: string[];
}

/** Where the IG's output goes and how, from the workflow's deploy steps. Pure. */
export function igTarget(d: { main?: IgDeploy; candidate?: IgDeploy }, o: { isDefault: boolean; branchDir: string; sha: string; runUrl: string }): IgTarget {
  const deploy = o.isDefault ? d.main : d.candidate;
  if (!deploy) throw new Error(`the workflow has no ${o.isDefault ? "default-branch" : "candidate-branch"} deploy step to mirror`);
  const dest = deploy.targetFolder.replace(/\$\{\{\s*env\.BRANCH_DIR\s*\}\}/g, o.branchDir);
  if (dest.split("/").some((s) => s === ".." || s === ".")) throw new Error(`deploy target '${dest}' leaves the publish root`);
  if (!o.isDefault && (dest === "" || !dest.includes(o.branchDir))) throw new Error(`a candidate deploy to '${dest || "/"}' would overwrite the root; refusing`);
  const keep = dest === "" && deploy.clean ? [...new Set([...DEPLOY_ACTION_ALWAYS_KEPT, ...deploy.cleanExclude])] : undefined;
  return { deploy, dest, ...(keep ? { keep } : {}), commit: [deploy.message || `Deploy ${o.isDefault ? "main" : "candidate"} branch`, `from ${o.sha}`, `built locally: ${o.runUrl}`] };
}

/**
 * Lay the built folder onto a publish-branch checkout as the deploy action
 * would: into the target folder, without deleting when `clean` is off; at the
 * root with `clean`, removing every top-level entry not kept first.
 *
 * `chromed` says the folder wears the harness chrome (the step stage-local
 * runs after the build). A root that wears it is never replaced by a folder
 * that does not: the root's `index.html` is read, not only the stamp, because
 * a root chromed by stage-local itself carries no `folio-build.json`.
 * Beyond the chrome, a clean root deploy must carry everything the root it
 * replaces carries — the theme's side bar and search, the served
 * directories, the build stamp — measured on the pages by `site-parity.ts`;
 * a railed IG Publisher output over a root `folio-site.yml` built is refused.
 */
export function applyIgDeploy(pages: string, folder: string, t: IgTarget, copy: (from: string, to: string) => void, o: { chromed?: boolean } = {}): void {
  const dest = join(pages, t.dest);
  if (t.keep) {
    const replaceable: readonly string[] = o.chromed ? CHROMED_IG_REPLACES : [];
    const folio = FOLIO_ROOT_MARKERS.filter((m) => existsSync(join(pages, m)) && !t.keep!.includes(m) && !replaceable.includes(m));
    if (folio.length) throw new Error(`the publish branch carries a folio's site (${folio.join(", ")}); a clean IG deploy at the root would delete it — refusing`);
    const index = join(pages, "index.html");
    if (!o.chromed && existsSync(index) && wearsChrome(readFileSync(index, "utf-8"))) {
      throw new Error("the publish root wears the harness chrome (#" + NAVBAR_ROW_ID + " on index.html) and this IG output does not; a clean deploy would replace it with bare IG Publisher pages — refusing");
    }
    // Owner, 2026-10-14: a root publish loses nothing the root has — measured on the pages (site-parity.ts).
    const short = parityShortfall(siteFeatures(pages, t.keep), siteFeatures(folder));
    if (short.length) throw new Error(`the IG output lacks what the publish root carries: ${short.join("; ")} — refusing a clean deploy at the root`);
    for (const e of readdirSync(pages)) if (!t.keep.includes(e)) rmSync(join(pages, e), { recursive: true, force: true });
  } else if (t.dest !== "" && t.deploy.clean) {
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  copy(folder, dest);
}

// ── Running it ─────────────────────────────────────────────────────────────

/** Split a docker action's `args` the way the runner does: on whitespace, honouring quotes. */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  let any = false;
  for (const c of s) {
    if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      any = true;
    } else if (/\s/.test(c)) {
      if (cur || any) out.push(cur);
      cur = "";
      any = false;
    } else cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}

/** What a run needs on this machine that is missing, by name. Empty when nothing is. */
export function missingPrerequisites(plan: PlannedStep[], has: (cmd: string[]) => boolean): string[] {
  const out: string[] = [];
  const docker = plan.some((s) => s.action === "docker" || (s.action === "run" && /\bdocker\s+(run|exec)\b/.test(s.step.run ?? "")));
  if (docker && !has(["docker", "info"])) out.push("a running Docker daemon (the workflow runs IG Publisher in its container image; `docker info` fails here)");
  if (plan.some((s) => s.action === "venv") && !has(["python3", "-m", "venv", "--help"])) out.push("python3 with the venv module (stands in for actions/setup-python)");
  if (plan.some((s) => s.action === "run") && !has(["bash", "--version"])) out.push("bash");
  if (!has(["curl", "--version"])) out.push("curl (the workflow fetches its scripts and IG Publisher with it)");
  return out;
}

export const commandWorks = (cmd: string[]): boolean => spawnSync(cmd[0]!, cmd.slice(1), { stdio: "ignore", timeout: 20_000 }).status === 0;

/** Read `KEY=VALUE` lines and `KEY<<DELIM` blocks from a GITHUB_ENV / GITHUB_OUTPUT file. */
export function readEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const h = /^([^=<]+)<<(.+)$/.exec(l);
    if (h) {
      const body: string[] = [];
      for (i++; i < lines.length && lines[i] !== h[2]; i++) body.push(lines[i]!);
      out[h[1]!] = body.join("\n");
      continue;
    }
    const e = l.indexOf("=");
    if (e > 0) out[l.slice(0, e)] = l.slice(e + 1);
  }
  return out;
}

/**
 * Run the planned build in `repo`, in the workflow's order, with the
 * environment the runner would give each step. Throws at the first failing
 * step that is not `continue-on-error`. Returns the final context, whose
 * `env` holds what the steps exported (`BRANCH_DIR`, `IS_DEFAULT_BRANCH`).
 */
export function runIgBuild(repo: string, wf: Workflow, ctx: ExprContext, log: (s: string) => void): ExprContext {
  const scratch = join(tmpdir(), `stage-local-ig-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  const envFile = join(scratch, "github_env");
  writeFileSync(envFile, "");
  let path = process.env.PATH ?? "";
  for (const [k, v] of Object.entries(wf.jobEnv)) ctx.env[k] = interpolate(String(v), ctx);
  try {
  for (const [i, s] of wf.steps.entries()) {
    const name = s.name ?? s.uses ?? `step ${i + 1}`;
    const k = skipReason(s);
    if (k.action === "skip" || k.action === "deploy") { log(`  – ${name}: ${k.reason}`); continue; }
    if (!stepRuns(s.if, ctx)) { log(`  – ${name}: if: ${String(s.if)} is false here`); continue; }
    log(`  ▸ ${name}`);
    const outFile = join(scratch, `output-${i}`);
    writeFileSync(outFile, "");
    const stepEnv: Record<string, string> = {};
    for (const [key, v] of Object.entries(s.env ?? {})) stepEnv[key] = interpolate(String(v), ctx);
    const env = {
      ...process.env, ...ctx.env, ...stepEnv, PATH: path,
      CI: "true", GITHUB_ACTIONS: "", GITHUB_ENV: envFile, GITHUB_OUTPUT: outFile,
      GITHUB_REPOSITORY: ctx.github.repository!, GITHUB_REF: ctx.github.ref!, GITHUB_REF_NAME: ctx.github.ref_name!,
      GITHUB_SHA: ctx.github.sha!, GITHUB_WORKSPACE: repo, GITHUB_SERVER_URL: ctx.github.server_url!, GITHUB_EVENT_NAME: ctx.github.event_name!,
    };
    let status: number | null = 0;
    if (k.action === "venv") {
      const venv = join(scratch, "venv");
      if (!existsSync(venv)) status = spawnSync("python3", ["-m", "venv", venv], { stdio: "inherit" }).status;
      path = `${join(venv, "bin")}:${path}`;
    } else if (k.action === "docker") {
      const w = s.with ?? {};
      const image = s.uses!.slice("docker://".length);
      const args = ["run", "--rm", "-v", `${repo}:/github/workspace`, "-w", "/github/workspace"];
      if (w.entrypoint) args.push("--entrypoint", interpolate(String(w.entrypoint), ctx));
      args.push(image, ...splitArgs(interpolate(String(w.args ?? ""), ctx)));
      status = spawnSync("docker", args, { cwd: repo, stdio: "inherit", env }).status;
    } else {
      const script = join(scratch, `step-${i}.sh`);
      writeFileSync(script, interpolate(s.run ?? "", ctx));
      status = spawnSync("bash", ["--noprofile", "--norc", "-e", script], { cwd: repo, stdio: "inherit", env }).status;
    }
    if (s.id) ctx.steps[s.id] = { outputs: readEnvFile(readFileSync(outFile, "utf-8")), outcome: status === 0 ? "success" : "failure" };
    Object.assign(ctx.env, readEnvFile(readFileSync(envFile, "utf-8")));
    if (status !== 0 && String(s["continue-on-error"] ?? "false") !== "true") throw new Error(`workflow step '${name}' exited ${status}`);
  }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return ctx;
}

// ── An IG repository's folio site ──────────────────────────────────────────

/**
 * The checkout scripts an IG repository's folio site is built with. This
 * layer names the SLOTS; the layers above fill them by declaring scripts of
 * these names (`checkoutScripts`), and the script table finds them. Nothing
 * here names those layers.
 *
 * Required, all three or the route cannot run: `ast` (a pre step: restore the
 * IG's AST from its cache branch and judge it; ig-build-pipeline rule 1),
 * `source` (before Jekyll: the artefact index and thin pages from the AST,
 * the IG composed at the site root) and `site` (after it: the AST's data
 * served, the Publisher-chrome guard, the build stamp).
 */
export const IG_SITE_STEPS = { ast: "ig-site:ast", source: "ig-site:compose", site: "ig-site:publisher-pages" } as const;

/**
 * Optional slots (owner, 2026-10-14: the DAK API pages and the OpenAPI pages
 * are provided by the layers that own them, the DAK layer and the harness,
 * not by this one), each run on a condition read off the checkout, never off
 * a declaration in the IG repository:
 *
 * - `sidecars`, a pre step after `ast`: run when the LANDING layer provides it,
 *   since the site wears that layer's chrome and its API surface; a provider
 *   elsewhere is not run, and the plan says so;
 * - `index`, a pre step after `sidecars`: run when a mounted layer provides
 *   it. The mounted layers' artefact indexes (`fhir-artifact-index/`) are no
 *   longer committed but built at publish (fhir-harness#124), and their
 *   `ig-pages` visualisers read them: without this step the coverage gate
 *   refuses the site (smart-base-clinical, 2026-10-30; smart-ra#101 for a
 *   declared recipe);
 * - `drawings`, a pre step after `index`: run when a mounted layer provides
 *   it. The site's drawing of every diagram (`docs/assets/img/workflows/`) is
 *   no longer committed but built at publish (cat-harness#1047, its
 *   `builtAtPublish`), and the process pages the visualiser writers add
 *   embed it: without this step a publish had 116 unresolved process-page
 *   images and the link check refused it unless `render:bpmn` was run by
 *   hand (smart-trust-demo#35, 2026-11-06). A folio's site runs the same
 *   writer before its process pages (folio-assistant `docs-site.yml`);
 * - `openapi`, a site step before `site`: run when the checkout holds an
 *   OpenAPI graph (`openapi/cat-openapi.config.json`).
 */
export const IG_SITE_OPTIONAL = { sidecars: "ig-site:sidecars", index: "ig-index:build", drawings: "render:bpmn", openapi: "ig-site:openapi", bar: "ig-site:bar", pageScan: "ig-site:page-render-qa" } as const;

/**
 * What an IG repository's root used to serve and no longer does, by the
 * owner's ruling: not a parity shortfall (`site-parity.ts` `DroppedByRuling`).
 * Top-level directories, and one page feature. Nothing else is excused: the
 * search box, the language picker, the rail and the icon row stay required.
 */
export const IG_DROPPED: readonly DroppedByRuling[] = [
  {
    dir: "comparison-v*",
    ruling: "owner, 2026-10-14, \"2a\": the IG Publisher's version comparisons (comparison-v*/) are not rendered and not published",
  },
  {
    dir: "schemas",
    ruling: "owner, 2026-10-15, \"New address only\": the IG API sidecars are served at fhir-artifact-index/sidecars/ and no copy is made at schemas/",
  },
  {
    dir: "ast-data",
    ruling: "owner, 2026-11-08, site size: the IG's AST (ast-data/) is not published on the site; resources are served once as <Type>-<id>.json and the AST ships as ast-data.zip on a release (fhir-harness#314, Q-REL-1 \"A\")",
  },
  {
    feature: "siteNav",
    ruling: "owner, 2026-10-15, layout \"C\" (chosen from wireframes): the folio rail stands in for the theme's side menu, so #site-nav is not carried; the IG's top bar carries the search box",
  },
];

/** What a dropped entry names, as the plan says it. */
export const droppedWords = (d: DroppedByRuling): string => (d.feature !== undefined ? `the page feature ${d.feature}` : `${d.dir}/`);

/**
 * Root entries an IG repository's publish keeps besides the folio's own:
 * `branches/`, where its IG workflow's per-branch previews are, and `ns/`,
 * the layer's JSON-LD context, which `publish-context.yml` publishes on
 * its own schedule. Deleting either is a separate question for the owner,
 * never a side effect of a publish. Owner, 2026-10-15, ruling on a base IG
 * repository's publish: "Keep both" — `ns/` and the versioned copies
 * ({@link versionedRoots}).
 */
export const IG_KEEP = ["branches", "ns"] as const;

/** A root entry named as a published IG version, `<major>.<minor>.<patch>[-label]`. */
const VERSION_DIR = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The published root's version directories (`0.1.0/`): an IG's release
 * copies, which a root publish keeps like `branches/` (owner, 2026-10-15,
 * on a base IG repository: "Keep both"). Pure; `entries` are the root's names.
 */
export function versionedRoots(entries: readonly string[]): string[] {
  return entries.filter((e) => VERSION_DIR.test(e));
}

/**
 * The root entries the landing layer's `site.build.keep` declares in this
 * checkout's `index.config.json` entry, read by build-instance-site's own
 * reader ({@link recipeRead}), so the IG route keeps what a declared recipe
 * would. An IG repository's Pages root can hold entries no build writes, laid
 * there by its other workflows; the repository names them, this layer does
 * not. Empty when the entry declares none.
 */
export function declaredKeep(repo: string, instance: string): string[] {
  return recipeRead(repo, instance).recipe?.keep ?? [];
}

/**
 * The landing entry's `site.build.coverage`, read the same way: an IG repository
 * whose root already lacks a declared visualiser page says so with "report",
 * as a folio does, rather than the IG route ignoring the recipe (2026-10-15:
 * the WHO SMART Trust and Immunizations IGs could not publish).
 */
export function declaredCoverage(repo: string, instance: string): "refuse" | "report" | undefined {
  return recipeRead(repo, instance).recipe?.coverage;
}

/**
 * The root file an IG repository's folio site must carry before it is
 * published: `folio-build.json`, which `ig-site:publisher-pages` writes, and
 * by which {@link FOLIO_ROOT_MARKERS} recognises the root as a folio's, so a
 * later `--bare-ig` deploy refuses to clean it away.
 */
export const IG_SITE_STAMP = "folio-build.json" as const;

/** The site's title and description, from the IG's `sushi-config.yaml`; the repository's name when it says none. */
export function igIdentity(sushiText: string | undefined, repoName: string): { title: string; description?: string } {
  let y: { title?: unknown; name?: unknown; description?: unknown } = {};
  try {
    y = (sushiText ? parseYaml(sushiText) : {}) ?? {};
  } catch {
    y = {};
  }
  const s = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
  const title = s(y.title) ?? s(y.name) ?? repoName;
  const description = s(y.description);
  return { title, ...(description ? { description } : {}) };
}

export interface IgFolioSite {
  /** The mounted layer whose chrome the site wears: `index.config.json` `site.landing`. */
  scope: string;
  title: string;
  description?: string;
  pre: string[];
  sourceSteps: string[];
  siteSteps: string[];
  /** Run after the platform's own writers (cat-harness-tools `finalSteps`): the IG's bar on the pages they write. */
  finalSteps: string[];
  keep: string[];
  /** The landing entry's `site.build.coverage` ({@link declaredCoverage}); absent means refuse. */
  coverage?: "refuse" | "report";
  /** Directories the root drops by ruling (`IG_DROPPED`). */
  dropped: DroppedByRuling[];
  /** What the plan says about each optional step, run or not. */
  notes: string[];
}

/**
 * Whether an IG repository publishes as a folio site, and how. Pure over what
 * the checkout holds. Owner, 2026-10-14: an IG repository needs no harness of
 * its own, only `index.config.json` mounting its base harness, and publishes
 * as the folio's just-the-docs site built from its cached AST, not as bare IG
 * Publisher output. So:
 *
 * - no `index.config.json`: not harnessed — the bare IG route (`why`);
 * - no mounted layer provides any of {@link IG_SITE_STEPS}: the bare route
 *   (`why`), since nothing can build the site;
 * - some but not all of them: REFUSED, naming the missing ones — the mounts
 *   are pinned at commits that do not agree on the route;
 * - otherwise the folio route, scoped to the landing layer the index
 *   names, with the optional steps {@link IG_SITE_OPTIONAL} their conditions
 *   admit; an index that names no landing is REFUSED, because the chrome
 *   cannot be scoped by guessing among the layers the repository mounts.
 *
 * `scripts` maps each checkout script to the manifest declaring it;
 * `landingPath` is the landing layer's mount path (`index.lock.json`);
 * `keep` is what the checkout declares kept at the root, besides {@link IG_KEEP}.
 */
export function igFolioSite(o: {
  hasIndexConfig: boolean;
  scripts: ReadonlyMap<string, { manifest: string }>;
  landing: { kind: string; name?: string; reason?: string };
  landingPath?: string;
  hasOpenapi?: boolean;
  identity: { title: string; description?: string };
  /** Root entries the checkout declares kept ({@link declaredKeep}), merged with {@link IG_KEEP}. */
  keep?: readonly string[];
  /** The checkout's declared coverage policy ({@link declaredCoverage}). */
  coverage?: "refuse" | "report";
}): { site?: IgFolioSite; why?: string } {
  if (!o.hasIndexConfig) return { why: "no index.config.json: this IG mounts no harness, so its site is the IG Publisher's output" };
  const required = Object.values(IG_SITE_STEPS);
  const lacking = required.filter((n) => !o.scripts.has(n));
  if (lacking.length === required.length) return { why: `no mounted layer provides ${required.join(", ")}: nothing here builds the IG's folio site, so its site is the IG Publisher's output` };
  if (lacking.length) throw new Error(`the mounted layers provide ${required.filter((n) => o.scripts.has(n)).join(", ")} but not ${lacking.join(", ")}: re-pin them together (the IG site route needs all of ${required.join(", ")})`);
  if (o.landing.kind !== "instance" || !o.landing.name) {
    throw new Error(`index.config.json names no landing instance (${o.landing.kind}${o.landing.reason ? `: ${o.landing.reason}` : ""}): add "site": { "landing": "<the harness this IG is built on>" } so the site's chrome is scoped to it`);
  }
  const notes: string[] = [];
  const pre: string[] = [IG_SITE_STEPS.ast];
  const side = o.scripts.get(IG_SITE_OPTIONAL.sidecars);
  if (!side) notes.push(`${IG_SITE_OPTIONAL.sidecars}: no mounted layer provides it — no IG API sidecars`);
  else if (o.landingPath !== undefined && side.manifest.startsWith(`${o.landingPath}/`)) {
    pre.push(IG_SITE_OPTIONAL.sidecars);
    notes.push(`${IG_SITE_OPTIONAL.sidecars}: run, provided by the landing layer ${o.landing.name} (${side.manifest})`);
  } else notes.push(`${IG_SITE_OPTIONAL.sidecars}: NOT run — provided by ${side.manifest}, not by the landing layer ${o.landing.name}`);
  if (o.scripts.has(IG_SITE_OPTIONAL.index)) {
    pre.push(IG_SITE_OPTIONAL.index);
    notes.push(`${IG_SITE_OPTIONAL.index}: run, the mounted layers' artefact indexes are built at publish`);
  } else notes.push(`${IG_SITE_OPTIONAL.index}: no mounted layer provides it — no artefact index is built`);
  if (o.scripts.has(IG_SITE_OPTIONAL.drawings)) {
    pre.push(IG_SITE_OPTIONAL.drawings);
    notes.push(`${IG_SITE_OPTIONAL.drawings}: run, the site's process drawings are built at publish, before the process pages that embed them`);
  } else notes.push(`${IG_SITE_OPTIONAL.drawings}: no mounted layer provides it — no process drawings are built`);
  const siteSteps: string[] = [];
  if (!o.hasOpenapi) notes.push(`${IG_SITE_OPTIONAL.openapi}: the checkout holds no openapi/cat-openapi.config.json — no OpenAPI pages`);
  else if (!o.scripts.has(IG_SITE_OPTIONAL.openapi)) notes.push(`${IG_SITE_OPTIONAL.openapi}: the checkout holds an OpenAPI graph, and no mounted layer provides the step — its pages are NOT built`);
  else {
    siteSteps.push(IG_SITE_OPTIONAL.openapi);
    notes.push(`${IG_SITE_OPTIONAL.openapi}: run, the checkout holds an OpenAPI graph`);
  }
  siteSteps.push(IG_SITE_STEPS.site);
  const finalSteps: string[] = [];
  if (o.scripts.has(IG_SITE_OPTIONAL.bar)) finalSteps.push(IG_SITE_OPTIONAL.bar);
  else notes.push(`${IG_SITE_OPTIONAL.bar}: no mounted layer provides it — the identifier lookup and mounted docs pages keep no IG bar`);
  // Last, on the finished pages: the QA report's page scan (owner, 2026-11-11, Q-MD-2).
  if (o.scripts.has(IG_SITE_OPTIONAL.pageScan)) {
    finalSteps.push(IG_SITE_OPTIONAL.pageScan);
    notes.push(`${IG_SITE_OPTIONAL.pageScan}: run, every page opened in a headless browser for markup shown as text (reported in the QA report, never gating)`);
  } else notes.push(`${IG_SITE_OPTIONAL.pageScan}: no mounted layer provides it — the QA report's page scan says it has no results`);
  return {
    site: {
      scope: o.landing.name,
      ...o.identity,
      pre,
      sourceSteps: [IG_SITE_STEPS.source],
      siteSteps,
      finalSteps,
      keep: [...new Set([...IG_KEEP, ...(o.keep ?? [])])],
      ...(o.coverage ? { coverage: o.coverage } : {}),
      dropped: [...IG_DROPPED],
      notes,
    },
  };
}

// ── Staging an IG repository (moved from stage-local.ts) ─────────────────────

/** An IG's output, laid out as its workflow's deploy step lays it; `chromed` when the chrome step chromed it. */
export function composeIg(pages: string, folder: string, t: IgTarget, chromed = false): Composed {
  applyIgDeploy(pages, folder, t, (from, to) => cpSync(from, to, { recursive: true }), { chromed });
  return { commit: t.commit, add: [t.dest || "."] };
}

/**
 * The harness chrome for an IG's own pages, and where its scripts are.
 *
 * Owner, 2026-10-14, decision "1": an IG site published by this path gets the
 * chrome `folio-site.yml` gave it. Measured that morning: every live root page
 * of an IG repository's site wore the icon row and the side navigation because a
 * `folio-site.yml` run of 2026-10-12 laid it there, and a preview built by this
 * path wrote 3654 bare IG Publisher pages, none with either. Published on
 * `main`, that preview would have replaced the chromed root.
 *
 * The chrome is NOT rebuilt here. It is the two steps a folio's site already
 * runs over pages Jekyll did not lay out (`build-instance-site.ts`, and
 * `folio-site.yml`'s own last step): `sync-docs-harness.ts`, which writes the
 * harness data the icon row is drawn from, then `rail-standalone-pages.ts
 * --foreign-site --instance <the IG>`, which rails every page, scopes the row
 * to the IG (#2263) and loads the platform's UI. The harness data is written
 * into the cat-harness MOUNT, so the pinned bytes are put back afterwards
 * (`keepPinned`), as `build-instance-site` does.
 *
 * A sync that fails is said and not fatal: the harness commits its own
 * `_data/harness.json`, and the rail's foreign-site scope exists to rebase
 * exactly that platform data onto another layer's site (#2263). Measured
 * 2026-10-14 on an IG repository: the sync refuses there ("cannot decide the
 * site's landing page", its `index.config.json` names no `landing`), and the
 * rail over the pinned data still chromed every page. Whether the chrome
 * landed is judged on the pages afterwards ({@link chromeShortfall}), never
 * on the exit codes.
 *
 * What it does NOT give, and the plan says so: `folio-site.yml` composes the IG
 * INTO a Jekyll shell (`stage-ig-sites --compose-at-root`), so its pages wear
 * the theme's side bar and search box; railed pages wear the harness rail and
 * the icon row. The rail's and the row's code (`navbar.js`, `docs-ui.js` and
 * their stylesheets) is copied into the site from the pinned cat-harness mount
 * and loaded from there, never live from the platform's site (owner,
 * 2026-10-15, "pinned copy per site"); only the rail's LINKS point at the
 * platform's pages.
 */
export interface IgChrome {
  sync: string;
  rail: string;
  /** The layer the checkout declares at its root: the IG whose site this is. Absent, the rail is the platform's. */
  instance?: string;
  homeLabel: string;
}

/** The chrome this checkout can apply, or why it cannot: the platform's scripts are read from its mounts, never named elsewhere. */
export function igChromeFor(repo: string, fallbackLabel: string, h: Pick<PublisherHost, "platformScript">): IgChrome | { unavailable: string } {
  let sync: string;
  let rail: string;
  try {
    sync = h.platformScript(repo, "sync-docs-harness.ts");
    rail = h.platformScript(repo, "rail-standalone-pages.ts");
  } catch (e) {
    return { unavailable: `the platform's chrome scripts are not mounted in this checkout (${(e as Error).message})` };
  }
  const declFile = findDeclarationFile(repo);
  const decl = declFile === undefined ? undefined : siteFields(readFileSync(join(repo, declFile), "utf-8"), join(repo, declFile));
  return { sync, rail, ...(decl ? { instance: decl.name } : {}), homeLabel: decl?.title ?? decl?.name ?? fallbackLabel };
}

/** What the plan says the chrome step does. */
export function igChromeStep(c: IgChrome | { unavailable: string }, folder: string): { name: string; action: string; reason: string } {
  const name = `the harness chrome over ${folder}/: sync-docs-harness.ts, then rail-standalone-pages.ts --foreign-site`;
  if ("unavailable" in c) return { name, action: "chrome", reason: `UNAVAILABLE — ${c.unavailable}` };
  return {
    name: `${name} --instance ${c.instance ?? "(none declared)"} --home-label "${c.homeLabel}"`,
    action: "chrome",
    reason: "not in the workflow: folio-site.yml's chrome, as rail and icon row (no theme side bar or search box); a root publish is refused without it",
  };
}

/**
 * Apply the chrome to the built IG in `site`, in place, and count it. Throws,
 * naming what is missing, when the root page or no page wears it: the caller
 * refuses a root publish on that, rather than replace a chromed root with bare
 * pages.
 */
export function applyIgChrome(repo: string, site: string, c: IgChrome, log: (s: string) => void, h: Pick<PublisherHost, "run">): ChromeCoverage {
  let restore = () => {};
  try {
    const harness = join(repo, "cat-harness");
    if (existsSync(harness)) restore = keepPinned(join(harness, siteFileFor(harness, "_data/harness.json")), lockedMountPaths(repo), repo);
    const sync = spawnSync("bun", ["run", c.sync], { cwd: repo, stdio: "inherit" });
    if (sync.status !== 0) log(`· sync-docs-harness exited ${sync.status}: the rail reads the harness data the cat-harness mount pins`);
    h.run(repo, "bun", ["run", c.rail, "--site", site, "--built", "cat-harness", "--foreign-site", "--home-label", c.homeLabel, ...(c.instance ? ["--instance", c.instance] : [])]);
  } finally {
    restore();
  }
  const cov = chromeCoverage(site);
  const short = chromeShortfall(cov);
  if (short) throw new Error(`the harness chrome was not applied: ${short}`);
  log(`· chrome: ${cov.navbarRow} of ${cov.pages} page(s) wear the icon row, ${cov.railed} carry the rail`);
  return cov;
}

export async function stageIg(a: PublisherRun, h: PublisherHost): Promise<StageResult> {
  const { o, log, repo, detected, branch, sha, ownerRepo, pagesRoot, runUrl, target } = a;
  const u = detected.uses;
  let path = u.path;
  let note: string | undefined;
  let wf = readWorkflow(fetchWorkflow(u, path, o.workflowSource));
  let deploys = readIgDeploys(wf);
  if (!deploys.main && !deploys.candidate) {
    path = u.path.replace(/[^/]+$/, PAGES_SIBLING);
    note = `${u.file} deploys nothing to Pages (it triggers build.fhir.org's auto-build); the Pages build its callers describe is ${PAGES_SIBLING} beside it, read at @${u.ref}`;
    wf = readWorkflow(fetchWorkflow(u, path, o.workflowSource));
    deploys = readIgDeploys(wf);
  }
  const isDefault = target === "main";
  const t0 = igTarget(deploys, { isDefault, branchDir: branchDirOf(branch), sha, runUrl });
  const callerWith = callerInputs(readFileSync(join(repo, a.caller), "utf-8"), u);
  const github = { repository: ownerRepo, ref: `refs/heads/${branch}`, ref_name: branch, head_ref: "", sha, event_name: "workflow_dispatch", workspace: repo, server_url: "https://github.com", run_id: "", actor: "stage-local" };
  const planCtx: ExprContext = { github, inputs: { ...wf.inputs, ...callerWith }, env: { IS_DEFAULT_BRANCH: String(isDefault), BRANCH_DIR: branchDirOf(branch), BRANCH_NAME: branch }, steps: {} };
  const steps = planIgSteps(wf, planCtx);
  const missing = missingPrerequisites(steps, commandWorks);
  const folio = o.bareIg ? undefined : folioSiteFor(repo, ownerRepo);
  if (folio?.site) return stageIgFolio(a, { wf, path, note, steps, missing, github, inputs: planCtx.inputs, isDefault }, folio.site, h);
  if (folio?.why) log(`· ${folio.why}`);
  const chrome = igChromeFor(repo, ownerRepo.split("/")[1]!, h);
  // A root publish without the chrome would replace a chromed root with bare pages: a missing prerequisite there.
  if (isDefault && "unavailable" in chrome) missing.push(`the harness chrome — ${chrome.unavailable}; a root publish is refused without it`);
  const planned: { name: string; action: string; reason?: string }[] = steps.map((s) => ({ name: s.name, action: s.action, ...(s.reason ? { reason: s.reason } : {}) }));
  const firstDeploy = planned.findIndex((s) => s.action === "deploy");
  planned.splice(firstDeploy < 0 ? planned.length : firstDeploy, 0, igChromeStep(chrome, t0.deploy.folder));
  const url = `${pagesRoot}/${t0.dest ? `${t0.dest}/` : ""}`;
  const plan: StagePlan = {
    kind: "ig", caller: a.caller, workflow: `${u.owner}/${u.repo}/${path}@${u.ref}`, ...(note ? { note } : {}),
    target, branch, ...(a.defaultBranch ? { defaultBranch: a.defaultBranch } : {}), sha,
    publishBranch: t0.deploy.branch, dest: t0.dest ? `${t0.dest}/` : "/", url,
    replaces: t0.keep ? "every root entry the deploy step's clean does not exclude" : t0.deploy.clean ? `${t0.dest}/, wholesale` : `files in ${t0.dest}/ that the build writes (clean: false — nothing deleted)`,
    preserved: t0.keep ?? [`everything outside ${t0.dest}/`],
    build: [`the runnable steps of ${path} below, in its order, in the checkout as on a runner (it writes input/scripts/, ${t0.deploy.folder}/, temp/ there)`],
    gate: "none, as the workflow: its deploy step pushes without one; 3 push attempts",
    commit: t0.commit,
    steps: planned,
    notRun: [
      ...(t0.deploy.singleCommit ? ["single-commit: the deploy action force-pushes one orphan commit, erasing the branch's history; this path commits on top and never force-pushes"] : []),
      ...(u.file !== PAGES_SIBLING ? [`${u.file}'s own job (the build.fhir.org trigger): an external build, not this repository's Pages`] : []),
    ],
    ...(missing.length ? { missing } : {}),
  };
  log(h.formatPlan(plan));
  const site = join(repo, t0.deploy.folder);
  const done = (r: Partial<StageResult>): StageResult => ({ kind: "ig", target, slug: branchDirOf(branch), url, pushed: false, site, plan, ...r });
  if (o.plan) return done({});
  if (missing.length) {
    if (o.dryRun) {
      log(`✓ --dry-run: plan only — this machine lacks ${missing.length} prerequisite(s) to build, listed above; nothing built, nothing pushed`);
      return done({});
    }
    throw new Error(`cannot build this IG here: missing ${missing.join("; ")}`);
  }

  log(`· building ${ownerRepo}@${branch} (${sha.slice(0, 7)}) with ${path}`);
  rmSync(site, { recursive: true, force: true });
  const ctx = runIgBuild(repo, wf, { github, inputs: planCtx.inputs, env: {}, steps: {} }, log);
  const ranDefault = ctx.env.IS_DEFAULT_BRANCH;
  if (ranDefault !== undefined && ranDefault !== String(isDefault)) throw new Error(`the workflow's own step decided IS_DEFAULT_BRANCH=${ranDefault}, and this run planned ${isDefault}; refusing to publish to the wrong place`);
  const t = igTarget(deploys, { isDefault, branchDir: ctx.env.BRANCH_DIR || branchDirOf(branch), sha, runUrl });
  if (!existsSync(site) || h.listSite(site).size === 0) throw new Error(`the build produced nothing in ${site} — refusing to deploy`);

  // The chrome, before anything is published: on the root it is required.
  let chromed = false;
  if ("unavailable" in chrome) log(`· no harness chrome: ${chrome.unavailable}; this preview is published bare, as the workflow publishes it`);
  else {
    try {
      applyIgChrome(repo, site, chrome, log, h);
      chromed = true;
    } catch (e) {
      if (isDefault) throw new Error(`${(e as Error).message} — refusing to publish the root: it would replace a chromed site with bare IG Publisher pages`);
      log(`· ${(e as Error).message}; this preview is published bare, as the workflow publishes it`);
    }
  }

  if (o.artifact) return done({ bundle: h.writeArtifact(site, o.artifact, undefined, { slug: branchDirOf(branch), branch, sha }, log) });
  const r = await h.pushLoop({ repo, publishBranch: t.deploy.branch, ...(o.dryRun ? { dryRun: true } : {}), gate: false, attempts: 3, compose: (pages) => composeIg(pages, site, t, chromed), url, log });
  return done(r);
}

/** The IG folio-site route for this checkout, read off what it holds ({@link igFolioSite}). */
function folioSiteFor(repo: string, ownerRepo: string): ReturnType<typeof igFolioSite> {
  const sushi = join(repo, "sushi-config.yaml");
  const landing = resolveLandingInstance(repo);
  const landingPath = landing.kind === "instance" && landing.name ? lockedMountPath(repo, landing.name) : undefined;
  const keep = landing.kind === "instance" && landing.name ? declaredKeep(repo, landing.name) : [];
  const coverage = landing.kind === "instance" && landing.name ? declaredCoverage(repo, landing.name) : undefined;
  return igFolioSite({
    hasIndexConfig: existsSync(join(repo, "index.config.json")),
    scripts: scriptTable(repo),
    landing,
    ...(landingPath !== undefined ? { landingPath } : {}),
    ...(keep.length ? { keep } : {}),
    ...(coverage ? { coverage } : {}),
    hasOpenapi: igOpenapiGraph(repo) !== undefined,
    identity: igIdentity(existsSync(sushi) ? readFileSync(sushi, "utf-8") : undefined, ownerRepo.split("/")[1]!),
  });
}

/**
 * Where the checkout holds a layer: its mount path in `index.lock.json`,
 * or, for a LOCAL layer (`index.config.json` `source.local.at`), the
 * directory the checkout keeps it in. A local layer is not mounted, so the
 * lock does not list it. Undefined when neither names it.
 *
 * The local case is a base harness's own repository: it declares its own
 * layer as `source.local.at: "<instance>"` and lands its site on it, so
 * without this its own IG API sidecars (`ig-site:sidecars`, from
 * `<instance>/package.json`) read as "not provided by the landing layer" and
 * were not run, where an IG repository that mounts the base harness runs them
 * (owner, 2026-10-15: the base republishes "via the same IG route" as an IG
 * that mounts it).
 */
export function lockedMountPath(repo: string, instance: string): string | undefined {
  const f = join(repo, "index.lock.json");
  if (existsSync(f)) {
    const l = JSON.parse(readFileSync(f, "utf-8")) as { instances?: { instance?: unknown; path?: unknown }[] };
    const e = (l.instances ?? []).find((i) => i.instance === instance && typeof i.path === "string");
    if (e) return e.path as string;
  }
  const c = join(repo, "index.config.json");
  if (!existsSync(c)) return undefined;
  const idx = JSON.parse(readFileSync(c, "utf-8")) as { instances?: { name?: unknown; source?: { local?: { at?: unknown } } }[] };
  const at = (idx.instances ?? []).find((i) => i.name === instance)?.source?.local?.at;
  return typeof at === "string" && at !== "" ? at.replace(/^\.\//, "").replace(/\/+$/, "") : undefined;
}

interface IgBuilt {
  wf: ReturnType<typeof readWorkflow>;
  path: string;
  note: string | undefined;
  steps: ReturnType<typeof planIgSteps>;
  missing: string[];
  github: Record<string, string>;
  inputs: Record<string, unknown>;
  isDefault: boolean;
}

/**
 * An IG repository's folio site, built from its cached AST by
 * `build-instance-site.ts` with the steps the mounted layers provide
 * ({@link igFolioSite}): the AST restored and judged, the landing layer's IG
 * API sidecars, the chrome of the landing layer, the IG and its thin
 * artefact pages composed at the root, Jekyll, the OpenAPI pages, the AST's
 * data served, the link check. No IG Publisher runs (owner, 2026-10-14: "Yes,
 * fix in platform"; ig-build-pipeline rule 1), so no Docker is needed. The root keeps `branches/`,
 * `_render-log/`, the IG workflow's `branches/` and every entry the landing
 * layer's `site.build.keep` declares; a preview goes to
 * `branches/<branch>/`, as every folio's does. The workflow's own deploy steps
 * are not mirrored: the folio site replaces them.
 */
async function stageIgFolio(a: PublisherRun, b: IgBuilt, site: IgFolioSite, h: PublisherHost): Promise<StageResult> {
  const { o, log, repo, branch, sha, ownerRepo, pagesRoot, target } = a;
  const u = a.detected.uses;
  const name = ownerRepo.split("/")[1]!;
  // The folio's preview SHARES the IG Publisher's branch directory, `branches/<last path
  // component>/` (owner, 2026-11-05): whichever deploy is later is what that folder shows.
  const staging = target === "preview" ? stagingDir(branchDirOf(branch)) : undefined;
  const url = `${pagesRoot}/${staging ? `${staging}/` : ""}`;
  const out = join(repo, "..", `${name}-site`);
  const message = `Publish ${name} ${sha.slice(0, 7)}${staging ? ` preview of ${branch}` : ""} (folio site, built locally)`;
  // A root publish keeps the published root's version directories too; a
  // root the remote cannot list (no gh-pages yet) has none to keep.
  let versions: string[] = [];
  if (!staging) {
    try {
      h.git(repo, ["fetch", "-q", "--depth", "1", "origin", "gh-pages"]);
      versions = versionedRoots(h.git(repo, ["ls-tree", "--name-only", "FETCH_HEAD"]).split("\n"));
    } catch {
      versions = [];
    }
  }
  const keep = [...site.keep, ...versions];
  const plan: StagePlan = {
    kind: "ig", caller: a.caller, workflow: `${u.owner}/${u.repo}/${b.path}@${u.ref}`, ...(b.note ? { note: b.note } : {}),
    target, branch, ...(a.defaultBranch ? { defaultBranch: a.defaultBranch } : {}), sha,
    publishBranch: "gh-pages", dest: staging ? `${staging}/` : "/", url,
    replaces: staging ? `${staging}/, wholesale` : "the root, as a folio's root publish replaces it",
    preserved: staging ? [`everything outside ${staging}/`] : [...PREVIEW_PREFIXES, "_render-log", ...keep],
    build: [
      `the folio site "${site.title}" from the IG's cached AST, never a Publisher run (ig-build-pipeline rule 1): build-instance-site.ts with the chrome of ${site.scope} (index.config.json site.landing)`,
      `  pre    ${site.pre.join(", ")} — restore and judge the AST (a stale one is refused for the root and accepted for a preview; SITE_ACCEPT_STALE_AST=0 refuses it for a preview too)${site.pre.length > 1 ? ", then the landing layer's IG API sidecars" : ""}`,
      `  source ${site.sourceSteps.join(", ")} — the artefact index and thin pages from the AST, the IG's pages at the site root`,
      `  site   ${site.siteSteps.join(", ")} — ${site.siteSteps.length > 1 ? "the OpenAPI pages, then " : ""}the AST's data served, and ${IG_SITE_STAMP} at the root (required: a folio root marker)`,
      ...(site.finalSteps.length ? [`  final  ${site.finalSteps.join(", ")} — the IG's bar on the pages the platform writes after the site steps`] : []),
      ...site.notes.map((n) => `  note   ${n}`),
      ...(staging ? [] : site.dropped.map((d) => `  parity ${droppedWords(d)} is not a shortfall: ${d.ruling}`)),
      `  out    ${out}`,
    ],
    gate: "build-instance-site's link check: every link the chrome writes must resolve; the IG's own dead links are reported, not gated",
    commit: [message],
    steps: [...site.pre.map((n) => ({ name: n, action: "pre" })), ...site.sourceSteps.map((n) => ({ name: n, action: "source" })), ...site.siteSteps.map((n) => ({ name: n, action: "site" })), ...site.finalSteps.map((n) => ({ name: n, action: "final" }))],
    notRun: [
      `the IG Publisher and every step of ${b.path}: the site is built from the AST on the IG's cache branch, which ig-ast-refresh.yml refreshes (pass --bare-ig for the Publisher's output as it is)`,
      ...(u.file !== PAGES_SIBLING ? [`${u.file}'s own job (the build.fhir.org trigger): an external build, not this repository's Pages`] : []),
    ],
  };
  log(h.formatPlan(plan));
  const done = (r: Partial<StageResult>): StageResult => ({ kind: "ig", target, slug: staging ?? branch, url, pushed: false, site: join(out, "_site"), plan, ...r });
  if (o.plan) return done({});
  if (o.artifact) throw new Error("--artifact is not available for an IG's folio site: build-instance-site publishes to the Pages branch only");
  log(`· building ${ownerRepo}@${branch} (${sha.slice(0, 7)}) from its cached AST`);
  const publish = !o.dryRun;
  const render = staging ? await proseRenderer(repo) : undefined;
  // The branch's open PR, so the banner names it on a hand-started build too (bean zvl0).
  const pr = staging ? await openPrFor(ownerRepo, branch) : null;
  if (staging) log(pr ? `· open PR for ${branch}: #${pr.number}` : `· no open PR found for ${branch}`);
  const previewData = (built: string): void =>
    igPreviewData(built, { ig: repo, render: render!, branch, sha, base: a.defaultBranch ?? "main", ownerRepo, runUrl: a.runUrl, pr }, log);
  // The pages the site writes (owner, 2026-11-08, Q-SZ-2 "B"): the IG's and its
  // landing layer's; every other layer's pages are linked on that layer's site.
  const igDecl = findDeclarationFile(repo);
  const igName = igDecl === undefined ? undefined : siteFields(readFileSync(join(repo, igDecl), "utf-8"), join(repo, igDecl))?.name;
  const scope = igName === undefined ? undefined : siteScopeOf(repo, igName);
  log(`· scope: ${scope ? `${scope.join(", ")}; the other layers' pages are linked on their own sites` : "every instance the checkout mounts"}`);
  const r = await buildInstanceSite({
    root: repo,
    instance: site.scope,
    ...(scope ? { scope } : {}),
    identity: { title: site.title, ...(site.description ? { description: site.description } : {}) },
    linkRoot: "https://litlfred.github.io/folio-assistant",
    out,
    pre: site.pre,
    sourceSteps: site.sourceSteps,
    siteSteps: site.siteSteps,
    ...(site.finalSteps.length ? { finalSteps: site.finalSteps } : {}),
    ...(target === "preview" ? { staging: branch, ...(staging ? { stagingDir: staging } : {}) } : {}),
    mount: true,
    fresh: false,
    publish,
    ...(publish ? { remote: h.git(repo, ["config", "--get", "remote.origin.url"]) } : {}),
    keep,
    ...(site.coverage ? { coverage: site.coverage } : {}),
    parityDropped: site.dropped,
    require: [IG_SITE_STAMP],
    // A preview's review data (folio-assistant#215 walk, break 6): the
    // ChangeSet, the review page and the staging banner with staging.json,
    // as a folio's preview carries them.
    ...(staging ? { beforePublish: (built: string) => previewData(built) } : {}),
    message,
  });
  return done({ pushed: publish, site: r.site });
}
