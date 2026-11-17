#!/usr/bin/env bun
/**
 * state-store — a DECLARED tip-keyed directory, read and spliced by id.
 *
 * @module scripts/state-store
 * @graphNode none — a reader/writer over a declared `storage` directory
 *
 * {@link BranchStore} knows how to read and splice a branch; this knows WHICH
 * branch, from the declaration, and talks in paths relative to the directory
 * rather than to the branch root.
 *
 * A caller names a DIRECTORY ID, not a branch name: {@link resolveTipLocation}
 * answers with the branch its declaration gives, so renaming a branch is a
 * one-line change to the declaration. On a tip-keyed branch the paths mirror
 * the checkout (`beans/defs/x.md` is `beans/defs/x.md` on the branch);
 * everything here is relative to the directory and
 * {@link StateStore.branchPath} does the joining.
 *
 * ## What it deliberately does NOT do
 *
 * No manifest validation, no tip verification, no JSON parsing, no retry over
 * a moved tip: `BranchStore` does all of that.
 *
 * It never merges content. A write carries `expect` — the blob id its author
 * read — and a tip that disagrees comes back `conflict` with the paths named.
 * {@link StateStore.update} is the one place a retry happens, and it retries
 * by RE-READING and re-applying the caller's function, so the new content is
 * computed from what is actually on the branch.
 *
 * ## Not wired to anything yet
 *
 * No declaration sets `storage` (see `DirectoryStorageSchema`), so
 * {@link StateStore.openFor} throws for every id today and that is correct:
 * `main` stays authoritative until the cutover. {@link StateStore.at} takes
 * an explicit location, which is what the tests and the cutover use before
 * any declaration exists.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/state-store.ts where --id <directory-id>
 *   bun run cat-harness-tools/scripts/state-store.ts read  --id <id> <path>
 *   bun run cat-harness-tools/scripts/state-store.ts ls    --id <id> [<path>]
 */

import {
  BranchStore,
  BranchStoreUsageError,
  EXIT,
  resolveTipLocation,
  type BranchStoreOptions,
  type Change,
  type DirRead,
  type FileRead,
  type JsonRead,
  type TipLocation,
  type TreeRead,
  type WriteResult,
} from "./branch-store.js";

/** A change expressed relative to the directory, not to the branch root. */
export interface StateChange {
  /** Directory-relative, e.g. `defs/folio-assistant-2h76--….md`. */
  path: string;
  /** New content as text or BYTES, or `null` to remove. See {@link Change.content}. */
  content: string | Buffer | null;
  /**
   * The blob id this author read (a {@link FileRead}'s `blob`), or `null` for
   * "must not exist". Omitted means "do not check" — a last-writer-wins write,
   * which is correct only for content nobody else edits.
   */
  expect?: string | null;
  /** Tree mode; see {@link Change.mode}. Default `100644`. */
  mode?: "100644" | "100755" | "120000";
}

export interface UpdateOptions {
  /** How many times to re-read and re-apply when the tip moved under us. Default 3. */
  attempts?: number;
}

export class StateStore {
  private constructor(
    readonly location: TipLocation,
    private readonly store: BranchStore,
  ) {}

  /**
   * Open the store for a declared directory id. Throws
   * {@link BranchStoreUsageError} when the id is unknown, declares no
   * `storage`, or is keyed by `commit` rather than `tip`.
   */
  static openFor(id: string, opts: BranchStoreOptions = {}): StateStore {
    const location = resolveTipLocation(id, opts.repoRoot);
    return StateStore.at(location, opts);
  }

  /**
   * Open the store for an explicit location, bypassing the declaration. For
   * tests, and for the cutover that must write the branch BEFORE a declaration
   * points at it.
   */
  static at(location: TipLocation, opts: BranchStoreOptions = {}): StateStore {
    return new StateStore(location, BranchStore.open(location.branch, opts));
  }

  /** The branch this directory's declaration names. */
  get branch(): string {
    return this.location.branch;
  }

  /**
   * A directory-relative path as it appears on the branch. `""` is the
   * directory itself. Rejects escapes: a `..` segment would read another
   * directory's state through this one's id.
   */
  branchPath(path = ""): string {
    const segs = path.split("/").filter((s) => s !== "" && s !== ".");
    if (segs.some((s) => s === "..")) throw new BranchStoreUsageError(`path escapes ${this.location.id}: ${path}`);
    return [this.location.path, ...segs].join("/");
  }

  /** One file at the tip. The `blob` on a hit is what a later write passes as `expect`. */
  readFile(path: string): FileRead {
    return this.store.readFile(this.branchPath(path));
  }

  /** {@link readFile}, parsed. Unparseable JSON is `corrupt`, never `miss`. */
  readJson<T = unknown>(path: string): JsonRead<T> {
    return this.store.readJson<T>(this.branchPath(path));
  }

  /** The entries of one directory at the tip (`""` is this directory). */
  listDir(path = ""): DirRead {
    return this.store.listDir(this.branchPath(path));
  }

  /** Every file under `path`, as branch-relative path to blob id. */
  readTree(path = ""): TreeRead {
    return this.store.readTree(this.branchPath(path));
  }

  /**
   * Splice `changes` onto the tip and push. Paths are directory-relative;
   * `expect` is honoured per path, and a disagreeing tip returns `conflict`
   * with nothing pushed.
   */
  write(changes: readonly StateChange[], message: string): WriteResult {
    const mapped: Change[] = changes.map((c) => ({
      path: this.branchPath(c.path),
      content: c.content,
      ...("expect" in c ? { expect: c.expect } : {}),
      ...(c.mode ? { mode: c.mode } : {}),
    }));
    return this.store.write(mapped, message);
  }

  /**
   * Read `path`, apply `change`, write it back under `expect` — and on a
   * `conflict`, RE-READ and apply `change` to the new content.
   *
   * This is the read-modify-write a bean edit needs. The retry is safe
   * precisely because `change` is re-run against what is on the branch: two
   * sessions editing the same file both land, second after first, instead of
   * the second overwriting the first. A `change` that returns `null` removes
   * the file; one that returns the text it was given writes nothing.
   *
   * `change` receives `undefined` when the file does not exist, and the write
   * then carries `expect: null` — "must not exist" — so two creators race and
   * one is told, rather than both believing they created it.
   */
  update(path: string, change: (current: string | undefined) => string | null, message: string, opts: UpdateOptions = {}): WriteResult {
    const attempts = Math.max(1, opts.attempts ?? 3);
    let last: WriteResult | undefined;
    for (let i = 0; i < attempts; i++) {
      const read = this.readFile(path);
      if (read.state === "corrupt" || read.state === "unknown") {
        return { state: "failed", reason: read.reason, branch: this.branch, attempts: i + 1 };
      }
      const current = read.state === "hit" ? read.text : undefined;
      const next = change(current);
      if (next === current) {
        return { state: "unchanged", reason: `${path} already holds this content`, branch: this.branch, attempts: i + 1 };
      }
      last = this.write([{ path, content: next, expect: read.state === "hit" ? read.blob : null }], message);
      if (last.state !== "conflict") return last;
    }
    return {
      ...last!,
      reason: `${last!.reason} — still conflicting after ${attempts} read-modify-write attempts`,
    };
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function usage(): never {
  console.error(
    [
      "usage: state-store where --id <directory-id>",
      "       state-store read  --id <directory-id> <path>",
      "       state-store ls    --id <directory-id> [<path>]",
      "",
      "Paths are relative to the declared directory.",
    ].join("\n"),
  );
  process.exit(EXIT.usage);
}

async function main(argv: string[]): Promise<number> {
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h") usage();
  const idAt = argv.indexOf("--id");
  if (idAt === -1 || !argv[idAt + 1]) usage();
  const id = argv[idAt + 1]!;
  const rest = argv.slice(1).filter((a, i, all) => a !== "--id" && all[i - 1] !== "--id");

  if (cmd === "where") {
    const loc = resolveTipLocation(id);
    console.log(JSON.stringify(loc, null, 2));
    return EXIT.hit;
  }

  const store = StateStore.openFor(id);
  if (cmd === "read") {
    const path = rest[0];
    if (!path) usage();
    const r = store.readFile(path);
    if (r.state !== "hit") {
      console.error(r.reason);
      return EXIT[r.state];
    }
    process.stdout.write(r.text);
    return EXIT.hit;
  }
  if (cmd === "ls") {
    const r = store.listDir(rest[0] ?? "");
    if (r.state !== "hit") {
      console.error(r.reason);
      return EXIT[r.state];
    }
    for (const e of r.entries) console.log(`${e.type === "tree" ? "d" : "-"} ${e.sha.slice(0, 12)} ${e.name}`);
    return EXIT.hit;
  }
  usage();
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (e) {
    if (e instanceof BranchStoreUsageError) {
      console.error(e.message);
      process.exit(EXIT.usage);
    }
    throw e;
  }
}
