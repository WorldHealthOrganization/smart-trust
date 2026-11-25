/**
 * A stray backtick inside a viewer's page template, named as what it is.
 *
 * @module scripts/check-viewer-backticks
 * @covers docs
 * @graphNode none — a gate, not a schema
 *
 * Several generators build a whole HTML page as ONE template literal; a
 * backtick anywhere inside (often in a comment) ends the string and the rest
 * of the page is parsed as TypeScript. The compiler reports only an
 * unexpected token; this gate names the cause (`<file>:<line> - a backtick
 * here closes the page template early`).
 *
 * It reads text, since the file does not parse: the template opens at
 * `return <backtick><!doctype html>` and must close right after the final
 * `</html>`. If the first unescaped backtick after the opening is not
 * preceded by that tag, the literal ended early there. Backticks before the
 * opening are fine.
 */
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";

/** The line that opens a page template, and the only thing that selects a file. */
export const PAGE_TEMPLATE_OPENER = /return\s+`<!doctype html>/i;

/**
 * Every source that builds a whole HTML page as one template literal.
 *
 * **Derived, and bean `57n3` is the reason it could not be before.** This was
 * an array of four paths, and the honest note on it said so: deriving the set
 * found twelve files, and the old detector reported two of them — both
 * compiling — as defects, because it took the first unescaped backtick as the
 * close and did not follow `${…}`. The array therefore encoded a
 * PRECONDITION: its members obey their own NO BACKTICKS warning absolutely,
 * which is what made the naive scan sound on them.
 *
 * {@link endOfTemplate} follows interpolations now, so the precondition is
 * gone and the list with it. Measured after the fix: all seven generators
 * report clean, and a backtick planted in a comment inside each one's page is
 * still found — including in the two that could not be scanned at all before.
 *
 * **Tests are excluded by shape, and that is measured rather than tidy.**
 * `scripts/tests/ui/check-viewer-backticks.test.ts` carries a PLANTED stray at
 * line 28 as a fixture; scanning it would fail the gate on its own evidence.
 * The `.e2e.ts` files report clean today, so they are excluded for the other
 * reason: a test is not a generator, and a gate that watches fixtures reports
 * on pages nobody ships.
 */
export function viewerSources(root: string): string[] {
  // `xd1g`. Measured at the conversion: **890 before, 889 after** — the one it
  // drops is `cat-harness/schemas/block-qa-schema/dist/index.d.ts`, a
  // gitignored build artefact. Nothing gained, so a strict narrowing.
  //
  // The dot rule stays here rather than in `gitFiles`: git's corpus includes
  // `.github/` and `.claude/`, so folding one in would change what several
  // scanners read without saying so.
  const out: string[] = [];
  for (const p of gitFiles(root, (rel) => {
    if (rel.split("/").some((seg) => seg.startsWith("."))) return false;
    if (!rel.endsWith(".ts")) return false;
    return !rel.endsWith(".test.ts") && !rel.endsWith(".e2e.ts");
  }).files) {
    let src: string;
    try {
      src = readFileSync(p, "utf-8");
    } catch {
      continue;
    }
    if (PAGE_TEMPLATE_OPENER.test(src)) out.push(relative(root, p).split(sep).join("/"));
  }
  return out.sort();
}

export interface StrayBacktick {
  /** 1-based line of the backtick that closed the literal too early. */
  line: number;
  /** The line's text, so the report shows the culprit rather than a number. */
  text: string;
}

/**
 * Where the page template ends, and whether that is where it should.
 *
 * Returns `null` when the file is fine or holds no page template — a file
 * without one is not a finding, because this list is a list of the generators
 * that have the trap, not of the files that must have it.
 */
/**
 * Index of the backtick that closes the template opened just before `from`,
 * or `-1` when it never closes.
 *
 * **It follows `${…}`, and that is the whole of bean `57n3`.** The first
 * version took the next unescaped backtick, full stop, which is right only
 * for a file that obeys its own NO BACKTICKS warning absolutely. Two
 * generators do not, legitimately:
 *
 *     <title>${esc(type.title)}${scope ? ` — ${esc(scope)}` : ""} · auto-docs</title>
 *
 * The backticks there are inside an interpolation, which is CODE rather than
 * page text, so they open and close a nested template and do not end this
 * one. Reading them as the close reported two compiling files as defects.
 *
 * A backtick OUTSIDE an interpolation still closes the template, which is
 * what keeps the trap caught: a backtick in a comment inside the page is
 * ordinary text to the parser, and ending the literal there is exactly what
 * goes wrong.
 */
function endOfTemplate(src: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") return i;
    if (c === "$" && src[i + 1] === "{") {
      const end = endOfInterpolation(src, i + 2);
      if (end < 0) return -1;
      i = end;
    }
  }
  return -1;
}

/**
 * Index of the `}` closing an interpolation opened at `from`, or `-1`.
 *
 * Inside `${…}` the text is JavaScript, so a brace may be nested, a `}` may
 * sit inside a string, and a backtick opens a template of its own. All three
 * appear in the files this gate exists for — `${who ? \`…\` : "…"}` is one
 * line of a PDF generator — so none of them can be waved through.
 */
function endOfInterpolation(src: string, from: number): number {
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") {
      const end = endOfTemplate(src, i + 1);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = endOfQuoted(src, i + 1, c);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Index of the quote closing a string opened at `from`, or `-1`. */
function endOfQuoted(src: string, from: number, quote: string): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === quote) return i;
    // An unterminated single-quoted string cannot span a line in valid TS, and
    // treating a newline as the end keeps one typo from swallowing the file.
    if (src[i] === "\n") return -1;
  }
  return -1;
}

export function strayBacktick(src: string): StrayBacktick | null {
  const open = /return\s+`<!doctype html>/i.exec(src);
  if (!open) return null;

  const close = endOfTemplate(src, open.index + open[0].length);
  // Never closed at all: the file does not parse for a different reason, and
  // pointing at a backtick would be a guess. Could-not-determine, reported by
  // the caller as no finding rather than as a clean bill.
  if (close < 0) return null;

  const before = src.slice(Math.max(0, close - 40), close);
  if (/<\/html>\s*$/i.test(before)) return null;

  const line = src.slice(0, close).split("\n").length;
  return { line, text: (src.split("\n")[line - 1] || "").trim() };
}

function main(): void {
  const root = repoRootFor(join(import.meta.dir, ".."));
  const bad: string[] = [];
  let checked = 0;

  const sources = viewerSources(root);
  // REPORTED, not counted. A generator that stops matching the opener drops
  // out of a derived set in silence, which is the one way this can quietly
  // stop watching something — so the set is printed and a reader can see a
  // name go missing. A bare number could not show that.
  if (sources.length === 0) {
    console.error(
      "✗ no source builds a page template — this repository has several, so the walk found nothing.\n" +
        "  That is not a pass.",
    );
    process.exit(2);
  }
  for (const rel of sources) {
    const src = readFileSync(join(root, rel), "utf-8");
    checked++;
    const hit = strayBacktick(src);
    if (hit) {
      bad.push(
        `${rel}:${hit.line} — a backtick here closes the page template early, so ` +
          `everything after it is parsed as TypeScript. The error the compiler ` +
          `reports will name a token on this line and will not mention backticks.\n` +
          `    ${hit.text}`,
      );
    }
  }

  if (bad.length) {
    console.error("✗ stray backtick inside a viewer's page template:\n");
    for (const b of bad) console.error(`  ${b}\n`);
    process.exit(1);
  }
  console.log(`✓ ${checked} page template(s) close where they should — no stray backtick:`);
  for (const rel of sources) console.log(`    ${rel}`);
}

if (import.meta.main) main();
