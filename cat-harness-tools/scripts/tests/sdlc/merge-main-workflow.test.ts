/**
 * `merge-main.yml` must be able to fire on the PRs it exists for — bean `d33q`.
 *
 * Measured 2026-10-02: labelling 4 CONFLICTED PRs started 0 runs. The label
 * trigger was `pull_request`, and GitHub runs no `pull_request` workflow for a
 * PR without a merge ref — which is every conflicted one. The fix moved it to
 * `pull_request_target`, which carries a write token; so the same-repository
 * guard that makes that safe is pinned here too, together with its position
 * (before the checkout, in the job that checks out).
 *
 * The tests that read the workflow itself live in the index repository's
 * `test/workflows/merge-main-workflow.test.ts` (owner's ruling 2026-10-09,
 * litlfred/folio-assistant#2521, ruling 1(c)): standing alone, cat-harness
 * has no `.github/workflows/`. What stays here is the composer's own
 * behaviour — `merge-main-comment.ts`, which that workflow runs.
 */
import { describe, expect, test } from "bun:test";

import {
  aggregateVerdicts,
  classifyVerdict,
  composeComment,
  parseLog,
  salientLines,
  signatureIn,
  type CommentInput,
  type Verdict,
  type VerdictInput,
} from "../../merge-main-comment.ts";

/** A finished, non-cancelled run with nothing to report; each test sets what it is about. */
const BASE: CommentInput = {
  jobStatus: "success", status: "1", merged: "false", pushed: "no", blocked: "", rejected: "",
  sha: "", log: "", headSha: "1111111111111111111111111111111111111111",
  marker: "<!-- merge-main-bot -->", runUrl: "https://example.invalid/run",
  mainFailing: () => "",
};

/** A member that failed with a brand-new signature; each test sets what it is about. */
const MEMBER: VerdictInput = {
  pr: "1801", jobStatus: "failure", headCheck: "success", mergeOutcome: "success",
  pushOutcome: "skipped", status: "1", refused: "", merged: "false", pushed: "no",
  blocked: "", rejected: "", signature: "abc123abc123abc1", previous: "",
};

const verdictOf = (i: Partial<VerdictInput>): Verdict => classifyVerdict({ ...MEMBER, ...i });
const signatureOfPlan = (i: Partial<CommentInput>): string => {
  const p = composeComment({ ...BASE, ...i });
  if (p.action !== "write") throw new Error("expected a comment");
  return p.signature;
};

describe("a push refusal is read from stderr, not guessed", () => {
  // Measured 2026-10-02 on #1790: GitHub refused because the merge commit
  // changed a workflow file and GITHUB_TOKEN has no `workflows` permission —
  // and the comment said "the branch moved", which was false.

  test("(b) the workflows refusal names the credentials design, and labels nothing", () => {
    const p = composeComment({ ...BASE, merged: "true", blocked: "workflows" });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("#1829");
    expect(p.body).not.toContain("branch moved");
  });

  test("(c) 'the branch moved' is said only when the push step said so", () => {
    const moved = composeComment({ ...BASE, merged: "true", rejected: "true" });
    const other = composeComment({ ...BASE, merged: "true" });
    expect(moved.action === "write" && moved.body).toContain("the branch moved during the run");
    expect(other.action === "write" && other.body).not.toContain("the branch moved");
  });
});

describe("a cancelled or unfinished run is not an error (#1854)", () => {
  // Measured 2026-10-02 on #1777 (run 36986362911): a newer push to main
  // cancelled the job mid-merge, the always() comment step ran with an empty
  // STATUS, and the comment became "**Error** (exit ) — merge-base failed …".

  test("empty status: the comment is left alone, and no error text is composed", () => {
    const p = composeComment({ ...BASE, status: "" });
    expect(p.action).toBe("leave");
    expect(JSON.stringify(p)).not.toContain("**Error**");
  });

  test("cancelled: superseded, the comment is left alone — even when a status was written", () => {
    for (const status of ["", "1"]) {
      const p = composeComment({ ...BASE, jobStatus: "cancelled", status });
      expect(p.action).toBe("leave");
      if (p.action === "leave") expect(p.reason).toContain("superseded");
    }
  });

  test("a real non-zero status with no refusal or unrepaired check is still the Error text", () => {
    const p = composeComment({ ...BASE, status: "2" });
    expect(p.action).toBe("write");
    if (p.action === "write") {
      expect(p.body).toContain("**Error** (exit 2) — merge-base failed for a reason that is neither a refusal nor an unrepaired check");
      expect(p.body.startsWith("<!-- merge-main-bot -->\n")).toBe(true);
    }
  });

  test("the other outcomes keep their texts", () => {
    const log = [
      "  ✓ cat-harness/docs/en/folio-assistant-core/glossary/index.md  [glossary: take-base]",
      "  ✓ cat-harness/docs/cat-harness/lsi/x.md  [glossary: take-base]",
      "  ✓ a.qa-results.json  [qa-results: take-base]",
      "  ✗ beans/defs/x.md  [beans: refuse] — authored",
    ].join("\n");
    expect(parseLog(log).resolved).toBe("- `glossary`: 2\n- `qa-results`: 1");
    const refused = composeComment({ ...BASE, log });
    expect(refused.action).toBe("write");
    expect(refused.action === "write" && refused.body).toContain("**Refused — nothing pushed.**");
    expect(refused.action === "write" && refused.body).toContain("Refused:\n- beans/defs/x.md  [beans: refuse] — authored");
    const upToDate = composeComment({ ...BASE, status: "0" });
    expect(upToDate.action === "write" && upToDate.body).toContain("**Already up to date with `main`.**");
    const pushed = composeComment({ ...BASE, status: "0", merged: "true", pushed: "success", sha: "0123456789abcdef", log });
    expect(pushed.action === "write" && pushed.body).toContain("**Merged `main` and pushed `012345678`.**");
    let asked = 0;
    const unproved = composeComment({ ...BASE, log: "    ✗ check:x STILL fails", mainFailing: () => { asked++; return "TypeScript"; } });
    expect(unproved.action === "write" && unproved.body).toContain("Failing on main right now: TypeScript.");
    expect(asked).toBe(1);
  });

  test("main's CI is asked only when the outcome reports it", () => {
    let asked = 0;
    composeComment({ ...BASE, status: "0", mainFailing: () => { asked++; return ""; } });
    composeComment({ ...BASE, status: "", mainFailing: () => { asked++; return ""; } });
    expect(asked).toBe(0);
  });
});

describe("the comment carries the signature of what it reports", () => {
  test("every written comment ends with its signature, and it round-trips", () => {
    const p = composeComment({ ...BASE, status: "2" });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(signatureIn(p.body)).toBe(p.signature);
    expect(p.body).toMatch(/<!-- merge-main-signature: [0-9a-f]{16} -->$/);
    // The bot's own marker still leads, which is how the comment is found.
    expect(p.body.startsWith("<!-- merge-main-bot -->\n")).toBe(true);
  });

  test("a comment with no signature records none, rather than throwing", () => {
    expect(signatureIn("<!-- merge-main-bot -->\n**Error** (exit 1)")).toBe("");
  });

  test("the same failure twice gives the same signature — the run link does not count", () => {
    expect(signatureOfPlan({ status: "2" })).toBe(signatureOfPlan({ status: "2", runUrl: "https://example.invalid/other-run" }));
  });

  test("a push by the AUTHOR makes it new again", () => {
    expect(signatureOfPlan({ status: "2" })).not.toBe(signatureOfPlan({ status: "2", headSha: "2222222222222222222222222222222222222222" }));
  });

  test("a CHANGED CAUSE is new even when the comment's head sentence is identical", () => {
    // The generic Error branch says the same thing for every cause, which is
    // why the signature reads merge-base's own ABORTED line.
    const one = composeComment({ ...BASE, log: "\nmerge-base: ABORTED, tree restored — 3 conflict(s) need a person (✗ above)" });
    const two = composeComment({ ...BASE, log: "\nmerge-base: ABORTED, tree restored — bun install against the merged lockfile failed" });
    if (one.action !== "write" || two.action !== "write") throw new Error("expected comments");
    expect(one.body.split("\n")[1]).toBe(two.body.split("\n")[1]);
    expect(one.signature).not.toBe(two.signature);
  });

  test("main's own red does not change the signature — it flaps, and it is main's", () => {
    const log = "    ✗ check:x STILL fails";
    const one = composeComment({ ...BASE, log, mainFailing: () => "TypeScript" });
    const two = composeComment({ ...BASE, log, mainFailing: () => "TypeScript, Repository gates, e2e 2/3" });
    if (one.action !== "write" || two.action !== "write") throw new Error("expected comments");
    // The comment still SAYS what is failing on main; the signature does not
    // count it, or an unchanged PR condition would notify on every flap.
    expect(one.body).toContain("Failing on main right now: TypeScript.");
    expect(two.body).toContain("Repository gates");
    expect(one.signature).toBe(two.signature);
  });

  test("the salient lines are normalised, sorted and bounded", () => {
    const log = [
      "  ✓ x.md  [glossary: take-base]",
      "merge-base: ABORTED, tree restored — 1 conflict(s) need a person (✗ above)",
      "    ✗ check:x STILL fails",
      "resolved 0123456789abcdef in 12.5s",
    ].join("\n");
    expect(salientLines(log)).toEqual([
      "merge-base: ABORTED, tree restored — 1 conflict(s) need a person (✗ above)",
      "✗ check:x STILL fails",
    ]);
    // A sha or a duration in the line would make every run differ from every
    // other, which is the spam this exists to stop.
    expect(salientLines("fatal: could not read 0123456789abcdef after 3.5s")).toEqual(["fatal: could not read <sha> after <dur>"]);
  });
});

describe("a repeat is quiet; new, changed, systemic and undetermined are loud", () => {
  test("a failure the comment already reports on this head is quiet", () => {
    const v = verdictOf({ signature: "deadbeefdeadbeef", previous: "deadbeefdeadbeef" });
    expect(v.verdict).toBe("repeat");
    expect(v.notify).toBe(false);
  });

  test("a first failure, and a failure whose cause changed, both notify", () => {
    expect(verdictOf({ previous: "" })).toMatchObject({ verdict: "new", notify: true });
    const changed = verdictOf({ signature: "aaaaaaaaaaaaaaaa", previous: "bbbbbbbbbbbbbbbb" });
    expect(changed).toMatchObject({ verdict: "new", notify: true });
    expect(changed.reason).toContain("changed");
  });

  test("a failure with no signature is undetermined, never a repeat", () => {
    // It cannot be told from one already reported, and "could not determine" is
    // never rendered as clean.
    expect(verdictOf({ signature: "", previous: "" })).toMatchObject({ verdict: "undetermined", notify: true });
  });

  test("the expected races are quiet, each named", () => {
    expect(verdictOf({ jobStatus: "cancelled" })).toMatchObject({ verdict: "race", notify: false });
    expect(verdictOf({ headCheck: "failure" })).toMatchObject({ verdict: "race", notify: false });
    expect(verdictOf({ merged: "true", rejected: "true" })).toMatchObject({ verdict: "race", notify: false });
  });

  test("the outcomes that are not failures at all stay quiet", () => {
    expect(verdictOf({ status: "0" })).toMatchObject({ verdict: "up-to-date", notify: false });
    expect(verdictOf({ refused: "true" })).toMatchObject({ verdict: "refused", notify: false });
    expect(verdictOf({ status: "0", merged: "true", pushed: "success" })).toMatchObject({ verdict: "merged", notify: false });
    expect(verdictOf({ merged: "true", blocked: "workflows" })).toMatchObject({ verdict: "blocked", notify: false });
  });

  test("a merge step that never completed is the bot's own failure: loud", () => {
    expect(verdictOf({ mergeOutcome: "skipped" })).toMatchObject({ verdict: "undetermined", notify: true });
    expect(verdictOf({ status: "" })).toMatchObject({ verdict: "undetermined", notify: true });
  });

  test("a REFUSAL outranks the signature: it is not a bot failure in the first place", () => {
    // The owner's ruling retired `needs-merge-human`; the reason lives in the
    // comment, and a PR that needs a person must not red the bot's run either.
    expect(verdictOf({ refused: "true", previous: "" }).notify).toBe(false);
  });
});

describe("the run notifies once, or not at all", () => {
  const v = (pr: string, verdict: Verdict["verdict"], notify: boolean): Verdict =>
    ({ pr, verdict, notify, reason: "because", signature: "s", previous: "p" });

  test("fourteen successes and one repeated failure: nobody is emailed", () => {
    const verdicts = [v("1", "merged", false), v("2", "up-to-date", false), v("3", "repeat", false)];
    const out = aggregateVerdicts({ selected: ["1", "2", "3"], verdicts, selectResult: "success" });
    expect(out.loud).toBe(false);
    // Quiet is not silent: the failure is still named in the run's summary.
    expect(out.summary).toContain("#3");
    expect(out.summary).toContain("repeat");
    expect(out.summary).toContain("1 member(s) failed");
  });

  test("one new failure makes the run red", () => {
    const out = aggregateVerdicts({ selected: ["1", "2"], verdicts: [v("1", "merged", false), v("2", "new", true)], selectResult: "success" });
    expect(out.loud).toBe(true);
    expect(out.lines.join("\n")).toContain("#2");
  });

  test("a member that reported nothing is loud, and says which", () => {
    const out = aggregateVerdicts({ selected: ["1", "2"], verdicts: [v("1", "merged", false)], selectResult: "success" });
    expect(out.loud).toBe(true);
    expect(out.summary).toContain("#2 reported no verdict at all");
  });

  test("every selected PR failing is systemic, and it is reported", () => {
    const out = aggregateVerdicts({ selected: ["1", "2"], verdicts: [v("1", "repeat", false), v("2", "new", true)], selectResult: "success" });
    expect(out.loud).toBe(true);
    expect(out.summary).toContain("Every selected PR failed");
  });

  test("...but a systemic state of pure REPEATS is not emailed again", () => {
    // Under a 10-minute merge cadence a persistent all-fail state would be
    // ~100 emails a day about conditions each PR's comment already reports —
    // this change's own defect in a different hat. The run in which it became
    // true was loud, because each member's first failure was new then.
    const out = aggregateVerdicts({ selected: ["1", "2"], verdicts: [v("1", "repeat", false), v("2", "repeat", false)], selectResult: "success" });
    expect(out.loud).toBe(false);
    expect(out.summary).toContain("every one of those failures is a repeat");
    expect(out.summary).toContain("does not email it again");
  });

  test("a systemic state is still loud when a member could not classify itself", () => {
    const out = aggregateVerdicts({ selected: ["1", "2"], verdicts: [v("1", "repeat", false), v("2", "undetermined", true)], selectResult: "success" });
    expect(out.loud).toBe(true);
  });

  test("ONE PR failing a repeat is not systemic", () => {
    const out = aggregateVerdicts({ selected: ["1"], verdicts: [v("1", "repeat", false)], selectResult: "success" });
    expect(out.loud).toBe(false);
  });

  test("select's own failure is loud by itself, and is not emailed twice", () => {
    const out = aggregateVerdicts({ selected: [], verdicts: [], selectResult: "failure" });
    expect(out.loud).toBe(false);
    expect(out.lines.join("\n")).toContain("loud by itself");
  });

  test("nothing selected is a clean, quiet run", () => {
    const out = aggregateVerdicts({ selected: [], verdicts: [], selectResult: "success" });
    expect(out.loud).toBe(false);
    expect(out.summary).toContain("no opted-in PR was behind main");
  });
});

describe("a could-not-determine regen is not reported to the author as an Error (task #62)", () => {
  // The whole point of the fix: the PR comment is what the author reads, and
  // for three of regen's four exits it said "**Error**" — asserting a defect
  // in their branch where regen had either measured nothing or explicitly
  // said it could not determine. The verdict reaches the comment through the
  // declared tag, so none of this depends on matching the abort's prose.
  const abort = (verdict: string): string =>
    `\nmerge-base: ABORTED, tree restored — the gate set did not prove the resolution — regen-verdict: ${verdict}\n  …`;

  test("parseLog recovers the verdict from the tag and reports no finding when there is none", () => {
    const p = parseLog(abort("not-settled"));
    expect(p.regenVerdict).toBe("not-settled");
    // Critically: not-settled prints no `STILL fails` line, so the comment
    // must not list one. The old reading had nothing else to go on and fell
    // through to the generic Error.
    expect(p.unrepaired).toBe("");
    expect(p.refused).toBe("");
  });

  test("a log with no tag records no verdict, rather than guessing one", () => {
    expect(parseLog("").regenVerdict).toBe("");
    expect(parseLog("\nmerge-base: ABORTED, tree restored — bun install failed").regenVerdict).toBe("");
  });

  test("not-settled says COULD NOT DETERMINE, and says regen found no unrepaired check", () => {
    const p = composeComment({ ...BASE, log: abort("not-settled") });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("**Could not determine");
    expect(p.body).not.toContain("**Error**");
    // The false assertion the author used to receive.
    expect(p.body).toContain("no** unrepaired check");
    expect(p.body).toContain("not a pass either");
  });

  test("a crashed regen is the bot's tool failing, and says so", () => {
    const p = composeComment({ ...BASE, status: "137", log: abort("crashed") });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("**Could not determine");
    expect(p.body).toContain("137");
    expect(p.body).toContain("says nothing about this PR");
  });

  test("not-staleness with no unrepaired line names the three OTHER kinds", () => {
    // Exit 1 whose failing checks are `no-writer`, `writer-failed` or
    // `no-browser`. One is about the tree, one about the tool, one a
    // could-not-determine — the generic Error text named none of them.
    const p = composeComment({ ...BASE, log: abort("not-staleness") });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("**Not proved");
    expect(p.body).toContain("none of them is an unrepaired check");
    expect(p.body).toContain("Chromium");
  });

  test("a real unrepaired check still gets the unrepaired text, tag or no tag", () => {
    // The more specific finding wins: when regen DID print `STILL fails`, the
    // comment must keep naming it rather than falling back to the verdict.
    const p = composeComment({
      ...BASE,
      log: `  ✗ check:x STILL fails after \`bun run x\` — a real defect, not staleness${abort("not-staleness")}`,
      mainFailing: () => "TypeScript",
    });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("**Not proved — nothing pushed.** Every conflict matched a pattern");
    expect(p.body).toContain("Unrepaired:");
    expect(p.body).toContain("check:x");
  });

  test("a refusal still outranks the verdict", () => {
    const p = composeComment({ ...BASE, log: `  ✗ a/b.ts  [authored: no pattern]${abort("not-staleness")}` });
    if (p.action !== "write") throw new Error("expected a comment");
    expect(p.body).toContain("**Refused");
  });

  test("the three verdicts no longer share one signature", () => {
    // Before the fix every one of them reduced to the SAME salient line —
    // `merge-base: ABORTED, tree restored — the gate set could not reproduce
    // the resolution (regen reported unrepaired checks)` — so the second
    // distinct failure on one head was classified a `repeat` and went quiet.
    // `no-browser` prints `  ? …`, which SALIENT does not match, so the abort
    // line was genuinely all there was to tell them apart.
    const sigs = ["not-settled", "crashed", "not-staleness"].map((v) => signatureOfPlan({ log: abort(v) }));
    expect(new Set(sigs).size).toBe(3);
  });
});
