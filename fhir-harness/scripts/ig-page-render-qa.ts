#!/usr/bin/env bun
/**
 * ig-page-render-qa.ts — open every page of a built IG site in a headless
 * browser and list the markup it shows as plain text.
 *
 * Owner, 2026-11-11 (Q-MD-2, "do both"): besides the AST scan
 * (`ig-markdown-qa.ts`), the QA report scans every page as a reader sees it.
 * The artefact pages draw their markdown and narrative in the browser, so
 * only a browser sees what they show. This is the site build's final step
 * `ig-site:page-render-qa`: it writes `assets/fhir-qa/page-render.json` and
 * the script that draws it into the QA report's "Page scan" panel. It reports
 * and never fails the build: a machine without a browser writes why.
 *
 *   bun run fhir-harness/scripts/ig-page-render-qa.ts <built site> [--limit <n>] [--concurrency <n>] [--budget-min <n>]
 *
 * The scan stops at its time budget (`SCAN_BUDGET_MS`, 15 minutes) and counts
 * the pages it did not reach, and each page has a hard limit, so the step
 * cannot hold a publish.
 *
 * @module fhir-harness/scripts/ig-page-render-qa
 * @covers none — it judges how built pages read, not a declared graph
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { LEFTOVERS } from "./ig-markdown-qa.ts";

/** Where the results and their drawing script go under the site root, beside the Publisher's QA. */
export const PAGE_RENDER_FILE = "assets/fhir-qa/page-render.json";
export const PAGE_RENDER_SCRIPT = "assets/fhir-qa/page-render.js";
export const PAGE_RENDER_SCHEMA = "fhir-harness/page-render-qa/v1";

export interface PageFinding {
  page: string;
  /** The markup names left as text in this block. */
  markup: string[];
  /** The block's text, shortened. */
  excerpt: string;
}

export interface PageRenderQa {
  $schema: typeof PAGE_RENDER_SCHEMA;
  generatedAt: string;
  /** Why nothing was scanned, when nothing was. */
  unavailable?: string;
  scanned: number;
  /** Pages that did not finish drawing in time, or failed to load. */
  unfinished: string[];
  /** Pages left unopened because the scan's time budget ran out. */
  notReached?: number;
  findings: PageFinding[];
}

/** The pages a reader meets: the root's pages and the artefact pages, not the JSON views or redirect stubs. */
export function pagesOf(site: string): string[] {
  const html = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".html")) : []);
  const isStub = (f: string) => /http-equiv=["']?refresh/i.test(readFileSync(f, "utf8").slice(0, 2000));
  const root = html(site).filter((f) => !isStub(join(site, f)));
  const art = html(join(site, "artifact"))
    .filter((f) => !/\.(json|xml|ttl|jsonld)\.html$/.test(f))
    // A mappings view shows FHIR's mapping strings, which are not markdown ("* .role [classCode = ...]").
    .filter((f) => !/-mappings\.html$/.test(f))
    .filter((f) => !isStub(join(site, "artifact", f)))
    .map((f) => `artifact/${f}`);
  return [...root, ...art].sort();
}

/** The markup names left as text in one block of a page's visible text. A heading numbered "1. Plan" is a heading, not a list. */
export function blockLeftovers(text: string, tag = "P"): string[] {
  const heading = /^H[1-6]$/.test(tag);
  return LEFTOVERS.filter((l) => !(heading && (l.name === "list marker" || l.name === "heading")) && l.re.test(text)).map((l) => l.name);
}

/**
 * Runs in the page: each text block of the main content as a reader sees it,
 * code and preformatted text left out (markup there is meant), and a link
 * shown as "[text]" so an image drawn as a link reads "![".
 */
const COLLECT = `(() => {
  const main = document.querySelector("main") || document.body;
  const BLOCK = "P,LI,TD,TH,DD,DT,H1,H2,H3,H4,H5,H6,FIGCAPTION,BLOCKQUOTE,CAPTION";
  const SKIP = "CODE,PRE,SCRIPT,STYLE,NOSCRIPT,TEXTAREA,SVG";
  const text = (n) => {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1 || SKIP.split(",").includes(n.tagName.toUpperCase())) return "";
    if (n.matches && n.matches(BLOCK)) return "";
    const t = Array.from(n.childNodes).map(text).join("");
    return n.tagName === "A" ? "[" + t + "]" : t;
  };
  const own = (b) => Array.from(b.childNodes).map((c) => c.nodeType === 1 && c.matches(BLOCK) ? "\\n" : text(c)).join("");
  return Array.from(main.querySelectorAll(BLOCK)).filter((b) => !b.closest(SKIP)).map((b) => [b.tagName, own(b).replace(/[ \\t]+/g, " ").trim()]).filter((x) => x[1]);
})()`;

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jsonld": "application/ld+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };

/**
 * Serve the built site on a free local port. `node:http`, not `Bun.serve`, so the
 * scan runs under Bun (the CLI) and under Node (Playwright, `ig-page-render-qa.e2e.ts`).
 */
async function serve(site: string): Promise<{ url: string; stop: () => void }> {
  const root = resolve(site);
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = resolve(join(root, p));
    if (!(f === root || f.startsWith(root + sep)) || !existsSync(f) || !statSync(f).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    stop: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

async function launch(): Promise<{ browser: import("playwright").Browser } | { unavailable: string }> {
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    return { unavailable: "playwright is not installed here" };
  }
  // Playwright's own pick first: for headless that is chrome-headless-shell of the
  // build it pins. A CI image or cache can ship that build's full Chromium without
  // the headless shell, so the full build of the same revision (`channel: "chromium"`)
  // is tried next, then any build found under the browser directories, newest first.
  const tries: { channel?: string; executablePath?: string }[] = [{}, { channel: "chromium" }];
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.HOME && join(process.env.HOME, ".cache", "ms-playwright")];
  for (const base of new Set(roots.filter((r): r is string => !!r && r !== "0" && existsSync(r))))
    for (const d of readdirSync(base).sort().reverse())
      for (const rel of ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"])
        if (existsSync(join(base, d, rel))) tries.push({ executablePath: join(base, d, rel) });
  const errors: string[] = [];
  for (const t of tries) {
    try {
      return { browser: await pw.chromium.launch({ ...t, args: ["--no-sandbox"] }) };
    } catch (e) {
      errors.push((e as Error).message.split("\n")[0]!);
    }
  }
  const last = [...new Set(errors)].join("; ");
  return { unavailable: `no Chromium could be launched (${last})` };
}

/** Scan the built site's pages. */
/** The whole scan's budget: a QA step reports, so it may never hold the publish (smart-ccc run 43738657067 sat in it for 2 h). */
export const SCAN_BUDGET_MS = 15 * 60_000;

/** `p`, or `undefined` once `ms` has passed. */
function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<undefined>((ok) => (t = setTimeout(() => ok(undefined), ms)))]).finally(() => clearTimeout(t));
}

export async function scanSite(site: string, o: { limit?: number; concurrency?: number; timeoutMs?: number; budgetMs?: number } = {}): Promise<PageRenderQa> {
  const out: PageRenderQa = { $schema: PAGE_RENDER_SCHEMA, generatedAt: new Date().toISOString(), scanned: 0, unfinished: [], findings: [] };
  const pages = pagesOf(site).slice(0, o.limit ?? Infinity);
  if (!pages.length) return { ...out, unavailable: "the site has no pages to scan" };
  const l = await launch();
  if ("unavailable" in l) return { ...out, unavailable: l.unavailable };
  const srv = await serve(site);
  try {
    const ctx = await l.browser.newContext();
    // Only the site itself: the platform's rail and other hosts are not this IG's pages.
    await ctx.route("**/*", (r) => (r.request().url().startsWith(srv.url) || r.request().url().startsWith("blob:") || r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    const queue = [...pages];
    const timeout = o.timeoutMs ?? 15000;
    const deadline = Date.now() + (o.budgetMs ?? SCAN_BUDGET_MS);
    const scan = async (page: import("playwright").Page, p: string): Promise<void> => {
      await page.goto(srv.url + p, { waitUntil: "load", timeout });
      // An artefact page has drawn when its loading line is gone.
      await page.waitForFunction(() => !document.querySelector(".iga-state, .ast-resource:not([data-state])"), null, { timeout }).catch(() => out.unfinished.push(p));
      const blocks = (await page.evaluate(COLLECT)) as [string, string][];
      out.scanned++;
      for (const [tag, b] of blocks) {
        const markup = blockLeftovers(b, tag);
        if (markup.length) out.findings.push({ page: p, markup, excerpt: b.replace(/\s+/g, " ").slice(0, 120) });
      }
    };
    const worker = async () => {
      let page = await ctx.newPage();
      for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
        if (Date.now() >= deadline) {
          queue.unshift(p);
          break;
        }
        // Each page has a hard limit too: Playwright's own timeouts do not cover a
        // page that never returns from `evaluate`. A page past it is closed, not reused.
        const done = await within(
          scan(page, p).then(
            () => true,
            () => false,
          ),
          2 * timeout + 5000,
        );
        if (done !== true) out.unfinished.push(p);
        if (done === undefined) {
          await within(page.close(), 5000).catch(() => {});
          page = await ctx.newPage();
        }
      }
      await within(page.close(), 5000).catch(() => {});
    };
    await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 4) }, worker));
    if (queue.length) out.notReached = queue.length;
  } finally {
    srv.stop();
    await l.browser.close();
  }
  // A page past its hard limit may also have been listed by its own wait.
  out.unfinished = [...new Set(out.unfinished)].sort();
  out.findings.sort((a, b) => a.page.localeCompare(b.page));
  return out;
}

/** The QA report's panel script: draws `page-render.json` into `.ig-qa-render`. Plain ES5, every value as text. */
export const PAGE_RENDER_JS = String.raw`(function () {
  "use strict";
  var box = document.querySelector(".ig-qa-render");
  if (!box) return;
  function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = String(text); return e; }
  fetch(box.getAttribute("data-src")).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (q) {
    box.textContent = "";
    if (q.unavailable) { box.append(el("p", "Not scanned: " + q.unavailable + ".")); return; }
    box.append(el("p", q.scanned + " page(s) scanned on " + q.generatedAt + ". Findings: " + (q.findings.length ? q.findings.length + " block(s) show markup as text." : "none.") + (q.unfinished.length ? " " + q.unfinished.length + " page(s) did not finish drawing." : "") + (q.notReached ? " " + q.notReached + " page(s) not reached: the scan's time budget ran out." : "")));
    if (q.findings.length) {
      var t = el("table"), h = el("tr");
      ["page", "left as text", "text"].forEach(function (c) { h.append(el("th", c)); });
      t.append(h);
      q.findings.forEach(function (f) {
        var tr = el("tr"), a = el("a", f.page), td = el("td");
        a.href = box.getAttribute("data-root") + f.page;
        td.append(a);
        tr.append(td, el("td", f.markup.join(", ")), el("td", f.excerpt));
        t.append(tr);
      });
      box.append(t);
    }
    if (q.unfinished.length) { box.append(el("p", "Did not finish drawing: " + q.unfinished.join(", "))); }
  }).catch(function (e) { box.textContent = "The page scan has no results on this site (" + e.message + "): it runs as the site build's last step."; });
})();
`;

/** The QA report's panel, as Markdown lines; drawn in the browser from what the final step wrote. */
export function pageRenderQaMarkdown(o: { up?: string } = {}): string[] {
  const up = o.up ?? "";
  return [
    "### Page scan",
    "",
    `Every page of this site opened in a headless browser after the build, and its text checked for markup shown as text. [Results (JSON)](${up}${PAGE_RENDER_FILE})`,
    "",
    `<div class="ig-qa-render" markdown="0" data-src="${up}${PAGE_RENDER_FILE}" data-root="${up}"><p>Loading the page scan…</p><noscript><p>The results are drawn in the browser; without JavaScript, read the JSON above.</p></noscript></div>`,
    `<script src="${up}${PAGE_RENDER_SCRIPT}" defer></script>`,
    "",
  ];
}

async function main(): Promise<number> {
  const site = process.argv[2];
  if (!site || site.startsWith("--")) {
    console.error("usage: ig-page-render-qa.ts <built site> [--limit <n>] [--concurrency <n>] [--budget-min <n>]");
    return 2;
  }
  const num = (k: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? Number(process.argv[i + 1]) : undefined;
  };
  const limit = num("limit");
  const concurrency = num("concurrency");
  const budgetMin = num("budget-min");
  const q = await scanSite(site, { ...(limit ? { limit } : {}), ...(concurrency ? { concurrency } : {}), ...(budgetMin ? { budgetMs: budgetMin * 60_000 } : {}) });
  mkdirSync(join(site, "assets", "fhir-qa"), { recursive: true });
  writeFileSync(join(site, PAGE_RENDER_FILE), `${JSON.stringify(q, null, 1)}\n`);
  writeFileSync(join(site, PAGE_RENDER_SCRIPT), PAGE_RENDER_JS);
  console.log(q.unavailable ? `page scan: not run — ${q.unavailable}` : `page scan: ${q.scanned} page(s), ${q.findings.length} finding(s), ${q.unfinished.length} unfinished${q.notReached ? `, ${q.notReached} not reached (time budget)` : ""}`);
  for (const f of q.findings.slice(0, 20)) console.log(`  ${f.page}: ${f.markup.join(", ")} — ${f.excerpt}`);
  return 0;
}

if (import.meta.main) process.exit(await main());
