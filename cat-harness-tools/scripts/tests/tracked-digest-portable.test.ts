/**
 * The `{tracked}` digest is the same for the same tree on any machine
 * (RECIPE_VERSION 5): whether `state:mount` ran, and so whether a file is
 * untracked or ignored, does not move it. What a file HOLDS still does.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileDigests, STATE_IGNORE_MARKERS, trackedTreeDigest, withoutStateIgnoreBlock } from "../input-hash.ts";
import { STATE_IGNORE_BEGIN, STATE_IGNORE_END, withStateIgnoreBlock } from "../state-mount.ts";

const git = (cwd: string, ...args: string[]) => {
  const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString();
};
const digest = (root: string) => {
  const d = trackedTreeDigest(root, new FileDigests(root));
  if (!("hash" in d)) throw new Error(d.undetermined);
  return d.hash;
};

describe("a portable {tracked} digest", () => {
  let origin: string;
  let a: string;
  let b: string;
  beforeEach(() => {
    origin = mkdtempSync(join(tmpdir(), "tracked-origin-"));
    git(origin, "init", "-q");
    writeFileSync(join(origin, ".gitignore"), "node_modules/\n*.log\n");
    mkdirSync(join(origin, "src"));
    writeFileSync(join(origin, "src", "a.ts"), "export const a = 1;\n");
    git(origin, "add", "-A");
    git(origin, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "tree");
    a = mkdtempSync(join(tmpdir(), "tracked-a-"));
    b = mkdtempSync(join(tmpdir(), "tracked-b-"));
    git(a, "clone", "-q", origin, ".");
    git(b, "clone", "-q", origin, ".");
  });
  afterEach(() => {
    for (const d of [origin, a, b]) rmSync(d, { recursive: true, force: true });
  });

  /** What `state:mount` leaves behind: the mounted files, and its block in the root .gitignore. */
  const stateMount = (root: string) => {
    mkdirSync(join(root, "beans"));
    writeFileSync(join(root, "beans", "x.md"), "# bean\n");
    const file = join(root, ".gitignore");
    writeFileSync(file, withStateIgnoreBlock(readFileSync(file, "utf-8"), [{ path: "beans" }]));
  };

  test("two checkouts of one tree, one of which ran state:mount, have one digest", () => {
    // The same state content on both machines; only one has the ignore block,
    // so in b beans/x.md is untracked and in a it is ignored.
    stateMount(a);
    mkdirSync(join(b, "beans"));
    writeFileSync(join(b, "beans", "x.md"), "# bean\n");
    expect(git(a, "status", "--porcelain")).toContain(".gitignore");
    expect(git(b, "status", "--porcelain")).toContain("beans/");
    expect(digest(a)).toBe(digest(b));
  });

  test("what a file holds still moves it, untracked or ignored", () => {
    stateMount(a);
    const before = digest(a);
    writeFileSync(join(a, "beans", "x.md"), "# bean, edited\n");
    expect(digest(a)).not.toBe(before);
    const ign = digest(a);
    writeFileSync(join(a, "debug.log"), "x\n");
    expect(digest(a)).not.toBe(ign);
  });

  test("an edit to .gitignore outside the block still moves it", () => {
    stateMount(a);
    const before = digest(a);
    writeFileSync(join(a, ".gitignore"), readFileSync(join(a, ".gitignore"), "utf-8").replace("*.log\n", "*.log\n*.tmp\n"));
    expect(digest(a)).not.toBe(before);
  });

  test("an ignored file is named by the git blob id hash-object gives, so committing it does not move the digest", () => {
    writeFileSync(join(a, "debug.log"), "x\n");
    const ignored = digest(a);
    // Un-ignore it: the same bytes, now untracked, then tracked.
    writeFileSync(join(a, ".gitignore"), "node_modules/\n");
    git(a, "add", "-A");
    git(a, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "c");
    writeFileSync(join(a, ".gitignore"), "node_modules/\n*.log\n");
    git(a, "add", "-A");
    git(a, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "c2");
    // debug.log is now tracked AND matches *.log; its id is the index's.
    expect(git(a, "ls-files", "-s", "debug.log").split(" ")[1]).toBe(git(a, "hash-object", "debug.log").trim());
    expect(digest(a)).toBe(ignored);
  });

  test("an ignored broken symlink is named by its target, not undetermined", () => {
    symlinkSync("nowhere", join(a, "dangling.log"));
    expect(typeof digest(a)).toBe("string");
  });
});

describe("withoutStateIgnoreBlock undoes withStateIgnoreBlock", () => {
  test("the markers are state-mount.ts's", () => {
    expect([...STATE_IGNORE_MARKERS]).toEqual([STATE_IGNORE_BEGIN, STATE_IGNORE_END]);
  });

  test.each([
    ["", "an empty file"],
    ["node_modules/\n", "a file ending in a newline"],
    ["node_modules/", "a file without a final newline"],
    ["a/\n\nb/\n", "a file with a blank line"],
  ])("appended to %p (%s), the block strips back to the same text", (text) => {
    const with1 = withStateIgnoreBlock(text, [{ path: "beans" }, { path: "qa" }]);
    expect(with1).toContain(STATE_IGNORE_BEGIN);
    expect(withoutStateIgnoreBlock(with1)).toBe(withoutStateIgnoreBlock(text.endsWith("\n") || text === "" ? text : `${text}\n`));
  });

  test("a block replaced in place, with other lines after it, strips to those lines", () => {
    const text = withStateIgnoreBlock("a/\n", [{ path: "beans" }]) + "z/\n";
    expect(withoutStateIgnoreBlock(withStateIgnoreBlock(text, [{ path: "other" }]))).toBe(withoutStateIgnoreBlock(text));
  });

  test("unpaired markers are left as they are", () => {
    const text = `a/\n${STATE_IGNORE_BEGIN}\n/beans/**\n`;
    expect(withoutStateIgnoreBlock(text)).toBe(text);
  });
});
