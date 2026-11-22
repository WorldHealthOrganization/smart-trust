import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  IG_VERSION_BANNER_OPT_OUT,
  igHomeHref,
  igMetadataTable,
  igOwnMetadataTable,
  igVersionBanner,
  igVersionTag,
  isHomePage,
  jurisdictionFlag,
  stampIgVersionChrome,
  versionFactsFrom,
  withIgVersionChrome,
} from "./ig-version-chrome.ts";

/** A neutral example IG on purpose: this layer names no publisher. */
const CFG = {
  id: "example.fhir.uv.demo",
  canonical: "http://example.org/fhir/demo/",
  name: "Demo",
  title: "Demo IG",
  status: "draft",
  version: "1.2.3",
  releaseLabel: "ci-build",
  fhirVersion: "4.0.1",
  date: "2026-10-12",
  jurisdiction: "http://unstats.un.org/unsd/methods/m49/m49.htm#001",
};
const F = versionFactsFrom(CFG);

describe("versionFactsFrom", () => {
  it("readsOwnConfig", () => {
    expect(F).toMatchObject({ title: "Demo IG", version: "1.2.3", releaseLabel: "ci-build", status: "draft", fhirVersion: "4.0.1", canonical: "http://example.org/fhir/demo", date: "2026-10-12", name: "Demo", id: "example.fhir.uv.demo" });
  });
  it("worldIsAGlobeCountryIsItsFlag", () => {
    expect(jurisdictionFlag(CFG.jurisdiction)).toEqual({ flag: "\u{1F310}", label: "International" });
    expect(jurisdictionFlag("urn:iso:std:iso:3166#CH")?.flag).toBe("\u{1F1E8}\u{1F1ED}");
    expect(jurisdictionFlag({ coding: [{ system: "urn:iso:std:iso:3166", code: "US" }] })?.label).toBe("US");
    expect(jurisdictionFlag("http://example.org/regions#north")).toBeUndefined();
  });
});

describe("the three pieces", () => {
  it("tagIsVersionAndLabel", () => {
    const t = igVersionTag(F);
    expect(t).toContain("1.2.3 - ci-build");
    expect(t).toContain('aria-label="International"');
    expect(igVersionTag({ title: "No version" })).toBe("");
  });
  it("bannerStatesThisBuildNotARelease", () => {
    const b = igVersionBanner(F);
    expect(b).toContain("This page is part of the Demo IG (v1.2.3: ci-build)");
    expect(b).toContain('href="http://hl7.org/fhir/R4/"');
    expect(b).toContain("not a published version");
    expect(b).toContain('href="http://example.org/fhir/demo/history.html">Directory of published versions</a>');
    const release = igVersionBanner(versionFactsFrom({ ...CFG, releaseLabel: "release", status: "active" }));
    expect(release).toContain("(v1.2.3: release)");
    expect(release).not.toContain("not a published version");
  });
  it("bannerAndTableInThePageLanguage", () => {
    const fr = igVersionBanner(F, "fr");
    expect(fr).toContain("Cette page fait partie du guide Demo IG (v1.2.3: ci-build), fondé sur");
    expect(fr).toContain(">Répertoire des versions publiées</a>");
    expect(fr).toContain("pas une version publiée");
    expect(igVersionBanner(F, "ar")).toContain("دليل الإصدارات المنشورة");
    expect(igVersionBanner(F, "zh-Hans")).toContain("已发布版本目录");
    expect(igVersionBanner(F, "xx")).toBe(igVersionBanner(F));
    const t = igOwnMetadataTable(F, "es");
    expect(t).toContain("URL oficial: ");
    expect(t).toContain("Borrador a fecha de 2026-10-12");
    expect(t).toContain("Nombre computable: Demo");
  });
  it("aTranslatedPageGetsItsLanguage", () => {
    const page = PAGE(FULL_BAR).replace("<html>", '<html lang="ru" dir="ltr">');
    const out = withIgVersionChrome(page, F, { home: true });
    expect(out).toContain("Эта страница входит в Demo IG");
    expect(out).toContain("Официальный URL: ");
  });
  it("metadataTableAsThePublisherWritesIt", () => {
    const t = igOwnMetadataTable(F);
    expect(t).toContain("Official URL: <code class=\"ig-metadata-url\">http://example.org/fhir/demo/ImplementationGuide/example.fhir.uv.demo</code>");
    expect(t).toContain("Version: 1.2.3");
    expect(t).toContain("Draft as of 2026-10-12");
    expect(t).toContain("Computable Name: Demo");
    expect(igMetadataTable({ version: "1" })).toBe("");
  });
});

const PAGE = (bar: string, main = "<h2>Summary</h2>") => `<!doctype html><html><head><title>x</title></head><body><nav class="fa-nav"></nav>\n${bar}\n<main class="ig-main fa-page-main">${main}</main></body></html>`;
const FULL_BAR = '<div class="ig-topbar fa-page-bar" role="navigation"><a class="ig-topbar-home" href="./index.html">Demo IG</a><details class="ig-topbar-group"><summary>Home</summary><ul><li><a href="x.html">X</a></li></ul></details><div class="ig-search-wrap"><form></form></div></div>';
const SLIM_BAR = '<header class="ig-search-top fa-page-bar"><a class="ig-search-home" href="../index.html">Demo IG</a><form class="ig-search"></form></header>';

describe("withIgVersionChrome", () => {
  it("versionRightOfTitleBannerAfterBar", () => {
    const out = withIgVersionChrome(PAGE(FULL_BAR), F, { home: false });
    expect(out).toMatch(/<span class="ig-topbar-head"><a class="ig-topbar-home"[^>]*>Demo IG<\/a><span class="ig-topbar-ver">.*1\.2\.3 - ci-build<\/span><\/span><details/);
    // The banner follows the WHOLE bar (its nested div included), not its first inner close.
    expect(out).toContain('<div class="ig-search-wrap"><form></form></div></div><p class="ig-version-banner"');
    expect(out).not.toContain('class="ig-metadata"');
    expect(out).toContain("<style data-ig-version-chrome>");
  });
  it("slimBarAndHomeTable", () => {
    const out = withIgVersionChrome(PAGE(SLIM_BAR), F, { home: true });
    expect(out).toContain('Demo IG</a><span class="ig-topbar-ver">');
    expect(out).not.toContain("ig-topbar-head\"");
    expect(out).toContain('</header><p class="ig-version-banner"');
    expect(out).toContain('<main class="ig-main fa-page-main"><table class="ig-metadata">');
  });
  it("aPageThatOptsOutGetsTheVersionButNoBanner", () => {
    const page = PAGE(SLIM_BAR).replace("<title>x</title>", `<title>x</title>${IG_VERSION_BANNER_OPT_OUT}`);
    const out = withIgVersionChrome(page, F, { home: false });
    expect(out).toContain('Demo IG</a><span class="ig-topbar-ver">');
    expect(out).not.toContain('class="ig-version-banner"');
    expect(withIgVersionChrome(out, F, { home: false })).toBe(out);
    const quoted = PAGE(SLIM_BAR, `<pre>${IG_VERSION_BANNER_OPT_OUT}</pre>`);
    expect(withIgVersionChrome(quoted, F, { home: false })).toContain('class="ig-version-banner"');
  });
  it("idempotentAndLeavesBarlessPages", () => {
    const once = withIgVersionChrome(PAGE(FULL_BAR), F, { home: true });
    expect(withIgVersionChrome(once, F, { home: true })).toBe(once);
    const bare = PAGE("<header>other</header>");
    expect(withIgVersionChrome(bare, F, { home: true })).toBe(bare);
  });
  it("homePagesAreTheRootAndEachLanguage", () => {
    expect(isHomePage("index.html")).toBe(true);
    expect(isHomePage("fr/index.html")).toBe(true);
    expect(isHomePage("zh-Hans/index.html")).toBe(true);
    expect(isHomePage("concepts.html")).toBe(false);
    expect(isHomePage("artifact/index.html")).toBe(false);
  });
});

describe("stampIgVersionChrome", () => {
  const site = mkdtempSync(join(tmpdir(), "ig-version-chrome-"));
  afterAll(() => rmSync(site, { recursive: true, force: true }));
  it("everyBarredPageOnce", () => {
    mkdirSync(join(site, "fr"), { recursive: true });
    mkdirSync(join(site, "assets"), { recursive: true });
    writeFileSync(join(site, "index.html"), PAGE(FULL_BAR));
    writeFileSync(join(site, "fr", "index.html"), PAGE(FULL_BAR));
    writeFileSync(join(site, "qa.html"), PAGE(SLIM_BAR));
    writeFileSync(join(site, "assets", "vendor.html"), PAGE(SLIM_BAR));
    writeFileSync(join(site, "old.html"), '<html><head><meta http-equiv="refresh" content="0; url=new.html"></head><body></body></html>');
    expect(stampIgVersionChrome(site, F).pages).toBe(3);
    expect(readFileSync(join(site, "fr", "index.html"), "utf-8")).toContain('class="ig-metadata"');
    expect(readFileSync(join(site, "qa.html"), "utf-8")).not.toContain('class="ig-metadata"');
    expect(readFileSync(join(site, "assets", "vendor.html"), "utf-8")).not.toContain("ig-version-banner");
    expect(stampIgVersionChrome(site, F).pages).toBe(0);
  });
});

describe("the banner's IG title links home", () => {
  it("hrefIsRelativeToThePageDepth", () => {
    const hasFr = (d: string): boolean => d === "fr" || d === "ar";
    expect(igHomeHref("index.html", hasFr)).toBe("index.html");
    expect(igHomeHref("StructureDefinition-x.html", hasFr)).toBe("index.html");
    expect(igHomeHref("journeys/j1/step.html", hasFr)).toBe("../../index.html");
    expect(igHomeHref("fr/index.html", hasFr)).toBe("index.html");
    expect(igHomeHref("ar/journeys/step.html", hasFr)).toBe("../index.html");
    // A directory that looks like a language but has no home of its own is just a directory.
    expect(igHomeHref("ig/page.html", hasFr)).toBe("../index.html");
  });
  it("titleIsEscapedInsideTheLink", () => {
    const b = igVersionBanner({ ...F, title: "A <b> & C" }, undefined, "../index.html");
    expect(b).toContain('This page is part of the <a href="../index.html">A &lt;b&gt; &amp; C</a> (v1.2.3: ci-build)');
    expect(igVersionBanner(F)).not.toContain('<a href="index.html">');
  });
  it("rootNestedAndLocalePages", () => {
    const site = mkdtempSync(join(tmpdir(), "ig-version-home-"));
    try {
      mkdirSync(join(site, "fr", "journeys"), { recursive: true });
      mkdirSync(join(site, "journeys"), { recursive: true });
      writeFileSync(join(site, "index.html"), PAGE(FULL_BAR));
      writeFileSync(join(site, "journeys", "j1.html"), PAGE(SLIM_BAR));
      writeFileSync(join(site, "fr", "index.html"), PAGE(FULL_BAR).replace("<html>", '<html lang="fr">'));
      writeFileSync(join(site, "fr", "journeys", "j1.html"), PAGE(SLIM_BAR).replace("<html>", '<html lang="fr">'));
      expect(stampIgVersionChrome(site, F).pages).toBe(4);
      const read = (r: string): string => readFileSync(join(site, r), "utf-8");
      expect(read("index.html")).toContain('part of the <a href="index.html">Demo IG</a> (v1.2.3');
      expect(read("journeys/j1.html")).toContain('part of the <a href="../index.html">Demo IG</a> (v1.2.3');
      expect(read("fr/index.html")).toContain('du guide <a href="index.html">Demo IG</a> (v1.2.3');
      expect(read("fr/journeys/j1.html")).toContain('du guide <a href="../index.html">Demo IG</a> (v1.2.3');
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});
