#!/usr/bin/env bun
/**
 * Where the Jekyll-built documentation tree sits under the published site.
 *
 * @module scripts/docs-route
 *
 * cat-harness's documentation pages publish under
 * `<base-url>/docs/cat-harness/<page>.html`, not at the site root — the same
 * `<base-url>/<kind>/<instance>/` rule that puts a mounted layer's
 * documentation at `/docs/<instance>/` (`mount-instance-docs.ts`).
 *
 * The route is read, not written down: the `docs` KIND and the built
 * layer's declared NAME, so it follows a rename. The one literal copy is
 * `_config.yml`'s `baseurl`, because Jekyll reads nothing else;
 * `docs-route.test.ts` checks it against this function.
 *
 * Usage (prints the route and nothing else, for `ROUTE=$(…)`):
 *   bun run cat-harness-tools/scripts/docs-route.ts --built cat-harness
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { declarationPathIn } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

/** The graph kind whose handler publishes a layer's documentation. */
export const DOCS_KIND = "docs";

/** `docs/<name>` — the route a layer's documentation is published at, site-root-relative, no slashes at either end. */
export function docsRouteFor(name: string): string {
  return `${DOCS_KIND}/${name}`;
}

/**
 * The route of the BUILT layer's documentation — the one Jekyll renders.
 *
 * `built` is the layer's directory, repo-relative (`cat-harness`); the
 * route uses its declared `name`, falling back to the directory name exactly
 * as `mount-instance-docs.ts` does for every other layer. Throws when there
 * is no declaration: a guessed route sends every rail link to a directory
 * nothing published, and "could not determine" is never rendered as an answer.
 */
export function builtDocsRoute(built: string, repo = REPO): string {
  const decl = declarationPathIn(join(repo, built));
  if (decl === undefined || !existsSync(decl)) {
    throw new Error(`docs-route: no declaration for ${built}; cannot say where its docs are published`);
  }
  let name: unknown;
  try {
    name = (JSON.parse(readFileSync(decl, "utf-8")) as { name?: unknown }).name;
  } catch (e) {
    throw new Error(`docs-route: ${decl} is unreadable (${e instanceof Error ? e.message : String(e)})`);
  }
  return docsRouteFor(typeof name === "string" && name ? name : built);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--built");
  const built = i >= 0 ? argv[i + 1] : undefined;
  if (!built) {
    console.error("usage: docs-route.ts --built <instance directory>");
    process.exit(2);
  }
  try {
    console.log(builtDocsRoute(built));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
}
