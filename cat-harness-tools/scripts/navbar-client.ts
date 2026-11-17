/**
 * The browser half of the rail from shared data — bundled into
 * `assets/js/navbar.js` by `gen-navbar-assets.ts`.
 *
 * It runs `renderRailRegions` — the same function the build runs for an audit —
 * over the page's own `#fa-rail` block and the shared data the page loaded just
 * before it (`assets/navbar/rail-<hash>.js`). Loaded `defer`, so it runs after
 * the document is parsed and before `DOMContentLoaded`: `navbar-row.js` and
 * `docs-ui.js`, which start at `DOMContentLoaded`, find the rail already drawn.
 *
 * @module cat-harness/scripts/navbar-client
 */
import { RAIL_PAGE_ID, renderRailRegions, type RailPage } from "./lib/harness-rail.ts";
import { wireNavFolds, wireNavResize } from "./lib/navbar.ts";
import { localisePageBar, localiseRail, navbarStringsFile, railLocale, railRootPath } from "./lib/navbar-locale.ts";

declare const self: { FaRailData?: Record<string, string>; FaNavStrings?: Record<string, Record<string, string>> };

/**
 * The rail in the page's language (owner, 2026-11-12): on a page whose
 * `<html lang>` is not English, load the site's `strings-<locale>.js` and swap
 * the labels it translates, in the rail and in the page's top bar. No file,
 * or no entry, leaves the English as built
 * (`navbar-locale.ts`). After `draw`, which replaces the rail's contents.
 */
function localise(nav: Element, siteRoot: string): void {
  const loc = railLocale(document.documentElement.getAttribute("lang"));
  if (!loc) return;
  const apply = (): void => {
    const map = self.FaNavStrings?.[loc];
    if (!map) return;
    localiseRail(nav, map);
    // The page's top bar (an IG's menu) from the same map (owner, 2026-11-13).
    localisePageBar(document, map);
  };
  if (self.FaNavStrings?.[loc]) return apply();
  // The script's address is built from page data, so both parts are held to
  // what they can legitimately be: `railLocale` admits a language tag only, and
  // the root a relative path of `.`/`..` segments (`railRootPath`).
  const base = railRootPath(siteRoot);
  if (base === undefined) return;
  const s = document.createElement("script");
  s.src = `${base}/${navbarStringsFile(loc)}`;
  s.onload = apply;
  document.head.appendChild(s);
}

/**
 * THE OPEN FOLDER IN THE PAGE'S TOP BAR TOO (owner, 2026-11-13): the bar's
 * site name reads "<site>: Library" on a page in the Library folder, as the
 * rail's header reads the site's name over "Library". Read from the header the
 * rail just drew, so the two cannot disagree; no folder, no suffix.
 */
function folderInPageBar(nav: Element): void {
  const folder = nav.querySelector(".fa-nav-head .fa-nav-folder")?.textContent?.trim();
  const home = document.querySelector(".fa-page-bar-home");
  if (!folder || !home || home.querySelector(".fa-page-bar-folder")) return;
  const s = document.createElement("span");
  s.className = "fa-page-bar-folder";
  s.textContent = `: ${folder}`;
  home.appendChild(s);
}

function draw(): void {
  const block = document.getElementById(RAIL_PAGE_ID);
  const nav = document.querySelector('nav.fa-nav[data-fa-rail="pending"]');
  if (!block || !nav) return;
  let page: RailPage;
  try {
    page = {
      ...(JSON.parse(block.textContent || "{}") as Omit<RailPage, "root" | "toRoot">),
      root: block.getAttribute("data-fa-root") ?? ".",
      toRoot: block.getAttribute("data-fa-to-root") ?? ".",
      // Set by a site that composes this one into a larger site (smart-html-jtd).
      ...(block.getAttribute("data-fa-home") ? { home: block.getAttribute("data-fa-home")! } : {}),
      ...(block.getAttribute("data-fa-home-name") ? { homeName: block.getAttribute("data-fa-home-name")! } : {}),
    };
  } catch {
    console.warn("navbar: #fa-rail is not valid JSON; the rail keeps its Home link only.");
    return;
  }
  const shared = self.FaRailData?.[page.data];
  if (typeof shared !== "string") {
    console.warn(`navbar: shared rail data ${page.data} did not load; the rail keeps its Home link only.`);
    return;
  }
  nav.innerHTML = renderRailRegions(shared, page);
  nav.removeAttribute("data-fa-rail");
  folderInPageBar(nav);
  // The SITE's root (`data-fa-to-root`), where the shared rail data and the
  // strings files are: on a site composed onto the platform (an IG),
  // `data-fa-root` is the platform's address, for the platform's links.
  localise(nav, page.toRoot);
}

draw();
// The fold toggles on parent rows (owner, 2026-10-15): one delegated handler.
wireNavFolds(document);
// The drag edge (owner, 2026-11-10): after `draw`, which replaces the rail's contents.
wireNavResize(document);
