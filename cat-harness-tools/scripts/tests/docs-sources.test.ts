/**
 * `lib/docs-sources.ts` — which docs sources one `gen-docs-pages` run renders
 * (owner, 2026-10-23, "A1": one run, every mounted layer's declared
 * docs-source).
 *
 * @module scripts/tests/docs-sources
 * @graphNode none — a test
 *
 * On throwaway trees, so each rule is falsified on its own: a dependent that
 * declares a docs source is found and renders into the directory that
 * declares it; one that declares none, declares an absent one, or declares it
 * under a non-`docs` or repository-scoped directory contributes nothing; and
 * the base layer's own source is always first and never read twice. And
 * the same page in two sources is two pages — every key above the base is
 * qualified by its layer — which is warned about, naming both files, and
 * never refused (owner, 2026-10-23).
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { declaredDocsSources, docsPageOf, docsSources, qualifiedKey, siteNodeOf, warnSamePages, type DocsSource } from "../lib/docs-sources.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tree(): string {
  const d = mkdtempSync(join(tmpdir(), "docs-sources-"));
  made.push(d);
  return d;
}

function instance(
  at: string,
  name: string,
  directories: Array<{ id: string; path: string; graphTypologies: string[]; scope?: string }>,
): string {
  const root = join(at, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, `${name}.json`), JSON.stringify({ name, directories }));
  return root;
}

function docsJson(dir: string, sourcePath: string | undefined, makeSource = true): void {
  mkdirSync(dir, { recursive: true });
  const directories = sourcePath === undefined ? [] : [{ id: "docs-source", path: sourcePath, graphTypologies: ["docs"] }];
  writeFileSync(join(dir, "docs.json"), JSON.stringify({ name: "x", directories }));
  if (sourcePath !== undefined && makeSource) mkdirSync(join(dir, sourcePath), { recursive: true });
}

describe("declaredDocsSources", () => {
  test("a docs directory whose docs.json declares a docs-source: pages render into that directory", () => {
    const t = tree();
    const root = instance(t, "upper", [{ id: "upper-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(root, "docs"), "source/");
    expect(declaredDocsSources(root)).toEqual([
      { instance: "upper", root, srcDir: join(root, "docs", "source"), outDir: join(root, "docs"), base: false },
    ]);
  });

  test("any instance-scoped docs directory may declare one, not only `docs/`", () => {
    const t = tree();
    const root = instance(t, "ig", [
      { id: "ig-pages", path: "docs/", graphTypologies: ["docs", "ig-pages"] },
      { id: "ig-site-docs", path: "site-docs/", graphTypologies: ["docs"] },
    ]);
    docsJson(join(root, "site-docs"), "source");
    const found = declaredDocsSources(root);
    expect(found.map((s) => s.outDir)).toEqual([join(root, "site-docs")]);
    expect(found[0]!.srcDir).toBe(join(root, "site-docs", "source"));
  });

  test("nothing declared, an absent source, a non-docs directory or a repository-scoped one: no source", () => {
    const t = tree();
    const none = instance(t, "none", [{ id: "d", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(none, "docs"), undefined);
    const absent = instance(t, "absent", [{ id: "d", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(absent, "docs"), "source", false);
    const notDocs = instance(t, "notdocs", [{ id: "d", path: "library/", graphTypologies: ["library"] }]);
    docsJson(join(notDocs, "library"), "source");
    const repo = instance(t, "repo", [{ id: "d", path: "docs/", graphTypologies: ["docs"], scope: "repository" }]);
    docsJson(join(repo, "docs"), "source");
    for (const r of [none, absent, notDocs, repo]) expect(declaredDocsSources(r)).toEqual([]);
    expect(declaredDocsSources(join(t, "no-such-instance"))).toEqual([]);
  });
});

describe("docsSources", () => {
  test("the base instance first, unchanged; then each dependent that declares one, in the order given", () => {
    const t = tree();
    const base = instance(t, "base", [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(base, "docs"), "source");
    const a = instance(t, "a", [{ id: "a-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(a, "docs"), "source");
    const silent = instance(t, "silent", [{ id: "s", path: "docs/", graphTypologies: ["docs"] }]);
    const b = instance(t, "b", [{ id: "b-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(b, "docs"), "source");

    const found = docsSources(base, [
      { name: "a", root: a },
      { name: "silent", root: silent },
      { name: "b", root: b },
    ]);
    expect(found.map((s) => [s.instance, s.base])).toEqual([
      ["base", true],
      ["a", false],
      ["b", false],
    ]);
    expect(found[0]!.srcDir).toBe(join(base, "docs", "source"));
    expect(found[0]!.outDir).toBe(join(base, "docs"));
  });

  test("a source reached twice is read once", () => {
    const t = tree();
    const base = instance(t, "base", [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(base, "docs"), "source");
    const a = instance(t, "a", [{ id: "a-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(a, "docs"), "source");
    const found = docsSources(base, [
      { name: "a", root: a },
      { name: "a", root: a },
      { name: "base", root: base },
    ]);
    expect(found.map((s) => s.instance)).toEqual(["base", "a"]);
  });
});

describe("the same page in two sources", () => {
  function page(srcDir: string, flat: string): void {
    mkdirSync(join(srcDir, flat), { recursive: true });
  }

  test("every key above the base is qualified by its instance; the base's are unchanged", () => {
    const t = tree();
    const base = instance(t, "base", [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(base, "docs"), "source");
    const up = instance(t, "up", [{ id: "up-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(up, "docs"), "source");
    const [b, u] = docsSources(base, [{ name: "up", root: up }]);
    expect(qualifiedKey(b!, "guides/x")).toBe("guides/x");
    expect(qualifiedKey(u!, "guides/x")).toBe("up/guides/x");
    expect(qualifiedKey(b!, "guides-x")).not.toBe(qualifiedKey(u!, "guides-x"));
  });

  test("a page in a lower and a higher source: both kept, one warning naming both files", () => {
    const t = tree();
    const base = instance(t, "base", [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(base, "docs"), "source");
    const up = instance(t, "up", [{ id: "up-docs", path: "docs/", graphTypologies: ["docs"] }]);
    docsJson(join(up, "docs"), "source");
    page(join(base, "docs", "source"), "guides-moved");
    page(join(up, "docs", "source"), "guides-moved");
    page(join(up, "docs", "source"), "guides-only-up");
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const found = docsSources(base, [{ name: "up", root: up }]);
      expect(found.map((s) => s.instance)).toEqual(["base", "up"]);
      const msgs = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('"guides-moved"'));
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toContain("base/docs/source/guides-moved");
      expect(msgs[0]).toContain("up/docs/source/guides-moved");
      expect(msgs[0]).toMatch(/move in flight/);
      expect(warn.mock.calls.some((c) => String(c[0]).includes("guides-only-up"))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  test("two sources of ONE instance holding one page: warned, not refused", () => {
    const t = tree();
    const root = instance(t, "ig", [
      { id: "a", path: "docs/", graphTypologies: ["docs"] },
      { id: "b", path: "site-docs/", graphTypologies: ["docs"] },
    ]);
    docsJson(join(root, "docs"), "source");
    docsJson(join(root, "site-docs"), "source");
    page(join(root, "docs", "source"), "same");
    page(join(root, "site-docs", "source"), "same");
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const dups = warnSamePages(declaredDocsSources(root));
      expect(dups).toEqual([{ page: "same", files: ["ig (ig/docs/source/same)", "ig (ig/site-docs/source/same)"] }]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("siteNodeOf — where a page's site JSON-LD is published", () => {
  function sources(): DocsSource[] {
    const t = tree();
    const base: DocsSource = { instance: "base", root: join(t, "base"), srcDir: join(t, "base", "docs", "source"), outDir: join(t, "base", "docs"), base: true };
    const upper: DocsSource = { instance: "upper", root: join(t, "upper"), srcDir: join(t, "upper", "docs", "source"), outDir: join(t, "upper", "docs"), base: false };
    mkdirSync(join(base.srcDir, "process-x"), { recursive: true });
    mkdirSync(join(upper.srcDir, "process-y"), { recursive: true });
    return [base, upper];
  }

  test("a base page: site/<slug>/nodes/<id>.jsonld, in the base's site directory", () => {
    const s = sources();
    expect(siteNodeOf(s, "process/x", "n")).toEqual({
      sitePath: "site/process/x/nodes/n.jsonld",
      file: join(s[0]!.outDir, "site/process/x/nodes/n.jsonld"),
    });
  });

  test("a page above the base: under its instance, as gen-site-jsonld publishes it — never site/<instance>/…", () => {
    const s = sources();
    expect(siteNodeOf(s, qualifiedKey(s[1]!, "process/y"), "n")).toEqual({
      sitePath: "upper/site/process/y/nodes/n.jsonld",
      file: join(s[1]!.outDir, "site/process/y/nodes/n.jsonld"),
    });
  });

  test("a key that only LOOKS qualified, naming no page of that source, is the base's", () => {
    const s = sources();
    expect(siteNodeOf(s, "upper/process/x").sitePath).toBe("site/upper/process/x.jsonld");
  });
});

describe("docsPageOf — the rendered page, from the source that holds it", () => {
  function sources(): DocsSource[] {
    const t = tree();
    const base: DocsSource = { instance: "base", root: join(t, "base"), srcDir: join(t, "base", "docs", "source"), outDir: join(t, "base", "docs"), base: true };
    const upper: DocsSource = { instance: "upper", root: join(t, "upper"), srcDir: join(t, "upper", "docs", "source"), outDir: join(t, "upper", "docs"), base: false };
    mkdirSync(join(base.srcDir, "process-x"), { recursive: true });
    mkdirSync(join(upper.srcDir, "process-y"), { recursive: true });
    mkdirSync(join(upper.srcDir, "process-x"), { recursive: true });
    return [base, upper];
  }

  test("a page that moved up is read from the layer that holds it, under its qualified key", () => {
    const s = sources();
    expect(docsPageOf(s, "process/y")).toEqual({ source: s[1]!, key: "upper/process/y", file: join(s[1]!.outDir, "process/y.md") });
  });

  test("a page in two layers (a move in flight) answers from the lower one", () => {
    const s = sources();
    expect(docsPageOf(s, "process/x")?.file).toBe(join(s[0]!.outDir, "process/x.md"));
  });

  test("a page no source holds is undefined, not a guessed path", () => {
    expect(docsPageOf(sources(), "process/z")).toBeUndefined();
  });
});
