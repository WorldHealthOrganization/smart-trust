import { describe, expect, test } from "bun:test";
import { darkRules, firstPaintSchemeScript, withSavedScheme } from "../../lib/scheme-css.ts";

/** Issue #2208: one sheet, two deciders — the OS until the reader picks, then the reader. */
describe("darkRules", () => {
  const css = darkRules(":root { --bg: #161616; } ins, del { color: #fff; }");

  test("the OS decides only when the reader has not picked light", () => {
    expect(css).toContain(`@media (prefers-color-scheme: dark) { :root:not([data-fa-scheme="light"]) { --bg: #161616; }`);
    expect(css).toContain(`:root:not([data-fa-scheme="light"]) ins, :root:not([data-fa-scheme="light"]) del { color: #fff; }`);
  });

  test("a reader who picked dark gets it on any OS", () => {
    const outside = css.slice(css.indexOf("} }") + 3);
    expect(outside).toContain(`:root[data-fa-scheme="dark"] { --bg: #161616; }`);
    expect(outside).toContain(`:root[data-fa-scheme="dark"] ins, :root[data-fa-scheme="dark"] del { color: #fff; }`);
  });

  test("the native controls follow the pick too", () => {
    expect(css).toContain(`:root[data-fa-scheme="light"] { color-scheme: light; }`);
    expect(css).toContain(`:root[data-fa-scheme="dark"] { color-scheme: dark; }`);
  });

  test("a nested block is refused, not half-copied", () => {
    expect(() => darkRules("@supports (x: y) { a { color: red; } }")).toThrow(/flat rules only/);
  });
});

/**
 * Owner, 2026-10-15: *"follow os else light"* — the reader's stored choice,
 * then the OS, then LIGHT; and ONE source for that rule. The snippet is run
 * here exactly as `head_custom.html` ships it, against stubbed globals.
 */
describe("the first-paint scheme — stored, else the OS, else light", () => {
  const body = firstPaintSchemeScript().replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  function decide(o: { stored?: string | null; os?: "dark" | "light" | "none" | "absent" | "throws"; site?: string }): string | null {
    const attrs: Record<string, string> = {};
    const document = {
      documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
      getElementById: (id: string) => (id === "fa-site-scheme" && o.site ? { textContent: JSON.stringify({ scheme: o.site }) } : null),
    };
    const localStorage = { getItem: (_k: string) => o.stored ?? null };
    const window: Record<string, unknown> = {};
    if (o.os === "throws") window.matchMedia = () => { throw new Error("no"); };
    else if (o.os !== "absent") window.matchMedia = (q: string) => ({ matches: o.os !== "none" && q === `(prefers-color-scheme: ${o.os})` });
    // input-site: inert #6b2812cd — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    new Function("document", "localStorage", "window", body)(document, localStorage, window);
    return attrs["data-fa-scheme"] ?? null;
  }

  test("a stored choice wins over the OS", () => {
    expect(decide({ stored: "light", os: "dark" })).toBe("light");
    expect(decide({ stored: "dark", os: "light" })).toBe("dark");
  });
  test("nothing stored: the OS decides", () => {
    expect(decide({ os: "dark" })).toBe("dark");
    expect(decide({ os: "light" })).toBe("light");
  });
  test("nothing stored and the OS says nothing: LIGHT", () => {
    expect(decide({ os: "none" })).toBe("light");
    expect(decide({ os: "absent" })).toBe("light");
    expect(decide({ os: "throws" })).toBe("light");
    expect(decide({ stored: "garbage", os: "none" })).toBe("light");
  });
  test("a site that DECLARES dark does not decide the reader's scheme", () => {
    expect(decide({ os: "none", site: "dark" })).toBe("light");
    expect(decide({ os: "light", site: "dark" })).toBe("light");
  });
  test("a standalone page carries the same bytes, marked once", () => {
    const page = withSavedScheme("<!doctype html><html><head><title>x</title></head><body></body></html>");
    const tag = /<script data-folio-saved-scheme>[\s\S]*?<\/script>/.exec(page)?.[0];
    expect(tag).toBe(firstPaintSchemeScript().replace(/^<script/, "<script data-folio-saved-scheme"));
    expect(withSavedScheme(page)).toBe(page);
  });
  test("a page carrying an OUTDATED marked snippet is brought up to the current rule, in place", () => {
    // Measured on the live root, 2026-10-16: slices/search.html shipped the
    // stored-choice-only rule, and the mark made this function a no-op.
    const stale = `<script data-folio-saved-scheme>try{var s=localStorage.getItem("fa-color-scheme");if(s==="light"||s==="dark")document.documentElement.setAttribute("data-fa-scheme",s)}catch(e){}</script>`;
    const page = `<!doctype html><html lang="en"><head>${stale}<meta charset="utf-8"><title>x</title></head><body></body></html>`;
    const current = firstPaintSchemeScript().replace(/^<script/, "<script data-folio-saved-scheme");
    const out = withSavedScheme(page);
    expect(out).toBe(page.replace(stale, current));
    expect(withSavedScheme(out)).toBe(out);
  });
  test("a second marked snippet is dropped, so one rule decides", () => {
    const once = withSavedScheme("<!doctype html><html><head><title>x</title></head><body></body></html>");
    const twice = once.replace("<title>", `<script data-folio-saved-scheme>old()</script><title>`);
    expect(withSavedScheme(twice).match(/data-folio-saved-scheme/g)).toHaveLength(1);
  });
  test("the mark named in prose is not a snippet: the page still gets one", () => {
    const out = withSavedScheme("<!doctype html><html><head><title>x</title></head><body><code>data-folio-saved-scheme</code></body></html>");
    expect(out).toContain(firstPaintSchemeScript().replace(/^<script/, "<script data-folio-saved-scheme"));
  });
  test("a page marked with an OLDER snippet gets the current one, once", () => {
    // The stored-choice-only rule `slices/search.html` still shipped on 2026-10-16.
    const old = `<script data-folio-saved-scheme>try{var s=localStorage.getItem("fa-color-scheme");if(s==="light"||s==="dark")document.documentElement.setAttribute("data-fa-scheme",s)}catch(e){}</script>`;
    const page = withSavedScheme(`<!doctype html><html><head>\n${old}<title>x</title></head><body></body></html>`);
    const tags = [...page.matchAll(/<script data-folio-saved-scheme>[\s\S]*?<\/script>/g)].map((m) => m[0]);
    expect(tags).toEqual([firstPaintSchemeScript().replace(/^<script/, "<script data-folio-saved-scheme")]);
    expect(withSavedScheme(page)).toBe(page);
  });
});
