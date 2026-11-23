/**
 * `verdict-reuse.sh` — may a push to `main` reuse a PR run's green verdict?
 * (bean `qbco`, folio-assistant#2456.) The script is run for real, in a
 * throwaway repository, against a stub `gh` that serves fixed API answers, so
 * every rule is exercised without the network:
 *
 * - a squash merge finds its PR head through `merge_commit_sha`;
 * - the tested tree is read from the producer's `tested-tree-<sha>` artifact
 *   name (a job summary is not exposed as `output.summary`);
 * - it reuses only when that tree equals the pushed commit's tree, and every
 *   undetermined case runs everything.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = resolve(import.meta.dir, "../../verdict-reuse.sh");

const SKIPPABLE = [
  "TypeScript — bun test, shard 1/4",
  "TypeScript — bun test, shard 2/4",
  "TypeScript — bun test, shard 3/4",
  "TypeScript — bun test, shard 4/4",
  "End-to-end + accessibility, shard 1/3",
  "End-to-end + accessibility, shard 2/3",
  "End-to-end + accessibility, shard 3/3",
  "Repository gates — cat-harness standalone ratchet (hard)",
];

function sh(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** base ← pr (H); main: squash of pr (SQ); m2: two-parent merge of pr (MG), then a direct commit (DP). */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "verdict-reuse-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  sh(repo, "init", "-q", "-b", "main");
  sh(repo, "config", "user.email", "t@example.invalid");
  sh(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "a"), "a\n");
  sh(repo, "add", "a");
  sh(repo, "commit", "-qm", "base");
  sh(repo, "checkout", "-qb", "pr");
  writeFileSync(join(repo, "b"), "b\n");
  sh(repo, "add", "b");
  sh(repo, "commit", "-qm", "pr");
  const H = sh(repo, "rev-parse", "HEAD");
  sh(repo, "checkout", "-q", "main");
  sh(repo, "merge", "-q", "--squash", "pr");
  sh(repo, "commit", "-qm", "squash");
  const SQ = sh(repo, "rev-parse", "HEAD");
  const TREE = sh(repo, "rev-parse", "HEAD^{tree}");
  sh(repo, "checkout", "-q", "-b", "m2", "HEAD~1");
  sh(repo, "merge", "-q", "--no-ff", "pr", "-m", "merge");
  const MG = sh(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "c"), "c\n");
  sh(repo, "add", "c");
  sh(repo, "commit", "-qm", "direct");
  const DP = sh(repo, "rev-parse", "HEAD");

  const bin = join(root, "bin");
  const fx = join(root, "fx");
  mkdirSync(bin);
  mkdirSync(fx);
  // `gh api <path> --jq <expr>`: serve fx/<path, query dropped, / → _>.json through jq.
  writeFileSync(
    join(bin, "gh"),
    [
      "#!/usr/bin/env bash",
      'key=$(printf "%s" "$2" | sed -E "s/\\?.*//; s#/#_#g")',
      'f="$FX/$key.json"',
      '[ -f "$f" ] || { echo "stub: no fixture $key" >&2; exit 1; }',
      'jq -r "${4:-.}" "$f"',
      "",
    ].join("\n"),
  );
  chmodSync(join(bin, "gh"), 0o755);
  return { repo, bin, fx, H, SQ, TREE, MG, DP };
}

type Fx = ReturnType<typeof fixture>;

function serve(f: Fx, opts: { artifacts: string[]; pulls: unknown[]; jobs?: string[] }) {
  const put = (key: string, v: unknown) => writeFileSync(join(f.fx, `${key}.json`), JSON.stringify(v));
  const jobs = [{ name: "producer", conclusion: "success", check_run_url: "https://api.github.com/x" }].concat(
    (opts.jobs ?? SKIPPABLE).map((name) => ({ name, conclusion: "success", check_run_url: "u" })),
  );
  put("repos_o_r_actions_runs_7_jobs", { jobs });
  put("repos_o_r_actions_workflows_w.yml_runs", {
    workflow_runs: [{ id: 7, event: "pull_request", head_sha: f.H, html_url: "u7" }],
  });
  put("repos_o_r_actions_runs_7_artifacts", { artifacts: opts.artifacts.map((name) => ({ name })) });
  put(`repos_o_r_commits_${f.SQ}_pulls`, opts.pulls);
  put(`repos_o_r_commits_${f.DP}_pulls`, []);
}

function judge(f: Fx, ref: string): { reuse: string; out: string } {
  const outFile = join(f.fx, "github-output");
  writeFileSync(outFile, "");
  const r = spawnSync("bash", [SCRIPT], {
    cwd: f.repo,
    encoding: "utf8",
    env: {
      ...process.env,
      // input-site: env PATH #be46e52e — PATH handed to a child process, which decides which binaries it runs
      PATH: `${f.bin}:${process.env.PATH}`,
      FX: f.fx,
      REPO: "o/r",
      WORKFLOW: "w.yml",
      PRODUCER_JOB: "producer",
      HEAD_REF: ref,
      GITHUB_OUTPUT: outFile,
      GITHUB_STEP_SUMMARY: "/dev/null",
    },
  });
  expect(r.status).toBe(0);
  const reuse = /^reuse=(.*)$/m.exec(readFileSync(outFile, "utf8"))?.[1] ?? "";
  return { reuse, out: r.stdout };
}

describe("verdict-reuse.sh", () => {
  const f = fixture();
  const merged = (sha: string, head: string) => ({ merged_at: "t", merge_commit_sha: sha, head: { sha: head } });

  test("a squash merge reuses the run of the PR merged as it, when the recorded tree is its tree", () => {
    serve(f, { artifacts: ["qa-working-copy", `tested-tree-${f.TREE}`], pulls: [merged(f.SQ, f.H)] });
    expect(judge(f, f.SQ).reuse).toBe("true");
  });

  test("a two-parent merge reads the same artifact record", () => {
    serve(f, { artifacts: [`tested-tree-${f.TREE}`], pulls: [] });
    expect(judge(f, f.MG).reuse).toBe("true");
  });

  test("a different recorded tree is not reused", () => {
    serve(f, { artifacts: [`tested-tree-${"0".repeat(40)}`], pulls: [merged(f.SQ, f.H)] });
    expect(judge(f, f.SQ).reuse).toBe("false");
  });

  test("no record is not reused", () => {
    serve(f, { artifacts: ["qa-working-copy"], pulls: [merged(f.SQ, f.H)] });
    expect(judge(f, f.SQ).reuse).toBe("false");
  });

  test("two records in one run are not reused", () => {
    serve(f, { artifacts: [`tested-tree-${f.TREE}`, `tested-tree-${"0".repeat(40)}`], pulls: [merged(f.SQ, f.H)] });
    expect(judge(f, f.SQ).reuse).toBe("false");
  });

  test("a one-parent commit no PR was merged as — a direct push — is not reused", () => {
    serve(f, { artifacts: [`tested-tree-${f.TREE}`], pulls: [] });
    expect(judge(f, f.DP).reuse).toBe("false");
    expect(judge(f, f.SQ).reuse).toBe("false");
  });

  test("a commit two merged PRs claim is not reused", () => {
    serve(f, { artifacts: [`tested-tree-${f.TREE}`], pulls: [merged(f.SQ, f.H), merged(f.SQ, f.DP)] });
    expect(judge(f, f.SQ).reuse).toBe("false");
  });

  test("a run that skipped one of the eight jobs is not reused", () => {
    serve(f, { artifacts: [`tested-tree-${f.TREE}`], pulls: [merged(f.SQ, f.H)], jobs: SKIPPABLE.slice(1) });
    expect(judge(f, f.SQ).reuse).toBe("false");
  });
});
