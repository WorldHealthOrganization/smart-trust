import { describe, expect, test } from "bun:test";
import {
  assess,
  byWorkflow,
  classifyRuns,
  cronPeriodDays,
  describeWindow,
  render,
  type RunSummary,
} from "../../../src/workflow/ci-health";

/**
 * `docs-site.yml` fired on every push to `main` and failed all 30 times over
 * two months. The trigger was fine; the *outcome* was invisible, and from
 * inside the repo a workflow that runs and passes and one that runs and fails
 * look identical. See bean `xom7`.
 *
 * These tests pin the two distinctions that make a health report worth reading:
 * a run still in flight is not a verdict either way, and "could not check" is
 * never rendered as "green". A report that goes quiet when it cannot see is
 * worse than no report, because it reads as reassurance.
 */

const NOW = new Date("2026-08-26T12:00:00Z");
const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  name: "Docs site",
  status: "completed",
  conclusion: "success",
  created_at: "2026-08-26T10:00:00Z",
  ...over,
});

describe("classifying one workflow's history", () => {
  test("latest success is green, with no failure count", () => {
    const h = classifyRuns([run(), run({ conclusion: "failure" })], NOW);
    expect(h.health).toBe("green");
    expect(h.consecutiveFailures).toBe(0);
  });

  test("consecutive failures are counted from the newest run backwards", () => {
    const h = classifyRuns(
      [
        run({ conclusion: "failure", created_at: "2026-08-26T10:00:00Z" }),
        run({ conclusion: "failure", created_at: "2026-08-25T10:00:00Z" }),
        run({ conclusion: "failure", created_at: "2026-08-24T10:00:00Z" }),
        run({ conclusion: "success", created_at: "2026-08-20T10:00:00Z" }),
        run({ conclusion: "failure", created_at: "2026-08-19T10:00:00Z" }),
      ],
      NOW,
    );
    expect(h.health).toBe("red");
    expect(h.consecutiveFailures).toBe(3);
    expect(h.daysSinceSuccess).toBe(6);
  });

  test("no success anywhere in the window leaves daysSinceSuccess undefined", () => {
    // The real docs-site shape: red as far back as the window reaches. Guessing
    // a number here would understate how long it had been broken.
    const h = classifyRuns([run({ conclusion: "failure" }), run({ conclusion: "failure" })], NOW);
    expect(h.health).toBe("red");
    expect(h.daysSinceSuccess).toBeUndefined();
    expect(h.lastSuccess).toBeUndefined();
  });

  test("a run still in flight is not a verdict either way", () => {
    // Counting a queued run as a failure would cry wolf on every push; counting
    // it as a pass would be the exact lie this whole module exists to prevent.
    expect(classifyRuns([run({ status: "in_progress", conclusion: null })], NOW).health).toBe(
      "running",
    );
  });

  test("cancelled and skipped runs are not the workflow's fault, and are ignored", () => {
    const h = classifyRuns(
      [
        run({ conclusion: "cancelled" }),
        run({ conclusion: "skipped" }),
        run({ conclusion: "success", created_at: "2026-08-26T09:00:00Z" }),
      ],
      NOW,
    );
    expect(h.health).toBe("green");
    expect(h.consecutiveFailures).toBe(0);
  });

  test("no runs at all is its own state, not green", () => {
    expect(classifyRuns([], NOW).health).toBe("no-runs");
  });
});

describe("assessing a whole repo", () => {
  const mixed: RunSummary[] = [
    run({ name: "Docs site", conclusion: "failure", created_at: "2026-08-26T10:00:00Z" }),
    run({ name: "Docs site", conclusion: "failure", created_at: "2026-08-25T10:00:00Z" }),
    run({ name: "Code-quality gates", conclusion: "success", created_at: "2026-08-26T11:00:00Z" }),
    run({ name: "QA sweep", conclusion: "failure", created_at: "2026-08-01T10:00:00Z" }),
  ];

  test("runs are grouped by workflow, newest first", () => {
    const g = byWorkflow(mixed);
    expect([...g.keys()].sort()).toEqual(["Code-quality gates", "Docs site", "QA sweep"]);
    expect(g.get("Docs site")![0].created_at).toBe("2026-08-26T10:00:00Z");
  });

  test("the worst workflow sorts first — one line read should be the worst one", () => {
    const h = assess(mixed, { now: NOW });
    expect(h[0].workflow).toBe("Docs site");
    expect(h[0].consecutiveFailures).toBe(2);
    expect(h.at(-1)!.workflow).toBe("Code-quality gates");
  });

  test("runs of a DELETED workflow are history, not a live problem", () => {
    const withGhost = [
      ...mixed,
      run({
        name: ".github/workflows/paper-builder-image.yml",
        path: ".github/workflows/paper-builder-image.yml",
        conclusion: "failure",
      }),
    ];
    const exists = (p: string) => p !== ".github/workflows/paper-builder-image.yml";
    const names = assess(withGhost, { now: NOW, workflowExists: exists }).map((h) => h.workflow);
    expect(names).not.toContain(".github/workflows/paper-builder-image.yml");
    // Still reports the live failure — the filter must not swallow real ones.
    expect(names).toContain("Docs site");
  });

  test("without a workflowExists predicate nothing is filtered", () => {
    // Not knowing which files exist must not silently drop failures.
    const withGhost = [...mixed, run({ name: "Gone", path: "x.yml", conclusion: "failure" })];
    expect(assess(withGhost, { now: NOW }).map((h) => h.workflow)).toContain("Gone");
  });
});

describe("age separates an active fire from a stale scorch mark", () => {
  test("a red that has not re-run in a week is flagged as possibly stale", () => {
    // The real shape of two of this repo's workflows: last red 2026-08-07,
    // against a commit whose files were changed the next day.
    const out = render(
      assess(
        [
          run({ name: "QA sweep", conclusion: "failure", created_at: "2026-08-07T15:04:09Z" }),
          run({ name: "QA sweep", conclusion: "failure", created_at: "2026-08-07T15:04:08Z" }),
        ],
        { now: NOW },
      ),
      { branch: "main" },
    );
    // 2026-08-07T15:04 to 2026-08-26T12:00 is 18 whole days, not 19.
    expect(out).toContain("has not run in 18d");
    expect(out).toContain("may be stale");
  });

  test("a red that ran today is NOT softened as stale", () => {
    const out = render(
      assess([run({ name: "Docs site", conclusion: "failure", created_at: "2026-08-26T10:00:00Z" })], {
        now: NOW,
      }),
      { branch: "main" },
    );
    expect(out).toContain("last ran 0d ago");
    expect(out).not.toContain("may be stale");
  });
});

describe("rendering, and the thing it must never do", () => {
  test("an unreachable API renders as unknown, never as green", () => {
    const out = render([], { unreachable: "GitHub API returned 403", branch: "main" });
    expect(out).toContain("Not checked");
    expect(out).toContain("treat as unknown, not as green");
    expect(out).not.toMatch(/✓|green \(/);
  });

  test("a failing workflow is named with its failure count and staleness", () => {
    const out = render(assess([
      run({ name: "Docs site", conclusion: "failure", created_at: "2026-08-26T10:00:00Z" }),
      run({ name: "Docs site", conclusion: "failure", created_at: "2026-08-25T10:00:00Z" }),
    ], { now: NOW }), { branch: "main" });
    expect(out).toContain("Docs site");
    expect(out).toContain("2 consecutive failure(s)");
    expect(out).toContain("no success in the window");
  });

  test("all green says so explicitly rather than printing nothing", () => {
    // An empty section is indistinguishable from a section that did not run.
    const out = render(assess([run({ name: "Code-quality gates" })], { now: NOW }), {
      branch: "main",
    });
    expect(out).toContain("every workflow with a recent run");
  });

  test("no runs in the window is stated, not rendered as green", () => {
    const out = render([], { branch: "main" });
    expect(out).toContain("No runs on");
    expect(out).not.toContain("green");
  });
});

describe("a verdict against a file that has since changed", () => {
  /**
   * `witness-refresh.yml` and `qa-sweep.yml` failed to parse, so GitHub could
   * not read their `on:` block and ran them on `push` despite both being
   * `workflow_dispatch`-only — the startup-failure signature, and why both runs
   * are named by path rather than by `name:`. They were fixed the next day, and
   * 75 pushes to `main` since produced no further run of either.
   *
   * Nothing will ever run them on the default branch again, so without this
   * rule they stay red forever: two permanent false fires in a report whose
   * whole value is that a red line means something. See bean `lq7e`.
   */
  const failedThenFixed = [
    run({
      name: ".github/workflows/qa-sweep.yml",
      path: ".github/workflows/qa-sweep.yml",
      conclusion: "failure",
      created_at: "2026-08-07T15:04:09Z",
    }),
  ];
  const fixedOn = (iso: string) => () => iso;

  test("a red whose file changed after the failure is superseded, not red", () => {
    const [h] = assess(failedThenFixed, {
      now: NOW,
      workflowChangedAt: fixedOn("2026-08-08T18:57:45Z"),
    });
    expect(h.health).toBe("superseded");
    expect(h.supersededBy).toBe("2026-08-08T18:57:45Z");
  });

  test("a red whose file changed BEFORE the failure stays red", () => {
    // The run tested the current version. Nothing about it is stale.
    const [h] = assess(failedThenFixed, {
      now: NOW,
      workflowChangedAt: fixedOn("2026-08-01T00:00:00Z"),
    });
    expect(h.health).toBe("red");
    expect(h.supersededBy).toBeUndefined();
  });

  test("without a workflowChangedAt predicate nothing is superseded", () => {
    // Not knowing when a file changed must leave the failure reported. This is
    // the same refusal as `workflowExists`: absence of evidence explains
    // nothing away.
    expect(assess(failedThenFixed, { now: NOW })[0].health).toBe("red");
  });

  test("git answering `undefined` — a shallow clone — leaves it red", () => {
    const [h] = assess(failedThenFixed, { now: NOW, workflowChangedAt: () => undefined });
    expect(h.health).toBe("red");
  });

  test("a GREEN workflow is never touched by the rule", () => {
    // The rule may only ever demote a red. A later edit is evidence the failing
    // version is gone — never evidence about a version that passed.
    const [h] = assess(
      [run({ name: "Code-quality gates", path: ".github/workflows/code-quality-gates.yml" })],
      { now: NOW, workflowChangedAt: fixedOn("2026-08-26T11:59:00Z") },
    );
    expect(h.health).toBe("green");
  });

  test("a run with no path cannot be superseded", () => {
    const [h] = assess([run({ name: "Nameless", conclusion: "failure" })], {
      now: NOW,
      workflowChangedAt: fixedOn("2026-08-26T11:59:00Z"),
    });
    expect(h.health).toBe("red");
  });

  test("superseded renders below the fold, and NEVER as green", () => {
    const out = render(
      assess(failedThenFixed, { now: NOW, workflowChangedAt: fixedOn("2026-08-08T18:57:45Z") }),
      { branch: "main" },
    );
    expect(out).toContain("stale, not green");
    expect(out).not.toContain("every workflow with a recent run");
  });

  test("a live red still sorts above a superseded one", () => {
    const h = assess(
      [
        ...failedThenFixed,
        run({
          name: "Docs site",
          path: ".github/workflows/docs-site.yml",
          conclusion: "failure",
          created_at: "2026-08-26T10:00:00Z",
        }),
      ],
      { now: NOW, workflowChangedAt: fixedOn("2026-08-08T18:57:45Z") },
    );
    expect(h[0].workflow).toBe("Docs site");
    expect(h[0].health).toBe("red");
    expect(h.at(-1)!.health).toBe("superseded");
  });
});

/**
 * Bean `gpuu`. The module already had a `running` health state, but it fired
 * only when NOTHING had settled. The ordinary case — a newest run still in
 * flight over older settled runs — fell straight through to the settled
 * verdict, and the report printed it as the answer.
 *
 * Measured on this repository, 2026-09-19: `main` took a merge at 02:39 that
 * broke `kg:audit:check`, and a run of this check at 02:39 printed
 * "✓ every workflow with a recent run on `main` is green (3)". #312 fixed the
 * breakage at 02:40. In between, an agent wrote "`main` is not red" into a
 * pull request body and flagged the PR that was fixing it as mistaken.
 *
 * Each test below is that situation with exactly one thing varied.
 */
describe("an unsettled newest run never reads as a verdict about the head", () => {
  const green = (at: string) => run({ created_at: at });

  test("newest in flight over an older success is flagged, not reported as green", () => {
    const [h] = assess([
      run({ status: "in_progress", conclusion: null, created_at: "2026-08-26T12:00:00Z" }),
      green("2026-08-26T10:00:00Z"),
    ]);
    expect(h.health).toBe("green");
    expect(h.newestUnsettled).toBe(true);
  });

  test("a queued newest run counts the same as one in flight", () => {
    const [h] = assess([
      run({ status: "queued", conclusion: null, created_at: "2026-08-26T12:00:00Z" }),
      green("2026-08-26T10:00:00Z"),
    ]);
    expect(h.newestUnsettled).toBe(true);
  });

  test("a cancelled newest run counts too — completed is not the same as judged", () => {
    const [h] = assess([
      run({ conclusion: "cancelled", created_at: "2026-08-26T12:00:00Z" }),
      green("2026-08-26T10:00:00Z"),
    ]);
    expect(h.newestUnsettled).toBe(true);
  });

  test("the summary line does not say every workflow is green", () => {
    const out = render(
      assess([
        run({ status: "in_progress", conclusion: null, created_at: "2026-08-26T12:00:00Z" }),
        green("2026-08-26T10:00:00Z"),
      ]),
      { branch: "main" },
    );
    expect(out).not.toContain("every workflow with a recent run");
    expect(out).toContain("has not reported");
    expect(out).toContain("the head has not been judged");
  });

  test("a settled newest run is not flagged — the ordinary case is unchanged", () => {
    const [h] = assess([green("2026-08-26T12:00:00Z"), green("2026-08-26T10:00:00Z")]);
    expect(h.health).toBe("green");
    expect(h.newestUnsettled).toBeUndefined();
    expect(render([h], { branch: "main" })).toContain("every workflow with a recent run");
  });

  test("the trend survives: red with a run in flight is still red, and still flagged", () => {
    const [h] = assess([
      run({ status: "in_progress", conclusion: null, created_at: "2026-08-26T14:00:00Z" }),
      run({ conclusion: "failure", created_at: "2026-08-26T12:00:00Z" }),
      run({ conclusion: "failure", created_at: "2026-08-26T10:00:00Z" }),
    ]);
    expect(h.health).toBe("red");
    expect(h.consecutiveFailures).toBe(2);
    expect(h.newestUnsettled).toBe(true);
  });

  test("`running` is not doubly reported — nothing settled stays just `running`", () => {
    const [h] = assess([run({ status: "in_progress", conclusion: null })]);
    expect(h.health).toBe("running");
    expect(h.newestUnsettled).toBeUndefined();
  });
});

/**
 * Bean `gpuu`, second half. `newestUnsettled` answers "a run for the head
 * exists but has not finished". It does not reach the other silence: no run
 * for the head was ever created, because the workflow did not fire or has not
 * yet. `docs-site.yml` sat in that state for two months under bean `xom7`.
 *
 * The hard part is not detecting it — it is NOT detecting it for a workflow
 * that never owed a run. `witness-refresh.yml` and `qa-sweep.yml` are
 * `workflow_dispatch`-only, so a naive check reports two permanent false
 * fires, which is the defect the `superseded` rule exists to retire.
 */
describe("no run for the head is reported — but only where a run was owed", () => {
  const HEAD = "deadbeefcafe";
  const onPush = () => true;
  const older = (sha: string, at: string) =>
    run({ path: ".github/workflows/docs-site.yml", head_sha: sha, created_at: at });

  test("a workflow that runs on push and has no run for the head is flagged", () => {
    const [h] = assess([older("aaa111", "2026-08-26T10:00:00Z")], {
      headSha: HEAD,
      triggersOnPush: onPush,
    });
    expect(h.health).toBe("green");
    expect(h.headUnjudged).toBe(true);
  });

  test("a dispatch-only workflow is NOT flagged — it never owed a run", () => {
    const [h] = assess([older("aaa111", "2026-08-26T10:00:00Z")], {
      headSha: HEAD,
      triggersOnPush: () => false,
    });
    expect(h.headUnjudged).toBeUndefined();
  });

  test("an unreadable trigger block claims nothing", () => {
    const [h] = assess([older("aaa111", "2026-08-26T10:00:00Z")], {
      headSha: HEAD,
      triggersOnPush: () => undefined,
    });
    expect(h.headUnjudged).toBeUndefined();
  });

  test("no head supplied claims nothing — not knowing is not a finding", () => {
    const [h] = assess([older("aaa111", "2026-08-26T10:00:00Z")], { triggersOnPush: onPush });
    expect(h.headUnjudged).toBeUndefined();
  });

  test("a run that DID judge the head clears it, even in flight", () => {
    const [h] = assess(
      [
        run({
          path: ".github/workflows/docs-site.yml",
          head_sha: HEAD,
          status: "in_progress",
          conclusion: null,
          created_at: "2026-08-26T12:00:00Z",
        }),
        older("aaa111", "2026-08-26T10:00:00Z"),
      ],
      { headSha: HEAD, triggersOnPush: onPush },
    );
    expect(h.headUnjudged).toBeUndefined();
    expect(h.newestUnsettled).toBe(true);
  });

  test("the summary refuses 'all green' and says which silence it is", () => {
    const out = render(
      assess([older("aaa111", "2026-08-26T10:00:00Z")], {
        headSha: HEAD,
        triggersOnPush: onPush,
      }),
      { branch: "main" },
    );
    expect(out).not.toContain("every workflow with a recent run");
    expect(out).toContain("no run has judged the current head");
    expect(out).toContain("the head has not been judged");
  });
});

/**
 * A workflow that did not run is a ROW, not an absence.
 *
 * ## The defect these pin
 *
 * Every row in this report used to be derived from the runs. `byWorkflow`
 * groups them, and a group is never empty — so `Health`'s `"no-runs"` state,
 * which `classifyRuns` sets at `runs.length === 0`, was **unreachable**. A
 * workflow with nothing in the window was not a row with a quiet verdict; it
 * was not in the report at all.
 *
 * Measured on this repository, 2026-09-20: **38 workflow files, 3 rows**, and
 * the summary `✓ every workflow … is green`. That is `xom7` — a workflow
 * failing where nobody looks — reproduced inside the module written for
 * `xom7`.
 *
 * ## Why the window is the sharper half
 *
 * `?per_page=100` is a page of RUNS, not a period. On the same measurement it
 * reached back **6.1 hours** (of 1096 runs on the branch). `ci-health.yml`
 * fires weekly and `health-check.yml` daily, so neither could appear however
 * healthy or broken it was — and the report said nothing about the gap.
 * Naming the span is what lets a reader see it.
 *
 * ## The three probe states, which must never collapse
 *
 * The first draft of this change printed "the direct fetch did not answer" for
 * a workflow whose fetch answered perfectly well, with zero runs. Reporting a
 * clean measurement as a failed one sends the reader to debug the tool.
 */
describe("a workflow that did not run is a row, not an absence", () => {
  const files = [
    { path: ".github/workflows/docs-site.yml", name: "Docs site" },
    { path: ".github/workflows/ci-health.yml", name: "CI health watchdog" },
    { path: ".github/workflows/qa-sweep.yml", name: "QA sweep" },
  ];
  const ran = run({ name: "Docs site", path: ".github/workflows/docs-site.yml" });

  test("a file with no runs becomes a no-runs row", () => {
    const h = assess([ran], { now: NOW, knownWorkflows: files });
    expect(h.map((x) => x.workflow).sort()).toEqual(["CI health watchdog", "Docs site", "QA sweep"]);
    expect(h.filter((x) => x.noRunsInWindow).map((x) => x.workflow).sort()).toEqual([
      "CI health watchdog",
      "QA sweep",
    ]);
  });

  test("omitting the file list changes nothing — not looking must not invent rows", () => {
    // `undefined` and `[]` are different answers: the second asserts there are
    // no workflow files, the first says the caller did not look.
    expect(assess([ran], { now: NOW }).map((x) => x.workflow)).toEqual(["Docs site"]);
    expect(assess([ran], { now: NOW, knownWorkflows: [] }).map((x) => x.workflow)).toEqual([
      "Docs site",
    ]);
  });

  test("a no-runs row is never counted as green", () => {
    const out = render(assess([ran], { now: NOW, knownWorkflows: files }), { branch: "main" });
    // The tick may still appear — every workflow that RAN is green — but the
    // parenthetical count must not absorb the two that did not.
    expect(out).toContain("(1)");
    expect(out).toContain("2 other workflow file(s) produced no run");
  });

  test("scheduled is carried from the caller, and unknown stays unset", () => {
    const h = assess([ran], {
      now: NOW,
      knownWorkflows: files,
      hasSchedule: (p) => (p.endsWith("ci-health.yml") ? true : undefined),
    });
    const byName = new Map(h.map((x) => [x.workflow, x]));
    expect(byName.get("CI health watchdog")!.scheduled).toBe(true);
    // Not `false` — a predicate that could not read the file must leave the
    // row saying nothing, rather than implying "dispatch-only".
    expect(byName.get("QA sweep")!.scheduled).toBeUndefined();
  });

  test("a scheduled workflow with no runs is named, not folded into the count", () => {
    const out = render(
      assess([ran], {
        now: NOW,
        knownWorkflows: files,
        hasSchedule: (p) => p.endsWith("ci-health.yml"),
      }),
      { branch: "main" },
    );
    expect(out).toContain("**CI health watchdog**");
    expect(out).toContain("fires on a schedule");
    // ...and the tick is withheld, because a reader who sees ✓ stops reading.
    expect(out).not.toContain("✓ every workflow");
    expect(out).toContain('Not "all green"');
  });

  test("never-ran and could-not-ask are DIFFERENT findings", () => {
    const sched = { hasSchedule: () => true, knownWorkflows: files, now: NOW };
    const never = render(assess([ran], { ...sched, probed: () => "never-ran" as const }), {
      branch: "main",
    });
    const unknown = render(assess([ran], { ...sched, probed: () => "unknown" as const }), {
      branch: "main",
    });
    expect(never).toContain("never run on this branch");
    expect(never).not.toContain("request failed");
    expect(unknown).toContain("request failed");
    expect(unknown).not.toContain("never run on this branch");
    // Neither is green, which is the one thing both share.
    expect(never).not.toContain("✓ every workflow");
    expect(unknown).not.toContain("✓ every workflow");
  });
});

describe("the window is a page of runs, not a period", () => {
  test("the span is reported, so a reader can see what the report could reach", () => {
    const out = render([], {
      branch: "main",
      window: { runs: 100, from: "2026-09-20T08:14:57Z", to: "2026-09-20T14:19:14Z" },
    });
    // The real measurement from this repository, to the tenth of an hour.
    expect(out).toContain("100 recent run(s) spanning 6.1h");
  });

  test("a long window reads in days, a short one in minutes", () => {
    const w = (from: string, to: string) => describeWindow({ runs: 5, from, to });
    expect(w("2026-09-10T00:00:00Z", "2026-09-20T00:00:00Z")).toContain("10.0d");
    expect(w("2026-09-20T12:00:00Z", "2026-09-20T12:30:00Z")).toContain("30m");
  });

  test("no window is reported rather than a zero-length one", () => {
    // `0h` would read as "checked, and nothing happened". Silence is the
    // honest rendering of "nothing to measure a span against".
    const out = render([], { branch: "main" });
    expect(out).not.toContain("spanning");
  });
});

/**
 * "Never run" and "not yet run" are different answers.
 *
 * ## The finding that was not one
 *
 * The change that made `never-ran` visible immediately reported
 * `upstream-pins.yml` — scheduled, asked directly, zero runs on `main`. Every
 * word of that was true and the finding was empty: the file had been added
 * **the previous day**, and its cron is `43 9 * * 2`, a Tuesday two days out.
 * It had never run because it had never had the chance.
 *
 * That is `5rfy`'s ambiguity one level in. The report could see that nothing
 * HAD run; it could not see that nothing COULD have. A workflow neutered for
 * months and one added yesterday rendered identically — and the second is far
 * more common, so the finding would have been noise from its first day.
 *
 * ## Why an approximate cron reading is the right one
 *
 * `cronPeriodDays` answers one yes/no: has the schedule come round since the
 * file appeared? The LONGEST gap suffices for that, and every shape it cannot
 * read returns `undefined`, which leaves the row a finding. Not knowing must
 * never explain a silent workflow away.
 */
describe("a workflow too new to have fired is not a finding", () => {
  const NOW2 = new Date("2026-09-20T12:00:00Z");
  const files = [
    { path: ".github/workflows/docs-site.yml", name: "Docs site" },
    { path: ".github/workflows/upstream-pins.yml", name: "Upstream pin watchdog" },
  ];
  const ran = run({ name: "Docs site", path: ".github/workflows/docs-site.yml" });
  const base = {
    now: NOW2,
    knownWorkflows: files,
    hasSchedule: (p: string) => p.endsWith("upstream-pins.yml"),
    probed: (p: string) => (p.endsWith("upstream-pins.yml") ? ("never-ran" as const) : undefined),
  };

  test("the real case: added yesterday, fires Tuesdays — not yet run", () => {
    const h = assess([ran], {
      ...base,
      workflowAddedAt: () => "2026-09-19T08:37:20Z",
      cronOf: () => "43 9 * * 2",
    });
    const row = h.find((x) => x.workflow === "Upstream pin watchdog")!;
    expect(row.tooYoung).toBe(true);
    expect(row.fileAgeDays).toBe(1);
  });

  test("...and the report says so instead of raising it", () => {
    const out = render(
      assess([ran], {
        ...base,
        workflowAddedAt: () => "2026-09-19T08:37:20Z",
        cronOf: () => "43 9 * * 2",
      }),
      { branch: "main" },
    );
    expect(out).toContain("its schedule has not come round");
    expect(out).not.toContain("never run on this branch");
    // And it does not withhold the tick — there is no finding to stop on.
    expect(out).toContain("✓ every workflow");
  });

  test("an OLD workflow that has never run is still a finding", () => {
    // The other direction of the ratchet. Two months old, fires weekly: the
    // schedule has come round eight times and nothing happened.
    const out = render(
      assess([ran], {
        ...base,
        workflowAddedAt: () => "2026-07-20T08:00:00Z",
        cronOf: () => "43 9 * * 2",
      }),
      { branch: "main" },
    );
    expect(out).toContain("never run on this branch");
    expect(out).not.toContain("has not come round");
    expect(out).not.toContain("✓ every workflow");
  });

  test("an unreadable age or cron leaves it a finding — never explained away", () => {
    for (const extra of [
      { workflowAddedAt: () => undefined, cronOf: () => "43 9 * * 2" },
      { workflowAddedAt: () => "2026-09-19T08:37:20Z", cronOf: () => undefined },
      // A shape cronPeriodDays refuses: both day fields restricted.
      { workflowAddedAt: () => "2026-09-19T08:37:20Z", cronOf: () => "30 2 1 * 3" },
    ]) {
      const out = render(assess([ran], { ...base, ...extra }), { branch: "main" });
      expect(out).toContain("never run on this branch");
    }
  });
});

describe("cronPeriodDays — the longest gap, or nothing", () => {
  test("the two real schedules in this repo", () => {
    expect(cronPeriodDays("43 9 * * 2")).toBe(7); // upstream-pins, Tuesdays
    expect(cronPeriodDays("17 9 * * 1")).toBe(7); // ci-health, Mondays
    expect(cronPeriodDays("41 6 * * *")).toBe(1); // health-check, daily
  });

  test("sub-daily is capped at a day — nothing is ever too young by more", () => {
    expect(cronPeriodDays("0 */4 * * *")).toBe(1);
    expect(cronPeriodDays("* * * * *")).toBe(1);
  });

  test("a day-of-month schedule is a month at worst", () => {
    expect(cronPeriodDays("0 3 1 * *")).toBe(31);
  });

  test("what it refuses, and refusing is the point", () => {
    // Both day fields restricted: GitHub ORs them, so this can fire often or
    // almost never. A guess here would be indistinguishable from a
    // measurement, and the caller treats undefined as "still a finding".
    expect(cronPeriodDays("30 2 1 * 3")).toBeUndefined();
    expect(cronPeriodDays("not a cron")).toBeUndefined();
    expect(cronPeriodDays("0 3 * *")).toBeUndefined(); // four fields
  });
});
