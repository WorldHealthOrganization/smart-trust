/**
 * The merge queue's store — four read states, and the two gates that could not
 * see a from-within graph.
 *
 * Bean `najo`. Against real git, a real declaration and a real mount marker,
 * for `graph-read.test.ts`'s reason: the question "what does this checkout
 * know" is answered by git and the marker, and a stub of either asserts the
 * stub.
 *
 * @module scripts/tests/merge-queue-store
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MOUNT_MARKER_SCHEMA, markerPath } from "../../branch-store.ts";
import { auditNested, tipPresence } from "../../check-declared-dirs.ts";
import { graphReadPath } from "../../graph-read.ts";
import { entryFileName, readQueueEntries, readQueueStore, recordDecision } from "../../merge-queue-store.ts";
import { MERGE_QUEUE_ENTRY_TAG } from "../../../schemas/sdlc/merge-queue.ts";
import { nestedDirectories, readDeclaration } from "../../../schemas/kg/cat-harness.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const BRANCH = "cat/cat-harness/merge-queue";
const TIP = { kind: "branch", branch: BRANCH, keyedBy: "tip" } as const;

function git(root: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(`${args.join(" ")} -> ${r.status}`).toBe(`${args.join(" ")} -> 0`);
}

/** A git repository whose layer declares exactly `dirs`. */
function repo(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "mq-store-"));
  made.push(root);
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }, null, 2));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@t");
  git(root, "config", "user.name", "t");
  return root;
}

/**
 * The live shape: the queue declared FROM WITHIN `beans/beans.json`, marked
 * `"subgraph": true` so `resolveDirectories` lists it (bean `cmsl`).
 */
function nestedRepo(entry: Record<string, unknown>): string {
  const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"] }]);
  mkdirSync(join(root, "beans"), { recursive: true });
  writeFileSync(
    join(root, "beans", "beans.json"),
    JSON.stringify({ name: "fixture", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }, entry] }, null, 2),
  );
  mkdirSync(join(root, "beans", "defs"), { recursive: true });
  return root;
}

function mount(root: string, id: string, path: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const p = markerPath(root, id);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id, branch: BRANCH, path, into, tip: "0".repeat(40), files: {} }));
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

describe("the four read states", () => {
  test("absent — no instance declares a merge-queue directory, and nothing claims one", () => {
    const root = repo([{ id: "beans", path: "beans/", graphTypologies: ["beans"] }]);
    expect(readQueueStore(root)).toEqual({ state: "absent", dir: null });
    // `null`, not a throw: an unmigrated folio has no queue, which is fine.
    expect(readQueueEntries(root)).toBeNull();
  });

  test("declared-but-absent — a checkout directory the declaration names and the disk has not got", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"] }]);
    const s = readQueueStore(root);
    expect(s.state).toBe("declared-but-absent");
    // And NOT a throw: the remedy here is to create it or fix the declaration,
    // which is a different remedy from mounting a branch.
    expect(readQueueEntries(root)).toBeNull();
  });

  test("unreachable — on the branch, nothing mounted: a REASON, and readQueueEntries THROWS", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"], source: TIP }]);
    const s = readQueueStore(root);
    expect(s.state).toBe("unreachable");
    if (s.state !== "unreachable") throw new Error("unreachable");
    expect(s.dir).toBeNull();
    expect(s.reason).toContain("state:mount");
    // THE POINT OF THE WHOLE MODULE. An empty array here is the sentence
    // "no decisions recorded, all clear" printed over a graph nobody read.
    expect(() => readQueueEntries(root)).toThrow(/cannot read the merge queue/);
  });

  test("read — entries, what was skipped, and a files count that is not a restatement", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"] }]);
    const dir = join(root, "beans", "queue");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, entryFileName(ENTRY.repository, ENTRY.pr)), JSON.stringify(ENTRY));
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ $schema: "state-manifest/v1", keyedBy: "tip" }));
    writeFileSync(join(dir, "broken.json"), JSON.stringify({ ...ENTRY, pr: -1 }));
    writeFileSync(join(dir, "README.md"), "# not json\n");
    const s = readQueueStore(root);
    if (s.state !== "read") throw new Error(`expected read, got ${s.state}`);
    expect(s.entries.map((e) => e.entry.pr)).toEqual([2065]);
    // The reserved file is EXPECTED; the malformed entry is not, and is
    // reported rather than dropped — a decision a steward believes it recorded.
    expect(s.skipped.find((x) => x.file === "manifest.json")?.expected).toBe(true);
    expect(s.skipped.find((x) => x.file === "broken.json")?.expected).toBe(false);
    expect(s.filesSeen).toBe(3);
    expect(s.entries.length + s.skipped.length).toBe(s.filesSeen);
  });

  test("a GitHub fact is refused BY NAME, so the queue cannot acquire a second answer to CI", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"], source: TIP }]);
    const r = recordDecision({ ...ENTRY, headSha: "a".repeat(40) }, { root });
    expect(r.state).toBe("refused");
    if (r.state !== "refused") throw new Error("refused");
    expect(r.reason).toContain("headSha");
  });
});

describe("the live shape: declared FROM WITHIN, and cut over", () => {
  test("graphReadPath resolves the from-within entry by its OWN id, and the store reads its mount", () => {
    const root = nestedRepo({ id: "queue", path: "queue", subgraph: true, source: TIP, graphTypologies: ["merge-queue"] });
    const into = join(root, "beans", "queue");
    mount(root, "queue", "beans/queue", into);
    const where = graphReadPath("queue", root);
    expect(where.state === "ok" && where.from).toBe("mount");
    writeFileSync(join(into, entryFileName(ENTRY.repository, ENTRY.pr)), JSON.stringify(ENTRY));
    const s = readQueueStore(root);
    if (s.state !== "read") throw new Error(`expected read, got ${s.state}`);
    expect(s.id).toBe("queue");
    expect(s.dir).toBe(into);
    expect(s.entries).toHaveLength(1);
  });

  test("a MOUNTED from-within graph no longer reports as `unmounted` — the najo regression", () => {
    const root = nestedRepo({ id: "queue", path: "queue", subgraph: true, source: TIP, graphTypologies: ["merge-queue"] });
    const into = join(root, "beans", "queue");
    mount(root, "queue", "beans/queue", into);

    // The composed id is what `nestedDirectories` reports under, and
    // `markerPath` refuses it outright. Asking with it used to be "could not
    // determine", rendered as `unmounted` — the defect. `tipPresence` now finds
    // a mount by its declared PATH first (an id several layers share is
    // filed under `<instance>.<id>`), so even the composed id sees the mount.
    const nested = nestedDirectories(root, readDeclaration(root)!)!.find((n) => n.ownId === "queue")!;
    expect(nested.id).toBe("beans/queue");
    expect(nested.ownId).toBe("queue");
    expect(nested.subgraph).toBe(true);
    expect(tipPresence({ id: nested.id, branch: BRANCH, keyedBy: "tip" }, into, root)).toEqual({ state: "mounted", into });
    // Asked with the id the MOUNT is keyed on, it is seen for what it is.
    expect(tipPresence({ id: nested.id, branch: BRANCH, keyedBy: "tip" }, into, root, nested.ownId)).toEqual({
      state: "mounted",
      into,
    });
    // And the gate agrees, which is the behaviour a reader actually sees.
    expect(auditNested(root, root, readDeclaration(root) as never)).toEqual([]);
  });

  test("a branch source on an entry NO mount can reach is `unmountable`, not `unmounted`", () => {
    // No `"subgraph": true`, so `resolveDirectories` never lists it,
    // `tipLocations` never sees it and `state:mount` cannot reach it. Printing
    // "mount it" would be a remedy that does nothing.
    const root = nestedRepo({ id: "queue", path: "queue", source: TIP, graphTypologies: ["merge-queue"] });
    const findings = auditNested(root, root, readDeclaration(root) as never);
    expect(findings.map((f) => f.kind)).toEqual(["unmountable"]);
    expect(findings[0]!.detail).toContain('"subgraph": true');
    expect(findings[0]!.detail).not.toContain("state:mount`)");
  });
});

describe("recording a decision", () => {
  test("refuses when the graph is not mounted, rather than writing where no push reaches", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"], source: TIP }]);
    const r = recordDecision(ENTRY, { root, push: false });
    expect(r.state).toBe("refused");
    if (r.state !== "refused") throw new Error("refused");
    expect(r.reason).toContain("not mounted");
  });

  test("refuses when the path is the CHECKOUT's own, because that write would be a commit on this branch", () => {
    const root = repo([{ id: "queue", path: "beans/queue/", graphTypologies: ["merge-queue"] }]);
    mkdirSync(join(root, "beans", "queue"), { recursive: true });
    const r = recordDecision(ENTRY, { root, push: false });
    expect(r.state).toBe("refused");
    if (r.state !== "refused") throw new Error("refused");
    expect(r.reason).toContain("pull request");
  });

  test("writes the entry into the mount, named for its repository and pull request", () => {
    const root = nestedRepo({ id: "queue", path: "queue", subgraph: true, source: TIP, graphTypologies: ["merge-queue"] });
    const into = join(root, "beans", "queue");
    mount(root, "queue", "beans/queue", into);
    const r = recordDecision(ENTRY, { root, push: false });
    if (r.state !== "written") throw new Error(`expected written, got ${r.state}`);
    expect(r.file).toBe("litlfred--folio-assistant--2065.json");
    expect(r.push).toBe("skipped");
    // Read back through the store, so the round trip is what is asserted
    // rather than the bytes this test wrote.
    const s = readQueueStore(root);
    if (s.state !== "read") throw new Error(`expected read, got ${s.state}`);
    expect(s.entries[0]!.entry.decidedBy).toBe(ENTRY.decidedBy);
  });

  test("an override with no reason is refused — the schema's one hard refusal, through the writer", () => {
    const root = nestedRepo({ id: "queue", path: "queue", subgraph: true, source: TIP, graphTypologies: ["merge-queue"] });
    mount(root, "queue", "beans/queue", join(root, "beans", "queue"));
    const r = recordDecision({ ...ENTRY, placement: { kind: "override", position: 1 } }, { root, push: false });
    expect(r.state).toBe("refused");
  });
});
