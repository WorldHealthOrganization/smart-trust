import { describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MARKER, VIEWER_PATH, VIEWER_REV, embed, isVendoredViewer, openShim, patchViewerHtml } from "../../pdf-viewer.ts";
import { run as stageBanner } from "../../staging-banner.ts";

/**
 * The inline PDF viewer's two halves. Bean `folio-assistant-5ea6`.
 *
 * Runs the SHIPPED bytes: the shim is evaluated against a stub of the two
 * pdf.js globals it touches, and the embed's client against a stub frame, so
 * the allowlist and the root derivation are tested as they run, not as a copy
 * of the rule. The browser half — that pdf.js itself opens the document,
 * searches, jumps and prints — was checked in Chromium when this landed; the
 * notes are on the bean.
 */

const WHO_IRIS = /^(.*?)(?:docs\/)?who-iris\//;
const CDN = "https://cdn.jsdelivr.net/gh/acme/";

/** Evaluate the shim with `src` and return what it asked pdf.js to open, or the refusal. */
async function runShim(src: string | null, opts: { sameOriginParent?: boolean; fails?: string } = {}) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const parentListeners: Record<string, ((e: unknown) => void)[]> = {};
  const opened: string[] = [];
  const refused: string[] = [];
  const set: Record<string, unknown> = {};
  const win: Record<string, unknown> = {};
  const container = { prepend: (p: { textContent: string }) => refused.push(p.textContent) };
  const doc = {
    addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] ??= []).push(f),
    getElementById: () => container,
    createElement: () => ({ setAttribute() {}, style: {}, textContent: "" }),
    body: container,
  };
  const parent = opts.sameOriginParent
    ? { document: { addEventListener: (t: string, f: (e: unknown) => void) => (parentListeners[t] ??= []).push(f) } }
    : win;
  const location = { search: src === null ? "" : `?src=${encodeURIComponent(src)}`, href: "https://site.example/assets/vendor/pdfjs/web/viewer.html", origin: "https://site.example" };
  win.PDFViewerApplicationOptions = { set: (k: string, v: unknown) => (set[k] = v) };
  win.PDFViewerApplication = { initializedPromise: Promise.resolve(), open: (o: { url: string }) => (opened.push(o.url), opts.fails ? Promise.reject(new Error(opts.fails)) : Promise.resolve()) };
  // input-site: inert #b56f3cef — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  new Function("window", "document", "location", "parent", openShim([CDN]))(win, doc, location, parent);
  const fire = opts.sameOriginParent ? parentListeners : listeners;
  for (const f of fire["webviewerloaded"] ?? []) f({ detail: { source: win } });
  for (let i = 0; i < 4; i++) await Promise.resolve();
  return { opened, refused, set };
}

describe("openShim", () => {
  test("opens an allowlisted CDN document and clears the sample", async () => {
    const r = await runShim(`${CDN}repo@main/x.pdf`);
    expect(r.opened).toEqual([`${CDN}repo@main/x.pdf`]);
    expect(r.set.defaultUrl).toBe("");
  });

  test("opens a same-origin document without an allowlist entry", async () => {
    expect((await runShim("/docs/a.pdf")).opened).toEqual(["https://site.example/docs/a.pdf"]);
  });

  test("refuses any other origin, on screen, and opens nothing", async () => {
    const r = await runShim("https://evil.example/x.pdf");
    expect(r.opened).toEqual([]);
    expect(r.refused[0]).toContain("Refused: https://evil.example/x.pdf");
  });

  test("a prefix is a prefix, not a substring: the owner's name inside a path is not the owner", async () => {
    expect((await runShim("https://evil.example/cdn.jsdelivr.net/gh/acme/x.pdf")).opened).toEqual([]);
  });

  test("listens on the parent document too — where pdf.js dispatches when framed same-origin", async () => {
    expect((await runShim(`${CDN}r/x.pdf`, { sameOriginParent: true })).opened).toEqual([`${CDN}r/x.pdf`]);
  });

  test("a document that fails to load is SAID on screen, with its address, not left as an empty viewer", async () => {
    // who-iris, 2026-10-15: a CDN 403 showed "0 of 0" and nothing else.
    const r = await runShim(`${CDN}r/x.pdf`, { fails: "Unexpected server response (403)" });
    expect(r.opened).toEqual([`${CDN}r/x.pdf`]);
    expect(r.refused[0]).toContain("could not be loaded (Unexpected server response (403))");
    expect(r.refused[0]).toContain(`${CDN}r/x.pdf`);
  });

  test("no ?src= opens nothing and refuses nothing", async () => {
    const r = await runShim(null);
    expect(r.opened).toEqual([]);
    expect(r.refused).toEqual([]);
  });
});

describe("embed", () => {
  /** Run the embed's inlined client at a pathname; return the frame's src once it scrolls into view. */
  function frameSrcAt(pathname: string, html: string, lastModified?: string): { src?: string; srcdoc?: string } {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    const attrs = Object.fromEntries([...html.matchAll(/data-(src|hash)="([^"]*)"/g)].map((m) => [m[1], m[2]!.replace(/&amp;/g, "&")]));
    const frame: { src?: string; srcdoc?: string; getAttribute: (k: string) => string } = {
      getAttribute: (k) => attrs[k.replace("data-", "")]!,
    };
    let cb: ((es: { isIntersecting: boolean }[]) => void) | undefined;
    class IO {
      constructor(f: typeof cb) {
        cb = f;
      }
      observe() {}
      disconnect() {}
    }
    const win = { IntersectionObserver: IO };
    const document = { currentScript: { parentNode: { querySelector: () => frame } }, lastModified };
    // input-site: inert #04e02a06 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    new Function("window", "document", "location", "IntersectionObserver", script)(win, document, { pathname }, IO);
    expect(frame.src).toBeUndefined(); // lazy: nothing until it is in view
    cb?.([{ isIntersecting: true }]);
    return frame;
  }

  const html = embed({ src: `${CDN}r@main/a b.pdf`, title: "A <title>", route: WHO_IRIS, page: 3 });

  test("carries the marker, the title and both plain links", () => {
    expect(html).toContain(MARKER);
    expect(html).toContain('title="A &lt;title&gt; (PDF viewer)"');
    expect(html).toContain(`href="${CDN}r@main/a b.pdf" download`);
  });

  test.each([
    ["/who-iris/item-x.html", "/"],
    ["/folio-assistant/who-iris/item-x.html", "/folio-assistant/"],
    ["/STAGING/my-branch/who-iris/item-x.html", "/STAGING/my-branch/"],
  ] as const)("at %s the frame opens the viewer under %s, on page 3", (path, root) => {
    expect(frameSrcAt(path, html).src).toBe(
      `${root}${VIEWER_PATH}?src=${encodeURIComponent(`${CDN}r@main/a b.pdf`)}&v=${VIEWER_REV}.0#page=3`,
    );
  });

  test("the frame's address changes with each deploy of the page around it, so a cache cannot serve last deploy's viewer", () => {
    // Owner, 2026-10-04: a hard reload still showed the pre-fix frame.
    const a = frameSrcAt("/who-iris/x.html", html, "10/04/2026 19:44:12").src!;
    const b = frameSrcAt("/who-iris/x.html", html, "10/04/2026 19:55:56").src!;
    expect(a).not.toBe(b);
    expect(a).toContain(`&v=${VIEWER_REV}.`);
    expect(a.endsWith("#page=3")).toBe(true); // the tag goes in the query, never after the fragment
  });

  test("the viewer's own shim is fetched under its revision", () => {
    const out = patchViewerHtml(`<head><script src="../build/pdf.mjs" type="module"></script></head>`);
    expect(out).toContain(`folio-open.js?v=${VIEWER_REV}`);
    expect(VIEWER_REV).toMatch(/^[0-9a-f]{10}$/);
  });

  test("a page off the route says so in the frame instead of loading a 404", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    const frame: { src?: string; srcdoc?: string; getAttribute: () => string } = { getAttribute: () => "" };
    const document = { currentScript: { parentNode: { querySelector: () => frame } } };
    // input-site: inert #578629d3 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    new Function("window", "document", "location", script)({}, document, { pathname: "/elsewhere/x.html" });
    expect(frame.src).toBeUndefined();
    expect(frame.srcdoc).toContain("could not find this site's root");
  });
});

describe("embed inside a closed <details> (owner, 2026-10-16: load the viewer only when the panel opens)", () => {
  const html = embed({ src: "https://raw/a.pdf", title: "A", route: { viewer: "../../assets/vendor/pdfjs/web/viewer.html" } });
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;

  function run(open: boolean) {
    let toggle: (() => void) | undefined;
    const details = { open, addEventListener: (_t: string, h: () => void) => (toggle = h), removeEventListener: () => (toggle = undefined) };
    const frame: { src?: string; getAttribute: (a: string) => string; closest: () => typeof details } = {
      getAttribute: (a) => (a === "data-src" ? "https://raw/a.pdf" : ""),
      closest: () => details,
    };
    let observed = false;
    class IO {
      observe() {
        observed = true;
      }
      disconnect() {}
    }
    const document = { currentScript: { parentNode: { querySelector: () => frame } }, lastModified: "" };
    // input-site: inert #0160cb8c — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    new Function("window", "document", "location", "IntersectionObserver", script)({ IntersectionObserver: IO }, document, { pathname: "/x/" }, IO);
    return { frame, details, observed, open: () => { details.open = true; toggle?.(); } };
  }

  test("closed: nothing is fetched until the panel is opened, then the page-relative viewer", () => {
    const r = run(false);
    expect(r.frame.src).toBeUndefined();
    expect(r.observed).toBe(false);
    r.open();
    expect(r.frame.src).toBe(`../../assets/vendor/pdfjs/web/viewer.html?src=${encodeURIComponent("https://raw/a.pdf")}&v=${VIEWER_REV}.0`);
  });

  test("open: the in-view observer, as before", () => {
    expect(run(true).observed).toBe(true);
  });
});

describe("install helpers", () => {
  test("the shim is loaded before pdf.js's own modules", () => {
    const out = patchViewerHtml(`<head><script src="../build/pdf.mjs" type="module"></script></head>`);
    expect(out.indexOf("folio-open.js")).toBeLessThan(out.indexOf("pdf.mjs"));
  });

  test("a release whose viewer.html moved the anchor is refused, not shipped half-wired", () => {
    expect(() => patchViewerHtml("<head></head>")).toThrow(/re-measure/);
  });

  test("only the installed viewer is vendored", () => {
    expect(isVendoredViewer("assets/vendor/pdfjs/web/viewer.html")).toBe(true);
    expect(isVendoredViewer("who-iris/item-x.html")).toBe(false);
    expect(isVendoredViewer("assets/vendor/pdfjs-other/x.html")).toBe(false);
  });
});

describe("the site's page-wide passes leave the framed viewer alone", () => {
  test("the staging banner goes on our page and not inside the PDF frame", () => {
    // Measured on the first staging preview, 2026-10-04: a second
    // "FEATURE BRANCH" banner rendered inside the frame, above pdf.js's toolbar.
    const site = mkdtempSync(join(tmpdir(), "pdfv-"));
    const put = (rel: string) => {
      mkdirSync(join(site, rel, ".."), { recursive: true });
      writeFileSync(join(site, rel), "<!doctype html><html><head></head><body><p>x</p></body></html>");
    };
    put("who-iris/item.html");
    put(VIEWER_PATH);
    const r = stageBanner(site, {} as Parameters<typeof stageBanner>[1]);
    expect(r.injected).toBe(1);
    expect(readFileSync(join(site, "who-iris/item.html"), "utf8")).toContain("data-fa-staging-banner");
    expect(readFileSync(join(site, VIEWER_PATH), "utf8")).not.toContain("data-fa-staging-banner");
  });
});
