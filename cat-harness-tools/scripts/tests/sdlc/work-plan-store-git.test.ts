/**
 * The git state branch Tool, held to the work-plan store's conformance suite.
 *
 * cat-harness#991, step 2. The Tool is what every checkout uses today: beans
 * as files under `beans/defs/` on a `cat/<harness>/beans` branch, written
 * through {@link BranchStore}. Its `expect` (the blob id the writer read) is
 * the contract's `ifMatch`, and a push that finds a different blob is refused
 * as `conflict` — the race guarantee, done by git rather than by a mock of it.
 *
 * The adapter below is the operations performed the way this Tool performs
 * them (`work-plan-store-git-branch` in cat-harness), with the same text
 * transforms the filesystem writer uses ({@link setFieldInText},
 * {@link appendNoteToText}), so a bean it writes reads back under the `beans`
 * CLI. The engine uses the same Tool on its mount
 * (`src/workflow/work-plan-store-git-mount.ts`, held to this suite in
 * `work-plan-store-git-mount.test.ts`); this one writes the branch directly,
 * which is what the race needs.
 *
 * @module scripts/tests/sdlc/work-plan-store-git
 */
import { afterAll, expect, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { MemoryEntry, MemoryScope } from "../../../schemas/kg/memory-record.ts";
import { BranchStore } from "../../branch-store.ts";
import { appendNoteToText, setFieldInText } from "../../beans-fallback.ts";
import { BeanStatusSchema } from "../../../schemas/tools/tool-types.ts";
import {
  admits,
  beansAtIn,
  keepOn,
  openOn,
  recallOn,
  positionsIn,
  parseBeanText,
  refuseWrite,
  renderBeanText,
  resolveId,
  setSequenceInText,
  slugifyTitle,
  versionOf,
  type HistoryEvent,
  type InstanceLike,
  type Position,
} from "../../../src/workflow/work-plan-store.ts";
import { beanVersions, branchReader, historyFrom } from "../../../src/workflow/work-plan-store-history.ts";
import {
  workPlanStoreConformance,
  type BeanChange,
  type BeanFields,
  type BeanFilter,
  type Got,
  type Refusal,
  type StoreUnderTest,
} from "./work-plan-store-conformance.ts";

// Real git, two clones of one bare remote, several subprocesses per operation
// (see claim-branch-store.test.ts for the measured cost on CI).
const GIT_MS = 60_000;
setDefaultTimeout(GIT_MS);

const BRANCH = "cat/cat-harness/beans";
const DEFS = "beans/defs";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
  expect(`${args[0]} -> ${r.status}: ${r.stderr}`).toBe(`${args[0]} -> 0: ${r.stderr}`);
}

/** A bare remote carrying an empty, tip-keyed beans branch, and a checkout declaring it. */
function world(): { repo: string; url: string; base: string } {
  const base = mkdtempSync(join(tmpdir(), "wps-git-"));
  made.push(base);
  const url = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", url);

  const seed = join(base, "seed");
  git(base, "clone", "-q", url, seed);
  writeFileSync(join(seed, "manifest.json"), JSON.stringify({ $schema: "state-manifest/v1", status: "store", authoritative: true, keyedBy: "tip" }, null, 2) + "\n");
  mkdirSync(join(seed, DEFS), { recursive: true });
  writeFileSync(join(seed, "beans", "beans.json"), JSON.stringify({ name: "f", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }));
  writeFileSync(join(seed, DEFS, "README.md"), "The beans.\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-qm", "seed");
  git(seed, "push", "-q", "origin", `HEAD:refs/heads/${BRANCH}`);

  const repo = join(base, "checkout");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "remote", "add", "origin", url);
  writeFileSync(
    join(repo, "fixture.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: { branch: BRANCH, keyedBy: "tip" } }] }, null, 2),
  );
  return { repo, url, base };
}

// ---------------------------------------------------------------------------
// The Tool, on the branch itself.

const STATUSES = new Set<string>(BeanStatusSchema.options);
const ARCHIVE = `${DEFS}/archive`;
const WORKFLOWS = "beans/workflows";

type Entry = { path: string; blob: string; text: string; bean: BeanFields };

class GitBranchStore implements StoreUnderTest {
  constructor(private readonly s: BranchStore) {}

  private dir(path: string, archived: boolean, out: Map<string, Entry>): void {
    const d = this.s.listDir(path);
    if (d.state === "miss" && archived) return;
    if (d.state !== "hit") throw new Error(`cannot read ${path}: ${d.reason}`);
    for (const e of d.entries) {
      if (e.type !== "blob" || !e.name.endsWith(".md") || !e.name.includes("--")) continue;
      const file = `${path}/${e.name}`;
      const r = this.s.readFile(file);
      if (r.state !== "hit") throw new Error(`cannot read ${file}: ${r.reason}`);
      const bean = parseBeanText(r.text);
      if (bean && !out.has(bean.id)) out.set(bean.id, { path: file, blob: r.blob, text: r.text, bean: archived ? { ...bean, archived: true } : bean });
    }
  }

  /** Every bean at the tip, `defs/` then `defs/archive/`. */
  private all(): Map<string, Entry> {
    const out = new Map<string, Entry>();
    this.dir(DEFS, false, out);
    this.dir(ARCHIVE, true, out);
    return out;
  }

  private fields(all: Map<string, Entry>): Map<string, BeanFields> {
    return new Map([...all].map(([k, v]) => [k, v.bean]));
  }

  get(id: string): Got {
    const all = this.all();
    const key = resolveId(all.keys(), id);
    if (!key) return { state: "none" };
    const e = all.get(key)!;
    return { state: "hit", bean: e.bean, version: e.blob };
  }

  list(filter: BeanFilter = {}): BeanFields[] {
    return [...this.all().values()]
      .map((e) => e.bean)
      .filter((b) => admits(filter, b))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  create(bean: BeanFields): { state: "created"; version: string } | Refusal {
    const all = this.all();
    const refused = refuseWrite(this.fields(all), bean, STATUSES);
    if (refused) return refused;
    if (all.has(bean.id)) return { state: "refused", why: "exists", detail: bean.id };
    const path = `${bean.archived ? ARCHIVE : DEFS}/${bean.id}--${slugifyTitle(bean.title)}.md`;
    const text = renderBeanText(bean, new Date().toISOString().replace(/\.\d+Z$/, "Z"));
    // `expect: null` — the path must not exist at the tip. A sibling that
    // created the same id between our read and our push makes this a conflict.
    const w = this.s.write([{ path, content: text, expect: null }], `create ${bean.id}`);
    if (w.state === "conflict") return { state: "refused", why: "exists", detail: `${bean.id} was created by another writer` };
    if (w.state !== "pushed") throw new Error(`create ${bean.id}: ${w.state} — ${w.reason}`);
    return { state: "created", version: versionOf(text) };
  }

  update(id: string, change: BeanChange, ifMatch: string): { state: "updated"; version: string } | Refusal | { state: "none" } {
    const all = this.all();
    const key = resolveId(all.keys(), id);
    if (!key) return { state: "none" };
    const e = all.get(key)!;
    if (e.blob !== ifMatch) return { state: "refused", why: "stale", detail: `${key} is at ${e.blob.slice(0, 12)}, not ${ifMatch.slice(0, 12)}` };
    const refused = refuseWrite(this.fields(all), { ...e.bean, ...change }, STATUSES);
    if (refused) return refused;

    let text = e.text;
    if (change.title !== undefined) text = setFieldInText(text, "title", `'${change.title.replace(/'/g, "''")}'`);
    if (change.status !== undefined) text = setFieldInText(text, "status", change.status);
    if (change.type !== undefined) text = setFieldInText(text, "type", change.type);
    if (change.parent !== undefined) text = setFieldInText(text, "parent", change.parent);
    if (change.blockedBy !== undefined) text = setFieldInText(setSequenceInText(text, "blocked_by", change.blockedBy), "updated_at", new Date().toISOString().replace(/\.\d+Z$/, "Z"));
    if (change.tags !== undefined) text = setFieldInText(setSequenceInText(text, "tags", change.tags), "updated_at", new Date().toISOString().replace(/\.\d+Z$/, "Z"));

    // Archiving moves the file between `defs/` and `defs/archive/`: one commit,
    // the old path removed and the new one written, both against what was read.
    const archived = change.archived ?? e.bean.archived === true;
    const to = `${archived ? ARCHIVE : DEFS}/${e.path.split("/").pop()}`;
    const changes = to === e.path
      ? [{ path: e.path, content: text, expect: ifMatch }]
      : [{ path: e.path, content: null, expect: ifMatch }, { path: to, content: text, expect: null }];
    const w = this.s.write(changes, `update ${key}`);
    if (w.state === "conflict") return { state: "refused", why: "stale", detail: `${key} changed between this read and this write` };
    if (w.state !== "pushed") throw new Error(`update ${key}: ${w.state} — ${w.reason}`);
    return { state: "updated", version: versionOf(text) };
  }

  /** Every instance at the tip, in `beans/workflows/`. */
  private instances(): InstanceLike[] {
    const t = this.s.readTree(WORKFLOWS);
    if (t.state === "miss") return [];
    if (t.state !== "hit") throw new Error(`cannot read ${WORKFLOWS}: ${t.reason}`);
    return [...t.files].filter(([p]) => p.endsWith(".json")).map(([, text]) => JSON.parse(text) as InstanceLike);
  }

  history(id: string): HistoryEvent[] {
    const all = this.all();
    const key = resolveId(all.keys(), id);
    if (!key) return [];
    return historyFrom(key, beanVersions(branchReader(this.s), all.get(key)!.path), this.instances());
  }

  positions(id: string): Position[] {
    return positionsIn(this.instances(), resolveId(this.all().keys(), id) ?? id);
  }

  beansAt(process: string, step?: string): string[] {
    return beansAtIn(this.instances(), process, step);
  }

  /**
   * A note carries no `ifMatch`: the caller cannot be asked to retry an
   * append. So the Tool retries it — re-read, append, write against what it
   * read — until it lands on an unchanged blob.
   */
  keep(id: string, entry: MemoryEntry) {
    return keepOn(this, id, entry);
  }

  recall(id: string) {
    return recallOn(this, id);
  }

  open(record: { id: string; title: string; scope: MemoryScope; about?: string[] }) {
    return openOn(this, record);
  }

  note(id: string, text: string, by: string): { state: "noted"; version: string } | { state: "none" } {
    for (let attempt = 0; attempt < 5; attempt++) {
      const all = this.all();
      const key = resolveId(all.keys(), id);
      if (!key) return { state: "none" };
      const e = all.get(key)!;
      const next = appendNoteToText(e.text, `${text} (${by})`);
      const w = this.s.write([{ path: e.path, content: next, expect: e.blob }], `note ${key}`);
      if (w.state === "pushed") return { state: "noted", version: versionOf(next) };
      if (w.state !== "conflict") throw new Error(`note ${key}: ${w.state} — ${w.reason}`);
    }
    throw new Error(`note ${id}: five writers in a row changed the bean under this one`);
  }
}

workPlanStoreConformance({
  name: "git state branch (beans-git-branch)",
  timeoutMs: GIT_MS,
  fresh() {
    const w = world();
    const open = (name: string): GitBranchStore =>
      new GitBranchStore(BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.base, `${name}.git`), log: () => {} }));
    const seeder = BranchStore.open(BRANCH, { repoRoot: w.repo, remote: w.url, storeDir: join(w.base, "seed.git"), log: () => {} });
    return {
      a: open("a"),
      b: open("b"),
      seedInstance: (s) => {
        const r = seeder.write([{ path: `${WORKFLOWS}/${s.id}.json`, content: `${JSON.stringify({ $schema: "folio-workflow-instance/v1", ...s }, null, 2)}\n` }], `start ${s.id}`);
        if (r.state !== "pushed") throw new Error(`seed ${s.id}: ${r.state} — ${r.reason}`);
      },
    };
  },
});
