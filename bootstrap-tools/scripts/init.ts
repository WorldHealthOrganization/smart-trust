#!/usr/bin/env bun
/**
 * Walk a layer's initialization steps AS ITS DECLARATIONS NAME THEM,
 * check each, perform the ones a tool can perform, and report every step in
 * one of four states — never a green tick over something nobody checked.
 *
 * @module bootstrap-tools/scripts/init
 * @covers code
 *
 * This is the tool half. The process half is bootstrap's
 * `processes/complete-initialization.bpmn`, with the skills
 * `initialization-steps` and `publish-site`: an agent following it may run
 * this command where tools are available, and does the same steps by reading
 * files where they are not.
 *
 * ## Where the steps come from
 *
 * Nothing here is a per-layer list. The steps are read off the
 * declaration at `--root` and the declarations it `needs`, each found as a
 * sibling checkout `../<name>/<name>.json`:
 *
 * | step | named by | a tool performs it? |
 * |---|---|---|
 * | `declaration` | the file itself: `<name>.json` parses | no |
 * | `needs:<name>` | `needs` — the dependency is beside it, and parses | no |
 * | `instructions:<name>` | `<name>/docs/bootstrap/initialization.md`, when the dependency has one | no: *stated* |
 * | `schemas:staged` | each JSON Schema `$id` and JSON-LD `@id` under `iriBase` — PRIMARY | checked: the site stages each at its IRI |
 * | `schemas:published` | the same IRIs — PRIMARY | no: the Pages workflow publishes them; this checks they answer |
 * | `directory:<id>` | `directories[]` — the path exists | no |
 * | `asset:<id>` | `assets[]` — the file exists | no |
 * | `readme` | the root has a `README.md` | no |
 * | `readme-sections` | the README's own markers — every opted-in section is current | yes |
 * | `site:workflow` | `repository` — a workflow commits the site onto gh-pages: the layer's own, or one in this toolset that checks it out | no |
 * | `site:branch` | `repository` — a gh-pages branch exists (it must, before Pages can be on) | no: says how |
 * | `site:enabled` | `repository` — Pages is on, serving gh-pages | yes, with `gh`, once the branch exists |
 * | `site:live` | `iriBase`, else the Pages address — the address answers, and so does its `README.html` | no |
 *
 * The two `schemas:` steps come first after the declarations are read, and
 * lead the printed summary: the site is the vehicle, the documents at their
 * addresses the goal. A 404 is `not-done`; a 403, 407, 5xx or no answer is
 * `could-not-determine` ({@link httpAnswer}).
 *
 * A directory is NOT created for you: an empty directory is not tracked by
 * git, so creating one would satisfy this check on one machine and nowhere
 * else. It is reported with what to put in it.
 *
 * ## Four states, and why four
 *
 * - `done` — checked, and it holds (possibly because this run just did it);
 * - `not-done` — checked, and it does not; `action` says what to do;
 * - `could-not-determine` — the check could not run (no `gh`, no network).
 *   Never reported as done: a check that could not look is not a pass;
 * - `stated` — the declarations name it but nothing can observe it (reading
 *   and following a harness's instructions), exactly as a `stated`
 *   precondition in bootstrap's diagrams is never reported as satisfied.
 *
 * Exit status: 0 when every checkable step is done; 1 when any is not done;
 * 3 when none is not-done but some could not be determined; 2 when there is
 * no declaration to read.
 *
 * NEVER enables anything that costs money: Pages on a public repository and
 * the Actions minutes it uses are free, and nothing else is touched.
 *
 * Usage: bun run bootstrap-tools/scripts/init.ts [--root ../bootstrap] [--dry-run] [--offline] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { readKnowledgeGraphDeclaration, type KnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { syncReadme } from "./readme-sections.ts";
import { ownerRepo, publishedDocuments, stageSite, type SiteReport } from "./site.ts";

export type StepState = "done" | "not-done" | "could-not-determine" | "stated";

export interface InitStep {
  id: string;
  /** The declaration (by name) that names this step. */
  namedBy: string;
  what: string;
  state: StepState;
  detail: string;
  /** For `not-done` and `could-not-determine`: exactly what an agent or a person does next. */
  action?: string;
  /** True when this run performed it. */
  performed?: boolean;
}

/** What the steps need from outside the files: a forge CLI and the network. Injected so a test can stand in for both. */
export interface Probe {
  /** Run `gh` with `args`; `undefined` when there is no `gh` to run. */
  gh(args: string[]): { status: number; stdout: string; stderr: string } | undefined;
  /** The HTTP status `url` answers with; `undefined` when it could not be reached. */
  httpStatus(url: string): Promise<number | undefined>;
  /** Run `git` in `cwd`; `undefined` when there is no `git` to run. Absent means could-not-determine. */
  git?(args: string[], cwd: string): { status: number; stdout: string; stderr: string } | undefined;
}

export const realProbe: Probe = {
  gh(args) {
    const r = spawnSync("gh", args, { encoding: "utf-8" });
    if (r.error) return undefined;
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  },
  git(args, cwd) {
    const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
    if (r.error) return undefined;
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  },
  async httpStatus(url) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
      return res.status;
    } catch {
      return undefined;
    }
  },
};

/** Probe that reaches nothing: every outside check becomes `could-not-determine`. */
export const offlineProbe: Probe = { gh: () => undefined, httpStatus: async () => undefined };

/** `owner/repo` from a declaration's `repository` — defined in `site.ts`, which composes a page's source links from it. */
export { ownerRepo };

const pagesSettings = (o: { owner: string; repo: string }) => `https://github.com/${o.owner}/${o.repo}/settings/pages`;

/** The person's one step, written so it can be followed without opening anything else. */
export function enablePagesByHand(o: { owner: string; repo: string }): string {
  return `open ${pagesSettings(o)} → "Build and deployment" → Source: "Deploy from a branch" → branch \`gh-pages\`, folder \`/ (root)\` (free for a public repository; the branch must exist first — site:branch). Then re-run the Pages workflow from the Actions tab, or push to main.`;
}

/** This toolset's own checkout, whose workflows may publish a layer from outside it. */
const TOOLSET_ROOT = join(import.meta.dir, "..");

/**
 * A workflow that deploys `root`'s site to Pages, or `undefined`: one under
 * the layer's own `.github/workflows/`, or — for a layer that carries
 * no workflow naming its toolset (bootstrap, owner 2026-10-01) — one under
 * the toolset's that checks out `owner/repo` and pushes its gh-pages.
 */
export function pagesWorkflow(root: string, o?: { owner: string; repo: string }, toolsetRoot: string = TOOLSET_ROOT): string | undefined {
  const inDir = (dir: string, match: (text: string) => boolean): string | undefined => {
    if (!existsSync(dir)) return undefined;
    for (const f of readdirSync(dir).sort()) {
      if (/\.ya?ml$/.test(f) && match(readFileSync(join(dir, f), "utf-8"))) return f;
    }
    return undefined;
  };
  const gh = (t: string) => /\bgh-pages\b/.test(t);
  const own = inDir(join(root, ".github", "workflows"), gh);
  if (own) return `.github/workflows/${own}`;
  if (!o || resolve(root) === resolve(toolsetRoot)) return undefined;
  const target = `${o.owner}/${o.repo}`;
  const names = (t: string) => new RegExp(`^\\s*(?:repository|REPO):\\s*${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(t);
  const outside = inDir(join(toolsetRoot, ".github", "workflows"), (t) => gh(t) && names(t));
  return outside ? `the toolset's .github/workflows/${outside}, publishing ${target}` : undefined;
}

/** The declarations `root` needs, each resolved as a sibling checkout; `undefined` where it is not there. */
function dependencies(root: string, decl: KnowledgeGraphDeclaration): { name: string; dir: string; decl?: KnowledgeGraphDeclaration; error?: string }[] {
  return (decl.needs ?? []).map((name) => {
    const dir = join(dirname(resolve(root)), name);
    try {
      const d = readKnowledgeGraphDeclaration(dir);
      return { name, dir, decl: d, error: d ? undefined : `no ${name}.json in ${dir}` };
    } catch (e) {
      return { name, dir, error: (e as Error).message };
    }
  });
}

async function siteSteps(root: string, decl: KnowledgeGraphDeclaration, probe: Probe, dryRun: boolean): Promise<InitStep[]> {
  const o = ownerRepo((decl as Record<string, unknown>)["repository"]);
  if (!o) return [];
  const named = decl.name;
  const steps: InitStep[] = [];

  const wf = pagesWorkflow(root, o);
  steps.push({
    id: "site:workflow",
    namedBy: named,
    what: "a workflow that builds the site and deploys it to GitHub Pages",
    state: wf ? "done" : "not-done",
    detail: wf ? wf : "no workflow under .github/workflows/ publishes to the gh-pages branch",
    action: wf ? undefined : "add .github/workflows/pages.yml — bootstrap-tools' own is the pattern: stage the site with scripts/site.ts and commit it onto gh-pages as a full replace",
  });

  // The branch must exist before Pages can serve it — owner, 2026-10-01:
  // "need to create gh-pages branch before can turn on".
  const branch: InitStep = { id: "site:branch", namedBy: named, what: `a gh-pages branch exists on ${o.owner}/${o.repo}, for Pages to serve`, state: "could-not-determine", detail: "" };
  const remote = `https://github.com/${o.owner}/${o.repo}`;
  const ls = probe.git?.(["ls-remote", "--heads", remote, "gh-pages"], root);
  if (!ls || ls.status !== 0) {
    branch.detail = ls ? `\`git ls-remote ${remote}\` failed: ${(ls.stderr || ls.stdout).trim().split("\n")[0] ?? "no output"}` : "no `git` here to ask the remote";
    branch.action = `create it: an orphan gh-pages holding a placeholder index.html and .nojekyll, pushed to ${remote}`;
  } else if (/refs\/heads\/gh-pages/.test(ls.stdout)) {
    branch.state = "done";
    branch.detail = "gh-pages exists";
  } else {
    branch.state = "not-done";
    branch.detail = "no gh-pages branch — Pages cannot be switched on to serve it until it exists";
    branch.action = `create it: \`git checkout --orphan gh-pages && git rm -rfq . && echo placeholder > index.html && touch .nojekyll && git add . && git commit -m "Create gh-pages" && git push origin gh-pages\` — init never creates a branch on a remote by itself`;
  }
  steps.push(branch);

  const enabled: InitStep = { id: "site:enabled", namedBy: named, what: `GitHub Pages is on for ${o.owner}/${o.repo}, serving the gh-pages branch`, state: "could-not-determine", detail: "" };
  const auth = probe.gh(["auth", "status"]);
  if (!auth) {
    enabled.detail = "no `gh` CLI here, so Pages could not be checked or enabled";
    enabled.action = enablePagesByHand(o);
  } else if (auth.status !== 0) {
    enabled.detail = "`gh` is installed but not signed in (`gh auth status` failed)";
    enabled.action = `run \`gh auth login\` and re-run this, or ${enablePagesByHand(o)}`;
  } else {
    const api = `repos/${o.owner}/${o.repo}/pages`;
    const read = () => probe.gh(["api", api])!;
    const r = read();
    const source = (s: string) => {
      try {
        return (JSON.parse(s) as { source?: { branch?: string } }).source?.branch;
      } catch {
        return undefined;
      }
    };
    const create = ["api", "-X", "POST", api, "-f", "source[branch]=gh-pages", "-f", "source[path]=/"];
    if (r.status === 0 && source(r.stdout) === "gh-pages") {
      enabled.state = "done";
      enabled.detail = "Pages is on, serving gh-pages";
    } else if (r.status === 0) {
      enabled.state = "not-done";
      enabled.detail = `Pages is on but serves ${source(r.stdout) ?? "a workflow build"}, not gh-pages`;
      enabled.action = `switch it with \`gh api -X PUT ${api} -f 'source[branch]=gh-pages' -f 'source[path]=/'\`, or ${enablePagesByHand(o)} — left to you, because it changes how an existing site is built`;
    } else if (/HTTP 404|Not Found/i.test(r.stderr + r.stdout)) {
      if (branch.state !== "done") {
        enabled.state = "not-done";
        enabled.detail = "Pages is not enabled, and cannot be until gh-pages exists (site:branch)";
        enabled.action = "create gh-pages first (site:branch), then re-run";
      } else if (dryRun) {
        enabled.state = "not-done";
        enabled.detail = "Pages is not enabled (dry run: not enabling it)";
        enabled.action = `\`gh ${create.join(" ")}\`, or ${enablePagesByHand(o)}`;
      } else {
        const c = probe.gh(create)!;
        const again = c.status === 0 ? read() : undefined;
        if (again && again.status === 0 && source(again.stdout) === "gh-pages") {
          enabled.state = "done";
          enabled.performed = true;
          enabled.detail = "Pages was not enabled; enabled it, serving gh-pages";
        } else {
          enabled.state = "not-done";
          enabled.detail = `enabling Pages failed: ${(c.stderr || c.stdout).trim().split("\n")[0] ?? "no output"}`;
          enabled.action = enablePagesByHand(o);
        }
      }
    } else {
      enabled.detail = `\`gh api ${api}\` answered neither yes nor no: ${(r.stderr || r.stdout).trim().split("\n")[0] ?? "no output"}`;
      enabled.action = enablePagesByHand(o);
    }
  }
  steps.push(enabled);

  const url = (decl.iriBase ?? `https://${o.owner.toLowerCase()}.github.io/${o.repo}/`).replace(/\/?$/, "/");
  // The root AND the README page: the root is the landing page (by default a
  // redirect, which a fetch follows), and README.html is where the README
  // page lands (owner, 2026-10-01). A root that answers over a README page
  // that does not is not a live site.
  const readmeUrl = `${url}README.html`;
  const [status, readmeStatus] = await Promise.all([probe.httpStatus(url), probe.httpStatus(readmeUrl)]);
  const answers = [httpAnswer(status), httpAnswer(readmeStatus)];
  const answer: StepState = answers.includes("not-done") ? "not-done" : answers.includes("could-not-determine") ? "could-not-determine" : "done";
  const said = (u: string, st: number | undefined) => (st === undefined ? `${u} could not be reached from here` : `${u} answered ${st}`);
  steps.push({
    id: "site:live",
    namedBy: named,
    what: `the site answers at ${url}, and its README page at ${readmeUrl}`,
    state: answer,
    detail: `${said(url, status)}; ${said(readmeUrl, readmeStatus)}${answer === "could-not-determine" ? " — an answer about the way here (a proxy, an access rule), not about the site" : ""}`,
    action:
      answer === "done"
        ? undefined
        : answer === "could-not-determine"
          ? `open ${readmeUrl} in a browser`
          : `once Pages is enabled and the workflow has run once, ${url} serves the site and ${readmeUrl} its README page; the run is at https://github.com/${o.owner}/${o.repo}/actions`,
  });
  return steps;
}

/**
 * What an HTTP status says about an address. 2xx and 3xx: it is there. 404
 * and 410: it is not. Anything else — 401, 403, 407, 5xx — or no answer at
 * all is an answer about the way HERE (a proxy, an access rule, an outage),
 * not about the address, so it is could-not-determine and never not-done:
 * measured 2026-09-30, this sandbox's proxy answers 403 for a site that does
 * not exist yet.
 */
export function httpAnswer(status: number | undefined): StepState {
  if (status === undefined) return "could-not-determine";
  if (status >= 200 && status < 400) return "done";
  if (status === 404 || status === 410) return "not-done";
  return "could-not-determine";
}

/**
 * The PRIMARY initialization step of a Knowledge Graph harness (owner,
 * 2026-09-30: *"json(ld) is primary step in initializing KG harness"*): every
 * JSON Schema and JSON-LD document the layer names an address for is
 * published AT that address. Two steps, because they answer different
 * questions — `schemas:staged`, does the site this toolset builds put each
 * one where its IRI says (checked here, no network); and
 * `schemas:published`, does each IRI answer now. The site is the vehicle;
 * these are the goal. Nothing is emitted when the layer publishes no
 * document (no `iriBase`, nothing under it): an empty list checked is not a
 * pass, so it is not reported as one.
 */
export async function documentSteps(root: string, decl: KnowledgeGraphDeclaration, probe: Probe): Promise<InitStep[]> {
  const docs = publishedDocuments(root);
  if (docs.length === 0) return [];
  const name = decl.name;
  const steps: InitStep[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "init-site-"));
  try {
    let report: SiteReport | undefined;
    let error: string | undefined;
    try {
      report = stageSite(root, tmp);
    } catch (e) {
      error = (e as Error).message;
    }
    const missing = docs.filter((d) => !existsSync(join(tmp, d.path)));
    const differ = docs.filter((d) => d.source && existsSync(join(tmp, d.path)) && readFileSync(join(tmp, d.path), "utf-8") !== readFileSync(join(root, d.source), "utf-8"));
    const bad = [...missing.map((d) => `${d.iri} is not at ${d.path}`), ...differ.map((d) => `${d.path} is not ${d.source}`), ...(error ? [error] : [])];
    steps.push({
      id: "schemas:staged",
      namedBy: name,
      what: `each of ${docs.length} JSON Schema / JSON-LD documents is staged at the address it names`,
      state: bad.length ? "not-done" : "done",
      detail: bad.length ? bad.join("; ") : `${docs.length} documents, each at its own IRI${report?.problems.length ? `; site problems: ${report.problems.join("; ")}` : ""}`,
      action: bad.length ? "fix the document or its address; `bun run bootstrap-tools/scripts/site.ts --root <instance> --out <dir>` shows what is staged" : undefined,
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const answers = await Promise.all(docs.map(async (d) => ({ d, status: await probe.httpStatus(d.iri) })));
  const by = (st: StepState) => answers.filter((a) => httpAnswer(a.status) === st);
  const absent = by("not-done");
  const unknown = by("could-not-determine");
  steps.push({
    id: "schemas:published",
    namedBy: name,
    what: `each of ${docs.length} document IRIs answers`,
    state: absent.length ? "not-done" : unknown.length ? "could-not-determine" : "done",
    detail: [
      `${by("done").length} answer`,
      absent.length ? `${absent.length} not found: ${absent.map((a) => a.d.iri).join(", ")}` : "",
      unknown.length ? `${unknown.length} could not be checked from here (${[...new Set(unknown.map((a) => a.status ?? "unreachable"))].join(", ")})` : "",
    ]
      .filter(Boolean)
      .join("; "),
    action: absent.length
      ? "they are published by the Pages workflow: once Pages is on (site:enabled) and the workflow has run, each IRI answers"
      : unknown.length
        ? `open one in a browser, e.g. ${unknown[0]!.d.iri}`
        : undefined,
  });
  return steps;
}

/** Every initialization step the declarations at and under `root` name, checked — and, unless `dryRun`, performed where a tool can. */
export async function initSteps(root: string, opts: { probe?: Probe; dryRun?: boolean } = {}): Promise<{ name?: string; steps: InitStep[] }> {
  const probe = opts.probe ?? realProbe;
  const dryRun = opts.dryRun ?? false;
  const steps: InitStep[] = [];
  let decl: KnowledgeGraphDeclaration | undefined;
  try {
    decl = readKnowledgeGraphDeclaration(root);
  } catch (e) {
    return { steps: [{ id: "declaration", namedBy: basename(resolve(root)), what: "the declaration parses", state: "not-done", detail: (e as Error).message, action: "fix the declaration; nothing else can be read until it parses" }] };
  }
  if (!decl) {
    return { steps: [{ id: "declaration", namedBy: basename(resolve(root)), what: "a declaration at the root", state: "not-done", detail: "no <name>.json whose `name` is its own file name", action: "this is not an instance yet: follow bootstrap's initialize-harness process" }] };
  }
  const name = decl.name;
  steps.push({ id: "declaration", namedBy: name, what: `${name}.json parses`, state: "done", detail: `${name}${decl.version ? ` ${decl.version}` : ""}` });

  for (const dep of dependencies(root, decl)) {
    steps.push({
      id: `needs:${dep.name}`,
      namedBy: name,
      what: `${dep.name}, which ${name} needs, is beside it and parses`,
      state: dep.decl ? "done" : "not-done",
      detail: dep.decl ? dep.dir : dep.error ?? "not found",
      action: dep.decl ? undefined : `clone ${dep.name} beside ${name}, at ${dep.dir}`,
    });
    const instructions = join(dep.dir, "docs", "bootstrap", "initialization.md");
    if (dep.decl && existsSync(instructions)) {
      steps.push({
        id: `instructions:${dep.name}`,
        namedBy: dep.name,
        what: `${dep.name}'s own initialization instructions are followed (FR-4)`,
        state: "stated",
        detail: `${instructions} — nothing here can observe that an agent followed it`,
        action: `read ${instructions} and do what it says; record that you did`,
      });
    }
  }

  // PRIMARY: the documents at their IRIs, before anything cosmetic.
  steps.push(...(await documentSteps(root, decl, probe)));

  for (const d of decl.directories ?? []) {
    const p = join(root, d.path);
    const ok = existsSync(p) && statSync(p).isDirectory();
    steps.push({
      id: `directory:${d.id}`,
      namedBy: name,
      what: `declared directory ${d.path} exists`,
      state: ok ? "done" : "not-done",
      detail: ok ? `holds ${d.graphTypologies.join(", ")}` : `${d.path} is declared and absent — a consumer would scan nothing and call it clean`,
      action: ok ? undefined : `create ${d.path} with its first ${d.graphTypologies.join("/")} file (an empty directory is not tracked by git), or remove the entry from ${name}.json`,
    });
  }
  for (const a of decl.assets ?? []) {
    const ok = existsSync(join(root, a.src));
    steps.push({
      id: `asset:${a.id}`,
      namedBy: name,
      what: `declared ${a.role} ${a.src} exists`,
      state: ok ? "done" : "not-done",
      detail: ok ? a.src : `${a.src} is declared and absent`,
      action: ok ? undefined : `write ${a.src}, or remove the asset from ${name}.json`,
    });
  }

  const readmePath = join(root, "README.md");
  const hasReadme = existsSync(readmePath);
  steps.push({
    id: "readme",
    namedBy: name,
    what: "the root has a README.md (FR-8)",
    state: hasReadme ? "done" : "not-done",
    detail: hasReadme ? "README.md" : "no README.md at the root",
    action: hasReadme ? undefined : "write one naming the harness and whether the set-up succeeded (bootstrap's root-readme skill)",
  });
  if (hasReadme) {
    const before = readFileSync(readmePath, "utf-8");
    const { content, written, notes } = syncReadme(root, before);
    if (written.length || notes.length) {
      const stale = content !== before;
      if (stale && !dryRun) writeFileSync(readmePath, content);
      steps.push({
        id: "readme-sections",
        namedBy: name,
        what: "every README section the README opts into is current",
        state: !stale || !dryRun ? "done" : "not-done",
        performed: stale && !dryRun ? true : undefined,
        detail: `${written.join(", ") || "none written"}${notes.length ? `; ${notes.join("; ")}` : ""}${stale ? (dryRun ? " — stale" : " — were stale; rewritten") : ""}`,
        action: stale && dryRun ? "run bootstrap-tools' `readme-sections` against this root" : undefined,
      });
    }
  }

  steps.push(...(await siteSteps(root, decl, probe, dryRun)));
  return { name, steps };
}

/** 0 all checkable steps done; 1 any not done; 3 only could-not-determine left. */
export function exitStatus(steps: readonly InitStep[]): number {
  if (steps.some((s) => s.state === "not-done")) return 1;
  if (steps.some((s) => s.state === "could-not-determine")) return 3;
  return 0;
}

const MARK: Record<StepState, string> = { done: "✓", "not-done": "✗", "could-not-determine": "?", stated: "·" };

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root = at >= 0 && args[at + 1] ? args[at + 1]! : join(import.meta.dir, "..", "..", "bootstrap");
  const { name, steps } = await initSteps(root, { probe: args.includes("--offline") ? offlineProbe : realProbe, dryRun: args.includes("--dry-run") });
  const code = name === undefined ? 2 : exitStatus(steps);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ root: resolve(root), name, steps, exit: code }, null, 2));
  } else {
    console.log(`Initialization steps for ${name ?? root}, as its declarations name them:`);
    // The primary step first, on its own line (owner: "json(ld) is primary step").
    const docs = steps.filter((s) => s.id.startsWith("schemas:"));
    if (docs.length) console.log(`  JSON Schema and JSON-LD at their IRIs: ${docs.map((s) => `${s.id.slice("schemas:".length)} ${MARK[s.state]} ${s.state}`).join(", ")}\n`);
    for (const s of steps) {
      console.log(`  ${MARK[s.state]} ${s.id.padEnd(28)} ${s.state.padEnd(20)} ${s.what}${s.performed ? " (done now)" : ""}`);
      console.log(`      ${s.detail}`);
      if (s.action) console.log(`      → ${s.action}`);
    }
    const count = (st: StepState) => steps.filter((s) => s.state === st).length;
    console.log(
      `\n${count("done")} done, ${count("not-done")} not done, ${count("could-not-determine")} could not be determined, ${count("stated")} stated (not observable).`,
    );
    if (code !== 0) {
      console.log(
        "An agent completes the rest by following bootstrap's processes/complete-initialization.bpmn: one step at a time, checking before doing, and asking the person for what only they can do.",
      );
    }
  }
  process.exit(code);
}
