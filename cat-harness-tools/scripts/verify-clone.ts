/**
 * Is a separated repository green from a FRESH clone?
 *
 * ```sh
 * bun run cat sub-kg:verify-clone --repo owner/name                 # JSON report, exit 0/1/2
 * bun run cat sub-kg:verify-clone --repo owner/name --ref my-branch --text
 * bun run cat sub-kg:verify-clone --repo owner/name --sibling owner/platform --gate "bun test"
 * ```
 *
 * Stage 11 of `sub-kg-lifecycle` ("Verify on a fresh clone"), as a command.
 *
 * ## Why a fresh clone and not the rehearsal
 *
 * `seed:ready --rehearse` copies a layer out of THIS checkout, so it shares
 * the checkout's `node_modules`, its git configuration and whatever the host
 * environment quietly supplies; an import that reaches outside the seed only
 * fails in a clone in an empty directory.
 *
 * ## What it does
 *
 * 1. `git clone --depth 1 --recurse-submodules` the repository (at `--ref`)
 *    into a scratch directory: `--work`, or a new temporary directory.
 * 2. Clones each `--sibling` beside it, for a repository that links its
 *    platform as a sibling checkout rather than a submodule.
 * 3. Installs, when there is a `package.json`: `bun install --frozen-lockfile`
 *    if a lockfile is committed, otherwise `bun install`.
 * 4. Runs the gates: every `--gate` command given; else the repository's own
 *    `gates` script; else its `test` script. A repository with none of these
 *    has nothing to judge it by, and that is `unknown`, not green.
 *
 * ## Three verdicts, and the third is never green
 *
 * | verdict  | exit | when |
 * |----------|------|------|
 * | `green`  | 0    | every step ran and passed |
 * | `red`    | 1    | a step ran and failed |
 * | `unknown`| 2    | a step could not run: the clone failed, the tree was empty, no gate was found |
 *
 * ## It reports and never acts
 *
 * It writes only inside the scratch directory, and removes that directory
 * afterwards unless `--keep` or `--work` was given. It never pushes, comments
 * or deletes anything outside it: the cutover is the owner's decision.
 *
 * @module cat-harness-tools/scripts/verify-clone
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

export type StepStatus = "pass" | "fail" | "could-not-run";
export type Verdict = "green" | "red" | "unknown";

export interface Step {
  name: string;
  command: string;
  status: StepStatus;
  exit: number | null;
  ms: number;
  /** The last lines of output, so a red step can be read without re-running it. */
  tail?: string;
}

export interface VerifyCloneOptions {
  /** `owner/name`, a git URL, or a local path. */
  repo: string;
  ref?: string;
  siblings?: string[];
  gates?: string[];
  /** Scratch directory. Kept when given. */
  work?: string;
  keep?: boolean;
  /** Per-step timeout, ms. */
  timeoutMs?: number;
}

export interface VerifyCloneReport {
  $schema: "sub-kg-verify-clone/v1";
  repo: string;
  ref: string | null;
  commit: string | null;
  work: string;
  steps: Step[];
  verdict: Verdict;
}

/** `owner/name` becomes a GitHub URL; a URL or an existing path is used as it is. */
export function cloneSource(repo: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo) && !existsSync(repo)) {
    return `https://github.com/${repo}.git`;
  }
  return repo;
}

function dirNameFor(repo: string): string {
  return basename(repo.replace(/\/+$/, "")).replace(/\.git$/, "") || "repo";
}

function run(name: string, command: string, args: string[], cwd: string, timeoutMs: number): Step {
  const t0 = Date.now();
  const r = spawnSync(command, args, { cwd, stdio: "pipe", timeout: timeoutMs, env: process.env });
  const ms = Date.now() - t0;
  const out = `${r.stdout?.toString() ?? ""}${r.stderr?.toString() ?? ""}`;
  const tail = out.trim().split("\n").slice(-15).join("\n");
  const shown = [command, ...args].join(" ");
  if (r.error || r.status === null) {
    return { name, command: shown, status: "could-not-run", exit: r.status, ms, tail: r.error?.message ?? tail };
  }
  return { name, command: shown, status: r.status === 0 ? "pass" : "fail", exit: r.status, ms, tail };
}

/** The gate commands a repository offers, in the order this command prefers them. */
export function defaultGates(repoDir: string): string[] {
  const pkgPath = join(repoDir, "package.json");
  if (!existsSync(pkgPath)) return [];
  let scripts: Record<string, string> = {};
  try {
    scripts = (JSON.parse(readFileSync(pkgPath, "utf-8")) as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    return [];
  }
  if (scripts.gates) return ["bun run cat gates"];
  if (scripts.test) return ["bun run test"];
  return [];
}

/** The verdict, from the steps: any could-not-run is unknown, else any fail is red. */
export function verdictOf(steps: Step[]): Verdict {
  if (steps.length === 0 || steps.some((s) => s.status === "could-not-run")) return "unknown";
  return steps.some((s) => s.status === "fail") ? "red" : "green";
}

export function verifyClone(o: VerifyCloneOptions): VerifyCloneReport {
  const timeoutMs = o.timeoutMs ?? 30 * 60_000;
  const work = o.work ? resolve(o.work) : mkdtempSync(join(tmpdir(), "verify-clone-"));
  mkdirSync(work, { recursive: true });
  const steps: Step[] = [];
  const name = dirNameFor(o.repo);
  const dir = join(work, name);
  const report = (commit: string | null): VerifyCloneReport => ({
    $schema: "sub-kg-verify-clone/v1",
    repo: o.repo,
    ref: o.ref ?? null,
    commit,
    work,
    steps,
    verdict: verdictOf(steps),
  });

  const branch = o.ref ? ["--branch", o.ref] : [];
  const clone = run("clone", "git", ["clone", "--depth", "1", "--recurse-submodules", "--shallow-submodules", ...branch, cloneSource(o.repo), dir], work, timeoutMs);
  if (clone.status !== "pass") clone.status = "could-not-run";
  steps.push(clone);
  if (clone.status !== "pass") return finish(report(null));

  const entries = readdirSync(dir).filter((e) => e !== ".git");
  if (entries.length === 0) {
    steps.push({ name: "tree", command: "ls", status: "could-not-run", exit: null, ms: 0, tail: "the clone is empty: an empty tree cannot pass" });
    return finish(report(null));
  }
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, stdio: "pipe" });
  const commit = head.status === 0 ? head.stdout.toString().trim() : null;

  for (const sib of o.siblings ?? []) {
    const s = run(`sibling ${sib}`, "git", ["clone", "--depth", "1", cloneSource(sib), join(work, dirNameFor(sib))], work, timeoutMs);
    if (s.status !== "pass") s.status = "could-not-run";
    steps.push(s);
    if (s.status !== "pass") return finish(report(commit));
  }

  if (existsSync(join(dir, "package.json"))) {
    const locked = existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"));
    const install = run("install", "bun", locked ? ["install", "--frozen-lockfile"] : ["install"], dir, timeoutMs);
    steps.push(install);
    if (install.status !== "pass") return finish(report(commit));
  }

  const gates = o.gates && o.gates.length > 0 ? o.gates : defaultGates(dir);
  if (gates.length === 0) {
    steps.push({ name: "gates", command: "(none)", status: "could-not-run", exit: null, ms: 0, tail: "no --gate given and no `gates` or `test` script: nothing to judge the clone by" });
    return finish(report(commit));
  }
  for (const g of gates) steps.push(run(`gate ${g}`, "sh", ["-c", g], dir, timeoutMs));
  return finish(report(commit));

  function finish(r: VerifyCloneReport): VerifyCloneReport {
    if (!o.work && !o.keep) rmSync(work, { recursive: true, force: true });
    return r;
  }
}

export function formatText(r: VerifyCloneReport): string {
  const lines = [`verify-clone ${r.repo}${r.ref ? `@${r.ref}` : ""}${r.commit ? ` (${r.commit.slice(0, 12)})` : ""}: ${r.verdict.toUpperCase()}`];
  for (const s of r.steps) {
    lines.push(`  ${s.status === "pass" ? "✓" : s.status === "fail" ? "✗" : "?"} ${s.name}  ${s.command}  (${(s.ms / 1000).toFixed(1)}s)`);
    if (s.status !== "pass" && s.tail) for (const l of s.tail.split("\n")) lines.push(`      ${l}`);
  }
  if (r.verdict === "unknown") lines.push("  could not determine: this is NOT a pass.");
  return lines.join("\n");
}

const USAGE = `usage: verify-clone.ts --repo <owner/name|url|path> [--ref <ref>] [--sibling <owner/name>]... [--gate "<cmd>"]... [--work <dir>] [--keep] [--text]`;

export function main(argv: string[]): number {
  const o: VerifyCloneOptions = { repo: "", siblings: [], gates: [] };
  let text = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--repo": o.repo = next(); break;
      case "--ref": o.ref = next(); break;
      case "--sibling": o.siblings!.push(next()); break;
      case "--gate": o.gates!.push(next()); break;
      case "--work": o.work = next(); break;
      case "--keep": o.keep = true; break;
      case "--text": text = true; break;
      case "--help": case "-h": console.log(USAGE); return 0;
      default: console.error(`verify-clone: unknown option ${a}\n${USAGE}`); return 2;
    }
  }
  if (!o.repo) {
    console.error(`verify-clone: --repo is required\n${USAGE}`);
    return 2;
  }
  const r = verifyClone(o);
  console.log(text ? formatText(r) : JSON.stringify(r, null, 2));
  return r.verdict === "green" ? 0 : r.verdict === "red" ? 1 : 2;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
