/**
 * Diagrams load as they near the viewport, and printing still gets all of
 * them (owner, 2026-11-14: "do lazy load content and libs"; "Make sure
 * printing loads all of the content before it renders the PDF on the
 * browser").
 *
 * `inlineDiagrams` is lifted out of the `docs-ui.js` IIFE and run against
 * stubs, as `search-index-notice.test.ts` runs `searchIndexNotice`; the
 * Mermaid include and `kg-graph.js` are read for the triggers they wire.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

const UI = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf-8");
const MERMAID = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "_includes/components/mermaid.html")), "utf-8");
const KG = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/kg-graph.js")), "utf-8");

/** The lazy-inlining block of docs-ui.js, verbatim. */
function block(): string {
  const from = UI.indexOf("  var INLINE_MARGIN");
  const end = "    return img.faInlined;\n  }\n";
  const to = UI.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error("the lazy-inlining block is not in docs-ui.js");
  return UI.slice(from, to + end.length);
}

type Img = {
  tagName: string;
  attrs: Record<string, string>;
  loading?: string;
  parentNode: { replaceChild: (n: unknown, o: unknown) => void; closest: () => null };
  getAttribute: (k: string) => string | null;
  setAttribute: (k: string, v: string) => void;
  removeAttribute: (k: string) => void;
  hasAttribute: (k: string) => boolean;
  faInlined?: Promise<unknown>;
};

function img(src: string, lazy = true): Img {
  const attrs: Record<string, string> = { src, alt: src };
  const i: Img = {
    tagName: "IMG",
    attrs,
    loading: lazy ? "lazy" : undefined,
    parentNode: { replaceChild: () => { i.attrs["data-replaced"] = "1"; }, closest: () => null },
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    hasAttribute: (k) => k in attrs,
  };
  return i;
}

/** Run the block on a page holding `imgs`; `observer` false is a browser without IntersectionObserver. */
function page(imgs: Img[], observer = true) {
  const fetched: string[] = [];
  const handlers: Record<string, () => void> = {};
  let observe: ((entries: { isIntersecting: boolean; target: Img }[]) => void) | null = null;
  const watched: Img[] = [];
  let mounts = 0;
  const win: Record<string, unknown> = {
    fetch: (src: string) => {
      fetched.push(src);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("<svg/>") });
    },
    DOMParser: function () {
      return { parseFromString: () => ({ documentElement: { nodeName: "svg", setAttribute() {}, querySelectorAll: () => [] } }) };
    },
    addEventListener: (t: string, f: () => void) => { handlers[t] = f; },
    setTimeout: (f: () => void) => { f(); return 1; },
  };
  if (observer) {
    win.IntersectionObserver = function (cb: typeof observe) {
      observe = cb;
      return { observe: (t: Img) => watched.push(t), unobserve() {} };
    };
  }
  const doc = {
    querySelectorAll: (sel: string) => (sel.includes('loading="lazy"') ? imgs.filter((i) => i.loading === "lazy") : imgs),
    importNode: (n: unknown) => n,
  };
  // input-site: inert — runs this layer's own committed chrome, lifted out of its IIFE, against stubs; it reads no environment
  const api = new Function(
    "window", "document", "location", "mountFigures", "scopeSvg", "safeHref", "fitBpmn", "console",
    `${block()}\nreturn { inlineDiagrams: inlineDiagrams, inlineAll: inlineAll, queueLateDrawings: queueLateDrawings };`,
  )(win, doc, { href: "https://example.test/p/" }, () => { mounts++; }, (s: unknown) => s, (h: string) => h, () => {}, { warn() {} }) as {
    inlineDiagrams: (done: () => void) => void;
    queueLateDrawings: () => void;
  };
  let done = 0;
  api.inlineDiagrams(() => { done++; });
  const flush = async () => { for (let k = 0; k < 10; k++) await Promise.resolve(); };
  return {
    fetched, handlers, watched, win, flush, api,
    get done() { return done; },
    get mounts() { return mounts; },
    see: (i: Img) => observe!([{ isIntersecting: true, target: i }]),
  };
}

describe("diagrams are inlined as they near the viewport", () => {
  test("nothing is fetched at load, and the figures are mounted at once", () => {
    const imgs = [img("a.svg"), img("b.svg"), img("c.svg")];
    const p = page(imgs);
    expect(p.fetched).toEqual([]);
    expect(p.done).toBe(1);
    expect(p.watched).toEqual(imgs);
    for (const i of imgs) expect(i.hasAttribute("data-fa-inline-pending")).toBe(true);
  });

  test("a drawing is fetched when it nears the viewport, once, and its figure is mounted then", async () => {
    const imgs = [img("a.svg"), img("b.svg")];
    const p = page(imgs);
    p.see(imgs[1]!);
    p.see(imgs[1]!);
    await p.flush();
    expect(p.fetched).toEqual(["b.svg"]);
    expect(imgs[1]!.hasAttribute("data-fa-inline-pending")).toBe(false);
    expect(imgs[0]!.hasAttribute("data-fa-inline-pending")).toBe(true);
    expect(p.mounts).toBeGreaterThan(0);
  });

  test("without IntersectionObserver every drawing is inlined at load, as before", async () => {
    const imgs = [img("a.svg"), img("b.svg")];
    const p = page(imgs, false);
    await p.flush();
    expect(p.fetched.sort()).toEqual(["a.svg", "b.svg"]);
  });

  test("a drawing added after load is queued too, once, and a drawing already tried is left alone", async () => {
    const imgs = [img("a.svg")];
    const p = page(imgs);
    p.see(imgs[0]!);
    await p.flush();
    // A whole-document page fills a block: its drawing arrives after load.
    const late = img("late.svg");
    imgs.push(late);
    p.api.queueLateDrawings();
    p.api.queueLateDrawings();
    expect(late.hasAttribute("data-fa-inline-pending")).toBe(true);
    expect(p.watched.filter((i) => i === late).length).toBe(1);
    expect(p.watched.filter((i) => i === imgs[0]).length).toBe(1);
    p.see(late);
    await p.flush();
    expect(p.fetched).toEqual(["a.svg", "late.svg"]);
    expect(UI).toContain("  function mountFigures() {\n    queueLateDrawings();");
  });
});

describe("printing gets every drawing", () => {
  test("beforeprint turns lazy images eager and inlines every drawing still waiting", async () => {
    const imgs = [img("a.svg"), img("b.svg"), img("c.svg")];
    const p = page(imgs);
    p.see(imgs[0]!);
    await p.flush();
    p.handlers.beforeprint!();
    await p.flush();
    for (const i of imgs) expect(i.loading).toBe("eager");
    expect(p.fetched.sort()).toEqual(["a.svg", "b.svg", "c.svg"]);
    for (const i of imgs) expect(i.hasAttribute("data-fa-inline-pending")).toBe(false);
  });

  test("a Print button can wait: faInlineAllDiagrams resolves once all are in", async () => {
    const imgs = [img("a.svg"), img("b.svg")];
    const p = page(imgs);
    await (p.win.faInlineAllDiagrams as () => Promise<unknown>)();
    expect(imgs.every((i) => i.attrs["data-replaced"] === "1")).toBe(true);
  });

  test("mountFigures leaves a drawing still waiting for its inlining", () => {
    expect(UI).toContain('if (node.hasAttribute("data-fa-inline-pending")) return;');
    expect(UI).toContain('if (f.querySelector("[data-fa-inline-pending]")) return;');
  });
});

describe("Mermaid and Graphviz are drawn nearest first, and all before printing", () => {
  test("Mermaid: per diagram through an IntersectionObserver, the rest on idle and on beforeprint, with a preconnect", () => {
    const body = MERMAID.slice(MERMAID.indexOf("{%- if content contains 'language-mermaid' -%}"));
    expect(body).toContain('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>');
    expect(body).toContain("new window.IntersectionObserver(");
    expect(body).toContain("mermaid.run({ nodes: todo })");
    expect(body).toContain("window.requestIdleCallback(rest");
    expect(body).toContain("window.addEventListener('beforeprint', function () { draw(all); });");
    expect(body).toContain("window.faRenderAllMermaid");
    // A diagram drawn late tells docs-ui.js, which mounts its controls.
    expect(body).toContain("new Event('fa:figures-changed')");
    expect(UI).toContain('document.addEventListener("fa:figures-changed", remountSoon);');
  });

  test("Graphviz: shown graphs mount as they near the viewport, the rest on idle and on beforeprint", () => {
    expect(KG).toContain("new IntersectionObserver(");
    expect(KG).toContain('window.addEventListener("beforeprint", () => { mountAllShown(); });');
    expect(KG).toContain("requestIdleCallback(() => mountAllShown()");
    expect(KG).toContain("window.faMountAllGraphs = mountAllShown;");
  });
});
