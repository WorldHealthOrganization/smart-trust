/**
 * The rail, with the visualiser-nav declaration it read taken out — bean
 * `gp2f`, page weight.
 *
 * A page that declares its section (`<script data-fa-visualiser-nav>`, see
 * `visualiserNavOf`) has that menu read into the rail's own data. Left in the
 * page, the block is a second copy of the same menu that nothing in the
 * browser reads: the rail draws from `#fa-rail`. On an IG site it is the IG's
 * whole menu, the same on every page — 2.9 KB of every page of one published
 * IG, measured, beside the 3.7 KB the rail already carries.
 *
 * A wrapper rather than a change inside `injectRail` on purpose:
 * `harness-rail.ts` is bundled into the committed `navbar.js`
 * (`gen-navbar-assets.ts`), and any edit to it reshuffles the minified names,
 * which would make this a two-repository change for no behaviour.
 *
 * A malformed declaration is kept: the rail fell back to the headings, and
 * `check-viewer-nav.ts` is what reports it. An explicit `o.documentIndex`
 * means the declaration was not read, so it is kept too.
 *
 * @module scripts/lib/rail-once
 */
import { injectRail, type RailOptions } from "./harness-rail.js";
import { VISUALISER_NAV_ATTR, visualiserNavOf } from "./navbar.js";

const DECLARATION = new RegExp(`<script\\b[^>]*\\b${VISUALISER_NAV_ATTR}\\b[^>]*>[\\s\\S]*?</script>`, "i");

/** The page with its first visualiser-nav declaration removed. */
export function withoutVisualiserNav(html: string): string {
  return html.replace(DECLARATION, "");
}

/** `injectRail`, then drop the declaration the rail has just read. */
export function injectRailOnce(html: string, o: RailOptions): string | undefined {
  const railed = injectRail(html, o);
  if (railed === undefined || o.documentIndex || !visualiserNavOf(html, "")) return railed;
  return withoutVisualiserNav(railed);
}
