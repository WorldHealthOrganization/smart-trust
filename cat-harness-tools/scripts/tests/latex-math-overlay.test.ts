/**
 * The LaTeX overlay — `latex-math-overlay.py` and `arxiv-source.py`.
 *
 * Every claim is made against an entry and a source this file builds: the
 * corpus has no fetched `source/` yet, so a run over it would report `skipped`
 * for every entry and prove nothing about the gates.
 *
 * @module scripts/tests/latex-math-overlay
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPTS = new URL("..", import.meta.url).pathname;
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const KNOTS =
  "Torus knots are classified by a pair of coprime positive integers. A knot is a torus knot if it lies " +
  "on the surface of a torus, in which case the integers count the number of times that the knot winds " +
  "around the two cycles of the torus. The simplest example is the trefoil knot, which has three crossings.";

interface Fixture {
  root: string;
  entry: string;
  tgz: string;
}

/** An entry as a PDF rung leaves it, and a source whose sections are given. */
function fixture(tex: Record<string, string>, opts: { granularity?: "page"; pdfText?: Record<string, string> } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "ovl-"));
  made.push(root);
  const entry = join(root, "library", "arxiv-0705.1468v1");
  mkdirSync(join(entry, "sections"), { recursive: true });
  const pdfText = opts.pdfText ?? { "Rational maps, torus knots and links": KNOTS + " In the standard knot catalogue notation it is 3 1." };
  const sections = Object.keys(pdfText).map((title, i) => ({ id: `sec-00${i}`, title, level: 1 }));
  writeFileSync(
    join(entry, "structure.json"),
    JSON.stringify({ _schema: "pdf-structure/v1", source: { file: "x.pdf" }, sections, ...(opts.granularity ? { granularity: "page" } : {}) }),
  );
  for (const [i, t] of Object.values(pdfText).entries()) {
    writeFileSync(join(entry, "sections", `sec-00${i}.md`), `---\ndoc_id: arxiv-0705.1468v1\nsection_id: sec-00${i}\n---\n${t}\n`);
  }
  const src = join(root, "src");
  mkdirSync(src);
  const body = Object.entries(tex)
    .map(([title, text]) => `\\section{${title}}\n${text}\n`)
    .join("");
  writeFileSync(join(src, "main.tex"), `\\documentclass{article}\n\\newcommand{\\R}{\\mathbb{R}}\n\\begin{document}\n${body}\\end{document}\n`);
  const r = Bun.spawnSync(["sh", "-c", "tar czf ../e-print.tgz ."], { cwd: src });
  if (r.exitCode !== 0) throw new Error("tar failed");
  return { root, entry, tgz: join(root, "e-print.tgz") };
}

function overlay(...args: string[]): { code: number; out: { status: string; reason: string; sections: Record<string, unknown>[] }[] } {
  const r = Bun.spawnSync(["python3", join(SCRIPTS, "latex-math-overlay.py"), ...args, "--json"]);
  return { code: r.exitCode, out: JSON.parse(new TextDecoder().decode(r.stdout)) };
}

const section = (f: Fixture, i = 0): string => readFileSync(join(f.entry, "sections", `sec-00${i}.md`), "utf-8");

describe("latex-math-overlay", () => {
  test("a section that passes all three gates gets the author's mathematics", () => {
    const f = fixture({
      "Rational maps, torus knots and links": `${KNOTS} In the standard knot catalogue notation it is $3_1$.\n\\begin{equation} \\phi:\\R^3\\to S^2 \\end{equation}`,
    });
    const { code, out } = overlay(f.entry, "--source", f.tgz);
    expect(code).toBe(0);
    expect(out[0]?.sections[0]?.result).toBe("overlaid");
    const md = section(f);
    expect(md).toContain("$3_1$");
    // With pandoc, the paper's own `\newcommand` expands, which is why the
    // preamble's macros are handed to it with each section. Without pandoc
    // (a stock CI runner) the section keeps the author's LaTeX verbatim and
    // says so; both branches are checked, whichever this machine takes.
    const converter = out[0]?.sections[0]?.converter;
    if (converter === "pandoc") {
      expect(md).toContain("\\mathbb{R}^3");
    } else {
      expect(converter).toBe("latex");
      expect(md).toContain("\\phi:\\R^3\\to S^2");
    }
    expect(md).toContain("text_source: latex");
    // The rung's frontmatter is kept, not rewritten.
    expect(md).toContain("doc_id: arxiv-0705.1468v1");
    const s = JSON.parse(readFileSync(join(f.entry, "structure.json"), "utf-8"));
    expect(s.source.math_source).toBe("latex");
    expect(s.diagnostics.latex_overlay.overlaid).toBe(1);
  });

  test("titles that agree over contents that do not: reported, NOT applied", () => {
    const f = fixture({ "Rational maps, torus knots and links": "Bananas, elephants, saxophones, volcanoes and marmalade." });
    const before = section(f);
    const { out } = overlay(f.entry, "--source", f.tgz);
    expect(String(out[0]?.sections[0]?.result)).toStartWith("prose gate failed");
    expect(section(f)).toBe(before);
  });

  test("a LaTeX section holding only part of the PDF section does not replace it", () => {
    // The prose gate alone passes this: every LaTeX word IS in the PDF text.
    // Without the coverage gate the whole section would become this fragment.
    const long = Array.from({ length: 12 }, (_, i) => `Paragraph ${["alpha", "gamma", "delta", "sigma"][i % 4]}${i} discusses soliton energy bounds.`).join(" ");
    const f = fixture({ "Rational maps, torus knots and links": "Torus knots are classified by a pair of coprime integers." }, {
      pdfText: { "Rational maps, torus knots and links": `${KNOTS} ${long}` },
    });
    const before = section(f);
    const { out } = overlay(f.entry, "--source", f.tgz);
    expect(String(out[0]?.sections[0]?.result)).toStartWith("coverage gate failed");
    expect(section(f)).toBe(before);
  });

  test("a PDF section that is a \\subsection pairs with it, and its parent stops where it starts", () => {
    // A font-size rung reports subsections as sections of their own. Splitting
    // the LaTeX only at \\section left every one of them unpaired, and made the
    // parent's LaTeX body hold its subsections' text, failing the prose gate.
    const SOL = "Higher charge solitons form linked loops whose energy grows sublinearly with their charge.";
    const f = fixture({ "Rational maps, torus knots and links": `${KNOTS}\n\\subsection{Higher charge solitons}\n${SOL}` }, {
      pdfText: { "Rational maps, torus knots and links": KNOTS, "Higher charge solitons": SOL },
    });
    const { out } = overlay(f.entry, "--source", f.tgz);
    expect(out[0]?.sections.map((s) => s.result)).toEqual(["overlaid", "overlaid"]);
    expect(section(f, 0)).not.toContain("sublinearly");
    expect(section(f, 1)).toContain("sublinearly");
  });

  test("a \\subsection the PDF did not report stays inside its parent", () => {
    const SOL = "Higher charge solitons form linked loops whose energy grows sublinearly with their charge.";
    const f = fixture({ "Rational maps, torus knots and links": `${KNOTS}\n\\subsection{Higher charge solitons}\n${SOL}` }, {
      pdfText: { "Rational maps, torus knots and links": `${KNOTS} Higher charge solitons ${SOL}` },
    });
    const { out } = overlay(f.entry, "--source", f.tgz);
    expect(out[0]?.sections[0]?.result).toBe("overlaid");
    expect(section(f, 0)).toContain("sublinearly");
  });

  test("a LaTeX 2.09 source (\\documentstyle) is read; AMS-TeX is not", () => {
    const f = fixture({ "Rational maps, torus knots and links": KNOTS });
    const tex = (head: string) => {
      const p = join(f.root, `old-${head.length}.tex`);
      writeFileSync(p, `${head}\n\\begin{document}\n\\section{Rational maps, torus knots and links}\n${KNOTS}\n\\end{document}\n`);
      return p;
    };
    expect(overlay(f.entry, "--source", tex("\\documentstyle[12pt]{article}"), "--dry-run").out[0]?.sections[0]?.result).toBe("overlaid");
    const amstex = join(f.root, "amstex.tex");
    writeFileSync(amstex, `\\input amstex\n\\documentstyle{amsppt}\n\\head Rational maps\\endhead\n${KNOTS}\n\\enddocument\n`);
    expect(overlay(f.entry, "--source", amstex, "--dry-run").out[0]?.reason).toContain("none with");
  });

  test("a section is never paired by position", () => {
    const f = fixture({ "Something else entirely": KNOTS });
    const { out } = overlay(f.entry, "--source", f.tgz);
    expect(out[0]?.sections[0]?.result).toBe("no matching \\section");
  });

  test("not eligible is SKIPPED with a reason, never 'overlaid: 0'", () => {
    const paged = fixture({ "Rational maps, torus knots and links": KNOTS }, { granularity: "page" });
    expect(overlay(paged.entry, "--source", paged.tgz).out[0]).toMatchObject({ status: "skipped", reason: expect.stringContaining("page granularity") });
    const nosrc = fixture({ "Rational maps, torus knots and links": KNOTS });
    const r = overlay(nosrc.entry);
    expect(r.code).toBe(0);
    expect(r.out[0]).toMatchObject({ status: "skipped", reason: expect.stringContaining("no LaTeX source") });
  });

  test("a staged entry reads the source fetched into the promoted one", () => {
    const f = fixture({ "Rational maps, torus knots and links": `${KNOTS} In the standard knot catalogue notation it is $3_1$.` });
    const library = join(f.root, "library");
    const promoted = join(library, "arxiv-0705.1468v1", "source");
    mkdirSync(promoted, { recursive: true });
    writeFileSync(join(promoted, "e-print"), readFileSync(f.tgz));
    const staging = join(f.root, "ingest-staging", "arxiv-0705.1468v1");
    mkdirSync(join(f.root, "ingest-staging"));
    Bun.spawnSync(["cp", "-r", f.entry, staging]);
    rmSync(join(staging, "source"), { recursive: true, force: true });
    expect(existsSync(join(staging, "source"))).toBe(false);
    expect(overlay(staging, "--library", library).out[0]?.sections[0]?.result).toBe("overlaid");
  });
});

describe("arxiv-source", () => {
  test("every arXiv id shape the qou library uses is read from the directory name", () => {
    const py = `
import importlib.util as u, json, sys
s = u.spec_from_file_location("a", sys.argv[1]); m = u.module_from_spec(s); s.loader.exec_module(m)
print(json.dumps([m.arxiv_id(n) for n in sys.argv[2:]]))`;
    const names = ["arxiv-0705.1468v1", "arxiv-2111.06645", "arxiv-hep-th-9901001v2", "arxiv-alg-geom-9408004v1", "arxiv-math.GT-0309136v1", "milnorlink"];
    const r = Bun.spawnSync(["python3", "-c", py, join(SCRIPTS, "arxiv-source.py"), ...names]);
    expect(JSON.parse(new TextDecoder().decode(r.stdout))).toEqual([
      "0705.1468v1",
      "2111.06645",
      // The LAST hyphen before the digits is the slash: categories carry hyphens.
      "hep-th/9901001v2",
      "alg-geom/9408004v1",
      "math.GT/0309136v1",
      null,
    ]);
  });
});
