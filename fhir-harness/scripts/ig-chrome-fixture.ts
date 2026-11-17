/**
 * Stand-ins for the platform's two chrome scripts, laid into a fixture IG
 * checkout where a mount would put them (`cat-harness-tools/scripts/`), so
 * stage-local's IG path can be run end to end without the platform mounted.
 * The REAL rail is exercised in `stage-local-ig-chrome.test.ts`; these only
 * write the two markers it writes, or (FAKE_RAIL_NOTHING) none, to stand for a
 * chrome step that ran and chromed nothing.
 */
/** A stand-in for the platform's sync-docs-harness.ts: writes nothing. */
export const FAKE_SYNC = "// stand-in\n";
/** A stand-in for rail-standalone-pages.ts: puts the rail and the icon row after every page's <body>. */
export const FAKE_RAIL = `import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const site = process.argv[process.argv.indexOf("--site") + 1];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, e.name);
  if (e.isDirectory()) walk(p);
  else if (e.name.endsWith(".html")) writeFileSync(p, readFileSync(p, "utf-8").replace(/<body>/, '<body><nav class="fa-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>'));
} };
walk(site);
`;

/** A rail that runs and rails nothing: the chrome step's failure, as the publish sees it. */
export const FAKE_RAIL_NOTHING = "// rails nothing\n";
/** A sync that refuses, as sync-docs-harness does in a checkout whose index names no landing layer (an IG repository, 2026-10-14). */
export const FAKE_SYNC_FAILS = "process.exit(1);\n";
