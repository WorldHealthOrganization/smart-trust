/**
 * `methodologies-viz` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/methodologies-viz.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the methodology graphs
 * of the content layers, smart-base's among them, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.js";

import {
  methodologyRows,
  page,
  pageRelPath,
  short,
  type MethodologyRow,
} from "../../scripts/gen-methodologies-viz.js";
import {
  checkMethodologyEvidence,
  methodologyNodes,
} from "../../scripts/check-methodology-evidence.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = resolve(ORIGIN_DIR, "..", "..");
const REPO = resolve(INSTANCE, "..");

describe("the page a reader gets — over the REAL corpus", () => {
  const r = checkMethodologyEvidence(INSTANCE);
  const rows = methodologyRows(methodologyNodes(INSTANCE), r, INSTANCE, REPO);

  it("the graph is found at all — `undetermined` is not a clean run", () => {
    expect(r.undetermined).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("every row's link resolves to an anchor ON THIS PAGE", () => {
    // The consumer property. A "Choosing one" row links to `#<name>`; if the
    // detail section below does not carry that id the link silently goes
    // nowhere, which reads as a broken site rather than a broken link
    // (`pb04`). Checking the committed page, not only the rendered string, so
    // a stale commit fails here too.
    const rendered = page(rows, r);
    // `siteDirFor`, never the literal. `site-dir-single-answer.test.ts` fails
    // a source file that hardcodes the output site root, and it is right to:
    // the site root is one answer and a second spelling of it is a second
    // answer free to disagree. This test wrote the literal and that guard
    // caught it.
    const committed = readFileSync(join(INSTANCE, siteDirFor(INSTANCE), pageRelPath(REPO)!), "utf-8");
    for (const text of [rendered, committed]) {
      // A detail section's anchor is the heading's kramdown id (`### Title {#name}`),
      // or an explicit `<a id>` before it; either is a target on this page.
      const targets = new Set([
        ...[...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]),
        ...[...text.matchAll(/^#{1,6} .*\{#([^}\s]+)\}\s*$/gm)].map((m) => m[1]),
      ]);
      // One title link per row. A row's prose may link further methodologies
      // by name (`linkProse`), so the count is of the title links only; every
      // same-page link, title or prose, must still land on a target.
      const rowLinks = [...text.matchAll(/^\| \*\*\[.*?\]\(#([^)]+)\)\*\*/gm)].map((m) => m[1]);
      expect(rowLinks.length).toBe(rows.length);
      const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(links.filter((l) => !targets.has(l))).toEqual([]);
    }
  });

  it("no cell breaks the table it sits in", () => {
    // `origin` and `applies-when` are free prose and one of them already
    // contains a pipe. An unescaped one silently shifts every column to its
    // right, which renders as a table that is subtly WRONG rather than as one
    // that is obviously broken.
    const body = page(rows, r).split("\n");
    const header = body.findIndex((l) => l.startsWith("| methodology |"));
    expect(header).toBeGreaterThan(-1);
    const columns = (l: string): number => l.split(/(?<!\\)\|/).length;
    const want = columns(body[header]!);
    for (const line of body.slice(header + 2)) {
      if (!line.startsWith("|")) break;
      expect({ line: line.slice(0, 40), columns: columns(line) }).toEqual({
        line: line.slice(0, 40),
        columns: want,
      });
    }
  });

  it("no row leaves a code span open — the defect that printed the table as text", () => {
    // Bean `7w1a`, owner 2026-09-24. The column check above counts pipes and
    // IGNORES code spans, so it passed while a truncated `applies-when` cut a
    // span open on the `madr` row: the stray backtick paired with one in a
    // later cell, the pipes between stopped being cell boundaries, and kramdown
    // rendered the whole table as a paragraph. Checked over the REAL page, in
    // both the rendered string and the committed file.
    const committed = readFileSync(join(INSTANCE, siteDirFor(INSTANCE), pageRelPath(REPO)!), "utf-8");
    for (const text of [page(rows, r), committed]) {
      const lines = text.split("\n");
      const header = lines.findIndex((l) => l.startsWith("| methodology |"));
      expect(header).toBeGreaterThan(-1);
      const tableRows = lines.slice(header + 2).filter((l, i, all) => all.slice(0, i + 1).every((x) => x.startsWith("|")));
      expect(tableRows.length).toBe(rows.length);
      for (const line of tableRows) {
        const ticks = (line.match(/`/g) ?? []).length;
        expect({ line: line.slice(0, 60), even: ticks % 2 === 0 }).toEqual({ line: line.slice(0, 60), even: true });
      }
    }
  });

  it("a cut that lands inside a code span or a bold run backs out of it", () => {
    const long = "x".repeat(130) + " (see `kepner-tregoe` for the method) and more words here";
    const cut = short(long, 140);
    expect((cut.match(/`/g) ?? []).length % 2).toBe(0);
    expect(cut.endsWith("…")).toBe(true);
    const bold = "y".repeat(130) + " **a bold phrase that runs past the limit** tail";
    expect((short(bold, 140).match(/\*\*/g) ?? []).length % 2).toBe(0);
    // ...and a cut that lands OUTSIDE any span, with no word boundary to back
    // off to, is left exactly where it was: the first `n` characters.
    expect(short("z".repeat(200), 150)).toBe("z".repeat(150) + "…");
  });

  it("the page is DECLARED, not composed — and under the docs tree", () => {
    const at = pageRelPath(REPO);
    expect(at).toBeDefined();
    expect(at!.startsWith("..")).toBe(false);
  });

  it("the counts on the page are the counts in the rows", () => {
    // A generated page that states a number nothing derived is the shape this
    // repository keeps paying for — a count in prose is a claim, not evidence.
    const html = page(rows, r);
    const stat = (label: string): number => {
      const m = new RegExp(`<b>(\\d+)</b><span>${label}`).exec(html);
      return m ? Number(m[1]) : -1;
    };
    expect(stat("adopted methodologies")).toBe(rows.length);
    expect(stat("with the source held here")).toBe(
      rows.filter((x: MethodologyRow) => x.state === "ingested").length,
    );
    expect(stat("cited, not ingested")).toBe(
      rows.filter((x: MethodologyRow) => x.state === "cited-only").length,
    );
  });
});
