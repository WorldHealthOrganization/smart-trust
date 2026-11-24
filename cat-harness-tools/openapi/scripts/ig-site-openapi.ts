#!/usr/bin/env bun
/**
 * The OpenAPI pages of an IG repository's own site: the checkout script
 * `ig-site:openapi`, a site step run after Jekyll on the built site.
 *
 * @module cat-harness-tools/openapi/scripts/ig-site-openapi
 * @covers openapi
 *
 * ```sh
 * bun run cat-harness-tools/openapi/scripts/ig-site-openapi.ts <built site> [--ig <checkout>]
 * ```
 *
 * Owner, 2026-10-14, on a DAK IG losing its OpenAPI pages when it dropped
 * its own declaration: *"that should already be there in ... cat-harness or so
 * for openapi"*. The renderer is this layer's (`gen-openapi-pages.ts`); what
 * an IG repository lacks is the declaration it used to find the graph through.
 * So the graph is found by what the checkout HOLDS, never by a declaration:
 * `openapi/cat-openapi.config.json` (or `cat-openapi.config.json` at the root),
 * the documents and their provenance beside it in `openapi/`, as
 * `ingest-openapi.ts` wrote them.
 *
 * The documents and the pages {@link pagesForGraph} writes for them are put
 * in the built site at `openapi/`, where the IG's pages link the Swagger UI
 * the Publisher vendored (`openapi/index.html#/<tag>/<operationId>`, which the
 * graph's index page forwards to the operation's own page). The IRIs extend
 * the repository's name, which is the site's. A checkout holding no config
 * writes nothing and says so; a path the site already holds is refused, never
 * overwritten.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { OpenApiConfigSchema, type OpenApiConfig } from "../schemas/openapi.ts";

import { pagesForGraph, type Written } from "./gen-openapi-pages.ts";
import { CONFIG_FILE } from "./ingest-openapi.ts";

/** Where an IG repository's site serves its OpenAPI graph, and where the checkout keeps it. */
export const OPENAPI_DIR = "openapi";

/** The checkout's OpenAPI config and the directory of its documents, or undefined when it holds none. Pure over the file system. */
export function igOpenapiGraph(ig: string): { config: string; dir: string } | undefined {
  for (const config of [join(ig, OPENAPI_DIR, CONFIG_FILE), join(ig, CONFIG_FILE)]) {
    if (existsSync(config)) return { config, dir: join(ig, OPENAPI_DIR) };
  }
  return undefined;
}

/** The config, parsed. Throws naming the file. */
export function readIgConfig(file: string): OpenApiConfig {
  const r = OpenApiConfigSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

/** The repository's name, from the checkout's origin, else its directory's name: the name the site is served under. */
export function repoName(ig: string): string {
  const r = spawnSync("git", ["-C", ig, "config", "--get", "remote.origin.url"], { encoding: "utf-8" });
  const m = r.status === 0 ? /([^/:]+?)(?:\.git)?\/?$/.exec(r.stdout.trim()) : null;
  return m?.[1] ?? basename(resolve(ig));
}

/** The documents and provenance the ingest wrote, which the pages fetch beside them. */
function ingested(dir: string): string[] {
  return readdirSync(dir).filter((f) => /\.(openapi|source)\.json$/.test(f)).sort();
}

/**
 * Write the graph into `site` at `openapi/`. Returns the paths written,
 * relative to the site; refuses any the site already holds.
 */
export function igSiteOpenapi(o: { site: string; ig: string; log?: (s: string) => void }): string[] {
  const log = o.log ?? ((s: string) => console.error(s));
  const g = igOpenapiGraph(resolve(o.ig));
  if (!g) {
    log(`ig-site:openapi: the checkout holds no ${OPENAPI_DIR}/${CONFIG_FILE}: no OpenAPI pages`);
    return [];
  }
  const instance = repoName(o.ig);
  const files: Written[] = [
    ...ingested(g.dir).map((f) => ({ path: f, content: readFileSync(join(g.dir, f), "utf8") })),
    ...pagesForGraph({ instance, config: readIgConfig(g.config), dir: g.dir, graphPath: OPENAPI_DIR }),
  ];
  const clash = files.map((f) => join(OPENAPI_DIR, f.path)).filter((p) => existsSync(join(o.site, p)));
  if (clash.length) throw new Error(`the built site already holds ${clash.length} path(s) the OpenAPI graph writes — refusing two answers for one URL:\n  ${clash.slice(0, 20).join("\n  ")}`);
  for (const f of files) {
    const to = join(o.site, OPENAPI_DIR, f.path);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, f.content);
  }
  const pages = files.filter((f) => f.path.endsWith("index.html")).length;
  log(`ig-site:openapi: ${files.length} file(s) at ${OPENAPI_DIR}/ — ${pages} page(s) over ${ingested(g.dir).filter((f) => f.endsWith(".openapi.json")).length} document(s), IRIs under /${instance}/${OPENAPI_DIR}/`);
  return files.map((f) => `${OPENAPI_DIR}/${f.path}`);
}

if (import.meta.main) {
  const [site, ...rest] = process.argv.slice(2);
  const i = rest.indexOf("--ig");
  if (!site) {
    console.error("usage: ig-site-openapi.ts <built site> [--ig <checkout>]");
    process.exit(2);
  }
  try {
    igSiteOpenapi({ site: resolve(site), ig: resolve(i >= 0 ? rest[i + 1]! : ".") });
  } catch (e) {
    console.error(`✗ ig-site:openapi: ${(e as Error).message}`);
    process.exit(1);
  }
}
