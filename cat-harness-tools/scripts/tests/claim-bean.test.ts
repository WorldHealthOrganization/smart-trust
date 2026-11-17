/**
 * A claim reaches the default branch, or says why it did not.
 *
 * Bean `35nj`. Every case is built against a REAL bare remote with a real
 * default branch, because the states that matter are the refusals and none of
 * them can be faked by stubbing git: a protected branch rejects at the receive
 * stage, and a non-fast-forward is a genuine ref race.
 *
 * **The refusals are the point, not the happy path.** This environment cannot
 * find out whether the default branch is protected — `GET /branches/main/
 * protection` answers 403 "Resource not accessible by integration", and
 * `git push --dry-run` does not run receive hooks — so the mechanism is built to
 * attempt and handle rejection rather than to assume. If `fell-back` regressed
 * into a silent no-op, a session would believe it had claimed something it had
 * not, which is worse than the duplicate `35nj` exists to prevent.
 *
 * @module scripts/tests/claim-bean
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BEAN_FM = `---
# folio-assistant-zz11
title: 'a bean to claim'
status: todo
type: task
created_at: 2026-10-03T00:00:00Z
updated_at: 2026-10-03T00:00:00Z
---
`;

import { absoluteRemote, claimOnDefaultBranch, describe as describeOutcome, exitCodeFor, mirrorClaimNote, wrongCheckout } from "../claim-bean.js";

const ID = ["-c", "user.name=t", "-c", "user.email=t@t"];

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...ID, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

function bean(id: string, status = "todo"): string {
  return `---\n# folio-assistant-${id}\ntitle: Bean ${id}\nstatus: ${status}\ntype: task\ncreated_at: 2026-09-19T00:00:00Z\nupdated_at: 2026-09-19T00:00:00Z\n---\n\nBody.\n`;
}

/** A work checkout on `claude/feature`, whose `origin` is a bare repo with `main`. */
function repoWith(beans: Record<string, string>): { work: string; bare: string } {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "claim-bean-t-")));
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  writeFileSync(
    join(work, ".beans.yml"),
    "beans:\n    path: beans/defs\n    prefix: folio-assistant-\n    id_length: 4\n    default_status: todo\n    default_type: task\n",
  );
  mkdirSync(join(work, "beans", "defs"), { recursive: true });
  for (const [id, body] of Object.entries(beans)) {
    writeFileSync(join(work, "beans", "defs", `folio-assistant-${id}--b.md`), body);
  }
  git(work, "add", "-A");
  git(work, "commit", "-qm", "seed");
  git(work, "remote", "add", "origin", bare);
  git(work, "push", "-q", bare, "HEAD:refs/heads/main");
  git(work, "fetch", "-q", "origin", "main");
  git(work, "switch", "-qc", "claude/feature");
  return { work, bare };
}

/** Make the remote reject every push, the way a protected branch does. */
function protect(bare: string): void {
  const h = join(bare, "hooks", "pre-receive");
  writeFileSync(h, '#!/bin/sh\necho "remote: error: GH006: Protected branch update failed." >&2\nexit 1\n');
  chmodSync(h, 0o755);
}

const statusOnMain = (work: string, id: string): string =>
  /^status:\s*(\S+)/m.exec(git(work, "show", `origin/main:beans/defs/folio-assistant-${id}--b.md`))?.[1] ?? "";

describe("claiming on the default branch", () => {
  test("a free bean is claimed there, in a commit of its own, without touching the working tree", () => {
    const { work } = repoWith({ aaaa: bean("aaaa") });

    const o = claimOnDefaultBranch("aaaa", "claude/feature", { repo: work });
    expect(o.state).toBe("pushed");
    expect(exitCodeFor(o)).toBe(0);

    git(work, "fetch", "-q", "origin", "main");
    expect(statusOnMain(work, "aaaa")).toBe("in-progress");
    // The claim names its branch — a claim that does not say who made it cannot
    // be told from an abandoned one.
    expect(git(work, "show", "origin/main:beans/defs/folio-assistant-aaaa--b.md")).toContain(
      "Claimed by claude/feature",
    );
    // CLAIM ONLY. Bundled with work it could not be pushed until the work was
    // ready, which is the whole defect.
    const changed = git(work, "show", "--stat", "--format=", "origin/main").split("\n").filter((l) => l.includes("|"));
    expect(changed).toHaveLength(1);
    // A session mid-edit cannot afford a CHECKOUT, and none happens — the commit
    // is built in a temp worktree that is then removed.
    //
    // Bean `24fa`: the claim COMMIT then joins the caller's branch. With nothing
    // of its own yet that is a fast-forward, so the tree is clean and the branch
    // is exactly the claim — no stray uncommitted copy left to conflict later.
    expect(o.joined).toBe("fast-forward");
    expect(git(work, "status", "--porcelain").trim()).toBe("");
    git(work, "fetch", "-q", "origin", "main");
    expect(git(work, "rev-parse", "HEAD").trim()).toBe(git(work, "rev-parse", "origin/main").trim());
    expect(git(work, "worktree", "list").trim().split("\n")).toHaveLength(1);
  });

  test("the claim is in the branch's history, so the branch's own later edit to the bean merges cleanly", () => {
    // #2344, 2026-10-07: the claim landed on main, the branch then completed the
    // same bean, and the PR conflicted on `updated_at` and the end of the body
    // even with the claim's text mirrored byte for byte. A conflicted PR gets no
    // CI at all (#2376). With the claim commit in the branch, the merge base
    // includes it and nothing collides.
    const { work } = repoWith({ mmmm: bean("mmmm") });
    expect(claimOnDefaultBranch("mmmm", "claude/feature", { repo: work }).state).toBe("pushed");
    const f = join(work, "beans", "defs", "folio-assistant-mmmm--b.md");
    const local = readFileSync(f, "utf-8");
    expect(/^status:\s*in-progress\s*$/m.test(local)).toBe(true);
    writeFileSync(f, local.replace(/^status: in-progress$/m, "status: completed").replace(/^updated_at: .*$/m, "updated_at: 2026-10-07T00:00:00Z") + "\n## Summary of Changes\n\nDone.\n");
    git(work, "commit", "-qam", "complete mmmm");
    // Somebody else lands something on main meanwhile.
    git(work, "fetch", "-q", "origin", "main");
    git(work, "merge", "--no-edit", "-q", "origin/main");
    expect(git(work, "status", "--porcelain").trim()).toBe("");
    expect(readFileSync(f, "utf-8")).toContain("status: completed");
  });

  test("a branch with commits of its own gets a MERGE commit, never a rewrite", () => {
    const { work } = repoWith({ nnnn: bean("nnnn") });
    writeFileSync(join(work, "other.txt"), "work\n");
    git(work, "add", "other.txt");
    git(work, "commit", "-qm", "own work");
    const own = git(work, "rev-parse", "HEAD").trim();
    const o = claimOnDefaultBranch("nnnn", "claude/feature", { repo: work });
    expect(o.joined).toBe("merged");
    git(work, "fetch", "-q", "origin", "main");
    const parents = git(work, "rev-list", "--parents", "-n", "1", "HEAD").trim().split(" ").slice(1);
    expect(parents).toEqual([own, git(work, "rev-parse", "origin/main").trim()]);
    expect(describeOutcome(o, "nnnn")).toContain("merge commit");
  });

  test("local edits in the way: the merge is not left half-done, and today's text mirror is the fallback", () => {
    const { work } = repoWith({ pppp: bean("pppp") });
    const f = join(work, "beans", "defs", "folio-assistant-pppp--b.md");
    writeFileSync(f, readFileSync(f, "utf-8") + "\nuncommitted\n");
    const before = git(work, "rev-parse", "HEAD").trim();
    const o = claimOnDefaultBranch("pppp", "claude/feature", { repo: work });
    expect(o.state).toBe("pushed");
    expect(o.joined).toBe("not-joined");
    expect(git(work, "rev-parse", "HEAD").trim()).toBe(before);
    const local = readFileSync(f, "utf-8");
    expect(local).toContain("uncommitted");
    expect(/^status:\s*in-progress\s*$/m.test(local)).toBe(true);
    expect(describeOutcome(o, "pppp")).toContain("NOT in this branch's history");
  });

  test("a bean another branch holds is REFUSED, by name, and nothing is written", () => {
    const { work } = repoWith({ bbbb: bean("bbbb") });
    claimOnDefaultBranch("bbbb", "claude/first", { repo: work });
    git(work, "fetch", "-q", "origin", "main");
    const before = git(work, "rev-list", "--count", "origin/main").trim();

    const o = claimOnDefaultBranch("bbbb", "claude/second", { repo: work });
    expect(o.state).toBe("already-claimed");
    expect(o.heldBy).toBe("claude/first");
    // Answered, not failed: "may I take this" got an answer.
    expect(exitCodeFor(o)).toBe(0);

    git(work, "fetch", "-q", "origin", "main");
    expect(git(work, "rev-list", "--count", "origin/main").trim()).toBe(before);
  });

  test("re-claiming from the same branch is idempotent — no second commit", () => {
    const { work } = repoWith({ cccc: bean("cccc") });
    claimOnDefaultBranch("cccc", "claude/feature", { repo: work });
    git(work, "fetch", "-q", "origin", "main");
    const after1 = git(work, "rev-list", "--count", "origin/main").trim();

    const o = claimOnDefaultBranch("cccc", "claude/feature", { repo: work });
    expect(o.state).toBe("pushed");
    git(work, "fetch", "-q", "origin", "main");
    expect(git(work, "rev-list", "--count", "origin/main").trim()).toBe(after1);
  });

  // ── `in-progress`, nobody recorded — bean `c3d7` ──────────────────────
  //
  // THE ARM NEITHER TEST ABOVE REACHES. Both build their `in-progress` state by
  // calling the tool, which writes a `Claimed by <branch>` note — so neither
  // ever produces the state the real store is almost entirely made of. Measured
  // on `origin/main` 2026-09-25: 97 of the 100 non-epic `in-progress` beans
  // record no holder, because `todo-manager.md` and `session-intent.md` still
  // route a claim through `beans update`, which writes no note.
  //
  // Until `c3d7` that arm returned `pushed`, so the guard against claim-stomping
  // said "✓ claimed — every session can see it now" for 97 % of the beans it was
  // guarding, having pushed nothing.

  test("in-progress with NO recorded holder is its own state, not a claim", () => {
    // Authored directly, the way `beans update <id> --status in-progress`
    // leaves it — not by calling the tool, which is the whole point.
    const { work } = repoWith({ eeee: bean("eeee", "in-progress") });
    git(work, "fetch", "-q", "origin", "main");
    const before = git(work, "rev-list", "--count", "origin/main").trim();

    const o = claimOnDefaultBranch("eeee", "claude/feature", { repo: work });
    expect(o.state).toBe("held-unknown");

    git(work, "fetch", "-q", "origin", "main");
    expect(git(work, "rev-list", "--count", "origin/main").trim()).toBe(before);
  });

  test("...and it is NEVER reported as a successful claim", () => {
    // The defect was the SENTENCE as much as the state: a past-tense claim of a
    // push that did not happen. `already-closed` and `already-claimed` are both
    // refusals a reader can act on; this one must not read as either a success
    // or a determined refusal.
    const { work } = repoWith({ ffff: bean("ffff", "in-progress") });
    const o = claimOnDefaultBranch("ffff", "claude/feature", { repo: work });
    const said = describeOutcome(o, "ffff");
    expect(said).not.toMatch(/every session can see it now/);
    expect(said).not.toMatch(/^claimed /);
    // It says what it could not determine, and names what to do instead.
    expect(said).toMatch(/NOBODY RECORDED A HOLDER/);
    expect(said).toMatch(/open PR list/);
  });

  test("its exit code is neither 'carry on' nor 'remote unreadable'", () => {
    // Not 0: `already-claimed` uses 0 because it tells the caller to pick
    // another item, and this one cannot tell them even that.
    // Not 2: the default branch was read fine — what is unknown is WHO holds
    // the bean, and collapsing the two makes a readable remote look unreadable.
    const { work } = repoWith({ gggg: bean("gggg", "in-progress") });
    const o = claimOnDefaultBranch("gggg", "claude/feature", { repo: work });
    expect(exitCodeFor(o)).toBe(4);
    expect(exitCodeFor(o)).not.toBe(0);
    expect(exitCodeFor(o)).not.toBe(2);
  });

  test("a holder that IS us still claims — the two cases stay apart", () => {
    // The cost of the split, checked rather than assumed. Folding them together
    // was wrong; keeping them apart must not break idempotency, which is the
    // case that made somebody fold them in the first place.
    const { work } = repoWith({ hhhh: bean("hhhh") });
    claimOnDefaultBranch("hhhh", "claude/feature", { repo: work });
    const o = claimOnDefaultBranch("hhhh", "claude/feature", { repo: work });
    expect(o.state).toBe("pushed");
    expect(exitCodeFor(o)).toBe(0);
  });

  test("a REJECTED push falls back loudly — exit 3, branch untouched, worktree cleaned", () => {
    const { work, bare } = repoWith({ dddd: bean("dddd") });
    protect(bare);

    const o = claimOnDefaultBranch("dddd", "claude/feature", { repo: work });
    expect(o.state).toBe("fell-back");
    expect(exitCodeFor(o)).toBe(3);
    expect(o.reason ?? "").toContain("Protected branch");

    git(work, "fetch", "-q", "origin", "main");
    expect(statusOnMain(work, "dddd")).toBe("todo");
    // Cleaned up on the failure path too, or the next run cannot add a worktree.
    expect(git(work, "worktree", "list").trim().split("\n")).toHaveLength(1);
  });

  test("a COMPLETED or SCRAPPED bean is refused — finished work is not re-opened by accident", () => {
    // Found by running `--dry-run` against the real store: the tool offered to
    // claim a `completed` bean without comment. Reviving a scrapped one is worse
    // than reviving a finished one, because `scrapped` exists to record that
    // something was considered and REJECTED.
    const { work } = repoWith({ iiii: bean("iiii", "completed"), jjjj: bean("jjjj", "scrapped") });

    for (const [id, status] of [["iiii", "completed"], ["jjjj", "scrapped"]] as const) {
      const o = claimOnDefaultBranch(id, "claude/feature", { repo: work });
      expect(o.state).toBe("already-closed");
      expect(o.closedAs).toBe(status);
      // Answered, not broken — so exit 0, like `already-claimed`.
      expect(exitCodeFor(o)).toBe(0);
      git(work, "fetch", "-q", "origin", "main");
      expect(statusOnMain(work, id)).toBe(status);
    }
  });

  test("a bean that is NEW on this branch is a determined state, not 'could not tell'", () => {
    const { work } = repoWith({ eeee: bean("eeee") });
    // Created after the branch diverged, so `origin/main` has never seen it.
    writeFileSync(join(work, "beans", "defs", "folio-assistant-ffff--b.md"), bean("ffff"));
    git(work, "add", "-A");
    git(work, "commit", "-qm", "new bean");

    const o = claimOnDefaultBranch("ffff", "claude/feature", { repo: work });
    // Nobody else can see it, so there is nothing to race over — and reporting
    // `unknown` here was the measured wrong answer for `beans create` followed
    // immediately by a claim.
    expect(o.state).toBe("new-on-branch");
    expect(exitCodeFor(o)).toBe(0);
  });

  test("an unreadable remote is exit 2, and never reads as 'the bean is free'", () => {
    const { work } = repoWith({ gggg: bean("gggg") });
    git(work, "remote", "set-url", "origin", join(tmpdir(), "no-such-remote-at-all.git"));

    const o = claimOnDefaultBranch("gggg", "claude/feature", { repo: work });
    expect(o.state).toBe("unknown");
    expect(exitCodeFor(o)).toBe(2);
  });

  test("a bean absent from the store is unknown, not a silent success", () => {
    const { work } = repoWith({ hhhh: bean("hhhh") });
    const o = claimOnDefaultBranch("nope", "claude/feature", { repo: work });
    expect(o.state).toBe("unknown");
    expect(exitCodeFor(o)).toBe(2);
  });
});

describe("absoluteRemote", () => {
  // Measured twice: pushing by remote NAME and by the raw `get-url` value both
  // failed from the temp worktree with "'../remote.git' does not appear to be a
  // git repository", because a relative path resolves against the WORKTREE.
  test("a relative local path is resolved against the repo, not the worktree", () => {
    expect(absoluteRemote("/srv/folio", "../mirror.git")).toBe("/srv/mirror.git");
  });

  test("a URL with a scheme and an scp-form address are left alone", () => {
    for (const u of [
      "https://github.com/litlfred/folio-assistant.git",
      "ssh://git@github.com/litlfred/folio-assistant.git",
      "file:///srv/mirror.git",
      "git@github.com:litlfred/folio-assistant.git",
    ]) {
      expect(absoluteRemote("/srv/folio", u)).toBe(u);
    }
  });
});

describe("a claim from the wrong checkout is refused, not misattributed (ssfp)", () => {
  test("a checkout on a work branch is the right one", () => {
    const { work } = repoWith({ aaaa: bean("aaaa") });
    expect(wrongCheckout(work, "claude/feature")).toBeUndefined();
  });

  test("a checkout on the default branch, or detached, names the tree it would have written to", () => {
    const { work } = repoWith({ aaaa: bean("aaaa") });
    expect(wrongCheckout(work, "main")).toContain(work);
    expect(wrongCheckout(work, "main")).toContain("default branch");
    expect(wrongCheckout(work, "(detached)")).toContain("detached");
  });

  test("the CLI claims from a WORKTREE into that worktree, and refuses from the main checkout", () => {
    // The measured failure: an agent's worktree held the work, the main
    // checkout sat on `main`, and the claim landed in the main checkout.
    const { work } = repoWith({ aaaa: bean("aaaa"), bbbb: bean("bbbb") });
    git(work, "switch", "-q", "main");
    const wt = join(work, "..", "wt");
    git(work, "worktree", "add", "-q", "-b", "claude/agent", wt);
    const script = join(import.meta.dir, "..", "claim-bean.ts");
    const run = (cwd: string, id: string) => spawnSync("bun", ["run", script, id], { cwd, encoding: "utf-8" });

    const fromMain = run(work, "aaaa");
    expect(fromMain.status).toBe(5);
    expect(fromMain.stderr).toContain(work);
    expect(readFileSync(join(work, "beans", "defs", "folio-assistant-aaaa--b.md"), "utf8")).toContain("status: todo");

    const fromWorktree = run(join(wt, "beans"), "bbbb");
    expect(fromWorktree.status).toBe(0);
    expect(fromWorktree.stdout).toContain(`claiming from ${wt}`);
    expect(readFileSync(join(wt, "beans", "defs", "folio-assistant-bbbb--b.md"), "utf8")).toContain("status: in-progress");
    // The main checkout is untouched — no stray claim left as dirt.
    expect(readFileSync(join(work, "beans", "defs", "folio-assistant-bbbb--b.md"), "utf8")).toContain("status: todo");
  });
});

describe("mirrorClaimNote — bean `24fa`", () => {
  /** A minimal two-store fixture: what was pushed, and the local branch. */
  const fixture = (localBody: string, pushedNote: string) => {
    const root = mkdtempSync(join(tmpdir(), "mirror-note-"));
    const work = join(root, "work");
    const repo = join(root, "repo");
    const name = "folio-assistant-zz11--a-bean-to-claim.md";
    for (const d of [work, repo]) {
      mkdirSync(join(d, "beans", "defs"), { recursive: true });
      // `findBean` resolves the store from `.beans.yml`; without it the fixture
      // has no store and every lookup is a miss.
      writeFileSync(
        join(d, ".beans.yml"),
        "beans:\n    path: beans/defs\n    prefix: folio-assistant-\n    id_length: 4\n    default_status: todo\n    default_type: task\n",
      );
    }
    writeFileSync(join(work, "beans", "defs", name), `${BEAN_FM}\nBody.\n${pushedNote === "" ? "" : `\n${pushedNote}\n`}`, "utf-8");
    writeFileSync(join(repo, "beans", "defs", name), `${BEAN_FM}\n${localBody}`, "utf-8");
    return { repo, work, file: join(repo, "beans", "defs", name) };
  };

  const NOTE = "_2026-10-03T00:27:48Z_ — Claimed by claude/x — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).";

  test("copies the pushed note onto the local branch byte for byte", () => {
    const { repo, work, file } = fixture("Body.\n", NOTE);
    expect(mirrorClaimNote(repo, work, "zz11")).toBe("mirrored");
    // Byte-identical is the whole point: re-running `noteBean` here would
    // stamp a different second and git would see two different additions.
    expect(readFileSync(file, "utf-8")).toContain(NOTE);
  });

  test("is idempotent — a second claim does not append the note twice", () => {
    const { repo, work, file } = fixture(`Body.\n\n${NOTE}\n`, NOTE);
    expect(mirrorClaimNote(repo, work, "zz11")).toBe("already-there");
    const body = readFileSync(file, "utf-8");
    expect(body.split(NOTE).length - 1).toBe(1);
  });

  test("the branch's own later edits stay AFTER the note, which is what fixes the body conflict", () => {
    const { repo, work, file } = fixture("Body.\n", NOTE);
    expect(mirrorClaimNote(repo, work, "zz11")).toBe("mirrored");
    writeFileSync(file, `${readFileSync(file, "utf-8")}\n## Summary of Changes\n\nDone.\n`, "utf-8");
    const body = readFileSync(file, "utf-8");
    // Guard the guard: without this the assertion below passes on indexOf === -1,
    // which is the note being ABSENT — the opposite of what it claims to show.
    expect(body).toContain(NOTE);
    expect(body.indexOf(NOTE)).toBeLessThan(body.indexOf("## Summary of Changes"));
  });

  test("reports `no-note` rather than guessing when nothing was pushed", () => {
    // Could-not-determine is never rendered as done — the file's own rule.
    const { repo, work } = fixture("Body.\n", "");
    expect(mirrorClaimNote(repo, work, "zz11")).toBe("no-note");
  });
});
