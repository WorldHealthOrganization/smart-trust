/**
 * Each row of `RENDER_AS`'s table, held to `renderToolOutput` — bean `q2wm`.
 * The hostile inputs are the ones a renderer meets: a script tag, an event
 * attribute, a `javascript:` link, and the TAB-split bypass `safeHref`'s own
 * history records.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

import {
  cardDetailHref,
  createLazyWindowLoader,
  renderToolOutput,
  renderWindowDetail,
} from "./render-output.js";
import { ToolOutputSchema, ToolRenderSchema } from "../tools/tool.js";

import { requireHarnessRoot } from "../harness-root.ts";
const SCRIPT = `<script>alert(1)</script><img src=x onerror="alert(2)">`;

describe("renderToolOutput", () => {
  it("text — the default — escapes everything, so no markup survives", () => {
    for (const out of [renderToolOutput(SCRIPT), renderToolOutput(SCRIPT, { as: "text" })]) {
      expect(out).not.toContain("<script");
      expect(out).not.toContain("<img");
      expect(out).toContain("&lt;script&gt;");
    }
  });

  it("url — links a safe scheme, and SHOWS a refused one as text", () => {
    expect(renderToolOutput("https://example.org/a", { as: "url" })).toContain('href="https://example.org/a"');
    const refused: Array<[string, string]> = [
      ["javascript:alert(1)", "javascript:alert(1)"],
      ["java\tscript:alert(1)", "java\tscript:alert(1)"],
      ["data:text/html,<b>x</b>", "data:text/html,&lt;b&gt;x&lt;/b&gt;"],
    ];
    for (const [bad, shown] of refused) {
      const out = renderToolOutput(bad, { as: "url" });
      expect(out).not.toContain("<a");
      expect(out).not.toContain("href=");
      // Shown, as escaped text — not dropped.
      expect(out).toBe(shown);
    }
  });

  it("markdown — renders markup, but raw HTML and a javascript: link do not survive", () => {
    const out = renderToolOutput(`# Title\n\n**bold** [ok](https://example.org) [bad](javascript:alert(1))\n\n${SCRIPT}`, {
      as: "markdown",
    });
    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain('href="https://example.org"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
  });

  it("json — shown escaped in a <pre>, never injected", () => {
    const out = renderToolOutput(`{"a":"${"</pre><script>x</script>"}"}`, { as: "json" });
    expect(out.startsWith("<pre>")).toBe(true);
    expect(out).not.toContain("<script");
    expect(out.match(/<\/pre>/g)).toHaveLength(1);
  });
});

describe("the hint's own rules", () => {
  const port = (schema: string, render?: object) => ({ name: "o", schema: `https://x.test/tool-types/${schema}.schema.json`, ...(render ? { render } : {}) });

  it("absent is allowed, and means text", () => {
    const parsed = ToolOutputSchema.safeParse(port("Markdown"));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.render).toBeUndefined();
    // No hint renders exactly as the `text` hint does.
    expect(renderToolOutput(SCRIPT)).toBe(renderToolOutput(SCRIPT, { as: "text" }));
    expect(renderToolOutput("**bold**")).toBe("**bold**");
  });

  it("anything but text needs a stated reason", () => {
    expect(ToolRenderSchema.safeParse({ as: "markdown" }).success).toBe(false);
    expect(ToolRenderSchema.safeParse({ as: "markdown", reason: "a report a reader reads" }).success).toBe(true);
    expect(ToolRenderSchema.safeParse({ as: "text" }).success).toBe(true);
  });

  it("url and markdown only on an output whose schema IS Url / Markdown", () => {
    expect(ToolOutputSchema.safeParse(port("Url", { as: "url", reason: "r" })).success).toBe(true);
    expect(ToolOutputSchema.safeParse(port("Text", { as: "url", reason: "r" })).success).toBe(false);
    expect(ToolOutputSchema.safeParse(port("Text", { as: "markdown", reason: "r" })).success).toBe(false);
    expect(ToolOutputSchema.safeParse(port("Markdown", { as: "markdown", reason: "r" })).success).toBe(true);
    // Each hint is for its own type only, not for the other's.
    expect(ToolOutputSchema.safeParse(port("Url", { as: "markdown", reason: "r" })).success).toBe(false);
    expect(ToolOutputSchema.safeParse(port("Markdown", { as: "url", reason: "r" })).success).toBe(false);
  });
});

describe("lazy window content fetch on open — bean q2wm", () => {
  it("rendering the board with N cards makes 0 detail fetches up front; opening 1 window fetches only that card and caches it", async () => {
    const cards = [
      { id: "card-1", title: "First card", detailHref: "https://example.org/todos/card-1.jsonld" },
      { id: "card-2", title: "Second card", bodyHref: "https://example.org/todos/card-2.md" },
      { id: "card-3", title: "Third card", artifactHref: "https://example.org/todos/card-3.json" },
      { id: "card-4", title: "Fourth card", jsonldHref: "https://example.org/todos/card-4.jsonld" },
    ];
    const fetchedUrls: string[] = [];
    const loader = createLazyWindowLoader(cards, async (url) => {
      fetchedUrls.push(url);
      return {
        comment: `Loaded body for ${url}`,
        outputs: [
          { name: "report", value: "https://example.org/report", render: { as: "url" } },
        ],
      };
    });

    // Phase 1: rendering all N board tiles makes 0 per-card detail fetches.
    const tiles = loader.renderBoardTiles();
    expect(tiles).toHaveLength(4);
    expect(fetchedUrls).toEqual([]);
    expect(loader.cacheSize()).toBe(0);

    // Phase 2: opening 1 card window triggers exactly 1 fetch for that card,
    // and does NOT pre-fetch the other N - 1 cards.
    const firstOpen = await loader.openWindow("card-2");
    expect(fetchedUrls).toEqual(["https://example.org/todos/card-2.md"]);
    expect(firstOpen.fromCache).toBe(false);
    expect(firstOpen.fetchedUrl).toBe("https://example.org/todos/card-2.md");
    expect(firstOpen.html).toContain("Loaded body for https://example.org/todos/card-2.md");
    expect(firstOpen.html).toContain('href="https://example.org/report"');
    expect(loader.isCached("card-2")).toBe(true);
    expect(loader.isCached("card-1")).toBe(false);
    expect(loader.isCached("card-3")).toBe(false);
    expect(loader.isCached("card-4")).toBe(false);

    // Re-opening the same card window uses the cached result (0 additional fetches).
    const secondOpen = await loader.openWindow("card-2");
    expect(secondOpen.fromCache).toBe(true);
    expect(secondOpen.html).toBe(firstOpen.html);
    expect(fetchedUrls).toHaveLength(1);
  });

  it("neutralises hostile <script>, event attributes, and javascript: URLs in lazy-fetched window content", async () => {
    const cards = [
      { id: "hostile-card", title: "Card with hostile payload", detailHref: "/todos/hostile-card.json" },
    ];
    const fetchedUrls: string[] = [];
    const loader = createLazyWindowLoader(cards, async (url) => {
      fetchedUrls.push(url);
      return JSON.stringify({
        comment: `# Heading\n\n[click](javascript:alert(1)) [ok](https://example.org/safe)\n\n${SCRIPT}`,
        outputs: [
          { name: "textOut", value: SCRIPT, render: { as: "text" } },
          { name: "badUrl", value: "javascript:alert(9)", render: { as: "url" } },
          { name: "tabUrl", value: "java\tscript:alert(9)", render: { as: "url" } },
          { name: "goodUrl", value: "https://example.org/ok", render: { as: "url" } },
          { name: "jsonOut", value: `{"x":"</pre><script>alert(3)</script>"}`, render: { as: "json" } },
        ],
      });
    });

    loader.renderBoardTiles();
    expect(fetchedUrls).toHaveLength(0);

    const opened = await loader.openWindow("hostile-card");
    expect(fetchedUrls).toEqual(["/todos/hostile-card.json"]);
    expect(opened.html).toContain("<h1>Heading</h1>");
    expect(opened.html).toContain('href="https://example.org/safe"');
    expect(opened.html).toContain('href="https://example.org/ok"');
    expect(opened.html).not.toContain("<script");
    expect(opened.html).not.toContain("<img");
    expect(opened.html).not.toContain('onerror="');
    expect(opened.html).not.toContain('href="javascript:');
    expect(opened.html).not.toContain("href=\"java\tscript:");
    // Refused URLs remain visible as escaped text rather than silently disappearing.
    expect(opened.html).toContain("javascript:alert(9)");
  });

  it("refuses to fetch a hostile detailHref scheme and shows it as escaped text", async () => {
    const fetchedUrls: string[] = [];
    const loader = createLazyWindowLoader(
      [
        { id: "bad-scheme", title: "Bad scheme", detailHref: "javascript:alert(1)" },
        { id: "data-scheme", title: "Data scheme", detailHref: "data:text/html,<script>x</script>" },
      ],
      async (url) => {
        fetchedUrls.push(url);
        return "should never be reached";
      },
    );

    const first = await loader.openWindow("bad-scheme");
    const second = await loader.openWindow("data-scheme");
    expect(fetchedUrls).toEqual([]);
    expect(first.html).not.toContain("<a");
    expect(first.html).toContain("javascript:alert(1)");
    expect(second.html).not.toContain("<script");
    expect(second.html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("cardDetailHref and renderWindowDetail preserve inline comments when jsonldHref is only a fallback", () => {
    expect(
      cardDetailHref({
        comment: "Already inline",
        jsonldHref: "/todos/inline.jsonld",
      }),
    ).toBeUndefined();
    expect(
      cardDetailHref({
        jsonldHref: "/todos/lazy.jsonld",
      }),
    ).toBe("/todos/lazy.jsonld");
    const inlineHtml = renderWindowDetail({ comment: "Already inline" });
    expect(inlineHtml).toContain("<p>Already inline</p>");
    expect(inlineHtml).not.toContain("No detail recorded.");
    const emptyHtml = renderWindowDetail({});
    expect(emptyHtml).toContain("No detail recorded.");
  });

  it("docs-ui.js wires lazy fetchCardDetail on openCard (not todoSlot) and renders tool outputs via renderToolOutput", () => {
    const docsUi = readFileSync(
      resolve(requireHarnessRoot(), "site-chrome", "assets", "js", "docs-ui.js"),
      "utf8",
    );
    expect(docsUi).toContain("function renderToolOutput(value, hint)");
    expect(docsUi).toContain("function fetchCardDetail(todo, done)");
    const slotStart = docsUi.indexOf("function todoSlot(row)");
    const slotEnd = docsUi.indexOf("syncStickyPins();", slotStart);
    expect(slotStart).toBeGreaterThan(0);
    expect(slotEnd).toBeGreaterThan(slotStart);
    const slotBlock = docsUi.slice(slotStart, slotEnd);
    expect(slotBlock).not.toContain("fetchCardDetail(");
    const openStart = docsUi.indexOf("function openCard(todo)");
    const openEnd = docsUi.indexOf("/* ── No semantic zoom on the board any more", openStart);
    expect(openStart).toBeGreaterThan(0);
    expect(openEnd).toBeGreaterThan(openStart);
    const openBlock = docsUi.slice(openStart, openEnd);
    expect(openBlock).toContain("fetchCardDetail(todo");
    // Each window output is rendered through renderToolOutput with its own hint.
    const outStart = docsUi.indexOf("function renderWindowOutputs(outputs)");
    expect(outStart).toBeGreaterThan(0);
    const outEnd = docsUi.indexOf("\n  function ", outStart + 1);
    expect(outEnd).toBeGreaterThan(outStart);
    expect(docsUi.slice(outStart, outEnd)).toContain("renderToolOutput(item.value, item.render)");
  });
});
