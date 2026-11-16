/**
 * A site's scope (owner, 2026-11-08, Q-SZ-2 "B"): an IG's site writes the
 * pages of the IG and the layer it lands on, and links every other layer's
 * pages on that layer's own site instead of copying them.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inScope, scopeArg, siteScope } from "../lib/site-scope.ts";
import { relinkOutOfScope, SCOPE_RULING, scopeDropped, siteScopeOf } from "../build-instance-site.ts";
import { writerArgv, type VisualiserWriter } from "../visualiser-writers.ts";
import { withoutLayers } from "../gen-tools-viz.ts";

describe("site-scope — the --scope flag", () => {
  test("no flag is no scope: every instance is written", () => {
    expect(siteScope(["bun", "w.ts", "--site", "x"])).toBeUndefined();
    expect(inScope(undefined, "cat-harness")).toBe(true);
  });

  test("the flag names the instances, comma-separated", () => {
    const s = siteScope(["bun", "w.ts", "--scope", "smart-base, smart-immunizations"]);
    expect([...s!].sort()).toEqual(["smart-base", "smart-immunizations"]);
    expect(inScope(s, "smart-base")).toBe(true);
    expect(inScope(s, "cat-harness")).toBe(false);
  });

  test("a flag with no names is refused, never read as everything", () => {
    expect(() => siteScope(["--scope"])).toThrow();
    expect(() => siteScope(["--scope", "--site"])).toThrow();
    expect(() => siteScope(["--scope", ","])).toThrow();
  });

  test("the value is sorted and once each", () => {
    expect(scopeArg(["b", "a", "b"])).toBe("a,b");
  });
});

describe("siteScopeOf — a site writes its own pages", () => {
  const dir = mkdtempSync(join(tmpdir(), "site-scope-"));
  const cfg = (site: unknown): string => {
    writeFileSync(join(dir, "index.config.json"), JSON.stringify({ site }));
    return dir;
  };

  test("the IG only: its landing layer lends chrome, not pages", () => {
    expect(siteScopeOf(cfg({ landing: "smart-base" }), "smart-immunizations")).toEqual(["smart-immunizations"]);
  });

  test("a folio that lands on itself: its own pages only, the other layers linked", () => {
    // owner, 2026-11-13: "other harnesses should be referenced not included".
    expect(siteScopeOf(cfg({ landing: "folio" }), "folio")).toEqual(["folio"]);
    expect(siteScopeOf(cfg({ landing: "smart-base" }), "smart-base")).toEqual(["smart-base"]);
  });

  test("the hub, or a checkout that names no landing, has no scope", () => {
    expect(siteScopeOf(cfg({ landing: "hub" }), "x")).toBeUndefined();
    expect(siteScopeOf(cfg({}), "x")).toBeUndefined();
    rmSync(join(dir, "index.config.json"));
    expect(siteScopeOf(dir, "x")).toBeUndefined();
  });
});

describe("writerArgv — the scope reaches a writer that declares it", () => {
  const w: VisualiserWriter = { tool: "t", visualisers: [], invoke: ["bun", "run", "x/gen.ts"], siteFlag: "--site" };

  test("declared: passed", () => {
    expect(writerArgv("/r", { ...w, scopeFlag: "--scope" }, "/s", ["smart-immunizations", "smart-base"])).toEqual(["bun", "run", "x/gen.ts", "--site", "/s", "--scope", "smart-base,smart-immunizations"]);
  });

  test("not declared: not passed, and the writer writes everything as before", () => {
    expect(writerArgv("/r", w, "/s", ["smart-base"]).join(" ")).not.toContain("--scope");
  });
});

describe("relinkOutOfScope — another layer's page is linked on its own site", () => {
  test("a dead link under a visualiser route points at linkRoot; a live one and any other dead one are left alone", async () => {
    const site = mkdtempSync(join(tmpdir(), "relink-"));
    mkdirSync(join(site, "en/h/processes"), { recursive: true });
    writeFileSync(join(site, "en/h/processes/mine.html"), "x");
    const page = join(site, "en/h/processes/index.html");
    writeFileSync(
      page,
      `<a href="mine.html">mine</a> <a href="theirs.html#step">theirs</a> <a href="../../../other/missing.html">gone</a> <a href="https://e.org/">out</a>`,
    );
    const r = await relinkOutOfScope(site, "/repo/", "https://example.org/platform/", ["en/h/processes/"]);
    expect(r).toEqual({ links: 1, pages: 1 });
    const html = readFileSync(page, "utf-8");
    expect(html).toContain(`href="mine.html"`);
    expect(html).toContain(`href="https://example.org/platform/en/h/processes/theirs.html#step"`);
    expect(html).toContain(`href="../../../other/missing.html"`);
    rmSync(site, { recursive: true, force: true });
  });
});

describe("scopeDropped — the parity guard lets a scoped site leave other layers' pages out", () => {
  const mk = (files: string[]): string => {
    const d = mkdtempSync(join(tmpdir(), "scope-drop-"));
    for (const f of files) {
      mkdirSync(join(d, f, ".."), { recursive: true });
      writeFileSync(join(d, f), "x");
    }
    return d;
  };
  test("only directories that hold nothing but out-of-scope layers' pages", () => {
    const current = mk([
      "who-iris/index.html", // an out-of-scope layer, as the directory
      "docs/who-iris/README.html", // one level down
      "ar/core/glossary/index.html", // a locale route of an out-of-scope layer
      "catalogue/index.html", // its own-site route
      "mixed/core/a.html", // ...but this directory also holds the IG's page
      "mixed/ig-page.html",
      "artifact/x.html", // still in the candidate: not considered
    ]);
    const candidate = mk(["artifact/x.html"]);
    const dropped = scopeDropped(current, candidate, ["ig"], ["ig", "who-iris", "core"], ["who-iris/catalogue/", "en/who-iris/catalogue/"]);
    expect(dropped.map((d) => d.dir).sort()).toEqual(["ar", "catalogue", "docs", "who-iris"]);
    expect(dropped.every((d) => d.ruling === SCOPE_RULING)).toBe(true);
  });
});

describe("withoutLayers — the Tools viewer writes its scope's layer pages only", () => {
  const pages = new Map([
    ["en/cat-harness/tools/index.md", "all"],
    ["en/cat-harness/tools/openapi.json", "api"],
    ["en/cat-harness/tools/cat-harness/index.md", "ch"],
    ["en/cat-harness/tools/cat-harness/gen-x/index.md", "ch tool"],
    ["en/cat-harness/tools/cat-harness-tools/index.md", "cht"],
    ["en/cat-harness/tools/smart-trust-tools/index.md", "own"],
  ]);

  test("an out-of-scope layer's pages are dropped; the index, the API and the scope's pages stay", () => {
    const kept = withoutLayers(pages, ["en/cat-harness/tools/cat-harness", "en/cat-harness/tools/cat-harness-tools"]);
    expect([...kept.keys()].sort()).toEqual([
      "en/cat-harness/tools/index.md",
      "en/cat-harness/tools/openapi.json",
      "en/cat-harness/tools/smart-trust-tools/index.md",
    ]);
  });

  test("a directory is matched whole, never as a name prefix", () => {
    // `cat-harness` must not drop `cat-harness-tools`.
    const kept = withoutLayers(pages, ["en/cat-harness/tools/cat-harness"]);
    expect(kept.has("en/cat-harness/tools/cat-harness-tools/index.md")).toBe(true);
    expect(kept.has("en/cat-harness/tools/cat-harness/index.md")).toBe(false);
  });

  test("no scope drops nothing", () => {
    expect(withoutLayers(pages, []).size).toBe(pages.size);
  });
});
