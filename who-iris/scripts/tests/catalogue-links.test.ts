/**
 * Bean `qgjh`: the catalogue page's rows lead somewhere. A held item's title
 * links to its library entry page (the replica it used to link was retired on
 * 2026-10-30); a "held as" library id links to the library viewer opened on it. Asserted over the COMMITTED
 * page, since what a reader follows is what was published.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { declaredRoute, siteOwnerDir } from "../../platform.ts";
import { CATALOGUE_VIEWER } from "../gen-iris-pages.ts";

const INSTANCE = resolve(import.meta.dir, "..", "..");
// Standing alone, who-iris mounts its dependencies inside itself; in the index
// checkout they are its siblings. Whichever holds cat-harness is the checkout.
const REPO = existsSync(join(INSTANCE, "cat-harness")) ? INSTANCE : resolve(INSTANCE, "..");
// The page is committed in who-iris's own site directory (wrong-direction move
// M1, 2026-10-20) and PUBLISHED at the route who-iris declares for its
// catalogue visualiser (owner, 2026-10-09) — read, never spelled. Its relative
// links are followed from where it is published, since that is where a reader
// follows them.
const PAGE = CATALOGUE_VIEWER;
const PUBLISHED = join(siteOwnerDir(REPO), ...(declaredRoute(INSTANCE, "iris-pages") ?? "who-iris/catalogue").split("/"));
// The library viewer is built at publish since cat-harness#363: the site's
// owner declares it in `builtAtPublish`, so it is never committed and is on
// disk only after `derive:publish`. Read from the owner's declaration, never
// spelled here.
const OWNER = dirname(siteOwnerDir(REPO));
const builtAtPublish: string[] = readdirSync(OWNER)
  .filter((n) => n.endsWith(".json"))
  .flatMap((n) => {
    try {
      const d = JSON.parse(readFileSync(join(OWNER, n), "utf-8")) as { $schema?: unknown; builtAtPublish?: Array<{ path?: unknown }> };
      if (typeof d.$schema !== "string" || !d.$schema.startsWith("cat-harness-declaration")) return [];
      return (d.builtAtPublish ?? []).map((e) => e.path).filter((x): x is string => typeof x === "string");
    } catch {
      return [];
    }
  });
const declaredBuiltAtPublish = (abs: string): boolean => {
  const rel = relative(OWNER, abs).split("\\").join("/");
  return builtAtPublish.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
};
const html = existsSync(PAGE) ? readFileSync(PAGE, "utf-8") : "";
// Matched by TEXT, not by exact markup: the heading carries an id
// (`<h2 id="…">Every node</h2>`), which is not what this test is about.
const table = html.slice(html.search(/<h2\b[^>]*>Every node<\/h2>/));
const nodes = table.slice(0, table.indexOf("</table>"));

describe("the catalogue's rows lead somewhere (qgjh)", () => {
  it("linksHeldTitlesToLibraryEntries", () => {
    // The IRIS replica's pages are gone (owner, 2026-10-30, option C): the
    // library entry page is an item's one page, so a held item's title links
    // there, at `<locale>/<harness>/library/<instance>/<id>/`.
    expect(nodes).not.toMatch(/href="[^"]*(?:item|collection)-[^"]+\.html"/);
    const entries = [...nodes.matchAll(/href="[^"#]*\/library\/who-iris\/([^"/]+)\/"/g)].map((m) => m[1]!);
    expect(entries.length).toBeGreaterThan(0);
    // A held item has its directory; an item catalogued by reference has its
    // Dublin Core record, and the library publishes its entry page from that
    // (owner, 2026-11-10, card Q-IRIS-5 = A; cat-harness-tools#1765).
    for (const id of entries) {
      const held = existsSync(join(INSTANCE, "library", id));
      const record = existsSync(join(INSTANCE, "catalogue", "records", `${id}.dc.json`));
      expect(held || record, id).toBe(true);
    }
  });

  it("linksLibraryIdsToViewerPage", () => {
    const viewers = [...nodes.matchAll(/href="([^"#]*)#[^"]+"><code>/g)].map((m) => m[1]!);
    expect(viewers.length).toBeGreaterThan(0);
    for (const v of new Set(viewers)) {
      const page = join(PUBLISHED, v, "index.html");
      expect(existsSync(page) || declaredBuiltAtPublish(page), v).toBe(true);
    }
  });
});

describe("the catalogue viewer is THEMED, so it carries the site's top band (2026-10-07)", () => {
  it("isOnDefaultLayout", () => {
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(html).toContain('<h1 id="ic-title">');
  });

  it("stylesOnlyOwnWrapperNoRail", () => {
    const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim())).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.filter((s) => !/^(:root\[data-fa-scheme="light"\] )?\.ic-page\b/.test(s))).toEqual([]);
    expect(html).not.toContain('<nav class="fa-nav"');
  });
});
