/**
 * Routes a visualiser builds on the HOST site (`builtOnHostSite`; bean
 * folio-assistant-uldr, owner option "1", 2026-11-06) are derived into the
 * publish plan, so the host lists none of them. Two halves are pure and
 * checked here: where a derived route sits in the host's writer order, and
 * which locales a translated viewer writes.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { rendererShell, translatedLocales, withHostSiteArtefacts, writerEdges, writersOf, type DeclaredArtefact } from "../../derive-at-publish.ts";

const entry = (instance: string, path: string, writer: string, extra: Partial<DeclaredArtefact> = {}): DeclaredArtefact => ({
  instance,
  abs: `/r/${instance}/${path}`,
  path,
  writer: [writer],
  because: "checkout",
  ...extra,
});

describe("a derived route keeps the host's writer order", () => {
  const declared = [
    entry("host", "docs/a/", "a:pages"),
    entry("host", "docs/assets/glossary/", "glossary:page", { index: true }),
    entry("host", "docs/z/", "z:pages", { reads: ["docs"] }),
  ];
  const derived = [
    entry("host", "docs/en/core/glossary/", "glossary:page", { index: true, hostSiteOf: "core" }),
    entry("host", "docs/fr/core/glossary/", "glossary:page", { index: true, optional: true, hostSiteOf: "core" }),
    entry("host", "docs/en/core/bibliography/", "bibliography:page", { hostSiteOf: "core" }),
  ];

  test("a route goes after its writer's own entry, and a new writer after its harness's last route", () => {
    expect(withHostSiteArtefacts(declared, derived).map((a) => a.path)).toEqual([
      "docs/a/",
      "docs/assets/glossary/",
      "docs/en/core/glossary/",
      "docs/fr/core/glossary/",
      "docs/en/core/bibliography/",
      "docs/z/",
    ]);
  });

  test("so the bibliography writer runs before a writer that reads the site, exactly as when the host listed it", () => {
    const listed = [declared[0]!, declared[1]!, entry("host", "docs/en/core/bibliography/", "bibliography:page"), declared[2]!];
    expect(writersOf(withHostSiteArtefacts(declared, derived))).toEqual(writersOf(listed));
  });

  test("with no place to go, a route goes at the end", () => {
    expect(withHostSiteArtefacts([], derived.slice(2)).map((a) => a.path)).toEqual(["docs/en/core/bibliography/"]);
  });
});

describe("a host that does not list the writer declares no order for it (a downstream IG root)", () => {
  // The shape that failed: the platform lists the glossary before the pages
  // that read the IG's docs and before the context; the IG root, the host,
  // lists its context before its pages and no glossary. Read as listed by the
  // host, the routes at its end closed a cycle and nothing was built.
  // declared-path-literal: test vectors for the host-site order rule, declarations the test builds itself; that the platform's built context exists in a checkout is beside the point.
  const declared = [
    entry("platform", "docs/assets/glossary/", "glossary:page", { index: true }),
    entry("platform", "docs/base/", "base:pages"),
    entry("platform", "ns/context/v1.jsonld", "jsonld:contexts"), // declared-path-literal: a writer-order test fixture (a declared route in memory), not a read; it matches this repo's built context only where jsonld:contexts already ran
    entry("ig", "ns/context/v1.jsonld", "jsonld:contexts"), // declared-path-literal: a writer-order test fixture (a declared route in memory), not a read; it matches this repo's built context only where jsonld:contexts already ran
    entry("ig", "docs/", "ig:pages"),
  ];
  const derived = [
    entry("ig", "docs/en/core/glossary/", "glossary:page", { index: true, hostSiteOf: "core" }),
    entry("ig", "docs/en/core/bibliography/", "bibliography:page", { hostSiteOf: "core" }),
  ];

  test("no cycle, and the harness's own viewers keep their order", () => {
    const order = writersOf(withHostSiteArtefacts(declared, derived));
    expect(order).toContain("ig:pages");
    expect(order.indexOf("glossary:page")).toBeLessThan(order.indexOf("bibliography:page"));
    expect(order.indexOf("glossary:page")).toBeLessThan(order.indexOf("base:pages"));
  });

  test("the edges name the harness, never the host, for its routes", () => {
    const whys = writerEdges(withHostSiteArtefacts(declared, derived)).map((e) => e.why);
    expect(whys.some((w) => w.startsWith("ig lists") && /glossary|bibliography/.test(w))).toBe(false);
    expect(whys).toContain("core declares its host-site viewer of glossary:page before that of bibliography:page");
  });
});

describe("the locales a translated viewer writes", () => {
  let tmp: string;
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "host-site-locales-"));
    const decl = (name: string, directories: unknown[]) => {
      const p = join(tmp, name, `${name}.json`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ name, needs: [], directories }));
    };
    decl("host", [{ id: "host-translations", path: "translations/", graphTypologies: ["translation-sources"] }]);
    decl("upper", [{ id: "upper-translations", path: "po/", graphTypologies: ["translation-sources"] }]);
    for (const d of ["host/translations/fr/glossary", "host/translations/en", "host/translations/_tmp", "upper/po/ar", "upper/po/fr"]) mkdirSync(join(tmp, d), { recursive: true });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test("every layer's translation-sources locales, once each, the page locale and non-locale folders aside", () => {
    expect(translatedLocales(tmp)).toEqual(["ar", "fr"]);
  });
});

describe("the Tool that draws a host-site page (cat-harness#1150)", () => {
  let tmp: string;
  const shell = "bun run cat state:visualizer";
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "host-site-renderer-"));
    const write = (p: string, body: unknown) => {
      mkdirSync(dirname(join(tmp, p)), { recursive: true });
      writeFileSync(join(tmp, p), JSON.stringify(body));
    };
    write("base/base.json", { name: "base", needs: [], directories: [{ id: "base-tools", path: "tools/", graphTypologies: ["tools"] }] });
    write("base/tools/state-viewer/state-viewer.json", {
      $schema: "tool-definition/v1",
      tool: { id: "state-viewer", title: "State graph viewer", description: "Draws state pages.", install: { none: true }, invoke: { shell }, io: { inputs: [], outputs: [] }, satisfies: ["graph-rendering"], renders: ["editor-checkers"] },
    });
    write("top/top.json", { name: "top", needs: ["base"], directories: [] });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test("a page declared above the layer that holds its Tool resolves to that Tool's script", () => {
    expect(rendererShell(tmp, { renderedBy: "state-viewer", harnessRoot: join(tmp, "top") })).toBe(shell);
  });

  test("the declaring layer's own Tool still resolves", () => {
    expect(rendererShell(tmp, { renderedBy: "state-viewer", harnessRoot: join(tmp, "base") })).toBe(shell);
  });

  test("a Tool no layer holds resolves to nothing, so the page is refused", () => {
    expect(rendererShell(tmp, { renderedBy: "no-such-tool", harnessRoot: join(tmp, "top") })).toBeUndefined();
  });
});
