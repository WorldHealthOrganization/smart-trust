/**
 * `--site <dir>`: where a visualiser writer puts its pages when it is asked to
 * write into a site being built rather than into its harness's own docs.
 *
 * Owner, 2026-10-15: *"a harness should combine its library/ (or whatever)
 * sites of it and all its dependencies and use the url path pattern"*. A
 * repository's own site (`build-instance-site.ts`) composes `compose-docs
 * --shell`, which carries no visualiser pages, and the harness's docs are a
 * pinned mount it must not write into. So each writer whose Tool declares a
 * `site` input (`visualiser-writers.ts`) reads it here, and writes the same
 * declared route (`<locale>/<harness>/<visualiser>/…`) under that directory.
 *
 * One reader for every writer, so the flag is spelt and parsed once.
 *
 * @module scripts/lib/site-target
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

/** The flag a writer reads. A Tool declares it as its `site` input's `arg.flag`. */
export const SITE_FLAG = "--site";

/** The `--site` value on `argv`, absolute, or undefined when none is given. */
export function siteArg(argv: readonly string[] = process.argv.slice(2)): string | undefined {
  const v = parseArgs({ args: [...argv], options: { site: { type: "string" } }, strict: false, allowPositionals: true }).values.site;
  return typeof v === "string" && v !== "" ? resolve(v) : undefined;
}

/** The site a writer writes into: `--site` when given, else its harness's own (`fallback`). */
export function siteTarget(fallback: string, argv: readonly string[] = process.argv.slice(2)): string {
  return siteArg(argv) ?? fallback;
}

/**
 * Whether `site` holds the page at site-relative `href`: the built `.html`, or
 * the Jekyll source (`.md`) it will be built from. A writer pointed at a site
 * being built links a page of its harness's own site only when this site
 * carries it too: a repository's own site holds its layer's pages, not the
 * harness's guides, and an unresolved link refuses its publish.
 */
export function sitePageAt(site: string, href: string): boolean {
  const rel = href.split("#")[0]!.replace(/^\/+/, "");
  return [rel, rel.replace(/\.html$/, ".md"), join(rel, "index.html"), join(rel, "index.md")].some((p) => existsSync(join(site, p)));
}
