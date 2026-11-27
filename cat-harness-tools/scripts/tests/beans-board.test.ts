/**
 * `beans-board.ts` draws the platform's own bean board for any checkout. Two
 * properties are checked: the projection is the shared one (same schema tag,
 * the edges resolved both ways), and the page mounts the shared renderer
 * against a RELATIVE data path, with nothing in an inlined script able to
 * close its element early.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BeanNode } from "../beans.ts";
import { boardPage } from "../beans-board.ts";
import { BEAN_INDEX_SCHEMA, beanIndexOf } from "../lib/bean-index.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

function bean(id: string, over: Partial<BeanNode> = {}): BeanNode {
  return {
    id,
    file: `beans/defs/${id}--x.md`,
    title: `bean ${id}`,
    status: "todo",
    type: "task",
    priority: "normal",
    parent: "",
    blocking: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-02T00:00:00Z",
    body: "body",
    ...over,
  };
}

describe("beanIndexOf", () => {
  test("carries the shared schema tag and resolves a block from either end", () => {
    const root = mkdtempSync(join(tmpdir(), "beans-board-"));
    const { document, edges } = beanIndexOf(
      [bean("a", { blocking: ["b"] }), bean("b"), bean("c", { declaredBlockedBy: ["a"] })],
      { repoRoot: root, repoWeb: "https://github.com/example/folio" },
    );
    expect(document.$schema).toBe(BEAN_INDEX_SCHEMA);
    expect(document.repoWeb).toBe("https://github.com/example/folio");
    const items = document.items as { id: string; blocking: string[]; blockedBy: string[] }[];
    expect(items.find((i) => i.id === "a")?.blocking.sort()).toEqual(["b", "c"]);
    expect(items.find((i) => i.id === "c")?.blockedBy).toEqual(["a"]);
    expect(edges.length).toBe(2);
  });
});

describe("boardPage", () => {
  const html = boardPage({ title: "Plans <and> work", repoWeb: "https://github.com/example/folio", harness: HARNESS_ROOT });

  test("mounts work-plan.js on beans only, reading the data relative to the page", () => {
    expect(html).toContain('<meta name="fa-beans-src" content="index.json">');
    expect(html).toContain('data-fa-workplan data-fa-workplan-only="beans"');
    expect(html).toContain("<title>Plans &lt;and&gt; work</title>");
  });

  test("no inlined script or stylesheet can close its element early", () => {
    // Two inlined scripts, two inlined stylesheets, and not one closing tag
    // more: an unescaped `</script` inside an inlined file would add one.
    expect(html.match(/<\/script/gi)?.length).toBe(2);
    expect(html.match(/<\/style/gi)?.length).toBe(2);
  });
});
