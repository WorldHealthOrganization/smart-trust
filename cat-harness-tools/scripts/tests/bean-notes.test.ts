/**
 * Two pull requests adding notes to one bean cannot touch the same file.
 * Bean `m61r`, issue #1853.
 *
 * Run against scratch repositories with real branches and a real `git merge`,
 * because the claim is about what git does with two branches — a mocked merge
 * would test the mock. The first test is the one the bean's "done when" names:
 * it fails if the branch is dropped from the naming rule, since the two notes
 * then share a path and the merge conflicts on it.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { branchSlug, noteFileName } from "../../schemas/sdlc/bean-note.ts";
import { addNote, checkNotes, noteDirs, writeIndex } from "../bean-notes.ts";
import { classify, resolveGeneratedRegions } from "../merge-conflict-patterns.ts";

const BEAN = "folio-assistant-ob3m";
const BEAN_FILE = `beans/defs/${BEAN}--navbar-findings.md`;
const INDEX = "beans/notes/README.md";

const scratches: string[] = [];
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf-8" });
  return { status: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/** A repository on `main` with one bean and a declared, indexed notes directory. */
function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bean-notes-"));
  scratches.push(dir);
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "beans", "defs"), { recursive: true });
  writeFileSync(
    join(dir, "beans", "beans.json"),
    JSON.stringify({
      name: "t",
      directories: [
        { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
        { id: "notes", path: "notes", graphTypologies: ["bean-notes"] },
      ],
    }),
  );
  writeFileSync(
    join(dir, BEAN_FILE),
    `---\n# ${BEAN}\ntitle: 'navbar findings'\nstatus: in-progress\ntype: task\n---\n\nFindings.\n`,
  );
  writeIndex(dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}

/** On a new branch off `main`, add a note through the helper and commit it. */
function branchWithNote(dir: string, branch: string, opts: { index: boolean }): string {
  git(dir, "checkout", "-q", "-b", branch, "main");
  const path = addNote({ bean: BEAN, title: `finding from ${branch}`, body: "measured", date: "2026-10-02" }, dir);
  git(dir, "add", "--", path.slice(dir.length + 1));
  if (opts.index) git(dir, "add", "--", INDEX);
  else git(dir, "checkout", "--", INDEX); // the note alone, without the regenerated index
  git(dir, "commit", "-qm", `note from ${branch}`);
  git(dir, "checkout", "-q", "main");
  return path.slice(dir.length + 1);
}

test("two branches' notes on ONE bean, same day: disjoint paths, and git merges them cleanly", () => {
  const dir = repo();
  const a = branchWithNote(dir, "claude/finding-3", { index: false });
  const b = branchWithNote(dir, "claude/finding-10", { index: false });

  expect(a).not.toBe(b);
  expect(git(dir, "merge", "-q", "--no-edit", "claude/finding-3").status).toBe(0);
  const merge = git(dir, "merge", "--no-edit", "claude/finding-10");
  expect(merge.out).not.toContain("CONFLICT");
  expect(merge.status).toBe(0);
  expect(existsSync(join(dir, a)) && existsSync(join(dir, b))).toBe(true);
  // The bean itself was never written by either branch.
  expect(git(dir, "log", "--format=%s", "--", BEAN_FILE).out).toBe("base");
});

test("with the regenerated index committed too, the ONLY conflict is the index, and the declared pattern resolves it", () => {
  const dir = repo();
  branchWithNote(dir, "claude/finding-3", { index: true });
  branchWithNote(dir, "claude/finding-10", { index: true });
  expect(git(dir, "merge", "-q", "--no-edit", "claude/finding-3").status).toBe(0);

  // Merge main into the second branch, as the merge-main bot does.
  git(dir, "checkout", "-q", "claude/finding-10");
  expect(git(dir, "merge", "--no-edit", "main").status).not.toBe(0);
  const conflicted = git(dir, "diff", "--name-only", "--diff-filter=U").out.split("\n").filter(Boolean);
  expect(conflicted).toEqual([INDEX]);

  // Not refused: the index is a README whose rows are all inside one region.
  expect(classify(INDEX).strategy).toBe("generated-regions");
  const resolved = resolveGeneratedRegions(readFileSync(join(dir, INDEX), "utf-8"));
  expect(resolved).toBeDefined();
  writeFileSync(join(dir, INDEX), resolved!);
  writeIndex(dir); // what `regen` does after resolving
  expect(checkNotes(dir)).toEqual({ findings: [], stale: false });
  const index = readFileSync(join(dir, INDEX), "utf-8");
  expect(index).toContain("`claude/finding-3`");
  expect(index).toContain("`claude/finding-10`");
});

test("the convention it replaces — both branches appending to the bean — conflicts, and the bot refuses it", () => {
  const dir = repo();
  for (const branch of ["claude/append-a", "claude/append-b"]) {
    git(dir, "checkout", "-q", "-b", branch, "main");
    writeFileSync(join(dir, BEAN_FILE), `${readFileSync(join(dir, BEAN_FILE), "utf-8")}\n## from ${branch}\n`);
    git(dir, "commit", "-qam", branch);
    git(dir, "checkout", "-q", "main");
  }
  expect(git(dir, "merge", "-q", "--no-edit", "claude/append-a").status).toBe(0);
  expect(git(dir, "merge", "--no-edit", "claude/append-b").out).toContain("CONFLICT");
  expect(classify(BEAN_FILE).strategy).toBe("refuse");
});

test("one branch's second note on a bean is a section in its own file, not a new file", () => {
  const dir = repo();
  const first = addNote({ bean: BEAN, title: "first", branch: "claude/x", date: "2026-10-02" }, dir);
  // A later date must not split the branch's notes into a second file.
  const second = addNote({ bean: BEAN, title: "second", branch: "claude/x", date: "2026-10-03" }, dir);
  expect(second).toBe(first);
  const text = readFileSync(first, "utf-8");
  expect(text).toContain("## first");
  expect(text).toContain("## second");
  expect(checkNotes(dir).findings).toEqual([]);
});

test("the name is derived from the note's own front matter; a hand-named note is a finding", () => {
  const dir = repo();
  const path = addNote({ bean: BEAN, title: "t", branch: "claude/x", date: "2026-10-02" }, dir);
  expect(path.endsWith(noteFileName(BEAN, "2026-10-02", "claude/x"))).toBe(true);
  renameSync(path, join(noteDirs(dir).notes, `${BEAN}.md`));
  const { findings } = checkNotes(dir);
  expect(findings.map((f) => f.file)).toEqual([`${BEAN}.md`]);
  expect(findings[0]!.why).toContain("named by hand");
});

test("a file without the tag, or naming a bean that does not exist, is a finding — never skipped", () => {
  const dir = repo();
  const notes = noteDirs(dir).notes;
  writeFileSync(join(notes, "loose.md"), "just some prose\n");
  writeFileSync(
    join(notes, noteFileName("folio-assistant-zzzz", "2026-10-02", "b")),
    `---\n$schema: folio-bean-note/v1\nbean: folio-assistant-zzzz\nbranch: b\ncreated: "2026-10-02"\n---\n`,
  );
  const why = checkNotes(dir).findings.map((f) => f.why);
  expect(why.some((w) => w.includes("no front matter"))).toBe(true);
  expect(why.some((w) => w.includes("no declared definitions directory holds"))).toBe(true);
});

test("two branch names that slug alike are refused at write time rather than merged into one file", () => {
  const dir = repo();
  expect(branchSlug("a/b")).toBe(branchSlug("a-b"));
  addNote({ bean: BEAN, title: "t", branch: "a/b", date: "2026-10-02" }, dir);
  expect(() => addNote({ bean: BEAN, title: "t", branch: "a-b", date: "2026-10-02" }, dir)).toThrow(/another branch/);
});

test("a stale index fails the check", () => {
  const dir = repo();
  addNote({ bean: BEAN, title: "t", branch: "claude/x", date: "2026-10-02" }, dir);
  writeFileSync(join(dir, INDEX), "# Bean notes\n");
  expect(checkNotes(dir).stale).toBe(true);
});
