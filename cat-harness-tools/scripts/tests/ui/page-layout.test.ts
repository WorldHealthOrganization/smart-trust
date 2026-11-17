/**
 * The shared page layout (`page-layout.ts`): one stylesheet and one script
 * every standalone page beside the rail links, instead of a copy per
 * generator. Owner, 2026-10-15: *"please consolidate behaviours/appearance"*.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PAGE_BAR_CLASS,
  PAGE_LAYOUT_CSS_FILE,
  PAGE_LAYOUT_CSS_SOURCE,
  PAGE_LAYOUT_JS_FILE,
  PAGE_LAYOUT_JS_SOURCE,
  PAGE_LAYOUT_MARK,
  PAGE_MAIN_CLASS,
  pageLayoutTags,
  withPageLayout,
  writePageLayout,
} from "../../page-layout.ts";
import { thinPageHtml } from "../../thin-page.ts";

const css = readFileSync(PAGE_LAYOUT_CSS_SOURCE, "utf-8");
const js = readFileSync(PAGE_LAYOUT_JS_SOURCE, "utf-8");
/** The declarations of the first rule whose selector is exactly `sel` (outside any @media unless `inMedia`). */
const rule = (sel: string, src = css): string => new RegExp(`(?:^|[}\\n])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(src)?.[1] ?? "";

describe("page-layout.css", () => {
  it("is full width: the content column has no cap and no centring margin", () => {
    const main = rule(`.${PAGE_MAIN_CLASS}`);
    expect(main).toContain("max-width:none");
    expect(main).toContain("margin:0");
    expect(main).not.toMatch(/margin:[^;]*auto/);
    expect(css).not.toMatch(/max-width:\s*\d+(\.\d+)?rem\s*[;}]/);
  });

  it("makes the bar sticky at the top, as folio-assistant's band is, only where the screen can spare it", () => {
    const wide = /@media \(min-width:50rem\)\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(wide).toContain(`.${PAGE_BAR_CLASS}{position:sticky;top:var(--fa-staging-offset,0px)}`);
    expect(rule(`.${PAGE_BAR_CLASS}`)).not.toContain("position:sticky");
    // The bar is the band the Folio tab sits on, so docs-ui's bare strip is not drawn over it.
    expect(wide).toContain(".fa-glass-band:not([data-fa-band-tools]){display:none!important}");
  });

  it("lands anchors below the stuck bar, from the height the script measures", () => {
    // A margin on the content, never a padding on the root, which would scroll the page whenever a control IN the bar takes focus (docs-ui #2201).
    expect(rule(":root:has(.fa-page-bar)")).toBe("scroll-padding-top:0!important");
    expect(rule(".fa-page-main,.fa-page-main *")).toBe("scroll-margin-top:calc(var(--fa-staging-offset,0px) + var(--fa-page-bar-h,0px) + .5rem)");
    expect(js).toContain('"--fa-page-bar-h"');
    // On a just-the-docs page too (column `.main-content`), over its own shorter `.fa-doc :target{4rem}` (owner, 2026-10-31, dth-pc "Zambia").
    expect(rule(":root:has(.fa-page-bar) :is(.fa-page-main,.main-content) *")).toBe("scroll-margin-top:calc(var(--fa-staging-offset,0px) + var(--fa-page-bar-h,0px) + .5rem)");
  });

  it("styles nothing a page did not opt into but the body's margin", () => {
    // Every selector names the bar, the column, the footer, the root or the body.
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@media[^{]*\{/g, "")
      .split("}")
      .map((r) => r.split("{")[0]!.trim())
      .filter(Boolean);
    for (const s of selectors) expect(s).toMatch(/^(:root|body\b|\.fa-page-|body:has\(\.fa-page-)/);
    expect(rule("body")).toBe("margin:0");
  });

  it("knows nothing of FHIR, an IG or WHO", () => {
    for (const src of [css, js]) expect(src).not.toMatch(/\b(fhir|WHO|smart\.who|implementation guide|\.ig-|\.iga)\b/i);
  });
});

describe("page-layout.js", () => {
  it("runs once, and puts back what a page drawn after load loses: the hash, and the scroll on back or reload", () => {
    expect(js).toContain(`root.hasAttribute("${PAGE_LAYOUT_MARK}")`);
    expect(js).toContain("MutationObserver");
    expect(js).toContain("function rejumpHash()");
    expect(js).toContain('"back_forward"');
    expect(js).toContain('"reload"');
    expect(js).toContain('"pagehide"');
    // It gives way to the reader.
    expect(js).toMatch(/if \(reader \|\|/);
  });

  it("jumps instantly, never with the theme's smooth scroll, which chased a page still drawing (dth-hrh, 2026-10-31)", () => {
    expect(js).toContain('s.scrollBehavior = "auto"');
    // Every jump it makes goes through that.
    expect(js.match(/scrollIntoView\(|scrollTo\(/g)?.length).toBe(js.match(/instantly\(function \(\) \{ (t\.scrollIntoView|window\.scrollTo)\(/g)?.length);
  });

  it("re-places a full-width bar when the rail opens: body's border box, the rail, and the padding transition (owner, 2026-10-15)", () => {
    // A body whose max-width fixes its content box does not resize when the
    // open rail widens its padding, so the content box alone is not enough.
    expect(js).toContain('observe(document.body, { box: "border-box" })');
    expect(js).toMatch(/querySelector\("nav\.fa-nav"\)[\s\S]*new ResizeObserver\(queueBleed\)\.observe\(rail\)/);
    expect(js).toContain('"transitionend"');
  });
});

describe("tags, stamping and writing", () => {
  it("links both files relative to the site root, marked so they are written once", () => {
    expect(pageLayoutTags("../")).toBe(
      `<link rel="stylesheet" href="../${PAGE_LAYOUT_CSS_FILE}" ${PAGE_LAYOUT_MARK}><script src="../${PAGE_LAYOUT_JS_FILE}" defer ${PAGE_LAYOUT_MARK}></script>`,
    );
    const page = "<html><head><title>x</title></head><body></body></html>";
    const once = withPageLayout(page, "");
    expect(once).toContain(`href="${PAGE_LAYOUT_CSS_FILE}"`);
    expect(once.indexOf(PAGE_LAYOUT_MARK)).toBeLessThan(once.indexOf("</head>"));
    expect(withPageLayout(once, "")).toBe(once);
    expect(withPageLayout("<p>no head</p>", "")).toBe("<p>no head</p>");
  });

  it("thinPageHtml links the layout when asked, before the page's own stylesheet, and not otherwise", () => {
    const base = { title: "t", jsonld: "n.jsonld", script: "s.js", configId: "c", config: {}, body: `<main class="${PAGE_MAIN_CLASS}"></main>` };
    expect(thinPageHtml(base)).not.toContain(PAGE_LAYOUT_MARK);
    const html = thinPageHtml({ ...base, layout: "../", stylesheet: "../own.css" });
    expect(html).toContain(`href="../${PAGE_LAYOUT_CSS_FILE}"`);
    expect(html.indexOf(PAGE_LAYOUT_CSS_FILE)).toBeLessThan(html.indexOf("own.css"));
  });

  it("writes the two files, and leaves bytes that already match alone", () => {
    const dir = mkdtempSync(join(tmpdir(), "page-layout-"));
    try {
      expect(writePageLayout(dir)).toEqual([PAGE_LAYOUT_CSS_FILE, PAGE_LAYOUT_JS_FILE]);
      expect(readFileSync(join(dir, PAGE_LAYOUT_CSS_FILE), "utf-8")).toBe(css);
      expect(writePageLayout(dir)).toEqual([]);
      writeFileSync(join(dir, PAGE_LAYOUT_JS_FILE), "stale");
      expect(writePageLayout(dir)).toEqual([PAGE_LAYOUT_JS_FILE]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
