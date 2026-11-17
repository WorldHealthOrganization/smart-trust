/**
 * `.github/workflows/layer-merge-guard.yml`: the `merge-guard` commit status
 * on every PR head of a layer (owner, 2026-11-13, card "A. merge-guard
 * required status").
 *
 * Its "Which PRs" step is run for real with bash, against a stub `gh` and an
 * event payload, for each event a caller wires; the rest is read from the
 * file: the guard runs from the caller's default branch with `--status
 * --full-tier`, and nothing in it merges.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

import { STATUS_CONTEXT } from "../../merge-guard.ts";

const WF = join(import.meta.dir, "..", "..", "..", ".github", "workflows");
const text = readFileSync(join(WF, "layer-merge-guard.yml"), "utf8");

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
  if?: string;
}
const wf = parse(text) as { on: { workflow_call: unknown }; jobs: { guard: { permissions: Record<string, string>; steps: Step[] } } };
const steps = wf.jobs.guard.steps;
const named = (n: string) => steps.find((s) => s.name?.startsWith(n))!;

/** Run "Which PRs" for `event` with `payload`; `gh` answers from `gh`. */
function whichPrs(event: string, payload: unknown, opts: { input?: string; gh?: string } = {}): { prs: string; calls: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "merge-guard-wf-"));
  const log = join(dir, "calls.log");
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env bash\necho "gh $*" >> "${log}"\necho '${opts.gh ?? ""}'\n`);
  chmodSync(join(dir, "gh"), 0o755);
  writeFileSync(join(dir, "event.json"), JSON.stringify(payload));
  const out = join(dir, "out");
  writeFileSync(out, "");
  const r = spawnSync("bash", ["-c", named("Which PRs").run!], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...(process.env as Record<string, string>),
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_EVENT_PATH: join(dir, "event.json"),
      GITHUB_OUTPUT: out,
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
      REPO: "litlfred/x",
      EVENT: event,
      INPUT_PR: opts.input ?? "",
    },
  });
  expect(r.status).toBe(0);
  let calls: string[] = [];
  try {
    calls = readFileSync(log, "utf8").trim().split("\n");
  } catch {
    calls = [];
  }
  return { prs: /^prs=(.*)$/m.exec(readFileSync(out, "utf8"))?.[1] ?? "", calls };
}

describe("layer-merge-guard: which PRs a run judges", () => {
  test("a pull_request_target or pull_request event judges its PR", () => {
    expect(whichPrs("pull_request_target", { pull_request: { number: 12 } }).prs).toBe("12");
    expect(whichPrs("pull_request", { pull_request: { number: 3 } }).prs).toBe("3");
  });

  test("a comment on a PR judges that PR; a comment on an issue judges none", () => {
    expect(whichPrs("issue_comment", { issue: { number: 8, pull_request: { url: "u" } } }).prs).toBe("8");
    expect(whichPrs("issue_comment", { issue: { number: 9 } }).prs).toBe("");
  });

  test("a finished workflow run judges the PRs it names, or else the open PRs on its head sha", () => {
    const named = whichPrs("workflow_run", { workflow_run: { head_sha: "abc", pull_requests: [{ number: 5 }, { number: 2 }] } });
    expect(named.prs).toBe("2 5");
    expect(named.calls).toEqual([]);
    const bySha = whichPrs("workflow_run", { workflow_run: { head_sha: "abc", pull_requests: [] } }, { gh: "7" });
    expect(bySha.prs).toBe("7");
    expect(bySha.calls[0]).toStartWith("gh api repos/litlfred/x/commits/abc/pulls");
  });

  test("workflow_dispatch judges the `pr` input, or every open PR", () => {
    expect(whichPrs("workflow_dispatch", {}, { input: "44" }).prs).toBe("44");
    const all = whichPrs("workflow_dispatch", {}, { gh: "1 4 4" });
    expect(all.prs).toBe("1 4");
    expect(all.calls[0]).toStartWith("gh api repos/litlfred/x/pulls?state=open");
  });

  test("anything that is not a PR number is dropped", () => {
    expect(whichPrs("workflow_dispatch", {}, { input: "12; rm -rf /" }).prs).toBe("");
  });
});

describe("layer-merge-guard: what it runs", () => {
  test("it posts the `merge-guard` status with --full-tier, from the caller's default branch, and never merges", () => {
    expect(STATUS_CONTEXT).toBe("merge-guard");
    const post = named("Post the merge-guard status").run!;
    expect(post).toContain("scripts/merge-guard.ts \"$n\" --repo \"$REPO\" --root site --status");
    expect(post).toContain("tier=(--full-tier)");
    for (const s of steps) expect(s.run ?? "").not.toMatch(/--merge\b|gh pr merge|--auto\b/);
    const checkout = steps.find((s) => s.uses?.startsWith("actions/checkout"))!;
    expect(checkout.with?.ref).toBe("${{ github.event.repository.default_branch }}");
    expect(checkout.with?.path).toBe("site");
    expect(wf.jobs.guard.permissions.statuses).toBe("write");
    expect(wf.jobs.guard.permissions.contents).toBe("read");
  });

  test("this layer's caller is `merge-guard.yml` on pull_request_target, comments and the PR checks' runs", () => {
    const caller = parse(readFileSync(join(WF, "merge-guard.yml"), "utf8")) as {
      on: Record<string, { types?: string[]; workflows?: string[] }>;
      jobs: { guard: { uses: string } };
    };
    expect(caller.jobs.guard.uses).toBe("./.github/workflows/layer-merge-guard.yml");
    expect(Object.keys(caller.on).sort()).toEqual(["issue_comment", "pull_request_target", "workflow_dispatch", "workflow_run"]);
    expect(caller.on.pull_request_target!.types).toEqual(expect.arrayContaining(["synchronize", "labeled", "unlabeled", "ready_for_review"]));
    const prChecks = parse(readFileSync(join(WF, "pr-tests.yml"), "utf8")) as { name: string };
    expect(caller.on.workflow_run!.workflows).toEqual([prChecks.name]);
  });
});

/**
 * The post step, run as Actions runs it (`bash -e`), with a stub `bun` that
 * answers as merge-guard would. The first live run (#2103 at 857b26f,
 * 2026-11-13) died silently on a refusal: `out="$(…)"` under `-e` ends the
 * step on exit 1.
 */
function postStep(guardExit: number, guardOut: string): { code: number; stdout: string; summary: string } {
  const dir = mkdtempSync(join(tmpdir(), "merge-guard-post-"));
  writeFileSync(join(dir, "bun"), `#!/usr/bin/env bash\necho '${guardOut}'\nexit ${guardExit}\n`);
  chmodSync(join(dir, "bun"), 0o755);
  const summary = join(dir, "summary");
  writeFileSync(summary, "");
  const r = spawnSync("bash", ["-e", "-c", named("Post the merge-guard status").run!], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...(process.env as Record<string, string>),
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_STEP_SUMMARY: summary,
      REPO: "litlfred/x",
      PRS: "7 8",
      FULL_TIER: "true",
    },
  });
  return { code: r.status ?? -1, stdout: r.stdout, summary: readFileSync(summary, "utf8") };
}

describe("layer-merge-guard: the post step under bash -e", () => {
  test("a refusal (exit 1) or an unknown (exit 2) is a verdict: every PR is judged, printed, and the step passes", () => {
    for (const exit of [1, 2]) {
      const r = postStep(exit, "merge-guard #7: REFUSED (status: pending)");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(`#7: exit ${exit}`);
      expect(r.stdout).toContain(`#8: exit ${exit}`);
      expect(r.summary).toContain("REFUSED (status: pending)");
    }
  });

  test("a status that could not be posted fails the step, naming the PRs", () => {
    const r = postStep(2, "could not post the merge-guard status: HTTP 403");
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("the merge-guard status could not be posted on: #7 #8");
  });
});

