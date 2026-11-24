/**
 * `chapters/*.tex` is `content_build` output and lives in the FOLIO. The test
 * helper resolved it as `join(REPO_ROOT, "chapters")` where
 * `REPO_ROOT = resolve(HARNESS_ROOT)` — this file's own location,
 * i.e. the INSTANCE_ROOT checkout.
 *
 * So `findChapterFiles()` returned `[]` even with a folio attached, and
 * `latex-lean-coverage.test.ts` — every one of whose assertions needs those
 * files — had never run a single one of them in either repo. Measured against
 * a synthetic folio: 0 pass / 6 skip before the fix, 6 pass / 1 fail after
 * (the failure correct — the fixture carries no Lean source).
 *
 * This is the same split-repo trap the `FOLIO_ROOT` comment two lines below
 * the old declaration already warned about: a folio embeds the platform as a
 * `folio-assistant/` SYMLINK, so `import.meta.dir` resolves back through it to
 * the real platform path and walking up from there never reaches the folio.
 * `QOU_LEAN_DIR`, immediately above, already did the right thing.
 *
 * Resolution happens at module load from `process.cwd()`, so pinning it needs
 * a subprocess launched from inside a folio — which is what this does.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const DIR = realpathSync(mkdtempSync(join(tmpdir(), "chapters-dir-")));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

/**
 * A minimal folio: one paper manifest (so `findPapers` sees it), a `chapters/`
 * directory, and the `folio-assistant/` symlink a real folio carries.
 */
function makeFolio(name: string, opts: { withChapter?: boolean } = {}): string {
  const root = join(DIR, name);
  mkdirSync(join(root, "folio", "demo-paper"), { recursive: true });
  mkdirSync(join(root, "chapters"), { recursive: true });
  writeFileSync(
    join(root, "folio", "demo-paper", "demo-paper.ts"),
    'export default { title: "Demo", authors: [], chapters: [] };\n',
  );
  if (opts.withChapter) {
    writeFileSync(
      join(root, "chapters", "ch01.tex"),
      "\\begin{theorem}\\label{thm:demo}\n\\lean{Demo.thmDemo}\nA statement.\n\\end{theorem}\n",
    );
  }
  try {
    symlinkSync(INSTANCE_ROOT, join(root, "folio-assistant"));
  } catch {
    /* already linked */
  }
  return root;
}

/** Import the helpers from `cwd` and report what they resolved. */
function probe(cwd: string): { chaptersDir: string; hasFolio: boolean; chapterFiles: number } {
  const script = join(DIR, "probe.ts");
  writeFileSync(
    script,
    `import { CHAPTERS_DIR, hasFolio, findChapterFiles } from ${JSON.stringify(
      join(TOOLS_ROOT, "scripts", "tests", "helpers.ts"),
    )};\n` +
      "console.log(JSON.stringify({ chaptersDir: CHAPTERS_DIR, hasFolio: hasFolio(), chapterFiles: findChapterFiles().length }));\n",
  );
  const r = spawnSync("bun", ["run", script], { cwd, encoding: "utf-8", timeout: 30_000 });
  if (r.status !== 0) throw new Error(`probe failed: ${r.stderr}`);
  return JSON.parse(r.stdout.trim());
}

describe("CHAPTERS_DIR resolves against the folio", () => {
  test("a folio is detected when run from one", () => {
    // Guard the guard: if this were false the assertions below would pass for
    // the wrong reason, which is the failure mode this whole file is about.
    expect(probe(makeFolio("detect")).hasFolio).toBe(true);
  });

  test("points inside the folio, not the platform", () => {
    const folio = makeFolio("resolves");
    const { chaptersDir } = probe(folio);
    expect(chaptersDir).toBe(join(folio, "chapters"));
    expect(chaptersDir.startsWith(INSTANCE_ROOT)).toBe(false);
  });

  test("findChapterFiles() actually finds the folio's chapters", () => {
    // The end-to-end fact: with `join(REPO_ROOT, "chapters")` this was 0 even
    // here, and every test downstream of it silently skipped.
    expect(probe(makeFolio("finds", { withChapter: true })).chapterFiles).toBe(1);
  });

  test("falls back to the platform when no folio is attached", () => {
    // A bare `bun test` in this repo must still resolve to something, and
    // report zero chapters rather than throwing.
    const { hasFolio, chaptersDir, chapterFiles } = probe(INSTANCE_ROOT);
    expect(hasFolio).toBe(false);
    expect(chaptersDir).toBe(join(INSTANCE_ROOT, "chapters"));
    expect(chapterFiles).toBe(0);
  });
});
