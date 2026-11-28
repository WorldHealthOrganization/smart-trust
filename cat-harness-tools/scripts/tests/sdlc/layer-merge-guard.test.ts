/**
 * `.github/workflows/layer-merge-guard.yml`: the `merge-guard` commit status
 * on every PR head of a layer (owner, 2026-11-13, card "A. merge-guard
 * required status").
 *
 * Its "Which PRs" step is run for real with bash, against a stub `gh` and an
 * event payload, for each event a caller wires; the rest is read from the
 * file: the guard runs from the caller's default branch with `--status
 * --full-tier`, and nothing in it merges.
 *
 * Since 2026-11-17 (owner, card) no caller runs on `pull_request_target`: the
 * pull-request events arrive as the completion of the permissionless
 * `Merge guard trigger` signal, which `workflow-pins --write` writes. The
 * safety properties of that split are held here: the signal has no token and
 * runs nothing, the guard refuses a `pull_request` event, and nothing the
 * privileged side runs comes from the PR head.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

import { SIGNAL_WORKFLOW_FILE, STATUS_CONTEXT } from "../../merge-guard.ts";
import { MERGE_GUARD_PR_TYPES, MERGE_GUARD_TRIGGER_FILE, MERGE_GUARD_TRIGGER_NAME, MERGE_GUARD_TRIGGER_TEXT } from "../../workflow-pins.ts";

const WF = join(import.meta.dir, "..", "..", "..", ".github", "workflows");
const text = readFileSync(join(WF, "layer-merge-guard.yml"), "utf8");

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
  uses?: string;
  with?: Record<string, string>;
  if?: string;
}
const wf = parse(text) as { permissions?: unknown; on: { workflow_call: unknown }; jobs: { guard: { permissions?: Record<string, string>; steps: Step[] } } };
const steps = wf.jobs.guard.steps;
const named = (n: string) => steps.find((s) => s.name?.startsWith(n))!;

/** Run "Which PRs" for `event` with `payload`; `gh` answers from `gh`. */
function whichPrs(event: string, payload: unknown, opts: { input?: string; gh?: string } = {}): { prs: string; calls: string[]; code: number; stdout: string } {
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
  let calls: string[] = [];
  try {
    calls = readFileSync(log, "utf8").trim().split("\n");
  } catch {
    calls = [];
  }
  return { prs: /^prs=(.*)$/m.exec(readFileSync(out, "utf8"))?.[1] ?? "", calls, code: r.status ?? -1, stdout: r.stdout };
}

describe("layer-merge-guard: which PRs a run judges", () => {
  test("a pull_request event is refused: the caller's file would be the PR's own", () => {
    const r = whichPrs("pull_request", { pull_request: { number: 3 } });
    expect(r.code).toBe(1);
    expect(r.prs).toBe("");
    expect(r.stdout).toContain("::error::the merge guard does not run on pull_request");
  });

  test("a caller not yet re-pinned (pull_request_target) is still judged, with a warning", () => {
    const r = whichPrs("pull_request_target", { pull_request: { number: 12 } });
    expect(r.code).toBe(0);
    expect(r.prs).toBe("12");
    expect(r.stdout).toContain("::warning::this caller still runs on pull_request_target");
  });

  test("a fork PR's signal names no PR and no open PR on its sha: its run name `#<n>` is judged, digits only", () => {
    const fork = whichPrs("workflow_run", { workflow_run: { name: MERGE_GUARD_TRIGGER_NAME, display_title: `${MERGE_GUARD_TRIGGER_NAME} #41`, head_sha: "abc", pull_requests: [] } });
    expect(fork.prs).toBe("41");
    for (const title of [`${MERGE_GUARD_TRIGGER_NAME} #41; rm -rf /`, "Some other run #41", `${MERGE_GUARD_TRIGGER_NAME} #`, ""]) {
      const r = whichPrs("workflow_run", { workflow_run: { display_title: title, head_sha: "abc", pull_requests: [] } });
      expect(r.code).toBe(0);
      expect(r.prs).toBe("");
    }
    // A run that names its PR is judged by that, never by its title.
    expect(whichPrs("workflow_run", { workflow_run: { display_title: `${MERGE_GUARD_TRIGGER_NAME} #41`, head_sha: "abc", pull_requests: [{ number: 6 }] } }).prs).toBe("6");
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
  test("the guard's tools install from the layer's committed lockfile, never the newest npm", () => {
    const compose = named("Compose the guard").run!;
    const seed = compose.indexOf("cp tools/cat-harness-tools/bun.lock tools/bun.lock");
    const install = compose.indexOf("(cd tools && bun install)");
    expect(seed).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(seed);
  });

  test("it posts the `merge-guard` status under the fast gate (--full-tier only when asked), from the caller's default branch, and lands a passing PR itself", () => {
    expect(STATUS_CONTEXT).toBe("merge-guard");
    const post = named("Post the merge-guard status").run!;
    expect(post).toContain("scripts/merge-guard.ts \"$n\" --repo \"$REPO\" --root site --status");
    expect(post).toContain('tier=(--gate "${GATE:-fast}")');
    expect(post).toContain('[ "$FULL_TIER" = "true" ] && tier+=(--full-tier)');
    const inputs = (wf as unknown as { on: { workflow_call: { inputs: Record<string, { default?: unknown }> } } }).on.workflow_call.inputs;
    expect(inputs["full-tier"]!.default).toBe(false);
    expect(inputs.gate!.default).toBe("fast");
    // The one merge path is `--auto-merge`, under the fast gate (owner, 2026-11-27).
    for (const s of steps) expect((s.run ?? "").replaceAll("--auto-merge", "")).not.toMatch(/--merge\b|gh pr merge|--auto\b/);
    expect(post).toContain('[ "${AUTO_MERGE:-false}" = "true" ] && [ "${GATE:-fast}" = "fast" ] && tier+=(--auto-merge)');
    expect(inputs["auto-merge"]!.default).toBe(true);
    const checkout = steps.find((s) => s.uses?.startsWith("actions/checkout"))!;
    expect(checkout.with?.ref).toBe("${{ github.event.repository.default_branch }}");
    expect(checkout.with?.path).toBe("site");
    // No permissions of its own: the job runs with the caller's grant, so a read-only caller still starts (no auto-merge).
    expect(wf.permissions).toBeUndefined();
    expect(wf.jobs.guard.permissions).toBeUndefined();
    const caller = parse(readFileSync(join(WF, "merge-guard.yml"), "utf8")) as { permissions: Record<string, string> };
    expect(caller.permissions).toMatchObject({ statuses: "write", contents: "write", "pull-requests": "write", actions: "write" });
  });

  test("this layer's caller is `merge-guard.yml`, from the default branch only: comments, the PR checks' runs and the signal's", () => {
    const caller = parse(readFileSync(join(WF, "merge-guard.yml"), "utf8")) as {
      on: Record<string, { types?: string[]; workflows?: string[] }>;
      jobs: { guard: { uses: string } };
    };
    expect(caller.jobs.guard.uses).toBe("./.github/workflows/layer-merge-guard.yml");
    expect(Object.keys(caller.on).sort()).toEqual(["issue_comment", "workflow_dispatch", "workflow_run"]);
    const prChecks = parse(readFileSync(join(WF, "pr-tests.yml"), "utf8")) as { name: string };
    expect(caller.on.workflow_run!.workflows).toEqual([prChecks.name, MERGE_GUARD_TRIGGER_NAME]);
  });

  test("the privileged side never takes code from the PR head and holds no secret", () => {
    // Only the caller's default branch is checked out, and nothing names the head as a ref.
    expect(steps.filter((s) => s.uses?.startsWith("actions/checkout"))).toHaveLength(1);
    // The head sha is only a concurrency key and an API lookup; nothing fetches the head's tree.
    expect(text).not.toMatch(/pull_request\.head|head_ref|head_branch|head_repository/);
    for (const s of steps) {
      expect(JSON.stringify(s.with ?? {})).not.toMatch(/head|secrets\./);
      expect(s.run ?? "").not.toMatch(/head_ref|head\.ref|secrets\./);
    }
    expect(text).not.toContain("secrets.");
  });
});

describe("layer-merge-guard: the signal (`Merge guard trigger`)", () => {
  const signalText = readFileSync(join(WF, "merge-guard-trigger.yml"), "utf8");
  const signal = parse(signalText) as {
    name: string;
    "run-name": string;
    on: Record<string, { types?: string[] }>;
    permissions: Record<string, string>;
    jobs: Record<string, { permissions: Record<string, string>; steps: Step[] }>;
  };

  test("this layer's copy is the one workflow-pins writes, at the file merge-guard ignores", () => {
    expect(signalText).toBe(MERGE_GUARD_TRIGGER_TEXT);
    expect(MERGE_GUARD_TRIGGER_FILE).toBe(SIGNAL_WORKFLOW_FILE);
  });

  test("it runs on pull_request only, on every type the old caller listed, and its run name carries the PR number", () => {
    expect(signal.name).toBe(MERGE_GUARD_TRIGGER_NAME);
    expect(Object.keys(signal.on)).toEqual(["pull_request"]);
    expect(signal.on.pull_request!.types).toEqual([...MERGE_GUARD_PR_TYPES]);
    expect(signal.on.pull_request!.types).toEqual(expect.arrayContaining(["synchronize", "labeled", "unlabeled", "ready_for_review", "edited"]));
    expect(signal["run-name"]).toBe(`${MERGE_GUARD_TRIGGER_NAME} #\${{ github.event.pull_request.number }}`);
  });

  test("it names no layer, since the layers below this one hold it too (check:reference-direction)", () => {
    expect(MERGE_GUARD_TRIGGER_TEXT).not.toMatch(/cat-harness|bootstrap|folio/);
  });

  test("it holds no token, uses no action, checks nothing out and reads no secret", () => {
    expect(signal.permissions).toEqual({});
    for (const job of Object.values(signal.jobs)) {
      expect(job.permissions).toEqual({});
      for (const s of job.steps) {
        expect(s.uses).toBeUndefined();
        expect(s.run ?? "").not.toContain("${{");
      }
    }
    expect(signalText).not.toContain("secrets.");
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

