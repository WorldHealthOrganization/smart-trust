/**
 * The standing repin's PR step, run for real against stub `gh` and `git`:
 * it never merges and never asks for auto-merge, on any trigger; it labels
 * the PR `needs-repin` for the merge manager (owner, 2026-11-13, card
 * "C. No auto-merge").
 *
 * The step's own `run:` script is read out of
 * `.github/workflows/standing-repin.yml` and executed with bash, with `gh`
 * and `git` on PATH replaced by stubs that log their arguments. So the test
 * judges what the workflow does, not a copy of it.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

const WORKFLOW = join(import.meta.dir, "..", "..", "..", ".github", "workflows", "standing-repin.yml");
const STEP = "Open or update the one repin PR";

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

function step(): Step {
  const wf = parse(readFileSync(WORKFLOW, "utf8")) as { jobs: { repin: { steps: Step[] } } };
  const s = wf.jobs.repin.steps.find((x) => x.name === STEP);
  if (!s?.run) throw new Error(`no "${STEP}" step with a run script`);
  return s;
}

/** Run the step as `event` would; `existing` is an open repin PR, or none. */
function runStep(
  event: string,
  existing?: number,
  labelFails = false,
  gitBody?: string,
  createFails?: string,
  labels: { have?: string[]; createRefused?: boolean } = { have: ["needs-repin"] },
  repo?: string,
): { code: number; calls: string[]; summary: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "standing-repin-"));
  const log = join(dir, "calls.log");
  const stub = (name: string, body: string) => {
    const p = join(dir, name);
    writeFileSync(p, `#!/usr/bin/env bash\necho "${name} $*" >> "${log}"\n${body}\n`);
    chmodSync(p, 0o755);
  };
  // With `repo`, the step runs in that real repository with the real git.
  if (!repo) stub("git", gitBody ?? `case "$1" in status) echo " M index.lock.json";; diff) echo index.lock.json;; esac`);
  const listed = existing ? `{"number":${existing},"headRefName":"repin/standing-2026-11-01"}` : "";
  stub(
    "gh",
    [
      `if [ "$1 $2" = "pr list" ]; then echo '${listed}'; fi`,
      `if [ "$1 $2" = "pr view" ]; then echo 42; fi`,
      labelFails ? `if [ "$1 $2" = "pr edit" ] && [[ "$*" == *--add-label* ]]; then exit 1; fi` : "",
      createFails ? `if [ "$1 $2" = "pr create" ]; then echo '${createFails}' >&2; exit 1; fi` : "",
      `if [ "$1 $2" = "label list" ]; then printf '%s\\n' ${(labels.have ?? []).map((l) => `'${l}'`).join(" ")}; fi`,
      labels.createRefused ? `if [ "$1 $2" = "label create" ]; then echo 'HTTP 403' >&2; exit 1; fi` : "",
    ].join("\n"),
  );
  writeFileSync(join(dir, "repin.md"), "moved cat-harness\n");
  const summary = join(dir, "summary.md");
  writeFileSync(summary, "");
  const s = step();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `${dir}:${process.env.PATH}`,
    RUNNER_TEMP: dir,
    GITHUB_STEP_SUMMARY: summary,
    BASE: "main",
    HAS_TOKEN: "true",
    GH_TOKEN: "x",
    EVENT: event,
    // The step's own literal env (the label name), as the workflow sets it.
    ...Object.fromEntries(Object.entries(s.env ?? {}).filter(([, v]) => !String(v).includes("${{"))),
  };
  if (repo) Object.assign(env, gitEnv);
  const r = spawnSync("bash", ["-c", s.run!], { cwd: repo ?? dir, env, encoding: "utf8" });
  let calls: string[] = [];
  try {
    calls = readFileSync(log, "utf8").trim().split("\n");
  } catch {
    calls = [];
  }
  return { code: r.status ?? -1, calls, summary: readFileSync(summary, "utf8"), stderr: r.stderr };
}

/** A git that reads no user or system config, with a fixed identity. */
const gitEnv: Record<string, string> = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.invalid",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.invalid",
};

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, env: { ...(process.env as Record<string, string>), ...gitEnv }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

const ghCalls = (calls: readonly string[]) => calls.filter((c) => c.startsWith("gh pr merge") || c.startsWith("gh pr edit"));

describe("standing repin never merges: it labels needs-repin on every trigger", () => {
  test("the step labels with needs-repin and has no merge method", () => {
    const s = step();
    expect(s.env?.REPIN_LABEL).toBe("needs-repin");
    expect(s.env?.METHOD).toBeUndefined();
    expect(s.run).not.toMatch(/--auto\b/);
  });

  test.each(["workflow_dispatch", "schedule", "repository_dispatch"])("%s: the new PR is labelled needs-repin, and auto-merge is never asked for", (event) => {
    const r = runStep(event);
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh pr create --base main --head repin/standing-"))).toBe(true);
    expect(ghCalls(r.calls)).toEqual(["gh pr edit 42 --add-label needs-repin", "gh pr merge 42 --disable-auto"]);
    expect(r.calls.some((c) => /--auto\b/.test(c))).toBe(false);
    expect(r.summary).toContain(`labelled \`needs-repin\` for the merge manager (${event} run); this workflow never merges it`);
  });

  test("a run updating the open repin PR labels that PR and turns its auto-merge off", () => {
    const r = runStep("workflow_dispatch", 7);
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh pr create"))).toBe(false);
    expect(ghCalls(r.calls)).toEqual([
      expect.stringMatching(/^gh pr edit 7 --title /),
      "gh pr edit 7 --add-label needs-repin",
      "gh pr merge 7 --disable-auto",
    ]);
  });

  test("a repository where Actions may not open PRs gets a warning, not a red run (Q-REPIN-TOK C)", () => {
    const r = runStep("schedule", undefined, false, undefined, "pull request create failed: GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)");
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh pr create"))).toBe(true);
    expect(ghCalls(r.calls)).toEqual([]);
    expect(r.summary).toContain("No PR opened: GitHub Actions may not create pull requests here");
  });

  test("any other refused create still fails the run", () => {
    const r = runStep("schedule", undefined, false, undefined, "pull request create failed: HTTP 502");
    expect(r.code).not.toBe(0);
    expect(ghCalls(r.calls)).toEqual([]);
  });

  test("a label that cannot be added fails the run, so the merge manager is not left unaware", () => {
    const r = runStep("schedule", undefined, true);
    expect(r.code).not.toBe(0);
    expect(r.calls.some((c) => /--auto\b/.test(c))).toBe(false);
  });
});

/**
 * A `git` whose first push is refused, as GitHub refuses a credential without
 * the `workflows` permission a commit that edits .github/workflows.
 * `workflowsChanged` says whether the commit touched them.
 */
const refusingGit = (workflowsChanged: boolean) =>
  [
    `case "$1" in`,
    `  status) echo " M index.lock.json";;`,
    `  diff) if [[ "$*" == *".github/workflows"* ]]; then exit ${workflowsChanged ? 1 : 0}; fi; echo index.lock.json;;`,
    `  push) if [ ! -f "$RUNNER_TEMP/pushed-once" ]; then touch "$RUNNER_TEMP/pushed-once"; exit 1; fi;;`,
    `esac`,
  ].join("\n");

describe("standing repin moves the workflow pins with the lock when it may (cat-harness-tools#2315)", () => {
  test("the re-pin step asks remote-mount to write the workflow pins in CI", () => {
    const wf = parse(readFileSync(WORKFLOW, "utf8")) as { jobs: { repin: { steps: Step[] } } };
    const repin = wf.jobs.repin.steps.find((x) => x.name === "Re-pin");
    expect(repin?.env?.WORKFLOW_PINS_WRITE).toBe("1");
    expect(wf.jobs.repin.steps.some((x) => x.name === "Refresh the root bun.lock")).toBe(true);
  });

  test("a push refused over the workflow pins is retried without them, and the summary says so", () => {
    const r = runStep("schedule", undefined, false, refusingGit(true));
    expect(r.code).toBe(0);
    expect(r.calls.filter((c) => c.startsWith("git push"))).toHaveLength(2);
    expect(r.calls).toContain("git reset -q HEAD~1 -- .github/workflows");
    expect(r.calls).toContain("git commit -q --amend --no-edit");
    expect(r.summary).toContain("Workflow pins NOT moved");
    expect(ghCalls(r.calls)).toEqual(["gh pr edit 42 --add-label needs-repin", "gh pr merge 42 --disable-auto"]);
  });

  test("a refused push that carried no workflow edit fails the run, with nothing dropped", () => {
    const r = runStep("schedule", undefined, false, refusingGit(false));
    expect(r.code).not.toBe(0);
    expect(r.calls.some((c) => c.startsWith("git reset -q HEAD~1"))).toBe(false);
    expect(r.calls.some((c) => c.startsWith("gh pr create"))).toBe(false);
  });
});

/**
 * The same refusal against real git: a bare remote whose pre-receive hook
 * refuses any pushed commit that changes .github/workflows, as GitHub
 * refuses a credential without the `workflows` permission. The re-pin both
 * edits a workflow and ADDS one: `checkout HEAD~1 -- .github/workflows` kept
 * the added file, so the retry was refused again (a downstream standing
 * repin).
 */
describe("standing repin's retry without the workflow pins, against real git", () => {
  test("a re-pin that edits ci.yml and adds a workflow is pushed with only index.lock.json changed", () => {
    const root = mkdtempSync(join(tmpdir(), "standing-repin-git-"));
    const remote = join(root, "remote.git");
    const work = join(root, "work");
    git(root, "init", "-q", "--bare", "-b", "main", remote);
    const hook = join(remote, "hooks", "pre-receive");
    writeFileSync(
      hook,
      [
        "#!/usr/bin/env bash",
        "while read -r old new ref; do",
        '  [ "$new" = 0000000000000000000000000000000000000000 ] && continue',
        '  for c in $(git rev-list "$new" --not --all); do',
        '    if git diff-tree --no-commit-id --name-only -r --root "$c" | grep -q "^\\.github/workflows/"; then',
        '      echo "refusing to allow a token without workflows permission to change .github/workflows" >&2; exit 1',
        "    fi",
        "  done",
        "done",
      ].join("\n") + "\n",
    );
    chmodSync(hook, 0o755);
    git(root, "init", "-q", "-b", "main", work);
    mkdirSync(join(work, ".github", "workflows"), { recursive: true });
    writeFileSync(join(work, ".github", "workflows", "ci.yml"), "uses: x/y@v1\n");
    writeFileSync(join(work, "index.lock.json"), '{"pin":"a"}\n');
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", "base");
    git(work, "remote", "add", "origin", remote);
    // The initial history goes in before the hook may judge it.
    chmodSync(hook, 0o644);
    git(work, "push", "-q", "origin", "main");
    chmodSync(hook, 0o755);

    // The re-pin: the lock moves, ci.yml's pin moves, and a workflow is added.
    writeFileSync(join(work, "index.lock.json"), '{"pin":"b"}\n');
    writeFileSync(join(work, ".github", "workflows", "ci.yml"), "uses: x/y@v2\n");
    writeFileSync(join(work, ".github", "workflows", "merge-guard-trigger.yml"), "on: push\n");

    const r = runStep("schedule", undefined, false, undefined, undefined, undefined, work);
    expect(r.code).toBe(0);
    expect(r.summary).toContain("Workflow pins NOT moved");
    const branch = git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads/repin/");
    expect(branch).toMatch(/^repin\/standing-/);
    expect(git(remote, "diff", "--name-only", "main", branch)).toBe("index.lock.json");
    // The working tree is the amended commit: no stray workflow edits remain.
    expect(git(work, "status", "--porcelain")).toBe("");
  });
});

describe("standing repin creates the needs-repin label where the repository has none (owner, card 2026-11-18)", () => {
  const labelCalls = (calls: readonly string[]) => calls.filter((c) => c.startsWith("gh label create") || (c.startsWith("gh pr edit") && c.includes("--add-label")));

  test("a repository without the label gets it created, before the PR is labelled", () => {
    const r = runStep("schedule", undefined, false, undefined, undefined, { have: ["bug", "release"] });
    expect(r.code).toBe(0);
    const calls = labelCalls(r.calls);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^gh label create needs-repin --color \S+ --description /);
    expect(calls[1]).toBe("gh pr edit 42 --add-label needs-repin");
  });

  test("a repository that has the label is left as it is: no create, no --force", () => {
    const r = runStep("schedule");
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh label create"))).toBe(false);
    expect(r.calls).toContain("gh pr edit 42 --add-label needs-repin");
  });

  test("the create is idempotent: a refused create is a warning, and the labelling still decides", () => {
    const r = runStep("schedule", undefined, false, undefined, undefined, { have: [], createRefused: true });
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh label create needs-repin"))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("gh label") && c.includes("--force"))).toBe(false);
    expect(r.calls).toContain("gh pr edit 42 --add-label needs-repin");
  });

  test("a label that still cannot be added after the create fails the run, as before", () => {
    const r = runStep("schedule", undefined, true, undefined, undefined, { have: [] });
    expect(r.code).not.toBe(0);
  });
});

/**
 * A re-dispatch never drops a commit someone else pushed to the repin branch
 * (2026-11-23, litlfred/smart-base#454: the re-pin rebuilt the branch from
 * main and force-pushed it over an agent's commit). Real git, a bare remote,
 * and the open PR (#7) on `repin/standing-2026-11-01`.
 */
describe("standing repin never overwrites someone else's commit on the repin branch (smart-base#454)", () => {
  const BRANCH = "repin/standing-2026-11-01";
  function setup(branchCommits: Array<{ subject: string; file: string; body: string }>): { remote: string; work: string; before: string } {
    const root = mkdtempSync(join(tmpdir(), "standing-repin-lease-"));
    const remote = join(root, "remote.git");
    const work = join(root, "work");
    git(root, "init", "-q", "--bare", "-b", "main", remote);
    git(root, "init", "-q", "-b", "main", work);
    writeFileSync(join(work, "index.lock.json"), '{"pin":"a"}\n');
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", "base");
    git(work, "remote", "add", "origin", remote);
    git(work, "push", "-q", "origin", "main");
    git(work, "checkout", "-q", "-b", BRANCH);
    for (const c of branchCommits) {
      writeFileSync(join(work, c.file), c.body);
      git(work, "add", "-A");
      git(work, "commit", "-q", "-m", c.subject);
    }
    git(work, "push", "-q", "origin", BRANCH);
    const before = git(work, "rev-parse", "HEAD");
    git(work, "checkout", "-q", "main");
    git(work, "branch", "-q", "-D", BRANCH);
    // The re-pin's new change, on main as the workflow checks it out.
    writeFileSync(join(work, "index.lock.json"), '{"pin":"c"}\n');
    return { remote, work, before };
  }

  test("an agent's commit on the open repin branch: the branch is left as it is, and the re-pin goes to a fresh branch and PR", () => {
    const { remote, work, before } = setup([
      { subject: "Standing repin: index.lock.json", file: "index.lock.json", body: '{"pin":"b"}\n' },
      { subject: "Fix the site for the new pin", file: "fix.txt", body: "agent's fix\n" },
    ]);
    const r = runStep("workflow_dispatch", 7, false, undefined, undefined, undefined, work);
    expect(r.code).toBe(0);
    expect(git(remote, "rev-parse", BRANCH)).toBe(before);
    expect(git(remote, "show", `${BRANCH}:fix.txt`)).toBe("agent's fix");
    const fresh = git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads/repin/").split("\n").filter((b) => b !== BRANCH);
    expect(fresh).toHaveLength(1);
    expect(git(remote, "show", `${fresh[0]}:index.lock.json`)).toBe('{"pin":"c"}');
    expect(r.calls.some((c) => c.startsWith(`gh pr create --base main --head ${fresh[0]}`))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("gh pr edit 7"))).toBe(false);
    expect(r.summary).toContain("carries commits this workflow did not make");
    expect(r.summary).toContain("Fix the site for the new pin");
  });

  test("a branch holding only this workflow's own commits is updated in place, as before", () => {
    const { remote, work, before } = setup([{ subject: "Standing repin: index.lock.json", file: "index.lock.json", body: '{"pin":"b"}\n' }]);
    const r = runStep("workflow_dispatch", 7, false, undefined, undefined, undefined, work);
    expect(r.code).toBe(0);
    expect(git(remote, "rev-parse", BRANCH)).not.toBe(before);
    expect(git(remote, "show", `${BRANCH}:index.lock.json`)).toBe('{"pin":"c"}');
    expect(git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads/repin/")).toBe(BRANCH);
    expect(r.calls.some((c) => c.startsWith("gh pr edit 7 --title"))).toBe(true);
  });

  test("every push is a lease on the branch as it was read, never a bare --force", () => {
    expect(step().run).not.toMatch(/git push -q --force /);
    expect(step().run).toContain('lease="--force-with-lease=refs/heads/$branch:$old"');
  });
});
