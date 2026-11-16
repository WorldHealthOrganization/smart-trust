/**
 * The shared fixture for `state:mount` / `state:push`: a bare remote over
 * `file://` holding a seeded state branch, and checkouts whose layer
 * DECLARES a subgraph kept on that branch, the current way
 * (`source: { kind: "branch" }`). Real git throughout: the failures these
 * commands exist for are a fetch that does not happen and a push that loses
 * a sibling's write, so a stub would only test the stub.
 *
 * @module scripts/tests/state-fixture
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BranchStore, MANIFEST_SCHEMA } from "../branch-store.js";

export const BRANCH = "cat/cat-harness/todos";
export const ID = "todos";
export const MANIFEST = JSON.stringify({ $schema: MANIFEST_SCHEMA, status: "seed", authoritative: false, subgraph: ID, keyedBy: "tip" });
/** Not valid UTF-8: a text round trip would change these bytes. */
export const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xfe, 0x80, 0x0a]);

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];

export function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}${r.stdout}`);
  return r.stdout;
}

/** A declaration with one directory, `todos/`, sourced as given. */
export function writeDeclaration(root: string, source: object | undefined): void {
  const entry = { id: ID, path: `${ID}/`, graphTypologies: [ID], ...(source ? { source } : {}) };
  writeFileSync(join(root, "t.json"), JSON.stringify({ name: "t", directories: [entry] }, null, 2) + "\n");
}

export const TIP_SOURCE = { kind: "branch", branch: BRANCH, keyedBy: "tip" } as const;

const made: string[] = [];
export function cleanup(): void {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
}

export interface StateFixture {
  base: string;
  bare: string;
  url: string;
  /** A fresh checkout (a "container") declaring `source`, with its own private store. */
  checkout: (name: string, source?: object) => { root: string; store: { storeDir: string; sleep: () => void; log: () => void } };
  /** A sibling session writing straight to the branch. */
  sibling: (name: string, repoRoot: string) => BranchStore;
  tip: () => string;
  /** The remote's file at the tip, as bytes; undefined when absent. */
  remoteFile: (path: string) => Buffer | undefined;
  /** The remote's tree mode for a path at the tip. */
  remoteMode: (path: string) => string | undefined;
}

/**
 * `files === null` pushes no branch at all.
 *
 * declared-path-literal: fixture CONTENT — the files seeded onto a temporary
 * state branch, never a path into this checkout, so there is no declaration
 * to read them from.
 */
export function stateFixture(prefix: string, files: Record<string, string | Buffer> | null = { "manifest.json": MANIFEST, "todos/a.md": "A\n", "todos/keep.md": "keep\n" }): StateFixture {
  const base = mkdtempSync(join(tmpdir(), prefix));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;
  if (files) {
    const seed = join(base, "seed");
    mkdirSync(seed);
    git(seed, "init", "-q", "-b", "seed");
    for (const [p, t] of Object.entries(files)) {
      mkdirSync(dirname(join(seed, p)), { recursive: true });
      writeFileSync(join(seed, p), t);
    }
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "seed");
    git(seed, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);
  }
  const quiet = { sleep: () => {}, log: () => {} };
  return {
    base,
    bare,
    url,
    checkout: (name, source = TIP_SOURCE) => {
      const root = join(base, `co-${name}`);
      mkdirSync(root);
      git(root, "init", "-q", "-b", "main");
      git(root, "remote", "add", "origin", url);
      writeDeclaration(root, source);
      git(root, "add", "-A");
      git(root, "commit", "-q", "-m", "declare");
      return { root, store: { storeDir: join(base, `store-${name}.git`), ...quiet } };
    },
    sibling: (name, repoRoot) => BranchStore.open(BRANCH, { repoRoot, storeDir: join(base, `sib-${name}.git`), ...quiet }),
    tip: () => git(bare, "rev-parse", `refs/heads/${BRANCH}`).trim(),
    remoteFile: (path) => {
      const r = spawnSync("git", ["--git-dir", bare, "cat-file", "blob", `refs/heads/${BRANCH}:${path}`]);
      return r.status === 0 ? r.stdout : undefined;
    },
    remoteMode: (path) => {
      const r = spawnSync("git", ["--git-dir", bare, "ls-tree", `refs/heads/${BRANCH}`, "--", path], { encoding: "utf-8" });
      return r.stdout.trim().split(/\s/)[0] || undefined;
    },
  };
}

/**
 * A seed holding a binary, an executable and a symlink.
 *
 * declared-path-literal: fixture CONTENT, as for `stateFixture` above.
 */
export function richSeed(): Record<string, string | Buffer> {
  return { "manifest.json": MANIFEST, "todos/a.md": "A\n", "todos/doc.pdf": PDF };
}
