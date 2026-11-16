/**
 * Every generated viewer's inline script must PARSE.
 *
 * Bean `hfkl`'s tiles led here. The four library viewers had been shipping a
 * script with a raw line break inside a string literal:
 *
 * ```js
 * ... .join("
 * ");
 * ```
 *
 * `gen-library-viz.ts` writes the whole page as a TypeScript **template
 * literal**, so the `\n` it contained was consumed at generation time and
 * emitted as a real newline. The browser threw `SyntaxError: Invalid or
 * unexpected token` before the first statement ran, so the viewer never issued
 * its fetch and every library tile sat on *"loading…"* forever.
 *
 * ## Why nothing caught it
 *
 * Every existing check looked at the page as TEXT or as a FILE: the links
 * resolved, the file existed, the byte size was plausible, the site build was
 * green. **A page whose script does not parse is a 200 with working links.**
 * The one question nobody asked was whether the JavaScript was JavaScript.
 *
 * Measured the day it was found: 12 navbar tiles, 5 of them opening a page
 * that could not run — and the failure is invisible to everything except a
 * browser or a parser.
 *
 * @module folio-assistant/scripts/tests/generated-viewer-scripts
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { PAGE_LOCALE } from "../../viewer-declarations.ts";

const ROOT = resolve(HARNESS_ROOT);
// `siteDirFor`, never the literal — the site root is one answer, and a gate
// in this repository fails a source file that spells it out.
const SITE = join(ROOT, siteDirFor(ROOT));

/** Every `index.html` under the generated viewer trees. */
function viewerPages(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) viewerPages(p, out);
    else if (e.name === "index.html" && statSync(p).size > 0) out.push(p);
  }
  return out;
}

// A DATA block (`type="application/json"`, `application/ld+json`) is not a
// script and is not parsed as one: a library page carries its identity in one
// since #1881, and `{"data": …}` is valid JSON and a syntax error as a body.
const SCRIPT = /<script(?![^>]*\bsrc=)(?![^>]*\btype="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g;
/** A page's `<script src>` that names a file of THIS site (relative), not a CDN. */
const SCRIPT_SRC = /<script\b[^>]*\bsrc="(?![a-z]+:|\/\/)([^"]+)"/g;

/** Does this text parse as a script? Uses the engine, not a regex. */
function parses(source: string): string | undefined {
  try {
    // `new Function` compiles without executing, which is the whole point:
    // the defect was a PARSE error, and running a viewer's script outside a
    // browser would fail for reasons that are not defects.
    // input-site: inert #40d9df46 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    new Function(source);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// DERIVED, not listed. The first version named `library` and `schemas` — the
// two families that broke in PR #805 — and that is how a guard ends up
// narrower than its own docstring: it said "every generated viewer" while
// covering 12 of 25 pages, leaving `voices`, `uploads` and `auto-docs`
// unexamined. Walking the generated tree means a new viewer family is covered
// the day it is generated rather than the day somebody remembers. Bean `jfr6`.
//
// Both trees: the viewers moved under the page locale (folio-assistant#2527),
// so `<site>/cat-harness/` alone holds only what is not yet regenerated, and a
// walk of it examined none of the pages that moved (bean w1gy F18).
const pages = [join(SITE, PAGE_LOCALE, "cat-harness"), join(SITE, "cat-harness")].flatMap((d) => viewerPages(d));

describe("generated viewers ship JavaScript that is JavaScript", () => {
  test("the viewer trees are not empty — examined nothing is not a pass", () => {
    // Without this the suite goes green on a checkout where nothing was
    // generated, which is the `dh4f` shape inside the guard itself.
    expect(pages.length).toBeGreaterThan(0);
  });

  test("every inline script in every generated viewer parses", () => {
    const broken: string[] = [];
    for (const page of pages) {
      const html = readFileSync(page, "utf-8");
      for (const [, body] of html.matchAll(SCRIPT)) {
        const err = parses(body!);
        if (err) broken.push(`${relative(ROOT, page)}: ${err}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("every SHARED script a generated viewer loads exists and parses", () => {
    // A page that is a thin shell (#1881) holds no code of its own: its
    // script is a shared asset beside its data, so the parse guard has to
    // follow the reference or it examines nothing for those pages.
    const broken: string[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      const html = readFileSync(page, "utf-8");
      for (const [, src] of html.matchAll(SCRIPT_SRC)) {
        const file = resolve(join(page, ".."), src!);
        if (seen.has(file)) continue;
        seen.add(file);
        if (!existsSync(file)) {
          broken.push(`${relative(ROOT, page)}: ${src} does not exist`);
          continue;
        }
        const err = parses(readFileSync(file, "utf-8"));
        if (err) broken.push(`${relative(ROOT, file)}: ${err}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("...and the guard has teeth — a raw newline in a string is caught", () => {
    // FALSIFICATION, in the exact shape that shipped: the escape eaten by the
    // template literal, leaving a literal line break inside the quotes.
    expect(parses('var x = ["a"].join("\n");')).toMatch(/Invalid or unexpected token|Unexpected/);
    expect(parses('var x = ["a"].join("\\n");')).toBeUndefined();
  });
});

describe("a field rendered without `esc()` must be provably numeric", () => {
  /**
   * Bean `1wef` surface 2, found 2026-09-22.
   *
   * `gen-library-viz` renders two fields WITHOUT `esc()` — `words` and
   * `bytes` — because both were assumed numeric. `words` was built by
   * `secs.reduce((n, s) => n + (s.n_words ?? 0), 0)` over `structure.json`,
   * which comes from an INGESTED corpus this repository did not author.
   *
   * `+` on a string is concatenation, so one string `n_words` made `words` the
   * string `0<img src=x onerror="alert(1)">`, and `toLocaleString()` handed it
   * straight to `innerHTML`.
   *
   * Four lines above, the `pages` line already guarded this exact class with
   * `typeof n === "number"`. The guard existed; two fields did not get it.
   *
   * This asserts the SHAPE rather than the instance: a reduce in a graph
   * builder that adds a value straight out of parsed JSON is the defect,
   * whatever the field is called.
   */
  const BUILDERS = ["library-graph.ts", "uploads-graph.ts"];

  test("no graph builder sums a raw JSON field without a typeof guard", () => {
    const offenders: string[] = [];
    for (const b of BUILDERS) {
      const p = join(TOOLS_ROOT, "scripts", b);
      if (!existsSync(p)) continue;
      const src = readFileSync(p, "utf-8");
      src.split("\n").forEach((line, i) => {
        // `reduce((n, s) => n + s.foo)` or `n + (s.foo ?? 0)` — an addition
        // whose right side is a property read, with no `typeof` on the line.
        if (/\.reduce\(/.test(line) && /\bn\s*\+\s*\(?\s*\w+\.\w+/.test(line) && !/typeof/.test(line)) {
          offenders.push(`${b}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("...and the guard has teeth — the original line is caught", () => {
    // The exact text that shipped, checked against the same predicate.
    const original = "        words: secs.reduce((n, s) => n + (s.n_words ?? 0), 0),";
    const caught =
      /\.reduce\(/.test(original) && /\bn\s*\+\s*\(?\s*\w+\.\w+/.test(original) && !/typeof/.test(original);
    expect(caught).toBe(true);
  });

  test("the guarded form passes", () => {
    const fixed = "        words: sumSections((s) => s.n_words),";
    const caught = /\.reduce\(/.test(fixed) && /\bn\s*\+\s*\(?\s*\w+\.\w+/.test(fixed) && !/typeof/.test(fixed);
    expect(caught).toBe(false);
  });
});
