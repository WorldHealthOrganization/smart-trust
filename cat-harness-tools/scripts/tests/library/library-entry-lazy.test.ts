// The entry page's loading (owner, 2026-11-14: "do lazy load content and
// libs"; "audit all of the web viewers to see what can be better lazy loaded
// as both content and libraries"). The shipped script, run against stubs on an
// entry page, as library-title-locale.test.ts runs it.
import { describe, expect, test } from "bun:test";
import { VIEWER_JS } from "../../gen-library-viz.ts";
import { DOCUMENT_VIEW_JS } from "../../lib/library-document.ts";
import { EDIT_LINKS_RUNTIME } from "../../../src/core/edit-links.ts";

type Call = { url: string; cache?: string };

/** Run viewer.js on a page at `path`; the index fetch never answers. */
function boot(path: string, scope = "layer-a", libRoot = "../../") {
  const pageUrl = `https://example.test/site/en/harness/library/${path}`;
  const calls: Call[] = [];
  const fetchStub = (url: string, init?: { cache?: string }) => {
    calls.push({ url: String(url), cache: init?.cache });
    return new Promise(() => {});
  };
  // input-site: inert #6842edec — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  new Function("document", "location", "fetch", "window", "history", VIEWER_JS)(
    {
      getElementById: () => null,
      addEventListener: () => {},
      readyState: "loading",
      querySelector: (sel: string) =>
        sel === ".lib-page"
          ? { dataset: { kgData: `${libRoot}../../../assets/library/index.json`, kgScope: scope, kgLibRoot: libRoot } }
          : null,
    },
    { href: pageUrl, pathname: new URL(pageUrl).pathname, hash: "" },
    fetchStub,
    { addEventListener: () => {} },
    { replaceState: () => {} },
  );
  return calls;
}

describe("an entry page asks for its own document without waiting for the index", () => {
  test("the entry's blocks and document are requested beside index.json, before it answers", () => {
    const calls = boot("layer-a/doc-x/");
    const urls = calls.map((c) => c.url);
    expect(urls).toContain("https://example.test/site/assets/library/index.json");
    expect(urls).toContain("https://example.test/site/assets/library/entries/doc-x.json");
    expect(urls).toContain("https://example.test/site/assets/library/entries/doc-x.doc.json");
    // Each once: the index has not answered, so nothing has asked twice.
    expect(new Set(urls).size).toBe(urls.length);
  });

  test("they are revalidated, not refetched: no-cache, never no-store", () => {
    const entry = boot("layer-a/doc-x/").filter((c) => c.url.includes("/entries/"));
    expect(entry.length).toBe(2);
    for (const c of entry) expect(c.cache).toBe("no-cache");
    expect(VIEWER_JS).not.toMatch(/cache:\s*"no-store"/);
  });

  test("a library page, or an entry of another library, starts nothing early", () => {
    expect(boot("layer-a/", "layer-a", "../").map((c) => c.url)).toEqual(["https://example.test/site/assets/library/index.json"]);
    expect(boot("layer-b/doc-x/").map((c) => c.url)).toEqual(["https://example.test/site/assets/library/index.json"]);
  });
});

describe("the edit-links runtime is the page's, not a second copy in viewer.js", () => {
  test("viewer.js does not inline the runtime", () => {
    // The runtime's own guard line, which only a copy of it carries.
    const guard = EDIT_LINKS_RUNTIME.split("\n").find((l) => l.includes("if (window.faEditLinks) return;"))!;
    expect(guard).toBeDefined();
    expect(VIEWER_JS).not.toContain(guard.trim());
    expect(VIEWER_JS.length).toBeLessThan(EDIT_LINKS_RUNTIME.length * 2);
  });

  // input-site: inert #6842edec — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const make = (win: Record<string, unknown>, doc: Record<string, unknown>) =>
    new Function("window", "document", "SITE_ROOT", "$", "esc", "DATA_HREF", "location",
      `${DOCUMENT_VIEW_JS}\nreturn { withEditLinks };`)(win, doc, "/site/", () => null, (s: string) => s, "", { hash: "" }) as {
      withEditLinks: (fn: (l: unknown) => void) => void;
    };

  test("a document drawn before the deferred runtime runs is filled once it has", async () => {
    const win: Record<string, unknown> = { addEventListener() {} };
    const listeners: Record<string, () => void> = {};
    const doc = { readyState: "loading", addEventListener: (t: string, f: () => void) => { listeners[t] = f; }, head: { appendChild() {} } };
    const seen: unknown[] = [];
    make(win, doc).withEditLinks((l) => seen.push(l));
    expect(seen).toEqual([]);
    const runtime = { configure() {}, fill() {} };
    win.faEditLinks = runtime;   // the deferred edit-links.js has run
    listeners.DOMContentLoaded!();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([runtime]);
  });

  test("on a host whose head has no runtime, it is loaded from the site root", async () => {
    const win: Record<string, unknown> = { addEventListener() {} };
    const added: { src: string; onload?: () => void }[] = [];
    const doc = {
      readyState: "complete",
      addEventListener() {},
      createElement: () => ({ src: "" }),
      head: { appendChild: (s: { src: string; onload?: () => void }) => added.push(s) },
    };
    const seen: unknown[] = [];
    make(win, doc).withEditLinks((l) => seen.push(l));
    expect(added.map((s) => s.src)).toEqual(["/site/assets/js/edit-links.js"]);
    const runtime = { configure() {}, fill() {} };
    win.faEditLinks = runtime;
    added[0]!.onload!();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([runtime]);
  });
});
