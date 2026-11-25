/**
 * `:val[name]` — a witnessed value — renders as the witness's number in the
 * PDF, in prose AND inside math. Nothing tested this until 2026-09-30, and
 * prose was broken for every name containing `_`: the directive's name was
 * taken from its LaTeX-ESCAPED children, so `inv_alpha` was looked up as
 * `inv\_alpha`, missed, and the directive was printed literally. Every name
 * qou's registry uses contains an underscore; 14 of its 62 uses are in prose.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { configureValueRegistry, type WitnessedValueEntry } from "./value-registry-di";
import { generateMainTex } from "./generate-main-tex";
import { markdownToLatex, renderChapter } from "./render-latex";

const dir = mkdtempSync(join(tmpdir(), "val-latex-"));
const witness = join(dir, "demo.witness.json");

const entry = (name: string): WitnessedValueEntry => ({
  name,
  description: "test value",
  symbol: "x",
  witnessFile: witness,
  witnessPath: "data.value",
  defaultPrecision: 6,
  units: null,
});

beforeAll(() => {
  writeFileSync(witness, JSON.stringify({ data: { value: 137.035999084 } }));
  const reg: Record<string, WitnessedValueEntry> = { inv_alpha: entry("inv_alpha"), invalpha: entry("invalpha") };
  configureValueRegistry({
    WITNESSED_VALUES: reg,
    lookupValue: (n) => reg[n],
    verifiedNames: () => Object.keys(reg),
  });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe(":val in the LaTeX render", () => {
  test("inside math, a name with an underscore resolves", () => {
    expect(markdownToLatex("A $x = :val[inv_alpha]$ B.")).toContain("137.036");
  });

  test("in prose, a name with an underscore resolves (was printed literally)", () => {
    const out = markdownToLatex("A :val[inv_alpha] B.");
    expect(out).toContain("137.036");
    expect(out).not.toContain(":val[");
  });

  test("in prose, a name without an underscore resolves", () => {
    expect(markdownToLatex("A :val[invalpha] B.")).toContain("137.036");
  });

  test("attributes still apply in prose (precision = significant digits)", () => {
    expect(markdownToLatex("A :val[inv_alpha]{precision=4} B.")).toContain("$137.0$");
    expect(markdownToLatex("A :val[inv_alpha]{precision=3} B.")).toContain("$137$");
  });
});

describe("generateMainTex cover page layout", () => {
  test("places title, abstract, Lean declaration, \\proofstatuslegend, and CC-BY 4.0 license inside a single titlepage without page breaks", () => {
    const preambleFile = join(dir, "dummy-preamble.tex");
    writeFileSync(preambleFile, "\\documentclass[11pt,a4paper]{report}\n");
    const tex = generateMainTex(
      {
        title: "Test Monograph Title",
        authors: ["Test Author"],
        date: "2026-03-21",
        abstract: "This monograph develops a test categorical framework.",
        chapters: [],
      },
      {
        preamblePath: preambleFile,
        chaptersDir: "chapters/",
        chapterSlugs: new Map([[0, "introduction"]]),
        leanDeclarationLatex: "Every proof in this paper possesses a corresponding Lean 4 formalisation.",
      },
    );

    const titlepageMatch = tex.match(/\\begin\{titlepage\}([\s\S]*?)\\end\{titlepage\}/);
    expect(titlepageMatch).not.toBeNull();
    const titlepageBody = titlepageMatch![1];

    expect(titlepageBody).toContain("Test Monograph Title");
    expect(titlepageBody).toContain("Test Author");
    expect(titlepageBody).toContain("{\\bfseries Abstract}");
    expect(titlepageBody).toContain("This monograph develops a test categorical framework.");
    expect(titlepageBody).toContain("{\\bfseries Lean 4 Formalisation and Authorship Declaration}");
    expect(titlepageBody).toContain("\\label{sec:authors-note}\\label{prose:authors-note}");
    expect(titlepageBody).toContain("Every proof in this paper possesses a corresponding Lean 4 formalisation.");
    expect(titlepageBody).toContain("\\proofstatuslegend");
    expect(titlepageBody).toContain("Creative Commons Attribution 4.0 International License");
    expect(titlepageBody).not.toContain("\\begin{abstract}");
    expect(titlepageBody).not.toContain("\\clearpage");
    expect(titlepageBody).not.toContain("\\newpage");

    // Order inside titlepage: title -> abstract -> lean declaration -> proofstatuslegend -> CC-BY 4.0
    const titleIdx = titlepageBody.indexOf("Test Monograph Title");
    const abstractIdx = titlepageBody.indexOf("This monograph develops a test categorical framework.");
    const declIdx = titlepageBody.indexOf("Every proof in this paper possesses a corresponding Lean 4 formalisation.");
    const legendIdx = titlepageBody.indexOf("\\proofstatuslegend");
    const copyrightIdx = titlepageBody.indexOf("Creative Commons Attribution 4.0 International License");
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(abstractIdx).toBeGreaterThan(titleIdx);
    expect(declIdx).toBeGreaterThan(abstractIdx);
    expect(legendIdx).toBeGreaterThan(declIdx);
    expect(copyrightIdx).toBeGreaterThan(legendIdx);

    // No separate copyright page after \end{titlepage}
    const afterTitlepage = tex.slice(tex.indexOf("\\end{titlepage}") + "\\end{titlepage}".length);
    expect(afterTitlepage).not.toContain("Copyright page");
  });

  test("renderChapter omits sec:authors-note from introduction body because it is hoisted onto Page 1", () => {
    const chLatex = renderChapter(
      {
        tabLabel: "I",
        title: "Introduction",
        label: "chap:introduction",
        sections: [
          {
            title: "Overview",
            label: "sec:introduction-overview",
            blocks: ["intro"],
          },
          {
            title: "Author's note",
            label: "sec:authors-note",
            blocks: ["authors-note"],
          },
        ],
      },
      new Map([
        [
          "intro",
          {
            block: { kind: "prose", label: "prose:intro" },
            mdContent: "Introduction overview body.",
          },
        ],
        [
          "authors-note",
          {
            block: { kind: "prose", label: "prose:authors-note" },
            mdContent: "Formalisation note body.",
          },
        ],
      ]),
    );
    expect(chLatex).toContain("Introduction overview body.");
    expect(chLatex).not.toContain("Formalisation note body.");
    expect(chLatex).not.toContain("\\label{sec:authors-note}");
  });
});
