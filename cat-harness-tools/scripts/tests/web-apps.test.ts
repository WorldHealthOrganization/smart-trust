/**
 * The `apps` visualiser's pure parts: the manifest, the checks on an app
 * directory, the route clash rule, the chrome-less marking of a built page,
 * and the index. The build itself shells out to npm or bun and is exercised
 * by a layer's site build, not here.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCommand, installCommand, parseWebApp, WEB_APP_V01 } from "../../schemas/ui/web-app.ts";
import { declaredApps, indexHtml, markChromeless, readApp, routeClashes, unmountedApps, type DeclaredApp } from "../gen-web-apps.ts";
import { NAVBAR_OPT_OUT } from "../viewer-page.ts";
import { appPoPath, appPot, localeStrings, potCurrent, readCatalog } from "../web-app-strings.ts";
import { extractTemplates, injectStrings, targetLocales } from "../gen-web-apps.ts";
import { existsSync, readFileSync } from "node:fs";

const tmp = mkdtempSync(join(tmpdir(), "web-apps-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const manifest = (over: Record<string, unknown> = {}) => ({
  $schema: WEB_APP_V01,
  id: "onboarding-game",
  title: "Join the Network",
  description: "A country onboards to the GDHCN.",
  locales: ["en", "fr"],
  ...over,
});

function appDir(name: string, files: Record<string, string>): string {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  for (const [f, body] of Object.entries(files)) writeFileSync(join(dir, f), body);
  return dir;
}

describe("web-app/0.1.0", () => {
  test("defaults: npm, the build script, dist/, no chrome", () => {
    const a = parseWebApp(manifest());
    expect(a.build).toEqual({ installer: "npm", script: "build", outDir: "dist" });
    expect(a.chrome).toBe("none");
    expect(installCommand(a)).toEqual(["npm", "ci", "--no-audit", "--no-fund"]);
    expect(buildCommand(a)).toEqual(["npm", "run", "build"]);
  });
  test("bun installer", () => {
    const a = parseWebApp(manifest({ build: { installer: "bun" } }));
    expect(installCommand(a)[0]).toBe("bun");
    expect(buildCommand(a)).toEqual(["bun", "run", "build"]);
  });
  test("refuses an id that is not a route segment, an outDir that climbs out, and no locales", () => {
    expect(() => parseWebApp(manifest({ id: "Onboarding Game" }))).toThrow(/kebab/);
    expect(() => parseWebApp(manifest({ build: { outDir: "../site" } }))).toThrow(/inside the app/);
    expect(() => parseWebApp(manifest({ locales: [] }))).toThrow();
  });
  test("refuses chrome other than none, and unknown fields", () => {
    expect(() => parseWebApp(manifest({ chrome: "navbar" }))).toThrow();
    expect(() => parseWebApp(manifest({ extra: 1 }))).toThrow();
  });
});

describe("readApp", () => {
  test("a complete app has no problem", () => {
    const dir = appDir("ok", {
      "web-app.json": JSON.stringify(manifest()),
      "package.json": JSON.stringify({ scripts: { build: "vite build" } }),
      "package-lock.json": "{}",
    });
    expect(readApp(dir)).toEqual({ app: parseWebApp(manifest()) });
  });
  test("names what is missing, in words", () => {
    expect(readApp(appDir("none", {})).problem).toMatch(/no web-app.json/);
    expect(readApp(appDir("noscript", { "web-app.json": JSON.stringify(manifest()), "package.json": "{}" })).problem).toMatch(/no "build" script/);
    expect(
      readApp(appDir("nolock", { "web-app.json": JSON.stringify(manifest()), "package.json": JSON.stringify({ scripts: { build: "x" } }) })).problem,
    ).toMatch(/no lockfile/);
  });
});

describe("routeClashes", () => {
  test("two layers declaring one app id are both named", () => {
    const app = parseWebApp(manifest());
    const a: DeclaredApp = { layer: "smart-trust", layerRoot: "/st", directory: "onboarding-game", dir: "/a", app };
    const b: DeclaredApp = { layer: "smart-trust-demo", layerRoot: "/std", directory: "game", dir: "/b", app };
    const [c] = routeClashes([a, b]);
    expect(c).toContain("smart-trust/onboarding-game");
    expect(c).toContain("smart-trust-demo/game");
    expect(routeClashes([a])).toEqual([]);
  });
});

describe("markChromeless", () => {
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>`;
  test("adds the navbar opt-out and rendered-by, once", () => {
    const once = markChromeless(page);
    expect(once).toContain(NAVBAR_OPT_OUT);
    expect(once).toContain(`<meta name="rendered-by" content="web-app-build">`);
    expect(markChromeless(once)).toBe(once);
    expect(once.split(NAVBAR_OPT_OUT).length).toBe(2);
  });
  test("leaves a fragment with no head alone", () => {
    expect(markChromeless("<p>hi</p>")).toBe("<p>hi</p>");
  });
});

describe("indexHtml", () => {
  test("links a built app relatively, and flags one over its budget", () => {
    const app = parseWebApp(manifest({ sizeBudgetMB: 10 }));
    const html = indexHtml([{ layer: "smart-trust", app, bytes: 40e6 }]);
    expect(html).toContain(`href="onboarding-game/"`);
    expect(html).toContain("over its 10 MB budget");
  });
  test("names an app it could not build, without a link", () => {
    const app = parseWebApp(manifest());
    const html = indexHtml([{ layer: "smart-trust", app, problem: "build failed" }]);
    expect(html).not.toContain(`href="onboarding-game/"`);
    expect(html).toContain("Not built:");
  });
  test("says so when nothing is declared", () => {
    expect(indexHtml([])).toContain("No directory of kind");
  });
});

describe("translation through the harness's process", () => {
  const catalog = { "title.start": "Start onboarding", "splash.liveIn": "Live in {domains}." };
  const po = (entries: [string, string, string][]) =>
    entries.map(([ctx, id, str]) => `msgctxt "${ctx}"\nmsgid "${id}"\nmsgstr "${str}"\n`).join("\n");

  test("the template carries one ui-string per key, the key as msgctxt", () => {
    const pot = appPot({ id: "onboarding-game", title: "Join the Network" }, catalog, "onboarding-game/i18n/en.json", "fr");
    expect(pot).toContain('msgctxt "title.start"');
    expect(pot).toContain('msgid "Live in {domains}."');
    expect(pot).toContain('"Language: fr\\n"');
    expect(potCurrent(pot.replace(/POT-Creation-Date: [^\\]*/, "POT-Creation-Date: 1999"), pot)).toBe(true);
    expect(potCurrent(undefined, pot)).toBe(false);
  });
  test("a locale: translated, missing, placeholder dropped, stale", () => {
    const r = localeStrings(
      catalog,
      po([
        ["title.start", "Start onboarding", "Commencer"],
        ["splash.liveIn", "Live in {domains}.", "En service."],
        ["gone", "Old text", "Ancien"],
      ]),
    );
    expect(r.strings).toEqual({ "title.start": "Commencer" });
    expect(r.placeholderErrors).toEqual(["splash.liveIn"]);
    expect(r.stale).toEqual(["gone"]);
    expect(localeStrings(catalog, "").missing.sort()).toEqual(["splash.liveIn", "title.start"]);
  });
  test("a catalog must be flat strings", () => {
    expect(() => readCatalog({ a: 1 }, "x")).toThrow(/not a non-empty string at a/);
    expect(() => readCatalog([], "x")).toThrow(/flat JSON object/);
  });
  test("templates are written per target locale in the layer, and the build writes each locale's JSON", () => {
    const layerRoot = join(tmp, "layer");
    const dir = join(layerRoot, "game");
    mkdirSync(join(dir, "i18n"), { recursive: true });
    writeFileSync(join(dir, "i18n", "en.json"), JSON.stringify(catalog));
    const app = parseWebApp(manifest({ locales: ["en", "fr", "ar"], i18n: { catalog: "i18n/en.json", out: "public/i18n" } }));
    const a = { layer: "l", layerRoot, directory: "game", dir, app };
    expect(targetLocales(app)).toEqual(["fr", "ar"]);
    expect(extractTemplates(a, true)).toHaveLength(2);
    expect(extractTemplates(a, false)).toEqual([]);
    expect(existsSync(join(layerRoot, appPoPath(app, "ar", "pot")))).toBe(true);
    expect(extractTemplates(a, true)).toEqual([]);
    mkdirSync(join(layerRoot, "translations", "fr", "apps"), { recursive: true });
    writeFileSync(join(layerRoot, appPoPath(app, "fr", "po")), po([["title.start", "Start onboarding", "Commencer"]]));
    expect(injectStrings(a, false)).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, "public", "i18n", "fr.json"), "utf-8"))).toEqual({ "title.start": "Commencer" });
    expect(JSON.parse(readFileSync(join(dir, "public", "i18n", "ar.json"), "utf-8"))).toEqual({});
  });
});

describe("an app the mount did not bring", () => {
  // A downstream mounts only the directories its index lists: a lock may
  // mount a layer's glossary and translations, not its game. The
  // declaration still names the game, so the build must say "not here" rather
  // than fail on a missing web-app.json.
  test("is listed as unmounted and never read, while a held one is read", () => {
    const repo = join(tmp, "repo-unmounted");
    const layer = join(repo, "lay");
    mkdirSync(layer, { recursive: true });
    writeFileSync(
      join(layer, "lay.json"),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name: "lay",
        version: "0.1.0",
        title: "lay",
        description: "a fixture layer",
        directories: [
          { id: "held-game", path: "held-game/", graphTypologies: ["web-app"], description: "held" },
          { id: "away-game", path: "away-game/", graphTypologies: ["web-app"], description: "not mounted" },
        ],
      }),
    );
    mkdirSync(join(layer, "held-game"));
    expect(unmountedApps(repo).map((a) => a.directory)).toEqual(["away-game"]);
    const held = declaredApps(repo);
    expect(held.map((a) => a.directory)).toEqual(["held-game"]);
    expect(held[0]!.problem).toMatch(/no web-app.json/);
  });
});
