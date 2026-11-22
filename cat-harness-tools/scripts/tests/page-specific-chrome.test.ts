/**
 * Page-specific chrome loads only where it is used (owner, 2026-11-14: "do
 * lazy load content and libs"; "audit all of the web viewers to see what can
 * be better lazy loaded as both content and libraries").
 *
 * - `work-plan.css`, `work-plan.js` and `process-index.js` are emitted only on
 *   a page whose content carries their container.
 * - The QR encoder is not in the head: `navbar-row.js` loads it the first
 *   time a code is shown, once, for its own row and for the `docs-ui.js` tile.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

const HEAD = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "_includes/head_custom.html")), "utf-8");
const NAVBAR_ROW = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/navbar-row.js")), "utf-8");
const DOCS_UI = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf-8");
const DOCS_UI_CSS = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/css/docs-ui.css")), "utf-8");

/** The `content contains` condition a tag sits inside, or null when it is unconditional. */
function guardOf(tag: string): string | null {
  const at = HEAD.indexOf(tag);
  if (at < 0) throw new Error(`not in head_custom.html: ${tag}`);
  const before = HEAD.slice(0, at);
  const open = before.lastIndexOf("{%- if content contains");
  if (open < 0) return null;
  // An endif between the opening and the tag closes the block first.
  if (/\{%-?\s*endif/.test(before.slice(open))) return null;
  const m = /\{%- if content contains '([^']+)'/.exec(before.slice(open));
  return m ? m[1]! : null;
}

describe("page-specific scripts and styles", () => {
  test("the work-plan dashboard's stylesheet and script are emitted only where its container is", () => {
    expect(guardOf("/assets/css/work-plan.css")).toBe("data-fa-workplan");
    expect(guardOf("/assets/js/work-plan.js")).toBe("data-fa-workplan");
  });

  test("the process index's script is emitted only where its container is", () => {
    expect(guardOf("/assets/js/process-index.js")).toBe("data-fa-process-index");
  });

  test("the chrome every page needs is still unconditional", () => {
    for (const t of ["/assets/js/docs-ui.js", "/assets/js/navbar-row.js", "/assets/js/edit-links.js", "/assets/css/docs-ui.css"]) {
      expect(guardOf(t)).toBeNull();
    }
  });

  test("the QR encoder is not loaded by the head", () => {
    expect(HEAD).not.toMatch(/<script[^>]+vendor\/qrcode/);
  });
});

/** Run navbar-row.js against a stub page; it mounts nothing, but defines its loader. */
function loadNavbarRow() {
  const added: { src: string; onload?: () => void; onerror?: () => void }[] = [];
  const win: Record<string, unknown> = { addEventListener() {} };
  const doc = {
    readyState: "loading",
    currentScript: null,
    documentElement: { setAttribute() {} },
    addEventListener() {},
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ src: "" }),
    head: { appendChild: (s: { src: string }) => added.push(s as never) },
  };
  // input-site: inert — runs this layer's own committed chrome against stubs; it reads no environment
  new Function("window", "document", "location", NAVBAR_ROW)(win, doc, { href: "https://example.test/site/page/", origin: "https://example.test" });
  return { win, added, ensure: win.faEnsureQrcode as (cb: () => void, onFail?: () => void) => void };
}

describe("the QR encoder is loaded on first use, once", () => {
  test("two callers before it arrives share one load, and both are called", () => {
    const { win, added, ensure } = loadNavbarRow();
    expect(typeof ensure).toBe("function");
    const calls: string[] = [];
    ensure(() => calls.push("row"));
    ensure(() => calls.push("tile"));
    expect(added.map((s) => s.src)).toEqual(["/assets/js/vendor/qrcode.js"]);
    added[0]!.onload!();
    expect(added.map((s) => s.src)).toEqual(["/assets/js/vendor/qrcode.js", "/assets/js/vendor/qrcode_UTF8.js"]);
    (globalThis as Record<string, unknown>).qrcode = () => ({});
    try {
      added[1]!.onload!();
      expect(calls).toEqual(["row", "tile"]);
      ensure(() => calls.push("again"));   // already there: no new script
      expect(calls).toEqual(["row", "tile", "again"]);
      expect(added.length).toBe(2);
    } finally {
      delete (globalThis as Record<string, unknown>).qrcode;
    }
    void win;
  });

  test("a failed load calls the failure callbacks, and a later call tries again", () => {
    const { added, ensure } = loadNavbarRow();
    const fails: string[] = [];
    ensure(() => fails.push("ok?"), () => fails.push("failed"));
    added[0]!.onerror!();
    expect(fails).toEqual(["failed"]);
    ensure(() => {});
    expect(added.length).toBe(2);
  });

  test("docs-ui.js always offers the QR tile and asks the shared loader when it opens", () => {
    expect(DOCS_UI).toContain('grid.appendChild(tileButton(GLYPH, "QR code", "qr"));');
    expect(DOCS_UI).not.toMatch(/if \(typeof qrcode === "function"\) \{\s*grid\.appendChild/);
    expect(DOCS_UI).toContain("window.faEnsureQrcode");
  });

  test("print: the QR code is not printed, so loading it on demand leaves nothing out of a printout", () => {
    // Owner, 2026-11-14: "Make sure printing loads all of the content before
    // it renders the PDF". The QR tile and the row both live in the sidebar,
    // which the print stylesheet removes; the page-specific scripts above load
    // eagerly on the pages that use them, as before.
    expect(DOCS_UI_CSS).toMatch(/@media print\s*\{\s*\.side-bar\s*\{\s*display:\s*none;?\s*\}/);
  });
});
