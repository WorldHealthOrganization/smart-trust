/**
 * The Pages build outcome — bean `3yi4`.
 *
 * `bm6d` measured **6 of the last 10 `pages build and deployment` runs
 * cancelled**, in an exact repeating pattern, and nothing in this repository
 * said so. Three properties hid it at once: those runs are on `gh-pages`
 * rather than the default branch, they are raised by `github-pages[bot]` on
 * the `dynamic` event rather than by a file in `.github/workflows/`, and
 * `check-ci-health.ts` asks `?branch=<default>`. The reader was never missing;
 * the QUESTION was too narrow.
 *
 * ## Why these are pure reducers with no store behind them
 *
 * The owner's correction, 2026-09-20: *"they are not. changes status of repo.
 * tools need to look external."* A Pages deployment is a fact an external
 * service holds. Writing it into the repository would rebuild `xom7` in a new
 * place — a committed answer that is right when written and silently wrong
 * afterwards. So the caller asks the API every time and these functions only
 * reduce what it got back.
 *
 * ## What is pinned
 *
 * That `cancelled` survives as a THIRD state (it is neither "shipped" nor
 * "broken"), and that a cancellation this repository caused itself is
 * distinguishable from one caused by a sibling session. Merging either
 * distinction gives a number that cannot answer the question the report is
 * for: *did the preview actually build?*
 *
 * @module cat-harness/scripts/tests/pages-health.test
 */
import { describe, expect, test } from "bun:test";

import {
  PAGES_WORKFLOW,
  pagesHealth,
  renderPages,
  selfSupersedes,
  slugOfDeployCommit,
  type DeployCommit,
  type PagesReport,
  type RunSummary,
} from "../../../src/workflow/ci-health";

const pages = (over: Partial<RunSummary> = {}): RunSummary => ({
  name: "pages build and deployment",
  status: "completed",
  conclusion: "success",
  created_at: "2026-09-20T12:00:00Z",
  ...over,
});

describe("pagesHealth — cancelled is a third state", () => {
  test("a cancelled deployment is neither success nor failure", () => {
    // The whole reason this function exists. Folded into success, the report
    // says the preview shipped while it is stale; folded into failure, it
    // sends somebody to fix a build that was merely superseded.
    const h = pagesHealth([pages({ conclusion: "cancelled" })]);
    expect(h.cancelled).toBe(1);
    expect(h.success).toBe(0);
    expect(h.failure).toBe(0);
    expect(h.unsettled).toBe(0);
  });

  test("the four settled states and the unsettled one partition the runs", () => {
    // `bm6d`'s measured shape: mostly cancelled, some green, one real red.
    const runs = [
      pages({ conclusion: "cancelled" }),
      pages({ conclusion: "cancelled" }),
      pages({ conclusion: "success" }),
      pages({ conclusion: "failure" }),
      pages({ status: "in_progress", conclusion: null as unknown as string }),
      pages({ conclusion: "skipped" }),
    ];
    const h = pagesHealth(runs);
    expect(h.total).toBe(6);
    expect(h.cancelled).toBe(2);
    expect(h.success).toBe(1);
    expect(h.failure).toBe(1);
    expect(h.unsettled).toBe(2); // in-flight + skipped
    expect(h.success + h.cancelled + h.failure + h.unsettled).toBe(h.total);
  });

  test("only the Pages workflow is counted", () => {
    // The runs arrive on a shared page with every other workflow. Counting a
    // red `docs-site` as a failed DEPLOYMENT would report the site as not
    // publishing when it published fine.
    const h = pagesHealth([
      pages(),
      { ...pages(), name: "Docs site", conclusion: "failure" },
      { ...pages(), name: "CI health", conclusion: "failure" },
    ]);
    expect(h.total).toBe(1);
    expect(h.failure).toBe(0);
  });

  test("the workflow name is matched case-insensitively", () => {
    // GitHub renders it lowercase in the UI and has spelled it with capitals
    // in the API. A case-sensitive match reports `total: 0` — which is
    // "no deployments at all", a far stronger and quite false claim.
    expect(pagesHealth([pages({ name: "Pages build and deployment" })]).total).toBe(1);
    expect(PAGES_WORKFLOW).toBe(PAGES_WORKFLOW.toLowerCase());
  });

  test("no Pages runs is total 0 with no latest — never a green", () => {
    // A caller that reads `failure === 0` as healthy gets the `xom7` misread.
    // `total` is the denominator that makes zero readable.
    const h = pagesHealth([{ ...pages(), name: "Docs site" }]);
    expect(h.total).toBe(0);
    expect(h.latest).toBeUndefined();
  });

  test("latest is the newest Pages run, not the newest run", () => {
    // The API returns newest-first across all workflows, so the first element
    // is usually somebody else's.
    const newest = { ...pages(), name: "Docs site" };
    const mine = pages({ conclusion: "cancelled", created_at: "2026-09-20T11:00:00Z" });
    const h = pagesHealth([newest, mine, pages({ created_at: "2026-09-20T09:00:00Z" })]);
    expect(h.latest?.created_at).toBe("2026-09-20T11:00:00Z");
    expect(h.latest?.conclusion).toBe("cancelled");
  });
});

describe("slugOfDeployCommit — which preview a publish-branch commit is about", () => {
  test("the payload commit names its slug", () => {
    expect(slugOfDeployCommit("staging(claude-eroyaz): from abc123")).toBe("claude-eroyaz");
  });

  test("the render-log commit names its slug", () => {
    // The second writer, from BEFORE `bm6d` coalesced the pair. Detecting the
    // old shape is the point: this is how the report shows the fix held.
    expect(slugOfDeployCommit("render-log: rendered STAGING/claude-eroyaz")).toBe("claude-eroyaz");
  });

  test("a commit about nothing staged is undefined, not a guess", () => {
    expect(slugOfDeployCommit("deploy: main site")).toBeUndefined();
    expect(slugOfDeployCommit("")).toBeUndefined();
  });

  test("the slug is read from a line start, so a quoted message does not match", () => {
    // `^` with `m`, not a bare `indexOf`. A commit quoting an earlier one in
    // its body — which `bm6d`'s own merge commits do — would otherwise be
    // counted as a deploy of that slug.
    expect(slugOfDeployCommit("Merge PR: reverts staging(other): from x")).toBeUndefined();
  });

  test("the coalesced commit resolves to its one slug", () => {
    // `bm6d`'s output carries both spellings in one message — the subject and
    // a trailer — from ONE shell variable, so they cannot disagree and the
    // branch order decides nothing here. That is worth saying because the
    // first version of this test claimed the opposite ("the subject wins")
    // and a mutation reordering the branches SURVIVED it. The rationale was
    // wrong, not the test set; the real ordering property is the next test.
    const msg = "staging(eroyaz): from abc\n\nrender-log: rendered STAGING/eroyaz\n";
    expect(slugOfDeployCommit(msg)).toBe("eroyaz");
  });

  test("a cleanup commit names the slug it REMOVED, not the word `cleanup`", () => {
    // The defect the surviving mutation led to. `feature-staging.yml` writes
    // `staging(cleanup): remove branches/<slug>` on a closed PR — `cleanup` is
    // the operation and the slug is in the path. Read subject-first, every
    // removal in the repository became one branch called `cleanup`, and two
    // removals for two unrelated PRs then looked like this repository
    // contending with itself.
    expect(slugOfDeployCommit("staging(cleanup): remove STAGING/eroyaz (PR #123 closed)")).toBe(
      "eroyaz",
    );
    expect(slugOfDeployCommit("staging(cleanup): remove STAGING/other (dispatched)")).toBe("other");
  });

  test("two removals for two PRs are two slugs, not one", () => {
    // The consequence, stated as the property rather than the spelling.
    const a = slugOfDeployCommit("staging(cleanup): remove STAGING/aaa (PR #1 closed)");
    const b = slugOfDeployCommit("staging(cleanup): remove STAGING/bbb (PR #2 closed)");
    expect(a).not.toBe(b);
  });

  test("a branch genuinely named `cleanup` still resolves", () => {
    // The cost of the fix, checked rather than assumed. A deploy commit for
    // such a branch carries no `remove branches/`, so the fallback reaches it.
    expect(slugOfDeployCommit("staging(cleanup): from abc123")).toBe("cleanup");
  });

  test("the retained-preview commit names its slug", () => {
    // A third writer: the cleanup job REFUSING a removal still pushes a
    // render-log commit, which still cancels a Pages build.
    expect(slugOfDeployCommit("render-log: retained STAGING/eroyaz")).toBe("eroyaz");
  });
});

describe("selfSupersedes — this repo's own contention, not a sibling's", () => {
  const c = (sha: string, message: string, date: string): DeployCommit => ({ sha, message, date });

  test("two commits for one slug seconds apart are one deploy writing twice", () => {
    // The `bm6d` signature exactly: payload, then render-log, ~10s later, and
    // the second cancels the first's Pages build.
    const found = selfSupersedes([
      c("bbb", "render-log: rendered STAGING/eroyaz", "2026-09-20T12:00:10Z"),
      c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ slug: "eroyaz", by: "bbb", superseded: "aaa", secondsApart: 10 });
  });

  test("different slugs are TWO SESSIONS and are not counted", () => {
    // This is the distinction `3yi4` asks for. Cross-session contention is
    // `yzsj`'s ground and a different fix; counting it here would make `bm6d`
    // look unfixed however well it worked.
    expect(
      selfSupersedes([
        c("bbb", "staging(other): from def", "2026-09-20T12:00:10Z"),
        c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
      ]),
    ).toHaveLength(0);
  });

  test("the same slug redeployed much later is a new deploy, not a self-supersede", () => {
    // An hour apart is a second push, whose cancellation of a finished build
    // is nothing. Without the window every re-run of a branch would be a
    // finding, and a finding that always fires is not read.
    expect(
      selfSupersedes([
        c("bbb", "staging(eroyaz): from def", "2026-09-20T13:00:00Z"),
        c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
      ]),
    ).toHaveLength(0);
  });

  test("the window is a parameter, and its boundary is inclusive", () => {
    const pair = [
      c("bbb", "staging(eroyaz): from def", "2026-09-20T12:02:00Z"),
      c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
    ];
    expect(selfSupersedes(pair, 120)).toHaveLength(1);
    expect(selfSupersedes(pair, 119)).toHaveLength(0);
  });

  test("commits handed over OLDEST-first are refused rather than reported", () => {
    // A negative gap means the caller's ordering is not the one documented.
    // Reporting the pair anyway would name the wrong commit as the canceller
    // — an answer that looks precise and points at the wrong thing.
    expect(
      selfSupersedes([
        c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
        c("bbb", "render-log: rendered STAGING/eroyaz", "2026-09-20T12:00:10Z"),
      ]),
    ).toHaveLength(0);
  });

  test("an unparseable date is not a zero-second gap", () => {
    // `Date.parse` gives NaN, and `NaN > withinSeconds` is false — so without
    // the explicit finite check this would report a pair with
    // `secondsApart: NaN`, which renders as a real finding.
    expect(
      selfSupersedes([
        c("bbb", "staging(eroyaz): from def", "not a date"),
        c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
      ]),
    ).toHaveLength(0);
  });

  test("a run of three finds both adjacent pairs", () => {
    const found = selfSupersedes([
      c("ccc", "render-log: rendered STAGING/eroyaz", "2026-09-20T12:00:20Z"),
      c("bbb", "staging(eroyaz): from def", "2026-09-20T12:00:10Z"),
      c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
    ]);
    expect(found.map((f) => f.by)).toEqual(["ccc", "bbb"]);
  });

  test("a commit that is not a deploy breaks the chain rather than bridging it", () => {
    // Only ADJACENT commits are paired. A merge landing between two staging
    // pushes means the second did not cancel the first's build — something
    // else did, and this must not claim otherwise.
    expect(
      selfSupersedes([
        c("ccc", "staging(eroyaz): from ghi", "2026-09-20T12:00:20Z"),
        c("bbb", "Merge branch 'main'", "2026-09-20T12:00:10Z"),
        c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z"),
      ]),
    ).toHaveLength(0);
  });

  test("two commits that are not deploys are never paired with each other", () => {
    // Both slugs undefined. Without the `!a` guard, `undefined !== undefined`
    // is false and the pair is reported — a finding whose slug renders as
    // `undefined`, from two main-site commits that have nothing to do with a
    // preview. The guard is what keeps "could not tell which slug" from
    // becoming "these two are the same slug".
    expect(
      selfSupersedes([
        c("bbb", "Merge branch 'main'", "2026-09-20T12:00:10Z"),
        c("aaa", "deploy: main site", "2026-09-20T12:00:00Z"),
      ]),
    ).toHaveLength(0);
  });

  test("an empty or single-commit history finds nothing", () => {
    expect(selfSupersedes([])).toHaveLength(0);
    expect(selfSupersedes([c("aaa", "staging(eroyaz): from abc", "2026-09-20T12:00:00Z")])).toHaveLength(0);
  });
});

describe("renderPages — what it refuses to say", () => {
  const ok = (over: Partial<PagesReport> = {}): PagesReport => ({
    health: { total: 10, success: 10, cancelled: 0, failure: 0, unsettled: 0 },
    publishBranch: "gh-pages",
    supersedes: [],
    ...over,
  });

  test("an unreachable API is never rendered as green", () => {
    // The `xom7` rule, one level up. A section that goes quiet when it cannot
    // see reads as reassurance.
    const out = renderPages({ unreachable: "GitHub API returned 403" });
    expect(out).toContain("treat as unknown, not as green");
    expect(out).toContain("403");
    expect(out).not.toMatch(/✓/);
  });

  test("zero deployments is unjudged, not clean", () => {
    // A repository that publishes nothing and one whose deployments went
    // unseen are indistinguishable from here, so it says the weaker thing.
    const out = renderPages(ok({ health: { total: 0, success: 0, cancelled: 0, failure: 0, unsettled: 0 } }));
    expect(out).toContain("Unjudged, not green");
    expect(out).not.toMatch(/✓ \*\*0\*\* succeeded/);
  });

  test("it states the cancelled count and grades no share", () => {
    // Measured 2026-09-20: 51 of 100 cancelled. That is bad and nothing here
    // says how bad, because no basis for a threshold exists — the argument
    // that stopped `6xaz` inventing one. No percentage, no verdict word.
    const out = renderPages(
      ok({ health: { total: 100, success: 49, cancelled: 51, failure: 0, unsettled: 0 } }),
    );
    expect(out).toContain("**51** cancelled");
    expect(out).not.toMatch(/\d+%/);
    expect(out).not.toMatch(/\bunhealthy\b|\bRED\b|\btoo many\b/);
  });

  test("but a floor IS graded: deployments happened and none succeeded", () => {
    // Answerable without calibration, exactly as `-z` on `ls -A` is in `oisv`.
    const out = renderPages(
      ok({ health: { total: 8, success: 0, cancelled: 8, failure: 0, unsettled: 0 } }),
    );
    expect(out).toContain("Not one of 8 deployments succeeded");
  });

  test("...and that floor does not fire when something got through", () => {
    const out = renderPages(
      ok({ health: { total: 8, success: 1, cancelled: 7, failure: 0, unsettled: 0 } }),
    );
    expect(out).not.toContain("Not one of");
  });

  test("unreadable commits leave the counts standing and say what is missing", () => {
    // The two questions fail separately. Dropping the whole section because
    // the SPLIT could not be computed would hide counts that were read fine.
    const out = renderPages(
      ok({
        health: { total: 10, success: 4, cancelled: 6, failure: 0, unsettled: 0 },
        commitsUnreachable: "GitHub API returned 409 for commits",
        supersedes: undefined,
      }),
    );
    expect(out).toContain("**6** cancelled");
    expect(out).toContain("uncategorised — not absent");
    expect(out).not.toContain("self-inflicted");
  });

  test("self-inflicted cancellations are named by slug, not merged into a count", () => {
    // `bm6d` (one workflow pushing twice, fixed) and `yzsj` (sessions racing
    // for the ref, not fixed) are different repairs. A merged count cannot
    // show whether the first held; a named slug says which branch is still
    // running the old workflow.
    const out = renderPages(
      ok({
        health: { total: 10, success: 4, cancelled: 6, failure: 0, unsettled: 0 },
        supersedes: [
          { slug: "aaa", by: "1", superseded: "0", secondsApart: 9 },
          { slug: "aaa", by: "3", superseded: "2", secondsApart: 9 },
          { slug: "bbb", by: "5", superseded: "4", secondsApart: 10 },
        ],
      }),
    );
    expect(out).toContain("**3** cancellation(s) were self-inflicted");
    expect(out).toContain("`aaa` — 2");
    expect(out).toContain("`bbb` — 1");
    expect(out).toContain("yzsj"); // the rest are pointed somewhere, not dropped
  });

  // ── A cited bean's STATUS is read, never asserted (bean `xfyk`) ──────────
  //
  // This renderer used to state it outright — "which is a different fix and
  // is not done" about `yzsj` — and the clause went stale the moment `yzsj`
  // closed on 2026-09-21, sending the next reader to a finished 200-line
  // bean. The comment beside it records fixing the POINTER (`6pfo` ->
  // `yzsj`) and names the class: a reference inside printed output that
  // resolves to the wrong thing. The pointer was fixed; the claim attached
  // to it was hardcoded, so it drifted instead.
  //
  // Each test below pins one branch, and the point of each is a DIFFERENT
  // honesty: a closed bean must not read as open, an unreadable store must
  // not read as either, and a missing bean must be called out rather than
  // silently rendered as fine.

  const raced = {
    health: { total: 10, success: 4, cancelled: 6, failure: 0, unsettled: 0 },
    supersedes: [{ slug: "aaa", by: "1", superseded: "0", secondsApart: 9 }],
  };

  test("a SETTLED bean does not read as open — the `xfyk` defect itself", () => {
    const out = renderPages(ok({ ...raced, citedBeans: { yzsj: { state: "read", status: "completed" } } }));
    expect(out).toContain("`yzsj`, now `completed`");
    expect(out).not.toContain("is not done");
    // And it must say what that means for the reader, not just the status:
    // cancellations past a shipped fix are new ground, not its residue.
    expect(out).toContain("NEW ground");
  });

  test("`scrapped` counts as settled too — abandoned is not open", () => {
    const out = renderPages(ok({ ...raced, citedBeans: { yzsj: { state: "read", status: "scrapped" } } }));
    expect(out).toContain("now `scrapped`");
    expect(out).toContain("NEW ground");
  });

  test("an OPEN bean still reads as work outstanding", () => {
    // The original sentence was not wrong when written — it was wrong later.
    // This branch keeps it correct for as long as it IS correct.
    const out = renderPages(ok({ ...raced, citedBeans: { yzsj: { state: "read", status: "in-progress" } } }));
    expect(out).toContain("is `in-progress`");
    expect(out).toContain("a different fix");
    expect(out).not.toContain("NEW ground");
  });

  test("an unreadable work plan is UNKNOWN — not open, not done", () => {
    // The house rule. An unknown rendered as either answer is worse than the
    // question, and this is the branch a fresh container actually takes.
    const out = renderPages(
      ok({ ...raced, citedBeans: { yzsj: { state: "unreadable", why: "no bean store in this instance" } } }),
    );
    expect(out).toContain("could not read the work plan");
    expect(out).toContain("no bean store in this instance");
    expect(out).toContain("not assumed either way");
    expect(out).not.toContain("is not done");
    expect(out).not.toContain("NEW ground");
  });

  test("NOBODY LOOKED renders the same as unreadable, not as a status", () => {
    // `citedBeans` absent entirely — the shape every existing caller had
    // before this change, and the one a new caller gets by forgetting.
    const out = renderPages(ok(raced));
    expect(out).toContain("could not read the work plan");
    expect(out).not.toContain("is not done");
  });

  test("a citation resolving to NOTHING says so — beans are never deleted", () => {
    const out = renderPages(ok({ ...raced, citedBeans: { yzsj: { state: "absent" } } }));
    expect(out).toContain("no such bean");
    expect(out).toContain("renamed or mistyped");
  });

  test("the clause wraps, because the watchdog commits this as markdown", () => {
    // One long line reads fine in a terminal and raggedly in the committed
    // report, which is the surface people actually read.
    const out = renderPages(ok({ ...raced, citedBeans: { yzsj: { state: "read", status: "completed" } } }));
    const long = out.split("\n").filter((l) => l.length > 90);
    expect(long).toEqual([]);
  });

  test("no self-supersede says so rather than going quiet", () => {
    // Silence would read as "not checked". This is the measurement that shows
    // `bm6d`'s fix holding, so it has to be stated when it is clean.
    const out = renderPages(ok({ health: { total: 10, success: 4, cancelled: 6, failure: 0, unsettled: 0 } }));
    expect(out).toContain("No deployment superseded its own slug");
    expect(out).toContain("bm6d");
  });

  test("every state in the breakdown is printed, including the empty ones", () => {
    // Four survivors in one mutation pass: dropping the success, failure or
    // unsettled line changed nothing any test could see. That is the third-
    // state discipline failing inside the function written for it — a real
    // Pages FAILURE could vanish from the report and only the two states the
    // author happened to care about would remain.
    //
    // Printed even at zero, on purpose. `✗ 0 failed` is a measurement; a
    // missing line is an absence the reader fills in themselves.
    const out = renderPages(
      ok({ health: { total: 4, success: 1, cancelled: 1, failure: 1, unsettled: 1 } }),
    );
    for (const line of ["**1** succeeded", "**1** cancelled", "**1** failed", "**1** not settled"]) {
      expect(out).toContain(line);
    }
    const zeros = renderPages(
      ok({ health: { total: 2, success: 2, cancelled: 0, failure: 0, unsettled: 0 } }),
    );
    for (const line of ["**0** cancelled", "**0** failed", "**0** not settled"]) {
      expect(zeros).toContain(line);
    }
  });

  test("the section says the number is not cached", () => {
    // The owner's correction, 2026-09-20: *"they are not. changes status of
    // repo. tools need to look external."* A reader who believes this figure
    // is repository state will trust a stale one — which is `xom7` with extra
    // steps. Pinned as a claim rather than as wording: the substance is that
    // it was asked externally and stored nowhere.
    const out = renderPages(ok());
    expect(out).toMatch(/not repository state/);
    expect(out).toMatch(/cached nowhere/);
  });

  test("the publish branch is reported, never assumed", () => {
    // `/repos/{slug}/pages` answers 403 without admin (checked 2026-09-20),
    // so the branch is read off the runs. A repo publishing from `main` must
    // say `main`, or the reader checks the wrong ref.
    expect(renderPages(ok({ publishBranch: "main" }))).toContain("`main`");
    expect(renderPages(ok({ publishBranch: "main" }))).not.toContain("gh-pages");
  });

  test("the window is stated, because a page of runs is not a period", () => {
    // Same rule the CI section already follows: 100 deployments spanned 2.6h
    // here. A reader given only a count reads it as a verdict on the repo.
    const out = renderPages(
      ok({ window: { runs: 100, from: "2026-09-20T14:50:58Z", to: "2026-09-20T17:29:03Z" } }),
    );
    expect(out).toMatch(/Window:.*100 recent run/);
  });
});

describe("coalescing or starvation — bean `thsz`", () => {
  // The counts alone are ambiguous by a factor that matters. GitHub Pages runs
  // ONE deployment per repository, so every push to the publish ref cancels the
  // build in flight and the survivor publishes everything on the ref: during a
  // busy hour most builds are cancelled BY DESIGN. The same share, when nothing
  // is getting through, means the site is frozen.
  //
  // This section was measured leading its own author wrong: 78 cancelled
  // against 21 succeeded read as a ten-hour outage, and the newest run before
  // the quiet period had SUCCEEDED. The gap was nobody pushing.
  const ok = (over: Partial<PagesReport> = {}): PagesReport => ({
    health: { total: 10, success: 2, cancelled: 8, failure: 0, unsettled: 0 },
    publishBranch: "gh-pages",
    supersedes: [],
    ...over,
  });

  test("newestSettled skips a run still in flight", () => {
    // `latest` is `pages[0]`, which is routinely unsettled — it was in the run
    // that produced this bean. Reading the newest outcome off it would answer
    // "in progress" to a question that has an answer one row down.
    const h = pagesHealth([
      pages({ status: "in_progress", conclusion: null as unknown as string }),
      pages({ conclusion: "cancelled", created_at: "2026-09-25T16:29:05Z" }),
      pages({ conclusion: "success", created_at: "2026-09-25T16:10:26Z" }),
    ]);
    expect(h.latest?.status).toBe("in_progress");
    expect(h.newestSettled?.conclusion).toBe("cancelled");
    expect(h.lastSuccessAt).toBe("2026-09-25T16:10:26Z");
  });

  test("an unsettled run is never the last success, even if it claims one", () => {
    // A surviving mutation found this untested: dropping the `completed` guard
    // from `lastSuccessAt` changed nothing any test could see.
    //
    // The guard is not dead code, it is this module's standing rule — the
    // tallies check `status !== "completed"` FIRST, so a conclusion on a run
    // that has not settled is not a verdict. Applying that rule here and
    // nowhere else would let a half-reported run set the "site is as of" time,
    // which is the one number in the section a reader acts on.
    const h = pagesHealth([
      pages({ status: "in_progress", conclusion: "success", created_at: "2026-09-25T17:00:00Z" }),
      pages({ conclusion: "success", created_at: "2026-09-25T16:10:26Z" }),
    ]);
    expect(h.lastSuccessAt).toBe("2026-09-25T16:10:26Z");
    expect(h.success).toBe(1); // the in-flight one is unsettled, not a success
    expect(h.unsettled).toBe(1);
  });

  test("a newest-settled SUCCESS says the share was coalescing", () => {
    // The case that nearly produced a false outage report. Eight cancellations
    // behind a green newest run are superseded builds whose content shipped in
    // the survivor.
    const out = renderPages(
      ok({
        health: {
          total: 10, success: 2, cancelled: 8, failure: 0, unsettled: 0,
          newestSettled: { name: PAGES_WORKFLOW, status: "completed", conclusion: "success", created_at: "2026-09-25T04:57:05Z" },
          lastSuccessAt: "2026-09-25T04:57:05Z",
        },
      }),
    );
    expect(out).toContain("newest deployment to settle SUCCEEDED");
    expect(out).toContain("coalescing, not failure");
    expect(out).not.toContain("starvation rather than");
  });

  test("a newest-settled CANCELLATION names starvation and how far behind", () => {
    const out = renderPages(
      ok({
        health: {
          total: 10, success: 2, cancelled: 8, failure: 0, unsettled: 0,
          newestSettled: { name: PAGES_WORKFLOW, status: "completed", conclusion: "cancelled", created_at: "2026-09-25T16:29:05Z" },
          lastSuccessAt: "2026-09-25T16:10:26Z",
        },
      }),
    );
    expect(out).toContain("did NOT succeed");
    expect(out).toContain("starvation");
    // How far behind, so the reader can judge without another query.
    expect(out).toContain("2026-09-25T16:10:26Z");
  });

  test("...and when nothing ever succeeded it says so rather than naming a time", () => {
    // `lastSuccessAt` undefined is not "as of undefined". The stronger claim is
    // available and is the one a reader needs.
    const out = renderPages(
      ok({
        health: {
          total: 10, success: 0, cancelled: 10, failure: 0, unsettled: 0,
          newestSettled: { name: PAGES_WORKFLOW, status: "completed", conclusion: "cancelled", created_at: "2026-09-25T16:29:05Z" },
        },
      }),
    );
    expect(out).toContain("no deployment in this window succeeded at all");
    expect(out).not.toMatch(/site is as of undefined/);
  });

  test("nothing settled yet is its own answer, not a verdict either way", () => {
    // Deployments happened and none has concluded. Reading the share against
    // no outcome is what this whole section exists to stop.
    const out = renderPages(
      ok({ health: { total: 3, success: 0, cancelled: 0, failure: 0, unsettled: 3 } }),
    );
    expect(out).toContain("has settled yet");
    expect(out).toContain("not a verdict");
    expect(out).not.toContain("SUCCEEDED");
  });

  test("it still grades no share and invents no staleness cutoff", () => {
    // The `6xaz` refusal is not relaxed by any of the above. The new sentence
    // is a FLOOR — did the newest settle green — which needs no calibration.
    const out = renderPages(
      ok({
        health: {
          total: 100, success: 21, cancelled: 78, failure: 0, unsettled: 1,
          newestSettled: { name: PAGES_WORKFLOW, status: "completed", conclusion: "cancelled", created_at: "2026-09-25T16:29:05Z" },
          lastSuccessAt: "2026-09-25T16:10:26Z",
        },
      }),
    );
    expect(out).not.toMatch(/\d+%/);
    expect(out).not.toMatch(/more than \d+ (minutes|hours)|stale for \d+/);
  });
});
