#!/usr/bin/env bun
/**
 * The `apps` visualiser: build every declared `web-app` directory in the
 * checkout and publish each at its own chrome-less route, with one index page
 * listing them.
 *
 * @module scripts/gen-web-apps
 * @covers web-app
 * @graphNode none — a build step over the web-app graph, not a schema itself
 *
 * Owner, 2026-11-11 (cards Q-GAME-5 A, Q-GAME-7 A): an app a content layer
 * carries (the GDHCN onboarding game in smart-trust) is published by the
 * harness, not by a script of its own, and is loaded only when a reader opens
 * it. So:
 *
 * | route | what |
 * |---|---|
 * | `<locale>/<harness>/apps/` | the index: one card per app, in the site's chrome |
 * | `<locale>/<harness>/apps/<id>/` | the app's build, unchanged except that every page carries the navbar opt-out and `rendered-by` |
 *
 * No other page embeds an app or loads its scripts, so its bytes are fetched
 * only by a reader who opens its route.
 *
 * Usage:
 *   bun run cat web-apps:build                     # build every app into the harness's own site
 *   bun run cat web-apps:build -- --site <dir>     # into a site being built
 *   bun run cat web-apps:build -- --only <id>      # one app
 *   bun run cat web-apps:build -- --check          # validate the declarations and translations; build nothing
 *   bun run cat web-apps:build -- --extract        # write each app's translation templates
 *
 * ## Translation
 *
 * An app that declares `i18n` is translated through the harness's own
 * process (`multi-locale-translation`, `translation-refresh`): `--extract` is
 * the "refresh the templates" step, writing `translations/<locale>/apps/<id>.pot`
 * in the declaring layer; the build reads each `.po` and writes
 * `<i18n.out>/<locale>.json` before the app builds. See `web-app-strings.ts`.
 *
 * Exit: 0 built (or nothing declared) · 1 a manifest is invalid or a build failed.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { buildCommand, installCommand, parseWebApp, WEB_APP_FILE, type WebApp } from "../schemas/ui/web-app.ts";
import { makeEmit, NAVBAR_OPT_OUT } from "./viewer-page.ts";
import { declaredPageRoute, withRenderedBy, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { themedPage } from "./lib/themed-page.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";
import { appPoPath, appPot, localeStrings, potCurrent, readCatalog } from "./web-app-strings.ts";

export const TOOL_ID = "web-app-build";
export const KIND = "web-app";

/** One declared app: where it is, and what its manifest says. */
export interface DeclaredApp {
  layer: string;
  /** Absolute path of the declaring layer's root, where its `translations/` are. */
  layerRoot: string;
  directory: string;
  /** Absolute path of the app's directory. */
  dir: string;
  app?: WebApp;
  /** Why the declaration cannot be built, when it cannot. */
  problem?: string;
}

/**
 * The declared app directories this checkout does not hold. A downstream
 * mounts only the directories its index lists (a lock may mount a layer's
 * glossary and translations but not its game), so the layer's declaration
 * names an app whose directory is simply not here. That is not a broken
 * declaration, and the layer's own checkout, which holds the
 * directory, still builds and judges it.
 */
export function unmountedApps(repoRoot: string): DeclaredApp[] {
  return appDeclarations(repoRoot).filter((a) => !existsSync(a.dir));
}

function appDeclarations(repoRoot: string): DeclaredApp[] {
  const out: DeclaredApp[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    const decl = readDeclaration(root);
    for (const d of decl?.directories ?? []) {
      if (!(d.graphTypologies ?? []).includes(KIND)) continue;
      out.push({ layer: decl!.name, layerRoot: root, directory: d.id, dir: join(root, d.path) });
    }
  }
  return out;
}

/** Every `web-app` directory the checkout's layers declare AND hold, with its manifest read and checked ({@link unmountedApps}: the rest). */
export function declaredApps(repoRoot: string): DeclaredApp[] {
  return appDeclarations(repoRoot).filter((a) => existsSync(a.dir)).map((a) => ({ ...a, ...readApp(a.dir) }));
}

/** Read and check one app directory. Never throws: a problem is returned in words. */
export function readApp(dir: string): { app?: WebApp; problem?: string } {
  const file = join(dir, WEB_APP_FILE);
  if (!existsSync(file)) return { problem: `no ${WEB_APP_FILE} at ${dir}` };
  let app: WebApp;
  try {
    app = parseWebApp(JSON.parse(readFileSync(file, "utf-8")), file);
  } catch (e) {
    return { problem: (e as Error).message };
  }
  const pkgFile = join(dir, "package.json");
  if (!existsSync(pkgFile)) return { app, problem: `no package.json at ${dir}` };
  const scripts = (JSON.parse(readFileSync(pkgFile, "utf-8")) as { scripts?: Record<string, string> }).scripts ?? {};
  if (scripts[app.build.script] === undefined) return { app, problem: `package.json has no "${app.build.script}" script` };
  const lock = app.build.installer === "bun" ? ["bun.lock", "bun.lockb"] : ["package-lock.json"];
  if (!lock.some((l) => existsSync(join(dir, l)))) return { app, problem: `no lockfile (${lock.join(" or ")}): the build must install exact versions` };
  return { app };
}

/** Two apps on one route are a declaration error, named with both claimants. */
export function routeClashes(apps: readonly DeclaredApp[]): string[] {
  const seen = new Map<string, DeclaredApp>();
  const out: string[] = [];
  for (const a of apps) {
    if (a.app === undefined) continue;
    const prior = seen.get(a.app.id);
    if (prior !== undefined) out.push(`app id "${a.app.id}" is declared by ${prior.layer}/${prior.directory} and ${a.layer}/${a.directory}`);
    else seen.set(a.app.id, a);
  }
  return out;
}

/** The locales an app translates into: all but its source, the first. */
export const targetLocales = (app: WebApp): string[] => app.locales.slice(1);

const readText = (f: string): string | undefined => (existsSync(f) ? readFileSync(f, "utf-8") : undefined);

/** An app's catalog, or a problem in words. */
export function appCatalog(a: DeclaredApp & { app: WebApp }): { catalog?: Record<string, string>; problem?: string } {
  if (a.app.i18n === undefined) return {};
  const file = join(a.dir, a.app.i18n.catalog);
  try {
    return { catalog: readCatalog(JSON.parse(readFileSync(file, "utf-8")), file) };
  } catch (e) {
    return { problem: (e as Error).message };
  }
}

/** Write (or with `check`, compare) each target locale's template. Returns the problems. */
export function extractTemplates(a: DeclaredApp & { app: WebApp }, check: boolean): string[] {
  const { catalog, problem } = appCatalog(a);
  if (problem !== undefined) return [problem];
  if (catalog === undefined) return [];
  const problems: string[] = [];
  for (const locale of targetLocales(a.app)) {
    const file = join(a.layerRoot, appPoPath(a.app, locale, "pot"));
    const fresh = appPot(a.app, catalog, relative(a.layerRoot, join(a.dir, a.app.i18n!.catalog)), locale);
    if (potCurrent(readText(file), fresh)) continue;
    if (check) problems.push(`${relative(a.layerRoot, file)} is ${existsSync(file) ? "stale" : "missing"}: run web-apps:build --extract`);
    else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, fresh); console.log(`  wrote ${relative(a.layerRoot, file)}`); }
  }
  return problems;
}

/** Check each locale's `.po`, and unless `check`, write `<out>/<locale>.json`. Returns the problems; prints coverage. */
export function injectStrings(a: DeclaredApp & { app: WebApp }, check: boolean): string[] {
  const { catalog, problem } = appCatalog(a);
  if (problem !== undefined) return [problem];
  if (catalog === undefined) return [];
  const problems: string[] = [];
  const total = Object.keys(catalog).length;
  for (const locale of targetLocales(a.app)) {
    const r = localeStrings(catalog, readText(join(a.layerRoot, appPoPath(a.app, locale, "po"))) ?? "");
    for (const k of r.placeholderErrors) problems.push(`${locale}: "${k}" drops or adds a {placeholder}`);
    for (const k of r.stale) problems.push(`${locale}: a translation for "${k}", which the catalog no longer has`);
    console.log(`  ${a.app.id} ${locale}: ${Object.keys(r.strings).length}/${total} translated${r.missing.length > 0 ? ` (${r.missing.length} fall back to ${a.app.locales[0]})` : ""}`);
    if (!check) {
      const out = join(a.dir, a.app.i18n!.out, `${locale}.json`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(r.strings, null, 2)}\n`);
    }
  }
  return problems;
}

/**
 * One page of an app's build, marked: the navbar opt-out (so the rail pass
 * leaves it alone and `check-viewer-nav` reads "no chrome on purpose") and
 * `rendered-by`. Idempotent. A page with no `<head>` is returned unchanged.
 */
export function markChromeless(html: string, tool = TOOL_ID): string {
  if (!/<head[^>]*>/i.test(html)) return html;
  if (html.includes(NAVBAR_OPT_OUT) && html.includes(`<meta name="rendered-by" content="${tool}">`)) return html;
  const withBy = withRenderedBy(html, tool);
  if (withBy.includes(NAVBAR_OPT_OUT)) return withBy;
  return withBy.replace(/<head([^>]*)>/i, (h) => `${h}\n${NAVBAR_OPT_OUT}`);
}

/** Every file under `dir`, relative, sorted. */
export function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mb = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;

/** One built app, as the index lists it. */
export interface BuiltApp { layer: string; app: WebApp; bytes?: number; problem?: string }

/** The index page, in the site's chrome. Links are relative, so the page works under any base. */
export function indexHtml(apps: readonly BuiltApp[]): string {
  const card = (b: BuiltApp): string => {
    const over = b.bytes !== undefined && b.app.sizeBudgetMB !== undefined && b.bytes > b.app.sizeBudgetMB * 1e6;
    const meta = [
      `from <code>${esc(b.layer)}</code>`,
      `languages: ${b.app.locales.map(esc).join(", ")}`,
      b.bytes !== undefined ? `${mb(b.bytes)}${over ? ` <b>(over its ${b.app.sizeBudgetMB} MB budget)</b>` : ""}` : "",
    ].filter(Boolean).join(" · ");
    const title = b.problem === undefined ? `<a href="${esc(b.app.id)}/">${esc(b.app.title)}</a>` : esc(b.app.title);
    return `<li><h2>${title}</h2><p>${esc(b.app.description)}</p><p class="m">${meta}</p>${b.problem !== undefined ? `<p class="warn"><b>Not built:</b> ${esc(b.problem)}</p>` : ""}</li>`;
  };
  return themedPage({
    title: "Apps",
    generator: "cat-harness-tools/scripts/gen-web-apps.ts",
    command: "bun run cat web-apps:build",
    body: `<style>
.apps-page { min-width:0; overflow-wrap:anywhere; --muted:#bcbab3; }
:root[data-fa-scheme="light"] .apps-page { --muted:#5b6168; }
.apps-page .m { color:var(--muted); font-size:.88rem; }
.apps-page .warn { border-left:4px solid #d97706; padding:4px 10px; }
.apps-page ul { list-style:none; padding:0; }
.apps-page li { margin:0 0 1.2rem; }
</style>
<div class="apps-page">
<h1>Apps</h1>
<p class="m">Interactive apps the layers of this site hold. Each opens on its own page, without the site's navigation, and loads only when you open it.</p>
${apps.length === 0 ? `<p>No directory of kind <code>${KIND}</code> is declared.</p>` : `<ul>\n${apps.map(card).join("\n")}\n</ul>`}
</div>`,
  });
}

function run(argv: string[], cwd: string): boolean {
  console.log(`  $ (${cwd}) ${argv.join(" ")}`);
  const r = spawnSync(argv[0]!, argv.slice(1), { cwd, stdio: "inherit", env: process.env });
  return r.status === 0;
}

/** Build one app and copy its output to `dest`, marking every page. Returns the bytes written, or a problem. */
export function buildApp(a: DeclaredApp & { app: WebApp }, dest: string): { bytes?: number; problem?: string } {
  const strings = injectStrings(a, false);
  if (strings.length > 0) return { problem: strings.join("; ") };
  if (!run(installCommand(a.app), a.dir)) return { problem: "install failed" };
  if (!run(buildCommand(a.app), a.dir)) return { problem: "build failed" };
  const out = join(a.dir, a.app.build.outDir);
  if (!existsSync(join(out, "index.html"))) return { problem: `the build wrote no ${a.app.build.outDir}/index.html` };
  rmSync(dest, { recursive: true, force: true });
  cpSync(out, dest, { recursive: true });
  let bytes = 0;
  for (const f of filesUnder(dest)) {
    const p = join(dest, f);
    if (f.endsWith(".html")) writeFileSync(p, markChromeless(readFileSync(p, "utf-8")));
    bytes += statSync(p).size;
  }
  return { bytes };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const extract = args.includes("--extract");
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
  const repoRoot = repoRootFor(HARNESS_ROOT);
  const route = declaredPageRoute(HARNESS_ROOT, TOOL_ID);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${TOOL_ID} — nothing to publish`);
    process.exit(0);
  }
  for (const a of unmountedApps(repoRoot)) console.log(`  · ${a.layer}/${a.directory}: not in this checkout (the mount did not bring it), so not built here`);
  const apps = declaredApps(repoRoot).filter((a) => only === undefined || a.app?.id === only || a.directory === only);
  const clashes = routeClashes(apps);
  let failed = clashes.length > 0;
  for (const c of clashes) console.error(`  ✗ ${c}`);
  for (const a of apps) if (a.problem !== undefined) { console.error(`  ✗ ${a.layer}/${a.directory}: ${a.problem}`); failed = true; }
  if (check || extract) {
    for (const a of apps) {
      if (a.problem !== undefined) continue;
      const ok = a as DeclaredApp & { app: WebApp };
      const problems = [...extractTemplates(ok, check), ...(check ? injectStrings(ok, true) : [])];
      for (const p of problems) console.error(`  ✗ ${a.layer}/${a.app!.id}: ${p}`);
      if (problems.length > 0) failed = true;
      else if (check) console.log(`  ✓ ${a.layer}/${a.directory}: ${a.app!.id}`);
    }
    process.exit(failed ? 1 : 0);
  }
  const site = siteTarget(join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT)));
  const built: BuiltApp[] = [];
  for (const a of apps) {
    if (a.app === undefined) continue;
    if (a.problem !== undefined || clashes.some((c) => c.includes(`"${a.app!.id}"`))) {
      built.push({ layer: a.layer, app: a.app, problem: a.problem ?? "route clash" });
      continue;
    }
    const r = buildApp(a as DeclaredApp & { app: WebApp }, join(site, route, a.app.id));
    if (r.problem !== undefined) failed = true;
    built.push({ layer: a.layer, app: a.app, ...r });
    console.log(`  ${r.problem === undefined ? "✓" : "✗"} ${a.layer}/${a.app.id}: ${r.problem ?? mb(r.bytes!)}`);
  }
  if (only === undefined) {
    makeEmit({ check: false, onStale: () => {} })(join(site, route, "index.html"), withRenderedByFrontMatter(indexHtml(built), TOOL_ID));
  }
  process.exit(failed ? 1 : 0);
}
