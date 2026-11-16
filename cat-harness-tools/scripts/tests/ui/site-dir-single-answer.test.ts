/**
 * The site root is composed from the layer stub, in ONE place.
 *
 * Bean `x4a6`. Before the move, `docs/` was spelled out separately in
 * `translation-index.ts`, `gen-docs-pages.ts`, `gen-skill-docs.ts`,
 * `gen-schema-docs.ts` and `translation-qa-sweep.ts` — five copies free to
 * disagree, and the bean counted them as the defect. Packaging the site under
 * `docs/<stub>/` for the repo split moved all five at once; nothing stopped a
 * sixth appearing the next day.
 *
 * This is the same shape as `graph-typology-docs.test.ts` (bean `5o3a`): a fact
 * that lives in code and in prose drifts unless something crosses between
 * them. Here both sides are code, which makes it cheaper, not less necessary.
 *
 * @module scripts/tests/site-dir-single-answer
 *
 * The tests of this file that read the whole checkout (reads the aggregate
 * root's `.gitignore`) live in `test/site-dir-single-answer-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteDir, siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { repoFilesWithExt } from "../../repo-files.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * Source trees that resolve paths at runtime. `docs/` itself is excluded: its
 * pages legitimately talk about their own layout in prose.
 *
 * `test` rather than `tests` since 2026-09-19 (bean `auap`), when the two test
 * trees were consolidated. `sourceFiles()` keeps only `.ts`/`.mjs`, so naming
 * `test/` here does not drag in the 500-odd JSON verdicts under
 * `test/results/` — but a stale `tests` WOULD have dropped `a11y.e2e.ts`, the
 * very file the `[^\n]*` widening above was written for, and the guard would
 * have kept passing.
 */
const TREES = ["scripts", "content", "schemas", "src", "test"];

/**
 * A literal naming the OUTPUT site root **in a path-resolving position**.
 *
 * Scoped to `join`/`resolve`/`readFileSync`/`existsSync`/`readdirSync` rather
 * than to every quoted `docs/…` on purpose. Plenty of strings here name the
 * path as PROSE — a finding's `where:`, a console message, a QA criterion's
 * description — and those are documentation, not resolution: they do not
 * break when the directory moves, and failing on them would mean the guard
 * fires on its own rationale. The defect this bean measured was five
 * CONSTANTS that resolve to a directory, so that is what is checked.
 *
 * `docs/source/` is the generator's INPUT — a different directory that
 * happens to share a segment — so a preceding `content` disqualifies a hit.
 *
 * ## `scanSync` and a bare `cwd:` were added after they let one through
 *
 * `html-comment-delimiters.test.ts` globbed with `scanSync` and a bare `cwd`
 * set to the site-root literal — matching none of the named functions, so this
 * guard passed it. (Spelled around rather than quoted, because writing it out
 * makes this guard fire on its own rationale; the sibling test reassembles its
 * fixture from parts for the same reason.) The stub
 * inversion then broke it in the worst available way: the move left an empty
 * `docs/` holding only the gitignored bundler tree, so LOCALLY the glob
 * matched nothing and the test passed over zero files — while in CI
 * `bundle install` populates that tree and the test reported findings in
 * third-party gem HTML. Green locally, red in CI, and neither run was looking
 * at the site.
 *
 * The lesson is about the SHAPE of the list, not the one missing entry: a
 * function allow-list only covers the resolution idioms somebody thought of.
 * A bare `cwd:`/`dir:`/`root:` property is a path-resolving position whatever
 * consumes it, so those are matched directly.
 */
const LITERAL =
  // `[^\n]*` rather than `[^)\n]*`: a nested call -- `join(dirname(x), "..",
  // "docs/…")` -- puts a `)` between the opener and the literal, and the
  // tighter pattern walked straight past exactly that line in `a11y.e2e.ts`.
  /(?:\b(?:join|resolve|readFileSync|existsSync|readdirSync|statSync|scanSync|glob|Glob)\s*\([^\n]*|\b(?:cwd|dir|root|base)\s*:\s*)(["'`])\.?\/?docs(\/[^"'`\n]*)?\1/;

/**
 * Source under the scanned trees — **including files not yet committed**.
 *
 * This used to call `git ls-files` directly, which lists tracked files only.
 * That made the guard blind to exactly the files most likely to violate it:
 * `gen-themes-css.ts` and `theme-tokens.test.ts` both hardcoded the site root,
 * a full local `bun test` reported 0 fail, and CI after the commit was the
 * earliest possible detection. Bean `bgle`.
 */
function sourceFiles(): string[] {
  return repoFilesWithExt(ROOT, TREES, [".ts", ".mjs"]);
}

/**
 * Source with its comments blanked, line numbering preserved.
 *
 * ## Why this is a function rather than two `.replace` calls
 *
 * It WAS two: `line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "")`,
 * applied per line. That handles `//` and a `/* … *` + `/` opened and closed on
 * one line, and **misses a `/** … *` + `/` block entirely** — every
 * continuation line of a JSDoc comment reached the scanner as code.
 *
 * So the guard failed on documentation that explained the guard. Measured
 * 2026-09-22: a test comment reading *"it was `join(REPO, "cat-harness",
 * "docs")`, and `site-dir-single-answer` refused it"* was reported as a
 * violation. That is precisely the case the original comment said stripping
 * existed to prevent — the intent was right and the implementation did not
 * reach it.
 *
 * Worth fixing rather than rewording the comment, because the next person to
 * document a path decision hits it too, and the obvious escape is to delete
 * the explanation instead of the literal.
 *
 * Blanking rather than deleting, so `${rel}:${i + 1}` still names the real
 * line. A dropped line would shift every number after it, and a guard that
 * reports the wrong line is worse than one that misses.
 *
 * NOT a full tokenizer: a `/*` inside a string literal blanks from there to
 * the next `*` + `/`. That direction is safe — it can only HIDE a violation,
 * never invent one — and a scanner elaborate enough to parse strings is a
 * scanner with its own bugs. The narrow miss is preferred to the broad one.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

describe("the site root is one answer, not a literal", () => {
  test("siteDir is docs under the layer root whatever the stub, and siteDirFor reads this instance's", () => {
    expect(siteDir({ name: "x", stub: "y" })).toBe("docs");
    // No longer varies with the stub: the layer root IS the stub directory,
    // so the site dir within it is the same string for every layer.
    expect(siteDir({ name: "x" })).toBe("docs");
    expect(siteDirFor(ROOT)).toBe("docs");
  });

  test("an instance with no name or stub cannot get a guessed site root", () => {
    // Third-state discipline: a wrong site root writes the whole site into a
    // directory nothing serves, so "could not determine" must throw rather
    // than fall back to `docs/`.
    expect(() => siteDirFor(join(TOOLS_ROOT, "scripts"))).toThrow(/cannot determine the site root/);
  });

  test("no source file hardcodes the output site root", () => {
    const offenders: string[] = [];
    for (const rel of sourceFiles()) {
      const text = readFileSync(join(ROOT, rel), "utf-8");
      // Comments are stripped BEFORE the per-line scan, and the reason is
      // stated on `stripComments`: the rationale for this rule necessarily
      // names the old path, and a guard that fails on its own explanation is
      // one the next person deletes.
      stripComments(text)
        .split("\n")
        .forEach((code, i) => {
          if (!LITERAL.test(code)) return;
          if (/content["'`]?\s*,\s*["'`]docs|content\/docs/.test(code)) return;
          offenders.push(`${rel}:${i + 1}: ${text.split("\n")[i]!.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
