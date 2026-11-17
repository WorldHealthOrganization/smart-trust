#!/usr/bin/env bun
/**
 * instantiate-harness — lay a harness over a repository that has none: pin the
 * harness and its whole closure, mount it, open the setup-only PR, and render
 * the repository's site as a preview of that PR's branch.
 *
 * @module cat-harness-tools/scripts/instantiate-harness
 * @covers none — a SETUP step: it composes the mount and publish Tools and judges no graph
 *
 * ```sh
 * git clone --depth 1 https://github.com/litlfred/cat-harness-tools /tmp/cht
 * echo "<where the consent was given>" | bun run /tmp/cht/scripts/instantiate-harness.ts \
 *   --repo <checkout> --harness <owner/repo>[@<sha>] --consent-by <who> \
 *   [--pin <name>=<sha>]… [--repo-of <name>=<owner/repo>]… [--branch <b>] \
 *   [--plan | --local] [--no-pr]
 * ```
 *
 * ## Where it sits
 *
 * The scripted step of the initiation process: `getting-started.bpmn`
 * (`Task_ChooseHarnessed`, then the setup) and the `repo-conversion` skill's
 * §4 rule "if `main` has no harness yet, land a setup-only PR first". The PR
 * this opens IS that setup-only PR, and its preview is what a reviewer looks
 * at before merging it.
 *
 * ## It runs before anything is mounted, so it imports only `node:*`
 *
 * A bare repository has no `cat-harness-tools/` to run from, and
 * `remote-mount.ts` needs `cat-harness` and `bootstrap-tools` beside it. So
 * this file, like `mount-from-lock.ts`, imports nothing but Node, and lays the
 * platform's own closure (the layers `cat-harness-tools` needs) into a
 * temporary root, AT THE PINS THE REPOSITORY WILL MOUNT, to run the mount from
 * (the bootstrap). After the mount every later step runs from the repository's
 * own mounted `cat-harness-tools/`, and the temporary root is removed.
 *
 * ## The steps, each a stop on failure
 *
 *  1. **closure** — the harness's declaration is read at its pin, and every
 *     name in `needs`, transitively. A need is looked for at
 *     `<owner of the instance that needs it>/<name>` unless `--repo-of` says
 *     otherwise, pinned at its default branch's tip unless `--pin` says
 *     otherwise, and its declaration's `name` must be the name asked for.
 *     `--plan` prints the closure and the steps, and stops.
 *  2. **branch** — the checkout must be clean; the work goes on `--branch`
 *     (default `harness/<harness>`), never on the default branch.
 *  3. **seed** — `remote-mount.ts --seed` for every layer of the closure,
 *     `--whole`, with the consent (`--consent-by`, and the evidence on stdin or
 *     `--evidence`); `index.config.json` gains `site.landing` (the harness),
 *     `site.agentRun`, and `mountApprovers` (the consenter).
 *  4. **mount** — `remote-mount.ts` lays the closure down and writes
 *     `index.lock.json` and the `.gitignore` mounts block. The agent surface
 *     is rendered afterwards by the MOUNTED generators, so its links point at
 *     the repository's own mounts and not at the bootstrap root.
 *  5. **install** — a root `package.json` whose workspaces are the mounted
 *     layers that carry one and whose `cat` script is `bun .github/cat.ts`,
 *     the two bootstrap files from `templates/root-bootstrap/` in `.github/`
 *     (so `bun run cat …` mounts the layers itself on a fresh clone), a
 *     hoisted `bunfig.toml` (the shape the harnessed IGs use), `node_modules/`
 *     ignored, `bun install`.
 *  6. **harness steps** — the checkout script `instantiate:<harness>`, when a
 *     mounted layer declares it: the harness's own files (an IG's identity,
 *     its publish workflows). Then everything is committed.
 *  7. **publish** (not with `--local`) — the branch is pushed, `gh-pages` is
 *     provisioned when absent (`pages-bootstrap.ts --provision`), and the PR is
 *     opened with `gh` (or its URL printed; `--no-pr` skips it).
 *  8. **prepare** — the checkout script `prepare:<harness>`, when declared:
 *     what the harness's site is built from and nobody commits (an IG's AST).
 *  9. **render** — `stage-local.ts`: on this branch, the preview at
 *     `gh-pages:branches/<branch>/`; with `--local`, `--dry-run` (built and
 *     composed, nothing pushed). The site, its JSON-LD and its chrome are the
 *     steps the mounted layers declare; this file names none of them.
 *
 * ## What it refuses
 *
 * A dirty checkout, the default branch, a repository whose `index.config.json`
 * already mounts the harness (re-pin with `remote-mount.ts --seed`), consent
 * with no evidence, a need whose declaration names another layer, and a
 * closure without `cat-harness-tools` (nothing of this platform to mount).
 */

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

/** One layer of the closure, pinned. */
export interface ClosureEntry {
  name: string;
  repository: string;
  ref: string;
  needs: string[];
}

export interface Options {
  repo: string;
  harness: string;
  harnessRef?: string;
  consentBy?: string;
  evidence?: string;
  pins: Record<string, string>;
  repoOf: Record<string, string>;
  branch?: string;
  plan: boolean;
  local: boolean;
  pr: boolean;
}

/** The platform's own layer: the bootstrap runs its mount. */
export const PLATFORM = "cat-harness-tools";
const SHA = /^[0-9a-f]{40}$/;

export const USAGE = `usage: instantiate-harness.ts --repo DIR --harness OWNER/REPO[@SHA] --consent-by WHO
         [--evidence TEXT] [--pin NAME=SHA]… [--repo-of NAME=OWNER/REPO]… [--branch B]
         [--plan | --local] [--no-pr]

  Pin a harness and its closure over a repository that has none, mount it, commit the
  setup on a branch, open the setup-only PR, and render the branch's preview
  (gh-pages branches/<branch>/). The consent evidence is read from stdin unless --evidence.

  --plan     resolve the closure, print every step, and stop
  --local    commit on the branch but push nothing: the site is built and composed (--dry-run)
  --no-pr    push the branch and the preview, but open no PR`;

/** Parse the command line; throws with what is wrong. */
export function parseArgs(argv: readonly string[]): Options {
  const o: Options = { repo: ".", harness: "", pins: {}, repoOf: {}, plan: false, local: false, pr: true };
  const pair = (flag: string, v: string | undefined): [string, string] => {
    const m = v?.match(/^([a-z0-9][a-z0-9-]*)=(.+)$/);
    if (!m) throw new Error(`${flag}: expected NAME=VALUE, got \`${v ?? ""}\``);
    return [m[1]!, m[2]!];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const v = () => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`${a} needs a value`);
      return x;
    };
    switch (a) {
      case "--repo": o.repo = v(); break;
      case "--harness": {
        const m = v().match(/^([\w.-]+\/[\w.-]+)(?:@([0-9a-f]{40}))?$/);
        if (!m) throw new Error("--harness: expected OWNER/REPO or OWNER/REPO@<40-character sha>");
        o.harness = m[1]!;
        if (m[2]) o.harnessRef = m[2];
        break;
      }
      case "--consent-by": o.consentBy = v(); break;
      case "--evidence": o.evidence = v(); break;
      case "--pin": {
        const [n, s] = pair(a, v());
        if (!SHA.test(s)) throw new Error(`--pin ${n}: expected a 40-character sha`);
        o.pins[n] = s;
        break;
      }
      case "--repo-of": {
        const [n, r] = pair(a, v());
        if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new Error(`--repo-of ${n}: expected OWNER/REPO`);
        o.repoOf[n] = r;
        break;
      }
      case "--branch": o.branch = v(); break;
      case "--plan": o.plan = true; break;
      case "--local": o.local = true; break;
      case "--no-pr": o.pr = false; break;
      default: throw new Error(`unknown argument \`${a}\`\n\n${USAGE}`);
    }
  }
  if (!o.harness) throw new Error(`--harness is required\n\n${USAGE}`);
  if (o.plan && o.local) throw new Error("--plan and --local: pick one");
  return o;
}

/** The layer name a harness repository declares by convention: its repository name. */
export function nameOf(repository: string): string {
  return repository.split("/")[1]!;
}

/** Where a need is looked for: `--repo-of`, else beside the layer that needs it. */
export function repositoryOfNeed(need: string, neededBy: string, repoOf: Record<string, string>): string {
  return repoOf[need] ?? `${neededBy.split("/")[0]}/${need}`;
}

/** What the closure walk asks of the network, injectable for the tests. */
export interface Fetcher {
  /** The default branch's tip. */
  tip(repository: string): string;
  /** `<name>.json` at that commit, parsed. */
  declaration(repository: string, ref: string, name: string): { name?: unknown; needs?: unknown };
}

/** The closure of `root`, breadth first: every layer once, pinned, its declaration's name checked. */
export function resolveClosure(root: { repository: string; ref?: string }, o: Pick<Options, "pins" | "repoOf">, f: Fetcher): ClosureEntry[] {
  const out: ClosureEntry[] = [];
  const queue: { name: string; repository: string; ref?: string; by?: string }[] = [{ name: nameOf(root.repository), repository: root.repository, ...(root.ref ? { ref: root.ref } : {}) }];
  while (queue.length) {
    const q = queue.shift()!;
    if (out.some((e) => e.name === q.name)) continue;
    const ref = q.ref ?? o.pins[q.name] ?? f.tip(q.repository);
    const d = f.declaration(q.repository, ref, q.name);
    if (d.name !== q.name) {
      throw new Error(`${q.repository}@${ref.slice(0, 12)}: \`${q.name}.json\` declares \`${String(d.name)}\`, not \`${q.name}\`${q.by ? ` (needed by ${q.by}; pass --repo-of ${q.name}=<owner/repo>)` : ""}`);
    }
    const needs = Array.isArray(d.needs) ? d.needs.filter((n): n is string => typeof n === "string") : [];
    out.push({ name: q.name, repository: q.repository, ref, needs });
    for (const n of needs) queue.push({ name: n, repository: repositoryOfNeed(n, q.repository, o.repoOf), by: q.name });
  }
  return out;
}

/** The layers `name` reaches, itself included, within an already resolved closure. */
export function subClosure(closure: readonly ClosureEntry[], name: string): ClosureEntry[] {
  const seen = new Set<string>();
  const walk = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const x of closure.find((e) => e.name === n)?.needs ?? []) walk(x);
  };
  walk(name);
  return closure.filter((e) => seen.has(e.name));
}

/** `index.config.json` after the seed: the landing, agent-run, and the consenter as the one approver. */
export function withSiteAndApprover(config: Record<string, unknown>, harness: string, approver: string): Record<string, unknown> {
  const site = { ...((config.site as Record<string, unknown> | undefined) ?? {}), landing: harness, agentRun: true };
  const approvers = Array.isArray(config.mountApprovers) ? (config.mountApprovers as string[]) : [];
  return { ...config, site, mountApprovers: approvers.includes(approver) ? approvers : [...approvers, approver] };
}

/** The root `package.json`: the mounted layers that carry one become its workspaces; the rest is kept. */
export function withWorkspaces(pkg: Record<string, unknown> | undefined, repoName: string, mounted: readonly string[]): Record<string, unknown> {
  const base = pkg ?? { name: `${repoName}-site`, private: true, type: "module" };
  const have = Array.isArray(base.workspaces) ? (base.workspaces as string[]) : [];
  return { ...base, workspaces: [...have, ...mounted.filter((m) => !have.includes(m))] };
}

/** The root's `cat` script: the bootstrap that mounts the layers when they are missing, then runs `run-script.ts`. */
export const CAT_SCRIPT = "bun .github/cat.ts";

/** The files `templates/root-bootstrap/` holds, written into the root's `.github/`. */
export const ROOT_BOOTSTRAP_FILES = ["cat.ts", "mount-from-lock.sh"] as const;

/**
 * The root `package.json` with `cat` pointing at the bootstrap. A `cat` that
 * runs the bare runner (`bun cat-harness-tools/scripts/run-script.ts`, or
 * cat-harness's before bean 70lx) is replaced; any other `cat` is the root's
 * own and is kept.
 */
export function withCatScript(pkg: Record<string, unknown>): Record<string, unknown> {
  const scripts = { ...((pkg.scripts as Record<string, string> | undefined) ?? {}) };
  const cat = scripts.cat;
  if (cat === undefined || /^bun (run )?cat-harness(-tools)?\/scripts\/run-script\.ts$/.test(cat.trim())) scripts.cat = CAT_SCRIPT;
  return { ...pkg, scripts };
}

/** Copy the bootstrap files into `<repo>/.github/`, executable. */
export function writeRootBootstrap(repo: string): void {
  const from = join(import.meta.dir, "..", "templates", "root-bootstrap");
  mkdirSync(join(repo, ".github"), { recursive: true });
  for (const f of ROOT_BOOTSTRAP_FILES) {
    copyFileSync(join(from, f), join(repo, ".github", f));
    chmodSync(join(repo, ".github", f), 0o755);
  }
}

/** `bunfig.toml` with the hoisted linker: ONE root node_modules every mount resolves from. */
export function withHoistedLinker(text: string | undefined): string {
  if (text === undefined || text.trim() === "") return `[install]\nlinker = "hoisted"\n`;
  if (/^\s*linker\s*=/m.test(text)) return text;
  if (/^\[install\][ \t]*$/m.test(text)) return text.replace(/^\[install\][ \t]*$/m, `[install]\nlinker = "hoisted"`);
  return `${text.endsWith("\n") ? text : `${text}\n`}\n[install]\nlinker = "hoisted"\n`;
}

/** `.gitignore` with `node_modules/` ignored: the install must never be committed. */
export function withIgnoredNodeModules(text: string): string {
  if (/^\/?node_modules\/?\s*$/m.test(text)) return text;
  return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}node_modules/\n`;
}

/** The plan, as printed before anything is written. */
export function planLines(o: Options, closure: readonly ClosureEntry[], branch: string): string[] {
  const h = nameOf(o.harness);
  return [
    `plan: instantiate ${h} over ${resolve(o.repo)} on branch ${branch}`,
    "closure:",
    ...closure.map((e) => `  ${e.name.padEnd(22)} ${e.repository}@${e.ref.slice(0, 12)}${e.needs.length ? `  needs ${e.needs.join(", ")}` : ""}`),
    `seed      remote-mount --seed ×${closure.length} --whole, consent by ${o.consentBy ?? "(missing: --consent-by)"}; site.landing ${h}, site.agentRun, mountApprovers`,
    "mount     remote-mount: the closure, index.lock.json, the .gitignore mounts block; then the agent surface, from the mounted generators",
    "install   package.json workspaces and `cat` (bun .github/cat.ts), .github/cat.ts + mount-from-lock.sh, bunfig.toml (hoisted), node_modules/ ignored, bun install",
    `harness   instantiate:${h}, when a mounted layer declares it; then commit`,
    o.local ? "publish   (--local: nothing pushed)" : `publish   push ${branch}, provision gh-pages when absent, ${o.pr ? "open the setup-only PR" : "no PR (--no-pr)"}`,
    `prepare   prepare:${h}, when a mounted layer declares it`,
    o.local ? "render    stage-local --dry-run: built and composed, nothing pushed" : `render    stage-local: the preview at gh-pages:branches/${branch.replace(/[^A-Za-z0-9._-]+/g, "-")}/`,
  ];
}

// ── The side-effecting half ────────────────────────────────────────────────

function run(cmd: string, args: readonly string[], opts: SpawnSyncOptions & { input?: string } = {}): string {
  const r = spawnSync(cmd, args, { encoding: "utf-8", stdio: opts.input !== undefined ? ["pipe", "pipe", "inherit"] : ["ignore", "pipe", "inherit"], ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status ?? r.signal}`);
  return String(r.stdout ?? "").trim();
}

function step(cmd: string, args: readonly string[], cwd: string, input?: string): void {
  console.error(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: [input !== undefined ? "pipe" : "inherit", "inherit", "inherit"], ...(input !== undefined ? { input } : {}) });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0] ?? ""}${args[1] ? ` ${args[1]}` : ""} exited ${r.status ?? r.signal}`);
}

const url = (repository: string) => `https://github.com/${repository}`;

/** The network, through git: a blobless fetch of one commit, then `git show`. */
export function gitFetcher(work: string): Fetcher {
  return {
    tip: (repository) => {
      const line = run("git", ["ls-remote", url(repository), "HEAD"]);
      const sha = line.split(/\s+/)[0] ?? "";
      if (!SHA.test(sha)) throw new Error(`${repository}: no default branch could be read`);
      return sha;
    },
    declaration: (repository, ref, name) => {
      const dir = join(work, repository.replace("/", "__"));
      if (!existsSync(dir)) run("git", ["init", "-q", dir]);
      run("git", ["-C", dir, "fetch", "-q", "--depth", "1", "--filter=blob:none", url(repository), ref]);
      let text: string;
      try {
        text = run("git", ["-C", dir, "show", `${ref}:${name}.json`]);
      } catch {
        throw new Error(`${repository}@${ref.slice(0, 12)} holds no \`${name}.json\`: it is not a harness instance (pass --repo-of ${name}=<owner/repo>)`);
      }
      return JSON.parse(text) as { name?: unknown; needs?: unknown };
    },
  };
}

/** The checkout scripts the mounted layers declare (`run-script.ts --list`). */
function declaredScripts(repo: string): Set<string> {
  const r = spawnSync("bun", ["run", "cat-harness-tools/scripts/run-script.ts", "--list"], { cwd: repo, encoding: "utf-8" });
  return new Set(String(r.stdout ?? "").split("\n").map((l) => l.trim().split(/\s+/)[0] ?? "").filter(Boolean));
}

function readJson(file: string): Record<string, unknown> | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>) : undefined;
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  const o = parseArgs(argv);
  const repo = resolve(o.repo);
  const h = nameOf(o.harness);
  const branch = o.branch ?? `harness/${h}`;
  if (!existsSync(join(repo, ".git"))) throw new Error(`${repo} is not a git checkout`);

  const work = mkdtempSync(join(tmpdir(), "instantiate-harness-"));
  try {
    const closure = resolveClosure({ repository: o.harness, ...(o.harnessRef ? { ref: o.harnessRef } : {}) }, o, gitFetcher(join(work, "decl")));
    for (const line of planLines(o, closure, branch)) console.error(line);
    if (!closure.some((e) => e.name === PLATFORM)) throw new Error(`${h}'s closure holds no ${PLATFORM}: it is not a harness of this platform`);
    if (o.plan) return 0;

    // 2. branch
    if (!o.consentBy) throw new Error("--consent-by is required: a mount without consent is refused (H8)");
    const evidence = (o.evidence ?? (process.stdin.isTTY ? "" : readFileSync(0, "utf-8"))).trim();
    if (!evidence) throw new Error("the consent evidence (where it was given, readable) is required: on stdin, or --evidence");
    if (run("git", ["-C", repo, "status", "--porcelain"]) !== "") throw new Error(`${repo} has uncommitted changes: commit or stash them first`);
    const config0 = readJson(join(repo, "index.config.json"));
    if (((config0?.instances as { name?: string }[] | undefined) ?? []).some((i) => i.name === h)) {
      throw new Error(`index.config.json already mounts ${h}: re-pin it with \`bun run cat-harness-tools/scripts/remote-mount.ts --seed\``);
    }
    const head = spawnSync("git", ["-C", repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { encoding: "utf-8" });
    const defaultBranch = head.status === 0 ? head.stdout.trim().replace(/^origin\//, "") : "main";
    if (branch === defaultBranch) throw new Error(`--branch ${branch} is the default branch: the setup lands through a PR`);
    run("git", ["-C", repo, "switch", "-c", branch]);

    // The bootstrap: the platform's own closure, at the pins the repository will mount.
    const boot = join(work, "boot");
    const platform = subClosure(closure, PLATFORM);
    for (const e of platform) {
      const dir = join(boot, e.name);
      run("git", ["init", "-q", dir]);
      run("git", ["-C", dir, "fetch", "-q", "--depth", "1", url(e.repository), e.ref]);
      run("git", ["-C", dir, "checkout", "-q", "FETCH_HEAD"]);
    }
    writeFileSync(join(boot, "package.json"), JSON.stringify({ name: "instantiate-harness-boot", private: true, workspaces: platform.filter((e) => existsSync(join(boot, e.name, "package.json"))).map((e) => e.name) }, null, 2));
    writeFileSync(join(boot, "bunfig.toml"), withHoistedLinker(undefined));
    step("bun", ["install", "--no-save"], boot);
    const mount = join(boot, PLATFORM, "scripts", "remote-mount.ts");

    // 3. seed
    const seeds = closure.flatMap((e) => ["--seed", `${e.name}=${e.repository}@${e.ref}`]);
    step("bun", ["run", mount, ...seeds, "--consent-by", o.consentBy, "--whole"], repo, evidence);
    const configFile = join(repo, "index.config.json");
    writeFileSync(configFile, `${JSON.stringify(withSiteAndApprover(readJson(configFile)!, h, o.consentBy), null, 2)}\n`);

    // 4. mount, then the agent surface from the MOUNTED generators
    step("bun", ["run", mount, "--no-agent-surface"], repo);

    // 5. install
    const mounted = closure.map((e) => e.name).filter((n) => existsSync(join(repo, n, "package.json")));
    const pkgFile = join(repo, "package.json");
    writeFileSync(pkgFile, `${JSON.stringify(withCatScript(withWorkspaces(readJson(pkgFile), basename(repo), mounted)), null, 2)}\n`);
    writeRootBootstrap(repo);
    const bunfig = join(repo, "bunfig.toml");
    writeFileSync(bunfig, withHoistedLinker(existsSync(bunfig) ? readFileSync(bunfig, "utf-8") : undefined));
    const ignore = join(repo, ".gitignore");
    writeFileSync(ignore, withIgnoredNodeModules(existsSync(ignore) ? readFileSync(ignore, "utf-8") : ""));
    step("bun", ["install", "--no-save"], repo);
    for (const g of ["gen-skill-commands.ts", "agent-memory.ts"]) step("bun", ["run", `${PLATFORM}/scripts/${g}`], repo);

    // 6. the harness's own files, then the commit
    const scripts = declaredScripts(repo);
    const hook = (name: string) => {
      if (scripts.has(name)) step("bun", ["run", `${PLATFORM}/scripts/run-script.ts`, name], repo);
      else console.error(`· ${name}: no mounted layer declares it — skipped`);
    };
    hook(`instantiate:${h}`);
    run("git", ["-C", repo, "add", "-A"]);
    run("git", ["-C", repo, "commit", "-q", "-m", `Harness: mount ${h} and its closure\n\nPinned by instantiate-harness.ts (cat-harness-tools); consent by ${o.consentBy}.`]);

    // 7. publish
    const origin = run("git", ["-C", repo, "config", "--get", "remote.origin.url"]);
    const ownerRepo = origin.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1];
    if (!o.local) {
      step("git", ["push", "-u", "origin", branch], repo);
      const pages = spawnSync("bun", ["run", `${PLATFORM}/scripts/pages-bootstrap.ts`], { cwd: repo, stdio: "inherit" });
      if (pages.status === 3) step("bun", ["run", `${PLATFORM}/scripts/pages-bootstrap.ts`, "--provision"], repo);
      if (o.pr) {
        const body = `Setup-only PR (repo-conversion §4): mounts ${h} and its closure.\n\n${closure.map((e) => `- \`${e.name}\` ${e.repository}@${e.ref.slice(0, 12)}`).join("\n")}\n\nConsent by ${o.consentBy}. Opened by \`cat-harness-tools/scripts/instantiate-harness.ts\`.`;
        const gh = spawnSync("gh", ["pr", "create", "--base", defaultBranch, "--head", branch, "--title", `Harness: mount ${h}`, "--body", body], { cwd: repo, stdio: "inherit" });
        if (gh.status !== 0) console.error(`· open the PR by hand: https://github.com/${ownerRepo}/compare/${defaultBranch}...${branch}?expand=1`);
      }
    }

    // 8. prepare, 9. render
    hook(`prepare:${h}`);
    step("bun", ["run", `${PLATFORM}/scripts/stage-local.ts`, "--repo", ".", ...(o.local ? ["--dry-run"] : [])], repo);
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (e) {
    console.error(`✗ instantiate-harness: ${(e as Error).message}`);
    process.exit(1);
  }
}
