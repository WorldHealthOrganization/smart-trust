/**
 * Judge a tree once, on whatever runner is at hand, and say so by digest;
 * GitHub is one runner of several.
 *
 * ```sh
 * # the digest of the tree: the index lock's fixity digests, the caller's entry
 * # replaced by its PR tree, and the judging-scripts version
 * bun run cat judge:tree digest --lock fa/index.lock.json --caller cat-harness --caller-dir ../cat-harness
 *
 * # judge it: run-gates.py on head (and base, or a stored base verdict),
 * # compare-gates.py and compare-test-failures.py, then write the verdict record
 * bun run cat judge:tree judge --lock fa/index.lock.json --caller cat-harness --caller-dir ../cat-harness \
 *   --root fa --instance cat-harness [--base-verdict base.json --base-tree <tree> | --base-root fa-main] \
 *   [--test-path ./cat-harness] [--out verdict.json] [--publish --repo litlfred/cat-harness --sha <head sha>]
 *
 * # publish a record as the commit status `judge-tree` (GITHUB_TOKEN/GH_TOKEN; without one, the file only)
 * bun run cat judge:tree publish --record verdict.json --repo litlfred/cat-harness --sha <head sha>
 *
 * # has any runner judged this tree green? (statuses on --sha, and/or records in --records-dir)
 * bun run cat judge:tree check --lock … --caller … --tree <tree> --repo … --sha … [--records-dir dir]
 *
 * # re-run N gates of a record, chosen by --seed, and fail on any that disagrees
 * bun run cat judge:tree sample --record verdict.json --root fa --seed <sha> --n 3 [digest args]
 * ```
 *
 * Nothing here assumes GitHub Actions: the runner kind comes from the
 * environment (`detectRunner`), paths are arguments, and the one network call
 * site is `gitHubStatuses`. Exit codes follow the harness: 0 green / found,
 * 1 red / not found / disagreed, 2 could not determine.
 *
 * @module scripts/judge-tree
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  type Candidate,
  candidatesFromStatuses,
  decide,
  detectRunner,
  type GatesReport,
  gateEntries,
  gatesReportOf,
  gitHubStatuses,
  type IndexLock,
  judgingFiles,
  judgingVersion,
  junitOf,
  junitSummary,
  newGatesFromCompare,
  newTestsFromCompare,
  sampleGates,
  statusPayload,
  treeDigest,
  type VerdictRecord,
  validateVerdictRecord,
  VERDICT_SCHEMA_ID,
  verdictOf,
} from "./lib/judge-tree.ts";

const TOOLS_ROOT = resolve(import.meta.dir, "..");

class Undetermined extends Error {}

function args(argv: string[]) {
  const flags = new Map<string, string[]>();
  const bools = new Set(["publish"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    if (bools.has(k)) flags.set(k, ["true"]);
    else flags.set(k, [...(flags.get(k) ?? []), argv[++i] ?? ""]);
  }
  return { get: (k: string) => flags.get(k)?.at(-1), all: (k: string) => flags.get(k) ?? [], has: (k: string) => flags.has(k) };
}
type Args = ReturnType<typeof args>;

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf-8")) as T;

function gitTree(dir: string, rev = "HEAD"): string {
  const r = spawnSync("git", ["-C", dir, "rev-parse", `${rev}^{tree}`], { encoding: "utf-8" });
  if (r.status !== 0) throw new Undetermined(`git rev-parse ${rev}^{tree} in ${dir}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function scriptsDir(a: Args): string {
  return resolve(a.get("scripts-dir") ?? join(TOOLS_ROOT, ".github", "scripts", "layer-pr-checks"));
}

/** The digest the arguments describe, with what it was built from. */
function digestFrom(a: Args, treeFlag = "tree", dirRev?: string): { digest: string; judging: string; caller: string; tree: string; instances: number } {
  const lockPath = a.get("lock");
  const caller = a.get("caller");
  if (!lockPath || !caller) throw new Undetermined("--lock <index.lock.json> and --caller <instance or owner/name> are required");
  const lock = readJson<IndexLock>(lockPath);
  const tree = a.get(treeFlag) ?? (a.get("caller-dir") ? gitTree(a.get("caller-dir")!, dirRev ?? a.get("sha") ?? "HEAD") : undefined);
  if (!tree) throw new Undetermined(`--${treeFlag} <git tree> or --caller-dir <checkout> is required`);
  const judging = a.get("judging") ?? judgingVersion(judgingFiles(TOOLS_ROOT, scriptsDir(a)));
  return { digest: treeDigest(lock, { caller, tree }, judging), judging, caller, tree, instances: lock.instances.length };
}

function run(cmd: string, argv: string[], opts: { cwd?: string; env?: Record<string, string | undefined> } = {}) {
  const r = spawnSync(cmd, argv, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, encoding: "utf-8", maxBuffer: 1 << 28 });
  return { code: r.status ?? 2, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** run-gates.py over `root`, into `dir/gates.json`. */
function runGates(root: string, dir: string, a: Args, junit: string): GatesReport {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "gates.json");
  const own = a.all("instance").flatMap((i) => ["--instance", i]);
  const r = run("python3", [join(scriptsDir(a), "run-gates.py"), root, out, ...own], { env: { GATE_JUNIT: junit, RUNNER_TEMP: process.env.RUNNER_TEMP ?? dir } });
  process.stderr.write(r.out.split("\n").filter((l) => !l.startsWith("::")).slice(-5).join("\n") + "\n");
  if (!existsSync(out)) throw new Undetermined(`run-gates.py wrote no report (exit ${r.code})`);
  return readJson<GatesReport>(out);
}

/** `bun test` over `testPath` in `root`, into `dir/junit.xml`; an empty report when there is nothing to run. */
function runTests(root: string, dir: string, testPath: string | undefined): string {
  mkdirSync(dir, { recursive: true });
  const junit = join(dir, "junit.xml");
  if (testPath) run("bun", ["test", ...testPath.split(/\s+/).filter(Boolean), "--reporter=junit", `--reporter-outfile=${junit}`], { cwd: root });
  if (!existsSync(junit) || readFileSync(junit, "utf-8").trim() === "") writeFileSync(junit, junitOf([], 0));
  return junit;
}

async function judge(a: Args): Promise<number> {
  const startedAt = new Date().toISOString();
  const head = digestFrom(a);
  const work = mkdtempSync(join(tmpdir(), "judge-tree-"));
  const root = a.get("root");

  // Head: a report already produced (CI's merged/head), or run here.
  let headJunit = a.get("head-junit");
  if (!headJunit) headJunit = runTests(root ?? ".", join(work, "head"), root ? a.get("test-path") : undefined);
  let headGates: GatesReport;
  if (a.get("head-gates")) headGates = readJson<GatesReport>(a.get("head-gates")!);
  else if (root) headGates = runGates(root, join(work, "head"), a, headJunit);
  else throw new Undetermined("--root <mounted index> or --head-gates <run-gates.py report> is required");

  // Base: a stored verdict for the base tree's digest, a report, a run, or none.
  let baseGates: GatesReport | undefined;
  let baseJunit = a.get("base-junit");
  let base: VerdictRecord["base"] = { source: "none" };
  if (a.get("base-verdict")) {
    const rec = readJson<VerdictRecord>(a.get("base-verdict")!);
    const errs = validateVerdictRecord(rec);
    if (errs.length) throw new Undetermined(`--base-verdict is not a verdict record: ${errs.join("; ")}`);
    if (!a.get("base-tree")) throw new Undetermined("--base-verdict needs --base-tree <git tree of base>, to prove it judged the base tree");
    const want = digestFrom(a, "base-tree").digest;
    if (rec.treeDigest !== want) throw new Undetermined(`--base-verdict judged tree ${rec.treeDigest}, not the base tree ${want}`);
    baseGates = gatesReportOf(rec);
    if (!baseJunit) writeFileSync((baseJunit = join(work, "base-junit.xml")), junitOf(rec.tests.failing ?? [], rec.tests.total));
    base = { source: "stored-verdict", treeDigest: rec.treeDigest };
  } else if (a.get("base-gates")) {
    baseGates = readJson<GatesReport>(a.get("base-gates")!);
    base = { source: "run" };
  } else if (a.get("base-root")) {
    baseJunit ??= runTests(a.get("base-root")!, join(work, "base"), a.get("test-path"));
    baseGates = runGates(a.get("base-root")!, join(work, "base"), a, baseJunit);
    base = { source: "run" };
  }
  if (!baseJunit) writeFileSync((baseJunit = join(work, "base-junit.xml")), junitOf([], 0));
  const basePath = join(work, "base-gates.json");
  const headPath = join(work, "head-gates.json");
  writeFileSync(basePath, JSON.stringify(baseGates ?? {}));
  writeFileSync(headPath, JSON.stringify(headGates));

  const gc = run("python3", [join(scriptsDir(a), "compare-gates.py"), basePath, headPath]);
  const tc = run("python3", [join(scriptsDir(a), "compare-test-failures.py"), baseJunit, headJunit]);
  process.stdout.write(gc.out + "\n" + tc.out + "\n");
  const tests = junitSummary(readFileSync(headJunit, "utf-8"));
  const gates = gateEntries(headGates, baseGates, newGatesFromCompare(gc.out));
  const record: VerdictRecord = {
    $schema: VERDICT_SCHEMA_ID,
    treeDigest: head.digest,
    judging: head.judging,
    tree: { caller: head.caller, callerTree: head.tree, instances: head.instances },
    runner: detectRunner(process.env, hostname()),
    startedAt,
    finishedAt: new Date().toISOString(),
    gates,
    tests: { total: tests.total, failed: tests.failing.length, new: newTestsFromCompare(tc.out) ?? (tc.code === 0 ? 0 : tests.failing.length), failing: tests.failing },
    base,
    ...(a.get("report-url") ? { reportUrl: a.get("report-url") } : {}),
    verdict: verdictOf(gc.code, tc.code, gates.filter((g) => g.skipped === undefined).length),
  };
  const errs = validateVerdictRecord(record);
  if (errs.length) throw new Undetermined(`built an invalid record: ${errs.join("; ")}`);
  const out = resolve(a.get("out") ?? join(a.get("records-dir") ?? "judge-tree-verdicts", `${record.treeDigest}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(record, null, 1) + "\n");
  console.log(`judge-tree: ${record.verdict} — tree ${record.treeDigest} by ${record.runner.kind} ${record.runner.id}; record ${out}`);
  if (a.has("publish")) await publishRecord(record, a);
  return record.verdict === "green" ? 0 : record.verdict === "red" ? 1 : 2;
}

async function publishRecord(record: VerdictRecord, a: Args): Promise<void> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = a.get("repo");
  const sha = a.get("sha");
  if (!token || !repo || !sha) {
    console.log(`judge-tree: not published (${!token ? "no GITHUB_TOKEN/GH_TOKEN" : "--repo and --sha are required"}); the record file is the verdict`);
    return;
  }
  const fallback = process.env.GITHUB_RUN_ID && process.env.GITHUB_SERVER_URL ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : `https://github.com/${repo}/commit/${sha}`;
  const payload = statusPayload(record, fallback);
  await gitHubStatuses(token, fetch).post(repo, sha, payload);
  console.log(`judge-tree: status ${payload.state} posted on ${repo}@${sha.slice(0, 12)} — ${payload.description}`);
}

async function check(a: Args): Promise<number> {
  const { digest } = a.get("digest") ? { digest: a.get("digest")! } : digestFrom(a);
  const candidates: Candidate[] = [];
  let looked = false;
  const dir = a.get("records-dir");
  if (dir && existsSync(dir)) {
    looked = true;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      try {
        const rec = readJson<VerdictRecord>(join(dir, f));
        if (validateVerdictRecord(rec).length === 0) candidates.push({ source: `record ${f} (${rec.runner.kind} ${rec.runner.id})`, digest: rec.treeDigest, verdict: rec.verdict });
      } catch {
        // Not a record: it answers for no tree.
      }
    }
  }
  if (a.get("repo") && a.get("sha")) {
    try {
      candidates.push(...candidatesFromStatuses(await gitHubStatuses(process.env.GITHUB_TOKEN || process.env.GH_TOKEN, fetch).list(a.get("repo")!, a.get("sha")!)));
      looked = true;
    } catch (e) {
      console.error(`judge-tree: could not read statuses: ${(e as Error).message}`);
    }
  }
  const d = decide(digest, candidates);
  console.log(d.message);
  if (d.pass) return 0;
  return looked ? 1 : 2;
}

async function sample(a: Args): Promise<number> {
  const rec = readJson<VerdictRecord>(a.get("record") ?? "");
  const errs = validateVerdictRecord(rec);
  if (errs.length) throw new Undetermined(`--record is not a verdict record: ${errs.join("; ")}`);
  if (a.get("lock")) {
    const { digest } = digestFrom(a);
    if (digest !== rec.treeDigest) {
      console.log(`the record judged tree ${rec.treeDigest}, not this tree ${digest}`);
      return 1;
    }
  }
  const root = a.get("root");
  const seed = a.get("seed");
  if (!root || !seed) throw new Undetermined("--root and --seed are required");
  const picked = sampleGates(rec.gates, seed, Number(a.get("n") ?? "3"));
  let disagree = 0;
  for (const g of picked) {
    if (!g.command) {
      console.log(`${g.name}: no command recorded; cannot re-run`);
      disagree++;
      continue;
    }
    // shlex, as run-gates.py splits it, so the command is the one recorded.
    const r = run("python3", ["-c", "import shlex,subprocess,sys; sys.exit(subprocess.run(shlex.split(sys.argv[1]), cwd=sys.argv[2], timeout=1200).returncode)", g.command, root]);
    const same = r.code === g.exit;
    if (!same) disagree++;
    console.log(`${g.name}: recorded exit ${g.exit}, re-run exit ${r.code} — ${same ? "agrees" : "DISAGREES"}`);
  }
  console.log(`sample of ${picked.length} (seed ${seed}): ${disagree} disagree`);
  return disagree ? 1 : 0;
}

export async function main(argv: string[]): Promise<number> {
  const [mode, ...rest] = argv;
  const a = args(rest);
  try {
    switch (mode) {
      case "digest": {
        const d = digestFrom(a);
        console.log(d.digest);
        return 0;
      }
      case "judge":
        return await judge(a);
      case "publish": {
        const rec = readJson<VerdictRecord>(a.get("record") ?? "");
        const errs = validateVerdictRecord(rec);
        if (errs.length) throw new Undetermined(`--record is not a verdict record: ${errs.join("; ")}`);
        await publishRecord(rec, a);
        return 0;
      }
      case "check":
        return await check(a);
      case "sample":
        return await sample(a);
      default:
        console.error("usage: judge-tree.ts digest|judge|publish|check|sample [options] (see the file's header)");
        return 2;
    }
  } catch (e) {
    console.error(`judge-tree: could not determine: ${(e as Error).message}`);
    return 2;
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
