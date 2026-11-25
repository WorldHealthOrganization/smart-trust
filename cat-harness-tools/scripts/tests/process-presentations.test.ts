/**
 * Subprocess links are DERIVED from the pages, and every one lands (bean `xl55`).
 *
 * Until `xl55` a process carried `<…:link href>` naming the page written about
 * it. Of ten, five were broken somewhere and nothing said so. The links are
 * now built from `WebPageNode.asset.source`, which makes the second half of
 * this file possible: checking every rendered link against the pages it names.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, basename, sep } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { workflowFiles } from "../known-skills.js";
import { processDiagrams } from "../../src/workflow/process-model.js";
import { TRACE_ENV, openTrace } from "../../schemas/sdlc/input-trace.ts";
import { checkoutProcessPresentations, processTarget, type Presentation } from "../process-presentations.js";
import { sourceForPermalink } from "../lib/jekyll-permalink.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { subjectHref } from "../lib/subject-pages.ts";
import { docsSources } from "../lib/docs-sources.ts";
import { PAGE_LOCALE } from "../viewer-declarations.ts";
import { notApplicableAlone } from "../../test/support/checkout.js";

/** guides/document-ingestion, which presents ingest-theme, is folio-assistant-core's page; only a composed checkout holds it. */
const NO_CORE_DOCS = notApplicableAlone(
  "folio-assistant-core's docs source, whose guides/document-ingestion page presents processes/ui/ingest-theme.bpmn",
);

const ROOT = resolve(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
const SVG_DIR = join(SITE, "assets/img/workflows");

// `href` is where the page is PUBLISHED, which may differ from its slug —
// since bean `kc7k` the docs-folder pages publish under `docs/cat-harness/`.
const p = (page: string, node: string, href = `${page}.html`): Presentation => ({ page, node, href, pageTitle: page });

describe("processTarget — where a subprocess box lands", () => {
  test("exactly one section presents it → that section", () => {
    expect(processTarget("x", [p("evidence", "the-subprocess")])).toBe("evidence.html#the-subprocess");
  });

  test("the link is the PUBLISHED address, not the slug", () => {
    expect(processTarget("x", [p("evidence", "s", "docs/cat-harness/evidence.html")])).toBe("docs/cat-harness/evidence.html#s");
  });

  test("a slug with a path keeps it", () => {
    expect(processTarget("x", [p("guides/who-smart-ig", "the-l3-pipeline")])).toBe("guides/who-smart-ig.html#the-l3-pipeline");
  });

  test("none → the process's own generated page, at the DECLARED route under the page locale (2026-10-09)", () => {
    expect(processTarget("options-analysis", undefined)).toBe(`${PAGE_LOCALE}/cat-harness/processes/options-analysis.html`);
    expect(processTarget("options-analysis", [])).toBe(`${PAGE_LOCALE}/cat-harness/processes/options-analysis.html`);
  });

  test("MORE than one → the process page, which lists them all — never a silent pick", () => {
    expect(processTarget("content-lifecycle", [p("a", "x"), p("b", "y")])).toBe(`${PAGE_LOCALE}/cat-harness/processes/content-lifecycle.html`);
  });
});

describe("this repository, right now", () => {
  test("the index is not empty — and reading .json page manifests reaches no traced input site", async () => {
    // The checkout's index, not one layer's: a page that presents this
    // layer's process may be authored in a layer above it, and then
    // its address carries that layer's name (`lib/docs-sources.ts`).
    const scratch = mkdtempSync(join(tmpdir(), "proc-pres-trace-"));
    const trace = openTrace(scratch);
    // input-site: inert #01b64b17 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env[TRACE_ENV];
    process.env[TRACE_ENV] = trace.env[TRACE_ENV];
    try {
      const idx = await checkoutProcessPresentations(ROOT);
      expect(idx.size).toBeGreaterThan(0);
      expect(trace.reached()).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env[TRACE_ENV];
      else process.env[TRACE_ENV] = prev;
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test.skipIf(NO_CORE_DOCS)("a process presented by an instance above is addressed under that instance", async () => {
    const idx = await checkoutProcessPresentations(ROOT);
    const theme = idx.get("processes/ui/ingest-theme.bpmn") ?? [];
    expect(theme.map((x) => `${x.page}#${x.node}`)).toEqual(["guides/document-ingestion#ingest-the-theme"]);
    expect(theme[0]!.href.endsWith("guides/document-ingestion.html")).toBe(true);
  });

  /** Every anchor a generated page pins, or a heading that would derive one. */
  const anchorsOf = (md: string): Set<string> =>
    new Set([...md.matchAll(/\{:\s*#([\w-]+)/g), ...md.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]!));

  test("every subprocess link in every rendered diagram lands on a page, and on its section", () => {
    // Only the SVGs `render-bpmn` writes. Three bootstrap diagrams' SVGs sit in
    // the same directory but are rendered by nothing since the split (bean
    // `oqdr`), so a finding in one would be about a stale file, not about how
    // links are derived — reported there rather than silently filtered here.
    const rendered = new Set(
      processDiagrams(workflowFiles(ROOT))
        .map((f) => `${f.split("/").pop()!.slice(0, -5)}.svg`),
    );
    const links = readdirSync(SVG_DIR)
      .filter((f) => rendered.has(f))
      .flatMap((f) =>
        [...readFileSync(join(SVG_DIR, f), "utf-8").matchAll(/class="fa-subprocess-link" href="([^"]+)"/g)].map((m) => ({
          svg: f,
          href: m[1]!,
        })),
      );
    expect(links.length).toBeGreaterThan(0);
    const broken: string[] = [];
    // A page of a layer above the base is composed into the site under its
    // layer's name, from that layer's own docs directory (moves M6–M8).
    const above = docsSources(ROOT).filter((s) => !s.base);
    // A call to a process whose layer's graph publishes subject pages links
    // to that page by its absolute subject IRI (cat-harness-tools#603). Such a
    // link must be exactly the IRI `subjectHref` answers for a process some
    // diagram declares — the page `kg-export` writes — never any other URL.
    const subjectPages = new Set(
      workflowFiles(ROOT).flatMap((f) =>
        [...readFileSync(f, "utf-8").matchAll(/<bpmn:process\b[^>]*\sid="([^"]+)"/g)]
          .map((m) => subjectHref(f, "process", m[1]!))
          .filter((h): h is string => h !== undefined),
      ),
    );
    for (const { svg, href } of links) {
      if (/^https?:\/\//.test(href)) {
        if (!subjectPages.has(href)) broken.push(`${svg}: ${href} — not the subject page of any declared process`);
        continue;
      }
      // Relative to the SVG FILE — which is how docs-ui re-anchors it when inlined.
      const [path, anchor] = href.split("#");
      const abs = resolve(SVG_DIR, path!);
      const layer = above.find((s) => abs.startsWith(join(SITE, s.instance) + sep));
      if (layer !== undefined) {
        const rel = relative(join(SITE, layer.instance), abs).split(sep).join("/");
        const src = sourceForPermalink(layer.outDir, `/${rel}`);
        const md = src === undefined ? join(layer.outDir, rel.replace(/\.html$/, ".md")) : join(layer.outDir, src);
        if (!existsSync(md)) broken.push(`${svg}: ${href} — no page at ${relative(ROOT, md)}`);
        else if (anchor && !anchorsOf(readFileSync(md, "utf-8")).has(anchor)) broken.push(`${svg}: ${href} — ${md.split("/").pop()} has no #${anchor}`);
        continue;
      }
      // Published address -> the page that is served there, by Jekyll's own
      // permalink rule (bean `kc7k`), not by swapping `.html` for `.md`.
      const source = abs.startsWith(SITE) ? sourceForPermalink(SITE, `/${relative(SITE, abs).split(sep).join("/")}`) : undefined;
      const md = source === undefined ? abs.replace(/\.html$/, ".md") : join(SITE, source);
      if (!abs.startsWith(SITE) || !existsSync(md)) {
        broken.push(`${svg}: ${href} — no page at ${md.slice(SITE.length + 1)}`);
        continue;
      }
      if (anchor && !anchorsOf(readFileSync(md, "utf-8")).has(anchor)) {
        broken.push(`${svg}: ${href} — ${dirname(md) === SITE ? "" : "…/"}${md.split("/").pop()} has no #${anchor}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("no diagram names a page — the link is the page's to declare", () => {
    const named = workflowFiles(ROOT)
      .filter((f) => f.endsWith(".bpmn"))
      .filter((p) => /<[\w.-]+:link\b[^>]*\bhref=/.test(readFileSync(p, "utf-8")))
      .map((p) => basename(p));
    expect(named).toEqual([]);
  });
});
