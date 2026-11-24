/**
 * Recording a decision reaches the BRANCH — through real git, with no pull
 * request anywhere in it.
 *
 * Bean `najo`. The claim this change rests on is that a steward can record a
 * decision without opening a PR to `main`, and that claim is about a push. So
 * it is measured against a local bare remote, the way
 * `claim-branch-store.test.ts` measures a claim: the conflict has to be git's,
 * not a mock's, and a test that stubbed the push would assert the stub.
 *
 * @module scripts/tests/merge-queue-push
 */
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BranchStore, mountTip } from "../../branch-store.ts";
import { MERGE_QUEUE_ENTRY_TAG } from "../../../schemas/sdlc/merge-queue.ts";
import { readQueueStore, recordDecision } from "../../merge-queue-store.ts";

// Each test builds a bare remote, seeds the branch, mounts it and pushes
// through real git — a dozen-odd subprocesses, which does not fit bun's 5 s
// default on a contended runner. `claim-branch-store.test.ts` carries the same
// line and the measurement behind it.
setDefaultTimeout(30_000);

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const BRANCH = "cat/cat-harness/merge-queue";

function git(cwd: string, ...args: string[]): void {
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env });
  expect(`${args[0]} -> ${r.status}: ${r.stderr}`).toBe(`${args[0]} -> 0: ${r.stderr}`);
}

/** A checkout whose `queue` entry is cut over, plus a bare remote carrying the branch. */
function world(): { repo: string; url: string; storeDir: string; base: string } {
  const base = mkdtempSync(join(tmpdir(), "mq-push-"));
  made.push(base);
  const url = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", url);

  // The branch: the manifest at the root, the graph at the path it has in the
  // checkout — the layout `branch-store.ts` documents and `state:mount` reads.
  const seed = join(base, "seed");
  git(base, "clone", "-q", url, seed);
  writeFileSync(
    join(seed, "manifest.json"),
    JSON.stringify({ $schema: "state-manifest/v1", status: "store", authoritative: true, keyedBy: "tip" }, null, 2) + "\n",
  );
  mkdirSync(join(seed, "beans", "queue"), { recursive: true });
  writeFileSync(join(seed, "beans", "queue", "README.md"), "# Merge queue\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-qm", "seed");
  git(seed, "push", "-q", "origin", `HEAD:refs/heads/${BRANCH}`);

  // The checkout: declares the queue FROM WITHIN `beans/beans.json`, marked
  // `"subgraph": true`, with the files NOT tracked here — the live shape.
  const repo = join(base, "checkout");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  git(repo, "remote", "add", "origin", url);
  writeFileSync(
    join(repo, "fixture.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] }, null, 2),
  );
  mkdirSync(join(repo, "beans"), { recursive: true });
  writeFileSync(
    join(repo, "beans", "beans.json"),
    JSON.stringify({
      name: "fixture",
      directories: [
        { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
        { id: "queue", path: "queue", subgraph: true, source: { kind: "branch", branch: BRANCH, keyedBy: "tip" }, graphTypologies: ["merge-queue"] },
      ],
    }),
  );
  return { repo, url, storeDir: join(base, "store.git"), base };
}

const ENTRY = {
  $schema: MERGE_QUEUE_ENTRY_TAG,
  repository: "litlfred/folio-assistant",
  pr: 2065,
  placement: { kind: "computed", decision: "merge-priority.dmn#Decision_MergePriority", rule: "Rule_X", class: "standard", rank: 3 },
  reason: "clean, green, oldest",
  decidedBy: "https://claude.ai/code/session_x",
  decidedAt: "2026-10-04T08:00:00Z",
  beans: ["folio-assistant-najo"],
};

describe("a decision reaches the branch without a pull request", () => {
  test("mount, record, push — and the entry is on the tip, read back through a second store", () => {
    const w = world();
    const opts = { repoRoot: w.repo, store: { remote: w.url, storeDir: w.storeDir, log: () => {} } };
    const m = mountTip({ id: "queue", path: "beans/queue", branch: BRANCH, keyedBy: "tip" }, opts);
    expect(m.state).toBe("mounted");

    const r = recordDecision(ENTRY, { root: w.repo, store: { remote: w.url, storeDir: w.storeDir, log: () => {} } });
    if (r.state !== "written") throw new Error(`expected written, got ${r.state}: ${r.reason}`);
    expect(r.push === "skipped" ? "skipped" : r.push.state).toBe("pushed");

    // Read back from a SEPARATE store over the same remote: what the next
    // steward would see, rather than what this process left on its own disk.
    const sib = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.base, "sib.git"), log: () => {} });
    const onTip = sib.readJson<typeof ENTRY>(`beans/queue/${r.file}`);
    if (onTip.state !== "hit") throw new Error(`could not read back: ${onTip.reason}`);
    expect(onTip.value.pr).toBe(2065);
    expect(onTip.value.decidedBy).toBe(ENTRY.decidedBy);

    // And no commit was made on the checkout's own branch — the whole point.
    const log = spawnSync("git", ["log", "--oneline", "-1"], { cwd: w.repo, encoding: "utf-8" });
    expect(log.status).not.toBe(0);
  });

  test("a sibling's write to the SAME entry is a conflict, and nothing is pushed over it", () => {
    const w = world();
    const opts = { repoRoot: w.repo, store: { remote: w.url, storeDir: w.storeDir, log: () => {} } };
    mountTip({ id: "queue", path: "beans/queue", branch: BRANCH, keyedBy: "tip" }, opts);

    // A sibling steward lands its own decision for the same PR after this
    // mount was taken, so what the tip holds is not what this mount read.
    const sib = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.base, "sib.git"), log: () => {} });
    const theirs = { ...ENTRY, reason: "the sibling's reason", decidedBy: "https://claude.ai/code/session_y" };
    const wrote = sib.write(
      [{ path: "beans/queue/litlfred--folio-assistant--2065.json", content: JSON.stringify(theirs, null, 2) + "\n", expect: null }],
      "queue: the sibling",
    );
    expect(wrote.state).toBe("pushed");

    const r = recordDecision(ENTRY, { root: w.repo, store: { remote: w.url, storeDir: w.storeDir, log: () => {} } });
    if (r.state !== "written") throw new Error(`expected written, got ${r.state}`);
    expect(r.push === "skipped" ? "skipped" : r.push.state).toBe("conflict");

    // THE SIBLING'S DECISION SURVIVED. A conflict is a finding, not a loss:
    // the local edit is still the only copy of this steward's version, and the
    // tip still carries the other one rather than a silent overwrite.
    const after = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.base, "sib2.git"), log: () => {} });
    const onTip = after.readJson<typeof ENTRY>("beans/queue/litlfred--folio-assistant--2065.json");
    if (onTip.state !== "hit") throw new Error(`could not read back: ${onTip.reason}`);
    expect(onTip.value.decidedBy).toBe("https://claude.ai/code/session_y");
    // ...and the refused write is still in the mount, for the steward to redo.
    const store = readQueueStore(w.repo);
    if (store.state !== "read") throw new Error(`expected read, got ${store.state}`);
    expect(store.entries[0]!.entry.decidedBy).toBe(ENTRY.decidedBy);
  });
});
