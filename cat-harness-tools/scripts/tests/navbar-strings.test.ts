/**
 * The rail in the page's language (owner, 2026-11-12): a site's `navbar.po`
 * becomes `assets/navbar/strings-<locale>.js`, and `navbar.js` swaps the labels
 * it translates, by exact match, on a page whose `<html lang>` is that locale.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { localisePageBar, localiseRail, navbarStringsFile, railLocale, railRootPath } from "../lib/navbar-locale.ts";
import { PAGE_BAR_CLASS } from "../lib/page-layout-classes.ts";
import {
  NAV_STRINGS_GLOBAL,
  RAIL_CHROME_STRINGS,
  navbarStringsBody,
  navbarStringsMap,
  railChromePotEntries,
  writeNavbarStrings,
} from "../lib/navbar-strings.ts";
import { NAV_RESIZE_LABEL, NAV_TOGGLE_LABEL, RAIL_SECTION_LABELS, navbarHtml, wireNavResize } from "../lib/navbar.ts";

const PO = [
  'msgid ""',
  'msgstr ""',
  '"Language: ar\\n"',
  "",
  'msgid "Pages"',
  'msgstr "الصفحات"',
  "",
  'msgid "Business Requirements"',
  'msgstr "متطلبات الأعمال"',
  "",
  'msgid "Folders"',
  'msgstr ""',
  "",
  "#, fuzzy",
  'msgid "Harnesses"',
  'msgstr "مسودة"',
  "",
].join("\n");

describe("the rail's own words are declared once", () => {
  it("lists every section label and both control names", () => {
    const ids = RAIL_CHROME_STRINGS.map((s) => s.msgid);
    for (const l of Object.values(RAIL_SECTION_LABELS)) expect(ids).toContain(l);
    expect(ids).toContain(NAV_TOGGLE_LABEL);
    expect(ids).toContain(NAV_RESIZE_LABEL);
    expect(railChromePotEntries().every((e) => e.kind === "ui-string" && e.comment)).toBe(true);
  });

  it("the drawn rail and the inlined drag edge say the declared names", () => {
    expect(wireNavResize.toString()).toContain(`"${NAV_RESIZE_LABEL}"`);
    const html = navbarHtml({ instance: "x", graphs: { label: "Folders", items: [] } } as Parameters<typeof navbarHtml>[0]);
    expect(html).toContain(NAV_TOGGLE_LABEL);
  });
});

describe("a site's navbar.po becomes a strings file", () => {
  it("keeps translated entries only — no empty, no fuzzy, no header", () => {
    expect(navbarStringsMap(PO)).toEqual({ Pages: "الصفحات", "Business Requirements": "متطلبات الأعمال" });
  });

  it("writes strings-<locale>.js for a locale with translations, and nothing for one without", () => {
    const tr = mkdtempSync(join(tmpdir(), "nav-tr-"));
    const site = mkdtempSync(join(tmpdir(), "nav-site-"));
    mkdirSync(join(tr, "ar"));
    writeFileSync(join(tr, "ar", "navbar.po"), PO);
    mkdirSync(join(tr, "es"));
    writeFileSync(join(tr, "es", "navbar.po"), 'msgid ""\nmsgstr ""\n\nmsgid "Pages"\nmsgstr ""\n');
    mkdirSync(join(tr, "fr")); // no navbar.po at all
    const r = writeNavbarStrings(site, tr);
    expect(r).toEqual({ written: ["ar"], empty: ["es"] });
    const body = readFileSync(join(site, navbarStringsFile("ar")), "utf-8");
    expect(body).toBe(navbarStringsBody("ar", navbarStringsMap(PO)));
    expect(body.startsWith(`(self.${NAV_STRINGS_GLOBAL}=self.${NAV_STRINGS_GLOBAL}||{})["ar"]=`)).toBe(true);
    expect(existsSync(join(site, navbarStringsFile("es")))).toBe(false);
  });

  it("a checkout with no translations writes nothing", () => {
    expect(writeNavbarStrings(mkdtempSync(join(tmpdir(), "nav-site-")), "/does/not/exist")).toEqual({ written: [], empty: [] });
  });
});

describe("which pages ask for a file", () => {
  it("a non-English <html lang>; never English or none", () => {
    expect(railLocale("ar")).toBe("ar");
    expect(railLocale("zh")).toBe("zh");
    expect(railLocale("EN")).toBeUndefined();
    expect(railLocale("en-GB")).toBeUndefined();
    expect(railLocale("")).toBeUndefined();
    expect(railLocale(null)).toBeUndefined();
  });

  it("builds the file's address only from a language tag and a relative root", () => {
    expect(railLocale("pt-br")).toBe("pt-br");
    expect(railLocale('ar"><script>')).toBeUndefined();
    expect(railLocale("../../x")).toBeUndefined();
    for (const ok of [".", "..", "../..", "../../", ""]) expect(railRootPath(ok)).toBeDefined();
    expect(railRootPath("../..")).toBe("../..");
    for (const bad of ["https://evil.example", "//evil.example", "/abs", "../x", "javascript:alert(1)"]) expect(railRootPath(bad)).toBeUndefined();
  });
});

/** Enough of the DOM for `localiseRail`: elements with text-node children and attributes. */
function fakeRail(labels: string[], attrs: Record<string, string>[]) {
  const text = (t: string) => ({ nodeType: 3, textContent: t });
  const els = labels.map((l) => ({ childNodes: [text(l)] }));
  const attrEls = attrs.map((a) => ({
    a: { ...a },
    getAttribute(k: string) {
      return this.a[k] ?? null;
    },
    setAttribute(k: string, v: string) {
      this.a[k] = v;
    },
  }));
  const nav = {
    querySelectorAll(sel: string) {
      return sel === ".fa-nav-label" ? els : attrEls;
    },
  };
  return { nav: nav as unknown as ParentNode, els, attrEls };
}

describe("the swap is exact match or nothing", () => {
  const map = { Pages: "الصفحات", "Business Requirements": "متطلبات الأعمال", [NAV_TOGGLE_LABEL]: "افتح أو أغلق" };

  it("replaces a whole label, keeps its surrounding space, and leaves an unknown one English", () => {
    const { nav, els } = fakeRail([" Pages ", "Business Requirements", "Business", "Fictional Countries"], []);
    expect(localiseRail(nav, map)).toBe(2);
    expect(els.map((e) => e.childNodes[0]!.textContent)).toEqual([" الصفحات ", "متطلبات الأعمال", "Business", "Fictional Countries"]);
  });

  it("translates names and tooltips the same way", () => {
    const { nav, attrEls } = fakeRail([], [{ "aria-label": NAV_TOGGLE_LABEL, "data-fa-tip": NAV_TOGGLE_LABEL }, { title: "Something else" }]);
    expect(localiseRail(nav, map)).toBe(2);
    expect(attrEls[0]!.a).toEqual({ "aria-label": "افتح أو أغلق", "data-fa-tip": "افتح أو أغلق" });
    expect(attrEls[1]!.a).toEqual({ title: "Something else" });
  });
});

describe("the page's top bar takes the same map", () => {
  type N = { nodeType: number; nodeName?: string; textContent: string | null; childNodes?: N[] };
  const t = (s: string): N => ({ nodeType: 3, textContent: s });
  const el = (name: string, ...kids: N[]): N => ({ nodeType: 1, nodeName: name, textContent: null, childNodes: kids });
  const map = { "SMART Verifiable IPS for Pilgrimage": "SMART IPS للزيارة الدينية", Home: "الرئيسية", Summary: "الملخص", Search: "بحث" };

  it("swaps whole labels at any depth, never script text or a partial match", () => {
    const home = el("A", t("SMART Verifiable IPS for Pilgrimage"));
    const group = el("SUMMARY", t(" Home "));
    const item = el("A", t("Summary"));
    const partial = el("SPAN", t("Home page"));
    const script = el("SCRIPT", t("Home"));
    const bar = el("DIV", home, el("DETAILS", group, el("UL", el("LI", item))), partial, script);
    const input = { a: { placeholder: "Search" } as Record<string, string> };
    const doc = {
      querySelectorAll(sel: string) {
        if (sel === `.${PAGE_BAR_CLASS}`) {
          return [Object.assign(bar, { querySelectorAll: () => [{ getAttribute: (k: string) => input.a[k] ?? null, setAttribute: (k: string, v: string) => (input.a[k] = v) }] })];
        }
        return [];
      },
    } as unknown as ParentNode;
    expect(localisePageBar(doc, map)).toBe(4);
    expect(home.childNodes![0]!.textContent).toBe("SMART IPS للزيارة الدينية");
    expect(group.childNodes![0]!.textContent).toBe(" الرئيسية ");
    expect(item.childNodes![0]!.textContent).toBe("الملخص");
    expect(partial.childNodes![0]!.textContent).toBe("Home page");
    expect(script.childNodes![0]!.textContent).toBe("Home");
    expect(input.a.placeholder).toBe("بحث");
  });

  it("a page with no top bar is left alone", () => {
    expect(localisePageBar({ querySelectorAll: () => [] } as unknown as ParentNode, map)).toBe(0);
  });
});
