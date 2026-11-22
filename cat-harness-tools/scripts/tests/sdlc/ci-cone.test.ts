/**
 * The CI cone (bean `4rbc`). A PR skips a check only when every path that
 * check's green run on main READ, and its `f017` fingerprint, are unchanged.
 *
 * Two halves:
 * - the trace parser, on synthetic `strace` text, so it runs everywhere;
 * - the falsifiers, end to end in a fixture repository under a real `strace`.
 *   Editing a traced file, the script, an imported module or the baseline
 *   must make the check RUN, and so must a file that a data-dependent read
 *   now reaches. Those tests need `strace` and say so when it is absent.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideRun, excluded, gitReplayable, keepRecords, loadRecords, parseTrace, pathState, preloadScripts, recordRun, recordsOnMain, inlineCodeOf, splitArgs, testGates, touchedOf, unquote } from "../../ci-cone.ts";
import { BUILD_OUTPUT_DIRS, FileDigests, TRACKED, type BaselineResolver, type PairIO } from "../../input-hash.ts";
import { NOT_LAYER_DIRS } from "../../../schemas/kg/instance-roots.ts";
import { statementPin } from "../../input-sites.ts";

const ROOT = "/work/repo";

describe("touchedOf — what a run touched, for a runner that traces several at once (Q-ACT-1 A)", () => {
  test("reads, listed directories, writes (creates, deletes, renames) and git, from one trace", () => {
    const t = touchedOf(
      [
        `10 openat(AT_FDCWD</work/repo>, "data/a.json", O_RDONLY|O_CLOEXEC) = 3</work/repo/data/a.json>`,
        `10 getdents64(4</work/repo/data>, 0x55, 32768) = 120`,
        `10 openat(AT_FDCWD</work/repo>, "out.json", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 5</work/repo/out.json>`,
        `10 unlink("/work/repo/old.json") = 0`,
        `10 rename("/work/repo/x.tmp", "/work/repo/x.json") = 0`,
      ].join("\n"),
      ROOT,
    );
    expect(t).toEqual({ reads: ["data", "data/a.json"], listed: ["data"], writes: ["old.json", "out.json", "x.json", "x.tmp"], git: 0 });
  });

  test("a read then rewritten path is both read and written; a failed create is a probe, not a write", () => {
    const t = touchedOf(
      [
        `10 openat(AT_FDCWD</work/repo>, "a.json", O_RDONLY|O_CLOEXEC) = 3</work/repo/a.json>`,
        `10 openat(AT_FDCWD</work/repo>, "a.json", O_WRONLY|O_TRUNC, 0644) = 4</work/repo/a.json>`,
        `10 mkdirat(AT_FDCWD</work/repo>, "d", 0755) = -1 EEXIST (File exists)`,
      ].join("\n"),
      ROOT,
    );
    expect(t).toMatchObject({ reads: ["a.json", "d"], writes: ["a.json"] });
  });

  test("a probe of a path that does not exist yet is a read, so a neighbour creating it is caught", () => {
    const t = touchedOf(`10 newfstatat(AT_FDCWD</work/repo>, "x/new.json", 0x7ffc, 0) = -1 ENOENT (No such file or directory)`, ROOT);
    expect(t).toMatchObject({ reads: ["x/new.json"], writes: [] });
  });

  test("no trace is undetermined, with the reason", () => {
    expect(touchedOf(undefined, ROOT, "not traced — x")).toEqual({ undetermined: "not traced — x" });
  });

  test("a git command the cone cannot replay is counted as git, not undetermined; its writes still show", () => {
    const trace = [
      `20 getcwd("/work/repo", 4096) = 11`,
      // input-site: inert #b95de63a — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      `20 execve("/usr/bin/git", ["git", "--git-dir=/work/repo/.git/qa-store.git", "log", "-1"], 0x1 /* 3 vars */) = 0`,
      `10 openat(AT_FDCWD</work/repo>, "out.json", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 5</work/repo/out.json>`,
    ].join("\n");
    expect(touchedOf(trace, ROOT)).toMatchObject({ writes: ["out.json"], git: 1 });
    // A record still refuses it: it could not replay the call.
    expect("undetermined" in parseTrace(trace, ROOT)).toBe(true);
  });
});

describe("keepRecords — records concurrent runs wrote to their own files", () => {
  test("a kept record goes into the record file; a null record removes the old one", () => {
    const root = mkdtempSync(join(tmpdir(), "cone-keep-"));
    const rec = { sha: "new", base: "fp", reads: { "b/x.json": "file 1" }, git: {} };
    const a = join(root, "a.json");
    const b = join(root, "b.json");
    writeFileSync(a, JSON.stringify({ script: "check:a", sha: "new", run: "new run 1", recordedAt: "t", record: rec }));
    writeFileSync(b, JSON.stringify({ script: "check:b", sha: "new", run: "new run 1", recordedAt: "t", record: null }));
    const notes = keepRecords(root, [a]);
    expect(notes[0]).toContain("check:a: recorded (1 paths");
    expect(loadRecords(root)?.checks["check:a"]).toEqual(rec as never);
    writeFileSync(a, JSON.stringify({ script: "check:a", sha: "new", run: "new run 1", recordedAt: "t", record: null }));
    keepRecords(root, [a, b]);
    expect(loadRecords(root)?.checks["check:a"]).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("parseTrace — what a traced run read, or why that cannot be enumerated", () => {
  const read = (text: string) => parseTrace(text, ROOT);

  test("a read, a listing and an absent probe are all in the read set; paths outside the checkout are not", () => {
    const r = read(
      [
        `10 openat(AT_FDCWD</work/repo>, "data/a.json", O_RDONLY|O_CLOEXEC) = 3</work/repo/data/a.json>`,
        `10 openat(AT_FDCWD</work/repo>, "/work/repo/data", O_RDONLY|O_CLOEXEC|O_DIRECTORY) = 4</work/repo/data>`,
        `10 newfstatat(AT_FDCWD</work/repo>, "data/maybe.json", 0x7ffc, 0) = -1 ENOENT (No such file or directory)`,
        // input-site: inert #e77e8245 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `10 openat(AT_FDCWD</work/repo>, "/usr/lib/libc.so.6", O_RDONLY|O_CLOEXEC) = 3</usr/lib/libc.so.6>`,
        // input-site: inert #55d97b93 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `10 openat(AT_FDCWD</work/repo>, "/tmp/scratch", O_WRONLY|O_CREAT, 0644) = 5</tmp/scratch>`,
      ].join("\n"),
    );
    expect(r).toEqual({ paths: ["data", "data/a.json", "data/maybe.json"], git: [] });
  });

  test("a write inside the checkout is undetermined, never a read set", () => {
    const r = read(`10 openat(AT_FDCWD</work/repo>, "out.json", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 3</work/repo/out.json>`);
    expect("undetermined" in r && r.undetermined).toContain("writes inside the checkout");
    expect("undetermined" in read(`10 unlink("/work/repo/x") = 0`)).toBe(true);
    expect("undetermined" in read(`10 mkdirat(AT_FDCWD</work/repo>, "d", 0755) = 0`)).toBe(true);
  });

  test("an unclassified path syscall is undetermined — never assumed harmless", () => {
    const r = read(`10 fanotify_mark(3, FAN_MARK_ADD, FAN_OPEN, AT_FDCWD</work/repo>, "x") = 0`);
    expect("undetermined" in r && r.undetermined).toContain("unclassified syscall fanotify_mark");
  });

  test("a relative path with no known directory is undetermined", () => {
    const r = read(`11 stat("data/a.json", 0x7ffc) = 0`);
    expect("undetermined" in r && r.undetermined).toContain("relative to a directory the trace does not name");
  });

  test("a relative path resolves against the cwd the trace showed, and a child inherits it", () => {
    const r = read(
      [
        `10 getcwd("/work/repo", 4096) = 11`,
        `10 vfork( <unfinished ...>`,
        `11 chdir("sub") = 0`,
        `10 <... vfork resumed>) = 11`,
        `11 stat("x.json", 0x7ffc) = 0`,
        `10 stat("y.json", 0x7ffc) = 0`,
      ].join("\n"),
    );
    expect(r).toEqual({ paths: ["sub", "sub/x.json", "y.json"], git: [] });
  });

  test("an unfinished call is joined to its resumption, and an fd-relative path resolves through -y", () => {
    const r = read(
      [
        `10 openat(5</work/repo/skills>, "a.md", O_RDONLY <unfinished ...>`,
        `12 openat(AT_FDCWD</work/repo>, "b.md", O_RDONLY) = 3</work/repo/b.md>`,
        `10 <... openat resumed>) = 6</work/repo/skills/a.md>`,
      ].join("\n"),
    );
    expect(r).toEqual({ paths: ["b.md", "skills/a.md"], git: [] });
  });

  test("a path strace truncated is undetermined", () => {
    const r = read(`10 stat("/work/repo/very-long"..., 0x7ffc) = 0`);
    expect("undetermined" in r).toBe(true);
  });

  test("git's own reads of .git are left out; the script's are kept", () => {
    const r = read(
      [
        `20 getcwd("/work/repo", 4096) = 11`,
        // input-site: inert #b95de63a — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 execve("/usr/bin/git", ["git", "rev-parse", "--show-toplevel"], 0x1 /* 3 vars */) = 0`,
        `20 openat(AT_FDCWD</work/repo>, ".git/HEAD", O_RDONLY) = 3</work/repo/.git/HEAD>`,
        `10 openat(AT_FDCWD</work/repo>, ".git/config", O_RDONLY) = 3</work/repo/.git/config>`,
      ].join("\n"),
    );
    expect(r).toEqual({ paths: [".git/config"], git: [{ cwd: "", args: ["rev-parse", "--show-toplevel"] }] });
  });

  test("a git command is recorded for REPLAY only when it is read-only and takes no stdin", () => {
    expect(gitReplayable("", ["-C", "sub", "ls-files", "-z"])).toEqual({ cwd: "sub", args: ["ls-files", "-z"] });
    expect(gitReplayable("", ["--no-pager", "log", "-1"])).toEqual({ cwd: "", args: ["--no-pager", "log", "-1"] });
    expect(gitReplayable("", ["remote", "get-url", "origin"])).toEqual({ cwd: "", args: ["remote", "get-url", "origin"] });
    expect(gitReplayable("", ["hash-object", "a.svg"])).toEqual({ cwd: "", args: ["hash-object", "a.svg"] });
    // An absolute -C (src/core/git-refs.ts passes the root) is made repo-relative, or refused.
    const rel = (abs: string) => (abs === "/work/repo" ? "" : abs.startsWith("/work/repo/") ? abs.slice(11) : undefined);
    expect(gitReplayable("", ["-C", "/work/repo", "ls-tree", "-r", "gh-pages"], rel)).toEqual({ cwd: "", args: ["ls-tree", "-r", "gh-pages"] });
    expect(gitReplayable("", ["-C", "/work/repo/sub/", "log"], rel)).toEqual({ cwd: "sub", args: ["log"] });
    for (const argv of [
      ["remote", "add", "x", "y"],
      ["remote", "set-url", "origin", "y"],
      ["hash-object", "-w", "a.svg"],
      ["-C", "/elsewhere", "ls-files"],
      ["fetch", "origin"],
      ["add", "-A"],
      ["status", "--porcelain"],
      ["hash-object", "--stdin-paths"],
      ["cat-file", "--batch"],
      ["check-ignore", "--stdin"],
      ["config", "user.name", "x"],
      ["--git-dir=/elsewhere", "ls-files"],
      ["-C", "../other", "ls-files"],
    ]) {
      expect("undetermined" in gitReplayable("", argv)).toBe(true);
    }
  });

  test("a git command that cannot be replayed makes the whole read set undetermined", () => {
    // input-site: inert #16b4582f — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    const r = read([`20 getcwd("/work/repo", 4096) = 11`, `20 execve("/usr/bin/git", ["git", "fetch", "origin"], 0x1 /* 3 vars */) = 0`].join("\n"));
    expect("undetermined" in r && r.undetermined).toContain("git fetch");
  });

  test("git in a directory the run created is its own scratch repository: kept as an ordinary process", () => {
    const r = read(
      [
        // input-site: inert #e7c547d5 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `10 mkdir("/tmp/probe-ab12", 0700) = 0`,
        // input-site: inert #edad0e52 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 getcwd("/tmp/probe-ab12", 4096) = 16`,
        // input-site: inert #a2b8ef9b — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 execve("/usr/bin/git", ["git", "commit", "-qm", "x"], 0x1 /* 3 vars */) = 0`,
        `20 openat(AT_FDCWD</tmp/probe-ab12>, ".git/index", O_RDONLY|O_CLOEXEC) = 3</tmp/probe-ab12/.git/index>`,
        // Its reads of the checkout's .git are kept: no replay answers them.
        `20 openat(AT_FDCWD</tmp/probe-ab12>, "/work/repo/.git/HEAD", O_RDONLY|O_CLOEXEC) = 4</work/repo/.git/HEAD>`,
      ].join("\n"),
    );
    // input-site: inert #bc3a4664 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(r).toEqual({ paths: [".git/HEAD"], git: [], children: ["/usr/bin/git"] });
  });

  test("the programs a child exec'd are named; the command's own exec is not", () => {
    const r = read(
      [
        // input-site: inert #32d89b5b — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `10 execve("/usr/bin/bun", ["bun", "test"], 0x1 /* 3 vars */) = 0`,
        // input-site: inert #628ea74f — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 execve("/usr/bin/bun", ["bun", "x.ts"], 0x1 /* 3 vars */) = 0`,
        // input-site: inert #2ddf12b8 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `21 execve("/usr/bin/nope", ["nope"], 0x1 /* 3 vars */) = -1 ENOENT (No such file or directory)`,
      ].join("\n"),
    );
    // input-site: inert #9b8e89e4 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(r).toEqual({ paths: [], git: [], children: ["/usr/bin/bun"] });
  });

  test("a child that ran inline code is named; installed package files it read are kept outside the read set", () => {
    const r = read(
      [
        // input-site: inert #32d89b5b — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `10 execve("/usr/bin/bun", ["bun", "test"], 0x1 /* 3 vars */) = 0`,
        // input-site: inert #91185dbc — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 execve("/usr/bin/python3", ["python3", "-c", "import x"], 0x1 /* 3 vars */) = 0`,
        // input-site: inert #99c9e692 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 openat(AT_FDCWD</work/repo>, "/usr/lib/python3/dist-packages/x/__init__.py", O_RDONLY|O_CLOEXEC) = 3</usr/lib/python3/dist-packages/x/__init__.py>`,
        // input-site: inert #983aebab — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
        `20 openat(AT_FDCWD</work/repo>, "/usr/lib/python3/dist-packages/y.py", O_RDONLY|O_CLOEXEC) = -1 ENOENT (No such file or directory)`,
      ].join("\n"),
    );
    expect(r).toEqual({
      paths: [],
      git: [],
      // input-site: inert #de00af49 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      children: ["/usr/bin/python3"],
      // input-site: inert #950f806e — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      inline: [{ program: "/usr/bin/python3", code: "import x" }],
      // input-site: inert #8a23f93d — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      external: ["/usr/lib/python3/dist-packages/x/__init__.py"],
    });
  });

  test("inlineCodeOf: python -c and bun -e give their code; a script on stdin is null; a file or -m is none", () => {
    // input-site: inert #3afd3461 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3", ["python3", "-c", "x", "arg"])).toBe("x");
    // input-site: inert #62880d23 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3", ["python3", "-Bc", "y"])).toBe("y");
    // input-site: inert #d46b5793 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3", ["python3"])).toBeNull();
    // input-site: inert #b6e29a60 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3", ["python3", "-u", "-"])).toBeNull();
    // input-site: inert #a6417898 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3", ["python3", "-W", "ignore", "s.py"])).toBeUndefined();
    // input-site: inert #fff14ef0 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/python3.12", ["python3.12", "-m", "json.tool"])).toBeUndefined();
    // input-site: inert #ad63b965 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/bun", ["bun", "-e", "1"])).toBe("1");
    // input-site: inert #3d2ca746 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/bun", ["bun", "x.ts"])).toBeUndefined();
    // input-site: inert #336c2cb6 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(inlineCodeOf("/usr/bin/git", ["git", "-c", "a=b", "log"])).toBeUndefined();
  });

  test("git outside the checkout in a directory the run did not create is still undetermined", () => {
    // input-site: inert #2aba9449 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    for (const mk of [`10 mkdir("/tmp/other", 0700) = 0`, `10 mkdir("/tmp/probe-ab12", 0700) = -1 EEXIST (File exists)`]) {
      // input-site: inert #bafa198e — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      const r = read([mk, `20 getcwd("/tmp/probe-ab12", 4096) = 16`, `20 execve("/usr/bin/git", ["git", "status"], 0x1 /* 3 vars */) = 0`].join("\n"));
      expect("undetermined" in r && r.undetermined).toContain("ran outside the checkout");
    }
  });

  test("the top-level node_modules is left out (bun.lock pins it); a nested one is kept (bean xd1g)", () => {
    expect(excluded("node_modules/zod/index.js", false)).toBe(true);
    expect(excluded("pkg/node_modules/x/index.js", false)).toBe(false);
    expect(excluded("build/ci-cone/records.json", false)).toBe(true);
    expect(excluded("build/regen-cache/traces/1.log", false)).toBe(true);
    expect(excluded("build/other.json", false)).toBe(false);
  });

  test("instance discovery skips exactly the build-output directories the tree digest leaves out", () => {
    expect([...NOT_LAYER_DIRS].sort()).toEqual([...BUILD_OUTPUT_DIRS].sort());
  });

  test("argument splitting respects quotes and brackets; escapes decode", () => {
    expect(splitArgs(`AT_FDCWD</a, b>, "x,y", {a=1, b=2}, 0`)).toEqual(["AT_FDCWD</a, b>", `"x,y"`, "{a=1, b=2}", "0"]);
    expect(unquote(`"a\\"b\\\\c"`)).toBe('a"b\\c');
    expect(unquote(`"abc"...`)).toBeUndefined();
  });

  test("ignores ???( <detached ...> thread-exit lines, while recording paths from syscalls that detached mid-call", () => {
    const r = read(
      [
        `10 openat(AT_FDCWD</work/repo>, "data/a.json", O_RDONLY|O_CLOEXEC) = 3</work/repo/data/a.json>`,
        `11 openat(AT_FDCWD</work/repo>, "data/b.json", O_RDONLY <detached ...>`,
        `12 ???( <detached ...>`,
        `13 <... futex resumed> <detached ...>`,
        `10 +++ exited with 0 +++`,
      ].join("\n"),
    );
    expect(r).toEqual({ paths: ["data/a.json", "data/b.json"], git: [] });
  });

  test("pathState on .git records directory presence without hashing git-internal transient entries, while hashing .git/config by content", () => {
    const tmp = mkdtempSync(join(tmpdir(), "ci-cone-git-state-"));
    try {
      expect(pathState(tmp, ".git", new FileDigests(tmp))).toBe("absent");
      mkdirSync(join(tmp, ".git"), { recursive: true });
      writeFileSync(join(tmp, ".git", "config"), "[core]\n\trepositoryformatversion = 0\n");
      const before = pathState(tmp, ".git", new FileDigests(tmp));
      const cfgBefore = pathState(tmp, ".git/config", new FileDigests(tmp));
      expect(before).toBe("dir");
      expect(cfgBefore).toMatch(/^file [0-9a-f]{64}$/);
      // A sibling git process writing FETCH_HEAD or index.lock inside .git/ must not invalidate a check that only stat-ed .git.
      writeFileSync(join(tmp, ".git", "FETCH_HEAD"), "deadbeef\n");
      writeFileSync(join(tmp, ".git", "index.lock"), "");
      expect(pathState(tmp, ".git", new FileDigests(tmp))).toBe(before);
      expect(pathState(tmp, ".git/config", new FileDigests(tmp))).toBe(cfgBefore);
      // A direct read of .git/config still notices when .git/config itself changes.
      writeFileSync(join(tmp, ".git", "config"), "[core]\n\trepositoryformatversion = 1\n");
      expect(pathState(tmp, ".git/config", new FileDigests(tmp))).not.toBe(cfgBefore);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── End to end, under a real strace ────────────────────────────────────────

const HAS_STRACE = Bun.which("strace") !== null && Bun.spawnSync(["strace", "-f", "-qq", "-o", "/dev/null", "true"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

describe.skipIf(!HAS_STRACE)("the falsifiers, under a real strace (skipped where strace cannot run)", () => {
  let root: string;
  const scripts = {
    "x:check": "bun scripts/x.ts",
    "b:check": "bun scripts/x.ts --against main",
    "w:check": "bun scripts/w.ts",
    "red:check": "bun scripts/red.ts",
    "g:check": "bun scripts/g.ts",
    "o:check": "bun scripts/o.ts",
  };
  const io: PairIO = { inputs: [TRACKED], outputs: [] };
  let baselineId = "entry-1";
  const baseline: BaselineResolver = () => ({ id: baselineId });
  const record = (script = "x:check") => recordRun({ root, scripts, script, io, baseline, sha: "mainsha", stdio: "ignore", runner: ["bun", "run"] });
  const decide = (script = "x:check") => decideRun({ root, scripts, script, io, baseline });
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ci-cone-"));
    baselineId = "entry-1";
    for (const d of ["scripts", "data", "elsewhere"]) mkdirSync(join(root, d));
    write("package.json", JSON.stringify({ name: "fixture", scripts }));
    write("scripts/y.ts", "export const y = 1;\n");
    // Reads data/a.json, follows the file it names (a DATA-DEPENDENT read),
    // lists data/, and probes a path that does not exist.
    write(
      "scripts/x.ts",
      [
        'import { existsSync, readdirSync, readFileSync } from "node:fs";',
        'import { y } from "./y.ts";',
        'const a = JSON.parse(readFileSync("data/a.json", "utf-8"));',
        'readFileSync(a.next, "utf-8");',
        'readdirSync("data");',
        'existsSync("data/maybe.json");',
        "console.log(y);",
      ].join("\n") + "\n",
    );
    write("scripts/w.ts", 'import { writeFileSync } from "node:fs";\nwriteFileSync("data/out.txt", "x");\n');
    write("scripts/red.ts", "process.exit(1);\n");
    // Asks whether opened/ is a directory and reads one file in it, but never lists it (tools#1265).
    write("scripts/o.ts", 'import { readFileSync, statSync } from "node:fs";\nif (statSync("opened").isDirectory()) console.log(readFileSync("opened/k.json", "utf-8"));\n');
    mkdirSync(join(root, "opened"));
    write("opened/k.json", "k\n");
    // Asks git for the tracked files under data/ (a `tree` site), annotated as the audit requires.
    write(
      "scripts/g.ts",
      [
        "// input-site: tree #PIN — ls-files: the index",
        'const r = Bun.spawnSync(["git", "ls-files", "data"], { stdout: "pipe" });',
        "console.log(r.stdout.toString());",
      ].join("\n") + "\n",
    );
    write("data/a.json", '{"next":"data/c.json"}\n');
    write("data/c.json", "c\n");
    write("data/d.json", "d\n");
    write("elsewhere/b.json", "{}\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  /** Pin the annotation in scripts/g.ts the way a reviewer would, then commit the fixture. */
  const gitFixture = () => {
    const lines = readFileSync(join(root, "scripts/g.ts"), "utf-8").split("\n");
    const pin = statementPin(lines, lines.findIndex((l) => l.includes("Bun.spawnSync")));
    write("scripts/g.ts", readFileSync(join(root, "scripts/g.ts"), "utf-8").replace("#PIN", `#${pin}`));
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture");
  };

  test("a `tree` site: git's answer is replayed — a tracked file added under its pathspec makes it RUN, one elsewhere does not", () => {
    gitFixture();
    const r = record("g:check");
    expect(r.note).toStartWith("recorded");
    expect(Object.keys(loadRecords(root)!.checks["g:check"]!.git)).toEqual([JSON.stringify(["", "ls-files", "data"])]);
    expect(decide("g:check").skip).toBe(true);
    write("elsewhere/new.json", "{}\n");
    git("add", "elsewhere/new.json");
    expect(decide("g:check").skip).toBe(true);
    write("data/new.json", "{}\n");
    git("add", "data/new.json");
    expect(decide("g:check").skip).toBe(false);
  });

  test("the result store: a result main's latest record no longer holds is REUSED; an unseen state still runs", () => {
    expect(record().note).toContain("result store");
    write("data/c.json", "c2\n");
    expect(record().note).toContain("result store");
    // records.json now holds the c2 run; the c run lives only in the store.
    write("data/c.json", "c\n");
    const back = decide();
    expect(back.skip).toBe(true);
    expect(back.why).toContain("reused");
    write("data/c.json", "c3\n");
    const unseen = decide();
    expect(unseen.skip).toBe(false);
    expect(unseen.why).toContain("result store: none of 2 stored result(s) matches");
  });

  test("a green run is recorded with what it read, and an untouched tree SKIPS", () => {
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toStartWith("recorded");
    const reads = Object.keys(loadRecords(root)!.checks["x:check"]!.reads);
    for (const p of ["data/a.json", "data/c.json", "data", "data/maybe.json", "scripts/x.ts", "scripts/y.ts", "package.json"]) {
      expect(reads).toContain(p);
    }
    expect(reads).not.toContain("elsewhere/b.json");
    const d = decide();
    expect(d.skip).toBe(true);
    expect(d.skip && d.sha).toBe("mainsha");
  });

  test("a directory it only OPENED: a new entry does not make it run; the file it read, or the directory becoming a file, does (tools#1265)", () => {
    expect(record("o:check").note).toStartWith("recorded");
    const reads = loadRecords(root)!.checks["o:check"]!.reads;
    expect(reads["opened"]).toBe("dir");
    // bun itself lists the checkout root and the directory of every module it loads.
    expect(reads["scripts"]).toStartWith("dir ");
    write("opened/new.json", "{}\n");
    expect(decide("o:check").skip).toBe(true);
    write("opened/k.json", "changed\n");
    expect(decide("o:check").skip).toBe(false);
    write("opened/k.json", "k\n");
    expect(decide("o:check").skip).toBe(true);
    rmSync(join(root, "opened"), { recursive: true });
    write("opened", "now a file\n");
    expect(decide("o:check").skip).toBe(false);
  });

  test("THE CONE: a change to a file the check never read does not make it run", () => {
    record();
    write("elsewhere/b.json", '{"changed":true}\n');
    write("elsewhere/new.json", "{}\n");
    expect(decide().skip).toBe(true);
  });

  test.each([
    ["a traced file edited", () => write("data/c.json", "changed\n")],
    ["a file a data-dependent read now reaches", () => write("data/a.json", '{"next":"data/d.json"}\n')],
    ["a probed absent path created", () => write("data/maybe.json", "{}\n")],
    ["a new file in a listed directory", () => write("data/e.json", "{}\n")],
    ["the script itself edited", () => write("scripts/x.ts", readFileSync(join(root, "scripts/x.ts"), "utf-8") + "\n// edit\n")],
    ["a module it IMPORTS edited", () => write("scripts/y.ts", "export const y = 2;\n")],
    ["package.json edited (bun reads it to run the check)", () => write("package.json", JSON.stringify({ name: "fixture2", scripts }))],
  ])("%s → it RUNS", (_name, change) => {
    record();
    expect(decide().skip).toBe(true);
    change();
    expect(decide().skip).toBe(false);
  });

  test("a moved --against baseline makes it run, though no file changed", () => {
    expect(record("b:check").note).toStartWith("recorded");
    expect(decide("b:check").skip).toBe(true);
    baselineId = "entry-2";
    expect(decide("b:check").skip).toBe(false);
  });

  test("a check that writes inside the checkout records nothing, so it always runs", () => {
    const r = record("w:check");
    expect(r.note).toContain("writes inside the checkout");
    expect(decide("w:check").skip).toBe(false);
  });

  test("a red run records nothing, keeps its own exit code, and forgets an earlier pass", () => {
    const r = record("red:check");
    expect(r.code).toBe(1);
    expect(r.note).toContain("re-run untraced, which exited 1");
    expect(decide("red:check").skip).toBe(false);
  });

  test("every check is a candidate, declared in task-io or not (owner, 2026-11-13: every gate)", () => {
    // No input declaration at all, and none naming {tracked}: the traced read
    // set alone decides, as for a test file.
    for (const undeclared of [undefined, { outputs: [] }]) {
      rmSync(join(root, "build"), { recursive: true, force: true });
      const r = recordRun({ root, scripts, script: "x:check", io: undeclared, baseline, sha: "mainsha", stdio: "ignore", runner: ["bun", "run"] });
      expect(r.code).toBe(0);
      expect(r.note).toContain("recorded");
      expect(decideRun({ root, scripts, script: "x:check", io: undeclared, baseline }).skip).toBe(true);
    }
  });

  test("an undeclared check still runs when a path it read changed", () => {
    recordRun({ root, scripts, script: "x:check", io: undefined, baseline, sha: "mainsha", stdio: "ignore", runner: ["bun", "run"] });
    expect(decideRun({ root, scripts, script: "x:check", io: undefined, baseline }).skip).toBe(true);
    // c.json is read only because a.json names it: a data-dependent read no declaration lists.
    writeFileSync(join(root, "data", "c.json"), "changed\n");
    expect(decideRun({ root, scripts, script: "x:check", io: undefined, baseline }).skip).toBe(false);
  });

  test("no record, or a record from another tracer version, means run", () => {
    expect(decide().skip).toBe(false);
    record();
    const path = join(root, "build", "ci-cone", "records.json");
    const rec = JSON.parse(readFileSync(path, "utf-8"));
    writeFileSync(path, JSON.stringify({ ...rec, version: -1 }));
    // The same green run is also in the result store, under THIS tracer's
    // recipe, and would rightly be reused. Without it, records.json alone decides.
    rmSync(join(root, "build", "result-store"), { recursive: true, force: true });
    expect(decide().skip).toBe(false);
  });
});

test("strace availability is reported, not hidden", () => {
  // The falsifier block above is skipped where strace cannot run. Say which
  // happened here, so a green run without strace is not read as one with it.
  console.log(`ci-cone.test: strace ${HAS_STRACE ? "available, falsifiers ran" : "NOT available, falsifiers skipped"}`);
  expect(typeof HAS_STRACE).toBe("boolean");
});

describe.skipIf(!HAS_STRACE)("test files as gates: a test's result is reused only when what it READ is unchanged", () => {
  let root: string;
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);
  const T = "test:t/a.test.ts";
  const scripts = () => testGates(root, ["t/a.test.ts", "t/red.test.ts"]);
  const record = (name = T) => recordRun({ root, scripts: scripts(), script: name, io: undefined, baseline: undefined, sha: "mainsha", stdio: "ignore" });
  const decide = (name = T) => decideRun({ root, scripts: scripts(), script: name, io: undefined, baseline: undefined });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ci-cone-tests-"));
    for (const d of ["t", "fixtures", "elsewhere"]) mkdirSync(join(root, d));
    write("package.json", JSON.stringify({ name: "fixture" }));
    write("bunfig.toml", '[test]\npreload = ["./t/preload.ts"]\n');
    write("t/preload.ts", "export {};\n");
    // A fixture read the import closure cannot see: only the trace names it.
    write(
      "t/a.test.ts",
      ['import { expect, test } from "bun:test";', 'import { readFileSync } from "node:fs";', 'test("reads its fixture", () => expect(readFileSync("fixtures/f.json", "utf-8")).toContain("ok"));'].join("\n") + "\n",
    );
    write("t/red.test.ts", 'import { expect, test } from "bun:test";\ntest("red", () => expect(1).toBe(2));\n');
    write("fixtures/f.json", '{"ok":1}\n');
    write("elsewhere/x.json", "{}\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("a green test file is recorded and SKIPS on an untouched tree, or when only an unrelated file changed", () => {
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toStartWith("recorded");
    expect(Object.keys(loadRecords(root)!.checks[T]!.reads)).toContain("fixtures/f.json");
    expect(decide().skip).toBe(true);
    write("elsewhere/x.json", '{"changed":1}\n');
    expect(decide().skip).toBe(true);
  });

  test("its fixture, its preload or the test itself changed: it RUNS", () => {
    record();
    write("fixtures/f.json", '{"ok":2}\n');
    expect(decide().skip).toBe(false);
    write("fixtures/f.json", '{"ok":1}\n');
    expect(decide().skip).toBe(true);
    write("t/preload.ts", "export const p = 1;\n");
    expect(decide().skip).toBe(false);
    write("t/preload.ts", "export {};\n");
    write("t/a.test.ts", readFileSync(join(root, "t/a.test.ts"), "utf-8") + "// edited\n");
    expect(decide().skip).toBe(false);
  });

  test("a red test file is never recorded", () => {
    const r = record("test:t/red.test.ts");
    expect(r.code).not.toBe(0);
    expect(r.note).toContain("not recorded");
    expect(decide("test:t/red.test.ts").skip).toBe(false);
  });

  test("the fingerprint audits the bunfig preloads as entries", () => {
    expect(preloadScripts(root)).toEqual({ "test-preload:t/preload.ts": "bun ./t/preload.ts" });
    expect(scripts()[T]).toBe("bun test ./t/a.test.ts");
  });
});

describe.skipIf(!HAS_STRACE)("a test's bun children: their environment is derived from the trace", () => {
  let root: string;
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);
  const T = "test:t/spawn.test.ts";
  const scripts = () => testGates(root, ["t/spawn.test.ts"]);
  const record = () => recordRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined, sha: "mainsha", stdio: "ignore" });
  const decide = () => decideRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined });
  const VAR = "CONE_CHILD_FIXTURE";
  /** The child, its env read annotated and pinned the way a reviewer would. */
  const child = (extra = "") => {
    const lines = [`// input-site: env ${VAR} #PIN — the fixture's variable`, `const v = process.env.${VAR};`, "console.log(v ?? '');", extra];
    write("t/child.ts", lines.join("\n").replace("#PIN", `#${statementPin(lines, 1)}`) + "\n");
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ci-cone-child-"));
    mkdirSync(join(root, "t"));
    write("package.json", JSON.stringify({ name: "fixture" }));
    write(
      "t/spawn.test.ts",
      [
        'import { expect, test } from "bun:test";',
        'test("runs its child", () => {',
        '  const r = Bun.spawnSync(["bun", "t/child.ts"], { stdout: "pipe" });',
        "  expect(r.exitCode).toBe(0);",
        "});",
      ].join("\n") + "\n",
    );
    child();
    process.env[VAR] = "one";
  });
  afterEach(() => {
    delete process.env[VAR];
    rmSync(root, { recursive: true, force: true });
  });

  test("the child's variable is recorded; changing it, or the child, makes the test RUN", () => {
    const r = record();
    expect(r.note).toStartWith("recorded");
    expect(loadRecords(root)!.checks[T]!.env).toEqual({ [VAR]: "one" });
    expect(decide().skip).toBe(true);
    process.env[VAR] = "two";
    expect(decide()).toMatchObject({ skip: false, why: expect.stringContaining(VAR) });
    process.env[VAR] = "one";
    expect(decide().skip).toBe(true);
    child("// edited");
    expect(decide().skip).toBe(false);
  });

  test("a child module with a site nobody reviewed records nothing", () => {
    write("t/child.ts", "console.log(process.env.HOME);\n");
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toContain("a bun child's modules");
    expect(decide().skip).toBe(false);
  });
});

describe.skipIf(!HAS_STRACE || Bun.which("python3") === null)("a test's python children: their sources are audited from the trace", () => {
  let root: string;
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);
  const T = "test:t/py.test.ts";
  const scripts = () => testGates(root, ["t/py.test.ts"]);
  const record = () => recordRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined, sha: "mainsha", stdio: "ignore" });
  const decide = () => decideRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined });
  const VAR = "CONE_PY_FIXTURE";
  /** The child, its env read annotated and pinned the way a reviewer would. */
  const child = (extra = "") => {
    const lines = ["import os", `v = os.environ.get("${VAR}", "")`, "print(v)", extra];
    lines.splice(1, 0, `# input-site: env ${VAR} #${statementPin(lines, 1)} — the fixture's variable`);
    write("t/child.py", lines.join("\n") + "\n");
  };
  const testFile = (args: string) =>
    write(
      "t/py.test.ts",
      ['import { expect, test } from "bun:test";', 'test("runs its child", () => {', `  const r = Bun.spawnSync(["python3", ${args}], { stdout: "pipe" });`, "  expect(r.exitCode).toBe(0);", "});"].join("\n") + "\n",
    );

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ci-cone-py-"));
    mkdirSync(join(root, "t"));
    write("package.json", JSON.stringify({ name: "fixture" }));
    testFile('"t/child.py"');
    child();
    process.env[VAR] = "one";
  });
  afterEach(() => {
    delete process.env[VAR];
    rmSync(root, { recursive: true, force: true });
  });

  test("the child's variable and interpreter are recorded; changing the variable or the script makes the test RUN", () => {
    const r = record();
    expect(r.note).toStartWith("recorded");
    const rec = loadRecords(root)!.checks[T]!;
    expect(rec.env![VAR]).toBe("one");
    expect(rec.env).toHaveProperty("PYTHONPATH");
    expect(Object.keys(rec.tools ?? {}).some((p) => /python3/.test(p))).toBe(true);
    expect(decide().skip).toBe(true);
    process.env[VAR] = "two";
    expect(decide()).toMatchObject({ skip: false, why: expect.stringContaining(VAR) });
    process.env[VAR] = "one";
    expect(decide().skip).toBe(true);
    child("# edited");
    expect(decide().skip).toBe(false);
  });

  test("a python source with a site nobody reviewed records nothing", () => {
    write("t/child.py", "import time\nprint(time.time())\n");
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toContain("a python child's sources");
  });

  test("inline code is audited from its command line: clean code records, a site nobody reviewed does not", () => {
    testFile('"-c", "print(1)"');
    expect(record().note).toStartWith("recorded");
    expect(decide().skip).toBe(true);
    testFile('"-c", "import time; print(time.time())"');
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toContain("inline code");
  });

  test("a script read from stdin records nothing", () => {
    write(
      "t/py.test.ts",
      ['import { expect, test } from "bun:test";', 'test("stdin", () => {', '  const r = Bun.spawnSync(["python3"], { stdin: new TextEncoder().encode("print(1)"), stdout: "pipe" });', "  expect(r.exitCode).toBe(0);", "});"].join("\n") + "\n",
    );
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toContain("from stdin");
  });

  test("an imported python module's __pycache__ is neither an input nor a write", () => {
    write("t/helper.py", "def f():\n    return 1\n");
    write("t/child.py", "import sys\nsys.path.insert(0, 't')\nimport helper\nprint(helper.f())\n");
    expect(record().note).toStartWith("recorded");
    expect(Object.keys(loadRecords(root)!.checks[T]!.reads).some((p) => p.includes("__pycache__"))).toBe(false);
    expect(decide().skip).toBe(true);
  });
});

describe.skipIf(!HAS_STRACE)("a computed load the run did not open is no input; one it opened is audited from the trace", () => {
  let root: string;
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);
  const T = "test:t/a.test.ts";
  const scripts = () => testGates(root, ["t/a.test.ts"]);
  const record = () => recordRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined, sha: "mainsha", stdio: "ignore" });
  const decide = () => decideRun({ root, scripts: scripts(), script: T, io: undefined, baseline: undefined });
  const VAR = "CONE_PLUGIN_FIXTURE";
  /** A plugin whose env read is annotated and pinned the way a reviewer would. */
  const reviewedPlugin = () => {
    const lines = [`// input-site: env ${VAR} #PIN — the fixture's variable`, `export const v = process.env.${VAR} ?? "";`];
    write("plugins/p.ts", lines.join("\n").replace("#PIN", `#${statementPin(lines, 1)}`) + "\n");
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ci-cone-defer-"));
    for (const d of ["t", "plugins", "data"]) mkdirSync(join(root, d));
    write("package.json", JSON.stringify({ name: "fixture" }));
    const load = "const m = await import(join(process.cwd(), p));";
    const loader = ['import { join } from "node:path";', "export async function loadPlugin(p: string) {", "  // input-site: imports plugins/*.ts #PIN — the plugins the data names", `  ${load}`, "  return m;", "}"];
    write("t/loader.ts", loader.join("\n").replace("#PIN", `#${statementPin(loader, 3)}`) + "\n");
    write(
      "t/a.test.ts",
      [
        'import { expect, test } from "bun:test";',
        'import { readFileSync } from "node:fs";',
        'import { loadPlugin } from "./loader.ts";',
        'test("loads the plugin the data names, if any", async () => {',
        '  const which = readFileSync("data/which.txt", "utf-8").trim();',
        '  if (which !== "") expect(typeof (await loadPlugin(which)).v).toBe("string");',
        "});",
      ].join("\n") + "\n",
    );
    write("plugins/p.ts", "export const v = process.env.HOME ?? '';\n"); // an unreviewed site
    write("data/which.txt", "\n");
    process.env[VAR] = "one";
  });
  afterEach(() => {
    delete process.env[VAR];
    rmSync(root, { recursive: true, force: true });
  });

  test("a plugin the run never loaded does not stop the record, even with an unreviewed site", () => {
    expect(record().note).toStartWith("recorded");
    expect(decide().skip).toBe(true);
  });

  test("a loaded plugin with an unreviewed site records nothing", () => {
    write("data/which.txt", "plugins/p.ts\n");
    const r = record();
    expect(r.code).toBe(0);
    expect(r.note).toContain("a module the run loaded by a computed load");
  });

  test("a loaded, reviewed plugin's variable is recorded, and a change to it or to the plugin RUNS", () => {
    write("data/which.txt", "plugins/p.ts\n");
    reviewedPlugin();
    expect(record().note).toStartWith("recorded");
    expect(loadRecords(root)!.checks[T]!.env).toEqual({ [VAR]: "one" });
    expect(decide().skip).toBe(true);
    process.env[VAR] = "two";
    expect(decide().skip).toBe(false);
    process.env[VAR] = "one";
    write("plugins/p.ts", readFileSync(join(root, "plugins/p.ts"), "utf-8") + "// edited\n");
    expect(decide().skip).toBe(false);
  });
});

describe("which runs record (recordsOnMain)", () => {
  test("a push to main records", () => {
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" })).toBe(true);
  });
  test("a dispatch on main records too: a train's merge starts no push run (bean hd58)", () => {
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" })).toBe(true);
  });
  test("nothing else records: a dispatch on another branch, a PR, a merge group", () => {
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/repin-train/x" })).toBe(false);
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge" })).toBe(false);
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "merge_group", GITHUB_REF: "refs/heads/gh-readonly-queue/main/x" })).toBe(false);
    expect(recordsOnMain({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/feature" })).toBe(false);
    expect(recordsOnMain({})).toBe(false);
  });
});
