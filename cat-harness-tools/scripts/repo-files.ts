/**
 * Enumerate a repository's files the way a GATE needs to see them.
 *
 * @module scripts/repo-files
 *
 * ## Tracked ∪ untracked-but-not-ignored
 *
 * `git ls-files <tree>` lists **tracked** files only, so a gate built on it
 * cannot see a file created and not yet committed — the file most likely to
 * break its rule — and passes locally while CI fails.
 *
 * `--others --exclude-standard` is the second half; `--exclude-standard`
 * honours `.gitignore`, so `node_modules/`, build output and local scratch
 * stay out while new work comes in.
 *
 * **Deleted-but-still-tracked files are excluded.** `ls-files` lists a file
 * the working tree no longer has, and a gate reading one would fail on
 * content nobody can fix from here.
 *
 * ## When tracked-only is the RIGHT question
 *
 * Keep `ls-files` when the question is literally "what is committed" — e.g.
 * `scripts/tests/lean-projects.test.ts` asks whether `.lake/` is *tracked*.
 * Use this module when the question is "what source is in this tree".
 */
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { gitCorpus } from "../schemas/sdlc/git-corpus.js";

function gitList(root: string, args: string[]): string[] {
  // input-site: tree #0a400405 — ls-files of a tree, tracked and untracked-not-ignored: git's view of the work tree
  const proc = Bun.spawnSync(["git", ...args], { cwd: root });
  return new TextDecoder()
    .decode(proc.stdout)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Every file under `trees`, tracked or newly created, excluding ignored ones.
 *
 * Returns repo-relative paths, sorted and de-duplicated — a file can appear in
 * both listings during some index states, and a gate reporting the same
 * offender twice reads as two defects.
 */
export function repoFiles(root: string, trees: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const t of trees) {
    // `gitCorpus` asks the same question (tracked ∪ untracked-not-ignored) and
    // also answers it for a tree git does not hold: a layer REMOTE-MOUNTED
    // into the index checkout is ignored there wholesale, so a bare
    // `ls-files` listed nothing and every gate over a mounted layer passed
    // over an empty set. Asked from inside the tree, the corpus is the
    // mount's files.
    const corpus = gitCorpus(join(root, t));
    if (corpus !== undefined) {
      for (const abs of corpus) seen.add(relative(root, abs));
      continue;
    }
    for (const f of gitList(root, ["ls-files", t])) seen.add(f);
    for (const f of gitList(root, ["ls-files", "--others", "--exclude-standard", t])) seen.add(f);
  }
  // A tracked file that has been deleted in the working tree is still listed.
  return [...seen].filter((f) => existsSync(join(root, f))).sort();
}

/** {@link repoFiles}, narrowed to the extensions a gate cares about. */
export function repoFilesWithExt(
  root: string,
  trees: readonly string[],
  exts: readonly string[],
): string[] {
  return repoFiles(root, trees).filter((f) => exts.some((e) => f.endsWith(e)));
}

/**
 * A TypeScript source with its comments removed, string literals intact.
 *
 * **For gates that assert about CODE and keep tripping over prose.** A check
 * that greps a whole file cannot tell an implementation from a comment
 * describing one — `manifest-remote-resolution.test.ts` records exactly that:
 * *"Grepping for `shallow-clone` was the first attempt and is not evidence: it
 * cannot tell an implementation from a comment, and it flagged the comment
 * this very change added."* Its own sibling assertions then kept the naive
 * form, and a documentation comment naming a directory tripped them.
 *
 * Tightening the pattern to quoted strings is not enough on its own, because
 * a markdown code span in a comment is delimited by backticks and backticks
 * quote strings in TypeScript. The comment has to go first.
 *
 * **String literals are skipped rather than stripped**, which is the whole
 * difficulty: a naive `//`-to-end-of-line rule cuts `"https://example.com"` in
 * half and invents a finding. Template-literal `${…}` is treated as ordinary
 * literal text — a comment inside an interpolation is vanishingly rare and
 * mis-keeping one is harmless here, whereas mis-cutting a URL is not.
 */
export function codeWithoutComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}
