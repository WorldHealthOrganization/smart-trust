/**
 * THE RAIL'S CONTROLS AT ITS FOOT and the open folder in its header —
 * owner, 2026-11-13:
 *
 * - *"put these controls at the bottom of the navbar ... remove the harnesses
 *   navbar, instead add an icon to the controls to show the harnesses."*
 * - the open FOLDER under the layer's name: the site's name over "Library".
 *
 * The browser half (the row moved to the foot, the icon adopted into it, the
 * panel opening) is `test/rail-icon-row.e2e.ts`.
 */
import { describe, expect, it } from "bun:test";

import { railModel, railSharedJson, renderRailRegions } from "../../lib/harness-rail.ts";
import { NAV_CONTROL_ATTR, folderOfPage, navbarCss, navbarRegionsHtml, wireNavFolds } from "../../lib/navbar.ts";

const LINKS = [
  { href: "../../../en/cat-harness/library/folio-x/", label: "Library", description: "L1 source content" },
  { href: "../../../en/cat-harness/schemas/folio-x/", label: "Schemas" },
  { href: "../../../en/cat-harness/themes/", label: "Themes" },
  { href: "../../../folio-x/catalogue/", label: "Catalogue" },
];
const OPTS = {
  instance: "folio-x",
  toRoot: "../../..",
  links: LINKS,
  harnesses: [{ href: "../../../cat-harness/", label: "C@T Harness" }],
};

describe("the Harnesses icon replaces the Harnesses disclosure", () => {
  const html = navbarRegionsHtml(railModel(OPTS));

  it("draws no Harnesses <details>, and a panel in the bottom region", () => {
    expect(html).not.toMatch(/<summary>(?:(?!<\/summary>)[\s\S])*>Harnesses</);
    const bottom = html.slice(html.indexOf('<div class="fa-nav-bottom">'));
    expect(bottom).toContain('<div class="fa-nav-pop" id="fa-nav-harnesses" role="region" aria-label="Harnesses" hidden>');
    expect(bottom).toContain('href="../../../cat-harness/"');
  });

  it("the icon is a button, named and tipped alike, that controls the panel and is marked for the row", () => {
    const b = /<button type="button" class="fa-nav-icon fa-nav-harnesses"[^>]*>/.exec(html)?.[0] ?? "";
    expect(b).toContain(NAV_CONTROL_ATTR);
    expect(b).toContain('aria-controls="fa-nav-harnesses"');
    expect(b).toContain('aria-expanded="false"');
    expect(b).toContain('aria-label="Harnesses" data-fa-tip="Harnesses"');
  });

  it("no harnesses, no icon and no panel", () => {
    const none = navbarRegionsHtml(railModel({ ...OPTS, harnesses: undefined }));
    expect(none).not.toContain("fa-nav-harnesses");
    expect(none).not.toContain("fa-nav-bottom");
  });

  it("the icon opens and closes its panel, pinning the rail only while it pinned it", () => {
    // A minimal document: the rail's checkbox, the button and its panel.
    const listeners: Record<string, ((e: unknown) => void)[]> = {};
    const attrs = (init: Record<string, string>) => {
      const a = { ...init };
      return {
        getAttribute: (k: string) => (k in a ? a[k]! : null),
        setAttribute: (k: string, v: string) => void (a[k] = v),
        removeAttribute: (k: string) => void delete a[k],
        hasAttribute: (k: string) => k in a,
        a,
      };
    };
    const panel = attrs({ hidden: "" });
    const box = { checked: false, dispatchEvent: () => true };
    const button = { ...attrs({ "aria-controls": "p", "aria-expanded": "false" }), focus: () => {}, closest: (s: string) => (s.includes("data-fa-nav-pop") ? button : null) };
    const doc = {
      addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] ??= []).push(f),
      getElementById: (id: string) => (id === "p" ? panel : id === "fa-nav-open" ? box : null),
      querySelector: () => (button.getAttribute("aria-expanded") === "true" ? button : null),
    };
    (globalThis as { Event?: unknown }).Event ??= class { constructor(public type: string) {} };
    wireNavFolds(doc as unknown as Document);
    const click = () => listeners.click!.forEach((f) => f({ target: button }));
    click();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(box.checked).toBe(true);
    listeners.keydown!.forEach((f) => f({ key: "Escape" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(box.checked).toBe(false);
    // A rail the reader pinned stays pinned when the panel closes.
    box.checked = true;
    click();
    click();
    expect(box.checked).toBe(true);
  });

  it("the stylesheet hides the emptied bottom and keeps the panel's hidden state", () => {
    const css = navbarCss();
    expect(css).toContain(".fa-nav-pop[hidden]{display:none}");
    expect(css).toContain(".fa-nav-controls:empty{display:none}");
  });
});

describe("the header's second line is the page's folder", () => {
  it("matches a folder's own page, a page beneath it, and its all-layers page", () => {
    const at = (here: string) => folderOfPage(LINKS, [`../../..${here}`], "folio-x")?.label;
    expect(at("/en/cat-harness/library/folio-x/")).toBe("Library");
    expect(at("/en/cat-harness/library/folio-x/some-doc/")).toBe("Library");
    // `schemas/folio-x/` routes `schemas/`: the all-layers schema page is in it.
    expect(at("/en/cat-harness/schemas/")).toBe("Schemas");
    expect(at("/en/cat-harness/themes/x/")).toBe("Themes");
    expect(at("/folio-x/catalogue/")).toBe("Catalogue");
  });

  it("names no folder for the home page or a page in none", () => {
    const at = (here: string) => folderOfPage(LINKS, [`../../..${here}`], "folio-x");
    expect(at("/")).toBeUndefined();
    expect(at("/en/")).toBeUndefined();
    expect(at("/en/cat-harness/tools/x/")).toBeUndefined();
  });

  it("a locale root or the site root is never a folder's route", () => {
    const wide = [{ href: "../en/", label: "English" }, { href: "../", label: "Home" }];
    expect(folderOfPage(wide, ["../en/cat-harness/library/"], "folio-x")).toBeUndefined();
  });

  it("is drawn under the name from shared data, and the bare name elsewhere", () => {
    const shared = railSharedJson(OPTS, "../../..");
    const page = (here: string) => renderRailRegions(shared, { data: "x", toRoot: "../../..", root: "../../..", here });
    const lib = page("/en/cat-harness/library/folio-x/");
    expect(lib).toContain('<span class="fa-nav-titles"><span class="fa-nav-name fa-nav-label">folio-x</span><span class="fa-nav-folder fa-nav-label">Library</span></span>');
    expect(page("/en/cat-harness/schemas/")).toContain('<span class="fa-nav-folder fa-nav-label">Schemas</span>');
    const home = page("/");
    expect(home).not.toContain("fa-nav-folder");
    expect(home).toContain('<span class="fa-nav-name fa-nav-label">folio-x</span>');
  });
});

describe("a long rail title is cut to one line and named in full", () => {
  // The cut itself is main's (owner, 2026-11-14: "one line w/ hover to show
  // more"); this holds that the text is left as it is -- `_x000D_` and all --
  // so the accessible name and the hover name are the whole title.
  const long = "YELLOW-FEVER VACCINATING CENTRES_x000D_FOR INTERNATIONAL TRAVEL = CENTRES DE VACCINATION";
  const html = navbarRegionsHtml(
    railModel({ ...OPTS, documentIndex: { label: "On this page", collapsible: true, items: [{ href: "#a", label: long }] } }),
  );

  it("keeps the whole text in the label and in the row's title", () => {
    expect(html).toContain(`<span class="fa-nav-label">${long}</span>`);
    expect(html).toContain(`title="${long}"`);
    expect(navbarCss()).toContain("text-overflow:ellipsis");
  });

  it("the header's folder line is a label like the rest, so it is cut and hidden at rest alike", () => {
    expect(navbarCss()).toContain(".fa-nav-titles{display:flex;flex-direction:column");
  });
});
