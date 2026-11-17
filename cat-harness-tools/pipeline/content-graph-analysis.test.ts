/**
 * content-graph-analysis.py names no paper of its own (bean saqd, 2026-10-30):
 * the paper is `--paper`, or the folio's only paper, and several papers with no
 * `--paper` is an error that lists them instead of a guess.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = join(import.meta.dir, "content-graph-analysis.py");

let repo: string;

function writePaper(folio: string, paper: string): void {
  const ch = join(folio, paper, "intro");
  mkdirSync(ch, { recursive: true });
  writeFileSync(join(folio, paper, `${paper}.ts`), `export default paper({ chapters: [chapterRef({ dir: "intro" })] });\n`);
  writeFileSync(
    join(ch, "intro.ts"),
    `export default chapter({ number: 1, title: "Intro", label: "chap:intro", sections: [section({ title: "Start", label: "sec:start", blocks: [] })] });\n`,
  );
}

function run(cwd: string, ...args: string[]) {
  const r = Bun.spawnSync(["python3", SCRIPT, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "content-graph-analysis-"));
  writePaper(join(repo, "one", "folio"), "alpha");
  writePaper(join(repo, "two", "folio"), "alpha");
  writePaper(join(repo, "two", "folio"), "beta");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("content-graph-analysis.py paper resolution", () => {
  test("a one-paper folio needs no --paper", () => {
    const r = run(join(repo, "one"));
    expect(r.code).toBe(0);
    expect(r.out).toContain("# Content Graph Analysis: alpha");
  });

  test("several papers and no --paper fails and names them", () => {
    const r = run(join(repo, "two"));
    expect(r.code).not.toBe(0);
    expect(r.err).toContain("alpha, beta");
  });

  test("--paper picks one of several", () => {
    const r = run(join(repo, "two"), "--paper", "beta");
    expect(r.code).toBe(0);
    expect(r.out).toContain("# Content Graph Analysis: beta");
  });

  test("an unknown --paper fails instead of reading nothing", () => {
    const r = run(join(repo, "two"), "--paper", "gamma");
    expect(r.code).not.toBe(0);
    expect(r.err).toContain("no paper 'gamma'");
  });

  test("--content-root and a path --paper both work from anywhere", () => {
    expect(run(repo, "--content-root", join(repo, "one", "folio")).code).toBe(0);
    expect(run(repo, "--paper", join(repo, "two", "folio", "beta")).out).toContain("Analysis: beta");
  });
});
