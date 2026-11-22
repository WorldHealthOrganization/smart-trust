/**
 * `claimOnBranchStore` — claiming after the cutover, and the race it catches.
 *
 * Bean `9ofm`; the blocker #2052 named. Against a REAL branch store over a
 * local bare repository: the whole claim is about what two writers do to one
 * tip, and a stub of the store would assert the stub.
 *
 * @module scripts/tests/claim-branch-store
 */
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BranchStore } from "../../branch-store.ts";
import { appendNoteToText, setFieldInText } from "../../beans-fallback.ts";
import { claimOnBranchStore } from "../../claim-bean.ts";

// Every test here builds a bare remote, clones it, and pushes through a real
// `git` — about twenty subprocesses, the race test two stores' worth. That is
// the point (the conflict must be git's, not a mock's), and it does not fit
// bun's 5 s default on a shared runner: the race test took 6.1 s on main's
// own run for #2061 and 6.8 s on #1801's, red both times for nobody's defect.
setDefaultTimeout(30_000);

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const BRANCH = "cat/cat-harness/beans";
const ID = "fx-aaaa";
const FILE = `${ID}--a-bean.md`;
const BEAN = `---\n# ${ID}\ntitle: a bean\nstatus: todo\ntype: task\ncreated_at: 2026-10-01T00:00:00Z\nupdated_at: 2026-10-01T00:00:00Z\n---\n\nbody\n`;

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  expect(`${args[0]} -> ${r.status}: ${r.stderr}`).toBe(`${args[0]} -> 0: ${r.stderr}`);
}

/** A checkout declaring `beans` tip-keyed, plus a bare remote carrying the graph. */
function world(status = "todo"): { repo: string; url: string; storeDir: string } {
  const base = mkdtempSync(join(tmpdir(), "claim-bs-"));
  made.push(base);
  const url = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", url);

  // Build the branch: manifest at the root, the graph under `beans/`.
  const work = join(base, "seed");
  git(base, "clone", "-q", url, work);
  writeFileSync(join(work, "manifest.json"), JSON.stringify({ $schema: "state-manifest/v1", status: "store", authoritative: true, keyedBy: "tip" }, null, 2) + "\n");
  mkdirSync(join(work, "beans", "defs"), { recursive: true });
  writeFileSync(join(work, "beans", "beans.json"), JSON.stringify({ name: "f", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }));
  writeFileSync(join(work, "beans", "defs", FILE), BEAN.replace("status: todo", `status: ${status}`));
  git(work, "add", "-A");
  git(work, "commit", "-qm", "seed");
  git(work, "push", "-q", "origin", `HEAD:refs/heads/${BRANCH}`);

  // The checkout: declares `beans` on that branch, files NOT tracked (cut over).
  const repo = join(base, "checkout");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  git(repo, "remote", "add", "origin", url);
  writeFileSync(
    join(repo, "fixture.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: { branch: BRANCH, keyedBy: "tip" } }] }, null, 2),
  );
  return { repo, url, storeDir: join(base, "store.git") };
}

function tipText(w: ReturnType<typeof world>): string {
  const s = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: w.storeDir, log: () => {} });
  const r = s.readFile(`beans/defs/${FILE}`);
  if (r.state !== "hit") throw new Error(`could not read back: ${r.reason}`);
  return r.text;
}

/** Timestamps differ by construction; everything else must match exactly. */
const normalise = (t: string): string => t.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<T>").replace(/_\d[^_]*_/g, "_<T>_");

/** Budget for a test that drives two clones of one remote (see below). */
const GIT_HEAVY_MS = 30_000;

describe("claiming on the branch store", () => {
  test("a clean claim lands on the tip, in-progress, with the claim note", () => {
    const w = world();
    const r = claimOnBranchStore(ID, "my-branch", { repo: w.repo });
    expect(r.state).toBe("pushed");

    const after = tipText(w);
    expect(after).toContain("status: in-progress");
    expect(after).toContain("Claimed by my-branch");
    expect(after).toContain("bean 35nj");
  });

  test("the bytes are the SAME TRANSFORM the filesystem writer uses — not a second spelling", () => {
    const w = world();
    expect(claimOnBranchStore(ID, "my-branch", { repo: w.repo }).state).toBe("pushed");

    const expected = appendNoteToText(
      setFieldInText(BEAN, "status", "in-progress"),
      "Claimed by my-branch — pushed to cat/cat-harness/beans so sibling sessions see it before this branch has a PR (bean 35nj).",
    );
    expect(normalise(tipText(w))).toBe(normalise(expected));
  });

  // These two open a SECOND clone of the remote and push from both sides:
  // real git, several processes each. Locally they finish well inside bun's
  // 5 s default; on a loaded CI runner the second took 6.1-6.5 s and timed
  // out (main, 2026-10-04, runs 37186849743 and 37187288682). The limit is a
  // budget for real I/O, not a retry: the assertions are unchanged.
  test("A SIBLING THAT WROTE FIRST IS A CONFLICT, caught on the first attempt — bean 35nj", () => {
    const w = world();

    // The sibling: same bean, different branch, written straight to the tip
    // between this reader's read and its write.
    const sib = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.storeDir, "..", "sib.git"), log: () => {} });
    const before = sib.readFile(`beans/defs/${FILE}`);
    if (before.state !== "hit") throw new Error("fixture");
    const theirs = appendNoteToText(setFieldInText(before.text, "status", "in-progress"), "Claimed by their-branch — …");
    expect(sib.write([{ path: `beans/defs/${FILE}`, content: theirs, expect: before.blob }], "sibling claims").state).toBe("pushed");

    // Now ours. The tip already says in-progress, so it is reported as held —
    // which is the race PREVENTED rather than merely survived.
    const r = claimOnBranchStore(ID, "my-branch", { repo: w.repo });
    expect(r.state).toBe("already-claimed");
    expect(r.heldBy).toBe("their-branch");
    // And the sibling's claim is intact: no lost write.
    expect(tipText(w)).toContain("Claimed by their-branch");
    expect(tipText(w)).not.toContain("Claimed by my-branch");
  }, GIT_HEAVY_MS);

  test("THE REAL CONFLICT: a sibling writes BETWEEN our read and our write — `expect` catches it", () => {
    const w = world();
    let raced = false;

    // `beforePush` fires after this claim has read the tip and built its
    // change, and before it pushes — the exact window `expect` exists to
    // close. Without staging it here the conflict branch is unreachable and
    // "the conflict IS the race detection" would be an untested assertion.
    const r = claimOnBranchStore(ID, "my-branch", {
      repo: w.repo,
      store: {
        remote: w.url,
        storeDir: w.storeDir,
        beforePush: () => {
          if (raced) return;
          raced = true;
          const sib = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.storeDir, "..", "sib2.git"), log: () => {} });
          const b = sib.readFile(`beans/defs/${FILE}`);
          if (b.state !== "hit") throw new Error("fixture");
          const theirs = appendNoteToText(setFieldInText(b.text, "status", "in-progress"), "Claimed by their-branch — …");
          expect(sib.write([{ path: `beans/defs/${FILE}`, content: theirs, expect: b.blob }], "sibling slips in").state).toBe("pushed");
        },
      },
    });

    expect(raced).toBe(true);
    expect(r.state).toBe("already-claimed");
    expect(r.reason).toContain("between this read and this write");
    // NOTHING WAS LOST: the sibling's claim is what stands on the tip.
    const after = tipText(w);
    expect(after).toContain("Claimed by their-branch");
    expect(after).not.toContain("Claimed by my-branch");
  }, GIT_HEAVY_MS);

  test("already in-progress with no readable holder is `held-unknown`, never a silent pass", () => {
    const w = world("in-progress");
    const r = claimOnBranchStore(ID, "my-branch", { repo: w.repo });
    expect(r.state).toBe("held-unknown");
  });

  test("a closed bean is `already-closed`, carrying the status it was closed as", () => {
    const w = world("completed");
    const r = claimOnBranchStore(ID, "my-branch", { repo: w.repo });
    expect(r).toMatchObject({ state: "already-closed", closedAs: "completed" });
  });

  test("`dry-run` reports without writing", () => {
    const w = world();
    const r = claimOnBranchStore(ID, "my-branch", { repo: w.repo, dryRun: true });
    expect(r.state).toBe("pushed");
    expect(r.reason).toContain("would claim");
    expect(tipText(w)).toContain("status: todo");
  });

  test("an unknown id is `unknown` with a reason, not a claim of something else", () => {
    const w = world();
    const r = claimOnBranchStore("nope", "my-branch", { repo: w.repo });
    expect(r.state).toBe("unknown");
    expect(r.reason).toContain('no bean matching "nope"');
  });

  test("`fell-back` is NEVER returned here — after the cutover a PR branch has no beans/ to hold a claim", () => {
    const w = world();
    for (const st of ["todo", "in-progress", "completed"]) {
      const r = claimOnBranchStore(ID, "b", { repo: world(st).repo });
      expect(r.state).not.toBe("fell-back");
    }
    expect(claimOnBranchStore("nope", "b", { repo: w.repo }).state).not.toBe("fell-back");
  });
});
