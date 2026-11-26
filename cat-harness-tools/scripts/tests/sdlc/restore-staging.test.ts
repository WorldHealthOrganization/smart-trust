/**
 * A preview survives a main deploy; a deleted page still disappears.
 *
 * Bean `plj1`. The failure being fixed is INVISIBLE to every existing check —
 * the staging push succeeds, the check run is green, and the artefact is
 * removed minutes later by an unrelated merge — so a green CI run is not
 * evidence here and these tests do not ask for one. They construct the
 * sequence deliberately: a real git remote with a real `gh-pages` branch, and
 * a step-for-step replay of what `peaceiris/actions-gh-pages@v4` does at push
 * time (`src/git-utils.ts`, `setRepo`):
 *
 * ```
 * git clone --depth=1 --single-branch --branch gh-pages <remote> workDir
 * git rm -r --ignore-unmatch '*'      # only when keep_files is false
 * cp -R publish_dir/* workDir/
 * ```
 *
 * Both halves are asserted, because they pull in opposite directions and the
 * one-line fix (`keep_files: true`) buys the first by giving up the second:
 *
 * 1. **previews survive** a full-replace deploy once they are restored;
 * 2. **a page removed from `docs/` still leaves the published site** — which
 *    the `keepFiles: true` control below shows it does NOT under the one-line
 *    fix. That control is the evidence for the trade-off, not an assertion
 *    about our own behaviour.
 *
 * @module scripts/tests/restore-staging
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe as describeOutcome, exitCodeFor, restoreStaging, verifyStaging } from "../../restore-staging.js";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ID = ["-c", "user.name=t", "-c", "user.email=t@t"];

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...ID, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

function put(root: string, path: string, body: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body);
}

/** A bare remote whose `gh-pages` branch holds `files`. */
function remoteWith(files: Record<string, string>): string {
  const base = mkdtempSync(join(tmpdir(), "restore-staging-t-"));
  const bare = join(base, "remote.git");
  git(base, "init", "--bare", "-b", "main", bare);
  const seed = join(base, "seed");
  mkdirSync(seed);
  git(seed, "init", "-b", "gh-pages");
  for (const [p, b] of Object.entries(files)) put(seed, p, b);
  git(seed, "add", "-A");
  git(seed, "commit", "-m", "seed");
  git(seed, "remote", "add", "origin", bare);
  git(seed, "push", "origin", "gh-pages");
  return bare;
}

/** A scratch checkout the restore runs from — what `actions/checkout` gives the job. */
function checkout(): string {
  const dir = mkdtempSync(join(tmpdir(), "restore-staging-co-"));
  git(dir, "init", "-b", "main");
  return dir;
}

/** A built `_site`, with whatever pages this run produced. */
function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "restore-staging-site-"));
  for (const [p, b] of Object.entries(files)) put(dir, p, b);
  return dir;
}

/**
 * `peaceiris/actions-gh-pages@v4`, replayed. Returns the paths now on the branch.
 *
 * `keepFiles` is the ONLY difference between the two candidate fixes, so it is
 * a parameter rather than a second function: the same replay answers both
 * questions, and neither answer can come from a different code path.
 */
function publish(bare: string, siteDir: string, opts: { keepFiles: boolean }): string[] {
  const work = mkdtempSync(join(tmpdir(), "restore-staging-pub-"));
  git(dirname(work), "clone", "--depth=1", "--single-branch", "--branch", "gh-pages", bare, work);
  if (!opts.keepFiles) git(work, "rm", "-r", "--ignore-unmatch", "*");
  for (const entry of readdirSync(siteDir)) {
    cpSync(join(siteDir, entry), join(work, entry), { recursive: true, force: true, dereference: true });
  }
  git(work, "add", "-A");
  git(work, "commit", "--allow-empty", "-m", "docs(gh-pages): site from deadbeef");
  git(work, "push", "origin", "gh-pages");
  return git(work, "ls-tree", "-r", "--name-only", "HEAD").split("\n").filter((s) => s !== "");
}

const BRANCH = { branch: "gh-pages", prefix: "STAGING" };
/** No fixture below seeds a retired record unless it says so. */
/** One retired-record store per preview directory, the current (`branches/`) one first. */
const RETIRED_ABSENT = [{ prefix: "branches/_retired", state: "absent" }, { prefix: "STAGING/_retired", state: "absent" }] as const;
/** Nor a public comment release (`pc-release.ts`). */
const PC_ABSENT = { prefix: "PC", state: "absent" } as const;

describe("a full-replace deploy with the restore in front of it", () => {
  /** The state of the branch before any of this: one live page, one about to be deleted, two previews. */
  const before = {
    "index.html": "<p>old home</p>",
    "renamed-away.html": "<p>this page is removed from docs/ in the change under test</p>",
    "STAGING/claude-pr-361/index.html": "<p>preview 361</p>",
    "STAGING/claude-pr-362/api/index.html": "<p>preview 362 typedoc</p>",
  };

  test("the previews survive, and a page deleted from docs/ still disappears", () => {
    const bare = remoteWith(before);
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>", "about.html": "<p>new page</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("restored");
    expect(restored.previews).toEqual(["claude-pr-361", "claude-pr-362"]);
    expect(exitCodeFor(restored)).toBe(0);

    const after = publish(bare, built, { keepFiles: false });

    // Half one — the previews, byte-for-byte, including the nested TypeDoc path.
    expect(after).toContain("STAGING/claude-pr-361/index.html");
    expect(after).toContain("STAGING/claude-pr-362/api/index.html");

    // Half two — delete-on-remove is intact. This is what `keep_files: true`
    // would have cost, and the control below measures that cost.
    expect(after).not.toContain("renamed-away.html");
    expect(after).toContain("about.html");

    // And the verifier agrees, from the branch rather than from this process.
    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, restored.previews);
    expect(v.state).toBe("ok");
    expect(exitCodeFor(v)).toBe(0);
  });

  test("CONTROL — `keep_files: true` keeps the previews but strands the deleted page", () => {
    const bare = remoteWith(before);
    const built = site({ "index.html": "<p>new home</p>" });

    const after = publish(bare, built, { keepFiles: true });

    expect(after).toContain("STAGING/claude-pr-361/index.html");
    // The regression the one-line fix would have introduced: the page is gone
    // from `docs/` and serves forever from `gh-pages`.
    expect(after).toContain("renamed-away.html");
  });

  test("CONTROL — with no restore, a full replace deletes every preview", () => {
    const bare = remoteWith(before);
    const built = site({ "index.html": "<p>new home</p>" });

    const after = publish(bare, built, { keepFiles: false });

    expect(after.filter((p) => p.startsWith("STAGING/"))).toEqual([]);
    expect(after).not.toContain("renamed-away.html");
  });
});

describe("the three states", () => {
  test("determined-empty: the branch is readable and carries no previews", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new</p>" });

    const r = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(r.state).toBe("empty");
    expect(exitCodeFor(r)).toBe(0);
    expect(existsSync(join(built, "STAGING"))).toBe(false);
  });

  test("determined: the publish branch does not exist at all — a first deploy", () => {
    const base = mkdtempSync(join(tmpdir(), "restore-staging-nb-"));
    const bare = join(base, "remote.git");
    git(base, "init", "--bare", "-b", "main", bare);
    const repo = checkout();
    const built = site({ "index.html": "<p>new</p>" });

    const r = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(r.state).toBe("no-branch");
    expect(exitCodeFor(r)).toBe(0);
  });

  test("COULD NOT DETERMINE is exit 2, never 'there are no previews to keep'", () => {
    const repo = checkout();
    const built = site({ "index.html": "<p>new</p>" });

    const r = restoreStaging({ repo, remote: join(tmpdir(), "no-such-remote-at-all.git"), site: built, ...BRANCH });
    expect(r.state).toBe("unknown");
    expect(exitCodeFor(r)).toBe(2);
    // Nothing written, so a caller that ignores the code still does not publish
    // a half-restored site.
    expect(existsSync(join(built, "STAGING"))).toBe(false);
  });

  test("a blind verifier is exit 2, not a pass", () => {
    const repo = checkout();
    const built = site({});
    const v = verifyStaging(
      { repo, remote: join(tmpdir(), "no-such-remote-at-all.git"), site: built, ...BRANCH },
      ["claude-pr-361"],
    );
    expect(v.state).toBe("unknown");
    expect(exitCodeFor(v)).toBe(2);
  });

  test("a preview lost in the window is exit 1, and is named", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", "STAGING/kept/index.html": "<p>k</p>" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new</p>" });
    restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    publish(bare, built, { keepFiles: false });

    // `raced` is a preview that landed after the restore read the branch — the
    // residual window the action's own re-clone leaves open.
    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, ["kept", "raced"]);
    expect(v.state).toBe("lost");
    if (v.state === "lost") expect(v.lost).toEqual(["raced"]);
    expect(exitCodeFor(v)).toBe(1);
  });

  test("a preview pushed after ours is added, never reported lost", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", "STAGING/mine/index.html": "<p>m</p>" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new</p>" });
    const r = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    publish(bare, built, { keepFiles: false });
    // A later staging deploy, which is additive (`keep_files: true` + destination_dir).
    const extra = site({ "STAGING/theirs/index.html": "<p>t</p>" });
    publish(bare, extra, { keepFiles: true });

    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, r.previews);
    expect(v.state).toBe("ok");
  });
});

/**
 * The wiring, checked against the workflow rather than described in a comment.
 *
 * Ordering is load-bearing and is the part a later edit is most likely to
 * break: the action re-clones `gh-pages` itself at push time, so every step
 * between the restore and the push widens the window in which a
 * `feature-staging` deploy can land a preview this push then removes.
 */
describe(".github/workflows/docs-site.yml + publish-gh-pages.sh", () => {
  const root = repoRootFor(resolve(HARNESS_ROOT));
  const wf = readFileSync(join(root, ".github", "workflows", "docs-site.yml"), "utf-8");
  const pub = readFileSync(join(root, "cat-harness-tools", "scripts", "publish-gh-pages.sh"), "utf-8");

  // These keyed on `peaceiris/actions-gh-pages@` until 2026-09-20. When that
  // action was replaced (bean `yzsj`, #605 half a) ONE of them failed loudly
  // and TWO passed VACUOUSLY — `indexOf` returned -1, and both assertions are
  // satisfied by -1. That is the `6tkl` shape introduced by the very change
  // the tests exist to guard, so each now asserts against something that
  // cannot silently go missing: a `-1` fails before the ordering is compared.

  test("the workflow delegates the publish to the script, and still verifies after", () => {
    const steps = wf.split("\n").filter((l) => /^\s{6}- name: |^\s{8}(run|uses):/.test(l));
    const publish = steps.findIndex((l) => l.includes("scripts/publish-gh-pages.sh"));
    const verify = steps.findIndex((l) => l.includes("restore-staging.ts --verify"));
    expect({ publish: publish > -1, verify: verify > -1 }).toEqual({ publish: true, verify: true });
    expect(verify).toBeGreaterThan(publish);
  });

  test("the action is gone — it is what made a retry impossible", () => {
    // It clones, replaces and pushes in one step, so the race window was
    // INSIDE it and there was nothing to wrap. Prose may still mention it.
    expect(wf).not.toMatch(/uses:\s*peaceiris\/actions-gh-pages/);
  });

  test("the restore is the last thing before the push, now inside the loop", () => {
    // The invariant is unchanged and better served: every step between
    // reading `gh-pages` and pushing widens the window in which a
    // `feature-staging` deploy lands a preview this push then removes.
    const restore = pub.indexOf("restore-staging.ts --site");
    const push = pub.indexOf("git -C \"$PAGES_DIR\" push");
    expect({ restore: restore > -1, push: push > -1 }).toEqual({ restore: true, push: true });
    expect(push).toBeGreaterThan(restore);
    // Nothing between them may read the branch again or sleep.
    const between = pub.slice(restore, push);
    expect(between).not.toContain("backoff-sleep");
    expect(between).not.toContain("fetch");
  });

  test("EVERY attempt re-reads and rebuilds — it must never rebase", () => {
    // The load-bearing property. This commit replaces the WHOLE TREE, so
    // replaying it onto a newer `gh-pages` would re-apply that replacement
    // over whatever landed in between — `plj1` re-created by the retry.
    // Verified end to end on a scratch remote: with the first push losing,
    // the final commit's parent was the rival's commit.
    expect(pub).toContain("reset --hard FETCH_HEAD");
    expect(pub).not.toMatch(/pull\s+--rebase|git\s+rebase/);
    // The restore sits INSIDE the attempt loop, not before it.
    const loop = pub.indexOf("for attempt in");
    expect(loop).toBeGreaterThan(-1);
    expect(pub.indexOf("restore-staging.ts --site")).toBeGreaterThan(loop);
  });

  test("the publish is still a FULL REPLACE — delete-on-remove is the point", () => {
    // `keep_files` here would be the regression the control test above
    // measures: the main site's own deleted pages would serve forever. The
    // previews survive by being RESTORED into `_site`, never by not deleting.
    expect(pub).toContain("rm -r --ignore-unmatch");
    // Comments stripped: the script's header explains at length why
    // `keep_files` is NOT the fix, so asserting on the raw text would fail on
    // its own reasoning. The assertion is about what it DOES.
    const code = pub.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(code).not.toContain("keep_files");
  });

  test("a restore that could not READ the branch is fatal, never 'no previews'", () => {
    // Exit 2 means the branch was unreadable. Publishing then would assert
    // "there are no previews to keep" on the strength of a failed read.
    const guard = pub.slice(pub.indexOf("restore-staging.ts --site"));
    expect(guard.slice(0, guard.indexOf("rm -r"))).toContain("exit");
  });
});

describe("the render log is carried UNCONDITIONALLY — the property previews do not have", () => {
  // A preview belongs to an open pull request, so gating its carry on liveness
  // is defensible. A log entry about a CLOSED pull request is exactly what such
  // a gate would drop and exactly what a reader asking "what happened to
  // `branches/x`" needs most. These tests pin the difference.

  const LOG = "_render-log/2026-09-20.jsonl";
  const LINE = `{"$schema":"folio-render-log/v1","id":"e1","event":"rendered"}\n`;

  test("the log survives a full replace when there are NO previews at all", () => {
    // The case the early `empty` return would have dropped: this function used
    // to leave the moment there were no previews, which would carry the record
    // of the branch only on the days it happened to still hold previews.
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("empty");
    expect(restored.carried).toEqual([{ prefix: "_render-log", state: "carried" }, ...RETIRED_ABSENT, PC_ABSENT]);

    const after = publish(bare, built, { keepFiles: false });
    expect(after).toContain(LOG);
  });

  test("CONTROL — with no restore, the full replace deletes the log", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE });
    const built = site({ "index.html": "<p>new home</p>" });

    const after = publish(bare, built, { keepFiles: false });
    expect(after.filter((p) => p.startsWith("_render-log/"))).toEqual([]);
  });

  test("entries are kept byte-for-byte, and a day file is not merged into another", () => {
    const other = "_render-log/2026-09-19.jsonl";
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE, [other]: LINE });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(readFileSync(join(built, LOG), "utf-8")).toBe(LINE);
    expect(existsSync(join(built, other))).toBe(true);

    const after = publish(bare, built, { keepFiles: false });
    expect(after).toContain(LOG);
    expect(after).toContain(other);
  });

  test("an absent log is a DETERMINED absence, reported rather than omitted", () => {
    // "there is no log on the branch yet" and "the carry never ran" look
    // identical in a silent report, and only the second is a defect.
    const bare = remoteWith({ "index.html": "<p>home</p>", "STAGING/x/index.html": "<p>p</p>" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("restored");
    expect(restored.carried).toEqual([{ prefix: "_render-log", state: "absent" }, ...RETIRED_ABSENT, PC_ABSENT]);
    expect(exitCodeFor(restored)).toBe(0);
  });

  test("a log the deploy would have wiped is carried alongside the previews", () => {
    const bare = remoteWith({
      "index.html": "<p>home</p>",
      "STAGING/claude-pr-9/index.html": "<p>preview</p>",
      [LOG]: LINE,
    });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("restored");

    const after = publish(bare, built, { keepFiles: false });
    expect(after).toContain(LOG);
    expect(after).toContain("STAGING/claude-pr-9/index.html");
  });

  test("an unreadable branch carries nothing and is exit 2 — never a silent pass", () => {
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({
      repo,
      remote: join(tmpdir(), "restore-staging-no-such-remote.git"),
      site: built,
      ...BRANCH,
    });
    expect(restored.state).toBe("unknown");
    expect(restored.carried).toEqual([]);
    expect(exitCodeFor(restored)).toBe(2);
    expect(existsSync(join(built, "_render-log"))).toBe(false);
  });
});

describe("the verifier checks the CARRIED prefixes, not only the previews", () => {
  /**
   * Measured 2026-09-20, which is why this is a test and not a worry.
   *
   * `gh-pages` commit `96926833b5`, a `docs(gh-pages)` full replace, deleted
   * `_render-log/2026-09-20.jsonl` — present at its parent, `D` at the commit,
   * three entries gone. The deploy's own verify step PASSED, because it only
   * ever looked at `branches/`.
   *
   * A verifier blind to half of what the restore carried reports a clean run
   * over exactly the loss it exists to catch, which is bean `plj1`'s shape one
   * level out.
   */
  const LOG = "_render-log/2026-09-20.jsonl";
  const LINE = `{"$schema":"folio-render-log/v1","id":"e1","event":"rendered"}\n`;

  test("a log the deploy dropped is reported LOST, where it used to pass", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE });
    const repo = checkout();
    // A publish directory that does NOT carry the log — what `main`'s own
    // `restore-staging.ts` produced before `CARRIED_PREFIXES` existed.
    const built = site({ "index.html": "<p>new home</p>" });
    publish(bare, built, { keepFiles: false });

    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, [], ["_render-log"]);
    expect(v.state).toBe("lost");
    if (v.state !== "lost") throw new Error("expected a loss");
    expect(v.lostPrefixes).toEqual(["_render-log"]);
    expect(exitCodeFor(v)).toBe(1);
  });

  test("the SAME case passes when the prefix is not passed — the old blind spot", () => {
    // Not a behaviour we want; a control showing what the deploy of
    // 2026-09-20 actually did, so the fix cannot be quietly reverted.
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });
    publish(bare, built, { keepFiles: false });

    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, []);
    expect(v.state).toBe("ok");
  });

  test("a log that survived is not reported lost", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", [LOG]: LINE });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.carried).toEqual([{ prefix: "_render-log", state: "carried" }, ...RETIRED_ABSENT, PC_ABSENT]);
    publish(bare, built, { keepFiles: false });

    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, [], ["_render-log"]);
    expect(v.state).toBe("ok");
    expect(exitCodeFor(v)).toBe(0);
  });

  test("a DETERMINED ABSENCE is never asserted on — it was never there to lose", () => {
    // The restore reports `absent` for a branch with no log yet. Verifying
    // against it would fail every deploy before the first entry is written.
    const bare = remoteWith({ "index.html": "<p>home</p>" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.carried).toEqual([{ prefix: "_render-log", state: "absent" }, ...RETIRED_ABSENT, PC_ABSENT]);
    publish(bare, built, { keepFiles: false });

    // Only the `carried` ones are passed, so this list is empty.
    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, [], []);
    expect(v.state).toBe("ok");
  });

  test("a loss names the prefix and says it is NOT recoverable by re-running", () => {
    const v = {
      state: "lost" as const,
      expected: [],
      present: [],
      lost: [],
      lostPrefixes: ["_render-log"],
    };
    const text = describeOutcome(v);
    expect(text).toContain("_render-log");
    expect(text).toContain("NOT recoverable");
  });
});

describe("the retired-record store is carried unconditionally and is not a preview — bean 6pfo", () => {
  // A retired record describes a CLOSED pull request's preview. The previews
  // are carried by liveness; the store must not be, or the full replace drops
  // exactly the records it exists to keep.
  const REC = "STAGING/_retired/claude-pr-7.json";
  const BODY = `{"kind":"staging-preview"}\n`;

  test("with no previews at all, the store survives the full replace", () => {
    const bare = remoteWith({ "index.html": "<p>home</p>", [REC]: BODY });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    // `empty`, not `restored`: the store is not a preview.
    expect(restored.state).toBe("empty");
    expect(restored.carried).toContainEqual({ prefix: "STAGING/_retired", state: "carried" });

    const after = publish(bare, built, { keepFiles: false });
    expect(after).toContain(REC);
  });

  test("beside a live preview, `_retired` is not counted among the previews", () => {
    const bare = remoteWith({
      "index.html": "<p>home</p>",
      "STAGING/claude-pr-9/index.html": "<p>preview</p>",
      [REC]: BODY,
    });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("restored");
    expect(restored.previews).toEqual(["claude-pr-9"]);

    publish(bare, built, { keepFiles: false });
    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, ["claude-pr-9"], ["STAGING/_retired"]);
    expect(v.state).toBe("ok");
  });
});

describe("a RETIRED preview is not restored", () => {
  /**
   * The measured sequence, replayed. `feature-staging.yml`'s cleanup removes
   * `branches/<slug>/` and writes `_retired/<slug>.json` in one commit, so this
   * is the branch state the next full-replace deploy reads: one live preview,
   * one retirement record, and no directory for the retired slug.
   *
   * On `gh-pages` 2026-10-02 the deploy read a state taken BEFORE that commit
   * and put all 1615 files back (`a46c58ca9df` removed them, `93ffa64488c`
   * re-added them). Here the directory is still present alongside its record —
   * the harder case, and the one a race actually produces.
   */
  const withRetired = {
    "index.html": "<p>home</p>",
    "STAGING/claude-live/index.html": "<p>a preview whose PR is open</p>",
    "STAGING/claude-gone/index.html": "<p>a preview that was retired</p>",
    "STAGING/_retired/claude-gone.json": JSON.stringify({
      $schema: "folio-fsh-guts/v1",
      kind: "staging-preview",
      staging: { slug: "claude-gone", retiredOn: "2026-10-02T09:17:23.071Z", retiredReason: "merged" },
    }),
  };

  test("the retired slug is left behind and the live one is carried", () => {
    const bare = remoteWith(withRetired);
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("restored");
    // The crux: `claude-gone` is absent from what the restore carries.
    expect(restored.previews).toEqual(["claude-live"]);

    const after = publish(bare, built, { keepFiles: false });
    expect(after).toContain("STAGING/claude-live/index.html");
    expect(after).not.toContain("STAGING/claude-gone/index.html");
  });

  test("the retirement RECORD still survives the deploy — it outlives the preview", () => {
    const bare = remoteWith(withRetired);
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.carried).toContainEqual({ prefix: "STAGING/_retired", state: "carried" });

    const after = publish(bare, built, { keepFiles: false });
    // Carried unconditionally: a record a deploy truncates is worse than none.
    expect(after).toContain("STAGING/_retired/claude-gone.json");
  });

  test("the verifier does not expect the retired preview back", () => {
    const bare = remoteWith(withRetired);
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    publish(bare, built, { keepFiles: false });

    const v = verifyStaging({ repo, remote: bare, site: built, ...BRANCH }, restored.previews, ["STAGING/_retired"]);
    expect(v.state).toBe("ok");
    // Narrowed rather than asserted through: `present` is absent from the
    // `unknown` variant, and an `unknown` read as "nothing present" would pass
    // this test while saying nothing — the third-state rule, in a test.
    if (v.state === "unknown") throw new Error(`verify could not run: ${v.reason}`);
    expect(v.present).not.toContain("claude-gone");
  });

  test("EVERY preview retired is a determined empty, not a whole-tree archive", () => {
    // The dangerous shape: if the filter removes every path and the copy still
    // ran, `git archive <rev>` with no pathspec would lay the whole branch over
    // the built site. The early `empty` return is what stops it, and
    // `copyPaths` refuses an empty list as a second guard.
    const bare = remoteWith({
      "index.html": "<p>home</p>",
      "STAGING/claude-gone/index.html": "<p>retired</p>",
      "STAGING/_retired/claude-gone.json": "{}",
    });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const restored = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(restored.state).toBe("empty");
    expect(restored.previews).toEqual([]);
    expect(exitCodeFor(restored)).toBe(0);
    // Nothing of the branch was laid into the site except the carried record.
    expect(existsSync(join(built, "STAGING", "claude-gone"))).toBe(false);
  });

  test("an UNREADABLE retirement store is `unknown`, never `no retirements`", () => {
    // The third-state rule, applied to this function's own input. Answering
    // "could not read the records" as "there are none" restores every retired
    // preview — the defect, reintroduced by the guard against it.
    // The branch exists and is read, but its retirement store is a FILE where a
    // directory of records belongs: it is there (so not "no retirements"), and
    // listing it fails (`git ls-tree <rev>:STAGING/_retired` is not a tree).
    const { "STAGING/_retired/claude-gone.json": _record, ...rest } = withRetired;
    const bare = remoteWith({ ...rest, "STAGING/_retired": "not a directory of records\n" });
    const repo = checkout();
    const built = site({ "index.html": "<p>new home</p>" });

    const broken = restoreStaging({ repo, remote: bare, site: built, ...BRANCH });
    expect(broken.state).toBe("unknown");
    expect(broken.previews).toEqual([]);
    expect(broken.state === "unknown" && broken.reason).toContain("STAGING/_retired");
    expect(exitCodeFor(broken)).not.toBe(0);
    // Neither preview is laid down — not even the live one — because the restore could not tell which are retired.
    expect(existsSync(join(built, "STAGING", "claude-gone"))).toBe(false);
    expect(existsSync(join(built, "STAGING", "claude-live"))).toBe(false);
  });
});
