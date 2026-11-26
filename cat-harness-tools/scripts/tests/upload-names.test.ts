/**
 * `check:upload-names` — a file in an `uploads` or `library` graph carries a
 * name that is safe to link to.
 *
 * `uploads/PIIS2589750021000388 (2).pdf` broke the generated README's Markdown
 * link (a target **ends at the first `)`**), which reddened `main` through
 * *"over the real tree, every link in every generated README resolves"*.
 *
 * ## What these tests hold
 *
 * **The rule is narrow, and the narrowing is the point.** A first draft used
 * `slugify` and reported 110 findings, **77 of them `README.md` → `readme.md`**
 * — a check that damages correct names to enforce a convention nobody asked
 * for. Case is not the defect. A test pins that `README.md` is untouched, so
 * nobody widens it back.
 *
 * **Extensions and sidecars survive.** `slugify` on a whole filename gives
 * `…-2-pdf`; and `X.pdf.extraction.json` must normalise to whatever `X.pdf`
 * does, or the extraction orphans. Both are asserted on the pure function, so
 * they hold without touching the tree.
 *
 * **A collision refuses.** Two files normalising to one name renames neither:
 * a `git mv` that overwrites is a deletion with a friendlier name.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { isNormalised, normaliseName } from "../check-upload-names.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");
const SCRIPT = join("cat-harness-tools", "scripts", "check-upload-names.ts");

function run(...args: string[]): { status: number; out: string } {
  const r = spawnSync("bun", ["run", SCRIPT, ...args], { cwd: REPO, encoding: "utf-8" });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("the corpus is clean as committed", () => {
  test("`--check` passes", () => {
    const { status, out } = run("--check");
    expect(out).toContain("files examined");
    expect(status).toBe(0);
  });

  test("every count carries its denominator", () => {
    expect(run().out).toMatch(/\.\.\.needing normalisation\s+\d+ of \d+/);
  });
});

describe("case is not the defect", () => {
  test("`README.md` is left alone", () => {
    // 77 of a first draft's 110 findings were this. Renaming README.md breaks
    // every link to it and every generator that writes one.
    expect(isNormalised("README.md")).toBe(true);
    expect(normaliseName("README.md")).toBe("README.md");
  });

  test("a name with no unsafe character is returned UNTOUCHED", () => {
    // The bug this pins cost a block out of the published graph. The rule
    // replaced unsafe runs and then collapsed `-+` globally, which rewrote
    // `sec-119-74-broadly--versus-narrowly-focused-key-question.md` — a library
    // SECTION file with no unsafe character in it — to a single dash. The
    // generator then could not find `prose-sec-119`, and `sections/sec-119.jsonld`
    // regenerated WITHOUT it: `gen-library-jsonld --check` went red and the
    // `contains` array silently lost an entry.
    //
    // A double dash is not unsafe and is not this check's business.
    expect(normaliseName("sec-119-74-broadly--versus-narrowly-focused.md"))
      .toBe("sec-119-74-broadly--versus-narrowly-focused.md");
    expect(isNormalised("a--b.pdf")).toBe(true);
    expect(isNormalised("-leading-and-trailing-.pdf")).toBe(true);
  });

  test("mixed case and underscores survive", () => {
    for (const n of ["AGENTS.md", "My_File.PDF", "arxiv-2607.25032v1", "WHO-handbook.pdf"]) {
      expect(normaliseName(n)).toBe(n);
    }
  });
});

describe("the characters that actually break a link are replaced", () => {
  test("the defect that reddened main", () => {
    expect(normaliseName("PIIS2589750021000388 (2).pdf")).toBe("PIIS2589750021000388-2.pdf");
  });

  test("each unsafe character is handled", () => {
    for (const bad of [" ", ",", "(", ")", "[", "]", "{", "}", "#", "?", "&", "%", "'", '"', "`", "<", ">", "|"]) {
      expect(isNormalised(`a${bad}b.pdf`)).toBe(false);
    }
  });

  test("a run collapses to one dash, and edges are trimmed", () => {
    expect(normaliseName("a  (  ) b.pdf")).toBe("a-b.pdf");
    expect(normaliseName(" leading.pdf")).toBe("leading.pdf");
  });
});

describe("the extension chain survives — the whole risk", () => {
  test("the extension is not slugged into the stem", () => {
    // `slugify` on a whole filename gives `…-2-pdf`, losing the extension.
    expect(normaliseName("x (2).pdf")).toEndWith(".pdf");
    expect(normaliseName("x (2).pdf")).not.toContain("-pdf");
  });

  test("a sidecar normalises to exactly what its source does, plus the suffix", () => {
    const src = "Skill authoring best practices - Claude Platform Docs.pdf";
    const car = `${src}.extraction.json`;
    // The pairing is structural: strip the suffix, normalise, restore.
    expect(normaliseName(car)).toBe(`${normaliseName(src)}.extraction.json`);
  });

  test("a dotfile and an extensionless name are not mangled", () => {
    expect(normaliseName("Makefile")).toBe("Makefile");
    expect(normaliseName(".gitkeep")).toBe(".gitkeep");
  });
});

describe("a collision refuses rather than picking a winner", () => {
  test("the refusal is in the script, and it is a refusal not a rename", () => {
    // Asserted on the source: planting a real collision would require writing
    // two files into a declared uploads graph, and the invariant is what
    // matters — a `git mv` that overwrites is a deletion with a nicer name.
    const src = Bun.file(join(REPO, SCRIPT));
    return src.text().then((t) => {
      expect(t).toContain("COLLISION");
      expect(t).toContain("picking a winner silently destroys an upload");
      // ...and it returns before any git mv runs.
      expect(t.indexOf("COLLISION")).toBeLessThan(t.indexOf('"git", ["mv"'));
    });
  });
});
