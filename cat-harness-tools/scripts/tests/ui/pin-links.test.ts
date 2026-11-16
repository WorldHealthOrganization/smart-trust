/**
 * Links to a layer at its pin, resolved in the browser (bean `fwtz`,
 * "Shrinking the cone itself").
 *
 * Calibrated: matching any 40-hex ref in `unpinHtml` fails "a link at another
 * commit stays"; dropping the `HEAD` swap from PIN_LINKS_JS fails "the browser
 * script and pinnedHref agree".
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { PIN_LINKS_JS, PINS_FILE, PIN_SCRIPT, type Pin, pinnedHref, pinsJson, scriptTag, unpinHtml, unpinSite } from "../../lib/pin-links.ts";

const CORE = "ebff26c3110fe06bfa6100ec68c89ab43079b027";
const SELF = "6a47cb22609a56ffb0bfc5b5d02e8dad55c1dbc2";
const OTHER = "41aad5c88e76b00790bba0347f47f2465c4df92a";
const PINS: Pin[] = [
  { path: "folio-assistant-core", repository: "litlfred/folio-assistant-core", ref: CORE },
  { path: "", repository: "litlfred/folio-assistant", ref: SELF },
];

function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pin-links-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

describe("unpinHtml", () => {
  it("makes a link at a pin pin-free and names its mount", () => {
    const r = unpinHtml(`<a href="https://github.com/litlfred/folio-assistant-core/blob/${CORE}/docs/x.md#s">x</a>`, PINS);
    expect(r.count).toBe(1);
    expect(r.html).toBe('<a href="https://github.com/litlfred/folio-assistant-core/blob/HEAD/docs/x.md#s" data-fa-pin="folio-assistant-core">x</a>');
  });

  it("handles the checkout's own commit, tree URLs and src", () => {
    const r = unpinHtml(`<a href="https://github.com/litlfred/folio-assistant/tree/${SELF}/skills/">t</a><img src="https://github.com/litlfred/folio-assistant/blob/${SELF}/a.svg">`, PINS);
    expect(r.count).toBe(2);
    expect(r.html).toContain('href="https://github.com/litlfred/folio-assistant/tree/HEAD/skills/" data-fa-pin="."');
    expect(r.html).toContain('src="https://github.com/litlfred/folio-assistant/blob/HEAD/a.svg" data-fa-pin="."');
  });

  it("a link at another commit stays, and so does a pin's commit in another repository", () => {
    const html = `<a href="https://github.com/litlfred/folio-assistant-core/blob/${OTHER}/x.md">a</a><a href="https://github.com/litlfred/cat-harness/blob/${CORE}/x.md">b</a>`;
    expect(unpinHtml(html, PINS)).toEqual({ html, count: 0 });
  });

  it("is idempotent", () => {
    const once = unpinHtml(`<a href="https://github.com/litlfred/folio-assistant-core/blob/${CORE}/x.md">x</a>`, PINS).html;
    expect(unpinHtml(once, PINS)).toEqual({ html: once, count: 0 });
  });
});

describe("the browser side", () => {
  it("pinnedHref puts the pin back, and leaves an unknown key alone", () => {
    const pins = pinsJson(PINS);
    expect(pins).toEqual({ ".": SELF, "folio-assistant-core": CORE });
    expect(pinnedHref("https://github.com/litlfred/folio-assistant-core/blob/HEAD/x.md", "folio-assistant-core", pins)).toBe(`https://github.com/litlfred/folio-assistant-core/blob/${CORE}/x.md`);
    expect(pinnedHref("https://github.com/litlfred/x/blob/HEAD/x.md", "nope", pins)).toBe("https://github.com/litlfred/x/blob/HEAD/x.md");
  });

  it("the browser script and pinnedHref agree", () => {
    // input-site: inert #73305a71 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    const faPinnedHref = new Function("document", `${PIN_LINKS_JS}\nreturn faPinnedHref;`)(undefined) as typeof pinnedHref;
    const pins = pinsJson(PINS);
    for (const [href, key] of [
      ["https://github.com/litlfred/folio-assistant-core/blob/HEAD/docs/x.md#s", "folio-assistant-core"],
      ["https://github.com/litlfred/folio-assistant/tree/HEAD/skills/", "."],
      ["https://github.com/litlfred/folio-assistant/blob/HEADER/x", "."],
      ["https://github.com/litlfred/x/blob/HEAD/x.md", "nope"],
    ] as const) {
      expect(faPinnedHref(href, key, pins)).toBe(pinnedHref(href, key, pins));
    }
    expect(faPinnedHref("https://github.com/litlfred/folio-assistant/blob/HEAD/x", ".", pins)).toContain(SELF);
  });

  it("the script tag is relative, so a staging preview reads its own pins", () => {
    expect(scriptTag("index.html")).toBe(`<script src="${PIN_SCRIPT}" data-fa-pins="${PINS_FILE}" defer></script>`);
    expect(scriptTag("docs/cat-harness/start/es/x.html")).toContain('src="../../../../assets/js/fa-pin-links.js" data-fa-pins="../../../../pins.json"');
  });
});

describe("unpinSite", () => {
  it("rewrites the pages, adds the script once, and writes pins.json and the script", () => {
    const root = site({
      "docs/a.html": `<html><body><a href="https://github.com/litlfred/folio-assistant-core/blob/${CORE}/x.md">x</a></body></html>`,
      "b.html": "<html><body>nothing pinned</body></html>",
    });
    const r = unpinSite(root, ["docs/a.html", "b.html"], PINS);
    expect(r).toEqual({ pages: 1, links: 1 });
    const a = readFileSync(join(root, "docs/a.html"), "utf-8");
    expect(a).toContain('data-fa-pin="folio-assistant-core"');
    expect(a.match(/data-fa-pins=/g)?.length).toBe(1);
    expect(a.indexOf("<script")).toBeLessThan(a.indexOf("</body>"));
    expect(readFileSync(join(root, "b.html"), "utf-8")).toBe("<html><body>nothing pinned</body></html>");
    expect(JSON.parse(readFileSync(join(root, PINS_FILE), "utf-8"))).toEqual(pinsJson(PINS));
    expect(readFileSync(join(root, PIN_SCRIPT), "utf-8")).toBe(PIN_LINKS_JS);
    // A second pass changes nothing.
    expect(unpinSite(root, ["docs/a.html", "b.html"], PINS)).toEqual({ pages: 0, links: 0 });
  });

  it("a re-pin leaves the page bytes the same and changes pins.json only", () => {
    const page = (ref: string) => `<html><body><a href="https://github.com/litlfred/folio-assistant-core/blob/${ref}/x.md">x</a></body></html>`;
    const before = site({ "a.html": page(CORE) });
    const after = site({ "a.html": page(OTHER) });
    unpinSite(before, ["a.html"], PINS);
    unpinSite(after, ["a.html"], [{ ...PINS[0]!, ref: OTHER }, PINS[1]!]);
    expect(readFileSync(join(after, "a.html"), "utf-8")).toBe(readFileSync(join(before, "a.html"), "utf-8"));
    expect(readFileSync(join(after, PINS_FILE), "utf-8")).not.toBe(readFileSync(join(before, PINS_FILE), "utf-8"));
  });

  it("writes no file when no page carries a pinned link", () => {
    const root = site({ "a.html": "<a href='x'>x</a>" });
    expect(unpinSite(root, ["a.html"], PINS)).toEqual({ pages: 0, links: 0 });
    expect(existsSync(join(root, PINS_FILE))).toBe(false);
  });
});
