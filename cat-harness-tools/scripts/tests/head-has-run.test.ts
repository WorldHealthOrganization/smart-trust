/**
 * Zero checks and checks-not-started look the same. This tells them apart.
 *
 * @module scripts/tests/head-has-run
 *
 * Bean `3pqn`. The property under test is not "it queries GitHub" — it is that
 * **three answers stay three answers**. A commit with no run, a commit nobody
 * could ask about, and a commit that has runs are different facts, and the
 * failure this script exists to prevent is any two of them rendering alike.
 *
 * The first draft failed that on its own terms: `deadbeef…` reported "has NO
 * workflow run of any kind", because an id GitHub never heard of returns an
 * empty list exactly as a dropped event does. That case is pinned below.
 *
 * The git half — resolving a commit, and whether it is pushed — is asserted
 * over a throwaway repository whose `HEAD` and `origin/main` are set by the
 * fixture (`test/support/git-fixture.ts`), not over this checkout: standing
 * alone, cat-harness has no `origin`, and these are logic over whatever
 * repository they are handed.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  pushedState,
  lastPushedReason,
  mergeStateForHead,
  missingRequiredAdvice,
  noRunAdvice,
  prNumberForHead,
  resolveCommit,
  runsForHead,
  type GitRunner,
} from "../check-head-has-run.js";
import { gitFixtureRepo } from "../../test/support/git-fixture.js";

/**
 * A throwaway repository with one commit on `main`, an `origin`, and that
 * commit recorded as `origin/main` — what a pushed branch leaves behind.
 */
const FIXTURE = gitFixtureRepo({ pushed: true });
const REPO = FIXTURE.root;
afterAll(() => FIXTURE.cleanup());

/** A fetch that answers with `runs` and never touches the network. */
const stub = (runs: unknown[], init: { ok?: boolean; status?: number } = {}) =>
  (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      headers: new Headers(),
      json: async () => ({ workflow_runs: runs }),
    }) as unknown as Response) as unknown as typeof fetch;

/** No real sleeping in tests — see the thrown-fetch case below. */
const FAST = { attempts: 3, sleep: async () => {} };

describe("three answers stay three answers", () => {
  test("runs present is `has-run`, and they come back", async () => {
    const r = await runsForHead("o/r", "abc", stub([{ name: "gates", event: "pull_request" }]));
    expect(r.state).toBe("has-run");
    expect(r.state === "has-run" && r.runs).toHaveLength(1);
  });

  test("an EMPTY list is `no-run` — a determined absence", async () => {
    expect((await runsForHead("o/r", "abc", stub([]))).state).toBe("no-run");
  });

  test("a missing `workflow_runs` key is also `no-run`, not a crash", async () => {
    const f = (async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
    expect((await runsForHead("o/r", "abc", f)).state).toBe("no-run");
  });

  test("NO REMOTE is `cannot-ask`, never `no-run`", async () => {
    const r = await runsForHead(undefined, "abc", stub([]));
    expect(r.state).toBe("cannot-ask");
  });

  test("a 404 is `cannot-ask` and names the token — not being ALLOWED to look is not an absence", async () => {
    const r = await runsForHead("o/r", "abc", stub([], { ok: false, status: 404 }), FAST);
    expect(r.state).toBe("cannot-ask");
    expect(r.state === "cannot-ask" && r.reason).toContain("GITHUB_TOKEN");
  });

  test("a 403 is `cannot-ask` and names rate limiting", async () => {
    const r = await runsForHead("o/r", "abc", stub([], { ok: false, status: 403 }), FAST);
    expect(r.state === "cannot-ask" && r.reason).toContain("rate limited");
  });

  test("a thrown fetch is retried, and THEN `cannot-ask` with the reason", async () => {
    // The owner's rule (2026-09-20): a falling-off retry rate on every error.
    // A dropped socket says nothing about the question, so it is worth asking
    // again — but exhausting the retries does NOT change the verdict. It is
    // the same third state it would have been without them.
    //
    // The sleep is injected. With the real one this takes 1+2+4+8s and fails
    // at bun's 5s default, which is exactly what the first draft did.
    let calls = 0;
    const f = (async () => {
      calls += 1;
      throw new Error("network is unreachable");
    }) as unknown as typeof fetch;
    const r = await runsForHead("o/r", "abc", f, { attempts: 3, sleep: async () => {} });
    expect(calls).toBe(3);
    expect(r.state === "cannot-ask" && r.reason).toContain("unreachable");
  });

  test("a 5xx is retried; a 404 is NOT — one is a blip, the other is an answer", async () => {
    let calls = 0;
    const responder = (status: number) =>
      (async () => {
        calls += 1;
        return { ok: false, status, headers: new Headers(), json: async () => ({}) } as unknown as Response;
      }) as unknown as typeof fetch;

    calls = 0;
    await runsForHead("o/r", "abc", responder(503), { attempts: 3, sleep: async () => {} });
    expect(calls).toBe(3);

    calls = 0;
    await runsForHead("o/r", "abc", responder(404), { attempts: 3, sleep: async () => {} });
    expect(calls).toBe(1);
  });
});

describe("the commit is resolved HERE before GitHub is asked", () => {
  test("an id git does not know is undefined — the CLI turns this into exit 2", () => {
    // The first draft's defect, pinned: without this, `deadbeef…` comes back
    // from the API as an empty list and reads as a dropped event.
    expect(resolveCommit(REPO, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")).toBeUndefined();
  });

  test("`HEAD` resolves to a full 40-character sha", () => {
    const sha = resolveCommit(REPO, "HEAD");
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test("a short sha resolves to the same full one", () => {
    const full = resolveCommit(REPO, "HEAD")!;
    expect(resolveCommit(REPO, full.slice(0, 8))).toBe(full);
  });
});

describe("pushed or not, because the two need different advice", () => {
  test("a commit on a remote-tracking ref reads as pushed", () => {
    // Asserted against `origin/main`, which the fixture records as pushed.
    const sha = resolveCommit(REPO, "origin/main") ?? resolveCommit(REPO, "HEAD")!;
    // `toBe("pushed")`, NOT `not.toBe("not-pushed")`. Bean `y0n2`: the third
    // state exists precisely so a git failure cannot pass as either answer, and
    // a negative assertion would be satisfied by `cannot-tell` — reinstating the
    // conflation the type was introduced to remove.
    expect(pushedState(REPO, sha)).toBe("pushed");
  });

  test("a commit in a fresh repo with no remote reads as NOT pushed", () => {
    // Telling somebody "GitHub dropped your event" when they simply have not
    // pushed is how a warning gets ignored.
    const fresh = gitFixtureRepo({ remote: null });
    try {
      expect(pushedState(fresh.root, resolveCommit(fresh.root, "HEAD")!)).toBe("not-pushed");
    } finally {
      fresh.cleanup();
    }
  });

  test("git unable to answer is `cannot-tell`, NOT `not-pushed`", () => {
    // Bean `y0n2`, the whole point. A path that is not a git repository makes
    // `git branch -r --contains` exit non-zero, which the old boolean caught and
    // returned as `false` — so somebody who HAD pushed was told to push again.
    // Asserted on a real git failure rather than a stub, because the defect was
    // in what a real non-zero exit became.
    const notARepo = mkdtempSync(join(tmpdir(), "headrun-norepo-"));
    expect(pushedState(notARepo, "0".repeat(40))).toBe("cannot-tell");
    // And the reason survives, which it could not before: stderr was discarded.
    expect(lastPushedReason()).toContain("exited");
  });
});

/**
 * Bean `sddf` — WHY a head has no run, and the branch that used to be wrong.
 *
 * The old no-run message asserted *"It IS pushed, so this is bean `3pqn`: the
 * event was dropped"* and told the reader to dispatch the workflow. Two
 * sentences later the same message admitted a PR with zero checks *"looks
 * exactly like one whose checks have not started"* — a cause stated as fact
 * beside the admission that the evidence cannot establish it.
 *
 * Worse, the advice is now known to be unsafe: a dispatch resolves
 * `refs/heads/<branch>`, not the merge ref, so on a conflicted PR it is a green
 * signal for a tree that will never exist. `yv4z` measured that on PR #813 and
 * `prepare-merge` §Guardrails gained a step 0 for it; this script did not.
 *
 * `noRunAdvice` is a pure function precisely so these branches can be run. The
 * conflicted one could not be reached at all while it lived inline — it needs a
 * live forge holding a PR that is open and conflicted at the same moment.
 */
const HEADS = [
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/pull/11/head",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/pull/22/head",
].join("\n");

/**
 * A forge where PR 11 is mergeable and PR 22 is not. A merge ref is named
 * `merge<N>`, and its second parent is PR N's head unless `staleFor` says the
 * ref was built for an earlier head. Its first parent is the default branch's
 * tip unless `base` says the ref was built on an older one (bean `rwwl`).
 */
const TIP = "e".repeat(40);
type BaseMoved = { builtOn: string; onDefault?: boolean; merges?: "clean" | "conflict" | "error" };
const fakeGit =
  (
    heads = HEADS,
    mergeable = new Set(["11"]),
    staleFor = new Set<string>(),
    base?: BaseMoved,
  ): GitRunner =>
  (args) => {
    const ref = args[args.length - 1] ?? "";
    if (ref === "refs/pull/*/head") return heads;
    if (args[0] === "fetch") return "";
    if (args[0] === "ls-remote" && args[1] === "--symref") return `ref: refs/heads/main\tHEAD\n${TIP}\tHEAD\n`;
    if (args[0] === "rev-parse" && /^merge\d+\^1$/.test(ref)) return base?.builtOn ?? TIP;
    if (args[0] === "merge-base") {
      if (base?.onDefault === false) throw new Error("not an ancestor");
      return "";
    }
    if (args[0] === "merge-tree") {
      if (base?.merges === "conflict") throw Object.assign(new Error("conflict"), { status: 1 });
      if (base?.merges === "error") throw Object.assign(new Error("fatal"), { status: 128 });
      return "f".repeat(40);
    }
    const parent = /^merge(\d+)\^2$/.exec(ref)?.[1];
    if (args[0] === "rev-parse" && parent !== undefined) {
      if (staleFor.has(parent)) return "d".repeat(40);
      const head = heads.split("\n").find((l) => l.endsWith(`refs/pull/${parent}/head`));
      return head?.split("\t")[0] ?? "";
    }
    const n = /refs\/pull\/(\d+)\/merge/.exec(ref)?.[1];
    return n && mergeable.has(n) ? `merge${n}\t${ref}\n` : "";
  };

describe("sddf — the merge ref is the discriminator, not the clock", () => {
  test("a sha that is a PR head is found, with its number", () => {
    expect(prNumberForHead(".", "a".repeat(40), fakeGit())).toBe(11);
    expect(prNumberForHead(".", "b".repeat(40), fakeGit())).toBe(22);
  });

  test("a sha that is no PR's head is `not-a-pr-head` — nothing was ever owed", () => {
    expect(prNumberForHead(".", "c".repeat(40), fakeGit())).toBeUndefined();
    expect(mergeStateForHead(".", "c".repeat(40), fakeGit())).toBe("not-a-pr-head");
  });

  test("a merge ref present means a run is OWED", () => {
    expect(mergeStateForHead(".", "a".repeat(40), fakeGit())).toBe("mergeable");
  });

  test("NO merge ref means conflicted — this head will never get a run", () => {
    // The measurement, PR #813: conflicted -> no merge ref for 433s and no
    // `pull_request` run; resolved -> merge ref within 15s and runs in 7s.
    expect(mergeStateForHead(".", "b".repeat(40), fakeGit())).toBe("conflicted");
  });

  test("a merge ref built for an EARLIER head is `unknown`, never `mergeable` (52cz, #1665)", () => {
    // The forge leaves the old merge ref in place when a new head conflicts.
    // Existence alone read that as mergeable and offered dispatch.
    expect(mergeStateForHead(".", "a".repeat(40), fakeGit(HEADS, new Set(["11"]), new Set(["11"])))).toBe(
      "unknown",
    );
  });

  test("a merge ref built for THIS head on an OLD base that now conflicts is `conflicted` (rwwl, #2197)", () => {
    // Measured 2026-10-06: refs/pull/2197/merge had ^2 = the head and ^1 = an
    // old main. Reading ^2 alone called it mergeable, so ci:watch printed PASS
    // on a PR REST called `dirty`.
    const old = "9".repeat(40);
    expect(
      mergeStateForHead(".", "a".repeat(40), fakeGit(HEADS, new Set(["11"]), new Set(), { builtOn: old, merges: "conflict" })),
    ).toBe("conflicted");
  });

  test("an old base that still merges cleanly is `mergeable` — the forge rebuilds lazily", () => {
    const old = "9".repeat(40);
    expect(
      mergeStateForHead(".", "a".repeat(40), fakeGit(HEADS, new Set(["11"]), new Set(), { builtOn: old, merges: "clean" })),
    ).toBe("mergeable");
  });

  test("a base that is not the default branch (a stacked PR) is `unknown`, not a guess", () => {
    const other = "8".repeat(40);
    expect(
      mergeStateForHead(".", "a".repeat(40), fakeGit(HEADS, new Set(["11"]), new Set(), { builtOn: other, onDefault: false })),
    ).toBe("unknown");
  });

  test("a merge-tree that ERRORS (rather than conflicts) is `unknown`, never `conflicted`", () => {
    const old = "9".repeat(40);
    expect(
      mergeStateForHead(".", "a".repeat(40), fakeGit(HEADS, new Set(["11"]), new Set(), { builtOn: old, merges: "error" })),
    ).toBe("unknown");
  });

  test("a FAILING probe is `unknown`, never `conflicted`", () => {
    // The third state, and the one this whole file exists for: a read that did
    // not happen is not an answer. Reporting it as `conflicted` would send
    // somebody to resolve a conflict that may not exist.
    const throws: GitRunner = (args) => {
      if (args[args.length - 1] === "refs/pull/*/head") return HEADS;
      throw new Error("ls-remote failed");
    };
    expect(mergeStateForHead(".", "a".repeat(40), throws)).toBe("unknown");
  });
});

/**
 * Wrapped prose, compared without its wrapping. Asserting on a literal
 * substring breaks the moment somebody re-flows a paragraph, which would make
 * this suite punish an editorial change and teach the next person to loosen
 * the assertion rather than keep it.
 */
const flat = (s: string): string => s.replace(/\s+/g, " ");

describe("sddf — the advice, per state", () => {
  test("CONFLICTED never says dispatch, and never says dropped", () => {
    const msg = flat(noRunAdvice("conflicted"));
    // The two defects, asserted as absences.
    expect(msg).not.toContain("the event was dropped");
    expect(msg).toContain("Do NOT dispatch");
    // And it must say what to do instead, or it is only a refusal.
    expect(msg).toContain("MERGE THE BASE BRANCH IN");
    expect(msg).toContain("a tree that will never exist");
  });

  test("MERGEABLE is the only state where dispatching is offered", () => {
    const msg = flat(noRunAdvice("mergeable"));
    expect(msg).toContain("safe HERE");
    // Still no confident cause: `3pqn` is named as the open question it is.
    expect(msg).toContain("NOT established");
    // And the clock is explicitly disclaimed, because `yv4z` proposed one.
    expect(msg).toContain("Latency is no guide");
  });

  test("NO state claims a cause it cannot establish", () => {
    for (const m of ["conflicted", "mergeable", "not-a-pr-head", "unknown"] as const) {
      expect(flat(noRunAdvice(m))).not.toContain("the event was dropped");
    }
  });

  test("UNKNOWN warns against dispatching rather than recommending it", () => {
    const msg = flat(noRunAdvice("unknown"));
    expect(msg).toContain("by hand");
    expect(msg).toContain("a tree that will never exist");
    expect(msg).not.toContain("safe HERE");
  });

  /**
   * "Check by hand" has to resolve to something, and for a while it resolved
   * to the wrong thing.
   *
   * Both UNKNOWN messages said *"check `mergeable_state` by hand"* — inside a
   * module whose own {@link mergeStateForHead} deliberately asks
   * `git ls-remote origin refs/pull/N/merge` instead, because `h2s9` had
   * already established the field is not a reliable discriminator. The code
   * had the right instinct and the prose sent the reader the other way.
   *
   * Bean `fx5r` then measured the cost: 45 minutes after a PR merged, its
   * `mergeable`, `mergeable_state`, `head.sha` and `updated_at` all still
   * served the pre-merge view, and `update-branch` answered "merge conflict
   * between base and head" for a PR that was CLOSED — a wrong cause, stated
   * with the authority of a measurement. Only `merged` went stale-safe.
   *
   * So these pin the REFERENT of "by hand", which the assertion above cannot:
   * it is satisfied by any advice containing the phrase, including advice
   * that names the field that misleads.
   */
  test("...and 'by hand' means ASK GIT, not the field that goes stale", () => {
    for (const msg of [flat(noRunAdvice("unknown")), flat(missingRequiredAdvice(["Code-quality gates"], "unknown"))]) {
      // The discriminators that hold: `merged`, and the merge ref itself.
      expect(msg).toContain("--json merged");
      expect(msg).toContain("refs/pull/");
      // And the field is named only to warn against it.
      expect(msg).toContain("not `mergeable_state`");
    }
  });

  test("the warning is specific about WHY, not just that", () => {
    // A bare "don't trust it" ages into folklore. The measurement is what
    // lets a future reader decide whether it still holds.
    const msg = flat(noRunAdvice("unknown"));
    expect(msg).toContain("45 minutes");
    expect(msg).toContain("stale-safe");
  });
});
