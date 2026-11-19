/**
 * The viewer-page fixture and its audit — bean `edx7`.
 *
 * What these tests are mostly about is the pair of DISTINCTIONS the owner's
 * rule turns on, because getting either backwards would not look like a bug:
 *
 * - *"common fixture **unless explicty removed**"* — a page that declines the
 *   rail and a page nobody wired must not read the same. If `declinesNavbar`
 *   returned false for a real opt-out, the fixture would override a decision;
 *   if it returned true too easily, an unwired page would look deliberate and
 *   the audit would report a clean run over it.
 * - **regression vs. never-railed** — the gate refuses the first and reports
 *   the second. Swapping them makes the gate either useless (nothing fails)
 *   or red on every branch the moment somebody else merges a page.
 */
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { audit, regressions } from "../../check-viewer-nav.ts";
import { siteFileFor } from "../../../schemas/kg/cat-harness.js";
import {
  NAVBAR_OPT_OUT,
  declinesNavbar,
  isStandalonePage,
  sitePathForPage,
  toRootForPage,
  withNarrowViewport,
  withSavedScheme,
  schemeKey,
} from "../../viewer-page.ts";

const PAGE = (body: string, head = ""): string =>
  `<!doctype html>\n<html lang="en">\n<head>${head}</head>\n<body>${body}</body>\n</html>\n`;

describe("the opt-out is a declaration in the page", () => {
  test("the marker this module documents is the marker it reads", () => {
    // Asserted rather than assumed: the constant is what a generator writes
    // and the regex is what the audit reads, and a drift between them would
    // silently turn every opt-out into a `missing` finding.
    expect(declinesNavbar(PAGE("", NAVBAR_OPT_OUT))).toBe(true);
  });

  test("attribute order does not decide it", () => {
    // The page is the declaration. A generator that writes valid HTML in the
    // other order has still declined, and losing to an attribute order would
    // make the rule depend on how somebody typed it.
    expect(declinesNavbar(PAGE("", `<meta content="none" name="folio-navbar">`))).toBe(true);
  });

  test("a page that says nothing has not declined", () => {
    // The half that makes the fixture a fixture. Absence is not consent.
    expect(declinesNavbar(PAGE("<h1>hi</h1>"))).toBe(false);
  });

  test("a DIFFERENT folio-navbar value is not a decline", () => {
    // `content="auto"` is not an opt-out, and treating any `folio-navbar`
    // meta as one would let a future value silently remove a rail.
    expect(declinesNavbar(PAGE("", `<meta name="folio-navbar" content="auto">`))).toBe(false);
  });
});

describe("which pages are in the family", () => {
  test("a standalone document is", () => {
    expect(isStandalonePage(PAGE("x"))).toBe(true);
  });

  test("a Jekyll source page is NOT", () => {
    // It gets the theme's sidebar from a layout. Read off the CONTENT rather
    // than the path, because "no layout will wrap this" is a property of the
    // file — and a path list would be a second answer free to disagree.
    expect(isStandalonePage("---\ntitle: Thing\n---\n\n# Thing\n")).toBe(false);
  });
});

describe("where the page thinks it is", () => {
  const docs = "/repo/cat-harness/docs";

  test("a page at the root goes nowhere to reach the root", () => {
    expect(toRootForPage(docs, `${docs}/index.html`)).toBe(".");
    expect(sitePathForPage(docs, `${docs}/index.html`)).toBe("/");
  });

  test("depth is counted in directories, not segments", () => {
    // The filename is not a directory. Counting it would send every href one
    // level too far up — the 57-dead-links shape `injectRails` already paid
    // for, and invisible in review because `../../../..` looks like a path.
    expect(toRootForPage(docs, `${docs}/beans/index.html`)).toBe("..");
    expect(toRootForPage(docs, `${docs}/cat-harness/library/agent-skills/index.html`)).toBe("../../..");
    expect(sitePathForPage(docs, `${docs}/cat-harness/library/agent-skills/index.html`)).toBe(
      "/cat-harness/library/agent-skills/",
    );
  });
});

/** A docs tree with one page per verdict. */
function tree(): { docs: string; repo: string } {
  const repo = mkdtempSync(join(tmpdir(), "edx7-"));
  // DELIBERATELY not the real site-root name. `audit` takes the root as a
  // parameter, and a fixture that reused the real one would pass even if the
  // function had the name baked in — which is the very thing
  // `site-dir-single-answer.test.ts` exists to forbid.
  const docs = join(repo, "published");
  const put = (rel: string, html: string): void => {
    mkdirSync(join(docs, rel), { recursive: true });
    writeFileSync(join(docs, rel, "index.html"), html);
  };
  put("railed", PAGE(`<nav class="fa-nav">…</nav>`));
  put("declined", PAGE("<p>replica</p>", NAVBAR_OPT_OUT));
  put("unwired", PAGE("<p>nobody wired this</p>"));
  mkdirSync(join(docs, "authored"), { recursive: true });
  writeFileSync(join(docs, "authored", "index.html"), "---\ntitle: A\n---\n# A\n");
  return { docs, repo };
}

describe("the audit records a verdict per page", () => {
  test("three verdicts, and the Jekyll source page is not one of them", () => {
    const { docs, repo } = tree();
    const r = audit(docs, repo);
    // `flagged: 1` — the fixture's rail is a bare `<nav class="fa-nav">`, which
    // has no header, so it fails the #1757 layout flags. That is the flags
    // working, and grading them is `viewer-rail-layout.test.ts`'s job.
    expect(r.totals).toEqual({ pages: 3, railed: 1, declined: 1, linked: 0, missing: 1, flagged: 1 });
    expect(r.pages.map((p) => p.path)).toEqual(["/declined/", "/railed/", "/unwired/"]);
  });

  test("everything but `railed` carries a reason", () => {
    // A bare verdict makes the next reader re-derive what this run knew. A
    // page that works owes no explanation; the other two are states somebody
    // has to act on or accept.
    const { docs, repo } = tree();
    for (const p of audit(docs, repo).pages) {
      if (p.verdict === "railed") expect(p.reason).toBeUndefined();
      else expect(p.reason).toBeTruthy();
    }
  });

  test("pages are sorted, so the committed diff is about the change", () => {
    const { docs, repo } = tree();
    const paths = audit(docs, repo).pages.map((p) => p.path);
    expect([...paths].sort((a, b) => a.localeCompare(b, "en"))).toEqual(paths);
  });
});

describe("the gate refuses a REGRESSION, not an absence", () => {
  const at = (path: string, verdict: "railed" | "declined" | "missing") => ({
    path,
    source: `published${path}index.html`,
    verdict,
    ...(verdict === "railed" ? {} : { reason: "because" }),
  });
  const qa = (pages: ReturnType<typeof at>[]) =>
    ({
      $schema: "viewer-nav-qa/v1" as const,
      root: "published",
      totals: {
        pages: pages.length,
        railed: pages.filter((p) => p.verdict === "railed").length,
        declined: pages.filter((p) => p.verdict === "declined").length,
        missing: pages.filter((p) => p.verdict === "missing").length,
      },
      pages,
    });

  test("railed → missing is the regression the gate exists for", () => {
    const found = regressions(qa([at("/a/", "railed")]), qa([at("/a/", "missing")]));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("/a/");
  });

  test("railed → declined is ALSO a regression", () => {
    // Someone removing a rail by declaring an opt-out is still removing a
    // rail. The declaration makes it visible; it does not make it silent, and
    // a reviewer should have to look at it.
    expect(regressions(qa([at("/a/", "railed")]), qa([at("/a/", "declined")]))).toHaveLength(1);
  });

  test("a NEW page with no rail is not a regression", () => {
    // This is the whole reason the gate is not staleness. A generator somebody
    // else merged adds an unrailed page; if that failed here, every open
    // branch would go red on a merge it had nothing to do with — the ruling
    // that left `library:viz:check` ungated. `--strict` reports it, to the
    // author who added it.
    expect(regressions(qa([at("/a/", "railed")]), qa([at("/a/", "railed"), at("/b/", "missing")]))).toEqual([]);
  });

  test("a page that was never railed and still is not is not a regression", () => {
    expect(regressions(qa([at("/a/", "missing")]), qa([at("/a/", "missing")]))).toEqual([]);
  });

  test("a page that GAINS a rail is not a regression", () => {
    expect(regressions(qa([at("/a/", "missing")]), qa([at("/a/", "railed")]))).toEqual([]);
  });

  test("a railed page that DISAPPEARS is not reported here", () => {
    // Deliberate, and the reason is worth stating: a deleted page is a
    // different finding with a different owner — the generator's own orphan
    // sweep, which knows whether the subject still exists. Reporting it here
    // as a lost rail would name the wrong defect and send somebody to fix
    // navigation on a page that should not exist.
    expect(regressions(qa([at("/a/", "railed")]), qa([]))).toEqual([]);
  });
});

describe("the narrow-viewport rules ride on the fixture — bean `2r2n`", () => {
  const css = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/css/narrow-viewport.css")), "utf-8");

  test("inlined into the head, from the one file the themed pages link", () => {
    const out = withNarrowViewport(PAGE("<table><tr><td>x</td></tr></table>"));
    const head = out.slice(0, out.search(/<\/head>/i));
    expect(head).toContain(css);
  });

  test("idempotent: a second pass adds nothing", () => {
    const once = withNarrowViewport(PAGE("<p>x</p>"));
    expect(withNarrowViewport(once)).toBe(once);
  });

  test("the rules keep wide content in its own box, never the page", () => {
    expect(css).toContain("overflow-x: auto");
    expect(css).toMatch(/max-width:\s*799\.98px/);
    // The theme's own wrapper already scrolls; the navbar is not content.
    expect(css).toContain(":not(.table-wrapper > table)");
    expect(css).toContain(":not(.fa-nav table)");
  });
});

describe("the reader's saved scheme reaches a standalone viewer — bean `dc64`", () => {
  test("the key is the one docs-ui.js stores the scheme under", () => {
    const js = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf-8");
    expect(js).toContain(`var SCHEME_KEY = "${schemeKey()}";`);
  });

  test("a script in the HEAD decides the scheme before first paint — stored, else the OS, else light (2026-10-15)", () => {
    const out = withSavedScheme(PAGE("<p>x</p>"));
    const head = out.slice(0, out.search(/<\/head>/i));
    expect(head).toContain(`localStorage.getItem(${JSON.stringify(schemeKey())})`);
    expect(head).toContain('s="light"');
    expect(head).toContain('(prefers-color-scheme: dark)');
    expect(head).toContain('setAttribute("data-fa-scheme",s)');
  });

  test("idempotent: a second pass adds nothing", () => {
    const once = withSavedScheme(PAGE("<p>x</p>"));
    expect(withSavedScheme(once)).toBe(once);
  });
});

