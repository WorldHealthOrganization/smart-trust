/**
 * Ancestry with "cannot tell" as its own answer.
 *
 * Every case builds REAL repositories and clones one of them `--depth 1`,
 * because the defect under test only exists in a shallow clone. A mocked
 * `spawnSync` would have to encode git's behaviour to reproduce it, and would
 * then be testing the encoding.
 *
 * The shallow failure is a **bad object, exit 128** — not a false `1`, which
 * is what this file first claimed. `assertTheDefectIsReal` pins the measured
 * exit code, so if a future git starts answering 1 (or 0) there, the premise
 * fails loudly instead of these tests passing for a reason that no longer
 * holds.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ancestorOr, isAncestor, relate } from "../git-ancestry.ts";

function git(repo: string, ...args: string[]) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A repo with `n` commits on one line of history. Returns its shas, oldest first. */
function linearRepo(n: number): { dir: string; shas: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "anc-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  const shas: string[] = [];
  for (let i = 0; i < n; i++) {
    writeFileSync(join(dir, "f"), `${i}\n`);
    git(dir, "add", "f");
    git(dir, "commit", "-q", "-m", `c${i}`);
    shas.push(git(dir, "rev-parse", "HEAD"));
  }
  return { dir, shas };
}

describe("isAncestor on a FULL history", () => {
  test("answers both directions, and knows it", () => {
    const { dir, shas } = linearRepo(3);
    const [first, , last] = shas;

    const fwd = isAncestor(dir, first!, last!);
    expect(fwd.known).toBe(true);
    expect(fwd.known && fwd.ancestor).toBe(true);

    const back = isAncestor(dir, last!, first!);
    expect(back.known).toBe(true);
    // THE POINT: a real "no" is still a known answer. The module must not
    // turn every negative into `unknown` — that would be the same defect
    // pointed the other way, and would make every caller fall back.
    expect(back.known && back.ancestor).toBe(false);
  });

  test("a commit is its own ancestor, as git defines it", () => {
    const { dir, shas } = linearRepo(2);
    const r = isAncestor(dir, shas[1]!, shas[1]!);
    expect(r).toEqual({ known: true, ancestor: true });
  });
});

describe("isAncestor on a SHALLOW history — the case this module exists for", () => {
  /**
   * The premise, asserted rather than described: on a `--depth 1` clone the
   * bare call does NOT answer "no" politely — it exits 128 on a bad object.
   * Every current caller reads that through `.ok` or a `try`/`catch`, so all
   * of them turn it into "not an ancestor".
   */
  test("the defect is real: bare --is-ancestor exits 128 where the answer is yes", () => {
    const { dir, shas } = linearRepo(5);
    const clone = mkdtempSync(join(tmpdir(), "anc-defect-"));
    spawnSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, clone]);
    const old = shas[0]!;

    const shallowAnswer = spawnSync("git", ["-C", clone, "merge-base", "--is-ancestor", old, "HEAD"]);
    const trueAnswer = spawnSync("git", ["-C", dir, "merge-base", "--is-ancestor", old, "HEAD"]);

    expect(trueAnswer.status).toBe(0); // it IS an ancestor
    expect(shallowAnswer.status).toBe(128); // and the shallow clone errors, not 1
    expect(shallowAnswer.status).not.toBe(0); // which `.ok` / catch read as "no"
  });

  /**
   * `--depth 1` keeps only the tip, so the older commit is absent and
   * `--is-ancestor` cannot reach it. With `deepen: false` the honest answer is
   * `unknown`; the bare exit-code reading would have said "not an ancestor".
   */
  test("a truncated negative is unknown, not false", () => {
    const { dir, shas } = linearRepo(5);
    const clone = mkdtempSync(join(tmpdir(), "anc-shallow-"));
    const r = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, clone], { encoding: "utf-8" });
    expect(r.status).toBe(0);

    const old = shas[0]!;
    // Confirm the premise rather than assuming it: the clone really is shallow
    // and really cannot see the old commit. Without this the test could pass
    // for the wrong reason on a git that ignores --depth over file://.
    expect(git(clone, "rev-parse", "--is-shallow-repository")).toBe("true");
    expect(spawnSync("git", ["-C", clone, "cat-file", "-e", `${old}^{commit}`]).status).not.toBe(0);

    const answer = isAncestor(clone, old, "HEAD", { deepen: false });
    expect(answer.known).toBe(false);
    expect(answer.known === false && answer.reason).toContain(old.slice(0, 9));
  });

  test("deepening turns the same question into a real answer", () => {
    const { dir, shas } = linearRepo(5);
    const clone = mkdtempSync(join(tmpdir(), "anc-deepen-"));
    spawnSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, clone]);
    expect(git(clone, "rev-parse", "--is-shallow-repository")).toBe("true");

    const answer = isAncestor(clone, shas[0]!, "HEAD");
    expect(answer).toEqual({ known: true, ancestor: true });
  });
});

describe("ancestorOr", () => {
  test("the caller states its own fallback for unknown", () => {
    expect(ancestorOr({ known: true, ancestor: true }, false)).toBe(true);
    expect(ancestorOr({ known: true, ancestor: false }, true)).toBe(false);
    expect(ancestorOr({ known: false, reason: "x" }, true)).toBe(true);
    expect(ancestorOr({ known: false, reason: "x" }, false)).toBe(false);
  });
});

describe("relate", () => {
  test("names which side descends", () => {
    const { dir, shas } = linearRepo(3);
    expect(relate(dir, shas[2]!, shas[0]!)).toEqual({ rel: "a-descends" });
    expect(relate(dir, shas[0]!, shas[2]!)).toEqual({ rel: "b-descends" });
    expect(relate(dir, shas[1]!, shas[1]!)).toEqual({ rel: "same" });
  });

  test("`diverged` is only claimed on a history whole enough to prove it", () => {
    // Two real branches off a shared root: genuinely diverged, full history.
    const { dir, shas } = linearRepo(1);
    git(dir, "checkout", "-q", "-b", "left");
    writeFileSync(join(dir, "l"), "l\n");
    git(dir, "add", "l");
    git(dir, "commit", "-q", "-m", "left");
    const left = git(dir, "rev-parse", "HEAD");
    git(dir, "checkout", "-q", shas[0]!);
    git(dir, "checkout", "-q", "-b", "right");
    writeFileSync(join(dir, "r"), "r\n");
    git(dir, "add", "r");
    git(dir, "commit", "-q", "-m", "right");
    const right = git(dir, "rev-parse", "HEAD");

    expect(relate(dir, left, right)).toEqual({ rel: "diverged" });
  });

  test("an unreachable pin is unknown rather than diverged — the #2046 error", () => {
    // Exactly the shape that put a false `diverged` into a commit message on
    // main: a shallow checkout, a pin it does not carry, and no network.
    const { dir, shas } = linearRepo(4);
    const clone = mkdtempSync(join(tmpdir(), "anc-rel-"));
    spawnSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, clone]);

    const r = relate(clone, shas[0]!, git(clone, "rev-parse", "HEAD"), { deepen: false });
    expect(r.rel).toBe("unknown");
    expect(r.rel === "unknown" && r.reason.length > 0).toBe(true);
  });
});
