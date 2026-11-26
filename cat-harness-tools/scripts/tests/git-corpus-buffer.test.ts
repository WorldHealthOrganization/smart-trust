/**
 * A corpus listing bigger than node's default buffer must still be a corpus.
 *
 * ## The defect, measured 2026-09-30
 *
 * `spawnSync` caps a child's stdout at **1 MiB** unless told otherwise, and on
 * overflow it sets `error` (`ENOBUFS`) rather than truncating. Both corpus
 * helpers read `r.error !== undefined` as *"git could not answer"*, so the
 * whole repository became invisible to every caller the moment its PATH NAMES
 * — not its contents — outgrew that buffer:
 *
 * | | `git ls-files -z --cached --others --exclude-standard` |
 * |---|---:|
 * | `origin/main` at 874d4c9bfb8 | 1,005,252 bytes |
 * | this branch, +740 ingested library files | **1,058,420 bytes** |
 * | node's default `maxBuffer` | 1,048,576 bytes |
 *
 * `iri:sync:check` exited 2 with *"git could not list the corpus, so nothing
 * was checked — that is not a pass"*, which is the correct refusal. The danger
 * is the callers that do the other thing: several fall back to a filesystem
 * walk, and a walk is a DIFFERENT corpus with different exclusions. #1609
 * measured that direction — converting one walk to git moved 21 archived beans
 * into findings — so crossing the buffer silently rescopes those checks rather
 * than stopping them.
 *
 * ## Why this test builds a corpus rather than reading an option
 *
 * Asserting `maxBuffer` is passed pins the spelling of the fix, and there are
 * two helpers in two layers that may not import each other (bean `xsqm`),
 * so the constant cannot be shared and an option assertion would have to be
 * written twice against two literals. What both must do is ANSWER, so both are
 * asked, over a scratch repository whose listing is deliberately past 1 MiB.
 *
 * Reverting either `maxBuffer` turns its case red — checked by hand, both
 * directions, on 2026-09-30.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";
import { gitFiles } from "@litlfred/bootstrap-tools/scripts/git-files.ts";

/** node's `spawnSync` default, restated so the fixture's target is explicit. */
const NODE_DEFAULT_MAX_BUFFER = 1024 * 1024;

const scratches: string[] = [];
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

/**
 * A git repository whose `ls-files -z` output exceeds {@link min} bytes.
 *
 * Long names rather than many files: the cost here is `git add`, and 6,000
 * paths of ~190 characters clear 1 MiB while 6,000 short ones do not.
 */
function bigCorpus(min: number): { dir: string; bytes: number } {
  const dir = mkdtempSync(join(tmpdir(), "corpus-buffer-"));
  scratches.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });

  const segment = "a".repeat(60);
  let bytes = 0;
  let i = 0;
  while (bytes < min) {
    const sub = join(dir, `d${String(i % 40)}`);
    mkdirSync(sub, { recursive: true });
    const rel = `d${String(i % 40)}/${segment}-${segment}-${String(i).padStart(6, "0")}.md`;
    writeFileSync(join(dir, rel), "x");
    bytes += rel.length + 1; // the NUL git writes after each path
    i += 1;
  }
  return { dir, bytes };
}

const CORPUS = bigCorpus(NODE_DEFAULT_MAX_BUFFER + 64 * 1024);

test("the fixture really is past node's default buffer — otherwise this asserts nothing", () => {
  expect(CORPUS.bytes).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: CORPUS.dir,
    encoding: "utf-8",
  });
  expect(r.error?.message ?? "").toContain("ENOBUFS");
});

test("gitCorpus answers over a listing bigger than 1 MiB", () => {
  const files = gitCorpus(CORPUS.dir);
  expect(files).toBeDefined();
  expect(files!.length).toBeGreaterThan(5000);
});

test("bootstrap's gitFiles answers over the same listing", () => {
  const files = gitFiles(CORPUS.dir);
  expect(files).toBeDefined();
  expect(files!.length).toBeGreaterThan(5000);
});

test("undefined still means git could not answer, and is not confused with a big corpus", () => {
  const bare = mkdtempSync(join(tmpdir(), "corpus-buffer-nogit-"));
  scratches.push(bare);
  expect(gitCorpus(join(bare, "does-not-exist"))).toBeUndefined();
  expect(gitFiles(join(bare, "does-not-exist"))).toBeUndefined();
});
