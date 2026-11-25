/**
 * folio-site-qa — QA of RENDERED content: what a reader of the built site
 * actually gets, block by block. Owner, 2026-10-05: *"lots of issues. you need
 * QA checks on rendered content!!!"* — raw `\begin{tikzcd}` listings and a
 * stray `\cite` reached the staging site because every check ran on the
 * SOURCE, which was correct, and none on the output.
 *
 * Each finding names the block and a short excerpt. Four classes:
 *
 * - `raw-tex` — TeX that reached the page as text: `\begin{…}`, `\end{…}`,
 *   `\ref{…}`, `\eqref{…}`, `\cite{…}`, `\label{…}`, outside a math node and
 *   outside a deliberate source disclosure (`.tex-ph`'s `<details>`).
 * - `raw-directive` — a `:defterm[` / `:refterm[` the renderer did not claim.
 * - `stray-dollar` — with math on, a `$…$` pair left in text.
 * - `katex` — a math node KaTeX cannot parse (`throwOnError: true`), with
 *   KaTeX's message. Server-side KaTeX is the one `remark-math` installs
 *   (0.16.x); the browser loads 0.16.11, so a rare minor-version difference is
 *   possible and the browser stays the final word.
 * - `missing-image` — an `<img data-src>` whose file is not in the site.
 *
 * A check that cannot run (KaTeX not installed) reports `unknown` for its
 * class — never a pass.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export type SiteQaClass = "raw-tex" | "raw-directive" | "stray-dollar" | "katex" | "missing-image";
export interface SiteQaFinding {
  block: string;
  class: SiteQaClass;
  excerpt: string;
}
export interface SiteQaReport {
  $schema: "folio-site-qa/v1";
  blocks: number;
  findings: SiteQaFinding[];
  counts: Record<SiteQaClass, number>;
  /** Classes that could not be checked here; never read as clean. */
  unknown: SiteQaClass[];
}

type Katex = { renderToString: (tex: string, opts: Record<string, unknown>) => string };
let katexMod: Katex | null | undefined;
async function katex(): Promise<Katex | null> {
  if (katexMod !== undefined) return katexMod;
  try {
    katexMod = ((await import("katex")) as { default: Katex }).default;
  } catch {
    katexMod = null;
  }
  return katexMod;
}

/** HTML text -> what a reader's browser shows: named AND numeric entities (`&#x26;` is how remark-html writes `&`). */
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const excerpt = (s: string, at: number) => s.slice(Math.max(0, at - 30), at + 50).replace(/\s+/g, " ").trim();

/** One block's rendered HTML. `site` + `paperRel` locate images. */
export async function qaBlockHtml(
  block: string,
  html: string,
  opts: { math: boolean; macros: Record<string, string>; imageExists?: (rel: string) => boolean },
): Promise<{ findings: SiteQaFinding[]; katexUnknown: boolean }> {
  const findings: SiteQaFinding[] = [];
  const add = (c: SiteQaClass, text: string, at: number) => findings.push({ block, class: c, excerpt: excerpt(text, at) });

  // Math nodes: parse each with KaTeX.
  const mathRe = /<code class="language-math (math-inline|math-display)">([\s\S]*?)<\/code>/g;
  let katexUnknown = false;
  if (opts.math) {
    const k = await katex();
    if (!k) katexUnknown = true;
    for (const m of html.matchAll(mathRe)) {
      if (!k) break;
      const tex = decode(m[2]!);
      try {
        k.renderToString(tex, { throwOnError: true, displayMode: m[1] === "math-display", macros: { ...opts.macros } });
      } catch (e) {
        findings.push({ block, class: "katex", excerpt: `${(e as Error).message.slice(0, 120)} — in: ${tex.slice(0, 60)}` });
      }
    }
  }

  // Text a reader sees: drop math nodes, code, preformatted text and disclosures.
  const text = decode(
    html
      .replace(mathRe, " ")
      .replace(/<details[\s\S]*?<\/details>/g, " ")
      .replace(/<pre[\s\S]*?<\/pre>/g, " ")
      .replace(/<code[\s\S]*?<\/code>/g, " ")
      .replace(/<img [^>]*>/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
  for (const m of text.matchAll(/\\(begin|end|ref|eqref|cite[pt]?|label)\{/g)) add("raw-tex", text, m.index!);
  for (const m of text.matchAll(/:(defterm|refterm)\[/g)) add("raw-directive", text, m.index!);
  if (opts.math) for (const m of text.matchAll(/\$[^$\s][^$]{0,200}?\$/g)) add("stray-dollar", text, m.index!);

  for (const m of html.matchAll(/<img [^>]*data-src="([^"]+)"/g)) {
    if (opts.imageExists && !opts.imageExists(m[1]!)) findings.push({ block, class: "missing-image", excerpt: m[1]! });
  }
  return { findings, katexUnknown };
}

export function emptyReport(): SiteQaReport {
  return { $schema: "folio-site-qa/v1", blocks: 0, findings: [], counts: { "raw-tex": 0, "raw-directive": 0, "stray-dollar": 0, katex: 0, "missing-image": 0 }, unknown: [] };
}

export function addToReport(r: SiteQaReport, found: SiteQaFinding[], katexUnknown: boolean): void {
  r.blocks++;
  for (const f of found) {
    r.findings.push(f);
    r.counts[f.class]++;
  }
  if (katexUnknown && !r.unknown.includes("katex")) r.unknown.push("katex");
}

export const imageExistsUnder = (paperOut: string) => (rel: string) => existsSync(join(paperOut, rel));
