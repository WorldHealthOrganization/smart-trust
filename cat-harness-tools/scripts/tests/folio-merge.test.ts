/**
 * The folio page merges the published folio graph with the reader's folio in
 * this browser (owner, 2026-11-13: "… and wants in browser cache dont agree.
 * update js to load both dynamically").
 */
import { describe, expect, test } from "bun:test";

import { mergeFolio, type LocalFolioEntry, type PublishedFolioNode } from "../folio-merge.ts";
import { viewerHtml } from "../gen-folio-viz.ts";

const PUB: PublishedFolioNode[] = [
  {
    id: "who-iris",
    summary: "A catalogue by reference",
    theme: "iris-sticky",
    anchor: "page:index",
    declaredIn: "who-iris.json",
    links: [{ label: "WHO IRIS", href: "/who-iris/" }],
    chars: 153,
    file: "folio/who-iris.json",
  },
  { id: "new-sticky", summary: "Published after the reader's last visit", links: [], chars: 10 },
];

const LOCAL: Record<string, LocalFolioEntry> = {
  "who-iris/who-iris": {
    shown: true,
    title: "An old title the reader cached",
    href: "/old/",
    kind: "library",
    geom: { left: -40, top: 12, width: 300, height: 200 },
    zoom: 0.5,
  },
  "pin:https://example.org/ch1#intro": {
    shown: false,
    title: "Chapter 1. Introduction",
    href: "https://example.org/ch1#intro",
    kind: "pin",
    nodeKind: "prose",
    source: "DTH-PHC",
  },
};

describe("mergeFolio — a union keyed by id", () => {
  const m = mergeFolio(PUB, LOCAL, "who-iris");
  const by = Object.fromEntries(m.rows.map((r) => [r.id, r]));

  test("every published node and every local entry is a row: neither side is dropped", () => {
    expect(m.rows.map((r) => r.id)).toEqual(["who-iris", "new-sticky", "pin:https://example.org/ch1#intro"]);
    expect(m.counts).toEqual({ published: 2, local: 2, synced: 1, unsynced: 1, publishedOnly: 1 });
  });

  test("the published copy wins for content", () => {
    const r = by["who-iris"]!;
    expect(r.status).toBe("synced");
    expect(r.key).toBe("who-iris/who-iris");
    expect(r.title).toBe("A catalogue by reference");
    expect(r.href).toBe("/who-iris/");
    expect(r.hrefFrom).toBe("published");
    expect(r.theme).toBe("iris-sticky");
    expect(r.chars).toBe(153);
  });

  test("the local copy wins for the reader's own state, including fields the merge does not know", () => {
    const r = by["who-iris"]!;
    expect(r.shown).toBe(true);
    expect(r.geom).toEqual({ left: -40, top: 12, width: 300, height: 200 });
    expect(r.layout).toEqual({ zoom: 0.5 });
    expect(r.kind).toBe("library");
  });

  test("a newly published node shows even though the browser's folio never held it", () => {
    const r = by["new-sticky"]!;
    expect(r.status).toBe("published");
    expect(r.key).toBeNull();
    expect(r.shown).toBeNull();
  });

  test("a local-only item is kept and marked unsynced, with its own title and address", () => {
    const r = by["pin:https://example.org/ch1#intro"]!;
    expect(r.status).toBe("unsynced");
    expect(r.title).toBe("Chapter 1. Introduction");
    expect(r.href).toBe("https://example.org/ch1#intro");
    expect(r.hrefFrom).toBe("local");
    expect(r.shown).toBe(false);
    expect(r.source).toBe("DTH-PHC");
  });

  test("the bare id and pin:/bookmark: forms match too; nothing else is guessed", () => {
    for (const k of ["new-sticky", "pin:new-sticky", "bookmark:who-iris/new-sticky"]) {
      const r = mergeFolio(PUB, { [k]: { shown: true } }, "who-iris").rows.find((x) => x.id === "new-sticky")!;
      expect(r.status).toBe("synced");
      expect(r.key).toBe(k);
    }
    const near = mergeFolio(PUB, { "other/new-sticky": { shown: true } }, "who-iris");
    expect(near.rows.find((x) => x.id === "new-sticky")!.status).toBe("published");
    expect(near.rows.find((x) => x.id === "other/new-sticky")!.status).toBe("unsynced");
  });

  test("two local keys for one published id: the first syncs, the second stays its own row", () => {
    const m2 = mergeFolio(PUB, { "who-iris": { shown: true }, "pin:who-iris": { shown: false } }, "who-iris");
    expect(m2.rows.filter((r) => r.id === "who-iris" && r.status === "synced")).toHaveLength(1);
    expect(m2.rows.find((r) => r.id === "pin:who-iris")!.status).toBe("unsynced");
    expect(m2.counts.local).toBe(2);
  });

  test("a missing or malformed side is empty, not an error", () => {
    expect(mergeFolio(null, null).rows).toEqual([]);
    expect(mergeFolio(PUB, [] as unknown as Record<string, LocalFolioEntry>).counts.local).toBe(0);
    expect(mergeFolio(undefined, LOCAL).counts.unsynced).toBe(2);
    expect(mergeFolio([{ id: "" } as PublishedFolioNode], { x: null as unknown as LocalFolioEntry }).rows).toEqual([]);
  });

  test("it is self-contained, so the page can carry it by toString", () => {
    const src = mergeFolio.toString();
    expect(src).not.toContain("`");
    // input-site: inert #6b8d5dd7 — evaluates this module's own toString'd source; it reads no environment
    const again = new Function("return " + src)() as typeof mergeFolio;
    expect(again(PUB, LOCAL, "who-iris")).toEqual(m);
  });
});

describe("the page loads both sources", () => {
  const html = viewerHtml("../../../../assets/folio/who-iris/index.json", "who-iris");

  test("it carries the merge and reads the reader's folio store", () => {
    expect(html).toContain("var mergeFolio = function mergeFolio(");
    expect(html).toContain('var FOLIO_KEY = "fa-folio-assets";');
    expect(html).toContain('var INSTANCE = "who-iris";');
    expect(html).toContain('<div id="merged" aria-live="polite"></div>');
  });

  test("the projection is fetched past any cache, and fetched again when the tab returns", () => {
    expect(html).toContain('fetch(stamped(DATA_HREF), { cache: "no-store" })');
    expect(html).toContain('"visibilitychange"');
    expect(html).toContain('addEventListener("storage"');
    expect(html).toContain('addEventListener("fa:folio-changed", renderMerged)');
  });
});
