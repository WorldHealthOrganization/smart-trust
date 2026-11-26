/**
 * `scripts/precheck.ts` — the pre-push precheck (owner, card 2026-11-18): only
 * the fast checks whose inputs the push changed, nothing when nothing relevant
 * changed, never in the way of a push it cannot judge.
 *
 * `run()` is exercised in a throwaway git repository whose `bun` and `tsc`
 * are stubs that log their arguments and exit as told, so the test judges what
 * runs and what the push is told, not the checks themselves.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { outcomeOf, parsePushStdin, planFor, run, type Check } from "../../precheck.ts";

const SCRIPTS = resolve(import.meta.dir, "..", "..");

const sh = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

interface Repo {
  root: string;
  log: string;
  bin: string;
  base: string;
}

/** A repository with a `cat` runner and node_modules, one commit on `main`, and `origin/main` at it. */
function repo(opts: { setUp?: boolean; tsc?: boolean } = {}): Repo {
  const root = mkdtempSync(join(tmpdir(), "precheck-"));
  const bin = mkdtempSync(join(tmpdir(), "precheck-bin-"));
  const log = join(bin, "calls.log");
  writeFileSync(log, "");
  sh(root, "init", "-q", "-b", "main");
  sh(root, "config", "user.email", "t@example.invalid");
  sh(root, "config", "user.name", "t");
  writeFileSync(join(root, "package.json"), JSON.stringify(opts.setUp === false ? { scripts: {} } : { scripts: { cat: "bun .github/cat.ts" } }));
  writeFileSync(join(root, "tsconfig.json"), "{}");
  writeFileSync(join(root, "index.lock.json"), "{}");
  writeFileSync(join(root, "README.md"), "x\n");
  writeFileSync(join(root, ".gitignore"), "node_modules\n");
  sh(root, "add", "-A");
  sh(root, "commit", "-q", "-m", "base");
  const base = sh(root, "rev-parse", "HEAD");
  sh(root, "update-ref", "refs/remotes/origin/main", base);
  if (opts.setUp !== false) mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
  // The stub `bun` exits with $STUB_<check> (default 0); `tsc` with $STUB_tsc.
  writeFileSync(join(bin, "bun"), `#!/usr/bin/env bash\necho "bun $*" >> "${log}"\nn="\${3//[:-]/_}"; v="STUB_$n"; [ -n "\${STUB_SLEEP:-}" ] && sleep "$STUB_SLEEP"; echo "out of $3"; exit "\${!v:-0}"\n`);
  chmodSync(join(bin, "bun"), 0o755);
  if (opts.tsc !== false && opts.setUp !== false) {
    const tsc = join(root, "node_modules", ".bin", "tsc");
    writeFileSync(tsc, `#!/usr/bin/env bash\necho "tsc $*" >> "${log}"\nexit "\${STUB_tsc:-0}"\n`);
    chmodSync(tsc, 0o755);
  }
  return { root, log, bin, base };
}

function change(r: Repo, files: Record<string, string>) {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(r.root, p, ".."), { recursive: true });
    writeFileSync(join(r.root, p), body);
  }
  sh(r.root, "add", "-A");
  sh(r.root, "commit", "-q", "-m", "change");
}

function go(r: Repo, env: Record<string, string> = {}, argv: string[] = [], stdin = ""): { code: number; calls: string[] } {
  const saved = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  let code: number;
  try {
    // input-site: env PATH #5a371b1a — PATH handed to the run, so the stub bun is the one it starts
    code = run(r.root, argv, stdin, { PATH: `${r.bin}:${process.env.PATH ?? ""}`, ...env });
  } finally {
    process.stderr.write = saved;
  }
  return { code, calls: readFileSync(r.log, "utf-8").trim().split("\n").filter(Boolean) };
}

describe("precheck: the plan follows what the push changed", () => {
  test("nothing it checks: no check", () => {
    expect(planFor(["README.md", "docs/x.md", "schemas/a.json"], { tsc: "tsc" })).toEqual([]);
  });

  test("the lock or the config: lock:coherence:check (agreement and freshness) and mount:remote:check", () => {
    for (const p of ["index.lock.json", "index.config.json"]) {
      expect(planFor([p]).map((c) => c.name)).toEqual(["lock:coherence:check", "mount:remote:check"]);
    }
  });

  test(".github/workflows: check:workflow-pins only", () => {
    expect(planFor([".github/workflows/x.yml"]).map((c) => c.name)).toEqual(["check:workflow-pins"]);
    expect(planFor([".github/cat.ts"], {}).map((c) => c.name)).toEqual([]);
  });

  test("TypeScript: the typecheck, only with a tsc to run it", () => {
    expect(planFor(["scripts/a.ts"], { tsc: "/x/tsc" })).toEqual([{ name: "typecheck", argv: ["/x/tsc", "--noEmit", "-p", "tsconfig.json"], why: "changes 1 TypeScript file(s)" }]);
    expect(planFor(["scripts/a.ts"], {})).toEqual([]);
  });

  test("git's pre-push stdin is read four fields a line", () => {
    expect(parsePushStdin("refs/heads/a 1111 refs/heads/a 0000\n\n")).toEqual([{ localRef: "refs/heads/a", localSha: "1111", remoteRef: "refs/heads/a", remoteSha: "0000" }]);
  });

  test("an exit of 0 passes, 2 or a timeout is undetermined, any other is red", () => {
    const c: Check = { name: "x", argv: ["x"], why: "" };
    expect(outcomeOf(c, { status: 0 }, "", 1, 90).status).toBe("pass");
    expect(outcomeOf(c, { status: 2 }, "", 1, 90).status).toBe("undetermined");
    const err = Object.assign(new Error("t"), { code: "ETIMEDOUT" });
    expect(outcomeOf(c, { status: null, error: err }, "", 90, 90)).toMatchObject({ status: "undetermined", detail: "ran past 90s" });
    expect(outcomeOf(c, { status: 1 }, "boom\n", 1, 90)).toMatchObject({ status: "red", detail: "boom" });
  });
});

describe("precheck: run() in a repository", () => {
  test("a push that changes nothing it checks does nothing", () => {
    const r = repo();
    change(r, { "README.md": "y\n" });
    expect(go(r)).toEqual({ code: 0, calls: [] });
  });

  test("a lock change runs the lock and mount checks, and passes when they pass", () => {
    const r = repo();
    change(r, { "index.lock.json": '{"a":1}' });
    const g = go(r);
    expect(g.code).toBe(0);
    expect(g.calls).toEqual(["bun run cat lock:coherence:check", "bun run cat mount:remote:check"]);
  });

  test("a red check refuses the push", () => {
    const r = repo();
    change(r, { "index.lock.json": '{"a":1}' });
    expect(go(r, { STUB_lock_coherence_check: "1" }).code).toBe(1);
  });

  test("a check that could not determine (exit 2) or ran past its time lets the push through", () => {
    const r = repo();
    change(r, { ".github/workflows/x.yml": "on: push\n" });
    expect(go(r, { STUB_check_workflow_pins: "2" })).toEqual({ code: 0, calls: ["bun run cat check:workflow-pins"] });
    expect(go(r, { STUB_SLEEP: "3", CAT_PRECHECK_TIMEOUT: "1" }).code).toBe(0);
  });

  test("a TypeScript change runs the checkout's own tsc; a red typecheck refuses", () => {
    const r = repo();
    change(r, { "scripts/a.ts": "export const a = 1;\n" });
    const g = go(r);
    expect(g.code).toBe(0);
    expect(g.calls).toEqual(["tsc --noEmit -p tsconfig.json"]);
    expect(go(r, { STUB_tsc: "1" }).code).toBe(1);
  });

  test("no tsc in node_modules: the typecheck is left to CI, nothing is installed", () => {
    const r = repo({ tsc: false });
    change(r, { "scripts/a.ts": "export const a = 1;\n" });
    expect(go(r)).toEqual({ code: 0, calls: [] });
  });

  test("a checkout that is not set up (no cat runner, no node_modules) lets the push through and runs nothing", () => {
    const r = repo({ setUp: false });
    change(r, { "index.lock.json": '{"a":1}', "scripts/a.ts": "x" });
    expect(go(r)).toEqual({ code: 0, calls: [] });
  });

  test("tracked changes not committed: the checks would judge another tree, so none runs", () => {
    const r = repo();
    change(r, { "index.lock.json": '{"a":1}' });
    writeFileSync(join(r.root, "index.lock.json"), '{"a":2}');
    expect(go(r)).toEqual({ code: 0, calls: [] });
  });

  test("CAT_PRECHECK=0 turns it off", () => {
    const r = repo();
    change(r, { "index.lock.json": '{"a":1}' });
    expect(go(r, { CAT_PRECHECK: "0", STUB_lock_coherence_check: "1" })).toEqual({ code: 0, calls: [] });
  });

  test("as git's hook: the pushed refs on stdin, diffed against the remote's tip", () => {
    const r = repo();
    change(r, { "index.lock.json": '{"a":1}' });
    const mid = sh(r.root, "rev-parse", "HEAD");
    change(r, { "README.md": "later\n" });
    const head = sh(r.root, "rev-parse", "HEAD");
    // The remote already has the lock change: this push carries only README.
    expect(go(r, {}, ["--git-hook", "origin"], `refs/heads/main ${head} refs/heads/main ${mid}\n`)).toEqual({ code: 0, calls: [] });
    // A new branch: against the merge base with origin/main, so the lock change counts.
    expect(go(r, {}, ["--git-hook", "origin"], `refs/heads/b ${head} refs/heads/b ${"0".repeat(40)}\n`).calls).toContain("bun run cat lock:coherence:check");
    // Pushing a commit that is not HEAD: not judged.
    writeFileSync(r.log, "");
    expect(go(r, {}, ["--git-hook", "origin"], `refs/heads/b ${mid} refs/heads/b ${"0".repeat(40)}\n`)).toEqual({ code: 0, calls: [] });
  });
});

describe("precheck: installed as git's pre-push hook", () => {
  const HOOK = join(SCRIPTS, "git-hooks", "pre-push");
  const SWEEP = join(SCRIPTS, "session-start-coord-sweep.sh");

  test("the hook runs the precheck before the gates, and a red precheck stops the push", () => {
    const hook = readFileSync(HOOK, "utf-8");
    expect(hook).toContain("cat-harness-tools pre-push hook");
    const loop = hook.slice(hook.indexOf("for p in cat-harness-tools/scripts/precheck.ts scripts/precheck.ts"), hook.indexOf("# By path"));
    expect(loop).toContain(`bun run "$p" --git-hook "$1" || exit 1`);
    expect(hook.indexOf("scripts/precheck.ts")).toBeLessThan(hook.indexOf("scripts/pre-push-gates.ts"));
    expect(hook).toContain("command -v bun >/dev/null 2>&1 ||");
  });

  /** Run the session-start block that installs the hook, from a scripts dir holding git-hooks/pre-push. */
  function installBlock(gitRoot: string): string {
    const sweep = readFileSync(SWEEP, "utf-8");
    const block = sweep.slice(sweep.indexOf("# ── -0.5. The pre-push precheck hook"), sweep.indexOf('REPO_ROOT="$(bash'));
    const dir = mkdtempSync(join(tmpdir(), "precheck-sweep-"));
    mkdirSync(join(dir, "git-hooks"));
    copyFileSync(HOOK, join(dir, "git-hooks", "pre-push"));
    writeFileSync(join(dir, "block.sh"), `SESSION_GIT_ROOT="${gitRoot}"\n${block}`);
    const r = spawnSync("bash", [join(dir, "block.sh")], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    return r.stdout;
  }

  test("session start installs it where there is none, and says so once", () => {
    const r = repo();
    const out = installBlock(r.root);
    expect(out).toContain("pre-push precheck hook is installed");
    expect(readFileSync(join(r.root, ".git", "hooks", "pre-push"), "utf-8")).toBe(readFileSync(HOOK, "utf-8"));
    expect(installBlock(r.root)).toBe("");
  });

  test("session start updates our older hook, and leaves anyone else's alone", () => {
    const r = repo();
    const dst = join(r.root, ".git", "hooks", "pre-push");
    writeFileSync(dst, "#!/bin/sh\nbun run scripts/pre-push-gates.ts --git-hook \"$1\"\n");
    installBlock(r.root);
    expect(readFileSync(dst, "utf-8")).toBe(readFileSync(HOOK, "utf-8"));
    writeFileSync(dst, "#!/bin/sh\necho mine\n");
    expect(installBlock(r.root)).toBe("");
    expect(readFileSync(dst, "utf-8")).toBe("#!/bin/sh\necho mine\n");
  });
});
