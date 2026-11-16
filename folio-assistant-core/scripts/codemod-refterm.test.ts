/**
 * The refterm codemod rewrites bare mentions of a known glossary phrase into
 * `:refterm[…]{#slug}` directives, and must leave alone anything that is not
 * prose: code, math, and terms already wrapped.
 *
 * It guarded that with a list of parent node types — `textDirective`,
 * `leafDirective`, `containerDirective`, `code`, `inlineCode`, `math`,
 * `inlineMath` — five of which could never fire. `code`/`inlineCode`/`math`/
 * `inlineMath` are mdast *literal* nodes: they carry `value` and no `children`
 * at all, so a `text` node is never inside one; a `containerDirective` holds
 * block content, so its text sits a paragraph deeper. Typing the visitor made
 * all five unreachable-comparison errors, and they were removed.
 *
 * These pin the behaviour that made removing them safe — the protection comes
 * from mdast's own structure, not from the guard list. If someone reworks the
 * visitor (or re-adds the guards on a hunch), this says what must stay true.
 */
import { describe, test, expect } from "bun:test";
import { rewriteMarkdown } from "./codemod-refterm.ts";

const SLUGS = new Set(["rigid-monoidal-category"]);
const rewrite = (md: string) => rewriteMarkdown(md, SLUGS, new Set());
const WRAPPED = ":refterm[rigid monoidal category]{#rigid-monoidal-category}";

describe("leaves non-prose alone", () => {
  test("leavesInlineCode", () => {
    const out = rewrite("A `rigid monoidal category` and a bare rigid monoidal category.");
    expect(out).toContain("`rigid monoidal category`");
    expect(out).toContain(WRAPPED);
    // Exactly one rewrite: the bare mention, not the code span.
    expect(out!.split(WRAPPED).length - 1).toBe(1);
  });

  test("leavesFencedCode", () => {
    const out = rewrite("```\nrigid monoidal category\n```\n\nAnd a bare rigid monoidal category.");
    expect(out).toContain("```\nrigid monoidal category\n```");
    expect(out!.split(WRAPPED).length - 1).toBe(1);
  });

  test("leavesInlineMath", () => {
    const out = rewrite("Math $rigid monoidal category$ and bare rigid monoidal category.");
    expect(out).toContain("$rigid monoidal category$");
    expect(out!.split(WRAPPED).length - 1).toBe(1);
  });

  test("leavesDisplayMath", () => {
    const out = rewrite("$$\nrigid monoidal category\n$$\n\nbare rigid monoidal category.");
    expect(out).toContain("$$\nrigid monoidal category\n$$");
    expect(out!.split(WRAPPED).length - 1).toBe(1);
  });

  test("noRewrap", () => {
    // The one guard that IS live: text inside a textDirective.
    expect(rewrite(`Already ${WRAPPED} wrapped.`)).toBeNull();
  });
});

describe("rewrites prose wherever it appears", () => {
  test("rewritesProseEverywhere", () => {
    for (const md of [
      "A rigid monoidal category.",
      "# A rigid monoidal category heading",
      "*a rigid monoidal category emphasised*",
      "| a | b |\n|---|---|\n| rigid monoidal category | x |",
      // Its text lives in a paragraph inside the directive, which is why the
      // old `containerDirective` guard never fired here either.
      ":::note\nA rigid monoidal category inside a container.\n:::",
    ]) {
      expect(rewrite(md)).toContain(WRAPPED);
    }
  });

  test("noSelfWrap", () => {
    expect(rewriteMarkdown("A rigid monoidal category.", SLUGS, SLUGS)).toBeNull();
  });

  test("noPhraseNoChange", () => {
    expect(rewrite("Nothing to see here.")).toBeNull();
  });
});
