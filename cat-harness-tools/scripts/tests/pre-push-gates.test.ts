/**
 * The pre-push gate hook: reading a push, the tree-keyed record, and the
 * verdict on a throwaway repository whose `cat` runner is a stub that writes
 * the report a real `bun run cat gates --report` would.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { failedTests, gatesEnabled, judge, parsePushCommand, parsePushStdin, testEnv } from "../pre-push-gates.ts";
import { readDurations } from "../gate-durations.ts";
import { buildRecord, covers, newFailures, readRecord, readResults, stateDir, toolVersions, treeOf, type GatesReportLike } from "../gate-record.ts";

const PASS: GatesReportLike = {
  $schema: "folio-gates-report/v1",
  outcome: "pass",
  exitCode: 0,
  set: "fast",
  gates: 2,
  commands: ["bun run cat check:a", "bun run cat check:b"],
  failed: [],
  skipped: [{ command: "bun run cat check:b", why: "inputs unchanged" }],
  undetermined: [],
};

describe("parsePushCommand", () => {
  test("a plain push pushes HEAD", () => {
    expect(parsePushCommand("git push -u origin claude/x")).toEqual({ sources: ["claude/x"], noVerify: false, dryRun: false });
    expect(parsePushCommand("git push")?.sources).toEqual(["HEAD"]);
  });
  test("finds the push inside a compound command, past git's own options", () => {
    expect(parsePushCommand("cd a && git -C . push origin HEAD:refs/heads/b")?.sources).toEqual(["HEAD"]);
  });
  test("a delete names no source", () => {
    expect(parsePushCommand("git push origin :old")?.sources).toEqual([]);
  });
  test("reads the bypass reason and --no-verify", () => {
    const p = parsePushCommand("CAT_GATES_BYPASS='ci is down' git push --no-verify origin x");
    expect(p?.bypass).toBe("ci is down");
    expect(p?.noVerify).toBe(true);
  });
  test("a dry run and a non-push are told apart", () => {
    expect(parsePushCommand("git push -n origin x")?.dryRun).toBe(true);
    expect(parsePushCommand("git status && echo git push")).toBeUndefined();
    expect(parsePushCommand("git log --oneline")).toBeUndefined();
  });
});

test("parsePushStdin reads git's four fields per line", () => {
  const z = "0".repeat(40);
  expect(parsePushStdin(`refs/heads/a ${"1".repeat(40)} refs/heads/a ${z}\n\n`)).toEqual([
    { localRef: "refs/heads/a", localSha: "1".repeat(40), remoteRef: "refs/heads/a", remoteSha: z },
  ]);
});

describe("the record", () => {
  const ctx = { tree: "a".repeat(40), commit: "b".repeat(40), tools: { bun: "1.0.0", git: "2", platform: "x" }, runBy: "human" as const, startedAt: "s", finishedAt: "f" };
  test("only a pass that names its gate set is recorded", () => {
    expect(buildRecord(PASS, ctx)?.gates).toEqual(PASS.commands!);
    expect(buildRecord({ ...PASS, outcome: "fail", exitCode: 1 }, ctx)).toBeUndefined();
    expect(buildRecord({ ...PASS, commands: undefined }, ctx)).toBeUndefined();
    expect(buildRecord({ ...PASS, commands: ["one"] }, ctx)).toBeUndefined();
  });
  test("covers needs the same tree and the same bun", () => {
    const rec = buildRecord(PASS, ctx)!;
    expect(covers(rec, ctx.tree, ctx.tools).covered).toBe(true);
    expect(covers(rec, "c".repeat(40), ctx.tools).covered).toBe(false);
    expect(covers(rec, ctx.tree, { ...ctx.tools, bun: "9.9.9" }).covered).toBe(false);
    expect(covers(undefined, ctx.tree, ctx.tools).covered).toBe(false);
  });
});

test("newFailures: only a gate green on the base, under the same bun, is this push's", () => {
  const tools = { bun: "1", git: "2", platform: "x" };
  const base = { $schema: "cat-local-gate-results/v1" as const, tree: "t", tools, at: "", outcomes: { a: "pass" as const, b: "fail" as const, c: "skipped" as const } };
  expect(newFailures(["a", "b", "c", "d"], base, tools)).toEqual(["a", "c"]);
  expect(newFailures(["a"], base, { ...tools, bun: "2" })).toEqual([]);
  expect(newFailures(["a"], undefined, tools)).toEqual([]);
});

describe("judge, on a throwaway repository", () => {
  let root: string;
  const sh = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  /** A `cat` runner stub: writes the report and exits with `code`, counting its runs. */
  const stub = (code: number, report: GatesReportLike) => {
    writeFileSync(join(root, "report.fixture.json"), JSON.stringify(report));
    writeFileSync(
      join(root, "fake-cat.ts"),
      `import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
const a = process.argv; const out = a[a.indexOf("--report") + 1]!;
appendFileSync(${JSON.stringify(join(root, "runs.txt"))}, "x");
writeFileSync(out, readFileSync(${JSON.stringify(join(root, "report.fixture.json"))}, "utf-8"));
process.exit(${code});\n`,
    );
  };
  const runs = () => (existsSync(join(root, "runs.txt")) ? readFileSync(join(root, "runs.txt"), "utf-8").length : 0);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pre-push-"));
    sh("init", "-q");
    sh("config", "user.email", "t@example.invalid");
    sh("config", "user.name", "t");
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { cat: "bun run fake-cat.ts" } }));
    writeFileSync(join(root, ".gitignore"), "fake-cat.ts\nreport.fixture.json\nruns.txt\nargv.txt\nbuild/\n");
    sh("add", "-A");
    sh("commit", "-qm", "init");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("a pass is recorded, never noted on the commit, and the same tree is not judged twice", async () => {
    stub(0, PASS);
    const head = sh("rev-parse", "HEAD").stdout.trim();
    expect((await judge(root, [head])).kind).toBe("allow");
    expect(runs()).toBe(1);
    const tree = treeOf(root, head)!;
    expect(covers(readRecord(root, tree), tree, toolVersions(root)).covered).toBe(true);
    // CI never honours a local record (owner's ruling, 2026-11-06): nothing is attached to the commit.
    expect(sh("notes", "--ref=refs/notes/cat-gates", "show", head).status).not.toBe(0);
    // An amend of the message keeps the tree: still covered, no second run.
    sh("commit", "-q", "--amend", "-m", "reworded");
    expect((await judge(root, [sh("rev-parse", "HEAD").stdout.trim()])).kind).toBe("allow");
    expect(runs()).toBe(1);
  });

  test("the time budget: a read-only gate timed over it here is held out of the next run, and the seed covers what is not timed yet", async () => {
    stub(0, PASS);
    // The stub also prints two pool lines, and keeps the argv it was given.
    writeFileSync(
      join(root, "fake-cat.ts"),
      readFileSync(join(root, "fake-cat.ts"), "utf-8").replace(
        "process.exit(",
        `appendFileSync(${JSON.stringify(join(root, "argv.txt"))}, JSON.stringify(a.slice(2)) + "\\n");
console.log("▸ bun run cat check:a   (75.0s, parallel)");
console.log("▸ bun run cat check:b   (3.0s, parallel)");
process.exit(`,
      ),
    );
    const argvs = () => readFileSync(join(root, "argv.txt"), "utf-8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    const excepts = (a: string[]) => a.flatMap((x, i) => (a[i - 1] === "--except" ? [x] : []));
    const first = await judge(root, [sh("rev-parse", "HEAD").stdout.trim()]);
    expect(first.kind).toBe("allow");
    // Nothing timed here yet: the committed seed's gates are held out, with the whole suite.
    expect(excepts(argvs()[0]!)).toContain("bun test");
    expect(excepts(argvs()[0]!)).toContain("bun run cat skill:register:check");
    expect(excepts(argvs()[0]!)).not.toContain("bun run cat check:a");
    expect(readDurations(root)!.seconds).toEqual({ "bun run cat check:a": 75, "bun run cat check:b": 3 });
    // A new tree: check:a, timed at 75 s here, is now held out; check:b is not.
    writeFileSync(join(root, "x.txt"), "x");
    sh("add", "x.txt");
    sh("commit", "-qm", "x");
    expect((await judge(root, [sh("rev-parse", "HEAD").stdout.trim()])).kind).toBe("allow");
    expect(excepts(argvs()[1]!)).toContain("bun run cat check:a");
    expect(excepts(argvs()[1]!)).not.toContain("bun run cat check:b");
    // Budget 0: every gate runs (only the whole suite is held out).
    sh("config", "cat.gates.budgetSeconds", "0");
    writeFileSync(join(root, "y.txt"), "y");
    sh("add", "y.txt");
    sh("commit", "-qm", "y");
    expect((await judge(root, [sh("rev-parse", "HEAD").stdout.trim()])).kind).toBe("allow");
    expect(excepts(argvs()[2]!)).toEqual(["bun test"]);
  });

  test("a red gate with no base outcome to compare against is undetermined, not refused, and leaves no record", async () => {
    stub(1, { ...PASS, outcome: "fail", exitCode: 1, failed: [{ command: "bun run cat check:a", job: "j", step: "s", why: ["boom"] }] });
    const head = sh("rev-parse", "HEAD").stdout.trim();
    const v = await judge(root, [head]);
    expect(v.kind).toBe("undetermined");
    expect(readRecord(root, treeOf(root, head)!)).toBeUndefined();
    // ...but its outcomes are kept, as the next push's base.
    expect(readResults(root, treeOf(root, head)!)?.outcomes["bun run cat check:a"]).toBe("fail");
  });

  /**
   * A gate runner whose `check:pages` needs publish-time pages (`_site/`,
   * never committed, written by `derive:publish`) and whose `check:a` reds
   * on a committed `broken` file: the shape of the 11 false reds measured in
   * a fresh agent container (folio-assistant#2946).
   */
  const pagesStub = () => {
    writeFileSync(
      join(root, "fake-cat.ts"),
      `import { existsSync, writeFileSync, appendFileSync } from "node:fs";
const a = process.argv; const out = a[a.indexOf("--report") + 1]!;
appendFileSync(${JSON.stringify(join(root, "runs.txt"))}, "x");
const failed = [];
if (!existsSync("_site/index.html")) failed.push({ command: "bun run cat check:pages", job: "j", step: "pages", why: ["no publish-time pages"] });
if (existsSync("broken")) failed.push({ command: "bun run cat check:a", job: "j", step: "a", why: ["broken"] });
writeFileSync(out, JSON.stringify({ $schema: "folio-gates-report/v1", outcome: failed.length ? "fail" : "pass", exitCode: failed.length ? 1 : 0,
  set: "fast", gates: 2, commands: ["bun run cat check:a", "bun run cat check:pages"], failed, skipped: [], undetermined: [] }));
process.exit(failed.length ? 1 : 0);\n`,
    );
  };

  test("a tree lacking the publish pages: the environment's red is not this push's, so the push is not refused", async () => {
    pagesStub();
    const base = sh("rev-parse", "HEAD").stdout.trim();
    expect((await judge(root, [base])).kind).toBe("undetermined"); // check:pages red on the base too
    writeFileSync(join(root, "change.txt"), "a change that breaks nothing\n");
    sh("add", "change.txt");
    sh("commit", "-qm", "change");
    const v = await judge(root, [sh("rev-parse", "HEAD").stdout.trim()], undefined, [base]);
    expect(v.kind).toBe("undetermined");
    expect(v.kind === "undetermined" && v.why).toContain("check:pages");
  });

  test("a gate green on the base and red now is this push's, and refuses", async () => {
    pagesStub();
    const base = sh("rev-parse", "HEAD").stdout.trim();
    await judge(root, [base]);
    writeFileSync(join(root, "broken"), "x\n");
    sh("add", "broken");
    sh("commit", "-qm", "break check:a");
    const v = await judge(root, [sh("rev-parse", "HEAD").stdout.trim()], undefined, [base]);
    expect(v.kind).toBe("refuse");
    const why = v.kind === "refuse" ? v.why.join("\n") : "";
    expect(why).toContain("check:a");
    expect(why).not.toContain("check:pages");
  });

  test("a passing record stands as the base's outcomes", async () => {
    stub(0, PASS);
    const base = sh("rev-parse", "HEAD").stdout.trim();
    await judge(root, [base]);
    rmSync(join(stateDir(root), "results"), { recursive: true, force: true });
    expect(readResults(root, treeOf(root, base)!)?.outcomes["bun run cat check:a"]).toBe("pass");
  });

  test("exit 2 is undetermined, not a pass", async () => {
    stub(2, { ...PASS, outcome: "undetermined", exitCode: 2 });
    expect((await judge(root, [sh("rev-parse", "HEAD").stdout.trim()])).kind).toBe("undetermined");
  });

  test("a dirty tracked file is not judged (never refused), and no gate runs", async () => {
    stub(0, PASS);
    writeFileSync(join(root, ".gitignore"), "changed\n");
    const v = await judge(root, [sh("rev-parse", "HEAD").stdout.trim()]);
    expect(v.kind).toBe("undetermined");
    expect(v.kind === "undetermined" && v.why).toContain(".gitignore");
    expect(runs()).toBe(0);
  });

  test("a commit that is not checked out (a branch-store push) is allowed unjudged, never refused", async () => {
    stub(1, { ...PASS, outcome: "fail", exitCode: 1, failed: [{ command: "bun run cat check:a", job: "j", step: "s", why: ["x"] }] });
    const store = sh("commit-tree", "-m", "store", sh("mktree").stdout.trim() || "4b825dc642cb6eb9a060e54bf8d69288fbee4904").stdout.trim();
    const v = await judge(root, [store]);
    expect(v.kind).toBe("allow");
    expect(v.kind === "allow" && v.why).toContain("not judged");
    expect(runs()).toBe(0);
  });

  test("no cat runner is undetermined", async () => {
    writeFileSync(join(root, "package.json"), "{}");
    sh("commit", "-qam", "no runner");
    expect((await judge(root, [sh("rev-parse", "HEAD").stdout.trim()])).kind).toBe("undetermined");
    expect(existsSync(stateDir(root))).toBe(false);
  });
});

test("failedTests reads bun's JUnit report, failures only, entities decoded", () => {
  const xml = `<testsuites><testsuite name="a.test.ts" file="a.test.ts"><testsuite name="grp" file="a.test.ts">
      <testcase name="ok" classname="grp" file="a.test.ts" line="2" />
      <testcase name="bad &amp; &lt;x&gt;" classname="grp" file="a.test.ts" line="2"><failure type="AssertionError">x</failure></testcase>
    </testsuite></testsuite></testsuites>`;
  expect([...failedTests(xml)]).toEqual(["a.test.ts > grp > bad & <x>"]);
});

describe("the affected tests, run for real in a throwaway repository", () => {
  let root: string;
  const sh = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  const head = () => sh("rev-parse", "HEAD").stdout.trim();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pre-push-tests-"));
    sh("init", "-q");
    sh("config", "user.email", "t@example.invalid");
    sh("config", "user.name", "t");
    // A `cat` runner whose gates all pass, so the verdict is the tests'.
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { cat: "bun run fake-cat.ts" } }));
    writeFileSync(
      join(root, "fake-cat.ts"),
      `import { writeFileSync } from "node:fs";
const a = process.argv; writeFileSync(a[a.indexOf("--report") + 1]!, JSON.stringify(${JSON.stringify({ ...PASS, skipped: [] })}));\n`,
    );
    writeFileSync(join(root, ".gitignore"), "fake-cat.ts\n");
    writeFileSync(join(root, "lib.ts"), "export const one = () => 1;\n");
    writeFileSync(join(root, "other.ts"), "export const two = 2;\n");
    writeFileSync(join(root, "lib.test.ts"), 'import { test, expect } from "bun:test";\nimport { one } from "./lib.ts";\ntest("one is 1", () => expect(one()).toBe(1));\n');
    writeFileSync(
      join(root, "env.test.ts"),
      'import { test, expect } from "bun:test";\nimport { one } from "./lib.ts";\ntest("needs the publish pages", () => { one(); expect(require("node:fs").existsSync("_site/index.html")).toBe(true); });\n',
    );
    sh("add", "-A");
    sh("commit", "-qm", "base");
    sh("update-ref", "refs/remotes/origin/main", head());
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("a test green at the base and red now refuses; one red at the base too does not; the tree is put back", async () => {
    writeFileSync(join(root, "lib.ts"), "export const one = () => 2;\n");
    sh("commit", "-qam", "break one");
    const v = await judge(root, [head()]);
    expect(v.kind).toBe("refuse");
    const why = v.kind === "refuse" ? v.why.join("\n") : "";
    expect(why).toContain("lib.test.ts > one is 1");
    expect(why).not.toContain("needs the publish pages");
    expect(sh("diff", "--quiet", "HEAD", "--").status).toBe(0);
  }, 60_000);

  test("a change whose only red is the environment's is undetermined, never refused", async () => {
    writeFileSync(join(root, "lib.ts"), "export const one = () => 1; // reworded\n");
    sh("commit", "-qam", "harmless");
    const v = await judge(root, [head()]);
    expect(v.kind).toBe("undetermined");
    expect(v.kind === "undetermined" && v.why).toContain("red at the base");
  }, 60_000);

  test("a change no test imports runs no test, and the push is allowed and recorded", async () => {
    writeFileSync(join(root, "other.ts"), "export const two = 3;\n");
    sh("commit", "-qam", "unrelated");
    const v = await judge(root, [head()]);
    expect(v.kind).toBe("allow");
    expect(v.kind === "allow" && v.why).toContain("0 affected test file(s)");
  }, 60_000);
});

describe("off by default: the gates run only when the checkout opts in", () => {
  const HOOK = join(import.meta.dir, "..", "pre-push-gates.ts");
  let root: string;
  const sh = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pre-push-off-"));
    sh("init", "-q");
    sh("config", "user.email", "t@example.invalid");
    sh("config", "user.name", "t");
    // A `cat` runner that would FAIL every gate, so a run of it would refuse the push.
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { cat: "exit 1" } }));
    sh("add", "-A");
    sh("commit", "-qm", "c");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("gatesEnabled reads the env first, then git config", () => {
    expect(gatesEnabled(root, {})).toBe(false);
    expect(gatesEnabled(root, { CAT_PREPUSH_GATES: "1" })).toBe(true);
    sh("config", "cat.gates.prePush", "true");
    expect(gatesEnabled(root, {})).toBe(true);
    expect(gatesEnabled(root, { CAT_PREPUSH_GATES: "0" })).toBe(false);
  });

  test("the git hook, off, lets the push go at once, says so and logs it", () => {
    const head = sh("rev-parse", "HEAD").stdout.trim();
    const r = spawnSync("bun", ["run", HOOK, "--git-hook", "origin"], {
      cwd: root,
      input: `refs/heads/main ${head} refs/heads/main ${"0".repeat(40)}\n`,
      encoding: "utf-8",
      env: { ...process.env, CAT_PREPUSH_GATES: "" },
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("gates not run (off by default");
    expect(readFileSync(join(stateDir(root), "push.log"), "utf-8")).toContain('"event":"off"');
  });

  test("the Claude hook, off, never blocks, even a --no-verify push", () => {
    const r = spawnSync("bun", ["run", HOOK, "--claude-hook"], {
      cwd: root,
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push --no-verify origin main" }, cwd: root }),
      encoding: "utf-8",
      env: { ...process.env, CAT_PREPUSH_GATES: "" },
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("off by default");
  });
});

test("the affected tests never inherit BUN_OPTIONS (a CI shard's --shard and --reporter-outfile)", () => {
  const env = testEnv({ BUN_OPTIONS: "--shard=1/4 --reporter=junit --reporter-outfile=/x.xml", PATH: "/bin" });
  expect(env.BUN_OPTIONS).toBeUndefined();
  expect(env.PATH).toBe("/bin");
});
