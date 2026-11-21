/**
 * Headings from the paper's own LaTeX — `_latex_headings.py` reads the
 * sectioning commands, `_pdf_headings.latex_headings` puts each on its page.
 *
 * Synthetic sources and synthetic layout lines, so nothing here needs a PDF
 * library or a corpus file.
 *
 * @module scripts/tests/latex-headings
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const SCRIPTS = new URL("..", import.meta.url).pathname;

function py(code: string): unknown {
  const r = Bun.spawnSync(["python3", "-c", `import sys, json\nsys.path.insert(0, ${JSON.stringify(SCRIPTS)})\n${code}`]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  return JSON.parse(new TextDecoder().decode(r.stdout));
}

describe("reading the source", () => {
  test("numbers as article does: sections, subsections, starred, appendix letters", () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\CN}{\mathcal N}
\begin{document}
\section{Introduction}\label{s:intro}
\section*{Acknowledgments}
\section{The @{q}$-deformed \emph{algebra}}
\subsection[short]{Its $\CN=2$ form}
\subsubsection{Detail}
\section{Next}
\appendix
\section{Proofs}
\subsection{Of the lemma}
\bibliography{refs}
\section{Not a heading}
\end{document}`.replace("@{", () => "${");
    const got = py(`import _latex_headings as L\nprint(json.dumps([list(h) for h in L.headings_from_tex(${JSON.stringify(tex)})]))`);
    expect(got).toEqual([
      [1, "1", "Introduction"],
      [1, null, "Acknowledgments"],
      [1, "2", "The $q$-deformed algebra"],
      [2, "2.1", "Its $\\mathcal N=2$ form"],
      [3, "2.1.1", "Detail"],
      [1, "3", "Next"],
      [1, "A", "Proofs"],
      [2, "A.1", "Of the lemma"],
    ]);
  });
});

describe("placing the headings on pages", () => {
  const LINES = String.raw`
import _pdf_headings as H, _latex_headings as L
def ln(page, y, text, size=10.0, bold=False):
    return H.Line(page, text, size, bold, False, H._caps(text), "Times", 1.0, 72.0, y, 72.0 + 6 * len(text), y + size, 800.0, 600.0)
def body(page, y0, n=8):
    return [ln(page, y0 + 14 * i, "the body of the text runs on in ordinary type here and there") for i in range(n)]
lines = []
for p in range(1, 6):
    lines += body(p, 200)
lines += [ln(1, 100, "1 Introduction", 12, True), ln(1, 600, "small print about the introduction", 7),
          ln(3, 100, "2 The q-deformed algebra", 12, True), ln(3, 400, "2.1 Its N=2 form", 11, True),
          ln(5, 100, "A Proofs", 12, True)]
lines.sort(key=lambda l: (l.page, l.y0))
tex = [L.TexHeading(1, "1", "Introduction"), L.TexHeading(1, "2", "The $q$-deformed algebra"),
       L.TexHeading(2, "2.1", "Its $\\mathcal N=2$ form"), L.TexHeading(1, "3", "A section the PDF lost"),
       L.TexHeading(1, "A", "Proofs")]
got = H.latex_headings(lines, tex)
`;

  test("the source is the spine; the body supplies pages; a lost heading is flagged, not dropped", () => {
    const got = py(LINES + "print(json.dumps([[s.heading.level, s.heading.number, s.heading.page, s.confidence, list(s.sources)] for s in got]))");
    expect(got).toEqual([
      [1, "1", 1, 1.0, ["latex", "body"]],
      [1, "2", 3, 1.0, ["latex", "body"]],
      [2, "2.1", 3, 1.0, ["latex", "body"]],
      [1, "3", 3, 0.5, ["latex"]],
      [1, "A", 5, 1.0, ["latex", "body"]],
    ]);
    expect(py(LINES + "print(json.dumps(H.latex_found_share(got)))")).toBe(0.8);
  });

  test("a run-in heading and a small-capitals numbered heading are found; small body text is not", () => {
    const got = py(
      LINES.replace("got = H.latex_headings(lines, tex)", "") +
        "lines2 = [l for l in lines if not l.text.startswith('2.1')] + [ln(4, 300, '2.1. Its N=2 form. We now show that the algebra splits', 10.0),\n" +
        "          ln(2, 500, 'a proofs paragraph mentions Proofs in passing', 7)]\n" +
        "lines2 = [l if l.text != 'A Proofs' else ln(5, 100, 'A. PROOFS', 7) for l in lines2]\n" +
        "lines2.sort(key=lambda l: (l.page, l.y0))\n" +
        "got = H.latex_headings(lines2, tex)\n" +
        "print(json.dumps([[s.heading.number, s.heading.page, s.confidence] for s in got]))",
    );
    expect(got).toEqual([["1", 1, 1.0], ["2", 3, 1.0], ["2.1", 4, 1.0], ["3", 4, 0.5], ["A", 5, 1.0]]);
  });

  test("pdf-structure prefers the source over the font guess, and trusts it", () => {
    const got = py(
      `import importlib.util\nspec = importlib.util.spec_from_file_location("ps", ${JSON.stringify(join(SCRIPTS, "pdf-structure.py"))})\n` +
        "ps = importlib.util.module_from_spec(spec); sys.modules['ps'] = ps; spec.loader.exec_module(ps)\n" +
        LINES +
        "toc, method = ps.infer_toc(lines, ['x' * 2000] * 5, tex)\n" +
        "few, m2 = ps.infer_toc(lines, ['x' * 2000] * 5, [L.TexHeading(1, '1', 'Nothing like it'), L.TexHeading(1, '2', 'Nor this')])\n" +
        "print(json.dumps([method, len(toc), m2, ps.latex_source_for('/nonexistent/x.pdf', None), ps.latex_source_for('/x.pdf', '')]))",
    );
    expect(got).toEqual(["latex", 5, "font", null, null]);
  });
});
