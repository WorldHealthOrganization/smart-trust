#!/usr/bin/env bun
/**
 * READ AND WRITE THE MERGE QUEUE — the steward's decisions, wherever they are declared.
 *
 * @module cat-harness/scripts/merge-queue-store
 * @covers none — a reader and writer over the `merge-queue` graph, run by a
 *   steward rather than by CI. It validates every entry it reads or writes
 *   against `MergeQueueEntrySchema`, which is TYPING and not judging
 *   (`audit:coverage`'s own thesis): claiming coverage here would let the gate
 *   that judges the kind be removed without the census noticing.
 *
 * ## Why the queue lives on a branch
 *
 * The merge steward must not open PRs of its own (it would set its own
 * priority, spend the queue's CI and judge its own head), so it cannot write
 * to `main`. When the `queue` entry in `beans/beans.json` declares
 * `source: { kind: "branch", keyedBy: "tip" }` (branch
 * `cat/cat-harness/merge-queue`), a write here is a splice onto that tip — no
 * pull request, no commit on `main`, and a sibling steward's write to the
 * same entry is a CONFLICT rather than an overwrite.
 *
 * While the declaration has no `source`, READS come from the checkout's
 * `beans/queue/` and {@link recordDecision} REFUSES — a write there would be
 * a commit on this branch — so stewards commit entries to `main`.
 *
 * ## Four read states, and a miss is never empty-clean
 *
 * The shape is {@link BeanStore}'s, so a reader of one can read the other.
 *
 * | state | means | the remedy it prints |
 * |---|---|---|
 * | `absent` | no declaration names a `merge-queue` directory | none — legitimate |
 * | `declared-but-absent` | a declaration names one in the checkout and it is not there | create it, or fix the declaration |
 * | `unreachable` | it is on the branch and nothing is mounted here | `bun run cat state:mount` |
 * | `read` | the entries, with what was skipped and how many files were seen | — |
 *
 * **`unreachable` is not a spelling of `declared-but-absent`**: their
 * remedies differ, and "create the directory" would act on a declaration that
 * is CORRECT. A checkout that cannot reach the graph must never report "no
 * decisions recorded" and exit 0, so {@link readQueueEntries} **throws**
 * rather than returning an empty list, following `readBeanFiles`.
 *
 * ## It never spells the directory's path
 *
 * The id is resolved from the declared GRAPH TYPOLOGY and the path from
 * `graphReadPath`, so this module knows neither `beans/queue` nor the branch
 * name (`check:declared-paths`). Relocating the graph — or mounting it with
 * `--into` — moves this reader with it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { directoryEntriesForGraph, layerRootsIn } from "../schemas/kg/cat-harness.js";
import "../schemas/kg/folio-graph-typology.js";
import { MergeQueueEntrySchema, type MergeQueueEntry } from "../schemas/sdlc/merge-queue.ts";
import { RESERVED, pushMount, readMarker, type BranchStoreOptions, type PushResult } from "./branch-store.ts";
import { graphReadPath } from "./graph-read.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** The graph typology whose directory holds the queue. The declaration says where. */
export const QUEUE_KIND = "merge-queue";

/** One entry, as it sits on the branch. */
export interface QueueEntryFile {
  /** The file name, e.g. `litlfred--folio-assistant--2065.json`. */
  file: string;
  entry: MergeQueueEntry;
}

/**
 * A `.json` in the queue directory that is not an entry.
 *
 * REPORTED, never dropped. A malformed entry is a decision a steward believes
 * it recorded, so swallowing it would make the queue quietly shorter than the
 * steward's own history — `t6s7`'s mangled fence, one graph over.
 */
export interface SkippedEntry {
  file: string;
  /** Why: unparseable JSON, or the schema issue, with its path. */
  reason: string;
  /** True when {@link RESERVED} names it, so it is expected rather than a defect. */
  expected: boolean;
}

export type QueueStore =
  /** No declaration names a `merge-queue` directory. Legitimate. */
  | { state: "absent"; dir: null }
  /** A declaration names this directory in the checkout and it is not there. `dh4f`. */
  | { state: "declared-but-absent"; dir: string }
  /** The graph is on a branch and this checkout has no mount of it. `9ofm` row D. */
  | { state: "unreachable"; dir: null; reason: string }
  | {
      state: "read";
      dir: string;
      id: string;
      entries: QueueEntryFile[];
      skipped: SkippedEntry[];
      /**
       * Every `.json` in the directory, counted by a SEPARATE traversal.
       *
       * Not `entries.length + skipped.length`, which would make the
       * reconciliation a tautology — a check that cannot fail is `xom7`, and
       * `bean-store-read.ts` was reopened for exactly this. As an independent
       * count, a future `continue` that forgets to record what it dropped
       * makes the two disagree instead of undercounting in silence.
       */
      filesSeen: number;
    };

/** The declared directory holding the queue: its id, and where to READ it. */
function locate(root: string): { id: string; where: ReturnType<typeof graphReadPath> } | null {
  for (const inst of layerRootsIn(root)) {
    for (const d of directoryEntriesForGraph(inst, QUEUE_KIND)) {
      return { id: d.id, where: graphReadPath(d.id, root) };
    }
  }
  return null;
}

/** The entry file name for a pull request — `<owner>--<repo>--<pr>.json`. */
export function entryFileName(repository: string, pr: number): string {
  return `${repository.replace("/", "--")}--${pr}.json`;
}

export function readQueueStore(root: string): QueueStore {
  const found = locate(root);
  // No layer declares the kind at all. An unmigrated folio has no queue,
  // which is fine rather than wrong.
  if (!found) return { state: "absent", dir: null };
  const { id, where } = found;
  if (where.state === "refused") {
    // Never a path that merely happens not to exist: that reads as
    // `declared-but-absent` and sends the reader to fix a correct declaration.
    return { state: "unreachable", dir: null, reason: where.reason };
  }
  if (where.state === "undeclared") return { state: "absent", dir: null };
  const dir = where.at;
  if (!existsSync(dir)) return { state: "declared-but-absent", dir };

  const entries: QueueEntryFile[] = [];
  const skipped: SkippedEntry[] = [];
  const filesSeen = readdirSync(dir).filter((n) => n.endsWith(".json")).length;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    if (RESERVED.has(name)) {
      skipped.push({ file: name, reason: "the branch store's own file, not an entry", expected: true });
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, name), "utf-8"));
    } catch (err) {
      skipped.push({ file: name, reason: `does not parse: ${(err as Error).message}`, expected: false });
      continue;
    }
    const r = MergeQueueEntrySchema.safeParse(raw);
    if (!r.success) {
      const i = r.error.issues[0];
      skipped.push({ file: name, reason: `${i?.path.join(".") || "(root)"}: ${i?.message}`, expected: false });
      continue;
    }
    entries.push({ file: name, entry: r.data });
  }
  return { state: "read", dir, id, entries, skipped, filesSeen };
}

/**
 * The queue's entries, or `null` when there is no queue — and a THROW when the
 * store could not be reached.
 *
 * `null` deliberately does not cover `unreachable`. Every caller reads `null`
 * as "no decisions have been recorded", and that is the sentence this whole
 * change exists to stop a checkout from printing over a graph it never saw.
 * The throw carries `graphReadPath`'s remedy. Shaped on `readBeanFiles`.
 */
export function readQueueEntries(root: string): QueueEntryFile[] | null {
  const store = readQueueStore(root);
  if (store.state === "unreachable") throw new Error(`cannot read the merge queue: ${store.reason}`);
  return store.state === "read" ? store.entries : null;
}

/** Is this hold still in force at `now`? A hold past its expiry is not a hold. */
export function holdInForce(e: MergeQueueEntry, at?: number): boolean {
  let now = at;
  if (now === undefined) {
    // input-site: traced #d1f46f57 — the time a hold is checked against when the caller gives none: a run that reaches it records no hash
    inputSiteReached("merge-queue-store: hold's time");
    now = Date.now();
  }
  return e.hold !== undefined && Date.parse(e.hold.expires) > now;
}

export type RecordResult =
  | { state: "refused"; reason: string }
  | { state: "written"; file: string; dir: string; push: PushResult | "skipped" };

/**
 * Record one decision — and push it, so it is live for every sibling at once.
 *
 * **No pull request is involved, which is the entire point.** The entry is
 * written into the mount and spliced onto the branch tip by
 * {@link pushMount}, carrying the blob each file was read at: a sibling steward
 * who edited the same entry since gets this write stopped as `conflict` with
 * the path named, and nothing is pushed.
 *
 * It REFUSES rather than falling back when the graph is not mounted. Writing
 * into an unmounted `beans/queue/` would put the entry in an ignored directory
 * that no push reaches and no reader resolves — a decision the steward believes
 * it recorded and nobody can see, which is worse than the refusal.
 */
export function recordDecision(
  entry: unknown,
  opts: {
    root: string;
    push?: boolean;
    message?: string;
    /** Passed to `BranchStore.open` — a test points it at a local bare remote. */
    store?: BranchStoreOptions;
  } = { root: process.cwd() },
): RecordResult {
  const parsed = MergeQueueEntrySchema.safeParse(entry);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { state: "refused", reason: `not a valid queue entry — ${i?.path.join(".") || "(root)"}: ${i?.message}` };
  }
  const e = parsed.data;
  const store = readQueueStore(opts.root);
  if (store.state === "unreachable") {
    return { state: "refused", reason: `the queue is not mounted here, so there is nowhere to write it: ${store.reason}` };
  }
  if (store.state !== "read") {
    return { state: "refused", reason: `the queue reads \`${store.state}\`, so there is nowhere to write an entry` };
  }
  const marker = readMarker(opts.root, store.id);
  if (!marker) {
    return {
      state: "refused",
      reason:
        `\`${store.id}\` resolves to ${relative(opts.root, store.dir) || "."} in this checkout rather than to a ` +
        `mount of its branch, so a write here would be a commit on this branch — which is the pull request this ` +
        `module exists to avoid. Cut the graph over, or mount it (\`bun run cat state:mount\`).`,
    };
  }
  const file = entryFileName(e.repository, e.pr);
  writeFileSync(join(store.dir, file), JSON.stringify(e, null, 2) + "\n");
  if (opts.push === false) return { state: "written", file, dir: store.dir, push: "skipped" };
  const message = opts.message ?? `queue: ${e.repository}#${e.pr} — ${e.placement.kind === "override" ? "override" : e.placement.class}`;
  return { state: "written", file, dir: store.dir, push: pushMount(store.id, message, { repoRoot: opts.root, store: opts.store }) };
}
