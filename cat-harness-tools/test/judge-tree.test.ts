/**
 * The `judge-tree` Tool (cat-harness-tools#399): the digest names the tree
 * and nothing else, the record holds to its schema, and "has any runner
 * judged this tree green?" answers only for this digest.
 *
 * @module test/judge-tree.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  candidatesFromStatuses,
  decide,
  detectRunner,
  gateEntries,
  gatesReportOf,
  gitHubStatuses,
  type IndexLock,
  judgingFiles,
  judgingVersion,
  junitOf,
  junitSummary,
  newGatesFromCompare,
  sampleGates,
  statusPayload,
  treeDigest,
  treeListing,
  type VerdictRecord,
  validateVerdictRecord,
  VERDICT_SCHEMA_ID,
  verdictOf,
} from "../scripts/lib/judge-tree.ts";

const ROOT = resolve(import.meta.dir, "..");
const SCRIPTS = join(ROOT, ".github", "scripts", "layer-pr-checks");
const T1 = "a".repeat(40);
const T2 = "b".repeat(40);
const H = (c: string) => c.repeat(64);

const lock = (): IndexLock => ({
  instances: [
    { instance: "bootstrap", repository: "litlfred/bootstrap", declaration: { file: "bootstrap.json", sha256: H("1") }, directories: [{ path: "bootstrap", treeDigest: H("2") }] },
    { instance: "cat-harness", repository: "litlfred/cat-harness", declaration: { file: "cat-harness.json", sha256: H("3") }, directories: [{ path: "cat-harness", treeDigest: H("4") }], assets: [{ src: "a.png", sha256: H("5") }] },
  ],
});

describe("tree digest", () => {
  test("is the same for the same tree, whatever order the lock lists instances in", () => {
    const l = lock();
    const r = { instances: [...l.instances].reverse() };
    expect(treeDigest(l, { caller: "cat-harness", tree: T1 }, "v1")).toBe(treeDigest(r, { caller: "cat-harness", tree: T1 }, "v1"));
    expect(treeDigest(l, { caller: "cat-harness", tree: T1 }, "v1")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("replaces the caller's locked entry by its PR tree: the lock's pin of the caller does not count", () => {
    const l = lock();
    const moved = lock();
    moved.instances[1].directories[0].treeDigest = H("9");
    moved.instances[1].declaration.sha256 = H("8");
    expect(treeDigest(l, { caller: "cat-harness", tree: T1 }, "v1")).toBe(treeDigest(moved, { caller: "cat-harness", tree: T1 }, "v1"));
    expect(treeListing(l, { caller: "cat-harness", tree: T1 }, "v1")).toContain(`cat-harness\tcaller\tgit-tree:${T1}`);
    expect(treeListing(l, { caller: "cat-harness", tree: T1 }, "v1")).not.toContain(H("4"));
  });

  test("changes with the caller's tree, any other instance's fixity digest, and the judging version", () => {
    const base = treeDigest(lock(), { caller: "cat-harness", tree: T1 }, "v1");
    expect(treeDigest(lock(), { caller: "cat-harness", tree: T2 }, "v1")).not.toBe(base);
    expect(treeDigest(lock(), { caller: "cat-harness", tree: T1 }, "v2")).not.toBe(base);
    const other = lock();
    other.instances[0].directories[0].treeDigest = H("7");
    expect(treeDigest(other, { caller: "cat-harness", tree: T1 }, "v1")).not.toBe(base);
  });

  test("names the caller by instance or by repository; a caller the lock does not pin (index mode) is added", () => {
    expect(treeDigest(lock(), { caller: "litlfred/cat-harness", tree: T1 }, "v1")).toBe(treeDigest(lock(), { caller: "cat-harness", tree: T1 }, "v1"));
    const listing = treeListing(lock(), { caller: "smart-ra", tree: T1 }, "v1");
    expect(listing.split("\n").filter(Boolean)).toHaveLength(2 + 3);
    expect(listing).toContain(`smart-ra\tcaller\tgit-tree:${T1}`);
  });

  test("refuses a caller tree that is not a git tree id, and an empty judging version", () => {
    expect(() => treeDigest(lock(), { caller: "cat-harness", tree: "HEAD" }, "v1")).toThrow();
    expect(() => treeDigest(lock(), { caller: "cat-harness", tree: T1 }, "")).toThrow();
  });

  test("the judging version hashes this checkout's judging scripts", () => {
    const v = judgingVersion(judgingFiles(ROOT, SCRIPTS));
    expect(v).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(judgingVersion(judgingFiles(ROOT, SCRIPTS))).toBe(v);
    expect(() => judgingVersion(judgingFiles(ROOT, join(ROOT, "no-such-dir")))).toThrow(/judging scripts not found/);
  });
});

describe("runner", () => {
  test("GitHub Actions, an agent, or a local machine, from the environment alone", () => {
    expect(detectRunner({ GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "o/r", GITHUB_RUN_ID: "5", GITHUB_RUN_ATTEMPT: "2" }, "h")).toEqual({ kind: "github-actions", id: "o/r/actions/runs/5/attempts/2" });
    expect(detectRunner({ CLAUDE_CODE_SESSION_ID: "s1" }, "h")).toEqual({ kind: "agent", id: "s1" });
    expect(detectRunner({ USER: "me" }, "box")).toEqual({ kind: "local", id: "me@box" });
    expect(detectRunner({ USER: "me", JUDGE_RUNNER_KIND: "agent", JUDGE_RUNNER_ID: "x" }, "box")).toEqual({ kind: "agent", id: "x" });
    expect(() => detectRunner({ JUDGE_RUNNER_KIND: "cloud" }, "h")).toThrow();
  });
});

const record = (over: Partial<VerdictRecord> = {}): VerdictRecord => ({
  $schema: VERDICT_SCHEMA_ID,
  treeDigest: H("c"),
  judging: "sha256:" + H("d"),
  tree: { caller: "cat-harness", callerTree: T1, instances: 2 },
  runner: { kind: "local", id: "me@box" },
  startedAt: "2026-10-16T10:00:00.000Z",
  finishedAt: "2026-10-16T10:05:00.000Z",
  gates: [
    { name: "graph:check-tools", exit: 0, seconds: 1.5, command: "true", new: false },
    { name: "x:check:live", exit: null, seconds: 0, skipped: "judges the remote's live state" },
    { name: "x:check:b", exit: 1, seconds: 2, baseExit: 1, new: false, command: "false" },
  ],
  tests: { total: 10, failed: 1, new: 0, failing: ["s > t"] },
  base: { source: "run" },
  verdict: "green",
  ...over,
});

describe("verdict record", () => {
  const schema = JSON.parse(readFileSync(join(ROOT, "schemas", "verdict-record.schema.json"), "utf-8"));

  test("a well-formed record validates", () => {
    expect(validateVerdictRecord(record())).toEqual([]);
  });

  test("the validator requires what the schema requires and admits only what it declares", () => {
    for (const k of schema.required as string[]) {
      const r = record() as unknown as Record<string, unknown>;
      delete r[k];
      expect(validateVerdictRecord(r)).toContain(`missing ${k}`);
    }
    expect(validateVerdictRecord({ ...record(), extra: 1 })).toContain("unknown property extra");
    expect(Object.keys(schema.properties).sort()).toEqual(["$schema", "base", "judging", "reportUrl", "runner", "startedAt", "finishedAt", "gates", "tests", "tree", "treeDigest", "verdict"].sort());
    expect(schema.properties.verdict.enum).toEqual(["green", "red", "unknown"]);
    expect(schema.properties.runner.properties.kind.enum).toEqual(["agent", "github-actions", "local"]);
    expect(Object.keys(schema.properties.gates.items.properties).sort()).toEqual(["baseExit", "command", "exit", "name", "new", "seconds", "skipped"]);
  });

  test("refuses a bad digest, runner, verdict, and a gate both skipped and exited", () => {
    expect(validateVerdictRecord(record({ treeDigest: "abc" }))).toContain("treeDigest is not 64 hex digits");
    expect(validateVerdictRecord(record({ runner: { kind: "cloud" as never, id: "x" } })).join()).toContain("runner");
    expect(validateVerdictRecord(record({ verdict: "pass" as never })).join()).toContain("verdict");
    expect(validateVerdictRecord(record({ gates: [{ name: "g", exit: 0, seconds: 0, skipped: "why" }] })).join()).toContain("exit is null exactly when skipped");
    expect(validateVerdictRecord(record({ startedAt: "yesterday" })).join()).toContain("startedAt");
  });

  test("verdict: green only when both comparisons pass and a gate ran; a 2 is unknown, never green", () => {
    expect(verdictOf(0, 0, 3)).toBe("green");
    expect(verdictOf(1, 0, 3)).toBe("red");
    expect(verdictOf(0, 1, 3)).toBe("red");
    expect(verdictOf(2, 0, 3)).toBe("unknown");
    expect(verdictOf(0, 0, 0)).toBe("unknown");
  });

  test("a stored record stands in for a base run: gates and failing tests round-trip", () => {
    const rep = gatesReportOf(record());
    expect(rep["x:check:b"].exit).toBe(1);
    expect(rep["x:check:live"].skipped).toBeDefined();
    const xml = junitOf(["a > b > c", "top"], 7);
    expect(junitSummary(xml)).toEqual({ total: 2, failing: ["a > b > c", "top"] });
  });

  test("junit summary names tests as compare-test-failures.py does", () => {
    const xml = `<?xml version="1.0"?><testsuites tests="3"><testsuite name="f.test.ts"><testsuite name="d"><testcase name="ok"/><testcase name="bad &amp; worse"><failure message="x"/></testcase></testsuite><testcase name="err"><error/></testcase></testsuite></testsuites>`;
    expect(junitSummary(xml)).toEqual({ total: 3, failing: ["f.test.ts > d > bad & worse", "f.test.ts > err"] });
  });
});

describe("composing the existing compare scripts", () => {
  test("new gates are read from compare-gates.py's own table", () => {
    const dir = mkdtempSync(join(tmpdir(), "jt-cmp-"));
    writeFileSync(join(dir, "b.json"), JSON.stringify({ a: { exit: 0 }, b: { exit: 1 }, c: { exit: 0 } }));
    writeFileSync(join(dir, "h.json"), JSON.stringify({ a: { exit: 1, tail: "" }, b: { exit: 1, tail: "" }, c: { exit: 2, tail: "" }, d: { command: "x", skipped: "why" } }));
    const r = spawnSync("python3", ["-B", join(SCRIPTS, "compare-gates.py"), join(dir, "b.json"), join(dir, "h.json")], { encoding: "utf-8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
    expect(r.status).toBe(1);
    expect(newGatesFromCompare(r.stdout).sort()).toEqual(["a", "c"]);
    const entries = gateEntries(JSON.parse(readFileSync(join(dir, "h.json"), "utf-8")), JSON.parse(readFileSync(join(dir, "b.json"), "utf-8")), ["a", "c"]);
    expect(entries.find((e) => e.name === "a")).toMatchObject({ exit: 1, baseExit: 0, new: true });
    expect(entries.find((e) => e.name === "d")).toMatchObject({ exit: null, skipped: "why", new: false });
  });
});

describe("publishing and the verdict-exists decision", () => {
  test("the status carries the digest; unknown is an error, never success", () => {
    const p = statusPayload(record(), "https://example.org/run/1");
    expect(p).toMatchObject({ state: "success", context: "judge-tree" });
    expect(p.target_url).toBe(`https://example.org/run/1#judge-tree=${H("c")}`);
    expect(p.description.length).toBeLessThanOrEqual(140);
    expect(p.description).toContain(`tree ${H("c").slice(0, 16)}`);
    expect(statusPayload(record({ verdict: "unknown" })).state).toBe("error");
    expect(statusPayload(record({ verdict: "red" })).state).toBe("failure");
  });

  test("passes only on a green verdict for THIS digest", () => {
    const d = H("c");
    expect(decide(d, [{ source: "s", digest: d, verdict: "green" }]).pass).toBe(true);
    expect(decide(d, [{ source: "s", prefix: d.slice(0, 16), verdict: "green" }]).pass).toBe(true);
    const other = decide(d, [{ source: "s", digest: H("e"), verdict: "green" }]);
    expect(other.pass).toBe(false);
    expect(other.message).toContain("no runner has judged this tree");
    const none = decide(d, []);
    expect(none).toEqual({ pass: false, message: `no runner has judged this tree (${d})` });
    const red = decide(d, [{ source: "s", digest: d, verdict: "red" }]);
    expect(red.pass).toBe(false);
    expect(red.message).toContain("judged red");
  });

  test("statuses: the newest per tree answers, other contexts are ignored", () => {
    const d = H("c");
    const c = candidatesFromStatuses([
      { context: "judge-tree", state: "failure", target_url: `https://x/1#judge-tree=${d}` },
      { context: "judge-tree", state: "success", target_url: `https://x/0#judge-tree=${d}` },
      { context: "ci", state: "success", description: `tree ${d.slice(0, 16)}` },
    ]);
    expect(c).toHaveLength(1);
    expect(decide(d, c).pass).toBe(false);
  });

  test("the REST calls go through the injected fetch, with the token", async () => {
    const calls: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[] = [];
    const fake = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => [{ context: "judge-tree", state: "success", target_url: `u#judge-tree=${H("c")}` }], text: async () => "" };
    };
    const gh = gitHubStatuses("tok", fake, "https://api.test");
    await gh.post("o/r", "abc1234", statusPayload(record()));
    const listed = await gh.list("o/r", "abc1234");
    expect(calls[0].url).toBe("https://api.test/repos/o/r/statuses/abc1234");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers?.authorization).toBe("Bearer tok");
    expect(JSON.parse(calls[0].init!.body!).context).toBe("judge-tree");
    expect(calls[1].url).toBe("https://api.test/repos/o/r/commits/abc1234/statuses?per_page=100");
    expect(decide(H("c"), candidatesFromStatuses(listed)).pass).toBe(true);
    await expect(gh.post("o/r; rm", "abc1234", statusPayload(record()))).rejects.toThrow();
  });

  test("the sample is seeded: the same seed picks the same run gates, never a skipped one", () => {
    const gates = Array.from({ length: 20 }, (_, i) => ({ name: `g${i}`, exit: 0, seconds: 0 }));
    gates.push({ name: "skipped", exit: null as never, seconds: 0, skipped: "why" } as never);
    const a = sampleGates(gates, "sha1", 3).map((g) => g.name);
    expect(a).toHaveLength(3);
    expect(sampleGates(gates, "sha1", 3).map((g) => g.name)).toEqual(a);
    expect(sampleGates(gates, "sha2", 3).map((g) => g.name)).not.toEqual(a);
    expect(sampleGates(gates, "sha1", 100).some((g) => g.name === "skipped")).toBe(false);
  });
});

describe("judge-tree.ts end to end (no network, no gates run)", () => {
  const CLI = join(ROOT, "scripts", "judge-tree.ts");
  const env = { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "", GITHUB_STEP_SUMMARY: "", GITHUB_ACTIONS: "", JUDGE_RUNNER_KIND: "local", JUDGE_RUNNER_ID: "test" };
  const cli = (...a: string[]) => spawnSync("bun", [CLI, ...a], { encoding: "utf-8", env });

  test("judges from reports, writes a valid record, and check finds it by digest only", () => {
    const dir = mkdtempSync(join(tmpdir(), "jt-e2e-"));
    writeFileSync(join(dir, "index.lock.json"), JSON.stringify(lock()));
    writeFileSync(join(dir, "base.json"), JSON.stringify({ a: { command: "true", exit: 0, tail: "" } }));
    writeFileSync(join(dir, "head.json"), JSON.stringify({ a: { command: "true", exit: 0, tail: "", seconds: 0.1 } }));
    const records = join(dir, "records");
    mkdirSync(records);
    const common = ["--lock", join(dir, "index.lock.json"), "--caller", "cat-harness", "--judging", "v-test"];
    const j = cli("judge", ...common, "--tree", T1, "--head-gates", join(dir, "head.json"), "--base-gates", join(dir, "base.json"), "--records-dir", records);
    expect(j.status).toBe(0);
    const digest = cli("digest", ...common, "--tree", T1).stdout.trim();
    const rec = JSON.parse(readFileSync(join(records, `${digest}.json`), "utf-8"));
    expect(validateVerdictRecord(rec)).toEqual([]);
    expect(rec).toMatchObject({ verdict: "green", runner: { kind: "local", id: "test" }, base: { source: "run" } });

    expect(cli("check", ...common, "--tree", T1, "--records-dir", records).status).toBe(0);
    const other = cli("check", ...common, "--tree", T2, "--records-dir", records);
    expect(other.status).toBe(1);
    expect(other.stdout).toContain("no runner has judged this tree");

    // Head newly breaks a gate: red, and a red verdict is no verdict for check.
    writeFileSync(join(dir, "head.json"), JSON.stringify({ a: { command: "false", exit: 1, tail: "boom", seconds: 0.1 } }));
    const red = cli("judge", ...common, "--tree", T2, "--head-gates", join(dir, "head.json"), "--base-gates", join(dir, "base.json"), "--records-dir", records);
    expect(red.status).toBe(1);
    expect(cli("check", ...common, "--tree", T2, "--records-dir", records).stdout).toContain("judged red");

    // A stored base verdict answers only for the base tree it judged.
    const stale = cli("judge", ...common, "--tree", T2, "--head-gates", join(dir, "head.json"), "--base-verdict", join(records, `${digest}.json`), "--base-tree", T2, "--out", join(dir, "x.json"));
    expect(stale.status).toBe(2);
    expect(stale.stderr).toContain("not the base tree");
    const reused = cli("judge", ...common, "--tree", T2, "--head-gates", join(dir, "head.json"), "--base-verdict", join(records, `${digest}.json`), "--base-tree", T1, "--out", join(dir, "y.json"));
    expect(reused.status).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, "y.json"), "utf-8")).base).toEqual({ source: "stored-verdict", treeDigest: digest });

    // No token: publish writes nothing and says so.
    const pub = cli("publish", "--record", join(dir, "y.json"), "--repo", "o/r", "--sha", "abc1234");
    expect(pub.status).toBe(0);
    expect(pub.stdout).toContain("not published");

    // Sample: re-runs the recorded commands; `false` still exits 1, so it agrees.
    const s = cli("sample", "--record", join(dir, "y.json"), "--root", dir, "--seed", "abc1234", "--n", "1");
    expect(s.stdout).toContain("agrees");
    expect(s.status).toBe(0);
  });
});
