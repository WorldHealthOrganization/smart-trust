#!/usr/bin/env bun
/**
 * Print the railed fixture page `railed-fixture.ts` serves: a minimal
 * standalone viewer, railed by `withViewerNav` exactly as a generator rails
 * one. Run under bun, because the rail's writer is generator code.
 *
 * @module test/railed-fixture.build
 */
import { basename, join } from "node:path";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { withViewerNav } from "../scripts/viewer-page.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rail fixture</title>
<style>body { margin: 0; background: #0d0d0d; color: #fff; font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 60rem; margin: 0 auto; padding: 1.5rem; }</style>
</head>
<body>
<main>
<h1 id="fixture">Rail fixture</h1>
<h2 id="first">First section</h2>
<p>A standalone viewer page, railed by withViewerNav.</p>
<h2 id="second">Second section</h2>
<p>Its sections give the rail a page index.</p>
</main>
</body>
</html>
`;

const railed = withViewerNav(page, join(SITE, "rail-fixture", "index.html"), { built: basename(ROOT), docsRoot: SITE });
if (railed === undefined) {
  console.error("withViewerNav returned no rail for the fixture page");
  process.exit(1);
}
process.stdout.write(railed);
