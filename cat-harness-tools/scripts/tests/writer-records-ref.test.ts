/**
 * Writer records published to a git ref, and the gate that judges them (cat-harness-tools#1702).
 * @covers scripts/writer-records-ref.ts
 * @covers scripts/writer-cone-verify.ts
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitStaged, stageOutputs } from "../derive-cache.ts";
import { emptyRecords, saveWriterRecords, type WriterRecords } from "../writer-cone.ts";
import { gateEntry, mergeGate, WRITER_RECORDS_GATE } from "../writer-cone-verify.ts";
import { commitDir, fetchRecords, publishRefusal, refFor, refsToPrune, WRITER_MAIN_REF } from "../writer-records-ref.ts";

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A records directory as derive:publish leaves it: records.json, and an outputs entry per recorded writer. */
function recordsDir(sha: string, writers: Record<string, string>): { dir: string; records: WriterRecords } {
  const dir = mkdtempSync(join(tmpdir(), "wr-dir-"));
  const src = mkdtempSync(join(tmpdir(), "wr-src-"));
  writeFileSync(join(src, "page.html"), "<p>hi</p>");
  const records = emptyRecords(sha);
  for (const [w, at] of Object.entries(writers)) {
    records.writers[w] = { sha: at, base: "b", audit: "clean", reads: {}, git: {}, outputs: {} };
    commitStaged(join(dir, "outputs"), w, at, stageOutputs(join(dir, "outputs"), w, at, src, ["page.html"], []));
  }
  saveWriterRecords(dir, records, join(dir, "records.json"));
  rmSync(src, { recursive: true, force: true });
  return { dir, records };
}

describe("publishRefusal", () => {
  test("refuses no records, another commit's records, and a record whose outputs entry is missing", () => {
    const { dir, records } = recordsDir("abc", { w: "abc", carried: "older" });
    expect(publishRefusal(undefined, "abc", join(dir, "outputs"))).toContain("no records");
    expect(publishRefusal(records, "def", join(dir, "outputs"))).toContain("not of def");
    expect(publishRefusal(records, "abc", join(dir, "outputs"))).toBeUndefined();
    records.writers["ghost"] = { ...records.writers["w"]!, sha: "zzz" };
    expect(publishRefusal(records, "abc", join(dir, "outputs"))).toBe("no outputs entry for ghost");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("refsToPrune", () => {
  test("keeps main and the refs of the newest commits", () => {
    const present = [WRITER_MAIN_REF, refFor("a"), refFor("b"), refFor("c")];
    expect(refsToPrune(present, ["c", "a"], 1)).toEqual([refFor("a"), refFor("b")]);
    expect(refsToPrune(present, ["c", "a"], 2)).toEqual([refFor("b")]);
  });
});

describe("publish and fetch through a ref", () => {
  test("a published commit's ref is found first, then main's; nothing found is no records", () => {
    const remote = mkdtempSync(join(tmpdir(), "wr-remote-"));
    git(remote, "init", "--bare", "-q");
    const work = mkdtempSync(join(tmpdir(), "wr-work-"));
    git(work, "init", "-q");
    git(work, "remote", "add", "origin", remote);
    const { dir } = recordsDir("abc", { w: "abc" });
    const c = commitDir(work, dir, "writer records of abc");
    expect("commit" in c).toBe(true);
    const commit = (c as { commit: string }).commit;
    git(work, "push", "-q", "origin", `${commit}:${refFor("abc")}`, `${commit}:${WRITER_MAIN_REF}`);

    const reader = mkdtempSync(join(tmpdir(), "wr-reader-"));
    git(reader, "init", "-q");
    git(reader, "remote", "add", "origin", remote);
    const out = join(reader, "build", "writer-cone");
    const hit = fetchRecords({ git: reader, want: ["abc"], dir: out });
    expect(hit).toEqual({ ref: refFor("abc"), commit });
    expect(JSON.parse(readFileSync(join(out, "records.json"), "utf-8")).sha).toBe("abc");
    expect(existsSync(join(out, "outputs", "w", "abc", "manifest.json"))).toBe(true);
    expect(fetchRecords({ git: reader, want: ["nope"], dir: out })).toEqual({ ref: WRITER_MAIN_REF, commit });

    const empty = mkdtempSync(join(tmpdir(), "wr-empty-"));
    git(empty, "init", "--bare", "-q");
    git(reader, "remote", "set-url", "origin", empty);
    git(reader, "update-ref", "-d", WRITER_MAIN_REF);
    git(reader, "update-ref", "-d", refFor("abc"));
    expect("none" in fetchRecords({ git: reader, want: ["abc"], dir: join(reader, "x") })).toBe(true);
    for (const d of [remote, work, reader, empty, dir]) rmSync(d, { recursive: true, force: true });
  });
});

describe("the gate on published records", () => {
  test("red on a writer that would have been served stale, green otherwise, skipped with no records", () => {
    const red = gateEntry([{ writer: "w", verdict: "skip-unsafe", proof: false, differs: ["out/a.html"] }, { writer: "v", verdict: "skip-safe", proof: true, outputs: 1 }], "abcdef");
    expect(red.exit).toBe(1);
    expect(String(red.tail)).toContain("w (out/a.html)");
    expect(gateEntry([{ writer: "v", verdict: "skip-safe", proof: true, outputs: 1 }], "abcdef").exit).toBe(0);
    expect(gateEntry(undefined, undefined, "none")).toHaveProperty("skipped", "none");
  });

  test("merges into the derive:publish record beside its own entry", () => {
    const d = mkdtempSync(join(tmpdir(), "wr-gate-"));
    const f = join(d, "derive-publish.json");
    writeFileSync(f, JSON.stringify({ "publish:derive:publish": { exit: 0 } }));
    mergeGate(f, { exit: 0 });
    const rec = JSON.parse(readFileSync(f, "utf-8"));
    expect(Object.keys(rec).sort()).toEqual(["publish:derive:publish", WRITER_RECORDS_GATE]);
    mkdirSync(join(d, "x"));
    mergeGate(join(d, "x", "new.json"), { exit: 1 });
    expect(JSON.parse(readFileSync(join(d, "x", "new.json"), "utf-8"))[WRITER_RECORDS_GATE]).toEqual({ exit: 1 });
    rmSync(d, { recursive: true, force: true });
  });
});
