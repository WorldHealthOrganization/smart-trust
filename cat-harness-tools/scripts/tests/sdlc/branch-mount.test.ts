/**
 * `mountTip` / `pushMount` on REAL git repositories: a bare remote over
 * `file://`, and one checkout per simulated container. Same practice as
 * branch-store.test.ts — a rejected push and a lost race are things a remote
 * does, so a stub would only test the stub.
 *
 * Owner ruling 2026-10-03 (bean 2h76, for 9c7h): one generic mount/push pair,
 * keyed by directory id, for beans, todos and fsh-guts. These tests pin the
 * promises the ruling makes: a miss is never an empty mount, the push carries
 * `expect`, so a sibling's edit is a conflict and never an overwrite, and
 * nothing is clobbered.
 *
 * @module scripts/tests/branch-mount
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { gitBlobId, MANIFEST_SCHEMA, markerPath, mountEmptyingReason, mountTip, pushMount, readMarker, type TipLocation } from "../../branch-store.js";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const BRANCH = "cat/cat-harness/fsh-guts";
const LOC: TipLocation = { id: "fsh-guts", path: "fsh-guts", branch: BRANCH, keyedBy: "tip" };
/** Not valid UTF-8: a text round-trip would change these bytes. */
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xfe, 0x80, 0x0a]);

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Fixture {
  url: string;
  bare: string;
  /** A fresh checkout (a "container"), with its own private store. */
  checkout: (name: string) => { root: string; opts: { repoRoot: string; store: object } };
  tip: () => string;
  /** The remote's file at the tip, as bytes; undefined when absent. */
  remoteFile: (path: string) => Buffer | undefined;
}

function fixture(): Fixture {
  const base = mkdtempSync(join(tmpdir(), "branch-mount-t-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;
  // The seeded state branch: manifest, README, and fsh-guts/** mirroring the checkout.
  const seed = join(base, "seed");
  mkdirSync(seed);
  git(seed, "init", "-q", "-b", "seed");
  const files: Record<string, string | Buffer> = {
    "manifest.json": JSON.stringify({ $schema: MANIFEST_SCHEMA, status: "seed", authoritative: false, subgraph: "fsh-guts", keyedBy: "tip" }),
    "README.md": "# fsh-guts\n",
    "fsh-guts/retired/a.md": "---\ntitle: A\n---\n",
    "fsh-guts/retired/b.md": "---\ntitle: B\n---\n",
    "fsh-guts/uploads/doc.pdf": PDF,
    "fsh-guts/scripts/run.sh": "#!/bin/sh\necho hi\n",
  };
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(dirname(join(seed, p)), { recursive: true });
    writeFileSync(join(seed, p), t);
  }
  spawnSync("chmod", ["755", join(seed, "fsh-guts/scripts/run.sh")]);
  symlinkSync("../retired/a.md", join(seed, "fsh-guts/scripts/a-link.md"));
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);
  return {
    url,
    bare,
    checkout: (name) => {
      const root = join(base, `co-${name}`);
      mkdirSync(root);
      git(root, "init", "-q", "-b", "main");
      git(root, "remote", "add", "origin", url);
      // After the cutover, main ignores nothing in the mount except local scratch.
      writeFileSync(join(root, ".gitignore"), "fsh-guts/logs/\n");
      return { root, opts: { repoRoot: root, store: { storeDir: join(base, `store-${name}.git`), sleep: () => {}, log: () => {} } } };
    },
    tip: () => git(bare, "rev-parse", `refs/heads/${BRANCH}`).trim(),
    remoteFile: (path) => {
      const r = spawnSync("git", ["--git-dir", bare, "cat-file", "blob", `refs/heads/${BRANCH}:${path}`]);
      return r.status === 0 ? r.stdout : undefined;
    },
  };
}

describe("mount", () => {
  test("puts the tip's files at the declared path, bytes and modes intact, with the marker outside the mount", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    const r = mountTip(LOC, opts);
    expect(r.state).toBe("mounted");
    expect(readFileSync(join(root, "fsh-guts/retired/a.md"), "utf-8")).toBe("---\ntitle: A\n---\n");
    expect(readFileSync(join(root, "fsh-guts/uploads/doc.pdf")).equals(PDF)).toBe(true);
    expect(statSync(join(root, "fsh-guts/scripts/run.sh")).mode & 0o111).not.toBe(0);
    // Only the directory's own files: the branch root's manifest and README stay on the branch.
    expect(existsSync(join(root, "fsh-guts/manifest.json"))).toBe(false);
    expect(existsSync(markerPath(root, "fsh-guts"))).toBe(true);
    expect(markerPath(root, "fsh-guts").startsWith(join(root, "fsh-guts"))).toBe(false);
    expect(readMarker(root, "fsh-guts")!.tip).toBe(f.tip());
  });

  test("a miss is a miss, never an empty mount", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    const r = mountTip({ ...LOC, branch: "cat/cat-harness/no-such" }, opts);
    expect(r.state).toBe("miss");
    expect(existsSync(join(root, "fsh-guts"))).toBe(false);
    expect(readMarker(root, "fsh-guts")).toBeUndefined();
  });

  test("refuses a directory the checkout still tracks: the cutover has not happened", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mkdirSync(join(root, "fsh-guts"));
    writeFileSync(join(root, "fsh-guts/kept.md"), "on main\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "main still holds it");
    const r = mountTip(LOC, opts);
    expect(r.state).toBe("refused");
    expect(readFileSync(join(root, "fsh-guts/kept.md"), "utf-8")).toBe("on main\n");
  });

  test("refuses a non-empty directory that is not a mount", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mkdirSync(join(root, "fsh-guts"));
    writeFileSync(join(root, "fsh-guts/stray.md"), "x\n");
    expect(mountTip(LOC, opts).state).toBe("refused");
    expect(readFileSync(join(root, "fsh-guts/stray.md"), "utf-8")).toBe("x\n");
  });

  test("refuses to re-mount over unpushed edits", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    writeFileSync(join(root, "fsh-guts/retired/a.md"), "edited\n");
    expect(mountTip(LOC, opts).state).toBe("refused");
    expect(readFileSync(join(root, "fsh-guts/retired/a.md"), "utf-8")).toBe("edited\n");
  });

  test("refuses a non-tip keying with a reason naming the keying (bean 5akx)", () => {
    const f = fixture();
    const { opts } = f.checkout("a");
    const routeLoc: TipLocation = { ...LOC, id: "uml-overview", keyedBy: "route" };
    const r = mountTip(routeLoc, opts);
    expect(r.state).toBe("refused");
    if (r.state === "refused") {
      expect(r.reason).toContain("keyed by route, not tip");
    }
  });
});

describe("push", () => {
  test("splices an edit, an addition and a removal onto the tip, then has nothing left to send", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    const before = f.tip();
    writeFileSync(join(root, "fsh-guts/retired/a.md"), "---\ntitle: A2\n---\n");
    mkdirSync(join(root, "fsh-guts/samples"), { recursive: true });
    writeFileSync(join(root, "fsh-guts/samples/new.md"), "new\n");
    unlinkSync(join(root, "fsh-guts/retired/b.md"));
    const r = pushMount("fsh-guts", "test push", opts);
    expect(r.state).toBe("pushed");
    expect(f.tip()).not.toBe(before);
    expect(f.remoteFile("fsh-guts/retired/a.md")!.toString()).toBe("---\ntitle: A2\n---\n");
    expect(f.remoteFile("fsh-guts/samples/new.md")!.toString()).toBe("new\n");
    expect(f.remoteFile("fsh-guts/retired/b.md")).toBeUndefined();
    // Untouched paths are carried across: the binary and the branch's own manifest.
    expect(f.remoteFile("fsh-guts/uploads/doc.pdf")!.equals(PDF)).toBe(true);
    expect(f.remoteFile("manifest.json")).toBeDefined();
    expect(readMarker(root, "fsh-guts")!.lastPush).toBe(f.tip());
    expect(readMarker(root, "fsh-guts")!.tip).toBe(before);
    expect(pushMount("fsh-guts", "again", opts).state).toBe("unchanged");
  });

  test("a sibling's edit to the SAME file since the mount is a conflict, and nothing is pushed", () => {
    const f = fixture();
    const a = f.checkout("a");
    const b = f.checkout("b");
    mountTip(LOC, a.opts);
    mountTip(LOC, b.opts);
    writeFileSync(join(b.root, "fsh-guts/retired/a.md"), "b's edit\n");
    expect(pushMount("fsh-guts", "b", b.opts).state).toBe("pushed");
    const afterB = f.tip();
    writeFileSync(join(a.root, "fsh-guts/retired/a.md"), "a's edit\n");
    const r = pushMount("fsh-guts", "a", a.opts);
    expect(r.state).toBe("conflict");
    expect(f.tip()).toBe(afterB);
    expect(f.remoteFile("fsh-guts/retired/a.md")!.toString()).toBe("b's edit\n");
  });

  test("siblings editing DIFFERENT files both land; neither overwrites the other", () => {
    const f = fixture();
    const a = f.checkout("a");
    const b = f.checkout("b");
    mountTip(LOC, a.opts);
    mountTip(LOC, b.opts);
    writeFileSync(join(a.root, "fsh-guts/retired/a.md"), "from a\n");
    writeFileSync(join(b.root, "fsh-guts/retired/b.md"), "from b\n");
    expect(pushMount("fsh-guts", "a", a.opts).state).toBe("pushed");
    expect(pushMount("fsh-guts", "b", b.opts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/retired/a.md")!.toString()).toBe("from a\n");
    expect(f.remoteFile("fsh-guts/retired/b.md")!.toString()).toBe("from b\n");
  });

  test("a file the checkout ignores (local scratch such as logs) is never pushed", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    mkdirSync(join(root, "fsh-guts/logs"), { recursive: true });
    writeFileSync(join(root, "fsh-guts/logs/session.jsonl"), "{}\n");
    expect(pushMount("fsh-guts", "logs only", opts).state).toBe("unchanged");
    expect(f.remoteFile("fsh-guts/logs/session.jsonl")).toBeUndefined();
  });

  test("ignoring the whole mount on main does not make its files unpushable", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    writeFileSync(join(root, ".gitignore"), "fsh-guts/\nfsh-guts/logs/\n");
    mountTip(LOC, opts);
    writeFileSync(join(root, "fsh-guts/retired/a.md"), "edited under a root-ignore\n");
    expect(pushMount("fsh-guts", "edit", opts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/retired/a.md")!.toString()).toBe("edited under a root-ignore\n");
  });

  test("the cutover's ignore rules: logs written BEFORE the first mount neither block it nor get pushed (bean 9c7h)", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    // Exactly what main's .gitignore says after the cutover. `/**`, not a
    // directory rule: `fsh-guts/` would be reported for the logs too, and
    // they would be pushed.
    writeFileSync(join(root, ".gitignore"), "/fsh-guts/**\nfsh-guts/logs/\n");
    // The log writer runs whether or not the trashcan is mounted.
    mkdirSync(join(root, "fsh-guts/logs"), { recursive: true });
    writeFileSync(join(root, "fsh-guts/logs/session.jsonl"), "{}\n");
    expect(mountTip(LOC, opts).state).toBe("mounted");
    expect(readFileSync(join(root, "fsh-guts/logs/session.jsonl"), "utf-8")).toBe("{}\n");
    writeFileSync(join(root, "fsh-guts/retired/a.md"), "edited after the cutover\n");
    expect(pushMount("fsh-guts", "edit", opts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/retired/a.md")!.toString()).toBe("edited after the cutover\n");
    expect(f.remoteFile("fsh-guts/logs/session.jsonl")).toBeUndefined();
  });

  test("a file the checkout does NOT ignore still blocks a first mount — it is a competing copy", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mkdirSync(join(root, "fsh-guts/retired"), { recursive: true });
    writeFileSync(join(root, "fsh-guts/retired/stray.md"), "not a mount\n");
    const r = mountTip(LOC, opts);
    expect(r.state).toBe("refused");
    expect(readFileSync(join(root, "fsh-guts/retired/stray.md"), "utf-8")).toBe("not a mount\n");
  });

  test("an unmounted id is refused, not treated as empty", () => {
    const f = fixture();
    const { opts } = f.checkout("a");
    expect(pushMount("fsh-guts", "x", opts).state).toBe("refused");
  });

  // 2026-10-15: a layer re-laid over five nested mounts left their markers
  // behind, and one bare `state:push` emptied all five graphs — after which
  // every `state:mount` reported a miss and the docs site stopped publishing.
  test("a mount deleted from under its marker is refused, never pushed as the deletion of every file", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    const before = f.tip();
    rmSync(join(root, "fsh-guts"), { recursive: true, force: true });
    const r = pushMount("fsh-guts", "x", opts);
    expect(r.state).toBe("refused");
    if (r.state === "refused") expect(r.reason).toContain("does not exist");
    expect(mountEmptyingReason("fsh-guts", opts)).toContain("does not exist");
    expect(f.tip()).toBe(before);
    expect(f.remoteFile("fsh-guts/retired/a.md")).toBeDefined();
    // The remedy the refusal names works: a gone mount holds no edit to lose.
    expect(mountTip(LOC, opts).state).toBe("mounted");
    expect(readFileSync(join(root, "fsh-guts/uploads/doc.pdf")).equals(PDF)).toBe(true);
  });

  test("a mount emptied of every file is refused too: the branch would then be a miss", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    const before = f.tip();
    rmSync(join(root, "fsh-guts"), { recursive: true, force: true });
    mkdirSync(join(root, "fsh-guts"));
    const r = pushMount("fsh-guts", "x", opts);
    expect(r.state).toBe("refused");
    if (r.state === "refused") expect(r.reason).toContain("holds no files");
    expect(f.tip()).toBe(before);
    // The marker is untouched, so a re-mount restores the files.
    expect(mountTip(LOC, opts).state).toBe("mounted");
    expect(readFileSync(join(root, "fsh-guts/retired/a.md"), "utf-8")).toBe("---\ntitle: A\n---\n");
  });

  test("a copy of a linked worktree, sharing its git directory, cannot re-mount over the original's mount", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    // The copy: same files, and a `.git` FILE naming the original's git directory.
    const copy = `${root}-copy`;
    made.push(copy);
    spawnSync("cp", ["-a", root, copy]);
    rmSync(join(copy, ".git"), { recursive: true, force: true });
    writeFileSync(join(copy, ".git"), `gitdir: ${join(root, ".git")}\n`);
    const r = mountTip(LOC, { ...opts, repoRoot: copy });
    expect(r.state).toBe("refused");
    if (r.state === "refused") expect(r.reason).toContain("shares this git directory");
    // The original's files and marker are untouched, so its push still has nothing to send.
    expect(readFileSync(join(root, "fsh-guts/retired/a.md"), "utf-8")).toBe("---\ntitle: A\n---\n");
    expect(readMarker(root, "fsh-guts")!.into).toBe("fsh-guts");
    expect(pushMount("fsh-guts", "x", opts).state).toBe("unchanged");
  });

  test("markers store a checkout-relative into; cp -a of a checkout followed by mountTip in the copy leaves the original byte-identical (bean 1ple)", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    expect(readMarker(root, "fsh-guts")!.into).toBe("fsh-guts");

    // Copy the entire checkout with its .git/branch-mounts/ marker intact.
    const copy = `${root}-full-copy`;
    made.push(copy);
    spawnSync("cp", ["-a", root, copy]);

    // Advance the remote tip and add an untracked local file in the original's mount.
    writeFileSync(join(root, "fsh-guts/local-draft.md"), "keep me\n");
    const b = f.checkout("b");
    mountTip(LOC, b.opts);
    writeFileSync(join(b.root, "fsh-guts/retired/b.md"), "updated on remote\n");
    expect(pushMount("fsh-guts", "b", b.opts).state).toBe("pushed");

    // Re-mounting in the copy must mount into the COPY, leaving the original untouched.
    expect(mountTip(LOC, { ...opts, repoRoot: copy }).state).toBe("mounted");
    expect(readFileSync(join(copy, "fsh-guts/retired/b.md"), "utf-8")).toBe("updated on remote\n");
    expect(readFileSync(join(root, "fsh-guts/retired/b.md"), "utf-8")).toBe("---\ntitle: B\n---\n");
    expect(readFileSync(join(root, "fsh-guts/local-draft.md"), "utf-8")).toBe("keep me\n");
  });

  test("a marker whose into resolves outside repoRoot is refused by mountTip and pushMount (bean 1ple)", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);

    // Simulate a legacy copied checkout whose marker still holds the ORIGINAL's absolute path.
    const copy = `${root}-legacy-copy`;
    made.push(copy);
    spawnSync("cp", ["-a", root, copy]);
    const mp = markerPath(copy, "fsh-guts");
    const legacy = { ...readMarker(copy, "fsh-guts")!, into: join(root, "fsh-guts") };
    writeFileSync(mp, JSON.stringify(legacy, null, 2) + "\n");

    const mr = mountTip(LOC, { ...opts, repoRoot: copy });
    expect(mr.state).toBe("refused");
    if (mr.state === "refused") expect(mr.reason).toContain("outside this checkout");

    const pr = pushMount("fsh-guts", "x", { ...opts, repoRoot: copy });
    expect(pr.state).toBe("refused");
    if (pr.state === "refused") expect(pr.reason).toContain("outside this checkout");

    // Original checkout's files are untouched.
    expect(readFileSync(join(root, "fsh-guts/retired/a.md"), "utf-8")).toBe("---\ntitle: A\n---\n");
  });

  test("an existing in-repo absolute marker is migrated to checkout-relative on next mount (bean 1ple)", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    const mp = markerPath(root, "fsh-guts");
    const legacy = { ...readMarker(root, "fsh-guts")!, into: join(root, "fsh-guts") };
    writeFileSync(mp, JSON.stringify(legacy, null, 2) + "\n");
    expect(readMarker(root, "fsh-guts")!.into).toBe(join(root, "fsh-guts"));

    expect(mountTip(LOC, opts).state).toBe("mounted");
    expect(readMarker(root, "fsh-guts")!.into).toBe("fsh-guts");
  });

  test("deleting all but one file, or replacing every file, is an edit and still pushes", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    for (const p of ["retired/b.md", "uploads/doc.pdf", "scripts/run.sh", "scripts/a-link.md"]) unlinkSync(join(root, "fsh-guts", p));
    expect(pushMount("fsh-guts", "most", opts).state).toBe("pushed");
    unlinkSync(join(root, "fsh-guts/retired/a.md"));
    writeFileSync(join(root, "fsh-guts/only.md"), "only\n");
    expect(pushMount("fsh-guts", "replace", opts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/only.md")!.toString()).toBe("only\n");
  });
});

describe("review on #1957", () => {
  test("two worktrees of one checkout mounting the same id keep separate markers, and neither pushes the other's edits", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    writeFileSync(join(root, "seed.txt"), "x\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "base");
    const wt = join(dirname(root), "co-a-wt");
    git(root, "worktree", "add", "-q", wt);
    const wtOpts = { ...opts, repoRoot: wt };
    expect(mountTip(LOC, opts).state).toBe("mounted");
    expect(mountTip(LOC, wtOpts).state).toBe("mounted");
    expect(markerPath(root, "fsh-guts")).not.toBe(markerPath(wt, "fsh-guts"));
    writeFileSync(join(wt, "fsh-guts/retired/b.md"), "only the worktree's edit\n");
    expect(pushMount("fsh-guts", "main checkout", opts).state).toBe("unchanged");
    expect(f.remoteFile("fsh-guts/retired/b.md")!.toString()).toBe("---\ntitle: B\n---\n");
    expect(pushMount("fsh-guts", "worktree", wtOpts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/retired/b.md")!.toString()).toBe("only the worktree's edit\n");
  });

  test("a symlink is mounted as a symlink and pushed back as one, never as a regular file", () => {
    const f = fixture();
    const { root, opts } = f.checkout("a");
    mountTip(LOC, opts);
    const link = join(root, "fsh-guts/scripts/a-link.md");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe("../retired/a.md");
    // An edit elsewhere must not turn the link into a file on the way back.
    writeFileSync(join(root, "fsh-guts/retired/b.md"), "edit\n");
    expect(pushMount("fsh-guts", "edit", opts).state).toBe("pushed");
    const mode = spawnSync("git", ["--git-dir", f.bare, "ls-tree", `refs/heads/${BRANCH}`, "fsh-guts/scripts/a-link.md"], { encoding: "utf-8" }).stdout;
    expect(mode.startsWith("120000")).toBe(true);
    // Re-pointing the link is an edit like any other.
    unlinkSync(link);
    symlinkSync("../retired/b.md", link);
    expect(pushMount("fsh-guts", "relink", opts).state).toBe("pushed");
    expect(f.remoteFile("fsh-guts/scripts/a-link.md")!.toString()).toBe("../retired/b.md");
  });

  test("gitBlobId is git's own blob id, computed without spawning git", () => {
    for (const bytes of [Buffer.from(""), Buffer.from("hello\n"), PDF]) {
      const r = spawnSync("git", ["hash-object", "--stdin"], { input: bytes, encoding: "utf-8" });
      expect(gitBlobId(bytes)).toBe(r.stdout.trim());
    }
  });

  test("after a push over a moved tip, `tip` is still the MOUNTED tip and `lastPush` records the push", () => {
    const f = fixture();
    const a = f.checkout("a");
    const b = f.checkout("b");
    mountTip(LOC, a.opts);
    const mounted = readMarker(a.root, "fsh-guts")!.tip;
    mountTip(LOC, b.opts);
    writeFileSync(join(b.root, "fsh-guts/retired/b.md"), "b moved the tip\n");
    expect(pushMount("fsh-guts", "b", b.opts).state).toBe("pushed");
    writeFileSync(join(a.root, "fsh-guts/retired/a.md"), "a lands on top\n");
    expect(pushMount("fsh-guts", "a", a.opts).state).toBe("pushed");
    const m = readMarker(a.root, "fsh-guts")!;
    expect(m.tip).toBe(mounted);
    expect(m.lastPush).toBe(f.tip());
    // a's disk still has the OLD b.md: the marker does not pretend otherwise,
    // and an edit to it now is a conflict, never an overwrite of b's change.
    writeFileSync(join(a.root, "fsh-guts/retired/b.md"), "a, unaware\n");
    expect(pushMount("fsh-guts", "a2", a.opts).state).toBe("conflict");
    expect(f.remoteFile("fsh-guts/retired/b.md")!.toString()).toBe("b moved the tip\n");
  });
});
