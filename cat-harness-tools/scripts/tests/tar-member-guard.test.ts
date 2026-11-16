/**
 * The archive guard, exercised against REAL `tar` output.
 *
 * Bean `6bhf`, the tar box. `/api/import/arxiv` fetches an archive from
 * `arxiv.org/e-print/` and extracts it, so its member names are not ours.
 *
 * ## Why this test builds actual tarballs
 *
 * The parsing here is the kind that looks right and is not. The first version
 * of the member-name extraction stripped **six** whitespace-separated fields
 * from a `tar tvzf` line; real GNU tar emits **five** before the name:
 *
 *     -rw-r--r-- root/root  2 2026-09-26 12:13 sub/a b c.tex
 *      \_______/ \_______/ \/ \________/ \___/ \___________/
 *        mode      owner   sz    date    time       name
 *
 * So `sub/a b c.tex` came out as `b c.tex`, and the containment check then ran
 * on a path that was never in the archive — a guard reading clean while
 * examining a fabrication. Asserting the source text could not have caught
 * that; only running `tar` could, which is why this file shells out.
 *
 * The extraction logic itself lives inline in the server's `fetch`, so the
 * predicates are restated here as the functions under test. That duplication is
 * deliberate and is the weakness of this file: it pins the RULES against real
 * tar, while `server-path-sinks.test.ts` pins that the server still applies
 * them. Neither alone is enough.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, linkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Only a regular file or a directory may be in the archive — a WHITELIST. */
function refusedForType(listing: string[]): string[] {
  return listing.filter((l) => !/^[-d]/.test(l));
}

/**
 * The member name is everything after the time field.
 *
 * GNU tar:  `-rw-r--r-- root/root  2 2026-09-26 12:13 sub/a b c.tex`
 *           — 5 whitespace-separated fields, then the name.
 * BSD tar:  `-rw-r--r--  0 litlfred wheel  2 Sep 26 21:34 sub/a b c.tex`
 *           — 8 fields (owner and group split, date is 3 tokens).
 *
 * Both end with `HH:MM name`, so we anchor on the time field.
 */
function memberNames(listing: string[]): string[] {
  return listing.map((l) => l.replace(/^.*?\d{1,2}:\d{2}\s+/, ""));
}

/** Traversal by spelling, which tar mostly but not entirely refuses itself. */
function refusedForName(members: string[]): string[] {
  return members.filter((m) => m.startsWith("/") || m.split("/").includes("..") || m.includes("\0"));
}

function listing(archive: string, cwd: string): string[] {
  return execFileSync("tar", ["tvzf", archive], { cwd, encoding: "utf-8", timeout: 15000 })
    .split("\n")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tar-guard-"));
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "main.tex"), "x\n");
  // A name with spaces — the case the six-field slice destroyed.
  writeFileSync(join(dir, "sub", "a b c.tex"), "y\n");
  // input-site: inert #204d37d7 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
  symlinkSync("/etc/passwd", join(dir, "evil.tex"));
  linkSync(join(dir, "main.tex"), join(dir, "hard.tex"));
  execFileSync("tar", ["czf", "benign.tgz", "main.tex", "sub"], { cwd: dir });
  execFileSync("tar", ["czf", "symlink.tgz", "main.tex", "evil.tex"], { cwd: dir });
  execFileSync("tar", ["czf", "hardlink.tgz", "main.tex", "hard.tex"], { cwd: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("tar is actually present, or every assertion below is vacuous", () => {
  it("lists the benign archive", () => {
    const l = listing("benign.tgz", dir);
    expect(l.length).toBeGreaterThan(0);
  });
});

describe("member names are parsed as tar actually prints them", () => {
  it("recovers a name containing spaces intact — the five-vs-six-field defect", () => {
    const names = memberNames(listing("benign.tgz", dir));
    expect(names).toContain("sub/a b c.tex");
    expect(names).toContain("main.tex");
    // The six-field version produced this, and nothing noticed.
    expect(names).not.toContain("b c.tex");
  });

  it("recovers a directory member with its trailing slash", () => {
    expect(memberNames(listing("benign.tgz", dir))).toContain("sub/");
  });

  it("names are not empty — an empty name passes every containment check", () => {
    for (const n of memberNames(listing("benign.tgz", dir))) {
      expect(n.length).toBeGreaterThan(0);
    }
  });
});

describe("the type whitelist closes the residual `--no-same-*` cannot", () => {
  it("accepts an archive of only regular files and directories", () => {
    expect(refusedForType(listing("benign.tgz", dir))).toEqual([]);
  });

  it("refuses a SYMLINK member, which writes through to its target", () => {
    const bad = refusedForType(listing("symlink.tgz", dir));
    expect(bad.length).toBe(1);
    expect(bad[0]).toMatch(/^l/);
    // And the spelling checks alone would have let it through: the member is
    // named `evil.tex`, which is neither absolute nor contains `..`.
    expect(refusedForName(memberNames(listing("symlink.tgz", dir)))).toEqual([]);
  });

  it("refuses a HARDLINK member for the same reason", () => {
    const bad = refusedForType(listing("hardlink.tgz", dir));
    expect(bad.length).toBe(1);
    expect(bad[0]).toMatch(/^h/);
  });
});

describe("the name checks still catch traversal by spelling", () => {
  it("refuses an absolute member", () => {
    // input-site: inert #84f9f23e — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(refusedForName(["/etc/passwd"])).toEqual(["/etc/passwd"]);
  });

  it("refuses a `..` SEGMENT without refusing a name that merely contains dots", () => {
    expect(refusedForName(["a/../../etc/passwd"])).toHaveLength(1);
    expect(refusedForName(["..hidden.tex", "a..b.tex", "fig..1.png"])).toEqual([]);
  });

  it("refuses a NUL, which truncates the path for some syscalls", () => {
    expect(refusedForName(["main.tex\0.png"])).toHaveLength(1);
  });
});
