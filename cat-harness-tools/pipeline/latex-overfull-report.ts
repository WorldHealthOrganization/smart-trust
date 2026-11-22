#!/usr/bin/env bun
/**
 * LaTeX overfull-box reporter — turns the pdflatex log's "Overfull \hbox"
 * warnings into an actionable, located report (and an optional CI gate).
 *
 * Motivation
 * ----------
 * Over-wide tables, long inline math, and unbreakable identifiers spill past
 * the right margin. pdflatex already reports each as an "Overfull \hbox
 * (<N>pt too wide) … at lines A--B" warning, but those are buried in a
 * thousands-of-lines log and carry only a line number — not which chapter /
 * file they belong to. This tool parses the log, tracks the current input
 * file via TeX's `(file …)` open/close convention, and emits a report sorted
 * by severity and grouped by file, so a "table overflow" is a named, ranked
 * item instead of a manual eyeball over a 1300-page PDF.
 *
 * It is the runtime complement to the render-time table sizing in
 * render-latex.ts: the renderer wraps / scales / breaks to AVOID overflow, and
 * this reports whatever residual still spills (e.g. a single math run with no
 * top-level break point) so it can be chased or content-fixed.
 *
 * Usage
 * -----
 *   bun run cat-harness-tools/pipeline/latex-overfull-report.ts main.log
 *   bun run cat-harness-tools/pipeline/latex-overfull-report.ts main.log --min 10   # hide < 10pt
 *   bun run cat-harness-tools/pipeline/latex-overfull-report.ts main.log --max 50   # exit 1 if any >= 50pt
 *   bun run cat-harness-tools/pipeline/latex-overfull-report.ts main.log --json
 *
 * Exit code is 0 unless `--max <pt>` is given and some box meets/exceeds it
 * (so it can gate CI at a chosen tolerance without failing on the long tail of
 * sub-visible <20pt boxes).
 */

import { readFileSync } from "fs";
import { basename } from "path";

export interface OverfullBox {
  /** Source file the box was typeset from (best-effort from the log). */
  file: string;
  /** First source line of the offending paragraph/row. */
  line: number;
  /** How far past the line width, in points. */
  pt: number;
  /** "hbox" (horizontal — the over-wide case) — vbox is ignored. */
  kind: "hbox";
}

/**
 * Walk the TeX log tracking the current input file via the `(path … )`
 * convention pdflatex uses when it opens/closes files, and return, for every
 * character offset, the file then being read. TeX wraps log lines at 79 cols,
 * so we scan the whole string and match `(` immediately followed by a
 * path-like token (containing a `/` or ending in `.tex`).
 */
function fileAtOffset(log: string): { offsets: number[]; files: string[] } {
  const stack: string[] = ["<main>"];
  const offsets: number[] = [0];
  const files: string[] = [stack[0]];
  // A path token after "(": up to the next whitespace or a paren/bracket.
  const PATH = /^\(([^\s()[\]{}]*\.[a-zA-Z]+)/;
  for (let i = 0; i < log.length; i++) {
    const c = log[i];
    if (c === "(") {
      const m = PATH.exec(log.slice(i, i + 200));
      if (m && (m[1].includes("/") || m[1].endsWith(".tex"))) {
        stack.push(basename(m[1]));
        offsets.push(i);
        files.push(stack[stack.length - 1]);
        i += m[0].length - 1;
        continue;
      }
      // a non-file "(" — push a marker so the matching ")" doesn't pop a file
      stack.push("");
    } else if (c === ")") {
      if (stack.length > 1) stack.pop();
      offsets.push(i);
      files.push(stack[stack.length - 1] || stack.slice().reverse().find(Boolean) || "<main>");
    }
  }
  return { offsets, files };
}

/** Binary-search the file in effect at a given log offset. */
function lookupFile(map: { offsets: number[]; files: string[] }, off: number): string {
  let lo = 0, hi = map.offsets.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (map.offsets[mid] <= off) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return map.files[ans] || "<main>";
}

/** Parse every "Overfull \hbox (<N>pt too wide) … at lines A--B" from a log. */
export function parseOverfull(log: string): OverfullBox[] {
  const map = fileAtOffset(log);
  const re =
    /Overfull \\hbox \(([\d.]+)pt too wide\)(?:[^\n]*?at lines (\d+)--\d+| (?:detected|has occurred))?/g;
  const out: OverfullBox[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(log)) !== null) {
    out.push({
      file: lookupFile(map, m.index),
      line: m[2] ? Number(m[2]) : 0,
      pt: Number(m[1]),
      kind: "hbox",
    });
  }
  return out;
}

function main(argv: string[]): number {
  const logPath = argv.find((a) => !a.startsWith("--"));
  if (!logPath) {
    console.error("usage: latex-overfull-report.ts <main.log> [--min N] [--max N] [--json]");
    return 2;
  }
  const minPt = Number(argv[argv.indexOf("--min") + 1]) || 0;
  const maxIdx = argv.indexOf("--max");
  const maxPt = maxIdx >= 0 ? Number(argv[maxIdx + 1]) : null;
  const json = argv.includes("--json");

  const boxes = parseOverfull(readFileSync(logPath, "utf-8"))
    .filter((b) => b.pt >= minPt)
    .sort((a, b) => b.pt - a.pt);

  if (json) {
    console.log(JSON.stringify(boxes, null, 2));
    return maxPt != null && boxes.some((b) => b.pt >= maxPt) ? 1 : 0;
  }

  if (boxes.length === 0) {
    console.log(`[overfull-report] ${basename(logPath)}: ✓ no Overfull \\hbox >= ${minPt}pt`);
    return 0;
  }

  // group by file
  const byFile = new Map<string, OverfullBox[]>();
  for (const b of boxes) (byFile.get(b.file) ?? byFile.set(b.file, []).get(b.file)!).push(b);

  const total = boxes.length;
  const worst = boxes[0].pt;
  const ge100 = boxes.filter((b) => b.pt >= 100).length;
  const ge50 = boxes.filter((b) => b.pt >= 50).length;
  console.log(
    `[overfull-report] ${basename(logPath)}: ${total} Overfull \\hbox` +
      ` (worst ${worst.toFixed(0)}pt, ${ge50} >=50pt, ${ge100} >=100pt)\n`,
  );
  for (const [file, list] of [...byFile.entries()].sort(
    (a, b) => b[1][0].pt - a[1][0].pt,
  )) {
    console.log(`  ${file}  (${list.length})`);
    for (const b of list.slice(0, 12)) {
      console.log(`    ${b.pt.toFixed(0).padStart(5)}pt  line ${b.line || "?"}`);
    }
    if (list.length > 12) console.log(`    … and ${list.length - 12} more`);
  }

  if (maxPt != null && worst >= maxPt) {
    console.log(`\n✗ ${boxes.filter((b) => b.pt >= maxPt).length} box(es) >= ${maxPt}pt (gate)`);
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
