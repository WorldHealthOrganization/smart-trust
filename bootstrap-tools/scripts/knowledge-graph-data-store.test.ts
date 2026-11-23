/**
 * bootstrap's `knowledge-graph-data-store` contract, held to its four
 * responsibilities against the mechanical Actor that plays the Role: a git
 * repository, read through the git CLI.
 *
 * The contract (bootstrap `skills/knowledge-graph-data-store.md`) says the
 * store is "a git repository, reached through the git CLI or a forge's API",
 * and that each of its lines "is something a test can check". This is that
 * check, for the git CLI. Each `describe` is one numbered responsibility, and
 * nothing here tests more than the line it quotes: the judgements made with
 * what the store serves (is this a layer, which harness) are the
 * Bootstrapping Agent's, and are not tested as the store's.
 *
 * bootstrap runs nothing, so its contract's tests live here, as
 * `pages-status.test.ts` holds this toolset's own `github-pages` contract.
 * Where a responsibility is about what a reader can rely on, the reader is
 * this toolset's `initSteps` — the tool half of `complete-initialization`,
 * whose `Knowledge Graph Data Store` lane this contract is the other side of.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initSteps, offlineProbe } from "./init.ts";

/** Run git in `cwd` with a fixed identity, so a commit's author is the test's to assert. */
function git(cwd: string, args: string[], env: Record<string, string> = {}): { status: number; stdout: Buffer; stderr: string } {
  const r = spawnSync("git", ["-c", "user.name=Writer", "-c", "user.email=writer@example.org", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", ...env },
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? Buffer.alloc(0), stderr: String(r.stderr ?? "") };
}

/** A store holding `files`, committed in one commit; returns its directory. */
function store(parent: string, name: string, files: Record<string, string | Buffer>, env: Record<string, string> = {}): string {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  expect(git(dir, ["init", "-q"]).status).toBe(0);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  expect(git(dir, ["add", "-A"]).status).toBe(0);
  expect(git(dir, ["commit", "-q", "-m", `write ${name}`], env).status).toBe(0);
  return dir;
}

/** The bytes the store serves for `path` at `ref`, or `undefined` when it says the path is absent there. */
function serve(dir: string, ref: string, path: string): Buffer | undefined {
  if (git(dir, ["cat-file", "-e", `${ref}:${path}`]).status !== 0) return undefined;
  const r = git(dir, ["show", `${ref}:${path}`]);
  expect(r.status).toBe(0);
  return r.stdout;
}

/**
 * A declaration whose bytes a reformatting would change: no trailing newline,
 * a non-ASCII title, and key order that is not alphabetical.
 */
const DECLARATION = Buffer.from('{"name":"demo","title":"Démo — données","needs":["base"],"directories":[]}', "utf-8");
const INSTRUCTIONS = Buffer.from("Do this first.\r\nThen this.\n", "utf-8");

describe("1. serve a file exactly as committed", () => {
  test("servesDeclarationByteForByte", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const dir = store(top, "demo", { "demo.json": DECLARATION, "docs/bootstrap/initialization.md": INSTRUCTIONS });
    expect(serve(dir, "HEAD", "demo.json")!.equals(DECLARATION)).toBe(true);
    expect(serve(dir, "HEAD", "docs/bootstrap/initialization.md")!.equals(INSTRUCTIONS)).toBe(true);
  });

  test("readsAtRef", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const dir = store(top, "demo", { "demo.json": DECLARATION });
    const first = String(git(dir, ["rev-parse", "HEAD"]).stdout).trim();
    writeFileSync(join(dir, "demo.json"), '{"name":"demo","needs":[]}\n');
    expect(git(dir, ["commit", "-q", "-am", "change it"]).status).toBe(0);
    expect(serve(dir, first, "demo.json")!.equals(DECLARATION)).toBe(true);
    expect(String(serve(dir, "HEAD", "demo.json"))).toBe('{"name":"demo","needs":[]}\n');
  });

  test("servesListedFiles", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const listed = Buffer.from("---\nname: x\n---\nbody", "utf-8");
    const dir = store(top, "demo", {
      "demo.json": JSON.stringify({ name: "demo", directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }] }),
      "skills/x.md": listed,
    });
    expect(serve(dir, "HEAD", "skills/x.md")!.equals(listed)).toBe(true);
  });
});

describe("2. tell absent from present", () => {
  test("uncommittedPathAbsent", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const dir = store(top, "demo", { "demo.json": DECLARATION, "empty.json": "" });
    // Present and empty: served, as zero bytes.
    expect(serve(dir, "HEAD", "empty.json")).toEqual(Buffer.alloc(0));
    // Absent: the store says so, distinctly from the empty file above.
    expect(serve(dir, "HEAD", "other.json")).toBeUndefined();
    const asked = git(dir, ["show", "HEAD:other.json"]);
    expect(asked.status).not.toBe(0);
    expect(asked.stderr).toMatch(/does not exist|exists on disk, but not in/);
  });

  test("untrackedFileAbsent", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const dir = store(top, "demo", { "demo.json": DECLARATION });
    writeFileSync(join(dir, "draft.json"), "{}");
    expect(serve(dir, "HEAD", "draft.json")).toBeUndefined();
  });

  test("absentVersusUnreadable", async () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    // Absent: no declaration at the root at all.
    const empty = store(top, "nothing", { "README.md": "# nothing\n" });
    const absent = (await initSteps(empty, { probe: offlineProbe, dryRun: true })).steps;
    expect(absent.map((s) => s.id)).toEqual(["declaration"]);
    expect(absent[0]!.detail).toMatch(/no <name>\.json/);
    // Present but unreadable: the declaration is there and names itself, but is not a declaration.
    const broken = store(top, "broken", { "broken.json": JSON.stringify({ name: "broken", directories: "not a list" }) });
    const unreadable = (await initSteps(broken, { probe: offlineProbe, dryRun: true })).steps;
    expect(unreadable.map((s) => s.id)).toEqual(["declaration"]);
    expect(unreadable[0]!.state).toBe("not-done");
    expect(unreadable[0]!.detail).toMatch(/is not a Knowledge Graph declaration/);
    expect(unreadable[0]!.detail).not.toBe(absent[0]!.detail);
  });
});

describe("3. serve siblings the same way", () => {
  test("readsSiblingNeeds", async () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const demo = store(top, "demo", { "demo.json": DECLARATION, "README.md": "# demo\n" });
    const base = store(top, "base", { "base.json": '{"name":"base","directories":[]}', "docs/bootstrap/initialization.md": INSTRUCTIONS });
    expect(String(serve(base, "HEAD", "base.json"))).toBe('{"name":"base","directories":[]}');
    const { steps } = await initSteps(demo, { probe: offlineProbe, dryRun: true });
    const needs = steps.find((s) => s.id === "needs:base")!;
    expect(needs.state).toBe("done");
    expect(needs.detail).toBe(base);
    expect(steps.find((s) => s.id === "instructions:base")?.state).toBe("stated");
  });

  test("missingSiblingReported", async () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const demo = store(top, "demo", { "demo.json": DECLARATION, "README.md": "# demo\n" });
    const { steps } = await initSteps(demo, { probe: offlineProbe, dryRun: true });
    const needs = steps.find((s) => s.id === "needs:base")!;
    expect(needs.state).toBe("not-done");
    expect(needs.detail).toMatch(/no base\.json in/);
  });
});

describe("4. keep what is written", () => {
  test("committedDeclarationReadBack", () => {
    const top = mkdtempSync(join(tmpdir(), "kg-store-"));
    const when = "2026-10-20T09:00:00+00:00";
    const dir = store(top, "demo", { "demo.json": DECLARATION }, { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
    // A later reader: a fresh clone, which shares nothing with the writer's work tree.
    const later = join(top, "later");
    expect(spawnSync("git", ["clone", "-q", dir, later]).status).toBe(0);
    expect(readFileSync(join(later, "demo.json")).equals(DECLARATION)).toBe(true);
    // `%at` (seconds since the epoch), not `%aI`: git versions disagree on how
    // `%aI` spells UTC (`+00:00` or `Z`), and the instant is what is asserted.
    const history = String(git(later, ["log", "--format=%an|%ae|%at", "--", "demo.json"]).stdout).trim().split("\n");
    expect(history).toEqual([`Writer|writer@example.org|${Date.parse(when) / 1000}`]);
  });
});
