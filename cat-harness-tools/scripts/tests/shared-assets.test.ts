/**
 * Shared assets (owner, 2026-11-09, Q-SZ-7 "A"): an IG site loads LHC-Forms,
 * the ✍ editor bundle and the harness images from one host on its origin.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dirDigest, dirKey, pagesBranchUrl, rewriteRefs, shareAssets, sharedDirsIn, sharedUrl, stageShared, withMeta } from "../lib/shared-assets.ts";
import { sharedAssetsOf } from "../build-instance-site.ts";

const HOST = "https://o.github.io/hub/";
const site = (files: Record<string, string>): string => {
  const d = mkdtempSync(join(tmpdir(), "shared-assets-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), body);
  }
  return d;
};

describe("shared-assets — which directories, and their addresses", () => {
  test("the fixed directories and every LHC-Forms version a site holds", () => {
    const d = site({ "assets/img/harness/a.webp": "a", "assets/lhc-forms/44.1.0/x.js": "x", "assets/lhc-forms/45.0.0/x.js": "y", "assets/img/other/b.png": "b" });
    expect(sharedDirsIn(d)).toEqual(["assets/img/harness/", "assets/lhc-forms/44.1.0/", "assets/lhc-forms/45.0.0/"]);
    rmSync(d, { recursive: true });
  });

  test("the Form Builder's bundle, but not the builder's own pages", () => {
    const d = site({ "assets/formbuilder-bundle/12.9.0/main.js": "m", "assets/formbuilder/12.9.0/index.html": "<html>" });
    expect(sharedDirsIn(d)).toEqual(["assets/formbuilder-bundle/12.9.0/"]);
    rmSync(d, { recursive: true });
  });

  test("the builder's worker finds a shared bundle through its percent-encoded query value", () => {
    const url = "https://o.github.io/hub/shared/assets/formbuilder-bundle/12.9.0/k/";
    const w = rewriteRefs('register("fa-terminology-sw.js?v=44.1.0&bundle=..%2F..%2Fformbuilder-bundle%2F12.9.0%2F")', "assets/formbuilder-bundle/12.9.0/", url);
    expect(w.n).toBe(1);
    expect(w.text).toContain(`bundle=${encodeURIComponent(url)}`);
  });

  test("the key is the content, or the build record when the bundle carries one", () => {
    const a = site({ "x/f.js": "1" });
    const b = site({ "x/f.js": "1" });
    const c = site({ "x/f.js": "2" });
    expect(dirDigest(join(a, "x"))).toBe(dirDigest(join(b, "x")));
    expect(dirDigest(join(a, "x"))).not.toBe(dirDigest(join(c, "x")));
    writeFileSync(join(a, "x/.build.json"), '{"v":1}');
    writeFileSync(join(c, "x/.build.json"), '{"v":1}');
    expect(dirKey(join(a, "x"))).toBe(dirKey(join(c, "x")));
    for (const d of [a, b, c]) rmSync(d, { recursive: true });
  });

  test("the address names the directory and its key", () => {
    expect(sharedUrl(HOST, "assets/img/harness/", "abc")).toBe("https://o.github.io/hub/shared/assets/img/harness/abc/");
  });
});

describe("rewriteRefs — addresses change, prose does not", () => {
  const U = "https://o.github.io/hub/shared/assets/img/harness/k/";
  test("CSS url(), attributes, the rail's root prefix", () => {
    const html = [
      `<style>.h{background:url("../../../assets/img/harness/a-laptop.webp")}</style>`,
      `<img src="/si/assets/img/harness/b.webp">`,
      `<i data-avatar='assets/img/harness/c.webp'></i>`,
      `"src":"@fa-rail-root@/assets/img/harness/d-card.webp"`,
    ].join("\n");
    const r = rewriteRefs(html, "assets/img/harness/", U);
    expect(r.n).toBe(4);
    expect(r.text).toContain(`url("${U}a-laptop.webp")`);
    expect(r.text).toContain(`src="${U}b.webp"`);
    expect(r.text).toContain(`data-avatar='${U}c.webp'`);
    expect(r.text).toContain(`"src":"${U}d-card.webp"`);
  });

  test("a path in prose, or on another host, is left alone", () => {
    const html = `<code>docs/assets/img/harness/x.webp</code> <a href="https://e.org/assets/img/harness/y.webp">y</a>`;
    expect(rewriteRefs(html, "assets/img/harness/", U)).toEqual({ text: html, n: 0 });
  });

  test("a percent-encoded relative query value (the Form Builder's worker)", () => {
    const L = "https://o.github.io/hub/shared/assets/lhc-forms/44.1.0/k/";
    const r = rewriteRefs(`fa-terminology-sw.js?index=..%2F..%2Fterminology%2Fi.json&lhc=..%2F..%2Flhc-forms%2F44.1.0%2F&v=44.1.0`, "assets/lhc-forms/44.1.0/", L);
    expect(r.n).toBe(1);
    expect(r.text).toContain(`lhc=${encodeURIComponent(L)}&v=`);
    expect(r.text).toContain("index=..%2F..%2Fterminology");
  });

  test("a script's relative module literal, resolved from the script (the SQLite and Graphviz loaders)", () => {
    const S = "https://o.github.io/hub/shared/assets/js/vendor/sqlite-wasm/k/";
    const src = [
      `const SQLITE_URL = new URL("./vendor/sqlite-wasm/index.mjs", import.meta.url).href;`,
      ` * vendored under assets/js/vendor/sqlite-wasm/, never fetched from a third party`,
      `const W = new URL("./slice-sqlite-worker.js", import.meta.url);`,
    ].join("\n");
    const r = rewriteRefs(src, "assets/js/vendor/sqlite-wasm/", S, "assets/js/slice-sqlite.js");
    expect(r.n).toBe(1);
    expect(r.text).toContain(`new URL("${S}index.mjs", import.meta.url)`);
    // The comment's path and the Worker, which must stay same-origin, are left alone.
    expect(r.text).toContain(" * vendored under assets/js/vendor/sqlite-wasm/");
    expect(r.text).toContain(`"./slice-sqlite-worker.js"`);
    // From a deeper script the literal climbs; without `from`, or in a page, it is not resolved.
    expect(rewriteRefs(`import('../js/vendor/sqlite-wasm/index.mjs')`, "assets/js/vendor/sqlite-wasm/", S, "assets/x/a.mjs").text).toBe(`import('${S}index.mjs')`);
    expect(rewriteRefs(src, "assets/js/vendor/sqlite-wasm/", S).n).toBe(0);
    expect(rewriteRefs(`"./vendor/sqlite-wasm/index.mjs"`, "assets/js/vendor/sqlite-wasm/", S, "assets/js/a.html").n).toBe(0);
  });

  test("a page names each shared directory in a meta", () => {
    expect(withMeta("<html><head><title>t</title>", [{ dir: "assets/vendor/crepe/", url: "https://h/c/" }])).toBe(
      `<html><head><meta name="fa-shared-asset" data-dir="assets/vendor/crepe/" content="https://h/c/"><title>t</title>`,
    );
  });
});

describe("shareAssets — the site points at the host and drops its copies", () => {
  test("a served directory is shared and deleted; one the host lacks is kept", async () => {
    const d = site({
      "index.html": `<head></head><img src="assets/img/harness/a.webp"><div data-lhc="assets/lhc-forms/44.1.0/"></div>`,
      "assets/img/harness/a.webp": "a",
      "assets/lhc-forms/44.1.0/x.js": "x",
    });
    const imgUrl = sharedUrl(HOST, "assets/img/harness/", dirKey(join(d, "assets/img/harness")));
    const r = await shareAssets(d, HOST, async (u) => u === `${imgUrl}.shared.json`);
    expect(r.shared.map((s) => [s.dir, s.refs])).toEqual([["assets/img/harness/", 1]]);
    expect(r.kept.map((k) => k.dir)).toEqual(["assets/lhc-forms/44.1.0/"]);
    expect(existsSync(join(d, "assets/img/harness"))).toBe(false);
    expect(existsSync(join(d, "assets/lhc-forms/44.1.0/x.js"))).toBe(true);
    const page = readFileSync(join(d, "index.html"), "utf-8");
    expect(page).toContain(`src="${imgUrl}a.webp"`);
    expect(page).toContain(`data-lhc="assets/lhc-forms/44.1.0/"`);
    // Only a directory a script finds at run time is named in a meta.
    expect(page).not.toContain("fa-shared-asset");
    rmSync(d, { recursive: true });
  });

  test("the vendored SQLite and Graphviz builds are shared; the SQLite Worker stays on the site", async () => {
    const d = site({
      "assets/js/slice-sqlite.js": `const SQLITE_URL = new URL("./vendor/sqlite-wasm/index.mjs", import.meta.url).href;\nnew Worker(new URL("./slice-sqlite-worker.js", import.meta.url), { type: "module" });`,
      "assets/js/slice-sqlite-worker.js": `import { openInScope } from "./slice-sqlite.js";`,
      "assets/js/kg-graph.js": `const GRAPHVIZ = new URL("./vendor/wasm-graphviz/index.js", import.meta.url).href;`,
      "assets/js/vendor/sqlite-wasm/index.mjs": `new URL("sqlite3.wasm", import.meta.url)`,
      "assets/js/vendor/sqlite-wasm/sqlite3.wasm": "w",
      "assets/js/vendor/wasm-graphviz/index.js": "g",
    });
    expect(sharedDirsIn(d)).toEqual(["assets/js/vendor/sqlite-wasm/", "assets/js/vendor/wasm-graphviz/"]);
    const sq = sharedUrl(HOST, "assets/js/vendor/sqlite-wasm/", dirKey(join(d, "assets/js/vendor/sqlite-wasm")));
    const gv = sharedUrl(HOST, "assets/js/vendor/wasm-graphviz/", dirKey(join(d, "assets/js/vendor/wasm-graphviz")));
    const r = await shareAssets(d, HOST, async () => true);
    expect(r.shared.map((s) => [s.dir, s.refs])).toEqual([["assets/js/vendor/sqlite-wasm/", 1], ["assets/js/vendor/wasm-graphviz/", 1]]);
    expect(existsSync(join(d, "assets/js/vendor/sqlite-wasm"))).toBe(false);
    expect(existsSync(join(d, "assets/js/vendor/wasm-graphviz"))).toBe(false);
    const loader = readFileSync(join(d, "assets/js/slice-sqlite.js"), "utf-8");
    expect(loader).toContain(`new URL("${sq}index.mjs", import.meta.url)`);
    expect(loader).toContain(`new URL("./slice-sqlite-worker.js", import.meta.url)`);
    expect(existsSync(join(d, "assets/js/slice-sqlite-worker.js"))).toBe(true);
    expect(readFileSync(join(d, "assets/js/kg-graph.js"), "utf-8")).toContain(`new URL("${gv}index.js", import.meta.url)`);
    rmSync(d, { recursive: true });
  });

  test("the editor bundle, found at run time, is named in each page's meta", async () => {
    const d = site({ "a/index.html": "<html><head></head></html>", "assets/vendor/crepe/crepe.js": "c" });
    const url = sharedUrl(HOST, "assets/vendor/crepe/", dirKey(join(d, "assets/vendor/crepe")));
    await shareAssets(d, HOST, async () => true);
    expect(readFileSync(join(d, "a/index.html"), "utf-8")).toContain(`<meta name="fa-shared-asset" data-dir="assets/vendor/crepe/" content="${url}">`);
    rmSync(d, { recursive: true });
  });

  test("the host stages each directory once, at its key, with a listing", () => {
    const d = site({ "assets/img/harness/a.webp": "a" });
    const out = mkdtempSync(join(tmpdir(), "shared-host-"));
    const [first] = stageShared(d, out);
    expect(first!.written).toBe(true);
    const at = join(out, "shared/assets/img/harness", first!.digest);
    expect(JSON.parse(readFileSync(join(at, ".shared.json"), "utf-8")).files).toEqual(["a.webp"]);
    expect(stageShared(d, out)[0]!.written).toBe(false);
    rmSync(d, { recursive: true });
    rmSync(out, { recursive: true });
  });
});

describe("sharedAssetsOf — the IG opts in", () => {
  test("an https URL ending in / is the host; anything else is none", () => {
    const d = mkdtempSync(join(tmpdir(), "shared-cfg-"));
    const cfg = (site: unknown): string => (writeFileSync(join(d, "index.config.json"), JSON.stringify({ site })), d);
    expect(sharedAssetsOf(cfg({ sharedAssets: HOST }))).toBe(HOST);
    expect(sharedAssetsOf(cfg({ sharedAssets: "http://x/" }))).toBeUndefined();
    expect(sharedAssetsOf(cfg({ sharedAssets: "https://x/no-slash" }))).toBeUndefined();
    expect(sharedAssetsOf(cfg({}))).toBeUndefined();
    rmSync(d, { recursive: true });
  });
});

describe("pagesBranchUrl — a Pages address read through its gh-pages branch", () => {
  test("a project site maps to its repository's gh-pages branch", () => {
    expect(pagesBranchUrl("https://litlfred.github.io/smart-html-jtd/shared/assets/img/harness/abc/.shared.json")).toBe(
      "https://raw.githubusercontent.com/litlfred/smart-html-jtd/gh-pages/shared/assets/img/harness/abc/.shared.json",
    );
  });
  test("any other host has no branch", () => {
    expect(pagesBranchUrl("https://example.org/shared/x/.shared.json")).toBeUndefined();
  });
});
