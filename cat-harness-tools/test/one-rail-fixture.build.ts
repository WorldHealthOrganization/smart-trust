#!/usr/bin/env bun
/**
 * Write the site `one-rail.e2e.ts` serves: two just-the-docs pages (the
 * theme's markup, reduced to what the rail pass touches) and one page the
 * theme never laid out, railed by the REAL pass with `--theme-source`
 * (owner, 2026-10-15, "folio rail everywhere", option A). The platform's
 * chrome — `navbar.js`, `navbar.css`, `navbar-row.*`, `docs-ui.*` — is copied
 * from the harness, so the browser runs the shipped bytes.
 *
 *   bun run cat-harness-tools/test/one-rail-fixture.build.ts <out-dir>
 *
 * @module test/one-rail-fixture.build
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { railStandalonePages } from "../scripts/mount-instance-docs.ts";

const out = process.argv[2];
if (!out) {
  console.error("usage: one-rail-fixture.build.ts <out-dir>");
  process.exit(2);
}
const site = join(out, "site");
const source = join(out, "source");
const put = (root: string, rel: string, body: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};

put(source, "index.md", `---\ntitle: Home\nnav_order: 1\n---\n`);
put(source, "guide/index.md", `---\ntitle: Guide\nnav_order: 2\n---\n`);
put(source, "guide/install.md", `---\ntitle: Install\nparent: Guide\n---\n`);
put(source, "guide/use.md", `---\ntitle: Use\nparent: Guide\n---\n`);

const themePage = (title: string, toRoot: string): string => `<!DOCTYPE html>
<html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="${toRoot}/assets/css/docs-ui.css"><script src="${toRoot}/assets/js/docs-ui.js" defer></script></head>
<body>
  <a class="skip-to-main" href="#main-content">Skip to main content</a>
  <header class="side-bar">
    <div class="site-header"><a href="${toRoot}/" class="site-title lh-tight">Site</a><button id="menu-button" class="site-button btn-reset" aria-label="Menu"></button></div>
    <nav aria-label="Main" id="site-nav" class="site-nav"><ul class="nav-list"><li class="nav-list-item"><a href="${toRoot}/" class="nav-list-link">Home</a></li></ul></nav>
    <div class="d-md-block d-none site-footer">theme footer</div>
  </header>
  <div class="main" id="top">
    <div id="main-header" class="main-header">
      <div class="search" role="search"><div class="search-input-wrap"><input type="text" id="search-input" class="search-input" placeholder="Search Site"><label for="search-input" class="search-label"></label></div><div id="search-results" class="search-results"></div></div>
    </div>
    <div class="main-content-wrap"><div id="main-content" class="main-content"><main>
      <h1 id="t">${title}</h1><h2 id="a">First section</h2><p>Text.</p><h2 id="b">Second section</h2><p>More.</p>
    </main><hr><footer><div class="d-md-none mt-4 fs-2">theme footer again</div></footer></div></div>
  </div>
</body></html>
`;
put(site, "index.html", themePage("Home", "."));
put(site, "guide/index.html", themePage("Guide", ".."));
put(site, "guide/install.html", themePage("Install", ".."));
put(site, "guide/use.html", themePage("Use", ".."));
// A replica's own layout makes its BODY the centred column (who-iris's pages do).
put(site, "replica/page.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Replica</title>
<style>body { max-width: 50rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }</style></head>
<body><main><h1>A replica page</h1><h2 id="x">One</h2><p>a</p><h2 id="y">Two</h2><p>b</p></main></body></html>
`);
// The theme's search scripts, as a just-the-docs site publishes them: stubs here.
put(site, "assets/js/vendor/lunr.min.js", "/* lunr stub */\n");
put(site, "assets/js/just-the-docs.js", "window.jtd = window.jtd || {};\n");
for (const rel of ["assets/js/navbar.js", "assets/css/navbar.css", "assets/js/navbar-row.js", "assets/css/navbar-row.css", "assets/js/docs-ui.js", "assets/css/docs-ui.css"]) {
  mkdirSync(dirname(join(site, rel)), { recursive: true });
  copyFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, rel)), join(site, rel));
}

const r = railStandalonePages(site, "cat-harness", "cat-harness", [], undefined, { themeSource: source });
console.log(JSON.stringify({ injected: r.injected, replacedThemeSidebar: r.replacedThemeSidebar, site }));
