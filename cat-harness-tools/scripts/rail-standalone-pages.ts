/**
 * Rail the standalone pages, as a LAST step over the finished site.
 *
 * It is its own step, run last, because a pass over every page the site
 * publishes needs the site finished: pages such as bootstrap's are generated
 * by `publish-instance-files.ts --instance ./bootstrap` after
 * `mount-instance-docs.ts` has run.
 *
 * It is idempotent: `injectRail` refuses a page that already carries a
 * navigation, so pages the mount pass railed earlier are left byte-identical.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/rail-standalone-pages.ts --site ./_site --built cat-harness
 *
 * Last, the rail in the page's language: each `<translations>/<locale>/navbar.po`
 * of the checkout it runs in (`--translations`, default `./translations`) becomes
 * the site's `assets/navbar/strings-<locale>.js`, which `navbar.js` loads on a
 * page whose `<html lang>` is that locale (`lib/navbar-strings.ts`).
 *
 * @module scripts/rail-standalone-pages
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { DOCS_SITE_BASE } from "../schemas/kg/jsonld.js";
import { writeNavbarStrings } from "./lib/navbar-strings.ts";
import { mountRoutes, railStandalonePages, type ForeignSiteRail } from "./mount-instance-docs.js";


function main(): number {
  const argv = process.argv.slice(2);
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const site = at("--site");
  const built = at("--built");
  if (!site || !built) {
    console.error("usage: rail-standalone-pages.ts --site <dir> --built <instance-dir-name> [--theme-source <jekyll source>] [--translations <dir>] [--foreign-site [--home-label <name>] [--instance <name> [--landing]]]");
    return 2;
  }
  // `--foreign-site`: the site is a FOLIO's, not the platform's (folio-staging.yml).
  // The platform's links then point at the platform's published site, and none
  // of the platform's mount routes exist here to be left alone.
  const homeLabel = at("--home-label");
  const foreign: ForeignSiteRail | undefined = argv.includes("--foreign-site")
    ? {
        platformBase: DOCS_SITE_BASE.replace(/\/$/, ""),
        ...(homeLabel ? { homeLabel } : {}),
        ...(at("--instance") ? { instance: at("--instance")! } : {}),
        // `--landing`: the checkout declares no layer; `--instance` is only the harness it lands on.
        ...(argv.includes("--landing") ? { landing: true } : {}),
      }
    : undefined;
  const siteAbs = resolve(site);
  if (!existsSync(siteAbs)) {
    // Could-not-determine, said out loud rather than reported as a clean run
    // over nothing. A pass that silently rails zero pages because the site is
    // not there is the shape this whole bean is about.
    console.error(`  ? ${siteAbs} does not exist — nothing to rail, and that is not a pass`);
    return 2;
  }

  // ASKED, not guessed — see `mountRoutes`. Guessing from directory names
  // called `bootstrap` a mount and skipped the ten pages this step exists for.
  const routes = foreign ? [] : mountRoutes(built);
  // `--theme-source <jekyll source>`: the theme's own pages are railed too, their
  // side bar replaced by the rail and its Pages (owner, 2026-10-15, option A).
  const themeSource = at("--theme-source");
  if (themeSource && !existsSync(resolve(themeSource))) {
    console.error(`  ? --theme-source ${themeSource} does not exist — the page tree cannot be read`);
    return 2;
  }
  const r = railStandalonePages(siteAbs, built, built, routes, foreign, themeSource ? { themeSource: resolve(themeSource) } : {});
  console.log(
    `rail-standalone-pages: rail on ${r.injected} page(s), ` +
      `${r.alreadyNavigated} already navigated, ${r.redirects} redirect stub(s) left bare, ` +
      `${r.declined} declined in their own markup (folio-navbar: none), ` +
      `${r.replacedThemeSidebar} theme side bar(s) replaced by the rail, ` +
      `${routes.length} mount route(s) left to the mount pass, ` +
      `${r.finished} railed page(s) there finished (theme side bar, first-paint snippet)`,
  );
  if (r.pinned) {
    // Owner, 2026-10-15, "pinned copy per site": what the railed pages link is shipped beside them.
    console.log(
      `  pinned chrome: ${r.pinned.copied.length} copied, ${r.pinned.same.length} already identical` +
        (r.pinned.differing.length ? `, ${r.pinned.differing.length} left as the site built them (${r.pinned.differing.join(", ")})` : ""),
    );
  }
  // The rail in the page's language (owner, 2026-11-12): the checkout's own
  // catalogues, written beside the rail's shared data.
  const strings = writeNavbarStrings(siteAbs, resolve(at("--translations") ?? "translations"));
  if (strings.written.length || strings.empty.length) {
    console.log(
      `  rail strings: ${strings.written.length ? strings.written.join(", ") : "none"}` +
        (strings.empty.length ? ` (navbar.po with no translated entry, left English: ${strings.empty.join(", ")})` : ""),
    );
  }
  if (r.skipped.length) {
    console.log(`  ${r.skipped.length} file(s) took no rail (no <body>):`);
    for (const f of r.skipped.slice(0, 5)) console.log(`      ${f}`);
    if (r.skipped.length > 5) console.log(`      … and ${r.skipped.length - 5} more`);
  }
  return 0;
}

if (import.meta.main) process.exit(main());
